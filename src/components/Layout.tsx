import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ReactNode, useState, useEffect } from 'react'
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
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
  ChevronDown
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

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isUserMenuOpen) {
        const menuElement = document.querySelector('.user-menu')
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
    { path: '/calls', label: 'Calls', icon: FileText },
    { path: '/proposals', label: 'Proposals', icon: FileEdit },
    { path: '/other-services', label: 'Other Services', icon: Brain },
    { path: '/projects', label: 'Projects', icon: Briefcase },
    { path: '/tasks', label: 'Tasks', icon: CheckSquare },
    { path: '/billing', label: 'Billing', icon: CreditCard },
    { path: '/call-analytics', label: 'Call Analytics', icon: BarChart3 },
    { path: '/other-analytics', label: 'Other Analytics', icon: TrendingUp },
  ]

  const filteredNavItems = user?.role === 'Customer'
    ? navItems.filter((item) => item.path === '/projects')
    : navItems

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

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo">
          <img src="/logo.png?v=2" alt="Álamos Innovación" className="logo-image" />
          <h1>Alamos IA</h1>
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
                <Icon className="nav-icon" size={20} />
                <span className="nav-label">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>
      <main className="main-content">
        <header className="main-header">
          <div className="header-spacer"></div>
          <div className="user-menu" style={{ position: 'relative' }}>
            {isAuthenticated ? (
              <>
                <button
                  className="user-button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                >
                  {user?.picture ? (
                    <img src={user.picture} alt={user.name} className="user-avatar" />
                  ) : (
                    <div className="user-avatar" style={{ 
                      background: '#8E44AD', 
                      color: 'white', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      fontSize: '0.875rem',
                      fontWeight: '600'
                    }}>
                      {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="user-info">
                    <span className="user-name">{user?.name || user?.email}</span>
                    <span className="user-email">{user?.email}</span>
                  </div>
                  <ChevronDown size={16} style={{ color: '#64748b' }} />
                </button>
                {isUserMenuOpen && (
                  <div className="user-menu-dropdown">
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
                className="user-button"
                onClick={() => setIsLoginModalOpen(true)}
              >
                <LogIn size={18} />
                <span>Login</span>
              </button>
            )}
          </div>
        </header>
        {children}
      </main>
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </div>
  )
}

export default Layout
