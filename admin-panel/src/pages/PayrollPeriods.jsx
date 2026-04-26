import { useState, useEffect } from 'react'
import { Calendar, Lock, Play, CheckCircle, Plus, ChevronRight } from 'lucide-react'
import { api } from '../services/api'
import toast from 'react-hot-toast'

const STATE_COLORS = {
  DRAFT: 'bg-gray-100 text-gray-600',
  OPEN: 'bg-blue-100 text-blue-700',
  PROCESSING: 'bg-yellow-100 text-yellow-700',
  PROCESSED: 'bg-green-100 text-green-700',
  LOCKED: 'bg-red-100 text-red-700',
}

const NEXT_STATE = {
  DRAFT: 'OPEN',
  OPEN: 'PROCESSING',
  PROCESSING: 'PROCESSED',
  PROCESSED: 'LOCKED',
}

export default function PayrollPeriods() {
  const [periods, setPeriods] = useState([])
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    period_name: '', period_type: 'MONTHLY',
    start_date: '', end_date: ''
  })

  useEffect(() => { fetchPeriods() }, [])

  async function fetchPeriods() {
    setLoading(true)
    try {
      const r = await api.get('/v1/payroll-periods/')
      setPeriods(r.data || [])
    } catch { toast.error('Failed to load periods') }
    finally { setLoading(false) }
  }

  async function createPeriod() {
    try {
      await api.post('/v1/payroll-periods/', form)
      toast.success('Period created!')
      setShowCreate(false)
      setForm({ period_name: '', period_type: 'MONTHLY', start_date: '', end_date: '' })
      fetchPeriods()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create period')
    }
  }

  async function transitionState(id, newState) {
    try {
      await api.patch(`/v1/payroll-periods/${id}/state`, { new_state: newState })
      toast.success(`Period moved to ${newState}`)
      fetchPeriods()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Transition failed')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Payroll Periods</h1>
          <p className="text-gray-500 text-sm mt-1">Manage payroll period lifecycle</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> New Period
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="space-y-3">
          {periods.map(p => (
            <div key={p.id} className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">{p.period_name}</h3>
                  <p className="text-sm text-gray-500">
                    {new Date(p.start_date).toLocaleDateString()} – {new Date(p.end_date).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {p.processed_employees ?? 0}/{p.total_employees ?? 0} employees processed · {p.period_type}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATE_COLORS[p.state] || 'bg-gray-100'}`}>
                  {p.state}
                </span>
                {NEXT_STATE[p.state] && (
                  <button
                    onClick={() => transitionState(p.id, NEXT_STATE[p.state])}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {NEXT_STATE[p.state] === 'LOCKED'
                      ? <><Lock className="w-4 h-4" /> Lock</>
                      : <><ChevronRight className="w-4 h-4" /> {NEXT_STATE[p.state]}</>
                    }
                  </button>
                )}
              </div>
            </div>
          ))}
          {periods.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No payroll periods yet</p>
              <p className="text-sm mt-1">Click "New Period" to get started</p>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-4 text-gray-800">Create Payroll Period</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Period Name</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. April 2026"
                  value={form.period_name}
                  onChange={e => setForm({ ...form, period_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Period Type</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.period_type}
                  onChange={e => setForm({ ...form, period_type: e.target.value })}
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.start_date}
                  onChange={e => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">End Date</label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.end_date}
                  onChange={e => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={createPeriod}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                Create
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 border py-2 rounded-lg hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
