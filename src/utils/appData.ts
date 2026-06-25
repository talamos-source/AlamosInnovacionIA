export const APP_DATA_UPDATED_AT_KEY = 'appDataUpdatedAt'

/** Disparado tras persistAppData — AppDataSync pushea al server sin esperar 15s. */
export const APP_DATA_CHANGED_EVENT = 'appDataChanged'

/** Disparado tras applySnapshot — páginas re-leen localStorage. */
export const APP_DATA_SYNC_APPLIED_EVENT = 'appDataSyncApplied'

export const APP_DATA_KEYS = [
  'customers',
  'calls',
  'proposals',
  'projects',
  'otherServices',
  'invoices',
  'companySettings',
  'users',
  'discoveryCalls',
  'discoverySources',
  'fundingProfiles',
  'roadmaps',
  // Briefs (fichas comerciales) generados con IA, indexados por callId.
  // Se sincronizan con backend para que estén disponibles desde cualquier
  // device y no se pierdan tras un applySnapshot con datos del server.
  'callBriefs',
  // Proposal ideas creadas desde Customers → "New Proposal Idea".
  // Indexadas por customerId — un cliente puede tener varias ideas en
  // exploración antes de convertirlas en una propuesta formal.
  // Alimentan Customer Context y posteriormente Funding Profile / Roadmap.
  'proposalIdeas',
]

export type AppDataSnapshot = Record<string, string>

export const getLocalSnapshot = (): AppDataSnapshot => {
  const snapshot: AppDataSnapshot = {}
  APP_DATA_KEYS.forEach((key) => {
    const value = localStorage.getItem(key)
    if (value !== null) {
      snapshot[key] = value
    }
  })
  return snapshot
}

export const applySnapshot = (data: AppDataSnapshot) => {
  APP_DATA_KEYS.forEach((key) => {
    if (data && Object.prototype.hasOwnProperty.call(data, key)) {
      localStorage.setItem(key, data[key])
    } else {
      localStorage.removeItem(key)
    }
  })
}

/** Parsea un array JSON de localStorage; devuelve [] si falla. */
function parseJsonArray(raw: string | undefined): unknown[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

type MergeableEntity = { id?: string; updatedAt?: string }

/**
 * Fusiona arrays de entidades por id. En conflicto gana el más reciente
 * (updatedAt) o el de local si no hay timestamps comparables.
 * Preserva entidades que solo existen en local (creadas offline).
 */
function mergeEntityArrays(localRaw: string | undefined, serverRaw: string | undefined): string {
  const local = parseJsonArray(localRaw) as MergeableEntity[]
  const server = parseJsonArray(serverRaw) as MergeableEntity[]
  const byId = new Map<string, MergeableEntity>()

  for (const item of server) {
    if (item?.id) byId.set(item.id, item)
  }
  for (const item of local) {
    if (!item?.id) continue
    const existing = byId.get(item.id)
    if (!existing) {
      byId.set(item.id, item)
      continue
    }
    const localTs = item.updatedAt ? Date.parse(item.updatedAt) : NaN
    const serverTs = existing.updatedAt ? Date.parse(existing.updatedAt) : NaN
    if (!Number.isFinite(serverTs) || (Number.isFinite(localTs) && localTs >= serverTs)) {
      byId.set(item.id, item)
    }
  }

  return JSON.stringify([...byId.values()])
}

/** Claves cuyos valores son arrays de entidades con { id, updatedAt }. */
const MERGE_ARRAY_KEYS = new Set([
  'customers',
  'calls',
  'proposals',
  'projects',
  'otherServices',
  'invoices',
  'users',
  'discoveryCalls',
  'fundingProfiles',
  'roadmaps',
])

/**
 * Aplica snapshot del server fusionando con local en lugar de pisar a ciegas.
 * Evita perder clientes/calls creados localmente que aún no llegaron al server.
 */
export const mergeSnapshot = (serverData: AppDataSnapshot): void => {
  const local = getLocalSnapshot()
  APP_DATA_KEYS.forEach((key) => {
    if (!serverData || !Object.prototype.hasOwnProperty.call(serverData, key)) {
      // Server no tiene esta clave — conservar local si existe
      if (local[key] !== undefined) return
      localStorage.removeItem(key)
      return
    }
    if (MERGE_ARRAY_KEYS.has(key)) {
      localStorage.setItem(key, mergeEntityArrays(local[key], serverData[key]))
    } else {
      localStorage.setItem(key, serverData[key])
    }
  })
}

export const notifyAppDataChanged = (): void => {
  window.dispatchEvent(new Event(APP_DATA_CHANGED_EVENT))
}

/**
 * Helper SEGURO para persistir cualquier APP_DATA_KEY a localStorage.
 * Actualiza el timestamp `appDataUpdatedAt` automáticamente para que
 * el próximo AppDataSync.initialize() respete los datos locales y no
 * los sobrescriba con un snapshot del server más viejo.
 *
 * Devuelve `true` si se persistió, `false` si falló (p.ej. QuotaExceeded).
 *
 * USAR SIEMPRE en lugar de `localStorage.setItem(key, value)` cuando
 * `key` esté en APP_DATA_KEYS. Si no se actualiza el timestamp, los
 * datos locales pueden perderse en el próximo refresh de la app.
 */
export const persistAppData = (key: string, value: string): boolean => {
  try {
    localStorage.setItem(key, value)
    if (APP_DATA_KEYS.includes(key)) {
      localStorage.setItem(APP_DATA_UPDATED_AT_KEY, new Date().toISOString())
      notifyAppDataChanged()
    }
    return true
  } catch (err) {
    console.error(`[appData] persistAppData failed for ${key}:`, err)
    // Re-throw para que los handlers puedan distinguir QuotaExceeded de otros
    throw err
  }
}

/* ============================================================
   STORAGE DIAGNOSTICS — tamaño por key y limpieza
   ============================================================ */

export interface StorageReport {
  totalBytes: number
  totalKB: number
  perKey: Array<{ key: string; bytes: number; kb: number; isAppData: boolean }>
}

/** Calcula el tamaño en bytes de cada key de localStorage, ordenado por
 *  mayor a menor. Útil para diagnosticar de dónde viene un QuotaExceeded. */
export const getStorageReport = (): StorageReport => {
  const perKey: StorageReport['perKey'] = []
  let totalBytes = 0
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key) continue
    const value = localStorage.getItem(key) || ''
    // Cada char en UTF-16 ocupa 2 bytes en localStorage
    const bytes = (key.length + value.length) * 2
    totalBytes += bytes
    perKey.push({
      key,
      bytes,
      kb: bytes / 1024,
      isAppData: APP_DATA_KEYS.includes(key),
    })
  }
  perKey.sort((a, b) => b.bytes - a.bytes)
  return { totalBytes, totalKB: totalBytes / 1024, perKey }
}

