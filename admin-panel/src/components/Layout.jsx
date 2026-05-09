import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  LogOut,
  Menu,
  X,
  FileText,
  DollarSign,
  CalendarDays,
  ClipboardList,
  BarChart2,
  Settings,
  Calendar,
  Calculator,
  SlidersHorizontal,
  CreditCard,
  ShieldCheck,
  ScrollText,
  Lightbulb,
  ChevronDown,
  ChevronRight,
  Banknote,
  ExternalLink,
  AlertCircle,
  WifiOff,
  RefreshCw,
  Lock,
  Zap,
} from 'lucide-react'
import { useState, useEffect } from 'react'

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/employees', label: 'Employees', icon: Users },
  { path: '/attendance', label: 'Attendance', icon: CalendarCheck },
  { path: '/leaves', label: 'Leaves', icon: FileText, requiresPaid: true },
  { path: '/salary', label: 'Salary System', icon: Banknote, isSalaryMenu: true, requiresPaid: true },
  { path: '/holidays', label: 'Holidays', icon: CalendarDays, requiresPaid: true },
  { path: '/reports', label: 'Reports', icon: BarChart2, requiresPaid: true },
  { path: '/audit', label: 'Audit Log', icon: ClipboardList, requiresPaid: true },
]

const salaryNavItems = [
  { path: '/salary/periods',     label: 'Payroll Periods',    icon: Calendar,          color: 'text-blue-500' },
  { path: '/salary/calculation', label: 'Salary Calculation', icon: Calculator,        color: 'text-green-500' },
  { path: '/salary/payslips',    label: 'Payslips',           icon: FileText,          color: 'text-indigo-500' },
  { path: '/salary/payheads',    label: 'Payhead Config',     icon: SlidersHorizontal, color: 'text-purple-500' },
  { path: '/salary/deductions',  label: 'Deductions',         icon: CreditCard,        color: 'text-orange-500' },
  { path: '/salary/compliance',  label: 'Compliance Reports', icon: ShieldCheck,       color: 'text-teal-500' },
  { path: '/salary/audit',       label: 'Salary Audit',       icon: ScrollText,        color: 'text-gray-500' },
  { path: '/salary/insights',    label: 'Smart Insights',     icon: Lightbulb,         color: 'text-yellow-500' },
]

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Auto-expand salary section when on any /salary/* page
  const isSalaryActive = location.pathname.startsWith('/salary')
  const [salaryOpen, setSalaryOpen] = useState(isSalaryActive)

  // ── License Check & Background Recovery ──
  const [license, setLicense] = useState(null)
  const [isReadOnly, setIsReadOnly] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  
  const fetchLicense = async () => {
    try {
      const res = await fetch('/api/v1/license/info')
      const data = await res.json()
      
      const wasReadOnly = isReadOnly
      setLicense(data)
      // setIsReadOnly is handled above with early return for BLOCKED

      // If we recovered from Read-Only to Normal
      if (wasReadOnly && data.status === 'NORMAL') {
        // You could add a toast notification here
        console.log("License reactivated successfully")
      }
      
      // If server says BLOCKED, hard redirect — support modal दाखवायचं
      if (data.status === 'BLOCKED') {
        window.location.href = '/?contact_support=1'
        return
      }
      // READ_ONLY — expire झाली, basic features allow
      setIsReadOnly(data.status === 'READ_ONLY')
    } catch (err) {
      console.error("License fetch failed")
    }
  }

  useEffect(() => {
    fetchLicense()
    // Background retry every 5 minutes
    const interval = setInterval(fetchLicense, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [isReadOnly])

  // Keep in sync when navigating
  useEffect(() => {
    if (isSalaryActive) setSalaryOpen(true)
  }, [isSalaryActive])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm">
        <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-gray-100">
          <Menu className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Banknote className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-gray-800">Face Attendance</span>
        </div>
        <div className="w-9" />
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-50
        flex flex-col shadow-xl
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:shadow-none
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>

        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <Banknote className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-tight">Face Attendance</p>
              <p className="text-xs text-gray-400">Admin Panel</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Nav — scrollable */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">

          {/* Main nav items */}
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path

            // ── Salary System collapsible menu ──
            if (item.path === '/salary') {
              const isSalaryLocked = isReadOnly && item.requiresPaid
              return (
                <div key="salary-menu" className="mt-0.5">
                  <button
                    onClick={() => {
                      if (isSalaryLocked) {
                        setShowUpgradeModal(true)
                      } else {
                        setSalaryOpen(o => !o)
                      }
                    }}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group
                      ${isSalaryLocked
                        ? 'text-gray-400 hover:bg-gray-50'
                        : isSalaryActive
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <Banknote className={`w-4 h-4 flex-shrink-0 ${isSalaryLocked ? 'text-gray-300' : isSalaryActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                    <span className="text-sm flex-1 text-left">Salary System</span>
                    {isSalaryLocked
                      ? <Lock className="w-3 h-3 text-gray-300" />
                      : salaryOpen
                        ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                        : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                    }
                  </button>

                  {!isSalaryLocked && salaryOpen && (
                    <div className="mt-0.5 ml-3 pl-3 border-l-2 border-blue-100 space-y-0.5">
                      {salaryNavItems.map((sub) => {
                        const SubIcon = sub.icon
                        const subActive = location.pathname === sub.path
                        return (
                          <Link
                            key={sub.path}
                            to={sub.path}
                            onClick={() => setSidebarOpen(false)}
                            className={`
                              flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 group
                              ${subActive
                                ? 'bg-blue-50 text-blue-700 font-semibold'
                                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                              }
                            `}
                          >
                            <SubIcon className={`w-3.5 h-3.5 flex-shrink-0 ${subActive ? 'text-blue-600' : sub.color + ' opacity-70 group-hover:opacity-100'}`} />
                            <span className="text-sm">{sub.label}</span>
                            {subActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            // ── Regular nav item ──
            const isLocked = isReadOnly && item.requiresPaid
            return (
              <div
                key={item.path}
                onClick={() => {
                  if (isLocked) {
                    setShowUpgradeModal(true)
                    setSidebarOpen(false)
                  } else {
                    setSidebarOpen(false)
                  }
                }}
              >
                {isLocked ? (
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-gray-400 hover:bg-gray-50 transition-all duration-150 group">
                    <Icon className="w-4 h-4 flex-shrink-0 text-gray-300" />
                    <span className="text-sm flex-1">{item.label}</span>
                    <Lock className="w-3 h-3 text-gray-300" />
                  </div>
                ) : (
                  <Link
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group
                      ${isActive
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                    <span className="text-sm">{item.label}</span>
                    {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />}
                  </Link>
                )}
              </div>
            )
          })}

          {/* salary menu is now inline in navItems above */}
        </nav>

        {/* ── Bottom: Settings + User ── */}
        <div className="border-t border-gray-100 px-3 py-3 space-y-1">
          <Link
            to="/settings"
            onClick={() => setSidebarOpen(false)}
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group
              ${location.pathname === '/settings'
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }
            `}
          >
            <Settings className={`w-4 h-4 flex-shrink-0 ${location.pathname === '/settings' ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
            <span className="text-sm">Settings</span>
          </Link>
          
          {/* ── License Status Card ── */}
          {/* WHY: This card keeps the Administrator informed about the software's validity status. */}
          {/* WHERE: Visible at the bottom of the sidebar across all admin pages. */}
          {/* WHAT: It displays the current plan (Trial/Gold) and a countdown of remaining days. 
              The "Renew" button opens the License Server's checkout page for online payment. */}
          {license && (
            <div className={`mx-1 mt-2 p-3 rounded-xl border ${
              isReadOnly ? 'bg-amber-50 border-amber-200' : 'bg-indigo-50 border-indigo-100'
            }`}>
              <div className="flex items-center gap-2 mb-1.5">
                {isReadOnly ? (
                  <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                )}
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  isReadOnly ? 'text-amber-700' : 'text-indigo-700'
                }`}>
                  {isReadOnly ? 'Offline Mode' : 'License Status'}
                </span>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs font-bold text-gray-800 capitalize">{license.plan} Plan</p>
                  <p className={`text-[10px] font-semibold ${
                    license.days_remaining <= 2 || isReadOnly ? 'text-red-500' : 'text-indigo-600'
                  }`}>
                    {isReadOnly
                      ? 'Renew to unlock all features'
                      : license.plan === 'free'
                        ? 'Limited features'
                        : `${license.days_remaining} Days Left`
                    }
                  </p>
                </div>
                {!isReadOnly && (
                  <button 
                    onClick={() => window.open(`https://license.vrushaliinfotech.com/checkout?customer_id=${license.customer_id}&plan=${license.plan}`, '_blank')}
                    className="text-[10px] bg-white border border-indigo-200 text-indigo-600 px-2 py-0.5 rounded-md font-bold hover:bg-indigo-600 hover:text-white transition-all shadow-sm flex items-center gap-1"
                  >
                    <ExternalLink size={10} /> Renew
                  </button>
                )}
              </div>
              <div className="mt-2 pt-2 border-t border-black/5">
                <p className="text-[8px] text-gray-400 font-mono truncate">ID: {license.machine_id}</p>
              </div>
            </div>
          )}

          {/* User card */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-50 mt-1">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-white font-bold text-xs">
                {user?.username?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{user?.username}</p>
              <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-64 pt-14 lg:pt-0 min-h-screen">
      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowUpgradeModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-orange-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Feature Locked</h2>
            <p className="text-gray-500 text-sm mb-6">
              This feature requires an active subscription. Renew your plan to unlock all features.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  const customerId = license?.customer_id
                  if (customerId) {
                    window.open(`https://license.vrushaliinfotech.com/checkout?customer_id=${customerId}&plan=basic`, '_blank')
                  }
                  setShowUpgradeModal(false)
                }}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
              >
                <Zap className="w-4 h-4" />
                Renew Now — ₹499/month
              </button>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="w-full py-2.5 text-gray-500 text-sm hover:text-gray-700 transition-colors"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expired / Read-Only Banner */}
        {isReadOnly && (
          <div className="bg-orange-500 text-white px-6 py-2.5 flex items-center justify-between sticky top-14 lg:top-0 z-30 shadow-md">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold">Subscription expired.</p>
                <p className="text-xs opacity-90">
                  You can view Attendance and Employees. Renew to unlock all features.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={fetchLicense}
                className="flex items-center gap-1 text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors font-semibold"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
              {license?.customer_id && (
                <button
                  onClick={() => window.open(`https://license.vrushaliinfotech.com/checkout?customer_id=${license.customer_id}&plan=basic`, '_blank')}
                  className="flex items-center gap-1 text-xs bg-white text-orange-600 hover:bg-orange-50 px-3 py-1 rounded-full transition-colors font-bold"
                >
                  Renew Now →
                </button>
              )}
            </div>
          </div>
        )}
        
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
