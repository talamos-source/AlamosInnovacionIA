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

async function fetchEUCalls(): Promise<NormalizedCall[]> {
  // SEDIA Search API: POST con apiKey en query string.
  // Documentación: https://api.tech.ec.europa.eu/search-api/prod/openapi.json
  // type=1 → "Topic"; status filtramos open + forthcoming.

  const url = 'https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA&text=*&pageSize=200&pageNumber=1'
  const body = {
    languages: ['en'],
    sort: { field: 'sortStatus', order: 'ASC' },
    fixedConditions: [
      {
        type: 'FixedField',
        field: 'type',
        values: ['1'],
      },
      {
        type: 'FixedField',
        field: 'status',
        values: ['31094501', '31094502'], // 1 = Forthcoming, 2 = Open en SEDIA
      },
    ],
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`EU portal API: HTTP ${response.status}`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await response.json()) as any

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = (data.results || []) as any[]
  return results.map(r => normalizeEUCall(r)).filter(Boolean) as NormalizedCall[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeEUCall(raw: any): NormalizedCall | null {
  try {
    const meta = raw.metadata || {}
    const identifier = (meta.identifier?.[0] || meta.callIdentifier?.[0] || raw.reference || raw.url || '').toString()
    if (!identifier) return null
    const title = (meta.title?.[0] || raw.title || identifier).toString()
    const framework = (meta.frameworkProgramme?.[0] || meta.programmeDivision?.[0] || 'Horizon Europe').toString()
    const callStatusVal = (meta.status?.[0] || '').toString().toLowerCase()
    const externalStatus: ExternalStatus =
      callStatusVal.includes('forth') ? 'forthcoming' :
      callStatusVal.includes('open') ? 'open' :
      callStatusVal.includes('clos') ? 'closed' : 'unknown'

    const deadlineRaw = (meta.deadlineDate?.[0] || meta.plannedOpeningDate?.[0] || '').toString()
    const openRaw = (meta.startDate?.[0] || meta.plannedOpeningDate?.[0] || '').toString()
    const budgetRaw = (meta.budgetOverview?.[0] || '').toString()

    return {
      externalId: identifier,
      source: 'EU_PORTAL',
      title,
      fundingBody: 'European Commission',
      program: framework,
      openDate: openRaw || undefined,
      closeDate: deadlineRaw || undefined,
      budget: budgetRaw || undefined,
      externalStatus,
      url: raw.url || `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${identifier.toLowerCase()}`,
      description: (raw.summary || '').toString().slice(0, 800) || undefined,
      geographicScope: 'European',
      aidType: 'Grant',
      actionable: true, // EU portal ya es I+D+i por naturaleza
    }
  } catch {
    return null
  }
}

/* ----------------------------------------------------------
   BDNS — Spanish Subvenciones API
   ---------------------------------------------------------- */

async function fetchBDNSCalls(): Promise<NormalizedCall[]> {
  // BDNS — endpoint público que devuelve convocatorias abiertas.
  // Sin auth, JSON. Páginamos hasta los últimos 60 días.
  const fechaDesde = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0]
  const fechaHasta = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]

  const url = `https://www.pap.hacienda.gob.es/bdnstrans/api/convocatorias?vpd=GE&fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}&pageSize=200&page=0`

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  })
  if (!response.ok) throw new Error(`BDNS API: HTTP ${response.status}`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await response.json()) as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (data.content || data || []) as any[]
  return items.map(it => normalizeBDNSCall(it)).filter(Boolean) as NormalizedCall[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeBDNSCall(raw: any): NormalizedCall | null {
  try {
    const externalId = (raw.numeroConvocatoria || raw.codigo || raw.id || '').toString()
    if (!externalId) return null
    const title = (raw.titulo || raw.descripcion || raw.objeto || externalId).toString()
    const organo = (raw.organo || raw.organoConcedente || raw.entidad || '').toString()
    const program = (raw.instrumento || raw.programa || '').toString()
    const fechaFin = (raw.fechaSolicitudFin || raw.fechaFinSolicitud || raw.fechaFin || '').toString()
    const fechaInicio = (raw.fechaSolicitudInicio || raw.fechaInicioSolicitud || raw.fechaInicio || '').toString()
    const budget = (raw.presupuestoTotal || raw.importe || '').toString()
    const callUrl = (raw.urlBaseRegional || raw.urlConvocatoria || `https://www.pap.hacienda.gob.es/bdnstrans/GE/es/convocatoria/${externalId}`).toString()

    const today = Date.now()
    const closeMs = fechaFin ? new Date(fechaFin).getTime() : NaN
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
  } catch {
    return null
  }
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
      if (s === 'EU_PORTAL') {
        const calls = await fetchEUCalls()
        allCalls.push(...calls)
      } else if (s === 'BDNS') {
        const calls = await fetchBDNSCalls()
        allCalls.push(...calls)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error(`Discovery sync error for ${s}:`, msg)
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
