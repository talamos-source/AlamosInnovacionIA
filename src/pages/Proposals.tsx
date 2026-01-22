import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, ChevronDown, ChevronLeft, ChevronRight, X, Users, Calendar, Clock } from 'lucide-react'
import ActionsMenu from '../components/ActionsMenu'
import Modal from '../components/Modal'
import { formatCurrency, formatNumber, parseEuropeanNumber } from '../utils/formatCurrency'
import './Page.css'

interface Proposal {
  id: string
  proposal: string
  call: string
  callId: string
  primaryClients: string[]
  secondaryClients: string[]
  budgetFunding: string
  fee: string
  status: string
  createdAt?: string
  internalNotes?: string
  primaryClientsFinancials?: Record<string, PrimaryClientFinancials>
  secondaryClientsFinancials?: Record<string, SecondaryClientFinancials>
}

interface Call {
  id: string
  name: string
  status: string
  deadline?: string
}

interface Customer {
  id: string
  name: string
  category: string
}

interface PrimaryClientFinancials {
  clientId: string
  budget: string
  grant: string
  grantFee: string
  loan: string
  loanFee: string
  equity: string
  equityFee: string
  totalFunding: string
  fee: string
}

interface SecondaryClientFinancials {
  clientId: string
  budget: string
  grant: string
  grantFee: string
  loan: string
  loanFee: string
  equity: string
  equityFee: string
  totalFunding: string
  fee: string
}

