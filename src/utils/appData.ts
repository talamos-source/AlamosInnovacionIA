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
 * USAR SIEMPRE en lugar de `localStorage.setItem(key, value)` cuando
 * `key` esté en APP_DATA_KEYS. Si no se actualiza el timestamp, los
 * datos locales pueden perderse en el próximo refresh de la app.
 */
export const persistAppData = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value)
    if (APP_DATA_KEYS.includes(key)) {
      localStorage.setItem(APP_DATA_UPDATED_AT_KEY, new Date().toISOString())
      notifyAppDataChanged()
    }
  } catch (err) {
    console.error(`[appData] persistAppData failed for ${key}:`, err)
  }
}
