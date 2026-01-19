import { useState } from 'react'
import { Mail } from 'lucide-react'
import { useGoogleLogin } from '@react-oauth/google'
import { useAuth } from '../contexts/AuthContext'
import '../components/LoginModal.css'
import './Page.css'

// Check if Google OAuth is available
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const isGoogleOAuthEnabled = GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID.length > 0

const LoginPage = () => {
  const { login, loginWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address')
      return
    }
    if (!password.trim()) {
      setError('Please enter your password')
      return
    }

    const success = login(email, password.trim())
    if (!success) {
      setError('Invalid email or password')
      return
    }
    setEmail('')
    setPassword('')
  }

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: {
            Authorization: `Bearer ${tokenResponse.access_token}`
          }
        })
        if (!response.ok) {
          throw new Error('Failed to fetch user info')
        }
        const userInfo = await response.json()
        const success = loginWithGoogle(userInfo)
        if (!success) {
          setError('This email is not authorized. Please contact the admin.')
          return
        }
      } catch (error) {
        console.error('Error fetching Google user info:', error)
        setError('Failed to login with Google. Please try again.')
      }
    },
    onError: () => {
      setError('Failed to login with Google. Please try again.')
    },
    flow: 'implicit'
  })

  const handleGoogleLogin = () => {
    if (!isGoogleOAuthEnabled) {
      setError('Google OAuth is not configured. Please use email login.')
      return
    }
    try {
      googleLogin()
    } catch (error) {
      console.error('Google login error:', error)
      setError('Failed to login with Google. Please check your configuration.')
    }
  }

  return (
    <div className="page" style={{ maxWidth: '100%', padding: '2rem' }}>
      <div className="login-page">
        <div className="login-modal-content">
          <div className="login-logo">
            <img src="/logo.png?v=2" alt="Alamos IA" className="login-logo-image" />
          </div>
          <div className="login-header">
            <h2>Welcome to Alamos AI</h2>
            <p>Sign in to continue</p>
          </div>

          <form onSubmit={handleEmailLogin} className="login-form">
            <div className="form-group">
              <label htmlFor="login-email">Email Address</label>
            <div className="input-with-icon no-icon">
                <input
                  type="email"
                  id="login-email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setError('')
                  }}
                  placeholder="Enter your email"
                  className={error ? 'error' : ''}
                  required
                />
              </div>
              {error && <span className="error-message">{error}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <div className="input-with-icon no-icon">
                <input
                  type="password"
                  id="login-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError('')
                  }}
                  placeholder="Enter your password"
                  className={error ? 'error' : ''}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-primary btn-full">
              Continue with Email
            </button>
          </form>

          <div className="login-divider">
            <span>or</span>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="btn-google btn-full"
            disabled={!isGoogleOAuthEnabled}
            title={!isGoogleOAuthEnabled ? 'Google OAuth no está configurado. Crea un archivo .env con VITE_GOOGLE_CLIENT_ID' : ''}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
              <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.348 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {!isGoogleOAuthEnabled && (
            <p style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center', marginTop: '0.5rem' }}>
              Para habilitar Google login, crea un archivo <code>.env</code> con <code>VITE_GOOGLE_CLIENT_ID</code>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default LoginPage
