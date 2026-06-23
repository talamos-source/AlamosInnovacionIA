import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  Globe,
  RefreshCw,
  ExternalLink,
  X,
  Clock,
  Sparkles,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
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
}

export interface DiscoverySourceMeta {
  lastSync?: string
  lastSyncStatus: 'idle' | 'syncing' | 'success' | 'error'
  recordCount: number
  lastError?: string
  newCount?: number
  updatedCount?: number
}

interface DiscoverySourcesState {
  EU_PORTAL: DiscoverySourceMeta
  BDNS: DiscoverySourceMeta
}

/* ============================================================
   Constantes
   ============================================================ */

const DEFAULT_SOURCES: DiscoverySourcesState = {
  EU_PORTAL: { lastSyncStatus: 'idle', recordCount: 0 },
  BDNS: { lastSyncStatus: 'idle', recordCount: 0 },
}

/**
 * Mapping defensivo de códigos SEDIA → nombres legibles.
 * Si el backend (antes del último deploy) guardó "Programme 111111" en localStorage,
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

/**
 * Limpia "Programme 12345" → nombre legible (si conocemos el código).
 * Conserva resto de strings incluyendo extensiones como "- CL5", "· RIA".
 */
function normalizeProgramName(program: string): string {
  if (!program) return program
  // Caso típico: "Programme 111111" o "Programme 111111 — Health · RIA"
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

const ITEMS_PER_PAGE = 25

/* ============================================================
   Storage helpers
   ============================================================ */

const loadCalls = (): DiscoveryCall[] => {
  try {
    const raw = localStorage.getItem('discoveryCalls')
    return raw ? (JSON.parse(raw) as DiscoveryCall[]) : []
  } catch {
    return []
  }
}

const saveCalls = (calls: DiscoveryCall[]) => {
  localStorage.setItem('discoveryCalls', JSON.stringify(calls))
  localStorage.setItem('appDataUpdatedAt', new Date().toISOString())
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
  localStorage.setItem('discoverySources', JSON.stringify(sources))
  localStorage.setItem('appDataUpdatedAt', new Date().toISOString())
}

const daysUntil = (dateStr?: string): number | null => {
  if (!dateStr) return null
  const target = new Date(dateStr)
  if (Number.isNaN(target.getTime())) return null
  const now = new Date()
  return Math.floor((target.getTime() - now.getTime()) / 86400000)
}

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

const isToday = (dateStr?: string): boolean => {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const t = new Date()
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  )
}

const isThisWeek = (dateStr?: string): boolean => {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const t = new Date()
  const diffDays = Math.floor((t.getTime() - d.getTime()) / 86400000)
  return diffDays >= 0 && diffDays <= 7
}

/* ============================================================
   Componente principal
   ============================================================ */

type ViewFilter = 'all' | 'today' | 'reviewing' | 'dismissed' | 'closing-soon' | 'this-week'

