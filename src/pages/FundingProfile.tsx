import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Save,
  Trash2,
  Plus,
  Award,
  XCircle,
  Clock,
  Route as RouteIcon,
  History,
  Sparkles,
  RefreshCw,
  Briefcase,
  FileText,
} from 'lucide-react'
import './Page.css'
import './FundingProfile.css'

/* ============================================================
   Tipos
   ============================================================ */

type ProjectTypePreference = 'individual' | 'colaborativo' | 'ambos'
type AmountRange = '<100k' | '100k-500k' | '500k-2M' | '>2M'
type FundingHistoryStatus = 'won' | 'lost' | 'pending'

export interface FundingHistoryEntry {
  id: string
  name: string              // Nombre de la convocatoria/programa (ej. "Cervera 2024")
  organism: string          // Organismo concedente (ej. "CDTI")
  programme: string         // Programa específico (ej. "Cervera de Transferencia")
  year: number              // Año aplicado
  requestedAmount: number   // Importe solicitado €
  grantedAmount?: number    // Importe concedido € (si ganó)
  status: FundingHistoryStatus
  projectDescription: string // Descripción breve del proyecto
  source?: 'manual' | 'project' | 'proposal' // origen — útil para badge UI + para no re-importar
  sourceRefId?: string       // id del project/proposal de origen — evitar duplicados al re-importar
}

export interface FundingProfile {
  customerId: string
  // Campos NUEVOS (no en Customer ni en Context)
  coFinancingCapacityPercent: number       // 0-100
  preferredProjectType: ProjectTypePreference
  desiredAmountRange: AmountRange
  targetTRL: number                         // 1-9 — TRL objetivo en 2 años (Q2 de Teresa)
  fundingHistory: FundingHistoryEntry[]    // Histórico (rich 8 fields × N entradas)
  // Campos auto-rellenados leídos de Customer / CustomerContext (no editables aquí, solo display)
  // No los almacenamos aquí, los leemos en runtime al cargar la página.
  updatedAt: string
}

interface CustomerRow {
  id: string
  name: string
  company: string
  region?: string
  country?: string
  companySize?: string
  category?: string
  description?: string
}

interface ContextField { value: string; suggested?: boolean }
interface CustomerContextData {
  businessModel?: ContextField
  companyOverview?: ContextField
  technologyInnovation?: ContextField
  currentTRL?: ContextField
  rdiRoadmap?: ContextField
}

interface ProjectRow {
  id: string
  title: string
  call?: string
  callYear?: string
  fundingBody?: string
  budgetFunding?: string
  fee?: string
  status: string
  startDate?: string
  primaryClients: string[]
  secondaryClients?: string[]
  source: 'proposal' | 'service'
}

interface ProposalRow {
  id: string
  proposal: string
  call: string
  callId?: string
  budgetFunding: string
  fee: string
  status: string  // In Progress / Pending / Granted / Dismissed
  createdAt?: string
  primaryClients: string[]
  secondaryClients?: string[]
}

/* ============================================================
   Helpers
   ============================================================ */

const PROFILE_STORAGE_KEY = 'fundingProfiles'

const loadAllProfiles = (): Record<string, FundingProfile> => {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, FundingProfile>
  } catch {
    return {}
  }
}
const saveAllProfiles = (profiles: Record<string, FundingProfile>) => {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles))
}

const loadCustomer = (id: string): CustomerRow | null => {
  try {
    const raw = localStorage.getItem('customers')
    if (!raw) return null
    const list = JSON.parse(raw) as CustomerRow[]
    return list.find(c => c.id === id) || null
  } catch {
    return null
  }
}

const loadContextForCustomer = (id: string): CustomerContextData | null => {
  try {
    const raw = localStorage.getItem(`customer-context-${id}`)
    if (!raw) return null
    return JSON.parse(raw) as CustomerContextData
  } catch {
    return null
  }
}

const loadProjectsForCustomer = (id: string): ProjectRow[] => {
  try {
    const raw = localStorage.getItem('projects')
    if (!raw) return []
    const list = JSON.parse(raw) as ProjectRow[]
    return list.filter(p =>
      (p.primaryClients || []).includes(id) ||
      (p.secondaryClients || []).includes(id)
    )
  } catch {
    return []
  }
}

