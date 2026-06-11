import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, X, ExternalLink, Calendar, ChevronDown, ChevronUp } from 'lucide-react'
import type { DiscoveryCall } from './Discovery'
import './Page.css'
import './Discovery.css'
import './DiscoveryImport.css'

/* ============================================================
   Tipos auxiliares
   ============================================================ */

interface CallFormData {
  name: string
  fundingBody: string
  program: string
  openDate: string
  closeDate: string
  status: 'Open' | 'Upcoming' | 'Closed'
  budget: string
  aidType: 'Grant' | 'Loan' | 'Mixed' | 'Tax Credit'
  geographicScope: 'European' | 'National' | 'Regional' | 'International'
  sourceUrl: string
  description: string
  publishToWeb: boolean
  featuredOnHomepage: boolean
}

interface ExistingCall {
  id: string
  name: string
  status: string
  deadline?: string
  fundingBody?: string
  program?: string
  budget?: string
  url?: string
  description?: string
  createdAt?: string
  source?: string
  externalId?: string
}

/* ============================================================
   Helpers
   ============================================================ */

const loadDiscoveryCall = (id: string): DiscoveryCall | null => {
  try {
    const raw = localStorage.getItem('discoveryCalls')
    const all: DiscoveryCall[] = raw ? JSON.parse(raw) : []
    return all.find(c => c.id === id) || null
  } catch {
    return null
  }
}

const saveDiscoveryCalls = (calls: DiscoveryCall[]) => {
  localStorage.setItem('discoveryCalls', JSON.stringify(calls))
  localStorage.setItem('appDataUpdatedAt', new Date().toISOString())
}

const loadCalls = (): ExistingCall[] => {
  try {
    const raw = localStorage.getItem('calls')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const saveCalls = (calls: ExistingCall[]) => {
  localStorage.setItem('calls', JSON.stringify(calls))
  localStorage.setItem('appDataUpdatedAt', new Date().toISOString())
}

const toInputDate = (dateStr?: string): string => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return ''
    return d.toISOString().split('T')[0]
  } catch {
    return ''
  }
}

const daysFromNow = (dateStr?: string): number | null => {
  if (!dateStr) return null
  const target = new Date(dateStr)
  if (Number.isNaN(target.getTime())) return null
  return Math.floor((target.getTime() - Date.now()) / 86400000)
}

const formatDateShort = (dateStr?: string): string => {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-GB')
  } catch {
    return dateStr
  }
}

const externalStatusToFormStatus = (s: string): 'Open' | 'Upcoming' | 'Closed' => {
  if (s === 'open') return 'Open'
  if (s === 'forthcoming') return 'Upcoming'
  if (s === 'closed') return 'Closed'
  return 'Open'
}

/* ============================================================
   Componente
   ============================================================ */

