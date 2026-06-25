/* ============================================================
   Proposal Ideas — generador Word con formato de plantilla Álamos
   ============================================================
   Replica la estructura de Plantilla_Propuesta.docx:
   portada + índice + 10 secciones numeradas, con tablas formateadas
   y la paleta corporativa (morado #5C358F, gris #888, oscuro #1A1A1A).
   ============================================================ */

import type { ProposalIdea } from '../components/ProposalIdeasModal'

const BRAND_PURPLE = '#5C358F'
const TEXT_DARK = '#1A1A1A'
const TEXT_MUTED = '#888888'
const TEXT_DEEP = '#555555'

function esc(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br/>')
}

function trlLabel(trl: number): string {
  const labels: Record<number, string> = {
    1: 'Principios básicos observados',
    2: 'Concepto tecnológico formulado',
    3: 'Prueba de concepto',
    4: 'Validación en laboratorio',
    5: 'Validación en entorno relevante',
    6: 'Demostración en entorno relevante (prototipo)',
    7: 'Demostración en entorno operacional',
    8: 'Sistema completo y cualificado',
    9: 'Sistema probado en entorno real',
  }
  return labels[trl] || ''
}

/** Deriva 4 fases de trabajo a partir de la duración del proyecto */
function derivePhases(durationMonths: number, wps: ProposalIdea['workPackages']) {
  // Estructura clásica de propuesta: 4 fases
  // Si hay WPs definidos, las primeras 4 fases reflejan los primeros 4 WPs
  if (wps.length >= 4) {
    const monthsPerWp = Math.max(1, Math.round(durationMonths / wps.length))
    return wps.slice(0, 4).map((wp, i) => ({
      n: i + 1,
      name: wp.name || `WP${i + 1}`,
      duration: `Meses ${i * monthsPerWp + 1}-${(i + 1) * monthsPerWp}`,
    }))
  }
  // Fallback genérico
  const q = Math.max(1, Math.round(durationMonths / 4))
  return [
    { n: 1, name: 'Análisis inicial y alineación de objetivos', duration: `Meses 1-${q}` },
    { n: 2, name: 'Diseño de la propuesta / estrategia',         duration: `Meses ${q + 1}-${q * 2}` },
    { n: 3, name: 'Elaboración del documento técnico',           duration: `Meses ${q * 2 + 1}-${q * 3}` },
    { n: 4, name: 'Revisión, presentación y cierre',             duration: `Meses ${q * 3 + 1}-${durationMonths}` },
  ]
}

