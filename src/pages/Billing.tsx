import { useState, useEffect } from 'react'
import { Search, ChevronDown, Clock, Send, CheckCircle, AlertCircle, Plus, Pencil, Trash2, FileText } from 'lucide-react'
import { formatCurrency, formatNumber, parseEuropeanNumber } from '../utils/formatCurrency'
import Modal from '../components/Modal'
import { useAuth } from '../contexts/AuthContext'
import './Page.css'

interface Project {
  id: string
  title: string
  primaryClients: string[]
  secondaryClients?: string[]
  billingSchedule?: BillingItem[]
  fee?: string
}

interface BillingItem {
  id: string
  percentage: string
  clientName: string
  dueDate: string
  amount: string
  invoiceStatus: string
  description?: string
  projectId: string
  projectName: string
}

interface Invoice {
  id: string
  billingId: string
  projectId: string
  projectName: string
  description: string
  amount: string
  clientName: string
  date: string
  number: string
  vatOption?: '21' | 'exempt'
  vatAmount?: number
  total?: number
}

interface Customer {
  id: string
  name: string
  company?: string
  taxId?: string
  address?: string
}

const Billing = () => {
  const { user } = useAuth()
  const isWorker = user?.role === 'Worker'
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [allBillings, setAllBillings] = useState<BillingItem[]>([])
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isConfirmPaidOpen, setIsConfirmPaidOpen] = useState(false)
  const [pendingInvoiceStatus, setPendingInvoiceStatus] = useState<string | null>(null)
  const [selectedBilling, setSelectedBilling] = useState<BillingItem | null>(null)
  const [editFormData, setEditFormData] = useState({
    description: '',
    amount: '',
    dueDate: '',
    invoiceStatus: 'Invoice_pending' as string
  })
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})
  
  // New Billing Modal state
  const [isNewBillingModalOpen, setIsNewBillingModalOpen] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [companySettings, setCompanySettings] = useState({
    name: '',
    legalName: '',
    taxId: '',
    address: ''
  })
  const [newBillingFormData, setNewBillingFormData] = useState({
    projectId: '',
    clientId: '',
    description: '',
    amount: '',
    dueDate: '',
    notes: ''
  })
  const [newBillingErrors, setNewBillingErrors] = useState<Record<string, string>>({})

  // Invoice Modal state
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  
  const getOrCreateInvoice = (billing: BillingItem) => {
    const savedInvoices = localStorage.getItem('invoices')
    const invoices = savedInvoices ? JSON.parse(savedInvoices) : []
    const existing = invoices.find((inv: { billingId: string }) => inv.billingId === billing.id)

    if (existing) {
      return existing as Invoice
    }

    const now = new Date()
    const invoice: Invoice = {
      id: `invoice-${Date.now()}`,
      billingId: billing.id,
      projectId: billing.projectId,
      projectName: billing.projectName,
      description: billing.description || '',
      amount: billing.amount,
      clientName: billing.clientName,
      date: now.toISOString(),
      number: ''
    }

    invoices.push(invoice)
    localStorage.setItem('invoices', JSON.stringify(invoices))
    return invoice
  }

  const openInvoiceModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setIsInvoiceModalOpen(true)
  }


  // Load projects and customers
  useEffect(() => {
    const loadProjects = () => {
      try {
        const saved = localStorage.getItem('projects')
        const projectsData: Project[] = saved ? JSON.parse(saved) : []
        setProjects(projectsData)
      } catch (error) {
        console.error('Error loading projects:', error)
        setProjects([])
      }
    }

    const loadCustomers = () => {
      try {
        const saved = localStorage.getItem('customers')
        const customersData: Customer[] = saved ? JSON.parse(saved) : []
        setCustomers(customersData)
      } catch (error) {
        console.error('Error loading customers:', error)
        setCustomers([])
      }
    }

    loadProjects()
    loadCustomers()
    const storedCompany = localStorage.getItem('companySettings')
    if (storedCompany) {
      try {
        const parsed = JSON.parse(storedCompany)
        setCompanySettings({
          name: parsed?.name || '',
          legalName: parsed?.legalName || '',
          taxId: parsed?.taxId || '',
          address: parsed?.address || ''
        })
      } catch {
        setCompanySettings({ name: '', legalName: '', taxId: '', address: '' })
      }
    }
  }, [])

  // Load all billings from projects
  useEffect(() => {
    const loadBillings = () => {
      try {
        const savedProjects = localStorage.getItem('projects')
        if (!savedProjects) {
          setAllBillings([])
          return
        }

        const projects: Project[] = JSON.parse(savedProjects)
        const billings: BillingItem[] = []

        projects.forEach(project => {
          if (project.billingSchedule && project.billingSchedule.length > 0) {
            project.billingSchedule.forEach(billing => {
              // Explicitly copy all fields including description
              const billingItem: BillingItem = {
                id: billing.id,
                percentage: billing.percentage,
                clientName: billing.clientName,
                dueDate: billing.dueDate,
                amount: billing.amount,
                invoiceStatus: billing.invoiceStatus,
                description: billing.description, // Explicitly import description from Projects
                projectId: project.id,
                projectName: project.title
              }
              billings.push(billingItem)
            })
          }
        })

        setAllBillings(billings)
      } catch (error) {
        console.error('Error loading billings:', error)
        setAllBillings([])
      }
    }

    loadBillings()
    
    // Listen for storage changes to update billings
    const handleStorageChange = () => {
      loadBillings()
    }
    window.addEventListener('storage', handleStorageChange)
    
    // Also check periodically (in case of same-tab updates)
    const interval = setInterval(loadBillings, 1000)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [])

  // Calculate statistics
  const getStatistics = () => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const pendingBillings = allBillings.filter(b => b.invoiceStatus === 'Invoice_pending')
    const sentBillings = allBillings.filter(b => b.invoiceStatus === 'Invoice_sent')
    const paidBillings = allBillings.filter(b => b.invoiceStatus === 'Invoice_paid')
    const overdueBillings = allBillings.filter(b => {
      const dueDate = new Date(b.dueDate)
      dueDate.setHours(0, 0, 0, 0)
      return dueDate < now && b.invoiceStatus !== 'Invoice_paid'
    })

    const pending = pendingBillings.length
    const sent = sentBillings.length
    const paid = paidBillings.length
    const overdue = overdueBillings.length

    // Calculate totals
    const pendingTotal = pendingBillings.reduce((sum, b) => sum + (parseEuropeanNumber(b.amount) || 0), 0)
    const sentTotal = sentBillings.reduce((sum, b) => sum + (parseEuropeanNumber(b.amount) || 0), 0)
    const paidTotal = paidBillings.reduce((sum, b) => sum + (parseEuropeanNumber(b.amount) || 0), 0)
    const overdueTotal = overdueBillings.reduce((sum, b) => sum + (parseEuropeanNumber(b.amount) || 0), 0)

    return { 
      pending, 
      sent, 
      paid, 
      overdue,
      pendingTotal,
      sentTotal,
      paidTotal,
      overdueTotal
    }
  }

  const stats = getStatistics()

  const getCustomerByName = (name: string) => {
    return customers.find((c) => c.name === name)
  }

  // Filter billings
  const filteredBillings = allBillings.filter(billing => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch = 
        billing.projectName.toLowerCase().includes(searchLower) ||
        billing.clientName.toLowerCase().includes(searchLower) ||
        (billing.description || '').toLowerCase().includes(searchLower) ||
        billing.amount.includes(searchTerm) ||
        formatDate(billing.dueDate).toLowerCase().includes(searchLower) ||
        billing.invoiceStatus.toLowerCase().includes(searchLower)
      
      if (!matchesSearch) return false
    }

    // Status filter
    if (statusFilter !== 'All') {
      if (statusFilter === 'Invoice_pending' && billing.invoiceStatus !== 'Invoice_pending') return false
      if (statusFilter === 'Invoice_sent' && billing.invoiceStatus !== 'Invoice_sent') return false
      if (statusFilter === 'Invoice_paid' && billing.invoiceStatus !== 'Invoice_paid') return false
    }

    // Overdue filter
    if (overdueOnly) {
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      const dueDate = new Date(billing.dueDate)
      dueDate.setHours(0, 0, 0, 0)
      if (dueDate >= now || billing.invoiceStatus === 'Invoice_paid') return false
    }

    return true
  })

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  // Get status badge class and color
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Invoice_pending':
        return { class: 'status-invoice-pending', color: '#FFC107', label: 'Invoice Pending' }
      case 'Invoice_sent':
        return { class: 'status-invoice-sent', color: '#2196F3', label: 'Invoice Sent' }
      case 'Invoice_paid':
        return { class: 'status-invoice-paid', color: '#4CAF50', label: 'Invoice Paid' }
      default:
        return { class: '', color: '#64748b', label: status }
    }
  }

  // Check if billing is overdue
  const isOverdue = (billing: BillingItem) => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const dueDate = new Date(billing.dueDate)
    dueDate.setHours(0, 0, 0, 0)
    return dueDate < now && billing.invoiceStatus !== 'Invoice_paid'
  }

  // Get unique statuses for filter
  const uniqueStatuses = Array.from(new Set(allBillings.map(b => b.invoiceStatus)))

  // Get available clients for selected project
  const getAvailableClients = () => {
    if (!newBillingFormData.projectId) return []
    const project = projects.find(p => p.id === newBillingFormData.projectId)
    if (!project) return []
    
    const clientIds = [...project.primaryClients, ...(project.secondaryClients || [])]
    return customers.filter(c => clientIds.includes(c.id))
  }

  // Get client name by ID
  const getClientName = (clientId: string) => {
    const client = customers.find(c => c.id === clientId)
    return client ? client.name : clientId
  }

  // Handle New Billing Form Change
  const handleNewBillingFormChange = (field: string, value: string) => {
    setNewBillingFormData(prev => {
      const updated = { ...prev, [field]: value }
      // Reset clientId when project changes
      if (field === 'projectId') {
        updated.clientId = ''
      }
      return updated
    })
    if (newBillingErrors[field]) {
      setNewBillingErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  // Handle New Billing Date Input
  const handleNewBillingDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '')
    if (value.length >= 2) value = value.slice(0, 2) + '/' + value.slice(2)
    if (value.length >= 5) value = value.slice(0, 5) + '/' + value.slice(5, 9)
    setNewBillingFormData(prev => ({ ...prev, dueDate: value }))
  }

  // Handle Add New Billing
  const handleAddNewBilling = () => {
    const newErrors: Record<string, string> = {}
    
    if (!newBillingFormData.projectId) newErrors.projectId = 'Project is required'
    if (!newBillingFormData.clientId) newErrors.clientId = 'Client is required'
    if (!newBillingFormData.description.trim()) newErrors.description = 'Description is required'
    if (!newBillingFormData.amount.trim()) newErrors.amount = 'Amount is required'
    if (!newBillingFormData.dueDate.trim()) newErrors.dueDate = 'Due Date is required'

    // Validate amount is a valid number
    if (newBillingFormData.amount.trim()) {
      const amountValue = parseEuropeanNumber(newBillingFormData.amount)
      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        newErrors.amount = 'Amount must be a valid positive number'
      }
    }

    // Validate date format
    if (newBillingFormData.dueDate.trim()) {
      const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/
      if (!dateRegex.test(newBillingFormData.dueDate)) {
        newErrors.dueDate = 'Date must be in dd/mm/yyyy format'
      }
    }

    setNewBillingErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    // Convert date from dd/mm/yyyy to YYYY-MM-DD
    const convertDateToISO = (dateString: string) => {
      if (!dateString) return ''
      const parts = dateString.split('/')
      if (parts.length === 3) {
        const day = parts[0]
        const month = parts[1]
        const year = parts[2]
        return `${year}-${month}-${day}`
      }
      return dateString
    }

    const amountValue = parseEuropeanNumber(newBillingFormData.amount)
    const clientName = getClientName(newBillingFormData.clientId)
    const project = projects.find(p => p.id === newBillingFormData.projectId)
    if (!project) return

    // Calculate percentage based on fee
    const projectFee = parseEuropeanNumber(project.fee) || 0
    const percentage = projectFee > 0 ? ((amountValue / projectFee) * 100).toFixed(0) + '%' : '0%'

    const newBillingItem: BillingItem = {
      id: `billing-${Date.now()}`,
      percentage: percentage,
      clientName: clientName,
      dueDate: convertDateToISO(newBillingFormData.dueDate),
      amount: formatNumber(amountValue, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      invoiceStatus: 'Invoice_pending',
      description: newBillingFormData.description.trim() || undefined,
      projectId: project.id,
      projectName: project.title
    }

    // Update project's billing schedule
    const updatedBillingSchedule = [
      ...(project.billingSchedule || []),
      newBillingItem
    ]

    const updatedProject: Project = {
      ...project,
      billingSchedule: updatedBillingSchedule
    }

    // Update projects in localStorage
    try {
      const savedProjects = localStorage.getItem('projects')
      if (!savedProjects) return

      const allProjects: Project[] = JSON.parse(savedProjects)
      const updatedProjects = allProjects.map(p => 
        p.id === project.id ? updatedProject : p
      )

      localStorage.setItem('projects', JSON.stringify(updatedProjects))
      
      // Reload billings
      const loadBillings = () => {
        const billings: BillingItem[] = []
        updatedProjects.forEach(proj => {
          if (proj.billingSchedule && proj.billingSchedule.length > 0) {
            proj.billingSchedule.forEach(b => {
              const billingItem: BillingItem = {
                id: b.id,
                percentage: b.percentage,
                clientName: b.clientName,
                dueDate: b.dueDate,
                amount: b.amount,
                invoiceStatus: b.invoiceStatus,
                description: b.description,
                projectId: proj.id,
                projectName: proj.title
              }
              billings.push(billingItem)
            })
          }
        })
        setAllBillings(billings)
      }
      loadBillings()

      // Reset form
      setNewBillingFormData({
        projectId: '',
        clientId: '',
        description: '',
        amount: '',
        dueDate: '',
        notes: ''
      })
      setNewBillingErrors({})
      setIsNewBillingModalOpen(false)
    } catch (error) {
      console.error('Error saving billing:', error)
    }
  }

  // Handle Edit Billing
  const handleEditBilling = (billing: BillingItem) => {
    setSelectedBilling(billing)
    
    // Convert date from YYYY-MM-DD to dd/mm/yyyy
    const formatDateForInput = (dateString: string) => {
      if (!dateString) return ''
      const date = new Date(dateString)
      const day = date.getDate().toString().padStart(2, '0')
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const year = date.getFullYear()
      return `${day}/${month}/${year}`
    }

    setEditFormData({
      description: billing.description || '',
      amount: formatNumber(parseEuropeanNumber(billing.amount) || 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      dueDate: formatDateForInput(billing.dueDate),
      invoiceStatus: billing.invoiceStatus
    })
    setEditErrors({})
    setIsEditModalOpen(true)
  }

  // Handle Edit Date Input
  const handleEditDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '')
    if (value.length >= 2) value = value.slice(0, 2) + '/' + value.slice(2)
    if (value.length >= 5) value = value.slice(0, 5) + '/' + value.slice(5, 9)
    setEditFormData(prev => ({ ...prev, dueDate: value }))
  }

  // Handle Edit Form Change
  const handleEditFormChange = (field: string, value: string) => {
    setEditFormData(prev => ({ ...prev, [field]: value }))
    if (editErrors[field]) {
      setEditErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleInvoiceStatusChange = (value: string) => {
    if (selectedBilling?.invoiceStatus === 'Invoice_sent' && value === 'Invoice_pending') {
      return
    }

    if (value === 'Invoice_paid' && editFormData.invoiceStatus !== 'Invoice_paid') {
      setPendingInvoiceStatus(value)
      setIsConfirmPaidOpen(true)
      return
    }

    handleEditFormChange('invoiceStatus', value)
  }

  // Handle Save Billing Changes
  const handleSaveBillingChanges = () => {
    if (!selectedBilling) return

    const newErrors: Record<string, string> = {}
    
    if (!editFormData.description.trim()) newErrors.description = 'Description is required'
    if (!editFormData.amount.trim()) newErrors.amount = 'Amount is required'
    if (!editFormData.dueDate.trim()) newErrors.dueDate = 'Due Date is required'

    // Validate amount is a valid number
    if (editFormData.amount.trim()) {
      const amountValue = parseEuropeanNumber(editFormData.amount)
      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        newErrors.amount = 'Amount must be a valid positive number'
      }
    }

    // Validate date format
    if (editFormData.dueDate.trim()) {
      const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/
      if (!dateRegex.test(editFormData.dueDate)) {
        newErrors.dueDate = 'Date must be in dd/mm/yyyy format'
      }
    }

    setEditErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    // Convert date from dd/mm/yyyy to YYYY-MM-DD
    const convertDateToISO = (dateString: string) => {
      if (!dateString) return ''
      const parts = dateString.split('/')
      if (parts.length === 3) {
        const day = parts[0]
        const month = parts[1]
        const year = parts[2]
        return `${year}-${month}-${day}`
      }
      return dateString
    }

    const amountValue = parseEuropeanNumber(editFormData.amount)

    // Load projects and update the billing item
    try {
      const savedProjects = localStorage.getItem('projects')
      if (!savedProjects) return

      const projects: Project[] = JSON.parse(savedProjects)
      const project = projects.find(p => p.id === selectedBilling.projectId)
      if (!project) return

      // Find the billing item in the project
      const billingIndex = project.billingSchedule?.findIndex(b => b.id === selectedBilling.id)
      if (billingIndex === undefined || billingIndex === -1) return

      // Calculate percentage based on fee
    const projectFee = parseEuropeanNumber(project.fee) || 0
      const percentage = projectFee > 0 ? ((amountValue / projectFee) * 100).toFixed(0) + '%' : '0%'

      // Update billing item
      const updatedBillingItem: BillingItem = {
        ...selectedBilling,
        description: editFormData.description.trim() || undefined,
        amount: formatNumber(amountValue, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        dueDate: convertDateToISO(editFormData.dueDate),
        invoiceStatus: editFormData.invoiceStatus,
        percentage: percentage
      }

      // Update project's billing schedule
      const updatedBillingSchedule = project.billingSchedule?.map((b, idx) => 
        idx === billingIndex ? updatedBillingItem : b
      ) || []

      const updatedProject: Project = {
        ...project,
        billingSchedule: updatedBillingSchedule
      }

      // Update projects in localStorage
      const updatedProjects = projects.map(p => 
        p.id === project.id ? updatedProject : p
      )

      localStorage.setItem('projects', JSON.stringify(updatedProjects))
      
      // Reload billings
      const loadBillings = () => {
        const billings: BillingItem[] = []
        updatedProjects.forEach(proj => {
          if (proj.billingSchedule && proj.billingSchedule.length > 0) {
            proj.billingSchedule.forEach(b => {
              billings.push({
                ...b,
                projectId: proj.id,
                projectName: proj.title
              })
            })
          }
        })
        setAllBillings(billings)
      }
      loadBillings()

      setIsEditModalOpen(false)
      setSelectedBilling(null)
      setEditFormData({
        description: '',
        amount: '',
        dueDate: '',
        invoiceStatus: 'Invoice_pending'
      })
      setEditErrors({})
    } catch (error) {
      console.error('Error saving billing:', error)
    }
  }

  // Handle Delete Billing
  const handleDeleteBilling = (_billing: BillingItem) => {
    window.alert('La eliminación está desactivada para conservar el histórico de billing.')
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Billing</h1>
          <p className="page-subtitle">Manage invoices and payments</p>
        </div>
      </div>

      {/* Statistics Panels */}
      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        <div 
          className="stat-card" 
          style={{ 
            background: 'white', 
            border: '1px solid #e2e8f0', 
            borderRadius: '0.75rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onClick={() => {
            setStatusFilter('Invoice_pending')
            setOverdueOnly(false)
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#FFA000'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 160, 0, 0.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#e2e8f0'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          <div className="stat-icon" style={{ background: '#FFF8E1', color: '#FFA000', borderRadius: '0.5rem', padding: '0.75rem' }}>
            <Clock size={24} />
          </div>
          <div className="stat-content">
            <h3 style={{ color: '#FFA000', margin: 0, fontSize: '0.875rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending</h3>
            <p className="stat-value" style={{ color: '#2C3E50', fontSize: '2.5rem', fontWeight: '700', margin: '0.5rem 0 0.25rem 0' }}>
              {stats.pending}
            </p>
            <p style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: '500', margin: 0 }}>
              {formatCurrency(stats.pendingTotal)}
            </p>
          </div>
        </div>

        <div 
          className="stat-card" 
          style={{ 
            background: 'white', 
            border: '1px solid #e2e8f0', 
            borderRadius: '0.75rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onClick={() => {
            setStatusFilter('Invoice_sent')
            setOverdueOnly(false)
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#1976D2'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(25, 118, 210, 0.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#e2e8f0'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          <div className="stat-icon" style={{ background: '#E3F2FD', color: '#1976D2', borderRadius: '0.5rem', padding: '0.75rem' }}>
            <Send size={24} />
          </div>
          <div className="stat-content">
            <h3 style={{ color: '#1976D2', margin: 0, fontSize: '0.875rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sent</h3>
            <p className="stat-value" style={{ color: '#2C3E50', fontSize: '2.5rem', fontWeight: '700', margin: '0.5rem 0 0.25rem 0' }}>
              {stats.sent}
            </p>
            <p style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: '500', margin: 0 }}>
              {formatCurrency(stats.sentTotal)}
            </p>
          </div>
        </div>

        <div 
          className="stat-card" 
          style={{ 
            background: 'white', 
            border: '1px solid #e2e8f0', 
            borderRadius: '0.75rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onClick={() => {
            setStatusFilter('Invoice_paid')
            setOverdueOnly(false)
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#388E3C'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(56, 142, 60, 0.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#e2e8f0'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          <div className="stat-icon" style={{ background: '#E8F5E9', color: '#388E3C', borderRadius: '0.5rem', padding: '0.75rem' }}>
            <CheckCircle size={24} />
          </div>
          <div className="stat-content">
            <h3 style={{ color: '#388E3C', margin: 0, fontSize: '0.875rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Paid</h3>
            <p className="stat-value" style={{ color: '#2C3E50', fontSize: '2.5rem', fontWeight: '700', margin: '0.5rem 0 0.25rem 0' }}>
              {stats.paid}
            </p>
            <p style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: '500', margin: 0 }}>
              {formatCurrency(stats.paidTotal)}
            </p>
          </div>
        </div>

        <div 
          className="stat-card" 
          style={{ 
            background: 'white', 
            border: '1px solid #e2e8f0', 
            borderRadius: '0.75rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onClick={() => {
            setStatusFilter('All')
            setOverdueOnly(true)
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#D32F2F'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(211, 47, 47, 0.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#e2e8f0'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          <div className="stat-icon" style={{ background: '#FFEBEE', color: '#D32F2F', borderRadius: '0.5rem', padding: '0.75rem' }}>
            <AlertCircle size={24} />
          </div>
          <div className="stat-content">
            <h3 style={{ color: '#D32F2F', margin: 0, fontSize: '0.875rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overdue</h3>
            <p className="stat-value" style={{ color: '#2C3E50', fontSize: '2.5rem', fontWeight: '700', margin: '0.5rem 0 0.25rem 0' }}>
              {stats.overdue}
            </p>
            <p style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: '500', margin: 0 }}>
              {formatCurrency(stats.overdueTotal)}
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="customers-toolbar">
        <div className="search-bar-inline">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by project, client, description, amount, due date, status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input-inline"
          />
        </div>

        <div className="filter-buttons">
          <div className="filter-button-group">
            <div className="select-wrapper" style={{ position: 'relative' }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`filter-btn ${statusFilter !== 'All' ? 'active' : ''}`}
                style={{ appearance: 'none', paddingRight: '2rem', cursor: 'pointer' }}
              >
                <option value="All">All Status</option>
                {uniqueStatuses.map(status => (
                  <option key={status} value={status}>
                    {status === 'Invoice_pending' ? 'Invoice Pending' : 
                     status === 'Invoice_sent' ? 'Invoice Sent' : 
                     status === 'Invoice_paid' ? 'Invoice Paid' : status}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="select-chevron" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
            <button
              onClick={() => setOverdueOnly(!overdueOnly)}
              className={`filter-btn ${overdueOnly ? 'active' : ''}`}
              style={{
                padding: '0.5rem 1rem',
                border: overdueOnly ? '1px solid #D32F2F' : '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                background: 'white',
                color: overdueOnly ? '#D32F2F' : '#64748b',
                transition: 'all 0.2s ease'
              }}
            >
              Overdue Only
            </button>
          </div>
        </div>

        <button 
          className="btn-primary" 
          onClick={() => {
            setNewBillingFormData({
              projectId: '',
              clientId: '',
              description: '',
              amount: '',
              dueDate: '',
              notes: ''
            })
            setNewBillingErrors({})
            setIsNewBillingModalOpen(true)
          }}
        >
          <Plus size={18} />
          New Billing
        </button>
      </div>

      {/* Table */}
      <div className="content-section">
        {filteredBillings.length === 0 ? (
          <div className="empty-row" style={{ padding: '3rem', textAlign: 'center' }}>
            {searchTerm || statusFilter !== 'All' || overdueOnly
              ? 'No billings match your filters' 
              : 'No billings found. Add billing milestones from projects.'}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Client</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Invoice</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBillings.map(billing => {
                const statusBadge = getStatusBadge(billing.invoiceStatus)
                const overdue = isOverdue(billing)
                
                return (
                  <tr key={billing.id}>
                    <td>
                      <div style={{ fontWeight: '500', color: '#2C3E50' }}>
                        {billing.projectName}
                      </div>
                    </td>
                    <td>{billing.clientName}</td>
                    <td>{billing.description || '-'}</td>
                    <td>{formatCurrency(billing.amount)}</td>
                    <td>
                      <span style={{ color: overdue ? '#FF5722' : '#2C3E50' }}>
                        {formatDate(billing.dueDate)}
                      </span>
                    </td>
                    <td>
                      <span 
                        className={`status-badge ${statusBadge.class}`}
                        style={{
                          backgroundColor: statusBadge.color,
                          color: 'white',
                          padding: '0.375rem 0.75rem',
                          borderRadius: '0.375rem',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        {statusBadge.label}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="table-action-btn" 
                        onClick={() => {
                          if (isWorker) return
                          if (billing.invoiceStatus === 'Invoice_sent' || billing.invoiceStatus === 'Invoice_paid') {
                            const invoice = getOrCreateInvoice(billing)
                            openInvoiceModal(invoice)
                            return
                          }
                          const invoice = getOrCreateInvoice(billing)
                          window.location.href = `/invoice/${invoice.id}`
                        }}
                        title={billing.invoiceStatus === 'Invoice_sent' || billing.invoiceStatus === 'Invoice_paid' ? 'View Invoice' : 'Generate Invoice'}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: isWorker ? 'not-allowed' : 'pointer',
                          padding: '0.25rem',
                          color: isWorker ? '#cbd5e1' : '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '0.25rem',
                          transition: 'all 0.2s ease'
                        }}
                        disabled={isWorker}
                      >
                        <FileText size={16} />
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button 
                          className="table-action-btn" 
                          onClick={() => {
                            if (isWorker && (billing.invoiceStatus === 'Invoice_sent' || billing.invoiceStatus === 'Invoice_paid')) return
                            handleEditBilling(billing)
                          }}
                          title="Edit"
                          disabled={isWorker && (billing.invoiceStatus === 'Invoice_sent' || billing.invoiceStatus === 'Invoice_paid')}
                        >
                          <Pencil size={16} />
                        </button>
                        <button 
                          className="table-action-btn delete" 
                          onClick={() => {
                            if (isWorker && (billing.invoiceStatus === 'Invoice_sent' || billing.invoiceStatus === 'Invoice_paid')) return
                            handleDeleteBilling(billing)
                          }}
                          title="Delete"
                          disabled={isWorker && (billing.invoiceStatus === 'Invoice_sent' || billing.invoiceStatus === 'Invoice_paid')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Invoice Modal */}
      <Modal
        isOpen={isInvoiceModalOpen}
        onClose={() => {
          setIsInvoiceModalOpen(false)
          setSelectedInvoice(null)
        }}
        title="Invoice"
      >
        {selectedInvoice ? (() => {
          const taxableBase = parseEuropeanNumber(selectedInvoice.amount) || 0
          const vatOption = selectedInvoice.vatOption || '21'
          const vatAmount = vatOption === '21' ? taxableBase * 0.21 : 0
          const total = vatOption === '21' ? taxableBase + vatAmount : taxableBase

          return (
            <div className="invoice-document">
              <div className="invoice-header">
                <div className="invoice-left">
                  <img src="/logo.png?v=2" alt="Alamos IA" className="invoice-logo" />
                  <div className="invoice-company">
                    <div className="invoice-company-name">{companySettings.legalName || '-'}</div>
                    <div className="invoice-company-line">TAX ID: {companySettings.taxId || '-'}</div>
                    <div className="invoice-company-line">{companySettings.address || '-'}</div>
                  </div>
                  <div className="invoice-meta">
                    <div><strong>Date:</strong> {formatDate(selectedInvoice.date)}</div>
                    <div><strong>Invoice Number:</strong> {selectedInvoice.number || '-'}</div>
                  </div>
                </div>
                <div className="invoice-right">
                  <div className="invoice-customer-title">CUSTOMER</div>
                  <div className="invoice-customer">
                    <div className="invoice-company-name">{getCustomerByName(selectedInvoice.clientName)?.company || '-'}</div>
                    <div className="invoice-company-line">TAX ID: {getCustomerByName(selectedInvoice.clientName)?.taxId || '-'}</div>
                    <div className="invoice-company-line">{getCustomerByName(selectedInvoice.clientName)?.address || '-'}</div>
                  </div>
                </div>
              </div>

              <table className="invoice-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Description</th>
                    <th>Quantity €</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{selectedInvoice.projectName}</td>
                    <td>{selectedInvoice.description || '-'}</td>
                    <td>{formatCurrency(taxableBase)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="invoice-summary">
                <table className="invoice-summary-table">
                  <tbody>
                    <tr>
                      <td>Taxable Base €</td>
                      <td>{formatCurrency(taxableBase)}</td>
                    </tr>
                    <tr>
                      <td>VAT</td>
                      <td>
                        {vatOption === '21'
                          ? `21% (${formatCurrency(vatAmount)})`
                          : 'Transaction not subject to VAT due to location rules'}
                      </td>
                    </tr>
                    <tr className="invoice-total-row">
                      <td>Total €</td>
                      <td>{formatCurrency(total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="invoice-notes">
                <strong>NOTES:</strong> Payment by bank transfer to the current account of ALAMOS INNOVACIÓN S.L at BBVA with number ES53 0182 1940 20 0201590924
              </div>
            </div>
          )
        })() : (
          <div className="empty-state">Invoice not found.</div>
        )}
      </Modal>

      {/* Edit Billing Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedBilling(null)
          setEditFormData({
            description: '',
            amount: '',
            dueDate: '',
            invoiceStatus: 'Invoice_pending'
          })
          setEditErrors({})
        }}
        title="Edit Billing"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSaveBillingChanges(); }} className="modal-form">
          <div className="form-group">
            <label htmlFor="edit-billing-description">Description <span className="required">*</span></label>
            <input
              type="text"
              id="edit-billing-description"
              value={editFormData.description}
              onChange={(e) => handleEditFormChange('description', e.target.value)}
              className={editErrors.description ? 'error' : ''}
              placeholder="e.g., First milestone - 50%"
            />
            {editErrors.description && <span className="error-message">{editErrors.description}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="edit-billing-amount">Amount (€) <span className="required">*</span></label>
            <input
              type="text"
              id="edit-billing-amount"
              value={editFormData.amount}
              onChange={(e) => handleEditFormChange('amount', e.target.value)}
              className={editErrors.amount ? 'error' : ''}
              placeholder="0,00"
            />
            {editErrors.amount && <span className="error-message">{editErrors.amount}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="edit-billing-due-date">Due Date <span className="required">*</span></label>
            <input
              type="text"
              id="edit-billing-due-date"
              value={editFormData.dueDate}
              onChange={handleEditDateInput}
              className={editErrors.dueDate ? 'error' : ''}
              placeholder="dd/mm/yyyy"
              maxLength={10}
            />
            {editErrors.dueDate && <span className="error-message">{editErrors.dueDate}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="edit-billing-status">Status <span className="required">*</span></label>
            <div className="select-wrapper">
              <select
                id="edit-billing-status"
                value={editFormData.invoiceStatus}
                onChange={(e) => handleInvoiceStatusChange(e.target.value)}
              >
                {selectedBilling?.invoiceStatus !== 'Invoice_sent' && (
                  <option value="Invoice_pending">Invoice Pending</option>
                )}
                <option value="Invoice_sent">Invoice Sent</option>
                <option value="Invoice_paid">Invoice Paid</option>
              </select>
              <ChevronDown size={16} className="select-chevron" />
            </div>
          </div>

          <div className="modal-actions">
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={() => {
                setIsEditModalOpen(false)
                setSelectedBilling(null)
                setEditFormData({
                  description: '',
                  amount: '',
                  dueDate: '',
                  invoiceStatus: 'Invoice_pending'
                })
                setEditErrors({})
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Invoice Paid Modal */}
      <Modal
        isOpen={isConfirmPaidOpen}
        onClose={() => {
          setIsConfirmPaidOpen(false)
          setPendingInvoiceStatus(null)
        }}
        title="Confirm Status Change"
      >
        <div className="modal-form">
          <p>Are you sure you want to change the Status to Invoice Paid?</p>
          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setIsConfirmPaidOpen(false)
                setPendingInvoiceStatus(null)
              }}
            >
              No
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                if (pendingInvoiceStatus) {
                  handleEditFormChange('invoiceStatus', pendingInvoiceStatus)
                }
                setIsConfirmPaidOpen(false)
                setPendingInvoiceStatus(null)
              }}
            >
              Yes
            </button>
          </div>
        </div>
      </Modal>

      {/* New Billing Modal */}
      <Modal
        isOpen={isNewBillingModalOpen}
        onClose={() => {
          setIsNewBillingModalOpen(false)
          setNewBillingFormData({
            projectId: '',
            clientId: '',
            description: '',
            amount: '',
            dueDate: '',
            notes: ''
          })
          setNewBillingErrors({})
        }}
        title="Add Billing Milestone"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleAddNewBilling(); }} className="modal-form">
          <div className="form-group">
            <label htmlFor="new-billing-project">Project <span className="required">*</span></label>
            <div className="select-wrapper">
              <select
                id="new-billing-project"
                value={newBillingFormData.projectId}
                onChange={(e) => handleNewBillingFormChange('projectId', e.target.value)}
                className={newBillingErrors.projectId ? 'error' : ''}
              >
                <option value="">Select a project</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>{project.title}</option>
                ))}
              </select>
              <ChevronDown size={16} className="select-chevron" />
            </div>
            {newBillingErrors.projectId && <span className="error-message">{newBillingErrors.projectId}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="new-billing-client">Client <span className="required">*</span></label>
            <div className="select-wrapper">
              <select
                id="new-billing-client"
                value={newBillingFormData.clientId}
                onChange={(e) => handleNewBillingFormChange('clientId', e.target.value)}
                className={newBillingErrors.clientId ? 'error' : ''}
                disabled={!newBillingFormData.projectId}
              >
                <option value="">Select a client</option>
                {getAvailableClients().map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
              <ChevronDown size={16} className="select-chevron" />
            </div>
            {newBillingErrors.clientId && <span className="error-message">{newBillingErrors.clientId}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="new-billing-description">Description <span className="required">*</span></label>
            <input
              type="text"
              id="new-billing-description"
              value={newBillingFormData.description}
              onChange={(e) => handleNewBillingFormChange('description', e.target.value)}
              className={newBillingErrors.description ? 'error' : ''}
              placeholder="e.g., First milestone - 50%"
            />
            {newBillingErrors.description && <span className="error-message">{newBillingErrors.description}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="new-billing-amount">Amount (€) <span className="required">*</span></label>
            <input
              type="text"
              id="new-billing-amount"
              value={newBillingFormData.amount}
              onChange={(e) => handleNewBillingFormChange('amount', e.target.value)}
              className={newBillingErrors.amount ? 'error' : ''}
              placeholder="0,00"
            />
            {newBillingErrors.amount && <span className="error-message">{newBillingErrors.amount}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="new-billing-due-date">Due Date <span className="required">*</span></label>
            <input
              type="text"
              id="new-billing-due-date"
              value={newBillingFormData.dueDate}
              onChange={handleNewBillingDateInput}
              className={newBillingErrors.dueDate ? 'error' : ''}
              placeholder="dd/mm/yyyy"
              maxLength={10}
            />
            {newBillingErrors.dueDate && <span className="error-message">{newBillingErrors.dueDate}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="new-billing-notes">Notes</label>
            <textarea
              id="new-billing-notes"
              value={newBillingFormData.notes}
              onChange={(e) => handleNewBillingFormChange('notes', e.target.value)}
              rows={3}
              placeholder="Add notes..."
            />
          </div>

          <div className="modal-actions">
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={() => {
                setIsNewBillingModalOpen(false)
                setNewBillingFormData({
                  projectId: '',
                  clientId: '',
                  description: '',
                  amount: '',
                  dueDate: '',
                  notes: ''
                })
                setNewBillingErrors({})
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Add Billing Milestone
            </button>
          </div>
        </form>
      </Modal>

    </div>
  )
}

export default Billing
