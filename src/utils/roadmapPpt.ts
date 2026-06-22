/* ============================================================
   Roadmap PPT generator — branding Álamos Innovación
   ============================================================
   Genera una presentación PowerPoint a partir del roadmap I+D+i
   con la identidad visual de Álamos (logo, watermark rama morada,
   tipografía y paleta morado/off-white). Acepta opcionalmente
   un logo de cliente que aparece en la portada.
   ============================================================ */

import PptxGenJS from 'pptxgenjs'

// Assets del template Álamos (importados como URLs vía Vite)
import branchSlideUrl from '../assets/pptx/branch-slide.jpg'
import branchWatermarkUrl from '../assets/pptx/branch-watermark.jpg'
import alamosLogoUrl from '../assets/pptx/alamos-logo.png'

/* ---------- Tipos ---------- */

export interface PptRecommendation {
  callId: string
  title: string
  source: 'EU_PORTAL' | 'BDNS'
  fitScore: number
  reasoning: string
  recommendedMonth: string
  estimatedFundingRange: string
  risks: string
  priorityOrder: number
  /** Orientación estratégica concreta para enfocar la propuesta. Opcional. */
  applicationGuidance?: string
  /** TRL mínimo que necesita el cliente para aplicar. */
  expectedStartTRL?: number
  /** TRL realista al terminar el proyecto. */
  expectedEndTRL?: number
  /** ID de la tech line del cliente que esta call sirve. */
  techLineId?: string | null
}

export interface PptCallDetail {
  externalId: string
  url?: string
  program?: string
  region?: string
  closeDate?: string
}

export interface GenerateRoadmapPptArgs {
  customerName: string
  customerLogoBase64?: string
  customerSector?: string
  timeline: 1 | 2 | 3
  recommendations: PptRecommendation[]
  /** PNG en data URL del timeline visual */
  timelineImageDataUrl?: string
  /** Mapa de detalles extra de la call (programa, región, deadline) */
  callDetails?: Record<string, PptCallDetail>
}

/* ---------- Paleta Álamos ---------- */

const COLOR = {
  brand: '5C358F',
  brandLight: 'A78BC9',
  brandDark: '3D1E66',
  brand50: 'F4EFFB',
  ink: '1A1325',
  text: '3B3346',
  muted: '6B6076',
  border: 'E5DFEF',
  white: 'FFFFFF',
  offWhite: 'FAF8F4',
  success: '2E7D5A',
  warning: 'A8780F',
  euChip: 'A78BC9',
  esChip: '3D1E66',
}

const FONT = {
  heading: 'Calibri',  // misma familia que el template
  body: 'Calibri',
}

/* ---------- Helpers ---------- */

/** Convierte una URL importada por Vite a un dataURL base64 (necesario para pptxgenjs en algunos casos) */
async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

function stripAgentTags(s: string): string {
  if (!s) return ''
  return s
    .replace(/\[\s*(Evergreen|Permanent|Annual|Biannual|Recurrent|Forthcoming|Open)\b[^\]]*\]\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function truncate(s: string, max: number): string {
  if (!s) return ''
  return s.length > max ? s.slice(0, max - 1).trim() + '…' : s
}

function formatApply(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number)
  const d = new Date(y || 2026, (m || 1) - 1, 1)
  return d.toLocaleString('es-ES', { month: 'long', year: 'numeric' })
}

function sourceLabel(s: 'EU_PORTAL' | 'BDNS'): string {
  return s === 'EU_PORTAL' ? 'EU Portal' : 'BDNS España'
}

/* ---------- Layouts comunes ---------- */

/**
 * Añade el background watermark (rama sutil) + logo Álamos en la esquina + footer.
 * Para slides de contenido.
 */
