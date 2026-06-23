/* ============================================================
   Call Mapping helpers
   ============================================================
   Funciones puras compartidas para enriquecer un objeto Call
   con los datos disponibles en una ficha del Knowledge Base o
   en un item de Discovery. Centralizar aquí evita duplicar la
   lógica entre los 3 puntos de entrada al import:
     · /calls → Import calls → Discovery
     · /calls → Import calls → Knowledge Base
     · /knowledge-base → card → Import to /calls
   ============================================================ */

/* ---------- Tipos mínimos compartidos ---------- */

export interface FichaMetaForImport {
  slug: string
  organisms: string[]
  aliases?: string[]
  aidType: string | null
  aidObject?: string | null
  regime?: string | null
  sectorBound?: string | null
  targetCompany?: string | null
  collaborationRequired?: boolean
  internationalRequired?: boolean
  convocatoriaTipo?: string | null
  similarAlternatives?: string[]
  exclusiveWith?: string[]
  /** Objeto con keys arbitrarias: pagina, boe, guidelines, programa, etc. */
  sourceUrls?: Record<string, string>
}

export interface DiscoveryItemForImport {
  externalId: string
  source: 'EU_PORTAL' | 'BDNS'
  title: string
  fundingBody?: string
  program?: string
  typeOfAction?: string
  region?: string
  openDate?: string
  closeDate?: string
  budget?: string
  url?: string
  description?: string
  geographicScope?: 'European' | 'National' | 'Regional' | 'International'
  aidType?: 'Grant' | 'Loan' | 'Mixed' | 'Tax Credit'
}

export interface ImportFormValues {
  customName?: string
  year: string
  openDate?: string
  deadline: string
  budget?: string
  status: 'Open' | 'Forthcoming' | 'Closed' | 'Draft'
}

/** Subconjunto de Call que devuelven los mappers — los consumidores
 *  pueden extenderlo con campos extra como id, archived, etc. */
export interface MappedCall {
  name: string
  scope: string
  deadline: string
  budget: string
  status: string
  fundingBody?: string
  program?: string
  year?: string
  openDate?: string
  aidType?: string
  sourceUrl?: string
  eligibleCompanySizes?: string[]
  eligibleCountries?: string[]
  eligibleRegion?: string[]
  additionalRequirements?: string
  internalNotes?: string
}

/* ============================================================
   HELPERS
   ============================================================ */

export const humanizeSlug = (slug: string): string => {
  return slug
    .split('-')
    .map(p => p.length <= 4 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1))
    .join(' ')
}

export const humanizeAidType = (aid: string | null | undefined): string => {
  if (!aid) return 'Subvención'
  const a = aid.toLowerCase()
  if (a.includes('lump_sum')) return 'Subvención (lump sum)'
  if (a.includes('prestamo_participativo')) return 'Préstamo participativo'
  if (a.includes('prestamo')) return 'Préstamo'
  if (a.includes('subvencion')) return 'Subvención'
  if (a.includes('mixta') || a.includes('blended')) return 'Mixta (grant + equity)'
  if (a.includes('equity') || a.includes('inversion')) return 'Equity'
  if (a.includes('label')) return 'Label EUREKA + nacional'
  return aid.replace(/_/g, ' ')
}

/** Convierte una fecha en cualquier formato común (ISO YYYY-MM-DD,
 *  ISO con tiempo, dd/mm/yyyy, dd-mm-yyyy) al formato dd/mm/yyyy que
 *  espera el form de /calls (handleDateInput + isValidDate).
 *  Si no se puede parsear, devuelve string vacío. */
export function toCallDateFormat(input: string | undefined | null): string {
  if (!input || typeof input !== 'string') return ''
  const trimmed = input.trim()
  if (!trimmed) return ''

  // Ya en formato dd/mm/yyyy
  const dmy = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (dmy) return trimmed

  // dd-mm-yyyy
  const dmyDash = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (dmyDash) return `${dmyDash[1]}/${dmyDash[2]}/${dmyDash[3]}`

  // ISO yyyy-mm-dd (con o sin tiempo)
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    const [, y, m, d] = iso
    return `${d}/${m}/${y}`
  }

  // Último intento: parse via Date
  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) {
    const d = String(parsed.getDate()).padStart(2, '0')
    const m = String(parsed.getMonth() + 1).padStart(2, '0')
    const y = parsed.getFullYear()
    return `${d}/${m}/${y}`
  }
  return ''
}

