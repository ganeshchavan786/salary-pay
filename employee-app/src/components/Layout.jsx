/**
 * Layout.jsx - Employee App
 * Simplified layout - removed face scan sync context, kept core nav.
 */
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Fingerprint, History, LogOut, Wifi, WifiOff, FileText, Wallet, User } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function Layout({ children }) {
  const { employee, logout } = useAuth()
  const location = useLocation()
  const [isOnline, setIsOnline] = useState(navigator.onLine)

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header style={{ background: 'linear-gradient(90deg, #0ea5e9, #0284c7)' }} className="text-white shadow-lg">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold leading-tight">Employee Attendance</h1>
            <p className="text-sky-100 text-xs">{employee?.name || employee?.username || 'Employee'}</p>
          </div>
          <div className="flex items-center gap-3">
            {isOnline
              ? <Wifi className="w-5 h-5 text-green-300" />
              : <WifiOff className="w-5 h-5 text-red-300" />
            }
            <button
              id="logout-btn"
              onClick={logout}
              className="p-2 rounded-full transition"
              style={{ background: 'rgba(255,255,255,0.15)' }}
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-yellow-500 text-yellow-900 text-xs text-center py-1.5 px-4 font-medium">
          📵 Offline — attendance will sync when connected
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 py-5">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-lg">
        <div className="max-w-lg mx-auto flex">
          <Link
            to="/"
            id="nav-attendance"
            className={`flex-1 flex flex-col items-center py-3 transition ${
              location.pathname === '/' ? 'text-sky-500' : 'text-gray-400'
            }`}
          >
            <Fingerprint className="w-6 h-6" />
            <span className="text-xs mt-1 font-medium">Attendance</span>
          </Link>
          <Link
            to="/history"
            id="nav-history"
            className={`flex-1 flex flex-col items-center py-3 transition ${
              location.pathname === '/history' ? 'text-sky-500' : 'text-gray-400'
            }`}
          >
            <History className="w-6 h-6" />
            <span className="text-xs mt-1 font-medium">History</span>
          </Link>
          <Link
            to="/my-leaves"
            id="nav-leaves"
            className={`flex-1 flex flex-col items-center py-3 transition ${
              location.pathname === '/my-leaves' ? 'text-sky-500' : 'text-gray-400'
            }`}
          >
            <FileText className="w-6 h-6" />
            <span className="text-xs mt-1 font-medium">Leaves</span>
          </Link>
          <Link
            to="/my-salary"
            id="nav-salary"
            className={`flex-1 flex flex-col items-center py-3 transition ${
              location.pathname === '/my-salary' ? 'text-sky-500' : 'text-gray-400'
            }`}
          >
            <Wallet className="w-6 h-6" />
            <span className="text-xs mt-1 font-medium">Salary</span>
          </Link>
          <Link
            to="/profile"
            id="nav-profile"
            className={`flex-1 flex flex-col items-center py-3 transition ${
              location.pathname === '/profile' ? 'text-sky-500' : 'text-gray-400'
            }`}
          >
            <User className="w-6 h-6" />
            <span className="text-xs mt-1 font-medium">Profile</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}
