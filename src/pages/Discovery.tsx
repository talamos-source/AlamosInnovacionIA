import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Eye,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import { isQuotaExceededError, tryFreeStorage } from '../utils/appData'
import { idbGet, idbSet } from '../utils/idbStorage'
import { getAiApiBase, getApiBase } from '../utils/aiApiBase'
import {
  AMBITO_LABEL,
  BAND_ORDER,
  ambitoOf,
  classifyCall,
  detectDirectAward,
  organismLine,
  ruleBand,
  type AiBand,
  type TriageBand,
  type TriageResult,
} from '../utils/discoveryTriage'
import './Page.css'
import './Discovery.css'

/* ============================================================
   Tipos
   ============================================================ */

export type DiscoverySource = 'EU_PORTAL' | 'BDNS'
export type DiscoveryUserStatus = 'new' | 'reviewing' | 'dismissed' | 'imported'
export type DiscoveryExternalStatus = 'open' | 'forthcoming' | 'closed' | 'unknown'

export interface DiscoveryCall {
  id: string
  externalId: string
  source: DiscoverySource
  title: string
  fundingBody: string
  program: string
  typeOfAction?: string
  region?: string
  openDate?: string
  closeDate?: string
  budget?: string
  externalStatus: DiscoveryExternalStatus
  userStatus: DiscoveryUserStatus
  url: string
  description?: string
  geographicScope?: 'European' | 'National' | 'Regional' | 'International'
  aidType?: 'Grant' | 'Loan' | 'Mixed' | 'Tax Credit'
  actionable: boolean
  discoveredAt: string
  importedToCallId?: string
  importedAt?: string
  /** Relevancia I+D+i 0-100 calculada por el backend (organismos + keywords). */
  rdiScore?: number
  rdiReasons?: string[]
  /** Seguimiento manual (pestaña Watching). */
  watching?: boolean
  /** Cualificación IA (solo BDNS). */
  aiBand?: AiBand
  aiReason?: string
  aiDirectAward?: boolean
  aiQualifiedAt?: string
  aiAttemptedAt?: string
  /** Cambios detectados en el último sync que la modificó (pestaña Changed). */
  changedAt?: string
  changes?: string[]
}

export interface DiscoverySourceMeta {
  lastSync?: string
  lastSyncStatus: 'idle' | 'syncing' | 'success' | 'error'
  recordCount: number
  lastError?: string
  newCount?: number
  updatedCount?: number
  changedCount?: number
}

interface DiscoverySourcesState {
  EU_PORTAL: DiscoverySourceMeta
  BDNS: DiscoverySourceMeta
}

type IncomingCall = Omit<DiscoveryCall, 'id' | 'userStatus' | 'discoveredAt'>
type TabKey = 'tray' | 'watching' | 'changed' | 'all'

/* ============================================================
   Constantes
   ============================================================ */

const DEFAULT_SOURCES: DiscoverySourcesState = {
  EU_PORTAL: { lastSyncStatus: 'idle', recordCount: 0 },
  BDNS: { lastSyncStatus: 'idle', recordCount: 0 },
}

const ALL_SOURCES: DiscoverySource[] = ['EU_PORTAL', 'BDNS']

/**
 * Mapping defensivo de códigos SEDIA → nombres legibles.
 * Si el backend (antes del último deploy) guardó "Programme 111111",
 * lo limpiamos al cargar la página.
 */
const SEDIA_PROGRAMME_CODE_MAP: Record<string, string> = {
  '111109': '1st Health Programme (1HP)',
  '111110': '2nd Health Programme (2HP)',
  '111111': 'Multi-Programme',
  '31045243': 'Horizon 2020 (H2020)',
  '31059083': 'Creative Europe (2014-2020)',
  '31059093': 'Erasmus+ (2014-2020)',
  '31059643': 'COSME (2014-2020)',
  '31061225': 'Research Fund for Coal & Steel (2014-2020)',
  '31061266': '3rd Health Programme (2014-2020)',
  '31065524': 'CEF (2014-2020)',
  '31070247': 'Justice Programme (2014-2020)',
  '31072773': 'AGRIP (2014-2020)',
  '31076817': 'Rights, Equality & Citizenship (2014-2020)',
  '31077795': 'AMIF (2014-2020)',
  '31077817': 'ISF — Police (2014-2020)',
  '31077833': 'ISF — Borders & Visa (2014-2020)',
  '31082527': 'UCPM (2014-2020)',
  '31084392': 'Hercule III (2014-2020)',
  '31098847': 'EMFF (2014-2020)',
  '31107710': 'LIFE (2014-2020)',
  '42198993': 'IMCAP (2014-2020)',
  '42905358': 'Structural Reform Support Programme (2014-2020)',
  '43089234': 'Innovation Fund (INNOVFUND)',
  '43108390': 'Horizon Europe (HORIZON)',
  '43152860': 'Digital Europe Programme',
  '43251447': 'Asylum, Migration & Integration Fund (AMIF)',
  '43251530': 'Border Management & Visa Instrument (BMVI)',
  '43251534': 'Customs Control Equipment Instrument (CCEI)',
  '43251567': 'Connecting Europe Facility (CEF)',
  '43251589': 'CERV — Citizens, Equality, Rights & Values',
  '43251814': 'Creative Europe (CREA)',
  '43251842': 'EU Anti-Fraud Programme (EUAF)',
  '43251882': 'Information Measures for CAP (IMCAP)',
  '43252368': 'Internal Security Fund (ISF)',
  '43252386': 'Justice Programme (JUST)',
  '43252405': 'LIFE — Environment & Climate Action',
  '43252433': 'Pericles IV — Euro Counterfeiting Protection',
  '43252449': 'Research Fund for Coal & Steel (RFCS)',
  '43252476': 'Single Market Programme (SMP)',
  '43252517': 'Social Prerogatives & Specific Competencies Lines (SOCPL)',
  '43253706': 'Technical Support Instrument (TSI)',
  '43253967': 'Renewable Energy Financing Mechanism',
  '43253979': 'Customs Programme (CUST)',
  '43253995': 'Fiscalis Programme (FISC)',
  '43254019': 'European Social Fund Plus (ESF+)',
  '43254037': 'European Solidarity Corps (ESC)',
  '43298203': 'Union Civil Protection Mechanism (UCPM)',
  '43298664': 'Agricultural Products Promotion (AGRIP)',
  '43298916': 'Euratom Research & Training Programme',
  '43332642': 'EU4Health',
  '43353764': 'Erasmus+',
  '43392145': 'European Maritime, Fisheries & Aquaculture Fund (EMFAF)',
  '44181033': 'European Defence Fund (EDF)',
  '44416173': 'Interregional Innovation Investments (I3)',
  '44773066': 'Just Transition Mechanism (JTM)',
  '44773133': 'Information Measures for EU Cohesion Policy (IMREG)',
  '45876777': 'Global Europe (NDICI)',
  '46324255': 'Technical Assistance for ERDF, CF & JTF',
}

