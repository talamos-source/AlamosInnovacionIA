/* ============================================================
   Funding Map — publicación de convocatorias en la web
   ============================================================
   Reglas:
     · Vencida (deadline pasada)            → nunca se publica
     · Override "unpublish"                 → oculta (aunque sea High)
     · Override "publish"                   → publicada (cualquier banda)
     · Sin override: AUTO si banda High, no es concesión directa,
       tiene deadline futura y no está descartada.
   La ficha pública NO incluye nada interno (motivos IA, scores…).
   ============================================================ */

import type { DiscoveryCall } from '../pages/Discovery'
import { ambitoOf, type Ambito, type TriageResult } from './discoveryTriage'

export type PublishMode = 'auto' | 'manual' | 'hidden' | 'none' | 'expired'

export interface PublishState {
  published: boolean
  mode: PublishMode
}

export interface PublicFundingCall {
  id: string
  source: 'EU_PORTAL' | 'BDNS'
  title: string
  body: string
  programme?: string
  ambito: Ambito
  typeOfAction?: string
  openDate?: string
  closeDate?: string
  budget?: string
  url: string
  summary?: string
  publishedAt?: string
}

/** URL pública de la página (para el enlace "View page" del CRM). */
export const FUNDING_MAP_PUBLIC_URL = 'https://www.alamosinnovacion.com/es/ayudas'

const isExpired = (c: DiscoveryCall): boolean => {
  const t = c.closeDate ? new Date(c.closeDate).getTime() : NaN
  return !Number.isNaN(t) && t < Date.now() - 86400000
}

export function isAutoPublishable(c: DiscoveryCall, cl: TriageResult): boolean {
  if (!c.closeDate || isExpired(c)) return false
  if (c.userStatus === 'dismissed') return false
  return cl.band === 'high' && !cl.direct
}

export function publicationOf(c: DiscoveryCall, cl: TriageResult): PublishState {
  if (isExpired(c)) return { published: false, mode: 'expired' }
  if (c.publishOverride === 'unpublish') return { published: false, mode: 'hidden' }
  if (c.publishOverride === 'publish') return { published: true, mode: 'manual' }
  return isAutoPublishable(c, cl) ? { published: true, mode: 'auto' } : { published: false, mode: 'none' }
}

/** Override resultante al pulsar el botón de publicar (deja el mínimo de overrides). */
export function nextPublishOverride(c: DiscoveryCall, cl: TriageResult): 'publish' | 'unpublish' | undefined {
  const auto = isAutoPublishable(c, cl)
  const { published } = publicationOf(c, cl)
  if (published) return auto ? 'unpublish' : undefined
  return auto ? undefined : 'publish'
}

/* ----------------------------------------------------------
   Formato legible para la web
   ---------------------------------------------------------- */

const SMALL_WORDS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'o', 'u', 'a', 'al', 'en',
  'para', 'por', 'con', 'sin', 'sobre', 'i', 'les', 'dels', 'da', 'do', 'das', 'dos',
])

const KEEP_UPPER = new Set([
  'CDTI', 'AEI', 'IDAE', 'ENISA', 'ICEX', 'EOI', 'INCIBE', 'SEPE', 'FEDER', 'FSE', 'ISCIII',
  'IDEA', 'IVACE', 'ADER', 'SODERCAN', 'AGAUR', 'SPRI', 'IGAPE', 'IAF', 'INFO', 'CSIC',
  'UE', 'PYME', 'PYMES', 'TIC', 'IA', 'I+D', 'MRR', 'PERTE', 'ACCIÓ',
])

