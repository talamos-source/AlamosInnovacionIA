import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, LayoutGrid, Activity, Coins, FileText, Calendar,
  Users, AlertTriangle, CheckCircle2, Clock,
  FileCheck, MessageSquare, Plus, Sparkles,
} from 'lucide-react'
import { formatCurrency } from '../utils/formatCurrency'
import './Page.css'
import './ProjectDetail.css'

/* ============================================================
   Tipos mínimos (replicados de Projects.tsx para autonomía)
   ============================================================ */

interface BillingItem {
  id: string
  percentage: string
  clientName: string
  dueDate: string
  amount: string
  invoiceStatus: string
  description?: string
}

interface Task {
  id: string
  title: string
  description?: string
  dueDate: string
  priority?: 'Low' | 'Medium' | 'High'
  status?: 'Pending' | 'In progress' | 'Completed'
}

interface Project {
  id: string
  title: string
  source: 'proposal' | 'service'
  sourceId: string
  call?: string
  callId?: string
  callYear?: string
  fundingBody?: string
  service?: string
  primaryClients: string[]
  secondaryClients?: string[]
  budgetFunding?: string
  fee?: string
  status: string
  startDate?: string
  endDate?: string
  paymentConditions?: string
  createdAt: string
  billingSchedule?: BillingItem[]
  tasks?: Task[]
}

interface Customer {
  id: string
  name: string
  category?: string
}

/* ============================================================
   Helpers
   ============================================================ */

