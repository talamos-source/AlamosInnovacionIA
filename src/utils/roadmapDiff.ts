/* ============================================================
   Roadmap diff — comparativa entre dos versiones de un roadmap
   ============================================================
   Función pura sin dependencias React. Recibe dos sets de
   recomendaciones (sorted no es obligatorio) y devuelve:
     · added: recs en B que no estaban en A
     · removed: recs en A que ya no están en B
     · modified: recs presentes en ambos con cambios significativos
     · unchanged: recs idénticas
   ============================================================ */

/** Shape mínimo que necesitamos para el diff (subset de RoadmapRecommendation) */
export interface DiffableRec {
  callId: string
  title: string
  source: 'EU_PORTAL' | 'BDNS'
  fitScore: number
  reasoning?: string
  recommendedMonth: string
  estimatedFundingRange: string
  risks?: string
  priorityOrder: number
  applicationGuidance?: string
  expectedStartTRL?: number
  expectedEndTRL?: number
  techLineId?: string | null
}

export interface FieldChange<T> {
  field: string
  before: T
  after: T
}

export interface ModifiedRec {
  before: DiffableRec
  after: DiffableRec
  changes: FieldChange<unknown>[]
}

export interface RoadmapDiffResult {
  added: DiffableRec[]
  removed: DiffableRec[]
  modified: ModifiedRec[]
  unchanged: DiffableRec[]
  /** Resumen rápido para el header del modal */
  summary: {
    addedCount: number
    removedCount: number
    modifiedCount: number
    unchangedCount: number
    totalChanges: number
  }
}

/**
 * Compara dos sets de recomendaciones por callId. Para recs presentes
 * en ambos, detecta cambios en los campos significativos.
 *
 * @param previous El roadmap anterior (referencia)
 * @param current El roadmap actual (el que compara)
 */
export function diffRoadmaps(previous: DiffableRec[], current: DiffableRec[]): RoadmapDiffResult {
  const prevMap = new Map(previous.map(r => [r.callId, r]))
  const currMap = new Map(current.map(r => [r.callId, r]))

  // Added: están en current pero no en previous
  const added: DiffableRec[] = current.filter(r => !prevMap.has(r.callId))

  // Removed: están en previous pero no en current
  const removed: DiffableRec[] = previous.filter(r => !currMap.has(r.callId))

  // En ambos: chequear modificaciones
  const modified: ModifiedRec[] = []
  const unchanged: DiffableRec[] = []
  for (const curr of current) {
    const prev = prevMap.get(curr.callId)
    if (!prev) continue
    const changes = detectChanges(prev, curr)
    if (changes.length > 0) {
      modified.push({ before: prev, after: curr, changes })
    } else {
      unchanged.push(curr)
    }
  }

  return {
    added,
    removed,
    modified,
    unchanged,
    summary: {
      addedCount: added.length,
      removedCount: removed.length,
      modifiedCount: modified.length,
      unchangedCount: unchanged.length,
      totalChanges: added.length + removed.length + modified.length,
    },
  }
}

/**
 * Detecta cambios significativos entre 2 versiones de una misma rec.
 * Solo reporta deltas humanos (no diffs de cadena en reasoning si solo
 * cambia espaciado, etc.).
 */
function detectChanges(prev: DiffableRec, curr: DiffableRec): FieldChange<unknown>[] {
  const changes: FieldChange<unknown>[] = []

  // Priority order — cambio si el delta >= 1
  if (prev.priorityOrder !== curr.priorityOrder) {
    changes.push({ field: 'priorityOrder', before: prev.priorityOrder, after: curr.priorityOrder })
  }

  // Fit score — cambio si delta >= 3 (cambios menores son ruido del agente)
  if (Math.abs((prev.fitScore || 0) - (curr.fitScore || 0)) >= 3) {
    changes.push({ field: 'fitScore', before: prev.fitScore, after: curr.fitScore })
  }

  // Recommended month — cualquier cambio
  if (prev.recommendedMonth !== curr.recommendedMonth) {
    changes.push({ field: 'recommendedMonth', before: prev.recommendedMonth, after: curr.recommendedMonth })
  }

  // Estimated funding range — cualquier cambio
  if ((prev.estimatedFundingRange || '').trim() !== (curr.estimatedFundingRange || '').trim()) {
    changes.push({
      field: 'estimatedFundingRange',
      before: prev.estimatedFundingRange || '—',
      after: curr.estimatedFundingRange || '—',
    })
  }

  // TRL ranges
  if (prev.expectedStartTRL !== curr.expectedStartTRL) {
    changes.push({ field: 'expectedStartTRL', before: prev.expectedStartTRL, after: curr.expectedStartTRL })
  }
  if (prev.expectedEndTRL !== curr.expectedEndTRL) {
    changes.push({ field: 'expectedEndTRL', before: prev.expectedEndTRL, after: curr.expectedEndTRL })
  }

  // Tech line — cambio si distintos (incluyendo null)
  if ((prev.techLineId ?? null) !== (curr.techLineId ?? null)) {
    changes.push({ field: 'techLineId', before: prev.techLineId ?? null, after: curr.techLineId ?? null })
  }

  return changes
}

/* ---------- Helpers de formateo para presentación ---------- */

export const formatChangeFieldLabel = (field: string): string => {
  const labels: Record<string, string> = {
    priorityOrder: 'Prioridad',
    fitScore: 'Fit score',
    recommendedMonth: 'Cuándo aplicar',
    estimatedFundingRange: 'Presupuesto estimado',
    expectedStartTRL: 'TRL inicial',
    expectedEndTRL: 'TRL final',
    techLineId: 'Línea técnica asignada',
  }
  return labels[field] || field
}

export const formatChangeValue = (field: string, value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—'
  if (field === 'recommendedMonth' && typeof value === 'string') {
    // YYYY-MM → "Sep 2026"
    const [y, m] = value.split('-')
    const date = new Date(Number(y), Number(m) - 1, 1)
    return date.toLocaleString('es-ES', { month: 'short', year: 'numeric' })
  }
  if (field === 'priorityOrder') return `#${value}`
  if (field === 'fitScore') return `${value}`
  if (field === 'expectedStartTRL' || field === 'expectedEndTRL') {
    return `TRL ${value}`
  }
  return String(value)
}

/**
 * Devuelve un delta human-readable para cambios numéricos.
 * Ej: priorityOrder 7 → 4 = "↑ subió 3 posiciones"
 *     fitScore 70 → 78 = "+8"
 */
export const formatChangeDelta = (field: string, before: unknown, after: unknown): string | null => {
  if (typeof before !== 'number' || typeof after !== 'number') return null
  const delta = after - before
  if (delta === 0) return null
  if (field === 'priorityOrder') {
    // En priority menor es mejor
    return delta < 0 ? `↑ subió ${Math.abs(delta)} posiciones` : `↓ bajó ${delta} posiciones`
  }
  if (field === 'fitScore') {
    return delta > 0 ? `+${delta}` : `${delta}`
  }
  if (field === 'expectedStartTRL' || field === 'expectedEndTRL') {
    return delta > 0 ? `+${delta} nivel${Math.abs(delta) > 1 ? 'es' : ''}` : `${delta} nivel${Math.abs(delta) > 1 ? 'es' : ''}`
  }
  return null
}