function paintContentBackground(
  slide: PptxGenJS.Slide,
  watermarkDataUrl: string,
  logoDataUrl: string,
  pageNum?: number,
  totalPages?: number,
) {
  // Fondo off-white
  slide.background = { color: COLOR.offWhite }
  // Watermark muy sutil
  slide.addImage({
    data: watermarkDataUrl,
    x: 0, y: 0, w: 13.333, h: 7.5,
    transparency: 60,
  })
  // Logo Álamos esquina superior izquierda
  slide.addImage({
    data: logoDataUrl,
    x: 0.4, y: 0.3, w: 0.85, h: 0.6,
  })
  // Footer
  slide.addText('Álamos Innovación · alamosinnovacion.com', {
    x: 0.4, y: 7.1, w: 8, h: 0.3,
    fontSize: 9, color: COLOR.muted, fontFace: FONT.body,
  })
  if (pageNum && totalPages) {
    slide.addText(`${pageNum} / ${totalPages}`, {
      x: 12.4, y: 7.1, w: 0.5, h: 0.3,
      fontSize: 9, color: COLOR.muted, align: 'right', fontFace: FONT.body,
    })
  }
}

/**
 * Background tipo cover / divider — branch más visible.
 */
function paintDividerBackground(
  slide: PptxGenJS.Slide,
  branchSlideDataUrl: string,
) {
  slide.background = { color: COLOR.offWhite }
  slide.addImage({
    data: branchSlideDataUrl,
    x: 0, y: 0, w: 13.333, h: 7.5,
  })
}

/* ============================================================
   Generador principal
   ============================================================ */

