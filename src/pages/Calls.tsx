import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Search, ChevronDown, ChevronLeft, ChevronRight, Clock,
  Download as DownloadIcon, BookOpen, Compass, X, Check,
  Archive, ArchiveRestore,
} from 'lucide-react'
import ActionsMenu from '../components/ActionsMenu'
import Modal from '../components/Modal'
import CallFichaModal, { CallFichaInput } from '../components/CallFichaModal'
import { formatCurrency } from '../utils/formatCurrency'
import './Page.css'
import './SharedTableLayout.css'
import './CallsImport.css'

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
  /** Si true, la call está archivada (no aparece en la tabla por defecto). */
  archived?: boolean
  /** Fecha ISO en que se archivó. */
  archivedAt?: string
  /** Identificador externo de Discovery (EU Portal o BDNS) si fue importada
   *  desde allí. Permite detectar duplicados aunque cambies el nombre o id. */
  discoveryExternalId?: string
  /** Slug de la ficha de Knowledge Base si la call viene del catálogo del agente.
   *  Usado para detectar si esa ficha ya fue importada este año. */
  knowledgeBaseSlug?: string
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

  /* ── Toggle ver archivadas ── */
  const [showArchived, setShowArchived] = useState(false)

  /* ── Importación: estado del dropdown + modales ── */
  const [importMenuOpen, setImportMenuOpen] = useState(false)
  const importMenuRef = useRef<HTMLDivElement | null>(null)
  const [discoveryModalOpen, setDiscoveryModalOpen] = useState(false)
  const [kbModalOpen, setKbModalOpen] = useState(false)

  /* ── Generador IA de ficha comercial ── */
  const [fichaModalCall, setFichaModalCall] = useState<CallFichaInput | null>(null)

  const handleGenerateFicha = (callId: string) => {
    const c = calls.find(x => x.id === callId)
    if (!c) return
    setFichaModalCall({
      id: c.id,
      name: c.name,
      title: c.name,
      program: c.program,
      fundingBody: c.fundingBody,
      aidType: c.aidType,
      openDate: c.openDate,
      closeDate: c.deadline,
      deadline: c.deadline,
      budget: c.budget,
      description: c.additionalRequirements || c.internalNotes,
      url: c.sourceUrl,
    })
  }

  // Cerrar dropdown si clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (importMenuRef.current && !importMenuRef.current.contains(e.target as Node)) {
        setImportMenuOpen(false)
      }
    }
    if (importMenuOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [importMenuOpen])

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

  // Filter calls — defensive contra datos sucios (campos undefined / null)
  const safeLower = (v: unknown): string => typeof v === 'string' ? v.toLowerCase() : ''
  const filteredCalls = calls.filter(call => {
    if (!call || typeof call !== 'object') return false
    // Filtro de archivadas: por defecto solo activas, con toggle activo solo archivadas
    const isArchived = !!call.archived
    if (showArchived !== isArchived) return false
    const searchLower = searchTerm.toLowerCase()

    // Search across all table fields — null-safe
    const matchesSearch = searchTerm === '' ||
      safeLower(call.name).includes(searchLower) ||
      safeLower(call.scope).includes(searchLower) ||
      safeLower(call.deadline).includes(searchLower) ||
      safeLower(call.budget).includes(searchLower) ||
      safeLower(call.status).includes(searchLower)

    const matchesDeadline = !filters.deadline || filters.deadline === 'All' || call.deadline === filters.deadline
    const matchesStatus = !filters.status || filters.status === 'All' || call.status === filters.status
    const matchesScope = !filters.scope || filters.scope === 'All' || call.scope === filters.scope

    return matchesSearch && matchesDeadline && matchesStatus && matchesScope
  })

  // Get unique values for filters (filtra strings vacíos / no-string)
  const uniqueDeadlines = Array.from(new Set(calls.map(c => c?.deadline).filter((v): v is string => typeof v === 'string' && v.length > 0))).sort()
  const uniqueStatuses = Array.from(new Set(calls.map(c => c?.status).filter((v): v is string => typeof v === 'string' && v.length > 0))).sort()
  const uniqueScopes = Array.from(new Set(calls.map(c => c?.scope).filter((v): v is string => typeof v === 'string' && v.length > 0))).sort()

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

  /**
   * Archiva / desarchiva una call. No se elimina nunca — el histórico
   * de calls se conserva. Las archivadas no aparecen en la tabla por
   * defecto; se muestran activando el toggle "Show archived".
   */
  const handleToggleArchive = (callId: string) => {
    setCalls(prev => prev.map(c => {
      if (c.id !== callId) return c
      const isArchiving = !c.archived
      return {
        ...c,
        archived: isArchiving,
        archivedAt: isArchiving ? new Date().toISOString() : undefined,
      }
    }))
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
          <h1>
            Calls
            {showArchived && <span className="ci-archived-badge">📦 Archivadas</span>}
          </h1>
          <p className="page-subtitle">
            {showArchived
              ? 'Vista de convocatorias archivadas. Click en la acción para desarchivarlas.'
              : 'Track public and private calls to apply to — deadlines, budgets and status'
            }
          </p>
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

        <div className="ci-header-actions">
          {/* Toggle ver archivadas */}
          {(() => {
            const archivedCount = calls.filter(c => c.archived).length
            const activeCount = calls.filter(c => !c.archived).length
            return (
              <button
                type="button"
                className={`btn-secondary ci-toggle-archived ${showArchived ? 'active' : ''}`}
                onClick={() => setShowArchived(v => !v)}
                title={showArchived ? 'Volver a la vista activa' : 'Ver convocatorias archivadas'}
              >
                {showArchived ? (
                  <><ArchiveRestore size={14} /> Ver activas ({activeCount})</>
                ) : (
                  <><Archive size={14} /> Ver archivadas ({archivedCount})</>
                )}
              </button>
            )
          })()}

          {/* Botón Import con dropdown */}
          <div className="ci-import-wrap" ref={importMenuRef}>
            <button
              type="button"
              className="btn-secondary ci-import-btn"
              onClick={() => setImportMenuOpen(o => !o)}
            >
              <DownloadIcon size={14} /> Import calls
              <ChevronDown size={12} className={importMenuOpen ? 'ci-chev-open' : ''} />
            </button>
            {importMenuOpen && (
              <div className="ci-import-menu">
                <button
                  type="button"
                  className="ci-import-menu-item"
                  onClick={() => { setImportMenuOpen(false); setDiscoveryModalOpen(true) }}
                >
                  <div className="ci-import-menu-icon"><Compass size={18} /></div>
                  <div className="ci-import-menu-text">
                    <strong>Discovery</strong>
                    <small>Calls sincronizadas en tiempo real de EU Portal y BDNS</small>
                  </div>
                </button>
                <button
                  type="button"
                  className="ci-import-menu-item"
                  onClick={() => { setImportMenuOpen(false); setKbModalOpen(true) }}
                >
                  <div className="ci-import-menu-icon"><BookOpen size={18} /></div>
                  <div className="ci-import-menu-text">
                    <strong>Knowledge Base</strong>
                    <small>Programas conocidos (fichas) — rellenas las fechas y el budget actuales</small>
                  </div>
                </button>
              </div>
            )}
          </div>
          <button className="btn-primary" onClick={handleNewCall}>+ New Call</button>
        </div>
      </div>

      {/* MODAL · Import from Discovery */}
      {discoveryModalOpen && (
        <ImportFromDiscovery
          existing={calls}
          onClose={() => setDiscoveryModalOpen(false)}
          onImport={(newOnes) => {
            setCalls(prev => [...prev, ...newOnes])
            setDiscoveryModalOpen(false)
          }}
        />
      )}

      {/* MODAL · Import from Knowledge Base */}
      {kbModalOpen && (
        <ImportFromKnowledgeBase
          existing={calls}
          onClose={() => setKbModalOpen(false)}
          onImport={(newCall) => {
            setCalls(prev => [...prev, newCall])
            setKbModalOpen(false)
          }}
        />
      )}

      {/* MODAL · Generate Ficha (IA) */}
      {fichaModalCall && (
        <CallFichaModal
          call={fichaModalCall}
          onClose={() => setFichaModalCall(null)}
        />
      )}

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
                paginatedCalls.map(call => {
                  // Render defensivo contra calls con campos undefined
                  const scope = typeof call.scope === 'string' && call.scope ? call.scope : '—'
                  const status = typeof call.status === 'string' && call.status ? call.status : '—'
                  const name = typeof call.name === 'string' && call.name ? call.name : '(sin nombre)'
                  const scopeClass = scope !== '—' ? scope.toLowerCase().replace(/\s+/g, '-') : 'unknown'
                  const statusClass = status !== '—' ? status.toLowerCase().replace(/\s+/g, '-') : 'unknown'
                  return (
                    <tr key={call.id || `call-${Math.random()}`} className="customer-row">
                      <td className="name-cell">
                        <div className="customer-name">{name}</div>
                      </td>
                      <td>
                        <span className={`scope-badge scope-${scopeClass}`}>
                          {scope}
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
                        <span className={`status-badge status-${statusClass}`}>
                          {status}
                        </span>
                      </td>
                      <td>
                        <ActionsMenu
                          onEdit={() => handleEdit(call.id)}
                          onGenerateFicha={() => handleGenerateFicha(call.id)}
                          onArchive={() => handleToggleArchive(call.id)}
                          isArchived={!!call.archived}
                        />
                      </td>
                    </tr>
                  )
                })
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

/* ============================================================
   IMPORT FROM DISCOVERY — multi-select de calls sincronizadas
   ============================================================ */

interface DiscoveryCall {
  externalId: string
  source: 'EU_PORTAL' | 'BDNS'
  title: string
  fundingBody?: string
  program?: string
  typeOfAction?: string
  region?: string
  budget?: string
  closeDate?: string
  openDate?: string
  externalStatus?: string
  description?: string
  url?: string
}

const ImportFromDiscovery = ({
  existing,
  onClose,
  onImport,
}: {
  existing: Call[]
  onClose: () => void
  onImport: (newCalls: Call[]) => void
}) => {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'all' | 'EU_PORTAL' | 'BDNS'>('all')

  const discoveryCalls = useMemo<DiscoveryCall[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('discoveryCalls') || '[]')
    } catch { return [] }
  }, [])

  // Set robusto de identificadores ya importados desde Discovery.
  // Probamos varias señales (en orden de fiabilidad):
  //   1) discoveryExternalId — campo persistido al importar
  //   2) id que empieza por `disc-<externalId>` — formato anterior
  //   3) sourceUrl idéntico al url de la call externa
  const existingDiscoveryIds = useMemo(() => {
    const ids = new Set<string>()
    const urls = new Set<string>()
    for (const c of existing) {
      if (c.discoveryExternalId) ids.add(c.discoveryExternalId)
      if (c.id?.startsWith('disc-')) {
        // Extrae el externalId del ID antiguo `disc-<id>[-timestamp]`
        const rest = c.id.slice(5)
        // Si tiene timestamp al final (formato nuevo), quita el último segmento numérico
        const parts = rest.split('-')
        if (parts.length > 1 && /^\d{10,}$/.test(parts[parts.length - 1])) {
          parts.pop()
          ids.add(parts.join('-'))
        } else {
          ids.add(rest)
        }
      }
      if (c.sourceUrl) urls.add(c.sourceUrl)
    }
    return { ids, urls }
  }, [existing])

  const isAlreadyImported = (c: DiscoveryCall): boolean => {
    if (existingDiscoveryIds.ids.has(c.externalId)) return true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const url = (c as any).url || (c as any).sourceUrl || ''
    if (url && existingDiscoveryIds.urls.has(url)) return true
    return false
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return discoveryCalls.filter(c => {
      if (filter !== 'all' && c.source !== filter) return false
      if (!q) return true
      return (
        c.title?.toLowerCase().includes(q) ||
        c.program?.toLowerCase().includes(q) ||
        c.fundingBody?.toLowerCase().includes(q)
      )
    })
  }, [discoveryCalls, search, filter])

  const toggleSelect = (id: string) => {
    setSelected(s => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleImport = () => {
    const toImport: Call[] = discoveryCalls
      .filter(c => selected.has(c.externalId))
      .map(c => {
        // URL — fallback robusto: prueba url, sourceUrl (datos viejos), o construye
        // BDNS desde externalId si está vacía.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cAny = c as any
        let sourceUrl: string = cAny.url || cAny.sourceUrl || ''
        if (!sourceUrl && c.source === 'BDNS' && c.externalId) {
          sourceUrl = `https://www.pap.hacienda.gob.es/bdnstrans/GE/es/convocatoria/${c.externalId}`
        }

        return {
          id: `disc-${c.externalId}-${Date.now()}`,
          name: c.title || '(sin título)',
          scope: c.source === 'EU_PORTAL' ? 'European' : 'National',
          deadline: c.closeDate ? c.closeDate.split('T')[0] : '',
          budget: c.budget || '',
          status: 'Open',
          fundingBody: c.fundingBody || (c.source === 'EU_PORTAL' ? 'EU Commission' : ''),
          program: c.program || '',
          year: c.closeDate ? c.closeDate.slice(0, 4) : new Date().getFullYear().toString(),
          openDate: c.openDate ? c.openDate.split('T')[0] : '',
          aidType: c.typeOfAction || '',
          sourceUrl,
          eligibleRegion: c.region ? [c.region] : [],
          additionalRequirements: c.description ? c.description.slice(0, 500) : '',
          // Anclas para detectar duplicados en futuros imports
          discoveryExternalId: c.externalId,
        } as Call
      })
    onImport(toImport)
  }

  return (
    <div className="ci-modal-overlay" onClick={onClose}>
      <div className="ci-modal" onClick={e => e.stopPropagation()}>
        <header className="ci-modal-header">
          <div>
            <h2><Compass size={18} /> Import from Discovery</h2>
            <p className="muted">
              Selecciona las convocatorias activas que quieres copiar a tu lista de Calls.
              {discoveryCalls.length === 0 && ' Discovery está vacío — sincroniza primero EU Portal / BDNS.'}
            </p>
          </div>
          <button type="button" className="ci-modal-close" onClick={onClose}><X size={18} /></button>
        </header>

        <div className="ci-modal-toolbar">
          <div className="ci-search-input">
            <Search size={14} />
            <input
              type="text"
              placeholder="Buscar por título, programa, organismo…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="ci-source-chips">
            <button type="button" className={`ci-chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
              Todas ({discoveryCalls.length})
            </button>
            <button type="button" className={`ci-chip ${filter === 'EU_PORTAL' ? 'active' : ''}`} onClick={() => setFilter('EU_PORTAL')}>
              EU Portal ({discoveryCalls.filter(c => c.source === 'EU_PORTAL').length})
            </button>
            <button type="button" className={`ci-chip ${filter === 'BDNS' ? 'active' : ''}`} onClick={() => setFilter('BDNS')}>
              BDNS ({discoveryCalls.filter(c => c.source === 'BDNS').length})
            </button>
          </div>
        </div>

        <div className="ci-modal-body">
          {filtered.length === 0 ? (
            <p className="ci-empty">No hay convocatorias que coincidan con los filtros.</p>
          ) : (
            <ul className="ci-list">
              {filtered.slice(0, 200).map(c => {
                const isExisting = isAlreadyImported(c)
                const isSelected = selected.has(c.externalId)
                return (
                  <li
                    key={c.externalId}
                    className={`ci-list-item ${isSelected ? 'selected' : ''} ${isExisting ? 'existing' : ''}`}
                    onClick={() => !isExisting && toggleSelect(c.externalId)}
                  >
                    <div className={`ci-check ${isSelected ? 'on' : ''}`}>
                      {isExisting ? <Check size={12} /> : isSelected ? <Check size={12} /> : null}
                    </div>
                    <div className="ci-list-item-content">
                      <strong>{c.title}</strong>
                      <span className="ci-list-meta">
                        <span className={`ci-source-tag ci-source-${c.source.toLowerCase()}`}>
                          {c.source === 'EU_PORTAL' ? 'EU' : 'BDNS'}
                        </span>
                        {c.program && <span>· {c.program}</span>}
                        {c.closeDate && <span>· Cierre: {c.closeDate.split('T')[0]}</span>}
                        {c.budget && <span>· {c.budget}</span>}
                        {isExisting && <span className="ci-existing-tag">ya importada</span>}
                      </span>
                    </div>
                  </li>
                )
              })}
              {filtered.length > 200 && (
                <li className="ci-list-more">+ {filtered.length - 200} más — refina la búsqueda</li>
              )}
            </ul>
          )}
        </div>

        <footer className="ci-modal-footer">
          <span className="muted">{selected.size} seleccionadas</span>
          <div className="ci-footer-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleImport}
              disabled={selected.size === 0}
            >
              Import {selected.size > 0 ? `(${selected.size})` : ''}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

/* ============================================================
   IMPORT FROM KNOWLEDGE BASE — selecciona ficha + completa datos
   ============================================================ */

interface FichaMeta {
  slug: string
  organisms: string[]
  aliases: string[]
  aidType: string | null
  sectorBound: string | null
  internationalRequired: boolean
}

const ImportFromKnowledgeBase = ({
  existing,
  onClose,
  onImport,
}: {
  existing: Call[]
  onClose: () => void
  onImport: (newCall: Call) => void
}) => {
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [fichas, setFichas] = useState<FichaMeta[]>([])
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  // Form state — campos editables que rellena el consultor
  const currentYear = new Date().getFullYear()
  const [form, setForm] = useState({
    year: String(currentYear),
    openDate: '',
    deadline: '',
    budget: '',
    status: 'Forthcoming' as 'Open' | 'Forthcoming' | 'Closed',
    customName: '',
  })

  useEffect(() => {
    const fetchFichas = async () => {
      try {
        const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || 'https://alamosinnovacionia.onrender.com'
        const token = localStorage.getItem('authToken') || ''
        const res = await fetch(`${API_BASE}/ai/fichas`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json() as { fichas: FichaMeta[] }
        setFichas(json.fichas || [])
      } catch (err) {
        console.error('Failed to load fichas:', err)
        setFichas([])
      } finally {
        setLoading(false)
      }
    }
    fetchFichas()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return fichas
    return fichas.filter(f =>
      f.slug.includes(q) ||
      f.aliases.some(a => a.toLowerCase().includes(q)) ||
      f.organisms.some(o => o.toLowerCase().includes(q))
    )
  }, [fichas, search])

  const selected = fichas.find(f => f.slug === selectedSlug) || null

  // Scope sugerido según organismo principal
  const suggestedScope = useMemo(() => {
    if (!selected) return 'National'
    const lower = selected.organisms.join(' ').toLowerCase()
    if (/comisión europea|european|eic|cinea|eacea|eit|eureka/.test(lower)) return 'European'
    return 'National'
  }, [selected])

  const handleSubmit = () => {
    if (!selected) return
    setFormError(null)
    if (!form.deadline) {
      setFormError('La fecha de cierre (deadline) es obligatoria. Si la call es de ventanilla abierta, indica una fecha estimada.')
      return
    }
    const name = form.customName.trim() || humanizeSlug(selected.slug)
    const newCall: Call = {
      id: `kb-${selected.slug}-${form.year}-${Date.now()}`,
      name,
      scope: suggestedScope,
      deadline: form.deadline,
      budget: form.budget || '',
      status: form.status,
      fundingBody: selected.organisms[0] || '',
      program: humanizeSlug(selected.slug),
      year: form.year,
      openDate: form.openDate,
      aidType: humanizeAidType(selected.aidType),
      sourceUrl: '',
      eligibleRegion: [],
      knowledgeBaseSlug: selected.slug,
    }
    onImport(newCall)
  }

  // IDs ya importados de esta ficha en este año (matching por slug + año)
  const existingFromKB = (slug: string) => existing.some(c =>
    c.knowledgeBaseSlug === slug
      ? c.year === form.year
      : c.id?.startsWith(`kb-${slug}-${form.year}-`)
  )

  return (
    <div className="ci-modal-overlay" onClick={onClose}>
      <div className="ci-modal ci-modal--kb" onClick={e => e.stopPropagation()}>
        <header className="ci-modal-header">
          <div>
            <h2><BookOpen size={18} /> Import from Knowledge Base</h2>
            <p className="muted">
              Elige un programa conocido por el agente y completa las fechas, budget y estado
              actuales para esta edición.
            </p>
          </div>
          <button type="button" className="ci-modal-close" onClick={onClose}><X size={18} /></button>
        </header>

        <div className="ci-kb-layout">
          {/* LEFT — lista de fichas */}
          <div className="ci-kb-list-panel">
            <div className="ci-search-input">
              <Search size={14} />
              <input
                type="text"
                placeholder="Buscar programa o alias…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {loading ? (
              <p className="ci-empty">Cargando catálogo…</p>
            ) : fichas.length === 0 ? (
              <p className="ci-empty">No se pudo cargar el catálogo (¿backend offline?).</p>
            ) : (
              <ul className="ci-list">
                {filtered.map(f => {
                  const isSel = f.slug === selectedSlug
                  const exists = existingFromKB(f.slug)
                  return (
                    <li
                      key={f.slug}
                      className={`ci-list-item ${isSel ? 'selected' : ''}`}
                      onClick={() => { setSelectedSlug(f.slug); setForm(prev => ({ ...prev, customName: humanizeSlug(f.slug) + ' ' + prev.year })) }}
                    >
                      <div className={`ci-check ${isSel ? 'on' : ''}`}>
                        {isSel && <Check size={12} />}
                      </div>
                      <div className="ci-list-item-content">
                        <strong>{humanizeSlug(f.slug)}</strong>
                        <span className="ci-list-meta">
                          <span className="ci-org-tag">{f.organisms[0] || 'unknown'}</span>
                          <span>{humanizeAidType(f.aidType)}</span>
                          {exists && <span className="ci-existing-tag">ya en {form.year}</span>}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* RIGHT — formulario */}
          <div className="ci-kb-form-panel">
            {!selected ? (
              <div className="ci-empty-form">
                <BookOpen size={40} />
                <p>Selecciona un programa de la lista para rellenar las fechas de esta edición.</p>
              </div>
            ) : (
              <>
                <h3>{humanizeSlug(selected.slug)}</h3>
                <p className="muted">
                  Organismo: <strong>{selected.organisms.join(', ')}</strong>
                  {' · '}Tipo: <strong>{humanizeAidType(selected.aidType)}</strong>
                </p>
                <p className="ci-aliases">Aliases: {selected.aliases.slice(0, 4).join(' · ')}</p>

                <div className="ci-form-grid">
                  <label>
                    <span>Nombre de la call</span>
                    <input
                      type="text"
                      value={form.customName}
                      onChange={e => setForm(f => ({ ...f, customName: e.target.value }))}
                      placeholder={`${humanizeSlug(selected.slug)} ${currentYear}`}
                    />
                  </label>
                  <label>
                    <span>Año</span>
                    <input
                      type="text"
                      value={form.year}
                      onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Open date (apertura)</span>
                    <input
                      type="date"
                      value={form.openDate}
                      onChange={e => setForm(f => ({ ...f, openDate: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Deadline (cierre) *</span>
                    <input
                      type="date"
                      value={form.deadline}
                      onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Budget / dotación</span>
                    <input
                      type="text"
                      value={form.budget}
                      onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
                      placeholder="€175k - €4M"
                    />
                  </label>
                  <label>
                    <span>Estado</span>
                    <select
                      value={form.status}
                      onChange={e => setForm(f => ({ ...f, status: e.target.value as 'Open' | 'Forthcoming' | 'Closed' }))}
                    >
                      <option value="Forthcoming">Forthcoming</option>
                      <option value="Open">Open</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </label>
                </div>

                <p className="ci-form-hint">
                  Scope detectado por organismo: <strong>{suggestedScope}</strong>
                </p>

                {formError && (
                  <div className="ci-form-error">{formError}</div>
                )}

                {/* CTA visible dentro del panel — la usuaria reportaba no
                    encontrar el botón de importar en KB. Ahora aparece tanto
                    aquí como en el footer. */}
                <button
                  type="button"
                  className="btn-primary ci-kb-import-cta"
                  onClick={handleSubmit}
                  disabled={!selected}
                >
                  <DownloadIcon size={14} />
                  Importar esta call a /calls
                </button>
              </>
            )}
          </div>
        </div>

        <footer className="ci-modal-footer">
          <span className="muted">
            {fichas.length > 0
              ? `${fichas.length} programas en el catálogo · ${selected ? '✓ ficha seleccionada' : 'selecciona una ficha →'}`
              : 'Catálogo no disponible'}
          </span>
          <div className="ci-footer-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSubmit}
              disabled={!selected}
              title={!selected ? 'Primero selecciona una ficha en la lista de la izquierda' : ''}
            >
              <DownloadIcon size={14} /> Importar
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

/* ---- Helpers compartidos ---- */

const humanizeSlug = (slug: string): string => {
  return slug
    .split('-')
    .map(p => p.length <= 4 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1))
    .join(' ')
}

const humanizeAidType = (aid: string | null): string => {
  if (!aid) return 'Subvención'
  const a = aid.toLowerCase()
  if (a.includes('prestamo_participativo')) return 'Préstamo participativo'
  if (a.includes('prestamo')) return 'Préstamo'
  if (a.includes('subvencion')) return 'Subvención'
  if (a.includes('mixta') || a.includes('blended')) return 'Mixta (grant + equity)'
  if (a.includes('equity') || a.includes('inversion')) return 'Equity'
  if (a.includes('label')) return 'Label EUREKA + nacional'
  return aid.replace(/_/g, ' ')
}

export default Calls

