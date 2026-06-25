/* ============================================================
   Proposal Ideas — generador de Word (.doc) con tablas
   ============================================================
   Genera un archivo Word usando HTML con MIME application/msword.
   Word abre el archivo respetando estilos, headings y tablas.
   Branding Álamos (morado #5C358F).
   ============================================================ */

import type { ProposalIdea } from '../components/ProposalIdeasModal'

const BRAND_PURPLE = '#5C358F'
const BRAND_LIGHT = '#F4EEF7'
const BRAND_DARK = '#3D1E66'

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

export async function generateProposalIdeaDocx(
  idea: ProposalIdea,
  customerName: string,
): Promise<void> {
  const today = new Date().toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const html = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>Proposal Idea — ${esc(customerName)}</title>
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
  margin: 2cm 2.2cm 2cm 2.2cm;
}
body {
  font-family: 'Calibri', Arial, sans-serif;
  font-size: 11pt;
  color: #1A1325;
  line-height: 1.5;
}

/* Cover */
.cover-eyebrow {
  color: ${BRAND_PURPLE};
  font-size: 11pt;
  font-weight: bold;
  letter-spacing: 3pt;
  margin: 0 0 12pt 0;
  text-transform: uppercase;
}
.cover-title {
  color: #1A1325;
  font-size: 28pt;
  font-weight: bold;
  margin: 0 0 8pt 0;
  line-height: 1.15;
}
.cover-subtitle {
  color: ${BRAND_PURPLE};
  font-size: 14pt;
  font-style: italic;
  margin: 0 0 24pt 0;
}
.cover-bar {
  width: 60pt;
  height: 3pt;
  background: ${BRAND_PURPLE};
  margin: 12pt 0 24pt 0;
}
.cover-meta {
  font-size: 10pt;
  color: #555;
  margin: 4pt 0;
}
.cover-meta strong { color: #1A1325; }

/* Headings */
h1 {
  color: ${BRAND_PURPLE};
  font-size: 18pt;
  font-weight: bold;
  margin: 28pt 0 8pt 0;
  padding-bottom: 4pt;
  border-bottom: 1.5pt solid ${BRAND_PURPLE};
  page-break-after: avoid;
}
h2 {
  color: ${BRAND_DARK};
  font-size: 13pt;
  font-weight: bold;
  margin: 18pt 0 6pt 0;
  page-break-after: avoid;
}
h3 {
  color: #1A1325;
  font-size: 11pt;
  font-weight: bold;
  margin: 12pt 0 4pt 0;
  page-break-after: avoid;
}

p {
  margin: 0 0 8pt 0;
  text-align: justify;
}

.label {
  font-size: 9pt;
  letter-spacing: 1.5pt;
  color: ${BRAND_PURPLE};
  font-weight: bold;
  text-transform: uppercase;
  margin: 4pt 0 2pt 0;
}

.kv {
  margin: 4pt 0;
}
.kv strong { color: ${BRAND_PURPLE}; }

/* TRL bar */
.trl-row {
  margin: 8pt 0;
  font-size: 10pt;
}
.trl-bar {
  display: inline-block;
  width: 220pt;
  height: 8pt;
  background: ${BRAND_LIGHT};
  border: 0.5pt solid ${BRAND_PURPLE};
  vertical-align: middle;
  margin: 0 6pt;
}
.trl-fill {
  display: inline-block;
  height: 6pt;
  background: ${BRAND_PURPLE};
  vertical-align: top;
}

/* Tables */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 8pt 0 12pt 0;
  page-break-inside: avoid;
}
table th {
  background: ${BRAND_PURPLE};
  color: white;
  padding: 6pt 8pt;
  text-align: left;
  font-weight: bold;
  font-size: 10pt;
  border: 0.5pt solid ${BRAND_DARK};
}
table td {
  padding: 6pt 8pt;
  border: 0.5pt solid #ccc;
  font-size: 10pt;
  vertical-align: top;
}
table tr:nth-child(even) td { background: #FBF8FE; }

.wp-name {
  background: ${BRAND_LIGHT} !important;
  color: ${BRAND_DARK};
  font-weight: bold;
  font-size: 11pt !important;
}

ul { margin: 4pt 0 8pt 0; padding-left: 18pt; }
li { margin: 2pt 0; }

/* Footer mark */
.footer-mark {
  margin-top: 36pt;
  padding-top: 8pt;
  border-top: 0.5pt solid #ddd;
  font-size: 9pt;
  color: #777;
  text-align: center;
}
</style>
</head>
<body>

<!-- COVER -->
<p class="cover-eyebrow">ÁLAMOS INNOVACIÓN · PROPOSAL IDEA</p>
<p class="cover-title">${esc(idea.objective.split('.')[0] || 'Nueva propuesta de I+D+i')}</p>
<div class="cover-bar"></div>
<p class="cover-subtitle">Cliente: ${esc(customerName)}</p>

<p class="cover-meta"><strong>Duración estimada:</strong> ${idea.durationMonths} meses</p>
<p class="cover-meta"><strong>TRL inicial:</strong> ${idea.initialTrl} — ${esc(trlLabel(idea.initialTrl))}</p>
<p class="cover-meta"><strong>Partners:</strong> ${idea.partners.length}</p>
<p class="cover-meta"><strong>Work packages:</strong> ${idea.workPackages.length}</p>
<p class="cover-meta" style="margin-top:16pt;">Generado el ${today}</p>

<br clear="all" style="page-break-before:always">

<!-- 1. OBJETIVO -->
<h1>1. Objetivo del proyecto</h1>
<p>${esc(idea.objective)}</p>

<!-- 2. INNOVACIÓN -->
<h1>2. Principal innovación</h1>
<p>${esc(idea.mainInnovation)}</p>

<!-- 3. MADUREZ TECNOLÓGICA -->
<h1>3. Madurez tecnológica (TRL)</h1>
<p class="trl-row">
  <strong>TRL inicial:</strong>
  <span class="trl-bar"><span class="trl-fill" style="width: ${(idea.initialTrl / 9) * 220}pt;"></span></span>
  <strong>${idea.initialTrl} / 9</strong>
</p>
<p style="margin-left: 0; color: ${BRAND_PURPLE};"><em>${esc(trlLabel(idea.initialTrl))}</em></p>

<!-- 4. PARTNERS -->
<h1>4. Consorcio</h1>
${idea.partners.length === 0
  ? '<p><em>Sin partners definidos.</em></p>'
  : `<table>
      <thead>
        <tr>
          <th style="width:22%">Tipo</th>
          <th style="width:30%">Partner</th>
          <th style="width:28%">Web</th>
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
    </table>`}

<!-- 5. DURACIÓN -->
<h1>5. Duración</h1>
<p><strong>${idea.durationMonths} meses</strong></p>

<!-- 6. WORK PACKAGES -->
<h1>6. Plan de trabajo</h1>
${idea.workPackages.length === 0
  ? '<p><em>Sin work packages definidos.</em></p>'
  : idea.workPackages.map((wp, i) => `
      <h2>${esc(wp.name) || `WP${i + 1}`}</h2>
      <table>
        <tr>
          <td class="wp-name" colspan="2">${esc(wp.name) || `Work Package ${i + 1}`}</td>
        </tr>
        <tr>
          <td style="width:50%; vertical-align: top;">
            <strong style="color: ${BRAND_PURPLE};">Tasks</strong>
            ${wp.tasks.filter(Boolean).length > 0
              ? `<ul>${wp.tasks.filter(Boolean).map(t => `<li>${esc(t)}</li>`).join('')}</ul>`
              : '<p style="color:#999; font-size:9pt;">(sin tareas)</p>'}
          </td>
          <td style="width:50%; vertical-align: top;">
            <strong style="color: ${BRAND_PURPLE};">Deliverables</strong>
            ${wp.deliverables.filter(Boolean).length > 0
              ? `<ul>${wp.deliverables.filter(Boolean).map(d => `<li>${esc(d)}</li>`).join('')}</ul>`
              : '<p style="color:#999; font-size:9pt;">(sin entregables)</p>'}
          </td>
        </tr>
      </table>
    `).join('')}

<!-- 7. RESUMEN VISUAL DE WPs -->
${idea.workPackages.length > 0
  ? `<h1>7. Resumen de Work Packages</h1>
     <table>
       <thead>
         <tr>
           <th style="width:12%">WP</th>
           <th>Nombre</th>
           <th style="width:18%">Tasks</th>
           <th style="width:18%">Deliverables</th>
         </tr>
       </thead>
       <tbody>
         ${idea.workPackages.map((wp, i) => `
           <tr>
             <td><strong>WP${i + 1}</strong></td>
             <td>${esc(wp.name)}</td>
             <td style="text-align:center;"><strong>${wp.tasks.filter(Boolean).length}</strong></td>
             <td style="text-align:center;"><strong>${wp.deliverables.filter(Boolean).length}</strong></td>
           </tr>
         `).join('')}
       </tbody>
     </table>`
  : ''}

<p class="footer-mark">
  Documento generado por Álamos Innovación CRM · ${today}<br/>
  Confidencial — para uso interno y discusión con el cliente
</p>

</body>
</html>
`.trim()

  // Construir blob con MIME Word
  const blob = new Blob(
    ['﻿', html],
    { type: 'application/msword;charset=utf-8' },
  )
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const safeName = (customerName || 'Cliente').replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_').slice(0, 50)
  link.href = url
  link.download = `Proposal_Idea_${safeName}_${new Date().toISOString().slice(0, 10)}.doc`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
