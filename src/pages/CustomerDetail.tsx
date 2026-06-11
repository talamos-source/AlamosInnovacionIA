import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Edit,
  Globe,
  MapPin,
  FileText,
  Briefcase,
  Euro,
  Building2,
} from 'lucide-react'
import { formatCurrency, parseEuropeanNumber } from '../utils/formatCurrency'
import './Page.css'
import './CustomerDetail.css'

/* ============================================================
   Tipos
   ============================================================ */

interface Customer {
  id: string
  name: string
  company: string
  country: string
  region: string
  partner: {
    name: string
    initials: string
  }
  website: string
  category: string
  status: string
  taxId?: string
  incorporationDate?: string
  companySize?: string
  revenue?: string
  shareCapital?: string
  employees?: string
  memberOf?: string[]
  address?: string
  description?: string
  notes?: string
  createdAt?: string
  updatedAt?: string
}

interface Proposal {
  id: string
  proposal: string
  call: string
  primaryClients: string[]
  secondaryClients: string[]
  budgetFunding: string
  fee: string
  status: string
}

interface Project {
  id: string
  title: string
  source: 'proposal' | 'service'
  status: string
}

/* ============================================================
   Helpers
   ============================================================ */

const formatEuroAmount = (value?: string): string => {
  if (!value) return '—'
  const n = parseEuropeanNumber(value)
  if (!n) return '—'
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

const formatDateEs = (dateString?: string): string => {
  if (!dateString) return '—'
  try {
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) {
      // Si viene en formato dd/mm/yyyy, devolver tal cual
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) return dateString
      return dateString
    }
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateString
  }
}

const formatStatusLabel = (status: string): string => {
  const map: Record<string, string> = {
    Active: 'Activo',
    Inactive: 'Inactivo',
    Archived: 'Archivado',
  }
  return map[status] || status
}

/* ============================================================
   Componente
   ============================================================ */

const CustomerDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('customers')
      const customers: Customer[] = saved ? JSON.parse(saved) : []
      setCustomer(customers.find(c => c.id === id) || null)
    } catch (error) {
      console.error('Error loading customer:', error)
    }

    try {
      const saved = localStorage.getItem('proposals')
      const all: Proposal[] = saved ? JSON.parse(saved) : []
      setProposals(all.filter(p =>
        p.primaryClients.includes(id || '') || p.secondaryClients.includes(id || '')
      ))
    } catch (error) {
      console.error('Error loading proposals:', error)
    }

    try {
      const saved = localStorage.getItem('projects')
      const all: Project[] = saved ? JSON.parse(saved) : []
      // Misma heurística que tenía: por ahora sin filter funcional
      setProjects(all.filter(() => false))
    } catch (error) {
      console.error('Error loading projects:', error)
    }
  }, [id])

  if (!customer) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Cliente no encontrado</h1>
          <button className="btn-secondary" onClick={() => navigate('/customers')}>
            Volver a clientes
          </button>
        </div>
      </div>
    )
  }

  // KPIs
  const primaryProposals = proposals.filter(p => p.primaryClients.includes(customer.id))
  const totalBudget = primaryProposals.reduce(
    (sum, p) => sum + (parseEuropeanNumber(p.budgetFunding) || 0),
    0,
  )
  const achievedFees = primaryProposals.reduce(
    (sum, p) => sum + (parseEuropeanNumber(p.fee) || 0),
    0,
  )

  const handleEdit = () => {
    // Vuelve a Customers con un query param que abre el modal de edición.
    navigate(`/customers?edit=${customer.id}`)
  }

  return (
    <div className="page page--customer-detail">
      {/* Volver */}
      <button className="customer-back-link" onClick={() => navigate('/customers')}>
        <ArrowLeft size={16} />
        <span>Volver a clientes</span>
      </button>

      {/* ============================================================
          HEADER del cliente — nombre, legal, badges, edit
          ============================================================ */}
      <section className="customer-detail-header">
        <div className="customer-detail-header-left">
          <div className="customer-logo-placeholder" aria-hidden>
            <Building2 size={28} strokeWidth={1.5} />
          </div>
          <div className="customer-detail-identity">
            <h1 className="customer-detail-name">{customer.name}</h1>
            <p className="customer-detail-legal">{customer.company}</p>
            <div className="customer-detail-badges">
              <span className={`status-badge status-${customer.status.toLowerCase()}`}>
                {formatStatusLabel(customer.status)}
              </span>
              {customer.companySize && (
                <>
                  <span className="badge-separator">·</span>
                  <span className="customer-meta-line">{customer.companySize}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <button className="btn-secondary" onClick={handleEdit}>
          <Edit size={16} />
          <span>Editar cliente</span>
        </button>
      </section>

      {/* ============================================================
          KPIs del cliente
          ============================================================ */}
      <div className="customer-kpi-grid">
        <div className="customer-kpi-card">
          <div className="customer-kpi-icon customer-kpi-icon--brand">
            <FileText size={20} />
          </div>
          <div className="customer-kpi-body">
            <span className="customer-kpi-label">Propuestas</span>
            <span className="customer-kpi-value tabular-nums">{proposals.length}</span>
          </div>
        </div>

        <div className="customer-kpi-card">
          <div className="customer-kpi-icon customer-kpi-icon--success">
            <Briefcase size={20} />
          </div>
          <div className="customer-kpi-body">
            <span className="customer-kpi-label">Proyectos</span>
            <span className="customer-kpi-value tabular-nums">{projects.length}</span>
          </div>
        </div>

        <div className="customer-kpi-card">
          <div className="customer-kpi-icon customer-kpi-icon--warning">
            <Euro size={20} />
          </div>
          <div className="customer-kpi-body">
            <span className="customer-kpi-label">Presupuesto total</span>
            <span className="customer-kpi-value tabular-nums">
              {formatCurrency(totalBudget)}
            </span>
          </div>
        </div>

        <div className="customer-kpi-card">
          <div className="customer-kpi-icon customer-kpi-icon--success">
            <Euro size={20} />
          </div>
          <div className="customer-kpi-body">
            <span className="customer-kpi-label">Honorarios conseguidos</span>
            <span className="customer-kpi-value tabular-nums">
              {formatCurrency(achievedFees)}
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================
          Sección de dos columnas: Company Info (izq) + Cards (der)
          ============================================================ */}
      <div className="customer-detail-twocol">
        <section className="customer-info-panel">
          <header className="customer-info-panel-header">
            <h2>Información de empresa</h2>
            <button
              type="button"
              className="customer-info-edit-link"
              onClick={handleEdit}
            >
              Editar facturación / capital / empleados
            </button>
          </header>

          <div className="customer-info-grid">
            <CustomerField label="CIF / NIF" value={customer.taxId} />
            <CustomerField label="Fecha de constitución" value={formatDateEs(customer.incorporationDate)} />
            <CustomerField label="Facturación (€)" value={formatEuroAmount(customer.revenue)} />
            <CustomerField label="Capital social (€)" value={formatEuroAmount(customer.shareCapital)} />
            <CustomerField label="Empleados" value={customer.employees || '—'} />
            <CustomerField
              label="País"
              value={
                <span className="customer-info-with-icon">
                  <Globe size={14} />
                  {customer.country || '—'}
                </span>
              }
            />
            <CustomerField
              label="Región"
              value={
                customer.region ? (
                  <span className="customer-info-with-icon">
                    <MapPin size={14} />
                    {customer.region}
                  </span>
                ) : '—'
              }
            />
            <CustomerField label="Dirección" value={customer.address || '—'} fullRow />
            <CustomerField
              label="Web"
              value={
                customer.website ? (
                  <a
                    href={customer.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="customer-info-link"
                  >
                    {customer.website}
                  </a>
                ) : '—'
              }
              fullRow
            />
          </div>
        </section>

        <aside className="customer-detail-sidebar">
          {/* Categoría (sustituye al antiguo Assigned Partner) */}
          <div className="customer-sidebar-card">
            <header className="customer-sidebar-header">
              <h3>Categoría</h3>
            </header>
            <div className="customer-sidebar-body">
              <span className={`badge ${customer.category === 'Contractor' ? 'badge--brand' : 'badge--neutral'}`}>
                {customer.category === 'Contractor' ? 'Cliente principal' : customer.category === 'Secondary' ? 'Cliente secundario' : (customer.category || '—')}
              </span>
              <p className="customer-sidebar-hint">
                {customer.category === 'Contractor'
                  ? 'Cliente principal con el que mantienes una relación comercial directa y facturación.'
                  : customer.category === 'Secondary'
                    ? 'Cliente secundario asociado a una propuesta o proyecto pero sin facturación directa.'
                    : 'Sin categoría asignada.'}
              </p>
            </div>
          </div>

          {/* Member of — aceleradoras / partners */}
          <div className="customer-sidebar-card">
            <header className="customer-sidebar-header">
              <h3>Member of</h3>
            </header>
            <div className="customer-sidebar-body">
              {customer.memberOf && customer.memberOf.length > 0 ? (
                <div className="chip-list chip-list--readonly">
                  {customer.memberOf.map(name => (
                    <span key={name} className="chip chip--readonly">{name}</span>
                  ))}
                </div>
              ) : (
                <p className="customer-sidebar-empty">
                  Sin asociaciones con aceleradoras o partners.
                </p>
              )}
            </div>
          </div>

          {/* Fechas */}
          <div className="customer-sidebar-card">
            <header className="customer-sidebar-header">
              <h3>Fechas</h3>
            </header>
            <div className="customer-sidebar-body customer-sidebar-dates">
              <div className="customer-date-row">
                <span className="customer-date-label">Creado</span>
                <span className="customer-date-value">{formatDateEs(customer.createdAt)}</span>
              </div>
              <div className="customer-date-row">
                <span className="customer-date-label">Última actualización</span>
                <span className="customer-date-value">{formatDateEs(customer.updatedAt)}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ============================================================
          DESCRIPTION — Mantenida intacta
          ============================================================ */}
      {customer.description && (
        <div className="customer-info-section">
          <h2>Descripción</h2>
          <p>{customer.description}</p>
        </div>
      )}

      {/* ============================================================
          PROPOSALS — Mantenida intacta (lógica + visual existente)
          ============================================================ */}
      <div className="customer-info-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Propuestas</h2>
          {proposals.length > 0 && (
            <a
              href={`/proposals?primaryClient=${customer.id}`}
              onClick={(e) => {
                e.preventDefault()
                navigate(`/proposals?primaryClient=${customer.id}`)
              }}
              className="view-all-link"
            >
              Ver todas
            </a>
          )}
        </div>
        {proposals.length > 0 ? (
          <div className="proposals-list">
            {proposals.slice(0, 5).map(proposal => (
              <div key={proposal.id} className="proposal-item">
                <div className="proposal-main">
                  <div className="proposal-name">{proposal.proposal}</div>
                  <div className="proposal-call">{proposal.call}</div>
                </div>
                <div className="proposal-amounts">
                  <div className="proposal-budget">{formatCurrency(proposal.budgetFunding)}</div>
                  <div className="proposal-fee">{formatCurrency(proposal.fee)}</div>
                </div>
                <div className="proposal-status">
                  <span className={`status-badge status-${proposal.status.toLowerCase().replace(' ', '-')}`}>
                    {proposal.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-section">No hay propuestas asociadas.</div>
        )}
      </div>

      {/* ============================================================
          PROJECTS — Mantenida intacta
          ============================================================ */}
      <div className="customer-info-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Proyectos</h2>
          {projects.length > 0 && (
            <a
              href={`/projects?primaryClient=${customer.id}`}
              onClick={(e) => {
                e.preventDefault()
                navigate(`/projects?primaryClient=${customer.id}`)
              }}
              className="view-all-link"
            >
              Ver todos
            </a>
          )}
        </div>
        {projects.length > 0 ? (
          <div className="proposals-list">
            {projects.slice(0, 5).map(project => (
              <div key={project.id} className="proposal-item">
                <div className="proposal-main">
                  <div className="proposal-name">{project.title}</div>
                  <div className="proposal-call">
                    {project.source === 'proposal' ? 'Desde propuesta' : 'Desde servicio'}
                  </div>
                </div>
                <div className="proposal-status">
                  <span className={`status-badge status-${project.status.toLowerCase().replace(' ', '-')}`}>
                    {project.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-section">No hay proyectos asociados.</div>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   Subcomponente — Field bilingüe
   ============================================================ */

const CustomerField = ({
  label,
  value,
  fullRow,
}: {
  label: string
  value: React.ReactNode
  fullRow?: boolean
}) => (
  <div className={`customer-info-field ${fullRow ? 'customer-info-field--full' : ''}`}>
    <span className="customer-info-label">{label}</span>
    <div className="customer-info-value">{value}</div>
  </div>
)

export default CustomerDetail