/** Detecta si un error es QuotaExceededError de cualquier navegador. */
export const isQuotaExceededError = (err: unknown): boolean => {
  if (!err) return false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = err as any
  return (
    e instanceof DOMException &&
    (e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e.code === 22 ||
      e.code === 1014)
  )
}

/**
 * Mueve los campos base64 grandes (logos, contractPdf) a IndexedDB
 * para liberar espacio en localStorage SIN borrar los datos del usuario.
 * Devuelve cuántos bytes libera.
 *
 * Tras esto, el campo `logoBase64` o `contractPdf.base64` queda vacío
 * en localStorage pero con un flag `logoInIdb: true` / `contractInIdb: true`.
 * Los componentes pueden cargarlos on-demand desde IDB con el id del
 * customer como key.
 */
export const moveHeavyFieldsToIdb = async (): Promise<{ movedBytes: number; actions: string[] }> => {
  const actions: string[] = []
  let movedBytes = 0

  try {
    // Import dinámico para evitar circular deps
    const { idbSet } = await import('./idbStorage')
    const raw = localStorage.getItem('customers') || '[]'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customers: any[] = JSON.parse(raw)
    let logosMoved = 0
    let pdfsMoved = 0

    for (const c of customers) {
      // Logo > 50 KB
      if (typeof c.logoBase64 === 'string' && c.logoBase64.length > 50_000 && !c.logoInIdb) {
        await idbSet('project-blobs', `customer-logo-${c.id}`, c.logoBase64)
        movedBytes += c.logoBase64.length * 2
        c.logoBase64 = ''
        c.logoInIdb = true
        logosMoved++
      }
      // ContractPdf cualquier tamaño
      if (c.contractPdf?.dataUrl && typeof c.contractPdf.dataUrl === 'string' && c.contractPdf.dataUrl.length > 50_000 && !c.contractInIdb) {
        await idbSet('project-blobs', `customer-contract-${c.id}`, c.contractPdf.dataUrl)
        movedBytes += c.contractPdf.dataUrl.length * 2
        c.contractPdf = { ...c.contractPdf, dataUrl: '' }
        c.contractInIdb = true
        pdfsMoved++
      }
    }
    if (logosMoved > 0 || pdfsMoved > 0) {
      localStorage.setItem('customers', JSON.stringify(customers))
      if (logosMoved > 0) actions.push(`${logosMoved} logo(s) movidos a IndexedDB (siguen accesibles)`)
      if (pdfsMoved > 0) actions.push(`${pdfsMoved} contrato(s) movidos a IndexedDB (siguen accesibles)`)
    }
  } catch (err) {
    console.warn('[appData] moveHeavyFieldsToIdb failed:', err)
  }

  return { movedBytes, actions }
}

