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
      if (syncingRef.current) return
      syncingRef.current = true
      try {
        await fetch(`${API_BASE}/app-data`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ data: snapshot })
        })
      } catch (error) {
        console.error('Failed to upload app data:', error)
      } finally {
        syncingRef.current = false
      }
    }

    const initialize = async () => {
      try {
        const response = await fetch(`${API_BASE}/app-data`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!response.ok) return
        const payload = (await response.json()) as AppDataResponse
        const serverData = payload?.data
        const serverUpdatedAt = payload?.updatedAt ? Date.parse(payload.updatedAt) : 0

        const localSnapshot = getLocalSnapshot()
        const hasLocal = Object.keys(localSnapshot).length > 0
        const localUpdatedAtRaw = localStorage.getItem(APP_DATA_UPDATED_AT_KEY)
        const localUpdatedAt = localUpdatedAtRaw ? Date.parse(localUpdatedAtRaw) : 0

        if (!serverData) {
          if (hasLocal) {
            await pushSnapshot(localSnapshot)
            const now = new Date().toISOString()
            localStorage.setItem(APP_DATA_UPDATED_AT_KEY, now)
            snapshotRef.current = JSON.stringify(localSnapshot)
          }
          return
        }

        if (!hasLocal || !localUpdatedAtRaw || localUpdatedAt <= serverUpdatedAt) {
          applySnapshot(serverData)
          if (payload.updatedAt) {
            localStorage.setItem(APP_DATA_UPDATED_AT_KEY, payload.updatedAt)
          }
          snapshotRef.current = JSON.stringify(serverData)
          return
        }

        await pushSnapshot(localSnapshot)
        const now = new Date().toISOString()
        localStorage.setItem(APP_DATA_UPDATED_AT_KEY, now)
        snapshotRef.current = JSON.stringify(localSnapshot)
      } catch (error) {
        console.error('Failed to initialize app data sync:', error)
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