/** "CONSEJERÍA DE INDUSTRIA, UNIVERSIDADES Y EMPLEO" → "Consejería de Industria, Universidades y Empleo". */
export function titleCaseEs(s?: string): string {
  if (!s) return ''
  const trimmed = s.trim()
  if (trimmed !== trimmed.toUpperCase()) return trimmed // ya tiene mayúsculas/minúsculas
  return trimmed.split(/\s+/).map((tok, i) => {
    const m = tok.match(/^([^\p{L}\d]*)(.*?)([^\p{L}\d+]*)$/u)
    const pre = m?.[1] || ''
    const core = m?.[2] || tok
    const post = m?.[3] || ''
    if (core === 'I+D+I') return `${pre}I+D+i${post}`
    if (KEEP_UPPER.has(core)) return `${pre}${core}${post}`
    const lower = core.toLocaleLowerCase('es')
    if (i > 0 && SMALL_WORDS.has(lower)) return `${pre}${lower}${post}`
    return `${pre}${lower.charAt(0).toLocaleUpperCase('es')}${lower.slice(1)}${post}`
  }).join(' ')
}

/** Siglas que se restauran tras pasar un título a minúsculas. */
const SENTENCE_ACRONYMS = [
  'CDTI', 'AEI', 'IDAE', 'ENISA', 'ICEX', 'EOI', 'INCIBE', 'SEPE', 'FEDER', 'FSE',
  'ISCIII', 'CSIC', 'TIC', 'MRR', 'PERTE', 'UE', 'IA', 'PRTR', 'ODS',
]

function restoreAcronyms(s: string): string {
  let out = s
    .replace(/(^|[^\p{L}])i\+d\+i(?![\p{L}])/gu, '$1I+D+i')
    .replace(/(^|[^\p{L}])i\+d(?![\p{L}+])/gu, '$1I+D')
  for (const a of SENTENCE_ACRONYMS) {
    const re = new RegExp(`(^|[^\\p{L}])${a.toLocaleLowerCase('es')}(?![\\p{L}])`, 'gu')
    out = out.replace(re, `$1${a}`)
  }
  return out
}

/** Títulos BDNS en mayúsculas → frase normal (conservando siglas). */
function sentenceIfUpper(s: string): string {
  const t = s.trim()
  if (t.length < 20 || t !== t.toUpperCase()) return t
  const lower = restoreAcronyms(t.toLocaleLowerCase('es'))
  return lower.charAt(0).toLocaleUpperCase('es') + lower.slice(1)
}

/** "Horizon Europe (HORIZON) — CL5" → "Horizon Europe — CL5". */
const stripProgrammeCode = (p: string): string => p.replace(/\s*\((?:[A-Z0-9+\-]{2,})\)/g, '').trim()

export function toPublicCall(c: DiscoveryCall): PublicFundingCall {
  const ambito = ambitoOf(c)
  let body: string
  let programme: string | undefined

  if (c.source === 'EU_PORTAL') {
    body = 'European Commission'
    programme = stripProgrammeCode(c.program || '') || undefined
  } else {
    // BDNS: program = "nivel3 · nivel2 · nivel1"
    const parts = (c.program || '').split(' · ').map(p => p.trim()).filter(Boolean)
    const nivel1 = (parts[parts.length - 1] || '').toUpperCase()
    const specific = parts.length > 1 ? parts.slice(0, -1) : parts
    if (nivel1 === 'ESTADO') {
      body = 'Gobierno de España'
      programme = titleCaseEs(specific[0] || c.fundingBody)
    } else if (ambito === 'REGIONAL') {
      body = titleCaseEs(specific[specific.length - 1] || c.fundingBody)
      programme = specific.length > 1 ? titleCaseEs(specific[0]) : undefined
    } else {
      body = titleCaseEs(specific[0] || c.fundingBody || 'Administración Pública')
      programme = specific.length > 1 ? titleCaseEs(specific[1]) : undefined
    }
    if (programme && programme === body) programme = undefined
  }

  return {
    id: `${c.source}::${c.externalId}`,
    source: c.source,
    title: c.source === 'BDNS' ? sentenceIfUpper(c.title) : c.title,
    body,
    programme,
    ambito,
    typeOfAction: c.source === 'EU_PORTAL' ? c.typeOfAction : undefined,
    openDate: c.openDate,
    closeDate: c.closeDate,
    budget: c.budget,
    url: c.url,
    summary: c.source === 'EU_PORTAL' ? c.description : undefined,
    publishedAt: c.discoveredAt,
  }
}
