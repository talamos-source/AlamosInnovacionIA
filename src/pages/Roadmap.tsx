import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Calendar,
  TrendingUp,
  Target,
  AlertTriangle,
  History,
  ExternalLink,
} from 'lucide-react'
import './Page.css'
import './Roadmap.css'

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
}

interface ContextField { value: string; suggested?: boolean }
interface CustomerContextData {
  businessModel?: ContextField
  companyOverview?: ContextField
  technologyInnovation?: ContextField
  currentTRL?: ContextField
  rdiRoadmap?: ContextField
}

interface FundingProfileLoaded {
  coFinancingCapacityPercent?: number
  preferredProjectType?: string
  desiredAmountRange?: string
  targetTRL?: number
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

const loadContextForCustomer = (id: string): CustomerContextData | null => {
  try {
    const raw = localStorage.getItem(`customer-context-${id}`)
    if (!raw) return null
    return JSON.parse(raw) as CustomerContextData
  } catch { return null }
}

const loadFundingProfile = (id: string): FundingProfileLoaded | null => {
  try {
    const raw = localStorage.getItem('fundingProfiles')
    if (!raw) return null
    const all = JSON.parse(raw) as Record<string, FundingProfileLoaded>
    return all[id] || null
  } catch { return null }
}

const loadDiscoveryCalls = (): DiscoveryCall[] => {
  try {
    const raw = localStorage.getItem('discoveryCalls')
    if (!raw) return []
    return JSON.parse(raw) as DiscoveryCall[]
  } catch { return [] }
}

// Convierte el context AI a un objeto simple { key: stringValue }
const flattenContext = (ctx: CustomerContextData | null): Record<string, string> | undefined => {
  if (!ctx) return undefined
  const out: Record<string, string> = {}
  Object.entries(ctx).forEach(([k, v]) => {
    if (v && typeof v === 'object' && 'value' in v && v.value) out[k] = v.value
  })
  return out
}

const formatRecommendedMonth = (m: string): string => {
  // 2026-09 → "Sep 2026"
  const [y, mo] = m.split('-')
  const date = new Date(Number(y), Number(mo) - 1, 1)
  return date.toLocaleString('en-US', { month: 'short', year: 'numeric' })
}

const sourceLabel = (s: 'EU_PORTAL' | 'BDNS') => (s === 'EU_PORTAL' ? 'EU Portal' : 'BDNS Spain')

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

  useEffect(() => {
    if (!activeRoadmap && customerRoadmaps[0]) setActiveRoadmap(customerRoadmaps[0])
  }, [customerRoadmaps, activeRoadmap])

  // Filtrar calls del discovery a I+D+i (score ≥ 50) y deadline futuro
  const idiCalls = useMemo(() => {
    const todayMs = Date.now() - 86400000
    return loadDiscoveryCalls().filter(c => {
      const score = c.rdiScore ?? (c.source === 'EU_PORTAL' ? 100 : 0)
      if (score < 50) return false
      if (c.closeDate) {
        const t = new Date(c.closeDate).getTime()
        if (!Number.isNaN(t) && t < todayMs) return false
      }
      return true
    })
  }, [])

  const handleGenerate = async () => {
    if (!customer || !customerId) return
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
          // Cap para evitar prompts gigantes y Premature close.
          // Si tienes 300 I+D+i calls, mandamos las primeras 80 ordenadas por rdiScore desc + deadline asc.
          calls: idiCalls
            .slice()
            .sort((a, b) => {
              const sa = a.rdiScore ?? 0
              const sb = b.rdiScore ?? 0
              if (sb !== sa) return sb - sa
              const da = a.closeDate ? new Date(a.closeDate).getTime() : Infinity
              const db = b.closeDate ? new Date(b.closeDate).getTime() : Infinity
              return da - db
            })
            .slice(0, 40),
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

      const next = [saved, ...allRoadmaps]
      saveAllRoadmaps(next)
      setActiveRoadmap(saved)
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
                       : <><Sparkles size={16} /> {customerRoadmaps.length === 0 ? 'Generate Roadmap' : 'Regenerate'}</>}
          </button>
        </div>
      </header>

      {/* ==================== INPUT SUMMARY ==================== */}
      <section className="rm-input-card">
        <div className="rm-input-stats">
          <div className="rm-stat">
            <div className="rm-stat-icon"><Target size={18} /></div>
            <div>
              <span className="rm-stat-label">R+D+i calls available</span>
              <strong>{idiCalls.length}</strong>
            </div>
          </div>
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
              <strong>{customerRoadmaps.length}</strong>
            </div>
          </div>
        </div>
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
      {customerRoadmaps.length > 0 && (
        <section className="rm-history-card">
          <span className="rm-history-label">Versions:</span>
          {customerRoadmaps.map(r => (
            <button
              key={r.id}
              type="button"
              className={`rm-version-chip ${activeRoadmap?.id === r.id ? 'active' : ''}`}
              onClick={() => setActiveRoadmap(r)}
            >
              {new Date(r.generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              <span className="muted"> · {r.timeline}y</span>
            </button>
          ))}
        </section>
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

          <section className="rm-recommendations">
            {activeRoadmap.result.recommendations.map((rec, i) => (
              <RecommendationCard key={rec.callId + i} rec={rec} idiCalls={idiCalls} />
            ))}
          </section>
        </>
      )}

      {!activeRoadmap && !generating && (
        <section className="rm-empty-state">
          <Sparkles size={32} />
          <h3>No roadmap yet</h3>
          <p>Set your horizon (1, 2 or 3 years) and click <strong>Generate Roadmap</strong>.</p>
          <p className="muted">Will analyze {idiCalls.length} R+D+i opportunities and select the best fits for this client.</p>
        </section>
      )}
    </div>
  )
}

/* ============================================================
   Tarjeta de recomendación
   ============================================================ */

const RecommendationCard = ({
  rec, idiCalls,
}: {
  rec: RoadmapRecommendation
  idiCalls: DiscoveryCall[]
}) => {
  const originalCall = idiCalls.find(c => c.externalId === rec.callId)
  const deadlineStr = originalCall?.closeDate ? new Date(originalCall.closeDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  const scoreClass = rec.fitScore >= 80 ? 'high' : rec.fitScore >= 60 ? 'mid' : 'low'

  return (
    <article className="rm-rec-card">
      <header className="rm-rec-header">
        <div className="rm-rec-priority">#{rec.priorityOrder}</div>
        <div className="rm-rec-title-wrap">
          <h3>{rec.title}</h3>
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
      </header>

      <div className="rm-rec-body">
        <p className="rm-rec-reasoning">{rec.reasoning}</p>
        <div className="rm-rec-grid">
          <div className="rm-rec-cell">
            <span className="rm-cell-label">Apply by</span>
            <strong>{formatRecommendedMonth(rec.recommendedMonth)}</strong>
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