/** "Programme 12345" → nombre legible (si conocemos el código). */
function normalizeProgramName(program: string): string {
  if (!program) return program
  const m = program.match(/^Programme (\d+)(.*)$/)
  if (m && SEDIA_PROGRAMME_CODE_MAP[m[1]]) {
    return SEDIA_PROGRAMME_CODE_MAP[m[1]] + (m[2] || '')
  }
  return program
}

const SOURCE_LABELS: Record<DiscoverySource, string> = {
  EU_PORTAL: 'EU Funding & Tenders Portal',
  BDNS: 'BDNS – Spanish National Grants',
}
const SOURCE_SHORT: Record<DiscoverySource, string> = {
  EU_PORTAL: 'EU',
  BDNS: 'BDNS',
}

const TABS: TabKey[] = ['tray', 'watching', 'changed', 'all']
const TAB_LABEL: Record<TabKey, string> = {
  tray: 'Daily Tray',
  watching: 'Watching',
  changed: 'Changed',
  all: 'All',
}

const LANE_META: Record<TriageBand, { title: string; desc: string }> = {
  high: {
    title: 'High — Pre-qualified',
    desc: 'Core R&D+i programmes and AI-confirmed strong fits. Review and decide.',
  },
  medium: {
    title: 'Medium — Partial fit',
    desc: 'Adjacent programmes or indirect fit. Worth a quick look.',
  },
  unscored: {
    title: 'Unscored — Needs your judgement',
    desc: 'National and regional calls that passed the noise filter but are not qualified yet.',
  },
  low: {
    title: 'Low — Low relevance',
    desc: 'Weak link with R&D+i or with our client profile.',
  },
  excluded: {
    title: 'Excluded — Out of profile',
    desc: 'Outside our focus or without a competitive procedure (auditable archive).',
  },
}

const DEFAULT_OPEN_LANES: Record<TriageBand, boolean> = {
  high: true, medium: true, unscored: true, low: false, excluded: false,
}

const LAST_REVIEW_KEY = 'discoveryLastReviewAt'
const HIDE_DIRECT_KEY = 'discoveryHideDirect'
const CHANGED_WINDOW_DAYS = 14
const LANE_PAGE = 50
const AI_BATCH = 20
const AI_AUTO_CAP = 60
const AI_RETRY_AFTER_MS = 7 * 86400000

/* ============================================================
   IndexedDB storage para discoveryCalls
   ============================================================
   discoveryCalls vive en IndexedDB (sin el tope de ~5 MB de
   localStorage). Es CACHE LOCAL: no se sincroniza con el server.
   ============================================================ */

const IDB_KEY_CALLS = 'allCalls'

const loadCallsSync = (): DiscoveryCall[] => {
  // Lectura sincrónica para el initial state (legacy localStorage).
  try {
    const raw = localStorage.getItem('discoveryCalls')
    return raw ? (JSON.parse(raw) as DiscoveryCall[]) : []
  } catch {
    return []
  }
}

const loadCallsFromIdb = async (): Promise<DiscoveryCall[]> => {
  try {
    const stored = await idbGet<DiscoveryCall[]>('discovery', IDB_KEY_CALLS)
    return Array.isArray(stored) ? stored : []
  } catch (err) {
    console.warn('[Discovery] idbGet failed, fallback to localStorage:', err)
    return loadCallsSync()
  }
}

/** Migración one-time localStorage → IDB. */
const migrateCallsToIdb = async (): Promise<DiscoveryCall[] | null> => {
  try {
    const idbCalls = await idbGet<DiscoveryCall[]>('discovery', IDB_KEY_CALLS)
    if (Array.isArray(idbCalls) && idbCalls.length > 0) {
      if (localStorage.getItem('discoveryCalls')) {
        localStorage.removeItem('discoveryCalls')
      }
      return null
    }
    const local = loadCallsSync()
    if (local.length === 0) return null
    await idbSet('discovery', IDB_KEY_CALLS, local)
    localStorage.removeItem('discoveryCalls')
    console.log(`[Discovery] ✓ migradas ${local.length} calls de localStorage → IndexedDB`)
    return local
  } catch (err) {
    console.warn('[Discovery] migración a IDB falló:', err)
    return null
  }
}

/** Guarda en IDB (fire-and-forget; las transacciones readwrite se serializan en orden). */
const saveCalls = (calls: DiscoveryCall[]): DiscoveryCall[] => {
  idbSet('discovery', IDB_KEY_CALLS, calls).then(() => {
    if (localStorage.getItem('discoveryCalls')) {
      try { localStorage.removeItem('discoveryCalls') } catch { /* noop */ }
    }
  }).catch(err => {
    console.error('[Discovery] idbSet failed:', err)
    if (isQuotaExceededError(err)) {
      try { tryFreeStorage() } catch { /* noop */ }
    }
  })
  return calls
}

