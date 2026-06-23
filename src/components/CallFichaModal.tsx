import { useState, useRef, useCallback, useEffect } from 'react'
import {
  X, Upload, FileText, Trash2, Sparkles, Download, Loader2,
  Building2, Calendar, Users, Coins, FileSearch, CheckCircle2, AlertCircle,
} from 'lucide-react'
import { extractDocumentText } from '../utils/extractDocumentText'
import { generateCallFichaPpt } from '../utils/callFichaPpt'
import './CallFichaModal.css'

/* ── Tipos ────────────────────────────────────────────── */

export interface CallFichaInput {
  id?: string
  name?: string
  title?: string
  program?: string
  fundingBody?: string
  aidType?: string
  openDate?: string
  closeDate?: string
  deadline?: string
  budget?: string
  description?: string
  url?: string
}

export interface CallFicha {
  title: string
  subtitle: string
  year: string
  organism: string
  managingEntity: string
  legalFramework: string
  regime: string
  callBudget: string
  aboutCall: string
  thematicAreas: string[]
  submissionPeriod: string
  deadline: string
  beneficiaries: string[]
  excludedBeneficiaries: string[]
  projectFeatures: {
    duration: string
    budgetMin: string
    budgetMax: string
    consortium: string
    geographic: string
    trl: string
  }
  aidFeatures: {
    type: string
    intensity: string
    maxAmount: string
    minAmount: string
    advancePayment: string
  }
  eligibleCosts: string[]
  nonEligibleCosts: string[]
  payment: string
  guarantees: string
  evaluationCriteria: {
    minScore: string
    criteria: Array<{ name: string; weight: string; description: string }>
  }
  novelties: string[]
  alamosCommentary: string
  sourceUrls: {
    legalBasis: string
    callOrder: string
    programWeb: string
    applicationGuide: string
  }
}

interface UploadedDoc {
  id: string
  name: string
  size: number
  status: 'extracting' | 'ready' | 'error'
  text?: string
  error?: string
}

interface CallFichaModalProps {
  call: CallFichaInput | null
  onClose: () => void
}

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  'https://alamosinnovacionia.onrender.com'

const MAX_FILE_SIZE = 12 * 1024 * 1024 // 12MB por doc
const MAX_DOCS = 6

/* ── Componente ────────────────────────────────────────── */

