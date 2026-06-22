// Build: 2026-06-11T15:55Z — redeploy trigger
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { getEvergreenAsNormalizedList } from './evergreenCalls.js'
import { loadAllFichas, buildFichaPromptBlock, getFichasIndex } from './agentFichasLoader.js'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { google } from 'googleapis'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import Anthropic from '@anthropic-ai/sdk'
import * as cheerio from 'cheerio'

dotenv.config()

const app = express()
const prisma = new PrismaClient()

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key']
}
app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
app.use(express.json({ limit: '10mb' }))

const PORT = process.env.PORT || 4000
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
const ADMIN_SECRET = process.env.ADMIN_SECRET || ''
const APP_BASE_URL = process.env.APP_BASE_URL || 'https://www.alamosinnovacion.com/private'
const PASSWORD_RESET_EXP_MIN = Number(process.env.PASSWORD_RESET_EXP_MIN || '15')

// Email whitelist for Google OAuth login. Comma-separated list of allowed emails.
// If empty, falls back to existing User-table check (any registered user can log in).
// Example value in production: ALLOWED_GOOGLE_EMAILS=talamos@gmail.com
const ALLOWED_GOOGLE_EMAILS = (process.env.ALLOWED_GOOGLE_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

// Anthropic client (Claude) — para análisis de contexto de clientes
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6'
// Modelo más pequeño y rápido para el Roadmap (matching estructurado, no reasoning profundo).
// Reduce dramáticamente el tiempo de respuesta y evita timeouts intermedios.
const CLAUDE_MODEL_FAST = process.env.CLAUDE_MODEL_FAST || 'claude-haiku-4-5-20251001'
const anthropic = ANTHROPIC_API_KEY
  ? new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
      timeout: 120 * 1000,   // 2 min máximo por petición (default es 10min, lo bajamos para fail fast)
      maxRetries: 0,          // Hacemos retries manualmente para tener control fino
    })
  : null

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID || ''
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || ''
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN || ''
const GMAIL_SENDER = process.env.GMAIL_SENDER || ''
const GMAIL_REDIRECT_URI =
  process.env.GMAIL_REDIRECT_URI || 'https://developers.google.com/oauthplayground'

const signToken = (payload: { id: string; email: string; role: string }) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })

const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized.' })
  }
  try {
    jwt.verify(token, JWT_SECRET)
    return next()
  } catch {
    return res.status(401).json({ error: 'Unauthorized.' })
  }
}

const createResetToken = () => {
  const raw = crypto.randomBytes(32).toString('hex')
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  return { raw, hash }
}

const sendPasswordResetEmail = async (to: string, resetLink: string) => {
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN || !GMAIL_SENDER) {
    throw new Error('Gmail API credentials are not configured.')
  }

  const oAuth2Client = new google.auth.OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    GMAIL_REDIRECT_URI
  )
  oAuth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN })

  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client })
  const subject = 'Reset your password'
  const text = `Hello,\n\nUse this link to reset your password (valid for ${PASSWORD_RESET_EXP_MIN} minutes):\n${resetLink}\n\nIf you did not request this, ignore this email.`
  const html = `
    <p>Hello,</p>
    <p>Use this link to reset your password (valid for ${PASSWORD_RESET_EXP_MIN} minutes):</p>
    <p><a href="${resetLink}">${resetLink}</a></p>
    <p>If you did not request this, ignore this email.</p>
  `

  const message = [
    `From: ${GMAIL_SENDER}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    '',
    html || text
  ].join('\n')

  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodedMessage }
  })
}

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string }
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' })
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: 'Invalid credentials.' })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials.' })
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role })
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } })
})

app.post('/auth/google', async (req, res) => {
  const { email, name } = req.body as { email?: string; name?: string }
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' })
  }

  const normalizedEmail = email.toLowerCase()

  // Email whitelist enforcement (defense in depth).
  // Only allow login if the email is explicitly whitelisted in ALLOWED_GOOGLE_EMAILS.
  if (ALLOWED_GOOGLE_EMAILS.length > 0 && !ALLOWED_GOOGLE_EMAILS.includes(normalizedEmail)) {
    return res.status(403).json({ error: 'Unauthorized email.' })
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (!user) {
    return res.status(403).json({ error: 'Unauthorized email.' })
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role })
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: name || user.name } })
})

app.post('/auth/forgot', async (req, res) => {
  const { email } = req.body as { email?: string }
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' })
  }

  const normalizedEmail = email.toLowerCase()
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })

  if (!user) {
    return res.json({ ok: true })
  }

  const { raw, hash } = createResetToken()
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXP_MIN * 60 * 1000)

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } })
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      expiresAt
    }
  })

  const baseUrl = APP_BASE_URL.replace(/\/$/, '')
  const resetLink = `${baseUrl}/reset-password?token=${raw}&email=${encodeURIComponent(normalizedEmail)}`

  try {
    await sendPasswordResetEmail(normalizedEmail, resetLink)
    return res.json({ ok: true })
  } catch (error) {
    console.error('Failed to send reset email:', error)
    return res.status(500).json({ error: 'Failed to send reset email.' })
  }
})

app.post('/auth/reset', async (req, res) => {
  const { token, password } = req.body as { token?: string; password?: string }
  if (!token || !password) {
    return res.status(400).json({ error: 'Token and password are required.' })
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash }
  })

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return res.status(400).json({ error: 'Token is invalid or expired.' })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.user.update({
    where: { id: record.userId },
    data: { passwordHash }
  })
  await prisma.passwordResetToken.update({
    where: { tokenHash },
    data: { usedAt: new Date() }
  })

  return res.json({ ok: true })
})

app.post('/auth/register', async (req, res) => {
  const adminKey = req.headers['x-admin-key']
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
  let isAdmin = false

  if (ADMIN_SECRET && adminKey === ADMIN_SECRET) {
    isAdmin = true
  }
  if (!isAdmin && token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { role?: string }
      if (payload?.role === 'Admin') {
        isAdmin = true
      }
    } catch {
      // ignore invalid token
    }
  }
  if (!isAdmin) {
    return res.status(403).json({ error: 'Forbidden.' })
  }

  const { email, password, name, role } = req.body as {
    email?: string
    password?: string
    name?: string
    role?: string
  }

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' })
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) {
    return res.status(409).json({ error: 'User already exists.' })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      name,
      role: role || 'Worker',
      passwordHash
    }
  })

  res.json({ id: user.id, email: user.email, role: user.role, name: user.name })
})

app.get('/app-data', requireAuth, async (_req, res) => {
  try {
    const record = await prisma.appData.findUnique({ where: { id: 'default' } })
    return res.json({ data: record?.data ?? null, updatedAt: record?.updatedAt ?? null })
  } catch (error) {
    console.error('Failed to fetch app data:', error)
    return res.status(500).json({ error: 'Failed to fetch app data.' })
  }
})

app.put('/app-data', requireAuth, async (req, res) => {
  const { data } = req.body as { data?: unknown }
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Data is required.' })
  }
  try {
    const record = await prisma.appData.upsert({
      where: { id: 'default' },
      create: { id: 'default', data },
      update: { data }
    })
    return res.json({ ok: true, updatedAt: record.updatedAt })
  } catch (error) {
    console.error('Failed to save app data:', error)
    return res.status(500).json({ error: 'Failed to save app data.' })
  }
})

/* ============================================================
   AI — Análisis de contexto de cliente con Claude
   ============================================================ */

// Los 14 campos de contexto que Claude debe rellenar
const CONTEXT_FIELD_KEYS = [
  'businessModel',
  'companyOverview',
  'competitiveAdvantage',
  'ipStrategy',
  'keyAchievements',
  'marketOverview',
  'problemStatement',
  'solutionDescription',
  'targetMarkets',
  'keyTeamMembers',
  'teamOverview',
  'technologyInnovation',
  'currentTRL',
  'rdiRoadmap',
] as const

const SYSTEM_PROMPT = `You are an analyst helping an innovation consultant gather structured context about a client company.
Your goal is to extract concise, factual context information from the available sources (website content, client profile, active projects, and UPLOADED DOCUMENTS such as business plans, pitch decks, NEOTEC plans, etc.).

You will return a STRICT JSON object with these 14 fields (all strings; can be empty if truly unknown):
- businessModel: How the company generates revenue
- companyOverview: 2-3 sentence company summary
- competitiveAdvantage: What makes them different from competitors
- ipStrategy: Patents, trademarks, IP protection approach
- keyAchievements: Notable awards, milestones, traction metrics
- marketOverview: Market context, size, dynamics
- problemStatement: What problem the company solves
- solutionDescription: How they solve it
- targetMarkets: Industries, geographies, customer segments served
- keyTeamMembers: Founders, executives, CEO, CTO, CSO, or key team members. List by NAME with their role when available (e.g., "Maria López (CEO, Co-founder), Juan García (CTO)"). Business plans, NEOTEC plans and similar documents ALMOST ALWAYS contain a dedicated team section — read carefully through ALL uploaded documents, including annexes and CVs.
- teamOverview: Team composition, size, structure, capabilities, headcount distribution
- technologyInnovation: Tech stack, methodologies, R&D approach, scientific or engineering basis
- currentTRL: Technology Readiness Level (e.g., "TRL 7 - System prototype demonstration"). Business plans often state this explicitly — extract the exact level and a short justification.
- rdiRoadmap: R&D&I roadmap — planned research lines, milestones, year-by-year initiatives. Business plans typically include this as a multi-year plan.

IMPORTANT GUIDANCE:
- When UPLOADED DOCUMENTS are present, prioritize them over the website. Documents like business plans, NEOTEC applications, investor pitch decks contain detailed information about team, IP, TRL, and R&D roadmap that is rarely on public websites.
- READ THE ENTIRE document including annexes — team members and CVs are often at the end.
- Extract NAMED PEOPLE when you find them. Do not return empty just because they appear inside a list or in a table.
- If a document is in Spanish, you must still return the values in English, but preserve proper names exactly as written.

Rules:
1. Be concise — 2-4 sentences per field is ideal, no longer than 5
2. Use ONLY information from the provided sources (no external knowledge)
3. Return empty string "" ONLY when you genuinely cannot find anything in any source
4. Write in English, but keep proper names (people, products, places) in their original language
5. Be factual, no marketing fluff, no speculation, no hallucination

Return ONLY a valid JSON object — no markdown code fences, no commentary, no preamble.`

async function fetchWebsiteContent(url: string): Promise<{ ok: boolean; content: string; error?: string }> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AlamosBot/1.0; +https://alamosinnovacion.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
      redirect: 'follow',
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      return { ok: false, content: '', error: `HTTP ${response.status}` }
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Limpiar elementos que no aportan contenido textual
    $('script, style, nav, footer, header, iframe, noscript, svg, img, picture, video, audio').remove()

    const title = $('title').first().text().trim()
    const metaDesc = $('meta[name="description"]').attr('content') || ''
    const metaOg = $('meta[property="og:description"]').attr('content') || ''

    // Extraer texto principal (body), limpiar whitespace, limitar tamaño
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 10000)

    const sections = [
      title && `PAGE TITLE: ${title}`,
      metaDesc && `META DESCRIPTION: ${metaDesc}`,
      metaOg && `OG DESCRIPTION: ${metaOg}`,
      bodyText && `BODY CONTENT:\n${bodyText}`,
    ].filter(Boolean)

    return { ok: true, content: sections.join('\n\n') }
  } catch (err: any) {
    return {
      ok: false,
      content: '',
      error: err?.name === 'AbortError' ? 'Timeout fetching website' : err?.message || 'Unknown error',
    }
  }
}

interface AnalyzePayload {
  customer?: {
    name?: string
    company?: string
    country?: string
    region?: string
    companySize?: string
    revenue?: string
    shareCapital?: string
    employees?: string
    memberOf?: string[]
    website?: string
    description?: string
  }
  projects?: Array<{
    title?: string
    call?: string
    status?: string
    description?: string
    budgetFunding?: string
    fee?: string
  }>
  documents?: Array<{
    name: string
    text: string
  }>
}

// Máximo de chars por documento al pasarlo a Claude.
// Sonnet 4.6 tiene 200k tokens de contexto. Subimos a 80k chars (~20k tokens)
// para que entren completos planes de empresa con anexos (donde suele ir el equipo).
const MAX_DOC_CHARS = 80000

app.post('/ai/analyze-client-context', requireAuth, async (req, res) => {
  if (!anthropic) {
    return res.status(503).json({
      error: 'AI analysis is not configured. Set ANTHROPIC_API_KEY in environment variables.',
    })
  }

  const { customer, projects, documents } = (req.body || {}) as AnalyzePayload

  if (!customer) {
    return res.status(400).json({ error: 'customer payload is required.' })
  }

  const trace: { websiteFetched: boolean; websiteError?: string } = { websiteFetched: false }

  try {
    // 1. Fetch website content
    let websiteContent = ''
    if (customer.website && /^https?:\/\//i.test(customer.website)) {
      const result = await fetchWebsiteContent(customer.website)
      websiteContent = result.content
      trace.websiteFetched = result.ok
      if (!result.ok) trace.websiteError = result.error
    }

    // 2. Build comprehensive source context
    const clientSection = [
      '=== CLIENT BASICS ===',
      customer.name && `Name: ${customer.name}`,
      customer.company && `Legal Name: ${customer.company}`,
      customer.country && `Country: ${customer.country}`,
      customer.region && `Region: ${customer.region}`,
      customer.companySize && `Company Size: ${customer.companySize}`,
      customer.revenue && `Revenue: ${customer.revenue}`,
      customer.shareCapital && `Share Capital: ${customer.shareCapital}`,
      customer.employees && `Employees: ${customer.employees}`,
      customer.memberOf && customer.memberOf.length > 0 && `Member of: ${customer.memberOf.join(', ')}`,
      customer.description && `\nClient description (provided by consultant):\n${customer.description}`,
    ]
      .filter(Boolean)
      .join('\n')

    const websiteSection = websiteContent
      ? `\n\n=== WEBSITE CONTENT (${customer.website}) ===\n${websiteContent}`
      : `\n\n=== WEBSITE ===\n(Not provided or could not be fetched${trace.websiteError ? ': ' + trace.websiteError : ''})`

    const projectsSection =
      projects && projects.length > 0
        ? `\n\n=== ACTIVE PROJECTS WITH THIS CLIENT ===\n` +
          projects
            .map((p, i) => {
              return [
                `Project ${i + 1}: ${p.title || 'Untitled'}`,
                p.call && `  Call: ${p.call}`,
                p.status && `  Status: ${p.status}`,
                p.budgetFunding && `  Budget: ${p.budgetFunding}`,
                p.fee && `  Fee: ${p.fee}`,
                p.description && `  Description: ${p.description.slice(0, 1000)}`,
              ]
                .filter(Boolean)
                .join('\n')
            })
            .join('\n\n')
        : '\n\n=== PROJECTS ===\n(No funded projects with this client yet)'

    const documentsSection =
      documents && documents.length > 0
        ? `\n\n=== UPLOADED DOCUMENTS ===\n` +
          documents
            .map((d, i) => {
              const text = (d.text || '').slice(0, MAX_DOC_CHARS)
              return `--- Document ${i + 1}: ${d.name} ---\n${text}`
            })
            .join('\n\n')
        : ''

    const fullSources = clientSection + websiteSection + projectsSection + documentsSection

    // 3. Call Claude
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Analyze this client based on the sources below and return the 14 context fields as a strict JSON object.\n\nSOURCES:\n\n${fullSources}`,
        },
      ],
    })

    // 4. Parse response
    const firstBlock = message.content[0]
    const text = firstBlock && firstBlock.type === 'text' ? firstBlock.text : ''
    let jsonText = text.trim()
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
    }

    let parsed: Record<string, string>
    try {
      parsed = JSON.parse(jsonText)
    } catch (parseErr) {
      console.error('Claude returned invalid JSON:', text.slice(0, 500))
      return res.status(502).json({
        error: 'AI returned invalid JSON',
        raw: text.slice(0, 1000),
      })
    }

    // 5. Build suggestions object with { value, suggested: true } wrapper
    const suggestions: Record<string, { value: string; suggested: boolean }> = {}
    for (const key of CONTEXT_FIELD_KEYS) {
      const value = (parsed[key] || '').toString().trim()
      if (value) {
        suggestions[key] = { value, suggested: true }
      }
    }

    return res.json({
      suggestions,
      analyzedAt: new Date().toISOString(),
      model: CLAUDE_MODEL,
      tokensUsed: {
        input: message.usage?.input_tokens ?? 0,
        output: message.usage?.output_tokens ?? 0,
      },
      trace: {
        ...trace,
        documentsReceived: documents?.length ?? 0,
        documentsChars: (documents ?? []).reduce((sum, d) => sum + (d.text?.length || 0), 0),
        promptChars: fullSources.length,
      },
    })
  } catch (err: any) {
    console.error('AI analysis error:', err)
    return res.status(500).json({
      error: err?.message || 'AI analysis failed',
    })
  }
})