const loadProposalsForCustomer = (id: string): ProposalRow[] => {
  try {
    const raw = localStorage.getItem('proposals')
    if (!raw) return []
    const list = JSON.parse(raw) as ProposalRow[]
    return list.filter(p =>
      (p.primaryClients || []).includes(id) ||
      (p.secondaryClients || []).includes(id)
    )
  } catch {
    return []
  }
}

// Parsea importe en formato string (ej "€100,000" o "100k" o "100000") a número.
const parseAmountToNumber = (raw?: string): number => {
  if (!raw) return 0
  const cleaned = String(raw).replace(/[€$,.\s]/g, '').toUpperCase()
  if (cleaned.endsWith('K')) return Number(cleaned.replace('K', '')) * 1000
  if (cleaned.endsWith('M')) return Number(cleaned.replace('M', '')) * 1_000_000
  const n = Number(cleaned)
  return Number.isNaN(n) ? 0 : n
}

// Convierte un Project del CRM en una entrada de funding history (status WON por defecto —
// si el proyecto existe es porque la propuesta fue aceptada).
const projectToHistoryEntry = (p: ProjectRow): FundingHistoryEntry => {
  const year = p.callYear
    ? Number(p.callYear)
    : p.startDate ? new Date(p.startDate).getFullYear() : new Date().getFullYear()
  const requested = parseAmountToNumber(p.budgetFunding)
  return {
    id: `fh-from-project-${p.id}`,
    name: p.call || p.title || 'Project',
    organism: p.fundingBody || '',
    programme: p.call || '',
    year,
    requestedAmount: requested,
    grantedAmount: requested > 0 ? requested : undefined,
    status: 'won',
    projectDescription: p.title,
    source: 'project',
    sourceRefId: p.id,
  }
}

// Convierte una Proposal del CRM en entrada de funding history.
// status: Granted → won, Dismissed → lost, otro (In Progress/Pending) → pending
const proposalToHistoryEntry = (p: ProposalRow): FundingHistoryEntry => {
  const year = p.createdAt ? new Date(p.createdAt).getFullYear() : new Date().getFullYear()
  const requested = parseAmountToNumber(p.budgetFunding)
  let status: FundingHistoryStatus = 'pending'
  const st = (p.status || '').toLowerCase()
  if (st === 'granted') status = 'won'
  else if (st === 'dismissed') status = 'lost'
  return {
    id: `fh-from-proposal-${p.id}`,
    name: p.call || p.proposal,
    organism: '',
    programme: p.call || '',
    year,
    requestedAmount: requested,
    grantedAmount: status === 'won' && requested > 0 ? requested : undefined,
    status,
    projectDescription: p.proposal,
    source: 'proposal',
    sourceRefId: p.id,
  }
}

const blankProfile = (customerId: string): FundingProfile => ({
  customerId,
  coFinancingCapacityPercent: 25,
  preferredProjectType: 'ambos',
  desiredAmountRange: '100k-500k',
  targetTRL: 7,
  fundingHistory: [],
  updatedAt: new Date().toISOString(),
})

