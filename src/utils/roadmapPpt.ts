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
  const totalPages = 1 /*cover*/ + 1 /*about*/ + (timelineImageDataUrl ? 1 : 0) + 1 /*summary table*/ + cardsSlides + 1 /*next steps*/
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
     4 · TABLA RESUMEN (top recomendaciones)
     ============================================================ */
  page++
  {
    const slide = pres.addSlide()
    paintContentBackground(slide, branchWatermark, alamosLogo, page, totalPages)

    slide.addText('RESUMEN', {
      x: 0.6, y: 1.0, w: 5, h: 0.35,
      fontSize: 11, bold: true, color: COLOR.brand, fontFace: FONT.heading,
      charSpacing: 3,
    })
    slide.addText('Recomendaciones priorizadas', {
      x: 0.6, y: 1.35, w: 12, h: 0.7,
      fontSize: 28, bold: true, color: COLOR.ink, fontFace: FONT.heading,
    })

    // Tabla
    const headers = ['#', 'Convocatoria', 'Fuente', 'Fit', 'Cuándo', 'Presupuesto']
    const rows = sorted.slice(0, 16).map(r => [
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
      rowH: 0.32,
      border: { type: 'solid', color: COLOR.border, pt: 0.5 },
    })

    if (sorted.length > 16) {
      slide.addText(`+ ${sorted.length - 16} adicionales en las siguientes páginas`, {
        x: 0.6, y: 6.7, w: 12, h: 0.3,
        fontSize: 9, italic: true, color: COLOR.muted, fontFace: FONT.body,
      })
    }
  }

  /* ============================================================
     5 · CARDS DETALLADAS (3 por slide)
     ============================================================ */
  for (let i = 0; i < sorted.length; i += CARDS_PER_SLIDE) {
    page++
    const slide = pres.addSlide()
    paintContentBackground(slide, branchWatermark, alamosLogo, page, totalPages)
    const chunk = sorted.slice(i, i + CARDS_PER_SLIDE)

    const slideNumber = Math.floor(i / CARDS_PER_SLIDE) + 1
    const totalCardSlides = cardsSlides

    slide.addText('DETALLE DE RECOMENDACIONES', {
      x: 0.6, y: 0.95, w: 8, h: 0.35,
      fontSize: 11, bold: true, color: COLOR.brand, fontFace: FONT.heading,
      charSpacing: 3,
    })
    slide.addText(`Página ${slideNumber} de ${totalCardSlides}`, {
      x: 9.5, y: 0.95, w: 3.4, h: 0.35,
      fontSize: 11, color: COLOR.muted, fontFace: FONT.body, align: 'right',
    })

    // 2 cards por slide con bloque de guidance. Vertical budget:
    //   slide útil = 7.5 - top(1.45) - bottom(0.5) = 5.55"
    //   2 cards * 2.65 + 1 gap * 0.25 = 5.55 ✓
    const cardH = 2.65
    const cardW = 12.1
    const startY = 1.45
    const gapY = 0.25

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

      // Title — hasta el fit chip menos margen. Más espacio vertical para
      // permitir wrap a 2 líneas sin desbordar.
      const titleW = fitChipX - 1.8 - 0.15
      slide.addText(truncate(stripAgentTags(rec.title), 130), {
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
      slide.addText(truncate(metaParts, 160), {
        x: 1.8, y: cy + 1.05, w: cardW - 1.4, h: 0.32,
        fontSize: 10, color: COLOR.muted, fontFace: FONT.body,
        valign: 'top',
        shrinkText: true,
      })

      // Separador sutil
      slide.addShape('rect' as any, {
        x: 1.8, y: cy + 1.4, w: cardW - 1.4, h: 0.01,
        fill: { color: COLOR.border }, line: { color: COLOR.border },
      })

      // Reasoning — compacto
      slide.addText(truncate(stripAgentTags(rec.reasoning), 320), {
        x: 1.8, y: cy + 1.48, w: cardW - 1.4, h: 0.55,
        fontSize: 10.5, color: COLOR.text, fontFace: FONT.body,
        lineSpacingMultiple: 1.2,
        valign: 'top',
        shrinkText: true,
      })

      // Bloque "Cómo orientar la solicitud" — destacado morado claro
      const guidance = rec.applicationGuidance && rec.applicationGuidance.trim()
        ? stripAgentTags(rec.applicationGuidance) : ''
      if (guidance) {
        const gY = cy + 2.05
        const gH = 0.55
        // Fondo morado muy claro
        slide.addShape('rect' as any, {
          x: 1.8, y: gY, w: cardW - 1.4, h: gH,
          fill: { color: COLOR.brand50 }, line: { color: COLOR.brand50 },
        })
        // Border-left morado
        slide.addShape('rect' as any, {
          x: 1.8, y: gY, w: 0.04, h: gH,
          fill: { color: COLOR.brand }, line: { color: COLOR.brand },
        })
        // Label
        slide.addText('CÓMO ORIENTAR', {
          x: 1.93, y: gY + 0.04, w: 1.6, h: 0.2,
          fontSize: 7.5, bold: true, color: COLOR.brand, fontFace: FONT.heading,
          charSpacing: 1.5,
          valign: 'top',
        })
        // Texto
        slide.addText(truncate(guidance, 280), {
          x: 3.55, y: gY + 0.05, w: cardW - 1.4 - 1.75 - 0.1, h: gH - 0.1,
          fontSize: 10, italic: true, color: COLOR.text, fontFace: FONT.body,
          lineSpacingMultiple: 1.2,
          valign: 'top',
          shrinkText: true,
        })
      }
      // Risk pegado al pie (si hay)
      if (rec.risks && rec.risks !== '—' && rec.risks.trim()) {
        // Solo si NO hay guidance ponemos el risk con más espacio.
        // Si HAY guidance, el risk va por encima o se omite por falta de espacio.
        if (!guidance) {
          slide.addText(`⚠ ${truncate(stripAgentTags(rec.risks), 160)}`, {
            x: 1.8, y: cy + 2.1, w: cardW - 1.4, h: 0.45,
            fontSize: 10, italic: true, color: COLOR.warning, fontFace: FONT.body,
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
