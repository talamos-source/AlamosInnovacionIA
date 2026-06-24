import { useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { APP_DATA_UPDATED_AT_KEY, applySnapshot, getLocalSnapshot } from '../utils/appData'

type AppDataResponse = {
  data: Record<string, string> | null
  updatedAt: string | null
}

const API_BASE = import.meta.env.VITE_API_URL || 'https://alamosinnovacionia.onrender.com'
const SYNC_INTERVAL_MS = 15000

const AppDataSync = () => {
  const { isAuthenticated } = useAuth()
  const snapshotRef = useRef<string>('')
  const syncingRef = useRef(false)

  useEffect(() => {
    if (!isAuthenticated) return

    const token = localStorage.getItem('authToken')
    if (!token) return

    const pushSnapshot = async (snapshot: Record<string, string>) => {
      if (syncingRef.current) {
        console.log('[Sync] push skipped — already syncing')
        return
      }
      syncingRef.current = true
      try {
        const res = await fetch(`${API_BASE}/app-data`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ data: snapshot })
        })
        if (res.ok) {
          const bytes = Object.values(snapshot).join('').length
          console.log(`[Sync] ✓ pushed snapshot (${Object.keys(snapshot).length} keys, ${(bytes / 1024).toFixed(1)} KB)`)
        } else {
          console.error(`[Sync] ✗ push failed: HTTP ${res.status}`)
        }
      } catch (error) {
        console.error('[Sync] ✗ push exception:', error)
      } finally {
        syncingRef.current = false
      }
    }

    const initialize = async () => {
      try {
        // 1) Snapshot del localUpdatedAt AL INICIO del fetch.
        //    Si después de la respuesta este valor ha cambiado, significa que
        //    el usuario creó/editó algo durante el fetch — NO podemos
        //    aplicar el snapshot del server porque pisaría esos cambios.
        const localUpdatedAtBeforeFetch = localStorage.getItem(APP_DATA_UPDATED_AT_KEY)

        console.log('[Sync] initialize: fetching server snapshot…')
        const response = await fetch(`${API_BASE}/app-data`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!response.ok) {
          console.error(`[Sync] initialize fetch failed: HTTP ${response.status}`)
          return
        }
        const payload = (await response.json()) as AppDataResponse
        const serverData = payload?.data
        const serverUpdatedAt = payload?.updatedAt ? Date.parse(payload.updatedAt) : 0

        // 2) RE-LEER localStorage TRAS la fetch.
        //    Durante los 1-2s del network, el usuario puede haber creado
        //    un cliente, editado algo, etc. Esos cambios actualizaron
        //    appDataUpdatedAt y los datos locales.
        const localSnapshot = getLocalSnapshot()
        const hasLocal = Object.keys(localSnapshot).length > 0
        const localUpdatedAtRaw = localStorage.getItem(APP_DATA_UPDATED_AT_KEY)
        const localUpdatedAt = localUpdatedAtRaw ? Date.parse(localUpdatedAtRaw) : 0

        // 3) DETECTAR RACE: ¿cambió localUpdatedAt durante el fetch?
        const localChangedDuringFetch =
          localUpdatedAtRaw !== localUpdatedAtBeforeFetch

        const serverCustomersN = serverData ? (() => { try { return JSON.parse(serverData.customers || '[]').length } catch { return '?' } })() : 'n/a'
        const localCustomersN = (() => { try { return JSON.parse(localSnapshot.customers || '[]').length } catch { return '?' } })()
        console.log('[Sync] initialize:', {
          hasLocal,
          localUpdatedAt: localUpdatedAtRaw,
          serverUpdatedAt: payload?.updatedAt,
          localCustomers: localCustomersN,
          serverCustomers: serverCustomersN,
          localChangedDuringFetch,
        })

        if (!serverData) {
          if (hasLocal) {
            console.log('[Sync] server vacío, pusheando local')
            await pushSnapshot(localSnapshot)
            const now = new Date().toISOString()
            localStorage.setItem(APP_DATA_UPDATED_AT_KEY, now)
            snapshotRef.current = JSON.stringify(localSnapshot)
          }
          return
        }

        // 4) CRÍTICO: si local cambió durante el fetch, NUNCA aplicar
        //    el snapshot del server — pisaría los cambios. Push local.
        if (localChangedDuringFetch) {
          console.warn('[Sync] RACE detectada: localStorage cambió durante el fetch — preservando local y pusheando')
          await pushSnapshot(localSnapshot)
          snapshotRef.current = JSON.stringify(localSnapshot)
          return
        }

        // En empate o si local tiene datos pero sin timestamp, preferir
        // LOCAL (más seguro). Solo aplicar server si:
        //   - No hay datos locales en absoluto, O
        //   - Server es ESTRICTAMENTE más nuevo que local
        const shouldApplyServer = !hasLocal || (localUpdatedAtRaw && localUpdatedAt < serverUpdatedAt)
        if (shouldApplyServer) {
          console.warn('[Sync] applySnapshot del server — local pierde', { localUpdatedAt, serverUpdatedAt, localCustomersN, serverCustomersN })
          applySnapshot(serverData)
          if (payload.updatedAt) {
            localStorage.setItem(APP_DATA_UPDATED_AT_KEY, payload.updatedAt)
          }
          snapshotRef.current = JSON.stringify(serverData)
          // 5) Notificar a las páginas montadas que el localStorage cambió
          //    para que re-lean su state. Sin esto, el state de React
          //    sigue con los datos viejos aunque localStorage tenga los nuevos.
          window.dispatchEvent(new Event('appDataSyncApplied'))
          return
        }

        console.log('[Sync] local gana, pusheando local al server')
        await pushSnapshot(localSnapshot)
        const now = new Date().toISOString()
        localStorage.setItem(APP_DATA_UPDATED_AT_KEY, now)
        snapshotRef.current = JSON.stringify(localSnapshot)
      } catch (error) {
        console.error('[Sync] initialize exception:', error)
      }
    }

    initialize()

    const interval = window.setInterval(async () => {
      const snapshot = getLocalSnapshot()
      const snapshotString = JSON.stringify(snapshot)
      if (snapshotString !== snapshotRef.current) {
        snapshotRef.current = snapshotString
        const now = new Date().toISOString()
        localStorage.setItem(APP_DATA_UPDATED_AT_KEY, now)
        await pushSnapshot(snapshot)
      }
    }, SYNC_INTERVAL_MS)

    return () => {
      window.clearInterval(interval)
    }
  }, [isAuthenticated])

  return null
}

export default AppDataSync
