import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Search, ChevronDown, Calendar, Users, MoreVertical, Clock, Pencil, Trash2, Plus, Edit, FileText, ListTodo, Copy } from 'lucide-react'
import { formatCurrency } from '../utils/formatCurrency'
import Modal from '../components/Modal'
import { useAuth } from '../contexts/AuthContext'
import './Page.css'

interface Project {
  id: string
  title: string
  source: 'proposal' | 'service'
  sourceId: string
  call?: string
  callId?: string
  callYear?: string
  fundingBody?: string
  service?: string
  primaryClients: string[]
  secondaryClients?: string[]
  budgetFunding?: string
  fee?: string
  status: string
  startDate?: string
  endDate?: string
  paymentConditions?: string
  createdAt: string
  billingSchedule?: BillingItem[]
  tasks?: Task[]
}

interface BillingItem {
  id: string
  percentage: string
  clientName: string
  dueDate: string
  amount: string
  invoiceStatus: string
  description?: string
}

interface Task {
  id: string
  title: string
  description?: string
  dueDate: string
  priority?: 'Low' | 'Medium' | 'High'
  status?: 'Pending' | 'In progress' | 'Completed'
}

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
}

interface Service {
  id: string
  title: string
  primaryClient: string
  secondaryClient?: string
  service: string
  fee: string
  status: string
}

interface Customer {
  id: string
  name: string
}