export async function generateProposalIdeaDocx(
  idea: ProposalIdea,
  customerName: string,
): Promise<void> {
  const today = new Date().toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  // Título derivado del objective (primera frase, ~80 chars)
  const titleProposal = (idea.objective.split(/[.!?]/)[0] || 'Nueva propuesta de I+D+i').trim().slice(0, 120)
  const subtitle = idea.mainInnovation.split(/[.!?]/)[0]?.trim().slice(0, 150) || ''
  const phases = derivePhases(idea.durationMonths, idea.workPackages)

  // Todos los deliverables planos (para sección Resumen ejecutivo)
  const allDeliverables = idea.workPackages
    .flatMap(wp => wp.deliverables.filter(Boolean))
    .slice(0, 6)

  const html = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>Propuesta — ${esc(customerName)}</title>
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml>
<![endif]-->
<style>
@page {
  size: A4;
  margin: 2.5cm 2cm 2cm 2cm;
}
body {
  font-family: 'Calibri', Arial, sans-serif;
  font-size: 11pt;
  color: ${TEXT_DARK};
  line-height: 1.45;
}

/* ============ COVER ============ */
.cover-eyebrow {
  color: ${BRAND_PURPLE};
  font-size: 10pt;
  font-weight: bold;
  letter-spacing: 2pt;
  margin: 0 0 8pt 0;
  text-transform: uppercase;
}
.cover-title {
  color: ${TEXT_MUTED};
  font-size: 22pt;
  font-weight: bold;
  margin: 0 0 10pt 0;
  line-height: 1.1;
}
.cover-subtitle {
  color: ${TEXT_MUTED};
  font-size: 12pt;
  margin: 0 0 36pt 0;
  line-height: 1.35;
}
.cover-prep {
  color: ${TEXT_DEEP};
  font-size: 9pt;
  margin: 0 0 4pt 0;
}
.cover-client {
  color: ${TEXT_MUTED};
  font-size: 14pt;
  margin: 0 0 32pt 0;
}
.cover-byline {
  color: ${TEXT_DARK};
  font-size: 9pt;
  margin: 0 0 2pt 0;
}
.cover-date {
  color: ${TEXT_MUTED};
  font-size: 9pt;
  margin: 0;
}

/* ============ HEADINGS ============ */
h1 {
  color: ${BRAND_PURPLE};
  font-size: 18pt;
  font-weight: bold;
  margin: 24pt 0 12pt 0;
  page-break-after: avoid;
}
h2 {
  color: ${TEXT_DARK};
  font-size: 13pt;
  font-weight: bold;
  margin: 16pt 0 6pt 0;
  page-break-after: avoid;
}
h3 {
  color: ${BRAND_PURPLE};
  font-size: 11pt;
  font-weight: bold;
  margin: 12pt 0 4pt 0;
  page-break-after: avoid;
}

p {
  margin: 0 0 8pt 0;
  text-align: justify;
}
.muted { color: ${TEXT_MUTED}; }
.dark  { color: ${TEXT_DARK}; }
.brand { color: ${BRAND_PURPLE}; font-weight: bold; }

/* ============ INDEX ============ */
.toc-item {
  color: ${BRAND_PURPLE};
  font-weight: bold;
  font-size: 11pt;
  margin: 4pt 0;
}

/* ============ LISTS ============ */
ul { margin: 4pt 0 10pt 0; padding-left: 20pt; }
li { margin: 3pt 0; }
.list-muted li { color: ${TEXT_MUTED}; }
.list-dark li  { color: ${TEXT_DARK}; }

/* ============ TABLES ============ */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 8pt 0 14pt 0;
  page-break-inside: avoid;
}
table th {
  background: ${BRAND_PURPLE};
  color: white;
  padding: 7pt 8pt;
  text-align: left;
  font-weight: bold;
  font-size: 10pt;
  border: 0.5pt solid ${BRAND_PURPLE};
}
table td {
  padding: 7pt 8pt;
  border: 0.5pt solid #D5D5D5;
  font-size: 10pt;
  vertical-align: top;
  color: ${TEXT_DARK};
}
table tr.placeholder td { color: ${TEXT_MUTED}; font-style: italic; }
.table-tagline td {
  background: ${BRAND_PURPLE}10;
  border-color: ${BRAND_PURPLE};
  font-size: 12pt;
  font-style: italic;
  color: ${BRAND_PURPLE};
  text-align: center;
  padding: 12pt;
}

/* ============ FOOTER MARK ============ */
.cover-footer-bar {
  margin-top: 80pt;
  border-top: 2pt solid ${BRAND_PURPLE};
  padding-top: 8pt;
  font-size: 9pt;
  color: ${TEXT_MUTED};
}
</style>
</head>
<body>

<!-- ═══════════════ PORTADA ═══════════════ -->
<p class="cover-eyebrow">PROPUESTA</p>
<p class="cover-title">${esc(titleProposal)}</p>
${subtitle ? `<p class="cover-subtitle">${esc(subtitle)}</p>` : ''}

<p class="cover-prep">Preparada para</p>
<p class="cover-client">${esc(customerName)}</p>

<p class="cover-byline">Por Teresa Álamos · Álamos Innovación</p>
<p class="cover-date">${today}</p>

<div class="cover-footer-bar">
  alamosinnovacion.com · contacto@alamosinnovacion.com
</div>

<br clear="all" style="page-break-before:always">