/* ============================================================
   POST /ai/generate-roadmap
   Agente que genera un roadmap estratégico de financiación I+D+i
   para un cliente, sobre un horizonte temporal.
   ============================================================ */

// ───── PRE-SCREENER PROMPT (Pass 1) ─────
// Tarea rápida y barata: dada una lista grande de calls, devuelve los IDs que
// SUPERFICIALMENTE puedan encajar con el cliente. Generoso, mejor incluir borderline.
const SCREENER_SYSTEM_PROMPT = `You are a VERY INCLUSIVE pre-screener for R+D+i funding opportunities.

Given a SHORT client profile and a LARGE list of funding calls, return as many callIds
as PLAUSIBLY could fit this client. The NEXT pass does deep filtering.

YOUR DEFAULT IS TO INCLUDE, NOT EXCLUDE. Bias HEAVILY toward including.

GUIDELINES:
- For a TECH/DIGITAL/LOGISTICS/INDUSTRIAL client: INCLUDE all Horizon Europe, Digital Europe,
  CEF Digital, EIC, EIT, Eurostars, CDTI (any program), Innterconecta, Misiones, Neotec,
  Industria Conectada 4.0, Industria/Comercio/Turismo calls, sustainability/climate/LIFE calls,
  modernización/transformación digital calls.
- For a BIOTECH/HEALTH client: INCLUDE all Horizon Health, ISCIII, IHI, EIT Health calls.
- For a CLEANTECH/SUSTAINABILITY client: INCLUDE all LIFE, IDAE, EIC, climate/green calls.
- DO NOT exclude based on TRL alone — a client may have multiple technologies at different
  TRLs (TRL is subjective and project-specific, NOT a company-wide attribute).
- DO NOT exclude based on amount alone — the client decides what fits their budget.
- ONLY exclude if topic is CLEARLY irrelevant (e.g. film distribution for logistics, beekeeping
  subsidy for tech company).

TARGET: 40-80 callIds minimum. If you cannot find 40, return as many as remotely connect.

Return ONLY a JSON object: { "candidateIds": ["id1", "id2", ...] }
No markdown fences, no surrounding text.`

const ROADMAP_SYSTEM_PROMPT = `You are an expert R+D+i public funding consultant in Spain and the EU.

⚠️ LANGUAGE — IMPORTANT:
ALL human-readable fields in your output (reasoning, applicationGuidance, risks,
executiveSummary, estimatedFundingRange labels) MUST be written in SPANISH
(castellano), regardless of the language of the input data.
The client and the consultant are Spanish. Internal codes/slugs/callIds stay as-is.
Do NOT mix languages in a single field. Do NOT translate program names (CDTI PID,
EIC Accelerator, etc.) — keep their official name.

Your job: given a client profile (company data + tech + funding history + preferences) and a list of
available public funding calls (Spanish BDNS + EU Horizon/Digital Europe/EIC/LIFE/etc), select the BEST
calls that fit this client and build a strategic timeline.

IMPORTANT — the input list is broad and includes ALL R+D+i calls. Many will NOT fit this client.
Your value comes from RIGOROUSLY filtering by sector, technology, target sector, and innovation type.
A call that mentions "innovation" but targets film distribution is NOT relevant for a logistics
tech client. A call targeting environment/climate (LIFE) IS relevant if the client works on
sustainability tech, even if "I+D" doesn't appear in the title.

═══════════════════════════════════════════════════════════════════════
EVERGREEN PROGRAMMES IN THE INPUT
═══════════════════════════════════════════════════════════════════════
The input list ALREADY includes 21 EVERGREEN recurrent programmes (CDTI permanents,
CDTI/AEI annuals, EIC, Eureka, EIT, LIFE, Erasmus+). They have synthetic IDs like
"CDTI-PID-PERMANENT", "EIC-ACCELERATOR-2026", "EUROSTARS-2026". You can identify them
because their typeOfAction field says "Permanently open (evergreen)" or
"Recurrent annual/biannual (evergreen)".

Treat them EXACTLY like any other candidate. Score them with the same method. They are
always available so they tend to score well on "Capacity/timing" dimension.

IMPORTANT — when writing the title of a recommendation, COPY the call's title field
EXACTLY as-is. Do NOT prepend "[Evergreen ...]" or "[Permanent]" or any other tag.
The frontend renders the title verbatim.

═══════════════════════════════════════════════════════════════════════
DECISION CRITERIA (in order of importance):
═══════════════════════════════════════════════════════════════════════
1. SECTORAL FIT: Does the call's target sector/theme match what the client does?
   · Digital/AI/IoT calls → for digital/tech clients
   · LIFE/Climate/Green calls → for sustainability/cleantech clients
   · Health calls → for biotech/medical clients
   · Cultural/Audiovisual → for cultural/media clients (REJECT for non-cultural clients)
   · Industrial calls → for manufacturing/Industry 4.0 clients
2. ELIGIBILITY: Does the client's profile (size, region, partners capability) match
   the call requirements?
3. STRATEGIC FIT: Does the call align with the client's R+D+i roadmap and tech focus?
4. CAPACITY: Can the client realistically prepare and execute (deadlines, co-financing, dedication)?
5. RISK: Avoid overlaps with the client's funding history (no double-funding same project type same year).
6. TIMELINE: Distribute applications across the horizon for steady funding flow, not all in one quarter.

═══════════════════════════════════════════════════════════════════════
IMPORTANT — TRL IS SUBJECTIVE AND MULTI-TECHNOLOGY:
═══════════════════════════════════════════════════════════════════════
A company is NOT defined by a single TRL. A company may have technology line A at TRL 7
(market-ready) AND technology line B at TRL 4 (research stage) AND a roadmap for new TRL 1-3
exploration. NEVER reject a call based solely on TRL fit — assume the client can position
ANY existing or new technology line at whatever TRL the call requires.

The 'currentTRL' field in client profile is a single snapshot for ONE of their technologies,
not a hard constraint. Always include programmes spanning multiple TRLs (CDTI PID covers 4-9,
CDTI Cervera 4-9, EIC Pathfinder 1-3, EIC Transition 3-6, EIC Accelerator 5-9, NEOTEC 4-7) —
the client decides which tech line maps to which call.

Output a JSON object EXACTLY matching this schema:
{
  "executiveSummary": "2-3 sentences explaining the overall strategy for this client.",
  "totalPotentialFunding": "human-readable range, e.g. '€800K - €1.5M'",
  "totalCallsRecommended": <integer>,
  "recommendations": [
    {
      "callId": "<exact callId or externalId from input list>",
      "title": "<call title (copy from input)>",
      "source": "EU_PORTAL" or "BDNS",
      "fitScore": <integer 0-100>,
      "reasoning": "2-3 sentences explaining WHY this call fits this client.",
      "recommendedMonth": "YYYY-MM (when to START preparing — MUST BE STRICTLY IN THE FUTURE, i.e. ≥ next month)",
      "estimatedFundingRange": "human-readable € range",
      "risks": "1 sentence about main risk or watchout.",
      "applicationGuidance": "2-3 sentences of CONCRETE strategic advice on how to ORIENT the proposal for THIS client: which tech line to position, which angle to emphasize, which partner type to seek, what to NOT mention. Practical, actionable, specific to this client+call combo.",
      "expectedStartTRL": <integer 1-9>,
      "expectedEndTRL": <integer 1-9>,
      "techLineId": "<id of the client's tech line this call best serves, or null if generic>",
      "priorityOrder": <integer, 1=highest>
    }
  ]
}

═══════════════════════════════════════════════════════════════════════
TRL RANGE per call (CRITICAL — for client expectation management)
═══════════════════════════════════════════════════════════════════════
For each recommendation, infer the realistic TRL JOURNEY the call enables:
  · expectedStartTRL: minimum TRL the client's tech needs to have to apply
    sensibly (e.g. CDTI PID typical 4-5 to start; EIC Accelerator 6+;
    EIC Pathfinder 1-2; LIC 6-7).
  · expectedEndTRL: realistic TRL achievable AT THE END of the project
    (e.g. PID can reach 6-7; LIC reaches 8; EIC Accelerator can reach 9
    if market-ready; Pathfinder rarely beyond 4).

These DON'T have to match the client's currentTRL → targetTRL. The call
delivers a SLICE of that journey. The frontend will compare and warn the
consultant if the call's expectedEndTRL is LOWER than the client's
targetTRL — that's OK as long as the agent sequences MULTIPLE calls to
cover the full journey.

Use the KNOWLEDGE BASE fichas (if provided) to ground these TRL ranges
in the program's deduced TRL section (typically section §2 of each ficha).

If the client has multiple tech lines in their FundingProfile, set
techLineId to the line this call BEST serves. If the call is generic
or serves multiple lines, set techLineId to null.

═══════════════════════════════════════════════════════════════════════
ELIGIBILITY RULES (HARD CONSTRAINTS — never break)
═══════════════════════════════════════════════════════════════════════
- NEOTEC: ONLY for companies ≤3 years since incorporation. ONCE-IN-LIFETIME per company.
  If client is older than 3y OR already has NEOTEC in funding history → DO NOT RECOMMEND.
- EIC Accelerator: ONLY for SMEs (PYME). If client is grande empresa → exclude.
- EIC Pathfinder/Transition: requires consortium typically. Check preferredProjectType.
- Eurostars: requires consortium with ≥2 Eureka countries. Solo-bid clients should consider
  it only if they have international partners.
- LIFE: requires environment/climate angle. If client has NO sustainability dimension → skip.

OTHER PROGRAMMES (CDTI PID, Cervera, Línea Directa, Misiones, Innterconecta, Torres Quevedo,
Doctorados Industriales, EIC, Horizon, etc.) CAN BE REQUESTED MULTIPLE TIMES by the same
company for DIFFERENT projects or technology lines. Past wins are informational context,
NOT a blocker. Use them only to (a) calibrate the client's track record (b) avoid recommending
the EXACT same project twice in overlapping periods.

═══════════════════════════════════════════════════════════════════════
METHOD — SYSTEMATIC SCORING (DO NOT skip):
═══════════════════════════════════════════════════════════════════════
Before producing the final list, MENTALLY score EVERY call in the candidate list AND every
applicable evergreen programme on these dimensions (each 0-25 points, total 0-100):
  · Sectoral fit (0-25): how well the call's domain matches what the client does
  · Eligibility match (0-25): size, region, project type preference, partners capability
  · Strategic fit (0-25): alignment with client's R+D+i roadmap and tech goals
  · Capacity/timing (0-25): can they prepare and execute given deadlines and resources?

Then SORT by total score and pick the TOP 10-15 (the consultant manually filters afterwards).
A candidate with score 60 must rank below a candidate with score 75 — be consistent.

If you discover during scoring that a non-obvious call scores higher than an obvious pick,
INCLUDE the higher-scoring one. The consultant has explicitly said: "do not skip calls just
because you think they look obvious choices for the consultant manually". Trust your scoring.

═══════════════════════════════════════════════════════════════════════
TEMPORAL DISTRIBUTION (CRITICAL — DO NOT CONDENSE)
═══════════════════════════════════════════════════════════════════════
The horizon is given to you in the user message. USE THE FULL HORIZON.
A 3-year roadmap MUST spread applications across the full 36 months — NOT cluster
all of them in the first 8-11 months. A 2-year roadmap spans 24 months. A 1-year
roadmap spans 12 months.

DISTRIBUTION RULES (HARD):
- recommendedMonth MUST be STRICTLY IN THE FUTURE (≥ next calendar month after today).
  NEVER output a recommendedMonth in the past or current month. EVEN evergreen calls
  must have a future apply month — it's "when to START preparing", which is always future.
- Distribute the 10-15 recommendations evenly across the horizon:
  · 1-year roadmap: ~1 rec/month, no more than 3 in any single month
  · 2-year roadmap: ~5-7 in year 1, ~5-7 in year 2 (no more than 2 in any single month)
  · 3-year roadmap: ~4-5 in year 1, ~4-5 in year 2, ~3-5 in year 3
- For OPEN calls with concrete deadlines (closeDate in the call data), use a recommendedMonth
  that is 3-4 months BEFORE the actual deadline (typical preparation time).
- For EVERGREEN calls (no fixed deadline), spread them later in the horizon — they act
  as "filler" between the timed opens. Don't bunch evergreens in month 1-3.
- The TIMELINE field of the schema tells you the horizon length. RESPECT IT.

═══════════════════════════════════════════════════════════════════════
TRL-AWARE SEQUENCING (R → D → i over time)
═══════════════════════════════════════════════════════════════════════
The client's funding profile contains TRL information per technology line. Use it
to sequence recommendations strategically:

- If the client has technology lines in LOW TRL (1-3, research/exploratory),
  schedule RESEARCH-type calls FIRST (early months): EIC Pathfinder, Doctorados
  Industriales, Misiones-investigación, AEI proyectos básicos. These mature the tech.
- Then in the MIDDLE of the horizon, schedule DEVELOPMENT calls (TRL 4-6):
  CDTI PID, CDTI Cervera, NEOTEC, EIC Transition, Innterconecta.
- Towards the END of the horizon, schedule INNOVATION/SCALE calls (TRL 7-9):
  EIC Accelerator, Línea Directa, ENISA, market-deployment grants.
- If the client's tech is ALREADY in HIGH TRL (7-9), invert — start with
  innovation/scale-up calls (faster impact) and use mid-horizon for new tech
  lines starting from research.
- This R→D→i pacing is the strategic backbone. Don't just sort by deadline.

═══════════════════════════════════════════════════════════════════════
APPLICATION GUIDANCE FIELD (NEW — important for the consultant)
═══════════════════════════════════════════════════════════════════════
For EACH recommendation, the schema requires "applicationGuidance" — a SHORT,
CONCRETE strategic note about how to position THIS proposal for THIS client.
Examples of good guidance:
- "Posicionar la línea de optimización IA como tecnología tractora, no como pieza
  auxiliar. Buscar partner académico (centro tecnológico) para reforzar la dimensión
  investigadora. Evitar enfatizar el componente SaaS comercial — restará en evaluación
  EIC Pathfinder."
- "Apalancarse en la actividad de sostenibilidad ya consolidada para alinear la
  propuesta con el cluster LIFE — Climate Action. Cuantificar reducción CO2 con
  baseline numérica. NO mencionar logística como vertical principal."
- "Aprovechar el track record de CDTI ganados para sustentar la solvencia técnica.
  Estructurar el proyecto en 24 meses con WP de validación TRL 6→7. Marcar como
  cooperative bid con un partner industrial complementario."
Guidance must be ACTIONABLE, SPECIFIC to this client, and tell the consultant
WHAT to do — not just describe the call.

Rules:
- TARGET: 10-15 recommendations. MUST return ≥10 unless candidate list has <10 plausible fits.
- Don't be conservative — include borderline candidates with fitScore 50-65 rather than excluding.
- callId MUST EXIST in candidate list OR be one of the synthetic recurrent IDs from the catalog.
- fitScore in output is the total 0-100 from your scoring above. Make it discriminating —
  don't give everything 80. Range should span (e.g. 55-90 across the 10-15).
- priorityOrder follows fitScore: highest score = priorityOrder 1, then 2, etc.
- recommendedMonth must be STRICTLY FUTURE (≥ next month) and SPREAD across the full horizon.
- Keep reasoning concise (1-2 sentences), risks concise (1 sentence).
- applicationGuidance: 2-3 sentences, concrete and actionable, specific to this client+call.
- Return ONLY the JSON, no surrounding text or markdown. Do NOT wrap in markdown fences.`

interface RoadmapPayload {
  customer: {
    name?: string
    company?: string
    country?: string
    region?: string
    companySize?: string
    category?: string
    description?: string
    incorporationDate?: string // YYYY-MM-DD — para calcular edad empresa (regla NEOTEC ≤3y)
  }
  context?: {
    businessModel?: string
    technologyInnovation?: string
    currentTRL?: string
    rdiRoadmap?: string
    [k: string]: string | undefined
  }
  fundingProfile?: {
    coFinancingCapacityPercent?: number
    preferredProjectType?: string
    desiredAmountRange?: string
    /** Tipos de ayuda que el cliente acepta (grant/loan/participative/equity/mixed) */
    preferredAidTypes?: Array<'grant' | 'loan' | 'participative' | 'equity' | 'mixed'>
    targetTRL?: number  // deprecated single TRL
    /** Multi-tecnología: cada línea con TRL current + target */
    trlProfile?: Array<{
      id: string
      technology: string
      currentTRL: number
      targetTRL: number
      /** Roadmap I+D para llegar al target. El agente lo usa para guidance. */
      rdRoadmap?: string
      /** @deprecated legacy field, fallback */
      notes?: string
    }>
    fundingHistory?: Array<{
      name: string
      organism: string
      programme: string
      year: number
      requestedAmount: number
      grantedAmount?: number
      status: string
      executionStatus?: string
      projectDescription: string
    }>
  }
  calls: Array<{
    externalId: string
    source: 'EU_PORTAL' | 'BDNS'
    title: string
    fundingBody: string
    program: string
    typeOfAction?: string
    region?: string
    budget?: string
    closeDate?: string
    openDate?: string
    externalStatus: string
    rdiScore?: number
    description?: string
  }>
  timeline: 1 | 2 | 3 // años desde hoy
}

