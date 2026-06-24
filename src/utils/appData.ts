export const APP_DATA_UPDATED_AT_KEY = 'appDataUpdatedAt'

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
    }
  } catch (err) {
    console.error(`[appData] persistAppData failed for ${key}:`, err)
  }
}