/** Detecta el primer URL HTTP en sourceUrls (la ficha guarda varias claves:
 *  pagina, boe, guidelines, programa, ayuda...) — preferimos la "principal". */
export function pickPrimaryUrl(sourceUrls: Record<string, string> | undefined): string {
  if (!sourceUrls) return ''
  // Orden de preferencia
  const priority = ['pagina', 'pagina_ayuda', 'programa', 'web', 'site', 'ayuda', 'guidelines', 'boe', 'orden_bases']
  for (const key of priority) {
    const v = sourceUrls[key]
    if (typeof v === 'string' && v.startsWith('http')) return v
  }
  // Cualquier otro http
  for (const v of Object.values(sourceUrls)) {
    if (typeof v === 'string' && v.startsWith('http')) return v
  }
  return ''
}

/** Deduce el ámbito geográfico desde los organismos. */
export function inferScopeFromOrganisms(organisms: string[]): string {
  const lower = organisms.join(' ').toLowerCase()
  if (/comisión europea|european|eic|cinea|eacea|eit|eureka|eismea|horizon/.test(lower)) return 'European'
  if (/junta de|generalitat|gobierno de|consellería|consejería|agencia idea|sodercan|idae regional/i.test(organisms.join(' '))) return 'Regional'
  return 'National'
}

/** Convierte target_company del frontmatter a tags de tamaño de empresa
 *  (PYME, gran empresa, startup, EBT) que el filtro de /calls entiende. */
export function inferCompanySizesFromTarget(target: string | null | undefined): string[] {
  if (!target) return []
  const t = target.toLowerCase()
  const sizes = new Set<string>()
  if (/\bsme\b|\bpyme\b|micro|pequeñ|mediana|small|medium/.test(t)) {
    sizes.add('SME')
  }
  if (/gran empresa|large|midcap|mid-cap/.test(t)) {
    sizes.add('Large Enterprise')
  }
  if (/startup|spin-?off|ebt|empresa de base tecnológica/.test(t)) {
    sizes.add('Startup')
  }
  return Array.from(sizes)
}

/** Construye un párrafo legible con los requisitos clave de la ficha. */
export function buildRequirementsFromFicha(f: FichaMetaForImport): string {
  const lines: string[] = []
  if (f.targetCompany) {
    lines.push(`• Beneficiario típico: ${f.targetCompany.replace(/_/g, ' ')}`)
  }
  if (f.sectorBound) {
    lines.push(`• Sectorial: ${f.sectorBound.replace(/_/g, ' ')}`)
  }
  if (f.aidObject) {
    lines.push(`• Financia: ${f.aidObject.replace(/_/g, ' ')}`)
  }
  if (f.collaborationRequired) {
    lines.push(`• Consorcio obligatorio (mín. 2 entidades)`)
  }
  if (f.internationalRequired) {
    lines.push(`• Partner internacional obligatorio`)
  }
  if (f.regime) {
    lines.push(`• Régimen: ${f.regime.replace(/_/g, ' ')}`)
  }
  if (f.convocatoriaTipo) {
    lines.push(`• Tipo convocatoria: ${f.convocatoriaTipo.replace(/_/g, ' ')}`)
  }
  if (f.exclusiveWith && f.exclusiveWith.length > 0) {
    lines.push(`• Incompatible con: ${f.exclusiveWith.join(', ')}`)
  }
  if (f.similarAlternatives && f.similarAlternatives.length > 0) {
    lines.push(`• Alternativas similares: ${f.similarAlternatives.join(', ')}`)
  }
  return lines.join('\n')
}

/** Notas internas: metadata para el equipo (no para enviar al cliente). */
export function buildInternalNotesFromFicha(f: FichaMetaForImport): string {
  const parts: string[] = [
    `[Importado del Knowledge Base · ficha "${f.slug}"]`,
  ]
  if (f.aliases && f.aliases.length > 0) {
    parts.push(`Aliases reconocidos: ${f.aliases.slice(0, 6).join(' · ')}`)
  }
  return parts.join('\n')
}

/* ============================================================
   MAPPERS
   ============================================================ */

/**
 * Construye un MappedCall a partir de una ficha del KB + valores del form.
 * Extrae automáticamente:
 *   - sourceUrl desde ficha.sourceUrls (primer http preferente)
 *   - scope desde internationalRequired + organismos
 *   - eligibleCompanySizes desde targetCompany
 *   - additionalRequirements en bullets desde requisitos del frontmatter
 *   - internalNotes con metadata de la ficha
 */