app.post('/ai/generate-roadmap', requireAuth, async (req, res) => {
  if (!anthropic) {
    return res.status(503).json({
      error: 'AI roadmap generation is not configured. Set ANTHROPIC_API_KEY.',
    })
  }

  const { customer, context, fundingProfile, calls: rawCalls, timeline } = (req.body || {}) as RoadmapPayload

  if (!customer) return res.status(400).json({ error: 'customer payload is required.' })
  if (!Array.isArray(rawCalls) || rawCalls.length === 0) {
    return res.status(400).json({ error: 'calls payload is required and non-empty.' })
  }
  if (![1, 2, 3].includes(timeline)) {
    return res.status(400).json({ error: 'timeline must be 1, 2 or 3 years.' })
  }

  // Inyecta el catálogo evergreen al pool de calls. El agente las tratará como cualquier otra
  // call, con sus synthetic IDs (CDTI-PID-PERMANENT, EIC-ACCELERATOR-2026, etc.). De-duplicar
  // si por casualidad el cliente ya envía alguna sintética desde Discovery.
  const evergreenCalls = getEvergreenAsNormalizedList()
  const existingIds = new Set(rawCalls.map(c => c.externalId))
  const evergreenToAdd = evergreenCalls.filter(e => !existingIds.has(e.externalId))
  const calls = [...rawCalls, ...evergreenToAdd]
  console.log(`📚 Evergreen catalog injected: ${evergreenToAdd.length} added (of ${evergreenCalls.length} total). Pool: ${calls.length}`)

  try {
    // Edad de la empresa — clave para reglas tipo NEOTEC (solo ≤3 años)
    let companyAgeYears: number | null = null
    if (customer.incorporationDate) {
      const inc = new Date(customer.incorporationDate)
      if (!Number.isNaN(inc.getTime())) {
        companyAgeYears = Math.floor((Date.now() - inc.getTime()) / (365.25 * 86400000))
      }
    }

    // Build client section
    const clientLines = [
      '=== CLIENT PROFILE ===',
      customer.name && `Name: ${customer.name}`,
      customer.company && `Legal name: ${customer.company}`,
      customer.country && `Country: ${customer.country}`,
      customer.region && `Region (CCAA if Spain): ${customer.region}`,
      customer.companySize && `Size: ${customer.companySize}`,
      customer.category && `Category: ${customer.category}`,
      customer.incorporationDate && `Incorporated: ${customer.incorporationDate}`,
      companyAgeYears !== null && `Company age: ~${companyAgeYears} years (${companyAgeYears <= 3 ? 'ELIGIBLE for NEOTEC' : 'NOT eligible for NEOTEC, exceeds 3y'})`,
      customer.description && `\nDescription:\n${customer.description}`,
    ].filter(Boolean).join('\n')

    // Build context section (from CustomerContext AI extraction)
    const contextLines = context
      ? [
          '\n\n=== R+D+i CONTEXT (extracted by AI from docs/website) ===',
          context.businessModel && `Business model: ${context.businessModel}`,
          context.technologyInnovation && `Tech innovation: ${context.technologyInnovation}`,
          context.currentTRL && `Current TRL: ${context.currentTRL}`,
          context.rdiRoadmap && `R+D+i roadmap: ${context.rdiRoadmap}`,
        ].filter(Boolean).join('\n')
      : ''

    // Build funding profile section
    // TRL profile multi-tecnología — IMPORTANTE para que el agente entienda que el cliente
    // puede tener varias líneas técnicas a distintos TRL simultáneamente.
    // Cada línea lleva además su rdRoadmap (hitos para llegar al target TRL) que el agente
    // usa para afinar applicationGuidance.
    const trlLines = (fundingProfile?.trlProfile || []).filter(l => l.technology?.trim())
    const trlSection = trlLines.length > 0
      ? '\nTechnology lines with R&D roadmap to target TRL:\n' +
        trlLines.map(l => {
          const roadmap = l.rdRoadmap || l.notes || ''
          const head = `  · [${l.id}] ${l.technology}: TRL ${l.currentTRL} → TRL ${l.targetTRL}`
          return roadmap.trim()
            ? `${head}\n     R&D roadmap: ${roadmap.trim().replace(/\n/g, ' / ')}`
            : head
        }).join('\n') +
        '\n(Use the [id] as techLineId when assigning a recommendation to a specific tech line.)'
      : ''

    const fpLines = fundingProfile
      ? [
          '\n\n=== FUNDING PROFILE ===',
          fundingProfile.coFinancingCapacityPercent !== undefined &&
            `Co-financing capacity: ${fundingProfile.coFinancingCapacityPercent}%`,
          fundingProfile.preferredProjectType && `Preferred project type: ${fundingProfile.preferredProjectType}`,
          fundingProfile.desiredAmountRange && `Desired amount range: ${fundingProfile.desiredAmountRange}`,
          fundingProfile.preferredAidTypes && fundingProfile.preferredAidTypes.length > 0 &&
            `⚠️ ACCEPTED AID TYPES (FILTER): ${fundingProfile.preferredAidTypes.join(', ')} — DISCARD or strongly penalize calls offering ONLY other instrument types not in this list. If list is missing/empty, no filter applies.`,
          // Legacy single TRL solo si no hay trlProfile y existe
          trlLines.length === 0 && fundingProfile.targetTRL !== undefined &&
            `Target TRL (single — legacy): ${fundingProfile.targetTRL}`,
          trlSection,
        ].filter(Boolean).join('\n')
      : ''

    // Detección específica de NEOTEC en histórico — única regla de one-shot-lifetime.
    // Otros programas (CDTI PID, Cervera, Línea Directa, etc.) SE PUEDEN volver a solicitar
    // para un proyecto/línea tecnológica distinta. Solo NEOTEC es estricto.
    // Buscamos en TODOS los campos relevantes del histórico (incl. organism y executionStatus).
    const neotecPatterns = /\bNEOTEC\b|\bEBT\b|EMPRESAS\s+DE\s+BASE\s+TECNOL[OÓ]GICA|CDTI[\s-]*NEOTEC/i
    const neotecHits = (fundingProfile?.fundingHistory || []).filter(h => {
      if (h.status !== 'won') return false
      const combined = `${h.name || ''} | ${h.programme || ''} | ${h.organism || ''} | ${h.projectDescription || ''}`
      return neotecPatterns.test(combined)
    })
    const hasWonNeotec = neotecHits.length > 0
    console.log(`🧠 NEOTEC blocklist check: ${hasWonNeotec ? `ACTIVE (${neotecHits.length} matches in history)` : 'inactive'} | history entries: ${fundingProfile?.fundingHistory?.length || 0}`)
    if (hasWonNeotec) {
      neotecHits.forEach(h => console.log(`   ↳ matched: "${h.name}" / "${h.programme}" / "${h.organism}" / "${h.projectDescription?.slice(0, 80)}"`))
    }

    const wonBlocklist = hasWonNeotec
      ? [
          '\n\n═══════════════════════════════════════════════════════════════════════',
          '🚫 HARD BLOCK — CLIENT ALREADY WON NEOTEC',
          '═══════════════════════════════════════════════════════════════════════',
          'NEOTEC is once-in-lifetime per company. The client has WON NEOTEC in the past.',
          'NEVER recommend NEOTEC, CDTI-NEOTEC-ANNUAL-2026, "Empresas de Base Tecnológica",',
          'or any NEOTEC variant. Treat NEOTEC as IF IT DID NOT EXIST in the catalog.',
          '',
          'Other won programmes (CDTI PID, Cervera, Línea Directa, etc.) CAN be reapplied',
          'for different projects or technology lines — the past win is just context.',
        ].join('\n')
      : ''

    // Funding history (helps agent consider track record + amounts + tech themes)
    const historyLines = fundingProfile?.fundingHistory && fundingProfile.fundingHistory.length > 0
      ? [
          '\n\n=== FUNDING HISTORY (past applications, for context — see blocklist above) ===',
          ...fundingProfile.fundingHistory.map((h, i) => {
            const statusStr = h.status === 'won'
              ? `WON${h.executionStatus ? ` (${h.executionStatus})` : ''}`
              : h.status.toUpperCase()
            const amountStr = h.grantedAmount
              ? `granted €${h.grantedAmount.toLocaleString()}`
              : h.requestedAmount > 0 ? `requested €${h.requestedAmount.toLocaleString()}` : ''
            return `${i + 1}. [${statusStr}] ${h.year} — ${h.name} — ${h.organism || '?'} — ${amountStr}\n   ${h.projectDescription}`
          }),
        ].join('\n')
      : ''

    // Calls section — SUPER COMPACT. Una línea por call, separador pipe.
    // Permite enviar 400-600 calls sin saturar el contexto de Haiku.
    // Formato: i|src|ID|title|program|action|region|budget|deadline
    const callsLines = [
      '\n\n=== AVAILABLE FUNDING CALLS (R+D+i pre-filtered, deadline ≥ today) ===',
      `Total: ${calls.length}`,
      `Format: idx|source|externalId|title|program|typeOfAction|region|budget|deadline`,
      ...calls.map((c, i) => {
        return [
          i + 1,
          c.source === 'EU_PORTAL' ? 'EU' : 'ES',
          c.externalId,
          (c.title || '').slice(0, 120).replace(/\|/g, ''),
          (c.program || '').slice(0, 80).replace(/\|/g, ''),
          (c.typeOfAction || '').slice(0, 50).replace(/\|/g, ''),
          (c.region || '').slice(0, 30).replace(/\|/g, ''),
          c.budget || '',
          c.closeDate ? c.closeDate.split('T')[0] : '',
        ].join('|')
      }),
    ].join('\n')

    const fullPrompt = clientLines + contextLines + fpLines + historyLines + callsLines

    const horizonText = `${timeline} year${timeline === 1 ? '' : 's'} starting today (${new Date().toISOString().split('T')[0]})`

    console.log(`🗺️ Generating roadmap (multi-pass) for ${customer.name} | timeline=${timeline}y | ${calls.length} calls input | model=${CLAUDE_MODEL_FAST}`)

    // Helper genérico para llamar a Claude con streaming + retry
    const callClaude = async (
      systemPrompt: string,
      userMessage: string,
      maxTokens: number,
      label: string,
    ): Promise<{ text: string; inputTokens: number; outputTokens: number; stopReason: string | null }> => {
      const attempt = async () => {
        const stream = anthropic!.messages.stream({
          model: CLAUDE_MODEL_FAST,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        })
        const finalMessage = await stream.finalMessage()
        const firstBlock = finalMessage.content[0]
        return {
          text: firstBlock && firstBlock.type === 'text' ? firstBlock.text : '',
          inputTokens: finalMessage.usage?.input_tokens ?? 0,
          outputTokens: finalMessage.usage?.output_tokens ?? 0,
          stopReason: finalMessage.stop_reason || null,
        }
      }
      try {
        return await attempt()
      } catch (e: any) {
        const m = String(e?.message || '')
        if (m.includes('Premature close') || m.includes('ECONNRESET') || m.includes('socket hang up') || m.includes('terminated')) {
          console.warn(`[${label}] retry after: ${m.slice(0, 150)}`)
          await new Promise(r => setTimeout(r, 1500))
          return await attempt()
        }
        throw e
      }
    }

    // ─────────────────────────────────────────────────────────
    // PASS 1: SCREENER — recibe TODAS las calls en formato ultra-compacto,
    // devuelve solo los IDs de las candidatas plausibles.
    // ─────────────────────────────────────────────────────────
    const screenerClientBrief = [
      customer.name && `Client: ${customer.name}`,
      customer.company && `Company: ${customer.company}`,
      customer.country && `Country: ${customer.country}`,
      customer.region && `Region: ${customer.region}`,
      customer.companySize && `Size: ${customer.companySize}`,
      customer.category && `Sector: ${customer.category}`,
      customer.description && `What they do: ${customer.description.slice(0, 300)}`,
      context?.technologyInnovation && `Tech: ${context.technologyInnovation.slice(0, 200)}`,
      context?.businessModel && `Business: ${context.businessModel.slice(0, 150)}`,
    ].filter(Boolean).join('\n')

    const screenerCallsList = calls.map((c, i) => {
      const src = c.source === 'EU_PORTAL' ? 'EU' : 'ES'
      return `${i + 1}|${src}|${c.externalId}|${(c.title || '').slice(0, 100).replace(/\|/g, ' ')}|${(c.program || '').slice(0, 60).replace(/\|/g, ' ')}|${(c.typeOfAction || '').slice(0, 40).replace(/\|/g, ' ')}|${(c.region || '').slice(0, 25)}`
    }).join('\n')

    const screenerUserMsg = `CLIENT PROFILE (short):
${screenerClientBrief}

ALL R+D+i CALLS (idx|src|externalId|title|program|action|region):
${screenerCallsList}

Return JSON { "candidateIds": [...] } with 30-60 callIds that plausibly fit this client. JSON only.`

    console.log(`🔍 Pass 1 (screener): ${calls.length} calls → asking for candidates...`)
    const screenerResult = await callClaude(SCREENER_SYSTEM_PROMPT, screenerUserMsg, 2000, 'screener')
    console.log(`   ↳ ${screenerResult.outputTokens} out tokens, stop=${screenerResult.stopReason}`)

    let candidateIds: string[] = []
    try {
      let screenerJson = screenerResult.text.trim()
      if (screenerJson.startsWith('```')) {
        screenerJson = screenerJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
      }
      const parsed = JSON.parse(screenerJson) as { candidateIds?: string[] }
      candidateIds = Array.isArray(parsed.candidateIds) ? parsed.candidateIds : []
    } catch (e) {
      console.warn('Screener returned invalid JSON. Raw text:', screenerResult.text.slice(0, 300))
    }

    let candidates = calls.filter(c => candidateIds.includes(c.externalId)).slice(0, 60)

    // Fallback: si el screener devuelve 0 (o muy pocas) candidates, le pasamos las TOP 60 por
    // urgencia (deadline más cercano) — más vale algo que nada.
    if (candidates.length < 10) {
      console.warn(`⚠️ Screener returned only ${candidates.length} candidates. Raw screener text:`, screenerResult.text.slice(0, 300))
      console.warn(`   Falling back to TOP 60 calls by deadline urgency.`)
      candidates = calls
        .slice()
        .sort((a, b) => {
          const da = a.closeDate ? new Date(a.closeDate).getTime() : Infinity
          const db = b.closeDate ? new Date(b.closeDate).getTime() : Infinity
          return da - db
        })
        .slice(0, 60)
    }
    console.log(`   ↳ ${candidates.length} candidates selected for pass 2`)

    // ─────────────────────────────────────────────────────────
    // PASS 2: DEEP MATCHER — recibe el contexto completo del cliente + las candidates,
    // hace ranking detallado.
    // ─────────────────────────────────────────────────────────
    const pass2CallsLines = [
      `\n\n=== CANDIDATE CALLS (pre-screened, deadline ≥ today) ===`,
      `Total: ${candidates.length}`,
      `Format: idx|source|externalId|title|program|typeOfAction|region|budget|deadline`,
      ...candidates.map((c, i) => {
        return [
          i + 1,
          c.source === 'EU_PORTAL' ? 'EU' : 'ES',
          c.externalId,
          (c.title || '').slice(0, 120).replace(/\|/g, ' '),
          (c.program || '').slice(0, 80).replace(/\|/g, ' '),
          (c.typeOfAction || '').slice(0, 50).replace(/\|/g, ' '),
          (c.region || '').slice(0, 30).replace(/\|/g, ' '),
          c.budget || '',
          c.closeDate ? c.closeDate.split('T')[0] : '',
        ].join('|')
      }),
    ].join('\n')

    const pass2FullPrompt = clientLines + contextLines + fpLines + wonBlocklist + historyLines + pass2CallsLines

    console.log(`🎯 Pass 2 (deep matcher): ${candidates.length} candidates, promptChars=${pass2FullPrompt.length}`)

    const deepResult = await callClaude(
      ROADMAP_SYSTEM_PROMPT,
      `Build a strategic R+D+i funding roadmap for this client over the next ${horizonText}.

⚠️ HARD REQUIREMENT: Return 10-15 recommendations (NOT fewer than 10 unless candidate list literally has <10 plausible options). The consultant filters manually after — your job is to populate the working set generously, NOT to over-filter. Include borderline candidates with fitScore 50-65 rather than excluding them.

🎯 SOURCE BALANCE (CRITICAL): the roadmap MUST include BOTH:
   - At least 5-8 REAL open/forthcoming calls from the candidate list (Discovery — concrete deadlines)
   - At least 4-6 EVERGREEN calls (recurrent — descriptions start with "[Evergreen ...]")
   Both are PRE-INCLUDED in the candidate list below. Don't pad with evergreen at the expense
   of real opens, and don't ignore evergreen either.

For evergreen calls (cadence permanent or annual), recommendedMonth is an estimate of when
the consultant should start preparation — the actual deadline is flexible/annual.

Apply ELIGIBILITY RULES strictly. If client has WON NEOTEC, NEVER recommend NEOTEC.

⚠️ IDIOMA OBLIGATORIO — TODOS los campos de texto humano del JSON
(executiveSummary, reasoning, applicationGuidance, risks) DEBEN estar
escritos en ESPAÑOL (castellano), sin importar el idioma de las calls
o del contexto. Los nombres oficiales de programas (CDTI PID, EIC
Accelerator, etc.) NO se traducen. NO mezcles idiomas dentro de un
mismo campo.

Return ONLY the JSON object per the schema. No markdown fences, no surrounding text.

${pass2FullPrompt}`,
      7000, // +2000 para acomodar applicationGuidance en 10-15 recs
      'deep-matcher',
    )
    const { text, inputTokens: deepInputTokens, outputTokens, stopReason } = deepResult
    let inputTokens = screenerResult.inputTokens + deepInputTokens
    let totalOutTokens = screenerResult.outputTokens + outputTokens
    console.log(`   ↳ ${outputTokens} out tokens, stop=${stopReason}, total in=${inputTokens}, out=${totalOutTokens}`)
    if (stopReason && stopReason !== 'end_turn') {
      console.warn(`⚠️ Deep matcher stopped unexpectedly: ${stopReason}. Response may be truncated.`)
    }
    let jsonText = text.trim()
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any
    try {
      parsed = JSON.parse(jsonText)
    } catch (parseErr) {
      console.error('Roadmap: Claude returned invalid JSON:', text.slice(0, 500))
      return res.status(502).json({
        error: 'AI returned invalid JSON',
        raw: text.slice(0, 1500),
      })
    }

    const pass2Translation = await translateParsedJsonToSpanishIfNeeded(
      parsed,
      'generate-roadmap pass 2',
      7000,
    )
    parsed = pass2Translation.parsed
    inputTokens += pass2Translation.inputTokens
    totalOutTokens += pass2Translation.outputTokens

    // ─────────────────────────────────────────────────────────
    // PASS 3: RE-SCORING — analiza cada recommendation individualmente para garantizar
    // consistencia con el endpoint /ai/analyze-call-fit. El multi-pass agent a veces da
    // scores conservadores por dividir atención entre 50 calls; aquí re-score cada una.
    // ─────────────────────────────────────────────────────────
    if (Array.isArray(parsed?.recommendations) && parsed.recommendations.length > 0) {
      console.log(`🎯 Pass 3 (re-scoring): ${parsed.recommendations.length} recommendations…`)
      const rescoreStart = Date.now()
      const rescoredRecs = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parsed.recommendations.map(async (rec: any) => {
          // Encuentra la call original en pool (candidates + evergreen)
          const callObj = calls.find(c => c.externalId === rec.callId)
          if (!callObj) {
            console.warn(`   ↳ ${rec.callId}: not in pool, keeping original score`)
            return rec
          }
          try {
            const fitResult = await analyzeCallFitInternal(customer, context, fundingProfile, callObj, timeline)
            return {
              ...rec,
              fitScore: typeof fitResult.parsed.fitScore === 'number' ? fitResult.parsed.fitScore : rec.fitScore,
              reasoning: fitResult.parsed.reasoning || rec.reasoning,
              recommendedMonth: fitResult.parsed.recommendedMonth || rec.recommendedMonth,
              estimatedFundingRange: fitResult.parsed.estimatedFundingRange || rec.estimatedFundingRange,
              risks: fitResult.parsed.risks || rec.risks,
              // Si Pass 3 produce applicationGuidance más detallada la preferimos,
              // si no caemos a la del Pass 2 deep matcher
              applicationGuidance: fitResult.parsed.applicationGuidance || rec.applicationGuidance,
              // TRL ranges: Pass 3 generalmente más afinado, fallback a Pass 2
              expectedStartTRL: typeof fitResult.parsed.expectedStartTRL === 'number' ? fitResult.parsed.expectedStartTRL : rec.expectedStartTRL,
              expectedEndTRL: typeof fitResult.parsed.expectedEndTRL === 'number' ? fitResult.parsed.expectedEndTRL : rec.expectedEndTRL,
              techLineId: fitResult.parsed.techLineId || rec.techLineId,
            }
          } catch (e) {
            console.warn(`   ↳ ${rec.callId}: re-score failed, keeping original`, e instanceof Error ? e.message : '')
            return rec
          }
        })
      )
      // Re-sort por fitScore desc + recompute priorityOrder
      rescoredRecs.sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rescoredRecs.forEach((r: any, i: number) => { r.priorityOrder = i + 1 })

      // ── SANITIZATION: TRL ranges en cada rec (1-9) ──
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rescoredRecs.forEach((r: any) => {
        const clamp = (n: unknown) => {
          if (typeof n !== 'number' || !Number.isFinite(n)) return undefined
          return Math.max(1, Math.min(9, Math.round(n)))
        }
        r.expectedStartTRL = clamp(r.expectedStartTRL)
        r.expectedEndTRL = clamp(r.expectedEndTRL)
        // Si end < start, swap (agente confundido)
        if (r.expectedStartTRL && r.expectedEndTRL && r.expectedEndTRL < r.expectedStartTRL) {
          [r.expectedStartTRL, r.expectedEndTRL] = [r.expectedEndTRL, r.expectedStartTRL]
        }
        // techLineId debe ser string o null
        if (r.techLineId !== null && typeof r.techLineId !== 'string') r.techLineId = null
      })

      // ── SANITIZATION: garantizar fechas SIEMPRE futuras dentro del horizonte ──
      // Defensa frente a agente que devuelve "2025-XX" o fechas pasadas.
      const today = new Date()
      const minMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)  // próximo mes
      const maxMonth = new Date(today.getFullYear() + timeline, today.getMonth(), 1)
      const horizonMonths = timeline * 12

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rescoredRecs.forEach((r: any, idx: number) => {
        const m = r.recommendedMonth as string | undefined
        let valid = false
        let recDate: Date | null = null
        if (m && /^\d{4}-\d{2}$/.test(m)) {
          const [y, mm] = m.split('-').map(Number)
          recDate = new Date(y, mm - 1, 1)
          if (recDate >= minMonth && recDate <= maxMonth) valid = true
        }
        if (!valid) {
          // Distribuir uniformemente: rec idx N de M cae en mes proporcional al horizonte
          const monthOffset = 1 + Math.floor(((idx + 1) * horizonMonths) / (rescoredRecs.length + 1))
          const fallback = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
          const y = fallback.getFullYear()
          const mm = String(fallback.getMonth() + 1).padStart(2, '0')
          console.warn(`   ↳ Sanitized recommendedMonth for ${r.callId}: "${m}" → "${y}-${mm}"`)
          r.recommendedMonth = `${y}-${mm}`
        }
      })

      parsed.recommendations = rescoredRecs
      const rescoreElapsed = ((Date.now() - rescoreStart) / 1000).toFixed(1)
      console.log(`   ↳ re-scored in ${rescoreElapsed}s`)
    }

    return res.json({
      roadmap: parsed,
      generatedAt: new Date().toISOString(),
      model: CLAUDE_MODEL_FAST,
      tokensUsed: {
        input: inputTokens,
        output: totalOutTokens,
      },
      callsConsidered: calls.length,
      callsScreened: candidates.length,
      timeline,
    })
  } catch (err: any) {
    console.error('Roadmap generation error:', err)
    return res.status(500).json({
      error: err?.message || 'Roadmap generation failed',
    })
  }
})

