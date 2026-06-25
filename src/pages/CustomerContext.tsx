import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Sparkles,
  Globe,
  FileText,
  Briefcase,
  Upload,
  X,
  AlertCircle,
  Loader2,
  Check,
} from 'lucide-react'
import { extractDocumentText } from '../utils/extractDocumentText'
import { persistAppData } from '../utils/appData'
import './Page.css'
import './CustomerContext.css'

/* ============================================================
   Tipos
   ============================================================ */

interface Customer {
  id: string
  name: string
  company: string
  website?: string
  description?: string
  context?: CustomerContextData
}

interface UploadedDocument {
  id: string
  name: string
  sizeBytes: number
  uploadedAt: string
  extractedText?: string
  extractionError?: string
}

interface ContextField {
  value: string
  suggested?: boolean
}

interface CustomerContextData {
  businessModel?: ContextField
  companyOverview?: ContextField
  competitiveAdvantage?: ContextField
  ipStrategy?: ContextField
  keyAchievements?: ContextField
  marketOverview?: ContextField
  problemStatement?: ContextField
  solutionDescription?: ContextField
  targetMarkets?: ContextField
  keyTeamMembers?: ContextField
  teamOverview?: ContextField
  technologyInnovation?: ContextField
  currentTRL?: ContextField
  rdiRoadmap?: ContextField
  uploadedDocuments?: UploadedDocument[]
  lastAnalyzedAt?: string
}

// Sólo las keys de CustomerContextData que son ContextField (no docs ni timestamps)
type ContextFieldKey = Exclude<keyof CustomerContextData, 'uploadedDocuments' | 'lastAnalyzedAt'>

interface FieldDefinition {
  key: ContextFieldKey
  label: string
  placeholder: string
}

/* ============================================================
   Definición de los 14 campos de contexto
   ============================================================ */

const CONTEXT_FIELDS: FieldDefinition[] = [
  { key: 'businessModel', label: 'Business Model', placeholder: 'Describe how the company generates revenue…' },
  { key: 'companyOverview', label: 'Company Overview', placeholder: 'Short description of the company…' },
  { key: 'competitiveAdvantage', label: 'Competitive Advantage', placeholder: 'What makes the company different…' },
  { key: 'ipStrategy', label: 'IP Strategy', placeholder: 'Patents, trademarks, IP protection approach…' },
  { key: 'keyAchievements', label: 'Key Achievements', placeholder: 'Awards, milestones, traction…' },
  { key: 'marketOverview', label: 'Market Overview', placeholder: 'Enter market overview…' },
  { key: 'problemStatement', label: 'Problem Statement', placeholder: 'What problem does the company solve…' },
  { key: 'solutionDescription', label: 'Solution Description', placeholder: 'How the company solves it…' },
  { key: 'targetMarkets', label: 'Target Markets', placeholder: 'Industries, geographies, customer segments…' },
  { key: 'keyTeamMembers', label: 'Key Team Members', placeholder: 'Founders, key roles…' },
  { key: 'teamOverview', label: 'Team Overview', placeholder: 'Size, structure, capabilities…' },
  { key: 'technologyInnovation', label: 'Technology & Innovation', placeholder: 'Tech stack, methodologies, R&D approach…' },
  { key: 'currentTRL', label: 'Current TRL', placeholder: 'Technology Readiness Level…' },
  { key: 'rdiRoadmap', label: 'R&D&i roadmap', placeholder: 'Planned R&D&i initiatives, milestones…' },
]

/* ============================================================
   Storage helpers
   ============================================================ */

