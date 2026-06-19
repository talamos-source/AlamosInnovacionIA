import { useMemo, useRef, useState } from 'react'
import { ExternalLink, AlertTriangle, Download } from 'lucide-react'
import './RoadmapTimeline.css'

/* ============================================================
   Tipos (espejados del Roadmap.tsx para no acoplar)
   ============================================================ */

interface Recommendation {
  callId: string
  title: string
  source: 'EU_PORTAL' | 'BDNS'
  fitScore: number
  reasoning: string
  recommendedMonth: string  // YYYY-MM
  estimatedFundingRange: string
  risks: string
  priorityOrder: number
}

interface DiscoveryCall {
  externalId: string
  url?: string
  program?: string
  closeDate?: string
  region?: string
}

interface Props {
  recommendations: Recommendation[]
  timeline: 1 | 2 | 3
  customerName?: string
  idiCalls: DiscoveryCall[]
  /** Cuando se hace doble click en una bubble */
  onOpenInList?: (callId: string) => void
}

/* ============================================================
   Categorización R / D / i por keywords
   ============================================================ */

type Category = 'research' | 'development' | 'innovation'

const CATEGORY_LABELS: Record<Category, string> = {
  research: 'Research',
  development: 'Development',
  innovation: 'Innovation',
}
const CATEGORY_TRL: Record<Category, string> = {
  research: 'TRL 1-3',
  development: 'TRL 4-6',
  innovation: 'TRL 7-9',
}

const categorize = (rec: Recommendation): Category => {
  const text = `${rec.title} ${rec.callId}`.toLowerCase()
  if (/research|investigaci|pathfinder|basic|fundament|doctorado|cient[ií]fic/.test(text)) return 'research'
  if (/accelerator|escalad|expansi[oó]n|industrializ|l[ií]nea directa|market|scaleup|innov/.test(text)) return 'innovation'
  return 'development'
}

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

