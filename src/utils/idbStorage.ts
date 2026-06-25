/* ============================================================
   IndexedDB helper — almacenamiento sin límite práctico
   ============================================================
   localStorage tiene tope ~5-10 MB. IndexedDB permite cientos de MB
   o GB según política del navegador. Lo usamos para blobs grandes:
   PDFs, base64 de imágenes, contenido de archivos subidos.

   API simple key/value:
     await idbSet('proposal-docs', 'doc-123', base64String)
     const value = await idbGet('proposal-docs', 'doc-123')
     await idbRemove('proposal-docs', 'doc-123')
     const allKeys = await idbKeys('proposal-docs')
   ============================================================ */

const DB_NAME = 'alamos-crm-storage'
const DB_VERSION = 1

// Stores conocidos
const STORES = ['proposal-docs', 'project-blobs'] as const
export type IdbStore = typeof STORES[number]

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store)
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      dbPromise = null
      reject(req.error)
    }
  })
  return dbPromise
}

function runTx<T>(
  store: IdbStore,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode)
        const objStore = tx.objectStore(store)
        const req = fn(objStore)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export async function idbSet(store: IdbStore, key: string, value: unknown): Promise<void> {
  await runTx(store, 'readwrite', s => s.put(value as IDBValidKey, key))
}

export async function idbGet<T = unknown>(store: IdbStore, key: string): Promise<T | undefined> {
  const v = await runTx<unknown>(store, 'readonly', s => s.get(key))
  return v as T | undefined
}

export async function idbRemove(store: IdbStore, key: string): Promise<void> {
  await runTx(store, 'readwrite', s => s.delete(key))
}

export async function idbKeys(store: IdbStore): Promise<string[]> {
  const keys = await runTx<IDBValidKey[]>(store, 'readonly', s => s.getAllKeys())
  return keys.map(k => String(k))
}

/** Reporte aproximado de uso de IndexedDB (Storage Manager API). */
export async function idbUsageReport(): Promise<{ usageMB: number; quotaMB: number } | null> {
  if (!navigator.storage || typeof navigator.storage.estimate !== 'function') return null
  const est = await navigator.storage.estimate()
  return {
    usageMB: (est.usage || 0) / (1024 * 1024),
    quotaMB: (est.quota || 0) / (1024 * 1024),
  }
}
