import { attendanceDB } from '../db'
import { attendanceApi } from './api'
import { showNotification } from './notificationService'

const DEVICE_ID = getOrCreateDeviceId()
const MAX_SYNC_RETRIES = 3
const RETRY_BASE_DELAY_MS = 1200

// ── Sync State Management ──────────────────────────────────────────────────
let _isSyncing = false
let _syncListeners = []

export function getSyncState() {
  return _isSyncing
}

export function onSyncStateChange(callback) {
  _syncListeners.push(callback)
}

export function offSyncStateChange(callback) {
  _syncListeners = _syncListeners.filter(cb => cb !== callback)
}

function setSyncing(value) {
  _isSyncing = value
  _syncListeners.forEach(cb => { try { cb(value) } catch (e) { /* ignore */ } })
}
// ──────────────────────────────────────────────────────────────────────────

function getOrCreateDeviceId() {
  let deviceId = localStorage.getItem('device_id')
  if (!deviceId) {
    deviceId = 'DEV-' + crypto.randomUUID()
    localStorage.setItem('device_id', deviceId)
  }
  return deviceId
}

export async function syncPendingAttendance() {
  const pendingRecords = await attendanceDB.getPending()
  
  if (pendingRecords.length === 0) {
    console.log('No pending records to sync')
    setLastSyncMeta({
      status: 'idle',
      message: 'No pending records',
      synced: 0,
      failed: 0,
      retries: 0,
      at: new Date().toISOString()
    })
    return { synced: 0, failed: 0 }
  }
  
  console.log(`Syncing ${pendingRecords.length} pending records...`)
  setSyncing(true)
  
  try {
    const records = pendingRecords.map(record => ({
      local_id: record.id,
      emp_id: record.emp_id,
      date: record.date,
      time: record.time,
      latitude: record.latitude,
      longitude: record.longitude,
      photo: record.photo,
      attendance_type: record.attendance_type || 'CHECK_IN'
    }))
    
    const response = await syncWithRetry(records)
    const { results } = response.data
    
    for (const result of results) {
      if (result.status === 'synced') {
        await attendanceDB.updateStatus(result.local_id, 'SYNCED')
      } else if (result.status === 'duplicate') {
        await attendanceDB.updateStatus(result.local_id, 'SYNCED')
      }
    }
    
    const summary = {
      synced: results.filter(r => r.status === 'synced').length,
      failed: results.filter(r => r.status === 'failed').length
    }
    setLastSyncMeta({
      status: summary.failed > 0 ? 'partial' : 'success',
      message: summary.failed > 0 ? 'Synced with some failures' : 'Sync completed successfully',
      synced: summary.synced,
      failed: summary.failed,
      retries: Number(response.__retryCount || 0),
      at: new Date().toISOString()
    })
    if (summary.synced > 0 && summary.failed === 0) {
      showNotification('Sync Complete ✅', `${summary.synced} record(s) synced successfully`)
    }
    return summary
  } catch (error) {
    console.error('Sync failed:', error)
    setLastSyncMeta({
      status: 'failed',
      message: error?.message || 'Sync failed',
      synced: 0,
      failed: pendingRecords.length,
      retries: MAX_SYNC_RETRIES,
      at: new Date().toISOString()
    })
    throw error
  } finally {
    setSyncing(false)
  }
}

async function syncWithRetry(records) {
  let attempt = 0
  let lastError = null

  while (attempt < MAX_SYNC_RETRIES) {
    try {
      const response = await attendanceApi.sync(DEVICE_ID, records)
      response.__retryCount = attempt
      return response
    } catch (error) {
      lastError = error
      attempt += 1
      if (attempt >= MAX_SYNC_RETRIES) break
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1)
      await sleep(delay)
    }
  }

  throw lastError
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function setLastSyncMeta(meta) {
  localStorage.setItem('last_sync_meta', JSON.stringify(meta))
}

export function getLastSyncMeta() {
  const raw = localStorage.getItem('last_sync_meta')
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function registerBackgroundSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then(registration => {
      return registration.sync.register('sync-attendance')
    }).catch(err => {
      console.log('Background sync registration failed:', err)
    })
  }
}

/**
 * Conflict Resolution — SRS GET /v1/data
 * Fetches today's records from server and marks any local PENDING records
 * as SYNCED if the server already has them (server wins strategy).
 */
export async function resolveConflicts() {
  try {
    const today = new Date().toISOString().split('T')[0]
    const response = await attendanceApi.getAll({
      start_date: today,
      end_date: today,
      limit: 100
    })
    const serverRecords = response.data.records || []

    if (serverRecords.length === 0) return

    // Build a lookup set: "emp_id|date|attendance_type"
    const serverKeys = new Set(
      serverRecords.map(r => `${r.emp_id}|${r.date}|${r.attendance_type}`)
    )

    // Get all local pending records
    const pendingLocal = await attendanceDB.getPending()
    let resolved = 0

    for (const local of pendingLocal) {
      const key = `${local.emp_id}|${local.date}|${local.attendance_type || 'CHECK_IN'}`
      if (serverKeys.has(key)) {
        // Server already has this record — mark local as SYNCED
        await attendanceDB.updateStatus(local.id, 'SYNCED')
        resolved++
      }
    }

    if (resolved > 0) {
      console.log(`[ConflictResolution] Resolved ${resolved} duplicate(s) — server wins`)
    }
  } catch (error) {
    // Conflict resolution is best-effort — don't block sync
    console.warn('[ConflictResolution] Failed:', error?.message)
  }
}

export async function checkAndSync() {
  if (navigator.onLine) {
    try {
      const result = await syncPendingAttendance()
      console.log('Sync completed:', result)
      // Run conflict resolution after sync
      await resolveConflicts()
      return result
    } catch (error) {
      console.error('Sync error:', error)
    }
  }
  return null
}

window.addEventListener('online', () => {
  console.log('Back online, attempting sync...')
  checkAndSync()
})
