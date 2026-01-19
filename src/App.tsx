import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import Calls from './pages/Calls'
import Proposals from './pages/Proposals'
import OtherServices from './pages/OtherServices'
import Projects from './pages/Projects'
import Tasks from './pages/Tasks'
import Billing from './pages/Billing'
import CallAnalytics from './pages/CallAnalytics'
import OtherAnalytics from './pages/OtherAnalytics'
import ProfileSettings from './pages/ProfileSettings'
import Admin from './pages/Admin'
import CompanySettings from './pages/CompanySettings'
import InvoicePage from './pages/InvoicePage'
import LoginPage from './pages/LoginPage'
import { useAuth } from './contexts/AuthContext'

// Google OAuth Client ID - Replace with your actual Client ID
// You can get one from: https://console.cloud.google.com/apis/credentials
// Create a .env file in the root directory with: VITE_GOOGLE_CLIENT_ID=your-client-id
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

const AppRoutes = () => {
  const { isAuthenticated, user } = useAuth()

  if (!isAuthenticated) {
    return <LoginPage />
  }

  const isCustomer = user?.role === 'Customer'
  const homeRoute = isCustomer ? '/projects' : '/'

  return (
    <Layout>
      <Routes>
        <Route path="/" element={isCustomer ? <Navigate to="/projects" replace /> : <Dashboard />} />
        <Route path="/customers" element={isCustomer ? <Navigate to="/projects" replace /> : <Customers />} />
        <Route path="/customers/:id" element={isCustomer ? <Navigate to="/projects" replace /> : <CustomerDetail />} />
        <Route path="/calls" element={isCustomer ? <Navigate to="/projects" replace /> : <Calls />} />
        <Route path="/proposals" element={isCustomer ? <Navigate to="/projects" replace /> : <Proposals />} />
        <Route path="/other-services" element={isCustomer ? <Navigate to="/projects" replace /> : <OtherServices />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/tasks" element={isCustomer ? <Navigate to="/projects" replace /> : <Tasks />} />
        <Route path="/billing" element={isCustomer ? <Navigate to="/projects" replace /> : <Billing />} />
        <Route path="/call-analytics" element={isCustomer ? <Navigate to="/projects" replace /> : <CallAnalytics />} />
        <Route path="/other-analytics" element={isCustomer ? <Navigate to="/projects" replace /> : <OtherAnalytics />} />
        <Route path="/profile" element={<ProfileSettings />} />
        <Route path="/admin" element={isCustomer ? <Navigate to="/projects" replace /> : <Admin />} />
        <Route path="/company-settings" element={isCustomer ? <Navigate to="/projects" replace /> : <CompanySettings />} />
        <Route path="/invoice/:id" element={isCustomer ? <Navigate to="/projects" replace /> : <InvoicePage />} />
        <Route path="*" element={<Navigate to={homeRoute} replace />} />
      </Routes>
    </Layout>
  )
}

function App() {
  const basePath = window.location.pathname.startsWith('/private') ? '/private' : ''

  const AppContent = () => (
    <AuthProvider>
      <Router basename={basePath || undefined}>
        <AppRoutes />
      </Router>
    </AuthProvider>
  )

  // Always wrap with GoogleOAuthProvider to enable Google login hook
  // If no client ID is provided, the hook will still work but login will fail gracefully
  // This ensures useGoogleLogin can be called in LoginModal
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID || 'placeholder-client-id'}>
      <AppContent />
    </GoogleOAuthProvider>
  )
}

export default App
