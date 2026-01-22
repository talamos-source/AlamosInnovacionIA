import { useState, useEffect } from 'react'
import { Search, ChevronDown, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import ActionsMenu from '../components/ActionsMenu'
import Modal from '../components/Modal'
import { formatCurrency } from '../utils/formatCurrency'
import './Page.css'

interface Call {
  id: string
  name: string
  scope: string
  deadline: string
  budget: string
  status: string
  // Additional fields for full call data
  fundingBody?: string
  program?: string
  year?: string
  openDate?: string
  aidType?: string
  sourceUrl?: string
  eligibleCompanySizes?: string[]
  minimumCompanyAge?: string
  eligibleCountries?: string[]
  eligibleRegion?: string[]
  additionalRequirements?: string
  internalNotes?: string
}

const Calls = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState({
    deadline: 'All',
    status: 'All',
    scope: 'All'
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCallId, setEditingCallId] = useState<string | null>(null)
  const itemsPerPage = 10

  // Form state
  const [formData, setFormData] = useState({
    callName: '',
    fundingBody: '',
    program: '',
    year: '',
    openDate: '',
    deadline: '',
    aidType: '',
    budget: '',
    sourceUrl: '',
    geographicScope: '',
    eligibleCompanySizes: [] as string[],
    minimumCompanyAge: '',
    eligibleCountries: [] as string[],
    eligibleRegion: [] as string[],
    additionalRequirements: '',
    status: 'Draft',
    internalNotes: ''
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Countries list (same as Customers)
  const countries = [
    'Albania', 'Andorra', 'Armenia', 'Austria', 'Belgium', 'Bosnia and Herzegovina', 'Bulgaria',
    'China', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Egypt', 'Estonia', 'Faroe Islands',
    'Finland', 'France', 'Georgia', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Ireland', 'Israel',
    'Italy', 'Japan', 'Kosovo', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Moldova', 'Monaco',
    'Montenegro', 'Morocco', 'Netherlands', 'North Macedonia', 'Norway', 'Poland', 'Portugal',
    'Romania', 'San Marino', 'Serbia', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Tunisia',
    'Türkiye', 'Ukraine', 'United Kingdom', 'United States', 'Vatican City'
  ].sort()

  // Spanish regions (same as Customers)
  const spanishRegions = [
    'Andalucía', 'Aragón', 'Canarias', 'Cantabria', 'Castilla-La Mancha',
    'Castilla y León', 'Cataluña', 'Comunidad de Madrid', 'Comunidad Foral de Navarra',
    'Comunitat Valenciana', 'Extremadura', 'Galicia', 'Illes Balears', 'La Rioja',
    'País Vasco o Euskadi', 'Principado de Asturias', 'Región de Murcia', 'Ceuta', 'Melilla'
  ]

  const aidTypes = ['Grant', 'Loan', 'Mixed (Grant + Loan)', 'Equity', 'Tax Credit', 'Other']
  const geographicScopes = ['International', 'EU', 'National', 'Regional']
  const companySizes = ['Small', 'Medium', 'Large']
  const statuses = ['Draft', 'Upcoming', 'Open', 'Closed', 'Archived']
  const euDefaultCountries = [
    'Germany',
    'Austria',
    'Belgium',
    'Bulgaria',
    'Cyprus',
    'Croatia',
    'Denmark',
    'Slovakia',
    'Slovenia',
    'Spain',
    'Estonia',
    'Finland',
    'France',
    'Greece',
    'Hungary',
    'Ireland',
    'Italy',
    'Latvia',
    'Lithuania',
    'Luxembourg',
    'Malta',
    'Netherlands',
    'Poland',
    'Portugal',
    'Czech Republic',
    'Romania',
    'Sweden'
  ]

  // Load calls from localStorage on component mount
  const loadCalls = (): Call[] => {
    try {
      const saved = localStorage.getItem('calls')
      return saved ? JSON.parse(saved) : []
    } catch (error) {
      console.error('Error loading calls from localStorage:', error)
      return []
    }
  }

  // Calls state - load from localStorage
  const [calls, setCalls] = useState<Call[]>(loadCalls)

  // Save calls to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('calls', JSON.stringify(calls))
    } catch (error) {
      console.error('Error saving calls to localStorage:', error)
    }
  }, [calls])

  // Filter calls
  const filteredCalls = calls.filter(call => {
    const searchLower = searchTerm.toLowerCase()
    
    // Search across all table fields
    const matchesSearch = searchTerm === '' || 
      call.name.toLowerCase().includes(searchLower) ||
      call.scope.toLowerCase().includes(searchLower) ||
      call.deadline.toLowerCase().includes(searchLower) ||
      call.budget.toLowerCase().includes(searchLower) ||
      call.status.toLowerCase().includes(searchLower)
    
    const matchesDeadline = !filters.deadline || filters.deadline === 'All' || call.deadline === filters.deadline
    const matchesStatus = !filters.status || filters.status === 'All' || call.status === filters.status
    const matchesScope = !filters.scope || filters.scope === 'All' || call.scope === filters.scope

    return matchesSearch && matchesDeadline && matchesStatus && matchesScope
  })

  // Get unique values for filters
  const uniqueDeadlines = Array.from(new Set(calls.map(c => c.deadline).filter(Boolean))).sort()
  const uniqueStatuses = Array.from(new Set(calls.map(c => c.status).filter(Boolean))).sort()
  const uniqueScopes = Array.from(new Set(calls.map(c => c.scope).filter(Boolean))).sort()

  // Pagination
  const totalPages = Math.ceil(filteredCalls.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedCalls = filteredCalls.slice(startIndex, endIndex)

  const handleEdit = (callId: string) => {
    const call = calls.find(c => c.id === callId)
    if (call) {
      // Populate form with call data - ensure all fields are loaded
      setFormData({
        callName: call.name || '',
        fundingBody: call.fundingBody || '',
        program: call.program || '',
        year: call.year || '',
        openDate: call.openDate || '',
        deadline: call.deadline || '',
        aidType: call.aidType || '',
        budget: call.budget === '-' ? '' : (call.budget || ''),
        sourceUrl: call.sourceUrl || '',
        geographicScope: call.scope || '',
        eligibleCompanySizes: call.eligibleCompanySizes || [],
        minimumCompanyAge: call.minimumCompanyAge || '',
        eligibleCountries: call.eligibleCountries || [],
        eligibleRegion: call.eligibleRegion || [],
        additionalRequirements: call.additionalRequirements || '',
        status: call.status || 'Draft',
        internalNotes: call.internalNotes || ''
      })
      setEditingCallId(callId)
      setIsModalOpen(true)
    }
  }

  const handleDelete = (_callId: string) => {
    window.alert('La eliminación está desactivada para conservar el histórico de calls.')
  }

  const handleNewCall = () => {
    setEditingCallId(null)
    setFormData({
      callName: '',
      fundingBody: '',
      program: '',
      year: '',
      openDate: '',
      deadline: '',
      aidType: '',
      budget: '',
      sourceUrl: '',
      geographicScope: '',
      eligibleCompanySizes: [],
      minimumCompanyAge: '',
      eligibleCountries: [],
      eligibleRegion: [],
      additionalRequirements: '',
      status: 'Draft',
      internalNotes: ''
    })
    setErrors({})
    setIsModalOpen(true)
  }

  const formatDate = (dateString: string) => {
    // Format date for display
    return dateString
  }


  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
    // Clear eligible region if Spain is not in eligible countries
    if (field === 'eligibleCountries') {
      const countries = Array.isArray(value) ? value : []
      if (!countries.includes('Spain')) {
        setFormData(prev => ({ ...prev, eligibleRegion: [] }))
      }
    }
    if (field === 'geographicScope' && typeof value === 'string') {
      setFormData(prev => {
        if (prev.eligibleCountries.length > 0) {
          return prev
        }
        return {
          ...prev,
          eligibleCountries: [...euDefaultCountries]
        }
      })
    }
  }

  const handleDateInput = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '')
    if (value.length >= 2) value = value.slice(0, 2) + '/' + value.slice(2)
    if (value.length >= 5) value = value.slice(0, 5) + '/' + value.slice(5, 9)
    handleInputChange(field, value)
  }

  const isValidDate = (value: string) => {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return false
    const [dayStr, monthStr, yearStr] = value.split('/')
    const day = Number(dayStr)
    const month = Number(monthStr)
    const year = Number(yearStr)
    if (!day || !month || !year) return false
    if (month < 1 || month > 12) return false
    if (year < 1900) return false
    const daysInMonth = new Date(year, month, 0).getDate()
    return day >= 1 && day <= daysInMonth
  }

  const handleMultiSelect = (field: string, value: string) => {
    const currentValues = formData[field as keyof typeof formData] as string[]
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value]
    handleInputChange(field, newValues)
    // Clear eligible region if Spain is deselected
    if (field === 'eligibleCountries' && value === 'Spain' && !newValues.includes('Spain')) {
      setFormData(prev => ({ ...prev, eligibleRegion: [] }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.callName.trim()) newErrors.callName = 'Call Name is required'
    if (!formData.fundingBody.trim()) newErrors.fundingBody = 'Funding Body is required'
    if (!formData.program.trim()) newErrors.program = 'Program is required'
    if (!formData.year) newErrors.year = 'Year is required'
    if (!formData.openDate) newErrors.openDate = 'Open Date is required'
    if (!formData.deadline) newErrors.deadline = 'Deadline is required'
    if (!formData.aidType) newErrors.aidType = 'Aid Type is required'
    if (!formData.sourceUrl.trim()) newErrors.sourceUrl = 'Source URL is required'
    if (!formData.geographicScope) newErrors.geographicScope = 'Geographic Scope is required'
    if (formData.eligibleCompanySizes.length === 0) newErrors.eligibleCompanySizes = 'At least one Company Size is required'
    if (formData.eligibleCountries.length === 0) newErrors.eligibleCountries = 'At least one Eligible Country is required'

    // Validate URL format
    if (formData.sourceUrl && !/^https?:\/\/.+/.test(formData.sourceUrl)) {
      newErrors.sourceUrl = 'Source URL must be a valid URL (e.g., https://example.com)'
    }

    // Validate date format and calendar validity
    if (formData.openDate && !isValidDate(formData.openDate)) {
      newErrors.openDate = 'Date must be valid and in format dd/mm/yyyy'
    }
    if (formData.deadline && !isValidDate(formData.deadline)) {
      newErrors.deadline = 'Date must be valid and in format dd/mm/yyyy'
    }

    // Validate year
    if (formData.year) {
      const yearNum = Number(formData.year)
      if (isNaN(yearNum) || formData.year.length !== 4) {
        newErrors.year = 'Year must be a valid 4-digit year'
      } else if (yearNum < 2000) {
        newErrors.year = 'Year must be 2000 or later'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      const callData: Call = {
        id: editingCallId || `call-${Date.now()}`,
        name: formData.callName.trim(),
        scope: formData.geographicScope,
        deadline: formData.deadline,
        budget: formData.budget || '-',
        status: formData.status,
        fundingBody: formData.fundingBody.trim(),
        program: formData.program.trim(),
        year: formData.year.trim(),
        openDate: formData.openDate,
        aidType: formData.aidType,
        sourceUrl: formData.sourceUrl.trim(),
        eligibleCompanySizes: formData.eligibleCompanySizes,
        minimumCompanyAge: formData.minimumCompanyAge.trim() || '',
        eligibleCountries: formData.eligibleCountries,
        eligibleRegion: formData.eligibleRegion,
        additionalRequirements: formData.additionalRequirements.trim() || '',
        internalNotes: formData.internalNotes.trim() || ''
      }

      if (editingCallId) {
        // Update existing call
        setCalls(prev => prev.map(c => c.id === editingCallId ? callData : c))
      } else {
        // Add new call to the list
        setCalls(prev => [...prev, callData])
      }
      
      // Reset form and close modal
      setFormData({
        callName: '',
        fundingBody: '',
        program: '',
        year: '',
        openDate: '',
        deadline: '',
        aidType: '',
        budget: '',
        sourceUrl: '',
        geographicScope: '',
        eligibleCompanySizes: [],
        minimumCompanyAge: '',
        eligibleCountries: [],
        eligibleRegion: [],
        additionalRequirements: '',
        status: 'Draft',
        internalNotes: ''
      })
      setEditingCallId(null)
      setIsModalOpen(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Calls</h1>
        </div>
      </div>

      <div className="customers-toolbar">
        <div className="search-bar-inline">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by call name, scope, deadline, budget, status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input-inline"
          />
        </div>

        <div className="filter-buttons">
          <div className="filter-button-group">
            <div className="select-wrapper" style={{ position: 'relative' }}>
              <select
                value={filters.deadline}
                onChange={(e) => setFilters(prev => ({ ...prev, deadline: e.target.value }))}
                className={`filter-btn ${filters.deadline !== 'All' ? 'active' : ''}`}
                style={{ appearance: 'none', paddingRight: '2rem', cursor: 'pointer' }}
              >
                <option value="All">All Deadlines</option>
                {uniqueDeadlines.map(deadline => (
                  <option key={deadline} value={deadline}>{deadline}</option>
                ))}
              </select>
              <ChevronDown size={16} className="select-chevron" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
            <div className="select-wrapper" style={{ position: 'relative' }}>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className={`filter-btn ${filters.status !== 'All' ? 'active' : ''}`}
                style={{ appearance: 'none', paddingRight: '2rem', cursor: 'pointer' }}
              >
                <option value="All">All Status</option>
                {uniqueStatuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <ChevronDown size={16} className="select-chevron" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
            <div className="select-wrapper" style={{ position: 'relative' }}>
              <select
                value={filters.scope}
                onChange={(e) => setFilters(prev => ({ ...prev, scope: e.target.value }))}
                className={`filter-btn ${filters.scope !== 'All' ? 'active' : ''}`}
                style={{ appearance: 'none', paddingRight: '2rem', cursor: 'pointer' }}
              >
                <option value="All">All Scopes</option>
                {uniqueScopes.map(scope => (
                  <option key={scope} value={scope}>{scope}</option>
                ))}
              </select>
              <ChevronDown size={16} className="select-chevron" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          </div>
        </div>

        <button className="btn-primary" onClick={handleNewCall}>+ New Call</button>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false)
          setEditingCallId(null)
          setFormData({
            callName: '',
            fundingBody: '',
            program: '',
            year: '',
            openDate: '',
            deadline: '',
            aidType: '',
            budget: '',
            sourceUrl: '',
            geographicScope: '',
            eligibleCompanySizes: [],
            minimumCompanyAge: '',
            eligibleCountries: [],
            eligibleRegion: [],
            additionalRequirements: '',
            status: 'Draft',
            internalNotes: ''
          })
          setErrors({})
        }} 
        title={editingCallId ? "Edit Call" : "New Call"}
      >
        <form onSubmit={handleSubmit} className="client-form">
          <div className="form-section">
            <h3 className="form-section-title">Basic Information</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="callName">Call Name <span className="required">*</span></label>
                <input
                  type="text"
                  id="callName"
                  value={formData.callName}
                  onChange={(e) => handleInputChange('callName', e.target.value)}
                  className={errors.callName ? 'error' : ''}
                  placeholder="e.g., NEOTEC 2026"
                />
                {errors.callName && <span className="error-message">{errors.callName}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="fundingBody">Funding Body <span className="required">*</span></label>
                <input
                  type="text"
                  id="fundingBody"
                  value={formData.fundingBody}
                  onChange={(e) => handleInputChange('fundingBody', e.target.value)}
                  className={errors.fundingBody ? 'error' : ''}
                  placeholder="e.g., CDTI, ENISA, European Commission"
                />
                {errors.fundingBody && <span className="error-message">{errors.fundingBody}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="program">Program <span className="required">*</span></label>
                <input
                  type="text"
                  id="program"
                  value={formData.program}
                  onChange={(e) => handleInputChange('program', e.target.value)}
                  className={errors.program ? 'error' : ''}
                  placeholder="e.g., Horizon Europe, NEOTEC"
                />
                {errors.program && <span className="error-message">{errors.program}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="year">Year <span className="required">*</span></label>
                <input
                  type="text"
                  id="year"
                  value={formData.year}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '')
                    if (value.length <= 4) {
                      handleInputChange('year', value)
                    }
                  }}
                  className={errors.year ? 'error' : ''}
                  placeholder="2026"
                  maxLength={4}
                />
                {errors.year && <span className="error-message">{errors.year}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="openDate">Open Date <span className="required">*</span></label>
                <input
                  type="text"
                  id="openDate"
                  value={formData.openDate}
                  onChange={handleDateInput('openDate')}
                  className={errors.openDate ? 'error' : ''}
                  placeholder="dd/mm/yyyy"
                  maxLength={10}
                />
                {errors.openDate && <span className="error-message">{errors.openDate}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="deadline">Deadline <span className="required">*</span></label>
                <input
                  type="text"
                  id="deadline"
                  value={formData.deadline}
                  onChange={handleDateInput('deadline')}
                  className={errors.deadline ? 'error' : ''}
                  placeholder="dd/mm/yyyy"
                  maxLength={10}
                />
                {errors.deadline && <span className="error-message">{errors.deadline}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="aidType">Aid Type <span className="required">*</span></label>
                <select
                  id="aidType"
                  value={formData.aidType}
                  onChange={(e) => handleInputChange('aidType', e.target.value)}
                  className={errors.aidType ? 'error' : ''}
                >
                  <option value="">Select type</option>
                  {aidTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                {errors.aidType && <span className="error-message">{errors.aidType}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="budget">Budget (optional)</label>
              <div className="input-with-suffix">
                <input
                  type="text"
                  id="budget"
                  value={formData.budget}
                  onChange={(e) => handleInputChange('budget', e.target.value)}
                  placeholder="e.g., 500000"
                />
                <span className="input-suffix">€</span>
              </div>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="sourceUrl">Source URL <span className="required">*</span></label>
              <input
                type="text"
                id="sourceUrl"
                value={formData.sourceUrl}
                onChange={(e) => handleInputChange('sourceUrl', e.target.value)}
                className={errors.sourceUrl ? 'error' : ''}
                placeholder="https://..."
              />
              {errors.sourceUrl && <span className="error-message">{errors.sourceUrl}</span>}
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">Eligibility Requirements</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="geographicScope">Geographic Scope <span className="required">*</span></label>
                <select
                  id="geographicScope"
                  value={formData.geographicScope}
                  onChange={(e) => handleInputChange('geographicScope', e.target.value)}
                  className={errors.geographicScope ? 'error' : ''}
                >
                  <option value="">Select scope</option>
                  {geographicScopes.map(scope => (
                    <option key={scope} value={scope}>{scope}</option>
                  ))}
                </select>
                {errors.geographicScope && <span className="error-message">{errors.geographicScope}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="minimumCompanyAge">Minimum Company Age (years)</label>
                <input
                  type="text"
                  id="minimumCompanyAge"
                  value={formData.minimumCompanyAge}
                  onChange={(e) => handleInputChange('minimumCompanyAge', e.target.value)}
                  placeholder="e.g., 3"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Eligible Company Sizes <span className="required">*</span></label>
              <div className="button-select-grid">
                {companySizes.map(size => (
                  <button
                    key={size}
                    type="button"
                    className={`select-button ${formData.eligibleCompanySizes.includes(size) ? 'selected' : ''}`}
                    onClick={() => handleMultiSelect('eligibleCompanySizes', size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
              {errors.eligibleCompanySizes && <span className="error-message">{errors.eligibleCompanySizes}</span>}
            </div>

            <div className="form-group">
              <label>Eligible Countries <span className="required">*</span></label>
              <div className="button-select-container">
                <div className="button-select-grid">
                  {countries.map(country => (
                    <button
                      key={country}
                      type="button"
                      className={`select-button ${formData.eligibleCountries.includes(country) ? 'selected' : ''}`}
                      onClick={() => handleMultiSelect('eligibleCountries', country)}
                    >
                      {country}
                    </button>
                  ))}
                </div>
              </div>
              {errors.eligibleCountries && <span className="error-message">{errors.eligibleCountries}</span>}
            </div>

            <div className="form-group">
              <label>Eligible Region (optional)</label>
              <div className="button-select-container">
                <div className="button-select-grid">
                  {formData.eligibleCountries.includes('Spain') ? (
                    spanishRegions.map(region => (
                      <button
                        key={region}
                        type="button"
                        className={`select-button ${formData.eligibleRegion.includes(region) ? 'selected' : ''}`}
                        onClick={() => handleMultiSelect('eligibleRegion', region)}
                      >
                        {region}
                      </button>
                    ))
                  ) : (
                    <div className="select-disabled-message">Select Spain in Eligible Countries to enable regions</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">Additional Requirements</h3>
            
            <div className="form-group">
              <label htmlFor="additionalRequirements">Any other specific requirements...</label>
              <textarea
                id="additionalRequirements"
                value={formData.additionalRequirements}
                onChange={(e) => handleInputChange('additionalRequirements', e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <div className="form-section">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="status">Status</label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                >
                  {statuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="internalNotes">Internal Notes (optional)</label>
              <textarea
                id="internalNotes"
                value={formData.internalNotes}
                onChange={(e) => handleInputChange('internalNotes', e.target.value)}
                rows={3}
                placeholder="Internal notes..."
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save Call
            </button>
          </div>
        </form>
      </Modal>
      
      <div className="content-section">
        <div className="table-container">
          <table className="data-table customers-table">
            <thead>
              <tr>
                <th>CALL</th>
                <th>SCOPE</th>
                <th>DEADLINE</th>
                <th>BUDGET</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCalls.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-row">
                    {searchTerm || filters.deadline !== 'All' || filters.status !== 'All' || filters.scope !== 'All'
                      ? 'No calls match your filters' 
                      : 'No calls registered yet'}
                  </td>
                </tr>
              ) : (
                paginatedCalls.map(call => (
                  <tr key={call.id} className="customer-row">
                    <td className="name-cell">
                      <div className="customer-name">{call.name}</div>
                    </td>
                    <td>
                      <span className={`scope-badge scope-${call.scope.toLowerCase()}`}>
                        {call.scope}
                      </span>
                    </td>
                    <td>
                      <div className="call-deadline">
                        <Clock size={14} className="call-deadline-icon" />
                        {formatDate(call.deadline)}
                      </div>
                    </td>
                    <td className="call-budget">{formatCurrency(call.budget)}</td>
                    <td>
                      <span className={`status-badge status-${call.status.toLowerCase()}`}>
                        {call.status}
                      </span>
                    </td>
                    <td>
                      <ActionsMenu
                        onEdit={() => handleEdit(call.id)}
                        onDelete={() => handleDelete(call.id)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredCalls.length > 0 && (
          <div className="pagination">
            <div className="pagination-info">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredCalls.length)} of {filteredCalls.length} calls
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

export default Calls

