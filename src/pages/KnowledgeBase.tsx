import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Loader2,
  Search,
  Building2,
  Globe,
  Briefcase,
  Filter,
  ExternalLink,
  X,
} from 'lucide-react'
import './Page.css'
import './KnowledgeBase.css'

/* ============================================================
   Tipos espejados del backend (/ai/fichas)
   ============================================================ */

interface FichaMeta {
  slug: string
  organisms: string[]
  aliases: string[]
  aliasCount: number
  aidType: string | null
  regime: string | null
  aidObject: string | null
  sectorBound: string | null
  targetCompany: string | null
  collaborationRequired: boolean
  internationalRequired: boolean
  convocatoriaTipo: string | null
  lastUpdated: string | null
  similarAlternatives: string[]
  exclusiveWith: string[]
  sourceUrls: Record<string, string>
}

interface FichasResponse {
  count: number
  totalAliases: number
  fichas: FichaMeta[]
}

/* ============================================================
   Helpers presentación
   ============================================================ */

/** Detecta el "organismo principal" (primer match contra organismos conocidos) para badge dominante. */
const detectMainOrganism = (organisms: string[]): string => {
  const map: Record<string, string> = {
    cdti: 'CDTI',
    aei: 'AEI',
    enisa: 'ENISA',
    eic: 'EIC',
    eit: 'EIT',
    eureka: 'EUREKA',
    cinea: 'EU',
    eacea: 'EU',
    sepie: 'EU',
    comisión: 'EU',
    european: 'EU',
    rea: 'EU',
    hadea: 'EU',
    horizonte: 'EU',
  }
  const lower = organisms.map(o => o.toLowerCase()).join(' ')
  for (const [needle, label] of Object.entries(map)) {
    if (lower.includes(needle)) return label
  }
  return organisms[0] || 'Otro'
}

const ORGANISM_COLOR: Record<string, string> = {
  CDTI: 'organism-cdti',
  AEI: 'organism-aei',
  ENISA: 'organism-enisa',
  EIC: 'organism-eic',
  EIT: 'organism-eit',
  EUREKA: 'organism-eureka',
  EU: 'organism-eu',
}

/** Categoriza el aidType en familia para chip humanizado. */
const humanizeAidType = (aid: string | null): string => {
  if (!aid) return '—'
  const a = aid.toLowerCase()
  if (a.includes('prestamo_participativo')) return 'Préstamo participativo'
  if (a.includes('prestamo')) return 'Préstamo reembolsable'
  if (a.includes('subvencion')) return 'Subvención'
  if (a.includes('mixta') || a.includes('blended')) return 'Mixta (grant + equity)'
  if (a.includes('equity') || a.includes('inversion')) return 'Equity / inversión'
  if (a.includes('subgrant') || a.includes('coinversion')) return 'Sub-grant + co-inversión'
  if (a.includes('label')) return 'Label EUREKA + financiación nacional'
  return aid.replace(/_/g, ' ')
}

const AID_TYPE_CLASS: Record<string, string> = {
  'Subvención': 'aid-subvencion',
  'Préstamo reembolsable': 'aid-prestamo',
  'Préstamo participativo': 'aid-participativo',
  'Equity / inversión': 'aid-equity',
  'Mixta (grant + equity)': 'aid-mixta',
  'Sub-grant + co-inversión': 'aid-mixta',
  'Label EUREKA + financiación nacional': 'aid-label',
}

const humanizeAidObject = (obj: string | null): string => {
  if (!obj) return '—'
  return obj.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
}

const humanizeSlug = (slug: string): string => {
  return slug
    .split('-')
    .map(p => p.length <= 4 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1))
    .join(' ')
}

/* ============================================================
   Componente
   ============================================================ */