const CallFichaModal = ({ call, onClose }: CallFichaModalProps) => {
  const [step, setStep] = useState<'upload' | 'generating' | 'preview' | 'error'>('upload')
  const [docs, setDocs] = useState<UploadedDoc[]>([])
  const [ficha, setFicha] = useState<CallFicha | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [exporting, setExporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  /* ── Lock scroll body ── */
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  /* ── ESC para cerrar ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  /* ── Upload handlers ── */
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files)
    const remaining = MAX_DOCS - docs.length
    if (remaining <= 0) {
      alert(`Máximo ${MAX_DOCS} documentos.`)
      return
    }
    const toAdd = arr.slice(0, remaining)

    for (const file of toAdd) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`"${file.name}" supera los 12MB. Saltado.`)
        continue
      }
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setDocs(prev => [...prev, { id, name: file.name, size: file.size, status: 'extracting' }])

      try {
        const result = await extractDocumentText(file)
        setDocs(prev => prev.map(d =>
          d.id === id
            ? result.ok
              ? { ...d, status: 'ready', text: result.text }
              : { ...d, status: 'error', error: result.error || 'Extracción falló' }
            : d
        ))
      } catch (err) {
        setDocs(prev => prev.map(d =>
          d.id === id
            ? { ...d, status: 'error', error: err instanceof Error ? err.message : 'Error' }
            : d
        ))
      }
    }
  }, [docs.length])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dropRef.current?.classList.remove('cfm-drop--active')
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    dropRef.current?.classList.add('cfm-drop--active')
  }
  const handleDragLeave = () => {
    dropRef.current?.classList.remove('cfm-drop--active')
  }

  const removeDoc = (id: string) => {
    setDocs(prev => prev.filter(d => d.id !== id))
  }

  /* ── Generar ficha ── */
  const handleGenerate = async () => {
    const readyDocs = docs.filter(d => d.status === 'ready' && d.text)
    if (readyDocs.length === 0) {
      alert('Sube al menos un documento procesado correctamente.')
      return
    }
    setStep('generating')
    setErrorMessage('')

    try {
      // App guarda en 'authToken' — 'token' era un bug heredado
      const token = localStorage.getItem('authToken') || localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/ai/generate-call-ficha`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          call: {
            id: call?.id,
            name: call?.name || call?.title,
            title: call?.title,
            program: call?.program,
            fundingBody: call?.fundingBody,
            aidType: call?.aidType,
            openDate: call?.openDate,
            closeDate: call?.closeDate || call?.deadline,
            budget: call?.budget,
            description: call?.description,
            url: call?.url,
          },
          documents: readyDocs.map(d => ({ name: d.name, text: d.text! })),
        }),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(errBody.error || `HTTP ${res.status}`)
      }

      const data = await res.json()
      if (!data.ficha) {
        throw new Error('La respuesta del agente no contiene "ficha".')
      }
      setFicha(data.ficha as CallFicha)
      setStep('preview')
    } catch (err) {
      console.error('generate-call-ficha error:', err)
      setErrorMessage(err instanceof Error ? err.message : 'Error desconocido')
      setStep('error')
    }
  }

  /* ── Exportar PPT ── */
  const handleExportPpt = async () => {
    if (!ficha) return
    setExporting(true)
    try {
      await generateCallFichaPpt(ficha)
    } catch (err) {
      console.error('export ppt error:', err)
      alert('Error al exportar PPT: ' + (err instanceof Error ? err.message : 'desconocido'))
    } finally {
      setExporting(false)
    }
  }

  /* ── Editar campos en preview ── */
  const updateFichaField = <K extends keyof CallFicha>(key: K, value: CallFicha[K]) => {
    setFicha(prev => (prev ? { ...prev, [key]: value } : prev))
  }

  const readyCount = docs.filter(d => d.status === 'ready').length

  /* ── Render ── */
  if (!call) return null

  return (
    <div className="cfm-overlay" onClick={onClose}>
      <div className="cfm-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="cfm-header">
          <div className="cfm-header-text">
            <h2>
              <Sparkles size={20} />
              Generar ficha comercial
            </h2>
            <p>
              <strong>{call.name || call.title || '(call sin nombre)'}</strong>
              {call.fundingBody && <span> · {call.fundingBody}</span>}
            </p>
          </div>
          <button className="cfm-close" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {/* Body — Step UPLOAD */}
        {step === 'upload' && (
          <div className="cfm-body">
            <div className="cfm-step-intro">
              <p>
                Sube los documentos oficiales de la convocatoria (orden de bases, resolución,
                workprogramme, application guide…). El agente IA extraerá los campos clave
                para generar una ficha comercial en PPT con el branding de Álamos.
              </p>
            </div>

            <div
              ref={dropRef}
              className="cfm-drop"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
            >
              <Upload size={28} />
              <strong>Arrastra aquí los documentos</strong>
              <small>
                o haz click para seleccionar — PDF, DOCX, TXT · máx 12MB · hasta {MAX_DOCS} archivos
              </small>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.txt,.md"
                onChange={e => {
                  if (e.target.files) handleFiles(e.target.files)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                style={{ display: 'none' }}
              />
            </div>

            {docs.length > 0 && (
              <ul className="cfm-doc-list">
                {docs.map(d => (
                  <li key={d.id} className={`cfm-doc-item cfm-doc-item--${d.status}`}>
                    <FileText size={18} />
                    <div className="cfm-doc-info">
                      <strong title={d.name}>{d.name}</strong>
                      <small>
                        {(d.size / 1024).toFixed(0)} KB
                        {d.status === 'extracting' && ' · extrayendo texto…'}
                        {d.status === 'ready' && d.text && ` · ${d.text.length.toLocaleString('es-ES')} caracteres`}
                        {d.status === 'error' && d.error && ` · ⚠ ${d.error}`}
                      </small>
                    </div>
                    {d.status === 'extracting' && <Loader2 size={16} className="cfm-spin" />}
                    {d.status === 'ready' && <CheckCircle2 size={16} className="cfm-ok" />}
                    {d.status === 'error' && <AlertCircle size={16} className="cfm-err" />}
                    <button
                      type="button"
                      className="cfm-doc-remove"
                      onClick={() => removeDoc(d.id)}
                      aria-label="Quitar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Body — Step GENERATING */}
        {step === 'generating' && (
          <div className="cfm-body cfm-loading">
            <Loader2 size={40} className="cfm-spin" />
            <h3>Generando ficha…</h3>
            <p>El agente está leyendo los documentos y extrayendo los campos clave.</p>
            <p className="cfm-loading-hint">Esto puede llevar 30–60 segundos.</p>
          </div>
        )}

        {/* Body — Step ERROR */}
        {step === 'error' && (
          <div className="cfm-body cfm-error">
            <AlertCircle size={40} />
            <h3>Error al generar la ficha</h3>
            <p>{errorMessage}</p>
            <button className="cfm-btn cfm-btn--secondary" onClick={() => setStep('upload')}>
              Volver a intentar
            </button>
          </div>
        )}

        {/* Body — Step PREVIEW */}
        {step === 'preview' && ficha && (
          <div className="cfm-body cfm-preview">
            <div className="cfm-preview-banner">
              <CheckCircle2 size={18} />
              Ficha generada. Revisa los campos clave antes de exportar — son editables.
            </div>

            {/* Identificación */}
            <section className="cfm-section">
              <h4><FileSearch size={16} /> Identificación</h4>
              <div className="cfm-grid">
                <label className="cfm-field">
                  <span>Título del programa</span>
                  <input
                    type="text"
                    value={ficha.title}
                    onChange={e => updateFichaField('title', e.target.value)}
                  />
                </label>
                <label className="cfm-field">
                  <span>Año</span>
                  <input
                    type="text"
                    value={ficha.year}
                    onChange={e => updateFichaField('year', e.target.value)}
                  />
                </label>
                <label className="cfm-field cfm-field--wide">
                  <span>Subtítulo / pitch</span>
                  <input
                    type="text"
                    value={ficha.subtitle}
                    onChange={e => updateFichaField('subtitle', e.target.value)}
                  />
                </label>
                <label className="cfm-field">
                  <span>Organismo convocante</span>
                  <input
                    type="text"
                    value={ficha.organism}
                    onChange={e => updateFichaField('organism', e.target.value)}
                  />
                </label>
                <label className="cfm-field">
                  <span>Régimen</span>
                  <input
                    type="text"
                    value={ficha.regime}
                    onChange={e => updateFichaField('regime', e.target.value)}
                  />
                </label>
                <label className="cfm-field">
                  <span>Presupuesto convocatoria</span>
                  <input
                    type="text"
                    value={ficha.callBudget}
                    onChange={e => updateFichaField('callBudget', e.target.value)}
                  />
                </label>
                <label className="cfm-field">
                  <span>Marco legal</span>
                  <input
                    type="text"
                    value={ficha.legalFramework}
                    onChange={e => updateFichaField('legalFramework', e.target.value)}
                  />
                </label>
              </div>
            </section>

            {/* Objeto */}
            <section className="cfm-section">
              <h4><Building2 size={16} /> Objeto de la convocatoria</h4>
              <textarea
                rows={4}
                value={ficha.aboutCall}
                onChange={e => updateFichaField('aboutCall', e.target.value)}
              />
              {ficha.thematicAreas.length > 0 && (
                <div className="cfm-chips">
                  {ficha.thematicAreas.map((a, i) => (
                    <span key={i} className="cfm-chip">{a}</span>
                  ))}
                </div>
              )}
            </section>

            {/* Plazos */}
            <section className="cfm-section">
              <h4><Calendar size={16} /> Plazos</h4>
              <label className="cfm-field cfm-field--wide">
                <span>Periodo de presentación</span>
                <input
                  type="text"
                  value={ficha.submissionPeriod}
                  onChange={e => updateFichaField('submissionPeriod', e.target.value)}
                />
              </label>
            </section>

            {/* Beneficiarios */}
            <section className="cfm-section">
              <h4><Users size={16} /> Beneficiarios</h4>
              <ul className="cfm-bullet-list">
                {ficha.beneficiaries.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
              {ficha.excludedBeneficiaries.length > 0 && (
                <>
                  <h5>No elegibles:</h5>
                  <ul className="cfm-bullet-list cfm-bullet-list--negative">
                    {ficha.excludedBeneficiaries.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                </>
              )}
            </section>

            {/* Ayuda */}
            <section className="cfm-section">
              <h4><Coins size={16} /> Características de la ayuda</h4>
              <div className="cfm-grid">
                <div className="cfm-field cfm-field--readonly">
                  <span>Tipo</span>
                  <p>{ficha.aidFeatures.type || '—'}</p>
                </div>
                <div className="cfm-field cfm-field--readonly">
                  <span>Intensidad</span>
                  <p>{ficha.aidFeatures.intensity || '—'}</p>
                </div>
                <div className="cfm-field cfm-field--readonly">
                  <span>Importe máximo</span>
                  <p>{ficha.aidFeatures.maxAmount || '—'}</p>
                </div>
                <div className="cfm-field cfm-field--readonly">
                  <span>Anticipo</span>
                  <p>{ficha.aidFeatures.advancePayment || '—'}</p>
                </div>
              </div>
            </section>

            {/* Comentario Álamos */}
            {ficha.alamosCommentary && (
              <section className="cfm-section cfm-section--alamos">
                <h4><Sparkles size={16} /> Comentario Álamos</h4>
                <textarea
                  rows={3}
                  value={ficha.alamosCommentary}
                  onChange={e => updateFichaField('alamosCommentary', e.target.value)}
                />
              </section>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="cfm-footer">
          {step === 'upload' && (
            <>
              <span className="cfm-doc-count">
                {readyCount} de {docs.length} documentos listos
                {docs.length > 0 && ` · máx ${MAX_DOCS}`}
              </span>
              <div className="cfm-footer-actions">
                <button className="cfm-btn cfm-btn--secondary" onClick={onClose}>
                  Cancelar
                </button>
                <button
                  className="cfm-btn cfm-btn--primary"
                  onClick={handleGenerate}
                  disabled={readyCount === 0}
                >
                  <Sparkles size={16} />
                  Generar con IA
                </button>
              </div>
            </>
          )}
          {step === 'preview' && (
            <>
              <span className="cfm-doc-count">
                Ficha lista — revisa y exporta
              </span>
              <div className="cfm-footer-actions">
                <button className="cfm-btn cfm-btn--secondary" onClick={() => setStep('upload')}>
                  ← Subir otros docs
                </button>
                <button
                  className="cfm-btn cfm-btn--primary"
                  onClick={handleExportPpt}
                  disabled={exporting}
                >
                  {exporting ? <Loader2 size={16} className="cfm-spin" /> : <Download size={16} />}
                  Exportar PPT
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default CallFichaModal
