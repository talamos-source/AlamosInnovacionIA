import { useMemo, useState } from 'react'
import { ExternalLink, AlertTriangle } from 'lucide-react'
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
const CATEGORY_HINT: Record<Category, string> = {
  research: 'TRL 1-3 · Basic / exploratory',
  development: 'TRL 4-6 · Prototyping / transfer',
  innovation: 'TRL 7-9 · Market / scaleup',
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

const RoadmapTimeline = ({ recommendations, timeline, customerName, idiCalls }: Props) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all')

  /* ---- coords ---- */
  const VIEWBOX_W = 1000
  const VIEWBOX_H = 480
  const PADDING_X = 80
  const PADDING_TOP = 80
  const PADDING_BOTTOM = 70
  const PLOT_W = VIEWBOX_W - 2 * PADDING_X
  const PLOT_H = VIEWBOX_H - PADDING_TOP - PADDING_BOTTOM

  const Y_BANDS: Record<Category, number> = useMemo(() => ({
    research: PADDING_TOP + PLOT_H * 0.18,
    development: PADDING_TOP + PLOT_H * 0.5,
    innovation: PADDING_TOP + PLOT_H * 0.82,
  }), [])

  /* ---- date math ---- */
  const today = useMemo(() => new Date(), [])
  const endDate = useMemo(() => {
    const d = new Date(today)
    d.setFullYear(d.getFullYear() + timeline)
    return d
  }, [today, timeline])
  const totalMs = endDate.getTime() - today.getTime()

  const monthTo = (monthStr: string): Date => {
    const [y, m] = monthStr.split('-').map(Number)
    return new Date(y, (m || 1) - 1, 15) // mid-month
  }

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
        x: PADDING_X + t * PLOT_W,
        y: Y_BANDS[category],
      }
    })
  }, [recommendations, today, totalMs, Y_BANDS])

  const filtered = selectedCategory === 'all'
    ? positioned
    : positioned.filter(r => r.category === selectedCategory)

  /* ---- curved morado path ---- */
  const path = useMemo(() => {
    if (filtered.length < 2) return ''
    const sorted = [...filtered].sort((a, b) => a.x - b.x)
    let d = `M ${sorted[0].x.toFixed(1)} ${sorted[0].y.toFixed(1)}`
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      const curr = sorted[i]
      const cp1x = prev.x + (curr.x - prev.x) * 0.4
      const cp1y = prev.y
      const cp2x = prev.x + (curr.x - prev.x) * 0.6
      const cp2y = curr.y
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`
    }
    return d
  }, [filtered])

  /* ---- X-axis ticks (cada N meses según timeline) ---- */
  const xTicks = useMemo(() => {
    const totalMonths = timeline * 12
    const stepMonths = timeline === 1 ? 1 : timeline === 2 ? 2 : 3
    const ticks: Array<{ x: number; label: string; year?: number }> = []
    for (let m = 0; m <= totalMonths; m += stepMonths) {
      const d = new Date(today)
      d.setMonth(d.getMonth() + m)
      const t = m / totalMonths
      ticks.push({
        x: PADDING_X + t * PLOT_W,
        label: d.toLocaleString('en-US', { month: 'short' }),
        year: d.getMonth() === 0 || m === 0 ? d.getFullYear() : undefined,
      })
    }
    return ticks
  }, [today, timeline])

  /* ---- bubble radius por fitScore ---- */
  const bubbleRadius = (fitScore: number) => {
    // 50-100 score → 14-26 px
    const norm = Math.max(0, Math.min(1, (fitScore - 50) / 50))
    return 14 + norm * 12
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
      {/* ─── HEADER + FILTERS ─── */}
      <header className="rt-header">
        <div>
          <h2>Strategic Roadmap Timeline</h2>
          <p className="muted">
            {customerName && <>{customerName} · </>}
            {timeline} {timeline === 1 ? 'year' : 'years'} horizon ·
            {' '}{positioned.length} recommendations
          </p>
        </div>
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
      </header>

      {/* ─── SVG TIMELINE ─── */}
      <div className="rt-svg-wrap">
        <svg viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`} preserveAspectRatio="xMidYMid meet" className="rt-svg">
          <defs>
            <linearGradient id="rt-curve-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#5C358F" stopOpacity={0.15} />
              <stop offset="50%" stopColor="#5C358F" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#7A4FB5" stopOpacity={0.15} />
            </linearGradient>
            <filter id="rt-bubble-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
              <feOffset dx="0" dy="2" result="offsetblur" />
              <feComponentTransfer><feFuncA type="linear" slope="0.4"/></feComponentTransfer>
              <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* ─ Y-axis bands ─ */}
          {(['research', 'development', 'innovation'] as Category[]).map(cat => (
            <g key={cat}>
              <line
                x1={PADDING_X} y1={Y_BANDS[cat]}
                x2={VIEWBOX_W - PADDING_X} y2={Y_BANDS[cat]}
                stroke="#E5DFEF" strokeWidth={1} strokeDasharray="4 6"
              />
              <text
                x={PADDING_X - 12} y={Y_BANDS[cat] - 8}
                textAnchor="end" className="rt-band-label"
              >
                {CATEGORY_LABELS[cat]}
              </text>
              <text
                x={PADDING_X - 12} y={Y_BANDS[cat] + 6}
                textAnchor="end" className="rt-band-hint"
              >
                {CATEGORY_HINT[cat]}
              </text>
            </g>
          ))}

          {/* ─ X-axis ─ */}
          <line
            x1={PADDING_X} y1={VIEWBOX_H - PADDING_BOTTOM}
            x2={VIEWBOX_W - PADDING_X} y2={VIEWBOX_H - PADDING_BOTTOM}
            stroke="#C9BFD9" strokeWidth={2}
          />
          {xTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={tick.x} y1={VIEWBOX_H - PADDING_BOTTOM}
                x2={tick.x} y2={VIEWBOX_H - PADDING_BOTTOM + 6}
                stroke="#C9BFD9" strokeWidth={1.5}
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
              x1={PADDING_X} y1={PADDING_TOP - 30}
              x2={PADDING_X} y2={VIEWBOX_H - PADDING_BOTTOM}
              stroke="#5C358F" strokeWidth={1.5} strokeDasharray="3 4" opacity={0.6}
            />
            <text x={PADDING_X} y={PADDING_TOP - 38} textAnchor="middle" className="rt-today-label">
              TODAY
            </text>
          </g>

          {/* ─ Curve morada conectando recommendations en orden temporal ─ */}
          {path && (
            <path
              d={path}
              fill="none"
              stroke="url(#rt-curve-gradient)"
              strokeWidth={5}
              strokeLinecap="round"
            />
          )}

          {/* ─ Bubbles ─ */}
          {filtered.map((rec) => {
            const r = bubbleRadius(rec.fitScore)
            const isHovered = hoveredId === rec.callId
            // EU = lavanda claro · ES (BDNS) = morado oscuro profundo. Todo en familia Álamos.
            const fill = rec.source === 'EU_PORTAL' ? '#A78BC9' : '#3D1E66'
            return (
              <g
                key={rec.callId}
                className="rt-bubble-group"
                onMouseEnter={() => setHoveredId(rec.callId)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  cx={rec.x} cy={rec.y} r={r}
                  fill={fill}
                  fillOpacity={isHovered ? 1 : 0.85}
                  stroke="#fff"
                  strokeWidth={isHovered ? 3 : 2}
                  filter="url(#rt-bubble-shadow)"
                />
                <text
                  x={rec.x} y={rec.y + 4}
                  textAnchor="middle"
                  className="rt-bubble-text"
                  fontSize={12}
                  fill="#fff"
                  fontWeight={700}
                  style={{ pointerEvents: 'none' }}
                >
                  {rec.priorityOrder}
                </text>
              </g>
            )
          })}
        </svg>

        {/* ─ Hover tooltip absolute (más control que SVG <title>) ─ */}
        {hoveredId && (() => {
          const rec = positioned.find(p => p.callId === hoveredId)
          if (!rec) return null
          const call = idiCalls.find(c => c.externalId === rec.callId)
          // Position tooltip near the bubble; convert SVG coords to % of viewBox
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
              {call?.url && (
                <a href={call.url} target="_blank" rel="noopener noreferrer" className="rt-tooltip-link">
                  Open call <ExternalLink size={11} />
                </a>
              )}
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