/* ============================================================
   Spanish output guard — heuristic English detection + retry
   ============================================================ */

const ENGLISH_MARKERS_RE = /\b(the|this|that|with|for|from|which|should|would|could|client|company|funding|project|technology|innovation|research)\b/gi

function looksEnglish(s: unknown): boolean {
  if (typeof s !== 'string' || s.length < 30) return false
  const matches = s.match(ENGLISH_MARKERS_RE) || []
  return matches.length >= 3
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function countEnglishHumanFieldsInParsed(parsed: any): number {
  let count = 0
  if (looksEnglish(parsed?.executiveSummary)) count++
  if (looksEnglish(parsed?.reasoning)) count++
  if (looksEnglish(parsed?.applicationGuidance)) count++
  if (looksEnglish(parsed?.risks)) count++
  if (Array.isArray(parsed?.recommendations)) {
    for (const rec of parsed.recommendations) {
      if (looksEnglish(rec?.reasoning)) count++
      if (looksEnglish(rec?.applicationGuidance)) count++
      if (looksEnglish(rec?.risks)) count++
    }
  }
  return count
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function translateParsedJsonToSpanishIfNeeded(
  parsed: any,
  label: string,
  maxTokens = 1500,
): Promise<{ parsed: any; inputTokens: number; outputTokens: number }> {
  if (!anthropic) return { parsed, inputTokens: 0, outputTokens: 0 }

  const fieldsEnglish = countEnglishHumanFieldsInParsed(parsed)
  if (fieldsEnglish < 1) {
    return { parsed, inputTokens: 0, outputTokens: 0 }
  }

  console.warn(`🌐 ${label}: detected English in ${fieldsEnglish} field(s). Retrying with forced translation…`)
  const retryUserMsg = `El siguiente JSON tiene campos en inglés que DEBEN estar en español. Tradúcelos al castellano manteniendo el significado exacto. NO traduzcas nombres oficiales de programas (CDTI PID, EIC Accelerator, Horizon Europe, NEOTEC, etc.). NO cambies números, fechas, ni el callId. Devuelve SOLO el JSON traducido, mismo schema, sin markdown.

JSON original:
${JSON.stringify(parsed)}`

  const retryStream = anthropic.messages.stream({
    model: CLAUDE_MODEL_FAST,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: retryUserMsg }],
  })
  const retryFinal = await retryStream.finalMessage()
  const retryBlock = retryFinal.content[0]
  const retryText = retryBlock && retryBlock.type === 'text' ? retryBlock.text : ''
  let retryJson = retryText.trim()
  if (retryJson.startsWith('```')) {
    retryJson = retryJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
  }
  try {
    const reparsed = JSON.parse(retryJson)
    console.log(`🌐 ✓ ${label} retraducido (${retryFinal.usage?.output_tokens} out tokens)`)
    return {
      parsed: { ...parsed, ...reparsed },
      inputTokens: retryFinal.usage?.input_tokens ?? 0,
      outputTokens: retryFinal.usage?.output_tokens ?? 0,
    }
  } catch {
    console.warn(`🌐 ✗ ${label} retry failed to parse JSON, keeping original`)
    return { parsed, inputTokens: 0, outputTokens: 0 }
  }
}

/* ============================================================
   POST /ai/analyze-call-fit
   Análisis del fit de UNA call específica para un cliente.
   Usado cuando el consultor añade una call manualmente al roadmap.
   ============================================================ */

/**
 * Helper interno: analiza el fit de UNA call para un cliente.
 * Usado tanto por el endpoint /ai/analyze-call-fit como por el roadmap (re-scoring pass)
 * para garantizar consistencia entre análisis individuales y roadmap global.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function analyzeCallFitInternal(
  customer: RoadmapPayload['customer'],
  context: RoadmapPayload['context'],
  fundingProfile: RoadmapPayload['fundingProfile'],
  call: RoadmapPayload['calls'][0],
  timeline: number,
): Promise<any> {
  if (!anthropic) throw new Error('Anthropic not configured')

  let companyAgeYears: number | null = null
  if (customer.incorporationDate) {
    const inc = new Date(customer.incorporationDate)
    if (!Number.isNaN(inc.getTime())) {
      companyAgeYears = Math.floor((Date.now() - inc.getTime()) / (365.25 * 86400000))
    }
  }

  const wonProgrammes = (fundingProfile?.fundingHistory || [])
    .filter(h => h.status === 'won')
    .map(h => `${h.name} (${h.organism || '?'} ${h.year})`)

  const trlLines = (fundingProfile?.trlProfile || []).filter(l => l.technology?.trim())
  const trlDetailed = trlLines.length > 0
    ? trlLines.map(l => {
        const roadmap = l.rdRoadmap || l.notes || ''
        const head = `[${l.id}] ${l.technology}: TRL ${l.currentTRL}→${l.targetTRL}`
        return roadmap.trim() ? `${head} {roadmap: ${roadmap.trim().slice(0, 200)}}` : head
      }).join(' | ')
    : ''

  const clientBlock = [
    `Client: ${customer.name || ''} ${customer.company ? `(${customer.company})` : ''}`,
    customer.country && `Country: ${customer.country} · Region: ${customer.region || ''}`,
    customer.companySize && `Size: ${customer.companySize}`,
    companyAgeYears !== null && `Age: ${companyAgeYears} years`,
    customer.description && `Description: ${customer.description.slice(0, 400)}`,
    context?.technologyInnovation && `Tech: ${context.technologyInnovation.slice(0, 300)}`,
    context?.businessModel && `Business: ${context.businessModel.slice(0, 200)}`,
    context?.rdiRoadmap && `R+D+i roadmap: ${context.rdiRoadmap.slice(0, 200)}`,
    trlDetailed && `Technology lines + R&D roadmaps: ${trlDetailed}`,
    fundingProfile?.coFinancingCapacityPercent !== undefined &&
      `Co-financing capacity: ${fundingProfile.coFinancingCapacityPercent}%`,
    fundingProfile?.preferredProjectType && `Project type preference: ${fundingProfile.preferredProjectType}`,
    fundingProfile?.desiredAmountRange && `Desired amount: ${fundingProfile.desiredAmountRange}`,
    fundingProfile?.preferredAidTypes && fundingProfile.preferredAidTypes.length > 0 &&
      `⚠️ Accepted aid types FILTER: ${fundingProfile.preferredAidTypes.join(', ')} — if this call's aid type is NOT in this list, fitScore must drop significantly and risks must explain why.`,
    wonProgrammes.length > 0 && `\n🚫 ALREADY WON (do not propose again): ${wonProgrammes.join(', ')}`,
  ].filter(Boolean).join('\n')

  const callBlock = [
    `Call: ${call.title}`,
    `ID: ${call.externalId}  ·  Source: ${call.source}`,
    `Programme: ${call.program || '?'}`,
    call.typeOfAction && `Type of action: ${call.typeOfAction}`,
    call.region && `Region: ${call.region}`,
    call.budget && `Budget: ${call.budget}`,
    call.closeDate && `Deadline: ${call.closeDate.split('T')[0]}`,
    call.description && `Description: ${call.description.slice(0, 400)}`,
  ].filter(Boolean).join('\n')

  // Si esta call matchea con alguna ficha de programa, inyectamos su contenido
  // como knowledge base autorizativa. Eso da scoring más fino + guidance grounded.
  const fichaBlock = buildFichaPromptBlock({
    title: call.title,
    organism: call.program,
    callId: call.externalId,
    description: call.description,
  })

  const userMsg = `Analyze the FIT of ONE specific funding call for this client.

═══ CLIENT ═══
${clientBlock}

═══ CALL ═══
${callBlock}
${fichaBlock}

TODAY is ${new Date().toISOString().split('T')[0]}. The HORIZON is ${timeline || 2} years.
recommendedMonth MUST be STRICTLY in the FUTURE (≥ next month from today) AND within the horizon.

Return a JSON object EXACTLY matching this schema:
{
  "fitScore": <integer 0-100>,
  "reasoning": "2-3 sentences explaining why this call fits (or does not fit) this client.",
  "recommendedMonth": "YYYY-MM (when to START preparing — STRICTLY FUTURE month, within ${timeline || 2} years of today)",
  "estimatedFundingRange": "human-readable € range (e.g. '€100K-€500K')",
  "risks": "1 sentence about main risk or watchout.",
  "applicationGuidance": "2-3 sentences of CONCRETE strategic advice on how to ORIENT this proposal for THIS client: which tech line to lead with, which angle to emphasize, partner type to seek, what NOT to mention. Specific and actionable.",
  "expectedStartTRL": <integer 1-9 — minimum TRL the client's tech needs to start>,
  "expectedEndTRL": <integer 1-9 — realistic TRL achievable at the end of this project>,
  "techLineId": "<id of the client's tech line this call best serves, or null if generic>",
  "eligibilityFlag": "OK" | "WARNING" | "BLOCKED" (BLOCKED only if hard rules clearly fail, e.g. NEOTEC for ${companyAgeYears && companyAgeYears > 3 ? 'NOT eligible — company exceeds 3y' : 'eligible'})
}

Apply ELIGIBILITY RULES (NEOTEC ≤3y company; if already won, never recommend again; EIC Accelerator SME-only; etc.).
TRL is subjective — never reject solely on TRL.
For TRL-aware sequencing: if call is research-type (Pathfinder, Doctorados, AEI) and client's tech is low TRL → recommend earlier; if call is innovation/scale (Accelerator, Línea Directa) → later in horizon.

⚠️ IDIOMA OBLIGATORIO — TODOS los campos de texto humano del JSON
(reasoning, applicationGuidance, risks) DEBEN estar escritos en
ESPAÑOL (castellano), sin importar el idioma de la call o del contexto.
Los nombres oficiales de programas (CDTI PID, EIC Accelerator, etc.)
NO se traducen. NO mezcles idiomas dentro de un mismo campo.

Return ONLY the JSON, no markdown fences, no surrounding text.`

  const stream = anthropic.messages.stream({
    model: CLAUDE_MODEL_FAST,
    max_tokens: 1500,    // +400 extra: ahora puede usar tips de la ficha para guidance más densa
    system: ROADMAP_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMsg }],
  })
  const finalMessage = await stream.finalMessage()
  const firstBlock = finalMessage.content[0]
  const text = firstBlock && firstBlock.type === 'text' ? firstBlock.text : ''

  let jsonText = text.trim()
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: any = JSON.parse(jsonText)
  let inputTokens = finalMessage.usage?.input_tokens ?? 0
  let outputTokens = finalMessage.usage?.output_tokens ?? 0

  const translation = await translateParsedJsonToSpanishIfNeeded(parsed, 'analyze-call-fit', 1500)
  parsed = translation.parsed
  inputTokens += translation.inputTokens
  outputTokens += translation.outputTokens

  return { parsed, inputTokens, outputTokens }
}

app.post('/ai/analyze-call-fit', requireAuth, async (req, res) => {
  if (!anthropic) {
    return res.status(503).json({ error: 'AI not configured.' })
  }

  const { customer, context, fundingProfile, call, timeline } = (req.body || {}) as RoadmapPayload & {
    call: RoadmapPayload['calls'][0]
  }

  if (!customer || !call) {
    return res.status(400).json({ error: 'customer and call are required.' })
  }

  try {
    const result = await analyzeCallFitInternal(customer, context, fundingProfile, call, timeline)
    return res.json({
      fit: result.parsed,
      analyzedAt: new Date().toISOString(),
      model: CLAUDE_MODEL_FAST,
      tokensUsed: { input: result.inputTokens, output: result.outputTokens },
    })
  } catch (err: any) {
    console.error('analyze-call-fit error:', err)
    return res.status(500).json({ error: err?.message || 'analyze failed' })
  }
})

/* ============================================================
   GET /ai/fichas
   Catálogo público de programas que el agente reconoce con detalle.
   Solo devuelve metadatos (frontmatter), no el contenido completo
   de cada ficha (eso queda como contexto interno del agente).
   ============================================================ */
