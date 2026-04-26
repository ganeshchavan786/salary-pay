import { useState, useEffect } from 'react'
import { Plus, PauseCircle, PlayCircle, AlertCircle } from 'lucide-react'
import { api } from '../services/api'
import toast from 'react-hot-toast'

const TYPE_COLORS = {
  LOAN: 'bg-blue-100 text-blue-700',
  ADVANCE: 'bg-purple-100 text-purple-700',
  FINE: 'bg-red-100 text-red-700',
  CUSTOM: 'bg-gray-100 text-gray-600',
}

const STATUS_COLORS = {
  ACTIVE: 'bg-green-100 text-green-700',
  PAUSED: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-gray-100 text-gray-500',
}

const DEFAULT_FORM = {
  deduction_type: 'LOAN',
  total_amount: '',
  emi_amount: '',
  description: '',
}

export default function DeductionManagement() {
  const [employees, setEmployees] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [deductions, setDeductions] = useState([])
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [installmentCounts, setInstallmentCounts] = useState({})

  useEffect(() => { fetchEmployees() }, [])
  useEffect(() => { if (selectedEmployee) fetchDeductions() }, [selectedEmployee])

  async function fetchEmployees() {
    try {
      const r = await api.get('/employees?limit=200')
      setEmployees(r.data?.employees || r.data || [])
    } catch { toast.error('Failed to load employees') }
  }

  async function fetchDeductions() {
    setLoading(true)
    try {
      const r = await api.get(`/v1/deductions/employee/${selectedEmployee}`)
      setDeductions(r.data || [])
      // Fetch installment counts
      try {
        const ir = await api.get(`/v1/deductions/employee/${selectedEmployee}/installments`)
        const counts = {}
        for (const inst of (ir.data || [])) {
          counts[inst.deduction_id] = (counts[inst.deduction_id] || 0) + 1
        }
        setInstallmentCounts(counts)
      } catch {
        setInstallmentCounts({})
      }
    } catch { toast.error('Failed to load deductions') }
    finally { setLoading(false) }
  }

  async function addDeduction() {
    if (!selectedEmployee) return toast.error('Select an employee first')
    setSaving(true)
    try {
      await api.post('/v1/deductions/', {
        ...form,
        employee_id: selectedEmployee,
        total_amount: parseFloat(form.total_amount) || 0,
        emi_amount: parseFloat(form.emi_amount) || 0,
      })
      toast.success('Deduction added!')
      setShowAdd(false)
      setForm(DEFAULT_FORM)
      fetchDeductions()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add deduction')
    } finally { setSaving(false) }
  }

  async function toggleStatus(id, currentStatus) {
    try {
      if (currentStatus === 'ACTIVE') {
        await api.patch(`/v1/deductions/${id}/pause`)
        toast.success('Deduction paused')
      } else {
        await api.patch(`/v1/deductions/${id}/resume`)
        toast.success('Deduction resumed')
      }
      fetchDeductions()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update status')
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Deduction Management</h1>
        <p className="text-gray-500 text-sm mt-1">Manage loans, advances, fines and custom deductions</p>
      </div>

      {/* Employee Selector */}
      <div className="bg-white rounded-xl shadow p-4 mb-6 flex items-end gap-4">
        <div className="flex-1 max-w-sm">
          <label className="block text-xs text-gray-500 mb-1">Select Employee</label>
          <select
            className="border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedEmployee}
            onChange={e => setSelectedEmployee(e.target.value)}
          >
            <option value="">— Choose an employee —</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>
                {e.name || e.full_name} ({e.emp_code || e.employee_code})
              </option>
            ))}
          </select>
        </div>
        {selectedEmployee && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add Deduction
          </button>
        )}
      </div>

      {/* Deductions List */}
      {selectedEmployee && (
        <div className="bg-white rounded-xl shadow">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-800">Active Deductions</h2>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : deductions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No deductions for this employee</p>
            </div>
          ) : (
            <div className="divide-y">
              {deductions.map(d => (
                <div key={d.id} className="p-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[d.deduction_type] || 'bg-gray-100'}`}>
                        {d.deduction_type}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[d.status] || 'bg-gray-100'}`}>
                        {d.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{d.description || '—'}</p>
                    <div className="flex gap-4 mt-1 text-xs text-gray-500">
                      <span>Total: ₹{(d.total_amount || 0).toLocaleString('en-IN')}</span>
                      <span>EMI: ₹{(d.emi_amount || 0).toLocaleString('en-IN')}</span>
                      <span>Remaining: ₹{(d.remaining ?? d.total_amount ?? 0).toLocaleString('en-IN')}</span>
                    </div>
                    {(d.deduction_type === 'LOAN' || d.deduction_type === 'ADVANCE') && (
                      <div className="mt-2">
                        {(() => {
                          const total = parseFloat(d.total_amount) || 0
                          const recovered = parseFloat(d.recovered) || 0
                          const emi = parseFloat(d.emi_amount) || 1
                          const pct = total > 0 ? Math.min(100, (recovered / total) * 100) : 0
                          const installmentsApplied = installmentCounts[d.id] || 0
                          const totalInstallments = emi > 0 ? Math.ceil(total / emi) : 0
                          return (
                            <>
                              <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                                <div
                                  className="bg-blue-500 h-2 rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <p className="text-xs text-gray-500">
                                ₹{recovered.toLocaleString('en-IN')} of ₹{total.toLocaleString('en-IN')} recovered — {installmentsApplied} of {totalInstallments} installments
                              </p>
                            </>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                  {d.status !== 'COMPLETED' && (
                    <button
                      onClick={() => toggleStatus(d.id, d.status)}
                      className={`flex items-center gap-1 text-sm font-medium ${
                        d.status === 'ACTIVE'
                          ? 'text-yellow-600 hover:text-yellow-800'
                          : 'text-green-600 hover:text-green-800'
                      }`}
                    >
                      {d.status === 'ACTIVE'
                        ? <><PauseCircle className="w-4 h-4" /> Pause</>
                        : <><PlayCircle className="w-4 h-4" /> Resume</>
                      }
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Deduction Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-4 text-gray-800">Add Deduction</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Deduction Type</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.deduction_type}
                  onChange={e => setForm({ ...form, deduction_type: e.target.value })}
                >
                  <option value="LOAN">Loan</option>
                  <option value="ADVANCE">Advance</option>
                  <option value="FINE">Fine</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Total Amount (₹)</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                  value={form.total_amount}
                  onChange={e => setForm({ ...form, total_amount: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Monthly EMI Amount (₹)</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                  value={form.emi_amount}
                  onChange={e => setForm({ ...form, emi_amount: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Reason or notes..."
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={addDeduction}
                disabled={saving}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
              >
                {saving ? 'Saving...' : 'Add Deduction'}
              </button>
              <button
                onClick={() => setShowAdd(false)}
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
