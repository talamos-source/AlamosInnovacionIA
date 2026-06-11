import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
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
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null

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
  openDate?: string
  closeDate?: string
  budget?: string
  externalStatus: ExternalStatus
  url: string
  description?: string
  geographicScope?: 'European' | 'National' | 'Regional' | 'International'
  aidType?: 'Grant' | 'Loan' | 'Mixed' | 'Tax Credit'
  actionable: boolean
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

/* ----------------------------------------------------------
   EU Funding & Tenders Portal — SEDIA Search API
   ---------------------------------------------------------- */

interface EUFetchAttempt {
  url: string
  method: 'GET' | 'POST'
  body?: object
  description: string
}

async function tryEUEndpoint(attempt: EUFetchAttempt): Promise<{ ok: boolean; results: unknown[]; error?: string }> {
  console.log(`   📡 Trying: ${attempt.description}`)
  console.log(`      ${attempt.method} ${attempt.url}`)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 25000)

  try {
    const response = await fetch(attempt.url, {
      method: attempt.method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'AlamosInnovacionCRM/1.0 (research@alamosinnovacion.com)',
      },
      body: attempt.body ? JSON.stringify(attempt.body) : undefined,
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
    return { ok: true, results }
  } catch (err) {
    clearTimeout(timeoutId)
    const msg = err instanceof Error ? err.message : 'unknown error'
    return { ok: false, results: [], error: msg }
  }
}

