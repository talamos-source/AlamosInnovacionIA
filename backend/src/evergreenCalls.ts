/**
 * Catálogo formal de programas EVERGREEN de I+D+i — recurrent o permanently-open calls
 * que no aparecen siempre en Discovery pero son siempre candidatos potenciales.
 *
 * Se inyectan en el input del agente del roadmap como calls "virtuales" con synthetic IDs.
 * El agente las trata como cualquier otra call y aplica las mismas eligibility rules.
 *
 * Mantenimiento: añade aquí cuando aparezca un nuevo programa relevante. Las URL deben
 * ser oficiales. Los presupuestos y TRL son orientativos basados en convocatorias previas.
 */

export type EvergreenCadence = 'permanent' | 'annual' | 'biannual'

export interface EvergreenCall {
  /** Synthetic callId que el agente usa en sus recomendaciones */
  externalId: string
  organism: string                     // 'CDTI', 'AEI', 'EIC', 'Eureka', 'EU Commission'
  programme: string                    // nombre corto del programa
  fullName: string                     // título completo legible
  source: 'BDNS' | 'EU_PORTAL'         // dónde se busca (nacional vs EU)
  cadence: EvergreenCadence
  /** Cuándo abre típicamente (texto libre, ej "May-June each year") */
  typicalOpenWindow?: string
  url: string
  /** Presupuesto típico en EUR */
  typicalBudgetEUR: { min: number; max: number }
  /** TRL elegibles */
  typicalTRL: { min: number; max: number }
  eligibility: {
    maxCompanyAgeYears?: number        // NEOTEC: 3
    sizes: Array<'pyme' | 'mediana' | 'grande' | 'startup'>
    requiresConsortium: boolean
    requiresInternational: boolean
    /** Si true: el cliente solo puede ganarlo una vez en su vida (NEOTEC) */
    onceInLifetime: boolean
  }
  /** Tags semánticos para matching contra el cliente */
  sectorTags: string[]
  /** Descripción breve (1-2 frases) para el agente */
  description: string
}

/* ============================================================================
   NACIONALES — CDTI + AEI
   ============================================================================ */

