import { useState, useEffect, useRef } from 'react'
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
  Wand2,
  Route,
  Upload,
  X,
  Users as UsersIcon,
  Mail,
  Phone,
  FileCheck,
  Download,
  Calendar,
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
  /** Logo opcional del cliente en data URL (base64) — aparece en exports PPT. */
  logoBase64?: string
  /** PDF de contrato firmado opcional. */
  contractPdf?: {
    dataUrl: string
    fileName: string
    uploadedAt: string
  }
  /** Lista opcional de contactos del cliente. */
  contacts?: Array<{
    id: string
    name: string
    email: string
    phone: string
    comments: string
  }>
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
  primaryClients?: string[]
  secondaryClients?: string[]
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

const formatStatusLabel = (status: string): string => status

/* ============================================================
   Componente
   ============================================================ */

const CustomerDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const logoInputRef = useRef<HTMLInputElement | null>(null)

  /**
   * Carga un logo de cliente, lo redimensiona a max 400px de lado para
   * mantener el localStorage compacto, y lo guarda como dataURL.
   */
  const handleLogoUpload = (file: File) => {
    if (!customer) return
    if (!file.type.startsWith('image/')) {
      alert('Por favor sube una imagen (PNG, JPG, SVG…).')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const MAX = 400
        let { width, height } = img
        if (width > MAX || height > MAX) {
          const r = Math.min(MAX / width, MAX / height)
          width = Math.round(width * r)
          height = Math.round(height * r)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0, width, height)
        // Si era PNG mantenemos transparencia, si no lo convertimos a JPEG
        const isPng = file.type === 'image/png' || file.type === 'image/svg+xml'
        const dataUrl = isPng
          ? canvas.toDataURL('image/png')
          : canvas.toDataURL('image/jpeg', 0.88)

        const updated: Customer = { ...customer, logoBase64: dataUrl, updatedAt: new Date().toISOString() }
        setCustomer(updated)
        try {
          const saved = localStorage.getItem('customers')
          const customers: Customer[] = saved ? JSON.parse(saved) : []
          const next = customers.map(c => c.id === updated.id ? updated : c)
          localStorage.setItem('customers', JSON.stringify(next))
        } catch (err) {
          console.error('Error saving logo:', err)
        }
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleLogoRemove = () => {
    if (!customer) return
    if (!confirm('Remove client logo?')) return
    const { logoBase64: _, ...rest } = customer
    void _
    const updated: Customer = { ...rest, updatedAt: new Date().toISOString() }
    setCustomer(updated)
    try {
      const saved = localStorage.getItem('customers')
      const customers: Customer[] = saved ? JSON.parse(saved) : []
      const next = customers.map(c => c.id === updated.id ? updated : c)
      localStorage.setItem('customers', JSON.stringify(next))
    } catch (err) {
      console.error('Error removing logo:', err)
    }
  }

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
      // Filtra por cliente principal o secundario en el proyecto
      setProjects(all.filter(p =>
        (p.primaryClients || []).includes(id || '') ||
        (p.secondaryClients || []).includes(id || '')
      ))
    } catch (error) {
      console.error('Error loading projects:', error)
    }
  }, [id])

  if (!customer) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Customer not found</h1>
          <button className="btn-secondary" onClick={() => navigate('/customers')}>
            Back to Customers
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
        <span>Back to Clients</span>
      </button>

      {/* ============================================================
          HEADER del cliente — nombre, legal, badges, edit
          ============================================================ */}
      <section className="customer-detail-header">
        <div className="customer-detail-header-left">
          <div className="customer-logo-wrap">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) handleLogoUpload(f)
                if (logoInputRef.current) logoInputRef.current.value = ''
              }}
            />
            {customer.logoBase64 ? (
              <button
                type="button"
                className="customer-logo-img-btn"
                onClick={() => logoInputRef.current?.click()}
                title="Click to replace logo"
              >
                <img src={customer.logoBase64} alt={`${customer.name} logo`} className="customer-logo-img" />
              </button>
            ) : (
              <button
                type="button"
                className="customer-logo-placeholder customer-logo-placeholder--upload"
                onClick={() => logoInputRef.current?.click()}
                title="Upload client logo (will appear in PPT exports)"
              >
                <Building2 size={26} strokeWidth={1.5} />
                <span className="customer-logo-upload-hint"><Upload size={11} /> Logo</span>
              </button>
            )}
            {customer.logoBase64 && (
              <button
                type="button"
                className="customer-logo-remove"
                onClick={handleLogoRemove}
                title="Remove logo"
                aria-label="Remove logo"
              >
                <X size={12} />
              </button>
            )}
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

        <div className="customer-detail-header-actions">
          <button
            className="btn-secondary btn-secondary--ai"
            onClick={() => navigate(`/customers/${customer.id}/context`)}
          >
            <Wand2 size={16} />
            <span>Edit context</span>
          </button>
          <button
            className="btn-secondary btn-secondary--ai"
            onClick={() => navigate(`/customers/${customer.id}/funding-profile`)}
          >
            <Route size={16} />
            <span>Generate roadmap</span>
          </button>
          <button className="btn-secondary" onClick={handleEdit}>
            <Edit size={16} />
            <span>Edit Client</span>
          </button>
        </div>
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
            <span className="customer-kpi-label">Proposals</span>
            <span className="customer-kpi-value tabular-nums">{proposals.length}</span>
          </div>
        </div>

        <div className="customer-kpi-card">
          <div className="customer-kpi-icon customer-kpi-icon--success">
            <Briefcase size={20} />
          </div>
          <div className="customer-kpi-body">
            <span className="customer-kpi-label">Projects</span>
            <span className="customer-kpi-value tabular-nums">{projects.length}</span>
          </div>
        </div>

        <div className="customer-kpi-card">
          <div className="customer-kpi-icon customer-kpi-icon--warning">
            <Euro size={20} />
          </div>
          <div className="customer-kpi-body">
            <span className="customer-kpi-label">Total Budget</span>
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
            <span className="customer-kpi-label">Achieved Fees</span>
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
            <h2>Company Information</h2>
            <button
              type="button"
              className="customer-info-edit-link"
              onClick={handleEdit}
            >
              Edit revenue / capital / employees
            </button>
          </header>

          <div className="customer-info-grid">
            <CustomerField label="Tax ID" value={customer.taxId} />
            <CustomerField label="Incorporation Date" value={formatDateEs(customer.incorporationDate)} />
            <CustomerField label="Revenue (€)" value={formatEuroAmount(customer.revenue)} />
            <CustomerField label="Share Capital (€)" value={formatEuroAmount(customer.shareCapital)} />
            <CustomerField label="Employees" value={customer.employees || '—'} />
            <CustomerField
              label="Country"
              value={
                <span className="customer-info-with-icon">
                  <Globe size={14} />
                  {customer.country || '—'}
                </span>
              }
            />
            <CustomerField
              label="Region"
              value={
                customer.region ? (
                  <span className="customer-info-with-icon">
                    <MapPin size={14} />
                    {customer.region}
                  </span>
                ) : '—'
              }
            />
            <CustomerField label="Address" value={customer.address || '—'} fullRow />
            <CustomerField
              label="Website"
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
              <h3>Category</h3>
            </header>
            <div className="customer-sidebar-body">
              <span className={`badge ${customer.category === 'Contractor' ? 'badge--brand' : 'badge--neutral'}`}>
                {customer.category || '—'}
              </span>
              <p className="customer-sidebar-hint">
                {customer.category === 'Contractor'
                  ? 'Primary client with direct commercial relationship and billing.'
                  : customer.category === 'Secondary'
                    ? 'Secondary client associated with a proposal or project but without direct billing.'
                    : 'No category assigned.'}
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
                  Not associated with any accelerators or partners.
                </p>
              )}
            </div>
          </div>

          {/* Fechas */}
          <div className="customer-sidebar-card">
            <header className="customer-sidebar-header">
              <h3>Dates</h3>
            </header>
            <div className="customer-sidebar-body customer-sidebar-dates">
              <div className="customer-date-row">
                <span className="customer-date-label">Created</span>
                <span className="customer-date-value">{formatDateEs(customer.createdAt)}</span>
              </div>
              <div className="customer-date-row">
                <span className="customer-date-label">Last Updated</span>
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
          <h2>Description</h2>
          <p>{customer.description}</p>
        </div>
      )}

      {/* ============================================================
          CONTACTS
          ============================================================ */}
      {customer.contacts && customer.contacts.length > 0 && (
        <div className="customer-info-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2><UsersIcon size={18} /> Contacts</h2>
            <button className="btn-link" onClick={handleEdit}>
              <Edit size={13} /> Edit
            </button>
          </div>
          <div className="customer-contacts-list">
            {customer.contacts.map(c => (
              <div key={c.id} className="customer-contact-card">
                <div className="customer-contact-avatar">
                  {c.name ? c.name.slice(0, 1).toUpperCase() : '?'}
                </div>
                <div className="customer-contact-body">
                  <strong>{c.name || '(sin nombre)'}</strong>
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="customer-contact-meta">
                      <Mail size={12} /> {c.email}
                    </a>
                  )}
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="customer-contact-meta">
                      <Phone size={12} /> {c.phone}
                    </a>
                  )}
                  {c.comments && (
                    <span className="customer-contact-comments">{c.comments}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================
          CONTRACT PDF
          ============================================================ */}
      {customer.contractPdf && (
        <div className="customer-info-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2><FileCheck size={18} /> Contract</h2>
            <button className="btn-link" onClick={handleEdit}>
              <Edit size={13} /> Edit
            </button>
          </div>
          <div className="customer-contract-card">
            <FileText size={32} className="customer-contract-icon" />
            <div className="customer-contract-info">
              <strong>{customer.contractPdf.fileName}</strong>
              <small>
                <Calendar size={12} /> Subido el {new Date(customer.contractPdf.uploadedAt).toLocaleString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </small>
            </div>
            <a
              href={customer.contractPdf.dataUrl}
              download={customer.contractPdf.fileName}
              className="btn-secondary btn-secondary--sm"
            >
              <Download size={14} /> Download
            </a>
          </div>
        </div>
      )}

      {/* ============================================================
          PROPOSALS — Mantenida intacta (lógica + visual existente)
          ============================================================ */}
      <div className="customer-info-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Proposals</h2>
          {proposals.length > 0 && (
            <a
              href={`/proposals?primaryClient=${customer.id}`}
              onClick={(e) => {
                e.preventDefault()
                navigate(`/proposals?primaryClient=${customer.id}`)
              }}
              className="view-all-link"
            >
              View all
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
          <div className="empty-section">No proposals found</div>
        )}
      </div>

      {/* ============================================================
          PROJECTS — Mantenida intacta
          ============================================================ */}
      <div className="customer-info-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Projects</h2>
          {projects.length > 0 && (
            <a
              href={`/projects?primaryClient=${customer.id}`}
              onClick={(e) => {
                e.preventDefault()
                navigate(`/projects?primaryClient=${customer.id}`)
              }}
              className="view-all-link"
            >
              View all
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
                    {project.source === 'proposal' ? 'From Proposal' : 'From Service'}
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
          <div className="empty-section">No projects found</div>
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
