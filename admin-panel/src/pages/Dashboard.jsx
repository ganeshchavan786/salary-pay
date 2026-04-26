import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Users, UserCheck, UserX, CalendarCheck, Clock, Umbrella, Star, ArrowRight, CheckCircle, XCircle } from 'lucide-react'
import { employeeApi, attendanceApi, dashboardApi, leaveApi } from '../services/api'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const STATUS_COLORS = {
  present: 'bg-green-100 text-green-700',
  absent: 'bg-red-100 text-red-700',
  halfday: 'bg-purple-100 text-purple-700',
  leave: 'bg-orange-100 text-orange-700',
  holiday: 'bg-blue-100 text-blue-700',
  weeklyoff: 'bg-gray-100 text-gray-600',
}

const LEAVE_TYPE_COLORS = {
  CL: 'bg-blue-100 text-blue-700',
  SL: 'bg-green-100 text-green-700',
  EL: 'bg-purple-100 text-purple-700',
  LWP: 'bg-red-100 text-red-700',
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [todayAttendance, setTodayAttendance] = useState([])
  const [pendingLeaves, setPendingLeaves] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  async function loadDashboardData() {
    setLoading(true)
    try {
      // Try new dashboard API first
      const [summaryRes, attRes, leavesRes] = await Promise.allSettled([
        dashboardApi.summary(),
        dashboardApi.todayAttendance(),
        dashboardApi.pendingLeaves(),
      ])

      if (summaryRes.status === 'fulfilled') {
        setStats(summaryRes.value.data)
      } else {
        // Fallback to old employee API
        const empResponse = await employeeApi.getAll({ limit: 100 })
        const employees = empResponse.data.employees || []
        const enrolled = employees.filter(e => e.face_enrolled).length
        setStats({
          total_employees: employees.length,
          active_employees: employees.length,
          present_today: 0,
          absent_today: 0,
          on_leave_today: 0,
          pending_leaves: 0,
          new_joiners_this_month: 0,
          attendance_rate: 0,
          enrolledFaces: enrolled,
          pendingEnrollment: employees.length - enrolled,
        })
      }

      if (attRes.status === 'fulfilled') {
        setTodayAttendance(attRes.value.data.records || [])
      }

      if (leavesRes.status === 'fulfilled') {
        setPendingLeaves(leavesRes.value.data.leaves || [])
      }
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleApproveLeave(id) {
    try {
      await leaveApi.approve(id)
      toast.success('Leave approved ✅')
      loadDashboardData()
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to approve') }
  }

  async function handleRejectLeave(id) {
    try {
      await leaveApi.reject(id, { comment: 'Rejected by HR' })
      toast.success('Leave rejected')
      loadDashboardData()
    } catch { toast.error('Failed to reject') }
  }

  const s = stats || {}

  const statCards = [
    { label: 'Total Employees', value: s.total_employees ?? s.totalEmployees ?? 0, icon: Users, color: 'bg-blue-500' },
    { label: 'Present Today', value: s.present_today ?? 0, icon: UserCheck, color: 'bg-green-500' },
    { label: 'Absent Today', value: s.absent_today ?? 0, icon: UserX, color: 'bg-red-500' },
    { label: 'On Leave Today', value: s.on_leave_today ?? 0, icon: Umbrella, color: 'bg-orange-500' },
    { label: 'Pending Leaves', value: s.pending_leaves ?? 0, icon: Clock, color: 'bg-purple-500' },
    { label: 'New Joiners', value: s.new_joiners_this_month ?? 0, icon: Star, color: 'bg-cyan-500' },
    { label: 'Face Enrolled', value: s.enrolledFaces ?? s.active_employees ?? 0, icon: UserCheck, color: 'bg-teal-500' },
    { label: "Today's Records", value: s.todayAttendance ?? todayAttendance.length, icon: CalendarCheck, color: 'bg-indigo-500' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500">
          {format(new Date(), 'EEEE, dd MMMM yyyy')} — Face Attendance HR
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div key={index} className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-xs">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-2.5 rounded-lg`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Today's Attendance */}
        <div className="bg-white rounded-xl shadow">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">📅 Today's Attendance</h2>
            <Link to="/attendance" className="text-blue-600 text-xs flex items-center gap-1 hover:underline">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {todayAttendance.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">No attendance records for today</div>
          ) : (
            <div className="divide-y max-h-64 overflow-y-auto">
              {todayAttendance.slice(0, 8).map(r => (
                <div key={r.id} className="px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-800">{r.emp_name}</div>
                    <div className="text-xs text-gray-400">{r.emp_code} · {r.department || '—'}</div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500">{r.check_in ? r.check_in.slice(11, 16) : '—'}</span>
                    <span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>
                      {r.status}
                    </span>
                    {r.is_late_mark && (
                      <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">Late</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Leave Requests */}
        <div className="bg-white rounded-xl shadow">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">🏖️ Pending Leaves</h2>
            <Link to="/leaves" className="text-blue-600 text-xs flex items-center gap-1 hover:underline">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {pendingLeaves.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">No pending leave requests 🎉</div>
          ) : (
            <div className="divide-y max-h-64 overflow-y-auto">
              {pendingLeaves.map(l => (
                <div key={l.id} className="px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-800">{l.emp_name}</div>
                    <div className="text-xs text-gray-400">
                      <span className={`px-1.5 py-0.5 rounded-full font-medium mr-1 ${LEAVE_TYPE_COLORS[l.leave_type] || 'bg-gray-100 text-gray-600'}`}>
                        {l.leave_type}
                      </span>
                      {l.from_date} → {l.to_date} ({l.total_days}d)
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => handleApproveLeave(l.id)} className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200" title="Approve">
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleRejectLeave(l.id)} className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-200" title="Reject">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="font-semibold text-gray-800 mb-3">⚡ Quick Actions</h2>
        <div className="flex gap-3 flex-wrap">
          {[
            { label: '+ Add Employee', to: '/employees', color: 'bg-blue-50 text-blue-700 border-blue-200' },
            { label: 'Run Payroll', to: '/payroll', color: 'bg-green-50 text-green-700 border-green-200' },
            { label: 'View Attendance', to: '/attendance', color: 'bg-purple-50 text-purple-700 border-purple-200' },
            { label: 'Manage Leaves', to: '/leaves', color: 'bg-orange-50 text-orange-700 border-orange-200' },
          ].map((a, i) => (
            <Link key={i} to={a.to} className={`px-4 py-2 rounded-lg text-sm font-medium border ${a.color} hover:opacity-80`}>
              {a.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
