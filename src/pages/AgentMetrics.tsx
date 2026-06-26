import { useMemo, useState } from 'react'
import {
  Target,
  TrendingUp,
  TrendingDown,
  Award,
  XCircle,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  Building2,
} from 'lucide-react'
import { formatCurrency } from '../utils/formatCurrency'
import './Page.css'
import './AgentMetrics.css'

/* ============================================================
   Tipos espejados de FundingProfile + Roadmap
   ============================================================ */

interface FundingHistoryEntry {
  name: string
  organism?: string
  programme: string
  year: number
  requestedAmount: number
  grantedAmount?: number
  status: 'in-progress' | 'pending' | 'won' | 'lost'
}

interface FundingProfileLoaded {
  customerId: string
  fundingHistory?: FundingHistoryEntry[]
}

interface RoadmapRecommendation {
  callId: string
  title: string
  fitScore: number
}

interface SavedRoadmap {
  customerId: string
  result: { recommendations: RoadmapRecommendation[] }
}

interface ProgramStats {
  programme: string
  organism?: string
  presented: number   // status won o lost (resolved)
  won: number
  lost: number
  pending: number
  successRate: number  // 0-100
  totalRequested: number
  totalGranted: number
  // Datos del agente — fit promedio de las recs de este programa en roadmaps
  agentFitAvg: number | null
  agentRecsCount: number
  // Calibración: fit del agente vs success real
  calibration: 'unknown' | 'aligned' | 'overconfident' | 'underconfident'
}

/* ============================================================
   Helpers de cálculo
   ============================================================ */

/**
 * Normaliza nombres de programas para agrupar variantes.
 * "CDTI PID 2024" / "CDTI PID 2025" / "Cervera PID" → todos al mismo bucket.
 */
const normalizeProgramme = (s: string): string => {
  const lower = s.toLowerCase().trim()
  // Reglas de canonicalización por keywords prioritarias
  if (/cervera/.test(lower)) return 'CDTI Cervera'
  if (/neotec/.test(lower)) return 'CDTI NEOTEC'
  if (/línea\s*directa.*innovaci|^lic\b|cdti\s*lic\b/.test(lower)) return 'CDTI LIC (Línea Directa Innovación)'
  if (/línea\s*directa.*expan|lica|cdti\s*lica/.test(lower)) return 'CDTI LICA (Línea Directa Expansión)'
  if (/cdti.*pid|proyectos.*i\+d.*cdti/.test(lower)) return 'CDTI PID'
  if (/misiones/.test(lower)) return 'CDTI Misiones'
  if (/innterconecta|step.*cdti|cdti.*step/.test(lower)) return 'CDTI STEP-INNTERCONECTA'
  if (/liee|infraestructura.*ensayo/.test(lower)) return 'CDTI LIEE'
  if (/eic\s*accelerator|accelerator.*eic/.test(lower)) return 'EIC Accelerator'
  if (/eic\s*pathfinder|pathfinder.*eic/.test(lower)) return 'EIC Pathfinder'
  if (/eic\s*transition|transition.*eic/.test(lower)) return 'EIC Transition'
  if (/eic.*step.*scale|step.*scaleup/.test(lower)) return 'EIC STEP ScaleUp'
  if (/eurostars/.test(lower)) return 'Eurostars'
  if (/innowwide/.test(lower)) return 'Innowwide'
  if (/torres\s*quevedo|^ptq\b/.test(lower)) return 'AEI PTQ Torres Quevedo'
  if (/doctorados\s*industriales|^din\b/.test(lower)) return 'AEI Doctorados Industriales'
  if (/colaboraci.n\s*p.blico|^cpp\b/.test(lower)) return 'AEI CPP'
  if (/horizon.*europe|horizonte\s*europa/.test(lower)) return 'Horizon Europe'
  if (/^life\b|programme.*environment/.test(lower)) return 'LIFE Programme'
  if (/erasmus/.test(lower)) return 'Erasmus+'
  if (/enisa/.test(lower)) return 'ENISA'
  if (/eureka.*celtic|celtic.*next/.test(lower)) return 'EUREKA Celtic-Next'
  if (/eureka.*eurogia|eurogia/.test(lower)) return 'EUREKA Eurogia'
  if (/eureka.*itea|itea\s*\d/.test(lower)) return 'EUREKA ITEA'
  if (/eureka.*smart|smart\s*advanced/.test(lower)) return 'EUREKA SMART'
  if (/eit.*urban.*mobility/.test(lower)) return 'EIT Urban Mobility'
  // Fallback: el propio nombre con casing limpio
  return s.trim()
}

