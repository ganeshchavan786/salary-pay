import { createContext, useContext, useState, useEffect } from 'react'
import {
  getSyncState,
  onSyncStateChange,
  offSyncStateChange,
  getLastSyncMeta
} from '../services/syncService'
import { attendanceDB } from '../db'
import { startHeartbeat, stopHeartbeat, onServerStatusChange, offServerStatusChange } from '../services/heartbeatService'

const SyncContext = createContext(null)

export function SyncProvider({ children }) {
  const [isSyncing, setIsSyncing] = useState(getSyncState())
  const [pendingCount, setPendingCount] = useState(0)
  const [lastSyncStatus, setLastSyncStatus] = useState(getLastSyncMeta())
  const [serverOnline, setServerOnline] = useState(null)

  // Subscribe to sync state changes
  useEffect(() => {
    const handleSyncChange = (syncing) => {
      setIsSyncing(syncing)
      if (!syncing) {
        // Refresh pending count and last sync meta after sync completes
        refreshPendingCount()
        setLastSyncStatus(getLastSyncMeta())
      }
    }
    onSyncStateChange(handleSyncChange)
    return () => offSyncStateChange(handleSyncChange)
  }, [])

  // Subscribe to server heartbeat
  useEffect(() => {
    const handleServerStatus = (online) => setServerOnline(online)
    onServerStatusChange(handleServerStatus)
    startHeartbeat()
    return () => {
      offServerStatusChange(handleServerStatus)
      stopHeartbeat()
    }
  }, [])

  // Refresh pending count periodically
  useEffect(() => {
    refreshPendingCount()
    const interval = setInterval(refreshPendingCount, 10_000)
    return () => clearInterval(interval)
  }, [])

  async function refreshPendingCount() {
    try {
      const pending = await attendanceDB.getPending()
      setPendingCount(pending.length)
    } catch {
      // ignore
    }
  }

  return (
    <SyncContext.Provider value={{ isSyncing, pendingCount, lastSyncStatus, serverOnline, refreshPendingCount }}>
      {children}
    </SyncContext.Provider>
  )
}

export function useSyncContext() {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSyncContext must be used inside SyncProvider')
  return ctx
}
