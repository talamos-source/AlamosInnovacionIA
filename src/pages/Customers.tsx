import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Globe, MapPin, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import Modal from '../components/Modal'
import ActionsMenu from '../components/ActionsMenu'
import { useAuth } from '../contexts/AuthContext'
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

const Customers = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isWorker = user?.role === 'Worker'
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState({
    status: 'All',
    country: 'All',
    region: 'All',
    category: 'All'
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null)
  const [importFeedback, setImportFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const csvInputRef = useRef<HTMLInputElement | null>(null)
  const itemsPerPage = 10

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    legalName: '',
    taxId: '',
    website: '',
    incorporationDate: '',
    companySize: '',
    country: '',
    region: '',
    address: '',
    status: 'Active',
    category: '',
    description: '',
    notes: ''
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Countries list (alphabetical order)
  const countries = [
    'Albania', 'Alemania', 'Andorra', 'Armenia', 'Austria', 'Bélgica', 'Bosnia and Herzegovina',
    'China', 'Chipre', 'Ciudad del Vaticano', 'Croacia', 'Egypt', 'Eslovaquia', 'Eslovenia',
    'España', 'Estonia', 'Faroe Islands', 'Finlandia', 'Francia', 'Georgia', 'Grecia',
    'Iceland', 'Irlanda', 'Israel', 'Italia', 'Japan', 'Kosovo', 'Kosovo (unilateralmente)',
    'Letonia', 'Lituania', 'Luxemburgo', 'Malta', 'Moldova', 'Mónaco', 'Montenegro',
    'Morocco', 'North Macedonia', 'Norway', 'Países Bajos', 'Portugal', 'Región de Murcia',
    'San Marino', 'Serbia', 'Tunisia', 'Türkiye', 'Ukraine', 'United Kingdom', 'United States'
  ].sort()

  // Spanish regions
  const spanishRegions = [
    'Andalucía', 'Aragón', 'Canarias', 'Cantabria', 'Castilla-La Mancha',
    'Castilla y León', 'Cataluña', 'Comunidad de Madrid', 'Comunidad Foral de Navarra',
    'Comunitat Valenciana', 'Extremadura', 'Galicia', 'Illes Balears', 'La Rioja',
    'País Vasco o Euskadi', 'Principado de Asturias', 'Región de Murcia', 'Ceuta', 'Melilla'
  ]

  const companySizes = ['Small', 'Medium', 'Large', 'Other (University, RC, etc)']
  const statuses = ['Active', 'Inactive', 'Archived']
  const categories = ['Contractor', 'Secondary']

  // Load customers from localStorage on component mount
  const loadCustomers = (): Customer[] => {
    try {
      const saved = localStorage.getItem('customers')
      return saved ? JSON.parse(saved) : []
    } catch (error) {
      console.error('Error loading customers from localStorage:', error)
      return []
    }
  }

  // Customers state - load from localStorage
  const [customers, setCustomers] = useState<Customer[]>(loadCustomers)

  // Save customers to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('customers', JSON.stringify(customers))
    } catch (error) {
      console.error('Error saving customers to localStorage:', error)
    }
  }, [customers])

  const sortedCustomers = [...customers].sort((a, b) =>
    a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
  )

  // Filter customers
  const filteredCustomers = sortedCustomers.filter(customer => {
    const searchLower = searchTerm.toLowerCase()
    
    // Search across all table fields
    const matchesSearch = searchTerm === '' || 
      customer.name.toLowerCase().includes(searchLower) ||
      customer.company.toLowerCase().includes(searchLower) ||
      customer.country.toLowerCase().includes(searchLower) ||
      customer.region.toLowerCase().includes(searchLower) ||
      customer.partner.name.toLowerCase().includes(searchLower) ||
      customer.website.toLowerCase().includes(searchLower) ||
      customer.category.toLowerCase().includes(searchLower) ||
      customer.status.toLowerCase().includes(searchLower)
    
    const matchesCountry = !filters.country || filters.country === 'All' || customer.country === filters.country
    const matchesRegion = !filters.region || filters.region === 'All' || customer.region === filters.region
    const matchesStatus = !filters.status || filters.status === 'All' || customer.status === filters.status
    const matchesCategory = !filters.category || filters.category === 'All' || customer.category === filters.category

    return matchesSearch && matchesCountry && matchesRegion && matchesStatus && matchesCategory
  })

  // Get unique values for filters
  const uniqueCountries = Array.from(new Set(customers.map(c => c.country).filter(Boolean))).sort()
  const uniqueRegions = Array.from(new Set(customers.map(c => c.region).filter(Boolean))).sort()
  const uniqueStatuses = Array.from(new Set(customers.map(c => c.status).filter(Boolean))).sort()
  const uniqueCategories = Array.from(new Set(customers.map(c => c.category).filter(Boolean))).sort()

  // Pagination
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex)

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
    // Clear region if country changes and it's not Spain
    if (field === 'country' && value !== 'España') {
      setFormData(prev => ({ ...prev, region: '' }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) newErrors.name = 'Name is required'
    if (!formData.legalName.trim()) newErrors.legalName = 'Legal Name is required'
    if (!formData.taxId.trim()) newErrors.taxId = 'Tax ID is required'
    if (!formData.website.trim()) newErrors.website = 'Website is required'
    if (!formData.incorporationDate) newErrors.incorporationDate = 'Incorporation Date is required'
    if (!formData.companySize) newErrors.companySize = 'Company Size is required'
    if (!formData.country) newErrors.country = 'Country is required'
    if (formData.country === 'España' && !formData.region) {
      newErrors.region = 'Region is required for Spain'
    }
    if (!formData.address.trim()) newErrors.address = 'Address is required'
    if (!formData.category) newErrors.category = 'Category is required'
    if (!formData.description.trim()) newErrors.description = 'Description is required'

    // Validate website URL format
    if (formData.website && !/^https?:\/\/.+/.test(formData.website)) {
      newErrors.website = 'Website must be a valid URL (e.g., https://example.com)'
    }

    // Validate date format
    if (formData.incorporationDate && !/^\d{2}\/\d{2}\/\d{4}$/.test(formData.incorporationDate)) {
      newErrors.incorporationDate = 'Date must be in format dd/mm/yyyy'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      const customerData: Customer = {
        id: editingCustomerId || `customer-${Date.now()}`,
        name: formData.name.trim(),
        company: formData.legalName.trim(),
        country: formData.country,
        region: formData.region || '',
        partner: {
          name: 'Default Partner',
          initials: 'DP'
        },
        website: formData.website.trim(),
        category: formData.category,
        status: formData.status,
        taxId: formData.taxId.trim() || undefined,
        incorporationDate: formData.incorporationDate || undefined,
        companySize: formData.companySize || undefined,
        address: formData.address.trim() || undefined,
        description: formData.description.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        createdAt: editingCustomerId ? customers.find(c => c.id === editingCustomerId)?.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      if (editingCustomerId) {
        // Update existing customer
        setCustomers(prev => prev.map(c => c.id === editingCustomerId ? customerData : c))
      } else {
        // Add new customer to the list
        setCustomers(prev => [...prev, customerData])
      }
      
      // Reset form and close modal
      setFormData({
        name: '',
        legalName: '',
        taxId: '',
        website: '',
        incorporationDate: '',
        companySize: '',
        country: '',
        region: '',
        address: '',
        status: 'Active',
        category: '',
        description: '',
        notes: ''
      })
      setEditingCustomerId(null)
      setIsModalOpen(false)
    }
  }

  const handleDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '')
    if (value.length >= 2) value = value.slice(0, 2) + '/' + value.slice(2)
    if (value.length >= 5) value = value.slice(0, 5) + '/' + value.slice(5, 9)
    handleInputChange('incorporationDate', value)
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const handleView = (customerId: string) => {
    navigate(`/customers/${customerId}`)
  }

  const handleEdit = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId)
    if (customer) {
      // Populate form with customer data
      setFormData({
        name: customer.name,
        legalName: customer.company,
        taxId: customer.taxId || '',
        website: customer.website,
        incorporationDate: customer.incorporationDate || '',
        companySize: customer.companySize || '',
        country: customer.country,
        region: customer.region || '',
        address: customer.address || '',
        status: customer.status,
        category: customer.category,
        description: customer.description || '',
        notes: customer.notes || ''
      })
      setEditingCustomerId(customerId)
      setIsModalOpen(true)
    }
  }

  const handleDelete = (_customerId: string) => {
    window.alert('La eliminación está desactivada para mantener el histórico de clientes.')
  }

  const handleNewClient = () => {
    setEditingCustomerId(null)
    setFormData({
      name: '',
      legalName: '',
      taxId: '',
      website: '',
      incorporationDate: '',
      companySize: '',
      country: '',
      region: '',
      address: '',
      status: 'Active',
      category: '',
      description: '',
      notes: ''
    })
    setIsModalOpen(true)
  }

  const parseCsv = (raw: string) => {
    const rows: string[][] = []
    let current = ''
    let row: string[] = []
    let inQuotes = false

    const pushCell = () => {
      row.push(current)
      current = ''
    }

    const pushRow = () => {
      rows.push(row)
      row = []
    }

    for (let i = 0; i < raw.length; i += 1) {
      const char = raw[i]
      const next = raw[i + 1]

      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"'
          i += 1
        } else {
          inQuotes = !inQuotes
        }
        continue
      }

      if (char === ',' && !inQuotes) {
        pushCell()
        continue
      }

      if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') {
          i += 1
        }
        pushCell()
        pushRow()
        continue
      }

      current += char
    }

    pushCell()
    pushRow()

    return rows
      .map(rowValues => rowValues.map(value => value.trim()))
      .filter(rowValues => rowValues.some(value => value !== ''))
  }

  const handleCsvImport = async (file: File) => {
    try {
      const text = await file.text()
      const rows = parseCsv(text)

      if (rows.length < 2) {
        setImportFeedback({ type: 'error', message: 'El CSV no tiene filas de datos para importar.' })
        return
      }

      const headerRow = rows[0].map(value => value.replace(/^\uFEFF/, '').toLowerCase())
      const requiredHeaders = [
        'name',
        'legalname',
        'taxid',
        'website',
        'incorporationdate',
        'companysize',
        'country',
        'region',
        'address',
        'status',
        'category',
        'description',
        'notes'
      ]

      const headerIndex = new Map<string, number>()
      headerRow.forEach((header, index) => headerIndex.set(header, index))

      const missingHeaders = requiredHeaders.filter(header => !headerIndex.has(header))
      if (missingHeaders.length > 0) {
        setImportFeedback({
          type: 'error',
          message: `Faltan columnas en el CSV: ${missingHeaders.join(', ')}. Usa el template.`
        })
        return
      }

      const rowErrors: string[] = []
      const newCustomers: Customer[] = []
      const now = new Date().toISOString()

      const getCell = (row: string[], key: string) => row[headerIndex.get(key) ?? -1] ?? ''

      rows.slice(1).forEach((row, index) => {
        const name = getCell(row, 'name')
        const legalName = getCell(row, 'legalname')
        const taxId = getCell(row, 'taxid')
        const website = getCell(row, 'website')
        const incorporationDate = getCell(row, 'incorporationdate')
        const companySize = getCell(row, 'companysize')
        const country = getCell(row, 'country')
        const region = getCell(row, 'region')
        const address = getCell(row, 'address')
        const status = getCell(row, 'status') || 'Active'
        const category = getCell(row, 'category')
        const description = getCell(row, 'description')
        const notes = getCell(row, 'notes')

        const errors: string[] = []
        if (!name) errors.push('name')
        if (!legalName) errors.push('legalName')
        if (!taxId) errors.push('taxId')
        if (!website) errors.push('website')
        if (website && !/^https?:\/\/.+/.test(website)) errors.push('website format')
        if (!incorporationDate || !/^\d{2}\/\d{2}\/\d{4}$/.test(incorporationDate)) errors.push('incorporationDate')
        if (!companySize) errors.push('companySize')
        if (!country) errors.push('country')
        if (country === 'España' && !region) errors.push('region')
        if (!address) errors.push('address')
        if (!category) errors.push('category')
        if (!description) errors.push('description')

        if (errors.length > 0) {
          rowErrors.push(`Fila ${index + 2}: ${errors.join(', ')}`)
          return
        }

        newCustomers.push({
          id: `customer-${Date.now()}-${index}`,
          name,
          company: legalName,
          country,
          region: region || '',
          partner: {
            name: 'Default Partner',
            initials: 'DP'
          },
          website,
          category,
          status,
          taxId: taxId || undefined,
          incorporationDate: incorporationDate || undefined,
          companySize: companySize || undefined,
          address: address || undefined,
          description: description || undefined,
          notes: notes || undefined,
          createdAt: now,
          updatedAt: now
        })
      })

      if (newCustomers.length === 0) {
        setImportFeedback({ type: 'error', message: 'No se pudo importar ninguna fila. Revisa el CSV.' })
        if (rowErrors.length > 0) {
          console.warn('Errores de importación CSV:', rowErrors)
        }
        return
      }

      setCustomers(prev => [...prev, ...newCustomers])
      setImportFeedback({
        type: rowErrors.length > 0 ? 'error' : 'success',
        message: rowErrors.length > 0
          ? `Importados ${newCustomers.length} clientes. ${rowErrors.length} filas con errores.`
          : `Importados ${newCustomers.length} clientes correctamente.`
      })
      if (rowErrors.length > 0) {
        console.warn('Errores de importación CSV:', rowErrors)
      }
    } catch (error) {
      console.error('Error importing CSV:', error)
      setImportFeedback({ type: 'error', message: 'Ocurrió un error al leer el archivo CSV.' })
    } finally {
      if (csvInputRef.current) {
        csvInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Customers</h1>
        </div>
      </div>

      <div className="customers-toolbar">
        <div className="search-bar-inline">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by name, company, country, region, partner, website, category, status..."
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
                {uniqueStatuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <ChevronDown size={16} className="select-chevron" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
            <div className="select-wrapper" style={{ position: 'relative' }}>
              <select
                value={filters.country}
                onChange={(e) => setFilters(prev => ({ ...prev, country: e.target.value }))}
                className={`filter-btn ${filters.country !== 'All' ? 'active' : ''}`}
                style={{ appearance: 'none', paddingRight: '2rem', cursor: 'pointer' }}
              >
                <option value="All">All Countries</option>
                {uniqueCountries.map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
              <ChevronDown size={16} className="select-chevron" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
            <div className="select-wrapper" style={{ position: 'relative' }}>
              <select
                value={filters.region}
                onChange={(e) => setFilters(prev => ({ ...prev, region: e.target.value }))}
                className={`filter-btn ${filters.region !== 'All' ? 'active' : ''}`}
                style={{ appearance: 'none', paddingRight: '2rem', cursor: 'pointer' }}
              >
                <option value="All">All Regions</option>
                {uniqueRegions.map(region => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
              <ChevronDown size={16} className="select-chevron" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
            <div className="select-wrapper" style={{ position: 'relative' }}>
              <select
                value={filters.category}
                onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                className={`filter-btn ${filters.category !== 'All' ? 'active' : ''}`}
                style={{ appearance: 'none', paddingRight: '2rem', cursor: 'pointer' }}
              >
                <option value="All">All Categories</option>
                {uniqueCategories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <ChevronDown size={16} className="select-chevron" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          </div>
        </div>

        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) {
              handleCsvImport(file)
            }
          }}
          style={{ display: 'none' }}
        />

        <button
          type="button"
          className="btn-secondary"
          onClick={() => csvInputRef.current?.click()}
        >
          Import CSV
        </button>
        <button className="btn-primary" onClick={handleNewClient}>+ New Client</button>
      </div>

      {importFeedback && (
        <div className={`import-feedback import-feedback-${importFeedback.type}`}>
          {importFeedback.message}
        </div>
      )}

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false)
          setEditingCustomerId(null)
          setFormData({
            name: '',
            legalName: '',
            taxId: '',
            website: '',
            incorporationDate: '',
            companySize: '',
            country: '',
            region: '',
            address: '',
            status: 'Active',
            category: '',
            description: '',
            notes: ''
          })
          setErrors({})
        }} 
        title={editingCustomerId ? "Edit Client" : "New Client"}
      >
        <form onSubmit={handleSubmit} className="client-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">Name <span className="required">*</span></label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={errors.name ? 'error' : ''}
              />
              {errors.name && <span className="error-message">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="legalName">Legal Name <span className="required">*</span></label>
              <input
                type="text"
                id="legalName"
                value={formData.legalName}
                onChange={(e) => handleInputChange('legalName', e.target.value)}
                className={errors.legalName ? 'error' : ''}
              />
              {errors.legalName && <span className="error-message">{errors.legalName}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="taxId">Tax ID (CIF/NIF) <span className="required">*</span></label>
              <input
                type="text"
                id="taxId"
                value={formData.taxId}
                onChange={(e) => handleInputChange('taxId', e.target.value)}
                className={errors.taxId ? 'error' : ''}
                placeholder="CIF/NIF"
              />
              {errors.taxId && <span className="error-message">{errors.taxId}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="website">Website <span className="required">*</span></label>
              <input
                type="text"
                id="website"
                value={formData.website}
                onChange={(e) => handleInputChange('website', e.target.value)}
                className={errors.website ? 'error' : ''}
                placeholder="https://example.com"
              />
              {errors.website && <span className="error-message">{errors.website}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="incorporationDate">Incorporation Date <span className="required">*</span></label>
              <input
                type="text"
                id="incorporationDate"
                value={formData.incorporationDate}
                onChange={handleDateInput}
                className={errors.incorporationDate ? 'error' : ''}
                placeholder="dd/mm/yyyy"
                maxLength={10}
              />
              {errors.incorporationDate && <span className="error-message">{errors.incorporationDate}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="companySize">Company Size <span className="required">*</span></label>
              <select
                id="companySize"
                value={formData.companySize}
                onChange={(e) => handleInputChange('companySize', e.target.value)}
                className={errors.companySize ? 'error' : ''}
              >
                <option value="">Select size</option>
                {companySizes.map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
              {errors.companySize && <span className="error-message">{errors.companySize}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="country">Country <span className="required">*</span></label>
              <select
                id="country"
                value={formData.country}
                onChange={(e) => handleInputChange('country', e.target.value)}
                className={errors.country ? 'error' : ''}
              >
                <option value="">Select country</option>
                {countries.map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
              {errors.country && <span className="error-message">{errors.country}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="region">Region/State</label>
              <select
                id="region"
                value={formData.region}
                onChange={(e) => handleInputChange('region', e.target.value)}
                disabled={formData.country !== 'España'}
                className={errors.region ? 'error' : ''}
              >
                <option value="">Select region</option>
                {formData.country === 'España' && spanishRegions.map(region => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
              {errors.region && <span className="error-message">{errors.region}</span>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="address">Address <span className="required">*</span></label>
            <input
              type="text"
              id="address"
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              className={errors.address ? 'error' : ''}
            />
            {errors.address && <span className="error-message">{errors.address}</span>}
          </div>

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

            <div className="form-group">
              <label htmlFor="category">Category <span className="required">*</span></label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                className={errors.category ? 'error' : ''}
              >
                <option value="">Select category</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              {errors.category && <span className="error-message">{errors.category}</span>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description <span className="required">*</span></label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className={errors.description ? 'error' : ''}
              rows={4}
            />
            {errors.description && <span className="error-message">{errors.description}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notes (optional)</label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save Client
            </button>
          </div>
        </form>
      </Modal>
      
      <div className="content-section">
        <div className="table-container">
          <table className="data-table customers-table">
            <thead>
              <tr>
                <th>NAME</th>
                <th>COUNTRY</th>
                <th>REGION</th>
                <th>PARTNER</th>
                <th>WEBSITE</th>
                <th>CATEGORY</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-row">
                    {searchTerm || filters.country !== 'All' || filters.status !== 'All' || filters.region !== 'All' || filters.category !== 'All'
                      ? 'No customers match your filters' 
                      : 'No customers registered yet'}
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map(customer => (
                  <tr key={customer.id} className="customer-row">
                    <td className="name-cell">
                      <div className="customer-name-group">
                        <div className="customer-name">{customer.name}</div>
                        <div className="customer-company">{customer.company}</div>
                      </div>
                    </td>
                    <td>
                      <div className="location-cell">
                        <Globe size={16} className="location-icon" />
                        <span>{customer.country}</span>
                      </div>
                    </td>
                    <td>
                      <div className="location-cell">
                        <MapPin size={16} className="location-icon" />
                        <span>{customer.region}</span>
                      </div>
                    </td>
                    <td>
                      <div className="partner-cell">
                        <div className="partner-avatar">
                          {customer.partner.initials || getInitials(customer.partner.name)}
                        </div>
                        <span className="partner-name">{customer.partner.name}</span>
                      </div>
                    </td>
                    <td>
                      <a 
                        href={customer.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="website-link"
                      >
                        {customer.website}
                      </a>
                    </td>
                    <td>
                      <span className="category-badge">{customer.category}</span>
                    </td>
                    <td>
                      <span className={`status-badge status-${customer.status.toLowerCase()}`}>
                        {customer.status}
                      </span>
                    </td>
                    <td>
                      <ActionsMenu
                        onView={() => handleView(customer.id)}
                        onEdit={() => handleEdit(customer.id)}
                        onDelete={isWorker ? undefined : () => handleDelete(customer.id)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredCustomers.length > 0 && (
          <div className="pagination">
            <div className="pagination-info">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredCustomers.length)} of {filteredCustomers.length} customers
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

export default Customers