const newHistoryEntry = (): FundingHistoryEntry => ({
  id: `fh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: '',
  organism: '',
  programme: '',
  year: new Date().getFullYear(),
  requestedAmount: 0,
  grantedAmount: undefined,
  status: 'pending',
  projectDescription: '',
})

const formatEuroShort = (n: number): string => {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}K`
  return `€${n}`
}

/* ============================================================
   Componente
   ============================================================ */

const FundingProfilePage = () => {
  const { id: customerId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const customer = useMemo(() => (customerId ? loadCustomer(customerId) : null), [customerId])
  const context = useMemo(() => (customerId ? loadContextForCustomer(customerId) : null), [customerId])

  const [profile, setProfile] = useState<FundingProfile>(() => {
    if (!customerId) return blankProfile('')
    const all = loadAllProfiles()
    if (all[customerId]) return all[customerId]
    // No hay perfil guardado → arrancamos con los proyectos/proposals del CRM como seed
    const seed = blankProfile(customerId)
    const projects = loadProjectsForCustomer(customerId)
    const proposals = loadProposalsForCustomer(customerId)
    seed.fundingHistory = [
      ...projects.map(projectToHistoryEntry),
      ...proposals
        // Si la proposal generó un Project, ya lo tenemos. Evitamos duplicado.
        .filter(p => !projects.some(pr => pr.source === 'proposal' && pr.id.includes(p.id)))
        .map(proposalToHistoryEntry),
    ]
    return seed
  })

  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  useEffect(() => {
    if (savedMessage) {
      const t = setTimeout(() => setSavedMessage(null), 2500)
      return () => clearTimeout(t)
    }
  }, [savedMessage])

  /* ----------------------------------------------------------
     Save / Update handlers
     ---------------------------------------------------------- */

  const persist = (next: FundingProfile) => {
    setProfile(next)
    if (!customerId) return
    const all = loadAllProfiles()
    all[customerId] = { ...next, updatedAt: new Date().toISOString() }
    saveAllProfiles(all)
  }

  const handleSave = () => {
    persist(profile)
    setSavedMessage('Profile saved ✓')
  }

  const updateField = <K extends keyof FundingProfile>(key: K, value: FundingProfile[K]) => {
    persist({ ...profile, [key]: value })
  }

  const addHistory = () => {
    persist({ ...profile, fundingHistory: [...profile.fundingHistory, newHistoryEntry()] })
  }

  const reimportFromCRM = () => {
    if (!customerId) return
    const projects = loadProjectsForCustomer(customerId)
    const proposals = loadProposalsForCustomer(customerId)
    const existingRefs = new Set(
      profile.fundingHistory
        .filter(e => e.sourceRefId)
        .map(e => `${e.source}:${e.sourceRefId}`)
    )
    const newFromProjects = projects
      .map(projectToHistoryEntry)
      .filter(e => !existingRefs.has(`project:${e.sourceRefId}`))
    const newFromProposals = proposals
      .map(proposalToHistoryEntry)
      .filter(e => !existingRefs.has(`proposal:${e.sourceRefId}`))
    const added = [...newFromProjects, ...newFromProposals]
    if (added.length === 0) {
      setSavedMessage('Already in sync ✓')
      return
    }
    persist({ ...profile, fundingHistory: [...profile.fundingHistory, ...added] })
    setSavedMessage(`Imported ${added.length} from CRM ✓`)
  }
  const removeHistory = (entryId: string) => {
    persist({ ...profile, fundingHistory: profile.fundingHistory.filter(e => e.id !== entryId) })
  }
  const updateHistoryEntry = (entryId: string, patch: Partial<FundingHistoryEntry>) => {
    persist({
      ...profile,
      fundingHistory: profile.fundingHistory.map(e => (e.id === entryId ? { ...e, ...patch } : e)),
    })
  }

  const handleGenerateRoadmap = () => {
    persist(profile) // ensure latest saved before navigation
    if (!customerId) return
    navigate(`/roadmap/${customerId}`)
  }

  /* ----------------------------------------------------------
     Render
     ---------------------------------------------------------- */

  if (!customerId || !customer) {
    return (
      <div className="page page--funding-profile">
        <header className="page-header">
          <button className="btn-secondary" onClick={() => navigate('/customers')}>
            <ArrowLeft size={16} /> Back to Customers
          </button>
        </header>
        <div className="empty-state">Customer not found.</div>
      </div>
    )
  }

  const currentTRLValue = context?.currentTRL?.value || '—'
  const rdiRoadmapText = context?.rdiRoadmap?.value || ''
  const technologyText = context?.technologyInnovation?.value || ''
  const businessModelText = context?.businessModel?.value || ''

  return (
    <div className="page page--funding-profile">
      {/* ============== HEADER ============== */}
      <header className="fp-header">
        <div className="fp-header-left">
          <button className="back-btn" onClick={() => navigate(`/customers/${customerId}`)} aria-label="Back">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>Funding Profile</h1>
            <p>{customer.name} {customer.company && <span className="muted">· {customer.company}</span>}</p>
          </div>
        </div>
        <div className="fp-header-actions">
          {savedMessage && <span className="fp-saved-message">{savedMessage}</span>}
          <button className="btn-secondary" onClick={handleSave}>
            <Save size={16} /> Save
          </button>
          <button className="btn-primary" onClick={handleGenerateRoadmap}>
            <Sparkles size={16} /> Generate Roadmap
          </button>
        </div>
      </header>

      {/* ============== AUTO-DATA SUMMARY ============== */}
      <section className="fp-card fp-auto-card">
        <div className="fp-auto-header">
          <h2>Auto-data from Customer & Context</h2>
          <p className="muted">These fields are read from Customer profile and AI context. Edit them there.</p>
        </div>
        <div className="fp-auto-grid">
          <div><span className="fp-label">Country</span><span>{customer.country || '—'}</span></div>
          <div><span className="fp-label">Region</span><span>{customer.region || '—'}</span></div>
          <div><span className="fp-label">Size</span><span>{customer.companySize || '—'}</span></div>
          <div><span className="fp-label">Category</span><span>{customer.category || '—'}</span></div>
          <div><span className="fp-label">Current TRL</span><span className="fp-trl-badge">{currentTRLValue}</span></div>
        </div>
        {(technologyText || businessModelText || rdiRoadmapText) && (
          <details className="fp-auto-text">
            <summary>Tech & business context (read-only summary)</summary>
            {businessModelText && <p><strong>Business model:</strong> {businessModelText}</p>}
            {technologyText && <p><strong>Tech innovation:</strong> {technologyText}</p>}
            {rdiRoadmapText && <p><strong>R+D+i roadmap:</strong> {rdiRoadmapText}</p>}
          </details>
        )}
      </section>

      {/* ============== FUNDING PREFERENCES ============== */}
      <section className="fp-card">
        <div className="fp-section-header">
          <h2>Funding preferences</h2>
          <p className="muted">What kind of funding fits this client.</p>
        </div>

        <div className="fp-form-grid">
          <div className="fp-field">
            <label htmlFor="cofi">Co-financing capacity (%)</label>
            <div className="fp-slider-wrap">
              <input
                id="cofi"
                type="range"
                min={0}
                max={100}
                step={5}
                value={profile.coFinancingCapacityPercent}
                onChange={(e) => updateField('coFinancingCapacityPercent', Number(e.target.value))}
              />
              <span className="fp-slider-value">{profile.coFinancingCapacityPercent}%</span>
            </div>
            <small className="fp-hint">% of project budget the client can self-fund</small>
          </div>

          <div className="fp-field">
            <label htmlFor="trl-target">Target TRL (in 2 years)</label>
            <div className="fp-slider-wrap">
              <input
                id="trl-target"
                type="range"
                min={1}
                max={9}
                step={1}
                value={profile.targetTRL}
                onChange={(e) => updateField('targetTRL', Number(e.target.value))}
              />
              <span className="fp-slider-value">TRL {profile.targetTRL}</span>
            </div>
            <small className="fp-hint">Where they want their tech to be in 2 years</small>
          </div>

          <div className="fp-field">
            <label htmlFor="proj-type">Preferred project type</label>
            <select
              id="proj-type"
              value={profile.preferredProjectType}
              onChange={(e) => updateField('preferredProjectType', e.target.value as ProjectTypePreference)}
            >
              <option value="individual">Individual</option>
              <option value="colaborativo">Collaborative (consortium)</option>
              <option value="ambos">Both</option>
            </select>
            <small className="fp-hint">Individual vs in consortium with partners</small>
          </div>

          <div className="fp-field">
            <label htmlFor="amount">Desired amount range</label>
            <select
              id="amount"
              value={profile.desiredAmountRange}
              onChange={(e) => updateField('desiredAmountRange', e.target.value as AmountRange)}
            >
              <option value="<100k">&lt; €100K</option>
              <option value="100k-500k">€100K – €500K</option>
              <option value="500k-2M">€500K – €2M</option>
              <option value=">2M">&gt; €2M</option>
            </select>
            <small className="fp-hint">Orientative grant size per project</small>
          </div>
        </div>
      </section>

      {/* ============== FUNDING HISTORY ============== */}
      <section className="fp-card">
        <div className="fp-section-header fp-section-header--with-action">
          <div>
            <h2>
              <History size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Funding history
            </h2>
            <p className="muted">Previous applications (won, lost, pending). Auto-imported from CRM Projects + Proposals. You can edit, remove or add manually.</p>
          </div>
          <button
            type="button"
            className="btn-secondary btn-secondary--sm"
            onClick={reimportFromCRM}
            title="Look for new Projects/Proposals in CRM and add them as funding history entries"
          >
            <RefreshCw size={14} /> Re-import from CRM
          </button>
        </div>

        {profile.fundingHistory.length === 0 ? (
          <div className="fp-empty">No history yet. Add the first one.</div>
        ) : (
          <div className="fp-history-list">
            {profile.fundingHistory.map((entry) => (
              <div key={entry.id} className={`fp-history-entry fp-history-entry--${entry.status}`}>
                {entry.source && entry.source !== 'manual' && (
                  <div className="fp-history-source-badge">
                    {entry.source === 'project' ? (
                      <><Briefcase size={11} /> Imported from Project</>
                    ) : (
                      <><FileText size={11} /> Imported from Proposal</>
                    )}
                  </div>
                )}
                <div className="fp-history-row">
                  <div className="fp-history-field">
                    <label>Call name</label>
                    <input
                      type="text"
                      placeholder="e.g. Cervera 2024"
                      value={entry.name}
                      onChange={(e) => updateHistoryEntry(entry.id, { name: e.target.value })}
                    />
                  </div>
                  <div className="fp-history-field">
                    <label>Organism</label>
                    <input
                      type="text"
                      placeholder="e.g. CDTI"
                      value={entry.organism}
                      onChange={(e) => updateHistoryEntry(entry.id, { organism: e.target.value })}
                    />
                  </div>
                  <div className="fp-history-field">
                    <label>Programme</label>
                    <input
                      type="text"
                      placeholder="e.g. Cervera de Transferencia"
                      value={entry.programme}
                      onChange={(e) => updateHistoryEntry(entry.id, { programme: e.target.value })}
                    />
                  </div>
                  <div className="fp-history-field">
                    <label>Year</label>
                    <input
                      type="number"
                      min={2010}
                      max={2030}
                      value={entry.year}
                      onChange={(e) => updateHistoryEntry(entry.id, { year: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="fp-history-row">
                  <div className="fp-history-field">
                    <label>Requested (€)</label>
                    <input
                      type="number"
                      min={0}
                      value={entry.requestedAmount}
                      onChange={(e) => updateHistoryEntry(entry.id, { requestedAmount: Number(e.target.value) })}
                    />
                    <small>{formatEuroShort(entry.requestedAmount)}</small>
                  </div>
                  <div className="fp-history-field">
                    <label>Granted (€) <span className="muted">— if won</span></label>
                    <input
                      type="number"
                      min={0}
                      placeholder="—"
                      value={entry.grantedAmount ?? ''}
                      onChange={(e) => updateHistoryEntry(entry.id, {
                        grantedAmount: e.target.value === '' ? undefined : Number(e.target.value),
                      })}
                    />
                    {entry.grantedAmount !== undefined && <small>{formatEuroShort(entry.grantedAmount)}</small>}
                  </div>
                  <div className="fp-history-field">
                    <label>Status</label>
                    <select
                      value={entry.status}
                      onChange={(e) => updateHistoryEntry(entry.id, { status: e.target.value as FundingHistoryStatus })}
                    >
                      <option value="won">Won</option>
                      <option value="lost">Lost</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                  <div className="fp-history-field fp-history-field--icon">
                    {entry.status === 'won' && <Award size={20} className="fp-status-icon fp-status-icon--won" />}
                    {entry.status === 'lost' && <XCircle size={20} className="fp-status-icon fp-status-icon--lost" />}
                    {entry.status === 'pending' && <Clock size={20} className="fp-status-icon fp-status-icon--pending" />}
                  </div>
                </div>

                <div className="fp-history-row">
                  <div className="fp-history-field fp-history-field--full">
                    <label>Project description</label>
                    <textarea
                      rows={2}
                      placeholder="Short description of the project, technologies, outcomes…"
                      value={entry.projectDescription}
                      onChange={(e) => updateHistoryEntry(entry.id, { projectDescription: e.target.value })}
                    />
                  </div>
                </div>

                <div className="fp-history-row fp-history-actions">
                  <button
                    type="button"
                    className="btn-link-danger"
                    onClick={() => removeHistory(entry.id)}
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button type="button" className="btn-secondary" onClick={addHistory}>
          <Plus size={16} /> Add funding entry
        </button>
      </section>

      {/* ============== CTA ROADMAP ============== */}
      <section className="fp-cta">
        <div>
          <h2><RouteIcon size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} /> Ready to generate the roadmap?</h2>
          <p className="muted">We'll match this client against I+D+i opportunities (EU + national) and build a strategic timeline.</p>
        </div>
        <button className="btn-primary" onClick={handleGenerateRoadmap}>
          <Sparkles size={16} /> Generate Roadmap
        </button>
      </section>
    </div>
  )
}

export default FundingProfilePage