app.get('/ai/fichas', requireAuth, (_req, res) => {
  const fichas = getFichasIndex()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapped = fichas.map((f: any) => ({
    slug: f.slug,
    organisms: f.frontmatter?.organisms || [],
    aliases: f.frontmatter?.aliases || [],
    aliasCount: (f.frontmatter?.aliases || []).length,
    aidType: f.frontmatter?.aid_type ?? f.frontmatter?.aid_type_internacional ?? null,
    regime: f.frontmatter?.regime ?? null,
    aidObject: f.frontmatter?.aid_object ?? null,
    sectorBound: f.frontmatter?.sector_bound ?? null,
    targetCompany: f.frontmatter?.target_company ?? null,
    collaborationRequired: f.frontmatter?.collaboration_required ?? false,
    internationalRequired: f.frontmatter?.international_required ?? false,
    convocatoriaTipo: f.frontmatter?.convocatoria_tipo ?? null,
    lastUpdated: f.frontmatter?.last_updated ?? f.frontmatter?.fiche_review_date ?? null,
    similarAlternatives: f.frontmatter?.similar_alternatives ?? [],
    exclusiveWith: f.frontmatter?.exclusive_with ?? [],
    sourceUrls: f.frontmatter?.source_urls ?? {},
  }))
  // Total aliases para stats
  const totalAliases = mapped.reduce((sum, f) => sum + f.aliasCount, 0)
  res.json({
    count: mapped.length,
    totalAliases,
    fichas: mapped.sort((a, b) => a.slug.localeCompare(b.slug)),
  })
})

/* ============================================================
   POST /ai/extract-trl-lines
   Extrae líneas tecnológicas + roadmap I+D estructurado a partir
   del contexto del cliente (technologyInnovation, businessModel,
   rdiRoadmap). Devuelve [{technology, currentTRL, targetTRL,
   rdRoadmap}] que el usuario puede aplicar o editar.
   ============================================================ */
const TRL_EXTRACT_PROMPT = `You are an R+D+i consultant who reads a client profile and identifies
distinct technology lines the company is working on, with their current
maturity level (TRL) and a roadmap of milestones to reach a target TRL.

You receive the client's context (technology description, business model,
R+D+i roadmap). Extract 1 to 4 DISTINCT technology lines.

For EACH line, infer:
- technology: short label (3-8 words) of the tech line
- currentTRL (1-9): present maturity. If unclear, estimate from cues:
  · "validated with pilot client" → 6-7
  · "prototype in lab" → 4
  · "concept proven" → 3
  · "preparing first commercial unit" → 8
  · "already in production for clients" → 9
- targetTRL (1-9): realistic level to reach in the next 2-3 years (the
  roadmap horizon of the client).
- rdRoadmap: 2-4 milestones IN PROSE separated by ' / ' that take the
  tech from currentTRL to targetTRL. Use info from the client's context
  literally when available (verbatim milestones, dates, partners).
  Example: "validar prototipo con cliente piloto (TRL 6) / integrar con
  ERP (TRL 7) / certificación industrial CE (TRL 8) / primera unidad
  en producción (TRL 9)".

If the client describes ONE main technology line, return just one.
If they have clearly separate parallel tech lines, return them separately.
NEVER invent technologies the client doesn't mention.

Return JSON EXACTLY:
{
  "lines": [
    { "technology": "...", "currentTRL": <int>, "targetTRL": <int>, "rdRoadmap": "..." }
  ]
}
No markdown, no surrounding text.`

app.post('/ai/extract-trl-lines', requireAuth, async (req, res) => {
  if (!anthropic) {
    return res.status(503).json({ error: 'AI not configured.' })
  }
  const { customer, context } = (req.body || {}) as {
    customer?: { name?: string; company?: string; description?: string; category?: string }
    context?: { technologyInnovation?: string; businessModel?: string; rdiRoadmap?: string }
  }
  if (!context?.technologyInnovation && !context?.rdiRoadmap) {
    return res.status(400).json({
      error: 'No client context available. Please fill in technologyInnovation and/or rdiRoadmap before extracting.',
    })
  }
  try {
    const userBlock = [
      customer?.name && `Client: ${customer.name}${customer.company ? ` (${customer.company})` : ''}`,
      customer?.category && `Sector: ${customer.category}`,
      customer?.description && `Description: ${customer.description.slice(0, 600)}`,
      context.technologyInnovation && `\n=== Technology / Innovation ===\n${context.technologyInnovation.slice(0, 1500)}`,
      context.businessModel && `\n=== Business model ===\n${context.businessModel.slice(0, 600)}`,
      context.rdiRoadmap && `\n=== R+D+i roadmap ===\n${context.rdiRoadmap.slice(0, 1500)}`,
    ].filter(Boolean).join('\n')

    const stream = anthropic.messages.stream({
      model: CLAUDE_MODEL_FAST,
      max_tokens: 1500,
      system: TRL_EXTRACT_PROMPT,
      messages: [{ role: 'user', content: userBlock }],
    })
    const finalMessage = await stream.finalMessage()
    const firstBlock = finalMessage.content[0]
    const text = firstBlock && firstBlock.type === 'text' ? firstBlock.text : ''
    let jsonText = text.trim()
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
    }
    let parsed
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      return res.status(502).json({ error: 'AI returned invalid JSON', raw: text.slice(0, 800) })
    }
    // Sanitización mínima
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lines = (parsed?.lines || []).map((l: any) => ({
      technology: String(l.technology || '').slice(0, 120).trim(),
      currentTRL: Math.max(1, Math.min(9, Math.round(Number(l.currentTRL) || 1))),
      targetTRL: Math.max(1, Math.min(9, Math.round(Number(l.targetTRL) || 9))),
      rdRoadmap: String(l.rdRoadmap || '').slice(0, 800).trim(),
    })).filter((l: { technology: string }) => l.technology.length > 0)
    return res.json({
      lines,
      extractedAt: new Date().toISOString(),
      model: CLAUDE_MODEL_FAST,
      tokensUsed: {
        input: finalMessage.usage?.input_tokens ?? 0,
        output: finalMessage.usage?.output_tokens ?? 0,
      },
    })
  } catch (err: unknown) {
    console.error('extract-trl-lines error:', err)
    return res.status(500).json({ error: err instanceof Error ? err.message : 'extract failed' })
  }
})

/* ============================================================
   DISCOVERY — Sync de calls desde EU Funding Portal y BDNS
   ============================================================ */

type DiscoverySource = 'EU_PORTAL' | 'BDNS'
type ExternalStatus = 'open' | 'forthcoming' | 'closed' | 'unknown'

interface NormalizedCall {
  externalId: string
  source: DiscoverySource
  title: string
  fundingBody: string
  program: string
  typeOfAction?: string
  openDate?: string
  closeDate?: string
  budget?: string
  externalStatus: ExternalStatus
  url: string
  description?: string
  geographicScope?: 'European' | 'National' | 'Regional' | 'International'
  aidType?: 'Grant' | 'Loan' | 'Mixed' | 'Tax Credit'
  actionable: boolean
  region?: string
  /** Relevancia I+D+i score 0-100. EU automáticamente 100. BDNS calculado por keywords + organismos. */
  rdiScore?: number
  /** Razones del score (debug/transparencia para el agente del Roadmap). */
  rdiReasons?: string[]
}

/* ----------------------------------------------------------
   Heurística "actionable" para detectar I+D+i en BDNS
   ---------------------------------------------------------- */

const RDI_KEYWORDS_INCLUDE = [
  'i+d', 'i+d+i', 'idi', 'innovaci', 'investigaci', 'desarrollo tecnológico',
  'tecnologi', 'cientific', 'startup', 'spin-off', 'patent', 'horizon', 'doctorad',
  'doctoral', 'transferencia', 'emprend', 'biomedic', 'biotec', 'aeroespac',
  'aerospace', 'climate', 'energy', 'digital twin', 'inteligencia artificial',
  'artificial intelligence', 'machine learning', 'sostenibilidad', 'cleantech',
]

const RDI_KEYWORDS_EXCLUDE = [
  'ayuntamiento', 'concejal', 'grup municipal', 'becas escolar', 'libros de texto',
  'transporte escolar', 'comedor', 'cultural', 'deportes', 'asociaci',
  'reformas', 'rehabilitación de vivienda', 'social', 'inclusi', 'mayor', 'familia',
  'protecci', 'igualdad', 'fiesta', 'turismo rural', 'agraria', 'pesca',
  'distrito', 'urbanismo', 'medio rural', 'comerci', 'cooperativ', 'fiesta',
  'religios',
]

function isActionable(title: string, body: string): boolean {
  const text = `${title} ${body}`.toLowerCase()
  const hasInclude = RDI_KEYWORDS_INCLUDE.some(k => text.includes(k))
  const hasExclude = RDI_KEYWORDS_EXCLUDE.some(k => text.includes(k))
  // Actionable si hay keyword positiva y NO hay negativa
  return hasInclude && !hasExclude
}

/* ============================================================
   R+D+i RELEVANCE SCORER
   Calcula un score 0-100 indicando cuán relevante es una call
   para I+D+i. EU automáticamente 100 (todo el portal es I+D+i+E).
   BDNS analiza keywords + organismos + programas conocidos.
   Usado como input filter por el Roadmap module.
   ============================================================ */

const RDI_STRONG_ORGS = [
  { kw: 'cdti', label: 'CDTI' },
  { kw: 'agencia estatal de investigación', label: 'Agencia Estatal de Investigación' },
  { kw: 'agencia estatal de investigacion', label: 'AEI' },
  { kw: 'instituto de salud carlos iii', label: 'ISCIII' },
  { kw: 'isciii', label: 'ISCIII' },
  { kw: 'idae', label: 'IDAE' },
  { kw: 'enisa', label: 'ENISA' },
  { kw: 'incibe', label: 'INCIBE' },
  { kw: 'red.es', label: 'RED.es' },
  { kw: 'ministerio de ciencia', label: 'Ministerio Ciencia' },
  { kw: 'ministerio de universidades', label: 'Ministerio Universidades' },
  { kw: 'icex', label: 'ICEX' },
  { kw: 'eoi', label: 'EOI' },
]

const RDI_STRONG_KEYWORDS = [
  { kw: 'i+d+i', label: 'I+D+i' },
  { kw: 'i+d', label: 'I+D' },
  { kw: 'i+i', label: 'I+i' },
  { kw: ' idi ', label: 'IDI' },
  { kw: 'investigación', label: 'investigación' },
  { kw: 'investigacion', label: 'investigación' },
  { kw: 'desarrollo tecnológico', label: 'desarrollo tecnológico' },
  { kw: 'desarrollo tecnologico', label: 'desarrollo tecnológico' },
  { kw: 'innovación', label: 'innovación' },
  { kw: 'innovacion', label: 'innovación' },
  { kw: 'torres quevedo', label: 'Torres Quevedo' },
  { kw: 'doctorado', label: 'doctorado' },
  { kw: 'doctorando', label: 'doctorando' },
  { kw: 'neotec', label: 'Neotec (CDTI)' },
  { kw: 'innterconecta', label: 'Innterconecta (CDTI)' },
  { kw: 'misiones cdti', label: 'Misiones CDTI' },
  { kw: 'misiones de ciencia', label: 'Misiones Ciencia' },
  { kw: 'cervera', label: 'Cervera (CDTI)' },
  { kw: 'innodemanda', label: 'Innodemanda' },
  { kw: 'línea directa', label: 'Línea Directa (CDTI)' },
  { kw: 'linea directa', label: 'Línea Directa (CDTI)' },
  { kw: 'transferencia tecnológica', label: 'transferencia tecnológica' },
  { kw: 'transferencia tecnologica', label: 'transferencia tecnológica' },
  { kw: 'transferencia de tecnología', label: 'transferencia de tecnología' },
  { kw: 'prototipo', label: 'prototipo' },
  { kw: 'demostrador', label: 'demostrador' },
  { kw: 'piloto industrial', label: 'piloto industrial' },
  { kw: ' trl ', label: 'TRL' },
  { kw: 'consorcio i+d', label: 'consorcio I+D' },
  { kw: 'patente', label: 'patente' },
  { kw: 'patentes', label: 'patentes' },
  { kw: 'deep tech', label: 'deep tech' },
  { kw: 'spin-off', label: 'spin-off' },
  { kw: 'spin off', label: 'spin-off' },
  { kw: 'pyme innovadora', label: 'PYME Innovadora' },
  { kw: 'empresa innovadora', label: 'empresa innovadora' },
  { kw: 'plan estatal de investigación', label: 'Plan Estatal Investigación' },
  { kw: 'plan estatal de investigacion', label: 'Plan Estatal Investigación' },
  { kw: 'plan nacional i+d', label: 'Plan Nacional I+D' },
  { kw: 'eureka', label: 'Eureka' },
  { kw: 'eurostars', label: 'Eurostars' },
  { kw: 'horizonte europa', label: 'Horizonte Europa' },
  { kw: 'horizon europe', label: 'Horizon Europe' },
  { kw: 'agrupación empresarial innovadora', label: 'AEI' },
  { kw: 'centro tecnológico', label: 'Centro Tecnológico' },
  { kw: 'valorización', label: 'valorización' },
]

const RDI_MEDIUM_KEYWORDS = [
  { kw: 'modernización', label: 'modernización' },
  { kw: 'modernizacion', label: 'modernización' },
  { kw: 'digitalización', label: 'digitalización' },
  { kw: 'digitalizacion', label: 'digitalización' },
  { kw: 'transformación digital', label: 'transformación digital' },
  { kw: 'transformacion digital', label: 'transformación digital' },
  { kw: 'industrial', label: 'industrial' },
  { kw: 'cooperación', label: 'cooperación' },
  { kw: 'cooperacion', label: 'cooperación' },
  { kw: 'colaboración', label: 'colaboración' },
  { kw: 'colaboracion', label: 'colaboración' },
  { kw: 'emprendimiento', label: 'emprendimiento' },
  { kw: 'tecnológic', label: 'tecnológico' },
  { kw: 'tecnologic', label: 'tecnológico' },
  { kw: 'sostenibilidad', label: 'sostenibilidad' },
  { kw: 'internacionalización', label: 'internacionalización' },
  { kw: 'internacionalizacion', label: 'internacionalización' },
]

interface RdiScoreResult {
  score: number       // 0-100
  reasons: string[]   // qué matched (para debug + transparencia agente)
}