const Proposals = () => {
  const [searchParams] = useSearchParams()
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState({
    status: 'All',
    call: 'All',
    primaryClient: 'All'
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null)
  const itemsPerPage = 10

  // Check for primaryClient filter from URL
  useEffect(() => {
    const primaryClientParam = searchParams.get('primaryClient')
    if (primaryClientParam) {
      setFilters(prev => ({ ...prev, primaryClient: primaryClientParam }))
    }
  }, [searchParams])

  // Load proposals from localStorage
  const loadProposals = (): Proposal[] => {
    try {
      const saved = localStorage.getItem('proposals')
      return saved ? JSON.parse(saved) : []
    } catch (error) {
      console.error('Error loading proposals from localStorage:', error)
      return []
    }
  }

  // Load calls from localStorage
  const loadCalls = (): Call[] => {
    try {
      const saved = localStorage.getItem('calls')
      return saved ? JSON.parse(saved) : []
    } catch (error) {
      console.error('Error loading calls from localStorage:', error)
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

  // State - load from localStorage
  const [proposals, setProposals] = useState<Proposal[]>(loadProposals)
  const [calls, setCalls] = useState<Call[]>(loadCalls)
  const [customers, setCustomers] = useState<Customer[]>(loadCustomers)

  // Reload calls and customers from localStorage when component mounts or when they might have changed
  useEffect(() => {
    const reloadData = () => {
      setCalls(loadCalls())
      setCustomers(loadCustomers())
    }
    
    // Reload on mount
    reloadData()
    
    // Listen for storage events to update when data changes in other tabs/windows
    window.addEventListener('storage', reloadData)
    
    // Also reload periodically to catch changes in same tab
    const interval = setInterval(reloadData, 1000)
    
    return () => {
      window.removeEventListener('storage', reloadData)
      clearInterval(interval)
    }
  }, [])

  // Save proposals to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('proposals', JSON.stringify(proposals))
    } catch (error) {
      console.error('Error saving proposals to localStorage:', error)
    }
  }, [proposals])

  // Form state
  const [formData, setFormData] = useState({
    proposalName: '',
    associatedCall: '',
    status: 'In Progress',
    primaryClients: [] as string[],
    secondaryClients: [] as string[],
    internalNotes: ''
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [primaryClientSelect, setPrimaryClientSelect] = useState('')
  const [secondaryClientSelect, setSecondaryClientSelect] = useState('')
  const [primaryClientsFinancials, setPrimaryClientsFinancials] = useState<Record<string, PrimaryClientFinancials>>({})
  const [secondaryClientsFinancials, setSecondaryClientsFinancials] = useState<Record<string, SecondaryClientFinancials>>({})

  // Filter calls and customers - only show Calls with status "Open"
  // Show all calls (not just Open ones) so users can associate proposals with any call
  const availableCalls = calls
  const contractorClients = customers.filter(customer => customer.category === 'Contractor')
  const secondaryClientsList = customers.filter(customer => customer.category === 'Secondary')

  // Filter proposals
  const filteredProposals = proposals.filter(proposal => {
    const searchLower = searchTerm.toLowerCase()
    const normalizedStatus = proposal.status === 'in progress' ? 'In Progress' : proposal.status
    
    // Get client names for search
    const primaryClientNames = proposal.primaryClients.map(id => {
      const client = customers.find(c => c.id === id)
      return client?.name || id
    })
    const secondaryClientNames = proposal.secondaryClients.map(id => {
      const client = customers.find(c => c.id === id)
      return client?.name || id
    })
    
    // Search across all table fields
    const matchesSearch = searchTerm === '' || 
      proposal.proposal.toLowerCase().includes(searchLower) ||
      proposal.call.toLowerCase().includes(searchLower) ||
      primaryClientNames.some(name => name.toLowerCase().includes(searchLower)) ||
      secondaryClientNames.some(name => name.toLowerCase().includes(searchLower)) ||
      proposal.budgetFunding.toLowerCase().includes(searchLower) ||
      proposal.fee.toLowerCase().includes(searchLower) ||
      normalizedStatus.toLowerCase().includes(searchLower)
    
    const matchesStatus = !filters.status || filters.status === 'All' || 
      (filters.status === 'In Progress' && normalizedStatus === 'In Progress') ||
      (filters.status === 'Pending' && normalizedStatus === 'Pending') ||
      (filters.status === 'Granted' && normalizedStatus === 'Granted') ||
      (filters.status === 'Dismissed' && normalizedStatus === 'Dismissed')
    const matchesCall = !filters.call || filters.call === 'All' || proposal.call === filters.call
    const matchesPrimaryClient = !filters.primaryClient || filters.primaryClient === 'All' || 
      proposal.primaryClients.includes(filters.primaryClient) ||
      proposal.secondaryClients.includes(filters.primaryClient)

    return matchesSearch && matchesStatus && matchesCall && matchesPrimaryClient
  })

  // Get unique call names for filter
  const uniqueCallNames = Array.from(new Set(proposals.map(p => p.call).filter(Boolean))).sort()

  // Pagination
  const totalPages = Math.ceil(filteredProposals.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedProposals = filteredProposals.slice(startIndex, endIndex)

  const handleEdit = (proposalId: string) => {
    const proposal = proposals.find(p => p.id === proposalId)
    if (proposal) {
      // Populate form with proposal data
      setFormData({
        proposalName: proposal.proposal,
        associatedCall: proposal.callId,
        status: proposal.status === 'in progress' ? 'In Progress' : proposal.status,
        primaryClients: proposal.primaryClients,
        secondaryClients: proposal.secondaryClients,
        internalNotes: proposal.internalNotes || ''
      })
      setPrimaryClientsFinancials(proposal.primaryClientsFinancials || {})
      setSecondaryClientsFinancials(proposal.secondaryClientsFinancials || {})
      setPrimaryClientSelect('')
      setSecondaryClientSelect('')
      setEditingProposalId(proposalId)
      setIsModalOpen(true)
    }
  }

  const handleDelete = (_proposalId: string) => {
    window.alert('La eliminación está desactivada para conservar el histórico de proposals.')
  }

  const handleNewProposal = () => {
    setEditingProposalId(null)
    setFormData({
      proposalName: '',
      associatedCall: '',
      status: 'In Progress',
      primaryClients: [],
      secondaryClients: [],
      internalNotes: ''
    })
    setPrimaryClientSelect('')
    setSecondaryClientSelect('')
    setPrimaryClientsFinancials({})
    setSecondaryClientsFinancials({})
    setIsModalOpen(true)
  }


  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleAddPrimaryClient = (clientId?: string) => {
    const clientToAdd = clientId || primaryClientSelect
    if (clientToAdd && !formData.primaryClients.includes(clientToAdd)) {
      handleInputChange('primaryClients', [...formData.primaryClients, clientToAdd])
      // Initialize financials for new client
      setPrimaryClientsFinancials(prev => ({
        ...prev,
        [clientToAdd]: {
          clientId: clientToAdd,
          budget: '',
          grant: '',
          grantFee: '',
          loan: '',
          loanFee: '',
          equity: '',
          equityFee: '',
          totalFunding: '0.00',
          fee: '0.00'
        }
      }))
      setPrimaryClientSelect('')
    }
  }

  const handleRemovePrimaryClient = (clientId: string) => {
    handleInputChange('primaryClients', formData.primaryClients.filter(id => id !== clientId))
    // Remove financials for removed client
    setPrimaryClientsFinancials(prev => {
      const newFinancials = { ...prev }
      delete newFinancials[clientId]
      return newFinancials
    })
  }

  const handleFinancialChange = (clientId: string, field: string, value: string) => {
    setPrimaryClientsFinancials(prev => {
      const current = prev[clientId] || {
        clientId,
        budget: '',
        grant: '',
        grantFee: '',
        loan: '',
        loanFee: '',
        equity: '',
        equityFee: '',
        totalFunding: '0',
        fee: '0'
      }

      const updated = { ...current, [field]: value }

      // Calculate Total Funding
      const grant = parseEuropeanNumber(updated.grant) || 0
      const loan = parseEuropeanNumber(updated.loan) || 0
      const equity = parseEuropeanNumber(updated.equity) || 0
      updated.totalFunding = formatNumber(grant + loan + equity, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })

      // Calculate Fee
      const grantFee = parseEuropeanNumber(updated.grantFee) || 0
      const loanFee = parseEuropeanNumber(updated.loanFee) || 0
      const equityFee = parseEuropeanNumber(updated.equityFee) || 0
      const fee = (grant * grantFee / 100) + (loan * loanFee / 100) + (equity * equityFee / 100)
      updated.fee = formatNumber(fee, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })

      return { ...prev, [clientId]: updated }
    })
  }

  const handleAddSecondaryClient = (clientId?: string) => {
    const clientToAdd = clientId || secondaryClientSelect
    if (clientToAdd && !formData.secondaryClients.includes(clientToAdd)) {
      handleInputChange('secondaryClients', [...formData.secondaryClients, clientToAdd])
      // Initialize financials for new client
      setSecondaryClientsFinancials(prev => ({
        ...prev,
        [clientToAdd]: {
          clientId: clientToAdd,
          budget: '',
          grant: '',
          grantFee: '',
          loan: '',
          loanFee: '',
          equity: '',
          equityFee: '',
          totalFunding: '0.00',
          fee: '0.00'
        }
      }))
      setSecondaryClientSelect('')
    }
  }

  const handleRemoveSecondaryClient = (clientId: string) => {
    handleInputChange('secondaryClients', formData.secondaryClients.filter(id => id !== clientId))
    // Remove financials for removed client
    setSecondaryClientsFinancials(prev => {
      const newFinancials = { ...prev }
      delete newFinancials[clientId]
      return newFinancials
    })
  }

  const handleSecondaryFinancialChange = (clientId: string, field: string, value: string) => {
    setSecondaryClientsFinancials(prev => {
      const current = prev[clientId] || {
        clientId,
        budget: '',
        grant: '',
        grantFee: '',
        loan: '',
        loanFee: '',
        equity: '',
        equityFee: '',
        totalFunding: '0',
        fee: '0'
      }
      const updated = { ...current, [field]: value }

      // Calculate Total Funding
      const grant = parseEuropeanNumber(updated.grant) || 0
      const loan = parseEuropeanNumber(updated.loan) || 0
      const equity = parseEuropeanNumber(updated.equity) || 0
      updated.totalFunding = formatNumber(grant + loan + equity, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })

      // Calculate Fee
      const grantFee = parseEuropeanNumber(updated.grantFee) || 0
      const loanFee = parseEuropeanNumber(updated.loanFee) || 0
      const equityFee = parseEuropeanNumber(updated.equityFee) || 0
      const fee = (grant * grantFee / 100) + (loan * loanFee / 100) + (equity * equityFee / 100)
      updated.fee = formatNumber(fee, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })

      return { ...prev, [clientId]: updated }
    })
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.proposalName.trim()) newErrors.proposalName = 'Proposal Name is required'
    if (!formData.associatedCall) newErrors.associatedCall = 'Associated Call is required'
    if (!formData.status) newErrors.status = 'Status is required'
    if (formData.primaryClients.length === 0) newErrors.primaryClients = 'At least one Primary Client is required'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      // Find the call name
      const selectedCall = calls.find(c => c.id === formData.associatedCall)
      const callName = selectedCall?.name || formData.associatedCall

      // Calculate total budget funding and fee from all primary and secondary clients
      let totalBudgetFunding = 0
      let totalFee = 0

      formData.primaryClients.forEach(clientId => {
        const financials = primaryClientsFinancials[clientId]
        if (financials) {
          totalBudgetFunding += parseEuropeanNumber(financials.totalFunding) || 0
          totalFee += parseEuropeanNumber(financials.fee) || 0
        }
      })

      formData.secondaryClients.forEach(clientId => {
        const financials = secondaryClientsFinancials[clientId]
        if (financials) {
          totalBudgetFunding += parseEuropeanNumber(financials.totalFunding) || 0
          totalFee += parseEuropeanNumber(financials.fee) || 0
        }
      })

      const existingCreatedAt = editingProposalId
        ? proposals.find(p => p.id === editingProposalId)?.createdAt
        : undefined

      const proposalData: Proposal = {
        id: editingProposalId || `proposal-${Date.now()}`,
        proposal: formData.proposalName.trim(),
        call: callName,
        callId: formData.associatedCall,
        primaryClients: formData.primaryClients,
        secondaryClients: formData.secondaryClients,
        budgetFunding: formatNumber(totalBudgetFunding, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }),
        fee: formatNumber(totalFee, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }),
        status: formData.status,
        createdAt: existingCreatedAt || new Date().toISOString(),
        internalNotes: formData.internalNotes.trim() || undefined,
        primaryClientsFinancials: primaryClientsFinancials,
        secondaryClientsFinancials: secondaryClientsFinancials
      }

      if (editingProposalId) {
        // Update existing proposal
        setProposals(prev => prev.map(p => p.id === editingProposalId ? proposalData : p))
      } else {
        // Add new proposal
        setProposals(prev => [...prev, proposalData])
      }

      // Reset form and close modal
      setFormData({
        proposalName: '',
        associatedCall: '',
        status: 'In Progress',
        primaryClients: [],
        secondaryClients: [],
        internalNotes: ''
      })
      setPrimaryClientSelect('')
      setSecondaryClientSelect('')
      setPrimaryClientsFinancials({})
      setEditingProposalId(null)
      setIsModalOpen(false)
    }
  }

  const getClientName = (clientId: string) => {
    const client = customers.find(c => c.id === clientId)
    return client?.name || clientId
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return dateString
    const day = date.getDate().toString().padStart(2, '0')
    const month = date.toLocaleString('es-ES', { month: 'short' })
    const year = date.getFullYear()
    return `${day} ${month} ${year}`
  }

  const getCallDeadline = (callId: string) => {
    const call = calls.find(c => c.id === callId)
    return call?.deadline
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Proposals</h1>
        </div>
      </div>

      <div className="customers-toolbar">
        <div className="search-bar-inline">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by proposal, call, clients, budget, fee, status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input-inline"
          />
        </div>

        <div className="filter-buttons">
          <div className="filter-button-group">
            <div className="select-wrapper" style={{ position: 'relative' }}>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className={`filter-btn ${filters.status !== 'All' ? 'active' : ''}`}
                style={{ appearance: 'none', paddingRight: '2rem', cursor: 'pointer' }}
              >
                <option value="All">All Status</option>
                <option value="In Progress">In Progress</option>
                <option value="Pending">Pending</option>
                <option value="Granted">Granted</option>
                <option value="Dismissed">Dismissed</option>
              </select>
              <ChevronDown size={16} className="select-chevron" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
            <div className="select-wrapper" style={{ position: 'relative' }}>
              <select
                value={filters.call}
                onChange={(e) => setFilters(prev => ({ ...prev, call: e.target.value }))}
                className={`filter-btn ${filters.call !== 'All' ? 'active' : ''}`}
                style={{ appearance: 'none', paddingRight: '2rem', cursor: 'pointer' }}
              >
                <option value="All">All Calls</option>
                {uniqueCallNames.map(callName => (
                  <option key={callName} value={callName}>{callName}</option>
                ))}
              </select>
              <ChevronDown size={16} className="select-chevron" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          </div>
        </div>

        <button className="btn-primary" onClick={handleNewProposal}>+ New Proposal</button>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false)
          setEditingProposalId(null)
          setFormData({
            proposalName: '',
            associatedCall: '',
            status: 'in progress',
            primaryClients: [],
            secondaryClients: [],
            internalNotes: ''
          })
          setPrimaryClientSelect('')
          setSecondaryClientSelect('')
          setPrimaryClientsFinancials({})
          setSecondaryClientsFinancials({})
          setErrors({})
        }} 
        title={editingProposalId ? "Edit Proposal" : "New Proposal"}
      >
        <form onSubmit={handleSubmit} className="client-form">
          <div className="form-section">
            <h3 className="form-section-title">Basic Information</h3>
            
            <div className="form-group">
              <label htmlFor="proposalName">Proposal Name <span className="required">*</span></label>
              <input
                type="text"
                id="proposalName"
                value={formData.proposalName}
                onChange={(e) => handleInputChange('proposalName', e.target.value)}
                className={errors.proposalName ? 'error' : ''}
              />
              {errors.proposalName && <span className="error-message">{errors.proposalName}</span>}
            </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="associatedCall">Associated Call <span className="required">*</span></label>
            <select
              id="associatedCall"
              value={formData.associatedCall}
              onChange={(e) => handleInputChange('associatedCall', e.target.value)}
              className={errors.associatedCall ? 'error' : ''}
            >
              <option value="">Select a call</option>
              {availableCalls.length === 0 ? (
                <option value="" disabled>No calls available. Please add calls first.</option>
              ) : (
                availableCalls.map(call => (
                  <option key={call.id} value={call.id}>{call.name}</option>
                ))
              )}
            </select>
            {errors.associatedCall && <span className="error-message">{errors.associatedCall}</span>}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="status">Status <span className="required">*</span></label>
          <select
            id="status"
            value={formData.status}
            onChange={(e) => handleInputChange('status', e.target.value)}
            className={errors.status ? 'error' : ''}
          >
            <option value="In Progress">In Progress</option>
            <option value="Pending">Pending</option>
            <option value="Granted">Granted</option>
            <option value="Dismissed">Dismissed</option>
          </select>
          {errors.status && <span className="error-message">{errors.status}</span>}
          {formData.status === 'Granted' && (
            <div className="status-note granted-note">
              When you save, a running project will be automatically created.
            </div>
          )}
        </div>
          </div>

          <div className="form-section">
            <div className="form-group">
              <label>Primary Clients <span className="required">*</span></label>
              <div className="client-selector">
                <label className="add-client-label">Add Client</label>
                <select
                  value={primaryClientSelect}
                  onChange={(e) => {
                    const selectedClientId = e.target.value
                    if (selectedClientId) {
                      handleAddPrimaryClient(selectedClientId)
                    } else {
                      setPrimaryClientSelect('')
                    }
                  }}
                  className="client-select-dropdown"
                >
                  <option value="">Select a client to add...</option>
                  {contractorClients
                    .filter(client => !formData.primaryClients.includes(client.id))
                    .map(client => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                </select>
                {formData.primaryClients.length === 0 ? (
                  <div className="no-clients-message">
                    <Users size={48} className="no-clients-icon" />
                    <div className="no-clients-text">
                      <div>No clients added yet.</div>
                      <div>Select a client from the dropdown above.</div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="selected-clients-list">
                      {formData.primaryClients.map(clientId => (
                        <div key={clientId} className="selected-client-tag">
                          <span>{getClientName(clientId)}</span>
                          <button
                            type="button"
                            className="remove-client-btn"
                            onClick={() => handleRemovePrimaryClient(clientId)}
                            aria-label="Remove client"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {formData.primaryClients.map(clientId => {
                      const financials = primaryClientsFinancials[clientId] || {
                        clientId,
                        budget: '',
                        grant: '',
                        grantFee: '',
                        loan: '',
                        loanFee: '',
                        equity: '',
                        equityFee: '',
                        totalFunding: '0',
                        fee: '0'
                      }
                      return (
                        <div key={`financials-${clientId}`} className="client-financials-form">
                          <h4 className="client-financials-title">{getClientName(clientId)} - Financial Information</h4>
                          <div className="financials-grid">
                            <div className="form-group">
                              <label htmlFor={`budget-${clientId}`}>Budget (€)</label>
                              <input
                                type="text"
                                id={`budget-${clientId}`}
                                value={financials.budget}
                                onChange={(e) => handleFinancialChange(clientId, 'budget', e.target.value)}
                                placeholder="0.00"
                              />
                            </div>

                            <div className="form-group">
                              <label htmlFor={`grant-${clientId}`}>Grant (€)</label>
                              <input
                                type="text"
                                id={`grant-${clientId}`}
                                value={financials.grant}
                                onChange={(e) => handleFinancialChange(clientId, 'grant', e.target.value)}
                                placeholder="0.00"
                              />
                            </div>

                            <div className="form-group">
                              <label htmlFor={`grantFee-${clientId}`}>Grant Fee (%)</label>
                              <input
                                type="text"
                                id={`grantFee-${clientId}`}
                                value={financials.grantFee}
                                onChange={(e) => handleFinancialChange(clientId, 'grantFee', e.target.value)}
                                placeholder="0.00"
                              />
                            </div>

                            <div className="form-group">
                              <label htmlFor={`loan-${clientId}`}>Loan (€)</label>
                              <input
                                type="text"
                                id={`loan-${clientId}`}
                                value={financials.loan}
                                onChange={(e) => handleFinancialChange(clientId, 'loan', e.target.value)}
                                placeholder="0.00"
                              />
                            </div>

                            <div className="form-group">
                              <label htmlFor={`loanFee-${clientId}`}>Loan Fee (%)</label>
                              <input
                                type="text"
                                id={`loanFee-${clientId}`}
                                value={financials.loanFee}
                                onChange={(e) => handleFinancialChange(clientId, 'loanFee', e.target.value)}
                                placeholder="0.00"
                              />
                            </div>

                            <div className="form-group">
                              <label htmlFor={`equity-${clientId}`}>Equity (€)</label>
                              <input
                                type="text"
                                id={`equity-${clientId}`}
                                value={financials.equity}
                                onChange={(e) => handleFinancialChange(clientId, 'equity', e.target.value)}
                                placeholder="0.00"
                              />
                            </div>

                            <div className="form-group">
                              <label htmlFor={`equityFee-${clientId}`}>Equity fee (%)</label>
                              <input
                                type="text"
                                id={`equityFee-${clientId}`}
                                value={financials.equityFee}
                                onChange={(e) => handleFinancialChange(clientId, 'equityFee', e.target.value)}
                                placeholder="0.00"
                              />
                            </div>

                            <div className="form-group calculated-field">
                              <label>Total Funding (€)</label>
                              <div className="calculated-value">{formatCurrency(financials.totalFunding)}</div>
                            </div>

                            <div className="form-group calculated-field">
                              <label>Fee (€)</label>
                              <div className="calculated-value">{formatCurrency(financials.fee)}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
              {errors.primaryClients && <span className="error-message">{errors.primaryClients}</span>}
            </div>

            <div className="form-group">
              <label>Secondary Clients <span className="required">*</span></label>
              <div className="client-selector">
                <label className="add-client-label">Add Client</label>
                <select
                  value={secondaryClientSelect}
                  onChange={(e) => {
                    const selectedClientId = e.target.value
                    if (selectedClientId) {
                      handleAddSecondaryClient(selectedClientId)
                    } else {
                      setSecondaryClientSelect('')
                    }
                  }}
                  className="client-select-dropdown"
                >
                  <option value="">Select a client to add...</option>
                  {secondaryClientsList
                    .filter(client => !formData.secondaryClients.includes(client.id))
                    .map(client => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                </select>
                {formData.secondaryClients.length === 0 ? (
                  <div className="no-clients-message">
                    <Users size={48} className="no-clients-icon" />
                    <div className="no-clients-text">
                      <div>No clients added yet.</div>
                      <div>Select a client from the dropdown above.</div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="selected-clients-list">
                      {formData.secondaryClients.map(clientId => (
                        <div key={clientId} className="selected-client-tag">
                          <span>{getClientName(clientId)}</span>
                          <button
                            type="button"
                            className="remove-client-btn"
                            onClick={() => handleRemoveSecondaryClient(clientId)}
                            aria-label="Remove client"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {formData.secondaryClients.map(clientId => {
                      const financials = secondaryClientsFinancials[clientId] || {
                        clientId,
                        budget: '',
                        grant: '',
                        grantFee: '',
                        loan: '',
                        loanFee: '',
                        equity: '',
                        equityFee: '',
                        totalFunding: '0',
                        fee: '0'
                      }
                      return (
                        <div key={`financials-${clientId}`} className="client-financials-form">
                          <h4 className="client-financials-title">{getClientName(clientId)} - Financial Information</h4>
                          <div className="financials-grid">
                            <div className="form-group">
                              <label htmlFor={`budget-sec-${clientId}`}>Budget (€)</label>
                              <input
                                type="text"
                                id={`budget-sec-${clientId}`}
                                value={financials.budget}
                                onChange={(e) => handleSecondaryFinancialChange(clientId, 'budget', e.target.value)}
                                placeholder="0,00"
                              />
                            </div>

                            <div className="form-group">
                              <label htmlFor={`grant-sec-${clientId}`}>Grant (€)</label>
                              <input
                                type="text"
                                id={`grant-sec-${clientId}`}
                                value={financials.grant}
                                onChange={(e) => handleSecondaryFinancialChange(clientId, 'grant', e.target.value)}
                                placeholder="0,00"
                              />
                            </div>

                            <div className="form-group">
                              <label htmlFor={`grantFee-sec-${clientId}`}>Grant Fee (%)</label>
                              <input
                                type="text"
                                id={`grantFee-sec-${clientId}`}
                                value={financials.grantFee}
                                onChange={(e) => handleSecondaryFinancialChange(clientId, 'grantFee', e.target.value)}
                                placeholder="0,00"
                              />
                            </div>

                            <div className="form-group">
                              <label htmlFor={`loan-sec-${clientId}`}>Loan (€)</label>
                              <input
                                type="text"
                                id={`loan-sec-${clientId}`}
                                value={financials.loan}
                                onChange={(e) => handleSecondaryFinancialChange(clientId, 'loan', e.target.value)}
                                placeholder="0,00"
                              />
                            </div>

                            <div className="form-group">
                              <label htmlFor={`loanFee-sec-${clientId}`}>Loan Fee (%)</label>
                              <input
                                type="text"
                                id={`loanFee-sec-${clientId}`}
                                value={financials.loanFee}
                                onChange={(e) => handleSecondaryFinancialChange(clientId, 'loanFee', e.target.value)}
                                placeholder="0,00"
                              />
                            </div>

                            <div className="form-group">
                              <label htmlFor={`equity-sec-${clientId}`}>Equity (€)</label>
                              <input
                                type="text"
                                id={`equity-sec-${clientId}`}
                                value={financials.equity}
                                onChange={(e) => handleSecondaryFinancialChange(clientId, 'equity', e.target.value)}
                                placeholder="0,00"
                              />
                            </div>

                            <div className="form-group">
                              <label htmlFor={`equityFee-sec-${clientId}`}>Equity fee (%)</label>
                              <input
                                type="text"
                                id={`equityFee-sec-${clientId}`}
                                value={financials.equityFee}
                                onChange={(e) => handleSecondaryFinancialChange(clientId, 'equityFee', e.target.value)}
                                placeholder="0,00"
                              />
                            </div>

                            <div className="form-group calculated-field">
                              <label>Total Funding (€)</label>
                              <div className="calculated-value">{formatCurrency(financials.totalFunding)}</div>
                            </div>

                            <div className="form-group calculated-field">
                              <label>Fee (€)</label>
                              <div className="calculated-value">{formatCurrency(financials.fee)}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
              {errors.secondaryClients && <span className="error-message">{errors.secondaryClients}</span>}
            </div>
          </div>

          <div className="form-section">
            <div className="form-group">
              <label htmlFor="internalNotes">Internal Notes (optional)</label>
              <textarea
                id="internalNotes"
                value={formData.internalNotes}
                onChange={(e) => handleInputChange('internalNotes', e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <div className="form-actions">
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={() => {
                setIsModalOpen(false)
                setEditingProposalId(null)
                setFormData({
                  proposalName: '',
                  associatedCall: '',
            status: 'In Progress',
                  primaryClients: [],
                  secondaryClients: [],
                  internalNotes: ''
                })
                setPrimaryClientSelect('')
                setSecondaryClientSelect('')
                setPrimaryClientsFinancials({})
                setSecondaryClientsFinancials({})
                setErrors({})
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {editingProposalId ? 'Update Proposal' : 'Save Proposal'}
            </button>
          </div>
        </form>
      </Modal>
      
      <div className="content-section">
        <div className="table-container">
          <table className="data-table customers-table">
            <thead>
              <tr>
                <th>PROPOSAL</th>
                <th>CALL</th>
                <th>CONTRACTOR</th>
                <th>SECONDARY</th>
                <th>BUDGET FUNDING</th>
                <th>FEE</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProposals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-row">
                    {searchTerm || filters.status !== 'All' || filters.call !== 'All'
                      ? 'No proposals match your filters' 
                      : 'No proposals registered yet'}
                  </td>
                </tr>
              ) : (
                paginatedProposals.map(proposal => (
                  <tr key={proposal.id} className="customer-row">
                    <td className="name-cell">
                      <div className="proposal-cell">
                        <div className="proposal-title">{proposal.proposal}</div>
                        <div className="proposal-subline">
                          <Calendar size={14} className="proposal-icon" />
                          Created {formatDate(proposal.createdAt)}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="proposal-cell">
                        <div className="proposal-title">{proposal.call}</div>
                        <div className="proposal-subline">
                          <Clock size={14} className="proposal-icon" />
                          Deadline: {formatDate(getCallDeadline(proposal.callId))}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="proposal-clients">
                        {proposal.primaryClients.length > 0 ? (
                          <>
                            <div className="proposal-count">
                              <Users size={14} className="proposal-icon" />
                              {proposal.primaryClients.length}
                            </div>
                            <div className="proposal-subline">
                              {proposal.primaryClients.map(getClientName).join(', ')}
                            </div>
                          </>
                        ) : (
                          <span className="empty-text">-</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="proposal-clients">
                        {proposal.secondaryClients.length > 0 ? (
                          <>
                            <div className="proposal-count">
                              <Users size={14} className="proposal-icon" />
                              {proposal.secondaryClients.length}
                            </div>
                            <div className="proposal-subline">
                              {proposal.secondaryClients.map(getClientName).join(', ')}
                            </div>
                          </>
                        ) : (
                          <span className="empty-text">-</span>
                        )}
                      </div>
                    </td>
                    <td>{formatCurrency(proposal.budgetFunding)}</td>
                    <td className="proposal-fee">{formatCurrency(proposal.fee)}</td>
                    <td>
                      <span className={`status-badge status-${proposal.status.toLowerCase().replace(' ', '-')}`}>
                        {proposal.status}
                      </span>
                    </td>
                    <td>
                      <ActionsMenu
                        onEdit={() => handleEdit(proposal.id)}
                        onDelete={() => handleDelete(proposal.id)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredProposals.length > 0 && (
          <div className="pagination">
            <div className="pagination-info">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredProposals.length)} of {filteredProposals.length} proposals
            </div>
            <div className="pagination-controls">
              <button 
                className="pagination-btn"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={18} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }
                return (
                  <button
                    key={pageNum}
                    className={`pagination-btn ${currentPage === pageNum ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                )
              })}
              {totalPages > 5 && currentPage < totalPages - 2 && (
                <>
                  <span className="pagination-ellipsis">...</span>
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage(totalPages)}
                  >
                    {totalPages}
                  </button>
                </>
              )}
              <button 
                className="pagination-btn"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Proposals
