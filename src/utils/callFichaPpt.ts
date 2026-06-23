/* ============================================================
   Call Ficha PPT generator — branding Álamos Innovación
   ============================================================
   Genera una ficha comercial en PowerPoint para una convocatoria,
   con la identidad visual de Álamos (paleta morado/off-white,
   tipografía Calibri, logo, watermark sutil). Pensada para enviar
   a clientes o publicar en web/blog.
   ============================================================ */

import PptxGenJS from 'pptxgenjs'

// Assets del template Álamos (importados como URLs vía Vite)
import branchSlideUrl from '../assets/pptx/branch-slide.jpg'
import branchWatermarkUrl from '../assets/pptx/branch-watermark.jpg'
import alamosLogoUrl from '../assets/pptx/alamos-logo.png'

import type { CallFicha } from '../components/CallFichaModal'

/* ---------- Paleta Álamos ---------- */

const COLOR = {
  brand: '5C358F',
  brandLight: 'A78BC9',
  brandDark: '3D1E66',
  brand50: 'F4EFFB',
  brand100: 'EADBF4',
  ink: '1A1325',
  text: '3B3346',
  muted: '6B6076',
  border: 'E5DFEF',
  white: 'FFFFFF',
  offWhite: 'FAF8F4',
  success: '2E7D5A',
  warning: 'A8780F',
  errorRed: 'C44343',
}

const FONT = {
  heading: 'Calibri',
  body: 'Calibri',
}

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

function truncate(s: string, max: number): string {
  if (!s) return ''
  return s.length > max ? s.slice(0, max - 1).trim() + '…' : s
}

function safe(s: string | undefined | null): string {
  return (s ?? '').toString().trim()
}

function safeArr(a: unknown): string[] {
  if (!Array.isArray(a)) return []
  return a.map(x => safe(String(x))).filter(Boolean)
}

/* ---------- Layouts comunes ---------- */

function paintContentBackground(
  slide: PptxGenJS.Slide,
  watermarkDataUrl: string,
  logoDataUrl: string,
  pageNum: number,
  totalPages: number,
) {
  slide.background = { color: COLOR.offWhite }
  slide.addImage({
    data: watermarkDataUrl,
    x: 0, y: 0, w: 13.333, h: 7.5,
    transparency: 60,
  })
  slide.addImage({
    data: logoDataUrl,
    x: 0.4, y: 0.3, w: 0.85, h: 0.6,
  })
  slide.addText('Álamos Innovación · alamosinnovacion.com', {
    x: 0.4, y: 7.1, w: 8, h: 0.3,
    fontSize: 9, color: COLOR.muted, fontFace: FONT.body,
  })
  slide.addText(`${pageNum} / ${totalPages}`, {
    x: 12.4, y: 7.1, w: 0.5, h: 0.3,
    fontSize: 9, color: COLOR.muted, align: 'right', fontFace: FONT.body,
  })
}

function paintDividerBackground(slide: PptxGenJS.Slide, branchSlideDataUrl: string) {
  slide.background = { color: COLOR.offWhite }
  slide.addImage({
    data: branchSlideDataUrl,
    x: 0, y: 0, w: 13.333, h: 7.5,
  })
}

function addSectionHeader(
  slide: PptxGenJS.Slide,
  eyebrow: string,
  title: string,
) {
  slide.addText(eyebrow, {
    x: 0.6, y: 1.0, w: 9, h: 0.35,
    fontSize: 11, bold: true, color: COLOR.brand, fontFace: FONT.heading,
    charSpacing: 3,
  })
  slide.addText(title, {
    x: 0.6, y: 1.35, w: 12, h: 0.75,
    fontSize: 28, bold: true, color: COLOR.ink, fontFace: FONT.heading,
  })
  // Línea morada decorativa bajo el título
  slide.addShape('rect' as PptxGenJS.ShapeType, {
    x: 0.6, y: 2.05, w: 0.7, h: 0.06,
    fill: { color: COLOR.brand }, line: { color: COLOR.brand },
  })
}

