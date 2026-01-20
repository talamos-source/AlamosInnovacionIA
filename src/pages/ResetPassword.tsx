import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import './Page.css'

const API_BASE = import.meta.env.VITE_API_URL || 'https://alamosinnovacionia.onrender.com'

const ResetPassword = () => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const email = searchParams.get('email') || ''

  const [requestEmail, setRequestEmail] = useState(email)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!requestEmail.trim()) {
      setError('Please enter your email address')
      return
    }

    try {
      const response = await fetch(`${API_BASE}/auth/forgot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: requestEmail.trim() })
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setError(data?.error || 'Unable to send reset email. Try again.')
        return
      }
      setSuccess('If your email exists, we sent you a reset link.')
    } catch (err) {
      setError('Network error. Please try again.')
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!newPassword.trim()) {
      setError('Please enter a new password')
      return
    }
    if (newPassword.trim() !== confirmPassword.trim()) {
      setError('Passwords do not match')
      return
    }

    try {
      const response = await fetch(`${API_BASE}/auth/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: newPassword.trim() })
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setError(data?.error || 'Unable to reset password. Try again.')
        return
      }
      setSuccess('Password updated. You can now sign in.')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError('Network error. Please try again.')
    }
  }

  return (
    <div className="page" style={{ maxWidth: '100%', padding: '2rem' }}>
      <div className="login-page">
        <div className="login-modal-content">
          <div className="login-header">
            <h2>{token ? 'Set a new password' : 'Reset your password'}</h2>
            <p>{token ? 'Choose a new password below.' : 'We will email you a reset link.'}</p>
          </div>

          {token ? (
            <form onSubmit={handleResetPassword} className="login-form">
              {email && (
                <div className="form-group">
                  <label htmlFor="reset-email">Email</label>
                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    readOnly
                    disabled
                  />
                </div>
              )}
              <div className="form-group">
                <label htmlFor="new-password">New Password</label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="confirm-password">Confirm Password</label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                />
              </div>
              {error && <span className="error-message">{error}</span>}
              {success && <span className="success-message">{success}</span>}
              <button type="submit" className="btn-primary btn-full">
                Update Password
              </button>
            </form>
          ) : (
            <form onSubmit={handleRequestReset} className="login-form">
              <div className="form-group">
                <label htmlFor="request-email">Email Address</label>
                <input
                  id="request-email"
                  type="email"
                  value={requestEmail}
                  onChange={(e) => setRequestEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                />
              </div>
              {error && <span className="error-message">{error}</span>}
              {success && <span className="success-message">{success}</span>}
              <button type="submit" className="btn-primary btn-full">
                Send Reset Link
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default ResetPassword
