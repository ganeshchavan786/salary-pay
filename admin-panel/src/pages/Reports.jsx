import { useState } from 'react'
import { LayoutDashboard, Users, CalendarCheck, Clock, DollarSign, FileText, Lightbulb } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import FilterPanel from './reports/FilterPanel'
import DashboardWidgets from './reports/DashboardWidgets'
import EmployeeReportsTab from './reports/EmployeeReportsTab'
import AttendanceAnalysisTab from './reports/AttendanceAnalysisTab'
import OTReportsTab from './reports/OTReportsTab'
import CostAnalysisTab from './reports/CostAnalysisTab'
import LeaveReportsTab from './reports/LeaveReportsTab'
import AutoInsightsTab from './reports/AutoInsightsTab'

/**
 * Main Reports page.
 * Manages activeTab state and shared filters.
 * Hides OT Reports and Cost Analysis from Supervisor role.
 * Requirement 1.1, 2.1, 34.1–34.3
 */

// Get first and last day of current month as YYYY-MM-DD strings
function getDefaultDates() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate()
  return {
    startDate: `${year}-${month}-01`,
    endDate: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
  }
}

const ALL_TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
  { id: 'employee', label: 'Employee Reports', icon: Users, adminOnly: false },
  { id: 'attendance', label: 'Attendance Analysis', icon: CalendarCheck, adminOnly: false },
  { id: 'ot', label: 'OT Reports', icon: Clock, adminOnly: true },
  { id: 'cost', label: 'Cost Analysis', icon: DollarSign, adminOnly: true },
  { id: 'leave', label: 'Leave Reports', icon: FileText, adminOnly: false },
  { id: 'insights', label: 'Auto Insights', icon: Lightbulb, adminOnly: false },
]

export default function Reports() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [activeTab, setActiveTab] = useState('dashboard')
  const [filters, setFilters] = useState({
    ...getDefaultDates(),
    empIds: [],
    departments: [],
  })

  // Filter tabs based on role
  const visibleTabs = ALL_TABS.filter(tab => !tab.adminOnly || isAdmin)

  // Validate date range before passing to children
  const hasDateError = filters.startDate && filters.endDate && filters.startDate > filters.endDate

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Advanced Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Comprehensive analytics and reporting</p>
      </div>

      {/* Filter Panel */}
      <FilterPanel filters={filters} onChange={setFilters} />

      {/* Tab navigation */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200 overflow-x-auto">
          <nav className="flex gap-0 px-4 min-w-max">
            {visibleTabs.map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                    isActive
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Tab content */}
        <div className="p-4">
          {hasDateError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
              Please fix the date range filter before viewing reports.
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && <DashboardWidgets />}
              {activeTab === 'employee' && <EmployeeReportsTab filters={filters} />}
              {activeTab === 'attendance' && <AttendanceAnalysisTab filters={filters} />}
              {activeTab === 'ot' && isAdmin && <OTReportsTab filters={filters} />}
              {activeTab === 'cost' && isAdmin && <CostAnalysisTab filters={filters} />}
              {activeTab === 'leave' && <LeaveReportsTab filters={filters} />}
              {activeTab === 'insights' && <AutoInsightsTab />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
