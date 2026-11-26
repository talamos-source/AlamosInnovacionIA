import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, ExternalLink, HeartHandshake, Loader2, RefreshCw } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getAiApiBase } from '../utils/aiApiBase'
import { persistAppData } from '../utils/appData'
import './Page.css'
import './ColaboraAdmin.css'

/* ============================================================
   Colabora · administración (solo rol Admin)
   Los usuarios externos de Colabora NO tienen acceso al CRM:
   usan la web con su propia sesión y su propio usuario de BD.
   ============================================================ */

type Tab = 'pending' | 'published' | 'all' | 'support' | 'linkedin' | 'requests' | 'metrics' | 'accounts' | 'config'

interface AdminRequest {
  id: string
  status: string
  created_at: string
  responded_at: string | null
  listing_title: string | null
  call_title: string | null
  message: string
  requester_email: string
  owner_email: string
  public_id: string | null
}

interface AdminReport {
  id: string
  reason: string
  status: string
  created_at: string
  reporter_email: string | null
  listing_title: string | null
  request_status: string | null
  public_id: string | null
}

interface AdminListing {
  id: string
  public_id: string
  call_id: string
  call_title: string
  call_programme: string | null
  call_close_date: string | null
  mode: string
  collab_type: string
  title: string
  summary: string
  details: string | null
  specialties: string[]
  phase: string | null
  state: string
  close_reason: string | null
  review_flags: string[]
  review_pending: boolean
  published_snapshot: { title?: string; summary?: string; mode?: string; collabType?: string; specialties?: string[] } | null
  entity_label: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  wants_support: boolean
  linkedin_authorized: boolean
  created_at: string
  updated_at: string
  published_at: string | null
  account_email: string
  account_status: string
  // Fase 3 (si la migración está aplicada)
  linkedin_authorized_at?: string | null
  linkedin_authorized_text?: string | null
  support_status?: string
  profile_entity_name?: string | null
  profile_country?: string | null
  profile_phone?: string | null
}

interface Metrics {
  byCall: Array<{ call_title: string; busco: number; ofrezco: number; total: number }>
  bySpecialty: Array<{ specialty: string; n: number }>
  byMode: Array<{ mode: string; n: number }>
  byType: Array<{ collab_type: string; n: number }>
  byState: Array<{ state: string; n: number }>
  requestsByStatus: Array<{ status: string; n: number }>
  outcomes: Array<{ outcome: string; n: number }>
  closeReasons: Array<{ reason: string; n: number }>
  viewsBySource: Array<{ source: string; n: number }>
  viewsByDay: Array<{ day: string; n: number }>
  alertsByCall?: Array<{ call_title: string; n: number }>
  acceptanceRate: number | null
}

interface AdminAccount {
  id: string
  email: string
  status: string
  created_at: string
  last_login_at: string | null
  contact_name: string | null
  entity_name: string | null
  entity_type: string | null
  country: string | null
  listings: number
}

interface Overview {
  byState: Array<{ state: string; n: number }>
  accounts: number
  suspended: number
  pending: number
  support: number
  linkedin: number
  requestsPending?: number
  connections?: number
  reportsOpen?: number
}

const REQUEST_STATE: Record<string, string> = {
  pendiente: 'Pendiente', aceptada: 'Aceptada', rechazada: 'No aceptada', retirada: 'Retirada', caducada: 'Caducada',
  revocada: 'Conexión cortada',
}