const NATIONAL_EVERGREEN: EvergreenCall[] = [
  // ─── CDTI permanentes ───
  {
    externalId: 'CDTI-PID-PERMANENT',
    organism: 'CDTI',
    programme: 'Proyectos I+D',
    fullName: 'CDTI — Proyectos de I+D',
    source: 'BDNS',
    cadence: 'permanent',
    url: 'https://www.cdti.es/ayudas/proyectos-de-i-d',
    typicalBudgetEUR: { min: 175_000, max: 5_000_000 },
    typicalTRL: { min: 4, max: 9 },
    eligibility: {
      sizes: ['pyme', 'mediana', 'grande'],
      requiresConsortium: false,
      requiresInternational: false,
      onceInLifetime: false,
    },
    sectorTags: ['I+D', 'desarrollo tecnológico', 'innovación', 'industrial', 'tech', 'todos los sectores'],
    description: 'Ayuda parcialmente reembolsable para proyectos de desarrollo tecnológico que generen producto/proceso nuevo o mejora sustancial. Individual o consorcio. Open permanently.',
  },
  {
    externalId: 'CDTI-CERVERA-PERMANENT',
    organism: 'CDTI',
    programme: 'Cervera I+D Transferencia',
    fullName: 'CDTI — Proyectos I+D de Transferencia Tecnológica Cervera',
    source: 'BDNS',
    cadence: 'permanent',
    url: 'https://www.cdti.es/ayudas/proyectos-de-id-de-transferencia-tecnologica-cervera-0',
    typicalBudgetEUR: { min: 175_000, max: 5_000_000 },
    typicalTRL: { min: 4, max: 9 },
    eligibility: {
      sizes: ['pyme', 'mediana', 'grande'],
      requiresConsortium: true, // requiere Centro Tecnológico
      requiresInternational: false,
      onceInLifetime: false,
    },
    sectorTags: ['transferencia tecnológica', 'I+D', 'centro tecnológico', 'industrial', 'tech'],
    description: 'Como PID pero requiere colaboración formal con Centro Tecnológico Cervera. Subvención adicional al préstamo reembolsable.',
  },
  {
    externalId: 'CDTI-LINEA-DIRECTA-INN-PERMANENT',
    organism: 'CDTI',
    programme: 'Línea Directa Innovación',
    fullName: 'CDTI — Línea Directa de Innovación',
    source: 'BDNS',
    cadence: 'permanent',
    url: 'https://www.cdti.es/ayudas/linea-directa-de-innovacion',
    typicalBudgetEUR: { min: 175_000, max: 2_000_000 },
    typicalTRL: { min: 7, max: 9 },
    eligibility: {
      sizes: ['pyme', 'mediana', 'grande'],
      requiresConsortium: false,
      requiresInternational: false,
      onceInLifetime: false,
    },
    sectorTags: ['innovación', 'industrialización', 'tech', 'industrial', 'mejora proceso'],
    description: 'Préstamo parcialmente reembolsable para incorporar tecnologías innovadoras en empresas. TRL alto (producto ya desarrollado). Open permanently.',
  },
  {
    externalId: 'CDTI-LINEA-DIRECTA-EXPANSION-PERMANENT',
    organism: 'CDTI',
    programme: 'Línea Directa Expansión',
    fullName: 'CDTI — Línea Directa de Expansión',
    source: 'BDNS',
    cadence: 'permanent',
    url: 'https://www.cdti.es/ayudas/linea-directa-de-expansion',
    typicalBudgetEUR: { min: 175_000, max: 3_000_000 },
    typicalTRL: { min: 8, max: 9 },
    eligibility: {
      sizes: ['pyme', 'mediana'],
      requiresConsortium: false,
      requiresInternational: false,
      onceInLifetime: false,
    },
    sectorTags: ['escalado', 'expansión', 'crecimiento', 'industrialización', 'tech'],
    description: 'Préstamo para escalado de empresas innovadoras. Inversión en infraestructura/equipos productivos para producto ya validado.',
  },
  {
    externalId: 'CDTI-INFRAESTRUCTURAS-PERMANENT',
    organism: 'CDTI',
    programme: 'Infraestructuras Ensayo',
    fullName: 'CDTI — Línea de Ayudas a Infraestructuras de Ensayo y Experimentación',
    source: 'BDNS',
    cadence: 'permanent',
    url: 'https://www.cdti.es/ayudas/linea-de-ayudas-infraestructuras-de-ensayo-y-experimentacion',
    typicalBudgetEUR: { min: 200_000, max: 2_000_000 },
    typicalTRL: { min: 3, max: 8 },
    eligibility: {
      sizes: ['pyme', 'mediana', 'grande'],
      requiresConsortium: false,
      requiresInternational: false,
      onceInLifetime: false,
    },
    sectorTags: ['infraestructura', 'laboratorios', 'equipamiento', 'ensayo', 'testing'],
    description: 'Subvención para crear/ampliar infraestructuras tecnológicas de ensayo y experimentación. Útil para empresas tech con necesidad de capacidad laboratorio.',
  },

  // ─── CDTI/AEI anuales ───
  {
    externalId: 'CDTI-NEOTEC-ANNUAL-2026',
    organism: 'CDTI',
    programme: 'NEOTEC',
    fullName: 'CDTI — NEOTEC (Empresas de Base Tecnológica)',
    source: 'BDNS',
    cadence: 'annual',
    typicalOpenWindow: 'May-June each year',
    url: 'https://www.cdti.es/ayudas/ayudas-neotec',
    typicalBudgetEUR: { min: 100_000, max: 325_000 },
    typicalTRL: { min: 4, max: 7 },
    eligibility: {
      maxCompanyAgeYears: 3,
      sizes: ['startup', 'pyme'],
      requiresConsortium: false,
      requiresInternational: false,
      onceInLifetime: true,
    },
    sectorTags: ['EBT', 'startup', 'tech', 'I+D', 'innovación', 'base tecnológica'],
    description: 'Subvención no reembolsable para EBT con producto innovador. Solo empresas ≤3 años. ONCE-IN-LIFETIME por empresa. ≤ €325K, 70% cofinanciación.',
  },
  {
    externalId: 'CDTI-MISIONES-ANNUAL-2026',
    organism: 'CDTI',
    programme: 'Misiones',
    fullName: 'CDTI — Misiones de Ciencia e Innovación',
    source: 'BDNS',
    cadence: 'annual',
    typicalOpenWindow: 'Sept-Oct each year',
    url: 'https://www.cdti.es/ayudas/misiones-ciencia-e-innovacion',
    typicalBudgetEUR: { min: 5_000_000, max: 10_000_000 },
    typicalTRL: { min: 4, max: 7 },
    eligibility: {
      sizes: ['pyme', 'mediana', 'grande'],
      requiresConsortium: true,
      requiresInternational: false,
      onceInLifetime: false,
    },
    sectorTags: ['consorcio', 'misiones', 'gran reto', 'transformación', 'industrial', 'tech'],
    description: 'Proyectos en consorcio de alta ambición tecnológica alineados con las Misiones (transición digital, climática, salud). Mínimo 3 empresas. €5-10M.',
  },
  {
    externalId: 'CDTI-INNTERCONECTA-STEP-ANNUAL-2026',
    organism: 'CDTI',
    programme: 'Innterconecta STEP',
    fullName: 'CDTI — Innterconecta STEP',
    source: 'BDNS',
    cadence: 'annual',
    typicalOpenWindow: 'Feb-Mar each year',
    url: 'https://www.cdti.es/ayudas/innterconecta-step',
    typicalBudgetEUR: { min: 1_000_000, max: 4_000_000 },
    typicalTRL: { min: 4, max: 7 },
    eligibility: {
      sizes: ['pyme', 'mediana'],
      requiresConsortium: true,
      requiresInternational: false,
      onceInLifetime: false,
    },
    sectorTags: ['consorcio regional', 'I+D', 'STEP', 'tech', 'industrial'],
    description: 'I+D en consorcio regional, focus en tecnologías estratégicas STEP. Especialmente para Andalucía, Castilla-La Mancha, Extremadura.',
  },
  {
    externalId: 'AEI-TORRES-QUEVEDO-ANNUAL-2026',
    organism: 'Agencia Estatal de Investigación',
    programme: 'Torres Quevedo',
    fullName: 'AEI — Torres Quevedo (contratación de doctores en empresa)',
    source: 'BDNS',
    cadence: 'annual',
    typicalOpenWindow: 'Oct-Nov each year',
    url: 'https://www.aei.gob.es/convocatorias',
    typicalBudgetEUR: { min: 55_000, max: 165_000 },
    typicalTRL: { min: 3, max: 8 },
    eligibility: {
      sizes: ['pyme', 'mediana', 'grande'],
      requiresConsortium: false,
      requiresInternational: false,
      onceInLifetime: false,
    },
    sectorTags: ['doctorado', 'RRHH', 'investigación', 'contratación', 'I+D'],
    description: 'Subvención para contratar un doctor en empresa por 3 años para proyecto I+D específico. ~€55K/año.',
  },
  {
    externalId: 'AEI-DOCTORADOS-INDUSTRIALES-ANNUAL-2026',
    organism: 'Agencia Estatal de Investigación',
    programme: 'Doctorados Industriales',
    fullName: 'AEI — Doctorados Industriales',
    source: 'BDNS',
    cadence: 'annual',
    typicalOpenWindow: 'Oct-Nov each year',
    url: 'https://www.aei.gob.es/convocatorias',
    typicalBudgetEUR: { min: 100_000, max: 200_000 },
    typicalTRL: { min: 2, max: 6 },
    eligibility: {
      sizes: ['pyme', 'mediana', 'grande'],
      requiresConsortium: true, // universidad
      requiresInternational: false,
      onceInLifetime: false,
    },
    sectorTags: ['doctorado', 'universidad', 'colaboración', 'investigación'],
    description: 'Contrato de 4 años para doctorando que desarrolla su tesis en empresa con co-tutorización universidad. Refuerza vínculo academia-industria.',
  },
  {
    externalId: 'AEI-COLABORACION-PUBLICO-PRIVADA-ANNUAL-2026',
    organism: 'Agencia Estatal de Investigación',
    programme: 'Colaboración Público-Privada',
    fullName: 'AEI — Colaboración Público-Privada',
    source: 'BDNS',
    cadence: 'annual',
    typicalOpenWindow: 'Mar-Apr each year',
    url: 'https://www.aei.gob.es/convocatorias',
    typicalBudgetEUR: { min: 250_000, max: 1_500_000 },
    typicalTRL: { min: 3, max: 7 },
    eligibility: {
      sizes: ['pyme', 'mediana', 'grande'],
      requiresConsortium: true, // OPI + empresa
      requiresInternational: false,
      onceInLifetime: false,
    },
    sectorTags: ['consorcio', 'OPI', 'universidad', 'colaboración', 'I+D'],
    description: 'I+D en consorcio universidad/OPI + empresa. La empresa lidera. Subvención para parte universitaria.',
  },
]