function calculateRdiScore(call: NormalizedCall): RdiScoreResult {
  // EU portal: todo el portal es I+D+i + Emprendimiento + Innovación
  if (call.source === 'EU_PORTAL') {
    return { score: 100, reasons: ['EU funding portal (Horizon/Digital Europe/EIC/etc.)'] }
  }

  // BDNS: analizamos texto
  const text = `${call.title} ${call.fundingBody} ${call.program} ${call.typeOfAction || ''} ${call.description || ''}`.toLowerCase()

  let score = 0
  const reasons: string[] = []

  // Organismo fuerte → 80 (uno solo basta)
  const orgMatch = RDI_STRONG_ORGS.find(o => text.includes(o.kw))
  if (orgMatch) {
    score = Math.max(score, 80)
    reasons.push(`organismo: ${orgMatch.label}`)
  }

  // Keyword fuerte → 70 (cualquiera de la lista)
  const kwMatch = RDI_STRONG_KEYWORDS.find(k => text.includes(k.kw))
  if (kwMatch) {
    score = Math.max(score, 70)
    reasons.push(`keyword: ${kwMatch.label}`)
  }

  // Keywords medios → 20 cada uno, acumulativo, cap 100
  const mediumHits = RDI_MEDIUM_KEYWORDS.filter(m => text.includes(m.kw))
  if (mediumHits.length > 0) {
    score += mediumHits.length * 20
    for (const m of mediumHits) reasons.push(`tema: ${m.label}`)
  }

  return { score: Math.min(score, 100), reasons }
}

/* ----------------------------------------------------------
   EU Funding & Tenders Portal — SEDIA Search API
   ---------------------------------------------------------- */

/**
 * SEDIA Search API requires multipart/form-data, NOT a JSON body.
 * The shape (verified from working Python client `ajruben/sedia-api-fetchers`):
 *
 *   URL params: apiKey=SEDIA & text=*** & pageSize=N & pageNumber=N
 *   Form fields (multipart, each as application/json blob):
 *     - query:     { bool: { must: [ { terms: { type: [...] } }, ... ] } }
 *     - sort:      { field: "deadlineDate", order: "ASC" }
 *     - languages: ["en"]
 *
 * Status codes (verified):
 *   31094501 = Forthcoming, 31094502 = Open, 31094503 = Closed
 *
 * Type codes (verified — grants are 1/2/8, tenders are 0):
 *   grants = ['1','2','8'],  tenders = ['0']
 */
interface EUFetchAttempt {
  description: string
  query: object
  sort: object
  languages: string[]
}

const SEDIA_SEARCH_BASE = 'https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA&text=***'

async function tryEUEndpoint(
  attempt: EUFetchAttempt,
  pageNumber: number = 1,
  pageSize: number = 100, // SEDIA caps at 100 anyway
): Promise<{ ok: boolean; results: unknown[]; total?: number; error?: string }> {
  const url = `${SEDIA_SEARCH_BASE}&pageSize=${pageSize}&pageNumber=${pageNumber}`
  if (pageNumber === 1) {
    console.log(`   📡 Trying: ${attempt.description}`)
    console.log(`      POST ${url}`)
    console.log(`      query: ${JSON.stringify(attempt.query)}`)
    console.log(`      sort:  ${JSON.stringify(attempt.sort)}`)
  } else {
    console.log(`   📡   ↳ Page ${pageNumber}`)
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 25000)

  try {
    // Build multipart/form-data with three JSON blobs.
    // IMPORTANT: do NOT set Content-Type header — fetch auto-adds the boundary.
    const fd = new FormData()
    fd.append('query', new Blob([JSON.stringify(attempt.query)], { type: 'application/json' }), 'blob')
    fd.append('sort', new Blob([JSON.stringify(attempt.sort)], { type: 'application/json' }), 'blob')
    fd.append('languages', new Blob([JSON.stringify(attempt.languages)], { type: 'application/json' }), 'blob')

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AlamosInnovacionCRM/1.0 (research@alamosinnovacion.com)',
      },
      body: fd,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    console.log(`      → HTTP ${response.status} ${response.statusText}`)

    if (!response.ok) {
      const errText = await response.text()
      return { ok: false, results: [], error: `HTTP ${response.status}: ${errText.slice(0, 200)}` }
    }

    const text = await response.text()
    console.log(`      → Response size: ${text.length} chars`)
    if (text.length < 100) {
      console.log(`      → Body: ${text}`)
    }

    let data: unknown
    try {
      data = JSON.parse(text)
    } catch (e) {
      return { ok: false, results: [], error: `Non-JSON: ${text.slice(0, 200)}` }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = (d.results || d.content || d.data || []) as any[]
    const total = typeof d.totalResults === 'number' ? d.totalResults : undefined
    if (total !== undefined) {
      console.log(`      → totalResults=${total}, returned=${results.length}`)
    }
    return { ok: true, results, total }
  } catch (err) {
    clearTimeout(timeoutId)
    const msg = err instanceof Error ? err.message : 'unknown error'
    return { ok: false, results: [], error: msg }
  }
}

async function fetchEUCalls(): Promise<NormalizedCall[]> {
  // ✅ Verified working syntax (multipart/form-data + Elasticsearch DSL).
  //    Test 2026-06-11 confirmed: totalResults=513, statuses=Open/Forthcoming, deadlines future.
  //
  // SEDIA status codes:
  //   31094501 = Forthcoming, 31094502 = Open, 31094503 = Closed
  // SEDIA type codes:
  //   ['1','2','8'] = grants, ['0'] = tenders
  //
  // Field names verified:
  //   metadata.status         array de códigos numéricos
  //   metadata.sortStatus     "1"/"2"/"3"
  //   metadata.callIdentifier prefijo "H2020-..." o "HORIZON-..."
  //   metadata.identifier     topic ID limpio
  //   metadata.frameworkProgramme  código (31045243=H2020, 43108390=Horizon Europe…)
  //   metadata.deadlineDate   array de ISO strings

  const attempts: EUFetchAttempt[] = [
    {
      description: 'SEDIA multipart — Open + Forthcoming grants, sorted by deadline ASC',
      query: {
        bool: {
          must: [
            // type 1=Topic, 2=Call, 8=Cascade/FSTP/competitive calls.
            // Incluimos los 3 porque las cascade (type=8) son oportunidades reales
            // (ej. "Third Call for Pilots"). El bug histórico de "DIGITAL-2023 zombie"
            // se resuelve con la dedup mejorada: type=8 dedupa por REFERENCE (único
            // por cascade), type=1/2 por identifier (de topic). Así no colisionan.
            { terms: { type: ['1', '2', '8'] } },
            { terms: { status: ['31094501', '31094502'] } }, // Forthcoming + Open
          ],
        },
      },
      sort: { field: 'deadlineDate', order: 'ASC' },
      // languages: ['en'] → SEDIA devuelve UNA versión por call (la inglesa).
      // Sin este filtro la misma call vendría en ~25 idiomas → 17.500 records inflados
      // y paginación se quedaba corta (cubría solo los deadlines más cercanos).
      // EU exige que toda call abierta tenga versión EN por norma, no perdemos cobertura.
      languages: ['en'],
    },
    {
      description: 'SEDIA multipart — grants only (no status filter, fallback)',
      query: {
        bool: {
          must: [
            { terms: { type: ['1', '2'] } },
          ],
        },
      },
      sort: { field: 'deadlineDate', order: 'ASC' },
      // languages: ['en'] → SEDIA devuelve UNA versión por call (la inglesa).
      // Sin este filtro la misma call vendría en ~25 idiomas → 17.500 records inflados
      // y paginación se quedaba corta (cubría solo los deadlines más cercanos).
      // EU exige que toda call abierta tenga versión EN por norma, no perdemos cobertura.
      languages: ['en'],
    },
  ]

  // SEDIA cappea pageSize a 100, por eso paginamos.
  // Con languages: ['en'] el portal devuelve ~700 calls únicas; 15 páginas dan margen.
  // Dedup por topic ID se mantiene como defensa por si llega alguna duplicada.
  const PAGE_SIZE = 100
  const MAX_PAGES = 15

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let results: any[] = []
  let lastError = ''

  for (const attempt of attempts) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const acc: any[] = []

    // Página 1 — descubrimos cuántas hay
    const first = await tryEUEndpoint(attempt, 1, PAGE_SIZE)
    if (!first.ok) {
      lastError = first.error || 'unknown error'
      console.log(`   ❌ ${attempt.description}: ${lastError}`)
      continue
    }
    if (first.results.length === 0) {
      lastError = '0 results returned'
      console.log(`   ⚠️  ${attempt.description}: ${lastError}`)
      continue
    }
    acc.push(...first.results)

    const total = first.total ?? acc.length
    const totalPages = Math.min(Math.ceil(total / PAGE_SIZE), MAX_PAGES)
    console.log(`   📊 totalResults=${total} → planning to fetch ${totalPages} pages (capped at ${MAX_PAGES})`)

    // Páginas 2..N
    for (let page = 2; page <= totalPages; page++) {
      const next = await tryEUEndpoint(attempt, page, PAGE_SIZE)
      if (!next.ok) {
        console.log(`   ⚠️  Page ${page} failed: ${next.error}. Continuing with ${acc.length} acumulados.`)
        break
      }
      if (next.results.length === 0) {
        console.log(`   ℹ️  Page ${page} returned 0, stopping`)
        break
      }
      acc.push(...next.results)
    }

    results = acc
    console.log(`   ✅ Accumulated ${results.length} results across ${totalPages} pages from "${attempt.description}"`)
    break
  }

  if (results.length === 0) {
    throw new Error(`EU portal — all attempts failed. Last error: ${lastError}`)
  }

  console.log(`   📦 EU portal raw count: ${results.length}`)

  // Deduplicación con clave compuesta type+ID:
  // - type=1/2 (topic/call): clave = "1::identifier" o "2::identifier"
  //   Misma identifier en distintos idiomas → 1 entry (preferimos EN).
  // - type=8 (cascade/FSTP): clave = "8::REFERENCE" (cada cascade es único)
  //   Mismo identifier pueden compartir varios cascades distintos sin colisionar.
  // - Otro caso raro: fallback a "type::identifier"
  // Resultado: type=1 y type=8 con misma identifier NO colisionan, ambos llegan al filtro
  // de status; el closed se descarta y el cascade open se conserva.
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byId = new Map<string, any>()
    for (const r of results) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const meta = (r as any).metadata || {}
      const type = pickFirst(meta.type)
      const identifier = pickFirst(meta.identifier) || pickFirst(meta.callIdentifier) || pickFirst(meta.callccm2Id)
      const reference = (r as { reference?: string }).reference || pickFirst(meta.REFERENCE)

      let key = ''
      if (type === '8') {
        key = `8::${reference || identifier || ''}`
      } else if (type) {
        key = `${type}::${identifier || reference || ''}`
      } else {
        key = identifier || reference || ''
      }
      if (!key || key.endsWith('::')) continue

      const lang = pickFirst(meta.language).toLowerCase()
      const existing = byId.get(key)
      if (!existing) {
        byId.set(key, r)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existingLang = pickFirst((existing as any).metadata?.language).toLowerCase()
        if (lang === 'en' && existingLang !== 'en') byId.set(key, r)
      }
    }
    const dedupCount = results.length - byId.size
    results = Array.from(byId.values())
    console.log(`   🧹 Deduplicated by (type, ID): ${results.length} unique (removed ${dedupCount} duplicates)`)
  }

  // 🔍 Debug: imprime el PRIMER resultado entero para diagnóstico
  if (results.length > 0) {
    console.log('   🔍 First raw EU result (for field diagnosis):')
    console.log(JSON.stringify(results[0], null, 2).slice(0, 3000))

    // También listamos las KEYS de metadata para entender qué campos están disponibles
    const meta = results[0].metadata || {}
    const keys = Object.keys(meta)
    console.log(`   🔑 Metadata keys (${keys.length}): ${keys.join(', ')}`)

    // Y muestra el valor de los 3-4 campos más relevantes
    for (const k of ['frameworkProgramme', 'frameworkProgrammeDescription', 'frameworkProgrammeAcronym',
                     'programmeAcronym', 'programmeDescription', 'topicIdentifier', 'callIdentifier',
                     'callStatus', 'status', 'deadlineDate', 'plannedOpeningDate', 'budgetOverview',
                     'totalBudget', 'indicativeBudget']) {
      if (meta[k]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const val = Array.isArray(meta[k]) ? `[${(meta[k] as any[]).map(v => `"${v}"`).join(', ')}]` : `"${meta[k]}"`
        console.log(`      ${k}: ${val}`)
      }
    }
  }

  // Filtro JS-side de status — solo Open + Forthcoming
  // Reglas verificadas con la API real:
  //   status[0] === "31094501" → Forthcoming
  //   status[0] === "31094502" → Open
  //   status[0] === "31094503" → Closed
  //   sortStatus[0] === "1"/"2" → Forthcoming/Open
  //   sortStatus[0] === "3" → Closed
  // FILTRO SIMPLIFICADO (decisión del usuario): solo por fecha de cierre.
  //  · Si la call tiene closingDate (cascade type=8) → usar ese
  //  · Si tiene deadlineDate (topic type=1/2) → usar la más tardía del array
  //  · Si la fecha resultante está pasada (más de 1 día) → fuera
  //  · Si no hay fecha → mantener (probablemente Forthcoming sin fecha asignada aún)
  // Confiamos en la fecha como verdad. Ignoramos status, latestInfos, budgetOverview cross-checks.
  const filtered = results.filter(r => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = (r as any).metadata || {}
    // Coge la última fecha del campo correcto según qué exista
    const closingDate = pickLatestDate(meta.closingDate)
    const deadlineDate = pickLatestDate(meta.deadlineDate)
    const effective = closingDate || deadlineDate
    if (!effective) return true // Sin fecha → conservamos (puede ser forthcoming)
    const t = new Date(effective).getTime()
    if (Number.isNaN(t)) return true
    return t >= Date.now() - 86400000 // gracia 1 día por UTC
  })

  console.log(`   📦 EU portal after status filter: ${filtered.length} (was ${results.length})`)
  return filtered.map(r => normalizeEUCall(r)).filter(Boolean) as NormalizedCall[]
}

/* ----------------------------------------------------------
   Mapping de framework programme codes a nombres legibles.
   Verificado con la API real.
   ---------------------------------------------------------- */
// Verified codes from ajruben/sedia-api-fetchers PROGRAMME_IDS dict (June 2026).
// Some codes like 111111 = "Multi" (multi-programme calls) come from SEDIA itself.
const FRAMEWORK_CODE_MAP: Record<string, string> = {
  // Multi-programme + Health
  '111109': '1st Health Programme (1HP)',
  '111110': '2nd Health Programme (2HP)',
  '111111': 'Multi-Programme',
  '31061266': '3rd Health Programme (2014-2020)',
  '43332642': 'EU4Health',

  // Horizon (research & innovation)
  '31045243': 'Horizon 2020 (H2020)',
  '43108390': 'Horizon Europe (HORIZON)',
  '43298916': 'Euratom Research & Training Programme',
  '43089234': 'Innovation Fund (INNOVFUND)',
  '43252449': 'Research Fund for Coal & Steel (RFCS)',
  '31061225': 'Research Fund for Coal & Steel (2014-2020)',

  // Digital, education, culture
  '43152860': 'Digital Europe Programme',
  '43353764': 'Erasmus+',
  '31059093': 'Erasmus+ (2014-2020)',
  '43251814': 'Creative Europe (CREA)',
  '31059083': 'Creative Europe (2014-2020)',
  '43254037': 'European Solidarity Corps (ESC)',

  // Connectivity & infrastructure
  '43251567': 'Connecting Europe Facility (CEF)',
  '31065524': 'CEF (2014-2020)',
  '43253967': 'Renewable Energy Financing Mechanism',

  // Single market & competitiveness
  '43252476': 'Single Market Programme (SMP)',
  '31059643': 'COSME (2014-2020)',
  '44416173': 'Interregional Innovation Investments (I3)',

  // Citizens, rights, justice
  '43251589': 'CERV — Citizens, Equality, Rights & Values',
  '31076817': 'Rights, Equality & Citizenship (2014-2020)',
  '43252386': 'Justice Programme (JUST)',
  '31070247': 'Justice Programme (2014-2020)',
  '43251842': 'EU Anti-Fraud Programme (EUAF)',
  '43252433': 'Pericles IV — Euro Counterfeiting Protection',
  '31084392': 'Hercule III (2014-2020)',

  // Migration, security, borders
  '43251447': 'Asylum, Migration & Integration Fund (AMIF)',
  '31077795': 'AMIF (2014-2020)',
  '43252368': 'Internal Security Fund (ISF)',
  '31077833': 'ISF — Borders & Visa (2014-2020)',
  '31077817': 'ISF — Police (2014-2020)',
  '43251530': 'Border Management & Visa Instrument (BMVI)',
  '43251534': 'Customs Control Equipment Instrument (CCEI)',
  '43253979': 'Customs Programme (CUST)',
  '43253995': 'Fiscalis Programme (FISC)',

  // Defence & civil protection
  '44181033': 'European Defence Fund (EDF)',
  '43298203': 'Union Civil Protection Mechanism (UCPM)',
  '31082527': 'UCPM (2014-2020)',

  // Environment, agriculture, fisheries
  '43252405': 'LIFE — Environment & Climate Action',
  '31107710': 'LIFE (2014-2020)',
  '43298664': 'Agricultural Products Promotion (AGRIP)',
  '31072773': 'AGRIP (2014-2020)',
  '43392145': 'European Maritime, Fisheries & Aquaculture Fund (EMFAF)',
  '31098847': 'EMFF (2014-2020)',
  '43251882': 'Information Measures for CAP (IMCAP)',
  '42198993': 'IMCAP (2014-2020)',

  // Social & cohesion
  '43254019': 'European Social Fund Plus (ESF+)',
  '43252517': 'Social Prerogatives & Specific Competencies Lines (SOCPL)',
  '44773066': 'Just Transition Mechanism (JTM)',
  '44773133': 'Information Measures for EU Cohesion Policy (IMREG)',
  '46324255': 'Technical Assistance for ERDF, CF & JTF',

  // Reform & global
  '43253706': 'Technical Support Instrument (TSI)',
  '42905358': 'Structural Reform Support Programme (2014-2020)',
  '45876777': 'Global Europe (NDICI)',
}

