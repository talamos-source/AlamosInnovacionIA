import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Lightbulb, Plus, Users, Calendar, Activity,
  Trash2, Edit,
} from 'lucide-react'
import ProposalIdeasModal, { ProposalIdea } from '../components/ProposalIdeasModal'
import { persistAppData } from '../utils/appData'
import './Page.css'
import './ProposalIdeasList.css'

interface StoredIdea extends ProposalIdea {
  id: string
  createdAt: string
  updatedAt: string
}

interface Customer {
  id: string
  name: string
  website?: string
}

const loadCustomers = (): Customer[] => {
  try {
    const raw = localStorage.getItem('customers')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

const loadIdeasFor = (customerId: string): StoredIdea[] => {
  try {
    const raw = localStorage.getItem('proposalIdeas') || '{}'
    const all = JSON.parse(raw) as Record<string, StoredIdea[]>
    return all[customerId] || []
  } catch { return [] }
}

const ProposalIdeasList = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [ideas, setIdeas] = useState<StoredIdea[]>([])
  const [modalState, setModalState] = useState<
    | { mode: 'new' }
    | { mode: 'edit'; ideaId: string; idea: ProposalIdea }
    | null
  >(null)

  const refresh = () => {
    setCustomers(loadCustomers())
    if (id) setIdeas(loadIdeasFor(id))
  }

  useEffect(() => {
    refresh()
  }, [id])

  const customer = useMemo(() => customers.find(c => c.id === id) || null, [customers, id])
  const otherCustomers = useMemo(() => customers.filter(c => c.id !== id), [customers, id])

  const handleDelete = (ideaId: string) => {
    if (!id) return
    if (!window.confirm('¿Eliminar esta proposal idea? No se puede deshacer.')) return
    try {
      const raw = localStorage.getItem('proposalIdeas') || '{}'
      const all = JSON.parse(raw) as Record<string, StoredIdea[]>
      all[id] = (all[id] || []).filter(it => it.id !== ideaId)
      persistAppData('proposalIdeas', JSON.stringify(all))
      refresh()
    } catch (err) {
      alert('Error al eliminar: ' + (err instanceof Error ? err.message : 'desconocido'))
    }
  }

  if (!id) {
    return <div className="page"><p>Cliente no especificado.</p></div>
  }
  if (!customer) {
    return (
      <div className="page">
        <button onClick={() => navigate('/customers')} className="pil-back">
          <ArrowLeft size={14} /> Customers
        </button>
        <p style={{ padding: 32, color: 'var(--color-text-muted)' }}>
          Cliente no encontrado.
        </p>
      </div>
    )
  }

  return (
    <div className="page pil-page">
      {/* Breadcrumb */}
      <div className="pil-breadcrumb">
        <button onClick={() => navigate('/customers')} className="pil-back">
          <ArrowLeft size={14} /> Customers
        </button>
        <span className="pil-bread-sep">/</span>
        <button
          onClick={() => navigate(`/customers/${id}`)}
          className="pil-bread-link"
        >
          {customer.name}
        </button>
        <span className="pil-bread-sep">/</span>
        <span className="pil-bread-current">Proposal Ideas</span>
      </div>

      {/* Header */}
      <div className="pil-header">
        <div>
          <h1><Lightbulb size={20} /> Proposal Ideas</h1>
          <p className="page-subtitle">
            Ideas de propuestas en exploración para <strong>{customer.name}</strong>.
            Alimentan Customer Context, Funding Profile y Roadmap I+D+i.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setModalState({ mode: 'new' })}
        >
          <Plus size={14} /> New Proposal Idea
        </button>
      </div>

      {/* Lista */}
      {ideas.length === 0 ? (
        <div className="pil-empty">
          <Lightbulb size={32} />
          <strong>Aún no hay ideas guardadas</strong>
          <p>
            Las ideas creadas alimentan automáticamente el análisis del cliente y
            el roadmap de financiación.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setModalState({ mode: 'new' })}
          >
            <Plus size={14} /> Crear primera idea
          </button>
        </div>
      ) : (
        <div className="pil-grid">
          {ideas
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .map(idea => (
              <article key={idea.id} className="pil-card">
                <header className="pil-card-header">
                  <h3>
                    {(idea.objective.split(/[.!?]/)[0] || 'Sin título').trim().slice(0, 90)}
                  </h3>
                  <div className="pil-card-actions">
                    <button
                      type="button"
                      className="pil-icon-btn"
                      onClick={() => setModalState({ mode: 'edit', ideaId: idea.id, idea })}
                      title="Editar"
                    >
                      <Edit size={13} />
                    </button>
                    <button
                      type="button"
                      className="pil-icon-btn pil-icon-btn--danger"
                      onClick={() => handleDelete(idea.id)}
                      title="Eliminar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </header>

                {idea.mainInnovation && (
                  <p className="pil-card-innovation">
                    <strong>Innovación:</strong> {idea.mainInnovation.slice(0, 180)}
                    {idea.mainInnovation.length > 180 ? '…' : ''}
                  </p>
                )}

                <div className="pil-card-stats">
                  <div className="pil-stat">
                    <Activity size={11} />
                    <span>TRL <strong>{idea.initialTrl}</strong></span>
                  </div>
                  <div className="pil-stat">
                    <Calendar size={11} />
                    <span><strong>{idea.durationMonths}</strong> meses</span>
                  </div>
                  <div className="pil-stat">
                    <Users size={11} />
                    <span><strong>{idea.partners?.length || 0}</strong> partners</span>
                  </div>
                  <div className="pil-stat">
                    <span>
                      <strong>{idea.workPackages?.length || 0}</strong> WP
                      {(idea.workPackages?.length || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <footer className="pil-card-footer">
                  <small>
                    Creada {new Date(idea.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {idea.updatedAt !== idea.createdAt && (
                      <> · actualizada {new Date(idea.updatedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</>
                    )}
                  </small>
                  <button
                    type="button"
                    className="btn-secondary btn-secondary--sm"
                    onClick={() => setModalState({ mode: 'edit', ideaId: idea.id, idea })}
                  >
                    Abrir →
                  </button>
                </footer>
              </article>
            ))}
        </div>
      )}

      {/* Modal */}
      {modalState && (
        <ProposalIdeasModal
          customer={customer}
          allCustomers={otherCustomers}
          initialIdea={modalState.mode === 'edit' ? modalState.idea : undefined}
          ideaId={modalState.mode === 'edit' ? modalState.ideaId : undefined}
          onClose={() => setModalState(null)}
          onSaved={() => { refresh() }}
        />
      )}
    </div>
  )
}

export default ProposalIdeasList