export async function generateRoadmapPpt(args: GenerateRoadmapPptArgs): Promise<void> {
  const {
    customerName,
    customerLogoBase64,
    customerSector,
    timeline,
    recommendations,
    timelineImageDataUrl,
    callDetails = {},
  } = args

  // Pre-carga assets
  const [branchSlide, branchWatermark, alamosLogo] = await Promise.all([
    urlToDataUrl(branchSlideUrl),
    urlToDataUrl(branchWatermarkUrl),
    urlToDataUrl(alamosLogoUrl),
  ])

  const pres = new PptxGenJS()
  pres.layout = 'LAYOUT_WIDE'           // 13.333 x 7.5
  pres.title = `Roadmap I+D+i — ${customerName}`
  pres.company = 'Álamos Innovación'
  pres.author = 'Teresa Álamos'

  const sorted = [...recommendations].sort((a, b) => b.fitScore - a.fitScore)

  // 2 cards por slide → mucho aire por card, nada desborda
  const CARDS_PER_SLIDE = 2
  const cardsSlides = Math.ceil(sorted.length / CARDS_PER_SLIDE)

  // Tabla resumen: máx 12 filas por slide (alto útil ~4.2", rowH 0.33 → cabe holgado).
  // Si hay más recs, se parte en varias slides numeradas.
  const SUMMARY_ROWS_PER_SLIDE = 12
  const summarySlides = Math.max(1, Math.ceil(sorted.length / SUMMARY_ROWS_PER_SLIDE))

  const totalPages = 1 /*cover*/ + 1 /*about*/ + (timelineImageDataUrl ? 1 : 0) + summarySlides + cardsSlides + 1 /*next steps*/
  let page = 0

  /* ============================================================
     1 · COVER
     ============================================================ */
  page++
  {
    const slide = pres.addSlide()
    paintDividerBackground(slide, branchSlide)

    // Logo Álamos arriba izquierda
    slide.addImage({ data: alamosLogo, x: 0.4, y: 0.3, w: 1.1, h: 0.78 })

    // Eyebrow
    slide.addText('ÁLAMOS INNOVACIÓN · ROADMAP I+D+i', {
      x: 0.6, y: 2.3, w: 7, h: 0.35,
      fontSize: 12, bold: true, color: COLOR.brand, fontFace: FONT.heading,
      charSpacing: 4,
    })

    // Título principal
    slide.addText('Roadmap estratégico\nde financiación pública', {
      x: 0.6, y: 2.7, w: 8.5, h: 1.6,
      fontSize: 40, bold: true, color: COLOR.ink, fontFace: FONT.heading,
      lineSpacingMultiple: 1.1,
    })

    // Línea morada decorativa
    slide.addShape('rect' as any, {
      x: 0.6, y: 4.5, w: 0.7, h: 0.06,
      fill: { color: COLOR.brand }, line: { color: COLOR.brand },
    })

    // Subtítulo: cliente
    slide.addText(customerName, {
      x: 0.6, y: 4.7, w: 8, h: 0.5,
      fontSize: 22, bold: true, color: COLOR.text, fontFace: FONT.heading,
    })
    if (customerSector) {
      slide.addText(customerSector, {
        x: 0.6, y: 5.2, w: 8, h: 0.4,
        fontSize: 13, italic: true, color: COLOR.muted, fontFace: FONT.body,
      })
    }

    // Footer-info
    const now = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    slide.addText(`Horizonte: ${timeline} ${timeline === 1 ? 'año' : 'años'}  ·  ${sorted.length} recomendaciones  ·  Generado el ${now}`, {
      x: 0.6, y: 6.9, w: 11, h: 0.4,
      fontSize: 11, color: COLOR.muted, fontFace: FONT.body,
    })

    // Logo del cliente (esquina superior derecha) si existe
    if (customerLogoBase64) {
      slide.addImage({
        data: customerLogoBase64,
        x: 11.2, y: 0.4, w: 1.7, h: 1.1,
        sizing: { type: 'contain', w: 1.7, h: 1.1 },
      })
    }
  }

  /* ============================================================
     2 · SOBRE ESTE ROADMAP (metodología)
     ============================================================ */
  page++
  {
    const slide = pres.addSlide()
    paintContentBackground(slide, branchWatermark, alamosLogo, page, totalPages)

    slide.addText('SOBRE ESTE ROADMAP', {
      x: 0.6, y: 1.0, w: 5, h: 0.35,
      fontSize: 11, bold: true, color: COLOR.brand, fontFace: FONT.heading,
      charSpacing: 3,
    })
    slide.addText('Estrategia personalizada de financiación I+D+i', {
      x: 0.6, y: 1.35, w: 12, h: 0.7,
      fontSize: 28, bold: true, color: COLOR.ink, fontFace: FONT.heading,
    })

    slide.addText(
      `Este documento contiene una hoja de ruta priorizada de oportunidades de financiación pública (nacional y europea) alineadas con el perfil de ${customerName}, su madurez tecnológica y sus objetivos de innovación. Cada convocatoria ha sido evaluada y puntuada según su encaje real, plazos y probabilidad de éxito.`,
      {
        x: 0.6, y: 2.25, w: 12.2, h: 1.2,
        fontSize: 14, color: COLOR.text, fontFace: FONT.body,
        lineSpacingMultiple: 1.35,
      },
    )

    // 4 pasos de metodología en grid (igual estilo que el template Álamos)
    const steps = [
      { num: '01', title: 'Discovery', desc: 'Mapeo de 500+ convocatorias activas (EU Portal + BDNS España).' },
      { num: '02', title: 'Análisis', desc: 'Lectura semántica del perfil de cliente, TRL y líneas tecnológicas.' },
      { num: '03', title: 'Scoring', desc: 'Puntuación multidimensional: encaje, presupuesto, calendario, riesgo.' },
      { num: '04', title: 'Priorización', desc: 'Ordenación temporal y selección de top oportunidades con justificación.' },
    ]
    const cardW = 2.85, cardH = 2.4, gap = 0.25
    const startX = 0.6, startY = 3.85
    steps.forEach((s, i) => {
      const x = startX + i * (cardW + gap)
      slide.addShape('rect' as any, {
        x, y: startY, w: cardW, h: cardH,
        fill: { color: COLOR.white },
        line: { color: COLOR.border, width: 0.75 },
      })
      // Border-left morado
      slide.addShape('rect' as any, {
        x, y: startY, w: 0.06, h: cardH,
        fill: { color: COLOR.brand }, line: { color: COLOR.brand },
      })
      slide.addText(s.num, {
        x: x + 0.25, y: startY + 0.2, w: cardW - 0.4, h: 0.55,
        fontSize: 28, bold: true, color: COLOR.brandLight, fontFace: FONT.heading,
      })
      slide.addText(s.title, {
        x: x + 0.25, y: startY + 0.85, w: cardW - 0.4, h: 0.45,
        fontSize: 16, bold: true, color: COLOR.ink, fontFace: FONT.heading,
      })
      slide.addText(s.desc, {
        x: x + 0.25, y: startY + 1.35, w: cardW - 0.4, h: cardH - 1.5,
        fontSize: 10.5, color: COLOR.text, fontFace: FONT.body,
        lineSpacingMultiple: 1.3,
      })
    })
  }

  /* ============================================================
     3 · TIMELINE VISUAL
     ============================================================ */
  if (timelineImageDataUrl) {
    page++
    const slide = pres.addSlide()
    paintContentBackground(slide, branchWatermark, alamosLogo, page, totalPages)

    slide.addText('VISIÓN GENERAL', {
      x: 0.6, y: 1.0, w: 5, h: 0.35,
      fontSize: 11, bold: true, color: COLOR.brand, fontFace: FONT.heading,
      charSpacing: 3,
    })
    slide.addText('Línea temporal estratégica', {
      x: 0.6, y: 1.35, w: 12, h: 0.7,
      fontSize: 28, bold: true, color: COLOR.ink, fontFace: FONT.heading,
    })

    // El SVG del timeline es 1140x500 (ratio 2.28). Para 12.1" de ancho
    // necesitamos ~5.31" de alto para preservar proporción. Usamos un
    // poco menos por margen + footer (5.0" deja espacio claro).
    slide.addImage({
      data: timelineImageDataUrl,
      x: 0.6, y: 2.3, w: 12.1, h: 5.0,
      sizing: { type: 'contain', w: 12.1, h: 5.0 },
    })
  }

  /* ============================================================
     4 · TABLA RESUMEN (paginada — N slides si hay muchas recs)
     ============================================================ */
  const headers = ['#', 'Convocatoria', 'Fuente', 'Fit', 'Cuándo', 'Presupuesto']
  for (let s = 0; s < summarySlides; s++) {
    page++
    const slide = pres.addSlide()
    paintContentBackground(slide, branchWatermark, alamosLogo, page, totalPages)

    const startIdx = s * SUMMARY_ROWS_PER_SLIDE
    const endIdx = Math.min(startIdx + SUMMARY_ROWS_PER_SLIDE, sorted.length)
    const chunk = sorted.slice(startIdx, endIdx)

    slide.addText('RESUMEN', {
      x: 0.6, y: 1.0, w: 5, h: 0.35,
      fontSize: 11, bold: true, color: COLOR.brand, fontFace: FONT.heading,
      charSpacing: 3,
    })
    slide.addText(
      summarySlides > 1
        ? `Recomendaciones priorizadas (${s + 1}/${summarySlides})`
        : 'Recomendaciones priorizadas',
      {
        x: 0.6, y: 1.35, w: 12, h: 0.7,
        fontSize: 28, bold: true, color: COLOR.ink, fontFace: FONT.heading,
      },
    )

    const rows = chunk.map(r => [
      `#${r.priorityOrder}`,
      truncate(stripAgentTags(r.title), 65),
      sourceLabel(r.source),
      `${r.fitScore}`,
      formatApply(r.recommendedMonth),
      r.estimatedFundingRange && r.estimatedFundingRange !== '—' ? r.estimatedFundingRange : '—',
    ])
    const tableRows: PptxGenJS.TableRow[] = [
      headers.map(h => ({
        text: h,
        options: {
          bold: true, color: COLOR.white, fill: { color: COLOR.brand },
          fontSize: 10, fontFace: FONT.heading, align: 'left' as const, valign: 'middle' as const,
        },
      })),
      ...rows.map((row, idx) => row.map((cell, ci) => ({
        text: cell,
        options: {
          color: ci === 0 ? COLOR.brand : COLOR.text,
          bold: ci === 0,
          fontSize: 9.5,
          fontFace: FONT.body,
          fill: { color: idx % 2 === 0 ? COLOR.white : COLOR.brand50 },
          align: (ci === 3 ? 'center' : 'left') as 'left' | 'center',
          valign: 'middle' as const,
        },
      }))),
    ]
    slide.addTable(tableRows, {
      x: 0.6, y: 2.3, w: 12.1,
      colW: [0.55, 5.95, 1.5, 0.7, 1.6, 1.8],
      rowH: 0.33,
      border: { type: 'solid', color: COLOR.border, pt: 0.5 },
    })

    // Hint de continuación si no es la última slide de resumen
    if (s < summarySlides - 1) {
      slide.addText(`Continúa en la página siguiente…`, {
        x: 0.6, y: 6.85, w: 12, h: 0.3,
        fontSize: 9, italic: true, color: COLOR.muted, fontFace: FONT.body,
      })
    }
  }

  /* ============================================================
     5 · CARDS DETALLADAS — empaquetado adaptativo
     ============================================================
     Algoritmo greedy: para cada rec mira si su contenido es "denso"
     (reasoning + guidance + risk grandes). Si lo es → 1 sola card
     por slide ocupando el doble de alto. Si no → 2 cards por slide.
     Garantiza que NUNCA se trunca con elipsis.
     ============================================================ */
  const isDenseCard = (r: PptRecommendation): boolean => {
    const reasonChars = stripAgentTags(r.reasoning || '').length
    const guidanceChars = stripAgentTags(r.applicationGuidance || '').length
    const riskChars = stripAgentTags(r.risks || '').length
    const titleChars = stripAgentTags(r.title || '').length
    // Umbrales calibrados con el espacio real disponible en cards normales (2.65" alto)
    return reasonChars > 280 || guidanceChars > 250 || riskChars > 130 || titleChars > 110
  }

  // Empaqueta las recs ordenadas en grupos: [1] denso o [1,2] normales
  type SlideGroup = { recs: PptRecommendation[]; mode: 'big' | 'normal' }
  const groups: SlideGroup[] = []
  let i = 0
  while (i < sorted.length) {
    const r1 = sorted[i]
    if (isDenseCard(r1)) {
      groups.push({ recs: [r1], mode: 'big' })
      i += 1
    } else if (i + 1 < sorted.length && !isDenseCard(sorted[i + 1])) {
      groups.push({ recs: [r1, sorted[i + 1]], mode: 'normal' })
      i += 2
    } else {
      groups.push({ recs: [r1], mode: 'normal' })
      i += 1
    }
  }
  const realCardsSlides = groups.length
  // Recalculamos totalPages real (substituyendo el estimado inicial)
  const realTotalPages = 1 /*cover*/ + 1 /*about*/ + (timelineImageDataUrl ? 1 : 0) + summarySlides + realCardsSlides + 1 /*next steps*/

  for (let g = 0; g < groups.length; g++) {
    page++
    const slide = pres.addSlide()
    paintContentBackground(slide, branchWatermark, alamosLogo, page, realTotalPages)
    const group = groups[g]
    const chunk = group.recs

    slide.addText('DETALLE DE RECOMENDACIONES', {
      x: 0.6, y: 0.95, w: 8, h: 0.35,
      fontSize: 11, bold: true, color: COLOR.brand, fontFace: FONT.heading,
      charSpacing: 3,
    })
    slide.addText(`Página ${g + 1} de ${realCardsSlides}`, {
      x: 9.5, y: 0.95, w: 3.4, h: 0.35,
      fontSize: 11, color: COLOR.muted, fontFace: FONT.body, align: 'right',
    })

    // Layout: 'big' = 1 card de 5.40" (margen seguro al footer)
    //         'normal' = 1-2 cards de 2.55" cada una
    // Budget vertical big:
    //   header (title+meta+trl+sep) hasta cy+1.74 = 1.74
    //   reasoning 1.20 + gap 0.20 + guidance 1.55 + gap 0.10 + risk 0.40 + margen 0.15 = 3.60
    //   total = 5.34 ≤ 5.40 ✓ con margen
    // Budget vertical normal:
    //   header hasta cy+1.74 = 1.74
    //   reasoning 0.35 + gap 0.06 + guidance 0.32 + margen 0.08 = 0.81
    //   total = 2.55 ✓
    const cardW = 12.1
    const startY = 1.45
    const gapY = 0.20
    const cardH = group.mode === 'big' ? 5.40 : 2.55

    chunk.forEach((rec, idx) => {
      const cy = startY + idx * (cardH + gapY)
      // Card body
      slide.addShape('rect' as any, {
        x: 0.6, y: cy, w: cardW, h: cardH,
        fill: { color: COLOR.white },
        line: { color: COLOR.border, width: 0.75 },
      })
      // Border-left morado
      slide.addShape('rect' as any, {
        x: 0.6, y: cy, w: 0.1, h: cardH,
        fill: { color: COLOR.brand }, line: { color: COLOR.brand },
      })
      // Priority badge (más grande)
      slide.addShape('ellipse' as any, {
        x: 0.9, y: cy + 0.25, w: 0.7, h: 0.7,
        fill: { color: COLOR.brand }, line: { color: COLOR.brand },
      })
      slide.addText(`${rec.priorityOrder}`, {
        x: 0.9, y: cy + 0.25, w: 0.7, h: 0.7,
        fontSize: 18, bold: true, color: COLOR.white, fontFace: FONT.heading,
        align: 'center', valign: 'middle',
      })

      // Fit chip a la derecha (reservamos su ancho antes del title)
      const fitColor = rec.fitScore >= 80 ? COLOR.success : rec.fitScore >= 60 ? COLOR.brand : COLOR.warning
      const fitChipW = 1.1
      const fitChipX = 0.6 + cardW - fitChipW - 0.25
      slide.addShape('roundRect' as any, {
        x: fitChipX, y: cy + 0.3, w: fitChipW, h: 0.42,
        fill: { color: fitColor }, line: { color: fitColor },
        rectRadius: 0.06,
      })
      slide.addText(`Fit ${rec.fitScore}`, {
        x: fitChipX, y: cy + 0.3, w: fitChipW, h: 0.42,
        fontSize: 12, bold: true, color: COLOR.white, fontFace: FONT.heading,
        align: 'center', valign: 'middle',
      })

      // Title — hasta el fit chip menos margen. Sin truncar, shrinkText se encarga.
      const titleW = fitChipX - 1.8 - 0.15
      slide.addText(stripAgentTags(rec.title), {
        x: 1.8, y: cy + 0.22, w: titleW, h: 0.75,
        fontSize: 14, bold: true, color: COLOR.ink, fontFace: FONT.heading,
        valign: 'top',
        lineSpacingMultiple: 1.15,
        shrinkText: true,
      })

      // Meta (source + apply + budget)
      const detail = callDetails[rec.callId]
      const metaParts = [
        sourceLabel(rec.source),
        detail?.program,
        detail?.region,
        `Apply: ${formatApply(rec.recommendedMonth)}`,
        rec.estimatedFundingRange && rec.estimatedFundingRange !== '—' ? rec.estimatedFundingRange : null,
      ].filter(Boolean).join('  ·  ')
      slide.addText(metaParts, {
        x: 1.8, y: cy + 1.05, w: cardW - 1.4, h: 0.28,
        fontSize: 10, color: COLOR.muted, fontFace: FONT.body,
        valign: 'top',
        shrinkText: true,
      })

      // TRL bar — si hay TRL ranges los pinto pegados a la meta
      if (rec.expectedStartTRL || rec.expectedEndTRL) {
        const trlText = `TRL ${rec.expectedStartTRL ?? '?'} → TRL ${rec.expectedEndTRL ?? '?'}`
        slide.addShape('roundRect' as any, {
          x: 1.8, y: cy + 1.34, w: 1.5, h: 0.28,
          fill: { color: COLOR.brand50 }, line: { color: COLOR.brand },
          rectRadius: 0.04,
        })
        slide.addText(trlText, {
          x: 1.8, y: cy + 1.34, w: 1.5, h: 0.28,
          fontSize: 9.5, bold: true, color: COLOR.brand, fontFace: FONT.heading,
          align: 'center', valign: 'middle',
        })
      }

      // Separador sutil
      slide.addShape('rect' as any, {
        x: 1.8, y: cy + 1.68, w: cardW - 1.4, h: 0.01,
        fill: { color: COLOR.border }, line: { color: COLOR.border },
      })

      // ── Layout interno por bloque (reasoning + guidance + risk) ──
      // Big card cardH=5.40, presupuesto vertical desde cy+1.74:
      //   reasoning 1.20 + gap 0.20 + guidance 1.55 + gap 0.10 + risk 0.40 = 3.45 ≤ 3.51 ✓
      // Normal card cardH=2.55, presupuesto:
      //   reasoning 0.35 + gap 0.06 + guidance 0.32 = 0.73 ≤ 0.81 ✓
      const isBig = group.mode === 'big'
      const reasonH = isBig ? 1.2 : 0.35
      const gapAfterReason = isBig ? 0.2 : 0.06
      const reasoningFontSize = isBig ? 12 : 10.5

      slide.addText(stripAgentTags(rec.reasoning), {
        x: 1.8, y: cy + 1.74, w: cardW - 1.4, h: reasonH,
        fontSize: reasoningFontSize, color: COLOR.text, fontFace: FONT.body,
        lineSpacingMultiple: 1.25,
        valign: 'top',
        shrinkText: true,
      })

      // Bloque "Cómo orientar la solicitud" — sin truncar, con shrinkText
      const guidance = rec.applicationGuidance && rec.applicationGuidance.trim()
        ? stripAgentTags(rec.applicationGuidance) : ''
      const guidanceY = cy + 1.74 + reasonH + gapAfterReason
      const guidanceH = isBig ? 1.55 : 0.32

      if (guidance) {
        slide.addShape('rect' as any, {
          x: 1.8, y: guidanceY, w: cardW - 1.4, h: guidanceH,
          fill: { color: COLOR.brand50 }, line: { color: COLOR.brand50 },
        })
        slide.addShape('rect' as any, {
          x: 1.8, y: guidanceY, w: 0.04, h: guidanceH,
          fill: { color: COLOR.brand }, line: { color: COLOR.brand },
        })
        if (isBig) {
          // Card grande: label completo arriba, texto debajo (más legible)
          slide.addText('CÓMO ORIENTAR LA SOLICITUD', {
            x: 1.93, y: guidanceY + 0.06, w: 4.5, h: 0.20,
            fontSize: 9, bold: true, color: COLOR.brand, fontFace: FONT.heading,
            charSpacing: 1.5,
            valign: 'top',
          })
          slide.addText(guidance, {
            x: 1.93, y: guidanceY + 0.30,
            w: cardW - 1.5, h: guidanceH - 0.36,
            fontSize: 11.5, italic: true, color: COLOR.text, fontFace: FONT.body,
            lineSpacingMultiple: 1.25,
            valign: 'top',
            shrinkText: true,
          })
        } else {
          // Card normal: label corto a la izquierda, texto a la derecha
          slide.addText('CÓMO ORIENTAR', {
            x: 1.93, y: guidanceY + 0.04, w: 1.55, h: 0.32,
            fontSize: 7.5, bold: true, color: COLOR.brand, fontFace: FONT.heading,
            charSpacing: 1.5,
            valign: 'middle',
          })
          slide.addText(guidance, {
            x: 3.55, y: guidanceY + 0.05,
            w: cardW - 1.4 - 1.75 - 0.1, h: guidanceH - 0.1,
            fontSize: 10, italic: true, color: COLOR.text, fontFace: FONT.body,
            lineSpacingMultiple: 1.2,
            valign: 'top',
            shrinkText: true,
          })
        }
      }

      // Risk al pie de la card — solo si cabe estrictamente dentro del cardBottom
      if (rec.risks && rec.risks !== '—' && rec.risks.trim()) {
        const riskY = guidance
          ? guidanceY + guidanceH + 0.10
          : cy + 1.74 + reasonH + 0.12
        const cardBottom = cy + cardH - 0.12
        const availableH = cardBottom - riskY
        // Mínimo 0.25" para que entre al menos una línea de 9pt
        if (availableH >= 0.25) {
          slide.addText(`⚠ ${stripAgentTags(rec.risks)}`, {
            x: 1.8, y: riskY, w: cardW - 1.4, h: Math.min(0.40, availableH),
            fontSize: isBig ? 10.5 : 9, italic: true, color: COLOR.warning, fontFace: FONT.body,
            valign: 'top',
            shrinkText: true,
          })
        }
      }
    })
  }

  /* ============================================================
     6 · PRÓXIMOS PASOS / CONTACTO
     ============================================================ */
  page++
  {
    const slide = pres.addSlide()
    paintDividerBackground(slide, branchSlide)
    slide.addImage({ data: alamosLogo, x: 0.4, y: 0.3, w: 0.85, h: 0.6 })

    slide.addText('PRÓXIMOS PASOS', {
      x: 0.6, y: 2.2, w: 5, h: 0.4,
      fontSize: 12, bold: true, color: COLOR.brand, fontFace: FONT.heading,
      charSpacing: 4,
    })
    slide.addText('Convertimos este roadmap\nen propuestas que ganan.', {
      x: 0.6, y: 2.65, w: 11, h: 1.6,
      fontSize: 36, bold: true, color: COLOR.ink, fontFace: FONT.heading,
      lineSpacingMultiple: 1.1,
    })

    slide.addText(
      [
        { text: 'Revisión conjunta: ', options: { bold: true, color: COLOR.brand } },
        { text: 'Priorizamos juntos las 3-5 convocatorias clave del primer año.\n', options: { color: COLOR.text } },
        { text: 'Preparación: ', options: { bold: true, color: COLOR.brand } },
        { text: 'Cronograma de propuestas y kick-off del primer call.\n', options: { color: COLOR.text } },
        { text: 'Acompañamiento: ', options: { bold: true, color: COLOR.brand } },
        { text: 'Redacción, partners europeos si aplica, y gestión post-concesión.', options: { color: COLOR.text } },
      ],
      {
        x: 0.6, y: 4.5, w: 8.5, h: 1.6,
        fontSize: 14, fontFace: FONT.body, lineSpacingMultiple: 1.4,
      },
    )

    slide.addText('Hablemos.', {
      x: 0.6, y: 6.1, w: 6, h: 0.5,
      fontSize: 18, bold: true, color: COLOR.brand, fontFace: FONT.heading,
    })
    slide.addText(
      'Teresa Álamos · Álamos Innovación\ncontacto@alamosinnovacion.com · alamosinnovacion.com',
      {
        x: 0.6, y: 6.55, w: 8, h: 0.6,
        fontSize: 11, color: COLOR.text, fontFace: FONT.body,
      },
    )
  }

  /* ============================================================
     Guardar
     ============================================================ */
  const ts = new Date().toISOString().slice(0, 10)
  const safeName = customerName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  await pres.writeFile({ fileName: `Roadmap-IDi-${safeName}-${ts}.pptx` })
}
