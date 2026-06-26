import { useState, useEffect, useMemo } from 'react'
import {
  X, Sparkles, Plus, Trash2, Download, Loader2,
  Lightbulb, Users, Calendar, Activity, CheckCircle2, AlertCircle, ChevronLeft,
} from 'lucide-react'
import SearchableSelect from './SearchableSelect'
import { generateProposalIdeaDocx } from '../utils/proposalIdeasDocx'
import { persistAppData } from '../utils/appData'
import './ProposalIdeasModal.css'

/* ── Tipos ─────────────────────────────────────────── */

export interface ProposalIdea {
  objective: string
  mainInnovation: string
  initialTrl: number  // 1-9
  partners: Partner[]
  durationMonths: number
  workPackages: WorkPackage[]
}

export interface Partner {
  id: string  // local UI id
  type: 'customer' | 'external'
  customerId?: string  // si type === 'customer'
  name: string
  web: string
  role: string
}

export interface WorkPackage {
  id: string
  name: string
  tasks: string[]
  deliverables: string[]
}

interface Customer {
  id: string
  name: string
  website?: string
  category?: string
}

interface ProposalIdeasModalProps {
  /** Cliente principal del que parte la idea */
  customer: Customer | null
  /** Para poder seleccionar otros clientes como partners */
  allCustomers: Customer[]
  /** Idea inicial — si se pasa, abre en modo edición. */
  initialIdea?: ProposalIdea
  /** ID persistido de la idea (cuando se edita una existente). */
  ideaId?: string
  onClose: () => void
  /** Notifica al padre que se guardó una idea (para refresh de lista). */
  onSaved?: () => void
}

import { getApiBase, getAiApiBase } from '../utils/aiApiBase'

const API_BASE = getApiBase()
const AI_API_BASE = getAiApiBase()
const AI_BYPASS_CLOUDFLARE = API_BASE !== AI_API_BASE

/* ── Componente ─────────────────────────────────────── */

