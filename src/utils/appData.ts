export const APP_DATA_UPDATED_AT_KEY = 'appDataUpdatedAt'

export const APP_DATA_KEYS = [
  'customers',
  'calls',
  'proposals',
  'projects',
  'otherServices',
  'invoices',
  'companySettings',
  'users'
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
