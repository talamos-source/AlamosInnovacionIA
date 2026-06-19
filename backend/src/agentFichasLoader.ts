/* ============================================================
   AGENT FICHAS LOADER
   ============================================================
   Carga al arrancar todas las fichas .md de agentFichas/ y las
   indexa por aliases. Cuando el agente procesa una call, hace
   fuzzy match contra los aliases para detectar si pertenece a
   algún programa fichado y, si match, inyecta la ficha completa
   en el prompt como "Knowledge Base for this call".

   Resultado: el agente da fitScore más fino + applicationGuidance
   basada en tips reales de la ficha, no inventada de la nada.
   ============================================================ */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/* ---------- Tipos ---------- */

export interface FichaFrontmatter {
  program_slug: string
  last_updated?: string
  fiche_review_date?: string
  aliases?: string[]
  organisms?: string[]
  bdns_codes?: string[]
  exclusive_with?: string[]
  similar_alternatives?: string[]
  aid_type?: string
  regime?: string
  success_rate?: number | null
  source_urls?: Record<string, string>
}

export interface Ficha {
  filename: string
  slug: string
  frontmatter: FichaFrontmatter
  body: string                // markdown body sin frontmatter
  /** Aliases en minúsculas para fuzzy match */
  aliasesLower: string[]
  organismsLower: string[]
}

/* ---------- Parser YAML frontmatter mínimo ---------- */

/**
 * Parser simple para el subset de YAML que usamos en las fichas.
 * Soporta: strings, arrays (block- y flow-style), null, números.
 * NO soporta: anchors, references, multi-line strings con > o |.
 *
 * Ejemplo:
 *   program_slug: cdti-lic
 *   aliases:
 *     - "Línea Directa"
 *     - "LIC"
 *   bdns_codes: []
 *   success_rate: null
 *   source_urls:
 *     pagina_ayuda: "https://..."
 */
function parseFrontmatter(yamlText: string): FichaFrontmatter {
  const result: Record<string, unknown> = {}
  const lines = yamlText.split('\n')
  let currentKey: string | null = null
  let currentArray: string[] | null = null
  let currentObject: Record<string, string> | null = null

  const stripComment = (s: string) => s.replace(/\s+#.*$/, '').trim()
  const unquote = (s: string) => {
    const t = s.trim()
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      return t.slice(1, -1)
    }
    return t
  }

  for (const rawLine of lines) {
    if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue

    // Item de array  ("  - foo")
    if (currentArray && /^\s+-\s+/.test(rawLine)) {
      const v = unquote(stripComment(rawLine.replace(/^\s+-\s+/, '')))
      if (v) currentArray.push(v)
      continue
    }

    // Item de objeto indentado ("  key: value")
    if (currentObject && /^\s{2,}\S/.test(rawLine) && rawLine.includes(':')) {
      const m = rawLine.match(/^\s+(\S+):\s*(.*)$/)
      if (m) {
        const k = m[1]
        const v = unquote(stripComment(m[2]))
        currentObject[k] = v
        continue
      }
    }

    // Cualquier otra línea cierra arrays/objetos pendientes
    currentArray = null
    currentObject = null

    // Key: value (top level)
    const kv = rawLine.match(/^(\S+):\s*(.*)$/)
    if (!kv) continue
    const key = kv[1]
    const rawValue = stripComment(kv[2])
    currentKey = key

    if (rawValue === '' || rawValue === undefined) {
      // El valor está en líneas siguientes (array u objeto)
      result[key] = null
      // Asumimos array por defecto; si la siguiente línea es "key: value" se reasignará a object
      currentArray = []
      ;(result as Record<string, unknown>)[key] = currentArray
      // Tampoco creamos currentObject aquí — solo si vemos sintaxis de objeto
      const nextNonEmpty = lines.slice(lines.indexOf(rawLine) + 1).find(l => l.trim() && !l.trim().startsWith('#'))
      if (nextNonEmpty && /^\s+\S+:\s/.test(nextNonEmpty) && !/^\s+-\s/.test(nextNonEmpty)) {
        currentArray = null
        currentObject = {}
        ;(result as Record<string, unknown>)[key] = currentObject
      }
      continue
    }

    // Array inline []
    if (rawValue === '[]') {
      result[key] = []
      continue
    }

    // Array inline ["foo", "bar"]
    const inlineArr = rawValue.match(/^\[(.*)\]$/)
    if (inlineArr) {
      const items = inlineArr[1].split(',').map(s => unquote(s.trim())).filter(Boolean)
      result[key] = items
      continue
    }

    // null
    if (rawValue === 'null' || rawValue === '~') {
      result[key] = null
      continue
    }

    // número
    if (/^-?\d+(\.\d+)?$/.test(rawValue)) {
      result[key] = Number(rawValue)
      continue
    }

    // string normal
    result[key] = unquote(rawValue)
  }

  return result as unknown as FichaFrontmatter
}

/**
 * Parsea un archivo .md con frontmatter YAML entre `---`.
 * Devuelve { frontmatter, body }.
 */
function parseMarkdownWithFrontmatter(text: string): { frontmatter: FichaFrontmatter; body: string } {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/)
  if (!match) {
    return { frontmatter: {} as FichaFrontmatter, body: text }
  }
  const frontmatter = parseFrontmatter(match[1])
  const body = match[2]
  return { frontmatter, body }
}