/* ----------------------------------------------------------
   Deriva el nombre legible del programa desde el topic ID
   (HORIZON-CL5-... → "Horizon Europe (HORIZON)")
   ---------------------------------------------------------- */
function deriveProgrammeFromIdentifier(id: string): string {
  const upper = (id || '').toUpperCase()
  // El orden importa: los más específicos primero
  if (upper.startsWith('HORIZON-EIC-') || upper.startsWith('HORIZON-EIC')) return 'Horizon Europe (HORIZON) — EIC'
  if (upper.startsWith('HORIZON-MSCA-')) return 'Horizon Europe (HORIZON) — Marie Skłodowska-Curie Actions'
  if (upper.startsWith('HORIZON-ERC-')) return 'Horizon Europe (HORIZON) — ERC'
  if (upper.startsWith('HORIZON-WIDERA-')) return 'Horizon Europe (HORIZON) — Widening Participation'
  if (upper.startsWith('HORIZON-INFRA-')) return 'Horizon Europe (HORIZON) — Research Infrastructures'
  if (upper.startsWith('HORIZON-MISS-')) return 'Horizon Europe (HORIZON) — Missions'
  if (upper.startsWith('HORIZON-JU-')) return 'Horizon Europe (HORIZON) — Joint Undertakings'
  if (upper.startsWith('HORIZON-')) return 'Horizon Europe (HORIZON)'

  if (upper.startsWith('EIC-')) return 'Horizon Europe — EIC'
  if (upper.startsWith('ERC-')) return 'Horizon Europe — ERC'
  if (upper.startsWith('MSCA-')) return 'Horizon Europe — Marie Skłodowska-Curie Actions'

  if (upper.startsWith('DIGITAL-')) return 'Digital Europe Programme'
  if (upper.startsWith('CEF-')) return 'Connecting Europe Facility'
  if (upper.startsWith('EU4H-')) return 'EU4Health'
  if (upper.startsWith('LIFE-')) return 'LIFE Programme'
  if (upper.startsWith('ERASMUS-')) return 'Erasmus+'
  if (upper.startsWith('CERV-')) return 'CERV Programme'
  if (upper.startsWith('JUST-')) return 'Justice Programme'
  if (upper.startsWith('SOCPL-')) return 'Social Prerogative and Specific Competencies Lines (SOCPL)'
  if (upper.startsWith('AMIF-')) return 'AMIF — Asylum, Migration and Integration Fund'
  if (upper.startsWith('ISF-')) return 'Internal Security Fund'
  if (upper.startsWith('BMVI-')) return 'Border Management and Visa Instrument'
  if (upper.startsWith('SMP-')) return 'Single Market Programme'
  if (upper.startsWith('EMFAF-')) return 'EMFAF — European Maritime, Fisheries and Aquaculture Fund'
  if (upper.startsWith('IMCAP-')) return 'Information Measures relating to CAP'
  if (upper.startsWith('UCPM-')) return 'Union Civil Protection Mechanism'
  if (upper.startsWith('I3-')) return 'Interregional Innovation Investments (I3)'
  if (upper.startsWith('EDF-')) return 'European Defence Fund'
  if (upper.startsWith('IBA-')) return 'Internal Border Areas (IBA)'
  if (upper.startsWith('RFCS-')) return 'Research Fund for Coal and Steel'

  return ''
}

/* ----------------------------------------------------------
   Cluster cuando viene en el identifier (CL1, CL2, CL3 …)
   ---------------------------------------------------------- */
function deriveClusterFromIdentifier(id: string): string {
  const m = (id || '').match(/-CL(\d)-/)
  if (!m) return ''
  const clusterNames: Record<string, string> = {
    '1': 'Health',
    '2': 'Culture, Creativity and Inclusive Society',
    '3': 'Civil Security for Society',
    '4': 'Digital, Industry and Space',
    '5': 'Climate, Energy and Mobility',
    '6': 'Food, Bioeconomy, Natural Resources, Agriculture and Environment',
  }
  return clusterNames[m[1]] || ''
}

// Helper para sacar el primer string de un campo SEDIA (suelen venir como array)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickFirst(field: any): string {
  if (!field) return ''
  if (Array.isArray(field)) return field[0] ? String(field[0]) : ''
  if (typeof field === 'string') return field
  return String(field)
}

// Extrae deadlines REALES desde budgetOverview, matching por topic identifier.
// SEDIA SEARCH tiene metadata.deadlineDate desincronizado del portal real (a veces
// trae fechas del programme period que no son deadlines reales). budgetOverview en
// cambio coincide con el detail API y con lo que muestra el portal.
function extractRealDeadlinesFromBudget(budgetRaw: string, topicIdentifier: string): string[] {
  if (!budgetRaw) return []
  let parsed: unknown
  try { parsed = JSON.parse(budgetRaw) } catch { return [] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actionMap = (parsed as any)?.budgetTopicActionMap
  if (!actionMap || typeof actionMap !== 'object') return []

  const deadlines: string[] = []
  const topicId = (topicIdentifier || '').trim()

  for (const actions of Object.values(actionMap)) {
    if (!Array.isArray(actions)) continue
    for (const action of actions) {
      if (!action || typeof action !== 'object') continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a = action as any
      const actionName = String(a.action || '')
      // Solo deadlines del topic en cuestión
      if (topicId && !actionName.startsWith(topicId)) continue
      if (Array.isArray(a.deadlineDates)) {
        for (const d of a.deadlineDates) {
          if (typeof d === 'string') deadlines.push(d)
          else if (typeof d === 'number') deadlines.push(String(d))
        }
      }
    }
  }
  return deadlines
}

// Detecta si latestInfos contiene texto que indica que la call está cerrada.
// Aunque metadata.status diga "Open", el portal real lo marca como Closed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isStaleClosedByLatestInfos(latestInfos: any): boolean {
  if (!latestInfos) return false
  const arr = Array.isArray(latestInfos) ? latestInfos : [latestInfos]
  for (const item of arr) {
    let entries: unknown[] = []
    if (typeof item === 'string') {
      try {
        const parsed = JSON.parse(item)
        entries = Array.isArray(parsed) ? parsed : [parsed]
      } catch { continue }
    } else if (typeof item === 'object' && item !== null) {
      entries = [item]
    }
    for (const entry of entries) {
      if (typeof entry !== 'object' || entry === null) continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const content = String((entry as any).content || '').toLowerCase()
      // Señales fuertes de que la call está cerrada
      if (content.includes('has closed on the')) return true
      if (content.includes('has been closed')) return true
      if (content.includes('the evaluation for this call is finalised')) return true
      if (content.includes('the call has closed')) return true
    }
  }
  return false
}

// Helper para la deadline más tardía (topics multi-etapa traen múltiples deadlines:
// stage 1 puede estar pasada y stage 2 abierta, queremos la más reciente).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickLatestDate(field: any): string {
  if (!field) return ''
  const arr = Array.isArray(field) ? field : [field]
  let bestIso = ''
  let bestMs = -Infinity
  for (const v of arr) {
    if (!v) continue
    const s = String(v)
    const t = new Date(s).getTime()
    if (!Number.isNaN(t) && t > bestMs) {
      bestMs = t
      bestIso = s
    }
  }
  return bestIso
}

// Helper para detectar si TODAS las fechas del array están en el pasado.
// Útil para descartar calls con deadline expirado aunque SEDIA aún las marque Open.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function allDatesInPast(field: any, graceDays: number = 0): boolean {
  if (!field) return false // sin deadline → no descartamos
  const arr = Array.isArray(field) ? field : [field]
  const cutoff = Date.now() - graceDays * 86400000
  let anyValid = false
  for (const v of arr) {
    if (!v) continue
    const t = new Date(String(v)).getTime()
    if (!Number.isNaN(t)) {
      anyValid = true
      if (t >= cutoff) return false // hay al menos una futura
    }
  }
  return anyValid // true solo si tenía fechas válidas y todas pasadas
}

/**
 * Formatea un total numérico de € en versión compacta: 1.5B / 20M / 500K.
 */
function formatEuroCompact(total: number): string {
  if (total >= 1_000_000_000) return `€${(total / 1_000_000_000).toFixed(1)}B`
  if (total >= 1_000_000) {
    // Para enteros redondos quitamos el ".0"
    const m = total / 1_000_000
    return `€${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`
  }
  if (total >= 10_000) return `€${(total / 1_000).toFixed(0)}K`
  return `€${total.toLocaleString('en-US')}`
}

/**
 * Extrae el budget de un topic EU desde el campo `budgetOverview`.
 * Devuelve string vacío si no se puede determinar.
 *
 * Prioridad:
 *   1. Acciones cuyo "action" empieza por el topic identifier (más preciso).
 *   2. Fallback: suma de TODAS las acciones del call (visión global).
 *
 * Solo suma valores de budgetYearMap (no contribution caps).
 */