async function fetchEUCalls(): Promise<NormalizedCall[]> {
  // 31094501 = Forthcoming, 31094502 = Open, 31094503 = Closed (en SEDIA)
  // Probamos 3 variantes de endpoint hasta que una funcione

  const attempts: EUFetchAttempt[] = [
    {
      description: 'SEDIA Search API (POST con apiKey)',
      method: 'POST',
      url: 'https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA&text=*&pageSize=300',
      body: {
        languages: ['en'],
        sort: { field: 'deadlineDate', order: 'ASC' },
      },
    },
    {
      description: 'SEDIA Search API (POST minimal body)',
      method: 'POST',
      url: 'https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA&text=%2A&pageSize=300&pageNumber=1',
      body: {},
    },
    {
      description: 'SEDIA Search API (POST con fixedConditions type=Topic)',
      method: 'POST',
      url: 'https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA&text=*&pageSize=300',
      body: {
        languages: ['en'],
        sort: { field: 'deadlineDate', order: 'ASC' },
        fixedConditions: [
          {
            type: 'FixedField',
            field: 'type',
            values: ['1'],
          },
        ],
      },
    },
  ]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let results: any[] = []
  let lastError = ''
  for (const attempt of attempts) {
    const res = await tryEUEndpoint(attempt)
    if (res.ok && res.results.length > 0) {
      results = res.results
      console.log(`   ✅ Got ${results.length} results from "${attempt.description}"`)
      break
    } else if (res.ok && res.results.length === 0) {
      lastError = '0 results returned'
      console.log(`   ⚠️  ${attempt.description}: ${lastError}`)
      // Si una respuesta fue OK pero vacía, probamos la siguiente
    } else {
      lastError = res.error || 'unknown error'
      console.log(`   ❌ ${attempt.description}: ${lastError}`)
    }
  }

  if (results.length === 0) {
    throw new Error(`EU portal — all attempts failed. Last error: ${lastError}`)
  }

  console.log(`   📦 EU portal raw count: ${results.length}`)

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

  // Filtro JS-side de status: solo Open + Forthcoming.
  // Si NO encontramos NINGÚN campo de status reconocible, dejamos pasar
  // (mejor mostrar que filtrar a 0).
  const filtered = results.filter(r => {
    const meta = r.metadata || {}
    const status = (pickFirst(meta.callStatus) || pickFirst(meta.status) || pickFirst(meta.sortStatus) || pickFirst(meta.statusValue)).toLowerCase()
    if (!status) return true // sin status → asumimos que es válido
    if (status === '31094501' || status === '31094502') return true
    if (status.includes('open') || status.includes('forth')) return true
    if (status === '31094503' || status.includes('clos')) return false
    return true // unknown status → lo dejamos pasar también
  })

  console.log(`   📦 EU portal after status filter: ${filtered.length}`)
  return filtered.map(r => normalizeEUCall(r)).filter(Boolean) as NormalizedCall[]
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeEUCall(raw: any): NormalizedCall | null {
  try {
    const meta = raw.metadata || {}

    // ID — probamos múltiples nombres porque SEDIA cambió esquemas varias veces
    const identifier =
      pickFirst(meta.identifier) ||
      pickFirst(meta.topicIdentifier) ||
      pickFirst(meta.callIdentifier) ||
      pickFirst(meta.reference) ||
      raw.reference ||
      ''
    if (!identifier) return null

    // Título — preferimos topic title sobre call title
    const title =
      pickFirst(meta.topicTitle) ||
      pickFirst(meta.title) ||
      pickFirst(meta.callTitle) ||
      raw.title ||
      identifier

    // ─────────────────────────────────────────────
    // Programa — ESTRATEGIA: derivar SIEMPRE del topic ID primero,
    // que es lo único 100% fiable. SEDIA devuelve códigos numéricos
    // que no nos sirven para mostrar.
    // ─────────────────────────────────────────────

    // Cualquier string con 6+ dígitos seguidos lo consideramos código SEDIA
    const looksLikeCode = (s: string) => /^\d{6,}$/.test(s.trim()) || /\b\d{8,}\b/.test(s)

    const cleanField = (s: string): string => {
      const v = (s || '').trim()
      if (!v) return ''
      if (looksLikeCode(v)) return ''
      return v
    }

    const tryFields = (...fields: unknown[]): string => {
      for (const f of fields) {
        const v = cleanField(pickFirst(f))
        if (v) return v
      }
      return ''
    }

    // 1. PRIMARY: derivar del prefijo del topic ID
    let framework = deriveProgrammeFromIdentifier(identifier)

    // 2. FALLBACK: si el ID no encaja en ninguna familia conocida, intentamos la API
    if (!framework) {
      framework = tryFields(
        meta.frameworkProgrammeAcronym,
        meta.programmeAcronym,
        meta.frameworkProgrammeDescription,
        meta.programmeDescription,
      )
    }

    // 3. Último recurso
    if (!framework) framework = 'Unknown programme'

    // Cluster derivado del ID (CL1-CL6) — esto es muy fiable
    const clusterFromId = deriveClusterFromIdentifier(identifier)
    const destination = tryFields(
      meta.destinationDescription,
      meta.destinationDetails,
      meta.destination,
      meta.clusterDescription,
    )

    let program = framework
    if (clusterFromId && !framework.includes(clusterFromId)) {
      program += ` — ${clusterFromId}`
    } else if (destination && !looksLikeCode(destination)) {
      program += ` — ${destination}`
    }

    // Type of action (RIA / IA / CSA) — solo si está limpio
    const typeOfMGA = tryFields(
      meta.typeOfMGADescription,
      meta.typeOfActionDescription,
    )
    if (typeOfMGA) program += ` · ${typeOfMGA}`

    // Status: SEDIA usa códigos numéricos (31094501=Forthcoming, 31094502=Open, 31094503=Closed)
    const statusRaw = pickFirst(meta.callStatus) || pickFirst(meta.status)
    const externalStatus: ExternalStatus =
      statusRaw === '31094501' || statusRaw.toLowerCase().includes('forth') ? 'forthcoming' :
      statusRaw === '31094502' || statusRaw.toLowerCase().includes('open') ? 'open' :
      statusRaw === '31094503' || statusRaw.toLowerCase().includes('clos') ? 'closed' : 'unknown'

    // Fechas
    const deadlineRaw =
      pickFirst(meta.deadlineDate) ||
      pickFirst(meta.deadlineSeries) ||
      pickFirst(meta.closingDate) ||
      pickFirst(meta.plannedDeadlineDate)
    const openRaw =
      pickFirst(meta.plannedOpeningDate) ||
      pickFirst(meta.openingDate) ||
      pickFirst(meta.startDate)

    // ─────────────────────────────────────────────
    // Budget — probamos varios campos. Lo formateamos como €X,XXX,XXX si llega como número.
    // ─────────────────────────────────────────────
    const budgetRaw = tryFields(
      meta.budgetOverview,
      meta.indicativeBudget,
      meta.totalBudget,
      meta.budgetMaximumGrantAmount,
      meta.callBudget,
      meta.programmeAllocation,
    )

    let budget = budgetRaw
    // Si llega como número puro lo formateamos como euros
    if (budget && /^\d+(\.\d+)?$/.test(budget)) {
      const n = parseFloat(budget)
      budget = '€' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
    }

    // URL al detalle
    const url = raw.url || `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${identifier.toLowerCase()}`

    // Description — corta porque viene en HTML largo
    const description = (raw.summary || raw.content || '').toString().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600)

    return {
      externalId: identifier,
      source: 'EU_PORTAL',
      title,
      fundingBody: 'European Commission',
      program,
      openDate: openRaw || undefined,
      closeDate: deadlineRaw || undefined,
      budget: budget || undefined,
      externalStatus,
      url,
      description: description || undefined,
      geographicScope: 'European',
      aidType: 'Grant',
      actionable: true, // EU portal ya es I+D+i por naturaleza
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

async function fetchBDNSCalls(): Promise<NormalizedCall[]> {
  // BDNS tiene varios endpoints públicos. Probamos en orden hasta que uno funcione.
  // Sin auth, JSON. Páginamos hasta los últimos 60 días.
  const fechaDesde = formatBDNSDate(new Date(Date.now() - 60 * 86400000))
  const fechaHasta = formatBDNSDate(new Date(Date.now() + 365 * 86400000))

  // Endpoints en orden de preferencia. Si uno falla por 404 o cambio de schema, prueba el siguiente.
  const candidateUrls = [
    `https://www.infosubvenciones.es/bdnstrans/api/convocatorias?vpd=GE&fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}&pageSize=200&page=0`,
    `https://www.pap.hacienda.gob.es/bdnstrans/api/convocatorias?vpd=GE&fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}&pageSize=200&page=0`,
    `https://www.pap.hacienda.gob.es/bdnstrans/api/convocatorias/busqueda?vpd=GE&fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}&pageSize=200&page=0`,
  ]

  let lastError = ''
  for (const url of candidateUrls) {
    try {
      console.log(`Trying BDNS endpoint: ${url}`)
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'AlamosInnovacionCRM/1.0',
        },
      })
      if (!response.ok) {
        lastError = `${response.status} from ${new URL(url).host}`
        console.warn(`  → ${lastError}`)
        continue
      }
      const text = await response.text()
      let data: unknown
      try {
        data = JSON.parse(text)
      } catch {
        lastError = `Non-JSON response from ${new URL(url).host}`
        console.warn(`  → ${lastError}: ${text.slice(0, 200)}`)
        continue
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: any[] = d.content || d.contenido || d.data || d.results || (Array.isArray(d) ? d : [])
      console.log(`  ✓ BDNS returned ${items.length} items from ${new URL(url).host}`)
      if (items.length === 0) continue
      return items.map(it => normalizeBDNSCall(it)).filter(Boolean) as NormalizedCall[]
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'fetch error'
      console.warn(`  → exception: ${lastError}`)
    }
  }
  throw new Error(`BDNS — all endpoints failed. Last error: ${lastError}`)
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
    const externalId = (
      raw.numeroConvocatoria ||
      raw.codigoConvocatoria ||
      raw['codigo-convocatoria'] ||
      raw.codigo ||
      raw.id ||
      ''
    ).toString()
    if (!externalId) return null

    const title = (
      raw.titulo ||
      raw.tituloConvocatoria ||
      raw.descripcion ||
      raw.objeto ||
      externalId
    ).toString()

    const organo = (
      raw.organo ||
      raw.organoConcedente ||
      raw.entidadConcedente ||
      raw.descripcionOrgano ||
      raw.administracion ||
      ''
    ).toString()

    const program = (
      raw.instrumento ||
      raw.programa ||
      raw.tipoConvocatoria ||
      raw.finalidadConvocatoria ||
      ''
    ).toString()

    const fechaFin = (
      raw.fechaSolicitudFin ||
      raw.fechaFinSolicitud ||
      raw.fechaFin ||
      raw['fecha-fin-solicitud'] ||
      ''
    ).toString()

    const fechaInicio = (
      raw.fechaSolicitudInicio ||
      raw.fechaInicioSolicitud ||
      raw.fechaInicio ||
      raw['fecha-inicio-solicitud'] ||
      ''
    ).toString()

    const budget = (
      raw.presupuestoTotal ||
      raw.importe ||
      raw.cuantia ||
      raw.financiacion ||
      ''
    ).toString()

    const callUrl = (
      raw.urlBaseRegional ||
      raw.urlConvocatoria ||
      raw.url ||
      `https://www.pap.hacienda.gob.es/bdnstrans/GE/es/convocatoria/${externalId}`
    ).toString()

    const today = Date.now()
    const closeMs = fechaFin ? parseSpanishDate(fechaFin).getTime() : NaN
    const externalStatus: ExternalStatus = !Number.isNaN(closeMs) && closeMs < today ? 'closed' : 'open'

    return {
      externalId,
      source: 'BDNS',
      title,
      fundingBody: organo || 'Ministerio',
      program,
      openDate: fechaInicio || undefined,
      closeDate: fechaFin || undefined,
      budget: budget || undefined,
      externalStatus,
      url: callUrl,
      description: undefined,
      geographicScope: 'National',
      aidType: 'Grant',
      actionable: isActionable(title, organo + ' ' + program),
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
        console.log(`   → BDNS returned ${calls.length} calls (${calls.filter(c => c.actionable).length} actionable)`)
        allCalls.push(...calls)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error(`❌ Discovery sync error for ${s}:`, msg)
      errors[s] = msg
    }
  }

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
    },
  })
})

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`)
  if (!anthropic) {
    console.warn('⚠️  ANTHROPIC_API_KEY not configured — /ai/analyze-client-context will return 503')
  } else {
    console.log(`✅ Anthropic configured with model: ${CLAUDE_MODEL}`)
  }
  console.log('🔭 Discovery endpoint ready at POST /discovery/sync')
})
