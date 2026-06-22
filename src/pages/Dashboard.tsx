import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Users,
  FileText,
  Briefcase,
  TrendingUp,
  Plus,
  ArrowUpRight,
  Calendar,
  Target,
  Activity as ActivityIcon,
  AlertCircle,
  Route as RouteIcon,
} from 'lucide-react'
import './Page.css'
import './Dashboard.css'

/* ============================================================
   Tipos mínimos para parsear localStorage
   ============================================================ */

interface Customer {
  id: string
  name: string
  status?: string
  createdAt?: string
  updatedAt?: string
}

interface Call {
  id: string
  name: string
  status?: string
  deadline?: string
  createdAt?: string
}

interface Proposal {
  id: string
  proposal?: string
  status?: string
  fee?: string
  call?: string
  createdAt?: string
  primaryClients?: string[]
}

interface Project {
  id: string
  title?: string
  status?: string
  fee?: string
  endDate?: string
  createdAt?: string
  billingSchedule?: Array<{ amount?: string; invoiceStatus?: string; dueDate?: string }>
}

interface Invoice {
  id: string
  total?: string
  status?: string
  createdAt?: string
}

/* ============================================================
   Utilidades
   ============================================================ */

const safeParse = <T,>(key: string): T[] => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const parseAmount = (value?: string): number => {
  if (!value) return 0
  const cleaned = value.replace(/[^\d,.-]/g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}

const formatEuros = (value: number): string =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)

const formatDate = (value?: string): string => {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
    })
  } catch {
    return value
  }
}

const daysFromNow = (value?: string): number | null => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const ms = date.getTime() - Date.now()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

/* ============================================================
   Componente
   ============================================================ */