/** Determina la calibración del agente para un programa. */
const computeCalibration = (
  successRate: number,
  agentFitAvg: number | null,
  presented: number,
): ProgramStats['calibration'] => {
  if (presented < 2 || agentFitAvg === null) return 'unknown'
  const delta = agentFitAvg - successRate
  if (Math.abs(delta) <= 20) return 'aligned'
  if (delta > 20) return 'overconfident'    // agente da fit alto pero perdemos
  return 'underconfident'                    // ganamos más de lo que el agente predecía
}

const calibrationConfig: Record<ProgramStats['calibration'], { label: string; icon: typeof CheckCircle; className: string; description: string }> = {
  aligned:        { label: 'Calibrado',       icon: CheckCircle,  className: 'metric-cal--ok',   description: 'El fit que da el agente está dentro de ±20 puntos del success rate real' },
  overconfident:  { label: 'Sobrestima',      icon: TrendingDown, className: 'metric-cal--warn', description: 'El agente da fit alto pero el success rate real es menor — revisar criterios de scoring' },
  underconfident: { label: 'Infraestima',     icon: TrendingUp,   className: 'metric-cal--info', description: 'El success rate real es mayor que el fit del agente — oportunidad para subir prioridades' },
  unknown:        { label: 'Sin datos',       icon: AlertTriangle,className: 'metric-cal--unknown', description: 'Insuficientes datos para calibrar (<2 propuestas resueltas o agente no ha visto este programa)' },
}

/* ============================================================
   Componente
   ============================================================ */