const DiscoveryImport = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [call, setCall] = useState<DiscoveryCall | null>(null)
  const [form, setForm] = useState<CallFormData | null>(null)
  const [additionalOpen, setAdditionalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const c = loadDiscoveryCall(id)
    if (!c) {
      setError('Discovery call not found')
      return
    }
    setCall(c)
    setForm({
      name: c.title,
      fundingBody: c.fundingBody,
      program: c.program,
      openDate: toInputDate(c.openDate),
      closeDate: toInputDate(c.closeDate),
      status: externalStatusToFormStatus(c.externalStatus),
      budget: c.budget || '',
      aidType: c.aidType || 'Grant',
      geographicScope: c.geographicScope || (c.source === 'EU_PORTAL' ? 'European' : 'National'),
      sourceUrl: c.url,
      description: c.description || '',
      publishToWeb: false,
      featuredOnHomepage: false,
    })
  }, [id])

  const updateField = <K extends keyof CallFormData>(key: K, value: CallFormData[K]) => {
    setForm(prev => (prev ? { ...prev, [key]: value } : prev))
  }

  const handleDismiss = () => {
    if (!call) return
    const all: DiscoveryCall[] = JSON.parse(localStorage.getItem('discoveryCalls') || '[]')
    const updated = all.map(c => c.id === call.id ? { ...c, userStatus: 'dismissed' as const } : c)
    saveDiscoveryCalls(updated)
    navigate('/discovery')
  }

  const handleImport = () => {
    if (!call || !form) return
    if (!form.name.trim()) {
      setError('Call Name is required')
      return
    }
    if (!form.fundingBody.trim()) {
      setError('Funding Body is required')
      return
    }

    // 1) Create new entry in 'calls' module
    const existing = loadCalls()
    const newCall: ExistingCall = {
      id: `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: form.name.trim(),
      status: form.status,
      deadline: form.closeDate || undefined,
      fundingBody: form.fundingBody.trim() || undefined,
      program: form.program.trim() || undefined,
      budget: form.budget.trim() || undefined,
      url: form.sourceUrl.trim() || undefined,
      description: form.description.trim() || undefined,
      createdAt: new Date().toISOString(),
      source: call.source,
      externalId: call.externalId,
    }
    saveCalls([...existing, newCall])

    // 2) Mark discovery call as imported
    const allDisc: DiscoveryCall[] = JSON.parse(localStorage.getItem('discoveryCalls') || '[]')
    const updated = allDisc.map(c =>
      c.id === call.id
        ? { ...c, userStatus: 'imported' as const, importedToCallId: newCall.id, importedAt: new Date().toISOString() }
        : c
    )
    saveDiscoveryCalls(updated)

    navigate('/calls')
  }

  if (error) {
    return (
      <div className="page page--discovery-import">
        <div className="empty-row">{error}</div>
        <button className="btn-secondary" onClick={() => navigate('/discovery')}>← Back to Discovery</button>
      </div>
    )
  }

  if (!call || !form) {
    return (
      <div className="page page--discovery-import">
        <div className="empty-row">Loading…</div>
      </div>
    )
  }

  const dDays = daysFromNow(call.closeDate)

  return (
    <div className="page page--discovery-import">
      {/* HEADER */}
      <header className="di-header">
        <div className="di-header-left">
          <button type="button" className="di-back-btn" onClick={() => navigate('/discovery')}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>Import to Calls</h1>
            <p>Review and customize before importing</p>
          </div>
        </div>
        <div className="di-header-actions">
          <button type="button" className="btn-secondary" onClick={handleDismiss}>
            <X size={14} />
            <span>Dismiss</span>
          </button>
          <button type="button" className="btn-primary" onClick={handleImport}>
            <Check size={14} />
            <span>Import to Calls</span>
          </button>
        </div>
      </header>

      <div className="di-layout">
        {/* LEFT — Call Information form */}
        <main className="di-main">
          <section className="surface-card di-section">
            <header className="di-section-header"><h2>Call Information</h2></header>

            <div className="di-form">
              <div className="di-field di-field--full">
                <label htmlFor="di-name">Call Name <span className="required">*</span></label>
                <input
                  id="di-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                />
              </div>

              <div className="di-row di-row--2">
                <div className="di-field">
                  <label htmlFor="di-funding">Funding Body <span className="required">*</span></label>
                  <input
                    id="di-funding"
                    type="text"
                    value={form.fundingBody}
                    onChange={(e) => updateField('fundingBody', e.target.value)}
                  />
                </div>
                <div className="di-field">
                  <label htmlFor="di-program">Program</label>
                  <input
                    id="di-program"
                    type="text"
                    value={form.program}
                    onChange={(e) => updateField('program', e.target.value)}
                  />
                </div>
              </div>

              <div className="di-row di-row--3">
                <div className="di-field">
                  <label htmlFor="di-open">Open Date</label>
                  <input id="di-open" type="date" value={form.openDate} onChange={(e) => updateField('openDate', e.target.value)} />
                </div>
                <div className="di-field">
                  <label htmlFor="di-close">Close Date</label>
                  <input id="di-close" type="date" value={form.closeDate} onChange={(e) => updateField('closeDate', e.target.value)} />
                </div>
                <div className="di-field">
                  <label htmlFor="di-status">Status</label>
                  <select id="di-status" value={form.status} onChange={(e) => updateField('status', e.target.value as CallFormData['status'])}>
                    <option value="Open">Open</option>
                    <option value="Upcoming">Upcoming</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="di-row di-row--3">
                <div className="di-field">
                  <label htmlFor="di-budget">Budget (€)</label>
                  <input id="di-budget" type="text" placeholder="e.g., 5000000" value={form.budget} onChange={(e) => updateField('budget', e.target.value)} />
                </div>
                <div className="di-field">
                  <label htmlFor="di-aid">Aid Type</label>
                  <select id="di-aid" value={form.aidType} onChange={(e) => updateField('aidType', e.target.value as CallFormData['aidType'])}>
                    <option value="Grant">Grant</option>
                    <option value="Loan">Loan</option>
                    <option value="Mixed">Mixed</option>
                    <option value="Tax Credit">Tax Credit</option>
                  </select>
                </div>
                <div className="di-field">
                  <label htmlFor="di-geo">Geographic Scope</label>
                  <select id="di-geo" value={form.geographicScope} onChange={(e) => updateField('geographicScope', e.target.value as CallFormData['geographicScope'])}>
                    <option value="European">European</option>
                    <option value="National">National</option>
                    <option value="Regional">Regional</option>
                    <option value="International">International</option>
                  </select>
                </div>
              </div>

              <div className="di-field di-field--full">
                <label htmlFor="di-url">Source URL</label>
                <input id="di-url" type="url" value={form.sourceUrl} onChange={(e) => updateField('sourceUrl', e.target.value)} />
              </div>
            </div>
          </section>

          {/* ADDITIONAL DETAILS (collapsible) */}
          <section className="surface-card di-section">
            <button type="button" className="di-collapsible-trigger" onClick={() => setAdditionalOpen(!additionalOpen)}>
              <h2>Additional Details</h2>
              {additionalOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {additionalOpen && (
              <div className="di-form di-form--padded">
                <div className="di-field di-field--full">
                  <label htmlFor="di-desc">Description</label>
                  <textarea
                    id="di-desc"
                    rows={6}
                    value={form.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    placeholder="Optional description for internal use"
                  />
                </div>
              </div>
            )}
          </section>

          {/* WEB PUBLISHING */}
          <section className="surface-card di-section">
            <header className="di-section-header"><h2>Web Publishing</h2></header>
            <div className="di-checkbox-list">
              <label className="di-checkbox-row">
                <input type="checkbox" checked={form.publishToWeb} onChange={(e) => updateField('publishToWeb', e.target.checked)} />
                <span>Publish to public website</span>
              </label>
              <label className="di-checkbox-row">
                <input type="checkbox" checked={form.featuredOnHomepage} onChange={(e) => updateField('featuredOnHomepage', e.target.checked)} />
                <span>Featured on homepage</span>
              </label>
            </div>
          </section>
        </main>

        {/* RIGHT — Source Information */}
        <aside className="di-sidebar">
          <section className="surface-card di-section">
            <header className="di-section-header"><h2>Source Information</h2></header>
            <div className="di-source-meta">
              <div className="di-meta-row">
                <span className="di-meta-label">Source</span>
                <span className="di-meta-source">
                  <span className="di-meta-source-dot" />
                  {call.source === 'EU_PORTAL' ? 'EU Funding & Tenders Portal' : 'BDNS – Spanish National Grants'}
                </span>
              </div>
              <div className="di-meta-row">
                <span className="di-meta-label">Deadline</span>
                <span className="di-meta-value">
                  <Calendar size={14} />
                  {formatDateShort(call.closeDate)}
                  {dDays !== null && <span className="di-meta-rel"> ({dDays} days)</span>}
                </span>
              </div>
              <div className="di-meta-row">
                <span className="di-meta-label">Discovered</span>
                <span className="di-meta-value">{formatDateShort(call.discoveredAt)}</span>
              </div>
              {call.url && (
                <a href={call.url} target="_blank" rel="noopener noreferrer" className="di-view-original">
                  <ExternalLink size={14} />
                  View Original
                </a>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

export default DiscoveryImport
