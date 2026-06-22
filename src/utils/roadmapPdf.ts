/* ============================================================
   Roadmap PDF generator — Álamos Innovación
   ============================================================
   Versión más compacta y ligera del PPT. Genera un PDF A4
   landscape con la misma estructura visual + paleta morada.

   Layout: 11.69" × 8.27" landscape = 297mm × 210mm.
   Ratio similar al PPT (16:9), permite reaprovechar imágenes.
   ============================================================ */

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

import branchSlideUrl from '../assets/pptx/branch-slide.jpg'
import branchWatermarkUrl from '../assets/pptx/branch-watermark.jpg'
import alamosLogoUrl from '../assets/pptx/alamos-logo.png'

/* ---------- Tipos ---------- */

export interface PdfRecommendation {
  callId: string
  title: string
  source: 'EU_PORTAL' | 'BDNS'
  fitScore: number
  reasoning: string
  recommendedMonth: string
  estimatedFundingRange: string
  risks: string
  priorityOrder: number
  applicationGuidance?: string
  expectedStartTRL?: number
  expectedEndTRL?: number
  techLineId?: string | null
}

export interface PdfCallDetail {
  externalId: string
  url?: string
  program?: string
  region?: string
  closeDate?: string
}

export interface GenerateRoadmapPdfArgs {
  customerName: string
  customerLogoBase64?: string
  customerSector?: string
  timeline: 1 | 2 | 3
  recommendations: PdfRecommendation[]
  timelineImageDataUrl?: string
  callDetails?: Record<string, PdfCallDetail>
}

/* ---------- Paleta y constantes (en mm) ---------- */

const COLOR = {
  brand: [92, 53, 143] as [number, number, number],
  brandLight: [167, 139, 201] as [number, number, number],
  brandDark: [61, 30, 102] as [number, number, number],
  brand50: [244, 239, 251] as [number, number, number],
  ink: [26, 19, 37] as [number, number, number],
  text: [59, 51, 70] as [number, number, number],
  muted: [107, 96, 118] as [number, number, number],
  border: [229, 223, 239] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  offWhite: [250, 248, 244] as [number, number, number],
  success: [46, 125, 90] as [number, number, number],
  warning: [168, 120, 15] as [number, number, number],
  euLavanda: [167, 139, 201] as [number, number, number],
  esMorado: [61, 30, 102] as [number, number, number],
}

const PAGE_W = 297   // A4 landscape mm
const PAGE_H = 210
const MARGIN = 14
const CONTENT_W = PAGE_W - 2 * MARGIN

/* ---------- Helpers ---------- */

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

function formatApply(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number)
  const d = new Date(y || 2026, (m || 1) - 1, 1)
  return d.toLocaleString('es-ES', { month: 'long', year: 'numeric' })
}

function sourceLabel(s: 'EU_PORTAL' | 'BDNS'): string {
  return s === 'EU_PORTAL' ? 'EU Portal' : 'BDNS España'
}