const KnowledgeBase = () => {
  const [data, setData] = useState<FichasResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [search, setSearch] = useState('')
  const [selectedOrganism, setSelectedOrganism] = useState<string>('all')
  const [selectedAidType, setSelectedAidType] = useState<string>('all')
  const [selectedScope, setSelectedScope] = useState<'all' | 'sectorial' | 'transversal' | 'international'>('all')

  // Detalle modal
  const [activeFicha, setActiveFicha] = useState<FichaMeta | null>(null)

  useEffect(() => {
    const fetchFichas = async () => {
      try {
        const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || 'https://alamosinnovacionia.onrender.com'
        const token = localStorage.getItem('authToken') || ''
        const res = await fetch(`${API_BASE}/ai/fichas`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json() as FichasResponse
        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load fichas')
      } finally {
        setLoading(false)
      }
    }
    fetchFichas()
  }, [])

  /* ---- enriched fichas con derivados ---- */
  const enriched = useMemo(() => {
    if (!data) return []
    return data.fichas.map(f => ({
      ...f,
      mainOrganism: detectMainOrganism(f.organisms),
      humanAidType: humanizeAidType(f.aidType),
      humanAidObject: humanizeAidObject(f.aidObject),
      humanName: humanizeSlug(f.slug),
    }))
  }, [data])

  /* ---- filtros aplicados ---- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return enriched.filter(f => {
      if (selectedOrganism !== 'all' && f.mainOrganism !== selectedOrganism) return false
      if (selectedAidType !== 'all' && f.humanAidType !== selectedAidType) return false
      if (selectedScope === 'sectorial' && !f.sectorBound) return false
      if (selectedScope === 'transversal' && f.sectorBound) return false
      if (selectedScope === 'international' && !f.internationalRequired) return false
      if (q) {
        const haystack = [
          f.slug,
          f.humanName,
          ...f.aliases,
          ...f.organisms,
          f.humanAidObject,
        ].join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [enriched, search, selectedOrganism, selectedAidType, selectedScope])

  /* ---- agregaciones para los chips de filtro ---- */
  const organismOptions = useMemo(() => {
    const counts = new Map<string, number>()
    enriched.forEach(f => counts.set(f.mainOrganism, (counts.get(f.mainOrganism) || 0) + 1))
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  }, [enriched])

  const aidTypeOptions = useMemo(() => {
    const counts = new Map<string, number>()
    enriched.forEach(f => counts.set(f.humanAidType, (counts.get(f.humanAidType) || 0) + 1))
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  }, [enriched])

  const clearFilters = () => {
    setSearch('')
    setSelectedOrganism('all')
    setSelectedAidType('all')
    setSelectedScope('all')
  }
  const filtersActive = search || selectedOrganism !== 'all' || selectedAidType !== 'all' || selectedScope !== 'all'

  /* ============================================================
     Render
     ============================================================ */

  if (loading) {
    return (
      <div className="page">
        <div className="kb-loading">
          <Loader2 size={28} className="kb-spin" />
          <p>Loading knowledge base…</p>
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="page">
        <div className="kb-error">
          <p>Failed to load knowledge base: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page page--knowledge-base">
      <header className="kb-header">
        <div className="kb-header-left">
          <div className="kb-icon-circle">
            <BookOpen size={22} />
          </div>
          <div>
            <h1>Knowledge Base</h1>
            <p className="kb-subtitle">
              Programas de financiación I+D+i que el agente reconoce con detalle estructurado.
              Cada ficha contiene reglas de elegibilidad, criterios de evaluación, ejemplos canónicos,
              anti-patrones de redacción y tips por perfil de cliente.
            </p>
          </div>
        </div>
        <div className="kb-stats">
          <div className="kb-stat">
            <span className="kb-stat-value">{data?.count}</span>
            <span className="kb-stat-label">Programas</span>
          </div>
          <div className="kb-stat">
            <span className="kb-stat-value">{data?.totalAliases}</span>
            <span className="kb-stat-label">Aliases indexados</span>
          </div>
          <div className="kb-stat">
            <span className="kb-stat-value">{organismOptions.length}</span>
            <span className="kb-stat-label">Organismos</span>
          </div>
        </div>
      </header>

      {/* ── FILTROS ── */}
      <section className="kb-filters">
        <div className="kb-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar por nombre, alias, organismo…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" className="kb-search-clear" onClick={() => setSearch('')} aria-label="Clear">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="kb-filter-group">
          <label className="kb-filter-label"><Building2 size={13} /> Organismo</label>
          <div className="kb-chips">
            <button
              type="button"
              className={`kb-chip ${selectedOrganism === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedOrganism('all')}
            >
              Todos ({enriched.length})
            </button>
            {organismOptions.map(([org, count]) => (
              <button
                key={org}
                type="button"
                className={`kb-chip ${selectedOrganism === org ? 'active' : ''} ${ORGANISM_COLOR[org] || ''}`}
                onClick={() => setSelectedOrganism(org)}
              >
                {org} ({count})
              </button>
            ))}
          </div>
        </div>

        <div className="kb-filter-group">
          <label className="kb-filter-label"><Briefcase size={13} /> Tipo de instrumento</label>
          <div className="kb-chips">
            <button
              type="button"
              className={`kb-chip ${selectedAidType === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedAidType('all')}
            >
              Todos
            </button>
            {aidTypeOptions.map(([type, count]) => (
              <button
                key={type}
                type="button"
                className={`kb-chip ${selectedAidType === type ? 'active' : ''}`}
                onClick={() => setSelectedAidType(type)}
              >
                {type} ({count})
              </button>
            ))}
          </div>
        </div>

        <div className="kb-filter-group">
          <label className="kb-filter-label"><Filter size={13} /> Alcance</label>
          <div className="kb-chips">
            <button
              type="button"
              className={`kb-chip ${selectedScope === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedScope('all')}
            >
              Todos
            </button>
            <button
              type="button"
              className={`kb-chip ${selectedScope === 'sectorial' ? 'active' : ''}`}
              onClick={() => setSelectedScope('sectorial')}
            >
              Sectoriales
            </button>
            <button
              type="button"
              className={`kb-chip ${selectedScope === 'transversal' ? 'active' : ''}`}
              onClick={() => setSelectedScope('transversal')}
            >
              Transversales
            </button>
            <button
              type="button"
              className={`kb-chip ${selectedScope === 'international' ? 'active' : ''}`}
              onClick={() => setSelectedScope('international')}
            >
              Requieren partner internacional
            </button>
          </div>
        </div>

        {filtersActive && (
          <button type="button" className="kb-clear-filters" onClick={clearFilters}>
            <X size={13} /> Limpiar filtros
          </button>
        )}
      </section>

      {/* ── CONTADOR RESULTADOS ── */}
      <div className="kb-results-bar">
        <span>
          Mostrando <strong>{filtered.length}</strong> de {data?.count} programas
        </span>
      </div>

      {/* ── GRID DE CARDS ── */}
      <section className="kb-grid">
        {filtered.map(f => (
          <button
            type="button"
            key={f.slug}
            className="kb-card"
            onClick={() => setActiveFicha(f)}
          >
            <div className="kb-card-top">
              <span className={`kb-organism-badge ${ORGANISM_COLOR[f.mainOrganism] || ''}`}>
                {f.mainOrganism}
              </span>
              {f.sectorBound && (
                <span className="kb-sector-badge">{f.sectorBound.replace(/_/g, ' ')}</span>
              )}
              {f.internationalRequired && (
                <span className="kb-intl-badge"><Globe size={11} /> Internacional</span>
              )}
            </div>
            <h3 className="kb-card-title">{f.humanName}</h3>
            <p className="kb-card-aliases">
              {f.aliases.slice(0, 3).join(' · ')}
              {f.aliases.length > 3 && <> · +{f.aliases.length - 3} más</>}
            </p>
            <div className="kb-card-bottom">
              <span className={`kb-aid-pill ${AID_TYPE_CLASS[f.humanAidType] || ''}`}>
                {f.humanAidType}
              </span>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="kb-empty">
            <p>No hay programas que coincidan con los filtros aplicados.</p>
            <button type="button" className="btn-secondary" onClick={clearFilters}>
              Limpiar filtros
            </button>
          </div>
        )}
      </section>

      {/* ── MODAL DETALLE ── */}
      {activeFicha && (
        <div className="kb-modal-overlay" onClick={() => setActiveFicha(null)}>
          <div className="kb-modal" onClick={e => e.stopPropagation()}>
            <header className="kb-modal-header">
              <div>
                <div className="kb-modal-badges">
                  <span className={`kb-organism-badge ${ORGANISM_COLOR[detectMainOrganism(activeFicha.organisms)] || ''}`}>
                    {detectMainOrganism(activeFicha.organisms)}
                  </span>
                  {activeFicha.sectorBound && (
                    <span className="kb-sector-badge">{activeFicha.sectorBound.replace(/_/g, ' ')}</span>
                  )}
                </div>
                <h2>{humanizeSlug(activeFicha.slug)}</h2>
                <code className="kb-modal-slug">{activeFicha.slug}</code>
              </div>
              <button type="button" className="kb-modal-close" onClick={() => setActiveFicha(null)} aria-label="Close">
                <X size={18} />
              </button>
            </header>

            <div className="kb-modal-body">
              <div className="kb-modal-row">
                <span className="kb-modal-label">Organismos</span>
                <span>{activeFicha.organisms.join(' · ')}</span>
              </div>
              <div className="kb-modal-row">
                <span className="kb-modal-label">Tipo de instrumento</span>
                <span className={`kb-aid-pill ${AID_TYPE_CLASS[humanizeAidType(activeFicha.aidType)] || ''}`}>
                  {humanizeAidType(activeFicha.aidType)}
                </span>
              </div>
              {activeFicha.aidObject && (
                <div className="kb-modal-row">
                  <span className="kb-modal-label">Financia</span>
                  <span>{humanizeAidObject(activeFicha.aidObject)}</span>
                </div>
              )}
              {activeFicha.convocatoriaTipo && (
                <div className="kb-modal-row">
                  <span className="kb-modal-label">Convocatoria</span>
                  <span>{activeFicha.convocatoriaTipo.replace(/_/g, ' ')}</span>
                </div>
              )}
              {activeFicha.targetCompany && (
                <div className="kb-modal-row">
                  <span className="kb-modal-label">Beneficiario típico</span>
                  <span>{activeFicha.targetCompany.replace(/_/g, ' ')}</span>
                </div>
              )}
              <div className="kb-modal-row">
                <span className="kb-modal-label">Colaboración requerida</span>
                <span>{activeFicha.collaborationRequired ? 'Sí (consorcio)' : 'No'}</span>
              </div>
              <div className="kb-modal-row">
                <span className="kb-modal-label">Partner internacional</span>
                <span>{activeFicha.internationalRequired ? 'Sí' : 'No'}</span>
              </div>

              <div className="kb-modal-aliases">
                <span className="kb-modal-label">Aliases indexados ({activeFicha.aliases.length})</span>
                <div className="kb-alias-chips">
                  {activeFicha.aliases.map((a, i) => (
                    <code key={i} className="kb-alias-chip">{a}</code>
                  ))}
                </div>
              </div>

              {activeFicha.similarAlternatives.length > 0 && (
                <div className="kb-modal-aliases">
                  <span className="kb-modal-label">Alternativas relacionadas</span>
                  <div className="kb-alias-chips">
                    {activeFicha.similarAlternatives.map((a, i) => (
                      <code key={i} className="kb-alias-chip kb-alias-chip--alt">{a}</code>
                    ))}
                  </div>
                </div>
              )}

              {activeFicha.exclusiveWith.length > 0 && (
                <div className="kb-modal-aliases">
                  <span className="kb-modal-label">Incompatible con</span>
                  <div className="kb-alias-chips">
                    {activeFicha.exclusiveWith.map((a, i) => (
                      <code key={i} className="kb-alias-chip kb-alias-chip--excl">{a}</code>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(activeFicha.sourceUrls).length > 0 && (
                <div className="kb-modal-sources">
                  <span className="kb-modal-label">Fuentes</span>
                  <ul>
                    {Object.entries(activeFicha.sourceUrls).map(([k, v]) => (
                      <li key={k}>
                        {v.startsWith('http') ? (
                          <a href={v} target="_blank" rel="noopener noreferrer">
                            {k.replace(/_/g, ' ')} <ExternalLink size={11} />
                          </a>
                        ) : (
                          <>
                            <strong>{k.replace(/_/g, ' ')}:</strong> {v}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {activeFicha.lastUpdated && (
                <p className="kb-modal-updated">
                  Última revisión: {activeFicha.lastUpdated}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default KnowledgeBase