const WEB_URL = 'https://www.alamosinnovacion.com/es/colabora'
const MODE: Record<string, string> = { busco: 'Demanda', ofrezco: 'Oferta' }
const MODE_LONG: Record<string, string> = { busco: 'Demanda de colaboración', ofrezco: 'Oferta de colaboración' }
const TYPE: Record<string, string> = { consorcio: 'Socio de consorcio', tecnica: 'Colaboración técnica', talento: 'Talento investigador' }
const STATE: Record<string, string> = {
  borrador: 'Borrador', pendiente: 'Pendiente', publicado: 'Publicado', pausado: 'Pausado', cerrado: 'Cerrado', rechazado: 'Rechazado',
}
const OUTCOME: Record<string, string> = {
  hablando: 'Seguimos hablando', acordado: 'Acordado colaborar', presentada: 'Propuesta presentada juntos',
  concedida: 'Concedida', denegada: 'No concedida', sin_encaje: 'No hubo encaje', desconocido: 'Sin responder (desconocido)',
  // valores anteriores a la fase 5
  preparando: 'Acordado colaborar', no_seguimos: 'No hubo encaje',
}
const SOURCE: Record<string, string> = {
  colabora: 'Colabora', ayudas: 'Mapa de ayudas', linkedin: 'LinkedIn / enlace compartido', sugerencia: 'Sugerencias',
  alerta: 'Alertas por correo', directo: 'Directo',
}
const CLOSE_REASON: Record<string, string> = {
  encontrada_aqui: 'Colaboración encontrada en Colabora', encontrada_otro_medio: 'Encontrada por otro medio',
  necesidad_retirada: 'Ya no lo necesita', otro: 'Otro motivo', retirado_admin: 'Retirado por administración',
}
const SUPPORT_STATE: Record<string, string> = { pendiente: 'Pendiente', en_crm: 'En el CRM', descartada: 'Descartada' }
const FLAG: Record<string, string> = { email: 'correo', url: 'web', telefono: 'teléfono', nombre: 'nombre propio', duplicado: 'duplicado' }
const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'pending', label: 'Pendientes de revisión' },
  { key: 'published', label: 'Publicados' },
  { key: 'all', label: 'Todos' },
  { key: 'support', label: 'Piden apoyo' },
  { key: 'linkedin', label: 'LinkedIn autorizados' },
  { key: 'requests', label: 'Solicitudes de contacto' },
  { key: 'metrics', label: 'Métricas' },
  { key: 'accounts', label: 'Usuarios' },
  { key: 'config', label: 'Configuración' },
]

const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')

/* ---------- Difusión en LinkedIn (manual supervisada) ---------- */

const publicUrl = (publicId: string) => `https://www.alamosinnovacion.com/es/colabora/anuncios/${publicId}`
const linkedInShareUrl = (url: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`

/** Texto sugerido: SOLO la versión pública aprobada y la convocatoria; nunca entidad, persona ni contacto. */
function linkedInText(l: AdminListing): string | null {
  const s = l.published_snapshot
  if (!s?.title) return null
  const type = TYPE[s.collabType || l.collab_type] || ''
  const lead = `${MODE_LONG[s.mode || l.mode] || ''} · ${type} para la convocatoria ${l.call_title}${l.call_programme ? ` (${l.call_programme})` : ''}.`
  const tags = s.specialties?.length ? ['', `Especialidades: ${s.specialties.join(', ')}`] : []
  return [
    lead, '', s.title, s.summary || '', ...tags, '',
    'Detalle y contacto gratuito en Colabora, de Álamos Innovación (la identidad solo se comparte cuando ambas partes aceptan):',
    publicUrl(l.public_id),
  ].join('\n')
}

/** La versión publicada es exactamente la que el autor autorizó para LinkedIn. */
function linkedInVersionOk(l: AdminListing): boolean {
  const s = l.published_snapshot
  if (!s?.title || !l.linkedin_authorized_text) return false
  return l.linkedin_authorized_text === `${s.title}\n${s.summary || ''}`
}

interface StoredCustomer { id: string; name?: string; company?: string; notes?: string; [k: string]: unknown }

/** Crea la ficha de cliente en el CRM con los datos privados de la solicitud de apoyo. */
function createCrmCustomer(l: AdminListing): { created: boolean; name: string } {
  const name = l.entity_label || l.profile_entity_name || l.contact_name || l.account_email
  const saved = localStorage.getItem('customers')
  const customers: StoredCustomer[] = saved ? JSON.parse(saved) : []
  const norm = (v?: string) => (v || '').trim().toLowerCase()
  if (customers.some((c) => norm(c.name) === norm(name) || norm(c.company) === norm(name))) return { created: false, name }
  const now = new Date().toISOString()
  const customer = {
    id: `customer-${Date.now()}`,
    name,
    company: name,
    country: l.profile_country || '',
    region: '',
    partner: { name: 'Default Partner', initials: 'DP' },
    website: '',
    category: '',
    status: 'Active',
    notes: `Solicitud de apoyo desde Colabora: ${l.title} (${l.call_title}). Anuncio ${publicUrl(l.public_id)}`,
    contacts: [{
      id: `contact-${Date.now()}`,
      name: l.contact_name || '',
      email: l.contact_email || l.account_email,
      phone: l.contact_phone || l.profile_phone || '',
      comments: 'Desde Colabora',
    }],
    createdAt: now,
    updatedAt: now,
  }
  persistAppData('customers', JSON.stringify([...customers, customer]))
  return { created: true, name }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('authToken') || ''
  const res = await fetch(`${getAiApiBase()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
  })
  const json = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
  return json as T
}