const loadCustomers = (): Customer[] => {
  try {
    const raw = localStorage.getItem('customers')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const saveCustomers = (customers: Customer[]) => {
  persistAppData('customers', JSON.stringify(customers))
  localStorage.setItem('appDataUpdatedAt', new Date().toISOString())
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/* ============================================================
   Componente
   ============================================================ */

const CustomerContext = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [context, setContext] = useState<CustomerContextData>({})
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [projectsCount, setProjectsCount] = useState(0)
  const [proposalDocsCount, setProposalDocsCount] = useState(0)
  const [lastTrace, setLastTrace] = useState<{
    documentsReceived: number
    documentsChars: number
    promptChars: number
    websiteFetched: boolean
    tokensInput: number
    tokensOutput: number
  } | null>(null)

  // Load on mount
  useEffect(() => {
    const customers = loadCustomers()
    const found = customers.find(c => c.id === id) || null
    setCustomer(found)
    setContext(found?.context || {})

    // Count projects linked to this client + proposal docs disponibles
    try {
      const raw = localStorage.getItem('projects')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const all: any[] = raw ? JSON.parse(raw) : []
      const linked = all.filter(p =>
        (p.primaryClients || []).includes(id || '') ||
        (p.secondaryClients || []).includes(id || '')
      )
      setProjectsCount(linked.length)
      const docsCount = linked.reduce((acc, p) => acc + ((p.proposalDocuments || []).length), 0)
      setProposalDocsCount(docsCount)
    } catch {
      setProjectsCount(0)
      setProposalDocsCount(0)
    }
  }, [id])

  // KPI: filled count
  const { filledCount, totalFields } = useMemo(() => {
    const filled = CONTEXT_FIELDS.filter(f => {
      const v = context[f.key]
      return v && v.value && v.value.trim().length > 0
    }).length
    return { filledCount: filled, totalFields: CONTEXT_FIELDS.length }
  }, [context])

  /* ----------------------------------------------------------
     Persistencia
     ---------------------------------------------------------- */

  const persistContext = (next: CustomerContextData) => {
    if (!customer) return
    const customers = loadCustomers()
    const idx = customers.findIndex(c => c.id === customer.id)
    if (idx === -1) return
    customers[idx] = { ...customers[idx], context: next }
    saveCustomers(customers)
  }

  /* ----------------------------------------------------------
     Handlers de campos
     ---------------------------------------------------------- */

  const updateField = (key: ContextFieldKey, value: string) => {
    setContext(prev => {
      const existing = prev[key] || { value: '', suggested: false }
      const next = { ...prev, [key]: { ...existing, value } }
      persistContext(next)
      return next
    })
  }

  const validateField = (key: ContextFieldKey) => {
    setContext(prev => {
      const existing = prev[key]
      if (!existing) return prev
      const next = { ...prev, [key]: { ...existing, suggested: false } }
      persistContext(next)
      return next
    })
  }

  /* ----------------------------------------------------------
     Subida de documentos (manual, sin backend real aún)
     ---------------------------------------------------------- */

  const handleAddDocument = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsExtracting(true)
    const docs: UploadedDocument[] = []
    for (const file of Array.from(files)) {
      const result = await extractDocumentText(file)
      docs.push({
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        sizeBytes: file.size,
        uploadedAt: new Date().toISOString(),
        extractedText: result.ok ? result.text : undefined,
        extractionError: result.ok ? undefined : result.error,
      })
    }
    setContext(prev => {
      const next = {
        ...prev,
        uploadedDocuments: [...(prev.uploadedDocuments || []), ...docs],
      }
      persistContext(next)
      return next
    })
    setIsExtracting(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeDocument = (docId: string) => {
    setContext(prev => {
      const next = {
        ...prev,
        uploadedDocuments: (prev.uploadedDocuments || []).filter(d => d.id !== docId),
      }
      persistContext(next)
      return next
    })
  }

  /* ----------------------------------------------------------
     "Analyze All Sources" — Stub del agente
     Mientras no haya backend AI, simula análisis con datos de placeholder
     basados en lo que sabemos del cliente.
     ---------------------------------------------------------- */

  const handleAnalyzeAll = async () => {
    if (!customer) return
    setAnalyzeError(null)
    setIsAnalyzing(true)

    try {
      // Reúne proyectos relacionados con el cliente para pasárselos al agente
      const customers = loadCustomers()
      const fullCustomer = customers.find(c => c.id === customer.id) as Record<string, unknown> | undefined

      let relatedProjects: Array<Record<string, unknown>> = []
      try {
        const rawProjects = localStorage.getItem('projects')
        if (rawProjects) {
          const allProjects: Array<Record<string, unknown>> = JSON.parse(rawProjects)
          relatedProjects = allProjects
            .filter(p => {
              const primary = (p.primaryClients as string[] | undefined) || []
              const secondary = (p.secondaryClients as string[] | undefined) || []
              return primary.includes(customer.id) || secondary.includes(customer.id)
            })
            .slice(0, 10) // limita por seguridad de tokens
            // Enriquecer cada project para que el agente sepa que son
            // PROYECTOS YA GANADOS Y EJECUTADOS, y conozca los proposal docs
            // disponibles (memoria técnica, anexos, etc.).
            .map(p => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const proposalDocs: any[] = (p.proposalDocuments as any[]) || []
              return {
                ...p,
                // Quita base64 para no inflar el payload
                proposalDocuments: undefined,
                // Marca explícita para el agente
                _wonProject: true,
                _executedProject: true,
                _note: 'Este es un proyecto ya GANADO y EN EJECUCIÓN o EJECUTADO por el cliente. Úsalo como evidencia de capacidad técnica y trayectoria.',
                proposalDocumentNames: proposalDocs.map(d => d.name).filter(Boolean),
                proposalDocumentsCount: proposalDocs.length,
              }
            })
        }
      } catch {
        // ignore
      }

      const API_BASE =
        (import.meta.env.VITE_API_URL as string | undefined) ||
        'https://alamosinnovacionia.onrender.com'
      const token = localStorage.getItem('authToken') || ''

      // Documentos: enviamos solo nombre + texto extraído al backend.
      const documents = (context.uploadedDocuments || [])
        .filter(d => d.extractedText && d.extractedText.length > 0)
        .map(d => ({
          name: d.name,
          text: d.extractedText as string,
        }))

      const response = await fetch(`${API_BASE}/ai/analyze-client-context`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customer: fullCustomer || customer,
          projects: relatedProjects,
          documents,
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        let message = `Server returned ${response.status}`
        try {
          const parsed = JSON.parse(text)
          message = parsed.error || message
        } catch {
          // text is not JSON; ignore
        }
        throw new Error(message)
      }

      const data = (await response.json()) as {
        suggestions: Record<string, ContextField>
        analyzedAt?: string
        tokensUsed?: { input: number; output: number }
        trace?: {
          websiteFetched?: boolean
          documentsReceived?: number
          documentsChars?: number
          promptChars?: number
        }
      }

      if (data.trace) {
        setLastTrace({
          documentsReceived: data.trace.documentsReceived ?? 0,
          documentsChars: data.trace.documentsChars ?? 0,
          promptChars: data.trace.promptChars ?? 0,
          websiteFetched: !!data.trace.websiteFetched,
          tokensInput: data.tokensUsed?.input ?? 0,
          tokensOutput: data.tokensUsed?.output ?? 0,
        })
      }

      setContext(prev => {
        const merged: CustomerContextData = { ...prev }
        for (const f of CONTEXT_FIELDS) {
          const aiSuggestion = data.suggestions[f.key as string] as ContextField | undefined
          const current = prev[f.key]
          if (aiSuggestion && (!current || !current.value || current.suggested)) {
            merged[f.key] = aiSuggestion
          }
        }
        merged.lastAnalyzedAt = data.analyzedAt || new Date().toISOString()
        persistContext(merged)
        return merged
      })
    } catch (err) {
      console.error('Analyze error', err)
      setAnalyzeError(
        err instanceof Error
          ? err.message
          : 'Could not analyze sources. Please try again.'
      )
    } finally {
      setIsAnalyzing(false)
    }
  }

  /* ----------------------------------------------------------
     Render
     ---------------------------------------------------------- */

  if (!customer) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Customer not found</h1>
          <button className="btn-secondary" onClick={() => navigate('/customers')}>
            Back to Customers
          </button>
        </div>
      </div>
    )
  }

  const websiteHost = (() => {
    try {
      if (!customer.website) return null
      return new URL(customer.website).host.replace(/^www\./, '')
    } catch {
      return customer.website
    }
  })()

  return (
    <div className="page page--customer-context">
      {/* HEADER */}
      <header className="cc-page-header">
        <button
          type="button"
          className="cc-back-btn"
          onClick={() => navigate(`/customers/${customer.id}`)}
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="cc-page-title">
          <h1>Client Context</h1>
          <p>{customer.name}</p>
        </div>
        <button
          type="button"
          className="cc-analyze-btn"
          onClick={handleAnalyzeAll}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? (
            <>
              <Loader2 size={16} className="cc-spinner" />
              <span>Analyzing…</span>
            </>
          ) : (
            <>
              <Sparkles size={16} />
              <span>Analyze All Sources</span>
            </>
          )}
        </button>
      </header>

      {analyzeError && (
        <div className="cc-error">
          <AlertCircle size={16} />
          <span>{analyzeError}</span>
        </div>
      )}

      {/* ====================== CONTEXT SOURCES ====================== */}
      <section className="cc-card">
        <header className="cc-card-header">
          <h2>Context Sources</h2>
        </header>

        <div className="cc-sources-grid">
          {/* Website */}
          <div className="cc-source-card">
            <div className="cc-source-icon cc-source-icon--blue">
              <Globe size={20} />
            </div>
            <div className="cc-source-body">
              <span className="cc-source-label">Website</span>
              <span className="cc-source-value" title={customer.website || ''}>
                {websiteHost || '—'}
              </span>
            </div>
          </div>

          {/* Documents */}
          <div className="cc-source-card">
            <div className="cc-source-icon cc-source-icon--purple">
              <FileText size={20} />
            </div>
            <div className="cc-source-body">
              <span className="cc-source-label">Documents</span>
              <span className="cc-source-value">
                {(context.uploadedDocuments?.length || 0)} uploaded
              </span>
              <button
                type="button"
                className="cc-source-action"
                onClick={handleAddDocument}
                disabled={isExtracting}
              >
                {isExtracting ? (
                  <>
                    <Loader2 size={12} className="cc-spinner" />
                    Extracting…
                  </>
                ) : (
                  <>
                    <Upload size={12} />
                    Add document
                  </>
                )}
              </button>
              <span className="cc-source-hint">PDF · DOCX · XLSX · CSV · TXT</span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.xlsx,.xls,.xlsm,.csv,.tsv,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain,text/markdown"
                onChange={handleFileSelected}
                style={{ display: 'none' }}
              />
              {context.uploadedDocuments && context.uploadedDocuments.length > 0 && (
                <ul className="cc-doc-list">
                  {context.uploadedDocuments.map(doc => (
                    <li
                      key={doc.id}
                      className={`cc-doc-item ${doc.extractionError ? 'cc-doc-item--error' : ''}`}
                      title={doc.extractionError || (doc.extractedText ? 'Text extracted — Claude will use it' : '')}
                    >
                      <span className="cc-doc-name" title={doc.name}>{doc.name}</span>
                      <span className="cc-doc-size">{formatBytes(doc.sizeBytes)}</span>
                      {doc.extractedText && (
                        <span className="cc-doc-badge cc-doc-badge--ok" title="Text extracted">
                          <Check size={10} />
                        </span>
                      )}
                      {doc.extractionError && (
                        <span className="cc-doc-badge cc-doc-badge--err" title={doc.extractionError}>
                          <AlertCircle size={10} />
                        </span>
                      )}
                      <button
                        type="button"
                        className="cc-doc-remove"
                        onClick={() => removeDocument(doc.id)}
                        aria-label={`Remove ${doc.name}`}
                      >
                        <X size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Projects */}
          <div className="cc-source-card">
            <div className="cc-source-icon cc-source-icon--green">
              <Briefcase size={20} />
            </div>
            <div className="cc-source-body">
              <span className="cc-source-label">Projects in AI</span>
              <span className="cc-source-value">
                {projectsCount} funded project{projectsCount !== 1 ? 's' : ''}
              </span>
              <span className="cc-source-hint">
                {proposalDocsCount > 0
                  ? `+ ${proposalDocsCount} proposal doc${proposalDocsCount !== 1 ? 's' : ''} (auto-incluidos como proyectos ganados)`
                  : 'Auto-included in analysis'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ====================== CONTEXT FIELDS ====================== */}
      <section className="cc-card">
        <header className="cc-card-header">
          <div>
            <h2>Context Fields</h2>
            <p className="cc-card-subtitle">
              {filledCount} of {totalFields} fields filled
            </p>
          </div>
        </header>

        <div className="cc-info-banner">
          This information will be automatically suggested when creating proposals for this client.
          Fields marked as <span className="cc-info-pill">suggested</span> need validation before use.
        </div>

        <div className="cc-fields-grid">
          {CONTEXT_FIELDS.map(field => {
            const data = context[field.key]
            const isSuggested = !!data?.suggested
            return (
              <div
                key={field.key as string}
                className={`cc-field-card ${isSuggested ? 'cc-field-card--suggested' : ''}`}
              >
                <div className="cc-field-head">
                  <label htmlFor={`cc-${field.key as string}`}>{field.label}</label>
                  {isSuggested && (
                    <button
                      type="button"
                      className="cc-validate-link"
                      onClick={() => validateField(field.key)}
                    >
                      <AlertCircle size={12} />
                      Validate
                    </button>
                  )}
                  {!isSuggested && data?.value && (
                    <span className="cc-validated-tag">
                      <Check size={12} />
                      Validated
                    </span>
                  )}
                </div>
                <textarea
                  id={`cc-${field.key as string}`}
                  className="cc-field-textarea"
                  value={data?.value || ''}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={5}
                />
              </div>
            )
          })}
        </div>

        {/* Last analyzed metadata */}
        {context.lastAnalyzedAt && (
          <p className="cc-last-analyzed">
            Last analyzed: {new Date(context.lastAnalyzedAt).toLocaleString('en-GB')}
            {lastTrace && (
              <>
                {' · '}
                Sources sent: {lastTrace.documentsReceived} documents
                {' '}({Math.round(lastTrace.documentsChars / 1000)}k chars)
                {' · '}
                Website: {lastTrace.websiteFetched ? 'fetched' : 'skipped'}
                {' · '}
                Tokens: {lastTrace.tokensInput}↓ {lastTrace.tokensOutput}↑
              </>
            )}
          </p>
        )}
      </section>
    </div>
  )
}

export default CustomerContext
