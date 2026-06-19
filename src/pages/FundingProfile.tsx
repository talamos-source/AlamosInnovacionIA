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
// Estados que reflejan el flujo del CRM Álamos:
//  · in-progress: propuesta en redacción
//  · pending: propuesta enviada, esperando resolución
//  · won: propuesta concedida (pasa a Proyecto automáticamente en el CRM)
//  · lost: propuesta no concedida (dismissed)
type FundingHistoryStatus = 'in-progress' | 'pending' | 'won' | 'lost'
// Sub-estado de ejecución para los proyectos (solo cuando status === 'won'):
//  · ongoing: proyecto en ejecución
//  · ended: proyecto terminado
type ExecutionStatus = 'ongoing' | 'ended'

export interface FundingHistoryEntry {
  id: string
  name: string              // Nombre de la convocatoria/programa (ej. "Cervera 2024")
  organism: string          // Organismo concedente (ej. "CDTI")
  programme: string         // Programa específico (ej. "Cervera de Transferencia")
  year: number              // Año aplicado
  requestedAmount: number   // Importe solicitado €
  grantedAmount?: number    // Importe concedido € (si ganó)
  status: FundingHistoryStatus
  executionStatus?: ExecutionStatus // Solo aplica si status === 'won' y se ejecutó como proyecto
  projectDescription: string // Descripción breve del proyecto
  source?: 'manual' | 'project' | 'proposal' // origen — útil para badge UI + para no re-importar
  sourceRefId?: string       // id del project/proposal de origen — evitar duplicados al re-importar
}

/** Línea tecnológica con TRL actual y objetivo. Permite reflejar que una empresa
 * puede tener varias tecnologías en distintos estados de madurez simultáneamente. */
export interface TRLLine {
  id: string
  technology: string  // ej. "IA logística", "Blockchain trazabilidad"
  currentTRL: number  // 1-9
  targetTRL: number   // 1-9 — TRL objetivo en el horizonte del roadmap
  notes?: string
}

export interface FundingProfile {
  customerId: string
  // Campos NUEVOS (no en Customer ni en Context)
  coFinancingCapacityPercent: number       // 0-100
  preferredProjectType: ProjectTypePreference
  desiredAmountRange: AmountRange
  /** @deprecated mantener por compat — usar trlProfile */
  targetTRL?: number
  /** Multi-tecnología: una empresa puede tener varias líneas con distintos TRL */
  trlProfile: TRLLine[]
  fundingHistory: FundingHistoryEntry[]
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

// Convierte un Project del CRM en entrada de funding history.
// Si existe un Project es porque su Proposal fue ganada → status: 'won'.
// El executionStatus lee el status real del proyecto:
//   'ongoing' (en ejecución) | 'ended' (terminado).
const projectToHistoryEntry = (p: ProjectRow): FundingHistoryEntry => {
  const year = p.callYear
    ? Number(p.callYear)
    : p.startDate ? new Date(p.startDate).getFullYear() : new Date().getFullYear()
  const requested = parseAmountToNumber(p.budgetFunding)
  const rawStatus = (p.status || '').toLowerCase().trim()
  let executionStatus: ExecutionStatus | undefined
  if (rawStatus === 'ended' || rawStatus === 'finished' || rawStatus === 'completed') executionStatus = 'ended'
  else if (rawStatus === 'ongoing' || rawStatus === 'in execution' || rawStatus === 'active') executionStatus = 'ongoing'
  // Si BaseProject no tuviera un estado reconocido, dejamos executionStatus indefinido
  return {
    id: `fh-from-project-${p.id}`,
    name: p.call || p.title || 'Project',
    organism: p.fundingBody || '',
    programme: p.call || '',
    year,
    requestedAmount: requested,
    grantedAmount: requested > 0 ? requested : undefined,
    status: 'won',
    executionStatus,
    projectDescription: p.title,
    source: 'project',
    sourceRefId: p.id,
  }
}

// Convierte una Proposal del CRM en entrada de funding history.
// Mapping según flujo Álamos:
//   'in progress' → in-progress   (propuesta en redacción)
//   'pending'     → pending       (propuesta enviada, esperando)
//   'granted'     → won           (debería ya tener Project, raro verlo aquí)
//   'dismissed'   → lost          (perdida)
const proposalToHistoryEntry = (p: ProposalRow): FundingHistoryEntry => {
  const year = p.createdAt ? new Date(p.createdAt).getFullYear() : new Date().getFullYear()
  const requested = parseAmountToNumber(p.budgetFunding)
  let status: FundingHistoryStatus = 'pending'
  const st = (p.status || '').toLowerCase().trim()
  if (st === 'granted') status = 'won'
  else if (st === 'dismissed') status = 'lost'
  else if (st === 'in progress' || st === 'in-progress') status = 'in-progress'
  else if (st === 'pending') status = 'pending'
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
  trlProfile: [], // empieza vacío — usuario añade líneas
  fundingHistory: [],
  updatedAt: new Date().toISOString(),
})

