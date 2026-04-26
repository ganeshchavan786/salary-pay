import { useState, useEffect } from 'react'
import { FileText, Plus, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { leaveApi } from '../services/api'
import { useTranslation } from 'react-i18next'

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
  cancelled: 'bg-gray-100 text-gray-500',
}

export default function MyLeaves() {
  const { t } = useTranslation()
  const [balance, setBalance] = useState(null)
  const [leaves, setLeaves] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [applying, setApplying] = useState(false)
  const [form, setForm] = useState({ leave_type: 'SL', from_date: '', to_date: '', reason: '' })
  const [message, setMessage] = useState(null)

  // Get current user's emp_id from localStorage
  const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} } })()
  const empId = user?.emp_id || user?.employee_id

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [leavesRes] = await Promise.allSettled([leaveApi.getMyLeaves()])
      if (leavesRes.status === 'fulfilled') setLeaves(leavesRes.value.data.leaves || [])
      if (empId) {
        const balRes = await leaveApi.getMyBalance(empId).catch(() => null)
        if (balRes) setBalance(balRes.data)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function handleApply(e) {
    e.preventDefault()
    setApplying(true)
    setMessage(null)
    try {
      await leaveApi.applyLeave({ ...form, emp_id: empId })
      setMessage({ type: 'success', text: 'Leave applied! Awaiting approval.' })
      setShowForm(false)
      setForm({ leave_type: 'SL', from_date: '', to_date: '', reason: '' })
      loadData()
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to apply leave' })
    } finally { setApplying(false) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">🏖️ My Leaves</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
        >
          {showForm ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          Apply
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* Apply Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow mb-6 p-4">
          <h2 className="font-semibold text-gray-800 mb-3">Apply for Leave</h2>
          <form onSubmit={handleApply} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Leave Type</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.leave_type} onChange={e => setForm(f => ({...f, leave_type: e.target.value}))}>
                <option value="SL">Sick Leave (SL)</option>
                <option value="CL">Casual Leave (CL)</option>
                <option value="EL">Emergency Leave (EL)</option>
                <option value="LWP">Leave Without Pay (LWP)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
                <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" required value={form.from_date} onChange={e => setForm(f => ({...f, from_date: e.target.value}))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
                <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" required value={form.to_date} onChange={e => setForm(f => ({...f, to_date: e.target.value}))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Reason</label>
              <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} required value={form.reason} onChange={e => setForm(f => ({...f, reason: e.target.value}))} placeholder="Reason for leave..." />
            </div>
            <button type="submit" disabled={applying} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {applying ? 'Applying...' : 'Submit Leave Request'}
            </button>
          </form>
        </div>
      )}

      {/* Leave Balance */}
      {balance && (
        <div className="bg-white rounded-xl shadow mb-6">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-800">Leave Balance</h2>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            {[
              { label: 'CL Available', value: `${Math.max(0, (balance.cl_total||0) - (balance.cl_used||0))} / ${balance.cl_total||0}`, color: 'border-blue-400 text-blue-700' },
              { label: 'SL Used', value: balance.sl_used || 0, color: 'border-green-400 text-green-700' },
              { label: 'EL Used', value: balance.el_used || 0, color: 'border-purple-400 text-purple-700' },
              { label: 'LWP Days', value: balance.lwp_days || 0, color: 'border-red-400 text-red-700' },
            ].map((card, i) => (
              <div key={i} className={`rounded-xl p-3 text-center border-t-4 bg-gray-50 ${card.color.split(' ')[0]}`}>
                <div className="text-xs text-gray-500 mb-1">{card.label}</div>
                <div className={`text-xl font-bold ${card.color.split(' ')[1]}`}>{card.value}</div>
              </div>
            ))}
          </div>
          {balance.late_mark_count > 0 && (
            <div className="mx-4 mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
              ⚠️ Late Marks: {balance.late_mark_count} | Half Late: {balance.half_late_mark_count} | Half Days from Late: {balance.half_day_from_late}
            </div>
          )}
        </div>
      )}

      {/* Leave History */}
      <div className="bg-white rounded-xl shadow">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-800">Leave History</h2>
        </div>
        {leaves.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No leave requests yet</p>
          </div>
        ) : (
          <div className="divide-y">
            {leaves.map(l => (
              <div key={l.id} className="p-4">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${LEAVE_TYPE_COLORS[l.leave_type] || 'bg-gray-100 text-gray-600'}`}>
                      {l.leave_type}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[l.status] || 'bg-gray-100 text-gray-600'}`}>
                      {l.status}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{l.total_days} day{l.total_days !== 1 ? 's' : ''}</span>
                </div>
                <div className="text-sm text-gray-600">{l.from_date} → {l.to_date}</div>
                <div className="text-xs text-gray-400 mt-1 truncate">{l.reason}</div>
                {l.approver_comment && (
                  <div className="text-xs text-gray-500 mt-1 italic">💬 {l.approver_comment}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
