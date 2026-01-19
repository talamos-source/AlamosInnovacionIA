import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './Page.css'

const CompanySettings = () => {
  const { user } = useAuth()
  const isAdmin = user?.role === 'Admin'
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    name: '',
    legalName: '',
    taxId: '',
    address: ''
  })

  useEffect(() => {
    const stored = localStorage.getItem('companySettings')
    if (!stored) return
    try {
      const parsed = JSON.parse(stored)
      setFormData({
        name: parsed?.name || '',
        legalName: parsed?.legalName || '',
        taxId: parsed?.taxId || '',
        address: parsed?.address || ''
      })
    } catch {
      // ignore
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    localStorage.setItem('companySettings', JSON.stringify(formData))
    navigate('/admin')
  }

  if (!isAdmin) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Company Settings</h1>
          </div>
        </div>
        <div className="empty-state">You do not have access to this panel.</div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Company Settings</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="form-section">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="company-name">Name</label>
            <input
              id="company-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Company name"
            />
          </div>
          <div className="form-group">
            <label htmlFor="company-legal-name">Legal Name</label>
            <input
              id="company-legal-name"
              type="text"
              value={formData.legalName}
              onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
              placeholder="Legal name"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="company-tax-id">Tax ID</label>
            <input
              id="company-tax-id"
              type="text"
              value={formData.taxId}
              onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
              placeholder="Tax ID"
            />
          </div>
          <div className="form-group">
            <label htmlFor="company-address">Address</label>
            <input
              id="company-address"
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Address"
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary">
            Save Changes
          </button>
        </div>
      </form>
    </div>
  )
}

export default CompanySettings