const ProposalIdeasModal = ({ customer, allCustomers, initialIdea, ideaId, onClose, onSaved }: ProposalIdeasModalProps) => {
  const isEditing = !!initialIdea
  const [step, setStep] = useState<'form' | 'generating' | 'preview' | 'error'>(
    isEditing ? 'preview' : 'form'
  )
  const [idea, setIdea] = useState<ProposalIdea>(
    initialIdea ||
    {
      objective: '',
      mainInnovation: '',
      initialTrl: 4,
      partners: customer
        ? [{ id: `p-${Date.now()}`, type: 'customer', customerId: customer.id, name: customer.name, web: customer.website || '', role: 'Coordinador' }]
        : [],
      durationMonths: 24,
      workPackages: [],
    }
  )
  const [improved, setImproved] = useState<ProposalIdea | null>(isEditing ? initialIdea || null : null)
  const [errorMsg, setErrorMsg] = useState('')
  const [exporting, setExporting] = useState(false)

  // Lock body scroll + ESC para cerrar
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  /* ── Partners CRUD ── */
  const addCustomerPartner = (customerId: string) => {
    const c = allCustomers.find(x => x.id === customerId)
    if (!c) return
    if (idea.partners.some(p => p.type === 'customer' && p.customerId === c.id)) return
    setIdea(prev => ({
      ...prev,
      partners: [...prev.partners, {
        id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'customer',
        customerId: c.id,
        name: c.name,
        web: c.website || '',
        role: 'Socio',
      }],
    }))
  }
  const addExternalPartner = () => {
    setIdea(prev => ({
      ...prev,
      partners: [...prev.partners, {
        id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'external',
        name: '',
        web: '',
        role: 'Socio externo',
      }],
    }))
  }
  const updatePartner = (id: string, patch: Partial<Partner>) => {
    setIdea(prev => ({
      ...prev,
      partners: prev.partners.map(p => p.id === id ? { ...p, ...patch } : p),
    }))
  }
  const removePartner = (id: string) => {
    setIdea(prev => ({ ...prev, partners: prev.partners.filter(p => p.id !== id) }))
  }

  /* ── Work Packages CRUD ── */
  const addWp = () => {
    const wpNum = idea.workPackages.length + 1
    setIdea(prev => ({
      ...prev,
      workPackages: [...prev.workPackages, {
        id: `wp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: `WP${wpNum}: `,
        tasks: [''],
        deliverables: [''],
      }],
    }))
  }
  const updateWp = (id: string, patch: Partial<WorkPackage>) => {
    setIdea(prev => ({
      ...prev,
      workPackages: prev.workPackages.map(w => w.id === id ? { ...w, ...patch } : w),
    }))
  }
  const removeWp = (id: string) => {
    setIdea(prev => ({ ...prev, workPackages: prev.workPackages.filter(w => w.id !== id) }))
  }

  /* ── Generar con IA ── */
  const handleGenerate = async () => {
    // Validación mínima
    if (!idea.objective.trim() || !idea.mainInnovation.trim()) {
      alert('Completa al menos Objective y Main Innovation antes de generar.')
      return
    }
    setStep('generating')
    setErrorMsg('')
    try {
      const token = localStorage.getItem('authToken') || ''

      // 1) WARMUP DOBLE: dos pings con espera para asegurar que Render
      //    está despierto. El primer ping arranca el server (puede tardar
      //    30-50s en free tier); el segundo confirma que ya está listo.
      console.log(
        `[ProposalIdea] API=${API_BASE} | AI=${AI_API_BASE}` +
        (AI_BYPASS_CLOUDFLARE ? ' (bypass Cloudflare → Render directo)' : '')
      )
      console.log(`[ProposalIdea] warmup 1/2 — ${AI_API_BASE}/health`)
      let healthOk = false
      try {
        const t0 = Date.now()
        const healthRes = await fetch(`${AI_API_BASE}/health`, { method: 'GET' })
        healthOk = healthRes.ok
        console.log(`[ProposalIdea] /health ${healthRes.status} (tardó ${Date.now() - t0}ms)`)
      } catch (e) {
        console.warn(`[ProposalIdea] /health 1 falló:`, e)
      }

      // Segundo ping para confirmar warm (solo si el primero tardó)
      if (healthOk) {
        try {
          const t0 = Date.now()
          await fetch(`${AI_API_BASE}/health`, { method: 'GET' })
          console.log(`[ProposalIdea] warmup 2/2 confirmado (tardó ${Date.now() - t0}ms)`)
        } catch { /* ignore */ }
      }

      // 2) POST real con timeout explícito de 90s (Claude puede tardar 30-60s)
      let res: Response
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 90_000)
        try {
          res = await fetch(`${AI_API_BASE}/ai/improve-proposal-idea`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              customer: customer ? { id: customer.id, name: customer.name } : null,
              idea: {
                objective: idea.objective,
                mainInnovation: idea.mainInnovation,
                initialTrl: idea.initialTrl,
                durationMonths: idea.durationMonths,
                partners: idea.partners.map(p => ({
                  id: p.id,
                  type: p.type,
                  name: p.name,
                  web: p.web,
                  role: p.role,
                  ...(p.customerId ? { customerId: p.customerId } : {}),
                })),
                workPackages: idea.workPackages.map(w => ({
                  id: w.id,
                  name: w.name,
                  tasks: w.tasks,
                  deliverables: w.deliverables,
                })),
              },
            }),
            signal: controller.signal,
          })
        } finally {
          clearTimeout(timeout)
        }
      } catch (fetchErr) {
        const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
        // AbortError = timeout interno (>90s)
        if (fetchErr instanceof DOMException && fetchErr.name === 'AbortError') {
          throw new Error(
            `Timeout: el agente IA tardó más de 90 segundos sin responder.\n\n` +
            `Causa probable: Claude está saturado o el backend tarda mucho.\n\n` +
            `Usa "Continuar sin IA →" para descargar el Word sin la mejora,\n` +
            `o vuelve a probar en unos minutos.`
          )
        }
        // Si /health funcionó pero el POST falla → 99% es que Render hizo
        // sleep durante el POST y devuelve 502/504 sin CORS headers, que
        // el browser reporta como "CORS error" engañosamente.
        if (healthOk) {
          throw new Error(
            `El backend respondió al ping pero el POST a /ai/improve-proposal-idea falló.\n\n` +
            `Causas probables (en orden de probabilidad):\n` +
            `  1. Cloudflare en api.alamosinnovacion.com devolvió 502/504 sin headers CORS\n` +
            `     (el browser lo muestra como "CORS error" — mira Network tab: status 502).\n` +
            `     Tras el próximo deploy de Vercel, las llamadas IA van directo a Render.\n` +
            `  2. Render free tier timeout (cold-start + Claude).\n` +
            `  3. Backend devolvió 500 — revisa status real en Network (F12).\n\n` +
            `Error técnico: ${msg}\n\n` +
            `RECOMENDACIÓN:\n` +
            `  • Pulsa "Continuar sin IA →" para guardar y descargar Word\n` +
            `  • O vuelve a pulsar "Mejorar con IA" — el backend ya está caliente`
          )
        }
        throw new Error(
          `No se pudo conectar con el servidor (${msg}).\n\n` +
          `Backend dormido o sin conexión. Usa "Continuar sin IA →" para seguir.`
        )
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        if (res.status === 404) {
          throw new Error('HTTP 404 — Endpoint /ai/improve-proposal-idea NO existe en el backend desplegado. Necesita redeploy.')
        }
        if (res.status === 401) {
          throw new Error('HTTP 401 — No autenticado. Refresca la sesión cerrando y abriendo la app.')
        }
        throw new Error(err.error || `HTTP ${res.status}: ${err.error || 'desconocido'}`)
      }
      const data = await res.json()
      if (!data.idea) throw new Error('Respuesta del agente sin campo "idea"')
      const finalIdea = data.idea as ProposalIdea
      setImproved(finalIdea)
      // Persistir en localStorage indexed por customerId → alimenta
      // Customer Context y el Funding Profile / Roadmap.
      if (customer?.id) {
        try {
          const raw = localStorage.getItem('proposalIdeas') || '{}'
          const all = JSON.parse(raw) as Record<string, Array<ProposalIdea & { id: string; createdAt: string; updatedAt: string }>>
          const list = all[customer.id] || []
          if (ideaId) {
            // MODO EDIT — actualiza la idea existente
            all[customer.id] = list.map(it => it.id === ideaId
              ? { ...finalIdea, id: ideaId, createdAt: it.createdAt, updatedAt: new Date().toISOString() }
              : it
            )
            console.log(`[ProposalIdea] updated ${ideaId} for customer ${customer.id}`)
          } else {
            // MODO NEW — añade
            const ideaWithMeta = {
              ...finalIdea,
              id: `pi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
            all[customer.id] = [...list, ideaWithMeta]
            console.log(`[ProposalIdea] saved for customer ${customer.id} — total: ${all[customer.id].length}`)
          }
          persistAppData('proposalIdeas', JSON.stringify(all))
          if (onSaved) onSaved()
        } catch (err) {
          console.warn('[ProposalIdea] failed to persist:', err)
        }
      }
      setStep('preview')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error desconocido')
      setStep('error')
    }
  }

  const handleExport = async () => {
    const finalIdea = improved || idea
    setExporting(true)
    try {
      await generateProposalIdeaDocx(finalIdea, customer?.name || 'Cliente')
    } catch (err) {
      alert('Error al exportar: ' + (err instanceof Error ? err.message : 'desconocido'))
    } finally {
      setExporting(false)
    }
  }

  const updateField = <K extends keyof ProposalIdea>(key: K, value: ProposalIdea[K]) => {
    if (improved) setImproved(prev => prev ? { ...prev, [key]: value } : prev)
    else setIdea(prev => ({ ...prev, [key]: value }))
  }

  const current = improved || idea

  // Available customers para selector partners (excluye los ya añadidos)
  const availablePartnerCustomers = useMemo(() => {
    const used = new Set(idea.partners.filter(p => p.type === 'customer').map(p => p.customerId))
    return allCustomers.filter(c => !used.has(c.id))
  }, [allCustomers, idea.partners])

  /* ── Render ── */
  return (
    <div className="pi-overlay" onClick={onClose}>
      <div className="pi-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <header className="pi-header">
          <div>
            <h2><Lightbulb size={18} /> New Proposal Idea</h2>
            <p>
              {customer ? <><strong>{customer.name}</strong> · </> : null}
              Rellena el cuestionario y el agente IA mejorará los textos antes de exportar a Word.
            </p>
          </div>
          <button className="pi-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>

        {/* Step: FORM */}
        {step === 'form' && (
          <div className="pi-body">
            {/* OBJECTIVE + INNOVATION */}
            <section className="pi-section">
              <label className="pi-field">
                <span><Lightbulb size={12} /> OBJECTIVE</span>
                <textarea
                  rows={3}
                  placeholder="¿Cuál es el objetivo principal del proyecto?"
                  value={idea.objective}
                  onChange={e => setIdea({ ...idea, objective: e.target.value })}
                />
              </label>
              <label className="pi-field">
                <span><Sparkles size={12} /> MAIN INNOVATION</span>
                <textarea
                  rows={3}
                  placeholder="¿Qué innovación aporta? ¿Diferenciación tecnológica clave?"
                  value={idea.mainInnovation}
                  onChange={e => setIdea({ ...idea, mainInnovation: e.target.value })}
                />
              </label>
            </section>

            {/* TRL slider + duration */}
            <section className="pi-section pi-section--row">
              <div className="pi-field">
                <span className="pi-field-label">
                  <Activity size={12} /> INITIAL TRL: <strong>{idea.initialTrl}</strong>
                </span>
                <input
                  type="range"
                  min={1}
                  max={9}
                  value={idea.initialTrl}
                  onChange={e => setIdea({ ...idea, initialTrl: Number(e.target.value) })}
                  className="pi-slider"
                />
                <div className="pi-slider-scale">
                  <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span>
                </div>
                <small className="pi-slider-hint">{trlLabel(idea.initialTrl)}</small>
              </div>
              <label className="pi-field">
                <span><Calendar size={12} /> DURATION (meses)</span>
                <input
                  type="number"
                  min={1}
                  max={84}
                  value={idea.durationMonths}
                  onChange={e => setIdea({ ...idea, durationMonths: Number(e.target.value) || 0 })}
                />
              </label>
            </section>

            {/* PARTNERS */}
            <section className="pi-section">
              <div className="pi-section-header">
                <h3><Users size={14} /> Partners</h3>
                <div className="pi-section-actions">
                  <div style={{ minWidth: 240 }}>
                    <SearchableSelect
                      value=""
                      onChange={(v) => v && addCustomerPartner(v)}
                      options={availablePartnerCustomers.map(c => ({ value: c.id, label: c.name }))}
                      placeholder="+ Añadir cliente como partner"
                      searchPlaceholder="Buscar cliente…"
                    />
                  </div>
                  <button type="button" className="pi-btn pi-btn--secondary" onClick={addExternalPartner}>
                    <Plus size={12} /> Partner externo
                  </button>
                </div>
              </div>
              {idea.partners.length === 0 ? (
                <p className="pi-empty">Aún no hay partners. Añade clientes o entidades externas.</p>
              ) : (
                <ul className="pi-partners-list">
                  {idea.partners.map(p => (
                    <li key={p.id} className={`pi-partner-row pi-partner-row--${p.type}`}>
                      <span className="pi-partner-badge">
                        {p.type === 'customer' ? 'CLIENTE' : 'EXTERNO'}
                      </span>
                      <input
                        type="text"
                        placeholder="Nombre"
                        value={p.name}
                        onChange={e => updatePartner(p.id, { name: e.target.value })}
                        readOnly={p.type === 'customer'}
                      />
                      <input
                        type="text"
                        placeholder="https://web.com"
                        value={p.web}
                        onChange={e => updatePartner(p.id, { web: e.target.value })}
                      />
                      <input
                        type="text"
                        placeholder="Rol (Coordinador, Socio, Subcontrata…)"
                        value={p.role}
                        onChange={e => updatePartner(p.id, { role: e.target.value })}
                      />
                      <button
                        type="button"
                        className="pi-row-remove"
                        onClick={() => removePartner(p.id)}
                        aria-label="Quitar"
                      >
                        <Trash2 size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* ACTIVITIES: WPs */}
            <section className="pi-section">
              <div className="pi-section-header">
                <h3><Activity size={14} /> Activities — Work Packages</h3>
                <button type="button" className="pi-btn pi-btn--secondary" onClick={addWp}>
                  <Plus size={12} /> Add Work Package
                </button>
              </div>
              {idea.workPackages.length === 0 ? (
                <p className="pi-empty">Sin WPs todavía. El agente puede sugerir una estructura si lo dejas vacío.</p>
              ) : (
                <div className="pi-wps">
                  {idea.workPackages.map((wp, i) => (
                    <div key={wp.id} className="pi-wp">
                      <div className="pi-wp-header">
                        <input
                          type="text"
                          className="pi-wp-name"
                          placeholder={`WP${i + 1}: nombre del work package`}
                          value={wp.name}
                          onChange={e => updateWp(wp.id, { name: e.target.value })}
                        />
                        <button
                          type="button"
                          className="pi-row-remove"
                          onClick={() => removeWp(wp.id)}
                          aria-label="Quitar WP"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div className="pi-wp-grid">
                        <div>
                          <label className="pi-wp-sublabel">TASKS</label>
                          <textarea
                            rows={3}
                            placeholder="Una tarea por línea"
                            value={wp.tasks.join('\n')}
                            onChange={e => updateWp(wp.id, { tasks: e.target.value.split('\n') })}
                          />
                        </div>
                        <div>
                          <label className="pi-wp-sublabel">DELIVERABLES</label>
                          <textarea
                            rows={3}
                            placeholder="Un entregable por línea (D1.1, D1.2…)"
                            value={wp.deliverables.join('\n')}
                            onChange={e => updateWp(wp.id, { deliverables: e.target.value.split('\n') })}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Step: GENERATING */}
        {step === 'generating' && (
          <div className="pi-body pi-loading">
            <Loader2 size={40} className="pi-spin" />
            <h3>Mejorando con IA…</h3>
            <p>El agente está revisando textos, mejorando redacción y completando estructura.</p>
            <p className="pi-loading-hint">Esto puede llevar 20-40 segundos.</p>
          </div>
        )}

        {/* Step: ERROR — con fallback "continuar sin IA" */}
        {step === 'error' && (
          <div className="pi-body pi-error">
            <AlertCircle size={40} />
            <h3>El agente IA no respondió</h3>
            <p style={{ whiteSpace: 'pre-line' }}>{errorMsg}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 }}>
              <button className="pi-btn pi-btn--secondary" onClick={() => setStep('form')}>
                ← Volver al formulario
              </button>
              <button
                className="pi-btn pi-btn--primary"
                onClick={() => {
                  // Continuar al preview con la idea ORIGINAL y persistirla.
                  // Permite descargar Word y guardar incluso sin IA.
                  setImproved(idea)
                  if (customer?.id) {
                    try {
                      const raw = localStorage.getItem('proposalIdeas') || '{}'
                      const all = JSON.parse(raw) as Record<string, Array<ProposalIdea & { id: string; createdAt: string; updatedAt: string }>>
                      const list = all[customer.id] || []
                      if (ideaId) {
                        all[customer.id] = list.map(it => it.id === ideaId
                          ? { ...idea, id: ideaId, createdAt: it.createdAt, updatedAt: new Date().toISOString() }
                          : it
                        )
                      } else {
                        all[customer.id] = [...list, {
                          ...idea,
                          id: `pi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                        }]
                      }
                      persistAppData('proposalIdeas', JSON.stringify(all))
                      if (onSaved) onSaved()
                    } catch (err) {
                      console.warn('[ProposalIdea] persist failed:', err)
                    }
                  }
                  setStep('preview')
                }}
              >
                Continuar sin IA →
              </button>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 12, maxWidth: 500 }}>
              "Continuar sin IA" guarda la idea tal cual la rellenaste y te lleva al preview
              para que puedas descargar el Word. Podrás re-mejorarla más tarde cuando el agente
              responda.
            </p>
          </div>
        )}

        {/* Step: PREVIEW */}
        {step === 'preview' && current && (
          <div className="pi-body pi-preview">
            <div className="pi-preview-banner">
              <CheckCircle2 size={18} />
              Propuesta mejorada por IA. Revisa y edita antes de exportar a Word.
            </div>

            <label className="pi-field">
              <span><Lightbulb size={12} /> OBJECTIVE</span>
              <textarea
                rows={4}
                value={current.objective}
                onChange={e => updateField('objective', e.target.value)}
              />
            </label>

            <label className="pi-field">
              <span><Sparkles size={12} /> MAIN INNOVATION</span>
              <textarea
                rows={4}
                value={current.mainInnovation}
                onChange={e => updateField('mainInnovation', e.target.value)}
              />
            </label>

            <div className="pi-section pi-section--row">
              <div className="pi-field">
                <span className="pi-field-label">INITIAL TRL: <strong>{current.initialTrl}</strong></span>
                <small className="pi-slider-hint">{trlLabel(current.initialTrl)}</small>
              </div>
              <div className="pi-field">
                <span className="pi-field-label">DURATION</span>
                <strong>{current.durationMonths} meses</strong>
              </div>
            </div>

            <div className="pi-field">
              <span><Users size={12} /> PARTNERS ({current.partners.length})</span>
              <ul className="pi-preview-list">
                {current.partners.map(p => (
                  <li key={p.id}>
                    <strong>{p.name}</strong>
                    <small> · {p.role} · {p.web || '—'}</small>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pi-field">
              <span><Activity size={12} /> WORK PACKAGES ({current.workPackages.length})</span>
              {current.workPackages.map((wp, i) => (
                <div key={wp.id} className="pi-preview-wp">
                  <strong>{wp.name || `WP${i + 1}`}</strong>
                  {wp.tasks.filter(Boolean).length > 0 && (
                    <div>
                      <em>Tasks:</em>
                      <ul>{wp.tasks.filter(Boolean).map((t, j) => <li key={j}>{t}</li>)}</ul>
                    </div>
                  )}
                  {wp.deliverables.filter(Boolean).length > 0 && (
                    <div>
                      <em>Deliverables:</em>
                      <ul>{wp.deliverables.filter(Boolean).map((d, j) => <li key={j}>{d}</li>)}</ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pi-footer">
          {step === 'form' && (
            <>
              <span className="pi-footer-hint">
                Mín. objective + innovation. El agente puede sugerir WPs si lo dejas vacío.
              </span>
              <div className="pi-footer-actions">
                <button className="pi-btn pi-btn--secondary" onClick={onClose}>Cancelar</button>
                <button className="pi-btn pi-btn--primary" onClick={handleGenerate}>
                  <Sparkles size={14} /> Mejorar con IA →
                </button>
              </div>
            </>
          )}
          {step === 'preview' && (
            <>
              <span className="pi-footer-hint">{isEditing ? 'Idea guardada · editable' : 'Versión mejorada · editable'}</span>
              <div className="pi-footer-actions">
                <button className="pi-btn pi-btn--secondary" onClick={() => setStep('form')}>
                  <ChevronLeft size={14} /> Editar campos
                </button>
                <button
                  className="pi-btn pi-btn--secondary"
                  onClick={handleGenerate}
                  title="Volver a pasar por el agente para mejorar más"
                >
                  <Sparkles size={14} /> Re-mejorar con IA
                </button>
                <button className="pi-btn pi-btn--primary" onClick={handleExport} disabled={exporting}>
                  {exporting ? <Loader2 size={14} className="pi-spin" /> : <Download size={14} />}
                  Descargar Word
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* TRL label helper */
function trlLabel(trl: number): string {
  const labels: Record<number, string> = {
    1: 'TRL 1 — Principios básicos observados',
    2: 'TRL 2 — Concepto tecnológico formulado',
    3: 'TRL 3 — Prueba de concepto',
    4: 'TRL 4 — Validación en laboratorio',
    5: 'TRL 5 — Validación en entorno relevante',
    6: 'TRL 6 — Demostración en entorno relevante (prototipo)',
    7: 'TRL 7 — Demostración en entorno operacional',
    8: 'TRL 8 — Sistema completo y cualificado',
    9: 'TRL 9 — Sistema probado en entorno real',
  }
  return labels[trl] || ''
}

export default ProposalIdeasModal
