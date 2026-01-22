import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { google } from 'googleapis'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

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

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
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

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`)
})
