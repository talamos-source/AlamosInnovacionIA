/* ============================================================
   Discovery triage — clasificación de convocatorias
   ============================================================
   Asigna a cada call de Discovery:
     · ámbito   → EU / NACIONAL / REGIONAL (color de fila y badge)
     · banda    → high / medium / unscored / low / excluded
     · motivo   → texto corto "reason for band"
     · directa  → concesión directa / nominativa (se oculta por defecto)

   Orden de decisión:
     1. Concesión directa detectada (reglas o IA) → excluded + flag direct
     2. Cualificación IA (solo BDNS) → manda sobre las reglas
     3. Reglas: EU por programa, BDNS por rdiScore del backend
   ============================================================ */

export type TriageBand = 'high' | 'medium' | 'unscored' | 'low' | 'excluded'
export type Ambito = 'EU' | 'NACIONAL' | 'REGIONAL'
export type AiBand = 'high' | 'medium' | 'low' | 'excluded'

/** Campos mínimos que necesita el clasificador (estructural, sirve para
 *  el DiscoveryCall de Discovery.tsx y para el de Roadmap.tsx). */
export interface TriageInput {
  externalId?: string
  source?: string
  title?: string
  program?: string
  typeOfAction?: string
  fundingBody?: string
  geographicScope?: string
  rdiScore?: number
  rdiReasons?: string[]
  aiBand?: AiBand
  aiReason?: string
  aiDirectAward?: boolean
}

export interface TriageResult {
  band: TriageBand
  reason: string
  origin: 'ai' | 'rule'
  direct: boolean
}

export const BAND_ORDER: TriageBand[] = ['high', 'medium', 'unscored', 'low', 'excluded']

const norm = (s?: string): string =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/* ----------------------------------------------------------
   Ámbito
   ---------------------------------------------------------- */

/** BDNS guarda program como "nivel3 · nivel2 · nivel1". nivel1 = AUTONOMICA,
 *  LOCAL, ESTADO u OTROS. Autonómica/local → Regional; resto → Nacional. */
export function ambitoOf(call: TriageInput): Ambito {
  if (call.source === 'EU_PORTAL') return 'EU'
  if (call.geographicScope === 'Regional') return 'REGIONAL'
  const parts = (call.program || '').split(' · ')
  const nivel1 = norm(parts[parts.length - 1])
  if (nivel1.startsWith('autonom') || nivel1.startsWith('local') || nivel1.includes('comunidad autonoma')) {
    return 'REGIONAL'
  }
  return 'NACIONAL'
}

export const AMBITO_LABEL: Record<Ambito, string> = {
  EU: 'Europea',
  NACIONAL: 'Nacional',
  REGIONAL: 'Regional',
}

/** Línea de organismo bajo el título (estilo "CONSEJERÍA … — CASTILLA Y LEÓN — AUTONÓMICA"). */
export function organismLine(call: TriageInput): string {
  if (call.source === 'EU_PORTAL') {
    return [call.program, call.typeOfAction, call.externalId].filter(Boolean).join(' · ')
  }
  const parts = (call.program || call.fundingBody || '').split(' · ').filter(Boolean)
  return parts.join(' — ')
}

/* ----------------------------------------------------------
   Concesión directa / nominativa
   ---------------------------------------------------------- */

const DIRECT_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /concesion directa/, label: 'concesión directa' },
  { re: /\bnominativa/, label: 'subvención nominativa' },
  { re: /excluida de (la )?concurrencia/, label: 'excluida de concurrencia' },
  { re: /sin concurrencia( competitiva)?/, label: 'sin concurrencia competitiva' },
  { re: /\bse conceden? (una |la |las )?(subvencion|ayuda|aportacion)/, label: 'acto de concesión a beneficiario concreto' },
  { re: /\bacuerdo de concesion\b/, label: 'acuerdo de concesión' },
  { re: /aportaciones? dinerarias?/, label: 'aportación dineraria' },
  { re: /transferencia nominativa|transferencias? de financiacion/, label: 'transferencia de financiación' },
  { re: /encomienda de gestion|\bencargo a medio propio/, label: 'encargo / encomienda' },
]