/**
 * Estrategia QUIRÚRGICA de auto-cleanup. Borra solo cosas seguras o
 * regenerables. NUNCA toca tus customers, calls, projects, proposals,
 * invoices, fundingProfiles o roadmaps activos.
 *
 * Orden de prioridad (lo más inocuo primero):
 *   1. discoveryCalls dismissed (descartadas — basura del cache)
 *   2. discoveryCalls con closeDate ya pasada hace >30 días (caducadas)
 *   3. discoveryCalls cuya description sea muy larga → la trunca a 200 chars
 *   4. callBriefs (fichas IA — REGENERABLES con un click)
 *   5. discoveryCalls completas (solo si tras 1-4 sigue lleno)
 *
 * NO toca:
 *   - logoBase64 ni contractPdf de customers (datos del usuario)
 *   - Calls importadas a /calls
 *   - Customers, projects, proposals, invoices
 */
export const tryFreeStorage = (): { freedBytes: number; actions: string[] } => {
  const actions: string[] = []
  let freedBytes = 0

  const bytesOf = (s: string | null) => (s ? s.length * 2 : 0)

  // 1. discoveryCalls dismissed
  try {
    const raw = localStorage.getItem('discoveryCalls')
    if (raw) {
      const before = bytesOf(raw)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const all: any[] = JSON.parse(raw)
      const kept = all.filter(c => c?.userStatus !== 'dismissed')
      const removed = all.length - kept.length
      if (removed > 0) {
        const after = bytesOf(JSON.stringify(kept))
        localStorage.setItem('discoveryCalls', JSON.stringify(kept))
        freedBytes += before - after
        actions.push(`${removed} call(s) descartadas eliminadas del caché de Discovery`)
      }
    }
  } catch { /* ignore */ }

  // 2. discoveryCalls con closeDate pasada hace >30 días
  try {
    const raw = localStorage.getItem('discoveryCalls')
    if (raw) {
      const before = bytesOf(raw)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const all: any[] = JSON.parse(raw)
      const threshold = Date.now() - 30 * 86400_000
      const kept = all.filter(c => {
        if (!c?.closeDate) return true // sin deadline — conservar
        const t = new Date(c.closeDate).getTime()
        if (Number.isNaN(t)) return true
        return t >= threshold // futura o cerró hace <30 días
      })
      const removed = all.length - kept.length
      if (removed > 0) {
        const after = bytesOf(JSON.stringify(kept))
        localStorage.setItem('discoveryCalls', JSON.stringify(kept))
        freedBytes += before - after
        actions.push(`${removed} call(s) caducadas (>30 días) del caché de Discovery`)
      }
    }
  } catch { /* ignore */ }

  // 3. Truncar descripciones muy largas en discoveryCalls
  try {
    const raw = localStorage.getItem('discoveryCalls')
    if (raw) {
      const before = bytesOf(raw)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const all: any[] = JSON.parse(raw)
      let truncated = 0
      const cleaned = all.map(c => {
        if (typeof c?.description === 'string' && c.description.length > 200) {
          truncated++
          return { ...c, description: c.description.slice(0, 200) + '…' }
        }
        return c
      })
      if (truncated > 0) {
        const after = bytesOf(JSON.stringify(cleaned))
        localStorage.setItem('discoveryCalls', JSON.stringify(cleaned))
        freedBytes += before - after
        actions.push(`${truncated} descripciones largas de Discovery truncadas a 200 chars`)
      }
    }
  } catch { /* ignore */ }

  // 4. callBriefs (regenerables — la usuaria puede re-generar con el botón)
  try {
    const raw = localStorage.getItem('callBriefs')
    if (raw && raw.length > 10_000) {
      const bytes = bytesOf(raw)
      localStorage.removeItem('callBriefs')
      freedBytes += bytes
      actions.push(`Fichas IA guardadas eliminadas (${(bytes / 1024).toFixed(0)} KB — regenerables con un click)`)
    }
  } catch { /* ignore */ }

  return { freedBytes, actions }
}
