import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Eye, Pencil, Trash2, Settings } from 'lucide-react'
import Modal from '../components/Modal'
import { useAuth } from '../contexts/AuthContext'
import './Page.css'

interface UserRow {
  name?: string
  email: string
  role?: 'Admin' | 'Worker' | 'Customer'
  projectIds?: string[]
}

interface ProjectOption {
  id: string
  title: string
}

const Admin = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'Admin'
  const API_BASE = import.meta.env.VITE_API_URL || 'https://api.alamosinnovacion.com'
  const [users, setUsers] = useState<UserRow[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('All')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Worker',
    projectIds: [] as string[],
    projectToAdd: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    const storedUsers = localStorage.getItem('users')
    const storedUser = localStorage.getItem('user')
    let nextUsers: UserRow[] = []

    if (storedUsers) {
      try {
        nextUsers = JSON.parse(storedUsers)
      } catch {
        nextUsers = []
      }
    }

    if (storedUser) {
      try {
        const currentUser = JSON.parse(storedUser) as UserRow
        if (currentUser?.email) {
          const index = nextUsers.findIndex((u) => u.email === currentUser.email)
          if (index >= 0) {
            nextUsers[index] = { ...nextUsers[index], ...currentUser }
          } else {
            nextUsers.push(currentUser)
          }
        }
      } catch {
        // ignore invalid user
      }
    }

    setUsers(nextUsers)
    localStorage.setItem('users', JSON.stringify(nextUsers))
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('projects')
    if (!stored) return
    try {
      const parsed = JSON.parse(stored) as Array<{ id: string; title: string }>
      const unique = parsed.filter((p) => p?.id && p?.title)
      setProjects(unique)
    } catch {
      setProjects([])
    }
  }, [])

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return users.filter((user) => {
      const projectNames = (user.projectIds || [])
        .map((id) => projects.find((p) => p.id === id)?.title)
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      const matchesSearch =
        !term ||
        user.name?.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        user.role?.toLowerCase().includes(term) ||
        projectNames.includes(term)
      const matchesRole = roleFilter === 'All' || user.role === roleFilter
      return matchesSearch && matchesRole
    })
  }, [users, searchTerm, roleFilter, projects])

  const validate = (mode: 'add' | 'edit') => {
    const nextErrors: Record<string, string> = {}
    if (!formData.name.trim()) nextErrors.name = 'Name is required'
    if (!formData.email.trim()) nextErrors.email = 'Email is required'
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (formData.email && !emailRegex.test(formData.email)) {
      nextErrors.email = 'Invalid email'
    }
    if (mode === 'add' && !formData.password.trim()) {
      nextErrors.password = 'Password is required'
    }
    if (formData.role === 'Customer' && formData.projectIds.length === 0) {
      nextErrors.projectIds = 'At least one project is required'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError('')
    if (!validate('add')) return
    const normalizedEmail = formData.email.trim().toLowerCase()
    const newUser: UserRow = {
      name: formData.name.trim(),
      email: normalizedEmail,
      role: formData.role as 'Admin' | 'Worker' | 'Customer',
      projectIds: formData.projectIds
    }
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          email: normalizedEmail,
          password: formData.password.trim(),
          name: formData.name.trim(),
          role: formData.role
        })
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setSubmitError(data?.error || 'Failed to create user in backend.')
        return
      }
    } catch (error) {
      console.error('Create user error:', error)
      setSubmitError('Failed to create user in backend.')
      return
    }
    const nextUsers = [...users]
    const existingIndex = nextUsers.findIndex((u) => u.email === newUser.email)
    if (existingIndex >= 0) {
      nextUsers[existingIndex] = { ...nextUsers[existingIndex], ...newUser }
    } else {
      nextUsers.push(newUser)
    }
    setUsers(nextUsers)
    localStorage.setItem('users', JSON.stringify(nextUsers))
    setIsAddModalOpen(false)
    setFormData({ name: '', email: '', password: '', role: 'Worker', projectIds: [], projectToAdd: '' })
    setErrors({})
  }

  const handleViewUser = (user: UserRow) => {
    navigate(`/profile?email=${encodeURIComponent(user.email)}`)
  }

  const handleEditUser = (user: UserRow) => {
    setSelectedUser(user)
    setFormData({
      name: user.name || '',
      email: user.email,
      password: '',
      role: user.role || 'Worker',
      projectIds: user.projectIds || [],
      projectToAdd: ''
    })
    setErrors({})
    setSubmitError('')
    setIsEditModalOpen(true)
  }

  const handleDeleteUser = (user: UserRow) => {
    setSelectedUser(user)
    setIsDeleteModalOpen(true)
  }

  const handleCompanySettings = () => {
    navigate('/company-settings')
  }

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate('edit')) return
    if (!selectedUser) return
    const normalizedEmail = formData.email.trim().toLowerCase()
    const updatedUser: UserRow = {
      name: formData.name.trim(),
      email: normalizedEmail,
      role: formData.role as 'Admin' | 'Worker' | 'Customer',
      projectIds: formData.projectIds
    }
    const nextUsers = users
      .filter((u) => u.email !== selectedUser.email)
      .map((u) => u)
    nextUsers.push({ ...selectedUser, ...updatedUser })
    setUsers(nextUsers)
    localStorage.setItem('users', JSON.stringify(nextUsers))
    setIsEditModalOpen(false)
    setSelectedUser(null)
    setErrors({})
    setSubmitError('')
  }

  const handleAddProject = () => {
    if (!formData.projectToAdd) return
    if (formData.projectIds.includes(formData.projectToAdd)) {
      setFormData({ ...formData, projectToAdd: '' })
      return
    }
    setFormData({
      ...formData,
      projectIds: [...formData.projectIds, formData.projectToAdd],
      projectToAdd: ''
    })
    setErrors({ ...errors, projectIds: '' })
  }

  const handleRemoveProject = (projectId: string) => {
    setFormData({
      ...formData,
      projectIds: formData.projectIds.filter((id) => id !== projectId)
    })
  }

  const confirmDeleteUser = () => {
    if (!selectedUser) return
    const nextUsers = users.filter((u) => u.email !== selectedUser.email)
    setUsers(nextUsers)
    localStorage.setItem('users', JSON.stringify(nextUsers))
    setIsDeleteModalOpen(false)
    setSelectedUser(null)
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Admin</h1>
          <p className="page-subtitle">Manage platform users.</p>
        </div>
        {isAdmin && (
          <button className="btn-secondary" onClick={handleCompanySettings}>
            <Settings size={16} />
            Company Settings
          </button>
        )}
      </div>

      {!isAdmin ? (
        <div className="empty-state">You do not have access to this panel.</div>
      ) : (
        <>
      <div className="customers-toolbar">
        <div className="search-bar-inline">
          <Search className="search-icon-inline" size={18} />
          <input
            type="text"
            placeholder="Search users..."
            className="search-input-inline"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-group" style={{ minWidth: '200px' }}>
          <label>Role</label>
          <select
            className="filter-select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="All">All Roles</option>
            <option value="Admin">Admin</option>
            <option value="Worker">Worker</option>
            <option value="Customer">Customer</option>
          </select>
        </div>
        <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>
          <Plus size={16} />
          Add User
        </button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Projects</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-state">
                  No users found.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const projectNames = (user.projectIds || [])
                  .map((id) => projects.find((p) => p.id === id)?.title)
                  .filter(Boolean)
                return (
                  <tr key={user.email}>
                    <td>{user.name || '-'}</td>
                    <td>{user.email}</td>
                    <td>{user.role || '-'}</td>
                    <td>{projectNames.length > 0 ? projectNames.join(', ') : '-'}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="action-btn"
                          onClick={() => handleViewUser(user)}
                          title="View"
                          aria-label="View"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          className="action-btn"
                          onClick={() => handleEditUser(user)}
                          title="Edit"
                          aria-label="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="action-btn delete"
                          onClick={() => handleDeleteUser(user)}
                          title="Delete"
                          aria-label="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add User"
      >
        <form onSubmit={handleAddUser} className="form-section">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="admin-name">Name</label>
              <input
                id="admin-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={errors.name ? 'error' : ''}
                placeholder="Name"
                required
              />
              {errors.name && <span className="error-message">{errors.name}</span>}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="admin-email">Email</label>
              <input
                id="admin-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={errors.email ? 'error' : ''}
                placeholder="Email"
                required
              />
              {errors.email && <span className="error-message">{errors.email}</span>}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="admin-password">Password</label>
              <input
                id="admin-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className={errors.password ? 'error' : ''}
                placeholder="Password"
                required
              />
              {errors.password && <span className="error-message">{errors.password}</span>}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="admin-role">Role</label>
              <select
                id="admin-role"
                value={formData.role}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    role: e.target.value,
                    projectIds: e.target.value === 'Customer' ? formData.projectIds : []
                  })
                }
              >
                <option value="Admin">Admin</option>
                <option value="Worker">Worker</option>
                <option value="Customer">Customer</option>
              </select>
            </div>
          </div>
          {formData.role === 'Customer' && (
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="admin-project">Project*</label>
                <div className="client-select">
                  <select
                    id="admin-project"
                    value={formData.projectToAdd}
                    onChange={(e) => setFormData({ ...formData, projectToAdd: e.target.value })}
                    className={errors.projectIds ? 'error' : ''}
                  >
                    <option value="">Select a project to add</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn-secondary" onClick={handleAddProject}>
                    Add
                  </button>
                </div>
                <div className="client-tags">
                  {formData.projectIds.length === 0 ? (
                    <div className="empty-state">No projects added yet.</div>
                  ) : (
                    formData.projectIds.map((id) => (
                      <span key={id} className="client-tag">
                        {projects.find((p) => p.id === id)?.title || id}
                        <button type="button" onClick={() => handleRemoveProject(id)}>×</button>
                      </span>
                    ))
                  )}
                </div>
                {errors.projectIds && <span className="error-message">{errors.projectIds}</span>}
              </div>
            </div>
          )}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Add User
            </button>
          </div>
          {submitError && <div className="error-message" style={{ marginTop: '0.75rem' }}>{submitError}</div>}
        </form>
      </Modal>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit User"
      >
        <form onSubmit={handleUpdateUser} className="form-section">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="admin-edit-name">Name</label>
              <input
                id="admin-edit-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={errors.name ? 'error' : ''}
                placeholder="Name"
                required
              />
              {errors.name && <span className="error-message">{errors.name}</span>}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="admin-edit-email">Email</label>
              <input
                id="admin-edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={errors.email ? 'error' : ''}
                placeholder="Email"
                required
              />
              {errors.email && <span className="error-message">{errors.email}</span>}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="admin-edit-role">Role</label>
              <select
                id="admin-edit-role"
                value={formData.role}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    role: e.target.value,
                    projectIds: e.target.value === 'Customer' ? formData.projectIds : []
                  })
                }
              >
                <option value="Admin">Admin</option>
                <option value="Worker">Worker</option>
                <option value="Customer">Customer</option>
              </select>
            </div>
          </div>
          {formData.role === 'Customer' && (
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="admin-edit-project">Project*</label>
                <div className="client-select">
                  <select
                    id="admin-edit-project"
                    value={formData.projectToAdd}
                    onChange={(e) => setFormData({ ...formData, projectToAdd: e.target.value })}
                    className={errors.projectIds ? 'error' : ''}
                  >
                    <option value="">Select a project to add</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn-secondary" onClick={handleAddProject}>
                    Add
                  </button>
                </div>
                <div className="client-tags">
                  {formData.projectIds.length === 0 ? (
                    <div className="empty-state">No projects added yet.</div>
                  ) : (
                    formData.projectIds.map((id) => (
                      <span key={id} className="client-tag">
                        {projects.find((p) => p.id === id)?.title || id}
                        <button type="button" onClick={() => handleRemoveProject(id)}>×</button>
                      </span>
                    ))
                  )}
                </div>
                {errors.projectIds && <span className="error-message">{errors.projectIds}</span>}
              </div>
            </div>
          )}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save Changes
            </button>
          </div>
          {submitError && <div className="error-message" style={{ marginTop: '0.75rem' }}>{submitError}</div>}
        </form>
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete User"
      >
        <div className="form-section">
          <p>Are you sure you want to delete this user?</p>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn-danger" onClick={confirmDeleteUser}>
              Delete
            </button>
          </div>
        </div>
      </Modal>
        </>
      )}
    </div>
  )
}

export default Admin
