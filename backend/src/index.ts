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
Your goal is to extract concise, factual context information from the available sources (website content, client profile, and active projects).

You will return a STRICT JSON object with these 14 fields (all strings; can be empty if unknown):
- businessModel: How the company generates revenue
- companyOverview: 2-3 sentence company summary
- competitiveAdvantage: What makes them different from competitors
- ipStrategy: Patents, IP protection approach (empty if unknown)
- keyAchievements: Notable awards, milestones, traction metrics
- marketOverview: Market context, size, dynamics
- problemStatement: What problem the company solves
- solutionDescription: How they solve it
- targetMarkets: Industries, geographies, customer segments served
- keyTeamMembers: Founders or key team members mentioned by name (empty if unknown)
- teamOverview: Team composition, size, capabilities
- technologyInnovation: Tech stack, methodologies, R&D approach
- currentTRL: Technology Readiness Level (e.g., "TRL 7 - System prototype demonstration") with brief justification
- rdiRoadmap: R&D&I roadmap, upcoming initiatives

Rules:
1. Be concise — 2-4 sentences per field is ideal, no longer than 5
2. Use ONLY information from the provided sources
3. If a field cannot be inferred from the sources, return empty string ""
4. Write in English
5. Be factual, no marketing fluff, no speculation
6. Do not hallucinate — if not in sources, leave empty

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

// Máximo de chars por documento al pasarlo a Claude (control de coste de tokens)
const MAX_DOC_CHARS = 25000

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
      trace,
    })
  } catch (err: any) {
    console.error('AI analysis error:', err)
    return res.status(500).json({
      error: err?.message || 'AI analysis failed',
    })
  }
})

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`)
  if (!anthropic) {
    console.warn('⚠️  ANTHROPIC_API_KEY not configured — /ai/analyze-client-context will return 503')
  } else {
    console.log(`✅ Anthropic configured with model: ${CLAUDE_MODEL}`)
  }
})