const Projects = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isWorker = user?.role === 'Worker'
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState({
    service: 'All',
    call: 'All',
    status: 'All',
    primaryClient: 'All',
    projectName: 'All'
  })

  // Check for primaryClient filter from URL
  useEffect(() => {
    const primaryClientParam = searchParams.get('primaryClient')
    if (primaryClientParam) {
      setFilters(prev => ({ ...prev, primaryClient: primaryClientParam }))
    }
  }, [searchParams])

  // Load data from localStorage
  const loadProposals = (): Proposal[] => {
    try {
      const saved = localStorage.getItem('proposals')
      return saved ? JSON.parse(saved) : []
    } catch (error) {
      console.error('Error loading proposals:', error)
      return []
    }
  }

  const loadServices = (): Service[] => {
    try {
      const saved = localStorage.getItem('otherServices')
      return saved ? JSON.parse(saved) : []
    } catch (error) {
      console.error('Error loading services:', error)
      return []
    }
  }

  const loadCalls = (): Array<{ id: string; name: string; fundingBody?: string; year?: string }> => {
    try {
      const saved = localStorage.getItem('calls')
      return saved ? JSON.parse(saved) : []
    } catch (error) {
      console.error('Error loading calls:', error)
      return []
    }
  }

  const loadCustomers = (): Customer[] => {
    try {
      const saved = localStorage.getItem('customers')
      return saved ? JSON.parse(saved) : []
    } catch (error) {
      console.error('Error loading customers:', error)
      return []
    }
  }

  const [projects, setProjects] = useState<Project[]>([])
  const [calls] = useState(loadCalls())
  const [customers] = useState(loadCustomers())
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddBillingModalOpen, setIsAddBillingModalOpen] = useState(false)
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false)
  const [isEditTaskModalOpen, setIsEditTaskModalOpen] = useState(false)
  const [isViewTasksModalOpen, setIsViewTasksModalOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [selectedBillingItem, setSelectedBillingItem] = useState<BillingItem | null>(null)
  const [isEditBillingModalOpen, setIsEditBillingModalOpen] = useState(false)
  const [isDeleteProjectModalOpen, setIsDeleteProjectModalOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [editFormData, setEditFormData] = useState({
    title: '',
    status: '',
    startDate: '',
    endDate: '',
    paymentConditions: ''
  })
  const [billingFormData, setBillingFormData] = useState({
    projectId: '',
    clientId: '',
    description: '',
    amount: '',
    dueDate: '',
    notes: ''
  })
  const [editBillingFormData, setEditBillingFormData] = useState({
    clientId: '',
    description: '',
    amount: '',
    dueDate: '',
    notes: ''
  })
  const [billingErrors, setBillingErrors] = useState<Record<string, string>>({})
  const [editBillingErrors, setEditBillingErrors] = useState<Record<string, string>>({})
  const [taskFormData, setTaskFormData] = useState({
    projectId: '',
    title: '',
    description: '',
    dueDate: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High',
    status: 'Pending' as 'Pending' | 'In progress' | 'Completed'
  })
  const [taskErrors, setTaskErrors] = useState<Record<string, string>>({})

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId) {
        const menuElement = document.querySelector(`[data-menu-id="${openMenuId}"]`)
        if (menuElement && !menuElement.contains(event.target as Node)) {
          setOpenMenuId(null)
        }
      }
    }

    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openMenuId])

  const getClientName = (clientId: string) => {
    const client = customers.find(c => c.id === clientId)
    return client ? client.name : clientId
  }

  // Load existing projects or auto-generate from Granted proposals and services
  useEffect(() => {
    const loadProjects = (): Project[] => {
      try {
        const saved = localStorage.getItem('projects')
        return saved ? JSON.parse(saved) : []
      } catch (error) {
        console.error('Error loading projects:', error)
        return []
      }
    }

    const proposals = loadProposals()
    const services = loadServices()
    const existingProjects = loadProjects()
    const existingProjectIds = new Set(existingProjects.map(p => p.id))
    const newProjects: Project[] = []

    // Create projects from Granted proposals that don't exist yet
    proposals
      .filter(p => p.status === 'Granted')
      .forEach(proposal => {
        const projectId = `proposal-${proposal.id}`
        if (!existingProjectIds.has(projectId)) {
          const callData = calls.find(c => c.id === proposal.callId)
          newProjects.push({
            id: projectId,
            title: proposal.proposal,
            source: 'proposal',
            sourceId: proposal.id,
            call: proposal.call,
            callId: proposal.callId,
            callYear: callData?.year || '',
            fundingBody: callData?.fundingBody || '',
            primaryClients: proposal.primaryClients,
            secondaryClients: proposal.secondaryClients,
            budgetFunding: proposal.budgetFunding,
            fee: proposal.fee,
            status: 'Ongoing',
            startDate: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString()
          })
        }
      })

    // Create projects from Granted services that don't exist yet
    services
      .filter(s => s.status === 'Granted')
      .forEach(service => {
        const projectId = `service-${service.id}`
        if (!existingProjectIds.has(projectId)) {
          newProjects.push({
            id: projectId,
            title: service.title,
            source: 'service',
            sourceId: service.id,
            service: service.service,
            primaryClients: [service.primaryClient],
            secondaryClients: service.secondaryClient ? [service.secondaryClient] : undefined,
            fee: service.fee,
            status: 'Ongoing',
            startDate: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString()
          })
        }
      })

    // Merge existing projects with new ones
    const allProjects = [...existingProjects, ...newProjects]

    // Save to localStorage only if there are new projects
    if (newProjects.length > 0) {
      try {
        localStorage.setItem('projects', JSON.stringify(allProjects))
      } catch (error) {
        console.error('Error saving projects:', error)
      }
    }

    setProjects(allProjects)
  }, [])

  // Reload projects when proposals or services change (only add new ones, preserve existing)
  useEffect(() => {
    const handleStorageChange = () => {
      const loadProjects = (): Project[] => {
        try {
          const saved = localStorage.getItem('projects')
          return saved ? JSON.parse(saved) : []
        } catch (error) {
          console.error('Error loading projects:', error)
          return []
        }
      }

      const proposals = loadProposals()
      const services = loadServices()
      const existingProjects = loadProjects()
      const existingProjectIds = new Set(existingProjects.map(p => p.id))
      const newProjects: Project[] = []

      // Create projects from Granted proposals that don't exist yet
      proposals
        .filter(p => p.status === 'Granted')
        .forEach(proposal => {
          const projectId = `proposal-${proposal.id}`
          if (!existingProjectIds.has(projectId)) {
            const callData = calls.find(c => c.id === proposal.callId)
            
            newProjects.push({
              id: projectId,
              title: proposal.proposal,
              source: 'proposal',
              sourceId: proposal.id,
              call: proposal.call,
              callId: proposal.callId,
              callYear: callData?.year || '',
              fundingBody: callData?.fundingBody || '',
              primaryClients: proposal.primaryClients,
              secondaryClients: proposal.secondaryClients,
              budgetFunding: proposal.budgetFunding,
              fee: proposal.fee,
              status: 'Ongoing',
              startDate: new Date().toISOString().split('T')[0],
              billingSchedule: [],
              tasks: [],
              createdAt: new Date().toISOString()
            })
          }
        })

      // Create projects from Granted services that don't exist yet
      services
        .filter(s => s.status === 'Granted')
        .forEach(service => {
          const projectId = `service-${service.id}`
          if (!existingProjectIds.has(projectId)) {
            newProjects.push({
              id: projectId,
              title: service.title,
              source: 'service',
              sourceId: service.id,
              service: service.service,
              primaryClients: [service.primaryClient],
              secondaryClients: service.secondaryClient ? [service.secondaryClient] : undefined,
              fee: service.fee,
              status: 'Ongoing',
              startDate: new Date().toISOString().split('T')[0],
              billingSchedule: [],
              tasks: [],
              createdAt: new Date().toISOString()
            })
          }
        })

      // Merge existing projects with new ones
      const allProjects = [...existingProjects, ...newProjects]

      // Save to localStorage only if there are new projects
      if (newProjects.length > 0) {
        try {
          localStorage.setItem('projects', JSON.stringify(allProjects))
        } catch (error) {
          console.error('Error saving projects:', error)
        }
        setProjects(allProjects)
      } else {
        // Still update state with existing projects in case they were modified elsewhere
        setProjects(existingProjects)
      }
    }

    // Listen for storage events
    window.addEventListener('storage', handleStorageChange)
    
    // Also check periodically (but less frequently to avoid overwriting manual changes)
    const interval = setInterval(handleStorageChange, 5000)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [])


  // Filter projects
  const filteredProjects = projects.filter(project => {
    const allowedProjects = user?.projectIds || []
    const isAllowedForCustomer = !user || user.role !== 'Customer' || (allowedProjects.length > 0 && allowedProjects.includes(project.id))
    if (!isAllowedForCustomer) {
      return false
    }
    const searchLower = searchTerm.toLowerCase()
    
    const primaryClientNames = project.primaryClients.map(id => getClientName(id))
    const secondaryClientNames = project.secondaryClients?.map(id => getClientName(id)) || []
    
    const matchesSearch = !searchTerm || 
      project.title.toLowerCase().includes(searchLower) ||
      (project.call && project.call.toLowerCase().includes(searchLower)) ||
      (project.service && project.service.toLowerCase().includes(searchLower)) ||
      primaryClientNames.some(name => name.toLowerCase().includes(searchLower)) ||
      secondaryClientNames.some(name => name.toLowerCase().includes(searchLower)) ||
      (project.budgetFunding && project.budgetFunding.toLowerCase().includes(searchLower)) ||
      (project.fee && project.fee.toLowerCase().includes(searchLower)) ||
      project.status.toLowerCase().includes(searchLower)

    const matchesService = filters.service === 'All' || 
      (filters.service === 'Proposals' && project.source === 'proposal') ||
      (filters.service !== 'Proposals' && project.service && project.service === filters.service)
    
    const matchesCall = filters.call === 'All' || 
      (project.callId && project.callId === filters.call)
    
    const matchesStatus = filters.status === 'All' || 
      (filters.status === 'Ongoing' && project.status === 'Ongoing') ||
      (filters.status === 'Ended' && project.status === 'Ended')
    
    const matchesPrimaryClient = filters.primaryClient === 'All' || 
      project.primaryClients.includes(filters.primaryClient) ||
      project.secondaryClients?.includes(filters.primaryClient)
    
    const matchesProjectName = filters.projectName === 'All' || 
      project.title === filters.projectName

    return matchesSearch && matchesService && matchesCall && matchesStatus && matchesPrimaryClient && matchesProjectName
  })

  // Get unique services and calls for filters
  const uniqueServices = Array.from(new Set(projects.map(p => p.service).filter(Boolean)))
  const uniqueCalls = calls.filter(call => 
    projects.some(p => p.callId === call.id)
  )
  const uniqueProjectNames = Array.from(new Set(projects.map(p => p.title).filter(Boolean))).sort()

  // Handle Edit Project
  const handleEditProject = (project: Project) => {
    setSelectedProject(project)
    // Convert dates from YYYY-MM-DD to dd/mm/yyyy format
    const formatDateForInput = (dateString?: string) => {
      if (!dateString) return ''
      const date = new Date(dateString)
      const day = date.getDate().toString().padStart(2, '0')
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const year = date.getFullYear()
      return `${day}/${month}/${year}`
    }
    
    setEditFormData({
      title: project.title,
      status: project.status,
      startDate: formatDateForInput(project.startDate),
      endDate: formatDateForInput(project.endDate),
      paymentConditions: project.paymentConditions || ''
    })
    setIsEditModalOpen(true)
  }

  const handleDateInput = (field: 'startDate' | 'endDate') => (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '')
    if (value.length >= 2) value = value.slice(0, 2) + '/' + value.slice(2)
    if (value.length >= 5) value = value.slice(0, 5) + '/' + value.slice(5, 9)
    setEditFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleEditFormChange = (field: string, value: string) => {
    setEditFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSaveProjectChanges = () => {
    if (!selectedProject) return

    // Convert dates from dd/mm/yyyy to YYYY-MM-DD format
    const convertDateToISO = (dateString: string) => {
      if (!dateString) return undefined
      const parts = dateString.split('/')
      if (parts.length === 3) {
        const day = parts[0]
        const month = parts[1]
        const year = parts[2]
        return `${year}-${month}-${day}`
      }
      return undefined
    }

    const updatedProject: Project = {
      ...selectedProject,
      title: editFormData.title,
      status: editFormData.status,
      startDate: convertDateToISO(editFormData.startDate),
      endDate: convertDateToISO(editFormData.endDate),
      paymentConditions: editFormData.paymentConditions
    }

    // Update project in state and save to localStorage
    setProjects(prev => {
      const updated = prev.map(p => p.id === selectedProject.id ? updatedProject : p)
      try {
        localStorage.setItem('projects', JSON.stringify(updated))
      } catch (error) {
        console.error('Error saving project:', error)
      }
      return updated
    })

    setIsEditModalOpen(false)
    setSelectedProject(null)
    setEditFormData({
      title: '',
      status: '',
      startDate: '',
      endDate: '',
      paymentConditions: ''
    })
  }

  // Handle Add Billing
  const handleBillingDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '')
    if (value.length >= 2) value = value.slice(0, 2) + '/' + value.slice(2)
    if (value.length >= 5) value = value.slice(0, 5) + '/' + value.slice(5, 9)
    setBillingFormData(prev => ({ ...prev, dueDate: value }))
  }

  const formatDateForInput = (dateString?: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
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

  const handleBillingFormChange = (field: string, value: string) => {
    setBillingFormData(prev => {
      const updated = { ...prev, [field]: value }
      if (field === 'projectId') {
        updated.clientId = ''
      }
      return updated
    })
    if (billingErrors[field]) {
      setBillingErrors(prev => ({ ...prev, [field]: '' }))
    }
    if (field === 'projectId') {
      const nextProject = projects.find(p => p.id === value) || null
      setSelectedProject(nextProject)
    }
  }

  const handleAddBilling = () => {
    const newErrors: Record<string, string> = {}
    const resolvedProject = selectedProject || projects.find(p => p.id === billingFormData.projectId) || null

    if (!billingFormData.projectId) newErrors.projectId = 'Project is required'
    if (!billingFormData.clientId) newErrors.clientId = 'Client is required'
    if (!billingFormData.description.trim()) newErrors.description = 'Description is required'
    if (!billingFormData.amount.trim()) newErrors.amount = 'Amount is required'
    if (!billingFormData.dueDate.trim()) {
      newErrors.dueDate = 'Due Date is required'
    } else if (!isValidDate(billingFormData.dueDate)) {
      newErrors.dueDate = 'Due Date must be valid (dd/mm/yyyy)'
    }

    // Validate amount is a valid number
    if (billingFormData.amount.trim()) {
      const amountValue = parseFloat(billingFormData.amount.replace(/[^\d.,-]/g, '').replace(',', '.'))
      if (isNaN(amountValue) || amountValue <= 0) {
        newErrors.amount = 'Amount must be a valid positive number'
      }
    }

    setBillingErrors(newErrors)
    if (Object.keys(newErrors).length > 0 || !resolvedProject) return

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

    const amountValue = parseFloat(billingFormData.amount.replace(/[^\d.,-]/g, '').replace(',', '.'))
    const clientName = getClientName(billingFormData.clientId)

    // Calculate percentage based on fee
    const projectFee = parseFloat(resolvedProject.fee?.replace(/[^\d.,-]/g, '').replace(',', '.') || '0')
    const percentage = projectFee > 0 ? ((amountValue / projectFee) * 100).toFixed(0) + '%' : '0%'

    const newBillingItem: BillingItem = {
      id: `billing-${Date.now()}`,
      percentage: percentage,
      clientName: clientName,
      dueDate: convertDateToISO(billingFormData.dueDate),
      amount: amountValue.toFixed(2),
      invoiceStatus: 'Invoice_pending',
      description: billingFormData.description.trim() || undefined
    }

    const updatedBillingSchedule = [
      ...(resolvedProject.billingSchedule || []),
      newBillingItem
    ]

    const updatedProject: Project = {
      ...resolvedProject,
      billingSchedule: updatedBillingSchedule
    }

    // Update project in state and save to localStorage
    setProjects(prev => {
      const updated = prev.map(p => p.id === resolvedProject.id ? updatedProject : p)
      try {
        localStorage.setItem('projects', JSON.stringify(updated))
      } catch (error) {
        console.error('Error saving billing:', error)
      }
      return updated
    })

    // Reset form
    setBillingFormData({
      projectId: '',
      clientId: '',
      description: '',
      amount: '',
      dueDate: '',
      notes: ''
    })
    setBillingErrors({})
    setIsAddBillingModalOpen(false)
    setSelectedProject(null)
  }

  const handleDuplicateBilling = (project: Project, billing: BillingItem) => {
    const clientId = [
      ...project.primaryClients,
      ...(project.secondaryClients || [])
    ].find(id => getClientName(id) === billing.clientName) || project.primaryClients[0] || ''

    setSelectedProject(project)
    setBillingFormData({
      projectId: project.id,
      clientId,
      description: billing.description || '',
      amount: billing.amount,
      dueDate: formatDateForInput(billing.dueDate),
      notes: ''
    })
    setBillingErrors({})
    setIsAddBillingModalOpen(true)
  }

  // Handle Edit Billing
  const handleEditBilling = (project: Project, billingItem: BillingItem) => {
    setSelectedProject(project)
    setSelectedBillingItem(billingItem)
    
    // Find client ID from name
    const clientId = [
      ...project.primaryClients,
      ...(project.secondaryClients || [])
    ].find(id => getClientName(id) === billingItem.clientName) || project.primaryClients[0] || ''

    // Extract amount value
    const amountValue = parseFloat(billingItem.amount.replace(/[^\d.,-]/g, '').replace(',', '.') || '0')
    
    setEditBillingFormData({
      clientId: clientId,
      description: billingItem.description || '', // Use description field from billing item
      amount: amountValue.toFixed(2).replace('.', ','),
      dueDate: formatDateForInput(billingItem.dueDate),
      notes: ''
    })
    setEditBillingErrors({})
    setIsEditBillingModalOpen(true)
  }

  const handleEditBillingDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '')
    if (value.length >= 2) value = value.slice(0, 2) + '/' + value.slice(2)
    if (value.length >= 5) value = value.slice(0, 5) + '/' + value.slice(5, 9)
    setEditBillingFormData(prev => ({ ...prev, dueDate: value }))
  }

  const handleEditBillingFormChange = (field: string, value: string) => {
    setEditBillingFormData(prev => ({ ...prev, [field]: value }))
    if (editBillingErrors[field]) {
      setEditBillingErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleSaveBillingChanges = () => {
    if (!selectedProject || !selectedBillingItem) return

    const newErrors: Record<string, string> = {}
    
    if (!editBillingFormData.clientId) newErrors.clientId = 'Client is required'
    if (!editBillingFormData.description.trim()) newErrors.description = 'Description is required'
    if (!editBillingFormData.amount.trim()) newErrors.amount = 'Amount is required'
    if (!editBillingFormData.dueDate.trim()) {
      newErrors.dueDate = 'Due Date is required'
    } else if (!isValidDate(editBillingFormData.dueDate)) {
      newErrors.dueDate = 'Due Date must be valid (dd/mm/yyyy)'
    }

    // Validate amount is a valid number
    if (editBillingFormData.amount.trim()) {
      const amountValue = parseFloat(editBillingFormData.amount.replace(/[^\d.,-]/g, '').replace(',', '.'))
      if (isNaN(amountValue) || amountValue <= 0) {
        newErrors.amount = 'Amount must be a valid positive number'
      }
    }

    setEditBillingErrors(newErrors)
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

    const amountValue = parseFloat(editBillingFormData.amount.replace(/[^\d.,-]/g, '').replace(',', '.'))
    const clientName = getClientName(editBillingFormData.clientId)

    // Calculate percentage based on fee
    const projectFee = parseFloat(selectedProject.fee?.replace(/[^\d.,-]/g, '').replace(',', '.') || '0')
    const percentage = projectFee > 0 ? ((amountValue / projectFee) * 100).toFixed(0) + '%' : '0%'

    const updatedBillingItem: BillingItem = {
      ...selectedBillingItem,
      percentage: percentage,
      clientName: clientName,
      dueDate: convertDateToISO(editBillingFormData.dueDate),
      amount: amountValue.toFixed(2),
      description: editBillingFormData.description.trim() || undefined
    }

    const updatedBillingSchedule = selectedProject.billingSchedule?.map(billing => 
      billing.id === selectedBillingItem.id ? updatedBillingItem : billing
    ) || []

    const updatedProject: Project = {
      ...selectedProject,
      billingSchedule: updatedBillingSchedule
    }

    // Update project in state and save to localStorage
    setProjects(prev => {
      const updated = prev.map(p => p.id === selectedProject.id ? updatedProject : p)
      try {
        localStorage.setItem('projects', JSON.stringify(updated))
      } catch (error) {
        console.error('Error saving billing:', error)
      }
      return updated
    })

    setIsEditBillingModalOpen(false)
    setSelectedProject(null)
    setSelectedBillingItem(null)
    setEditBillingFormData({
      clientId: '',
      description: '',
      amount: '',
      dueDate: '',
      notes: ''
    })
    setEditBillingErrors({})
  }

  // Handle Delete Billing
  const handleDeleteBilling = (_project: Project, _billingItemId: string) => {
    window.alert('La eliminación está desactivada para conservar el histórico de billing.')
  }

  const handleDeleteProject = () => {
    window.alert('La eliminación está desactivada para conservar el histórico de proyectos.')
    setIsDeleteProjectModalOpen(false)
    setProjectToDelete(null)
  }

  // Handle Add Task
  const handleTaskDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '')
    if (value.length >= 2) value = value.slice(0, 2) + '/' + value.slice(2)
    if (value.length >= 5) value = value.slice(0, 5) + '/' + value.slice(5, 9)
    setTaskFormData(prev => ({ ...prev, dueDate: value }))
  }

  const handleTaskFormChange = (field: string, value: string) => {
    setTaskFormData(prev => ({ ...prev, [field]: value }))
    if (taskErrors[field]) {
      setTaskErrors(prev => ({ ...prev, [field]: '' }))
    }
    if (field === 'projectId') {
      const nextProject = projects.find(p => p.id === value) || null
      setSelectedProject(nextProject)
    }
  }

  const handleAddTask = () => {
    const newErrors: Record<string, string> = {}
    const resolvedProject = selectedProject || projects.find(p => p.id === taskFormData.projectId) || null

    if (!taskFormData.projectId) newErrors.projectId = 'Project is required'
    if (!taskFormData.title.trim()) newErrors.title = 'Task Title is required'
    if (!taskFormData.dueDate.trim()) {
      newErrors.dueDate = 'Due Date is required'
    } else if (!isValidDate(taskFormData.dueDate)) {
      newErrors.dueDate = 'Due Date must be valid (dd/mm/yyyy)'
    }

    setTaskErrors(newErrors)
    if (Object.keys(newErrors).length > 0 || !resolvedProject) return

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

    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: taskFormData.title.trim(),
      description: taskFormData.description.trim() || undefined,
      dueDate: convertDateToISO(taskFormData.dueDate),
      priority: taskFormData.priority,
      status: taskFormData.status
    }

    const updatedTasks = [
      ...(resolvedProject.tasks || []),
      newTask
    ]

    const updatedProject: Project = {
      ...resolvedProject,
      tasks: updatedTasks
    }

    // Update project in state and save to localStorage
    setProjects(prev => {
      const updated = prev.map(p => p.id === resolvedProject.id ? updatedProject : p)
      try {
        localStorage.setItem('projects', JSON.stringify(updated))
      } catch (error) {
        console.error('Error saving task:', error)
      }
      return updated
    })

    // Reset form
    setTaskFormData({
      projectId: '',
      title: '',
      description: '',
      dueDate: '',
      priority: 'Medium',
      status: 'Pending'
    })
    setTaskErrors({})
    setIsAddTaskModalOpen(false)
    setSelectedProject(null)
  }

  const handleDuplicateTask = (project: Project, task: Task) => {
    setSelectedProject(project)
    setTaskFormData({
      projectId: project.id,
      title: task.title,
      description: task.description || '',
      dueDate: formatDateForInput(task.dueDate),
      priority: task.priority || 'Medium',
      status: task.status || 'Pending'
    })
    setTaskErrors({})
    setIsAddTaskModalOpen(true)
  }

  // Handle Edit Task
  const handleEditTask = (project: Project, task: Task) => {
    setSelectedProject(project)
    setSelectedTask(task)
    
    setTaskFormData({
      projectId: project.id,
      title: task.title,
      description: task.description || '',
      dueDate: formatDateForInput(task.dueDate),
      priority: task.priority || 'Medium',
      status: task.status || 'Pending'
    })
    setTaskErrors({})
    setIsEditTaskModalOpen(true)
  }

  const handleSaveTaskChanges = () => {
    if (!selectedProject || !selectedTask) return

    const newErrors: Record<string, string> = {}
    
    if (!taskFormData.title.trim()) newErrors.title = 'Task Title is required'
    if (!taskFormData.dueDate.trim()) {
      newErrors.dueDate = 'Due Date is required'
    } else if (!isValidDate(taskFormData.dueDate)) {
      newErrors.dueDate = 'Due Date must be valid (dd/mm/yyyy)'
    }

    setTaskErrors(newErrors)
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

    const updatedTask: Task = {
      ...selectedTask,
      title: taskFormData.title.trim(),
      description: taskFormData.description.trim() || undefined,
      dueDate: convertDateToISO(taskFormData.dueDate),
      priority: taskFormData.priority,
      status: taskFormData.status
    }

    const updatedTasks = selectedProject.tasks?.map(t => 
      t.id === selectedTask.id ? updatedTask : t
    ) || []

    const updatedProject: Project = {
      ...selectedProject,
      tasks: updatedTasks
    }

    // Update project in state and save to localStorage
    setProjects(prev => {
      const updated = prev.map(p => p.id === selectedProject.id ? updatedProject : p)
      try {
        localStorage.setItem('projects', JSON.stringify(updated))
      } catch (error) {
        console.error('Error saving task:', error)
      }
      return updated
    })

    setIsEditTaskModalOpen(false)
    setSelectedProject(null)
    setSelectedTask(null)
    setTaskFormData({
      projectId: '',
      title: '',
      description: '',
      dueDate: '',
      priority: 'Medium',
      status: 'Pending'
    })
    setTaskErrors({})
  }

  // Handle Delete Task
  const handleDeleteTask = (_project: Project, _taskId: string) => {
    window.alert('La eliminación está desactivada para conservar el histórico de tareas.')
  }

  // Get date color based on due date and status
  const getTaskDateColor = (dueDate: string, status?: string) => {
    if (!dueDate) return '#64748b' // Default gray
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const taskDate = new Date(dueDate)
    taskDate.setHours(0, 0, 0, 0)
    
    const isOverdue = taskDate < today
    
    if (!isOverdue) {
      return '#27AE60' // Green - not overdue
    } else {
      if (status === 'Pending') {
        return '#ef4444' // Red - overdue and pending
      } else if (status === 'In progress') {
        return '#f59e0b' // Yellow - overdue but in progress
      } else {
        return '#64748b' // Gray - completed or other status
      }
    }
  }

  // Get task dot color based on priority
  const getTaskDotColor = (priority?: string) => {
    switch (priority) {
      case 'Low':
        return '#64748b' // Gray
      case 'Medium':
        return '#8E44AD' // Purple
      case 'High':
        return '#E91E63' // Fuchsia/Pink
      default:
        return '#8E44AD' // Default to purple (Medium)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Projects</h1>
          <p className="page-subtitle">Running projects from granted proposals and services</p>
        </div>
      </div>

      <div className="customers-toolbar">
        <div className="search-bar-inline">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input-inline"
          />
        </div>

        <div className="filter-buttons">
          <div className="filter-button-group">
            <div className="select-wrapper" style={{ position: 'relative' }}>
              <select
                value={filters.projectName}
                onChange={(e) => setFilters(prev => ({ ...prev, projectName: e.target.value }))}
                className={`filter-btn ${filters.projectName !== 'All' ? 'active' : ''}`}
                style={{ appearance: 'none', paddingRight: '2rem', cursor: 'pointer' }}
              >
                <option value="All">All Projects</option>
                {uniqueProjectNames.map(projectName => (
                  <option key={projectName} value={projectName}>{projectName}</option>
                ))}
              </select>
              <ChevronDown size={16} className="select-chevron" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
            <div className="select-wrapper" style={{ position: 'relative' }}>
              <select
                value={filters.service}
                onChange={(e) => setFilters(prev => ({ ...prev, service: e.target.value }))}
                className={`filter-btn ${filters.service !== 'All' ? 'active' : ''}`}
                style={{ appearance: 'none', paddingRight: '2rem', cursor: 'pointer' }}
              >
                <option value="All">All Services</option>
                <option value="Proposals">Proposals</option>
                {uniqueServices.map(service => (
                  <option key={service} value={service}>{service}</option>
                ))}
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
                {uniqueCalls.map(call => (
                  <option key={call.id} value={call.id}>{call.name}</option>
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
                <option value="Ongoing">Ongoing</option>
                <option value="Ended">Ended</option>
              </select>
              <ChevronDown size={16} className="select-chevron" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          </div>
        </div>
      </div>

      <div className="content-section">
        {filteredProjects.length === 0 ? (
          <div className="empty-row" style={{ padding: '3rem', textAlign: 'center' }}>
            {searchTerm || filters.service !== 'All' || filters.call !== 'All' || filters.status !== 'All' || filters.projectName !== 'All'
              ? 'No projects match your filters' 
              : 'No projects found. Projects are automatically created from Granted proposals and services.'}
          </div>
        ) : (
          <div className="projects-grid">
            {filteredProjects.map(project => {
              const formatDate = (dateString: string) => {
                if (!dateString) return ''
                const date = new Date(dateString)
                const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
                const day = date.getDate()
                const month = months[date.getMonth()]
                const year = date.getFullYear()
                return `${day} ${month} ${year}`
              }

              const projectIdentifier = project.callYear && project.fundingBody 
                ? `${project.call} ${project.callYear} - ${project.fundingBody}`
                : project.call || project.service || ''

              const totalClients = project.primaryClients.length + (project.secondaryClients?.length || 0)
              const totalPartners = 1 // Default, can be enhanced later

              return (
                <div key={project.id} className="project-card">
                  <div className="project-card-header">
                    <div className="project-header-left">
                      <h3 className="project-title">{project.title}</h3>
                      {projectIdentifier && (
                        <div className="project-identifier">{projectIdentifier}</div>
                      )}
                      <div className="project-meta-row">
                        {project.startDate && (
                          <div className="project-meta-item">
                            <Calendar size={16} />
                            <span>{formatDate(project.startDate)} - {project.status}</span>
                          </div>
                        )}
                        <div className="project-meta-item">
                          <Users size={16} />
                          <span>{totalClients} clients, {totalPartners} partners</span>
                        </div>
                      </div>
                    </div>
                    <div className="project-header-right">
                      <span className={`status-badge status-${project.status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {project.status}
                      </span>
                      {project.budgetFunding && (
                        <div className="project-amount">{formatCurrency(project.budgetFunding)}</div>
                      )}
                      {project.fee && (
                        <div className="project-fee">Fee: {formatCurrency(project.fee)}</div>
                      )}
                      <div 
                        className="actions-menu-container" 
                        data-menu-id={project.id}
                        style={{ position: 'relative' }}
                      >
                        <button 
                          className="project-menu-btn" 
                          type="button"
                          onClick={() => setOpenMenuId(openMenuId === project.id ? null : project.id)}
                        >
                          <MoreVertical size={20} />
                        </button>
                        {openMenuId === project.id && (
                          <div className="actions-menu-dropdown" style={{ right: 0, top: '100%', marginTop: '0.5rem' }}>
                            <button 
                              className="actions-menu-item" 
                              onClick={() => {
                                handleEditProject(project)
                                setOpenMenuId(null)
                              }}
                            >
                              <Edit size={16} />
                              <span>Edit Project</span>
                            </button>
                            <button 
                              className="actions-menu-item" 
                              onClick={() => {
                                setSelectedProject(project)
                                setBillingFormData({
                                  projectId: project.id,
                                  clientId: '',
                                  description: '',
                                  amount: '',
                                  dueDate: '',
                                  notes: ''
                                })
                                setBillingErrors({})
                                setIsAddBillingModalOpen(true)
                                setOpenMenuId(null)
                              }}
                            >
                              <FileText size={16} />
                              <span>Add Billing</span>
                            </button>
                            <button 
                              className="actions-menu-item" 
                              onClick={() => {
                                setSelectedProject(project)
                                setTaskFormData({
                                  projectId: project.id,
                                  title: '',
                                  description: '',
                                  dueDate: '',
                                  priority: 'Medium',
                                  status: 'Pending'
                                })
                                setTaskErrors({})
                                setIsAddTaskModalOpen(true)
                                setOpenMenuId(null)
                              }}
                            >
                              <Plus size={16} />
                              <span>Add Task</span>
                            </button>
                            <button 
                              className="actions-menu-item" 
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setOpenMenuId(null)
                                navigate(`/tasks?project=${project.id}`)
                              }}
                            >
                              <ListTodo size={16} />
                              <span>View Tasks</span>
                            </button>
                            {!isWorker && (
                              <button 
                                className="actions-menu-item" 
                                onClick={() => {
                                  setProjectToDelete(project)
                                  setIsDeleteProjectModalOpen(true)
                                  setOpenMenuId(null)
                                }}
                                style={{ color: '#F44336' }}
                              >
                                <Trash2 size={16} />
                                <span>Delete</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {project.billingSchedule && project.billingSchedule.length > 0 && (
                    <div className="project-section">
                      <h4 className="project-section-title">Billing Schedule</h4>
                      {project.billingSchedule.map(billing => (
                        <div key={billing.id} className="billing-item">
                          <div className="billing-left">
                            <div className="billing-percentage">{billing.percentage} payment</div>
                            <div className="billing-client">
                              {billing.clientName} - Due: {formatDate(billing.dueDate)}
                            </div>
                          </div>
                          <div className="billing-right">
                            <div className="billing-amount">{formatCurrency(billing.amount)}</div>
                            <span className={`invoice-status invoice-${billing.invoiceStatus.toLowerCase().replace(/_/g, '-')}`}>
                              <Clock size={14} />
                              {billing.invoiceStatus}
                            </span>
                          <button
                            className="billing-action-btn"
                            type="button"
                            title="Duplicate"
                            onClick={() => handleDuplicateBilling(project, billing)}
                          >
                            <Copy size={16} />
                          </button>
                            <button 
                              className="billing-action-btn" 
                              type="button" 
                              title="Edit"
                              onClick={() => handleEditBilling(project, billing)}
                            >
                              <Pencil size={16} />
                            </button>
                            <button 
                              className="billing-action-btn" 
                              type="button" 
                              title="Delete"
                              onClick={() => handleDeleteBilling(project, billing.id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {(() => {
                        const projectFee = parseFloat(project.fee?.replace(/[^\d.,-]/g, '').replace(',', '.') || '0')
                        const totalBilling = project.billingSchedule.reduce((sum, billing) => {
                          const amount = parseFloat(billing.amount.replace(/[^\d.,-]/g, '').replace(',', '.') || '0')
                          return sum + amount
                        }, 0)
                        
                        // Check if totals match (with small tolerance for floating point comparison)
                        const tolerance = 0.01
                        const isEqual = Math.abs(totalBilling - projectFee) < tolerance
                        
                        if (projectFee > 0) {
                          if (totalBilling > projectFee) {
                            // Overpassed fee - red warning
                            return (
                              <div className="billing-warning" style={{
                                marginTop: '1rem',
                                padding: '0.75rem',
                                backgroundColor: '#fef2f2',
                                border: '1px solid #fecaca',
                                borderRadius: '0.5rem',
                                color: '#dc2626',
                                fontSize: '0.875rem',
                                fontWeight: '500'
                              }}>
                                Overpassed agreed fee
                              </div>
                            )
                          } else if (isEqual) {
                            // Successfully planned - green message
                            return (
                              <div style={{
                                marginTop: '1rem',
                                padding: '0.75rem',
                                backgroundColor: '#f0fdf4',
                                border: '1px solid #86efac',
                                borderRadius: '0.5rem',
                                color: '#166534',
                                fontSize: '0.875rem',
                                fontWeight: '500'
                              }}>
                                Billing Schedule Successfully Planned
                              </div>
                            )
                          } else {
                            // Outstanding billing milestones - yellow message
                            return (
                              <div style={{
                                marginTop: '1rem',
                                padding: '0.75rem',
                                backgroundColor: '#fefce8',
                                border: '1px solid #fde047',
                                borderRadius: '0.5rem',
                                color: '#854d0e',
                                fontSize: '0.875rem',
                                fontWeight: '500'
                              }}>
                                Outstanding billing milestones
                              </div>
                            )
                          }
                        }
                        return null
                      })()}
                    </div>
                  )}

                  {project.tasks && project.tasks.length > 0 && (
                    <div className="project-section">
                      <div className="project-section-header">
                        <h4 className="project-section-title">Upcoming Tasks</h4>
                        <button 
                          className="add-task-btn" 
                          type="button"
                          onClick={() => {
                            setSelectedProject(project)
                            setTaskFormData({
                              projectId: project.id,
                              title: '',
                              description: '',
                              dueDate: '',
                              priority: 'Medium',
                              status: 'Pending'
                            })
                            setTaskErrors({})
                            setIsAddTaskModalOpen(true)
                          }}
                        >
                          <Plus size={16} />
                          Add Task
                        </button>
                      </div>
                      {project.tasks.map(task => (
                        <div key={task.id} className="task-item">
                          <div 
                            className="task-dot" 
                            style={{ backgroundColor: getTaskDotColor(task.priority) }}
                          ></div>
                          <div className="task-content">
                            <span className="task-description">{task.title || task.description}</span>
                            <span 
                              className="task-date" 
                              style={{ color: getTaskDateColor(task.dueDate, task.status) }}
                            >
                              {formatDate(task.dueDate)}
                            </span>
                          </div>
                          <div className="task-actions">
                            <button
                              className="task-action-btn"
                              type="button"
                              title="Duplicate"
                              onClick={() => handleDuplicateTask(project, task)}
                            >
                              <Copy size={16} />
                            </button>
                            <button 
                              className="task-action-btn" 
                              type="button" 
                              title="Edit"
                              onClick={() => handleEditTask(project, task)}
                            >
                              <Pencil size={16} />
                            </button>
                            <button 
                              className="task-action-btn" 
                              type="button" 
                              title="Delete"
                              onClick={() => handleDeleteTask(project, task.id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Edit Project Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedProject(null)
          setEditFormData({
            title: '',
            status: '',
            startDate: '',
            endDate: '',
            paymentConditions: ''
          })
        }}
        title="Edit Project"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSaveProjectChanges(); }} className="modal-form">
          <div className="form-group">
            <label htmlFor="edit-project-name">Project Name</label>
            <input
              type="text"
              id="edit-project-name"
              value={editFormData.title}
              onChange={(e) => handleEditFormChange('title', e.target.value)}
              placeholder="Enter project name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-project-status">Status</label>
            <div className="select-wrapper">
              <select
                id="edit-project-status"
                value={editFormData.status}
                onChange={(e) => handleEditFormChange('status', e.target.value)}
              >
                <option value="">Select status</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Ended">Ended</option>
              </select>
              <ChevronDown size={16} className="select-chevron" />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="edit-start-date">Start Date</label>
            <input
              type="text"
              id="edit-start-date"
              value={editFormData.startDate}
              onChange={handleDateInput('startDate')}
              placeholder="dd/mm/yyyy"
              maxLength={10}
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-end-date">End Date</label>
            <input
              type="text"
              id="edit-end-date"
              value={editFormData.endDate}
              onChange={handleDateInput('endDate')}
              placeholder="dd/mm/yyyy"
              maxLength={10}
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-payment-conditions">Payment Conditions</label>
            <textarea
              id="edit-payment-conditions"
              value={editFormData.paymentConditions}
              onChange={(e) => handleEditFormChange('paymentConditions', e.target.value)}
              rows={4}
              placeholder="Enter payment conditions..."
            />
          </div>

          <div className="modal-actions">
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={() => {
                setIsEditModalOpen(false)
                setSelectedProject(null)
                setEditFormData({
                  title: '',
                  status: '',
                  startDate: '',
                  endDate: '',
                  paymentConditions: ''
                })
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

      {/* Add Billing Modal */}
      <Modal
        isOpen={isAddBillingModalOpen}
        onClose={() => {
          setIsAddBillingModalOpen(false)
          setSelectedProject(null)
          setBillingFormData({
            projectId: '',
            clientId: '',
            description: '',
            amount: '',
            dueDate: '',
            notes: ''
          })
          setBillingErrors({})
        }}
        title="Add Billing Milestone"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleAddBilling(); }} className="modal-form">
          <div className="form-group">
            <label htmlFor="billing-project">Associated Project <span className="required">*</span></label>
            <div className="select-wrapper">
              <select
                id="billing-project"
                value={billingFormData.projectId}
                onChange={(e) => handleBillingFormChange('projectId', e.target.value)}
                className={billingErrors.projectId ? 'error' : ''}
              >
                <option value="">Select a project</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>{project.title}</option>
                ))}
              </select>
              <ChevronDown size={16} className="select-chevron" />
            </div>
            {billingErrors.projectId && <span className="error-message">{billingErrors.projectId}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="billing-client">Client <span className="required">*</span></label>
            <div className="select-wrapper">
              <select
                id="billing-client"
                value={billingFormData.clientId}
                onChange={(e) => handleBillingFormChange('clientId', e.target.value)}
                className={billingErrors.clientId ? 'error' : ''}
              >
                <option value="">Select a client</option>
                {selectedProject && [
                  ...selectedProject.primaryClients,
                  ...(selectedProject.secondaryClients || [])
                ].map(clientId => (
                  <option key={clientId} value={clientId}>{getClientName(clientId)}</option>
                ))}
              </select>
              <ChevronDown size={16} className="select-chevron" />
            </div>
            {billingErrors.clientId && <span className="error-message">{billingErrors.clientId}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="billing-description">Description <span className="required">*</span></label>
            <input
              type="text"
              id="billing-description"
              value={billingFormData.description}
              onChange={(e) => handleBillingFormChange('description', e.target.value)}
              className={billingErrors.description ? 'error' : ''}
              placeholder="e.g., First milestone - 50%"
            />
            {billingErrors.description && <span className="error-message">{billingErrors.description}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="billing-amount">Amount (€) <span className="required">*</span></label>
            <input
              type="text"
              id="billing-amount"
              value={billingFormData.amount}
              onChange={(e) => handleBillingFormChange('amount', e.target.value)}
              className={billingErrors.amount ? 'error' : ''}
              placeholder="0,00"
            />
            {billingErrors.amount && <span className="error-message">{billingErrors.amount}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="billing-due-date">Due Date <span className="required">*</span></label>
            <input
              type="text"
              id="billing-due-date"
              value={billingFormData.dueDate}
              onChange={handleBillingDateInput}
              className={billingErrors.dueDate ? 'error' : ''}
              placeholder="dd/mm/yyyy"
              maxLength={10}
            />
            {billingErrors.dueDate && <span className="error-message">{billingErrors.dueDate}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="billing-notes">Notes</label>
            <textarea
              id="billing-notes"
              value={billingFormData.notes}
              onChange={(e) => handleBillingFormChange('notes', e.target.value)}
              rows={3}
              placeholder="Add notes..."
            />
          </div>

          <div className="modal-actions">
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={() => {
                setIsAddBillingModalOpen(false)
                setSelectedProject(null)
                setBillingFormData({
                    projectId: '',
                  clientId: '',
                  description: '',
                  amount: '',
                  dueDate: '',
                  notes: ''
                })
                setBillingErrors({})
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Add Billing
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Task Modal */}
      <Modal
        isOpen={isAddTaskModalOpen}
        onClose={() => {
          setIsAddTaskModalOpen(false)
          setSelectedProject(null)
          setTaskFormData({
            projectId: '',
            title: '',
            description: '',
            dueDate: '',
            priority: 'Medium',
            status: 'Pending'
          })
          setTaskErrors({})
        }}
        title="Add Task"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleAddTask(); }} className="modal-form">
          <div className="form-group">
            <label htmlFor="task-project">Associated Project <span className="required">*</span></label>
            <div className="select-wrapper">
              <select
                id="task-project"
                value={taskFormData.projectId}
                onChange={(e) => handleTaskFormChange('projectId', e.target.value)}
                className={taskErrors.projectId ? 'error' : ''}
              >
                <option value="">Select a project</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>{project.title}</option>
                ))}
              </select>
              <ChevronDown size={16} className="select-chevron" />
            </div>
            {taskErrors.projectId && <span className="error-message">{taskErrors.projectId}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="task-title">Task Title <span className="required">*</span></label>
            <input
              type="text"
              id="task-title"
              value={taskFormData.title}
              onChange={(e) => handleTaskFormChange('title', e.target.value)}
              className={taskErrors.title ? 'error' : ''}
              placeholder="e.g., Submit first report"
            />
            {taskErrors.title && <span className="error-message">{taskErrors.title}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="task-description">Description</label>
            <textarea
              id="task-description"
              value={taskFormData.description}
              onChange={(e) => handleTaskFormChange('description', e.target.value)}
              rows={4}
              placeholder="Task details..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="task-due-date">Due Date <span className="required">*</span></label>
            <input
              type="text"
              id="task-due-date"
              value={taskFormData.dueDate}
              onChange={handleTaskDateInput}
              className={taskErrors.dueDate ? 'error' : ''}
              placeholder="dd/mm/yyyy"
              maxLength={10}
            />
            {taskErrors.dueDate && <span className="error-message">{taskErrors.dueDate}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="task-priority">Priority</label>
            <div className="select-wrapper">
              <select
                id="task-priority"
                value={taskFormData.priority}
                onChange={(e) => handleTaskFormChange('priority', e.target.value as 'Low' | 'Medium' | 'High')}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
              <ChevronDown size={16} className="select-chevron" />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="task-status">Status</label>
            <div className="select-wrapper">
              <select
                id="task-status"
                value={taskFormData.status}
                onChange={(e) => handleTaskFormChange('status', e.target.value as 'Pending' | 'In progress' | 'Completed')}
              >
                <option value="Pending">Pending</option>
                <option value="In progress">In progress</option>
                <option value="Completed">Completed</option>
              </select>
              <ChevronDown size={16} className="select-chevron" />
            </div>
          </div>

          <div className="modal-actions">
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={() => {
                setIsAddTaskModalOpen(false)
                setSelectedProject(null)
                setTaskFormData({
                  projectId: '',
                  title: '',
                  description: '',
                  dueDate: '',
                  priority: 'Medium',
                  status: 'Pending'
                })
                setTaskErrors({})
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Add Task
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Billing Modal */}
      <Modal
        isOpen={isEditBillingModalOpen}
        onClose={() => {
          setIsEditBillingModalOpen(false)
          setSelectedProject(null)
          setSelectedBillingItem(null)
          setEditBillingFormData({
            clientId: '',
            description: '',
            amount: '',
            dueDate: '',
            notes: ''
          })
          setEditBillingErrors({})
        }}
        title="Edit Billing Milestone"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSaveBillingChanges(); }} className="modal-form">
          <div className="form-group">
            <label htmlFor="edit-billing-client">Client <span className="required">*</span></label>
            <div className="select-wrapper">
              <select
                id="edit-billing-client"
                value={editBillingFormData.clientId}
                onChange={(e) => handleEditBillingFormChange('clientId', e.target.value)}
                className={editBillingErrors.clientId ? 'error' : ''}
              >
                <option value="">Select a client</option>
                {selectedProject && [
                  ...selectedProject.primaryClients,
                  ...(selectedProject.secondaryClients || [])
                ].map(clientId => (
                  <option key={clientId} value={clientId}>{getClientName(clientId)}</option>
                ))}
              </select>
              <ChevronDown size={16} className="select-chevron" />
            </div>
            {editBillingErrors.clientId && <span className="error-message">{editBillingErrors.clientId}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="edit-billing-description">Description <span className="required">*</span></label>
            <input
              type="text"
              id="edit-billing-description"
              value={editBillingFormData.description}
              onChange={(e) => handleEditBillingFormChange('description', e.target.value)}
              className={editBillingErrors.description ? 'error' : ''}
              placeholder="e.g., First milestone - 50%"
            />
            {editBillingErrors.description && <span className="error-message">{editBillingErrors.description}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="edit-billing-amount">Amount (€) <span className="required">*</span></label>
            <input
              type="text"
              id="edit-billing-amount"
              value={editBillingFormData.amount}
              onChange={(e) => handleEditBillingFormChange('amount', e.target.value)}
              className={editBillingErrors.amount ? 'error' : ''}
              placeholder="0,00"
            />
            {editBillingErrors.amount && <span className="error-message">{editBillingErrors.amount}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="edit-billing-due-date">Due Date <span className="required">*</span></label>
            <input
              type="text"
              id="edit-billing-due-date"
              value={editBillingFormData.dueDate}
              onChange={handleEditBillingDateInput}
              className={editBillingErrors.dueDate ? 'error' : ''}
              placeholder="dd/mm/yyyy"
              maxLength={10}
            />
            {editBillingErrors.dueDate && <span className="error-message">{editBillingErrors.dueDate}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="edit-billing-notes">Notes</label>
            <textarea
              id="edit-billing-notes"
              value={editBillingFormData.notes}
              onChange={(e) => handleEditBillingFormChange('notes', e.target.value)}
              rows={3}
              placeholder="Add notes..."
            />
          </div>

          <div className="modal-actions">
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={() => {
                setIsEditBillingModalOpen(false)
                setSelectedProject(null)
                setSelectedBillingItem(null)
                setEditBillingFormData({
                  clientId: '',
                  description: '',
                  amount: '',
                  dueDate: '',
                  notes: ''
                })
                setEditBillingErrors({})
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

      {/* Edit Task Modal */}
      <Modal
        isOpen={isEditTaskModalOpen}
        onClose={() => {
          setIsEditTaskModalOpen(false)
          setSelectedProject(null)
          setSelectedTask(null)
          setTaskFormData({
            projectId: '',
            title: '',
            description: '',
            dueDate: '',
            priority: 'Medium',
            status: 'Pending'
          })
          setTaskErrors({})
        }}
        title="Edit Task"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSaveTaskChanges(); }} className="modal-form">
          <div className="form-group">
            <label htmlFor="edit-task-title">Task Title <span className="required">*</span></label>
            <input
              type="text"
              id="edit-task-title"
              value={taskFormData.title}
              onChange={(e) => handleTaskFormChange('title', e.target.value)}
              className={taskErrors.title ? 'error' : ''}
              placeholder="e.g., Submit first report"
            />
            {taskErrors.title && <span className="error-message">{taskErrors.title}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="edit-task-description">Description</label>
            <textarea
              id="edit-task-description"
              value={taskFormData.description}
              onChange={(e) => handleTaskFormChange('description', e.target.value)}
              rows={4}
              placeholder="Task details..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-task-due-date">Due Date <span className="required">*</span></label>
            <input
              type="text"
              id="edit-task-due-date"
              value={taskFormData.dueDate}
              onChange={handleTaskDateInput}
              className={taskErrors.dueDate ? 'error' : ''}
              placeholder="dd/mm/yyyy"
              maxLength={10}
            />
            {taskErrors.dueDate && <span className="error-message">{taskErrors.dueDate}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="edit-task-priority">Priority</label>
            <div className="select-wrapper">
              <select
                id="edit-task-priority"
                value={taskFormData.priority}
                onChange={(e) => handleTaskFormChange('priority', e.target.value as 'Low' | 'Medium' | 'High')}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
              <ChevronDown size={16} className="select-chevron" />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="edit-task-status">Status</label>
            <div className="select-wrapper">
              <select
                id="edit-task-status"
                value={taskFormData.status}
                onChange={(e) => handleTaskFormChange('status', e.target.value as 'Pending' | 'In progress' | 'Completed')}
              >
                <option value="Pending">Pending</option>
                <option value="In progress">In progress</option>
                <option value="Completed">Completed</option>
              </select>
              <ChevronDown size={16} className="select-chevron" />
            </div>
          </div>

          <div className="modal-actions">
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={() => {
                setIsEditTaskModalOpen(false)
                setSelectedProject(null)
                setSelectedTask(null)
                setTaskFormData({
                  projectId: '',
                  title: '',
                  description: '',
                  dueDate: '',
                  priority: 'Medium',
                  status: 'Pending'
                })
                setTaskErrors({})
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

      {/* View Tasks Modal */}
      <Modal
        isOpen={isViewTasksModalOpen}
        onClose={() => {
          setIsViewTasksModalOpen(false)
          setSelectedProject(null)
        }}
        title="View Tasks"
      >
        <div style={{ padding: '1rem' }}>
          <p>View Tasks functionality will be implemented here.</p>
          <p>Selected Project: {selectedProject?.title}</p>
        </div>
      </Modal>

      {/* Delete Project Confirmation Modal */}
      <Modal
        isOpen={isDeleteProjectModalOpen}
        onClose={() => {
          setIsDeleteProjectModalOpen(false)
          setProjectToDelete(null)
        }}
        title="Delete Project"
      >
          <div style={{ padding: '1rem' }}>
          <div style={{ 
            marginBottom: '1.5rem',
            padding: '1rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '0.5rem',
            color: '#991b1b'
          }}>
            <p style={{ margin: 0, fontWeight: '500' }}>
              Are you sure you want to delete this project{projectToDelete ? `: ${projectToDelete.title}` : ''}?
            </p>
          </div>
          <div className="modal-actions">
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={() => {
                setIsDeleteProjectModalOpen(false)
                setProjectToDelete(null)
              }}
            >
              Cancel
            </button>
            <button 
              type="button" 
              className="btn-primary" 
              onClick={handleDeleteProject}
              style={{ backgroundColor: '#F44336', borderColor: '#F44336' }}
            >
              Yes
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Projects