<!-- ═══════════════ ÍNDICE ═══════════════ -->
<h1>Índice</h1>
<p class="toc-item">1.  Resumen ejecutivo</p>
<p class="toc-item">2.  Comprensión del proyecto</p>
<p class="toc-item">3.  Nuestra propuesta</p>
<p class="toc-item">4.  Metodología y enfoque de trabajo</p>
<p class="toc-item">5.  Calendario y plan de hitos</p>
<p class="toc-item">6.  Equipo</p>

<br clear="all" style="page-break-before:always">

<!-- ═══════════════ 1. RESUMEN EJECUTIVO ═══════════════ -->
<h1>1. Resumen ejecutivo</h1>

<table>
  <tr class="table-tagline"><td>${esc(idea.mainInnovation || titleProposal)}</td></tr>
</table>

<p>${esc(idea.objective)}</p>

<h3>Lo que entregaremos</h3>
${allDeliverables.length > 0
  ? `<ul class="list-dark">${allDeliverables.map(d => `<li>${esc(d)}</li>`).join('')}</ul>`
  : `<ul class="list-muted">
       <li>[Entregable 1]</li>
       <li>[Entregable 2]</li>
       <li>[Entregable 3]</li>
     </ul>`}

<h3>Por qué Álamos Innovación</h3>
<ul class="list-dark">
  <li>Más de 20 años de experiencia en innovación y financiación pública europea.</li>
  <li>Más de 70 proyectos financiados y más de 100 M€ movilizados.</li>
  <li>Evaluadora externa Horizon Europe (Comisión Europea) y Eurostars.</li>
  <li>Enfoque integral: del diseño de la propuesta al cierre administrativo.</li>
</ul>

<br clear="all" style="page-break-before:always">

<!-- ═══════════════ 2. COMPRENSIÓN DEL PROYECTO ═══════════════ -->
<h1>2. Comprensión del proyecto</h1>

<h2>El reto</h2>
<p>${esc(idea.objective)}</p>

<h2>Por qué este momento</h2>
<p class="muted">[Por qué tiene sentido actuar ahora: ventana de convocatoria abierta, oportunidad estratégica, contexto regulatorio, deadline próximo.]</p>

<h2>Cómo lo plantea Álamos Innovación</h2>
<p>${esc(idea.mainInnovation)}</p>

<br clear="all" style="page-break-before:always">

<!-- ═══════════════ 3. NUESTRA PROPUESTA ═══════════════ -->
<h1>3. Nuestra propuesta</h1>

<h2>Alcance del trabajo</h2>
<p>El proyecto se estructura en ${idea.workPackages.length} ${idea.workPackages.length === 1 ? 'work package' : 'work packages'} a desarrollar a lo largo de <strong>${idea.durationMonths} meses</strong>, partiendo de una madurez tecnológica inicial <strong>TRL ${idea.initialTrl}</strong> (${esc(trlLabel(idea.initialTrl))}).</p>

${idea.workPackages.length > 0
  ? idea.workPackages.map((wp, i) => `
      <h3>Bloque ${i + 1} — ${esc(wp.name) || `WP${i + 1}`}</h3>
      ${wp.tasks.filter(Boolean).length > 0
        ? `<p><strong>Actividades:</strong></p>
           <ul class="list-dark">${wp.tasks.filter(Boolean).map(t => `<li>${esc(t)}</li>`).join('')}</ul>`
        : ''}
      ${wp.deliverables.filter(Boolean).length > 0
        ? `<p><strong>Entregables:</strong></p>
           <ul class="list-dark">${wp.deliverables.filter(Boolean).map(d => `<li>${esc(d)}</li>`).join('')}</ul>`
        : ''}
    `).join('')
  : `<h3>Bloque 1 — [Nombre del bloque]</h3>
     <p class="muted">[Descripción de actividades y entregables.]</p>`}

<h2>Lo que NO incluye</h2>
<p class="muted">[Define el perímetro: qué queda fuera de la propuesta para evitar expectativas no acordadas.]</p>

<br clear="all" style="page-break-before:always">

<!-- ═══════════════ 4. METODOLOGÍA ═══════════════ -->
<h1>4. Metodología y enfoque de trabajo</h1>