const Discovery = () => {
  const navigate = useNavigate()

  const [calls, setCalls] = useState<DiscoveryCall[]>(loadCalls)
  const [sources, setSources] = useState<DiscoverySourcesState>(loadSources)
  const [view, setView] = useState<ViewFilter>('all')
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'all' | DiscoverySource>('all')
  const [programFilter, setProgramFilter] = useState<string>('all')
  const [typeOfActionFilter, setTypeOfActionFilter] = useState<string>('all')
  const [regionFilter, setRegionFilter] = useState<string>('all')
  const [deadlineYearFilter, setDeadlineYearFilter] = useState<string>('all')
  const [actionableOnly, setActionableOnly] = useState(true)
  const [page, setPage] = useState(1)
  const [syncingSource, setSyncingSource] = useState<DiscoverySource | null>(null)
  const [syncBanner, setSyncBanner] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  /* ----------------------------------------------------------
     Auto-sync al entrar (en background, no bloquea UI)
     Solo si han pasado más de 30 min desde el último sync.
     ---------------------------------------------------------- */
  useEffect(() => {
    // Limpieza inmediata de zombies con deadline pasada (no esperamos al sync).
    // Conservamos dismissed/imported por historial.
    const todayMs = Date.now()
    const GRACE_MS = 86400000 // 1 día
    const initialCount = calls.length
    let renamedCount = 0
    const purged = calls.filter(c => {
      if (c.userStatus === 'dismissed' || c.userStatus === 'imported') return true
      if (!c.closeDate) return true // sin deadline → puede ser Forthcoming
      const t = new Date(c.closeDate).getTime()
      if (Number.isNaN(t)) return true
      return t >= todayMs - GRACE_MS
    }).map(c => {
      // Defensive: si el program quedó como "Programme XXXXX" (cache viejo), lo mapeamos
      const normalized = normalizeProgramName(c.program)
      if (normalized !== c.program) {
        renamedCount += 1
        return { ...c, program: normalized }
      }
      return c
    })
    if (purged.length !== initialCount || renamedCount > 0) {
      console.log(`[Discovery] Cleanup: purged ${initialCount - purged.length} past-deadline, renamed ${renamedCount} unknown programmes`)
      persistCalls(purged)
    }

    const RECENT_MS = 30 * 60 * 1000 // 30 min
    const now = Date.now()
    const lastEU = sources.EU_PORTAL.lastSync ? new Date(sources.EU_PORTAL.lastSync).getTime() : 0
    const lastBDNS = sources.BDNS.lastSync ? new Date(sources.BDNS.lastSync).getTime() : 0
    const shouldSyncEU = now - lastEU > RECENT_MS
    const shouldSyncBDNS = now - lastBDNS > RECENT_MS

    if (shouldSyncEU || shouldSyncBDNS) {
      // Disparamos en background (no await)
      void triggerSync('all')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ----------------------------------------------------------
     Persistencia
     ---------------------------------------------------------- */

  const persistCalls = (next: DiscoveryCall[]) => {
    setCalls(next)
    saveCalls(next)
  }
  const persistSources = (next: DiscoverySourcesState) => {
    setSources(next)
    saveSources(next)
  }

  /* ----------------------------------------------------------
     KPIs
     ---------------------------------------------------------- */

  const kpis = useMemo(() => {
    const open = calls.filter(c => c.userStatus !== 'dismissed' && c.userStatus !== 'imported')
    return {
      all: open.length,
      today: open.filter(c => isToday(c.discoveredAt)).length,
      reviewing: calls.filter(c => c.userStatus === 'reviewing').length,
      dismissed: calls.filter(c => c.userStatus === 'dismissed').length,
      closingSoon: open.filter(c => {
        const d = daysUntil(c.closeDate)
        return d !== null && d >= 0 && d <= 30
      }).length,
      thisWeek: open.filter(c => isThisWeek(c.discoveredAt)).length,
    }
  }, [calls])

  /* ----------------------------------------------------------
     Lista de programas únicos (para el dropdown)
     ---------------------------------------------------------- */

  const uniquePrograms = useMemo(() => {
    const set = new Set<string>()
    calls.forEach(c => {
      if (c.program && c.program.trim()) set.add(c.program.trim())
    })
    return Array.from(set).sort()
  }, [calls])

  /* ----------------------------------------------------------
     Años de deadline únicos (para el dropdown)
     ---------------------------------------------------------- */

  /* ----------------------------------------------------------
     Type of Action únicos (para el dropdown)
     ---------------------------------------------------------- */

  const uniqueTypesOfAction = useMemo(() => {
    const set = new Set<string>()
    calls.forEach(c => {
      if (c.typeOfAction && c.typeOfAction.trim()) set.add(c.typeOfAction.trim())
    })
    return Array.from(set).sort()
  }, [calls])

  /* ----------------------------------------------------------
     Regiones únicas (para el dropdown)
     ---------------------------------------------------------- */

  const uniqueRegions = useMemo(() => {
    const set = new Set<string>()
    calls.forEach(c => {
      if (c.region && c.region.trim()) set.add(c.region.trim())
    })
    return Array.from(set).sort()
  }, [calls])

  const uniqueDeadlineYears = useMemo(() => {
    const set = new Set<number>()
    calls.forEach(c => {
      if (c.closeDate) {
        const y = new Date(c.closeDate).getFullYear()
        if (!Number.isNaN(y) && y > 1900) set.add(y)
      }
    })
    return Array.from(set).sort((a, b) => a - b) // ascendente: 2026, 2027, 2028
  }, [calls])

  /* ----------------------------------------------------------
     Filtrado de la tabla
     ---------------------------------------------------------- */

  const filteredCalls = useMemo(() => {
    let filtered = calls

    // View filter (KPI)
    switch (view) {
      case 'all':
        filtered = filtered.filter(c => c.userStatus !== 'dismissed' && c.userStatus !== 'imported')
        break
      case 'today':
        filtered = filtered.filter(c => isToday(c.discoveredAt))
        break
      case 'reviewing':
        filtered = filtered.filter(c => c.userStatus === 'reviewing')
        break
      case 'dismissed':
        filtered = filtered.filter(c => c.userStatus === 'dismissed')
        break
      case 'closing-soon':
        filtered = filtered.filter(c => {
          const d = daysUntil(c.closeDate)
          return d !== null && d >= 0 && d <= 30
        })
        break
      case 'this-week':
        filtered = filtered.filter(c => isThisWeek(c.discoveredAt))
        break
    }

    if (actionableOnly) filtered = filtered.filter(c => c.actionable)

    // Filtro defensivo: oculta calls con deadline pasada en todas las vistas excepto Dismissed.
    // SEDIA tiene lag entre cerrar deadline y cambiar status, + zombies cacheadas.
    if (view !== 'dismissed') {
      const todayMs = Date.now()
      filtered = filtered.filter(c => {
        if (!c.closeDate) return true // sin fecha → permitimos (Forthcoming aún sin deadline)
        const t = new Date(c.closeDate).getTime()
        if (Number.isNaN(t)) return true
        return t >= todayMs - 86400000 // gracia 1 día por UTC
      })
    }

    if (sourceFilter !== 'all') filtered = filtered.filter(c => c.source === sourceFilter)
    if (programFilter !== 'all') filtered = filtered.filter(c => c.program === programFilter)
    if (typeOfActionFilter !== 'all') filtered = filtered.filter(c => c.typeOfAction === typeOfActionFilter)
    if (regionFilter !== 'all') filtered = filtered.filter(c => c.region === regionFilter)
    if (deadlineYearFilter !== 'all') {
      const targetYear = Number(deadlineYearFilter)
      filtered = filtered.filter(c => {
        if (!c.closeDate) return false
        const y = new Date(c.closeDate).getFullYear()
        return y === targetYear
      })
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim()
      filtered = filtered.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.fundingBody.toLowerCase().includes(q) ||
        c.program.toLowerCase().includes(q)
      )
    }

    // Orden por deadline ascendente (más próximo primero). Calls sin
    // closeDate o con fecha inválida quedan al final. Tras ese criterio,
    // desempate por discoveredAt descendente (más recientes primero).
    const sorted = [...filtered].sort((a, b) => {
      const ta = a.closeDate ? new Date(a.closeDate).getTime() : NaN
      const tb = b.closeDate ? new Date(b.closeDate).getTime() : NaN
      const aValid = !Number.isNaN(ta)
      const bValid = !Number.isNaN(tb)
      if (aValid && bValid) {
        if (ta !== tb) return ta - tb
      } else if (aValid) {
        return -1
      } else if (bValid) {
        return 1
      }
      // Desempate
      const da = a.discoveredAt ? new Date(a.discoveredAt).getTime() : 0
      const db = b.discoveredAt ? new Date(b.discoveredAt).getTime() : 0
      return db - da
    })

    return sorted
  }, [calls, view, actionableOnly, sourceFilter, programFilter, typeOfActionFilter, regionFilter, deadlineYearFilter, search])

  const totalCount = filteredCalls.length
  const actionableCount = filteredCalls.filter(c => c.actionable).length
  const noDeadlineCount = filteredCalls.filter(c => !c.closeDate).length
  const pastCount = filteredCalls.filter(c => {
    const d = daysUntil(c.closeDate)
    return d !== null && d < 0
  }).length

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE))
  const pageCalls = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE
    return filteredCalls.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredCalls, page])

  useEffect(() => {
    if (page > totalPages) setPage(1)
  }, [totalPages, page])

  /* ----------------------------------------------------------
     Acciones de usuario sobre calls
     ---------------------------------------------------------- */

  const dismissCall = (id: string) => {
    persistCalls(calls.map(c => c.id === id ? { ...c, userStatus: 'dismissed' } : c))
  }

  const restoreCall = (id: string) => {
    persistCalls(calls.map(c =>
      c.id === id ? { ...c, userStatus: c.importedToCallId ? 'imported' : 'new' } : c
    ))
  }

  const openImportFlow = (id: string) => {
    navigate(`/discovery/${id}/import`)
  }

  /* ----------------------------------------------------------
     Sync — llamada al backend
     ---------------------------------------------------------- */

  const triggerSync = async (source: DiscoverySource | 'all') => {
    setSyncBanner(null)
    const targets: DiscoverySource[] = source === 'all' ? ['EU_PORTAL', 'BDNS'] : [source]

    // Mantenemos un snapshot que se actualiza tras cada iteración.
    // Sin esto, el sync 'all' (iter 1 EU + iter 2 BDNS) usaba el mismo `calls`
    // congelado en el closure → perdíamos las calls añadidas en iter 1.
    let currentCalls = calls

    for (const s of targets) {
      setSyncingSource(s)
      persistSources({
        ...sources,
        [s]: { ...sources[s], lastSyncStatus: 'syncing' },
      })

      try {
        const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || 'https://alamosinnovacionia.onrender.com'
        const token = localStorage.getItem('authToken') || ''

        const response = await fetch(`${API_BASE}/discovery/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ source: s }),
        })

        if (!response.ok) {
          const errText = await response.text()
          throw new Error(errText || `HTTP ${response.status}`)
        }

        const data = await response.json() as { calls: Array<Omit<DiscoveryCall, 'id' | 'userStatus' | 'discoveredAt'>> }

        // Merge con calls existentes (usar snapshot actualizado, no el closure original)
        const existingByExternal = new Map<string, DiscoveryCall>()
        currentCalls.forEach(c => existingByExternal.set(`${c.source}::${c.externalId}`, c))

        const now = new Date().toISOString()
        let newCount = 0
        let updatedCount = 0
        const merged: DiscoveryCall[] = []

        // Add or update incoming calls
        for (const incoming of data.calls) {
          const key = `${incoming.source}::${incoming.externalId}`
          const existing = existingByExternal.get(key)
          if (existing) {
            // Conservamos el userStatus y datos importados
            merged.push({
              ...incoming,
              id: existing.id,
              userStatus: existing.userStatus,
              discoveredAt: existing.discoveredAt,
              importedToCallId: existing.importedToCallId,
              importedAt: existing.importedAt,
            })
            updatedCount += 1
            existingByExternal.delete(key)
          } else {
            merged.push({
              ...incoming,
              id: `disc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              userStatus: 'new',
              discoveredAt: now,
            })
            newCount += 1
          }
        }

        // Tratamiento de stragglers (calls que tenemos en cache y NO han vuelto en este sync):
        //
        // Si el sync fue suficientemente exhaustivo (>= 50 calls de respuesta), confiamos en
        // que es la verdad y eliminamos los stragglers del mismo source. Esto mata zombies
        // como "DIGITAL-2023-SKILLS-05-SPECIALEDU" que se quedaron pegados con deadline
        // 2028 desde syncs viejos con bugs (la API ya no los devuelve, son closed).
        //
        // Si el sync trajo pocos (< 50), no nos fiamos (pudo fallar a mitad) y aplicamos
        // criterios defensivos solo: descartar closed o con deadline pasada.
        //
        // En ambos casos: dismissed e imported se conservan por historial.
        const todayMs = Date.now()
        const syncWasComprehensive = data.calls.length >= 50

        existingByExternal.forEach(c => {
          // Calls de OTRO source: siempre conservar (el sync de este source no las afecta)
          if (c.source !== s) {
            merged.push(c)
            return
          }
          // Historial de decisiones del usuario: siempre conservar
          if (c.userStatus === 'dismissed' || c.userStatus === 'imported') {
            merged.push(c)
            return
          }
          // Si externalStatus es closed, fuera
          if (c.externalStatus === 'closed') return

          if (syncWasComprehensive) {
            // El sync ha sido exhaustivo y esta call NO ha vuelto → es zombie, fuera.
            return
          }

          // Sync no fiable → solo descartamos si la deadline está pasada
          if (c.closeDate) {
            const t = new Date(c.closeDate).getTime()
            if (!Number.isNaN(t) && t < todayMs - 86400000) return
          }
          merged.push(c)
        })

        persistCalls(merged)
        currentCalls = merged // siguiente iteración usa el state ACTUALIZADO
        persistSources({
          ...sources,
          [s]: {
            lastSync: now,
            lastSyncStatus: 'success',
            recordCount: data.calls.length,
            newCount,
            updatedCount,
          },
        })

        setSyncBanner(`${SOURCE_LABELS[s]}: ${newCount} new, ${updatedCount} updated (${data.calls.length} total)`)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        persistSources({
          ...sources,
          [s]: { ...sources[s], lastSyncStatus: 'error', lastError: message },
        })
        setSyncBanner(`Error syncing ${SOURCE_LABELS[s]}: ${message}`)
      }
    }

    setSyncingSource(null)
  }

  /* ----------------------------------------------------------
     Render
     ---------------------------------------------------------- */

  return (
    <div className="page page--discovery">
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Discovery</h1>
          <p className="page-subtitle">Discover and import funding opportunities from external sources</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="disc-kpi-grid">
        <KpiTile label="All" value={kpis.all} dotColor="brand" active={view === 'all'} onClick={() => setView('all')} />
        <KpiTile label="Today" value={kpis.today} dotColor="warning" active={view === 'today'} onClick={() => setView('today')} />
        <KpiTile label="Reviewing" value={kpis.reviewing} dotColor="warning" active={view === 'reviewing'} onClick={() => setView('reviewing')} />
        <KpiTile label="Dismissed" value={kpis.dismissed} dotColor="muted" active={view === 'dismissed'} onClick={() => setView('dismissed')} />
        <KpiTile label="Closing Soon" value={kpis.closingSoon} icon={<AlertTriangle size={14} />} variant="danger" active={view === 'closing-soon'} onClick={() => setView('closing-soon')} />
        <KpiTile label="This Week" value={kpis.thisWeek} icon={<Sparkles size={14} />} variant="brand" active={view === 'this-week'} onClick={() => setView('this-week')} />
      </div>

      {/* Sources */}
      <section className="disc-sources-section surface-card">
        <header className="disc-sources-header">
          <h2>Sources</h2>
          <span className="disc-last-sync">
            Last sync: {sources.EU_PORTAL.lastSync || sources.BDNS.lastSync
              ? formatDate(
                  [sources.EU_PORTAL.lastSync, sources.BDNS.lastSync]
                    .filter((d): d is string => Boolean(d))
                    .sort()
                    .pop()
                )
              : '—'}
          </span>
        </header>

        <div className="disc-sources-cards">
          <SourceCard
            source="BDNS"
            sources={sources}
            syncingSource={syncingSource}
            onSync={() => triggerSync('BDNS')}
          />
          <SourceCard
            source="EU_PORTAL"
            sources={sources}
            syncingSource={syncingSource}
            onSync={() => triggerSync('EU_PORTAL')}
          />
        </div>

        {syncBanner && (
          <div className="disc-sync-banner">
            <span>{syncBanner}</span>
            <button type="button" onClick={() => setSyncBanner(null)} aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        )}
      </section>

      {/* Filters */}
      <div className="disc-filters">
        <div className="search-bar-inline disc-search">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search calls…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input-inline"
          />
        </div>

        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}
          className="filter-btn"
        >
          <option value="all">All Sources</option>
          <option value="EU_PORTAL">EU Funding & Tenders Portal</option>
          <option value="BDNS">BDNS — Spanish Grants</option>
        </select>

        <select
          value={programFilter}
          onChange={(e) => setProgramFilter(e.target.value)}
          className="filter-btn"
        >
          <option value="all">All Programs</option>
          {uniquePrograms.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <select
          value={typeOfActionFilter}
          onChange={(e) => setTypeOfActionFilter(e.target.value)}
          className="filter-btn"
          title="Filter by type of action (RIA, IA, CSA, Cascade…)"
        >
          <option value="all">All Action Types</option>
          {uniqueTypesOfAction.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="filter-btn"
          title="Filter by region (only BDNS calls have region)"
        >
          <option value="all">All Regions</option>
          {uniqueRegions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <select
          value={deadlineYearFilter}
          onChange={(e) => setDeadlineYearFilter(e.target.value)}
          className="filter-btn"
          title="Filter by deadline year"
        >
          <option value="all">All Years</option>
          {uniqueDeadlineYears.map(y => <option key={y} value={String(y)}>{y}</option>)}
        </select>

        <label className="disc-actionable">
          <input
            type="checkbox"
            checked={actionableOnly}
            onChange={(e) => setActionableOnly(e.target.checked)}
          />
          <Clock size={14} />
          <span>Actionable</span>
        </label>

        <div className="disc-counts">
          Total: <strong>{totalCount}</strong>
          &nbsp;·&nbsp; Actionable: <strong className="text-success">{actionableCount}</strong>
          &nbsp;·&nbsp; No deadline: <strong className="text-muted">{noDeadlineCount}</strong>
          &nbsp;·&nbsp; Past: <strong className="text-danger">{pastCount}</strong>
        </div>
      </div>

      {/* Table */}
      <div className="disc-table-container">
        <table className="data-table disc-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input
                  type="checkbox"
                  checked={pageCalls.length > 0 && pageCalls.every(c => selected.has(c.id))}
                  onChange={(e) => {
                    const next = new Set(selected)
                    if (e.target.checked) pageCalls.forEach(c => next.add(c.id))
                    else pageCalls.forEach(c => next.delete(c.id))
                    setSelected(next)
                  }}
                />
              </th>
              <th>Call</th>
              <th>Program</th>
              <th>Type of Action</th>
              <th>Region</th>
              <th>Budget</th>
              <th>Deadline</th>
              <th>Status</th>
              <th style={{ width: 90, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageCalls.length === 0 ? (
              <tr><td colSpan={9} className="empty-row">No calls found. Try syncing a source to fetch fresh opportunities.</td></tr>
            ) : pageCalls.map(call => {
              const dDays = daysUntil(call.closeDate)
              return (
                <tr key={call.id} className="disc-row">
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(call.id)}
                      onChange={(e) => {
                        const next = new Set(selected)
                        if (e.target.checked) next.add(call.id)
                        else next.delete(call.id)
                        setSelected(next)
                      }}
                    />
                  </td>
                  <td>
                    <div className="disc-call-cell">
                      <div className="disc-call-title">{call.title}</div>
                      <a
                        href={call.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="disc-call-entity"
                        title={call.url}
                      >
                        {call.fundingBody}
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </td>
                  <td className="disc-program">{call.program || '—'}</td>
                  <td className="disc-type-action">{call.typeOfAction || '—'}</td>
                  <td className="disc-region">{call.region || '—'}</td>
                  <td className="disc-budget">{call.budget || '—'}</td>
                  <td>
                    <div className="disc-deadline">
                      <span>{formatDate(call.closeDate)}</span>
                      {dDays !== null && (
                        <span className={`disc-deadline-rel ${dDays < 0 ? 'past' : dDays <= 30 ? 'soon' : ''}`}>
                          {dDays < 0 ? `${Math.abs(dDays)} days past` : `${dDays} days`}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <DiscoveryStatusBadge status={call.userStatus} externalStatus={call.externalStatus} />
                  </td>
                  <td>
                    <div className="disc-actions">
                      <button
                        type="button"
                        className="disc-action-btn disc-action-btn--primary"
                        onClick={() => openImportFlow(call.id)}
                        title="Review and import to Calls"
                      >
                        <ExternalLink size={14} />
                      </button>
                      {call.userStatus === 'dismissed' ? (
                        <button
                          type="button"
                          className="disc-action-btn"
                          onClick={() => restoreCall(call.id)}
                          title="Restore"
                        >
                          <RefreshCw size={14} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="disc-action-btn"
                          onClick={() => dismissCall(call.id)}
                          title="Dismiss"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="pagination">
            <span className="pagination-info">Page {page} of {totalPages}</span>
            <div className="pagination-controls">
              <button className="pagination-btn" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>‹</button>
              <button className="pagination-btn" disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>›</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   Subcomponentes
   ============================================================ */

const KpiTile = ({
  label, value, dotColor, icon, variant, active, onClick,
}: {
  label: string
  value: number
  dotColor?: 'brand' | 'warning' | 'muted'
  icon?: React.ReactNode
  variant?: 'brand' | 'danger'
  active?: boolean
  onClick?: () => void
}) => (
  <button
    type="button"
    className={`disc-kpi-tile ${active ? 'disc-kpi-tile--active' : ''} ${variant ? `disc-kpi-tile--${variant}` : ''}`}
    onClick={onClick}
  >
    <div className="disc-kpi-label">
      {icon || (dotColor && <span className={`disc-kpi-dot disc-kpi-dot--${dotColor}`} />)}
      <span>{label}</span>
    </div>
    <div className="disc-kpi-value tabular-nums">{value}</div>
  </button>
)

const SourceCard = ({
  source, sources, syncingSource, onSync,
}: {
  source: DiscoverySource
  sources: DiscoverySourcesState
  syncingSource: DiscoverySource | null
  onSync: () => void
}) => {
  const meta = sources[source]
  const isSyncing = syncingSource === source
  return (
    <div className={`disc-source-card ${isSyncing ? 'disc-source-card--syncing' : ''}`}>
      <div className="disc-source-icon"><Globe size={18} /></div>
      <div className="disc-source-info">
        <span className="disc-source-name">{SOURCE_LABELS[source]}</span>
        <span className="disc-source-meta">
          {isSyncing ? 'Syncing…' : `${meta.recordCount} records`}
          {meta.lastSyncStatus === 'success' && !isSyncing && ' · success'}
          {meta.lastSyncStatus === 'error' && !isSyncing && ' · error'}
        </span>
      </div>
      <button
        type="button"
        className={`disc-source-sync-btn ${isSyncing ? 'disc-source-sync-btn--syncing' : ''}`}
        onClick={onSync}
        disabled={!!syncingSource}
      >
        {isSyncing ? (
          <>
            <Loader2 size={14} className="cc-spinner" />
            <span>Syncing…</span>
          </>
        ) : (
          <>
            <RefreshCw size={14} />
            <span>Sync</span>
          </>
        )}
      </button>
    </div>
  )
}

const DiscoveryStatusBadge = ({
  status, externalStatus,
}: {
  status: DiscoveryUserStatus
  externalStatus: DiscoveryExternalStatus
}) => {
  // Reglas de display:
  //  · Si has tomado acción (reviewing / dismissed / imported) → prima esa.
  //  · Si no, mostramos el externalStatus (Open / Forthcoming / Closed) — más útil que "New"
  //    porque siempre todo es "new" tras sync inicial.
  //  · Sin externalStatus reconocible → fallback "—"
  let label = ''
  let cls = ''
  if (status === 'reviewing') { label = 'Reviewing'; cls = 'warning' }
  else if (status === 'dismissed') { label = 'Dismissed'; cls = 'muted' }
  else if (status === 'imported') { label = 'Imported'; cls = 'success' }
  else if (externalStatus === 'open') { label = 'Open'; cls = 'success' }
  else if (externalStatus === 'forthcoming') { label = 'Forthcoming'; cls = 'warning' }
  else if (externalStatus === 'closed') { label = 'Closed'; cls = 'muted' }
  else { label = '—'; cls = 'muted' }

  return (
    <span className={`disc-badge disc-badge--${cls}`}>
      <span className="disc-badge-dot" />
      {label}
    </span>
  )
}

export default Discovery
