/**
 * Heartbeat Service — SRS GET /v1/status
 * Polls /api/status every 30 seconds to detect server availability.
 * Notifies subscribers when server status changes.
 */

const HEARTBEAT_INTERVAL_MS = 30_000
const HEARTBEAT_TIMEOUT_MS = 5_000

let _serverOnline = null   // null = unknown, true = online, false = offline
let _intervalId = null
let _listeners = []

/**
 * Subscribe to server status changes.
 * Callback receives (isOnline: boolean)
 */
export function onServerStatusChange(callback) {
  _listeners.push(callback)
  // Immediately notify with current state if known
  if (_serverOnline !== null) {
    callback(_serverOnline)
  }
}

export function offServerStatusChange(callback) {
  _listeners = _listeners.filter(cb => cb !== callback)
}

export function isServerOnline() {
  return _serverOnline
}

function notifyListeners(isOnline) {
  _listeners.forEach(cb => {
    try { cb(isOnline) } catch (e) { /* ignore */ }
  })
}

async function ping() {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS)

    const response = await fetch('/api/status', {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store'
    })
    clearTimeout(timeoutId)

    const wasOnline = _serverOnline
    _serverOnline = response.ok

    if (wasOnline !== _serverOnline) {
      notifyListeners(_serverOnline)
    }
  } catch {
    const wasOnline = _serverOnline
    _serverOnline = false
    if (wasOnline !== false) {
      notifyListeners(false)
    }
  }
}

/**
 * Start polling the heartbeat endpoint.
 * Safe to call multiple times — only one interval runs at a time.
 */
export function startHeartbeat() {
  if (_intervalId) return  // already running

  // Ping immediately, then every 30s
  ping()
  _intervalId = setInterval(ping, HEARTBEAT_INTERVAL_MS)
}

/**
 * Stop polling.
 */
export function stopHeartbeat() {
  if (_intervalId) {
    clearInterval(_intervalId)
    _intervalId = null
  }
}