const ColaboraAdmin = () => {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('pending')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [listings, setListings] = useState<AdminListing[]>([])
  const [accounts, setAccounts] = useState<AdminAccount[]>([])
  const [requests, setRequests] = useState<AdminRequest[]>([])
  const [reports, setReports] = useState<AdminReport[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [conn, setConn] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedShare, setCopiedShare] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setOverview(await api<Overview>('/admin/colabora/overview'))
      if (tab === 'accounts') {
        setAccounts((await api<{ accounts: AdminAccount[] }>('/admin/colabora/accounts')).accounts)
      } else if (tab === 'requests') {
        const r = await api<{ requests: AdminRequest[]; reports: AdminReport[] }>('/admin/colabora/requests')
        setRequests(r.requests)
        setReports(r.reports)
      } else if (tab === 'metrics') {
        setMetrics(await api<Metrics>('/admin/colabora/metrics'))
      } else if (tab !== 'config') {
        setListings((await api<{ listings: AdminListing[] }>(`/admin/colabora/listings?filter=${tab}`)).listings)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    if (user?.role === 'Admin') void load()
  }, [load, user?.role])

  if (user?.role !== 'Admin') {
    return (
      <div className="page">
        <p className="ca-empty">Solo el perfil de administración puede gestionar Colabora.</p>
      </div>
    )
  }

  const act = async (id: string, action: 'approve' | 'reject' | 'pause' | 'retire') => {
    let reason: string | undefined
    if (action === 'reject') {
      const r = window.prompt('Motivo del rechazo (se registra):', 'No cumple las condiciones de publicación')
      if (r === null) return
      reason = r
    }
    if (action === 'retire' && !window.confirm('¿Retirar este anuncio de Colabora?')) return
    setBusy(id)
    try {
      await api(`/admin/colabora/listings/${id}/action`, { method: 'POST', body: JSON.stringify({ action, reason }) })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setBusy(null)
    }
  }

  const copyShareText = async (l: AdminListing) => {
    const text = linkedInText(l)
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopiedShare(l.id)
      setTimeout(() => setCopiedShare(null), 2000)
    } catch {
      window.prompt('Copia el texto:', text)
    }
  }

  /** Abre la ventana de LinkedIn (en el mismo clic, para que no la bloquee el navegador) y deja constancia. */
  const shareOnLinkedIn = (l: AdminListing) => {
    window.open(linkedInShareUrl(publicUrl(l.public_id)), '_blank', 'noopener,noreferrer')
    void api(`/admin/colabora/listings/${l.id}/action`, { method: 'POST', body: JSON.stringify({ action: 'linkedin_shared' }) })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error'))
  }

  const setSupport = async (l: AdminListing, status: 'en_crm' | 'descartada') => {
    setNotice(null)
    if (status === 'descartada' && !window.confirm('¿Descartar esta solicitud de apoyo?')) return
    setBusy(l.id)
    try {
      if (status === 'en_crm') {
        const r = createCrmCustomer(l)
        setNotice(r.created ? `Cliente «${r.name}» creado en el CRM.` : `Ya existía un cliente «${r.name}» en el CRM: no se ha duplicado.`)
      }
      await api(`/admin/colabora/listings/${l.id}/support`, { method: 'POST', body: JSON.stringify({ status }) })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setBusy(null)
    }
  }

  const setAccountStatus = async (id: string, status: 'active' | 'suspended') => {
    if (status === 'suspended' && !window.confirm('¿Suspender esta cuenta? Se cerrarán sus sesiones y sus anuncios dejarán de mostrarse.')) return
    setBusy(id)
    try {
      await api(`/admin/colabora/accounts/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setBusy(null)
    }
  }

  const markReportReviewed = async (id: string) => {
    setBusy(id)
    try {
      await api(`/admin/colabora/reports/${id}/status`, { method: 'POST', body: '{}' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setBusy(null)
    }
  }

  const generateCredentials = async () => {
    if (!window.confirm('Se generará una contraseña nueva para el usuario de base de datos de Colabora. La anterior dejará de funcionar hasta que actualices Vercel. ¿Continuar?')) return
    setBusy('config')
    setConn(null)
    try {
      const r = await api<{ connectionString: string }>('/admin/colabora/db-credentials', { method: 'POST', body: '{}' })
      setConn(r.connectionString)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setBusy(null)
    }
  }

  const count = (state: string) => overview?.byState.find((s) => s.state === state)?.n ?? 0

  return (
    <div className="page ca-page">
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title"><HeartHandshake size={22} /> Colabora</h1>
          <p className="page-subtitle">Búsquedas y ofertas de socios publicadas en la web. Los usuarios externos no acceden al CRM.</p>
        </div>
        <div className="ca-header-actions">
          <a className="btn-secondary" href={WEB_URL} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Ver en la web</a>
          <button type="button" className="btn-secondary" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 size={14} className="ca-spin" /> : <RefreshCw size={14} />} Actualizar
          </button>
        </div>
      </div>

      <div className="ca-kpis">
        <div className="ca-kpi"><span>{overview?.pending ?? '—'}</span>Pendientes de revisión</div>
        <div className="ca-kpi"><span>{overview ? count('publicado') : '—'}</span>Publicados</div>
        <div className="ca-kpi"><span>{overview?.accounts ?? '—'}</span>Usuarios</div>
        <div className="ca-kpi"><span>{overview?.suspended ?? '—'}</span>Suspendidos</div>
        <div className="ca-kpi"><span>{overview?.support ?? '—'}</span>Piden apoyo</div>
        <div className="ca-kpi"><span>{overview?.linkedin ?? '—'}</span>LinkedIn autorizados</div>
        <div className="ca-kpi"><span>{overview?.requestsPending ?? '—'}</span>Solicitudes pendientes</div>
        <div className="ca-kpi"><span>{overview?.connections ?? '—'}</span>Conexiones aceptadas</div>
        <div className="ca-kpi"><span>{overview?.reportsOpen ?? '—'}</span>Denuncias abiertas</div>
      </div>

      <nav className="ca-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`ca-tab${tab === t.key ? ' ca-tab--active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </nav>

      {error && (
        <div className="ca-error">
          {error === 'Colabora no está inicializado todavía.'
            ? 'Colabora aún no está inicializado en la base de datos: despliega el backend en Render (la migración crea las tablas).'
            : error}
        </div>
      )}

      {notice && <div className="ca-notice">{notice}</div>}

      {tab === 'metrics' && metrics && <MetricsView m={metrics} />}

      {tab === 'config' && (
        <section className="ca-config">
          <h2>Conexión segura de la web</h2>
          <p>
            La web usa un usuario de base de datos propio (<code>colabora_app</code>) que solo puede leer y escribir las tablas de Colabora.
            No tiene acceso a clientes, proyectos, facturas ni ningún otro dato del CRM.
          </p>
          <ol>
            <li>Pulsa <strong>Generar credenciales</strong> y copia la cadena de conexión.</li>
            <li>En Vercel → proyecto de la web → <strong>Settings → Environment Variables</strong>, crea <code>COLABORA_DATABASE_URL</code> (Production y Preview) y pega el valor.</li>
            <li>Vuelve a desplegar la web (Deployments → Redeploy).</li>
          </ol>
          <button type="button" className="btn-primary" onClick={() => void generateCredentials()} disabled={busy === 'config'}>
            {busy === 'config' ? <Loader2 size={14} className="ca-spin" /> : null} Generar credenciales
          </button>
          {conn && (
            <div className="ca-conn">
              <code>{conn}</code>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { void navigator.clipboard.writeText(conn).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }) }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar'}
              </button>
              <p className="ca-hint">Se muestra una sola vez. Si la pierdes, genera otra y actualiza Vercel.</p>
            </div>
          )}
        </section>
      )}

      {tab === 'requests' && (
        <section className="ca-requests">
          <p className="ca-hint">
            Las partes solo ven los datos de contacto de la otra cuando la solicitud se acepta. Aquí se ven los correos de las cuentas para operar el servicio.
          </p>
          <div className="ca-table-wrap">
            <table className="ca-table">
              <thead>
                <tr><th>Fecha</th><th>Anuncio</th><th>Solicita</th><th>Autor del anuncio</th><th>Estado</th><th>Respuesta</th></tr>
              </thead>
              <tbody>
                {requests.length === 0 && <tr><td colSpan={6} className="ca-empty">Sin solicitudes todavía.</td></tr>}
                {requests.map((r) => (
                  <tr key={r.id} title={r.message}>
                    <td>{fmt(r.created_at)}</td>
                    <td>
                      {r.public_id ? (
                        <a className="ca-link" href={publicUrl(r.public_id)} target="_blank" rel="noopener noreferrer">{r.listing_title || '—'}</a>
                      ) : (r.listing_title || 'Anuncio eliminado')}
                      <div className="ca-hint">{r.call_title || ''}</div>
                    </td>
                    <td>{r.requester_email}</td>
                    <td>{r.owner_email}</td>
                    <td><span className={`ca-state ca-state--${r.status}`}>{REQUEST_STATE[r.status] || r.status}</span></td>
                    <td>{fmt(r.responded_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="ca-subtitle">Denuncias</h2>
          {reports.length === 0 ? (
            <p className="ca-empty">Sin denuncias.</p>
          ) : (
            <ul className="ca-list">
              {reports.map((rp) => (
                <li key={rp.id} className="ca-item">
                  <div className="ca-item__head">
                    <div>
                      <p className="ca-item__meta">
                        <span className={`ca-state ca-state--${rp.status === 'abierta' ? 'pendiente' : 'publicado'}`}>{rp.status === 'abierta' ? 'Abierta' : 'Revisada'}</span>
                        <span>{fmt(rp.created_at)}</span>
                        <span>De: {rp.reporter_email || '—'}</span>
                        {rp.request_status && <span>Solicitud: {REQUEST_STATE[rp.request_status] || rp.request_status}</span>}
                      </p>
                      <h3 className="ca-item__title">{rp.listing_title || 'Anuncio eliminado'}</h3>
                      <p className="ca-text">{rp.reason}</p>
                    </div>
                    <div className="ca-item__actions">
                      {rp.public_id && (
                        <a className="ca-link" href={publicUrl(rp.public_id)} target="_blank" rel="noopener noreferrer">Ver anuncio ↗</a>
                      )}
                      {rp.status === 'abierta' && (
                        <button type="button" className="btn-secondary" disabled={busy === rp.id} onClick={() => void markReportReviewed(rp.id)}>Marcar revisada</button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'accounts' && (
        <div className="ca-table-wrap">
          <table className="ca-table">
            <thead>
              <tr><th>Correo</th><th>Contacto</th><th>Entidad</th><th>País</th><th>Anuncios</th><th>Último acceso</th><th>Estado</th><th /></tr>
            </thead>
            <tbody>
              {accounts.length === 0 && <tr><td colSpan={8} className="ca-empty">Sin usuarios todavía.</td></tr>}
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td>{a.email}</td>
                  <td>{a.contact_name || '—'}</td>
                  <td>{a.entity_name || (a.entity_type === 'profesional' ? 'Profesional' : '—')}</td>
                  <td>{a.country || '—'}</td>
                  <td>{a.listings}</td>
                  <td>{fmt(a.last_login_at)}</td>
                  <td><span className={`ca-state ca-state--${a.status}`}>{a.status === 'active' ? 'Activa' : 'Suspendida'}</span></td>
                  <td>
                    {a.status === 'active' ? (
                      <button type="button" className="ca-link" disabled={busy === a.id} onClick={() => void setAccountStatus(a.id, 'suspended')}>Suspender</button>
                    ) : (
                      <button type="button" className="ca-link" disabled={busy === a.id} onClick={() => void setAccountStatus(a.id, 'active')}>Reactivar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab !== 'accounts' && tab !== 'config' && tab !== 'requests' && tab !== 'metrics' && (
        <ul className="ca-list">
          {!loading && listings.length === 0 && <li className="ca-empty">No hay anuncios en esta vista.</li>}
          {listings.map((l) => (
            <li key={l.id} className="ca-item">
              <div className="ca-item__head">
                <div>
                  <p className="ca-item__meta">
                    <span className={`ca-state ca-state--${l.state}`}>{STATE[l.state] || l.state}</span>
                    {l.review_pending && <span className="ca-state ca-state--pendiente">Edición pendiente</span>}
                    <span>{MODE[l.mode]} · {TYPE[l.collab_type]}</span>
                    {l.review_flags?.length > 0 && <span className="ca-flags">Detectado: {l.review_flags.map((f) => FLAG[f] || f).join(', ')}</span>}
                    {l.wants_support && <span className="ca-badge">Pide apoyo</span>}
                    {l.linkedin_authorized && <span className="ca-badge">LinkedIn ✓</span>}
                    {l.wants_support && l.support_status && l.support_status !== 'pendiente' && (
                      <span className="ca-badge">Apoyo: {SUPPORT_STATE[l.support_status] || l.support_status}</span>
                    )}
                  </p>
                  <h3 className="ca-item__title">{l.title}</h3>
                  <p className="ca-item__call">{l.call_title}{l.call_close_date ? ` · cierre ${new Date(l.call_close_date).toLocaleDateString('es-ES')}` : ''}</p>
                </div>
                <div className="ca-item__actions">
                  {(l.state === 'pendiente' || l.review_pending) && (
                    <>
                      <button type="button" className="btn-primary" disabled={busy === l.id} onClick={() => void act(l.id, 'approve')}>Aprobar</button>
                      <button type="button" className="btn-secondary" disabled={busy === l.id} onClick={() => void act(l.id, 'reject')}>Rechazar</button>
                    </>
                  )}
                  {l.state === 'publicado' && (
                    <button type="button" className="btn-secondary" disabled={busy === l.id} onClick={() => void act(l.id, 'pause')}>Pausar</button>
                  )}
                  {!['cerrado', 'rechazado'].includes(l.state) && (
                    <button type="button" className="ca-link" disabled={busy === l.id} onClick={() => void act(l.id, 'retire')}>Retirar</button>
                  )}
                  <button type="button" className="ca-link" onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
                    {expanded === l.id ? 'Ocultar' : 'Ver detalle'}
                  </button>
                </div>
              </div>
              {tab === 'linkedin' && (
                <div className="ca-share">
                  {l.state === 'publicado' && linkedInText(l) && !linkedInVersionOk(l) ? (
                    <p className="ca-hint ca-warn">
                      La versión publicada no coincide con el texto que el autor autorizó para LinkedIn
                      {l.linkedin_authorized_at ? ` (autorizado el ${fmt(l.linkedin_authorized_at)})` : ''}.
                      No se puede difundir hasta que el autor vuelva a autorizar la versión actual.
                    </p>
                  ) : l.state === 'publicado' && linkedInText(l) ? (
                    <>
                      <p className="ca-label">Texto para LinkedIn · versión pública aprobada, sin entidad, persona ni contacto</p>
                      {l.linkedin_authorized_at && <p className="ca-hint">Autorizado por el autor el {fmt(l.linkedin_authorized_at)} para esta versión.</p>}
                      {l.review_pending && <p className="ca-hint">Hay una edición pendiente de revisión: se comparte la versión pública actual.</p>}
                      <pre className="ca-share__text">{linkedInText(l)}</pre>
                      <div className="ca-share__actions">
                        <button type="button" className="btn-secondary" onClick={() => void copyShareText(l)}>
                          {copiedShare === l.id ? <Check size={14} /> : <Copy size={14} />} {copiedShare === l.id ? 'Copiado' : 'Copiar texto'}
                        </button>
                        <button type="button" className="btn-primary" onClick={() => shareOnLinkedIn(l)}>
                          <ExternalLink size={14} /> Compartir en LinkedIn
                        </button>
                        <a className="ca-link" href={publicUrl(l.public_id)} target="_blank" rel="noopener noreferrer">Ver ficha pública ↗</a>
                      </div>
                      <p className="ca-hint">LinkedIn mostrará la tarjeta del anuncio (título, convocatoria y especialidades). Pega el texto, revísalo y publica desde la página de Álamos Innovación.</p>
                    </>
                  ) : (
                    <p className="ca-hint">Solo se puede difundir cuando el anuncio está publicado.</p>
                  )}
                </div>
              )}
              {tab === 'support' && (
                <div className="ca-share">
                  <p className="ca-label">Solicitud de apoyo profesional · estado: {SUPPORT_STATE[l.support_status || 'pendiente'] || l.support_status}</p>
                  <p className="ca-text">
                    {[l.entity_label || l.profile_entity_name, l.contact_name, l.contact_email || l.account_email, l.contact_phone || l.profile_phone]
                      .filter(Boolean).join(' · ')}
                  </p>
                  <div className="ca-share__actions">
                    {(l.support_status || 'pendiente') !== 'en_crm' && (
                      <button type="button" className="btn-primary" disabled={busy === l.id} onClick={() => void setSupport(l, 'en_crm')}>Crear cliente en el CRM</button>
                    )}
                    {(l.support_status || 'pendiente') === 'pendiente' && (
                      <button type="button" className="btn-secondary" disabled={busy === l.id} onClick={() => void setSupport(l, 'descartada')}>Descartar</button>
                    )}
                  </div>
                  <p className="ca-hint">Crea la ficha en Clientes con el contacto del anuncio y una nota con el anuncio y la convocatoria. No se duplica si ya existe.</p>
                </div>
              )}
              {expanded === l.id && (
                <div className="ca-item__body">
                  <div>
                    <p className="ca-label">Resumen{l.review_pending ? ' (versión nueva, pendiente)' : ''}</p>
                    <p className="ca-text">{l.summary}</p>
                    {l.details && (<><p className="ca-label">Descripción profesional</p><p className="ca-text">{l.details}</p></>)}
                    {l.review_pending && l.published_snapshot?.summary && (
                      <><p className="ca-label">Versión pública actual</p><p className="ca-text">{l.published_snapshot.summary}</p></>
                    )}
                    <p className="ca-label">Especialidades</p>
                    <p className="ca-text">{l.specialties?.join(', ') || '—'}</p>
                  </div>
                  <div className="ca-private">
                    <p className="ca-label">Datos privados (solo para operar el servicio)</p>
                    <p>Cuenta: {l.account_email}{l.account_status !== 'active' ? ' (suspendida)' : ''}</p>
                    <p>Entidad: {l.entity_label || '—'}</p>
                    <p>Contacto: {[l.contact_name, l.contact_email, l.contact_phone].filter(Boolean).join(' · ') || '—'}</p>
                    <p>Creado: {fmt(l.created_at)} · Actualizado: {fmt(l.updated_at)}</p>
                    {l.state === 'publicado' && (
                      <a className="ca-link" href={`https://www.alamosinnovacion.com/es/colabora/anuncios/${l.public_id}`} target="_blank" rel="noopener noreferrer">
                        Ver ficha pública ↗
                      </a>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ---------- Métricas (agregadas, sin datos personales) ---------- */

function Bars({ title, rows, empty = 'Sin datos todavía.' }: { title: string; rows: Array<{ label: string; n: number; extra?: string }>; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n))
  return (
    <div className="ca-metric">
      <h3>{title}</h3>
      {rows.length === 0 ? <p className="ca-hint">{empty}</p> : (
        <ul className="ca-bars">
          {rows.map((r) => (
            <li key={r.label}>
              <span className="ca-bars__label" title={r.label}>{r.label}</span>
              <span className="ca-bars__track"><span className="ca-bars__fill" style={{ width: `${(r.n / max) * 100}%` }} /></span>
              <span className="ca-bars__n">{r.n}{r.extra ? <small> {r.extra}</small> : null}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function MetricsView({ m }: { m: Metrics }) {
  const n = (rows: Array<{ n: number }>) => rows.reduce((s, r) => s + r.n, 0)
  const modeN = (k: string) => m.byMode.find((r) => r.mode === k)?.n ?? 0
  const views = n(m.viewsBySource)
  return (
    <section className="ca-metrics">
      <div className="ca-kpis">
        <div className="ca-kpi"><span>{modeN('busco')}</span>Demandas</div>
        <div className="ca-kpi"><span>{modeN('ofrezco')}</span>Ofertas</div>
        <div className="ca-kpi"><span>{n(m.requestsByStatus)}</span>Solicitudes</div>
        <div className="ca-kpi"><span>{m.acceptanceRate === null ? '—' : `${Math.round(m.acceptanceRate * 100)} %`}</span>Aceptación (de las respondidas)</div>
        <div className="ca-kpi"><span>{views}</span>Visitas a fichas</div>
      </div>
      <div className="ca-metrics__grid">
        <Bars title="Convocatorias con más anuncios" rows={m.byCall.map((r) => ({ label: r.call_title, n: r.total, extra: `(${r.busco} D · ${r.ofrezco} O)` }))} />
        <Bars title="Especialidades más usadas" rows={m.bySpecialty.map((r) => ({ label: r.specialty, n: r.n }))} />
        <Bars title="Tipo de colaboración" rows={m.byType.map((r) => ({ label: TYPE[r.collab_type] || r.collab_type, n: r.n }))} />
        <Bars title="Anuncios por estado" rows={m.byState.map((r) => ({ label: STATE[r.state] || r.state, n: r.n }))} />
        <Bars title="Solicitudes por estado" rows={m.requestsByStatus.map((r) => ({ label: REQUEST_STATE[r.status] || r.status, n: r.n }))} />
        <Bars title="Resultado declarado de las conexiones" rows={m.outcomes.map((r) => ({ label: OUTCOME[r.outcome] || r.outcome, n: r.n }))} />
        <Bars title="Motivos de cierre" rows={m.closeReasons.map((r) => ({ label: CLOSE_REASON[r.reason] || r.reason, n: r.n }))} />
        <Bars title="Visitas por procedencia" rows={m.viewsBySource.map((r) => ({ label: SOURCE[r.source] || r.source, n: r.n }))} />
        <Bars title="Personas que siguen cada convocatoria" rows={(m.alertsByCall || []).map((r) => ({ label: r.call_title, n: r.n }))} />
        <Bars title="Visitas en los últimos 30 días" rows={m.viewsByDay.map((r) => ({ label: new Date(`${r.day}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }), n: r.n }))} />
      </div>
      <p className="ca-hint">Cifras agregadas. El resultado lo declara cada parte de una conexión (hay dos respuestas por conexión, que pueden no coincidir); «Sin responder» es quien aún no lo ha indicado.</p>
    </section>
  )
}

export default ColaboraAdmin