const newTRLLine = (): TRLLine => ({
  id: `trl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  technology: '',
  currentTRL: 5,
  targetTRL: 7,
  notes: '',
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
    if (all[customerId]) {
      const existing = all[customerId]
      // Migración: si el profile viejo solo tiene targetTRL (single) y no trlProfile,
      // creamos una línea por defecto para no perder el dato.
      if (!Array.isArray(existing.trlProfile)) {
        existing.trlProfile = existing.targetTRL
          ? [{
              id: `trl-migrated-${Date.now()}`,
              technology: 'General R+D+i',
              currentTRL: 5,
              targetTRL: existing.targetTRL,
              notes: 'Migrated from legacy single-TRL profile',
            }]
          : []
      }
      return existing
    }
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

  const addTRLLine = () => {
    persist({ ...profile, trlProfile: [...(profile.trlProfile || []), newTRLLine()] })
  }
  const removeTRLLine = (id: string) => {
    persist({ ...profile, trlProfile: (profile.trlProfile || []).filter(l => l.id !== id) })
  }
  const updateTRLLine = (id: string, patch: Partial<TRLLine>) => {
    persist({
      ...profile,
      trlProfile: (profile.trlProfile || []).map(l => (l.id === id ? { ...l, ...patch } : l)),
    })
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

      {/* ============== TRL PROFILE (multi-tecnología) ============== */}
      <section className="fp-card">
        <div className="fp-section-header fp-section-header--with-action">
          <div>
            <h2>Technology lines &amp; TRL</h2>
            <p className="muted">
              A company often has multiple technology lines at different TRLs simultaneously
              (e.g. AI logistics at TRL 7, blockchain trazabilidad at TRL 4, IoT pilots at TRL 3).
              Add each separately so the AI matches calls to the right TRL band per line.
            </p>
          </div>
          <button type="button" className="btn-secondary btn-secondary--sm" onClick={addTRLLine}>
            <Plus size={14} /> Add technology line
          </button>
        </div>

        {(profile.trlProfile || []).length === 0 ? (
          <div className="fp-empty">
            No technology lines defined yet. Add at least one to help the AI match calls accurately by TRL.
          </div>
        ) : (
          <div className="fp-trl-list">
            {(profile.trlProfile || []).map((line) => (
              <div key={line.id} className="fp-trl-entry">
                <div className="fp-trl-row">
                  <div className="fp-trl-field fp-trl-field--name">
                    <label>Technology / line name</label>
                    <input
                      type="text"
                      placeholder="e.g. AI for last-mile logistics"
                      value={line.technology}
                      onChange={(e) => updateTRLLine(line.id, { technology: e.target.value })}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-link-danger"
                    onClick={() => removeTRLLine(line.id)}
                    title="Remove this line"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="fp-trl-row fp-trl-sliders">
                  <div className="fp-trl-field">
                    <label>Current TRL</label>
                    <div className="fp-slider-wrap">
                      <input
                        type="range"
                        min={1}
                        max={9}
                        step={1}
                        value={line.currentTRL}
                        onChange={(e) => updateTRLLine(line.id, { currentTRL: Number(e.target.value) })}
                      />
                      <span className="fp-slider-value">TRL {line.currentTRL}</span>
                    </div>
                  </div>
                  <div className="fp-trl-field">
                    <label>Target TRL (in horizon)</label>
                    <div className="fp-slider-wrap">
                      <input
                        type="range"
                        min={1}
                        max={9}
                        step={1}
                        value={line.targetTRL}
                        onChange={(e) => updateTRLLine(line.id, { targetTRL: Number(e.target.value) })}
                      />
                      <span className="fp-slider-value">TRL {line.targetTRL}</span>
                    </div>
                  </div>
                </div>
                <div className="fp-trl-row">
                  <div className="fp-trl-field fp-trl-field--full">
                    <label>Notes (optional)</label>
                    <input
                      type="text"
                      placeholder="Brief context about this tech line"
                      value={line.notes || ''}
                      onChange={(e) => updateTRLLine(line.id, { notes: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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
                    <label>Application status</label>
                    <select
                      value={entry.status}
                      onChange={(e) => {
                        const newStatus = e.target.value as FundingHistoryStatus
                        // Si cambia a algo distinto de 'won', limpia executionStatus
                        updateHistoryEntry(entry.id, {
                          status: newStatus,
                          executionStatus: newStatus === 'won' ? entry.executionStatus : undefined,
                        })
                      }}
                    >
                      <option value="in-progress">In progress (drafting)</option>
                      <option value="pending">Pending (submitted)</option>
                      <option value="won">Won</option>
                      <option value="lost">Lost</option>
                    </select>
                  </div>
                  {entry.status === 'won' && (
                    <div className="fp-history-field">
                      <label>Project status</label>
                      <select
                        value={entry.executionStatus || ''}
                        onChange={(e) => updateHistoryEntry(entry.id, {
                          executionStatus: (e.target.value || undefined) as ExecutionStatus | undefined,
                        })}
                      >
                        <option value="">—</option>
                        <option value="ongoing">Ongoing</option>
                        <option value="ended">Ended</option>
                      </select>
                    </div>
                  )}
                  <div className="fp-history-field fp-history-field--icon">
                    {entry.status === 'won' && <Award size={20} className="fp-status-icon fp-status-icon--won" />}
                    {entry.status === 'lost' && <XCircle size={20} className="fp-status-icon fp-status-icon--lost" />}
                    {entry.status === 'pending' && <Clock size={20} className="fp-status-icon fp-status-icon--pending" />}
                    {entry.status === 'in-progress' && <Sparkles size={20} className="fp-status-icon fp-status-icon--inprogress" />}
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