export function detectDirectAward(call: TriageInput): { isDirect: boolean; reason?: string } {
  if (call.aiDirectAward) {
    return { isDirect: true, reason: 'Concesión directa o beneficiario predeterminado (detectado por IA)' }
  }
  if (call.source === 'EU_PORTAL') return { isDirect: false }
  const text = `${norm(call.title)} ${norm(call.typeOfAction)}`
  // Si el texto habla de convocar/bases reguladoras y NO de concesión directa,
  // damos prioridad a que es competitiva (evita falsos positivos tipo
  // "se convocan ayudas ... y se conceden…").
  for (const p of DIRECT_PATTERNS) {
    if (p.re.test(text)) {
      if (p.label === 'acto de concesión a beneficiario concreto' && /\bconvoca|bases reguladoras|concurrencia competitiva/.test(text)) {
        continue
      }
      return { isDirect: true, reason: `Sin concurrencia (${p.label}): no admite solicitud abierta` }
    }
  }
  return { isDirect: false }
}

/* ----------------------------------------------------------
   Programas UE por encaje con I+D+i
   ---------------------------------------------------------- */

const EU_PROGRAMMES: Array<{ prefixes: string[]; names: string[]; tier: 'high' | 'medium' | 'low'; label: string }> = [
  { prefixes: ['horizon-eic', 'eic-'], names: ['european innovation council'], tier: 'high', label: 'EIC' },
  { prefixes: ['horizon-'], names: ['horizon europe', 'horizon 2020'], tier: 'high', label: 'Horizon Europe' },
  { prefixes: ['digital-'], names: ['digital europe'], tier: 'high', label: 'Digital Europe' },
  { prefixes: ['life-'], names: ['life '], tier: 'high', label: 'LIFE' },
  { prefixes: ['innovfund-'], names: ['innovation fund'], tier: 'high', label: 'Innovation Fund' },
  { prefixes: ['edf-'], names: ['european defence fund'], tier: 'high', label: 'European Defence Fund' },
  { prefixes: ['i3-'], names: ['interregional innovation'], tier: 'high', label: 'I3' },
  { prefixes: ['euratom-'], names: ['euratom'], tier: 'high', label: 'Euratom' },
  { prefixes: ['rfcs-'], names: ['coal & steel', 'coal and steel'], tier: 'high', label: 'RFCS' },
  { prefixes: ['cef-'], names: ['connecting europe'], tier: 'high', label: 'CEF' },
  { prefixes: ['eu4h-'], names: ['eu4health'], tier: 'medium', label: 'EU4Health' },
  { prefixes: ['smp-'], names: ['single market'], tier: 'medium', label: 'Single Market Programme' },
  { prefixes: ['emfaf-'], names: ['maritime, fisheries'], tier: 'medium', label: 'EMFAF' },
  { prefixes: ['crea-'], names: ['creative europe'], tier: 'medium', label: 'Creative Europe' },
  { prefixes: ['erasmus-'], names: ['erasmus'], tier: 'low', label: 'Erasmus+' },
  { prefixes: ['esf-', 'socpl-'], names: ['social fund', 'social prerogatives'], tier: 'low', label: 'ESF+' },
  { prefixes: ['cerv-'], names: ['cerv', 'citizens, equality'], tier: 'low', label: 'CERV' },
  { prefixes: ['just-'], names: ['justice programme'], tier: 'low', label: 'Justice' },
  { prefixes: ['amif-'], names: ['asylum, migration', 'amif'], tier: 'low', label: 'AMIF' },
  { prefixes: ['isf-'], names: ['internal security'], tier: 'low', label: 'ISF' },
  { prefixes: ['bmvi-'], names: ['border management'], tier: 'low', label: 'BMVI' },
  { prefixes: ['cust-', 'ccei-'], names: ['customs'], tier: 'low', label: 'Customs' },
  { prefixes: ['fisc-'], names: ['fiscalis'], tier: 'low', label: 'Fiscalis' },
  { prefixes: ['euaf-'], names: ['anti-fraud'], tier: 'low', label: 'EU Anti-Fraud' },
  { prefixes: ['peri-'], names: ['pericles'], tier: 'low', label: 'Pericles' },
  { prefixes: ['imcap-', 'imreg-'], names: ['information measures'], tier: 'low', label: 'Information Measures' },
  { prefixes: ['agrip-'], names: ['agricultural products promotion'], tier: 'low', label: 'AGRIP' },
  { prefixes: ['esc-'], names: ['solidarity corps'], tier: 'low', label: 'European Solidarity Corps' },
  { prefixes: ['ucpm-'], names: ['civil protection'], tier: 'low', label: 'UCPM' },
  { prefixes: ['tsi-'], names: ['technical support instrument'], tier: 'low', label: 'TSI' },
  { prefixes: ['ndici-'], names: ['global europe'], tier: 'low', label: 'Global Europe' },
  { prefixes: ['jtm-'], names: ['just transition'], tier: 'low', label: 'Just Transition' },
]