/* ============================================================================
   EUROPEAS — Horizon Europe + EIC + Eureka + EU programmes
   ============================================================================ */

const EU_EVERGREEN: EvergreenCall[] = [
  {
    externalId: 'EIC-ACCELERATOR-2026',
    organism: 'European Innovation Council',
    programme: 'EIC Accelerator',
    fullName: 'EIC Accelerator — Deep-tech scaleups',
    source: 'EU_PORTAL',
    cadence: 'biannual',
    typicalOpenWindow: 'Two cutoffs per year (Mar + Oct typically)',
    url: 'https://eic.ec.europa.eu/eic-funding-opportunities/eic-accelerator_en',
    typicalBudgetEUR: { min: 500_000, max: 17_500_000 },
    typicalTRL: { min: 5, max: 9 },
    eligibility: {
      sizes: ['pyme', 'startup'],
      requiresConsortium: false,
      requiresInternational: false,
      onceInLifetime: false,
    },
    sectorTags: ['deep tech', 'scaleup', 'mercado', 'innovación disruptiva', 'PYME'],
    description: 'Grant + equity (€2.5M + hasta €15M equity) para PYME deep-tech con producto market-ready. Muy competitivo, evaluación con pitch.',
  },
  {
    externalId: 'EIC-PATHFINDER-2026',
    organism: 'European Innovation Council',
    programme: 'EIC Pathfinder',
    fullName: 'EIC Pathfinder — Early-stage breakthrough research',
    source: 'EU_PORTAL',
    cadence: 'biannual',
    typicalOpenWindow: 'Two cutoffs per year',
    url: 'https://eic.ec.europa.eu/eic-funding-opportunities/eic-pathfinder_en',
    typicalBudgetEUR: { min: 2_000_000, max: 4_000_000 },
    typicalTRL: { min: 1, max: 3 },
    eligibility: {
      sizes: ['pyme', 'mediana', 'grande'],
      requiresConsortium: true,
      requiresInternational: true,
      onceInLifetime: false,
    },
    sectorTags: ['investigación básica', 'breakthrough', 'consorcio internacional', 'TRL bajo'],
    description: 'Investigación de alto riesgo / alta recompensa. TRL 1-3. Consorcio ≥3 entidades de ≥3 países. €3M típico.',
  },
  {
    externalId: 'EIC-TRANSITION-2026',
    organism: 'European Innovation Council',
    programme: 'EIC Transition',
    fullName: 'EIC Transition — Research-to-market bridge',
    source: 'EU_PORTAL',
    cadence: 'biannual',
    typicalOpenWindow: 'Two cutoffs per year',
    url: 'https://eic.ec.europa.eu/eic-funding-opportunities/eic-transition_en',
    typicalBudgetEUR: { min: 500_000, max: 2_500_000 },
    typicalTRL: { min: 3, max: 6 },
    eligibility: {
      sizes: ['pyme', 'mediana', 'grande'],
      requiresConsortium: false,
      requiresInternational: false,
      onceInLifetime: false,
    },
    sectorTags: ['valorización', 'transferencia', 'research-to-market', 'TRL medio'],
    description: 'Valoriza resultados de Horizon/Pathfinder previos hacia mercado. TRL 3-6. €2.5M, individual o pequeño consorcio.',
  },
  {
    externalId: 'EIC-STEP-SCALE-2026',
    organism: 'European Innovation Council',
    programme: 'STEP Scale Up',
    fullName: 'EIC STEP Scale up — Strategic Tech Platform',
    source: 'EU_PORTAL',
    cadence: 'annual',
    url: 'https://eic.ec.europa.eu/eic-funding-opportunities/step-scale_en',
    typicalBudgetEUR: { min: 5_000_000, max: 30_000_000 },
    typicalTRL: { min: 6, max: 9 },
    eligibility: {
      sizes: ['pyme', 'mediana', 'grande'],
      requiresConsortium: false,
      requiresInternational: false,
      onceInLifetime: false,
    },
    sectorTags: ['STEP', 'scaleup', 'deep tech', 'tecnologías estratégicas EU'],
    description: 'Para escalado de tecnologías estratégicas EU (chips, IA, biotech, cleantech). Equity + grant. Alta inversión.',
  },
  {
    externalId: 'EUROSTARS-2026',
    organism: 'Eureka',
    programme: 'Eurostars',
    fullName: 'Eurostars — Consortium SMEs from Eureka countries',
    source: 'EU_PORTAL',
    cadence: 'biannual',
    typicalOpenWindow: 'Two cutoffs per year (Feb + Sep typically)',
    url: 'https://www.eurekanetwork.org/programmes-and-calls/eurostars/',
    typicalBudgetEUR: { min: 500_000, max: 1_500_000 },
    typicalTRL: { min: 3, max: 8 },
    eligibility: {
      sizes: ['pyme'],
      requiresConsortium: true,
      requiresInternational: true,
      onceInLifetime: false,
    },
    sectorTags: ['consorcio internacional', 'PYME', 'Eureka', 'producto comercial'],
    description: 'Consorcio PYME de ≥2 países Eureka. Producto innovador market-ready en <3 años. €500K-1.5M, 60-70% cofinanciación.',
  },
  {
    externalId: 'INNOWWIDE-2026',
    organism: 'Eureka',
    programme: 'Innowwide',
    fullName: 'Eureka Innowwide — Viability assessment international',
    source: 'EU_PORTAL',
    cadence: 'annual',
    url: 'https://www.eurekanetwork.org/programmes-and-calls/innowwide/',
    typicalBudgetEUR: { min: 50_000, max: 60_000 },
    typicalTRL: { min: 5, max: 8 },
    eligibility: {
      sizes: ['pyme'],
      requiresConsortium: false,
      requiresInternational: true, // mercado fuera UE
      onceInLifetime: false,
    },
    sectorTags: ['internacionalización', 'estudio viabilidad', 'mercado fuera UE'],
    description: 'Estudio de viabilidad técnico-comercial en país fuera de UE. €60K subvención para PYME. Útil para internationalization.',
  },
  {
    externalId: 'EUREKA-CLUSTERS-2026',
    organism: 'Eureka',
    programme: 'Eureka Clusters',
    fullName: 'Eureka Clusters (ITEA, CELTIC-NEXT, EUROGIA, Smart Cities)',
    source: 'EU_PORTAL',
    cadence: 'annual',
    url: 'https://www.eurekanetwork.org/programmes-and-calls/',
    typicalBudgetEUR: { min: 500_000, max: 5_000_000 },
    typicalTRL: { min: 4, max: 8 },
    eligibility: {
      sizes: ['pyme', 'mediana', 'grande'],
      requiresConsortium: true,
      requiresInternational: true,
      onceInLifetime: false,
    },
    sectorTags: ['consorcio internacional', 'ITEA', 'CELTIC-NEXT', 'IT', 'industrial', 'energy', 'smart cities'],
    description: 'Clusters Eureka por sector: ITEA (software/embedded), CELTIC-NEXT (telecom), EUROGIA (energy/green), Smart Cities. Cada uno con call anual.',
  },
  {
    externalId: 'EIT-2026',
    organism: 'European Institute of Innovation & Technology',
    programme: 'EIT KICs',
    fullName: 'EIT — Innovation Communities (Climate, Digital, Health, Food, Urban Mobility, Manufacturing, RawMaterials, InnoEnergy)',
    source: 'EU_PORTAL',
    cadence: 'annual',
    url: 'https://eit.europa.eu/our-activities/calls-for-proposals',
    typicalBudgetEUR: { min: 100_000, max: 2_000_000 },
    typicalTRL: { min: 4, max: 9 },
    eligibility: {
      sizes: ['pyme', 'mediana', 'startup'],
      requiresConsortium: false,
      requiresInternational: false,
      onceInLifetime: false,
    },
    sectorTags: ['EIT', 'climate', 'digital', 'health', 'food', 'mobility', 'manufacturing', 'innovation community'],
    description: 'Calls sectoriales de las 8 Knowledge Innovation Communities (KICs). Cada KIC tiene sus propias condiciones. Programas de aceleración + grants.',
  },
  {
    externalId: 'LIFE-2026',
    organism: 'CINEA / EU Commission',
    programme: 'LIFE Programme',
    fullName: 'LIFE — Environment & Climate Action',
    source: 'EU_PORTAL',
    cadence: 'annual',
    typicalOpenWindow: 'Apr-Sep each year',
    url: 'https://cinea.ec.europa.eu/programmes/life_en',
    typicalBudgetEUR: { min: 1_000_000, max: 10_000_000 },
    typicalTRL: { min: 4, max: 8 },
    eligibility: {
      sizes: ['pyme', 'mediana', 'grande'],
      requiresConsortium: true,
      requiresInternational: false,
      onceInLifetime: false,
    },
    sectorTags: ['LIFE', 'environment', 'climate', 'sustainability', 'green', 'biodiversity', 'circular economy'],
    description: 'Acción ambiental, biodiversidad, mitigación climática, gobernanza. Subvención 60%, consorcio europeo recomendado. €1-10M.',
  },
  {
    externalId: 'ERASMUS-PLUS-2026',
    organism: 'EACEA / EU Commission',
    programme: 'Erasmus+',
    fullName: 'Erasmus+ — Knowledge alliances, strategic partnerships',
    source: 'EU_PORTAL',
    cadence: 'annual',
    typicalOpenWindow: 'Oct-Mar each year',
    url: 'https://erasmus-plus.ec.europa.eu/es/funding-calls',
    typicalBudgetEUR: { min: 200_000, max: 1_000_000 },
    typicalTRL: { min: 4, max: 9 },
    eligibility: {
      sizes: ['pyme', 'mediana', 'grande'],
      requiresConsortium: true,
      requiresInternational: true,
      onceInLifetime: false,
    },
    sectorTags: ['educación', 'formación', 'knowledge alliances', 'cooperation'],
    description: 'Alianzas universidad-empresa para innovación pedagógica/sectorial. Asociaciones estratégicas. Ideal para empresas con vertiente formativa.',
  },
]