const loadSources = (): DiscoverySourcesState => {
  try {
    const raw = localStorage.getItem('discoverySources')
    return raw ? { ...DEFAULT_SOURCES, ...JSON.parse(raw) } : DEFAULT_SOURCES
  } catch {
    return DEFAULT_SOURCES
  }
}

const saveSources = (sources: DiscoverySourcesState) => {
  try {
    localStorage.setItem('discoverySources', JSON.stringify(sources))
  } catch { /* noop */ }
}

/* ============================================================
   Helpers
   ============================================================ */

const normText = (s?: string): string =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const parseDate = (s?: string | null): number => (s ? new Date(s).getTime() : NaN)

const dayKey = (s?: string): string => (s ? String(s).slice(0, 10) : '')

const isPastDeadline = (c: DiscoveryCall): boolean => {
  const t = parseDate(c.closeDate)
  return !Number.isNaN(t) && t < Date.now() - 86400000
}

const isWatching = (c: DiscoveryCall): boolean => !!c.watching || c.userStatus === 'reviewing'

const formatShortDate = (s?: string): string => {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatDateTime = (s?: string | null): string => {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const daysLeft = (s?: string): number | null => {
  const t = parseDate(s)
  if (Number.isNaN(t)) return null
  return Math.ceil((t - Date.now()) / 86400000)
}

/** Deadline más cercana primero; sin fecha al final; desempate por descubrimiento reciente. */
const sortByDeadline = (a: DiscoveryCall, b: DiscoveryCall): number => {
  const ta = parseDate(a.closeDate)
  const tb = parseDate(b.closeDate)
  const av = !Number.isNaN(ta)
  const bv = !Number.isNaN(tb)
  if (av && bv && ta !== tb) return ta - tb
  if (av !== bv) return av ? -1 : 1
  return (parseDate(b.discoveredAt) || 0) - (parseDate(a.discoveredAt) || 0)
}

/** Cambios relevantes entre la versión guardada y la que llega del sync. */
function diffCall(prev: DiscoveryCall, next: IncomingCall): string[] {
  const out: string[] = []
  if (dayKey(prev.closeDate) !== dayKey(next.closeDate) && (prev.closeDate || next.closeDate)) {
    out.push(`Deadline ${formatShortDate(prev.closeDate)} → ${formatShortDate(next.closeDate)}`)
  }
  if (dayKey(prev.openDate) !== dayKey(next.openDate) && (prev.openDate || next.openDate)) {
    out.push(`Opening ${formatShortDate(prev.openDate)} → ${formatShortDate(next.openDate)}`)
  }
  if ((prev.budget || '') !== (next.budget || '')) {
    out.push(`Budget ${prev.budget || '—'} → ${next.budget || '—'}`)
  }
  if (
    next.externalStatus && prev.externalStatus !== next.externalStatus &&
    prev.externalStatus !== 'unknown' && next.externalStatus !== 'unknown'
  ) {
    out.push(`Status ${prev.externalStatus} → ${next.externalStatus}`)
  }
  return out
}

/**
 * Fusiona el resultado de un sync con lo guardado.
 *  - Conserva decisiones del usuario (dismiss/import/watch) y la cualificación IA.
 *  - Detecta cambios reales (deadline, apertura, presupuesto, estado).
 *  - Stragglers: EU es exhaustivo (se eliminan los que no vuelven); BDNS es
 *    una ventana deslizante (solo escanea lo reciente) → se conservan mientras
 *    sigan abiertas.
 */
function mergeSync(current: DiscoveryCall[], incomingList: IncomingCall[], s: DiscoverySource) {
  const existingByKey = new Map<string, DiscoveryCall>()
  current.forEach(c => existingByKey.set(`${c.source}::${c.externalId}`, c))
  const now = new Date().toISOString()
  const merged: DiscoveryCall[] = []
  const seen = new Set<string>()
  const newIds: string[] = []
  let newCount = 0
  let matchedCount = 0
  let changedCount = 0

  for (const raw of incomingList) {
    const key = `${raw.source}::${raw.externalId}`
    if (seen.has(key)) continue
    seen.add(key)
    const incoming: IncomingCall = { ...raw, program: normalizeProgramName(raw.program) }
    const existing = existingByKey.get(key)
    if (existing) {
      const changes = diffCall(existing, incoming)
      if (changes.length > 0) changedCount += 1
      merged.push({
        ...incoming,
        id: existing.id,
        userStatus: existing.userStatus,
        discoveredAt: existing.discoveredAt,
        importedToCallId: existing.importedToCallId,
        importedAt: existing.importedAt,
        watching: existing.watching,
        aiBand: existing.aiBand,
        aiReason: existing.aiReason,
        aiDirectAward: existing.aiDirectAward,
        aiQualifiedAt: existing.aiQualifiedAt,
        aiAttemptedAt: existing.aiAttemptedAt,
        changedAt: changes.length > 0 ? now : existing.changedAt,
        changes: changes.length > 0 ? changes : existing.changes,
      })
      matchedCount += 1
      existingByKey.delete(key)
    } else {
      const id = `disc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      merged.push({ ...incoming, id, userStatus: 'new', discoveredAt: now })
      newIds.push(id)
      newCount += 1
    }
  }

  const euExhaustive = s === 'EU_PORTAL' && incomingList.length >= 50
  existingByKey.forEach(c => {
    if (c.source !== s) { merged.push(c); return }
    if (c.userStatus === 'dismissed' || c.userStatus === 'imported') { merged.push(c); return }
    if (c.externalStatus === 'closed' || isPastDeadline(c)) return
    if (euExhaustive && !isWatching(c)) return
    merged.push(c)
  })

  return { merged, newIds, newCount, matchedCount, changedCount }
}

/** ¿Hay que mandar esta call a la IA? Solo BDNS sin banda IA, activas y no directas. */
const needsAiQualification = (c: DiscoveryCall): boolean => {
  if (c.source !== 'BDNS' || c.aiBand) return false
  if (c.userStatus === 'dismissed' || c.userStatus === 'imported') return false
  if (isPastDeadline(c)) return false
  if (detectDirectAward(c).isDirect) return false
  if (c.aiAttemptedAt && Date.now() - parseDate(c.aiAttemptedAt) < AI_RETRY_AFTER_MS) return false
  const rb = ruleBand(c).band
  return rb === 'unscored' || rb === 'low'
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/* ============================================================
   Componente principal
   ============================================================ */

const Discovery = () => {
  const navigate = useNavigate()

  const [calls, setCalls] = useState<DiscoveryCall[]>(loadCallsSync)
  const callsRef = useRef<DiscoveryCall[]>(calls)
  const [sources, setSources] = useState<DiscoverySourcesState>(loadSources)
  const sourcesRef = useRef<DiscoverySourcesState>(sources)
  const [hydrated, setHydrated] = useState(false)
  const bootDoneRef = useRef(false)

  const [tab, setTab] = useState<TabKey>('tray')
  const [search, setSearch] = useState('')
  const [hideDirect, setHideDirect] = useState<boolean>(() => localStorage.getItem(HIDE_DIRECT_KEY) !== '0')
  const [includeDismissed, setIncludeDismissed] = useState(false)
  const [lastReviewAt, setLastReviewAt] = useState<string | null>(() => localStorage.getItem(LAST_REVIEW_KEY))
  const [openLanes, setOpenLanes] = useState<Record<TriageBand, boolean>>(DEFAULT_OPEN_LANES)
  const [laneLimit, setLaneLimit] = useState<Record<TriageBand, number>>({
    high: LANE_PAGE, medium: LANE_PAGE, unscored: LANE_PAGE, low: LANE_PAGE, excluded: LANE_PAGE,
  })

  const [syncingSource, setSyncingSource] = useState<DiscoverySource | null>(null)
  const syncingRef = useRef(false)
  const [banner, setBanner] = useState<{ text: string; undo?: () => void } | null>(null)

  const [qualify, setQualify] = useState<{ running: boolean; done: number; total: number; error: string | null }>({
    running: false, done: 0, total: 0, error: null,
  })
  const qualifyingRef = useRef(false)
  const cancelQualifyRef = useRef(false)

  /* ----------------------------------------------------------
     Persistencia (siempre sobre la versión más reciente vía ref,
     para que sync + IA + clicks no se pisen entre sí)
     ---------------------------------------------------------- */

  const commitCalls = (next: DiscoveryCall[] | ((prev: DiscoveryCall[]) => DiscoveryCall[])): DiscoveryCall[] => {
    const value = typeof next === 'function' ? next(callsRef.current) : next
    callsRef.current = value
    setCalls(value)
    saveCalls(value)
    return value
  }

  const patchSource = (s: DiscoverySource, meta: DiscoverySourceMeta) => {
    const value = { ...sourcesRef.current, [s]: meta } as DiscoverySourcesState
    sourcesRef.current = value
    setSources(value)
    saveSources(value)
  }

  /* ----------------------------------------------------------
     Hidratación desde IndexedDB (fuente de verdad)
     ---------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const migrated = await migrateCallsToIdb()
      const loaded = migrated && migrated.length > 0 ? migrated : await loadCallsFromIdb()
      if (cancelled) return
      if (loaded.length > 0) {
        callsRef.current = loaded
        setCalls(loaded)
      }
      setHydrated(true)
    })()
    return () => { cancelled = true }
  }, [])

  /* ----------------------------------------------------------
     Arranque (SOLO tras hidratar — antes se lanzaba el auto-sync con
     la lista vacía y se perdían dismissed/imported)
     ---------------------------------------------------------- */

  useEffect(() => {
    if (!hydrated || bootDoneRef.current) return
    bootDoneRef.current = true

    // 0) Estados 'syncing' colgados de una sesión interrumpida
    for (const s of ALL_SOURCES) {
      if (sourcesRef.current[s].lastSyncStatus === 'syncing') {
        patchSource(s, { ...sourcesRef.current[s], lastSyncStatus: 'idle' })
      }
    }

    // 1) Backfill: marcar como importadas las que ya están en /calls
    backfillImported()

    // 2) Limpieza: deadlines pasadas + nombres de programa legacy
    const before = callsRef.current
    let renamed = 0
    const cleaned = before
      .filter(c => c.userStatus === 'dismissed' || c.userStatus === 'imported' || !isPastDeadline(c))
      .map(c => {
        const p = normalizeProgramName(c.program)
        if (p !== c.program) { renamed += 1; return { ...c, program: p } }
        return c
      })
    if (cleaned.length !== before.length || renamed > 0) {
      console.log(`[Discovery] Cleanup: purged ${before.length - cleaned.length} past-deadline, renamed ${renamed}`)
      commitCalls(cleaned)
    }

    // 3) Auto-sync en background de las fuentes con más de 30 min
    const RECENT_MS = 30 * 60 * 1000
    const stale = ALL_SOURCES.filter(s => {
      const t = parseDate(sourcesRef.current[s].lastSync)
      return Number.isNaN(t) || Date.now() - t > RECENT_MS
    })
    if (stale.length > 0) void triggerSync(stale)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  const backfillImported = () => {
    try {
      const userCallsRaw = localStorage.getItem('calls')
      if (!userCallsRaw) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userCalls: any[] = JSON.parse(userCallsRaw)
      if (!Array.isArray(userCalls) || userCalls.length === 0) return
      const byExtId = new Map<string, string>()
      const byUrl = new Map<string, string>()
      for (const uc of userCalls) {
        if (uc?.discoveryExternalId) byExtId.set(String(uc.discoveryExternalId), uc.id)
        if (uc?.externalId) byExtId.set(String(uc.externalId), uc.id)
        if (typeof uc?.id === 'string' && uc.id.startsWith('disc-')) {
          const parts = uc.id.slice(5).split('-')
          if (parts.length > 1 && /^\d{10,}$/.test(parts[parts.length - 1])) parts.pop()
          byExtId.set(parts.join('-'), uc.id)
        }
        if (uc?.sourceUrl) byUrl.set(String(uc.sourceUrl), uc.id)
        if (uc?.url) byUrl.set(String(uc.url), uc.id)
      }
      let changed = false
      const next = callsRef.current.map(c => {
        if (c.userStatus === 'imported') return c
        const userCallId = byExtId.get(c.externalId) || (c.url ? byUrl.get(c.url) : undefined)
        if (!userCallId) return c
        changed = true
        return {
          ...c,
          userStatus: 'imported' as const,
          importedToCallId: userCallId,
          importedAt: c.importedAt || new Date().toISOString(),
        }
      })
      if (changed) commitCalls(next)
    } catch (err) {
      console.warn('[Discovery] backfill failed:', err)
    }
  }

  /* ----------------------------------------------------------
     Sync con el backend
     ---------------------------------------------------------- */

  const triggerSync = async (targets: DiscoverySource[]) => {
    if (syncingRef.current) return
    syncingRef.current = true
    setBanner(null)
    const newBdnsIds: string[] = []
    const messages: string[] = []

    for (const s of targets) {
      setSyncingSource(s)
      patchSource(s, { ...sourcesRef.current[s], lastSyncStatus: 'syncing' })
      try {
        const token = localStorage.getItem('authToken') || ''
        const response = await fetch(`${getApiBase()}/discovery/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ source: s }),
        })
        if (!response.ok) {
          const errText = await response.text()
          throw new Error(errText || `HTTP ${response.status}`)
        }
        const data = await response.json() as { calls?: IncomingCall[] }
        const incoming = Array.isArray(data.calls) ? data.calls : []
        const result = mergeSync(callsRef.current, incoming, s)
        commitCalls(result.merged)
        if (s === 'BDNS') newBdnsIds.push(...result.newIds)
        patchSource(s, {
          lastSync: new Date().toISOString(),
          lastSyncStatus: 'success',
          recordCount: incoming.length,
          newCount: result.newCount,
          updatedCount: result.matchedCount,
          changedCount: result.changedCount,
        })
        messages.push(`${SOURCE_SHORT[s]}: ${result.newCount} new · ${result.changedCount} changed`)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        patchSource(s, { ...sourcesRef.current[s], lastSyncStatus: 'error', lastError: message.slice(0, 300) })
        messages.push(`${SOURCE_SHORT[s]}: error — ${message.replace(/<[^>]+>/g, ' ').slice(0, 120)}`)
      }
    }

    setSyncingSource(null)
    syncingRef.current = false
    setBanner({ text: `Sync finished · ${messages.join(' · ')}` })

    // Cualificación IA automática solo de lo NUEVO (coste acotado)
    if (newBdnsIds.length > 0) {
      void qualifyWithAi({ ids: newBdnsIds, cap: AI_AUTO_CAP, silent: true })
    }
  }

  /* ----------------------------------------------------------
     Cualificación IA (BDNS) por lotes
     ---------------------------------------------------------- */

  const qualifyWithAi = async (opts: { ids?: string[]; cap?: number; silent?: boolean } = {}) => {
    if (qualifyingRef.current) return
    let pending = callsRef.current.filter(needsAiQualification)
    if (opts.ids) {
      const wanted = new Set(opts.ids)
      pending = pending.filter(c => wanted.has(c.id))
    }
    // Primero las que pasaron el filtro de ruido, luego las de señal débil
    pending.sort((a, b) => {
      const ra = ruleBand(a).band === 'unscored' ? 0 : 1
      const rb = ruleBand(b).band === 'unscored' ? 0 : 1
      return ra !== rb ? ra - rb : sortByDeadline(a, b)
    })
    if (opts.cap) pending = pending.slice(0, opts.cap)
    if (pending.length === 0) {
      if (!opts.silent) setBanner({ text: 'Nothing to qualify: every national/regional call already has a band.' })
      return
    }

    qualifyingRef.current = true
    cancelQualifyRef.current = false
    setQualify({ running: true, done: 0, total: pending.length, error: null })

    const base = getAiApiBase()
    const token = localStorage.getItem('authToken') || ''
    // Warmup (cold start de Render)
    try { await fetchWithTimeout(`${base}/health`, {}, 30000) } catch { /* ignore */ }

    let done = 0
    let qualified = 0
    for (let i = 0; i < pending.length; i += AI_BATCH) {
      if (cancelQualifyRef.current) break
      const batch = pending.slice(i, i + AI_BATCH)
      try {
        const res = await fetchWithTimeout(`${base}/ai/qualify-discovery-calls`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            calls: batch.map(c => ({
              id: c.id,
              title: c.title,
              organism: organismLine(c),
              ambito: AMBITO_LABEL[ambitoOf(c)],
              typeOfAction: c.typeOfAction,
              budget: c.budget,
              closeDate: c.closeDate,
            })),
          }),
        }, 90000)
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(body.error || `HTTP ${res.status}`)
        }
        const json = await res.json() as {
          results?: Array<{ id: string; band: AiBand; reason: string; directAward?: boolean }>
        }
        const byId = new Map((json.results || []).map(r => [r.id, r]))
        const batchIds = new Set(batch.map(c => c.id))
        const now = new Date().toISOString()
        commitCalls(prev => prev.map(c => {
          if (!batchIds.has(c.id)) return c
          const r = byId.get(c.id)
          if (!r) return { ...c, aiAttemptedAt: now }
          return {
            ...c,
            aiBand: r.band,
            aiReason: r.reason,
            aiDirectAward: !!r.directAward,
            aiQualifiedAt: now,
            aiAttemptedAt: now,
          }
        }))
        qualified += byId.size
        done += batch.length
        setQualify(q => ({ ...q, done }))
      } catch (err) {
        const msg = err instanceof Error
          ? (err.name === 'AbortError' ? 'timeout (the AI server took too long)' : err.message)
          : 'unknown error'
        setQualify(q => ({ ...q, error: msg }))
        break
      }
    }

    const stopped = cancelQualifyRef.current
    qualifyingRef.current = false
    setQualify(q => ({ ...q, running: false }))
    if (!opts.silent || qualified > 0) {
      setBanner({ text: `AI qualification: ${qualified} calls qualified${stopped ? ' (stopped)' : ''}.` })
    }
  }

  /* ----------------------------------------------------------
     Acciones sobre calls
     ---------------------------------------------------------- */

  const dismissCall = (id: string) =>
    commitCalls(prev => prev.map(c => (c.id === id ? { ...c, userStatus: 'dismissed' as const } : c)))

  const restoreCall = (id: string) =>
    commitCalls(prev => prev.map(c => (
      c.id === id ? { ...c, userStatus: c.importedToCallId ? 'imported' as const : 'new' as const } : c
    )))

  const toggleWatch = (id: string) =>
    commitCalls(prev => prev.map(c => {
      if (c.id !== id) return c
      const on = !isWatching(c)
      return {
        ...c,
        watching: on,
        userStatus: !on && c.userStatus === 'reviewing' ? 'new' as const : c.userStatus,
      }
    }))

  const toggleHideDirect = (value: boolean) => {
    setHideDirect(value)
    try { localStorage.setItem(HIDE_DIRECT_KEY, value ? '1' : '0') } catch { /* noop */ }
  }

  const markReviewed = (trayCount: number) => {
    const prev = lastReviewAt
    const now = new Date().toISOString()
    try { localStorage.setItem(LAST_REVIEW_KEY, now) } catch { /* noop */ }
    setLastReviewAt(now)
    setBanner({
      text: `Tray cleared (${trayCount} calls). They remain available in All.`,
      undo: () => {
        try {
          if (prev) localStorage.setItem(LAST_REVIEW_KEY, prev)
          else localStorage.removeItem(LAST_REVIEW_KEY)
        } catch { /* noop */ }
        setLastReviewAt(prev)
        setBanner(null)
      },
    })
  }

  /* ----------------------------------------------------------
     Derivados
     ---------------------------------------------------------- */

  const classified = useMemo(() => {
    const map = new Map<string, TriageResult>()
    for (const c of calls) map.set(c.id, classifyCall(c))
    return map
  }, [calls])

  const changedSinceMs = Date.now() - CHANGED_WINDOW_DAYS * 86400000

  const tabCalls = useMemo(() => {
    const lastReviewMs = lastReviewAt ? parseDate(lastReviewAt) : 0
    const since = Date.now() - CHANGED_WINDOW_DAYS * 86400000
    const out: Record<TabKey, DiscoveryCall[]> = { tray: [], watching: [], changed: [], all: [] }
    for (const c of calls) {
      if (isPastDeadline(c)) continue
      const dismissed = c.userStatus === 'dismissed'
      const imported = c.userStatus === 'imported'
      if (!dismissed && !imported && (!lastReviewMs || parseDate(c.discoveredAt) > lastReviewMs)) out.tray.push(c)
      if (!dismissed && isWatching(c)) out.watching.push(c)
      if (!dismissed && c.changedAt && parseDate(c.changedAt) >= since) out.changed.push(c)
      if (includeDismissed || !dismissed) out.all.push(c)
    }
    return out
  }, [calls, lastReviewAt, includeDismissed])

  const tabCounts = useMemo(() => {
    const visible = (list: DiscoveryCall[]) =>
      hideDirect ? list.filter(c => !classified.get(c.id)?.direct).length : list.length
    return {
      tray: visible(tabCalls.tray),
      watching: visible(tabCalls.watching),
      changed: visible(tabCalls.changed),
      all: visible(tabCalls.all),
    } as Record<TabKey, number>
  }, [tabCalls, hideDirect, classified])

  const view = useMemo(() => {
    const q = normText(search.trim())
    let list = tabCalls[tab]
    if (q) {
      list = list.filter(c => normText(`${c.title} ${c.fundingBody} ${c.program} ${c.externalId}`).includes(q))
    }
    let hiddenDirect = 0
    const lanes: Record<TriageBand, DiscoveryCall[]> = { high: [], medium: [], unscored: [], low: [], excluded: [] }
    for (const c of list) {
      const cl = classified.get(c.id) || classifyCall(c)
      if (cl.direct && hideDirect) { hiddenDirect += 1; continue }
      lanes[cl.band].push(c)
    }
    for (const b of BAND_ORDER) lanes[b].sort(sortByDeadline)
    return { lanes, hiddenDirect }
  }, [tabCalls, tab, search, hideDirect, classified])

  const aiStats = useMemo(() => ({
    qualified: calls.filter(c => !!c.aiBand).length,
    pending: calls.filter(needsAiQualification).length,
  }), [calls])

  const ingestion = useMemo(() => {
    const runs = ALL_SOURCES.map(s => sources[s])
    const lastRun = runs.map(r => r.lastSync).filter((d): d is string => !!d).sort().pop() || null
    return {
      newTotal: runs.reduce((n, r) => n + (r.newCount || 0), 0),
      changedTotal: runs.reduce((n, r) => n + (r.changedCount || 0), 0),
      lastRun,
    }
  }, [sources])

  const sourceErrors = ALL_SOURCES.filter(s => sources[s].lastSyncStatus === 'error')

  /* ----------------------------------------------------------
     Render de fila
     ---------------------------------------------------------- */

  const renderRow = (c: DiscoveryCall) => {
    const cl = classified.get(c.id) || classifyCall(c)
    const amb = ambitoOf(c)
    const dl = daysLeft(c.closeDate)
    const imported = c.userStatus === 'imported' || !!c.importedToCallId
    const watching = isWatching(c)
    const dismissed = c.userStatus === 'dismissed'
    const recentChange = !!c.changedAt && parseDate(c.changedAt) >= changedSinceMs && (c.changes?.length || 0) > 0

    return (
      <tr key={c.id} className={`dt-row dt-row--${amb}${dismissed ? ' dt-row--dismissed' : ''}`}>
        <td className="dt-cell-call">
          <div className="dt-call-title" title={c.title}>{c.title}</div>
          <div className="dt-call-org">{organismLine(c)}</div>
          {(imported || watching || cl.direct || dismissed) && (
            <div className="dt-call-tags">
              {imported && <span className="dt-tag dt-tag--imported"><Check size={11} /> In Calls</span>}
              {watching && <span className="dt-tag dt-tag--watching"><Eye size={11} /> Watching</span>}
              {cl.direct && <span className="dt-tag dt-tag--direct">Direct award</span>}
              {dismissed && <span className="dt-tag dt-tag--dismissed">Dismissed</span>}
            </div>
          )}
        </td>
        <td>
          <span className={`dt-ambito dt-ambito--${amb}`}>{AMBITO_LABEL[amb]}</span>
        </td>
        <td>
          <div className="dt-dates">
            <span>{formatShortDate(c.openDate)}</span>
            <span>{formatShortDate(c.closeDate)}</span>
            {dl !== null && dl >= 0 && dl <= 30 && (
              <span className={`dt-days${dl <= 10 ? ' dt-days--urgent' : ''}`}>{dl}d left</span>
            )}
          </div>
        </td>
        <td className="dt-cell-budget">{c.budget || '—'}</td>
        <td className="dt-cell-reason">
          <p>{cl.reason}</p>
          <span className={`dt-origin dt-origin--${cl.origin}`}>{cl.origin === 'ai' ? 'AI' : 'Rule'}</span>
          {recentChange && <p className="dt-change">↻ {c.changes?.join(' · ')}</p>}
        </td>
        <td className="dt-cell-actions">
          <div className="dt-actions">
            <button
              type="button"
              className="dt-act"
              title={imported ? 'Already in Calls' : 'Promote to Calls'}
              disabled={imported}
              onClick={() => navigate(`/discovery/${c.id}/import`)}
            >
              {imported ? <Check size={14} /> : <ArrowUpRight size={14} />}
            </button>
            {dismissed ? (
              <button type="button" className="dt-act" title="Restore" onClick={() => restoreCall(c.id)}>
                <RotateCcw size={14} />
              </button>
            ) : (
              <button type="button" className="dt-act" title="Dismiss" onClick={() => dismissCall(c.id)}>
                <X size={14} />
              </button>
            )}
            <button
              type="button"
              className={`dt-act${watching ? ' dt-act--on' : ''}`}
              title={watching ? 'Stop watching' : 'Watch'}
              onClick={() => toggleWatch(c.id)}
            >
              <Eye size={14} />
            </button>
            <a className="dt-act" href={c.url} target="_blank" rel="noopener noreferrer" title="Open source">
              <ExternalLink size={14} />
            </a>
          </div>
        </td>
      </tr>
    )
  }

  /* ----------------------------------------------------------
     Render
     ---------------------------------------------------------- */

  return (
    <div className="page page--discovery dt-page">
      <header className="dt-header">
        <div className="dt-header-main">
          <h1 className="page-title">Discovery</h1>
          <p className="dt-subtitle">Triage new funding calls and keep the tray at zero.</p>
          <div className="dt-legend">
            <span className="dt-legend-label">Ámbito:</span>
            <span className="dt-legend-item"><i className="dt-dot dt-dot--EU" />Europea</span>
            <span className="dt-legend-item"><i className="dt-dot dt-dot--NACIONAL" />Nacional</span>
            <span className="dt-legend-item"><i className="dt-dot dt-dot--REGIONAL" />Regional / local</span>
          </div>
          <label className="dt-hide-direct">
            <input type="checkbox" checked={hideDirect} onChange={e => toggleHideDirect(e.target.checked)} />
            <span>Hide direct and nominative awards</span>
            {hideDirect && view.hiddenDirect > 0 && (
              <span className="dt-muted">({view.hiddenDirect} hidden in this view)</span>
            )}
          </label>
        </div>

        <div className="dt-header-kpis">
          <div className="dt-kpi">
            <span className="dt-kpi-value">{tabCounts.tray}</span>
            <span className="dt-kpi-label">new since your last review</span>
            <span className="dt-kpi-sub">Last review: {lastReviewAt ? formatDateTime(lastReviewAt) : 'never'}</span>
          </div>
          <div className="dt-kpi dt-kpi--system">
            <span className="dt-kpi-eyebrow">Last ingestion</span>
            <span className="dt-kpi-value dt-kpi-value--mono">
              {ingestion.newTotal} new · {ingestion.changedTotal} changed
            </span>
            <span className="dt-kpi-sub">
              {ingestion.lastRun ? `${formatDateTime(ingestion.lastRun)} · ` : ''}system activity, not your review queue
            </span>
          </div>
          <button
            type="button"
            className="dt-mark-btn"
            onClick={() => markReviewed(tabCounts.tray)}
            disabled={tabCounts.tray === 0}
          >
            Mark reviewed now
          </button>
        </div>
      </header>

      {banner && (
        <div className="dt-banner">
          <span>{banner.text}</span>
          <div className="dt-banner-actions">
            {banner.undo && (
              <button type="button" className="dt-banner-undo" onClick={banner.undo}>Undo</button>
            )}
            <button type="button" className="dt-banner-close" onClick={() => setBanner(null)} aria-label="Close">
              <X size={14} />
            </button>
          </div>
        </div>
      )}
      {qualify.error && !qualify.running && (
        <div className="dt-banner dt-banner--error">
          <span>AI qualification stopped: {qualify.error}</span>
          <button
            type="button"
            className="dt-banner-close"
            onClick={() => setQualify(q => ({ ...q, error: null }))}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="dt-toolbar">
        <nav className="dt-tabs" role="tablist">
          {TABS.map(t => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`dt-tab${tab === t ? ' dt-tab--active' : ''}`}
              onClick={() => setTab(t)}
            >
              {TAB_LABEL[t]}
              <span className="dt-tab-count">{tabCounts[t]}</span>
            </button>
          ))}
        </nav>
        <div className="dt-toolbar-right">
          {tab === 'all' && (
            <label className="dt-check">
              <input type="checkbox" checked={includeDismissed} onChange={e => setIncludeDismissed(e.target.checked)} />
              Show dismissed
            </label>
          )}
          <div className="dt-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search calls, bodies, programmes…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {qualify.running ? (
            <button
              type="button"
              className="dt-ai-btn dt-ai-btn--running"
              onClick={() => { cancelQualifyRef.current = true }}
              title="Stop after the current batch"
            >
              <Loader2 size={14} className="dt-spin" />
              Qualifying {qualify.done}/{qualify.total} · Stop
            </button>
          ) : (
            <button
              type="button"
              className="dt-ai-btn"
              onClick={() => void qualifyWithAi()}
              disabled={aiStats.pending === 0}
              title="Qualify unscored and low-signal national/regional calls with AI"
            >
              <Sparkles size={14} />
              Qualify with AI ({aiStats.pending})
            </button>
          )}
        </div>
      </div>

      <div className="dt-body">
        <div className="dt-lanes">
          {!hydrated && (
            <div className="dt-loading"><Loader2 size={16} className="dt-spin" /> Loading calls…</div>
          )}
          {hydrated && BAND_ORDER.map(band => {
            const rows = view.lanes[band]
            const open = openLanes[band]
            const limit = laneLimit[band]
            return (
              <section key={band} className={`dt-lane dt-lane--${band}`}>
                <button
                  type="button"
                  className="dt-lane-head"
                  aria-expanded={open}
                  onClick={() => setOpenLanes(o => ({ ...o, [band]: !o[band] }))}
                >
                  <div className="dt-lane-titles">
                    <div className="dt-lane-title">
                      <span>{LANE_META[band].title}</span>
                      <span className="dt-count">{rows.length}</span>
                    </div>
                    <p className="dt-lane-desc">{LANE_META[band].desc}</p>
                  </div>
                  {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                {open && (rows.length === 0 ? (
                  <div className="dt-lane-empty">No calls in this lane.</div>
                ) : (
                  <div className="dt-table-wrap">
                    <table className="dt-table">
                      <thead>
                        <tr>
                          <th>Call</th>
                          <th>Ámbito</th>
                          <th>Opening / Closing</th>
                          <th>Budget</th>
                          <th>Reason for band</th>
                          <th className="dt-th-actions">Actions</th>
                        </tr>
                      </thead>
                      <tbody>{rows.slice(0, limit).map(renderRow)}</tbody>
                    </table>
                    {rows.length > limit && (
                      <button
                        type="button"
                        className="dt-more"
                        onClick={() => setLaneLimit(l => ({ ...l, [band]: l[band] + LANE_PAGE }))}
                      >
                        Show {Math.min(LANE_PAGE, rows.length - limit)} more · {rows.length - limit} remaining
                      </button>
                    )}
                  </div>
                ))}
              </section>
            )
          })}
        </div>

        <aside className="dt-side">
          <div className="dt-card">
            <h3>Last ingestion</h3>
            <p className="dt-card-sub">Activity per source, independent of your review badge</p>
            <table className="dt-mini">
              <thead>
                <tr><th>Source</th><th>New</th><th>Chg</th><th>Err</th></tr>
              </thead>
              <tbody>
                {ALL_SOURCES.map(s => (
                  <tr key={s} title={SOURCE_LABELS[s]}>
                    <td>{SOURCE_SHORT[s]}</td>
                    <td>{sources[s].newCount ?? 0}</td>
                    <td>{sources[s].changedCount ?? 0}</td>
                    <td className={sources[s].lastSyncStatus === 'error' ? 'dt-err' : ''}>
                      {sources[s].lastSyncStatus === 'error' ? 1 : 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="dt-card-meta">AI: {aiStats.qualified} qualified · {aiStats.pending} pending</p>
          </div>

          <div className="dt-card">
            <h3>Ingestion health</h3>
            {ALL_SOURCES.map(s => (
              <div key={s} className="dt-health-row" title={SOURCE_LABELS[s]}>
                <span className={`dt-status-dot dt-status-dot--${syncingSource === s ? 'syncing' : sources[s].lastSyncStatus}`} />
                <span className="dt-health-text">
                  Last {SOURCE_SHORT[s]} run: {formatDateTime(sources[s].lastSync)}
                </span>
                <button
                  type="button"
                  className="dt-link-btn"
                  disabled={!!syncingSource}
                  onClick={() => void triggerSync([s])}
                >
                  {syncingSource === s ? <Loader2 size={12} className="dt-spin" /> : <RefreshCw size={12} />}
                  Sync
                </button>
              </div>
            ))}
            {sourceErrors.map(s => (
              <p key={s} className="dt-err-text">
                {SOURCE_SHORT[s]}: {(sources[s].lastError || 'error').replace(/<[^>]+>/g, ' ').slice(0, 140)}
              </p>
            ))}
            <p className="dt-card-meta">Tray items: {tabCounts.tray} · Records: {calls.length}</p>
            <button
              type="button"
              className="dt-sync-all"
              disabled={!!syncingSource}
              onClick={() => void triggerSync(ALL_SOURCES)}
            >
              {syncingSource ? <Loader2 size={13} className="dt-spin" /> : <RefreshCw size={13} />}
              {syncingSource ? `Syncing ${SOURCE_SHORT[syncingSource]}…` : 'Sync all sources'}
            </button>
          </div>

          <div className="dt-card">
            <h3>Quick actions</h3>
            <ul className="dt-legend-list">
              <li><ArrowUpRight size={13} /> Promote to Calls</li>
              <li><X size={13} /> Dismiss</li>
              <li><Eye size={13} /> Watch</li>
              <li><ExternalLink size={13} /> Open source</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default Discovery
