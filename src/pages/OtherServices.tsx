import { useState, useEffect } from 'react'
import { Search, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import ActionsMenu from '../components/ActionsMenu'
import Modal from '../components/Modal'
import { formatCurrency, parseEuropeanNumber } from '../utils/formatCurrency'
import './Page.css'

interface Service {
  id: string
  title: string
  primaryClient: string
  secondaryClient?: string
  service: string
  fee: string
  status: string
  internalNotes?: string
}

interface Customer {
  id: string
  name: string
  category: string
}

const OtherServices = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState({
    primaryClient: 'All',
    secondaryClient: 'All',
    status: 'All'
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const itemsPerPage = 10

  // Load services from localStorage
  const loadServices = (): Service[] => {
    try {
      const saved = localStorage.getItem('otherServices')
      return saved ? JSON.parse(saved) : []
    } catch (error) {
      console.error('Error loading services from localStorage:', error)
      return []
    }
  }

  // Load customers from localStorage
  const loadCustomers = (): Customer[] => {
    try {
      const saved = localStorage.getItem('customers')
      return saved ? JSON.parse(saved) : []
    } catch (error) {
      console.error('Error loading customers from localStorage:', error)
      return []
    }
  }

  const [services, setServices] = useState<Service[]>(loadServices)
  const [customers] = useState<Customer[]>(loadCustomers)

  // Save services to localStorage whenever services change
  useEffect(() => {
    try {
      localStorage.setItem('otherServices', JSON.stringify(services))
    } catch (error) {
      console.error('Error saving services to localStorage:', error)
    }
  }, [services])

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    primaryClient: '',
    secondaryClient: '',
    service: '',
    fee: '',
    status: '',
    internalNotes: ''
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Get contractor and secondary customers
  const contractorClients = customers.filter(c => c.category === 'Contractor')
  const secondaryClients = customers.filter(c => c.category === 'Secondary')

  // Filter services
  const filteredServices = services.filter(service => {
    const matchesSearch = !searchTerm || 
      service.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getClientName(service.primaryClient).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (service.secondaryClient && getClientName(service.secondaryClient).toLowerCase().includes(searchTerm.toLowerCase())) ||
      service.service.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.fee.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.status.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesPrimaryClient = filters.primaryClient === 'All' || service.primaryClient === filters.primaryClient
    const matchesSecondaryClient = filters.secondaryClient === 'All' || 
      (filters.secondaryClient === 'None' && !service.secondaryClient) ||
      service.secondaryClient === filters.secondaryClient
    const matchesStatus = filters.status === 'All' || service.status === filters.status

    return matchesSearch && matchesPrimaryClient && matchesSecondaryClient && matchesStatus
  })

  // Pagination
  const totalPages = Math.ceil(filteredServices.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedServices = filteredServices.slice(startIndex, endIndex)

  const getClientName = (clientId: string) => {
    const client = customers.find(c => c.id === clientId)
    return client ? client.name : clientId
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.title.trim()) newErrors.title = 'Title is required'
    if (!formData.primaryClient) newErrors.primaryClient = 'Primary Client is required'
    if (!formData.service) newErrors.service = 'Service is required'
    if (!formData.fee.trim()) newErrors.fee = 'Fee is required'
    if (!formData.status) newErrors.status = 'Status is required'

    // Validate fee is a valid number
    if (formData.fee.trim()) {
      const feeValue = parseEuropeanNumber(formData.fee)
      if (!Number.isFinite(feeValue) || feeValue < 0) {
        newErrors.fee = 'Fee must be a valid positive number'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    const serviceData: Service = {
      id: editingServiceId || `service-${Date.now()}`,
      title: formData.title.trim(),
      primaryClient: formData.primaryClient,
      secondaryClient: formData.secondaryClient || undefined,
      service: formData.service,
      fee: formData.fee.trim(),
      status: formData.status,
      internalNotes: formData.internalNotes.trim() || undefined
    }

    if (editingServiceId) {
      setServices(prev => prev.map(s => s.id === editingServiceId ? serviceData : s))
    } else {
      setServices(prev => [...prev, serviceData])
    }

    // Reset form
    setFormData({
      title: '',
      primaryClient: '',
      secondaryClient: '',
      service: '',
      fee: '',
      status: '',
      internalNotes: ''
    })
    setErrors({})
    setIsModalOpen(false)
    setEditingServiceId(null)
  }

  const handleEdit = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId)
    if (service) {
      setFormData({
        title: service.title,
        primaryClient: service.primaryClient,
        secondaryClient: service.secondaryClient || '',
        service: service.service,
        fee: service.fee,
        status: service.status,
        internalNotes: service.internalNotes || ''
      })
      setEditingServiceId(serviceId)
      setIsModalOpen(true)
    }
  }

  const handleDelete = (_serviceId: string) => {
    window.alert('La eliminación está desactivada para conservar el histórico de servicios.')
  }

  const handleNewService = () => {
    setFormData({
      title: '',
      primaryClient: '',
      secondaryClient: '',
      service: '',
      fee: '',
      status: '',
      internalNotes: ''
    })
    setErrors({})
    setEditingServiceId(null)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingServiceId(null)
    setFormData({
      title: '',
      primaryClient: '',
      secondaryClient: '',
      service: '',
      fee: '',
      status: '',
      internalNotes: ''
    })
    setErrors({})
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Other Services</h1>
          <p className="page-subtitle">Additional services</p>
        </div>
      </div>

      <div className="customers-toolbar">
        <div className="search-bar-inline">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by title, primary client, secondary client, service, fee, status..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            className="search-input-inline"
          />
        </div>

        <div className="filter-buttons">
          <div className="filter-button-group">
            <div className="select-wrapper" style={{ position: 'relative' }}>
              <select
                value={filters.primaryClient}
                onChange={(e) => {
                  setFilters(prev => ({ ...prev, primaryClient: e.target.value }))
                  setCurrentPage(1)
                }}
                className={`filter-btn ${filters.primaryClient !== 'All' ? 'active' : ''}`}
                style={{ appearance: 'none', paddingRight: '2rem', cursor: 'pointer' }}
              >
                <option value="All">All Primary Clients</option>
                {contractorClients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
              <ChevronDown size={16} className="select-chevron" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
            <div className="select-wrapper" style={{ position: 'relative' }}>
              <select
                value={filters.secondaryClient}
                onChange={(e) => {
                  setFilters(prev => ({ ...prev, secondaryClient: e.target.value }))
                  setCurrentPage(1)
                }}
                className={`filter-btn ${filters.secondaryClient !== 'All' ? 'active' : ''}`}
                style={{ appearance: 'none', paddingRight: '2rem', cursor: 'pointer' }}
              >
                <option value="All">All Secondary Clients</option>
                <option value="None">None</option>
                {secondaryClients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
              <ChevronDown size={16} className="select-chevron" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
            <div className="select-wrapper" style={{ position: 'relative' }}>
              <select
                value={filters.status}
                onChange={(e) => {
                  setFilters(prev => ({ ...prev, status: e.target.value }))
                  setCurrentPage(1)
                }}
                className={`filter-btn ${filters.status !== 'All' ? 'active' : ''}`}
                style={{ appearance: 'none', paddingRight: '2rem', cursor: 'pointer' }}
              >
                <option value="All">All Status</option>
                <option value="In progress">In progress</option>
                <option value="Offer sent">Offer sent</option>
                <option value="Granted">Granted</option>
                <option value="Dismissed">Dismissed</option>
              </select>
              <ChevronDown size={16} className="select-chevron" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          </div>
        </div>

        <button className="btn-primary" onClick={handleNewService}>+ New Service</button>
      </div>

      <div className="content-section">

        <div className="table-container">
          <table className="data-table customers-table">
            <thead>
              <tr>
                <th>TITLE</th>
                <th>PRIMARY CLIENT</th>
                <th>SECONDARY CLIENT</th>
                <th>SERVICE</th>
                <th>FEE</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {paginatedServices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-row">
                    {searchTerm || filters.primaryClient !== 'All' || filters.secondaryClient !== 'All' || filters.status !== 'All'
                      ? 'No services match your filters' 
                      : 'No services registered yet'}
                  </td>
                </tr>
              ) : (
                paginatedServices.map(service => (
                  <tr key={service.id} className="customer-row">
                    <td className="name-cell">
                      <div className="customer-name">{service.title}</div>
                    </td>
                    <td>{getClientName(service.primaryClient)}</td>
                    <td>{service.secondaryClient ? getClientName(service.secondaryClient) : '-'}</td>
                    <td>
                      <span className={`service-badge service-${service.service.toLowerCase().replace(/\s+/g, '-')}`}>
                        {service.service}
                      </span>
                    </td>
                    <td>{formatCurrency(service.fee)}</td>
                    <td>
                      <span className={`status-badge status-${service.status.toLowerCase().replace(' ', '-')}`}>
                        {service.status}
                      </span>
                    </td>
                    <td>
                      <ActionsMenu
                        onEdit={() => handleEdit(service.id)}
                        onDelete={() => handleDelete(service.id)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredServices.length > 0 && (
          <div className="pagination">
            <div className="pagination-info">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredServices.length)} of {filteredServices.length} services
            </div>
            <div className="pagination-controls">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="pagination-btn"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="pagination-page">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="pagination-btn"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingServiceId ? 'Edit Service' : 'New Service'}
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="title">Title <span className="required">*</span></label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className={errors.title ? 'error' : ''}
              placeholder="Enter service title"
            />
            {errors.title && <span className="error-message">{errors.title}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="primaryClient">Primary Client <span className="required">*</span></label>
            <div className="select-wrapper">
              <select
                id="primaryClient"
                value={formData.primaryClient}
                onChange={(e) => handleInputChange('primaryClient', e.target.value)}
                className={errors.primaryClient ? 'error' : ''}
              >
                <option value="">Select a primary client</option>
                {contractorClients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
              <ChevronDown size={16} className="select-chevron" />
            </div>
            {errors.primaryClient && <span className="error-message">{errors.primaryClient}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="secondaryClient">Secondary Client (optional)</label>
            <div className="select-wrapper">
              <select
                id="secondaryClient"
                value={formData.secondaryClient}
                onChange={(e) => handleInputChange('secondaryClient', e.target.value)}
              >
                <option value="">Select a secondary client</option>
                {secondaryClients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
              <ChevronDown size={16} className="select-chevron" />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="service">Service <span className="required">*</span></label>
            <div className="select-wrapper">
              <select
                id="service"
                value={formData.service}
                onChange={(e) => handleInputChange('service', e.target.value)}
                className={errors.service ? 'error' : ''}
              >
                <option value="">Select a service</option>
                <option value="Coaching">Coaching</option>
                <option value="Mentoring">Mentoring</option>
                <option value="Training">Training</option>
                <option value="Project Management">Project Management</option>
                <option value="Tax Credit">Tax Credit</option>
              </select>
              <ChevronDown size={16} className="select-chevron" />
            </div>
            {errors.service && <span className="error-message">{errors.service}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="fee">Fee (€) <span className="required">*</span></label>
            <input
              type="text"
              id="fee"
              value={formData.fee}
              onChange={(e) => handleInputChange('fee', e.target.value)}
              className={errors.fee ? 'error' : ''}
              placeholder="0,00"
            />
            {errors.fee && <span className="error-message">{errors.fee}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="status">Status <span className="required">*</span></label>
            <div className="select-wrapper">
              <select
                id="status"
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className={errors.status ? 'error' : ''}
              >
                <option value="">Select status</option>
                <option value="In progress">In progress</option>
                <option value="Offer sent">Offer sent</option>
                <option value="Granted">Granted</option>
                <option value="Dismissed">Dismissed</option>
              </select>
              <ChevronDown size={16} className="select-chevron" />
            </div>
            {errors.status && <span className="error-message">{errors.status}</span>}
            {formData.status === 'Granted' && (
              <div className="granted-note">
                When you save, a running project will be automatically created.
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="internalNotes">Internal Notes (optional)</label>
            <textarea
              id="internalNotes"
              value={formData.internalNotes}
              onChange={(e) => handleInputChange('internalNotes', e.target.value)}
              rows={4}
              placeholder="Add internal notes..."
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={handleCloseModal}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {editingServiceId ? 'Update Service' : 'Save Service'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default OtherServices