function euProgrammeTier(call: TriageInput): { tier: 'high' | 'medium' | 'low'; label: string } {
  const id = norm(call.externalId)
  const prog = norm(call.program)
  // Cascade funding (open calls de proyectos UE para pymes/startups) → foco directo
  if (/\[cascade\]/i.test(call.title || '') || norm(call.typeOfAction).includes('cascade')) {
    return { tier: 'high', label: 'Cascade funding — open call de proyecto UE' }
  }
  for (const p of EU_PROGRAMMES) {
    if (p.prefixes.some(pre => id.startsWith(pre))) return { tier: p.tier, label: p.label }
  }
  for (const p of EU_PROGRAMMES) {
    if (p.names.some(n => prog.includes(n))) return { tier: p.tier, label: p.label }
  }
  return { tier: 'high', label: call.program || 'Programa UE' }
}

/* ----------------------------------------------------------
   Clasificación
   ---------------------------------------------------------- */

/** Bandas solo por reglas (sin IA). Usado para decidir qué mandar a la IA. */
export function ruleBand(call: TriageInput): { band: TriageBand; reason: string } {
  if (call.source === 'EU_PORTAL') {
    const { tier, label } = euProgrammeTier(call)
    if (tier === 'high') {
      const toa = call.typeOfAction && !norm(call.typeOfAction).includes('cascade') ? ` · ${call.typeOfAction}` : ''
      return { band: 'high', reason: `Fuente UE pre-cualificada (${label})${toa}` }
    }
    if (tier === 'medium') {
      return { band: 'medium', reason: `Programa UE con encaje parcial en I+D+i (${label}): revisar si hay componente de innovación` }
    }
    return { band: 'low', reason: `Programa UE fuera del foco I+D+i (${label})` }
  }

  // BDNS — usamos el rdiScore que calcula el backend (organismos + keywords)
  const reasons = (call.rdiReasons || []).slice(0, 4).join(' · ')
  if (call.rdiScore === undefined || call.rdiScore === null) {
    return { band: 'unscored', reason: 'Sin puntuación previa: pendiente de cualificación' }
  }
  if (call.rdiScore >= 50) {
    return { band: 'unscored', reason: `Señales I+D+i (${reasons || 'organismo/keywords'}): pasa el filtro de ruido, pendiente de cualificación fina` }
  }
  if (call.rdiScore > 0) {
    return { band: 'low', reason: `Señales débiles (${reasons || 'temas generales'}): encaje bajo con criterios I+D+i` }
  }
  return { band: 'excluded', reason: 'Sin señales de I+D+i, innovación o transferencia (archivo auditable)' }
}

export function classifyCall(call: TriageInput): TriageResult {
  const direct = detectDirectAward(call)
  if (direct.isDirect) {
    return { band: 'excluded', reason: direct.reason || 'Concesión directa', origin: call.aiDirectAward ? 'ai' : 'rule', direct: true }
  }
  if (call.source !== 'EU_PORTAL' && call.aiBand) {
    return { band: call.aiBand, reason: call.aiReason || 'Cualificada por IA', origin: 'ai', direct: false }
  }
  const r = ruleBand(call)
  return { ...r, origin: 'rule', direct: false }
}

/** Para el Roadmap: descartar directas y las excluidas por IA. */
export function isOutOfProfileForRoadmap(call: TriageInput): boolean {
  if (detectDirectAward(call).isDirect) return true
  if (call.source !== 'EU_PORTAL' && call.aiBand === 'excluded') return true
  return false
}