function addBulletList(
  slide: PptxGenJS.Slide,
  items: string[],
  opts: {
    x: number; y: number; w: number; h: number;
    fontSize?: number; color?: string;
    bulletColor?: string;
  },
) {
  const { x, y, w, h, fontSize = 12, color = COLOR.text, bulletColor = COLOR.brand } = opts
  if (items.length === 0) return
  // pptxgenjs soporta bullets nativos; usamos lista de runs
  const textRuns = items.map((it, i) => ({
    text: truncate(it, 220),
    options: {
      fontSize, color, fontFace: FONT.body,
      bullet: { type: 'bullet' as const, code: '25CF', indent: 18, color: bulletColor },
      paraSpaceAfter: 4,
      breakLine: i < items.length - 1,
    },
  }))
  slide.addText(textRuns, {
    x, y, w, h,
    valign: 'top',
    lineSpacingMultiple: 1.25,
  })
}

function fieldBlock(
  slide: PptxGenJS.Slide,
  label: string,
  value: string,
  opts: { x: number; y: number; w: number; h: number },
) {
  const { x, y, w, h } = opts
  slide.addShape('rect' as PptxGenJS.ShapeType, {
    x, y, w, h,
    fill: { color: COLOR.white },
    line: { color: COLOR.border, width: 0.75 },
  })
  // Borde-izquierdo morado
  slide.addShape('rect' as PptxGenJS.ShapeType, {
    x, y, w: 0.07, h,
    fill: { color: COLOR.brand }, line: { color: COLOR.brand },
  })
  slide.addText(label, {
    x: x + 0.22, y: y + 0.12, w: w - 0.3, h: 0.3,
    fontSize: 9, bold: true, color: COLOR.brand, fontFace: FONT.heading,
    charSpacing: 2,
  })
  slide.addText(value || '—', {
    x: x + 0.22, y: y + 0.45, w: w - 0.3, h: h - 0.55,
    fontSize: 12, color: COLOR.ink, fontFace: FONT.body,
    valign: 'top', lineSpacingMultiple: 1.25,
  })
}

/* ============================================================
   Generador principal
   ============================================================ */

