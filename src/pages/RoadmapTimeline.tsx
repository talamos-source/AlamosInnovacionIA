import { useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react'
import { ExternalLink, AlertTriangle, Download } from 'lucide-react'
import './RoadmapTimeline.css'

/** Handle expuesto al padre para poder pedir el PNG desde fuera (ej. para el export PPT). */
export interface RoadmapTimelineHandle {
  /** Devuelve el dataURL PNG SOLO del timeline (sin el resumen de cards). */
  getTimelinePngDataUrl: () => Promise<string>
}

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

const RoadmapTimeline = forwardRef<RoadmapTimelineHandle, Props>(({ recommendations, timeline, customerName, idiCalls, onOpenInList }, ref) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all')
  const svgRef = useRef<SVGSVGElement | null>(null)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Programa cerrar el tooltip con delay (cancelable si entras al tooltip) */
  const scheduleHoverClose = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    hoverTimeoutRef.current = setTimeout(() => setHoveredId(null), 220)
  }
  const cancelHoverClose = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
  }

  /* ---- coords ---- */
  const VIEWBOX_W = 1140
  const VIEWBOX_H = 500
  const PADDING_LEFT = 180   // más espacio para labels Y y respiración
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
  // TODAY siempre anclado al borde izquierdo del plot.
  const startMs = today.getTime()
  // Pequeño offset (en días) para que las bubbles del mes en curso o anteriores
  // queden justo a la DERECHA de la línea TODAY (no encima, no a la izquierda).
  const PRESENT_OFFSET_DAYS = 8

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
    const total = endMs - startMs
    const months = total / (1000 * 60 * 60 * 24 * 30.4)
    return { totalMs: total, spanMonths: months }
  }, [recommendations, today, startMs, maxHorizonDate])

  // TODAY pegado al margen izquierdo del plot
  const todayX = PADDING_LEFT

  /* ---- positioned recs ---- */
  const positioned = useMemo(() => {
    const minPresentMs = today.getTime() + 1000 * 60 * 60 * 24 * PRESENT_OFFSET_DAYS
    return recommendations.map(rec => {
      const realDate = monthTo(rec.recommendedMonth)
      // Si la fecha de aplicación ya pasó o es esta misma semana,
      // la "anclamos" a +8 días desde hoy para que la bubble se
      // muestre claramente a la derecha de TODAY (no encima ni detrás).
      const effectiveMs = Math.max(realDate.getTime(), minPresentMs)
      const t = Math.max(0, Math.min(1, (effectiveMs - startMs) / totalMs))
      const category = categorize(rec)
      return {
        ...rec,
        date: realDate,         // fecha real para mostrar en tooltip
        category,
        x: PADDING_LEFT + t * PLOT_W,
        y: Y_BANDS[category],
      }
    })
  }, [recommendations, today, startMs, totalMs, Y_BANDS])

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
    let stepMonths: number
    if (totalMonths <= 6) stepMonths = 1
    else if (totalMonths <= 12) stepMonths = 1
    else if (totalMonths <= 18) stepMonths = 2
    else if (totalMonths <= 24) stepMonths = 2
    else stepMonths = 3
    const ticks: Array<{ x: number; label: string; year?: number }> = []
    // Primer tick = inicio del PRÓXIMO mes (para no superponer con TODAY)
    const firstTick = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    for (let m = 0; m <= totalMonths + 1; m += stepMonths) {
      const d = new Date(firstTick)
      d.setMonth(d.getMonth() + m)
      const t = (d.getTime() - startMs) / totalMs
      if (t < 0.04 || t > 1) continue  // skip lo que cae demasiado pegado a TODAY
      ticks.push({
        x: PADDING_LEFT + t * PLOT_W,
        label: d.toLocaleString('en-US', { month: 'short' }),
        year: d.getMonth() === 0 || m === 0 ? d.getFullYear() : undefined,
      })
    }
    return ticks
  }, [today, startMs, totalMs, spanMonths])

  /* ---- bubble radius por fitScore ---- */
  const bubbleRadius = (fitScore: number) => {
    const norm = Math.max(0, Math.min(1, (fitScore - 50) / 50))
    return 16 + norm * 14   // 16 → 30 px (más generoso)
  }

  /**
   * Renderiza SOLO el SVG del timeline a PNG dataURL (sin la lista resumen abajo).
   * Útil para incrustar en el PPT, donde la lista va aparte.
   */
  const getTimelinePngDataUrl = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const svg = svgRef.current
      if (!svg) return reject(new Error('SVG not mounted'))
      const clone = svg.cloneNode(true) as SVGSVGElement
      const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style')
      styleEl.textContent = `
        text {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        }
      `
      clone.insertBefore(styleEl, clone.firstChild)
      const svgStr = new XMLSerializer().serializeToString(clone)
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => {
        const scale = 2
        const canvas = document.createElement('canvas')
        canvas.width = VIEWBOX_W * scale
        canvas.height = VIEWBOX_H * scale
        const ctx = canvas.getContext('2d')
        if (!ctx) { URL.revokeObjectURL(url); return reject(new Error('No canvas ctx')) }
        ctx.fillStyle = '#FAF8F4'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG image load failed')) }
      img.src = url
    })
  }

  useImperativeHandle(ref, () => ({ getTimelinePngDataUrl }))

  /* ---- PNG export con resumen de cards y fonts robustas ---- */
  const handleDownloadPNG = () => {
    const svg = svgRef.current
    if (!svg) return

    // Clonamos el SVG para inyectar un <style> con font-family de sistema
    // (Inter no se carga dentro de un data: SVG renderizado en canvas).
    const clone = svg.cloneNode(true) as SVGSVGElement
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    styleEl.textContent = `
      text {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      }
    `
    clone.insertBefore(styleEl, clone.firstChild)

    const serializer = new XMLSerializer()
    const svgStr = serializer.serializeToString(clone)
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const scale = 2 // export @2x para nitidez retina
      const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif'

      // Resumen abajo del timeline
      const sortedRecs = [...positioned].sort((a, b) => b.fitScore - a.fitScore)
      const cardH = 56
      const summaryHeader = 80
      const summaryFooter = 40
      const summaryHeight = summaryHeader + sortedRecs.length * cardH + summaryFooter

      const canvas = document.createElement('canvas')
      canvas.width = VIEWBOX_W * scale
      canvas.height = (VIEWBOX_H + summaryHeight) * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Background off-white
      ctx.fillStyle = '#FAF8F4'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Timeline arriba
      ctx.drawImage(img, 0, 0, VIEWBOX_W * scale, VIEWBOX_H * scale)
      URL.revokeObjectURL(url)

      // ───── Resumen abajo ─────
      const sy = VIEWBOX_H * scale
      const padX = 40 * scale

      // Separador
      ctx.strokeStyle = '#D5C9E6'
      ctx.lineWidth = 1 * scale
      ctx.beginPath()
      ctx.moveTo(padX, sy + 10 * scale)
      ctx.lineTo(canvas.width - padX, sy + 10 * scale)
      ctx.stroke()

      // Título resumen
      ctx.fillStyle = '#5C358F'
      ctx.font = `bold ${20 * scale}px ${FONT_STACK}`
      ctx.textBaseline = 'top'
      ctx.fillText(
        `Recommendations summary — ${customerName || 'Client'}`,
        padX,
        sy + 30 * scale,
      )

      // Subtítulo (count + timeline + fecha)
      ctx.fillStyle = '#6B6076'
      ctx.font = `${12 * scale}px ${FONT_STACK}`
      const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      ctx.fillText(
        `${sortedRecs.length} recommendations · ${timeline} ${timeline === 1 ? 'year' : 'years'} horizon · Generated ${dateStr}`,
        padX,
        sy + 58 * scale,
      )

      // Cards
      sortedRecs.forEach((rec, i) => {
        const cy = sy + (summaryHeader + i * cardH) * scale
        const cardX = padX
        const cardW = canvas.width - 2 * padX
        const innerH = (cardH - 8) * scale

        // Card background
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(cardX, cy, cardW, innerH)
        // Border-left morado
        ctx.fillStyle = '#5C358F'
        ctx.fillRect(cardX, cy, 4 * scale, innerH)
        // Sutil border
        ctx.strokeStyle = '#EDE6F5'
        ctx.lineWidth = 1 * scale
        ctx.strokeRect(cardX, cy, cardW, innerH)

        // Priority badge
        ctx.fillStyle = '#5C358F'
        ctx.font = `bold ${15 * scale}px ${FONT_STACK}`
        ctx.fillText(`#${rec.priorityOrder}`, cardX + 18 * scale, cy + 8 * scale)

        // Title
        const title = stripAgentTags(rec.title) || rec.callId
        const titleTrim = title.length > 95 ? title.slice(0, 92) + '…' : title
        ctx.fillStyle = '#1A1325'
        ctx.font = `600 ${14 * scale}px ${FONT_STACK}`
        ctx.fillText(titleTrim, cardX + 60 * scale, cy + 8 * scale)

        // Meta line: source badge + fit + apply + budget
        const sourceLabel = rec.source === 'EU_PORTAL' ? 'EU Portal' : 'BDNS Spain'
        const sourceColor = rec.source === 'EU_PORTAL' ? '#A78BC9' : '#3D1E66'
        const applyStr = rec.date.toLocaleString('en-US', { month: 'short', year: 'numeric' })
        const budget = rec.estimatedFundingRange && rec.estimatedFundingRange !== '—'
          ? rec.estimatedFundingRange : 'Budget n/a'

        const metaY = cy + 30 * scale

        // Source chip
        ctx.fillStyle = sourceColor
        const chipW = ctx.measureText(sourceLabel).width
        ctx.font = `bold ${10 * scale}px ${FONT_STACK}`
        const realChipW = ctx.measureText(sourceLabel).width + 12 * scale
        ctx.fillRect(cardX + 60 * scale, metaY - 2 * scale, realChipW, 16 * scale)
        ctx.fillStyle = '#FFFFFF'
        ctx.fillText(sourceLabel, cardX + 66 * scale, metaY + 1 * scale)

        // Fit + apply + budget
        ctx.fillStyle = '#6B6076'
        ctx.font = `${11 * scale}px ${FONT_STACK}`
        const metaText = `Fit ${rec.fitScore}  ·  Apply ${applyStr}  ·  ${budget}`
        ctx.fillText(metaText, cardX + 70 * scale + realChipW, metaY + 1 * scale)
        // dummy use to silence ts noUnusedLocals on chipW
        void chipW
      })

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
            {/* Font stack del SVG — usamos system fonts para que el export PNG coincida */}
            <style>{`
              .rt-svg text {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
              }
            `}</style>
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
                {/* Label a la izquierda — en su propio gutter con aire */}
                <text
                  x={PADDING_LEFT - 22} y={cy - 8}
                  textAnchor="end" className="rt-band-label"
                >
                  {CATEGORY_LABELS[cat]}
                </text>
                <text
                  x={PADDING_LEFT - 22} y={cy + 12}
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
              x1={todayX} y1={PADDING_TOP - 35}
              x2={todayX} y2={VIEWBOX_H - PADDING_BOTTOM}
              stroke="#5C358F" strokeWidth={1.5} strokeDasharray="4 5" opacity={0.55}
            />
            <rect
              x={todayX - 28} y={PADDING_TOP - 52}
              width={56} height={18} rx={9}
              fill="#5C358F"
            />
            <text x={todayX} y={PADDING_TOP - 39} textAnchor="middle" className="rt-today-label">
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
                onMouseEnter={() => { cancelHoverClose(); setHoveredId(rec.callId) }}
                onMouseLeave={scheduleHoverClose}
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
              onMouseEnter={cancelHoverClose}
              onMouseLeave={scheduleHoverClose}
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
})

RoadmapTimeline.displayName = 'RoadmapTimeline'

export default RoadmapTimeline