/* ============================================================================
   EXPORT — lista completa
   ============================================================================ */

export const EVERGREEN_CALLS: EvergreenCall[] = [
  ...NATIONAL_EVERGREEN,
  ...EU_EVERGREEN,
]

/**
 * Convierte un EvergreenCall a formato NormalizedCall para inyectarlo en el input del agente.
 * El agente lo tratará como una call normal con su synthetic ID.
 */
export function evergreenAsNormalized(e: EvergreenCall): {
  externalId: string
  source: 'EU_PORTAL' | 'BDNS'
  title: string
  fundingBody: string
  program: string
  typeOfAction?: string
  openDate?: string
  closeDate?: string
  budget?: string
  externalStatus: 'open' | 'forthcoming' | 'closed' | 'unknown'
  url: string
  description?: string
  geographicScope?: 'European' | 'National' | 'Regional' | 'International'
  aidType?: 'Grant' | 'Loan' | 'Mixed' | 'Tax Credit'
  actionable: boolean
  region?: string
  rdiScore?: number
  rdiReasons?: string[]
} {
  const budgetText = `€${(e.typicalBudgetEUR.min / 1000).toFixed(0)}K - €${(e.typicalBudgetEUR.max / 1000).toFixed(0)}K`
  // Cadence info va en typeOfAction (no en description) para que no contamine
  // el title que el agente extrae para las recomendaciones.
  // NO usamos la palabra "evergreen" para evitar que el agente la copie como tag.
  const typeOfAction = e.cadence === 'permanent'
    ? 'Permanently open'
    : `Recurrent ${e.cadence} call${e.typicalOpenWindow ? ` — ${e.typicalOpenWindow}` : ''}`
  // Description LIMPIO (sin prefijos tipo [Evergreen X]) — solo metadata útil
  const desc = `${e.description} | TRL ${e.typicalTRL.min}-${e.typicalTRL.max} | Sizes: ${e.eligibility.sizes.join(',')}${e.eligibility.requiresConsortium ? ' | requires consortium' : ''}${e.eligibility.requiresInternational ? ' | requires international partners' : ''}${e.eligibility.onceInLifetime ? ' | ONCE-IN-LIFETIME' : ''}${e.eligibility.maxCompanyAgeYears ? ` | max company age ${e.eligibility.maxCompanyAgeYears}y` : ''} | Tags: ${e.sectorTags.join(', ')}`

  return {
    externalId: e.externalId,
    source: e.source,
    title: e.fullName,
    fundingBody: e.organism,
    program: e.programme,
    typeOfAction,
    openDate: undefined,
    closeDate: undefined, // evergreen: no deadline fija
    budget: budgetText,
    externalStatus: e.cadence === 'permanent' ? 'open' : 'forthcoming',
    url: e.url,
    description: desc,
    geographicScope: e.source === 'EU_PORTAL' ? 'European' : 'National',
    aidType: 'Grant',
    actionable: true,
    region: e.source === 'BDNS' ? 'España (estatal)' : 'EU',
    rdiScore: 100,
    rdiReasons: ['evergreen-catalog'],
  }
}

/**
 * Devuelve todas las evergreen como NormalizedCall, listas para inyectar en el pipeline.
 */
export function getEvergreenAsNormalizedList() {
  return EVERGREEN_CALLS.map(evergreenAsNormalized)
}