/** Pinta el background con watermark + logo + footer en página actual */
function paintContentBackground(
  doc: jsPDF,
  watermarkDataUrl: string,
  logoDataUrl: string,
  pageNum: number,
  totalPages: number,
) {
  // Off-white background
  doc.setFillColor(...COLOR.offWhite)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
  // Watermark sutil (alfa simulada con muy bajo opacity gris)
  doc.addImage(watermarkDataUrl, 'JPEG', 0, 0, PAGE_W, PAGE_H, undefined, 'FAST')
  // Logo Álamos esquina sup. izq.
  doc.addImage(logoDataUrl, 'PNG', MARGIN, 8, 18, 12)
  // Footer
  doc.setFontSize(8)
  doc.setTextColor(...COLOR.muted)
  doc.text('Álamos Innovación · alamosinnovacion.com', MARGIN, PAGE_H - 6)
  doc.text(`${pageNum} / ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 6, { align: 'right' })
}

/** Background tipo cover (branch más visible) */
function paintDividerBackground(doc: jsPDF, branchSlideDataUrl: string) {
  doc.setFillColor(...COLOR.offWhite)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
  doc.addImage(branchSlideDataUrl, 'JPEG', 0, 0, PAGE_W, PAGE_H, undefined, 'FAST')
}

/** Helper: setea texto con color RGB */
function setText(doc: jsPDF, rgb: [number, number, number], size: number, style: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal') {
  doc.setTextColor(...rgb)
  doc.setFontSize(size)
  doc.setFont('helvetica', style)
}

/** Wrap text para que quepa en w; devuelve líneas. */
function wrapLines(doc: jsPDF, text: string, w: number): string[] {
  return doc.splitTextToSize(text, w)
}

/* ============================================================
   Generador principal
   ============================================================ */

export async function generateRoadmapPdf(args: GenerateRoadmapPdfArgs): Promise<void> {
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

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.setProperties({
    title: `Roadmap I+D+i — ${customerName}`,
    author: 'Teresa Álamos',
    creator: 'Álamos Innovación',
  })

  const sorted = [...recommendations].sort((a, b) => b.fitScore - a.fitScore)

  // Calcular total de páginas — pre-estimación, recalculamos en sección 5
  const ROWS_PER_TABLE = 14
  const SUMMARY_PAGES = Math.max(1, Math.ceil(sorted.length / ROWS_PER_TABLE))

  // Pre-empaquetado para conocer cuántas páginas de cards habrá
  const _isDense = (r: PdfRecommendation): boolean => {
    const re = stripAgentTags(r.reasoning || '').length
    const gu = stripAgentTags(r.applicationGuidance || '').length
    const ri = stripAgentTags(r.risks || '').length
    const ti = stripAgentTags(r.title || '').length
    return re > 280 || gu > 220 || ri > 120 || ti > 110
  }
  let _pagesCount = 0
  let _idx = 0
  while (_idx < sorted.length) {
    if (_isDense(sorted[_idx])) { _pagesCount++; _idx++ }
    else if (_idx + 1 < sorted.length && !_isDense(sorted[_idx + 1])) { _pagesCount++; _idx += 2 }
    else { _pagesCount++; _idx++ }
  }
  const CARD_PAGES = _pagesCount
  const totalPages = 1 /*cover*/ + 1 /*about*/ + (timelineImageDataUrl ? 1 : 0) + SUMMARY_PAGES + CARD_PAGES + 1 /*contact*/
  let page = 0

  /* ============================================================
     1 · COVER
     ============================================================ */
  page++
  paintDividerBackground(doc, branchSlide)
  // Logo grande arriba izq
  doc.addImage(alamosLogo, 'PNG', MARGIN, 12, 26, 18)
  // Logo cliente esquina sup derecha
  if (customerLogoBase64) {
    try {
      doc.addImage(customerLogoBase64, 'PNG', PAGE_W - MARGIN - 38, 12, 38, 24, undefined, 'FAST')
    } catch {
      // logo corrupto, ignore
    }
  }
  // Eyebrow
  setText(doc, COLOR.brand, 9, 'bold')
  doc.text('ÁLAMOS INNOVACIÓN  ·  ROADMAP I+D+i', MARGIN, 75)
  // Título grande (2 líneas)
  setText(doc, COLOR.ink, 28, 'bold')
  doc.text('Roadmap estratégico', MARGIN, 95)
  doc.text('de financiación pública', MARGIN, 108)
  // Línea decorativa
  doc.setFillColor(...COLOR.brand)
  doc.rect(MARGIN, 114, 12, 1.2, 'F')
  // Cliente
  setText(doc, COLOR.text, 18, 'bold')
  doc.text(customerName, MARGIN, 130)
  if (customerSector) {
    setText(doc, COLOR.muted, 11, 'italic')
    doc.text(customerSector, MARGIN, 138)
  }
  // Pie info
  setText(doc, COLOR.muted, 9)
  const now = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
  doc.text(
    `Horizonte: ${timeline} ${timeline === 1 ? 'año' : 'años'}   ·   ${sorted.length} recomendaciones   ·   Generado el ${now}`,
    MARGIN, PAGE_H - 12,
  )

  /* ============================================================
     2 · SOBRE ESTE ROADMAP
     ============================================================ */
  page++
  doc.addPage()
  paintContentBackground(doc, branchWatermark, alamosLogo, page, totalPages)

  setText(doc, COLOR.brand, 9, 'bold')
  doc.text('SOBRE ESTE ROADMAP', MARGIN, 35)
  setText(doc, COLOR.ink, 20, 'bold')
  doc.text('Estrategia personalizada de financiación I+D+i', MARGIN, 45)

  setText(doc, COLOR.text, 10)
  const intro = `Este documento contiene una hoja de ruta priorizada de oportunidades de financiación pública (nacional y europea) alineadas con el perfil de ${customerName}, su madurez tecnológica y sus objetivos de innovación. Cada convocatoria ha sido evaluada y puntuada según su encaje real, plazos y probabilidad de éxito.`
  const introLines = wrapLines(doc, intro, CONTENT_W)
  doc.text(introLines, MARGIN, 56)

  // 4 pasos de metodología en grid 2x2
  const steps = [
    { num: '01', title: 'Discovery', desc: 'Mapeo de 500+ convocatorias activas (EU Portal + BDNS España).' },
    { num: '02', title: 'Análisis', desc: 'Lectura semántica del perfil, TRL y líneas tecnológicas.' },
    { num: '03', title: 'Scoring', desc: 'Puntuación multidimensional: encaje, presupuesto, calendario, riesgo.' },
    { num: '04', title: 'Priorización', desc: 'Ordenación temporal y selección de top oportunidades.' },
  ]
  const stepW = (CONTENT_W - 9) / 4
  const stepH = 38
  const stepsY = 85
  steps.forEach((s, i) => {
    const x = MARGIN + i * (stepW + 3)
    // Card
    doc.setFillColor(...COLOR.white)
    doc.setDrawColor(...COLOR.border)
    doc.setLineWidth(0.3)
    doc.rect(x, stepsY, stepW, stepH, 'FD')
    // Border-left
    doc.setFillColor(...COLOR.brand)
    doc.rect(x, stepsY, 1.5, stepH, 'F')
    // Número
    setText(doc, COLOR.brandLight, 22, 'bold')
    doc.text(s.num, x + 5, stepsY + 11)
    // Título
    setText(doc, COLOR.ink, 12, 'bold')
    doc.text(s.title, x + 5, stepsY + 20)
    // Descripción
    setText(doc, COLOR.text, 8)
    const descLines = wrapLines(doc, s.desc, stepW - 10)
    doc.text(descLines, x + 5, stepsY + 26)
  })

  /* ============================================================
     3 · TIMELINE VISUAL
     ============================================================ */
  if (timelineImageDataUrl) {
    page++
    doc.addPage()
    paintContentBackground(doc, branchWatermark, alamosLogo, page, totalPages)
    setText(doc, COLOR.brand, 9, 'bold')
    doc.text('VISIÓN GENERAL', MARGIN, 35)
    setText(doc, COLOR.ink, 20, 'bold')
    doc.text('Línea temporal estratégica', MARGIN, 45)
    // Imagen del timeline (mantener aspect ratio 1140x500 ≈ 2.28)
    const imgW = CONTENT_W
    const imgH = imgW / 2.28
    try {
      doc.addImage(timelineImageDataUrl, 'PNG', MARGIN, 55, imgW, imgH, undefined, 'FAST')
    } catch (err) {
      console.warn('Timeline image embed failed:', err)
    }
  }

  /* ============================================================
     4 · TABLA RESUMEN (paginada si hace falta)
     ============================================================ */
  for (let s = 0; s < SUMMARY_PAGES; s++) {
    page++
    doc.addPage()
    paintContentBackground(doc, branchWatermark, alamosLogo, page, totalPages)

    setText(doc, COLOR.brand, 9, 'bold')
    doc.text('RESUMEN', MARGIN, 35)
    setText(doc, COLOR.ink, 20, 'bold')
    doc.text(
      SUMMARY_PAGES > 1
        ? `Recomendaciones priorizadas (${s + 1}/${SUMMARY_PAGES})`
        : 'Recomendaciones priorizadas',
      MARGIN, 45,
    )

    const chunk = sorted.slice(s * ROWS_PER_TABLE, (s + 1) * ROWS_PER_TABLE)
    autoTable(doc, {
      startY: 55,
      margin: { left: MARGIN, right: MARGIN },
      head: [['#', 'Convocatoria', 'Fuente', 'Fit', 'Cuándo', 'Presupuesto']],
      body: chunk.map(r => [
        `#${r.priorityOrder}`,
        stripAgentTags(r.title).slice(0, 80),
        sourceLabel(r.source),
        `${r.fitScore}`,
        formatApply(r.recommendedMonth),
        r.estimatedFundingRange && r.estimatedFundingRange !== '—' ? r.estimatedFundingRange : '—',
      ]),
      headStyles: {
        fillColor: COLOR.brand,
        textColor: COLOR.white,
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: COLOR.text,
        cellPadding: 2,
      },
      alternateRowStyles: {
        fillColor: COLOR.brand50,
      },
      columnStyles: {
        0: { cellWidth: 12, fontStyle: 'bold', textColor: COLOR.brand },
        1: { cellWidth: 130 },
        2: { cellWidth: 30 },
        3: { cellWidth: 14, halign: 'center' },
        4: { cellWidth: 32 },
        5: { cellWidth: 50 },
      },
      theme: 'grid',
    })
  }

  /* ============================================================
     5 · CARDS DETALLADAS — empaquetado adaptativo
     ============================================================
     Algoritmo: si rec es "densa" (mucho contenido) → 1 sola por
     página con cardH grande (~150mm). Si no → 2 por página con
     cardH normal (75mm). Mismo concepto que el PPT.
     ============================================================ */
  const isDenseCard = (r: PdfRecommendation): boolean => {
    const reasonChars = stripAgentTags(r.reasoning || '').length
    const guidanceChars = stripAgentTags(r.applicationGuidance || '').length
    const riskChars = stripAgentTags(r.risks || '').length
    const titleChars = stripAgentTags(r.title || '').length
    return reasonChars > 280 || guidanceChars > 220 || riskChars > 120 || titleChars > 110
  }
  type CardGroup = { recs: PdfRecommendation[]; mode: 'big' | 'normal' }
  const groups: CardGroup[] = []
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

  const cardsStartY = 32
  const cardGap = 6

  for (const group of groups) {
    page++
    doc.addPage()
    paintContentBackground(doc, branchWatermark, alamosLogo, page, totalPages)
    setText(doc, COLOR.brand, 9, 'bold')
    doc.text('DETALLE DE RECOMENDACIONES', MARGIN, 25)

    const cardH = group.mode === 'big' ? 150 : 75
    group.recs.forEach((rec, idx) => {
      const cy = cardsStartY + idx * (cardH + cardGap)
      paintCard(doc, rec, cy, cardH, callDetails, group.mode === 'big')
    })
  }

  /* ============================================================
     6 · CONTACTO / PRÓXIMOS PASOS
     ============================================================ */
  page++
  doc.addPage()
  paintDividerBackground(doc, branchSlide)
  doc.addImage(alamosLogo, 'PNG', MARGIN, 12, 22, 14)

  setText(doc, COLOR.brand, 11, 'bold')
  doc.text('PRÓXIMOS PASOS', MARGIN, 60)
  setText(doc, COLOR.ink, 28, 'bold')
  doc.text('Convertimos este roadmap', MARGIN, 80)
  doc.text('en propuestas que ganan.', MARGIN, 95)

  setText(doc, COLOR.text, 11)
  const nextSteps = [
    { label: 'Revisión conjunta: ', text: 'Priorizamos juntos las 3-5 convocatorias clave del primer año.' },
    { label: 'Preparación: ', text: 'Cronograma de propuestas y kick-off del primer call.' },
    { label: 'Acompañamiento: ', text: 'Redacción, partners europeos si aplica, y gestión post-concesión.' },
  ]
  let nextY = 115
  nextSteps.forEach(ns => {
    setText(doc, COLOR.brand, 11, 'bold')
    doc.text(ns.label, MARGIN, nextY)
    const labelW = doc.getTextWidth(ns.label)
    setText(doc, COLOR.text, 11)
    doc.text(ns.text, MARGIN + labelW, nextY)
    nextY += 9
  })

  setText(doc, COLOR.brand, 16, 'bold')
  doc.text('Hablemos.', MARGIN, PAGE_H - 35)
  setText(doc, COLOR.text, 10)
  doc.text('Teresa Álamos · Álamos Innovación', MARGIN, PAGE_H - 25)
  doc.text('contacto@alamosinnovacion.com · alamosinnovacion.com', MARGIN, PAGE_H - 18)

  /* ============================================================
     Guardar
     ============================================================ */
  const ts = new Date().toISOString().slice(0, 10)
  const safeName = customerName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  doc.save(`Roadmap-IDi-${safeName}-${ts}.pdf`)
}

