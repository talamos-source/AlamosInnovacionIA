// Build: 2026-06-11T15:55Z — redeploy trigger
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
            { terms: { type: ['1', '2', '8'] } },           // Grants only
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
            { terms: { type: ['1', '2', '8'] } },
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

  // Deduplicación por topic identifier — sin filtro de idioma, SEDIA devuelve
  // la misma call repetida en varios idiomas (en, fr, de, etc.). Preferimos en si está.
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byId = new Map<string, any>()
    for (const r of results) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const meta = (r as any).metadata || {}
      const id = pickFirst(meta.identifier) || pickFirst(meta.callIdentifier) || pickFirst(meta.callccm2Id) || (r as { reference?: string }).reference || ''
      if (!id) continue
      const lang = pickFirst(meta.language).toLowerCase()
      const existing = byId.get(id)
      if (!existing) {
        byId.set(id, r)
      } else {
        // Si la actual es 'en' y la guardada no, sustituimos (preferimos inglés)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existingLang = pickFirst((existing as any).metadata?.language).toLowerCase()
        if (lang === 'en' && existingLang !== 'en') byId.set(id, r)
      }
    }
    const dedupCount = results.length - byId.size
    results = Array.from(byId.values())
    console.log(`   🧹 Deduplicated by topic ID: ${results.length} unique (removed ${dedupCount} duplicates)`)
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
  const filtered = results.filter(r => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = (r as any).metadata || {}
    const statusCode = pickFirst(meta.status)
    const sortStatus = pickFirst(meta.sortStatus)

    // Descarte por status explícito
    if (statusCode === '31094503' || sortStatus === '3') return false

    // Defensa CRÍTICA: SEDIA SEARCH a veces tiene metadata.status desincronizada.
    // Si latestInfos dice "has closed on the…" o "evaluation finalised", es que está
    // cerrada aunque el status diga otra cosa.
    if (isStaleClosedByLatestInfos(meta.latestInfos)) return false

    // Verificación con deadlines REALES desde budgetOverview (no metadata.deadlineDate
    // que está sucio). Si TODAS las deadlines reales pasaron → cerrada.
    const identifier = pickFirst(meta.identifier) || pickFirst(meta.callIdentifier) || ''
    const realDeadlines = extractRealDeadlinesFromBudget(pickFirst(meta.budgetOverview), identifier)
    if (realDeadlines.length > 0 && allDatesInPast(realDeadlines, 1)) return false

    // Fallback al campo metadata.deadlineDate (puede tener 2028 incorrecto pero al menos
    // sirve si budgetOverview no tiene datos)
    if (realDeadlines.length === 0 && allDatesInPast(meta.deadlineDate, 1)) return false

    if (statusCode === '31094501' || statusCode === '31094502') return true
    if (sortStatus === '1' || sortStatus === '2') return true

    // Sin status reconocible → fallback por la última deadline en futuro
    const deadline = pickLatestDate(meta.deadlineDate)
    if (deadline) {
      const t = new Date(deadline).getTime()
      if (!Number.isNaN(t) && t > Date.now()) return true
    }
    return false
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

    const externalId = identifier || callId

    // Título (campo verificado: metadata.title)
    const title = pickFirst(meta.title) || pickFirst(meta.callTitle) || raw.title || externalId

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

    // Type of action — viene como string array legible en metadata.typesOfAction
    // Ej. ["Research and Innovation action"]
    const typeOfAction = pickFirst(meta.typesOfAction)
    if (typeOfAction) {
      // Acortar a sigla común si encaja
      const acronym = typeOfAction.match(/^(RIA|IA|CSA|SME|FPA)\b/i)?.[1]?.toUpperCase()
      program += acronym ? ` · ${acronym}` : ` · ${typeOfAction}`
    }

    // Status (campo verificado: metadata.status como código)
    const statusCode = pickFirst(meta.status)
    const sortStatus = pickFirst(meta.sortStatus)
    const externalStatus: ExternalStatus =
      statusCode === '31094501' || sortStatus === '1' ? 'forthcoming' :
      statusCode === '31094502' || sortStatus === '2' ? 'open' :
      statusCode === '31094503' || sortStatus === '3' ? 'closed' : 'unknown'

    // Fechas — fuente primaria: budgetOverview (coincide con detail API y portal real).
    // metadata.deadlineDate de SEDIA SEARCH a veces trae fechas inventadas (2028 cuando
    // la deadline real fue 2024). Solo se usa como fallback si budgetOverview no tiene.
    const realDeadlines = extractRealDeadlinesFromBudget(pickFirst(meta.budgetOverview), identifier)
    const deadlineRaw = realDeadlines.length > 0
      ? pickLatestDate(realDeadlines)
      : pickLatestDate(meta.deadlineDate)
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
