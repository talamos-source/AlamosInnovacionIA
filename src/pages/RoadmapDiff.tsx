import { useMemo, useState } from 'react'
import { GitCompare, X, Plus, Minus, ArrowRight, Equal, ChevronDown } from 'lucide-react'
import {
  diffRoadmaps,
  formatChangeFieldLabel,
  formatChangeValue,
  formatChangeDelta,
  type DiffableRec,
} from '../utils/roadmapDiff'
import './RoadmapDiff.css'

/* ============================================================
   Tipos
   ============================================================ */

interface RoadmapVersion {
  id: string
  generatedAt: string
  timeline: 1 | 2 | 3
  result: { recommendations: DiffableRec[] }
}

interface Props {
  activeRoadmap: RoadmapVersion
  allRoadmaps: RoadmapVersion[]
  onClose: () => void
}

/* ============================================================
   Componente
   ============================================================ */

const RoadmapDiff = ({ activeRoadmap, allRoadmaps, onClose }: Props) => {
  // Roadmaps comparables: todos los del cliente excepto el actual
  const comparable = useMemo(
    () => allRoadmaps.filter(r => r.id !== activeRoadmap.id),
    [allRoadmaps, activeRoadmap],
  )

  // Selección: por defecto el más reciente que no sea el actual
  const [comparedId, setComparedId] = useState<string | null>(
    comparable[0]?.id ?? null,
  )
  const comparedRoadmap = useMemo(
    () => comparable.find(r => r.id === comparedId) || null,
    [comparedId, comparable],
  )

  // Diff (previous = el comparado, current = el activo)
  // El usuario verá "qué ha cambiado del comparado HACIA el activo"
  const diff = useMemo(() => {
    if (!comparedRoadmap) return null
    return diffRoadmaps(
      comparedRoadmap.result.recommendations,
      activeRoadmap.result.recommendations,
    )
  }, [comparedRoadmap, activeRoadmap])

  /* ---- Helpers ---- */
  const formatDate = (iso: string) => new Date(iso).toLocaleString('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  if (!comparable.length) {
    return (
      <div className="rd-overlay" onClick={onClose}>
        <div className="rd-modal rd-modal--empty" onClick={e => e.stopPropagation()}>
          <header className="rd-header">
            <h2><GitCompare size={18} /> Comparar versiones</h2>
            <button type="button" className="rd-close" onClick={onClose}><X size={18} /></button>
          </header>
          <div className="rd-empty">
            <p>Solo hay una versión del roadmap. Genera al menos otra para comparar.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rd-overlay" onClick={onClose}>
      <div className="rd-modal" onClick={e => e.stopPropagation()}>
        {/* ─── HEADER ─── */}
        <header className="rd-header">
          <div>
            <h2><GitCompare size={18} /> Comparar versiones</h2>
            <p className="muted">
              Diff entre la versión activa y otra versión anterior. Solo se reportan
              cambios significativos (fit ±3+, priority, fecha, TRL, presupuesto).
            </p>
          </div>
          <button type="button" className="rd-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        {/* ─── SELECCIÓN ─── */}
        <div className="rd-selector">
          <div className="rd-selector-side">
            <span className="rd-selector-label">COMPARANDO DESDE</span>
            <div className="rd-selector-input">
              <select value={comparedId ?? ''} onChange={e => setComparedId(e.target.value)}>
                {comparable.map(r => (
                  <option key={r.id} value={r.id}>
                    {formatDate(r.generatedAt)} · {r.timeline}y · {r.result.recommendations.length} recs
                  </option>
                ))}
              </select>
              <ChevronDown size={14} />
            </div>
          </div>
          <div className="rd-arrow"><ArrowRight size={18} /></div>
          <div className="rd-selector-side">
            <span className="rd-selector-label">HACIA (ACTIVA)</span>
            <div className="rd-selector-pill">
              {formatDate(activeRoadmap.generatedAt)} · {activeRoadmap.timeline}y ·
              {' '}{activeRoadmap.result.recommendations.length} recs
            </div>
          </div>
        </div>

        {/* ─── RESUMEN ─── */}
        {diff && (
          <div className="rd-summary">
            <div className="rd-summary-stat rd-summary-stat--added">
              <Plus size={16} />
              <div>
                <span className="rd-summary-value">{diff.summary.addedCount}</span>
                <span className="rd-summary-label">nuevas</span>
              </div>
            </div>
            <div className="rd-summary-stat rd-summary-stat--removed">
              <Minus size={16} />
              <div>
                <span className="rd-summary-value">{diff.summary.removedCount}</span>
                <span className="rd-summary-label">eliminadas</span>
              </div>
            </div>
            <div className="rd-summary-stat rd-summary-stat--modified">
              <ArrowRight size={16} />
              <div>
                <span className="rd-summary-value">{diff.summary.modifiedCount}</span>
                <span className="rd-summary-label">modificadas</span>
              </div>
            </div>
            <div className="rd-summary-stat rd-summary-stat--unchanged">
              <Equal size={16} />
              <div>
                <span className="rd-summary-value">{diff.summary.unchangedCount}</span>
                <span className="rd-summary-label">idénticas</span>
              </div>
            </div>
          </div>
        )}

        {/* ─── BODY ─── */}
        <div className="rd-body">
          {/* NUEVAS */}
          {diff && diff.added.length > 0 && (
            <section className="rd-section">
              <h3 className="rd-section-title rd-section-title--added">
                <Plus size={16} /> Nuevas recomendaciones ({diff.added.length})
              </h3>
              <ul className="rd-list">
                {diff.added.map(rec => (
                  <li key={rec.callId} className="rd-item rd-item--added">
                    <div className="rd-item-priority">#{rec.priorityOrder}</div>
                    <div className="rd-item-content">
                      <strong>{rec.title}</strong>
                      <div className="rd-item-meta">
                        {sourceLabel(rec.source)} · Fit {rec.fitScore} ·
                        {' '}Aplicar {formatMonth(rec.recommendedMonth)} · {rec.estimatedFundingRange || '—'}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ELIMINADAS */}
          {diff && diff.removed.length > 0 && (
            <section className="rd-section">
              <h3 className="rd-section-title rd-section-title--removed">
                <Minus size={16} /> Eliminadas ({diff.removed.length})
              </h3>
              <ul className="rd-list">
                {diff.removed.map(rec => (
                  <li key={rec.callId} className="rd-item rd-item--removed">
                    <div className="rd-item-priority">#{rec.priorityOrder}</div>
                    <div className="rd-item-content">
                      <strong className="rd-strike">{rec.title}</strong>
                      <div className="rd-item-meta">
                        {sourceLabel(rec.source)} · Fit {rec.fitScore} ·
                        {' '}Aplicar {formatMonth(rec.recommendedMonth)} · {rec.estimatedFundingRange || '—'}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* MODIFICADAS */}
          {diff && diff.modified.length > 0 && (
            <section className="rd-section">
              <h3 className="rd-section-title rd-section-title--modified">
                <ArrowRight size={16} /> Modificadas ({diff.modified.length})
              </h3>
              <ul className="rd-list">
                {diff.modified.map(m => (
                  <li key={m.after.callId} className="rd-item rd-item--modified">
                    <div className="rd-item-priority">#{m.after.priorityOrder}</div>
                    <div className="rd-item-content">
                      <strong>{m.after.title}</strong>
                      <ul className="rd-changes">
                        {m.changes.map((c, i) => (
                          <li key={i} className="rd-change">
                            <span className="rd-change-field">{formatChangeFieldLabel(c.field)}:</span>
                            <span className="rd-change-before">{formatChangeValue(c.field, c.before)}</span>
                            <ArrowRight size={11} className="rd-change-arrow" />
                            <span className="rd-change-after">{formatChangeValue(c.field, c.after)}</span>
                            {formatChangeDelta(c.field, c.before, c.after) && (
                              <span className="rd-change-delta">{formatChangeDelta(c.field, c.before, c.after)}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* SIN CAMBIOS (colapsado por defecto) */}
          {diff && diff.unchanged.length > 0 && (
            <UnchangedSection unchanged={diff.unchanged} />
          )}

          {/* No hay diff */}
          {diff && diff.summary.totalChanges === 0 && (
            <div className="rd-no-changes">
              <Equal size={32} />
              <p>Las dos versiones son <strong>idénticas</strong> en los campos significativos.</p>
              <p className="muted">No hay diferencias en priority, fit (±3+), fecha, TRL, presupuesto o asignación de líneas técnicas.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const UnchangedSection = ({ unchanged }: { unchanged: DiffableRec[] }) => {
  const [open, setOpen] = useState(false)
  return (
    <section className="rd-section">
      <button
        type="button"
        className="rd-section-title rd-section-title--unchanged rd-section-toggle"
        onClick={() => setOpen(o => !o)}
      >
        <Equal size={16} />
        Idénticas ({unchanged.length})
        <ChevronDown size={14} className={open ? 'rd-chevron-open' : ''} />
      </button>
      {open && (
        <ul className="rd-list">
          {unchanged.map(rec => (
            <li key={rec.callId} className="rd-item rd-item--unchanged">
              <div className="rd-item-priority">#{rec.priorityOrder}</div>
              <div className="rd-item-content">
                <strong>{rec.title}</strong>
                <div className="rd-item-meta">
                  {sourceLabel(rec.source)} · Fit {rec.fitScore}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ---- Helpers locales ---- */
const sourceLabel = (s: 'EU_PORTAL' | 'BDNS'): string =>
  s === 'EU_PORTAL' ? 'EU Portal' : 'BDNS España'

const formatMonth = (m: string): string => {
  if (!m || !/^\d{4}-\d{2}$/.test(m)) return '—'
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1, 1)
    .toLocaleString('es-ES', { month: 'short', year: 'numeric' })
}

export default RoadmapDiff