const Dashboard = () => {
  const navigate = useNavigate()
  const [tick, setTick] = useState(0) // se incrementa al recargar datos

  // Lee localStorage cada vez que cambia tick
  const data = useMemo(() => {
    const customers = safeParse<Customer>('customers')
    const calls = safeParse<Call>('calls')
    const proposals = safeParse<Proposal>('proposals')
    const projects = safeParse<Project>('projects')
    const invoices = safeParse<Invoice>('invoices')
    return { customers, calls, proposals, projects, invoices }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  // Recarga datos si cambia localStorage (por ejemplo cuando AppDataSync hidrata)
  useEffect(() => {
    const handler = () => setTick((t) => t + 1)
    window.addEventListener('storage', handler)
    const interval = window.setInterval(handler, 5000)
    return () => {
      window.removeEventListener('storage', handler)
      window.clearInterval(interval)
    }
  }, [])

  /* ============================================================
     ROADMAP DEADLINES — recomendaciones con deadline próximo
     ============================================================
     Cruza:
       · cdtiRoadmaps (localStorage) → recomendaciones por customer
       · discoveryCalls (localStorage) → fecha closeDate por externalId
     Devuelve recs con closeDate dentro de los próximos 90 días, ordenadas
     por urgencia (más cercano primero).
     ============================================================ */
  const roadmapDeadlines = useMemo(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const roadmaps = JSON.parse(localStorage.getItem('cdtiRoadmaps') || '[]') as any[]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const calls = JSON.parse(localStorage.getItem('discoveryCalls') || '[]') as any[]
      const customers = data.customers
      const callsById = new Map(calls.map(c => [c.externalId, c]))
      const customersById = new Map(customers.map(c => [c.id, c]))

      const today = new Date()
      const horizon90 = new Date(today.getTime() + 90 * 86400000)

      const items: Array<{
        callId: string
        customerName: string
        customerId: string
        roadmapId: string
        title: string
        source: 'EU_PORTAL' | 'BDNS'
        fitScore: number
        priorityOrder: number
        closeDate: Date
        daysLeft: number
        program?: string
      }> = []

      // Roadmap activo = más reciente por customer (no enumerar todas las versiones,
      // solo la última generada por cliente)
      const latestByCustomer = new Map<string, typeof roadmaps[number]>()
      for (const rm of roadmaps) {
        const cur = latestByCustomer.get(rm.customerId)
        if (!cur || new Date(rm.generatedAt) > new Date(cur.generatedAt)) {
          latestByCustomer.set(rm.customerId, rm)
        }
      }

      latestByCustomer.forEach(rm => {
        const customer = customersById.get(rm.customerId)
        if (!customer) return
        const recs = rm.result?.recommendations || []
        for (const rec of recs) {
          const call = callsById.get(rec.callId)
          if (!call?.closeDate) continue
          const closeDate = new Date(call.closeDate)
          if (Number.isNaN(closeDate.getTime())) continue
          if (closeDate < today || closeDate > horizon90) continue
          const daysLeft = Math.ceil((closeDate.getTime() - today.getTime()) / 86400000)
          items.push({
            callId: rec.callId,
            customerName: customer.name,
            customerId: customer.id,
            roadmapId: rm.id,
            title: rec.title,
            source: rec.source,
            fitScore: rec.fitScore,
            priorityOrder: rec.priorityOrder,
            closeDate,
            daysLeft,
            program: call.program,
          })
        }
      })

      items.sort((a, b) => a.daysLeft - b.daysLeft)
      return items
    } catch (err) {
      console.warn('Failed to compute upcoming deadlines:', err)
      return []
    }
  }, [data.customers, tick])


  /* ----------------------------------------------------------
     KPIs derivados
     ---------------------------------------------------------- */

  const kpis = useMemo(() => {
    const activeProposals = data.proposals.filter(
      (p) => !['Lost', 'Closed', 'Cancelled', 'Rejected'].includes(p.status || '')
    )
    const activeProjects = data.projects.filter(
      (p) => !['Completed', 'Cancelled', 'Closed'].includes(p.status || '')
    )
    const potentialFees =
      activeProposals.reduce((sum, p) => sum + parseAmount(p.fee), 0) +
      activeProjects.reduce((sum, p) => sum + parseAmount(p.fee), 0)

    return {
      customersCount: data.customers.length,
      activeProposalsCount: activeProposals.length,
      activeProjectsCount: activeProjects.length,
      potentialFees,
    }
  }, [data])

  /* ----------------------------------------------------------
     Pipeline activo (propuestas + proyectos en curso)
     ---------------------------------------------------------- */

  const pipeline = useMemo(() => {
    const proposalRows = data.proposals
      .filter((p) => !['Lost', 'Closed', 'Cancelled', 'Rejected'].includes(p.status || ''))
      .map((p) => ({
        id: p.id,
        type: 'Proposal' as const,
        title: p.proposal || p.call || 'Untitled',
        status: p.status || 'In progress',
        amount: parseAmount(p.fee),
        link: `/proposals?focus=${p.id}`,
      }))

    const projectRows = data.projects
      .filter((p) => !['Completed', 'Cancelled', 'Closed'].includes(p.status || ''))
      .map((p) => ({
        id: p.id,
        type: 'Project' as const,
        title: p.title || 'Untitled',
        status: p.status || 'Active',
        amount: parseAmount(p.fee),
        link: `/projects?focus=${p.id}`,
      }))

    return [...proposalRows, ...projectRows]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
  }, [data])

  /* ----------------------------------------------------------
     Próximos deadlines (calls + billing items)
     ---------------------------------------------------------- */

  const upcomingDeadlines = useMemo(() => {
    const callDeadlines = data.calls
      .filter((c) => c.deadline)
      .map((c) => ({
        id: `call-${c.id}`,
        kind: 'Call' as const,
        label: c.name,
        date: c.deadline as string,
        days: daysFromNow(c.deadline) ?? 999,
        link: `/calls`,
      }))

    const billingDeadlines = data.projects.flatMap((p) =>
      (p.billingSchedule || [])
        .filter((item) => item.invoiceStatus !== 'Paid' && item.dueDate)
        .map((item, idx) => ({
          id: `bill-${p.id}-${idx}`,
          kind: 'Billing' as const,
          label: `${p.title || 'Project'} — ${item.amount || ''}€`,
          date: item.dueDate as string,
          days: daysFromNow(item.dueDate) ?? 999,
          link: `/billing`,
        }))
    )

    return [...callDeadlines, ...billingDeadlines]
      .filter((d) => d.days >= -30 && d.days <= 60)
      .sort((a, b) => a.days - b.days)
      .slice(0, 5)
  }, [data])

  /* ----------------------------------------------------------
     Render
     ---------------------------------------------------------- */

  return (
    <div className="page page--dashboard">
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Overview of your activity — clients, proposals, projects and upcoming milestones
          </p>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="kpi-grid">
        <KpiCard
          icon={<Users size={20} />}
          label="Clients"
          value={kpis.customersCount.toString()}
          hint={`${kpis.customersCount === 1 ? 'registered client' : 'registered clients'}`}
          onClick={() => navigate('/customers')}
        />
        <KpiCard
          icon={<FileText size={20} />}
          label="Active proposals"
          value={kpis.activeProposalsCount.toString()}
          hint="proposals in progress"
          onClick={() => navigate('/proposals')}
        />
        <KpiCard
          icon={<Briefcase size={20} />}
          label="Active projects"
          value={kpis.activeProjectsCount.toString()}
          hint="in execution"
          onClick={() => navigate('/projects')}
        />
        <KpiCard
          icon={<TrendingUp size={20} />}
          label="Potential fees"
          value={formatEuros(kpis.potentialFees)}
          hint="from active proposals + projects"
          highlight
        />
      </div>

      {/* ─── ROADMAP DEADLINES — bloque destacado si hay calls urgentes ─── */}
      {roadmapDeadlines.length > 0 && (
        <section className={`surface-card dashboard-deadlines ${roadmapDeadlines.some(d => d.daysLeft < 30) ? 'dashboard-deadlines--urgent' : ''}`}>
          <header className="surface-card-header">
            <h2>
              <AlertCircle size={18} />
              Deadlines próximos del roadmap
              <span className="dashboard-deadlines-count">{roadmapDeadlines.length}</span>
            </h2>
            <span className="muted">Recomendaciones de los roadmaps activos con cierre en &lt;90 días</span>
          </header>
          <ul className="dashboard-deadlines-list">
            {roadmapDeadlines.slice(0, 6).map(item => (
              <li
                key={`${item.customerId}-${item.callId}`}
                className={`dashboard-deadline-row ${item.daysLeft < 14 ? 'critical' : item.daysLeft < 30 ? 'warning' : ''}`}
                onClick={() => navigate(`/roadmap/${item.customerId}`)}
              >
                <div className="dashboard-deadline-countdown">
                  <span className="dashboard-deadline-days">{item.daysLeft}</span>
                  <span className="dashboard-deadline-days-label">días</span>
                </div>
                <div className="dashboard-deadline-content">
                  <div className="dashboard-deadline-title">
                    <strong>{item.customerName}</strong>
                    <span className="dashboard-deadline-priority">#{item.priorityOrder}</span>
                  </div>
                  <p className="dashboard-deadline-call">{item.title}</p>
                  <p className="dashboard-deadline-meta">
                    {item.source === 'EU_PORTAL' ? 'EU Portal' : 'BDNS'}
                    {item.program && <> · {item.program}</>}
                    {' · '}
                    Cierra el {item.closeDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}
                    Fit {item.fitScore}
                  </p>
                </div>
                <RouteIcon size={14} className="dashboard-deadline-arrow" />
              </li>
            ))}
          </ul>
          {roadmapDeadlines.length > 6 && (
            <p className="muted dashboard-deadlines-more">
              + {roadmapDeadlines.length - 6} deadlines más entre los próximos 90 días
            </p>
          )}
        </section>
      )}

      {/* Dos columnas: pipeline + deadlines */}
      <div className="dashboard-twocol">
        <section className="surface-card">
          <header className="surface-card-header">
            <h2>
              <Target size={18} />
              Active pipeline
            </h2>
            <Link to="/proposals" className="link-cta">
              View all <ArrowUpRight size={14} />
            </Link>
          </header>

          {pipeline.length === 0 ? (
            <EmptyState
              text="No active proposals or projects yet."
              cta={{ label: 'Create first proposal', onClick: () => navigate('/proposals') }}
            />
          ) : (
            <ul className="pipeline-list">
              {pipeline.map((item) => (
                <li key={item.id} className="pipeline-row" onClick={() => navigate(item.link)}>
                  <div className="pipeline-row-main">
                    <span className="badge badge--neutral">{item.type}</span>
                    <span className="pipeline-row-title" title={item.title}>
                      {item.title}
                    </span>
                  </div>
                  <div className="pipeline-row-side">
                    <span className="pipeline-row-status">{item.status}</span>
                    {item.amount > 0 && (
                      <span className="pipeline-row-amount tabular-nums">
                        {formatEuros(item.amount)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface-card">
          <header className="surface-card-header">
            <h2>
              <Calendar size={18} />
              Upcoming milestones
            </h2>
            <Link to="/calls" className="link-cta">
              View calls <ArrowUpRight size={14} />
            </Link>
          </header>

          {upcomingDeadlines.length === 0 ? (
            <EmptyState text="No deadlines in the next 60 days." />
          ) : (
            <ul className="deadline-list">
              {upcomingDeadlines.map((d) => (
                <li key={d.id} className="deadline-row" onClick={() => navigate(d.link)}>
                  <div className={`deadline-marker deadline-marker--${getDeadlineUrgency(d.days)}`}>
                    {formatDate(d.date)}
                  </div>
                  <div className="deadline-content">
                    <span className="deadline-kind">{d.kind}</span>
                    <span className="deadline-label" title={d.label}>
                      {d.label}
                    </span>
                  </div>
                  <span className={`deadline-days deadline-days--${getDeadlineUrgency(d.days)}`}>
                    {d.days < 0
                      ? `${Math.abs(d.days)}d ago`
                      : d.days === 0
                      ? 'Today'
                      : `${d.days}d`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Acciones rápidas */}
      <section className="surface-card">
        <header className="surface-card-header">
          <h2>
            <ActivityIcon size={18} />
            Quick actions
          </h2>
        </header>
        <div className="quick-actions-row">
          <QuickAction
            label="New client"
            icon={<Users size={18} />}
            onClick={() => navigate('/customers')}
          />
          <QuickAction
            label="New proposal"
            icon={<FileText size={18} />}
            onClick={() => navigate('/proposals')}
          />
          <QuickAction
            label="New project"
            icon={<Briefcase size={18} />}
            onClick={() => navigate('/projects')}
          />
          <QuickAction
            label="New call"
            icon={<Calendar size={18} />}
            onClick={() => navigate('/calls')}
          />
        </div>
      </section>
    </div>
  )
}

/* ============================================================
   Componentes auxiliares
   ============================================================ */

const KpiCard = ({
  icon,
  label,
  value,
  hint,
  highlight,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint: string
  highlight?: boolean
  onClick?: () => void
}) => (
  <div
    className={`kpi-card ${highlight ? 'kpi-card--highlight' : ''} ${onClick ? 'kpi-card--clickable' : ''}`}
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={(e) => {
      if (onClick && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        onClick()
      }
    }}
  >
    <div className="kpi-card-icon">{icon}</div>
    <div className="kpi-card-body">
      <span className="kpi-card-label">{label}</span>
      <span className="kpi-card-value tabular-nums">{value}</span>
      <span className="kpi-card-hint">{hint}</span>
    </div>
  </div>
)

const QuickAction = ({
  label,
  icon,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
}) => (
  <button className="quick-action" onClick={onClick}>
    <span className="quick-action-icon">{icon}</span>
    <span className="quick-action-label">{label}</span>
    <Plus size={14} className="quick-action-plus" />
  </button>
)

const EmptyState = ({
  text,
  cta,
}: {
  text: string
  cta?: { label: string; onClick: () => void }
}) => (
  <div className="empty-state">
    <p className="empty-state-text">{text}</p>
    {cta && (
      <button className="btn btn-primary btn-sm" onClick={cta.onClick}>
        {cta.label}
      </button>
    )}
  </div>
)

const getDeadlineUrgency = (days: number): 'past' | 'urgent' | 'soon' | 'far' => {
  if (days < 0) return 'past'
  if (days <= 7) return 'urgent'
  if (days <= 21) return 'soon'
  return 'far'
}

export default Dashboard