<p>El enfoque combina rigor metodológico (estructura clara de WPs, hitos verificables, entregables cuantificables) con cercanía al cliente: el equipo de Álamos trabaja como una extensión natural del equipo del cliente, con revisiones periódicas y comunicación fluida.</p>

<h2>Fases de trabajo</h2>
<table>
  <thead>
    <tr>
      <th style="width:10%">Fase</th>
      <th>Actividad principal</th>
      <th style="width:25%">Duración estimada</th>
    </tr>
  </thead>
  <tbody>
    ${phases.map(p => `
      <tr>
        <td><strong>${p.n}</strong></td>
        <td>${esc(p.name)}</td>
        <td>${esc(p.duration)}</td>
      </tr>
    `).join('')}
  </tbody>
</table>

<br clear="all" style="page-break-before:always">

<!-- ═══════════════ 5. CALENDARIO Y PLAN DE HITOS ═══════════════ -->
<h1>5. Calendario y plan de hitos</h1>

<p>Calendario detallado anclado al inicio del proyecto. Cada hito tiene un responsable claro y una fecha objetivo.</p>

<table>
  <thead>
    <tr>
      <th>Hito</th>
      <th style="width:22%">Fecha estimada</th>
      <th style="width:22%">Responsable</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Inicio del trabajo</strong></td>
      <td>Mes 1</td>
      <td>Álamos + Cliente</td>
    </tr>
    ${idea.workPackages.slice(0, 4).map((wp, i) => `
      <tr>
        <td>Cierre ${esc(wp.name) || `WP${i + 1}`}</td>
        <td>Mes ${Math.round(((i + 1) / idea.workPackages.length) * idea.durationMonths) || (i + 1)}</td>
        <td>${i === 1 ? 'Cliente + Álamos' : 'Álamos'}</td>
      </tr>
    `).join('')}
    <tr>
      <td>Cierre del proyecto / envío al organismo</td>
      <td>Mes ${idea.durationMonths}</td>
      <td>Cliente</td>
    </tr>
  </tbody>
</table>

<br clear="all" style="page-break-before:always">

<!-- ═══════════════ 6. EQUIPO ═══════════════ -->
<h1>6. Equipo</h1>

<h2>Teresa Álamos</h2>
<p class="brand">Senior Innovation Consultant · Álamos Innovación · Sevilla</p>
<p>Más de 20 años de experiencia en innovación y financiación pública europea. Especialista en propuestas competitivas, gestión de proyectos I+D+i y evaluación de propuestas para la Comisión Europea (Horizon Europe, Eurostars).</p>

<h2>Consorcio propuesto</h2>
${idea.partners.length > 0
  ? `<table>
      <thead>
        <tr>
          <th style="width:14%">Tipo</th>
          <th>Partner</th>
          <th style="width:25%">Web</th>
          <th style="width:20%">Rol</th>
        </tr>
      </thead>
      <tbody>
        ${idea.partners.map(p => `
          <tr>
            <td><strong>${p.type === 'customer' ? 'Cliente Álamos' : 'Externo'}</strong></td>
            <td>${esc(p.name)}</td>
            <td><a href="${esc(p.web)}">${esc(p.web)}</a></td>
            <td>${esc(p.role)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`
  : `<p class="muted">[Si la propuesta incluye colaboración con Soros Gabinete u otro partner técnico, describir aquí brevemente el rol de cada parte.]</p>`}

<p style="margin-top:36pt;">Quedo a tu disposición para cualquier consulta o ajuste.</p>
<p style="margin-top:8pt;"><strong>Teresa Álamos</strong></p>
<p>contacto@alamosinnovacion.com · alamosinnovacion.com</p>

</body>
</html>
`.trim()

  const blob = new Blob(
    ['﻿', html],
    { type: 'application/msword;charset=utf-8' },
  )
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const safeName = (customerName || 'Cliente').replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_').slice(0, 50)
  link.href = url
  link.download = `Propuesta_${safeName}_${new Date().toISOString().slice(0, 10)}.doc`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
