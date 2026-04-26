const ICON = '/icon-192.png'

/**
 * Request browser notification permission (once).
 * Returns true if granted, false otherwise.
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

/**
 * Show a browser notification.
 * Silently no-ops if permission not granted or API unavailable.
 */
export function showNotification(title, body) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, icon: ICON, badge: ICON })
  } catch (e) {
    // Some browsers (e.g. Firefox in certain contexts) throw — ignore silently
    console.warn('[notificationService] Notification failed:', e)
  }
}
