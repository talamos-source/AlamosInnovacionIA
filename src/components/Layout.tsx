import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ReactNode, useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Users,
  Phone,
  FileEdit,
  Brain,
  Briefcase,
  CheckSquare,
  CreditCard,
  BarChart3,
  TrendingUp,
  LogIn,
  LogOut,
  User,
  Shield,
  ChevronDown,
  Compass,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import LoginModal from './LoginModal'
import './Layout.css'
import './LoginModal.css'

interface LayoutProps {
  children: ReactNode
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, isAuthenticated } = useAuth()
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isUserMenuOpen) {
        const menuElement = document.querySelector('.topbar-user-wrapper')
        if (menuElement && !menuElement.contains(event.target as Node)) {
          setIsUserMenuOpen(false)
        }
      }
    }
    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isUserMenuOpen])

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/customers', label: 'Customers', icon: Users },
    { path: '/discovery', label: 'Discovery', icon: Compass },
    { path: '/calls', label: 'Calls', icon: Phone },
    { path: '/proposals', label: 'Proposals', icon: FileEdit },
    { path: '/other-services', label: 'Other Services', icon: Brain },
    { path: '/projects', label: 'Projects', icon: Briefcase },
    { path: '/tasks', label: 'Tasks', icon: CheckSquare },
    { path: '/billing', label: 'Billing', icon: CreditCard },
    { path: '/call-analytics', label: 'Call Analytics', icon: BarChart3 },
    { path: '/other-analytics', label: 'Other Analytics', icon: TrendingUp },
  ]

  const filteredNavItems =
    user?.role === 'Customer' ? navItems.filter((item) => item.path === '/projects') : navItems

  const handleLogout = () => {
    logout()
    setIsUserMenuOpen(false)
  }

  const handleProfile = () => {
    setIsUserMenuOpen(false)
    navigate('/profile')
  }

  const handleAdmin = () => {
    setIsUserMenuOpen(false)
    navigate('/admin')
  }

  const userInitials =
    user?.name?.charAt(0).toUpperCase() ||
    user?.email?.charAt(0).toUpperCase() ||
    '·'

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo">
          <img src="/brand/logo.png" alt="Álamos Innovación" className="logo-image" />
          <span className="logo-subtitle">CRM</span>
        </div>
        <nav className="nav">
          {filteredNavItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              >
                <Icon className="nav-icon" size={18} />
                <span className="nav-label">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-user-wrapper">
            {isAuthenticated ? (
              <>
                <button
                  className="topbar-user-btn"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  aria-label="User menu"
                >
                  {user?.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name || ''}
                      className="topbar-user-avatar"
                    />
                  ) : (
                    <div className="topbar-user-avatar topbar-user-avatar--initials">
                      {userInitials}
                    </div>
                  )}
                  <ChevronDown size={14} className="topbar-user-chevron" />
                </button>

                {isUserMenuOpen && (
                  <div className="user-menu-dropdown">
                    <div className="user-menu-header">
                      <span className="user-menu-name">{user?.name || user?.email}</span>
                      <span className="user-menu-email">{user?.email}</span>
                      {user?.role && (
                        <span className="user-menu-role">{user.role}</span>
                      )}
                    </div>
                    <button className="user-menu-item" onClick={handleProfile}>
                      <User size={16} />
                      <span>Profile</span>
                    </button>
                    {user?.role === 'Admin' && (
                      <button className="user-menu-item" onClick={handleAdmin}>
                        <Shield size={16} />
                        <span>Admin</span>
                      </button>
                    )}
                    <button className="user-menu-item logout" onClick={handleLogout}>
                      <LogOut size={16} />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <button
                className="topbar-login-btn"
                onClick={() => setIsLoginModalOpen(true)}
              >
                <LogIn size={16} />
                <span>Sign in</span>
              </button>
            )}
          </div>
        </header>

        <div className="main-content-inner">{children}</div>
      </main>

      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </div>
  )
}

export default Layout
