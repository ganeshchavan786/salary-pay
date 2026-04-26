import { useState, useEffect } from 'react'
import { Calendar, Download, Search, Loader2, Plus, BarChart2, History, Grid, TrendingUp } from 'lucide-react'
import { attendanceApi, attendanceHrApi, employeeApi } from '../services/api'
import { format, subDays } from 'date-fns'
import toast from 'react-hot-toast'
import BulkCalendarModal from './BulkCalendarModal'
import AllEmployeesGrid from './AllEmployeesGrid'
import AttendanceStatsPanel from './AttendanceStatsPanel'
import ExportPanel from './ExportPanel'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const STATUS_OPTIONS = ['present','absent','halfday','leave','holiday','weeklyoff']
const STATUS_COLORS = {
  present: 'bg-green-100 text-green-700',
  absent: 'bg-red-100 text-red-700',
  halfday: 'bg-purple-100 text-purple-700',
  leave: 'bg-orange-100 text-orange-700',
  holiday: 'bg-blue-100 text-blue-700',
  weeklyoff: 'bg-gray-100 text-gray-600',
}
const LATE_COLORS = {
  late: 'bg-yellow-100 text-yellow-700',
  halfLate: 'bg-orange-100 text-orange-700',
  halfDay: 'bg-red-100 text-red-700',
}

