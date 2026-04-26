import { useState, useEffect } from 'react'
import {
  FileText, CheckCircle, XCircle, Clock, AlertTriangle,
  Download, X, Edit2, ChevronLeft, ChevronRight, List, Calendar
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { leaveApi, employeeApi } from '../services/api'
import { filterLeaves, getCalendarDayLeaves, exportLeavesToCSV } from '../utils/leaveUtils'
import toast from 'react-hot-toast'

const LEAVE_TYPE_COLORS = {
  CL: 'bg-blue-100 text-blue-700',
  SL: 'bg-green-100 text-green-700',
  EL: 'bg-purple-100 text-purple-700',
  LWP: 'bg-red-100 text-red-700',
}
const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
}
const PIE_COLORS = { CL: '#3b82f6', SL: '#10b981', EL: '#8b5cf6', LWP: '#ef4444' }
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const TABS = ['Leave Requests', 'All Balances', 'Reports']

// ── Stats Bar ─────────────────────────────────────────────────────────────────
function StatsBar({ stats, statsError }) {
  const cards = [
    { label: 'Pending', value: stats?.pending_count ?? '—', color: 'text-yellow-600 bg-yellow-50', icon: Clock },
    { label: 'Approved (This Month)', value: stats?.approved_this_month ?? '—', color: 'text-green-600 bg-green-50', icon: CheckCircle },
    { label: 'Rejected (This Month)', value: stats?.rejected_this_month ?? '—', color: 'text-red-600 bg-red-50', icon: XCircle },
    { label: 'LWP Days (This Year)', value: stats?.lwp_this_year ?? '—', color: 'text-orange-600 bg-orange-50', icon: AlertTriangle },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      {cards.map(c => {
        const Icon = c.icon
        return (
          <div key={c.label} className="bg-white rounded-xl shadow p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${c.color}`}><Icon className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className="text-xl font-bold text-gray-800 flex items-center gap-1">
                {statsError ? <span className="text-red-400 text-sm">●</span> : null}
                {c.value}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Calendar View ─────────────────────────────────────────────────────────────
function CalendarView({ leaves, calendarMonth, setCalendarMonth, onLeaveClick }) {
  const year = calendarMonth.getFullYear()
  const month = calendarMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCalendarMonth(new Date(year, month - 1, 1))} className="p-1.5 hover:bg-gray-100 rounded"><ChevronLeft className="w-5 h-5" /></button>
        <h3 className="font-semibold text-gray-800">{MONTHS_SHORT[month]} {year}</h3>
        <button onClick={() => setCalendarMonth(new Date(year, month + 1, 1))} className="p-1.5 hover:bg-gray-100 rounded"><ChevronRight className="w-5 h-5" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />
          const dateISO = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const dayLeaves = getCalendarDayLeaves(leaves, dateISO)
          const isToday = new Date().toISOString().slice(0,10) === dateISO
          return (
            <div key={day} className={`min-h-14 p-1 rounded-lg border text-xs ${isToday ? 'border-primary-400 bg-primary-50' : 'border-gray-100'}`}>
              <div className={`font-medium mb-0.5 ${isToday ? 'text-primary-600' : 'text-gray-700'}`}>{day}</div>
              {dayLeaves.slice(0, 2).map(l => (
                <div key={l.id} onClick={() => onLeaveClick(l)}
                  className={`truncate cursor-pointer rounded px-1 mb-0.5 ${l.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {l.emp_name?.split(' ')[0] || l.emp_code}
                </div>
              ))}
              {dayLeaves.length > 2 && <div className="text-gray-400">+{dayLeaves.length - 2}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Leaves() {
  const [activeTab, setActiveTab] = useState('Leave Requests')
  const [viewMode, setViewMode] = useState('table')

  // Data
  const [leaves, setLeaves] = useState([])
  const [stats, setStats] = useState(null)
  const [statsError, setStatsError] = useState(false)
  const [balances, setBalances] = useState([])
  const [reportSummary, setReportSummary] = useState([])
  const [reportMonthly, setReportMonthly] = useState(Array(12).fill(0))
  const [reportYear, setReportYear] = useState(new Date().getFullYear())
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filters, setFilters] = useState({ status: '', leave_type: '', emp_id: '', from_date: '', to_date: '' })

  // Selection
  const [selectedIds, setSelectedIds] = useState(new Set())

  // Calendar
  const [calendarMonth, setCalendarMonth] = useState(new Date())

  // Modals
  const [actionModal, setActionModal] = useState(null)   // { leave, action, isBulk }
  const [detailModal, setDetailModal] = useState(null)
  const [balanceModal, setBalanceModal] = useState(null)
  const [cancelModal, setCancelModal] = useState(null)
  const [showApply, setShowApply] = useState(false)

  // Sorting (balances)
  const [sortCol, setSortCol] = useState('emp_name')
  const [sortDir, setSortDir] = useState('asc')

  // Apply form
  const [applyForm, setApplyForm] = useState({ emp_id: '', leave_type: 'SL', from_date: '', to_date: '', reason: '' })
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    loadAll()
    employeeApi.getAll({ limit: 200 }).then(r => setEmployees(r.data.employees || [])).catch(() => {})
  }, [])

  useEffect(() => {
    fetchLeaves()
  }, [filters])

  useEffect(() => {
    if (activeTab === 'All Balances' && balances.length === 0) loadBalances()
    if (activeTab === 'Reports') loadReports()
  }, [activeTab, reportYear])

  async function loadAll() {
    await Promise.all([fetchLeaves(), fetchStats()])
  }

  async function fetchLeaves() {
    setLoading(true)
    try {
      const params = {}
      if (filters.status) params.status = filters.status
      if (filters.leave_type) params.leave_type = filters.leave_type
      if (filters.emp_id) params.emp_id = filters.emp_id
      if (filters.from_date) params.from_date = filters.from_date
      if (filters.to_date) params.to_date = filters.to_date
      const r = await leaveApi.getAll(params)
      setLeaves(r.data.leaves || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function fetchStats() {
    try {
      const r = await leaveApi.getStats()
      setStats(r.data)
      setStatsError(false)
    } catch { setStatsError(true) }
  }

  async function loadBalances() {
    try {
      const r = await leaveApi.getBalances()
      setBalances(r.data.balances || [])
    } catch { toast.error('Failed to load balances') }
  }

  async function loadReports() {
    try {
      const [sumR, monR] = await Promise.all([
        leaveApi.getReportSummary(reportYear),
        leaveApi.getReportMonthly(reportYear),
      ])
      setReportSummary(sumR.data.summary || [])
      setReportMonthly(monR.data.monthly || Array(12).fill(0))
    } catch { toast.error('Failed to load reports') }
  }

  function refreshAll() { loadAll(); if (activeTab === 'All Balances') loadBalances() }

  // Selection
  const pendingLeaves = leaves.filter(l => l.status === 'pending')
  function toggleSelect(id) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleSelectAll() {
    setSelectedIds(selectedIds.size === pendingLeaves.length ? new Set() : new Set(pendingLeaves.map(l => l.id)))
  }

  // Actions
  async function handleActionConfirm(comment) {
    const { leave, action, isBulk } = actionModal
    try {
      if (isBulk) {
        const r = await leaveApi.bulkAction({ action, leave_ids: [...selectedIds], comment })
        toast.success(`${r.data.success_count} leave(s) ${action}d`)
        if (r.data.failure_count > 0) toast.error(`${r.data.failure_count} leave(s) failed`)
        setSelectedIds(new Set())
      } else if (action === 'approve') {
        await leaveApi.approve(leave.id, { comment })
        toast.success('Leave approved ✅')
      } else {
        await leaveApi.reject(leave.id, { comment })
        toast.success('Leave rejected')
      }
      setActionModal(null)
      refreshAll()
    } catch (err) {
      return err.response?.data?.detail || 'Action failed'
    }
  }

  async function handleCancel() {
    try {
      await leaveApi.cancel(cancelModal.id)
      toast.success('Leave cancelled')
      setCancelModal(null)
      refreshAll()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to cancel')
    }
  }

  async function handleApply(e) {
    e.preventDefault()
    setApplying(true)
    try {
      await leaveApi.apply(applyForm)
      toast.success('Leave applied! Awaiting approval.')
      setShowApply(false)
      setApplyForm({ emp_id: '', leave_type: 'SL', from_date: '', to_date: '', reason: '' })
      refreshAll()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to apply')
    } finally { setApplying(false) }
  }

  function handleExportCSV() {
    const csv = exportLeavesToCSV(leaves)
    if (!csv) { toast.error('No records to export'); return }
    const today = new Date().toISOString().slice(0, 10)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `leaves_export_${today}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  // Sorted balances
  const sortedBalances = [...balances].sort((a, b) => {
    const av = a[sortCol] ?? '', bv = b[sortCol] ?? ''
    const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
    return sortDir === 'asc' ? cmp : -cmp
  })
  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  // Pie data
  const pieData = (() => {
    const totals = { CL: 0, SL: 0, EL: 0, LWP: 0 }
    reportSummary.forEach(r => { totals.CL += r.cl_used; totals.SL += r.sl_used; totals.EL += r.el_used; totals.LWP += r.lwp_days })
    return Object.entries(totals).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))
  })()

  // Monthly chart data
  const monthlyChartData = MONTHS_SHORT.map((m, i) => ({ month: m, days: reportMonthly[i] || 0 }))

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Leave Management</h1>
          <p className="text-gray-500 text-sm">{leaves.filter(l => l.status === 'pending').length} pending requests</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"><Download className="w-4 h-4" /> Export CSV</button>
          <button onClick={() => setShowApply(true)} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">+ Apply Leave</button>
        </div>
      </div>

      {/* Stats Bar */}
      <StatsBar stats={stats} statsError={statsError} />

      {/* Tabs */}
      <div className="flex border-b mb-5 bg-white rounded-t-xl shadow-sm overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition ${activeTab === tab ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── LEAVE REQUESTS TAB ── */}
      {activeTab === 'Leave Requests' && (
        <div>
          {/* Filter Panel */}
          <div className="bg-white rounded-xl shadow p-4 mb-4">
            <div className="flex flex-wrap gap-3 items-end">
              <select value={filters.status} onChange={e => setFilters(f => ({...f, status: e.target.value}))} className="border rounded-lg px-3 py-2 text-sm outline-none">
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select value={filters.leave_type} onChange={e => setFilters(f => ({...f, leave_type: e.target.value}))} className="border rounded-lg px-3 py-2 text-sm outline-none">
                <option value="">All Types</option>
                <option value="CL">CL</option>
                <option value="SL">SL</option>
                <option value="EL">EL</option>
                <option value="LWP">LWP</option>
              </select>
              <select value={filters.emp_id} onChange={e => setFilters(f => ({...f, emp_id: e.target.value}))} className="border rounded-lg px-3 py-2 text-sm outline-none">
                <option value="">All Employees</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <input type="date" value={filters.from_date} onChange={e => setFilters(f => ({...f, from_date: e.target.value}))} className="border rounded-lg px-3 py-2 text-sm outline-none" placeholder="From" />
              <input type="date" value={filters.to_date} onChange={e => setFilters(f => ({...f, to_date: e.target.value}))} className="border rounded-lg px-3 py-2 text-sm outline-none" placeholder="To" />
              <button onClick={() => setFilters({ status: '', leave_type: '', emp_id: '', from_date: '', to_date: '' })} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border rounded-lg hover:bg-gray-50">Clear</button>
              <span className="text-xs text-gray-400 ml-auto self-center">{leaves.length} records</span>
              {/* View toggle */}
              <div className="flex border rounded-lg overflow-hidden">
                <button onClick={() => setViewMode('table')} className={`px-3 py-2 ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}><List className="w-4 h-4" /></button>
                <button onClick={() => setViewMode('calendar')} className={`px-3 py-2 ${viewMode === 'calendar' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}><Calendar className="w-4 h-4" /></button>
              </div>
            </div>
          </div>

          {/* Bulk action toolbar */}
          {selectedIds.size > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-blue-700">{selectedIds.size} selected</span>
              <button onClick={() => setActionModal({ action: 'approve', isBulk: true })} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Bulk Approve</button>
              <button onClick={() => setActionModal({ action: 'reject', isBulk: true })} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Bulk Reject</button>
              <button onClick={() => setSelectedIds(new Set())} className="ml-auto p-1 text-gray-500 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* Calendar View */}
          {viewMode === 'calendar' && (
            <CalendarView leaves={leaves} calendarMonth={calendarMonth} setCalendarMonth={setCalendarMonth}
              onLeaveClick={l => setDetailModal(l)} />
          )}

          {/* Table View */}
          {viewMode === 'table' && (
            <div className="bg-white rounded-xl shadow overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>
              ) : leaves.length === 0 ? (
                <div className="p-8 text-center text-gray-500"><FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" /><p>No leave requests found</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                      <tr>
                        <th className="px-4 py-3 w-8">
                          <input type="checkbox" checked={selectedIds.size === pendingLeaves.length && pendingLeaves.length > 0} onChange={toggleSelectAll} className="w-4 h-4 accent-blue-600" />
                        </th>
                        <th className="px-4 py-3 text-left">Employee</th>
                        <th className="px-4 py-3 text-left">Type</th>
                        <th className="px-4 py-3 text-left">From</th>
                        <th className="px-4 py-3 text-left">To</th>
                        <th className="px-4 py-3 text-left">Days</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {leaves.map(l => (
                        <tr key={l.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setDetailModal(l)}>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            {l.status === 'pending' && (
                              <input type="checkbox" checked={selectedIds.has(l.id)} onChange={() => toggleSelect(l.id)} className="w-4 h-4 accent-blue-600" />
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-800">{l.emp_name || '—'}</div>
                            <div className="text-xs text-gray-400">{l.emp_code}</div>
                          </td>
                          <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${LEAVE_TYPE_COLORS[l.leave_type] || 'bg-gray-100 text-gray-600'}`}>{l.leave_type}</span></td>
                          <td className="px-4 py-3 text-gray-600">{l.from_date}</td>
                          <td className="px-4 py-3 text-gray-600">{l.to_date}</td>
                          <td className="px-4 py-3 font-semibold text-gray-800">{l.total_days}</td>
                          <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[l.status] || 'bg-gray-100 text-gray-600'}`}>{l.status}</span></td>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            {l.status === 'pending' && (
                              <div className="flex gap-1.5">
                                <button onClick={() => setActionModal({ leave: l, action: 'approve', isBulk: false })} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200" title="Approve"><CheckCircle className="w-4 h-4" /></button>
                                <button onClick={() => setActionModal({ leave: l, action: 'reject', isBulk: false })} className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200" title="Reject"><XCircle className="w-4 h-4" /></button>
                              </div>
                            )}
                            {l.status === 'approved' && (
                              <button onClick={() => setCancelModal(l)} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200">Cancel</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ALL BALANCES TAB ── */}
      {activeTab === 'All Balances' && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="p-4 border-b"><h2 className="font-semibold text-gray-800">Leave Balances — {new Date().getFullYear()}</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  {[['emp_name','Employee'],['emp_code','Code'],['department','Dept'],['cl_available','CL Avail'],['cl_used','CL Used'],['sl_used','SL Used'],['el_used','EL Used'],['lwp_days','LWP'],['late_mark_count','Late Marks']].map(([col, label]) => (
                    <th key={col} className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100 select-none" onClick={() => toggleSort(col)}>
                      {label} {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedBalances.map(b => (
                  <tr key={b.emp_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{b.emp_name}</td>
                    <td className="px-4 py-3 text-gray-500">{b.emp_code}</td>
                    <td className="px-4 py-3 text-gray-500">{b.department || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-blue-700">{b.cl_available}</td>
                    <td className="px-4 py-3">{b.cl_used}</td>
                    <td className="px-4 py-3">{b.sl_used}</td>
                    <td className="px-4 py-3">{b.el_used}</td>
                    <td className="px-4 py-3 text-red-600">{b.lwp_days}</td>
                    <td className="px-4 py-3">{b.late_mark_count}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => setBalanceModal(b)} className="p-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"><Edit2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── REPORTS TAB ── */}
      {activeTab === 'Reports' && (
        <div className="space-y-5">
          {/* Year selector */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Year:</label>
            <select value={reportYear} onChange={e => setReportYear(+e.target.value)} className="border rounded-lg px-3 py-2 text-sm outline-none">
              {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>

          {/* Monthly Bar Chart */}
          <div className="bg-white rounded-xl shadow p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Monthly Leave Days — {reportYear}</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} label={{ value: 'Days', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="days" fill="#3b82f6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart */}
          {pieData.length > 0 && (
            <div className="bg-white rounded-xl shadow p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Leave Type Distribution — {reportYear}</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                    label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                    {pieData.map(d => <Cell key={d.name} fill={PIE_COLORS[d.name] || '#6b7280'} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v} days`, '']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Summary Table */}
          <div className="bg-white rounded-xl shadow p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Employee Leave Summary — {reportYear}</h3>
            {reportSummary.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No approved leaves for {reportYear}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left">Employee</th>
                      <th className="px-4 py-2 text-right">CL Used</th>
                      <th className="px-4 py-2 text-right">SL Used</th>
                      <th className="px-4 py-2 text-right">EL Used</th>
                      <th className="px-4 py-2 text-right">LWP</th>
                      <th className="px-4 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {reportSummary.map(r => (
                      <tr key={r.emp_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2"><div className="font-medium">{r.emp_name}</div><div className="text-xs text-gray-400">{r.emp_code}</div></td>
                        <td className="px-4 py-2 text-right">{r.cl_used}</td>
                        <td className="px-4 py-2 text-right">{r.sl_used}</td>
                        <td className="px-4 py-2 text-right">{r.el_used}</td>
                        <td className="px-4 py-2 text-right text-red-600">{r.lwp_days}</td>
                        <td className="px-4 py-2 text-right font-semibold">{r.total_days}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 font-semibold text-gray-700">
                    <tr>
                      <td className="px-4 py-2">Total</td>
                      <td className="px-4 py-2 text-right">{reportSummary.reduce((s,r) => s+r.cl_used, 0).toFixed(1)}</td>
                      <td className="px-4 py-2 text-right">{reportSummary.reduce((s,r) => s+r.sl_used, 0).toFixed(1)}</td>
                      <td className="px-4 py-2 text-right">{reportSummary.reduce((s,r) => s+r.el_used, 0).toFixed(1)}</td>
                      <td className="px-4 py-2 text-right text-red-600">{reportSummary.reduce((s,r) => s+r.lwp_days, 0).toFixed(1)}</td>
                      <td className="px-4 py-2 text-right">{reportSummary.reduce((s,r) => s+r.total_days, 0).toFixed(1)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODALS ── */}

      {/* Apply Leave Modal */}
      {showApply && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={e => e.target === e.currentTarget && setShowApply(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Apply for Leave</h3>
              <button onClick={() => setShowApply(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleApply} className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={applyForm.emp_id} onChange={e => setApplyForm(f => ({...f, emp_id: e.target.value}))} required>
                  <option value="">Select Employee</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.emp_code})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type *</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={applyForm.leave_type} onChange={e => setApplyForm(f => ({...f, leave_type: e.target.value}))}>
                  <option value="SL">Sick Leave (SL)</option>
                  <option value="CL">Casual Leave (CL) — Confirmed only</option>
                  <option value="EL">Emergency Leave (EL)</option>
                  <option value="LWP">Leave Without Pay (LWP)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From *</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" required value={applyForm.from_date} onChange={e => setApplyForm(f => ({...f, from_date: e.target.value}))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To *</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" required value={applyForm.to_date} onChange={e => setApplyForm(f => ({...f, to_date: e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={3} required value={applyForm.reason} onChange={e => setApplyForm(f => ({...f, reason: e.target.value}))} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowApply(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={applying} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">{applying ? 'Applying...' : 'Apply'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Action Modal (approve/reject with comment) */}
      {actionModal && <ActionModal modal={actionModal} onClose={() => setActionModal(null)} onConfirm={handleActionConfirm} />}

      {/* Detail Modal */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={e => e.target === e.currentTarget && setDetailModal(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Leave Details</h3>
              <button onClick={() => setDetailModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-2 text-sm">
              {[
                ['Employee', `${detailModal.emp_name || '—'} (${detailModal.emp_code || '—'})`],
                ['Leave Type', detailModal.leave_type],
                ['From', detailModal.from_date],
                ['To', detailModal.to_date],
                ['Total Days', detailModal.total_days],
                ['Reason', detailModal.reason],
                ['Status', detailModal.status],
                ['Applied At', detailModal.applied_at?.slice(0,10)],
                ['Approver Comment', detailModal.approver_comment || '—'],
                ['Action Date', detailModal.action_at?.slice(0,10) || '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <span className="text-gray-500 w-36 flex-shrink-0">{k}</span>
                  <span className="text-gray-800 font-medium">{v}</span>
                </div>
              ))}
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              {detailModal.status === 'pending' && (
                <>
                  <button onClick={() => { setActionModal({ leave: detailModal, action: 'approve', isBulk: false }); setDetailModal(null) }} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Approve</button>
                  <button onClick={() => { setActionModal({ leave: detailModal, action: 'reject', isBulk: false }); setDetailModal(null) }} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Reject</button>
                </>
              )}
              {detailModal.status === 'approved' && (
                <button onClick={() => { setCancelModal(detailModal); setDetailModal(null) }} className="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700">Cancel Leave</button>
              )}
              <button onClick={() => setDetailModal(null)} className="px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5">
            <h3 className="font-semibold text-gray-800 mb-2">Cancel Leave?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Cancel <strong>{cancelModal.leave_type}</strong> leave for <strong>{cancelModal.emp_name}</strong> ({cancelModal.from_date} → {cancelModal.to_date})?
              <br /><span className="text-orange-600 text-xs">This will reverse the balance deduction.</span>
            </p>
            <div className="flex gap-3">
              <button onClick={() => setCancelModal(null)} className="flex-1 px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Keep Leave</button>
              <button onClick={handleCancel} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Confirm Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Balance Edit Modal */}
      {balanceModal && <BalanceEditModal balance={balanceModal} onClose={() => setBalanceModal(null)} onSaved={() => { setBalanceModal(null); loadBalances() }} />}
    </div>
  )
}

// ── Action Modal ──────────────────────────────────────────────────────────────
function ActionModal({ modal, onClose, onConfirm }) {
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { leave, action, isBulk } = modal

  async function handleConfirm() {
    setLoading(true)
    setError('')
    const err = await onConfirm(comment)
    if (err) setError(err)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 capitalize">{action} Leave{isBulk ? 's' : ''}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          {!isBulk && leave && (
            <div className="p-3 bg-gray-50 rounded-lg text-sm">
              <p><strong>{leave.emp_name}</strong> · {leave.leave_type}</p>
              <p className="text-gray-500">{leave.from_date} → {leave.to_date} ({leave.total_days} days)</p>
            </div>
          )}
          {isBulk && <p className="text-sm text-gray-600">This will {action} all selected pending leaves.</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comment (optional)</label>
            <textarea className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" rows={3} value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment..." />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>
        <div className="p-4 border-t flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleConfirm} disabled={loading}
            className={`flex-1 px-4 py-2 text-white rounded-lg text-sm disabled:opacity-50 ${action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
            {loading ? 'Processing...' : `Confirm ${action}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Balance Edit Modal ────────────────────────────────────────────────────────
function BalanceEditModal({ balance, onClose, onSaved }) {
  const [clTotal, setClTotal] = useState(balance.cl_total)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (clTotal < balance.cl_used) {
      setError(`CL total cannot be less than CL used (${balance.cl_used} days)`)
      return
    }
    setSaving(true)
    try {
      await leaveApi.updateBalance(balance.emp_id, { cl_total: clTotal })
      toast.success('Balance updated')
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update')
    } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5">
        <h3 className="font-semibold text-gray-800 mb-1">Edit CL Balance</h3>
        <p className="text-sm text-gray-500 mb-4">{balance.emp_name} ({balance.emp_code})</p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CL Total (days)</label>
            <input type="number" min={0} value={clTotal} onChange={e => { setClTotal(+e.target.value); setError('') }}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-400 mt-1">CL Used: {balance.cl_used} days</p>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}
