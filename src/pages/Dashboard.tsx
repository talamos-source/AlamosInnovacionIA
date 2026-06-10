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
        type: 'Propuesta' as const,
        title: p.proposal || p.call || 'Sin nombre',
        status: p.status || 'En curso',
        amount: parseAmount(p.fee),
        link: `/proposals?focus=${p.id}`,
      }))

    const projectRows = data.projects
      .filter((p) => !['Completed', 'Cancelled', 'Closed'].includes(p.status || ''))
      .map((p) => ({
        id: p.id,
        type: 'Proyecto' as const,
        title: p.title || 'Sin nombre',
        status: p.status || 'Activo',
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
        kind: 'Convocatoria' as const,
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
          kind: 'Facturación' as const,
          label: `${p.title || 'Proyecto'} — ${item.amount || ''}€`,
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
            Vista general del estado de tu actividad — clientes, propuestas, proyectos y próximos hitos
          </p>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="kpi-grid">
        <KpiCard
          icon={<Users size={20} />}
          label="Clientes"
          value={kpis.customersCount.toString()}
          hint={`${kpis.customersCount === 1 ? 'cliente registrado' : 'clientes registrados'}`}
          onClick={() => navigate('/customers')}
        />
        <KpiCard
          icon={<FileText size={20} />}
          label="Propuestas en curso"
          value={kpis.activeProposalsCount.toString()}
          hint="propuestas activas"
          onClick={() => navigate('/proposals')}
        />
        <KpiCard
          icon={<Briefcase size={20} />}
          label="Proyectos activos"
          value={kpis.activeProjectsCount.toString()}
          hint="en ejecución"
          onClick={() => navigate('/projects')}
        />
        <KpiCard
          icon={<TrendingUp size={20} />}
          label="Honorarios potenciales"
          value={formatEuros(kpis.potentialFees)}
          hint="propuestas + proyectos activos"
          highlight
        />
      </div>

      {/* Dos columnas: pipeline + deadlines */}
      <div className="dashboard-twocol">
        <section className="surface-card">
          <header className="surface-card-header">
            <h2>
              <Target size={18} />
              Pipeline activo
            </h2>
            <Link to="/proposals" className="link-cta">
              Ver todo <ArrowUpRight size={14} />
            </Link>
          </header>

          {pipeline.length === 0 ? (
            <EmptyState
              text="Aún no tienes propuestas ni proyectos activos."
              cta={{ label: 'Crear primera propuesta', onClick: () => navigate('/proposals') }}
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
              Próximos hitos
            </h2>
            <Link to="/calls" className="link-cta">
              Ver convocatorias <ArrowUpRight size={14} />
            </Link>
          </header>

          {upcomingDeadlines.length === 0 ? (
            <EmptyState text="No hay deadlines en los próximos 60 días." />
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
                      ? `${Math.abs(d.days)}d atrás`
                      : d.days === 0
                      ? 'Hoy'
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
            Acciones rápidas
          </h2>
        </header>
        <div className="quick-actions-row">
          <QuickAction
            label="Nuevo cliente"
            icon={<Users size={18} />}
            onClick={() => navigate('/customers')}
          />
          <QuickAction
            label="Nueva propuesta"
            icon={<FileText size={18} />}
            onClick={() => navigate('/proposals')}
          />
          <QuickAction
            label="Nuevo proyecto"
            icon={<Briefcase size={18} />}
            onClick={() => navigate('/projects')}
          />
          <QuickAction
            label="Nueva convocatoria"
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