function ManualEntryModal({ employees, onClose, onSaved, initialData = null }) {
  // Helper: extract HH:MM from ISO datetime string or return as-is
  function toTimeStr(val) {
    if (!val) return ''
    if (typeof val === 'string' && val.includes('T')) return val.slice(11, 16)
    if (typeof val === 'string' && val.length >= 5) return val.slice(0, 5)
    return ''
  }

  const [form, setForm] = useState({
    emp_id: initialData?.emp_id || employees[0]?.id || '',
    date: initialData?.date || format(new Date(), 'yyyy-MM-dd'),
    check_in: toTimeStr(initialData?.check_in) || '09:30',
    check_out: toTimeStr(initialData?.check_out) || '18:30',
    status: initialData?.status || 'present',
    override_note: initialData?.override_note || '',
  })
  const [saving, setSaving] = useState(false)
  const [conflictData, setConflictData] = useState(null)

  function handleClose() {
    setConflictData(null)
    onClose()
  }

  async function handleSave(conflictMode = null) {
    if (!form.emp_id || !form.date) return
    setSaving(true)
    try {
      const payload = {
        emp_id: form.emp_id,
        date: form.date,
        check_in: form.status !== 'absent' && form.status !== 'holiday' && form.status !== 'weeklyoff' ? form.check_in : null,
        check_out: form.status !== 'absent' && form.status !== 'holiday' && form.status !== 'weeklyoff' ? form.check_out : null,
        status: form.status,
        override_note: form.override_note || 'Manual HR Entry',
      }
      if (conflictMode) {
        payload.conflict_mode = conflictMode
      }
      await attendanceHrApi.manualEntry(payload)
      toast.success('Attendance saved ✅')
      setConflictData(null)
      onSaved()
    } catch (err) {
      if (err.response?.status === 409) {
        const detail = err.response.data?.detail
        const existingRecord = detail?.existing_record ?? err.response.data?.existing_record ?? null
        setConflictData(existingRecord)
      } else {
        toast.error(err.response?.data?.detail || 'Failed to save')
      }
    } finally { setSaving(false) }
  }

  function formatTime(datetimeStr) {
    if (!datetimeStr) return '—'
    // Handle both "HH:MM" and full ISO datetime strings
    if (datetimeStr.includes('T')) return datetimeStr.slice(11, 16)
    return datetimeStr.slice(0, 5)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={e => e.target === e.currentTarget && handleClose()}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">📅 Manual Attendance Entry</h3>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {conflictData ? (
          /* Conflict panel */
          <>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <span className="text-amber-500 text-lg">⚠️</span>
                <div>
                  <p className="font-semibold text-amber-800 text-sm">Attendance Already Exists</p>
                  <p className="text-amber-700 text-xs mt-0.5">A record already exists for this employee on this date.</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Existing Record</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-xs text-gray-500">Date</span>
                    <p className="font-medium text-gray-800">{conflictData.date || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Status</span>
                    <p className="font-medium text-gray-800 capitalize">{conflictData.status || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Check In</span>
                    <p className="font-medium text-gray-800">{formatTime(conflictData.check_in)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Check Out</span>
                    <p className="font-medium text-gray-800">{formatTime(conflictData.check_out)}</p>
                  </div>
                </div>
                {conflictData.override_note && (
                  <div>
                    <span className="text-xs text-gray-500">Note</span>
                    <p className="text-gray-700 text-xs mt-0.5">{conflictData.override_note}</p>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500">Do you want to overwrite this record with your new entry?</p>
            </div>
            <div className="p-4 border-t flex gap-3">
              <button
                onClick={() => setConflictData(null)}
                disabled={saving}
                className="flex-1 px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSave('overwrite')}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 disabled:opacity-50"
              >
                {saving ? 'Saving...' : '⚠ Overwrite'}
              </button>
            </div>
          </>
        ) : (
          /* Normal form */
          <>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Employee *</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.emp_id} onChange={e => setForm(f => ({...f, emp_id: e.target.value}))}>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.emp_code})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status *</label>
                  <select 
                    className="w-full border rounded-lg px-3 py-2 text-sm" 
                    value={form.status} 
                    onChange={e => {
                      const newStatus = e.target.value
                      setForm(f => ({
                        ...f, 
                        status: newStatus,
                        // Auto-adjust check_out time for halfday (4 hours work)
                        check_out: newStatus === 'halfday' ? '13:30' : (f.check_out === '13:30' ? '18:30' : f.check_out)
                      }))
                    }}
                  >
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              {!['absent','holiday','weeklyoff'].includes(form.status) && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Check In</label>
                    <input type="time" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.check_in} onChange={e => setForm(f => ({...f, check_in: e.target.value}))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Check Out</label>
                    <input type="time" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.check_out} onChange={e => setForm(f => ({...f, check_out: e.target.value}))} />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Note</label>
                <input type="text" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.override_note} onChange={e => setForm(f => ({...f, override_note: e.target.value}))} placeholder="Optional note..." />
              </div>
            </div>
            <div className="p-4 border-t flex gap-3">
              <button onClick={handleClose} className="flex-1 px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={() => handleSave()} disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : '✓ Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function AuditModal({ recordId, onClose }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    attendanceHrApi.getAudit(recordId).then(r => setLogs(r.data.logs || [])).catch(() => {}).finally(() => setLoading(false))
  }, [recordId])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">📋 Change History</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-4 max-h-80 overflow-y-auto">
          {loading ? <div className="text-center text-gray-400 py-4">Loading...</div> :
           logs.length === 0 ? <div className="text-center text-gray-400 py-4">No history found</div> :
           logs.map(l => (
            <div key={l.id} className="mb-3 p-3 bg-gray-50 rounded-lg text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-gray-700">{l.action} by {l.changed_by_name}</span>
                <span className="text-xs text-gray-400">{l.created_at?.slice(0,16)}</span>
              </div>
              <div className="text-gray-600">
                {l.old_value && <span className="line-through text-red-500 mr-2">{l.old_value}</span>}
                <span className="text-green-600">→ {l.new_value}</span>
              </div>
              {l.note && <div className="text-xs text-gray-400 mt-1">{l.note}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Attendance() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [search, setSearch] = useState('')
  const [summary, setSummary] = useState(null)
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [selectedRecord, setSelectedRecord] = useState(null)

  // View mode state (replaces hrMode boolean)
  const [viewMode, setViewMode] = useState('raw') // 'raw' | 'hr' | 'all' | 'stats'
  const hrMode = viewMode === 'hr' // backward compatibility for existing code
  const [employees, setEmployees] = useState([])
  const [selEmp, setSelEmp] = useState('')
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [dailyRecords, setDailyRecords] = useState([])
  const [dailySummary, setDailySummary] = useState(null)
  const [showManual, setShowManual] = useState(false)
  const [editRecord, setEditRecord] = useState(null) // holds record data for edit mode
  const [auditRecordId, setAuditRecordId] = useState(null)
  const [showBulkCalendar, setShowBulkCalendar] = useState(false)
  const [showExport, setShowExport] = useState(false)

  useEffect(() => {
    loadAttendance()
    employeeApi.getAll({ limit: 200 }).then(r => {
      const emps = r.data.employees || []
      setEmployees(emps)
      if (emps.length > 0) setSelEmp(emps[0].id)
    }).catch(() => {})
  }, [startDate, endDate])

  useEffect(() => {
    if (viewMode === 'hr' && selEmp) loadDailyAttendance()
  }, [viewMode, selEmp, month, year])

  async function loadAttendance() {
    setLoading(true)
    try {
      const [recordsRes, summaryRes] = await Promise.all([
        attendanceApi.getAll({ start_date: startDate, end_date: endDate, limit: 100 }),
        attendanceApi.getSummary({ start_date: startDate, end_date: endDate })
      ])
      setRecords(recordsRes.data.records || [])
      setSummary(summaryRes.data)
    } catch (error) {
      console.error('Error loading attendance:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadDailyAttendance() {
    if (!selEmp) return
    setLoading(true)
    try {
      const r = await attendanceHrApi.getDaily(selEmp, month, year)
      setDailyRecords(r.data.records || [])
      setDailySummary(r.data.summary || null)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function handleOverride(id, status) {
    try {
      await attendanceHrApi.override(id, status, 'Status changed via dropdown')
      toast.success('Status updated ✅')
      loadDailyAttendance()
    } catch { toast.error('Failed to update') }
  }

  const filteredRecords = records.filter(rec =>
    (rec.emp_name?.toLowerCase().includes(search.toLowerCase()) ||
    rec.emp_code?.toLowerCase().includes(search.toLowerCase()))
  )

  function exportCSV() {
    if (records.length === 0) return

    const headers = ['Date', 'Time', 'Type', 'Employee Code', 'Employee Name', 'Latitude', 'Longitude']
    const rows = records.map(r => [
      r.date,
      r.time,
      r.attendance_type === 'CHECK_OUT' ? 'OUT' : 'IN',
      r.emp_code,
      r.emp_name,
      r.latitude || '',
      r.longitude || ''
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance_${startDate}_${endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function exportMonthlyCSV() {
    try {
      const r = await attendanceHrApi.monthlyReport(month, year)
      const report = r.data.report || []
      const headers = ['Employee Code', 'Name', 'Department', 'Present', 'Absent', 'Half Day', 'Late Mark', 'Half Late']
      const rows = report.map(r => [
        r.employee?.code || '',
        r.employee?.name || '',
        r.employee?.department || '',
        r.present || 0,
        r.absent || 0,
        r.halfday || 0,
        r.late_mark || 0,
        r.half_late_mark || 0,
      ])
      const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `attendance_monthly_${month}_${year}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV exported successfully')
    } catch {
      toast.error('Failed to export CSV')
    }
  }

  return (
    <div>
      {/* Modals */}
      {showManual && employees.length > 0 && (
        <ManualEntryModal
          employees={employees}
          initialData={editRecord}
          onClose={() => { setShowManual(false); setEditRecord(null) }}
          onSaved={() => { setShowManual(false); setEditRecord(null); loadDailyAttendance() }}
        />
      )}
      {auditRecordId && (
        <AuditModal recordId={auditRecordId} onClose={() => setAuditRecordId(null)} />
      )}
      {showBulkCalendar && employees.length > 0 && selEmp && (
        <BulkCalendarModal
          employee={employees.find(e => e.id === selEmp) || employees[0]}
          month={month}
          year={year}
          onClose={() => setShowBulkCalendar(false)}
          onSaved={() => { setShowBulkCalendar(false); loadDailyAttendance() }}
        />
      )}
      {showExport && (
        <ExportPanel
          month={month}
          year={year}
          employees={employees}
          onClose={() => setShowExport(false)}
        />
      )}

      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Attendance Records</h1>
            <p className="text-gray-500 text-sm">View and manage attendance data</p>
          </div>
        </div>

        {/* View mode tabs — scrollable on mobile */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-2 scrollbar-hide">
          <button
            onClick={() => setViewMode('raw')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap flex-shrink-0 ${viewMode === 'raw' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Raw
          </button>
          <button
            onClick={() => setViewMode('hr')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap flex-shrink-0 ${viewMode === 'hr' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            HR Mode
          </button>
          <button
            onClick={() => setViewMode('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap flex-shrink-0 ${viewMode === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            <Grid className="w-3.5 h-3.5" />
            All Employees
          </button>
          <button
            onClick={() => setViewMode('stats')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap flex-shrink-0 ${viewMode === 'stats' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Stats
          </button>
        </div>

        {/* Action buttons — only shown for relevant modes */}
        {viewMode === 'hr' && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            <button onClick={() => setShowBulkCalendar(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0">
              📅 Bulk Attendance
            </button>
            <button onClick={() => setShowManual(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0">
              <Plus className="w-3.5 h-3.5" /> Manual Entry
            </button>
            <button onClick={() => setShowExport(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </div>
        )}
        {viewMode === 'all' && (
          <div className="flex gap-1.5">
            <button onClick={() => setShowExport(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </div>
        )}
        {viewMode === 'raw' && (
          <div className="flex gap-1.5">
            <button onClick={exportCSV} disabled={records.length === 0} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium disabled:opacity-50">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        )}
      </div>

      {/* HR Mode — Monthly Daily View */}
      {viewMode === 'hr' && (
        <>
          {/* HR Controls */}
          <div className="bg-white rounded-xl shadow p-4 mb-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Employee</label>
              <select className="border rounded-lg px-3 py-2 text-sm w-52" value={selEmp} onChange={e => setSelEmp(e.target.value)}>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.emp_code})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Month</label>
              <select className="border rounded-lg px-3 py-2 text-sm" value={month} onChange={e => setMonth(+e.target.value)}>
                {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Year</label>
              <select className="border rounded-lg px-3 py-2 text-sm" value={year} onChange={e => setYear(+e.target.value)}>
                {[2024,2025,2026].map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Daily Summary */}
          {dailySummary && (
            <div className="grid grid-cols-5 gap-3 mb-4">
              {[
                { label: 'Present', value: dailySummary.present, color: 'border-green-400' },
                { label: 'Absent', value: dailySummary.absent, color: 'border-red-400' },
                { label: 'Half Day', value: dailySummary.halfday, color: 'border-purple-400' },
                { label: 'Late Mark', value: dailySummary.late_mark, color: 'border-yellow-400' },
                { label: 'Half Late', value: dailySummary.half_late_mark, color: 'border-orange-400' },
              ].map((s, i) => (
                <div key={i} className={`bg-white rounded-xl shadow p-3 border-t-4 ${s.color}`}>
                  <div className="text-xs text-gray-500">{s.label}</div>
                  <div className="text-xl font-bold text-gray-800">{s.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Daily Records Table */}
          <div className="bg-white rounded-xl shadow mb-6">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-800">
                📅 {MONTHS[month-1]} {year} — {employees.find(e => e.id === selEmp)?.name || ''}
              </h2>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-32"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
            ) : dailyRecords.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <p>No records for {MONTHS[month-1]} {year}</p>
                <button onClick={() => setShowManual(true)} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">+ Manual Entry</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Day</th>
                      <th className="px-4 py-3 text-left">Check In</th>
                      <th className="px-4 py-3 text-left">Check Out</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Late Mark</th>
                      <th className="px-4 py-3 text-left">Override</th>
                      <th className="px-4 py-3 text-left">History</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {dailyRecords.map(r => {
                      const d = new Date(r.date)
                      const dayName = d.toLocaleDateString('en-IN', { weekday: 'short' })
                      const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                      return (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5">
                            <strong>{dateStr}</strong>
                            {r.is_overridden && (
                              <button
                                onClick={() => {
                                  setEditRecord({
                                    emp_id: selEmp,
                                    date: r.date,
                                    check_in: r.check_in,
                                    check_out: r.check_out,
                                    status: r.status,
                                    override_note: r.override_note || '',
                                  })
                                  setShowManual(true)
                                }}
                                className="ml-1 text-orange-500 text-xs hover:text-orange-700"
                                title="Edit this record"
                              >✏️</button>
                            )}
                            {!r.is_overridden && (
                              <button
                                onClick={() => {
                                  setEditRecord({
                                    emp_id: selEmp,
                                    date: r.date,
                                    check_in: r.check_in,
                                    check_out: r.check_out,
                                    status: r.status,
                                    override_note: r.override_note || '',
                                  })
                                  setShowManual(true)
                                }}
                                className="ml-1 text-gray-300 text-xs hover:text-blue-500"
                                title="Edit this record"
                              >✏️</button>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-gray-400 text-xs">{dayName}</td>
                          <td className="px-4 py-2.5 text-gray-600">{r.check_in ? r.check_in.slice(11,16) : '—'}</td>
                          <td className="px-4 py-2.5 text-gray-600">{r.check_out ? r.check_out.slice(11,16) : '—'}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            {r.late_mark_type && r.late_mark_type !== 'none' ? (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${LATE_COLORS[r.late_mark_type] || 'bg-gray-100 text-gray-600'}`}>
                                {r.late_mark_type}
                              </span>
                            ) : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            <select
                              className="border rounded px-2 py-1 text-xs"
                              value={r.status}
                              onChange={e => handleOverride(r.id, e.target.value)}
                            >
                              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td className="px-4 py-2.5">
                            <button
                              onClick={() => setAuditRecordId(r.id)}
                              className="p-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                              title="View History"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* All Employees Grid View */}
      {viewMode === 'all' && (
        <AllEmployeesGrid
          month={month}
          year={year}
          onNavigateToEmployee={(empId) => {
            setSelEmp(empId)
            setViewMode('hr')
          }}
        />
      )}

      {/* Stats View */}
      {viewMode === 'stats' && (
        <AttendanceStatsPanel
          month={month}
          year={year}
          onMonthChange={setMonth}
          onYearChange={setYear}
        />
      )}

      {/* Raw Attendance Mode */}
      {viewMode === 'raw' && (
        <>
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-gray-500 text-sm">Total Employees</p>
            <p className="text-2xl font-bold text-gray-800">{summary.total_employees}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-gray-500 text-sm">Employees Present</p>
            <p className="text-2xl font-bold text-green-600">{summary.employees_present}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-gray-500 text-sm">Total Records</p>
            <p className="text-2xl font-bold text-blue-600">{summary.total_attendance_records}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow mb-4">
        <div className="p-3">
          {/* Quick filter buttons */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-hide">
            {[
              { label: 'Today', fn: () => { const t = format(new Date(), 'yyyy-MM-dd'); setStartDate(t); setEndDate(t) } },
              { label: 'Yesterday', fn: () => { const y = format(subDays(new Date(), 1), 'yyyy-MM-dd'); setStartDate(y); setEndDate(y) } },
              { label: 'This Week', fn: () => { setStartDate(format(subDays(new Date(), 6), 'yyyy-MM-dd')); setEndDate(format(new Date(), 'yyyy-MM-dd')) } },
              { label: 'This Month', fn: () => { const n = new Date(); setStartDate(format(new Date(n.getFullYear(), n.getMonth(), 1), 'yyyy-MM-dd')); setEndDate(format(new Date(), 'yyyy-MM-dd')) } },
              { label: 'Last Month', fn: () => { const n = new Date(); const f = new Date(n.getFullYear(), n.getMonth()-1, 1); const l = new Date(n.getFullYear(), n.getMonth(), 0); setStartDate(format(f, 'yyyy-MM-dd')); setEndDate(format(l, 'yyyy-MM-dd')) } },
            ].map(q => (
              <button key={q.label} onClick={q.fn}
                className="px-3 py-1 bg-gray-100 hover:bg-blue-100 hover:text-blue-700 text-gray-600 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition">
                {q.label}
              </button>
            ))}
          </div>
          {/* Date range + Search */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400" />
              <span className="text-gray-400 text-xs flex-shrink-0">to</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or code..."
                className="w-full pl-9 pr-4 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Photo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                      No attendance records found for selected date range
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-800">{rec.date}</td>
                      <td className="px-4 py-3 text-gray-600">{rec.time}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          rec.attendance_type === 'CHECK_OUT' 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {rec.attendance_type === 'CHECK_OUT' ? '🔴 OUT' : '🟢 IN'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{rec.emp_name}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{rec.emp_code}</td>
                      <td className="px-4 py-3 text-gray-500 text-sm">
                        {rec.latitude && rec.longitude ? (
                          <a
                            href={`https://maps.google.com/?q=${rec.latitude},${rec.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:underline"
                          >
                            {rec.latitude.toFixed(4)}, {rec.longitude.toFixed(4)}
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {rec.photo ? (
                          <img
                            src={rec.photo}
                            alt="attendance"
                            className="w-8 h-8 rounded object-cover cursor-pointer hover:opacity-80 transition"
                            onClick={() => { setSelectedPhoto(rec.photo); setSelectedRecord(rec) }}
                          />
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Photo Preview Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="bg-white rounded-xl p-4 max-w-sm w-full mx-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <div>
                <p className="font-semibold text-gray-800">{selectedRecord?.emp_name}</p>
                <p className="text-sm text-gray-500">{selectedRecord?.date} · {selectedRecord?.time}</p>
              </div>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <img
              src={selectedPhoto}
              alt="Attendance photo"
              className="w-full rounded-lg object-cover"
            />
          </div>
        </div>
      )}
        </>
      )}
    </div>
  )
}
