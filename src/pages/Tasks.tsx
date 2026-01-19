import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, ChevronDown, Pencil, Trash2, Plus, List, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import Modal from '../components/Modal'
import './Page.css'

interface Task {
  id: string
  title: string
  description?: string
  dueDate: string
  priority?: 'Low' | 'Medium' | 'High'
  status?: 'Pending' | 'In progress' | 'Completed'
  projectId: string
  projectName: string
  notes?: string
}

interface Project {
  id: string
  title: string
  tasks?: Task[]
}

const Tasks = () => {
  const [searchParams] = useSearchParams()
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [calendarView, setCalendarView] = useState<'week' | 'month' | 'year'>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState({
    status: 'All',
    priority: 'All',
    project: 'All'
  })
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false)
  const [isEditTaskModalOpen, setIsEditTaskModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskFormData, setTaskFormData] = useState({
    projectId: '',
    title: '',
    description: '',
    dueDate: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High',
    status: 'Pending' as 'Pending' | 'In progress' | 'Completed',
    notes: ''
  })
  const [taskErrors, setTaskErrors] = useState<Record<string, string>>({})
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  // Check for project filter from URL
  useEffect(() => {
    const projectParam = searchParams.get('project')
    if (projectParam) {
      setFilters(prev => ({ ...prev, project: projectParam }))
    }
  }, [searchParams])

  // Load projects and extract all tasks
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

    const loadData = () => {
      const projectsData = loadProjects()
      setProjects(projectsData)

      // Extract all tasks from all projects
      const tasksList: Task[] = []
      projectsData.forEach(project => {
        if (project.tasks && project.tasks.length > 0) {
          project.tasks.forEach(task => {
            tasksList.push({
              ...task,
              projectId: project.id,
              projectName: project.title
            })
          })
        }
      })

      setAllTasks(tasksList)
    }

    loadData()

    // Listen for storage changes
    const handleStorageChange = () => {
      loadData()
    }

    window.addEventListener('storage', handleStorageChange)
    const interval = setInterval(loadData, 2000)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [])

  // Filter tasks
  const filteredTasks = allTasks.filter(task => {
    const searchLower = searchTerm.toLowerCase()
    
    const matchesSearch = !searchTerm ||
      task.title.toLowerCase().includes(searchLower) ||
      task.projectName.toLowerCase().includes(searchLower) ||
      (task.description && task.description.toLowerCase().includes(searchLower)) ||
      task.dueDate.toLowerCase().includes(searchLower) ||
      (task.priority && task.priority.toLowerCase().includes(searchLower)) ||
      (task.status && task.status.toLowerCase().includes(searchLower))

    const matchesStatus = filters.status === 'All' || task.status === filters.status
    const matchesPriority = filters.priority === 'All' || task.priority === filters.priority
    const matchesProject = filters.project === 'All' || task.projectId === filters.project

    return matchesSearch && matchesStatus && matchesPriority && matchesProject
  })

  // Get unique values for filters
  const uniqueStatuses = Array.from(new Set(allTasks.map(t => t.status).filter(Boolean))) as string[]
  const uniquePriorities = Array.from(new Set(allTasks.map(t => t.priority).filter(Boolean))) as string[]

  // Handle date input
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
  }

  // Handle Add Task
  const handleAddTask = () => {
    const newErrors: Record<string, string> = {}
    
    if (!taskFormData.projectId) newErrors.projectId = 'Project is required'
    if (!taskFormData.title.trim()) newErrors.title = 'Task Title is required'
    if (!taskFormData.dueDate.trim()) newErrors.dueDate = 'Due Date is required'

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

    const selectedProject = projects.find(p => p.id === taskFormData.projectId)
    if (!selectedProject) return

    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: taskFormData.title.trim(),
      description: taskFormData.description.trim() || undefined,
      dueDate: convertDateToISO(taskFormData.dueDate),
      priority: taskFormData.priority,
      status: taskFormData.status,
      projectId: taskFormData.projectId,
      projectName: selectedProject.title,
      notes: taskFormData.notes.trim() || undefined
    }

    // Add task to project
    const updatedTasks = [
      ...(selectedProject.tasks || []),
      newTask
    ]

    const updatedProject: Project = {
      ...selectedProject,
      tasks: updatedTasks
    }

    // Update projects in localStorage
    const updatedProjects = projects.map(p => 
      p.id === taskFormData.projectId ? updatedProject : p
    )

    try {
      localStorage.setItem('projects', JSON.stringify(updatedProjects))
      setProjects(updatedProjects)
      setAllTasks(prev => [...prev, newTask])
    } catch (error) {
      console.error('Error saving task:', error)
    }

    // Reset form
    setTaskFormData({
      projectId: '',
      title: '',
      description: '',
      dueDate: '',
      priority: 'Medium',
      status: 'Pending',
      notes: ''
    })
    setTaskErrors({})
    setIsNewTaskModalOpen(false)
  }

  // Handle Edit Task
  const handleEditTask = (task: Task) => {
    setSelectedTask(task)
    
    // Convert date from YYYY-MM-DD to dd/mm/yyyy
    const formatDateForInput = (dateString: string) => {
      if (!dateString) return ''
      const date = new Date(dateString)
      const day = date.getDate().toString().padStart(2, '0')
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const year = date.getFullYear()
      return `${day}/${month}/${year}`
    }
    
    setTaskFormData({
      projectId: task.projectId,
      title: task.title,
      description: task.description || '',
      dueDate: formatDateForInput(task.dueDate),
      priority: task.priority || 'Medium',
      status: task.status || 'Pending',
      notes: task.notes || ''
    })
    setTaskErrors({})
    setIsEditTaskModalOpen(true)
  }

  const handleSaveTaskChanges = () => {
    if (!selectedTask) return

    const newErrors: Record<string, string> = {}
    
    if (!taskFormData.projectId) newErrors.projectId = 'Project is required'
    if (!taskFormData.title.trim()) newErrors.title = 'Task Title is required'
    if (!taskFormData.dueDate.trim()) newErrors.dueDate = 'Due Date is required'

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

    const selectedProject = projects.find(p => p.id === taskFormData.projectId)
    if (!selectedProject) return

    const updatedTask: Task = {
      ...selectedTask,
      title: taskFormData.title.trim(),
      description: taskFormData.description.trim() || undefined,
      dueDate: convertDateToISO(taskFormData.dueDate),
      priority: taskFormData.priority,
      status: taskFormData.status,
      projectId: taskFormData.projectId,
      projectName: selectedProject.title,
      notes: taskFormData.notes.trim() || undefined
    }

    // Update task in project
    const updatedTasks = selectedProject.tasks?.map(t => 
      t.id === selectedTask.id ? updatedTask : t
    ) || []

    const updatedProject: Project = {
      ...selectedProject,
      tasks: updatedTasks
    }

    // Update projects in localStorage
    const updatedProjects = projects.map(p => 
      p.id === taskFormData.projectId ? updatedProject : p
    )

    try {
      localStorage.setItem('projects', JSON.stringify(updatedProjects))
      setProjects(updatedProjects)
      setAllTasks(prev => prev.map(t => t.id === selectedTask.id ? updatedTask : t))
    } catch (error) {
      console.error('Error saving task:', error)
    }

    setIsEditTaskModalOpen(false)
    setSelectedTask(null)
    setTaskFormData({
      projectId: '',
      title: '',
      description: '',
      dueDate: '',
      priority: 'Medium',
      status: 'Pending',
      notes: ''
    })
    setTaskErrors({})
  }

  // Handle Delete Task
  const handleDeleteTask = (task: Task) => {
    if (!window.confirm('Are you sure you want to delete this task?')) {
      return
    }

    const selectedProject = projects.find(p => p.id === task.projectId)
    if (!selectedProject) return

    const updatedTasks = selectedProject.tasks?.filter(t => t.id !== task.id) || []

    const updatedProject: Project = {
      ...selectedProject,
      tasks: updatedTasks.length > 0 ? updatedTasks : undefined
    }

    // Update projects in localStorage
    const updatedProjects = projects.map(p => 
      p.id === task.projectId ? updatedProject : p
    )

    try {
      localStorage.setItem('projects', JSON.stringify(updatedProjects))
      setProjects(updatedProjects)
      setAllTasks(prev => prev.filter(t => t.id !== task.id))
    } catch (error) {
      console.error('Error deleting task:', error)
    }
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    const day = date.getDate()
    const month = months[date.getMonth()]
    const year = date.getFullYear()
    return `${day} ${month} ${year}`
  }

  // Get priority color
  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'Low':
        return '#64748b'
      case 'Medium':
        return '#8E44AD'
      case 'High':
        return '#E91E63'
      default:
        return '#8E44AD'
    }
  }

  // Get status badge class
  const getStatusBadgeClass = (status?: string) => {
    switch (status) {
      case 'Pending':
        return 'status-pending'
      case 'In progress':
        return 'status-in-progress'
      case 'Completed':
        return 'status-completed'
      default:
        return ''
    }
  }

  // Calendar functions
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    
    const days: (Date | null)[] = []
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }
    return days
  }

  const getWeekDays = (date: Date) => {
    const weekStart = new Date(date)
    const day = weekStart.getDay()
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1) // Adjust to Monday
    weekStart.setDate(diff)
    
    const weekDays: Date[] = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart)
      day.setDate(weekStart.getDate() + i)
      weekDays.push(day)
    }
    return weekDays
  }

  const getYearMonths = (date: Date) => {
    const year = date.getFullYear()
    const months: Date[] = []
    for (let month = 0; month < 12; month++) {
      months.push(new Date(year, month, 1))
    }
    return months
  }

  const getTasksForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return filteredTasks.filter(task => {
      const taskDate = new Date(task.dueDate).toISOString().split('T')[0]
      return taskDate === dateStr
    })
  }

  const navigateCalendar = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (calendarView === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    } else if (calendarView === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
    } else if (calendarView === 'year') {
      newDate.setFullYear(newDate.getFullYear() + (direction === 'next' ? 1 : -1))
    }
    setCurrentDate(newDate)
  }

  const formatCalendarHeader = () => {
    if (calendarView === 'week') {
      const weekStart = getWeekDays(currentDate)[0]
      const weekEnd = getWeekDays(currentDate)[6]
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
      if (weekStart.getMonth() === weekEnd.getMonth()) {
        return `${months[weekStart.getMonth()]} ${weekStart.getFullYear()}`
      }
      return `${months[weekStart.getMonth()]} ${weekStart.getDate()} - ${months[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekStart.getFullYear()}`
    } else if (calendarView === 'month') {
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
      return `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    } else {
      return `${currentDate.getFullYear()}`
    }
  }

  const isSameDay = (date1: Date, date2: Date) => {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear()
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return isSameDay(date, today)
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Tasks</h1>
          <p className="page-subtitle">Manage all tasks across projects</p>
        </div>
      </div>

      <div className="customers-toolbar">
        <div className="search-bar-inline">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by task, project, due date, priority, status..."
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
                value={filters.priority}
                onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
                className={`filter-btn ${filters.priority !== 'All' ? 'active' : ''}`}
                style={{ appearance: 'none', paddingRight: '2rem', cursor: 'pointer' }}
              >
                <option value="All">All Priority</option>
                {uniquePriorities.map(priority => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </select>
              <ChevronDown size={16} className="select-chevron" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
            <div className="select-wrapper" style={{ position: 'relative' }}>
              <select
                value={filters.project}
                onChange={(e) => setFilters(prev => ({ ...prev, project: e.target.value }))}
                className={`filter-btn ${filters.project !== 'All' ? 'active' : ''}`}
                style={{ appearance: 'none', paddingRight: '2rem', cursor: 'pointer' }}
              >
                <option value="All">All Projects</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>{project.title}</option>
                ))}
              </select>
              <ChevronDown size={16} className="select-chevron" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', padding: '0.25rem' }}>
            <button
              onClick={() => setViewMode('list')}
              title="List View"
              style={{
                padding: '0.5rem',
                border: 'none',
                background: viewMode === 'list' ? 'white' : 'transparent',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: viewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <List size={18} color={viewMode === 'list' ? '#2C3E50' : '#64748b'} />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              title="Calendar View"
              style={{
                padding: '0.5rem',
                border: 'none',
                background: viewMode === 'calendar' ? 'white' : 'transparent',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: viewMode === 'calendar' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <Calendar size={18} color={viewMode === 'calendar' ? '#2C3E50' : '#64748b'} />
            </button>
          </div>

          {viewMode === 'calendar' && (
            <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', padding: '0.25rem' }}>
              <button
                onClick={() => setCalendarView('week')}
                style={{
                  padding: '0.5rem 0.75rem',
                  border: 'none',
                  background: calendarView === 'week' ? 'white' : 'transparent',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: calendarView === 'week' ? '600' : '500',
                  color: calendarView === 'week' ? '#2C3E50' : '#64748b',
                  boxShadow: calendarView === 'week' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                Week
              </button>
              <button
                onClick={() => setCalendarView('month')}
                style={{
                  padding: '0.5rem 0.75rem',
                  border: 'none',
                  background: calendarView === 'month' ? 'white' : 'transparent',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: calendarView === 'month' ? '600' : '500',
                  color: calendarView === 'month' ? '#2C3E50' : '#64748b',
                  boxShadow: calendarView === 'month' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                Month
              </button>
              <button
                onClick={() => setCalendarView('year')}
                style={{
                  padding: '0.5rem 0.75rem',
                  border: 'none',
                  background: calendarView === 'year' ? 'white' : 'transparent',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: calendarView === 'year' ? '600' : '500',
                  color: calendarView === 'year' ? '#2C3E50' : '#64748b',
                  boxShadow: calendarView === 'year' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                Year
              </button>
            </div>
          )}

          <button 
            className="btn-primary" 
            onClick={() => {
              setTaskFormData({
                projectId: '',
                title: '',
                description: '',
                dueDate: '',
                priority: 'Medium',
                status: 'Pending',
                notes: ''
              })
              setTaskErrors({})
              setIsNewTaskModalOpen(true)
            }}
          >
            <Plus size={18} />
            New Task
          </button>
        </div>
      </div>

      <div className="content-section">
        {viewMode === 'list' ? (
          filteredTasks.length === 0 ? (
            <div className="empty-row" style={{ padding: '3rem', textAlign: 'center' }}>
              {searchTerm || filters.status !== 'All' || filters.priority !== 'All' || filters.project !== 'All'
                ? 'No tasks match your filters' 
                : 'No tasks found. Add tasks from projects or create new ones.'}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Project</th>
                  <th>Due Date</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map(task => (
                  <tr key={task.id}>
                    <td>
                      <div style={{ fontWeight: '500', color: '#2C3E50' }}>
                        {task.title}
                      </div>
                      {task.description && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                          {task.description}
                        </div>
                      )}
                    </td>
                    <td>{task.projectName}</td>
                    <td>{formatDate(task.dueDate)}</td>
                    <td>
                      <span 
                        className="priority-badge"
                        style={{ 
                          backgroundColor: getPriorityColor(task.priority),
                          color: 'white',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: '500'
                        }}
                      >
                        {task.priority || 'Medium'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusBadgeClass(task.status)}`}>
                        {task.status || 'Pending'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button 
                          className="table-action-btn" 
                          onClick={() => handleEditTask(task)}
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button 
                          className="table-action-btn delete" 
                          onClick={() => handleDeleteTask(task)}
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          <div className="calendar-view">
            <div className="calendar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', padding: '1rem', background: 'white', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
              <button
                onClick={() => navigateCalendar('prev')}
                style={{
                  padding: '0.5rem',
                  border: 'none',
                  background: '#f8fafc',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <ChevronLeft size={20} />
              </button>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: '#2C3E50' }}>
                {formatCalendarHeader()}
              </h2>
              <button
                onClick={() => navigateCalendar('next')}
                style={{
                  padding: '0.5rem',
                  border: 'none',
                  background: '#f8fafc',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {calendarView === 'month' && (
              <div className="calendar-month" style={{ background: 'white', borderRadius: '0.5rem', padding: '1rem', border: '1px solid #e2e8f0' }}>
                <div className="calendar-weekdays" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                    <div key={day} style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '600', color: '#64748b', fontSize: '0.875rem' }}>
                      {day}
                    </div>
                  ))}
                </div>
                <div className="calendar-days" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
                  {getDaysInMonth(currentDate).map((day: Date | null, index: number) => {
                    if (!day) {
                      return <div key={`empty-${index}`} style={{ minHeight: '100px' }}></div>
                    }
                    const dayTasks = getTasksForDate(day)
                    const isCurrentDay = isToday(day)
                    const isCurrentMonth = day.getMonth() === currentDate.getMonth()
                    
                    return (
                      <div
                        key={day.toISOString()}
                        style={{
                          minHeight: '100px',
                          padding: '0.5rem',
                          background: isCurrentDay ? '#f0f9ff' : 'white',
                          border: isCurrentDay ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                          borderRadius: '0.5rem',
                          opacity: isCurrentMonth ? 1 : 0.4
                        }}
                      >
                        <div style={{ 
                          fontWeight: isCurrentDay ? '700' : '500', 
                          color: isCurrentDay ? '#3b82f6' : '#2C3E50',
                          marginBottom: '0.5rem',
                          fontSize: '0.875rem'
                        }}>
                          {day.getDate()}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {dayTasks.slice(0, 3).map((task: any) => (
                            <div
                              key={task.id}
                              onClick={() => handleEditTask(task)}
                              style={{
                                padding: '0.25rem 0.5rem',
                                background: getPriorityColor(task.priority),
                                color: 'white',
                                borderRadius: '0.25rem',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                              title={task.title}
                            >
                              {task.title}
                            </div>
                          ))}
                          {dayTasks.length > 3 && (
                            <div style={{ fontSize: '0.75rem', color: '#64748b', padding: '0.25rem' }}>
                              +{dayTasks.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {calendarView === 'week' && (
              <div className="calendar-week" style={{ background: 'white', borderRadius: '0.5rem', padding: '1rem', border: '1px solid #e2e8f0' }}>
                <div className="calendar-weekdays" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                    <div key={day} style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '600', color: '#64748b', fontSize: '0.875rem' }}>
                      {day}
                    </div>
                  ))}
                </div>
                <div className="calendar-week-days" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
                  {getWeekDays(currentDate).map((day: Date) => {
                    const dayTasks = getTasksForDate(day)
                    const isCurrentDay = isToday(day)
                    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.getDay()]
                    
                    return (
                      <div
                        key={day.toISOString()}
                        style={{
                          minHeight: '200px',
                          padding: '0.75rem',
                          background: isCurrentDay ? '#f0f9ff' : 'white',
                          border: isCurrentDay ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                          borderRadius: '0.5rem'
                        }}
                      >
                        <div style={{ 
                          fontWeight: isCurrentDay ? '700' : '500', 
                          color: isCurrentDay ? '#3b82f6' : '#2C3E50',
                          marginBottom: '0.75rem',
                          fontSize: '0.875rem'
                        }}>
                          {dayName} {day.getDate()}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {dayTasks.map((task: any) => (
                            <div
                              key={task.id}
                              onClick={() => handleEditTask(task)}
                              style={{
                                padding: '0.5rem',
                                background: getPriorityColor(task.priority),
                                color: 'white',
                                borderRadius: '0.25rem',
                                fontSize: '0.75rem',
                                cursor: 'pointer'
                              }}
                            >
                              <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{task.title}</div>
                              <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>{task.projectName}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {calendarView === 'year' && (
              <div className="calendar-year" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', background: 'white', borderRadius: '0.5rem', padding: '1rem', border: '1px solid #e2e8f0' }}>
                {getYearMonths(currentDate).map((month: Date) => {
                  const monthTasks = filteredTasks.filter((task: any) => {
                    const taskDate = new Date(task.dueDate)
                    return taskDate.getMonth() === month.getMonth() && taskDate.getFullYear() === month.getFullYear()
                  })
                  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                  
                  return (
                    <div
                      key={month.toISOString()}
                      style={{
                        padding: '1rem',
                        background: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.5rem'
                      }}
                    >
                      <div style={{ fontWeight: '600', color: '#2C3E50', marginBottom: '0.75rem', fontSize: '1rem' }}>
                        {months[month.getMonth()]} {month.getFullYear()}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {monthTasks.slice(0, 5).map((task: any) => (
                          <div
                            key={task.id}
                            onClick={() => handleEditTask(task)}
                            style={{
                              padding: '0.5rem',
                              background: getPriorityColor(task.priority),
                              color: 'white',
                              borderRadius: '0.25rem',
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                          >
                            {formatDate(task.dueDate)} - {task.title}
                          </div>
                        ))}
                        {monthTasks.length > 5 && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b', padding: '0.25rem' }}>
                            +{monthTasks.length - 5} more tasks
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Task Modal */}
      <Modal
        isOpen={isNewTaskModalOpen}
        onClose={() => {
          setIsNewTaskModalOpen(false)
          setTaskFormData({
            projectId: '',
            title: '',
            description: '',
            dueDate: '',
            priority: 'Medium',
            status: 'Pending',
            notes: ''
          })
          setTaskErrors({})
        }}
        title="New Task"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleAddTask(); }} className="modal-form">
          <div className="form-group">
            <label htmlFor="new-task-project">Project <span className="required">*</span></label>
            <div className="select-wrapper">
              <select
                id="new-task-project"
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
            <label htmlFor="new-task-title">Title <span className="required">*</span></label>
            <input
              type="text"
              id="new-task-title"
              value={taskFormData.title}
              onChange={(e) => handleTaskFormChange('title', e.target.value)}
              className={taskErrors.title ? 'error' : ''}
              placeholder="Task title"
            />
            {taskErrors.title && <span className="error-message">{taskErrors.title}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="new-task-description">Description</label>
            <textarea
              id="new-task-description"
              value={taskFormData.description}
              onChange={(e) => handleTaskFormChange('description', e.target.value)}
              rows={4}
              placeholder="Task description"
            />
          </div>

          <div className="form-group">
            <label htmlFor="new-task-due-date">Due Date <span className="required">*</span></label>
            <input
              type="text"
              id="new-task-due-date"
              value={taskFormData.dueDate}
              onChange={handleTaskDateInput}
              className={taskErrors.dueDate ? 'error' : ''}
              placeholder="dd/mm/yyyy"
              maxLength={10}
            />
            {taskErrors.dueDate && <span className="error-message">{taskErrors.dueDate}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="new-task-priority">Priority</label>
            <div className="select-wrapper">
              <select
                id="new-task-priority"
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
            <label htmlFor="new-task-status">Status</label>
            <div className="select-wrapper">
              <select
                id="new-task-status"
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

          <div className="form-group">
            <label htmlFor="new-task-notes">Notes</label>
            <textarea
              id="new-task-notes"
              value={taskFormData.notes}
              onChange={(e) => handleTaskFormChange('notes', e.target.value)}
              rows={3}
              placeholder="Add notes..."
            />
          </div>

          <div className="modal-actions">
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={() => {
                setIsNewTaskModalOpen(false)
                setTaskFormData({
                  projectId: '',
                  title: '',
                  description: '',
                  dueDate: '',
                  priority: 'Medium',
                  status: 'Pending',
                  notes: ''
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

      {/* Edit Task Modal */}
      <Modal
        isOpen={isEditTaskModalOpen}
        onClose={() => {
          setIsEditTaskModalOpen(false)
          setSelectedTask(null)
          setTaskFormData({
            projectId: '',
            title: '',
            description: '',
            dueDate: '',
            priority: 'Medium',
            status: 'Pending',
            notes: ''
          })
          setTaskErrors({})
        }}
        title="Edit Task"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSaveTaskChanges(); }} className="modal-form">
          <div className="form-group">
            <label htmlFor="edit-task-project">Project <span className="required">*</span></label>
            <div className="select-wrapper">
              <select
                id="edit-task-project"
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
            <label htmlFor="edit-task-title">Title <span className="required">*</span></label>
            <input
              type="text"
              id="edit-task-title"
              value={taskFormData.title}
              onChange={(e) => handleTaskFormChange('title', e.target.value)}
              className={taskErrors.title ? 'error' : ''}
              placeholder="Task title"
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
              placeholder="Task description"
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

          <div className="form-group">
            <label htmlFor="edit-task-notes">Notes</label>
            <textarea
              id="edit-task-notes"
              value={taskFormData.notes}
              onChange={(e) => handleTaskFormChange('notes', e.target.value)}
              rows={3}
              placeholder="Add notes..."
            />
          </div>

          <div className="modal-actions">
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={() => {
                setIsEditTaskModalOpen(false)
                setSelectedTask(null)
                setTaskFormData({
                  projectId: '',
                  title: '',
                  description: '',
                  dueDate: '',
                  priority: 'Medium',
                  status: 'Pending',
                  notes: ''
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
    </div>
  )
}

export default Tasks