const RoadmapTimeline = ({ recommendations, timeline, customerName, idiCalls, onOpenInList }: Props) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all')
  const svgRef = useRef<SVGSVGElement | null>(null)

  /* ---- coords ---- */
  const VIEWBOX_W = 1100
  const VIEWBOX_H = 500
  const PADDING_LEFT = 150   // más espacio para labels Y
  const PADDING_RIGHT = 60
  const PADDING_TOP = 80
  const PADDING_BOTTOM = 80
  const PLOT_W = VIEWBOX_W - PADDING_LEFT - PADDING_RIGHT
  const PLOT_H = VIEWBOX_H - PADDING_TOP - PADDING_BOTTOM

  const Y_BANDS: Record<Category, number> = useMemo(() => ({
    research: PADDING_TOP + PLOT_H * 0.18,
    development: PADDING_TOP + PLOT_H * 0.5,
    innovation: PADDING_TOP + PLOT_H * 0.82,
  }), [])

  /* ---- date math ---- */
  const today = useMemo(() => new Date(), [])
  const maxHorizonDate = useMemo(() => {
    const d = new Date(today)
    d.setFullYear(d.getFullYear() + timeline)
    return d
  }, [today, timeline])

  const monthTo = (monthStr: string): Date => {
    const [y, m] = monthStr.split('-').map(Number)
    return new Date(y, (m || 1) - 1, 15) // mid-month
  }

  /**
   * El eje X se adapta al rango REAL de recomendaciones (con buffer),
   * no al horizonte completo. Así si el roadmap es a 3 años pero todas
   * las recs caen en los primeros 8 meses, no vemos un timeline vacío
   * de 36 meses con todo amontonado a la izquierda.
   *
   * Reglas:
   *  - inicio = hoy (siempre)
   *  - fin    = última rec + 1 mes de buffer
   *  - cap    = horizonte máximo del roadmap (no excedemos)
   *  - floor  = mínimo 6 meses visible (para no ser ridículamente corto)
   */
  const { totalMs, spanMonths } = useMemo(() => {
    const recDates = recommendations
      .map(r => monthTo(r.recommendedMonth).getTime())
      .filter(t => t > today.getTime())
    const sixMonths = today.getTime() + 1000 * 60 * 60 * 24 * 30 * 6
    let endMs: number
    if (recDates.length === 0) {
      endMs = maxHorizonDate.getTime()
    } else {
      const lastRec = Math.max(...recDates)
      const buffered = lastRec + 1000 * 60 * 60 * 24 * 45 // ~1.5 meses de buffer
      endMs = Math.min(maxHorizonDate.getTime(), Math.max(buffered, sixMonths))
    }
    const total = endMs - today.getTime()
    const months = total / (1000 * 60 * 60 * 24 * 30.4)
    return { totalMs: total, spanMonths: months }
  }, [recommendations, today, maxHorizonDate])

  /* ---- positioned recs ---- */
  const positioned = useMemo(() => {
    return recommendations.map(rec => {
      const date = monthTo(rec.recommendedMonth)
      const t = Math.max(0, Math.min(1, (date.getTime() - today.getTime()) / totalMs))
      const category = categorize(rec)
      return {
        ...rec,
        date,
        category,
        x: PADDING_LEFT + t * PLOT_W,
        y: Y_BANDS[category],
      }
    })
  }, [recommendations, today, totalMs, Y_BANDS])

  const filtered = selectedCategory === 'all'
    ? positioned
    : positioned.filter(r => r.category === selectedCategory)

  /* ---- curved morado path (Bezier C-spline) ---- */
  const path = useMemo(() => {
    if (filtered.length < 2) return ''
    const sorted = [...filtered].sort((a, b) => a.x - b.x)
    let d = `M ${sorted[0].x.toFixed(1)} ${sorted[0].y.toFixed(1)}`
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      const curr = sorted[i]
      const cp1x = prev.x + (curr.x - prev.x) * 0.45
      const cp1y = prev.y
      const cp2x = prev.x + (curr.x - prev.x) * 0.55
      const cp2y = curr.y
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`
    }
    return d
  }, [filtered])

  /* ---- X-axis ticks (adaptados al span real, no al timeline máximo) ---- */
  const xTicks = useMemo(() => {
    const totalMonths = Math.max(1, Math.ceil(spanMonths))
    // step adaptativo: queremos ~6-10 ticks visibles, nunca densificar
    let stepMonths: number
    if (totalMonths <= 6) stepMonths = 1
    else if (totalMonths <= 12) stepMonths = 1
    else if (totalMonths <= 18) stepMonths = 2
    else if (totalMonths <= 24) stepMonths = 2
    else stepMonths = 3
    const ticks: Array<{ x: number; label: string; year?: number }> = []
    for (let m = 0; m <= totalMonths; m += stepMonths) {
      const d = new Date(today)
      d.setMonth(d.getMonth() + m)
      const t = m / totalMonths
      ticks.push({
        x: PADDING_LEFT + t * PLOT_W,
        label: d.toLocaleString('en-US', { month: 'short' }),
        year: d.getMonth() === 0 || m === 0 ? d.getFullYear() : undefined,
      })
    }
    return ticks
  }, [today, spanMonths])

  /* ---- bubble radius por fitScore ---- */
  const bubbleRadius = (fitScore: number) => {
    const norm = Math.max(0, Math.min(1, (fitScore - 50) / 50))
    return 16 + norm * 14   // 16 → 30 px (más generoso)
  }

  /* ---- PNG export ---- */
  const handleDownloadPNG = () => {
    const svg = svgRef.current
    if (!svg) return
    const serializer = new XMLSerializer()
    const svgStr = serializer.serializeToString(svg)
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const scale = 2 // export @2x para nitidez
      const canvas = document.createElement('canvas')
      canvas.width = VIEWBOX_W * scale
      canvas.height = VIEWBOX_H * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#FAF8F4'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob(blob => {
        if (!blob) return
        const a = document.createElement('a')
        const ts = new Date().toISOString().slice(0, 10)
        a.href = URL.createObjectURL(blob)
        a.download = `roadmap-${(customerName || 'cliente').toLowerCase().replace(/\s+/g, '-')}-${ts}.png`
        a.click()
        URL.revokeObjectURL(a.href)
      }, 'image/png')
    }
    img.src = url
  }

  if (positioned.length === 0) {
    return (
      <div className="rt-empty">
        <p>No recommendations yet to plot. Generate a roadmap first.</p>
      </div>
    )
  }

  return (
    <div className="rt-container">
      {/* ─── HEADER + FILTERS + EXPORT ─── */}
      <header className="rt-header">
        <div>
          <h2>Strategic Roadmap Timeline</h2>
          <p className="muted">
            {customerName && <>{customerName} · </>}
            {timeline} {timeline === 1 ? 'year' : 'years'} horizon ·
            {' '}showing {Math.ceil(spanMonths)} months ·
            {' '}{positioned.length} recommendations
            <span className="rt-hint"> · double-click any bubble to open the full card</span>
          </p>
        </div>
        <div className="rt-header-actions">
          <div className="rt-category-filter">
            {(['all', 'research', 'development', 'innovation'] as const).map(cat => (
              <button
                key={cat}
                type="button"
                className={`rt-filter-btn ${selectedCategory === cat ? 'active' : ''} ${cat !== 'all' ? `rt-filter-btn--${cat}` : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="rt-export-btn"
            onClick={handleDownloadPNG}
            title="Download as PNG"
          >
            <Download size={14} /> PNG
          </button>
        </div>
      </header>

      {/* ─── SVG TIMELINE ─── */}
      <div className="rt-svg-wrap">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="rt-svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* gradient principal de la curve */}
            <linearGradient id="rt-curve-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#5C358F" stopOpacity={0.2} />
              <stop offset="35%" stopColor="#5C358F" stopOpacity={0.85} />
              <stop offset="65%" stopColor="#7A4FB5" stopOpacity={0.85} />
              <stop offset="100%" stopColor="#A78BC9" stopOpacity={0.25} />
            </linearGradient>

            {/* gradient de fondo para las bandas (sutil) */}
            <linearGradient id="rt-band-bg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5C358F" stopOpacity={0.04} />
              <stop offset="100%" stopColor="#5C358F" stopOpacity={0.01} />
            </linearGradient>

            {/* sheen radial para bubbles */}
            <radialGradient id="rt-bubble-sheen-eu" cx="35%" cy="30%" r="65%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.55} />
              <stop offset="55%" stopColor="#A78BC9" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#7C5BA3" stopOpacity={1} />
            </radialGradient>
            <radialGradient id="rt-bubble-sheen-es" cx="35%" cy="30%" r="65%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.4} />
              <stop offset="50%" stopColor="#5C358F" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#2A1147" stopOpacity={1} />
            </radialGradient>

            {/* glow soft para la curve */}
            <filter id="rt-curve-glow" x="-20%" y="-50%" width="140%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* sombra para bubbles */}
            <filter id="rt-bubble-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3.5" />
              <feOffset dx="0" dy="3" result="offsetblur" />
              <feComponentTransfer><feFuncA type="linear" slope="0.35"/></feComponentTransfer>
              <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* ─ Y bands como zonas sutiles ─ */}
          {(['research', 'development', 'innovation'] as Category[]).map(cat => {
            const cy = Y_BANDS[cat]
            const halfH = PLOT_H * 0.16
            return (
              <g key={cat}>
                <rect
                  x={PADDING_LEFT}
                  y={cy - halfH}
                  width={PLOT_W}
                  height={halfH * 2}
                  fill="url(#rt-band-bg)"
                  rx={8}
                />
                <line
                  x1={PADDING_LEFT} y1={cy}
                  x2={VIEWBOX_W - PADDING_RIGHT} y2={cy}
                  stroke="#D5C9E6" strokeWidth={1} strokeDasharray="2 8"
                  opacity={0.55}
                />
                {/* Label a la izquierda — ahora con espacio suficiente */}
                <text
                  x={PADDING_LEFT - 18} y={cy - 3}
                  textAnchor="end" className="rt-band-label"
                >
                  {CATEGORY_LABELS[cat]}
                </text>
                <text
                  x={PADDING_LEFT - 18} y={cy + 14}
                  textAnchor="end" className="rt-band-hint"
                >
                  {CATEGORY_TRL[cat]}
                </text>
              </g>
            )
          })}

          {/* ─ X-axis ─ */}
          <line
            x1={PADDING_LEFT} y1={VIEWBOX_H - PADDING_BOTTOM}
            x2={VIEWBOX_W - PADDING_RIGHT} y2={VIEWBOX_H - PADDING_BOTTOM}
            stroke="#C9BFD9" strokeWidth={1.5}
          />
          {xTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={tick.x} y1={VIEWBOX_H - PADDING_BOTTOM}
                x2={tick.x} y2={VIEWBOX_H - PADDING_BOTTOM + 5}
                stroke="#C9BFD9" strokeWidth={1.2}
              />
              <text
                x={tick.x} y={VIEWBOX_H - PADDING_BOTTOM + 22}
                textAnchor="middle" className="rt-tick-label"
              >
                {tick.label}
              </text>
              {tick.year && (
                <text
                  x={tick.x} y={VIEWBOX_H - PADDING_BOTTOM + 40}
                  textAnchor="middle" className="rt-tick-year"
                >
                  {tick.year}
                </text>
              )}
            </g>
          ))}

          {/* ─ Today marker ─ */}
          <g>
            <line
              x1={PADDING_LEFT} y1={PADDING_TOP - 35}
              x2={PADDING_LEFT} y2={VIEWBOX_H - PADDING_BOTTOM}
              stroke="#5C358F" strokeWidth={1.5} strokeDasharray="4 5" opacity={0.55}
            />
            <rect
              x={PADDING_LEFT - 28} y={PADDING_TOP - 52}
              width={56} height={18} rx={9}
              fill="#5C358F"
            />
            <text x={PADDING_LEFT} y={PADDING_TOP - 39} textAnchor="middle" className="rt-today-label">
              TODAY
            </text>
          </g>

          {/* ─ Curve morada con glow ─ */}
          {path && (
            <>
              {/* glow soft detrás */}
              <path
                d={path}
                fill="none"
                stroke="#7A4FB5"
                strokeOpacity={0.25}
                strokeWidth={14}
                strokeLinecap="round"
                filter="url(#rt-curve-glow)"
              />
              {/* línea principal */}
              <path
                d={path}
                fill="none"
                stroke="url(#rt-curve-gradient)"
                strokeWidth={4.5}
                strokeLinecap="round"
              />
            </>
          )}

          {/* ─ Bubbles ─ */}
          {filtered.map((rec) => {
            const r = bubbleRadius(rec.fitScore)
            const isHovered = hoveredId === rec.callId
            const sheenId = rec.source === 'EU_PORTAL' ? 'rt-bubble-sheen-eu' : 'rt-bubble-sheen-es'
            return (
              <g
                key={rec.callId}
                className="rt-bubble-group"
                onMouseEnter={() => setHoveredId(rec.callId)}
                onMouseLeave={() => setHoveredId(null)}
                onDoubleClick={() => onOpenInList?.(rec.callId)}
                style={{ cursor: 'pointer' }}
              >
                {/* Halo exterior al hover */}
                {isHovered && (
                  <circle
                    cx={rec.x} cy={rec.y} r={r + 6}
                    fill="none"
                    stroke="#5C358F"
                    strokeOpacity={0.3}
                    strokeWidth={2}
                  />
                )}
                {/* Bubble con gradient radial */}
                <circle
                  cx={rec.x} cy={rec.y} r={r}
                  fill={`url(#${sheenId})`}
                  stroke="#fff"
                  strokeWidth={2.5}
                  filter="url(#rt-bubble-shadow)"
                />
                <text
                  x={rec.x} y={rec.y + 5}
                  textAnchor="middle"
                  fontSize={14}
                  fill="#fff"
                  fontWeight={700}
                  style={{ pointerEvents: 'none', letterSpacing: 0.2 }}
                >
                  {rec.priorityOrder}
                </text>
              </g>
            )
          })}
        </svg>

        {/* ─ Hover tooltip absolute ─ */}
        {hoveredId && (() => {
          const rec = positioned.find(p => p.callId === hoveredId)
          if (!rec) return null
          const call = idiCalls.find(c => c.externalId === rec.callId)
          const leftPct = (rec.x / VIEWBOX_W) * 100
          const topPct = (rec.y / VIEWBOX_H) * 100
          return (
            <div
              className="rt-tooltip"
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
              }}
            >
              <div className="rt-tooltip-header">
                <span className="rt-tooltip-priority">#{rec.priorityOrder}</span>
                <span className={`rt-tooltip-source rt-tooltip-source--${rec.source.toLowerCase()}`}>
                  {rec.source === 'EU_PORTAL' ? 'EU' : 'ES'}
                </span>
                <span className="rt-tooltip-fit">Fit {rec.fitScore}</span>
              </div>
              <h4 className="rt-tooltip-title">{stripAgentTags(rec.title)}</h4>
              <p className="rt-tooltip-reasoning">{stripAgentTags(rec.reasoning).slice(0, 200)}{stripAgentTags(rec.reasoning).length > 200 ? '…' : ''}</p>
              <div className="rt-tooltip-meta">
                <span><strong>Apply by:</strong> {rec.date.toLocaleString('en-US', { month: 'short', year: 'numeric' })}</span>
                <span><strong>Budget:</strong> {rec.estimatedFundingRange}</span>
              </div>
              {rec.risks && rec.risks !== '—' && (
                <div className="rt-tooltip-risk">
                  <AlertTriangle size={12} /> {stripAgentTags(rec.risks)}
                </div>
              )}
              <div className="rt-tooltip-footer">
                {call?.url && (
                  <a href={call.url} target="_blank" rel="noopener noreferrer" className="rt-tooltip-link">
                    Open call <ExternalLink size={11} />
                  </a>
                )}
                {onOpenInList && (
                  <button
                    type="button"
                    className="rt-tooltip-action"
                    onClick={() => onOpenInList(rec.callId)}
                  >
                    Open full card →
                  </button>
                )}
              </div>
            </div>
          )
        })()}
      </div>

      {/* ─ LEGEND ─ */}
      <footer className="rt-legend">
        <div className="rt-legend-group">
          <span className="rt-legend-label">Source:</span>
          <span className="rt-legend-chip"><span className="rt-legend-dot" style={{ background: '#A78BC9' }} /> EU Portal</span>
          <span className="rt-legend-chip"><span className="rt-legend-dot" style={{ background: '#3D1E66' }} /> BDNS (Spain)</span>
        </div>
        <div className="rt-legend-group">
          <span className="rt-legend-label">Bubble size:</span>
          <span className="rt-legend-text">proportional to fit score</span>
        </div>
        <div className="rt-legend-group">
          <span className="rt-legend-label">Curve:</span>
          <span className="rt-legend-text">strategic sequence over time</span>
        </div>
      </footer>
    </div>
  )
}

export default RoadmapTimeline