const AgentMetrics = () => {
  const [filter, setFilter] = useState<'all' | 'aligned' | 'overconfident' | 'underconfident' | 'unknown'>('all')
  const [expandedProgramme, setExpandedProgramme] = useState<string | null>(null)

  const data = useMemo(() => {
    // ── Carga datos de localStorage ──
    let profiles: FundingProfileLoaded[] = []
    let roadmaps: SavedRoadmap[] = []
    let customers: Array<{ id: string; name: string }> = []
    try {
      const raw = localStorage.getItem('fundingProfiles')
      if (raw) {
        const parsed = JSON.parse(raw)
        // Defensa contra el bug histórico que dejó "[]" (array) en lugar de {}
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          profiles = Object.values(parsed as Record<string, FundingProfileLoaded>)
        }
      }
    } catch { /* */ }
    try {
      roadmaps = JSON.parse(localStorage.getItem('cdtiRoadmaps') || '[]') as SavedRoadmap[]
    } catch { /* */ }
    try {
      customers = JSON.parse(localStorage.getItem('customers') || '[]') as Array<{ id: string; name: string }>
    } catch { /* */ }

    // ── Calcula stats por programa ──
    const byProgramme = new Map<string, ProgramStats>()

    // 1) Recorre fundingHistory de cada cliente
    for (const p of profiles) {
      for (const entry of p.fundingHistory || []) {
        const key = normalizeProgramme(entry.programme || entry.name || '?')
        if (!byProgramme.has(key)) {
          byProgramme.set(key, {
            programme: key,
            organism: entry.organism,
            presented: 0,
            won: 0,
            lost: 0,
            pending: 0,
            successRate: 0,
            totalRequested: 0,
            totalGranted: 0,
            agentFitAvg: null,
            agentRecsCount: 0,
            calibration: 'unknown',
          })
        }
        const s = byProgramme.get(key)!
        if (entry.status === 'won') {
          s.presented++
          s.won++
          s.totalGranted += entry.grantedAmount || entry.requestedAmount || 0
        } else if (entry.status === 'lost') {
          s.presented++
          s.lost++
        } else {
          s.pending++
        }
        s.totalRequested += entry.requestedAmount || 0
      }
    }

    // 2) Cruza con roadmaps: agrega fit medio del agente por programa
    const agentFitsByProgramme = new Map<string, number[]>()
    for (const rm of roadmaps) {
      for (const rec of rm.result?.recommendations || []) {
        const key = normalizeProgramme(rec.title || '')
        const arr = agentFitsByProgramme.get(key) || []
        arr.push(rec.fitScore)
        agentFitsByProgramme.set(key, arr)
      }
    }

    // 3) Compute final
    for (const stats of byProgramme.values()) {
      stats.successRate = stats.presented > 0 ? Math.round((stats.won / stats.presented) * 100) : 0
      const agentFits = agentFitsByProgramme.get(stats.programme) || []
      if (agentFits.length > 0) {
        stats.agentFitAvg = Math.round(agentFits.reduce((a, b) => a + b, 0) / agentFits.length)
        stats.agentRecsCount = agentFits.length
      }
      stats.calibration = computeCalibration(stats.successRate, stats.agentFitAvg, stats.presented)
    }

    // 4) Ordenar por relevancia: presented desc, después won rate desc
    const allStats = Array.from(byProgramme.values()).sort((a, b) => {
      if (b.presented !== a.presented) return b.presented - a.presented
      return b.successRate - a.successRate
    })

    // 5) KPIs globales
    const totalPresented = allStats.reduce((s, x) => s + x.presented, 0)
    const totalWon = allStats.reduce((s, x) => s + x.won, 0)
    const totalGranted = allStats.reduce((s, x) => s + x.totalGranted, 0)
    const overallSuccessRate = totalPresented > 0 ? Math.round((totalWon / totalPresented) * 100) : 0
    const programmesWithData = allStats.filter(s => s.presented > 0).length

    return {
      allStats,
      overallStats: {
        totalPresented,
        totalWon,
        totalGranted,
        overallSuccessRate,
        programmesWithData,
      },
      customersCount: customers.length,
      roadmapsCount: roadmaps.length,
    }
  }, [])

  const filtered = useMemo(
    () => filter === 'all' ? data.allStats : data.allStats.filter(s => s.calibration === filter),
    [data.allStats, filter],
  )

  /* ============================================================
     Render
     ============================================================ */

  return (
    <div className="page page--agent-metrics">
      <header className="metric-header">
        <div className="metric-header-left">
          <div className="metric-icon-circle">
            <Target size={22} />
          </div>
          <div>
            <h1>Métricas del agente</h1>
            <p className="metric-subtitle">
              Compara el <strong>fit score</strong> que da el agente con el <strong>success rate</strong> real observado
              en tus propuestas presentadas. Sirve para detectar programas donde el agente está mal calibrado y mejorar
              futuras recomendaciones.
            </p>
          </div>
        </div>
        <div className="metric-stats">
          <div className="metric-stat">
            <span className="metric-stat-value">{data.overallStats.overallSuccessRate}%</span>
            <span className="metric-stat-label">Success rate global</span>
          </div>
          <div className="metric-stat">
            <span className="metric-stat-value">{data.overallStats.totalWon}/{data.overallStats.totalPresented}</span>
            <span className="metric-stat-label">Ganadas / Presentadas</span>
          </div>
          <div className="metric-stat">
            <span className="metric-stat-value">{formatCurrency(data.overallStats.totalGranted)}</span>
            <span className="metric-stat-label">Importe ganado</span>
          </div>
          <div className="metric-stat">
            <span className="metric-stat-value">{data.overallStats.programmesWithData}</span>
            <span className="metric-stat-label">Programas con histórico</span>
          </div>
        </div>
      </header>

      {/* ── FILTROS ── */}
      <section className="metric-filters">
        <span className="metric-filter-label">Filtrar por calibración:</span>
        {(['all', 'aligned', 'overconfident', 'underconfident', 'unknown'] as const).map(f => {
          const count = f === 'all'
            ? data.allStats.length
            : data.allStats.filter(s => s.calibration === f).length
          const config = f === 'all'
            ? { label: 'Todos', className: '' }
            : calibrationConfig[f]
          return (
            <button
              key={f}
              type="button"
              className={`metric-filter-chip ${filter === f ? 'active' : ''} ${config.className || ''}`}
              onClick={() => setFilter(f)}
            >
              {config.label} ({count})
            </button>
          )
        })}
      </section>

      {/* ── TABLA POR PROGRAMA ── */}
      {filtered.length === 0 ? (
        <div className="metric-empty">
          <p>No hay datos para mostrar con este filtro.</p>
        </div>
      ) : (
        <section className="metric-table-wrap">
          <div className="metric-table">
            <div className="metric-row metric-row--head">
              <span>Programa</span>
              <span className="metric-num">Presentadas</span>
              <span className="metric-num">Ganadas</span>
              <span className="metric-num">Won rate</span>
              <span className="metric-num">Fit agente</span>
              <span className="metric-num">Importe ganado</span>
              <span>Calibración</span>
            </div>
            {filtered.map(s => {
              const cal = calibrationConfig[s.calibration]
              const Icon = cal.icon
              const isExpanded = expandedProgramme === s.programme
              return (
                <div key={s.programme}>
                  <button
                    type="button"
                    className={`metric-row metric-row--data ${isExpanded ? 'expanded' : ''}`}
                    onClick={() => setExpandedProgramme(isExpanded ? null : s.programme)}
                  >
                    <span className="metric-prog-name">
                      <ChevronDown size={12} className={`metric-row-chevron ${isExpanded ? 'rotated' : ''}`} />
                      <strong>{s.programme}</strong>
                      {s.organism && <small> · {s.organism}</small>}
                    </span>
                    <span className="metric-num">{s.presented + s.pending}<small> ({s.pending} pend.)</small></span>
                    <span className="metric-num metric-won">{s.won}</span>
                    <span className="metric-num">
                      {s.presented > 0 ? (
                        <span className={`metric-rate ${s.successRate >= 60 ? 'high' : s.successRate >= 30 ? 'mid' : 'low'}`}>
                          {s.successRate}%
                        </span>
                      ) : <span className="muted">—</span>}
                    </span>
                    <span className="metric-num">
                      {s.agentFitAvg !== null ? (
                        <span className="metric-fit">
                          {s.agentFitAvg}
                          <small> · {s.agentRecsCount} rec{s.agentRecsCount > 1 ? 's' : ''}</small>
                        </span>
                      ) : <span className="muted">—</span>}
                    </span>
                    <span className="metric-num">{formatCurrency(s.totalGranted)}</span>
                    <span>
                      <span className={`metric-cal ${cal.className}`}>
                        <Icon size={12} /> {cal.label}
                      </span>
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="metric-row-detail">
                      <div className="metric-detail-grid">
                        <div className="metric-detail-card">
                          <h4><Award size={14} /> Ganadas</h4>
                          <strong className="metric-big-num">{s.won}</strong>
                          <p className="muted">{formatCurrency(s.totalGranted)} en grants/préstamos concedidos</p>
                        </div>
                        <div className="metric-detail-card">
                          <h4><XCircle size={14} /> Perdidas</h4>
                          <strong className="metric-big-num">{s.lost}</strong>
                          <p className="muted">{s.presented > 0 ? Math.round((s.lost / s.presented) * 100) : 0}% del total resuelto</p>
                        </div>
                        <div className="metric-detail-card">
                          <h4><Building2 size={14} /> En curso</h4>
                          <strong className="metric-big-num">{s.pending}</strong>
                          <p className="muted">Propuestas pendientes / en evaluación</p>
                        </div>
                        <div className="metric-detail-card metric-detail-card--insight">
                          <h4>Diagnóstico del agente</h4>
                          <p>{cal.description}</p>
                          {s.calibration === 'overconfident' && s.agentFitAvg !== null && (
                            <p className="metric-insight">
                              El agente da <strong>{s.agentFitAvg}/100</strong> en {s.programme} pero solo ganamos
                              {' '}<strong>{s.successRate}%</strong>. Considera revisar la ficha de este programa para
                              ajustar las reglas de scoring.
                            </p>
                          )}
                          {s.calibration === 'underconfident' && s.agentFitAvg !== null && (
                            <p className="metric-insight">
                              Ganamos <strong>{s.successRate}%</strong> de las propuestas pero el agente solo da
                              {' '}<strong>{s.agentFitAvg}/100</strong>. Probablemente el agente está siendo
                              demasiado conservador con este programa.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── FOOTER CONTEXTO ── */}
      <footer className="metric-footer">
        <p className="muted">
          📊 Análisis basado en <strong>{data.customersCount}</strong> clientes y
          {' '}<strong>{data.roadmapsCount}</strong> roadmaps generados. Las métricas se recalculan
          automáticamente cada vez que actualizas el funding history de algún cliente.
        </p>
      </footer>
    </div>
  )
}

export default AgentMetrics
