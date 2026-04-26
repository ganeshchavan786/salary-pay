import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSyncContext } from '../context/SyncContext'
import { Camera, History, LogOut, Wifi, WifiOff, Loader2, AlertCircle, AlertTriangle, CheckCircle2, FileText, Wallet, Receipt, CreditCard } from 'lucide-react'
import { useState, useEffect } from 'react'
import { requestNotificationPermission } from '../services/notificationService'
import { checkAndSync } from '../services/syncService'
import { useTranslation } from 'react-i18next'

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const { t, i18n } = useTranslation()
  const { isSyncing, pendingCount, lastSyncStatus, serverOnline } = useSyncContext()

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    requestNotificationPermission()
  }, [])

  function toggleLang() {
    const next = i18n.language === 'en' ? 'mr' : 'en'
    i18n.changeLanguage(next)
    localStorage.setItem('lang', next)
  }

  async function handleRetrySync() {
    if (isOnline) {
      await checkAndSync()
    }
  }

  // Determine sync icon to show in header
  function SyncStatusIcon() {
    if (isSyncing) {
      return (
        <span title="Syncing in progress...">
          <Loader2 className="w-5 h-5 text-blue-300 animate-spin" />
        </span>
      )
    }
    if (pendingCount > 0) {
      return (
        <span className="relative" title={`${pendingCount} record(s) pending sync`}>
          <AlertCircle className="w-5 h-5 text-yellow-300" />
          <span className="absolute -top-1 -right-1 bg-yellow-400 text-yellow-900 text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
            {pendingCount > 9 ? '9+' : pendingCount}
          </span>
        </span>
      )
    }
    if (lastSyncStatus?.status === 'failed') {
      return (
        <span title="Last sync failed — tap to retry" onClick={handleRetrySync} className="cursor-pointer">
          <AlertTriangle className="w-5 h-5 text-red-300" />
        </span>
      )
    }
    if (lastSyncStatus?.status === 'success') {
      return (
        <span title="All records synced">
          <CheckCircle2 className="w-5 h-5 text-green-300" />
        </span>
      )
    }
    return null
  }

  // Status banner below header
  function StatusBanner() {
    if (!isOnline) {
      return (
        <div className="bg-yellow-500 text-yellow-900 text-xs text-center py-1.5 px-4 font-medium">
          📵 Offline Mode — records will sync when connected
        </div>
      )
    }
    if (isSyncing) {
      return (
        <div className="bg-blue-500 text-white text-xs text-center py-1.5 px-4 font-medium flex items-center justify-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          Syncing records to server...
        </div>
      )
    }
    if (lastSyncStatus?.status === 'failed') {
      return (
        <div
          className="bg-red-500 text-white text-xs text-center py-1.5 px-4 font-medium cursor-pointer"
          onClick={handleRetrySync}
        >
          ⚠️ Sync failed — tap to retry
        </div>
      )
    }
    if (serverOnline === false && isOnline) {
      return (
        <div className="bg-orange-500 text-white text-xs text-center py-1.5 px-4 font-medium">
          🔌 Server unreachable — working offline
        </div>
      )
    }
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary-500 text-white shadow-lg">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Face Attendance</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleLang}
              className="text-xs px-2 py-1 bg-primary-600 hover:bg-primary-700 rounded font-medium transition"
              title="Toggle language"
            >
              {i18n.language === 'en' ? 'मराठी' : 'EN'}
            </button>

            {/* Sync status icon */}
            <SyncStatusIcon />

            {/* Network status icon */}
            {isOnline ? (
              <Wifi className="w-5 h-5 text-green-300" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-300" />
            )}

            <button
              onClick={logout}
              className="p-2 hover:bg-primary-600 rounded-full transition"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Status banner */}
      <StatusBanner />

      <main className="max-w-lg mx-auto px-4 py-6">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="max-w-lg mx-auto flex overflow-x-auto">
          <Link
            to="/"
            className={`flex-1 flex flex-col items-center py-3 min-w-[60px] ${
              location.pathname === '/' ? 'text-primary-500' : 'text-gray-500'
            }`}
          >
            <Camera className="w-6 h-6" />
            <span className="text-xs mt-1">{t('nav.attendance')}</span>
          </Link>
          <Link
            to="/history"
            className={`flex-1 flex flex-col items-center py-3 min-w-[60px] ${
              location.pathname === '/history' ? 'text-primary-500' : 'text-gray-500'
            }`}
          >
            <History className="w-6 h-6" />
            <span className="text-xs mt-1">{t('nav.history')}</span>
          </Link>
          <Link
            to="/my-leaves"
            className={`flex-1 flex flex-col items-center py-3 min-w-[60px] ${
              location.pathname === '/my-leaves' ? 'text-primary-500' : 'text-gray-500'
            }`}
          >
            <FileText className="w-6 h-6" />
            <span className="text-xs mt-1">{t('nav.leaves', 'Leaves')}</span>
          </Link>
          <Link
            to="/my-salary"
            className={`flex-1 flex flex-col items-center py-3 min-w-[60px] ${
              location.pathname === '/my-salary' ? 'text-primary-500' : 'text-gray-500'
            }`}
          >
            <Wallet className="w-6 h-6" />
            <span className="text-xs mt-1">{t('nav.salary', 'Salary')}</span>
          </Link>
          <Link
            to="/my-tax-declaration"
            className={`flex-1 flex flex-col items-center py-3 min-w-[60px] ${
              location.pathname === '/my-tax-declaration' ? 'text-primary-500' : 'text-gray-500'
            }`}
          >
            <Receipt className="w-6 h-6" />
            <span className="text-xs mt-1">Tax</span>
          </Link>
          <Link
            to="/my-loans"
            className={`flex-1 flex flex-col items-center py-3 min-w-[60px] ${
              location.pathname === '/my-loans' ? 'text-primary-500' : 'text-gray-500'
            }`}
          >
            <CreditCard className="w-6 h-6" />
            <span className="text-xs mt-1">Loans</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}
