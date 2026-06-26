import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Calendar,
  TrendingUp,
  AlertTriangle,
  History,
  ExternalLink,
  Trash2,
  Plus,
  X,
  Search,
  FileDown,
  Download,
  GitCompare,
} from 'lucide-react'
import './Page.css'
import './Roadmap.css'
import RoadmapTimeline, { type RoadmapTimelineHandle } from './RoadmapTimeline'
import RoadmapDiff from './RoadmapDiff'
import { generateRoadmapPpt, type PptCallDetail } from '../utils/roadmapPpt'
import { generateRoadmapPdf, type PdfCallDetail } from '../utils/roadmapPdf'

/* ============================================================
   Tipos
   ============================================================ */

interface RoadmapRecommendation {
  callId: string
  title: string
  source: 'EU_PORTAL' | 'BDNS'
  fitScore: number
  reasoning: string
  recommendedMonth: string         // YYYY-MM
  estimatedFundingRange: string
  risks: string
  priorityOrder: number
  /** Orientación estratégica para enfocar la propuesta. Opcional para back-compat. */
  applicationGuidance?: string
  /** TRL mínimo necesario del cliente para aplicar a esta convocatoria. */
  expectedStartTRL?: number
  /** TRL realista alcanzable al finalizar el proyecto. */
  expectedEndTRL?: number
  /** ID de la TRL line del cliente que esta call mejor sirve (FundingProfile.trlProfile[].id). */
  techLineId?: string | null
}

interface RoadmapResult {
  executiveSummary: string
  totalPotentialFunding: string
  totalCallsRecommended: number
  recommendations: RoadmapRecommendation[]
}

interface SavedRoadmap {
  id: string
  customerId: string
  timeline: 1 | 2 | 3
  generatedAt: string
  callsConsidered: number
  model?: string
  result: RoadmapResult
}

interface CustomerRow {
  id: string
  name: string
  company: string
  region?: string
  country?: string
  companySize?: string
  category?: string
  description?: string
  incorporationDate?: string
}

/**
 * Contexto del cliente normalizado a strings planos por loadContextForCustomer.
 * El storage original guarda cada campo como { value, suggested } pero el
 * loader extrae el .value y devuelve esto.
 */
interface CustomerContextData {
  businessModel?: string
  companyOverview?: string
  technologyInnovation?: string
  currentTRL?: string
  rdiRoadmap?: string
}

