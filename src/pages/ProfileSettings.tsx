import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './Page.css'

interface ProjectOption {
  id: string
  title: string
}

const ProfileSettings = () => {
  const { user, updateProfile, isAuthenticated } = useAuth()
  const [searchParams] = useSearchParams()
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [storedPassword, setStoredPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [role, setRole] = useState<'Admin' | 'Worker' | 'Customer'>(user?.role || 'Admin')
  const [projectIds, setProjectIds] = useState<string[]>(user?.projectIds || [])
  const [projectToAdd, setProjectToAdd] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(user?.picture)
  const [notFound, setNotFound] = useState(false)
  const [projectError, setProjectError] = useState('')
  const [passwordUpdated, setPasswordUpdated] = useState(false)
  const [projects, setProjects] = useState<ProjectOption[]>([])

  const queryEmail = useMemo(() => {
    return searchParams.get('email') || ''
  }, [searchParams])

  const targetEmail = useMemo(() => {
    return queryEmail || user?.email || ''
  }, [queryEmail, user?.email])

  const isViewingOtherUser = useMemo(() => {
    return !!queryEmail && !!user?.email && queryEmail !== user.email
  }, [queryEmail, user?.email])

  const isWorker = user?.role === 'Worker'
  const isAdmin = user?.role === 'Admin'

  useEffect(() => {
    if (!targetEmail) {
      setName(user?.name || '')
      setEmail(user?.email || '')
      setStoredPassword(user?.password || '')
      setRole(user?.role || 'Admin')
      setProjectIds(user?.projectIds || [])
      setProjectToAdd('')
      setAvatarPreview(user?.picture)
      setNotFound(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordError('')
      return
    }

    if (queryEmail) {
      const storedUsers = localStorage.getItem('users')
      let usersList: Array<{ email: string; name?: string; role?: 'Admin' | 'Worker' | 'Customer'; picture?: string; projectIds?: string[]; password?: string }> = []
      if (storedUsers) {
        try {
          usersList = JSON.parse(storedUsers)
        } catch {
          usersList = []
        }
      }
      const target = usersList.find((u) => u.email === queryEmail)
      if (target) {
        setName(target.name || '')
        setEmail(target.email)
        setStoredPassword(target.password || '')
        setRole(target.role || 'Worker')
        setProjectIds(target.projectIds || [])
        setProjectToAdd('')
        setAvatarPreview(target.picture)
        setNotFound(false)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setPasswordError('')
        return
      }
      // If user isn't found, create a basic profile entry
      const fallbackName = queryEmail.split('@')[0] || ''
      const newUser = { email: queryEmail, name: fallbackName, role: 'Worker' as const, picture: undefined, projectIds: [] as string[], password: '' }
      usersList.push(newUser)
      localStorage.setItem('users', JSON.stringify(usersList))
      setName(newUser.name || '')
      setEmail(newUser.email)
      setStoredPassword(newUser.password || '')
      setRole(newUser.role)
      setProjectIds([])
      setProjectToAdd('')
      setAvatarPreview(undefined)
      setNotFound(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordError('')
      return
    }

    if (!isViewingOtherUser) {
      setName(user?.name || '')
      setEmail(user?.email || '')
      setStoredPassword(user?.password || '')
      setRole(user?.role || 'Admin')
      setProjectIds(user?.projectIds || [])
      setProjectToAdd('')
      setAvatarPreview(user?.picture)
      setNotFound(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordError('')
      return
    }
  }, [user, targetEmail, isViewingOtherUser, queryEmail])

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

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : undefined
      if (result) {
        setAvatarPreview(result)
        if (isViewingOtherUser) {
          const storedUsers = localStorage.getItem('users')
          const usersList = storedUsers ? JSON.parse(storedUsers) : []
          const index = usersList.findIndex((u: { email: string }) => u.email === targetEmail)
          if (index >= 0) {
            usersList[index] = { ...usersList[index], picture: result }
            localStorage.setItem('users', JSON.stringify(usersList))
          }
        } else {
          updateProfile({ picture: result })
        }
      }
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isViewingOtherUser && !isAdmin) {
      return
    }
    if (role === 'Customer' && projectIds.length === 0) {
      setProjectError('At least one project is required')
      return
    }
    setProjectError('')
    const trimmedCurrent = currentPassword.trim()
    const trimmedNew = newPassword.trim()
    const trimmedConfirm = confirmPassword.trim()
    setPasswordUpdated(false)
    setPasswordError('')

    const wantsPasswordChange = !!trimmedNew || !!trimmedConfirm || !!trimmedCurrent
    if (wantsPasswordChange) {
      if (trimmedNew.length === 0 || trimmedConfirm.length === 0) {
        setPasswordError('Please enter the new password twice')
        return
      }
      if (trimmedNew !== trimmedConfirm) {
        setPasswordError('New passwords do not match')
        return
      }
      if (!isViewingOtherUser) {
        if (storedPassword && trimmedCurrent !== storedPassword) {
          setPasswordError('Current password is incorrect')
          return
        }
        if (!storedPassword && trimmedCurrent.length === 0) {
          setPasswordError('Please enter your current password')
          return
        }
      }
    }

    if (isViewingOtherUser) {
      const storedUsers = localStorage.getItem('users')
      const usersList = storedUsers ? JSON.parse(storedUsers) : []
      const index = usersList.findIndex((u: { email: string }) => u.email === targetEmail)
      const updated = {
        name: name.trim(),
        email: email.trim(),
        role,
        projectIds,
        ...(trimmedNew ? { password: trimmedNew } : {})
      }
      if (index >= 0) {
        usersList[index] = { ...usersList[index], ...updated }
      } else {
        usersList.push(updated)
      }
      localStorage.setItem('users', JSON.stringify(usersList))
      if (trimmedNew) {
        setPasswordUpdated(true)
      }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      return
    }
    if (isWorker) {
      updateProfile({
        name: name.trim(),
        ...(trimmedNew ? { password: trimmedNew } : {})
      })
      if (trimmedNew) {
        setPasswordUpdated(true)
      }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      return
    }
    updateProfile({
      name: name.trim(),
      email: email.trim(),
      role,
      projectIds,
      ...(trimmedNew ? { password: trimmedNew } : {})
    })
    if (trimmedNew) {
      setPasswordUpdated(true)
    }
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Profile Settings</h1>
        </div>
      </div>

      {!isAuthenticated ? (
        <div className="empty-state">Please login to view your profile.</div>
      ) : isViewingOtherUser && !isAdmin ? (
        <div className="empty-state">You do not have access to this profile.</div>
      ) : notFound ? (
        <div className="empty-state">User not found.</div>
      ) : (
        <form onSubmit={handleSubmit} className="form-section">
          <div className="profile-settings-layout">
            <div className="profile-settings-fields">
              <div className="profile-fields-column">
                <div className="form-group">
                  <label htmlFor="profile-name">Name</label>
                  <input
                    id="profile-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="profile-email">Email</label>
                  <input
                    id="profile-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    required
                    disabled={isWorker}
                  />
                </div>

                {!isViewingOtherUser && (
                  <div className="form-group">
                    <label htmlFor="profile-current-password">Current Password</label>
                    <input
                      id="profile-current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value)
                        setPasswordError('')
                      }}
                      placeholder="Current password"
                    />
                  </div>
                )}
                <div className="form-group">
                  <label htmlFor="profile-new-password">New Password</label>
                  <input
                    id="profile-new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value)
                      setPasswordError('')
                    }}
                    placeholder="New password"
                    disabled={isViewingOtherUser && !isAdmin}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="profile-confirm-password">Confirm New Password</label>
                  <input
                    id="profile-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
                      setPasswordError('')
                    }}
                    placeholder="Confirm new password"
                    disabled={isViewingOtherUser && !isAdmin}
                  />
                  {passwordError && <span className="error-message">{passwordError}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="profile-role">Role</label>
                  <select
                    id="profile-role"
                    value={role}
                    onChange={(e) => {
                      setRole(e.target.value as 'Admin' | 'Worker' | 'Customer')
                      if (e.target.value !== 'Customer') {
                        setProjectIds([])
                        setProjectToAdd('')
                        setProjectError('')
                      }
                    }}
                    disabled={isWorker}
                  >
                    <option value="Admin">Admin</option>
                    <option value="Worker">Worker</option>
                    <option value="Customer">Customer</option>
                  </select>
                </div>

                {role === 'Customer' && (
                  <div className="form-group">
                    <label htmlFor="profile-project">Project*</label>
                    <div className="client-select">
                      <select
                        id="profile-project"
                        value={projectToAdd}
                        onChange={(e) => {
                          setProjectToAdd(e.target.value)
                          setProjectError('')
                        }}
                        className={projectError ? 'error' : ''}
                        disabled={isWorker}
                      >
                        <option value="">Select a project to add</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.title}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          if (!projectToAdd) return
                          if (projectIds.includes(projectToAdd)) {
                            setProjectToAdd('')
                            return
                          }
                          setProjectIds([...projectIds, projectToAdd])
                          setProjectToAdd('')
                          setProjectError('')
                        }}
                        disabled={isWorker}
                      >
                        Add
                      </button>
                    </div>
                    <div className="client-tags">
                      {projectIds.length === 0 ? (
                        <div className="empty-state">No projects added yet.</div>
                      ) : (
                        projectIds.map((id) => (
                          <span key={id} className="client-tag">
                            {projects.find((p) => p.id === id)?.title || id}
                            <button
                              type="button"
                              onClick={() => setProjectIds(projectIds.filter((pid) => pid !== id))}
                              disabled={isWorker}
                            >
                              ×
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                    {projectError && <span className="error-message">{projectError}</span>}
                  </div>
                )}
              </div>
            </div>

            <div className="profile-settings-avatar">
              <label className="profile-avatar-label" htmlFor="profile-avatar">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Profile avatar" className="profile-avatar-preview" />
                ) : (
                  <div className="profile-avatar-placeholder">Upload Image</div>
                )}
              </label>
              <input
                id="profile-avatar"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="profile-avatar-input"
              />
              <span className="profile-avatar-hint">Profile Image</span>
            </div>
          </div>

          <div className="form-actions">
            {passwordUpdated && (
              <span className="password-updated">Password updated</span>
            )}
            <button type="submit" className="btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export default ProfileSettings