/* ============================================================
   paintCard: una recomendación individual en la página detallada
   ============================================================ */

/**
 * Trunca un array de líneas a maxLines, añadiendo elipsis a la última
 * si hubo recorte. Garantiza que el output nunca exceda maxLines.
 */
function truncateLines(lines: string[], maxLines: number): string[] {
  if (lines.length <= maxLines) return lines
  const out = lines.slice(0, maxLines)
  // Añade … al final de la última línea (recorta 1-2 chars si hace falta)
  const last = out[out.length - 1] || ''
  out[out.length - 1] = last.length > 3
    ? last.slice(0, Math.max(0, last.length - 2)) + '…'
    : '…'
  return out
}

function paintCard(
  doc: jsPDF,
  rec: PdfRecommendation,
  cy: number,
  cardH: number,
  callDetails: Record<string, PdfCallDetail>,
  isBig = false,
) {
  const cardW = CONTENT_W
  const cardX = MARGIN

  // Card body
  doc.setFillColor(...COLOR.white)
  doc.setDrawColor(...COLOR.border)
  doc.setLineWidth(0.3)
  doc.rect(cardX, cy, cardW, cardH, 'FD')
  // Border-left morado
  doc.setFillColor(...COLOR.brand)
  doc.rect(cardX, cy, 1.5, cardH, 'F')

  // Priority badge (círculo)
  const badgeX = cardX + 8
  const badgeY = cy + 8
  const badgeR = 5
  doc.setFillColor(...COLOR.brand)
  doc.circle(badgeX, badgeY, badgeR, 'F')
  setText(doc, COLOR.white, 12, 'bold')
  doc.text(`${rec.priorityOrder}`, badgeX, badgeY + 1.5, { align: 'center' })

  // Fit chip a la derecha
  const fitColor = rec.fitScore >= 80 ? COLOR.success : rec.fitScore >= 60 ? COLOR.brand : COLOR.warning
  const fitChipW = 22
  const fitChipH = 8
  const fitChipX = cardX + cardW - fitChipW - 4
  const fitChipY = cy + 4
  doc.setFillColor(...fitColor)
  doc.roundedRect(fitChipX, fitChipY, fitChipW, fitChipH, 1.2, 1.2, 'F')
  setText(doc, COLOR.white, 9, 'bold')
  doc.text(`Fit ${rec.fitScore}`, fitChipX + fitChipW / 2, fitChipY + 5.5, { align: 'center' })

  // Title (entre badge y fit chip) — máx 2 líneas con truncado
  const titleX = cardX + 18
  const titleW = fitChipX - titleX - 3
  setText(doc, COLOR.ink, 11, 'bold')
  const titleLines = truncateLines(wrapLines(doc, stripAgentTags(rec.title), titleW), 2)
  doc.text(titleLines, titleX, cy + 7)

  // Meta line
  const detail = callDetails[rec.callId]
  const metaParts = [
    sourceLabel(rec.source),
    detail?.program,
    detail?.region,
    `Aplicar: ${formatApply(rec.recommendedMonth)}`,
    rec.estimatedFundingRange && rec.estimatedFundingRange !== '—' ? rec.estimatedFundingRange : null,
  ].filter(Boolean).join('  ·  ')
  setText(doc, COLOR.muted, 8.5)
  // Truncar meta a 1 línea
  const metaLines = truncateLines(wrapLines(doc, metaParts, cardW - 22), 1)
  doc.text(metaLines, titleX, cy + 19)

  // TRL bar
  if (rec.expectedStartTRL || rec.expectedEndTRL) {
    const trlText = `TRL ${rec.expectedStartTRL ?? '?'}  >  TRL ${rec.expectedEndTRL ?? '?'}`
    doc.setFillColor(...COLOR.brand50)
    doc.setDrawColor(...COLOR.brand)
    doc.setLineWidth(0.3)
    doc.roundedRect(titleX, cy + 22, 32, 5.5, 0.8, 0.8, 'FD')
    setText(doc, COLOR.brand, 8, 'bold')
    doc.text(trlText, titleX + 16, cy + 25.8, { align: 'center' })
  }

  // Línea separadora
  doc.setDrawColor(...COLOR.border)
  doc.setLineWidth(0.2)
  doc.line(titleX, cy + 31, cardX + cardW - 4, cy + 31)

  /* ─── Budgets verticales por modo ─── */
  // BIG card (cardH=150mm):
  //   reasoning desde y=36 hasta y=80 (44mm = ~12 líneas a 3.5mm)
  //   guidance desde y=85 hasta y=130 (45mm = ~12 líneas)
  //   risk desde y=135 hasta y=145 (10mm = ~3 líneas)
  // NORMAL card (cardH=75mm):
  //   reasoning desde y=36 hasta y=51 (15mm = ~4 líneas)
  //   guidance desde y=53 hasta y=67 (14mm con header 4mm + texto ~3 líneas)
  //   risk en y=71 (1 línea)
  const reasoningY = cy + 36
  const reasoningMaxLines = isBig ? 12 : 4
  const reasoningFontSize = isBig ? 10 : 9
  const reasoningLineH = isBig ? 4 : 3.5

  setText(doc, COLOR.text, reasoningFontSize)
  const reasoningWrapped = wrapLines(doc, stripAgentTags(rec.reasoning), cardW - 22)
  const reasoningLines = truncateLines(reasoningWrapped, reasoningMaxLines)
  doc.text(reasoningLines, titleX, reasoningY, { lineHeightFactor: 1.3 })

  // Guidance — posición depende del modo
  const guidance = rec.applicationGuidance && rec.applicationGuidance.trim()
    ? stripAgentTags(rec.applicationGuidance) : ''

  // Calculamos dinámicamente dónde empieza el guidance basado en cuánto
  // ocupó el reasoning realmente
  const reasoningUsedH = reasoningLines.length * reasoningLineH + 2
  const guidanceY = isBig
    ? reasoningY + reasoningUsedH + 6   // gap 6mm en big
    : cy + 52                            // posición fija en normal

  if (guidance) {
    const guidanceH = isBig ? Math.min(45, cardH - (guidanceY - cy) - 16) : 18
    const guidanceTextLineH = isBig ? 4 : 3.5
    const guidanceFontSize = isBig ? 10 : 9
    // Líneas que caben SEGURO dentro del rectángulo (descontando label arriba)
    const guidanceTextH = guidanceH - (isBig ? 8 : 5)
    const guidanceMaxLines = Math.max(1, Math.floor(guidanceTextH / guidanceTextLineH))

    doc.setFillColor(...COLOR.brand50)
    doc.rect(titleX, guidanceY, cardW - 22, guidanceH, 'F')
    doc.setFillColor(...COLOR.brand)
    doc.rect(titleX, guidanceY, 1, guidanceH, 'F')

    setText(doc, COLOR.brand, 7, 'bold')
    doc.text('CÓMO ORIENTAR LA SOLICITUD', titleX + 3, guidanceY + 4)

    setText(doc, COLOR.text, guidanceFontSize, 'italic')
    const guidanceLines = truncateLines(wrapLines(doc, guidance, cardW - 25), guidanceMaxLines)
    doc.text(guidanceLines, titleX + 3, guidanceY + (isBig ? 9 : 8), { lineHeightFactor: 1.25 })
  }

  // Risk al pie — dentro del cardBottom estricto
  if (rec.risks && rec.risks !== '—' && rec.risks.trim()) {
    const riskY = isBig
      ? cy + cardH - 8     // 8mm desde el bottom de la card
      : cy + cardH - 4
    const riskMaxLines = isBig ? 2 : 1
    setText(doc, COLOR.warning, isBig ? 9 : 8, 'italic')
    const riskWrapped = wrapLines(doc, `[!]  ${stripAgentTags(rec.risks)}`, cardW - 22)
    const riskLines = truncateLines(riskWrapped, riskMaxLines)
    doc.text(riskLines, titleX, riskY)
  }
}