interface FundingProfileLoaded {
  coFinancingCapacityPercent?: number
  preferredProjectType?: string
  desiredAmountRange?: string
  targetTRL?: number
  trlProfile?: Array<{
    id: string
    technology: string
    currentTRL: number
    targetTRL: number
    rdRoadmap?: string
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

interface DiscoveryCall {
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
  url?: string
}

/* ============================================================
   Helpers
   ============================================================ */

const ROADMAPS_KEY = 'roadmaps'

const loadAllRoadmaps = (): SavedRoadmap[] => {
  try {
    const raw = localStorage.getItem(ROADMAPS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as SavedRoadmap[]
  } catch {
    return []
  }
}
const saveAllRoadmaps = (list: SavedRoadmap[]) => {
  localStorage.setItem(ROADMAPS_KEY, JSON.stringify(list))
}

const loadCustomer = (id: string): CustomerRow | null => {
  try {
    const raw = localStorage.getItem('customers')
    if (!raw) return null
    const list = JSON.parse(raw) as CustomerRow[]
    return list.find(c => c.id === id) || null
  } catch { return null }
}

/**
 * Carga el contexto del cliente.
 *
 * BUG FIX: el contexto se guarda DENTRO del customer (customers[i].context),
 * no en una key separada. Además cada campo del shape original es
 * { value: string, suggested?: boolean }; aquí lo normalizamos a strings
 * planos para enviarlo al agente.
 */
const loadContextForCustomer = (id: string): CustomerContextData | null => {
  try {
    const raw = localStorage.getItem('customers')
    if (!raw) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list = JSON.parse(raw) as Array<{ id: string; context?: Record<string, any> }>
    const cust = list.find(c => c.id === id)
    if (!cust?.context) return null
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(cust.context)) {
      if (typeof v === 'string') out[k] = v
      else if (v && typeof v === 'object' && typeof v.value === 'string') out[k] = v.value
    }
    return out as CustomerContextData
  } catch { return null }
}

const loadFundingProfile = (id: string): FundingProfileLoaded | null => {
  try {
    const raw = localStorage.getItem('fundingProfiles')
    if (!raw) return null
    const all = JSON.parse(raw)
    // Defensa contra el bug histórico que dejó "[]" en algunos clientes
    if (!all || typeof all !== 'object' || Array.isArray(all)) return null
    return (all as Record<string, FundingProfileLoaded>)[id] || null
  } catch { return null }
}

/**
 * Lectura sincrónica para useMemo. Devuelve lo que haya en localStorage
 * (legacy) — la fuente de verdad real es IndexedDB, cargada por el
 * useEffect siguiente. Si el usuario aún no ha visitado Discovery, IDB
 * puede estar vacío; entonces caemos al localStorage legacy.
 */
const loadDiscoveryCallsSync = (): DiscoveryCall[] => {
  try {
    const raw = localStorage.getItem('discoveryCalls')
    if (!raw) return []
    return JSON.parse(raw) as DiscoveryCall[]
  } catch { return [] }
}

/**
 * Devuelve el contexto como object plano para enviar al backend.
 * Ahora es prácticamente identity porque loadContextForCustomer ya normalizó.
 * Mantenida la función por compat con call-sites existentes y por filtrar undefined.
 */
const flattenContext = (ctx: CustomerContextData | null): Record<string, string> | undefined => {
  if (!ctx) return undefined
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(ctx)) {
    if (typeof v === 'string' && v.trim()) out[k] = v
  }
  return Object.keys(out).length > 0 ? out : undefined
}

const formatRecommendedMonth = (m: string): string => {
  // 2026-09 → "Sep 2026"
  const [y, mo] = m.split('-')
  const date = new Date(Number(y), Number(mo) - 1, 1)
  return date.toLocaleString('en-US', { month: 'short', year: 'numeric' })
}

const sourceLabel = (s: 'EU_PORTAL' | 'BDNS') => (s === 'EU_PORTAL' ? 'EU Portal' : 'BDNS Spain')

/**
 * Limpia bracket-tags que el agente a veces añade (heredados de prompts/descripciones).
 * Pilla: [Evergreen], [Evergreen permanent], [Permanent], [Recurrent annual], etc.
 * Aplica strip global (en cualquier posición), case-insensitive.
 */
const stripAgentTags = (s: string | undefined): string => {
  if (!s) return ''
  return s
    .replace(/\[\s*(Evergreen|Permanent|Annual|Biannual|Recurrent|Forthcoming|Open)\b[^\]]*\]\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/* ============================================================
   Componente
   ============================================================ */

const RoadmapPage = () => {
  const { customerId } = useParams<{ customerId: string }>()
  const navigate = useNavigate()

  const customer = useMemo(() => (customerId ? loadCustomer(customerId) : null), [customerId])
  const context = useMemo(() => (customerId ? loadContextForCustomer(customerId) : null), [customerId])
  const fundingProfile = useMemo(() => (customerId ? loadFundingProfile(customerId) : null), [customerId])
  const allRoadmaps = useMemo(() => loadAllRoadmaps(), [])

  const customerRoadmaps = useMemo(
    () =>
      customerId
        ? allRoadmaps
            .filter(r => r.customerId === customerId)
            .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
        : [],
    [customerId, allRoadmaps]
  )

  const [timeline, setTimeline] = useState<1 | 2 | 3>(2)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeRoadmap, setActiveRoadmap] = useState<SavedRoadmap | null>(
    customerRoadmaps[0] || null
  )
  // Estado local de roadmaps (para reflejar deletes/edits en UI sin recargar)
  const [roadmapsState, setRoadmapsState] = useState<SavedRoadmap[]>(allRoadmaps)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [view, setView] = useState<'timeline' | 'list'>('timeline')
  const [exportingPpt, setExportingPpt] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [diffOpen, setDiffOpen] = useState(false)
  const timelineRef = useRef<RoadmapTimelineHandle | null>(null)

  const customerRoadmapsFromState = useMemo(
    () =>
      customerId
        ? roadmapsState
            .filter(r => r.customerId === customerId)
            .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
        : [],
    [customerId, roadmapsState]
  )

  useEffect(() => {
    if (!activeRoadmap && customerRoadmapsFromState[0]) setActiveRoadmap(customerRoadmapsFromState[0])
  }, [customerRoadmapsFromState, activeRoadmap])

  // Persistencia helper
  const persistRoadmaps = (next: SavedRoadmap[]) => {
    setRoadmapsState(next)
    saveAllRoadmaps(next)
  }

  // ── Acciones sobre roadmaps ───────────────────────────────────────────
  /**
   * Export del roadmap activo a PowerPoint con branding Álamos.
   * Si está en vista List cambia temporalmente a Timeline para capturar el PNG,
   * y luego restaura.
   */
  const handleExportPpt = async () => {
    if (!activeRoadmap || !customer) return
    setExportingPpt(true)
    const previousView = view
    try {
      // Necesitamos el timeline montado para capturar el PNG
      if (view !== 'timeline') {
        setView('timeline')
        // Esperamos a que React monte el componente
        await new Promise(r => setTimeout(r, 250))
      }

      let timelinePng: string | undefined
      try {
        timelinePng = await timelineRef.current?.getTimelinePngDataUrl()
      } catch (err) {
        console.warn('Timeline PNG capture failed, generating PPT without timeline image:', err)
      }

      // Detalles enriquecidos por callId desde idiCalls (programa, región, deadline)
      const callDetails: Record<string, PptCallDetail> = {}
      idiCalls.forEach(c => {
        callDetails[c.externalId] = {
          externalId: c.externalId,
          url: c.url,
          program: c.program,
          region: c.region,
          closeDate: c.closeDate,
        }
      })

      // logoBase64 puede estar guardado en customer si CustomerDetail lo subió
      const logo = (customer as unknown as { logoBase64?: string }).logoBase64
      const sector = (customer as unknown as { category?: string }).category

      await generateRoadmapPpt({
        customerName: customer.name,
        customerLogoBase64: logo,
        customerSector: sector,
        timeline: activeRoadmap.timeline,
        recommendations: activeRoadmap.result.recommendations,
        timelineImageDataUrl: timelinePng,
        callDetails,
      })
    } catch (err) {
      console.error('PPT export failed:', err)
      alert('No se pudo generar el PPT. Revisa la consola para detalles.')
    } finally {
      setExportingPpt(false)
      if (view !== previousView) setView(previousView)
    }
  }

  /**
   * Export del roadmap activo a PDF (A4 landscape) con la misma identidad
   * visual que el PPT. Alternativa más ligera para email / propuestas.
   */
  const handleExportPdf = async () => {
    if (!activeRoadmap || !customer) return
    setExportingPdf(true)
    const previousView = view
    try {
      if (view !== 'timeline') {
        setView('timeline')
        await new Promise(r => setTimeout(r, 250))
      }
      let timelinePng: string | undefined
      try {
        timelinePng = await timelineRef.current?.getTimelinePngDataUrl()
      } catch (err) {
        console.warn('Timeline PNG capture failed, generating PDF without timeline image:', err)
      }
      const callDetails: Record<string, PdfCallDetail> = {}
      idiCalls.forEach(c => {
        callDetails[c.externalId] = {
          externalId: c.externalId,
          url: c.url,
          program: c.program,
          region: c.region,
          closeDate: c.closeDate,
        }
      })
      const logo = (customer as unknown as { logoBase64?: string }).logoBase64
      const sector = (customer as unknown as { category?: string }).category

      await generateRoadmapPdf({
        customerName: customer.name,
        customerLogoBase64: logo,
        customerSector: sector,
        timeline: activeRoadmap.timeline,
        recommendations: activeRoadmap.result.recommendations,
        timelineImageDataUrl: timelinePng,
        callDetails,
      })
    } catch (err) {
      console.error('PDF export failed:', err)
      alert('No se pudo generar el PDF. Revisa la consola para detalles.')
    } finally {
      setExportingPdf(false)
      if (view !== previousView) setView(previousView)
    }
  }

  const handleDeleteVersion = (rmId: string) => {
    if (!confirm('Delete this roadmap version? This cannot be undone.')) return
    const next = roadmapsState.filter(r => r.id !== rmId)
    persistRoadmaps(next)
    if (activeRoadmap?.id === rmId) {
      const fallback = next.filter(r => r.customerId === customerId)[0]
      setActiveRoadmap(fallback || null)
    }
  }

  const updateActiveRoadmap = (mutator: (r: SavedRoadmap) => SavedRoadmap) => {
    if (!activeRoadmap) return
    const updated = mutator(activeRoadmap)
    const next = roadmapsState.map(r => (r.id === updated.id ? updated : r))
    persistRoadmaps(next)
    setActiveRoadmap(updated)
    setLastSavedAt(new Date().toISOString())
  }

  const handleUpdateRecommendationMonth = (callId: string, newMonth: string) => {
    if (!activeRoadmap) return
    updateActiveRoadmap(r => ({
      ...r,
      result: {
        ...r.result,
        recommendations: r.result.recommendations.map(rec =>
          rec.callId === callId ? { ...rec, recommendedMonth: newMonth } : rec
        ),
      },
    }))
  }

  const handleRemoveRecommendation = (callId: string) => {
    if (!activeRoadmap) return
    updateActiveRoadmap(r => ({
      ...r,
      result: {
        ...r.result,
        recommendations: r.result.recommendations.filter(rec => rec.callId !== callId),
        totalCallsRecommended: r.result.recommendations.filter(rec => rec.callId !== callId).length,
      },
    }))
  }

  const [analyzingCallId, setAnalyzingCallId] = useState<string | null>(null)

  const handleAddFromDiscovery = async (call: DiscoveryCall) => {
    if (!activeRoadmap || !customer || !customerId) return
    const exists = activeRoadmap.result.recommendations.some(rec => rec.callId === call.externalId)
    if (exists) {
      alert('This call is already in the roadmap.')
      return
    }

    setAnalyzingCallId(call.externalId)
    type FitResult = {
      fitScore: number
      reasoning: string
      recommendedMonth: string
      estimatedFundingRange: string
      risks: string
      applicationGuidance?: string
      expectedStartTRL?: number
      expectedEndTRL?: number
      techLineId?: string | null
      eligibilityFlag?: 'OK' | 'WARNING' | 'BLOCKED'
    }
    let fit: FitResult | null = null

    try {
      const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || 'https://alamosinnovacionia.onrender.com'
      const token = localStorage.getItem('authToken') || ''
      const r = await fetch(`${API_BASE}/ai/analyze-call-fit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customer: {
            name: customer.name,
            company: customer.company,
            country: customer.country,
            region: customer.region,
            companySize: customer.companySize,
            category: customer.category,
            description: customer.description,
            incorporationDate: customer.incorporationDate,
          },
          context: flattenContext(context),
          fundingProfile,
          call: {
            externalId: call.externalId,
            source: call.source,
            title: call.title,
            fundingBody: call.fundingBody,
            program: call.program,
            typeOfAction: call.typeOfAction,
            region: call.region,
            budget: call.budget,
            closeDate: call.closeDate,
            openDate: call.openDate,
            externalStatus: call.externalStatus,
            rdiScore: call.rdiScore,
            description: call.description,
          },
          timeline: activeRoadmap.timeline,
        }),
      })
      if (r.ok) {
        const data = await r.json() as { fit: FitResult }
        fit = data.fit
      } else {
        console.warn('analyze-call-fit failed', await r.text())
      }
    } catch (e) {
      console.warn('analyze-call-fit error', e)
    } finally {
      setAnalyzingCallId(null)
    }

    const nextOrder = activeRoadmap.result.recommendations.length + 1
    const fallbackMonth = call.closeDate
      ? call.closeDate.slice(0, 7)
      : new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 7)

    const newRec: RoadmapRecommendation = {
      callId: call.externalId,
      title: call.title,
      source: call.source,
      fitScore: fit?.fitScore ?? 50,
      reasoning: fit?.reasoning || 'Añadida manualmente por el consultor. Análisis IA no disponible.',
      recommendedMonth: fit?.recommendedMonth || fallbackMonth,
      estimatedFundingRange: fit?.estimatedFundingRange || call.budget || '—',
      risks: fit?.risks || '—',
      priorityOrder: nextOrder,
      // ✅ Propagar los campos nuevos del fit al recommendation para que se rendericen
      //    el TRL bar y el bloque "Cómo orientar la solicitud" igual que en las recs
      //    generadas por el agente del roadmap completo.
      applicationGuidance: fit?.applicationGuidance,
      expectedStartTRL: fit?.expectedStartTRL,
      expectedEndTRL: fit?.expectedEndTRL,
      techLineId: fit?.techLineId,
    }

    if (fit?.eligibilityFlag === 'BLOCKED') {
      if (!confirm(`⚠️ AI flagged this call as BLOCKED for eligibility reasons:\n\n${fit.reasoning}\n\nAdd anyway?`)) {
        return
      }
    }

    updateActiveRoadmap(r => ({
      ...r,
      result: {
        ...r.result,
        recommendations: [...r.result.recommendations, newRec],
        totalCallsRecommended: r.result.recommendations.length + 1,
      },
    }))
    setPickerOpen(false)
    setPickerSearch('')
  }

  // Discovery calls: hidratamos de IndexedDB en mount. Initial state usa
  // localStorage por compat (puede tener legacy data); cuando IDB carga,
  // el state se actualiza y los useMemo de abajo se recalculan.
  const [discoveryAll, setDiscoveryAll] = useState<DiscoveryCall[]>(loadDiscoveryCallsSync)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { idbGet } = await import('../utils/idbStorage')
        const stored = await idbGet<DiscoveryCall[]>('discovery', 'allCalls')
        if (cancelled) return
        if (Array.isArray(stored) && stored.length > 0) {
          setDiscoveryAll(stored)
        }
      } catch (err) {
        console.warn('[Roadmap] hidratación de discoveryCalls desde IDB falló:', err)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Filtrar calls del discovery a I+D+i (score ≥ 50) y deadline futuro
  const idiCalls = useMemo(() => {
    const todayMs = Date.now() - 86400000
    return discoveryAll.filter(c => {
      const score = c.rdiScore ?? (c.source === 'EU_PORTAL' ? 100 : 0)
      if (score < 50) return false
      if (c.closeDate) {
        const t = new Date(c.closeDate).getTime()
        if (!Number.isNaN(t) && t < todayMs) return false
      }
      return true
    })
  }, [discoveryAll])

  // Mandamos TODAS las I+D+i al agente (hasta un cap alto). Antes filtrábamos a 40 por
  // rdiScore+deadline, pero todas las EU tienen score=100, así que el orden era arbitrario
  // por deadline → calls relevantes (LIFE) quedaban fuera frente a no-relevantes (Film Sales)
  // por unas semanas de diferencia. Mejor mandar todas y que Haiku decida con contexto cliente.
  // Cap alto — el backend hace multi-pass: pre-screener procesa todas las calls (formato
  // ultra-compacto), luego deep matcher solo recibe las 30-60 candidates plausibles.
  // Así no perdemos visibilidad de ninguna call.
  const AGENT_INPUT_CAP = 400
  const idiCallsForAgent = useMemo(() => {
    return idiCalls
      .slice()
      .sort((a, b) => {
        // Solo ordenamos como secundario por deadline (más urgentes primero) si hay que cortar.
        const da = a.closeDate ? new Date(a.closeDate).getTime() : Infinity
        const db = b.closeDate ? new Date(b.closeDate).getTime() : Infinity
        return da - db
      })
      .slice(0, AGENT_INPUT_CAP)
  }, [idiCalls])

  const [showPreview, setShowPreview] = useState(false)

  /**
   * Comprueba si el cliente tiene los campos críticos rellenos para que
   * el agente pueda generar un roadmap de calidad. Devuelve la lista de
   * gaps detectados (vacía si todo OK).
   */
  const checkClientReadiness = (): { critical: string[]; warnings: string[] } => {
    const critical: string[] = []
    const warnings: string[] = []
    // Contexto AI — sin esto el agente no puede generar guidance específica
    if (!context?.technologyInnovation && !context?.rdiRoadmap) {
      critical.push('Contexto AI del cliente — completar al menos technologyInnovation o rdiRoadmap (página Edit Context)')
    } else {
      if (!context?.technologyInnovation) warnings.push('Falta technologyInnovation (calidad de guidance reducida)')
      if (!context?.rdiRoadmap) warnings.push('Falta rdiRoadmap (sin hitos para sequence temporal)')
    }
    // TRL lines — sin esto no se puede asignar techLineId ni warnings de gap
    if (!fundingProfile?.trlProfile || fundingProfile.trlProfile.length === 0) {
      warnings.push('Sin líneas TRL definidas — el agente no podrá asignar recomendaciones a líneas técnicas (FundingProfile · Technology lines)')
    }
    // Funding Profile básico
    if (fundingProfile?.coFinancingCapacityPercent === undefined) {
      warnings.push('Sin capacidad de cofinanciación definida (FundingProfile)')
    }
    // Discovery I+D+i
    if (idiCalls.length === 0) {
      critical.push('No hay convocatorias I+D+i en Discovery — sincroniza EU Portal y BDNS antes de generar')
    } else if (idiCalls.length < 20) {
      warnings.push(`Solo ${idiCalls.length} convocatorias I+D+i en Discovery — recomendamos sincronizar para tener ≥50 candidates`)
    }
    return { critical, warnings }
  }

  const handleGenerate = async () => {
    if (!customer || !customerId) return

    // ── VALIDACIÓN PRE-GENERACIÓN ──
    const { critical, warnings } = checkClientReadiness()
    if (critical.length > 0) {
      alert(
        `⚠️ No se puede generar el roadmap.\n\nFaltan datos críticos:\n\n` +
        critical.map(c => `• ${c}`).join('\n') +
        `\n\nCompleta estos puntos antes de generar para evitar resultados pobres y gasto innecesario de tokens.`,
      )
      return
    }
    if (warnings.length > 0) {
      const confirmed = confirm(
        `⚠️ El roadmap se puede generar pero faltan datos que mejorarían la calidad:\n\n` +
        warnings.map(w => `• ${w}`).join('\n') +
        `\n\n¿Generar igualmente?`,
      )
      if (!confirmed) return
    }

    setGenerating(true)
    setError(null)
    try {
      const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || 'https://alamosinnovacionia.onrender.com'
      const token = localStorage.getItem('authToken') || ''

      const response = await fetch(`${API_BASE}/ai/generate-roadmap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customer,
          context: flattenContext(context),
          fundingProfile,
          // Top N pre-filtradas que ya tenemos calculadas
          calls: idiCallsForAgent,
          timeline,
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(errText || `HTTP ${response.status}`)
      }

      const data = await response.json() as {
        roadmap: RoadmapResult
        generatedAt: string
        callsConsidered: number
        model?: string
      }

      const saved: SavedRoadmap = {
        id: `rm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        customerId,
        timeline,
        generatedAt: data.generatedAt,
        callsConsidered: data.callsConsidered,
        model: data.model,
        result: data.roadmap,
      }

      // FIX: usar estado vivo (roadmapsState) NO el snapshot allRoadmaps que es stale.
      // Sin esto, al generar el 2º roadmap se perdía el 1º guardado.
      const next = [saved, ...roadmapsState]
      persistRoadmaps(next)
      setActiveRoadmap(saved)
      setLastSavedAt(new Date().toISOString())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setGenerating(false)
    }
  }

  /* ------------------------------------------------------------------------- */

  if (!customerId || !customer) {
    return (
      <div className="page page--roadmap">
        <header className="page-header">
          <button className="btn-secondary" onClick={() => navigate('/customers')}>
            <ArrowLeft size={16} /> Back to Customers
          </button>
        </header>
        <div className="empty-state">Customer not found.</div>
      </div>
    )
  }

  return (
    <div className="page page--roadmap">
      {/* ==================== HEADER ==================== */}
      <header className="rm-header">
        <div className="rm-header-left">
          <button className="back-btn" onClick={() => navigate(`/customers/${customerId}/funding-profile`)} aria-label="Back to Funding Profile">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>R+D+i Roadmap</h1>
            <p>
              {customer.name}
              {customer.company && <span className="muted"> · {customer.company}</span>}
            </p>
          </div>
        </div>

        <div className="rm-header-actions">
          <div className="rm-timeline-selector">
            <span className="muted">Horizon</span>
            <div className="rm-timeline-buttons">
              {([1, 2, 3] as const).map(y => (
                <button
                  key={y}
                  type="button"
                  className={`rm-timeline-btn ${timeline === y ? 'active' : ''}`}
                  onClick={() => setTimeline(y)}
                  disabled={generating}
                >
                  {y}y
                </button>
              ))}
            </div>
          </div>
          <button
            className="btn-primary"
            onClick={handleGenerate}
            disabled={generating || idiCalls.length === 0}
          >
            {generating ? <><Loader2 size={16} className="spin" /> Generating…</>
                       : <><Sparkles size={16} /> {customerRoadmapsFromState.length === 0 ? 'Generate Roadmap' : 'Regenerate'}</>}
          </button>
        </div>
      </header>

      {/* ==================== INPUT SUMMARY ==================== */}
      <section className="rm-input-card">
        <div className="rm-pipeline">
          <div className="rm-pipeline-step">
            <span className="rm-pipeline-num">{idiCalls.length}</span>
            <span className="rm-pipeline-label">R+D+i in Discovery</span>
            <span className="rm-pipeline-hint">score ≥ 50, deadline ≥ today</span>
          </div>
          <span className="rm-pipeline-arrow">→</span>
          <div className="rm-pipeline-step">
            <span className="rm-pipeline-num">{idiCallsForAgent.length}</span>
            <span className="rm-pipeline-label">Pre-screener (Pass 1)</span>
            <span className="rm-pipeline-hint">
              {idiCalls.length <= AGENT_INPUT_CAP
                ? 'analyzes ALL calls'
                : `cap at ${AGENT_INPUT_CAP}`}
            </span>
          </div>
          <span className="rm-pipeline-arrow">→</span>
          <div className="rm-pipeline-step rm-pipeline-step--highlight">
            <span className="rm-pipeline-num">~30-60</span>
            <span className="rm-pipeline-label">Deep matcher (Pass 2)</span>
            <span className="rm-pipeline-hint">candidates + full client context</span>
          </div>
          <span className="rm-pipeline-arrow">→</span>
          <div className="rm-pipeline-step">
            <span className="rm-pipeline-num">~10-15</span>
            <span className="rm-pipeline-label">Final recommendations</span>
            <span className="rm-pipeline-hint">incl. evergreen CDTI/EIC if fit</span>
          </div>
        </div>

        <div className="rm-input-stats">
          <div className="rm-stat">
            <div className="rm-stat-icon"><Calendar size={18} /></div>
            <div>
              <span className="rm-stat-label">Horizon</span>
              <strong>{timeline} year{timeline === 1 ? '' : 's'}</strong>
            </div>
          </div>
          <div className="rm-stat">
            <div className="rm-stat-icon"><History size={18} /></div>
            <div>
              <span className="rm-stat-label">Funding history</span>
              <strong>{fundingProfile?.fundingHistory?.length || 0} entries</strong>
            </div>
          </div>
          <div className="rm-stat">
            <div className="rm-stat-icon"><TrendingUp size={18} /></div>
            <div>
              <span className="rm-stat-label">Saved roadmaps</span>
              <strong>{customerRoadmapsFromState.length}</strong>
            </div>
          </div>
          <div className="rm-stat">
            <button
              type="button"
              className="rm-preview-toggle"
              onClick={() => setShowPreview(!showPreview)}
              disabled={idiCallsForAgent.length === 0}
            >
              {showPreview ? 'Hide' : 'Preview'} the {idiCallsForAgent.length} sent to AI
            </button>
          </div>
        </div>

        {showPreview && idiCallsForAgent.length > 0 && (
          <div className="rm-preview-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Source</th>
                  <th>Title</th>
                  <th>Program</th>
                  <th>Region</th>
                  <th>Deadline</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {idiCallsForAgent.map((c, i) => (
                  <tr key={c.externalId}>
                    <td>{i + 1}</td>
                    <td><span className={`rm-source-badge rm-source-badge--${c.source.toLowerCase()}`}>{sourceLabel(c.source)}</span></td>
                    <td className="rm-preview-title" title={c.title}>{c.title.slice(0, 80)}{c.title.length > 80 ? '…' : ''}</td>
                    <td>{c.program || '—'}</td>
                    <td>{c.region || '—'}</td>
                    <td>{c.closeDate ? new Date(c.closeDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td><strong>{c.rdiScore ?? '—'}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {idiCalls.length === 0 && (
          <div className="rm-warning">
            <AlertTriangle size={16} /> No R+D+i calls found in Discovery. Go to Discovery and sync first.
          </div>
        )}
      </section>

      {/* ==================== ERROR ==================== */}
      {error && (
        <section className="rm-error-card">
          <AlertTriangle size={18} />
          <div>
            <strong>Generation failed</strong>
            <div>{error}</div>
          </div>
        </section>
      )}

      {/* ==================== VERSION HISTORY ==================== */}
      {customerRoadmapsFromState.length > 0 && (
        <section className="rm-history-card">
          <span className="rm-history-label">Versions:</span>
          {customerRoadmapsFromState.map(r => (
            <span key={r.id} className={`rm-version-chip-wrap ${activeRoadmap?.id === r.id ? 'active' : ''}`}>
              <button
                type="button"
                className="rm-version-chip"
                onClick={() => setActiveRoadmap(r)}
              >
                {new Date(r.generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                <span className="muted"> · {r.timeline}y</span>
              </button>
              <button
                type="button"
                className="rm-version-chip-delete"
                onClick={() => handleDeleteVersion(r.id)}
                title="Delete this version"
                aria-label="Delete version"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {customerRoadmapsFromState.length >= 2 && activeRoadmap && (
            <button
              type="button"
              className="rm-compare-btn"
              onClick={() => setDiffOpen(true)}
              title="Comparar la versión activa con otra anterior"
            >
              <GitCompare size={13} /> Comparar versiones
            </button>
          )}
        </section>
      )}

      {/* ==================== MODAL COMPARE VERSIONS ==================== */}
      {diffOpen && activeRoadmap && (
        <RoadmapDiff
          activeRoadmap={activeRoadmap}
          allRoadmaps={customerRoadmapsFromState}
          onClose={() => setDiffOpen(false)}
        />
      )}

      {/* ==================== RESULT ==================== */}
      {activeRoadmap && (
        <>
          <section className="rm-summary-card">
            <h2><Sparkles size={20} /> Strategy</h2>
            <p>{activeRoadmap.result.executiveSummary}</p>
            <div className="rm-summary-stats">
              <div>
                <span className="rm-stat-label">Potential funding</span>
                <strong className="rm-amount-highlight">{activeRoadmap.result.totalPotentialFunding}</strong>
              </div>
              <div>
                <span className="rm-stat-label">Recommendations</span>
                <strong>{activeRoadmap.result.totalCallsRecommended}</strong>
              </div>
              <div>
                <span className="rm-stat-label">Generated</span>
                <strong>{new Date(activeRoadmap.generatedAt).toLocaleString('en-US')}</strong>
              </div>
              <div>
                <span className="rm-stat-label">Considered</span>
                <strong>{activeRoadmap.callsConsidered} calls</strong>
              </div>
            </div>
          </section>

          {/* Toggle de vista + export PPT */}
          <div className="rm-view-bar">
            <div className="rm-view-toggle">
              <button
                type="button"
                className={`rm-view-btn ${view === 'timeline' ? 'active' : ''}`}
                onClick={() => setView('timeline')}
              >
                Timeline
              </button>
              <button
                type="button"
                className={`rm-view-btn ${view === 'list' ? 'active' : ''}`}
                onClick={() => setView('list')}
              >
                List
              </button>
            </div>
            <div className="rm-export-group">
              <button
                type="button"
                className="rm-export-png-btn"
                onClick={() => {
                  if (view !== 'timeline') {
                    setView('timeline')
                    setTimeout(() => timelineRef.current?.downloadFullPng(), 200)
                  } else {
                    timelineRef.current?.downloadFullPng()
                  }
                }}
                title="Download as PNG (timeline + summary)"
              >
                <Download size={15} /> Export PNG
              </button>
              <button
                type="button"
                className="rm-export-pdf-btn"
                onClick={handleExportPdf}
                disabled={exportingPdf}
                title="Exportar a PDF A4 — más ligero, ideal para email"
              >
                {exportingPdf ? (
                  <><Loader2 size={15} className="rm-spin" /> Generating PDF…</>
                ) : (
                  <><FileDown size={15} /> Export PDF</>
                )}
              </button>
              <button
                type="button"
                className="rm-export-ppt-btn"
                onClick={handleExportPpt}
                disabled={exportingPpt}
                title="Exportar a PowerPoint con branding Álamos completo"
              >
                {exportingPpt ? (
                  <><Loader2 size={15} className="rm-spin" /> Generating PPT…</>
                ) : (
                  <><FileDown size={15} /> Export PPT</>
                )}
              </button>
            </div>
          </div>

          {view === 'timeline' && (
            <RoadmapTimeline
              ref={timelineRef}
              recommendations={activeRoadmap.result.recommendations}
              timeline={activeRoadmap.timeline}
              customerName={customer.name}
              idiCalls={idiCalls}
              onOpenInList={(callId) => {
                setView('list')
                // Dejamos que React pinte la lista, luego scrolleamos
                setTimeout(() => {
                  const el = document.getElementById(`rec-card-${callId}`)
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    el.classList.add('rm-rec-card--highlight')
                    setTimeout(() => el.classList.remove('rm-rec-card--highlight'), 2500)
                  }
                }, 80)
              }}
            />
          )}

          {view === 'list' && (
          <section className="rm-recommendations">
            {[...activeRoadmap.result.recommendations]
              .sort((a, b) => {
                // Ordena por fit score DESC, desempate por priorityOrder ASC
                if (b.fitScore !== a.fitScore) return b.fitScore - a.fitScore
                return a.priorityOrder - b.priorityOrder
              })
              .map((rec, i) => (
              <RecommendationCard
                key={rec.callId + i}
                rec={rec}
                idiCalls={idiCalls}
                trlProfile={fundingProfile?.trlProfile || []}
                onRemove={() => handleRemoveRecommendation(rec.callId)}
                onUpdateMonth={(m) => handleUpdateRecommendationMonth(rec.callId, m)}
              />
            ))}
            <button
              type="button"
              className="rm-add-from-discovery-btn"
              onClick={() => setPickerOpen(true)}
            >
              <Plus size={18} /> Add a call from Discovery
            </button>
          </section>
          )}

          <section className="rm-save-banner">
            <div className="rm-save-banner-info">
              <span className="rm-save-icon">✓</span>
              <div>
                <strong>Auto-saved</strong>
                <span className="muted">
                  {' '}all changes (add/remove/edit/regenerate) persist automatically to local storage.
                  {lastSavedAt && ` Last save: ${new Date(lastSavedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.`}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                if (activeRoadmap) {
                  persistRoadmaps(roadmapsState) // force re-save
                  setLastSavedAt(new Date().toISOString())
                }
              }}
            >
              Force save now
            </button>
          </section>
        </>
      )}

      {/* ==================== PICKER MODAL ==================== */}
      {pickerOpen && (
        <div className="rm-picker-overlay" onClick={() => setPickerOpen(false)}>
          <div className="rm-picker-modal" onClick={e => e.stopPropagation()}>
            <header className="rm-picker-header">
              <h3>Add a call from Discovery</h3>
              <button type="button" className="rm-picker-close" onClick={() => setPickerOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </header>
            <div className="rm-picker-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search by title, programme, region…"
                value={pickerSearch}
                onChange={e => setPickerSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="rm-picker-list">
              {idiCalls
                .filter(c => {
                  if (!pickerSearch.trim()) return true
                  const q = pickerSearch.toLowerCase()
                  return (
                    c.title?.toLowerCase().includes(q) ||
                    c.program?.toLowerCase().includes(q) ||
                    c.region?.toLowerCase().includes(q) ||
                    c.fundingBody?.toLowerCase().includes(q)
                  )
                })
                .slice(0, 200)
                .map(c => {
                  const isAdded = activeRoadmap?.result.recommendations.some(rec => rec.callId === c.externalId)
                  const isAnalyzing = analyzingCallId === c.externalId
                  return (
                    <button
                      key={c.externalId}
                      type="button"
                      className={`rm-picker-item ${isAdded ? 'added' : ''}`}
                      onClick={() => !isAdded && !analyzingCallId && handleAddFromDiscovery(c)}
                      disabled={isAdded || !!analyzingCallId}
                    >
                      <div className="rm-picker-item-main">
                        <span className={`rm-source-badge rm-source-badge--${c.source.toLowerCase()}`}>{sourceLabel(c.source)}</span>
                        <strong>{c.title}</strong>
                      </div>
                      <div className="rm-picker-item-meta">
                        <span>{c.program || '—'}</span>
                        {c.region && <span>· {c.region}</span>}
                        {c.closeDate && <span>· closes {new Date(c.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                        {isAdded && <span className="rm-picker-added-tag">already added</span>}
                        {isAnalyzing && <span className="rm-picker-analyzing"><Loader2 size={11} className="spin" /> analyzing fit…</span>}
                      </div>
                    </button>
                  )
                })}
              {idiCalls.length === 0 && <p className="muted">No I+D+i calls in Discovery yet.</p>}
            </div>
          </div>
        </div>
      )}

      {!activeRoadmap && !generating && (
        <section className="rm-empty-state">
          <Sparkles size={32} />
          <h3>No roadmap yet</h3>
          <p>Set your horizon (1, 2 or 3 years) and click <strong>Generate Roadmap</strong>.</p>
          <p className="muted">
            From {idiCalls.length} I+D+i opportunities in Discovery, we'll send the top {idiCallsForAgent.length} (best scored + most urgent) to the AI agent.
            The agent picks 10-15 that fit this client and builds the timeline.
          </p>
        </section>
      )}
    </div>
  )
}

/* ============================================================
   Tarjeta de recomendación
   ============================================================ */

const RecommendationCard = ({
  rec, idiCalls, trlProfile = [], onRemove, onUpdateMonth,
}: {
  rec: RoadmapRecommendation
  idiCalls: DiscoveryCall[]
  trlProfile?: Array<{ id: string; technology: string; currentTRL: number; targetTRL: number }>
  onRemove?: () => void
  onUpdateMonth?: (newMonth: string) => void
}) => {
  const [editingMonth, setEditingMonth] = useState(false)
  const [draftMonth, setDraftMonth] = useState(rec.recommendedMonth)

  const saveMonth = () => {
    if (/^\d{4}-\d{2}$/.test(draftMonth) && onUpdateMonth) {
      onUpdateMonth(draftMonth)
    }
    setEditingMonth(false)
  }
  const originalCall = idiCalls.find(c => c.externalId === rec.callId)
  const deadlineStr = originalCall?.closeDate ? new Date(originalCall.closeDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  const scoreClass = rec.fitScore >= 80 ? 'high' : rec.fitScore >= 60 ? 'mid' : 'low'

  return (
    <article className="rm-rec-card" id={`rec-card-${rec.callId}`}>
      <header className="rm-rec-header">
        <div className="rm-rec-priority">#{rec.priorityOrder}</div>
        <div className="rm-rec-title-wrap">
          <h3>{stripAgentTags(rec.title) || rec.callId}</h3>
          <div className="rm-rec-meta">
            <span className={`rm-source-badge rm-source-badge--${rec.source.toLowerCase()}`}>
              {sourceLabel(rec.source)}
            </span>
            {originalCall?.program && <span className="rm-meta-chip">{originalCall.program}</span>}
            {originalCall?.region && <span className="rm-meta-chip">{originalCall.region}</span>}
          </div>
        </div>
        <div className={`rm-fit-score rm-fit-score--${scoreClass}`}>
          <span className="rm-fit-score-value">{rec.fitScore}</span>
          <span className="rm-fit-score-label">fit</span>
        </div>
        {onRemove && (
          <button
            type="button"
            className="rm-rec-remove-btn"
            onClick={() => {
              if (confirm(`Remove "${rec.title.slice(0, 60)}…" from this roadmap?`)) {
                onRemove()
              }
            }}
            title="Remove from roadmap"
            aria-label="Remove"
          >
            <Trash2 size={16} />
          </button>
        )}
      </header>

      <div className="rm-rec-body">
        <p className="rm-rec-reasoning">{stripAgentTags(rec.reasoning)}</p>

        {(rec.expectedStartTRL || rec.expectedEndTRL) && (() => {
          // Buscar la línea TRL del cliente asignada por el agente
          const matchedLine = rec.techLineId
            ? trlProfile.find(l => l.id === rec.techLineId)
            : undefined
          const clientTarget = matchedLine?.targetTRL
          // Warning si el final esperado de esta call NO llega al target del cliente
          const trlGap = rec.expectedEndTRL && clientTarget && rec.expectedEndTRL < clientTarget
          return (
            <div className={`rm-rec-trl ${trlGap ? 'rm-rec-trl--gap' : ''}`}>
              <div className="rm-rec-trl-label">RECORRIDO TRL DE ESTA CONVOCATORIA</div>
              <div className="rm-rec-trl-bar">
                <span className="rm-rec-trl-start">TRL {rec.expectedStartTRL ?? '?'}</span>
                <span className="rm-rec-trl-arrow">→</span>
                <span className="rm-rec-trl-end">TRL {rec.expectedEndTRL ?? '?'}</span>
                {matchedLine && (
                  <span className="rm-rec-trl-line">
                    Línea: <strong>{matchedLine.technology}</strong>
                    {' '}(target {matchedLine.targetTRL})
                  </span>
                )}
              </div>
              {trlGap && (
                <p className="rm-rec-trl-warn">
                  <AlertTriangle size={11} /> Esta convocatoria te lleva hasta TRL {rec.expectedEndTRL}, pero
                  tu objetivo en esta línea es TRL {clientTarget}. Tendrás que encadenar otra convocatoria
                  posterior para cerrar el último tramo.
                </p>
              )}
            </div>
          )
        })()}

        {rec.applicationGuidance && rec.applicationGuidance.trim() && (
          <div className="rm-rec-guidance">
            <div className="rm-rec-guidance-label">
              <Sparkles size={13} /> CÓMO ORIENTAR LA SOLICITUD
            </div>
            <p className="rm-rec-guidance-text">{stripAgentTags(rec.applicationGuidance)}</p>
          </div>
        )}

        <div className="rm-rec-grid">
          <div className="rm-rec-cell">
            <span className="rm-cell-label">Apply by {onUpdateMonth && !editingMonth && <button type="button" className="rm-cell-edit-btn" onClick={() => { setDraftMonth(rec.recommendedMonth); setEditingMonth(true) }} title="Edit month">✎</button>}</span>
            {editingMonth ? (
              <span className="rm-month-edit">
                <input
                  type="month"
                  value={draftMonth}
                  onChange={(e) => setDraftMonth(e.target.value)}
                  onBlur={saveMonth}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveMonth(); if (e.key === 'Escape') setEditingMonth(false) }}
                  autoFocus
                />
              </span>
            ) : (
              <strong>{formatRecommendedMonth(rec.recommendedMonth)}</strong>
            )}
            <span className="muted">deadline {deadlineStr}</span>
          </div>
          <div className="rm-rec-cell">
            <span className="rm-cell-label">Estimated funding</span>
            <strong className="rm-amount-highlight">{rec.estimatedFundingRange}</strong>
          </div>
          <div className="rm-rec-cell rm-rec-cell--risk">
            <span className="rm-cell-label"><AlertTriangle size={12} /> Risk</span>
            <span>{rec.risks}</span>
          </div>
        </div>
      </div>

      {originalCall?.url && (
        <footer className="rm-rec-footer">
          <a href={originalCall.url} target="_blank" rel="noopener noreferrer" className="rm-rec-link">
            View call details <ExternalLink size={14} />
          </a>
        </footer>
      )}
    </article>
  )
}

export default RoadmapPage
