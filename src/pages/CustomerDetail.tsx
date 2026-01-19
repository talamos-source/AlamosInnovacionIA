import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Globe, Building2, FileText, Briefcase } from 'lucide-react'
import { formatCurrency } from '../utils/formatCurrency'
import './Page.css'

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

const CustomerDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    // Load customer from localStorage
    try {
      const saved = localStorage.getItem('customers')
      const customers: Customer[] = saved ? JSON.parse(saved) : []
      const foundCustomer = customers.find(c => c.id === id)
      setCustomer(foundCustomer || null)
    } catch (error) {
      console.error('Error loading customer:', error)
    }

    // Load proposals from localStorage
    try {
      const saved = localStorage.getItem('proposals')
      const allProposals: Proposal[] = saved ? JSON.parse(saved) : []
      // Filter proposals where this customer is a primary or secondary client
      const relatedProposals = allProposals.filter(p => 
        p.primaryClients.includes(id || '') || p.secondaryClients.includes(id || '')
      )
      setProposals(relatedProposals)
    } catch (error) {
      console.error('Error loading proposals:', error)
    }

    // Load projects from localStorage
    try {
      const saved = localStorage.getItem('projects')
      const allProjects: Project[] = saved ? JSON.parse(saved) : []
      // Filter projects related to this customer
      const relatedProjects = allProjects.filter(() => {
        // This will need to be adjusted based on how projects store customer info
        return false // Placeholder
      })
      setProjects(relatedProjects)
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      const day = date.getDate().toString().padStart(2, '0')
      const month = date.toLocaleString('en-US', { month: 'short' })
      const year = date.getFullYear()
      return `${day} ${month} ${year}`
    } catch {
      return dateString
    }
  }


  // Calculate key metrics
  const primaryProposals = proposals.filter(p => p.primaryClients.includes(customer.id))
  const totalBudget = primaryProposals.reduce((sum, p) => sum + (parseFloat(p.budgetFunding) || 0), 0)
  const totalFees = primaryProposals.reduce((sum, p) => sum + (parseFloat(p.fee) || 0), 0)

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn-secondary" onClick={() => navigate('/customers')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ArrowLeft size={18} />
          Back to Customers
        </button>
      </div>

      {/* Customer Header */}
      <div className="customer-header-card">
        <div className="customer-header-main">
          <div>
            <h1>{customer.name}</h1>
            <p className="customer-company">{customer.company}</p>
          </div>
          <div className="customer-header-badges">
            <span className={`status-badge status-${customer.status.toLowerCase()}`}>
              {customer.status}
            </span>
            {customer.companySize && (
              <span className="category-badge">{customer.companySize}</span>
            )}
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="key-metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">
            <FileText size={24} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Proposals</div>
            <div className="metric-value">{proposals.length}</div>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon">
            <Briefcase size={24} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Projects</div>
            <div className="metric-value">{projects.length}</div>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon">
            <Building2 size={24} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Total Budget</div>
            <div className="metric-value">{formatCurrency(totalBudget)}</div>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon">
            <Globe size={24} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Achieved Fees</div>
            <div className="metric-value">{formatCurrency(totalFees)}</div>
          </div>
        </div>
      </div>

      {/* Company Information */}
      <div className="customer-info-section">
        <h2>Company Information</h2>
        <div className="info-grid">
          {customer.taxId && (
            <div className="info-item">
              <label>Tax ID (CIF/NIF)</label>
              <span>{customer.taxId}</span>
            </div>
          )}
          <div className="info-item">
            <label>Country</label>
            <span>{customer.country}</span>
          </div>
          {customer.address && (
            <div className="info-item">
              <label>Address</label>
              <span>{customer.address}</span>
            </div>
          )}
          <div className="info-item">
            <label>Website</label>
            <a href={customer.website} target="_blank" rel="noopener noreferrer" className="website-link">
              {customer.website}
            </a>
          </div>
          {customer.incorporationDate && (
            <div className="info-item">
              <label>Incorporation Date</label>
              <span>{formatDate(customer.incorporationDate)}</span>
            </div>
          )}
          {customer.region && (
            <div className="info-item">
              <label>Region</label>
              <span>{customer.region}</span>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {customer.description && (
        <div className="customer-info-section">
          <h2>Description</h2>
          <p>{customer.description}</p>
        </div>
      )}

      {/* Dates */}
      <div className="customer-info-section">
        <h2>Dates</h2>
        <div className="info-grid">
          {customer.createdAt && (
            <div className="info-item">
              <label>Created</label>
              <span>{formatDate(customer.createdAt)}</span>
            </div>
          )}
          {customer.updatedAt && (
            <div className="info-item">
              <label>Last Updated</label>
              <span>{formatDate(customer.updatedAt)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Proposals Section */}
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

      {/* Projects Section */}
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
                  <div className="proposal-call">{project.source === 'proposal' ? 'From Proposal' : 'From Service'}</div>
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

export default CustomerDetail