export async function generateCallFichaPpt(ficha: CallFicha): Promise<void> {
  // Pre-carga assets
  const [branchSlide, branchWatermark, alamosLogo] = await Promise.all([
    urlToDataUrl(branchSlideUrl),
    urlToDataUrl(branchWatermarkUrl),
    urlToDataUrl(alamosLogoUrl),
  ])

  const pres = new PptxGenJS()
  pres.layout = 'LAYOUT_WIDE'
  pres.title = `Ficha — ${safe(ficha.title)}`
  pres.company = 'Álamos Innovación'
  pres.author = 'Teresa Álamos'

  // Calculamos slides condicionales para el total
  const hasCriteria = (ficha.evaluationCriteria?.criteria || []).length > 0
  const hasCommentary = safe(ficha.alamosCommentary).length > 0
  const hasNovelties = safeArr(ficha.novelties).length > 0
  const hasUrls = Object.values(ficha.sourceUrls || {}).some(u => safe(u).length > 0)

  const totalPages =
    1 + // cover
    1 + // sobre la call
    1 + // plazos + beneficiarios
    1 + // características proyecto
    1 + // características ayuda
    1 + // costes
    (hasCriteria ? 1 : 0) +
    (hasCommentary || hasNovelties ? 1 : 0) +
    (hasUrls ? 1 : 0) +
    1   // cierre

  let page = 0

  /* ============================================================
     1 · COVER
     ============================================================ */
  page++
  {
    const slide = pres.addSlide()
    paintDividerBackground(slide, branchSlide)

    // Logo Álamos
    slide.addImage({ data: alamosLogo, x: 0.4, y: 0.3, w: 1.1, h: 0.78 })

    // Eyebrow
    slide.addText('ÁLAMOS INNOVACIÓN · FICHA DE CONVOCATORIA', {
      x: 0.6, y: 2.3, w: 9, h: 0.35,
      fontSize: 12, bold: true, color: COLOR.brand, fontFace: FONT.heading,
      charSpacing: 4,
    })

    // Título principal
    slide.addText(safe(ficha.title) || 'Convocatoria', {
      x: 0.6, y: 2.7, w: 11, h: 1.6,
      fontSize: 44, bold: true, color: COLOR.ink, fontFace: FONT.heading,
      lineSpacingMultiple: 1.05,
    })

    // Línea decorativa
    slide.addShape('rect' as PptxGenJS.ShapeType, {
      x: 0.6, y: 4.5, w: 0.7, h: 0.06,
      fill: { color: COLOR.brand }, line: { color: COLOR.brand },
    })

    // Subtítulo
    if (safe(ficha.subtitle)) {
      slide.addText(safe(ficha.subtitle), {
        x: 0.6, y: 4.7, w: 11, h: 0.7,
        fontSize: 18, italic: true, color: COLOR.brand, fontFace: FONT.heading,
      })
    }

    // Organism + year
    const orgLine = [safe(ficha.organism), safe(ficha.year) && `Convocatoria ${safe(ficha.year)}`]
      .filter(Boolean).join(' · ')
    slide.addText(orgLine, {
      x: 0.6, y: 5.4, w: 11, h: 0.5,
      fontSize: 16, color: COLOR.text, fontFace: FONT.body,
    })

    // Pill: presupuesto
    if (safe(ficha.callBudget)) {
      slide.addShape('roundRect' as PptxGenJS.ShapeType, {
        x: 0.6, y: 6.05, w: 4.5, h: 0.55,
        fill: { color: COLOR.brand },
        line: { color: COLOR.brand },
        rectRadius: 0.27,
      })
      slide.addText(`Presupuesto: ${safe(ficha.callBudget)}`, {
        x: 0.6, y: 6.05, w: 4.5, h: 0.55,
        fontSize: 13, bold: true, color: COLOR.white, fontFace: FONT.heading,
        align: 'center', valign: 'middle',
      })
    }

    // Footer-info
    const now = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    slide.addText(`Ficha generada el ${now} · Álamos Innovación`, {
      x: 0.6, y: 6.9, w: 11, h: 0.4,
      fontSize: 10, color: COLOR.muted, fontFace: FONT.body,
    })
  }

  /* ============================================================
     2 · SOBRE LA CONVOCATORIA
     ============================================================ */
  page++
  {
    const slide = pres.addSlide()
    paintContentBackground(slide, branchWatermark, alamosLogo, page, totalPages)
    addSectionHeader(slide, '01 · OBJETO', 'Sobre esta convocatoria')

    // Texto principal — objeto
    slide.addText(safe(ficha.aboutCall) || '—', {
      x: 0.6, y: 2.4, w: 12.2, h: 2.2,
      fontSize: 14, color: COLOR.text, fontFace: FONT.body,
      lineSpacingMultiple: 1.4, valign: 'top',
    })

    // Áreas temáticas (chips)
    const areas = safeArr(ficha.thematicAreas).slice(0, 14)
    if (areas.length > 0) {
      slide.addText('ÁREAS / SECTORES PRIORITARIOS', {
        x: 0.6, y: 4.85, w: 12, h: 0.3,
        fontSize: 10, bold: true, color: COLOR.brand, fontFace: FONT.heading,
        charSpacing: 3,
      })
      // Chips
      const chipH = 0.4
      const startY = 5.2
      let curX = 0.6
      let curY = startY
      const maxX = 12.9
      areas.forEach(a => {
        const label = truncate(a, 60)
        const estW = Math.min(4.2, 0.18 + label.length * 0.12) // estimación ancho
        if (curX + estW > maxX) {
          curX = 0.6
          curY += chipH + 0.12
        }
        slide.addShape('roundRect' as PptxGenJS.ShapeType, {
          x: curX, y: curY, w: estW, h: chipH,
          fill: { color: COLOR.brand100 },
          line: { color: COLOR.brand100 },
          rectRadius: 0.2,
        })
        slide.addText(label, {
          x: curX, y: curY, w: estW, h: chipH,
          fontSize: 10, color: COLOR.brandDark, fontFace: FONT.body,
          align: 'center', valign: 'middle',
        })
        curX += estW + 0.12
      })
    }

    // Footer: marco legal + régimen
    const metaParts = [
      safe(ficha.legalFramework) && `Marco: ${safe(ficha.legalFramework)}`,
      safe(ficha.regime) && `Régimen: ${safe(ficha.regime)}`,
      safe(ficha.managingEntity) && `Gestor: ${safe(ficha.managingEntity)}`,
    ].filter(Boolean).join(' · ')
    if (metaParts) {
      slide.addText(metaParts, {
        x: 0.6, y: 6.75, w: 12, h: 0.3,
        fontSize: 9, italic: true, color: COLOR.muted, fontFace: FONT.body,
      })
    }
  }

  /* ============================================================
     3 · PLAZOS Y BENEFICIARIOS
     ============================================================ */
  page++
  {
    const slide = pres.addSlide()
    paintContentBackground(slide, branchWatermark, alamosLogo, page, totalPages)
    addSectionHeader(slide, '02 · PLAZOS Y BENEFICIARIOS', 'Quién puede aplicar y cuándo')

    // Bloque Plazos (izquierda)
    fieldBlock(slide, 'PLAZO DE PRESENTACIÓN', safe(ficha.submissionPeriod), {
      x: 0.6, y: 2.4, w: 5.6, h: 1.4,
    })

    // Beneficiarios (derecha)
    const beneficiaries = safeArr(ficha.beneficiaries).slice(0, 8)
    slide.addShape('rect' as PptxGenJS.ShapeType, {
      x: 6.7, y: 2.4, w: 6.1, h: 4.3,
      fill: { color: COLOR.white },
      line: { color: COLOR.border, width: 0.75 },
    })
    slide.addShape('rect' as PptxGenJS.ShapeType, {
      x: 6.7, y: 2.4, w: 0.07, h: 4.3,
      fill: { color: COLOR.brand }, line: { color: COLOR.brand },
    })
    slide.addText('BENEFICIARIOS ELEGIBLES', {
      x: 6.92, y: 2.5, w: 5.8, h: 0.3,
      fontSize: 10, bold: true, color: COLOR.brand, fontFace: FONT.heading,
      charSpacing: 2,
    })
    if (beneficiaries.length > 0) {
      addBulletList(slide, beneficiaries, {
        x: 6.92, y: 2.85, w: 5.8, h: 3.7,
        fontSize: 11, color: COLOR.text,
      })
    } else {
      slide.addText('—', {
        x: 6.92, y: 2.85, w: 5.8, h: 0.4,
        fontSize: 12, color: COLOR.muted, fontFace: FONT.body,
      })
    }

    // Bloque "No elegibles" (debajo del plazo, izquierda)
    const excluded = safeArr(ficha.excludedBeneficiaries).slice(0, 6)
    slide.addShape('rect' as PptxGenJS.ShapeType, {
      x: 0.6, y: 3.95, w: 5.6, h: 2.75,
      fill: { color: COLOR.brand50 },
      line: { color: COLOR.border, width: 0.5 },
    })
    slide.addText('NO ELEGIBLES (excepciones)', {
      x: 0.8, y: 4.05, w: 5.3, h: 0.3,
      fontSize: 10, bold: true, color: COLOR.brandDark, fontFace: FONT.heading,
      charSpacing: 2,
    })
    if (excluded.length > 0) {
      addBulletList(slide, excluded, {
        x: 0.8, y: 4.4, w: 5.3, h: 2.2,
        fontSize: 10, color: COLOR.text, bulletColor: COLOR.brandDark,
      })
    } else {
      slide.addText('No se especifican exclusiones particulares.', {
        x: 0.8, y: 4.4, w: 5.3, h: 0.4,
        fontSize: 10, italic: true, color: COLOR.muted, fontFace: FONT.body,
      })
    }
  }

  /* ============================================================
     4 · CARACTERÍSTICAS DEL PROYECTO
     ============================================================ */
  page++
  {
    const slide = pres.addSlide()
    paintContentBackground(slide, branchWatermark, alamosLogo, page, totalPages)
    addSectionHeader(slide, '03 · PROYECTO', 'Características del proyecto')

    const pf = ficha.projectFeatures || {} as CallFicha['projectFeatures']

    // Grid 3x2 con campos del proyecto
    const cardW = 4.05, cardH = 1.55, gap = 0.2
    const startX = 0.6, startY = 2.4
    const fields = [
      { label: 'DURACIÓN', value: safe(pf.duration) },
      { label: 'PRESUPUESTO MÍN.', value: safe(pf.budgetMin) },
      { label: 'PRESUPUESTO MÁX.', value: safe(pf.budgetMax) },
      { label: 'CONSORCIO', value: safe(pf.consortium) },
      { label: 'ÁMBITO GEOGRÁFICO', value: safe(pf.geographic) },
      { label: 'TRL OBJETIVO', value: safe(pf.trl) },
    ]
    fields.forEach((f, i) => {
      const col = i % 3
      const row = Math.floor(i / 3)
      const x = startX + col * (cardW + gap)
      const y = startY + row * (cardH + 0.2)
      fieldBlock(slide, f.label, f.value, { x, y, w: cardW, h: cardH })
    })

    // Nota inferior
    slide.addText('Datos extraídos de la convocatoria oficial. Verificar versiones definitivas en el BOE.', {
      x: 0.6, y: 6.45, w: 12, h: 0.35,
      fontSize: 9, italic: true, color: COLOR.muted, fontFace: FONT.body,
    })
  }

  /* ============================================================
     5 · CARACTERÍSTICAS DE LA AYUDA
     ============================================================ */
  page++
  {
    const slide = pres.addSlide()
    paintContentBackground(slide, branchWatermark, alamosLogo, page, totalPages)
    addSectionHeader(slide, '04 · AYUDA', 'Cuánto y cómo se financia')

    const af = ficha.aidFeatures || {} as CallFicha['aidFeatures']

    // Tipo de ayuda — destaque
    slide.addShape('roundRect' as PptxGenJS.ShapeType, {
      x: 0.6, y: 2.4, w: 12.2, h: 1.1,
      fill: { color: COLOR.brand },
      line: { color: COLOR.brand },
      rectRadius: 0.1,
    })
    slide.addText('TIPO DE AYUDA', {
      x: 0.85, y: 2.5, w: 11.5, h: 0.3,
      fontSize: 10, bold: true, color: COLOR.brand100, fontFace: FONT.heading,
      charSpacing: 3,
    })
    slide.addText(safe(af.type) || '—', {
      x: 0.85, y: 2.8, w: 11.5, h: 0.65,
      fontSize: 22, bold: true, color: COLOR.white, fontFace: FONT.heading,
    })

    // Grid 2x2 con detalles
    const cardW = 5.9, cardH = 1.45, gap = 0.4
    const startX = 0.6, startY = 3.85
    const fields = [
      { label: 'INTENSIDAD MÁX.', value: safe(af.intensity) },
      { label: 'IMPORTE MÁXIMO', value: safe(af.maxAmount) },
      { label: 'IMPORTE MÍNIMO', value: safe(af.minAmount) },
      { label: 'ANTICIPO', value: safe(af.advancePayment) },
    ]
    fields.forEach((f, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const x = startX + col * (cardW + gap)
      const y = startY + row * (cardH + 0.2)
      fieldBlock(slide, f.label, f.value, { x, y, w: cardW, h: cardH })
    })

    // Garantías como nota si las hay
    if (safe(ficha.guarantees)) {
      slide.addText(`Garantías: ${truncate(safe(ficha.guarantees), 240)}`, {
        x: 0.6, y: 6.55, w: 12.2, h: 0.45,
        fontSize: 10, italic: true, color: COLOR.brandDark, fontFace: FONT.body,
      })
    }
  }

  /* ============================================================
     6 · COSTES (elegibles vs no elegibles)
     ============================================================ */
  page++
  {
    const slide = pres.addSlide()
    paintContentBackground(slide, branchWatermark, alamosLogo, page, totalPages)
    addSectionHeader(slide, '05 · COSTES', 'Qué se financia (y qué no)')

    const eligible = safeArr(ficha.eligibleCosts).slice(0, 10)
    const notEligible = safeArr(ficha.nonEligibleCosts).slice(0, 8)

    // Columna izquierda: elegibles
    slide.addShape('rect' as PptxGenJS.ShapeType, {
      x: 0.6, y: 2.4, w: 6.0, h: 4.3,
      fill: { color: COLOR.white },
      line: { color: COLOR.border, width: 0.75 },
    })
    slide.addShape('rect' as PptxGenJS.ShapeType, {
      x: 0.6, y: 2.4, w: 0.07, h: 4.3,
      fill: { color: COLOR.success }, line: { color: COLOR.success },
    })
    slide.addText('COSTES ELEGIBLES', {
      x: 0.82, y: 2.5, w: 5.7, h: 0.3,
      fontSize: 11, bold: true, color: COLOR.success, fontFace: FONT.heading,
      charSpacing: 2,
    })
    if (eligible.length > 0) {
      addBulletList(slide, eligible, {
        x: 0.82, y: 2.9, w: 5.7, h: 3.7,
        fontSize: 11, color: COLOR.text, bulletColor: COLOR.success,
      })
    } else {
      slide.addText('Consultar bases oficiales.', {
        x: 0.82, y: 2.9, w: 5.7, h: 0.4,
        fontSize: 10, italic: true, color: COLOR.muted, fontFace: FONT.body,
      })
    }

    // Columna derecha: no elegibles
    slide.addShape('rect' as PptxGenJS.ShapeType, {
      x: 6.9, y: 2.4, w: 5.9, h: 4.3,
      fill: { color: COLOR.white },
      line: { color: COLOR.border, width: 0.75 },
    })
    slide.addShape('rect' as PptxGenJS.ShapeType, {
      x: 6.9, y: 2.4, w: 0.07, h: 4.3,
      fill: { color: COLOR.errorRed }, line: { color: COLOR.errorRed },
    })
    slide.addText('NO FINANCIABLES', {
      x: 7.12, y: 2.5, w: 5.6, h: 0.3,
      fontSize: 11, bold: true, color: COLOR.errorRed, fontFace: FONT.heading,
      charSpacing: 2,
    })
    if (notEligible.length > 0) {
      addBulletList(slide, notEligible, {
        x: 7.12, y: 2.9, w: 5.6, h: 3.7,
        fontSize: 11, color: COLOR.text, bulletColor: COLOR.errorRed,
      })
    } else {
      slide.addText('No se especifican exclusiones particulares.', {
        x: 7.12, y: 2.9, w: 5.6, h: 0.4,
        fontSize: 10, italic: true, color: COLOR.muted, fontFace: FONT.body,
      })
    }

    // Pago de la ayuda
    if (safe(ficha.payment)) {
      slide.addText(`💰 Pago: ${truncate(safe(ficha.payment), 280)}`, {
        x: 0.6, y: 6.8, w: 12.2, h: 0.3,
        fontSize: 9, italic: true, color: COLOR.muted, fontFace: FONT.body,
      })
    }
  }

  /* ============================================================
     7 · CRITERIOS DE VALORACIÓN (condicional)
     ============================================================ */
  if (hasCriteria) {
    page++
    const slide = pres.addSlide()
    paintContentBackground(slide, branchWatermark, alamosLogo, page, totalPages)
    addSectionHeader(slide, '06 · EVALUACIÓN', 'Criterios de valoración')

    const criteria = ficha.evaluationCriteria.criteria.slice(0, 8)
    const minScore = safe(ficha.evaluationCriteria.minScore)

    if (minScore) {
      slide.addShape('roundRect' as PptxGenJS.ShapeType, {
        x: 0.6, y: 2.4, w: 5.0, h: 0.65,
        fill: { color: COLOR.brand50 },
        line: { color: COLOR.brand100 },
        rectRadius: 0.1,
      })
      slide.addText(`Mínimo para ser financiable: ${minScore}`, {
        x: 0.85, y: 2.4, w: 4.7, h: 0.65,
        fontSize: 12, bold: true, color: COLOR.brand, fontFace: FONT.heading,
        valign: 'middle',
      })
    }

    // Tabla de criterios
    const headerRow = [
      { text: 'Criterio', options: { bold: true, color: COLOR.white, fill: { color: COLOR.brand }, fontSize: 11, fontFace: FONT.heading } },
      { text: 'Peso', options: { bold: true, color: COLOR.white, fill: { color: COLOR.brand }, fontSize: 11, fontFace: FONT.heading, align: 'center' as const } },
      { text: 'Descripción', options: { bold: true, color: COLOR.white, fill: { color: COLOR.brand }, fontSize: 11, fontFace: FONT.heading } },
    ]
    const rows = criteria.map((c, idx) => [
      { text: truncate(safe(c.name), 80), options: { fontSize: 10, color: COLOR.ink, fontFace: FONT.body, fill: { color: idx % 2 === 0 ? COLOR.white : COLOR.brand50 } } },
      { text: safe(c.weight) || '—', options: { fontSize: 10, color: COLOR.brandDark, fontFace: FONT.body, bold: true, align: 'center' as const, fill: { color: idx % 2 === 0 ? COLOR.white : COLOR.brand50 } } },
      { text: truncate(safe(c.description), 180), options: { fontSize: 10, color: COLOR.text, fontFace: FONT.body, fill: { color: idx % 2 === 0 ? COLOR.white : COLOR.brand50 } } },
    ])

    slide.addTable([headerRow, ...rows], {
      x: 0.6, y: 3.25, w: 12.2,
      colW: [3.5, 1.2, 7.5],
      border: { type: 'solid', pt: 0.5, color: COLOR.border },
      autoPage: false,
    })
  }

  /* ============================================================
     8 · COMENTARIO ÁLAMOS + NOVEDADES (condicional)
     ============================================================ */
  if (hasCommentary || hasNovelties) {
    page++
    const slide = pres.addSlide()
    paintContentBackground(slide, branchWatermark, alamosLogo, page, totalPages)
    addSectionHeader(slide, '07 · ANÁLISIS', 'Comentario Álamos')

    let cursorY = 2.4

    if (hasCommentary) {
      // Cita destacada
      slide.addShape('rect' as PptxGenJS.ShapeType, {
        x: 0.6, y: cursorY, w: 12.2, h: 2.0,
        fill: { color: COLOR.brand },
        line: { color: COLOR.brand },
      })
      slide.addText('« ' + truncate(safe(ficha.alamosCommentary), 500) + ' »', {
        x: 0.95, y: cursorY + 0.15, w: 11.5, h: 1.7,
        fontSize: 15, italic: true, color: COLOR.white, fontFace: FONT.heading,
        lineSpacingMultiple: 1.35, valign: 'middle',
      })
      slide.addText('— Teresa Álamos · Álamos Innovación', {
        x: 0.95, y: cursorY + 1.65, w: 11.5, h: 0.3,
        fontSize: 10, italic: true, color: COLOR.brand100, fontFace: FONT.body,
      })
      cursorY += 2.3
    }

    if (hasNovelties) {
      const novelties = safeArr(ficha.novelties).slice(0, 6)
      slide.addText('NOVEDADES Y PARTICULARIDADES', {
        x: 0.6, y: cursorY, w: 12, h: 0.3,
        fontSize: 11, bold: true, color: COLOR.brand, fontFace: FONT.heading,
        charSpacing: 2,
      })
      cursorY += 0.35
      addBulletList(slide, novelties, {
        x: 0.6, y: cursorY, w: 12.2, h: 6.8 - cursorY,
        fontSize: 12, color: COLOR.text,
      })
    }
  }

  /* ============================================================
     9 · FUENTES Y ENLACES (condicional)
     ============================================================ */
  if (hasUrls) {
    page++
    const slide = pres.addSlide()
    paintContentBackground(slide, branchWatermark, alamosLogo, page, totalPages)
    addSectionHeader(slide, '08 · FUENTES', 'Documentación oficial')

    const urls = ficha.sourceUrls || {} as CallFicha['sourceUrls']
    const items: Array<{ label: string; url: string }> = [
      { label: 'Orden de bases (BOE)', url: safe(urls.legalBasis) },
      { label: 'Resolución de convocatoria', url: safe(urls.callOrder) },
      { label: 'Web del programa', url: safe(urls.programWeb) },
      { label: 'Guía del solicitante', url: safe(urls.applicationGuide) },
    ].filter(x => x.url.length > 0)

    let y = 2.4
    items.forEach(item => {
      slide.addShape('rect' as PptxGenJS.ShapeType, {
        x: 0.6, y, w: 12.2, h: 0.85,
        fill: { color: COLOR.white },
        line: { color: COLOR.border, width: 0.5 },
      })
      slide.addShape('rect' as PptxGenJS.ShapeType, {
        x: 0.6, y, w: 0.07, h: 0.85,
        fill: { color: COLOR.brand }, line: { color: COLOR.brand },
      })
      slide.addText(item.label, {
        x: 0.82, y: y + 0.1, w: 11.5, h: 0.3,
        fontSize: 11, bold: true, color: COLOR.brand, fontFace: FONT.heading,
      })
      slide.addText(item.url, {
        x: 0.82, y: y + 0.4, w: 11.5, h: 0.4,
        fontSize: 10, color: COLOR.brandDark, fontFace: FONT.body,
        hyperlink: { url: item.url },
      })
      y += 1.0
    })
  }

  /* ============================================================
     10 · CIERRE / CONTACTO ÁLAMOS
     ============================================================ */
  page++
  {
    const slide = pres.addSlide()
    paintDividerBackground(slide, branchSlide)

    slide.addImage({ data: alamosLogo, x: 0.4, y: 0.3, w: 1.1, h: 0.78 })

    slide.addText('¿Encaja con vuestro proyecto?', {
      x: 0.6, y: 2.3, w: 12, h: 0.95,
      fontSize: 36, bold: true, color: COLOR.ink, fontFace: FONT.heading,
    })

    slide.addText(
      'En Álamos Innovación analizamos en profundidad cada convocatoria y diseñamos propuestas competitivas. Más de 20 años de experiencia y +100M€ movilizados.',
      {
        x: 0.6, y: 3.3, w: 11.5, h: 1.4,
        fontSize: 16, color: COLOR.text, fontFace: FONT.body,
        lineSpacingMultiple: 1.4,
      },
    )

    // Línea decorativa
    slide.addShape('rect' as PptxGenJS.ShapeType, {
      x: 0.6, y: 5.0, w: 0.7, h: 0.06,
      fill: { color: COLOR.brand }, line: { color: COLOR.brand },
    })

    slide.addText('Teresa Álamos · Álamos Innovación', {
      x: 0.6, y: 5.15, w: 12, h: 0.5,
      fontSize: 18, bold: true, color: COLOR.brand, fontFace: FONT.heading,
    })
    slide.addText([
      { text: 'contacto@alamosinnovacion.com', options: { fontSize: 14, color: COLOR.ink, fontFace: FONT.body, breakLine: true, hyperlink: { url: 'mailto:contacto@alamosinnovacion.com' } } },
      { text: 'alamosinnovacion.com', options: { fontSize: 14, color: COLOR.ink, fontFace: FONT.body, breakLine: true, hyperlink: { url: 'https://alamosinnovacion.com' } } },
      { text: 'linkedin.com/in/teresaalamos', options: { fontSize: 14, color: COLOR.ink, fontFace: FONT.body, hyperlink: { url: 'https://linkedin.com/in/teresaalamos' } } },
    ], {
      x: 0.6, y: 5.65, w: 12, h: 1.3,
      lineSpacingMultiple: 1.3,
    })

    slide.addText('Álamos Innovación SL · CIF B90311739 · Registro Mercantil de Sevilla · Tomo 6346 · Folio 107 · Hoja SE-113138', {
      x: 0.6, y: 7.1, w: 12, h: 0.3,
      fontSize: 8, color: COLOR.muted, fontFace: FONT.body,
    })
  }

  /* ============================================================
     DESCARGA
     ============================================================ */
  const safeTitle = (safe(ficha.title) || 'Ficha').replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_').slice(0, 60)
  const fname = `Ficha_${safeTitle}_${safe(ficha.year) || new Date().getFullYear()}.pptx`
  await pres.writeFile({ fileName: fname })
}