const parseDate = (s?: string): Date | null => {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

const formatDateShort = (s?: string): string => {
  const d = parseDate(s)
  if (!d) return '—'
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

const daysBetween = (from: Date, to: Date): number => {
  return Math.floor((to.getTime() - from.getTime()) / 86400000)
}

const loadProject = (id: string): Project | null => {
  try {
    const raw = localStorage.getItem('projects')
    if (!raw) return null
    const list: Project[] = JSON.parse(raw)
    return list.find(p => p.id === id) || null
  } catch { return null }
}

const loadCustomers = (): Customer[] => {
  try {
    const raw = localStorage.getItem('customers')
    if (!raw) return []
    return JSON.parse(raw)
  } catch { return [] }
}

/* ============================================================
   Componente
   ============================================================ */

type Section = 'overview' | 'execution' | 'annuities' | 'documents' | 'meetings'

const SECTIONS: Array<{ key: Section; label: string; icon: typeof LayoutGrid }> = [
  { key: 'overview',   label: 'Overview',   icon: LayoutGrid },
  { key: 'execution',  label: 'Execution',  icon: Activity },
  { key: 'annuities',  label: 'Annuities',  icon: Coins },
  { key: 'documents',  label: 'Documents',  icon: FileText },
  { key: 'meetings',   label: 'Meetings',   icon: MessageSquare },
]

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [project, setProject] = useState<Project | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const tabParam = (searchParams.get('tab') as Section) || 'overview'
  const [activeSection, setActiveSection] = useState<Section>(
    SECTIONS.some(s => s.key === tabParam) ? tabParam : 'overview'
  )

  useEffect(() => {
    if (!id) return
    setProject(loadProject(id))
    setCustomers(loadCustomers())
  }, [id])

  useEffect(() => {
    if (activeSection !== tabParam) {
      const next = new URLSearchParams(searchParams)
      next.set('tab', activeSection)
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection])

  const clientName = useMemo(() => {
    if (!project || project.primaryClients.length === 0) return '—'
    const c = customers.find(x => x.id === project.primaryClients[0])
    return c?.name || '—'
  }, [project, customers])

  /* ---- KPIs Overview ---- */
  const overviewKpis = useMemo(() => {
    if (!project) return null
    const today = new Date()
    const start = parseDate(project.startDate)
    const end = parseDate(project.endDate)

    // Schedule
    let scheduleScore = 100
    let scheduleLabel = 'On track'
    if (end) {
      const dDays = daysBetween(today, end)
      if (dDays < 0) {
        scheduleScore = 30
        scheduleLabel = `${Math.abs(dDays)} d overdue`
      } else if (dDays <= 30) {
        scheduleScore = 60
        scheduleLabel = `${dDays} d remaining`
      } else if (dDays <= 90) {
        scheduleScore = 80
        scheduleLabel = 'Approaching'
      }
    }

    // Justification (basado en tasks completadas vs totales)
    const totalTasks = (project.tasks || []).length
    const doneTasks = (project.tasks || []).filter(t => t.status === 'Completed').length
    const justificationPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

    // Administration (% facturas pagadas vs total)
    const totalBilling = (project.billingSchedule || []).length
    const paidBilling = (project.billingSchedule || []).filter(b => b.invoiceStatus === 'Paid').length
    const adminPct = totalBilling > 0 ? Math.round((paidBilling / totalBilling) * 100) : 100

    // Alerts
    const alerts: string[] = []
    if (end && daysBetween(today, end) < 0) alerts.push(`Project ended ${Math.abs(daysBetween(today, end))}d ago`)
    const overdueTasks = (project.tasks || []).filter(t =>
      t.status !== 'Completed' && parseDate(t.dueDate) && daysBetween(today, parseDate(t.dueDate)!) < 0
    ).length
    if (overdueTasks > 0) alerts.push(`${overdueTasks} task(s) overdue`)
    const pendingBilling = (project.billingSchedule || []).filter(b =>
      b.invoiceStatus !== 'Paid' && parseDate(b.dueDate) && daysBetween(today, parseDate(b.dueDate)!) < 0
    ).length
    if (pendingBilling > 0) alerts.push(`${pendingBilling} bill(s) overdue`)

    // Health score (weighted)
    const health = Math.round((scheduleScore * 0.4) + (justificationPct * 0.3) + (adminPct * 0.3))

    return {
      health,
      schedule: { score: scheduleScore, label: scheduleLabel },
      justification: { pct: justificationPct, done: doneTasks, total: totalTasks },
      administration: { pct: adminPct, paid: paidBilling, total: totalBilling },
      alerts,
      start, end,
    }
  }, [project])

  if (!id) {
    return <div className="page"><p>Proyecto no encontrado.</p></div>
  }
  if (!project) {
    return (
      <div className="page">
        <button onClick={() => navigate('/projects')} className="pd-back">
          <ArrowLeft size={14} /> Back to projects
        </button>
        <p style={{ padding: 32, color: 'var(--color-text-muted)' }}>
          Cargando proyecto o no encontrado…
        </p>
      </div>
    )
  }

  /* ============================================================
     Render
     ============================================================ */

  const statusBadge = project.status === 'Ongoing' ? 'IN EXECUTION'
    : project.status === 'Ended' ? 'CLOSED' : project.status.toUpperCase()
  const statusClass = project.status === 'Ongoing' ? 'ok'
    : project.status === 'Ended' ? 'muted' : 'warn'

  return (
    <div className="pd-page">
      {/* TOP BAR — breadcrumb */}
      <div className="pd-breadcrumb">
        <button onClick={() => navigate('/projects')} className="pd-back">
          <ArrowLeft size={14} /> Projects
        </button>
        <span className="pd-bread-sep">/</span>
        <span className="pd-bread-current">{project.title}</span>
      </div>

      {/* LAYOUT: sidebar + main */}
      <div className="pd-layout">
        {/* SIDEBAR menú */}
        <aside className="pd-sidebar">
          <div className="pd-sidebar-section-label">MAIN MENU</div>
          {SECTIONS.map(s => {
            const Icon = s.icon
            return (
              <button
                key={s.key}
                type="button"
                className={`pd-sidebar-item ${activeSection === s.key ? 'active' : ''}`}
                onClick={() => setActiveSection(s.key)}
              >
                <Icon size={15} />
                <span>{s.label}</span>
              </button>
            )
          })}
        </aside>

        {/* MAIN */}
        <main className="pd-main">
          {/* HEADER del proyecto */}
          <header className="pd-header">
            <div className="pd-header-title-row">
              <h1>{project.title}</h1>
              <span className={`pd-status-badge pd-status-badge--${statusClass}`}>
                {statusBadge}
              </span>
            </div>
            <div className="pd-header-meta">
              {project.service && <span>{project.service}</span>}
              {project.call && <span> · {project.call}</span>}
              {project.callYear && <span> · {project.callYear}</span>}
              {project.fundingBody && <span> · {project.fundingBody}</span>}
            </div>
            <div className="pd-header-stats">
              {(project.startDate || project.endDate) && (
                <div className="pd-header-stat">
                  <Calendar size={13} />
                  PERIOD {formatDateShort(project.startDate)} → {formatDateShort(project.endDate)}
                </div>
              )}
              {project.budgetFunding && (
                <div className="pd-header-stat">
                  <Coins size={13} />
                  AWARDED {formatCurrency(project.budgetFunding)}
                </div>
              )}
            </div>
          </header>

          {/* CONTENIDO según sección activa */}
          {activeSection === 'overview' && overviewKpis && (
            <OverviewSection project={project} clientName={clientName} kpis={overviewKpis} />
          )}
          {activeSection === 'execution' && <ExecutionSection project={project} />}
          {activeSection === 'annuities' && <AnnuitiesSection project={project} />}
          {activeSection === 'documents' && <DocumentsSection project={project} />}
          {activeSection === 'meetings' && <MeetingsSection project={project} />}
        </main>
      </div>
    </div>
  )
}

export default ProjectDetail

/* ============================================================
   SECCIÓN: OVERVIEW
   ============================================================ */

interface OverviewKpis {
  health: number
  schedule: { score: number; label: string }
  justification: { pct: number; done: number; total: number }
  administration: { pct: number; paid: number; total: number }
  alerts: string[]
  start: Date | null
  end: Date | null
}

const OverviewSection = ({ project, clientName, kpis }: {
  project: Project
  clientName: string
  kpis: OverviewKpis
}) => {
  const healthLabel = kpis.health >= 80 ? 'Good health'
    : kpis.health >= 60 ? 'At risk' : 'Critical'
  const healthClass = kpis.health >= 80 ? 'ok' : kpis.health >= 60 ? 'warn' : 'bad'

  return (
    <>
      {/* HEALTH SCORE banner */}
      <div className={`pd-health-banner pd-health-banner--${healthClass}`}>
        <div className="pd-health-banner-label">HEALTH SCORE</div>
        <div className="pd-health-banner-content">
          <div className="pd-health-banner-score">
            <span className="pd-health-banner-num">{kpis.health}</span>
            <span className="pd-health-banner-max">/100</span>
          </div>
          <div className="pd-health-banner-text">{healthLabel}</div>
        </div>
        <div className="pd-health-banner-bar">
          <div className="pd-health-banner-bar-fill" style={{ width: `${kpis.health}%` }} />
        </div>
      </div>

      {/* 5 KPI tiles */}
      <div className="pd-kpi-grid">
        <KpiTile
          icon={Calendar}
          label="SCHEDULE"
          value={kpis.schedule.label}
          subtitle={`Score ${kpis.schedule.score} / 100`}
        />
        <KpiTile
          icon={FileCheck}
          label="JUSTIFICATION"
          value={kpis.justification.total > 0 ? `${kpis.justification.done}/${kpis.justification.total}` : '—'}
          subtitle={kpis.justification.total > 0 ? `${kpis.justification.pct}% tasks done` : 'No tasks yet'}
        />
        <KpiTile
          icon={Coins}
          label="ADMINISTRATION"
          value={kpis.administration.total > 0 ? `${kpis.administration.paid}/${kpis.administration.total}` : '—'}
          subtitle={kpis.administration.total > 0 ? `${kpis.administration.pct}% paid` : 'No billing yet'}
        />
        <KpiTile
          icon={AlertTriangle}
          label="ALERTS"
          value={`${kpis.alerts.length} alerts`}
          subtitle={kpis.alerts[0] || 'All clear'}
          variant={kpis.alerts.length > 0 ? 'warn' : 'ok'}
        />
        <KpiTile
          icon={Users}
          label="CLIENT"
          value={clientName}
          subtitle={`${project.primaryClients.length} primary${project.secondaryClients?.length ? ` · ${project.secondaryClients.length} secondary` : ''}`}
        />
      </div>

      {/* ECONOMICS */}
      <section className="pd-section">
        <h2 className="pd-section-title">Economics</h2>
        <div className="pd-economics-grid">
          <div className="pd-eco-card">
            <div className="pd-eco-label">BUDGET (awarded)</div>
            <div className="pd-eco-value">
              {project.budgetFunding ? formatCurrency(project.budgetFunding) : '—'}
            </div>
          </div>
          <div className="pd-eco-card">
            <div className="pd-eco-label">FEE (Álamos)</div>
            <div className="pd-eco-value">
              {project.fee ? formatCurrency(project.fee) : '—'}
            </div>
          </div>
          <div className="pd-eco-card">
            <div className="pd-eco-label">BILLING TRANCHES</div>
            <div className="pd-eco-value">{(project.billingSchedule || []).length}</div>
            <div className="pd-eco-sub">
              {(project.billingSchedule || []).filter(b => b.invoiceStatus === 'Paid').length} paid
            </div>
          </div>
        </div>
      </section>

      {/* NEXT ACTIONS */}
      <section className="pd-section">
        <h2 className="pd-section-title">Next actions</h2>
        {(() => {
          const upcoming = (project.tasks || [])
            .filter(t => t.status !== 'Completed')
            .sort((a, b) => {
              const da = parseDate(a.dueDate)?.getTime() || Infinity
              const db = parseDate(b.dueDate)?.getTime() || Infinity
              return da - db
            })
            .slice(0, 5)
          if (upcoming.length === 0) {
            return <p className="pd-empty">No pending tasks.</p>
          }
          return (
            <ul className="pd-actions-list">
              {upcoming.map(t => {
                const due = parseDate(t.dueDate)
                const days = due ? daysBetween(new Date(), due) : null
                const priority = t.priority || 'Medium'
                return (
                  <li key={t.id} className={`pd-action-item pd-action-item--${priority.toLowerCase()}`}>
                    <span className={`pd-pri-tag pd-pri-tag--${priority.toLowerCase()}`}>{priority.toUpperCase()}</span>
                    <div className="pd-action-content">
                      <strong>{t.title}</strong>
                      {t.description && <small>{t.description}</small>}
                    </div>
                    <span className="pd-action-due">
                      {days !== null
                        ? days < 0 ? `DUE ${Math.abs(days)}d AGO` : days === 0 ? 'DUE TODAY' : `DUE IN ${days}d`
                        : t.dueDate}
                    </span>
                  </li>
                )
              })}
            </ul>
          )
        })()}
      </section>

      {/* ORIGIN */}
      <section className="pd-section">
        <h2 className="pd-section-title">Origin</h2>
        <div className="pd-meta-grid">
          <MetaRow label="Call"         value={project.call || '—'} />
          <MetaRow label="Year"         value={project.callYear || '—'} />
          <MetaRow label="Funding body" value={project.fundingBody || '—'} />
          <MetaRow label="Source"       value={project.source} />
          <MetaRow label="Created"      value={formatDateShort(project.createdAt)} />
        </div>
      </section>
    </>
  )
}

/* ── Helpers de UI ── */

const KpiTile = ({ icon: Icon, label, value, subtitle, variant }: {
  icon: typeof LayoutGrid
  label: string
  value: string
  subtitle?: string
  variant?: 'ok' | 'warn'
}) => (
  <div className={`pd-kpi-tile ${variant ? 'pd-kpi-tile--' + variant : ''}`}>
    <div className="pd-kpi-tile-label">
      <Icon size={13} />
      {label}
    </div>
    <div className="pd-kpi-tile-value">{value}</div>
    {subtitle && <div className="pd-kpi-tile-sub">{subtitle}</div>}
  </div>
)

const MetaRow = ({ label, value }: { label: string; value: string }) => (
  <div className="pd-meta-row">
    <span className="pd-meta-label">{label}</span>
    <span className="pd-meta-value">{value}</span>
  </div>
)

/* ============================================================
   SECCIÓN: EXECUTION (work packages, milestones, deliverables)
   ============================================================ */

const ExecutionSection = ({ project }: { project: Project }) => {
  // Por ahora vacío — placeholder visual hasta que tengamos modelo de WPs
  // Cuando se implemente: project.workPackages, milestones, deliverables
  void project
  return (
    <section className="pd-section">
      <div className="pd-section-header-row">
        <div>
          <h2 className="pd-section-title">Work packages, milestones &amp; deliverables</h2>
          <p className="pd-section-sub">0 work packages · 0 milestones · 0 deliverables</p>
        </div>
        <div className="pd-section-actions">
          <button type="button" className="pd-btn pd-btn--secondary">
            <Sparkles size={13} /> Ingest from memoria técnica
          </button>
          <button type="button" className="pd-btn pd-btn--primary">
            <Plus size={13} /> New work package
          </button>
        </div>
      </div>
      <div className="pd-empty-box">
        <p><strong>No work packages imported</strong></p>
        <p className="pd-empty-sub">
          This project does not yet carry work packages, milestones or deliverables.
        </p>
        <p className="pd-empty-sub">Add the first ones manually below — the cockpit works fine without them.</p>
        <div className="pd-empty-actions">
          <button type="button" className="pd-btn pd-btn--primary"><Plus size={13} /> New work package</button>
          <button type="button" className="pd-btn pd-btn--secondary"><Plus size={13} /> New milestone</button>
          <button type="button" className="pd-btn pd-btn--secondary"><Plus size={13} /> New deliverable</button>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   SECCIÓN: ANNUITIES (justification by year)
   ============================================================ */

const AnnuitiesSection = ({ project }: { project: Project }) => {
  // Por ahora: deduce años de start/end y muestra placeholder
  const start = parseDate(project.startDate)
  const end = parseDate(project.endDate)
  const years: number[] = []
  if (start && end) {
    for (let y = start.getFullYear(); y <= end.getFullYear(); y++) years.push(y)
  } else if (start) {
    years.push(start.getFullYear())
  }

  return (
    <section className="pd-section">
      <div className="pd-section-header-row">
        <div>
          <h2 className="pd-section-title">Annuities &amp; justification</h2>
          <p className="pd-section-sub">{years.length} annuit{years.length === 1 ? 'y' : 'ies'} · 0 with justification record</p>
        </div>
        <button type="button" className="pd-btn pd-btn--primary">
          <Plus size={13} /> New annuity
        </button>
      </div>

      {years.length === 0 ? (
        <p className="pd-empty">Set project start and end dates to derive annuities.</p>
      ) : (
        years.map(y => (
          <div key={y} className="pd-annuity-card">
            <div className="pd-annuity-header">
              <strong>Anualidad {y}</strong>
              <span className="pd-status-badge pd-status-badge--muted">PENDING</span>
              <span className="pd-annuity-amount">
                {project.budgetFunding ? formatCurrency(project.budgetFunding) : '—'}
              </span>
            </div>
            <div className="pd-annuity-progress">
              <div className="pd-annuity-progress-label">Filing progress</div>
              <div className="pd-annuity-bar">
                <div className="pd-annuity-bar-fill" style={{ width: '0%' }} />
              </div>
              <div className="pd-annuity-progress-value">0%</div>
            </div>
            <ul className="pd-annuity-reports">
              <li><Clock size={12} /> Technical report <span>PENDING</span></li>
              <li><Clock size={12} /> Economic report <span>PENDING</span></li>
              <li><Clock size={12} /> Personnel evidence <span>PENDING</span></li>
              <li><Clock size={12} /> Financial report <span>PENDING</span></li>
            </ul>
          </div>
        ))
      )}
    </section>
  )
}

/* ============================================================
   SECCIÓN: DOCUMENTS
   ============================================================ */

const DocumentsSection = ({ project }: { project: Project }) => {
  void project
  return (
    <>
      <section className="pd-section">
        <div className="pd-section-header-row">
          <div>
            <h2 className="pd-section-title">Project documents</h2>
            <p className="pd-section-sub">Technical checklist (deliverables + ad-hoc docs) and administrative documents.</p>
          </div>
          <button type="button" className="pd-btn pd-btn--secondary">
            <Sparkles size={13} /> Apply requirements
          </button>
        </div>

        <div className="pd-docs-block">
          <div className="pd-docs-block-header">
            <h3>Technical documents</h3>
            <button type="button" className="pd-btn pd-btn--primary pd-btn--sm">
              <Plus size={12} /> New technical document
            </button>
          </div>
          <p className="pd-docs-help">
            Deliverables tracked in Execution and ad-hoc technical documents in one checklist.
            Deliverables are read-only here; edit them in Execution.
          </p>
          <div className="pd-empty-box pd-empty-box--sm">
            <p>No items yet.</p>
          </div>
        </div>

        <div className="pd-docs-block">
          <div className="pd-docs-block-header">
            <h3>Administrative documents</h3>
            <button type="button" className="pd-btn pd-btn--primary pd-btn--sm">
              <Plus size={12} /> New administrative document
            </button>
          </div>
          <p className="pd-docs-help">
            Facturas, nóminas, partes de horas y otros documentos administrativos de justificación de costes.
          </p>
          <div className="pd-empty-box pd-empty-box--sm">
            <p>No items yet.</p>
          </div>
        </div>
      </section>
    </>
  )
}

/* ============================================================
   SECCIÓN: MEETINGS
   ============================================================ */

const MeetingsSection = ({ project }: { project: Project }) => {
  const tasks = project.tasks || []
  return (
    <>
      <section className="pd-section">
        <div className="pd-section-header-row">
          <div>
            <h2 className="pd-section-title">Meetings</h2>
            <p className="pd-section-sub">
              Schedule conversations with the client, capture minutes and follow up on the open tasks each meeting generates.
            </p>
          </div>
          <button type="button" className="pd-btn pd-btn--primary">
            <Plus size={13} /> New meeting
          </button>
        </div>
        <div className="pd-empty-box">
          <p><strong>No meetings yet</strong></p>
          <p className="pd-empty-sub">Use "New meeting" above to log the first conversation with the client.</p>
        </div>
      </section>

      <section className="pd-section">
        <div className="pd-section-header-row">
          <div>
            <h2 className="pd-section-title">Tasks</h2>
            <p className="pd-section-sub">Project tasks across all meetings. Toggle the semaphore to mark a task done.</p>
          </div>
          <button type="button" className="pd-btn pd-btn--primary">
            <Plus size={13} /> New task
          </button>
        </div>
        {tasks.length === 0 ? (
          <p className="pd-empty">No tasks yet.</p>
        ) : (
          <ul className="pd-tasks-list">
            {tasks.map(t => {
              const done = t.status === 'Completed'
              return (
                <li key={t.id} className={`pd-task ${done ? 'pd-task--done' : ''}`}>
                  <span className="pd-task-check">
                    {done ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                  </span>
                  <div className="pd-task-content">
                    <strong>{t.title}</strong>
                    {t.description && <small>{t.description}</small>}
                  </div>
                  <span className="pd-task-due">Due {formatDateShort(t.dueDate)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
