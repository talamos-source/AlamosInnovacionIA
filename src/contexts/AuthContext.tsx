import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react'

interface User {
  email: string
  name?: string
  picture?: string
  password?: string
  projectIds?: string[]
  role?: 'Admin' | 'Worker' | 'Customer'
  provider: 'email' | 'google'
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>
  loginWithGoogle: (user: any) => Promise<{ success: boolean; error?: string }>
  updateProfile: (updates: Partial<User>) => void
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
const API_BASE = import.meta.env.VITE_API_URL || 'https://alamosinnovacionia.onrender.com'
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000
  const ACTIVITY_KEY = 'lastActivityAt'
  const lastActivityWriteRef = useRef(0)

  const normalizeEmail = (email: string) => email.trim().toLowerCase()
  const normalizeProjectIds = (user: User) => {
    if (user.projectIds && user.projectIds.length > 0) {
      return user.projectIds
    }
    const legacy = (user as User & { projectId?: string }).projectId
    return legacy ? [legacy] : []
  }

  const getUserFromList = (email: string) => {
    const existing = localStorage.getItem('users')
    const users: User[] = existing ? JSON.parse(existing) : []
    const target = normalizeEmail(email)
    return users.find((u) => normalizeEmail(u.email) === target)
  }

  const upsertUserInList = (nextUser: User) => {
    const existing = localStorage.getItem('users')
    const users: User[] = existing ? JSON.parse(existing) : []
    const target = normalizeEmail(nextUser.email)
    const index = users.findIndex((u) => normalizeEmail(u.email) === target)
    if (index >= 0) {
      const prev = users[index]
      users[index] = {
        ...prev,
        ...nextUser,
        email: normalizeEmail(nextUser.email),
        role: nextUser.role ?? prev.role,
        projectIds: normalizeProjectIds(nextUser).length > 0 ? normalizeProjectIds(nextUser) : normalizeProjectIds(prev)
      }
    } else {
      users.push({
        ...nextUser,
        email: normalizeEmail(nextUser.email),
        projectIds: normalizeProjectIds(nextUser)
      })
    }
    localStorage.setItem('users', JSON.stringify(users))
  }

  const recordActivity = useCallback((force = false) => {
    const now = Date.now()
    if (force || now - lastActivityWriteRef.current > 60000) {
      localStorage.setItem(ACTIVITY_KEY, String(now))
      lastActivityWriteRef.current = now
    }
  }, [ACTIVITY_KEY])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem('authToken')
  }, [])

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      try {
        const lastActivity = Number(localStorage.getItem(ACTIVITY_KEY) || '0')
        if (lastActivity && Date.now() - lastActivity > SESSION_TIMEOUT_MS) {
          localStorage.removeItem('user')
          localStorage.removeItem('authToken')
          return
        }
        const parsed = JSON.parse(savedUser) as User
        const fromList = parsed?.email ? getUserFromList(parsed.email) : undefined
        const resolved = fromList
          ? { ...parsed, ...fromList, provider: parsed.provider }
          : parsed
        setUser({ ...resolved, projectIds: normalizeProjectIds(resolved) })
        recordActivity(true)
      } catch (error) {
        console.error('Error loading user from localStorage:', error)
      }
    }
  }, [recordActivity])

  // Normalize any stored users to lowercase emails once
  useEffect(() => {
    const existing = localStorage.getItem('users')
    if (!existing) return
    try {
      const users: User[] = JSON.parse(existing)
      const normalized = users.map((u) => ({
        ...u,
        email: normalizeEmail(u.email),
        projectIds: normalizeProjectIds(u)
      }))
      localStorage.setItem('users', JSON.stringify(normalized))
    } catch {
      // ignore
    }
  }, [])

  // Save user to localStorage whenever it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user))
    } else {
      localStorage.removeItem('user')
    }
  }, [user])

  useEffect(() => {
    if (!user) return

    const handleActivity = () => recordActivity()
    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'keydown',
      'click',
      'scroll',
      'touchstart'
    ]

    events.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }))

    const interval = window.setInterval(() => {
      const lastActivity = Number(localStorage.getItem(ACTIVITY_KEY) || '0')
      if (lastActivity && Date.now() - lastActivity > SESSION_TIMEOUT_MS) {
        logout()
      }
    }, 60000)

    return () => {
      events.forEach((event) => window.removeEventListener(event, handleActivity))
      window.clearInterval(interval)
    }
  }, [user, recordActivity, logout])

  const login = async (email: string, password: string, name?: string) => {
    const normalizedEmail = normalizeEmail(email)
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password })
      })
      if (!response.ok) {
        let errorMessage = 'Invalid email or password.'
        try {
          const errorData = await response.json()
          if (errorData?.error) {
            errorMessage = errorData.error
          }
        } catch {
          // ignore parse errors
        }
        return { success: false, error: errorMessage }
      }
      const data = await response.json()
      const existing = getUserFromList(normalizedEmail)
      const newUser: User = {
        email: normalizedEmail,
        name: data?.user?.name || name || existing?.name || normalizedEmail.split('@')[0],
        role: data?.user?.role || existing?.role || 'Worker',
        projectIds: normalizeProjectIds(existing || ({ email: normalizedEmail, provider: 'email' } as User)),
        provider: 'email'
      }
      localStorage.setItem('authToken', data?.token || '')
      setUser(newUser)
      upsertUserInList(newUser)
      recordActivity(true)
      return { success: true }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, error: 'Network error. Check API URL or connection.' }
    }
  }

  const loginWithGoogle = async (googleUser: any) => {
    const normalizedEmail = normalizeEmail(googleUser.email)
    try {
      const response = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, name: googleUser.name })
      })
      if (!response.ok) {
        let errorMessage = 'Unauthorized email.'
        try {
          const errorData = await response.json()
          if (errorData?.error) {
            errorMessage = errorData.error
          }
        } catch {
          // ignore parse errors
        }
        return { success: false, error: errorMessage }
      }
      const data = await response.json()
      const existing = getUserFromList(normalizedEmail)
      const newUser: User = {
        email: normalizedEmail,
        name: data?.user?.name || googleUser.name || existing?.name,
        picture: googleUser.picture || existing?.picture,
        role: data?.user?.role || existing?.role || 'Worker',
        projectIds: normalizeProjectIds(existing || ({ email: normalizedEmail, provider: 'google' } as User)),
        provider: 'google'
      }
      localStorage.setItem('authToken', data?.token || '')
      setUser(newUser)
      upsertUserInList(newUser)
      recordActivity(true)
      return { success: true }
    } catch (error) {
      console.error('Google login error:', error)
      return { success: false, error: 'Network error. Check API URL or connection.' }
    }
  }

  const updateProfile = (updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev
      const updated = {
        ...prev,
        ...updates,
        provider: prev.provider
      }
      upsertUserInList(updated)
      return updated
    })
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        loginWithGoogle,
        updateProfile,
        logout,
        isAuthenticated: !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