/* ---------- Index ---------- */

let FICHAS_INDEX: Ficha[] = []

/**
 * Carga todas las fichas .md de la carpeta agentFichas/.
 * Se llama una vez al arrancar el servidor.
 */
export function loadAllFichas(): void {
  const fichasDir = join(__dirname, 'agentFichas')
  if (!existsSync(fichasDir)) {
    console.log(`📚 No agentFichas/ dir, skipping fichas load`)
    FICHAS_INDEX = []
    return
  }
  const files = readdirSync(fichasDir).filter(f => f.endsWith('.md'))
  const loaded: Ficha[] = []
  for (const filename of files) {
    try {
      const text = readFileSync(join(fichasDir, filename), 'utf-8')
      const { frontmatter, body } = parseMarkdownWithFrontmatter(text)
      const slug = frontmatter.program_slug || filename.replace(/\.md$/, '')
      const aliases = (frontmatter.aliases || []).filter(a => typeof a === 'string' && a.length > 0)
      const organisms = (frontmatter.organisms || []).filter(o => typeof o === 'string' && o.length > 0)
      loaded.push({
        filename,
        slug,
        frontmatter,
        body,
        aliasesLower: aliases.map(a => a.toLowerCase()),
        organismsLower: organisms.map(o => o.toLowerCase()),
      })
      console.log(`📚 Loaded ficha "${slug}" (${aliases.length} aliases, ${organisms.length} organisms)`)
    } catch (err) {
      console.error(`📚 Failed to load ficha ${filename}:`, err instanceof Error ? err.message : err)
    }
  }
  FICHAS_INDEX = loaded
  console.log(`📚 Total fichas indexed: ${loaded.length}`)
}

/**
 * Busca fichas que matcheen con el título / organismo / id de una call.
 * Match si CUALQUIER alias aparece en el texto de la call (case-insensitive)
 * o si el organism declarado en la ficha aparece en el organism de la call.
 *
 * Devuelve la lista de fichas relevantes (puede ser 0, 1 o más si varias
 * fichas comparten organismo — raro pero posible para programas hermanos).
 */
export function matchFichasForCall(args: {
  title?: string
  organism?: string
  callId?: string
  description?: string
}): Ficha[] {
  if (FICHAS_INDEX.length === 0) return []

  const hay = [args.title, args.organism, args.callId, args.description]
    .filter(Boolean)
    .map(s => (s as string).toLowerCase())
    .join(' | ')

  if (!hay) return []

  return FICHAS_INDEX.filter(f => {
    // Match por alias con BOUNDARIES en TODOS los casos.
    //
    // Una versión anterior usaba substring sin boundaries para aliases largos,
    // pero eso provocaba falsos positivos como "Ayuda LIC" matcheando dentro
    // de "Ayuda LICA Andalucía". Aplicando boundary check siempre:
    //  - "LIC" no matchea en "LICA" (sin separador después)
    //  - "Línea Directa de Innovación" sigue matcheando en
    //    "Convocatoria Línea Directa de Innovación 2026" (separadores OK)
    // Trade-off: más estricto, más preciso, menos ambigüedades.
    return f.aliasesLower.some(alias => {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // Boundary = inicio/fin de cadena o cualquier separador típico
      const re = new RegExp(`(^|[\\s\\-_/.,;:()])${escaped}([\\s\\-_/.,;:()]|$)`, 'i')
      return re.test(hay)
    })
  })
}

/**
 * Construye un bloque de texto para inyectar en el prompt del agente,
 * con el contenido de TODAS las fichas matcheadas para una call.
 * Si no hay match, devuelve string vacío.
 */
export function buildFichaPromptBlock(args: {
  title?: string
  organism?: string
  callId?: string
  description?: string
}): string {
  const matched = matchFichasForCall(args)
  if (matched.length === 0) return ''

  const blocks = matched.map(f => {
    // Incluimos slug + body completo. El body ya tiene secciones markdown que
    // el modelo lee perfectamente.
    return `### KNOWLEDGE BASE — ${f.slug.toUpperCase()} (${f.frontmatter.organisms?.join(', ') || 'unknown organism'})

${f.body.trim()}`
  })

  return `

═══════════════════════════════════════════════════════════════════════
📚 PROGRAM KNOWLEDGE BASE — use these fiches as authoritative reference
═══════════════════════════════════════════════════════════════════════
The following ficha(s) match THIS specific call. They contain detailed
eligibility, scoring criteria, anti-patterns, canonical examples, and
profile-specific tips. USE THEM to:
  1. Score the call's fit accurately (the ficha contains rules and
     positive sector hints — calibrate fitScore against the canonical
     examples in section 9).
  2. Generate applicationGuidance that is CONCRETE and grounded in the
     ficha (use the anti-patterns from section 11, the per-profile tips
     from section 10, and the evaluation criteria from section 5).
  3. Decide if the project should be derived to a SIMILAR ALTERNATIVE
     (listed in frontmatter) when the fit is weak.

${blocks.join('\n\n---\n\n')}
═══════════════════════════════════════════════════════════════════════
END OF KNOWLEDGE BASE
═══════════════════════════════════════════════════════════════════════
`
}

/** Devuelve el índice actual (para debugging/inspección). */
export function getFichasIndex(): Ficha[] {
  return FICHAS_INDEX
}
