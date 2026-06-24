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

        const localSnapshot = getLocalSnapshot()
        const hasLocal = Object.keys(localSnapshot).length > 0
        const localUpdatedAtRaw = localStorage.getItem(APP_DATA_UPDATED_AT_KEY)
        const localUpdatedAt = localUpdatedAtRaw ? Date.parse(localUpdatedAtRaw) : 0

        const serverCustomersN = serverData ? (() => { try { return JSON.parse(serverData.customers || '[]').length } catch { return '?' } })() : 'n/a'
        const localCustomersN = (() => { try { return JSON.parse(localSnapshot.customers || '[]').length } catch { return '?' } })()
        console.log('[Sync] initialize:', {
          hasLocal,
          localUpdatedAt: localUpdatedAtRaw,
          serverUpdatedAt: payload?.updatedAt,
          localCustomers: localCustomersN,
          serverCustomers: serverCustomersN,
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

        // CAMBIO CRÍTICO: en empate o si local no tiene timestamp pero SÍ
        // tiene datos, preferir LOCAL. Solo aplicar server si:
        //   - No hay datos locales en absoluto, O
        //   - Server es ESTRICTAMENTE más nuevo que local (> en vez de >=)
        // Antes con <=, un empate hacía perder los cambios locales sin push.
        const shouldApplyServer = !hasLocal || (localUpdatedAtRaw && localUpdatedAt < serverUpdatedAt)
        if (shouldApplyServer) {
          console.warn('[Sync] applySnapshot del server — local pierde', { localUpdatedAt, serverUpdatedAt, localCustomersN, serverCustomersN })
          applySnapshot(serverData)
          if (payload.updatedAt) {
            localStorage.setItem(APP_DATA_UPDATED_AT_KEY, payload.updatedAt)
          }
          snapshotRef.current = JSON.stringify(serverData)
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