export function mapFichaToCall(
  ficha: FichaMetaForImport,
  form: ImportFormValues,
): MappedCall {
  const name = (form.customName ?? '').trim() || humanizeSlug(ficha.slug)

  // Scope: si pide internacional → International; si organismos EU → European;
  // si regional → Regional; resto → National
  let scope: string
  if (ficha.internationalRequired) {
    scope = 'International'
  } else {
    scope = inferScopeFromOrganisms(ficha.organisms)
  }

  return {
    name,
    scope,
    deadline: toCallDateFormat(form.deadline),
    budget: form.budget || '',
    status: form.status,
    fundingBody: ficha.organisms[0] || '',
    program: humanizeSlug(ficha.slug),
    year: form.year,
    openDate: toCallDateFormat(form.openDate),
    aidType: humanizeAidType(ficha.aidType),
    sourceUrl: pickPrimaryUrl(ficha.sourceUrls),
    eligibleCompanySizes: inferCompanySizesFromTarget(ficha.targetCompany),
    eligibleCountries: [],
    eligibleRegion: [],
    additionalRequirements: buildRequirementsFromFicha(ficha),
    internalNotes: buildInternalNotesFromFicha(ficha),
  }
}

/**
 * Construye un MappedCall a partir de un item de Discovery.
 * Usa los campos ricos que el sync trae (geographicScope, typeOfAction,
 * region, description) en lugar de inferirlos.
 */
export function mapDiscoveryToCall(c: DiscoveryItemForImport): MappedCall {
  // URL — fallback robusto: prueba url, sourceUrl (datos viejos), o construye
  // BDNS desde externalId si está vacía.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cAny = c as any
  let sourceUrl: string = cAny.url || cAny.sourceUrl || ''
  if (!sourceUrl && c.source === 'BDNS' && c.externalId) {
    sourceUrl = `https://www.pap.hacienda.gob.es/bdnstrans/GE/es/convocatoria/${c.externalId}`
  }

  // Scope: usa geographicScope nativo (más preciso que inferir por source).
  // Fallback al heurístico clásico si está vacío.
  const scope = c.geographicScope || (c.source === 'EU_PORTAL' ? 'European' : 'National')

  // Type de ayuda: prioriza aidType (Grant/Loan/Mixed); si no, usa typeOfAction;
  // si no, deja vacío y el usuario lo completa.
  let aidType = ''
  if (c.aidType) {
    aidType = c.aidType === 'Grant' ? 'Subvención'
            : c.aidType === 'Loan'  ? 'Préstamo'
            : c.aidType === 'Mixed' ? 'Mixta (grant + equity)'
            : c.aidType === 'Tax Credit' ? 'Crédito fiscal'
            : c.aidType
  } else if (c.typeOfAction) {
    aidType = c.typeOfAction
  }

  // additionalRequirements: combina type of action (RIA/IA/CSA), región
  // y descripción si existe — para que el consultor no pierda ese contexto.
  const reqLines: string[] = []
  if (c.typeOfAction && c.aidType) {
    // typeOfAction tipo RIA/IA/CSA (EU) es info adicional si ya tenemos aidType
    reqLines.push(`• Type of action: ${c.typeOfAction}`)
  }
  if (c.geographicScope) {
    reqLines.push(`• Ámbito: ${c.geographicScope}`)
  }
  if (c.region) {
    reqLines.push(`• Región: ${c.region}`)
  }
  if (c.description) {
    reqLines.push(`\n${c.description.slice(0, 500)}`)
  }

  return {
    name: c.title || '(sin título)',
    scope,
    deadline: toCallDateFormat(c.closeDate),
    budget: c.budget || '',
    status: 'Open',
    fundingBody: c.fundingBody || (c.source === 'EU_PORTAL' ? 'EU Commission' : ''),
    program: c.program || '',
    year: c.closeDate ? c.closeDate.slice(0, 4) : new Date().getFullYear().toString(),
    openDate: toCallDateFormat(c.openDate),
    aidType,
    sourceUrl,
    eligibleCompanySizes: [],
    eligibleCountries: [],
    eligibleRegion: c.region ? [c.region] : [],
    additionalRequirements: reqLines.join('\n').trim(),
    internalNotes: `[Importado de Discovery · ${c.source === 'EU_PORTAL' ? 'EU Funding Portal' : 'BDNS España'} · ID ${c.externalId}]`,
  }
}
