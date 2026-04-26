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
} from 'lucide-react'
import { useState, useEffect } from 'react'

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/employees', label: 'Employees', icon: Users },
  { path: '/attendance', label: 'Attendance', icon: CalendarCheck },
  { path: '/leaves', label: 'Leaves', icon: FileText },
  // { path: '/payroll', label: 'Payroll', icon: DollarSign }, // Disabled old Payroll menu as per user request
  { path: '/salary', label: 'Salary System', icon: Banknote, isSalaryMenu: true },
  { path: '/holidays', label: 'Holidays', icon: CalendarDays },
  { path: '/reports', label: 'Reports', icon: BarChart2 },
  { path: '/audit', label: 'Audit Log', icon: ClipboardList },
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
              return (
                <div key="salary-menu" className="mt-0.5">
                  <button
                    onClick={() => setSalaryOpen(o => !o)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group
                      ${isSalaryActive
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <Banknote className={`w-4 h-4 flex-shrink-0 ${isSalaryActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                    <span className="text-sm flex-1 text-left">Salary System</span>
                    {salaryOpen
                      ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                      : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                    }
                  </button>

                  {salaryOpen && (
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
            return (
              <Link
                key={item.path}
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
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