function extractEUBudget(budgetRaw: string, topicIdentifier: string): string {
  if (!budgetRaw) return ''

  let parsed: unknown
  try {
    parsed = JSON.parse(budgetRaw)
  } catch {
    return ''
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actionMap = (parsed as any)?.budgetTopicActionMap
  if (!actionMap || typeof actionMap !== 'object') return ''

  let matchedTotal = 0
  let allTotal = 0
  const topicId = (topicIdentifier || '').trim()

  for (const actions of Object.values(actionMap)) {
    if (!Array.isArray(actions)) continue
    for (const action of actions) {
      if (!action || typeof action !== 'object') continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a = action as any
      const actionName = String(a.action || '')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const yearMap = a.budgetYearMap
      if (!yearMap || typeof yearMap !== 'object') continue

      let actionTotal = 0
      for (const v of Object.values(yearMap)) {
        if (typeof v === 'number' && v > 0) actionTotal += v
      }

      allTotal += actionTotal
      // Match estricto: el nombre de la action empieza por el ID del topic.
      if (topicId && actionName.startsWith(topicId)) {
        matchedTotal += actionTotal
      }
    }
  }

  const total = matchedTotal > 0 ? matchedTotal : allTotal
  return total > 0 ? formatEuroCompact(total) : ''
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeEUCall(raw: any): NormalizedCall | null {
  try {
    const meta = raw.metadata || {}

    // ID limpio del topic (campo verificado: metadata.identifier)
    const identifier = pickFirst(meta.identifier) || pickFirst(meta.topicIdentifier) || ''
    // Call identifier separado — usado para derivar el programa
    const callId = pickFirst(meta.callIdentifier) || ''
    if (!identifier && !callId) return null

    const type = pickFirst(meta.type)
    const isCascade = type === '8'

    // externalId: para topics (type 1/2) usamos identifier — único por topic.
    // Para cascade (type 8), DISTINTAS cascade comparten identifier (el del topic padre),
    // así que usamos REFERENCE que sí es único por cada cascade.
    const reference = raw.reference || pickFirst(meta.REFERENCE) || ''
    const externalId = isCascade
      ? (reference || `${identifier}::cascade`)
      : (identifier || callId)

    // Título (campo verificado: metadata.title)
    // Para cascades, callTitle/caName suelen tener el nombre del proyecto financiador.
    const rawTitle = pickFirst(meta.title) || pickFirst(meta.callTitle) || raw.title || ''
    const title = isCascade
      ? (rawTitle ? `[Cascade] ${rawTitle}` : `[Cascade] ${identifier}`)
      : (rawTitle || externalId)

    // ─────────────────────────────────────────────
    // Programa — Triple estrategia (verificada con API real):
    // 1) Diccionario por código de frameworkProgramme
    // 2) Derivar del prefijo del callIdentifier (H2020-... / HORIZON-...)
    // 3) Fallback a "Unknown"
    // ─────────────────────────────────────────────

    const fpCode = pickFirst(meta.frameworkProgramme)
    let framework = FRAMEWORK_CODE_MAP[fpCode] || ''

    // Si no tenemos mapping del código, derivamos del callIdentifier que es legible
    if (!framework) {
      framework = deriveProgrammeFromIdentifier(callId) || deriveProgrammeFromIdentifier(identifier)
    }

    if (!framework && fpCode) framework = `Programme ${fpCode}` // último recurso muestra el código sin disfrazar
    if (!framework) framework = 'Unknown programme'

    // Cluster derivado del topic ID (CL1-CL6) — verificado con HORIZON-CLX-...
    const clusterFromId = deriveClusterFromIdentifier(identifier) || deriveClusterFromIdentifier(callId)
    let program = framework
    if (clusterFromId && !framework.includes(clusterFromId)) {
      program += ` — ${clusterFromId}`
    }

    // Type of action — viene como string array en metadata.typesOfAction
    // Ej. ["Research and Innovation action"], ["HORIZON Coordination and Support Actions"]
    // Para cascade (type=8) no existe ese campo: usamos "Cascade Funding" como etiqueta.
    let typeOfAction = pickFirst(meta.typesOfAction) || ''
    if (!typeOfAction && isCascade) {
      typeOfAction = 'Cascade Funding'
    }

    // Status (campo verificado: metadata.status como código)
    const statusCode = pickFirst(meta.status)
    const sortStatus = pickFirst(meta.sortStatus)
    const externalStatus: ExternalStatus =
      statusCode === '31094501' || sortStatus === '1' ? 'forthcoming' :
      statusCode === '31094502' || sortStatus === '2' ? 'open' :
      statusCode === '31094503' || sortStatus === '3' ? 'closed' : 'unknown'

    // Fechas — closingDate primero (cascade), deadlineDate después (topics).
    // Cogemos la fecha más tardía del array (multi-cut-off → último cut-off).
    const deadlineRaw = pickLatestDate(meta.closingDate) || pickLatestDate(meta.deadlineDate)
    const openRaw = pickFirst(meta.startDate) || pickFirst(meta.plannedOpeningDate)

    // Budget — extracción precisa desde budgetOverview (JSON string complejo).
    // Estructura típica:
    //   {
    //     "budgetTopicActionMap": {
    //       "<actionId>": [{
    //         "action": "<TOPIC-ID> - <RIA|IA|CSA> ...",
    //         "budgetYearMap": { "2024": 20000000, "2025": 30000000 },
    //         "expectedGrants": 0, "minContribution": 0, "maxContribution": 0
    //       }],
    //       ...
    //     }
    //   }
    // Estrategia:
    //   1) Buscamos acciones cuyo "action" empiece por el topic identifier
    //      (eso es la budget del TOPIC concreto, no de toda la call).
    //   2) Si no encontramos match, sumamos TODAS las acciones (budget de la call entera).
    //   3) Solo sumamos valores de budgetYearMap (no expected/min/max contribution).
    const budget = extractEUBudget(pickFirst(meta.budgetOverview), identifier)

    // URL al detalle — construimos a partir del identifier
    const topicSlug = (identifier || callId).toLowerCase()
    const url = `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${topicSlug}`

    // Description — limpiamos HTML del descriptionByte
    const descSource = pickFirst(meta.descriptionByte) || raw.summary || raw.content || ''
    const description = descSource
      .toString()
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 600)

    return {
      externalId,
      source: 'EU_PORTAL',
      title,
      fundingBody: 'European Commission',
      program,
      typeOfAction: typeOfAction || undefined,
      openDate: openRaw || undefined,
      closeDate: deadlineRaw || undefined,
      budget: budget || undefined,
      externalStatus,
      url,
      description: description || undefined,
      geographicScope: 'European',
      aidType: 'Grant',
      actionable: true, // EU portal ya es I+D+i por naturaleza
      // rdiScore se añade fuera del builder para no duplicar lógica
    }
  } catch (err) {
    console.error('normalizeEUCall failed for raw:', JSON.stringify(raw).slice(0, 300))
    console.error(err)
    return null
  }
}

/* ----------------------------------------------------------
   BDNS — Spanish Subvenciones API
   ---------------------------------------------------------- */

/**
 * BDNS estrategia 2-pasos:
 *   1) Search endpoint /api/convocatorias/busqueda → lista de numeroConvocatoria (mínima info)
 *   2) Para cada numeroConvocatoria → detail endpoint con campos completos
 *      (organo, instrumentos, presupuestoTotal, regiones, fechas Inicio/FinSolicitud)
 *
 * Tras el detail, filtramos por fechaFinSolicitud >= hoy.
 * Los detail se piden en paralelo en batches para no saturar el servidor.
 */

const BDNS_SEARCH_BASE = 'https://www.pap.hacienda.gob.es/bdnstrans/api/convocatorias/busqueda'
const BDNS_DETAIL_BASE = 'https://www.pap.hacienda.gob.es/bdnstrans/api/convocatorias'
const BDNS_DETAIL_CONCURRENCY = 30 // detail requests en paralelo
const BDNS_DETAIL_TIMEOUT_MS = 5000 // si un detail tarda > 5s, lo descartamos

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchBDNSDetail(numConv: string | number): Promise<any | null> {
  const url = `${BDNS_DETAIL_BASE}?vpd=GE&numConv=${numConv}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), BDNS_DETAIL_TIMEOUT_MS)
  try {
    const r = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'AlamosInnovacionCRM/1.0' },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!r.ok) return null
    return await r.json()
  } catch {
    clearTimeout(timer)
    return null
  }
}

async function fetchBDNSCalls(): Promise<NormalizedCall[]> {
  // ESTRATEGIA: paginar el search SIN filtro de fecha (porque excluye Forthcoming)
  // y filtrar al organo:
  //   - nivel1 = AUTONOMICA → todos (todas las CCAA)
  //   - nivel1 = ESTADO → solo si nivel2 está en lista cerrada de ministerios
  //   - resto (LOCAL) → descartado
  //
  // BDNS sin filtro fecha devuelve por numeroConvocatoria DESC, así que las primeras
  // páginas son las más recientes. 50 pages × 200 = 10.000 calls cubre ~6 semanas de
  // BDNS activity, más que suficiente para captar Forthcoming + Open recientes.

  // 20 pages × 200 = 4000 calls scanned. Render HTTP timeout ~60s, así que limitamos.
  // CDTI 912587 (numConv ~912587, top numConv ~913524) está en página 5-7, dentro del rango.
  const MAX_SEARCH_PAGES = 20

  // Patrones de match para nivel2 = ministerios relevantes. Substring match
  // (case-insensitive) para tolerar variaciones del nombre completo.
  const ALLOWED_MINISTRY_PATTERNS = [
    'MINISTERIO DE CULTURA',
    'MINISTERIO DE CIENCIA',
    'MINISTERIO DE ASUNTOS EXTERIORES',
    'MINISTERIO PARA LA TRANSFORMACIÓN DIGITAL',
    'MINISTERIO PARA LA TRANSFORMACION DIGITAL', // sin tilde por si BDNS varía
    'MINISTERIO DE INDUSTRIA',
    'MINISTERIO DE TRABAJO',
    'MINISTERIO DE TRANSPORTES',
    'MINISTERIO DE ECONOMÍA',
    'MINISTERIO DE ECONOMIA',
  ]

  // Match autonomic level — BDNS puede usar varias formas
  const AUTONOMIC_LEVEL_PATTERNS = [
    'AUTONOMICA', 'AUTONOMICO', 'AUTONÓMICA', 'AUTONÓMICO',
    'COMUNIDAD AUTONOMA', 'COMUNIDAD AUTÓNOMA',
    'CCAA', 'C.A.', 'AUTONOMIA',
  ]
  // Devuelve true si esta call entra por nuestro filtro de organos
  const isRelevantOrgano = (nivel1?: string, nivel2?: string): boolean => {
    const n1 = String(nivel1 || '').toUpperCase().trim()
    const n2 = String(nivel2 || '').toUpperCase().trim()
    // Autonomic: cualquier variante
    if (AUTONOMIC_LEVEL_PATTERNS.some(p => n1 === p || n1.startsWith(p))) return true
    // Estado: solo los ministerios autorizados
    if (n1 === 'ESTADO') {
      return ALLOWED_MINISTRY_PATTERNS.some(m => n2.includes(m))
    }
    return false
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allRelevantSearchItems = new Map<string | number, { numeroConvocatoria: string | number; nivel1?: string; nivel2?: string }>()

  // Helper para paginar un endpoint con filtros opcionales
  const paginatedSearch = async (label: string, queryParams: string, maxPages: number) => {
    let scanned = 0, relevant = 0
    let stopPaging = false
    const SEARCH_BATCH = 5
    for (let start = 0; start < maxPages && !stopPaging; start += SEARCH_BATCH) {
      const pages = Array.from({ length: Math.min(SEARCH_BATCH, maxPages - start) }, (_, i) => start + i)
      const responses = await Promise.all(pages.map(async p => {
        const url = `${BDNS_SEARCH_BASE}?${queryParams}&pageSize=200&page=${p}`
        try {
          const resp = await fetch(url, {
            headers: { Accept: 'application/json', 'User-Agent': 'AlamosInnovacionCRM/1.0' },
          })
          if (!resp.ok) return { page: p, data: null }
          return { page: p, data: await resp.json() as { content?: unknown[]; last?: boolean } }
        } catch {
          return { page: p, data: null }
        }
      }))
      for (const r of responses) {
        if (!r.data) continue
        const pageItems = (r.data.content || []) as Array<{ numeroConvocatoria?: string | number; nivel1?: string; nivel2?: string }>
        scanned += pageItems.length
        for (const it of pageItems) {
          if (!isRelevantOrgano(it.nivel1, it.nivel2)) continue
          if (it.numeroConvocatoria === undefined || it.numeroConvocatoria === null) continue
          if (!allRelevantSearchItems.has(it.numeroConvocatoria)) relevant++
          allRelevantSearchItems.set(it.numeroConvocatoria, {
            numeroConvocatoria: it.numeroConvocatoria,
            nivel1: it.nivel1,
            nivel2: it.nivel2,
          })
        }
        if (r.data.last || pageItems.length < 200) stopPaging = true
      }
    }
    console.log(`   ↳ [${label}] scanned ${scanned}, ${relevant} new relevant added`)
  }

  console.log(`📡 BDNS search — pagination + text searches in parallel…`)
  // 4 estrategias en paralelo para cubrir más coverage:
  //  1) Recent pagination (calls recientes, captura Forthcoming)
  //  2) Text "CONSEJERÍA" (típica autonómica — Andalucía, Madrid, Galicia, etc.)
  //  3) Text "MINISTERIO" (estatal — refuerza ministerios)
  //  4) Text "AGENCIA" (agencias estatales y autonómicas de innovación)
  await Promise.all([
    paginatedSearch('recent', 'vpd=GE', MAX_SEARCH_PAGES),
    paginatedSearch('CONSEJERÍA', `vpd=GE&descripcion=${encodeURIComponent('CONSEJERÍA')}`, 10),
    paginatedSearch('MINISTERIO', `vpd=GE&descripcion=${encodeURIComponent('MINISTERIO')}`, 5),
    paginatedSearch('AGENCIA', `vpd=GE&descripcion=${encodeURIComponent('AGENCIA')}`, 5),
  ])

  const totalScanned = allRelevantSearchItems.size

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allRelevantSearchItemsArr = Array.from(allRelevantSearchItems.values()) as Array<{ numeroConvocatoria?: string | number; nivel1?: string }>
  console.log(`   ✓ BDNS search: ${allRelevantSearchItemsArr.length} unique calls passed organo filter across all strategies`)
  void totalScanned // suprimir TS unused

  if (allRelevantSearchItemsArr.length === 0) return []

  // Paso 2: Detail por cada uno, en batches paralelos
  const numConvs = allRelevantSearchItemsArr
    .map(it => it.numeroConvocatoria)
    .filter((n): n is string | number => n !== undefined && n !== null)

  console.log(`   📡 Fetching ${numConvs.length} BDNS details in batches of ${BDNS_DETAIL_CONCURRENCY}…`)
  const startMs = Date.now()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const details: any[] = []
  for (let i = 0; i < numConvs.length; i += BDNS_DETAIL_CONCURRENCY) {
    const batch = numConvs.slice(i, i + BDNS_DETAIL_CONCURRENCY)
    const batchResults = await Promise.all(batch.map(n => fetchBDNSDetail(n)))
    details.push(...batchResults.filter(Boolean))
  }
  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1)
  console.log(`   ✓ Retrieved ${details.length}/${numConvs.length} details in ${elapsed}s`)

  // Paso 3a: Filtra por tipoConvocatoria — descartamos Concesión directa
  // (son nominativas con beneficiario predeterminado, no son competitivas, no aplican).
  const beforeTipoFilter = details.length
  const competitiveDetails = details.filter(d => {
    const tipo = String(d?.tipoConvocatoria || '').toUpperCase()
    if (tipo.includes('CONCESIÓN DIRECTA') || tipo.includes('CONCESION DIRECTA')) return false
    return true
  })
  console.log(`   📦 BDNS after tipoConvocatoria filter (excluded Concesión directa): ${competitiveDetails.length} (was ${beforeTipoFilter})`)

  // Paso 3b: Filtra por fechaFinSolicitud >= hoy (con 1 día de gracia por UTC)
  const todayMs = Date.now() - 86400000
  const stillOpen = competitiveDetails.filter(d => {
    const closeStr = d?.fechaFinSolicitud
    if (!closeStr) return true // sin fecha → mantenemos (puede ser Forthcoming sin planificar)
    const t = new Date(String(closeStr)).getTime()
    if (Number.isNaN(t)) return true
    return t >= todayMs
  })
  console.log(`   📦 BDNS after deadline filter: ${stillOpen.length} (was ${details.length})`)

  // Paso 4: Normaliza
  return stillOpen.map(d => normalizeBDNSCall(d)).filter(Boolean) as NormalizedCall[]
}

function formatBDNSDate(d: Date): string {
  // BDNS espera fechas como DD/MM/YYYY o YYYY-MM-DD según endpoint. Probamos DD/MM/YYYY que es lo que devuelve también.
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeBDNSCall(raw: any): NormalizedCall | null {
  try {
    // ID externo
    const externalId = String(
      raw.codigoBDNS ||
      raw.numeroConvocatoria ||
      raw.id ||
      ''
    )
    if (!externalId) return null

    // Título: descripcion es lo más completo
    const title = String(raw.descripcion || raw.descripcionLeng || externalId)

    // Organo es objeto {nivel1, nivel2, nivel3} → program más específico al menos específico
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const organo = (raw.organo || {}) as { nivel1?: string; nivel2?: string; nivel3?: string }
    const organoParts = [organo.nivel3, organo.nivel2, organo.nivel1].filter(Boolean)
    const program = organoParts.length > 0 ? organoParts.join(' · ') : 'Administración Pública'
    // fundingBody: el más específico (nivel3 es la entidad concedente, ej. "AYUNTAMIENTO DE VIGO")
    const fundingBody = organo.nivel3 || organo.nivel2 || organo.nivel1 || 'Administración Pública'

    // Type of Action: combina instrumentos[] + tipoConvocatoria
    //   instrumentos: [{descripcion: 'SUBVENCIÓN Y ENTREGA…'}]
    //   tipoConvocatoria: 'Concesión directa - instrumental'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const instrumentos: Array<{ descripcion?: string }> = Array.isArray(raw.instrumentos) ? raw.instrumentos : []
    const instrumentoStr = instrumentos.map(i => i.descripcion).filter(Boolean).join(', ')
    const tipoConvocatoria = String(raw.tipoConvocatoria || '').trim()
    const typeOfActionParts: string[] = []
    if (instrumentoStr) typeOfActionParts.push(instrumentoStr)
    if (tipoConvocatoria && tipoConvocatoria !== instrumentoStr) typeOfActionParts.push(tipoConvocatoria)
    const typeOfAction = typeOfActionParts.join(' — ') || undefined

    // Region: regiones[] como array de {descripcion}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const regiones: Array<{ descripcion?: string }> = Array.isArray(raw.regiones) ? raw.regiones : []
    const region = regiones.map(r => r.descripcion).filter(Boolean).join(', ') || undefined

    // Budget: presupuestoTotal es un número (no string)
    let budget: string | undefined
    if (typeof raw.presupuestoTotal === 'number' && raw.presupuestoTotal > 0) {
      budget = formatEuroCompact(raw.presupuestoTotal)
    } else if (typeof raw.presupuestoTotal === 'string' && raw.presupuestoTotal) {
      const n = Number(raw.presupuestoTotal)
      if (!Number.isNaN(n) && n > 0) budget = formatEuroCompact(n)
    }

    // Fechas
    const fechaInicio = String(raw.fechaInicioSolicitud || '').trim()
    const fechaFin = String(raw.fechaFinSolicitud || '').trim()

    // externalStatus según las fechas (mismo criterio que EU):
    //   forthcoming = aún no ha empezado el periodo de solicitud
    //   open        = estamos dentro del periodo
    //   closed      = ya pasó la fecha fin
    const now = Date.now()
    const initMs = fechaInicio ? new Date(fechaInicio).getTime() : NaN
    const closeMs = fechaFin ? new Date(fechaFin).getTime() : NaN
    let externalStatus: ExternalStatus = 'unknown'
    if (!Number.isNaN(closeMs) && closeMs < now - 86400000) externalStatus = 'closed'
    else if (!Number.isNaN(initMs) && initMs > now) externalStatus = 'forthcoming'
    else if (!Number.isNaN(closeMs) && closeMs >= now - 86400000) externalStatus = 'open'

    // URL portal de BDNS
    const callUrl = `https://www.pap.hacienda.gob.es/bdnstrans/GE/es/convocatoria/${externalId}`

    return {
      externalId,
      source: 'BDNS',
      title,
      fundingBody,
      program,
      typeOfAction,
      openDate: fechaInicio || undefined,
      closeDate: fechaFin || undefined,
      budget,
      externalStatus,
      url: callUrl,
      description: undefined,
      geographicScope: 'National',
      aidType: 'Grant',
      // Antes filtrábamos por keywords I+D+i, pero perdíamos demasiadas. Marcamos todas
      // como actionable (igual que las EU); el usuario decide en la UI con los filtros.
      actionable: true,
      region,
    }
  } catch (err) {
    console.error('normalizeBDNSCall failed:', err)
    return null
  }
}

function parseSpanishDate(s: string): Date {
  // BDNS devuelve a veces "DD/MM/YYYY", a veces "YYYY-MM-DD"
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) {
    return new Date(`${m[3]}-${m[2]}-${m[1]}`)
  }
  return new Date(s)
}

/* ----------------------------------------------------------
   Endpoint /discovery/sync
   ---------------------------------------------------------- */

app.post('/discovery/sync', requireAuth, async (req, res) => {
  const { source } = (req.body || {}) as { source?: DiscoverySource | 'all' }
  const targets: DiscoverySource[] = source === 'all' || !source
    ? ['EU_PORTAL', 'BDNS']
    : [source]

  const allCalls: NormalizedCall[] = []
  const errors: Record<string, string> = {}

  for (const s of targets) {
    try {
      console.log(`🔭 Discovery: syncing ${s}…`)
      if (s === 'EU_PORTAL') {
        const calls = await fetchEUCalls()
        console.log(`   → EU portal returned ${calls.length} calls`)
        allCalls.push(...calls)
      } else if (s === 'BDNS') {
        const calls = await fetchBDNSCalls()
        console.log(`   → BDNS returned ${calls.length} calls`)
        allCalls.push(...calls)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error(`❌ Discovery sync error for ${s}:`, msg)
      errors[s] = msg
    }
  }

  // Enriquecer cada call con rdiScore (0-100) — usado por el módulo Roadmap como filtro
  for (const c of allCalls) {
    const { score, reasons } = calculateRdiScore(c)
    c.rdiScore = score
    c.rdiReasons = reasons
  }
  const idiHigh = allCalls.filter(c => (c.rdiScore || 0) >= 80).length
  const idiMid = allCalls.filter(c => (c.rdiScore || 0) >= 50 && (c.rdiScore || 0) < 80).length
  console.log(`🎯 R+D+i scoring: ${idiHigh} high (≥80), ${idiMid} mid (50-79), ${allCalls.length - idiHigh - idiMid} low (<50)`)

  res.json({
    calls: allCalls,
    syncedAt: new Date().toISOString(),
    sources: targets,
    errors,
    counts: {
      total: allCalls.length,
      eu: allCalls.filter(c => c.source === 'EU_PORTAL').length,
      bdns: allCalls.filter(c => c.source === 'BDNS').length,
      actionable: allCalls.filter(c => c.actionable).length,
      idiHigh,
      idiMid,
    },
  })
})

// Carga fichas del agente al arrancar
loadAllFichas()

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`)
  console.log(`📚 Agent fichas indexed: ${getFichasIndex().length}`)
  if (!anthropic) {
    console.warn('⚠️  ANTHROPIC_API_KEY not configured — /ai/analyze-client-context will return 503')
  } else {
    console.log(`✅ Anthropic configured with model: ${CLAUDE_MODEL}`)
  }
  console.log('🔭 Discovery endpoint ready at POST /discovery/sync')
})
