import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Search, Globe, MapPin, ChevronDown, ChevronLeft, ChevronRight,
  Upload, X, FileText, Plus, Trash2, Building2, Users as UsersIcon, FileCheck,
} from 'lucide-react'
import Modal from '../components/Modal'
import ActionsMenu from '../components/ActionsMenu'
import DateInput from '../components/DateInput'
import SearchableSelect from '../components/SearchableSelect'
import { persistAppData } from '../utils/appData'
import { useAuth } from '../contexts/AuthContext'
import './Page.css'
import './Customers.css'

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
  /** Logo del cliente como dataURL (PNG/JPG, comprimido <400px). Aparece en PPT/PDF exports. */
  logoBase64?: string
  /** PDF de contrato firmado con el cliente (opcional). */
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

const Customers = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
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
    revenue: '',
    shareCapital: '',
    employees: '',
    memberOf: [] as string[],
    country: '',
    region: '',
    address: '',
    status: 'Active',
    category: '',
    description: '',
    notes: '',
    logoBase64: '' as string | undefined,
    contractPdf: undefined as { dataUrl: string; fileName: string; uploadedAt: string } | undefined,
    contacts: [] as Array<{ id: string; name: string; email: string; phone: string; comments: string }>,
  })
  const logoInputRef = useRef<HTMLInputElement | null>(null)
  const contractInputRef = useRef<HTMLInputElement | null>(null)
  // Para el desplegable de "Member of"
  const [memberOfPick, setMemberOfPick] = useState('')

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

  // Lista de aceleradoras, incubadoras y partners. Editable libremente — añade/quita aquí.
  const accelerators = [
    'AABAN',
    'Antai Venture Builder',
    'BANC (Business Angels Network of Catalonia)',
    'BBK Open Innovation',
    'Big Ban Angels',
    'Bind 4.0',
    'Conector Startup Accelerator',
    'Demium',
    'EIT Health',
    'EIT InnoEnergy',
    'Endeavor',
    'ESADE BAN',
    'ICEX Next',
    'IE Venture Network',
    'ISDI Accelerator',
    'Keiretsu Forum',
    'Lanzadera',
    'Plug and Play',
    'SeedRocket',
    'Startupbootcamp',
    'Startupxplore',
    'Techstars',
    'Wayra (Telefónica)',
    'Y Combinator',
  ].sort()

  // Añadir / quitar una aceleradora a la lista de memberOf
  const addMemberOf = (name: string) => {
    if (!name) return
    setFormData(prev => {
      if (prev.memberOf.includes(name)) return prev
      return { ...prev, memberOf: [...prev.memberOf, name] }
    })
    setMemberOfPick('')
  }
  const removeMemberOf = (name: string) => {
    setFormData(prev => ({ ...prev, memberOf: prev.memberOf.filter(m => m !== name) }))
  }

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

  // Si llega ?edit=<id> en la URL (p. ej. desde la ficha del cliente),
  // abre el modal de edición automáticamente y limpia el query param.
  useEffect(() => {
    const editId = searchParams.get('edit')
    if (!editId) return
    const target = customers.find(c => c.id === editId)
    if (target) {
      handleEdit(editId)
    }
    searchParams.delete('edit')
    setSearchParams(searchParams, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, customers])

  // Save customers to localStorage whenever they change.
  // CRÍTICO: usar persistAppData para actualizar appDataUpdatedAt y evitar
  // que el AppDataSync.initialize() de un próximo refresh sobrescriba los
  // cambios locales con un snapshot del server más viejo.
  useEffect(() => {
    const json = JSON.stringify(customers)
    persistAppData('customers', json)
    // Verificación post-write
    const verify = localStorage.getItem('customers')
    if (verify !== json) {
      console.error('[Customers] persist verification FAILED! Expected len', json.length, 'got', verify?.length)
    } else {
      console.log('[Customers] persisted to localStorage — count:', customers.length, '(', (json.length / 1024).toFixed(1), 'KB )')
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
        revenue: formData.revenue.trim() || undefined,
        shareCapital: formData.shareCapital.trim() || undefined,
        employees: formData.employees.trim() || undefined,
        memberOf: formData.memberOf.length > 0 ? [...formData.memberOf] : undefined,
        address: formData.address.trim() || undefined,
        description: formData.description.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        logoBase64: formData.logoBase64 || undefined,
        contractPdf: formData.contractPdf || undefined,
        contacts: formData.contacts.length > 0
          ? formData.contacts.filter(c => c.name.trim() || c.email.trim() || c.phone.trim() || c.comments.trim())
          : undefined,
        createdAt: editingCustomerId ? customers.find(c => c.id === editingCustomerId)?.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      // FIX CRÍTICO: persistir SÍNCRONAMENTE a localStorage ANTES de
      // setCustomers. Si solo confiamos en el useEffect [customers], puede
      // ejecutarse demasiado tarde (race con navegación o re-render) y el
      // cliente desaparece. Hacerlo aquí garantiza que la próxima vez que
      // se monte Customers, loadCustomers() devuelva los datos correctos.
      const nextCustomers = editingCustomerId
        ? customers.map(c => c.id === editingCustomerId ? customerData : c)
        : [...customers, customerData]

      console.log('[Customers] handleSubmit:', {
        action: editingCustomerId ? 'update' : 'add',
        id: customerData.id,
        name: customerData.name,
        category: customerData.category,
        currentCount: customers.length,
        nextCount: nextCustomers.length,
      })

      // 1) Persistir AHORA mismo a localStorage
      persistAppData('customers', JSON.stringify(nextCustomers))

      // 2) Verify post-write — leer de vuelta para confirmar
      const verify = localStorage.getItem('customers')
      try {
        const parsed = JSON.parse(verify || '[]')
        const found = parsed.find((c: { id: string }) => c.id === customerData.id)
        if (!found) {
          console.error('[Customers] ✗ VERIFY FAILED — cliente NO está en localStorage tras write!', { count: parsed.length })
          alert('Error al guardar el cliente: no se ha podido persistir en localStorage. Revisa la consola (F12).')
          return
        }
        console.log('[Customers] ✓ verified in localStorage — count:', parsed.length)
      } catch (err) {
        console.error('[Customers] verify parse error:', err)
      }

      // 3) Actualizar el state de React (UI)
      setCustomers(nextCustomers)
      
      // Reset form and close modal
      setFormData({
        name: '',
        legalName: '',
        taxId: '',
        website: '',
        incorporationDate: '',
        companySize: '',
        revenue: '',
        shareCapital: '',
        employees: '',
        memberOf: [],
        country: '',
        region: '',
        address: '',
        status: 'Active',
        category: '',
        description: '',
        notes: '',
        logoBase64: undefined,
        contractPdf: undefined,
        contacts: [],
      })
      setMemberOfPick('')
      setEditingCustomerId(null)
      setIsModalOpen(false)
    }
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
        revenue: customer.revenue || '',
        shareCapital: customer.shareCapital || '',
        employees: customer.employees || '',
        memberOf: customer.memberOf || [],
        country: customer.country,
        region: customer.region || '',
        address: customer.address || '',
        status: customer.status,
        category: customer.category,
        description: customer.description || '',
        notes: customer.notes || '',
        logoBase64: customer.logoBase64 || undefined,
        contractPdf: customer.contractPdf || undefined,
        contacts: customer.contacts || [],
      })
      setMemberOfPick('')
      setEditingCustomerId(customerId)
      setIsModalOpen(true)
    }
  }

  const handleDelete = (_customerId: string) => {
    window.alert('La eliminación está desactivada para mantener el histórico de clientes.')
  }

  /* ---------- Logo upload con redimensión a 400px ---------- */
  const handleLogoUpload = (file: File) => {
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
        const isPng = file.type === 'image/png' || file.type === 'image/svg+xml'
        const dataUrl = isPng
          ? canvas.toDataURL('image/png')
          : canvas.toDataURL('image/jpeg', 0.88)
        setFormData(fd => ({ ...fd, logoBase64: dataUrl }))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  /* ---------- Contract PDF upload ---------- */
  const handleContractUpload = (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('El contrato debe ser un PDF.')
      return
    }
    // 8MB cap aprox para no inflar el localStorage
    if (file.size > 8 * 1024 * 1024) {
      alert('El PDF supera 8 MB. Comprimirlo o subir otra versión.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setFormData(fd => ({
        ...fd,
        contractPdf: {
          dataUrl: reader.result as string,
          fileName: file.name,
          uploadedAt: new Date().toISOString(),
        },
      }))
    }
    reader.readAsDataURL(file)
  }

  /* ---------- Contacts CRUD ---------- */
  const addContact = () => {
    setFormData(fd => ({
      ...fd,
      contacts: [
        ...fd.contacts,
        { id: `contact-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: '', email: '', phone: '', comments: '' },
      ],
    }))
  }
  const updateContact = (id: string, patch: Partial<{ name: string; email: string; phone: string; comments: string }>) => {
    setFormData(fd => ({
      ...fd,
      contacts: fd.contacts.map(c => c.id === id ? { ...c, ...patch } : c),
    }))
  }
  const removeContact = (id: string) => {
    setFormData(fd => ({
      ...fd,
      contacts: fd.contacts.filter(c => c.id !== id),
    }))
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
      revenue: '',
      shareCapital: '',
      employees: '',
      memberOf: [],
      country: '',
      region: '',
      address: '',
      status: 'Active',
      category: '',
      description: '',
      notes: '',
      logoBase64: undefined,
      contractPdf: undefined,
      contacts: [],
    })
    setMemberOfPick('')
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
          <p className="page-subtitle">
            Your client base — companies, startups and organizations you work with
          </p>
        </div>
      </div>

      <div className="customers-toolbar">
        <div className="search-bar-inline">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by name, company, country, region, category, status…"
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
            <div style={{ minWidth: 180 }}>
              <SearchableSelect
                value={filters.country === 'All' ? '' : filters.country}
                onChange={(v) => setFilters(prev => ({ ...prev, country: v || 'All' }))}
                options={uniqueCountries}
                placeholder="All Countries"
                searchPlaceholder="Buscar país…"
                clearable
              />
            </div>
            <div style={{ minWidth: 180 }}>
              <SearchableSelect
                value={filters.region === 'All' ? '' : filters.region}
                onChange={(v) => setFilters(prev => ({ ...prev, region: v || 'All' }))}
                options={uniqueRegions}
                placeholder="All Regions"
                searchPlaceholder="Buscar región…"
                clearable
              />
            </div>
            <div style={{ minWidth: 180 }}>
              <SearchableSelect
                value={filters.category === 'All' ? '' : filters.category}
                onChange={(v) => setFilters(prev => ({ ...prev, category: v || 'All' }))}
                options={uniqueCategories}
                placeholder="All Categories"
                searchPlaceholder="Buscar categoría…"
                clearable
              />
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
            revenue: '',
            shareCapital: '',
            employees: '',
            memberOf: [],
            country: '',
            region: '',
            address: '',
            status: 'Active',
            category: '',
            description: '',
            notes: '',
            logoBase64: undefined,
            contractPdf: undefined,
            contacts: [],
          })
          setMemberOfPick('')
          setErrors({})
        }}
        title={editingCustomerId ? "Edit Client" : "New Client"}
      >
        <form onSubmit={handleSubmit} className="client-form">
          {/* ─── LOGO DEL CLIENTE ─── */}
          <div className="cf-logo-section">
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
            {formData.logoBase64 ? (
              <div className="cf-logo-preview">
                <img src={formData.logoBase64} alt="Client logo" />
                <div className="cf-logo-preview-actions">
                  <button
                    type="button"
                    className="btn-secondary btn-secondary--sm"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    className="btn-link-danger"
                    onClick={() => setFormData(fd => ({ ...fd, logoBase64: undefined }))}
                    title="Remove logo"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="cf-logo-upload-btn"
                onClick={() => logoInputRef.current?.click()}
              >
                <div className="cf-logo-upload-icon">
                  <Building2 size={28} strokeWidth={1.5} />
                </div>
                <div className="cf-logo-upload-text">
                  <strong><Upload size={12} /> Subir logo del cliente</strong>
                  <small>PNG, JPG o SVG (recomendado &lt; 1 MB) — aparecerá en exports PPT/PDF</small>
                </div>
              </button>
            )}
          </div>

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
              <DateInput
                id="incorporationDate"
                value={formData.incorporationDate}
                onChange={(v) => setFormData(prev => ({ ...prev, incorporationDate: v }))}
                className={errors.incorporationDate ? 'error' : ''}
              />
              {errors.incorporationDate && <span className="error-message">{errors.incorporationDate}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="companySize">Company Size <span className="required">*</span></label>
              <SearchableSelect
                id="companySize"
                value={formData.companySize}
                onChange={(v) => handleInputChange('companySize', v)}
                options={companySizes}
                placeholder="Select size"
                className={errors.companySize ? 'error' : ''}
              />
              {errors.companySize && <span className="error-message">{errors.companySize}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="revenue">Revenue (€)</label>
              <input
                id="revenue"
                type="number"
                min="0"
                step="any"
                value={formData.revenue}
                onChange={(e) => handleInputChange('revenue', e.target.value)}
                placeholder="e.g. 500000"
              />
            </div>

            <div className="form-group">
              <label htmlFor="shareCapital">Share Capital (€)</label>
              <input
                id="shareCapital"
                type="number"
                min="0"
                step="any"
                value={formData.shareCapital}
                onChange={(e) => handleInputChange('shareCapital', e.target.value)}
                placeholder="e.g. 3000"
              />
            </div>

            <div className="form-group">
              <label htmlFor="employees">Employees</label>
              <input
                id="employees"
                type="number"
                min="0"
                step="1"
                value={formData.employees}
                onChange={(e) => handleInputChange('employees', e.target.value)}
                placeholder="e.g. 25"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group form-group--full">
              <label htmlFor="memberOf">Member of</label>
              <SearchableSelect
                id="memberOf"
                value={memberOfPick}
                onChange={(v) => addMemberOf(v)}
                options={accelerators.filter(a => !formData.memberOf.includes(a))}
                placeholder="Select an accelerator, incubator or partner…"
                searchPlaceholder="Buscar aceleradora, incubadora…"
              />

              {formData.memberOf.length > 0 && (
                <div className="chip-list">
                  {formData.memberOf.map(name => (
                    <span key={name} className="chip">
                      {name}
                      <button
                        type="button"
                        className="chip-remove"
                        onClick={() => removeMemberOf(name)}
                        aria-label={`Remove ${name}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <p className="field-hint">
                Associate this client with an accelerator, incubator or partner organization. None of these fields are required.
              </p>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="country">Country <span className="required">*</span></label>
              <SearchableSelect
                id="country"
                value={formData.country}
                onChange={(v) => handleInputChange('country', v)}
                options={countries}
                placeholder="Select country"
                searchPlaceholder="Buscar país…"
                clearable
                className={errors.country ? 'error' : ''}
              />
              {errors.country && <span className="error-message">{errors.country}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="region">Region/State</label>
              <SearchableSelect
                id="region"
                value={formData.region}
                onChange={(v) => handleInputChange('region', v)}
                options={formData.country === 'España' ? spanishRegions : []}
                placeholder={formData.country === 'España' ? 'Select region' : 'Solo aplicable a España'}
                searchPlaceholder="Buscar comunidad autónoma…"
                clearable
                disabled={formData.country !== 'España'}
                className={errors.region ? 'error' : ''}
              />
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
              <SearchableSelect
                id="status"
                value={formData.status}
                onChange={(v) => handleInputChange('status', v)}
                options={statuses}
                placeholder="Select status"
              />
            </div>

            <div className="form-group">
              <label htmlFor="category">Category <span className="required">*</span></label>
              <SearchableSelect
                id="category"
                value={formData.category}
                onChange={(v) => handleInputChange('category', v)}
                options={categories}
                placeholder="Select category"
                searchPlaceholder="Buscar categoría…"
                clearable
                className={errors.category ? 'error' : ''}
              />
              {errors.category && <span className="error-message">{errors.category}</span>}
            </div>
          </div>

          {/* ─── CONTACTOS ─── */}
          <div className="cf-section">
            <header className="cf-section-header">
              <h3><UsersIcon size={16} /> Contacts <span className="optional-hint">(optional)</span></h3>
              <button type="button" className="btn-secondary btn-secondary--sm" onClick={addContact}>
                <Plus size={14} /> Add contact
              </button>
            </header>
            {formData.contacts.length === 0 ? (
              <p className="cf-empty-hint">Sin contactos. Añade nombres, emails y teléfonos del personal de contacto del cliente.</p>
            ) : (
              <div className="cf-contacts-table">
                <div className="cf-contacts-head">
                  <span>Nombre</span>
                  <span>Email</span>
                  <span>Teléfono</span>
                  <span>Comentarios</span>
                  <span></span>
                </div>
                {formData.contacts.map(c => (
                  <div key={c.id} className="cf-contacts-row">
                    <input
                      type="text"
                      placeholder="Nombre completo"
                      value={c.name}
                      onChange={e => updateContact(c.id, { name: e.target.value })}
                    />
                    <input
                      type="email"
                      placeholder="email@cliente.com"
                      value={c.email}
                      onChange={e => updateContact(c.id, { email: e.target.value })}
                    />
                    <input
                      type="tel"
                      placeholder="+34 ..."
                      value={c.phone}
                      onChange={e => updateContact(c.id, { phone: e.target.value })}
                    />
                    <input
                      type="text"
                      placeholder="Rol, notas…"
                      value={c.comments}
                      onChange={e => updateContact(c.id, { comments: e.target.value })}
                    />
                    <button
                      type="button"
                      className="btn-link-danger"
                      onClick={() => removeContact(c.id)}
                      title="Remove contact"
                      aria-label="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
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

          {/* ─── CONTRACT PDF ─── */}
          <div className="cf-section">
            <header className="cf-section-header">
              <h3><FileCheck size={16} /> Contract <span className="optional-hint">(optional)</span></h3>
            </header>
            <input
              ref={contractInputRef}
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) handleContractUpload(f)
                if (contractInputRef.current) contractInputRef.current.value = ''
              }}
            />
            {formData.contractPdf ? (
              <div className="cf-contract-preview">
                <FileText size={28} className="cf-contract-icon" />
                <div className="cf-contract-info">
                  <strong>{formData.contractPdf.fileName}</strong>
                  <small>Subido el {new Date(formData.contractPdf.uploadedAt).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>
                </div>
                <div className="cf-contract-actions">
                  <a
                    href={formData.contractPdf.dataUrl}
                    download={formData.contractPdf.fileName}
                    className="btn-secondary btn-secondary--sm"
                  >
                    Download
                  </a>
                  <button
                    type="button"
                    className="btn-secondary btn-secondary--sm"
                    onClick={() => contractInputRef.current?.click()}
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    className="btn-link-danger"
                    onClick={() => setFormData(fd => ({ ...fd, contractPdf: undefined }))}
                    title="Remove contract"
                    aria-label="Remove"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="cf-contract-upload-btn"
                onClick={() => contractInputRef.current?.click()}
              >
                <Upload size={16} /> Subir contrato firmado (PDF, máx. 8 MB)
              </button>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notes <span className="optional-hint">(optional)</span></label>
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
              {editingCustomerId ? 'Save changes' : 'Create client'}
            </button>
          </div>
        </form>
      </Modal>
      
      <div className="content-section">
        <div className="table-container">
          <table className="data-table customers-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Country</th>
                <th>Region</th>
                <th>Partner</th>
                <th>Website</th>
                <th>Category</th>
                <th>Status</th>
                <th>Actions</th>
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
                        onEditContext={() => navigate(`/customers/${customer.id}/context`)}
                        onGenerateRoadmap={() => navigate(`/customers/${customer.id}/funding-profile`)}
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
              Showing {startIndex + 1}–{Math.min(endIndex, filteredCustomers.length)} of {filteredCustomers.length} customers
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
