import { useState, useEffect } from 'react'
import { Play, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { api } from '../services/api'
import toast from 'react-hot-toast'

const STATUS_COLORS = {
  PENDING: 'bg-gray-100 text-gray-600',
  CALCULATED: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

// AttendanceWarning component - displays warning icon when no attendance records
function AttendanceWarning({ presentDays }) {
  if (presentDays === 0) {
    return (
      <span 
        className="text-amber-600 ml-2 inline-block" 
        title="No attendance records for this period"
      >
        ⚠
      </span>
    )
  }
  return null
}

export default function SalaryCalculation() {
  const [periods, setPeriods] = useState([])
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [calculations, setCalculations] = useState([])
  const [loading, setLoading] = useState(false)
  const [calculating, setCalculating] = useState(false)

  useEffect(() => { fetchPeriods() }, [])
  useEffect(() => { if (selectedPeriod) fetchCalculations() }, [selectedPeriod])

  async function fetchPeriods() {
    try {
      const r = await api.get('/v1/payroll-periods/')
      const list = r.data || []
      setPeriods(list)
      if (list.length > 0) setSelectedPeriod(list[0].id)
    } catch (err) {
      console.error('Failed to load periods:', err)
      if (err.response?.status === 401) {
        toast.error('Session expired. Please log in again.')
      } else {
        toast.error('Failed to load periods')
      }
    }
  }

  async function fetchCalculations() {
    setLoading(true)
    try {
      const r = await api.get(`/v1/payroll/period/${selectedPeriod}`)
      setCalculations(r.data || [])
    } catch (err) {
      console.error('Failed to load calculations:', err)
      if (err.response?.status === 401) {
        toast.error('Session expired. Please log in again.')
      } else if (err.response?.status === 422) {
        toast.error(err.response?.data?.detail || 'Invalid request')
      } else {
        toast.error('Failed to load calculations')
      }
    } finally {
      setLoading(false)
    }
  }

  async function calculateAll() {
    if (!selectedPeriod) return toast.error('Select a period first')
    if (!confirm('Run salary calculation for all employees in this period?')) return
    setCalculating(true)
    try {
      // Send empty object as body (required by backend)
      const r = await api.post(`/v1/payroll/calculate/${selectedPeriod}`, {})
      const processed = r.data?.total_processed ?? 0
      const errors = r.data?.total_errors ?? 0
      if (errors > 0) {
        toast.success(`Calculation complete — ${processed} processed, ${errors} errors`)
      } else {
        toast.success(`Calculation complete — ${processed} processed`)
      }
      fetchCalculations()
    } catch (err) {
      console.error('Calculation failed:', err)
      
      // Extract error message safely
      let errorMessage = 'Calculation failed'
      
      if (err.response?.status === 401) {
        errorMessage = 'Session expired. Please log in again.'
      } else if (err.response?.status === 422) {
        // Handle Pydantic validation errors
        const detail = err.response?.data?.detail
        if (Array.isArray(detail)) {
          // Pydantic validation error array
          const firstError = detail[0]
          if (firstError && typeof firstError === 'object') {
            const loc = firstError.loc ? firstError.loc.join(' → ') : ''
            const msg = firstError.msg || 'Validation error'
            errorMessage = loc ? `${loc}: ${msg}` : msg
          } else {
            errorMessage = 'Invalid request data'
          }
        } else if (typeof detail === 'string') {
          errorMessage = detail
        } else if (detail && typeof detail === 'object') {
          // Single validation error object
          const loc = detail.loc ? detail.loc.join(' → ') : ''
          const msg = detail.msg || 'Validation error'
          errorMessage = loc ? `${loc}: ${msg}` : msg
        } else {
          errorMessage = 'Invalid request'
        }
      } else if (err.response?.data?.detail) {
        errorMessage = typeof err.response.data.detail === 'string' 
          ? err.response.data.detail 
          : 'Calculation failed'
      }
      
      toast.error(errorMessage)
    } finally {
      setCalculating(false)
    }
  }

  async function approveCalculation(calcId) {
    try {
      // Send empty object as body (required by backend)
      await api.patch(`/v1/payroll/calculation/${calcId}/approve`, {})
      toast.success('Approved!')
      fetchCalculations()
    } catch (err) {
      console.error('Approval failed:', err)
      
      // Extract error message safely
      let errorMessage = 'Approval failed'
      
      if (err.response?.status === 401) {
        errorMessage = 'Session expired. Please log in again.'
      } else if (err.response?.status === 422) {
        // Handle Pydantic validation errors
        const detail = err.response?.data?.detail
        if (Array.isArray(detail)) {
          const firstError = detail[0]
          if (firstError && typeof firstError === 'object') {
            const loc = firstError.loc ? firstError.loc.join(' → ') : ''
            const msg = firstError.msg || 'Validation error'
            errorMessage = loc ? `${loc}: ${msg}` : msg
          } else {
            errorMessage = 'Invalid request data'
          }
        } else if (typeof detail === 'string') {
          errorMessage = detail
        } else if (detail && typeof detail === 'object') {
          const loc = detail.loc ? detail.loc.join(' → ') : ''
          const msg = detail.msg || 'Validation error'
          errorMessage = loc ? `${loc}: ${msg}` : msg
        }
      } else if (err.response?.data?.detail) {
        errorMessage = typeof err.response.data.detail === 'string' 
          ? err.response.data.detail 
          : 'Approval failed'
      }
      
      toast.error(errorMessage)
    }
  }

  // Safe calculation with null checks and default values
  const totalGross = calculations.reduce((s, c) => s + (Number(c?.gross_salary) || 0), 0)
  const totalNet = calculations.reduce((s, c) => s + (Number(c?.net_salary || c?.net_pay) || 0), 0)
  const totalDeductions = calculations.reduce((s, c) => s + (Number(c?.total_deductions) || 0), 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Salary Calculation</h1>
        <p className="text-gray-500 text-sm mt-1">Trigger and review salary calculations per period</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Payroll Period</label>
            <select
              className="border rounded-lg px-3 py-2 text-sm min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedPeriod}
              onChange={e => setSelectedPeriod(e.target.value)}
            >
              {periods.map(p => (
                <option key={p.id} value={p.id}>{p.period_name}</option>
              ))}
            </select>
          </div>
          <div className="ml-auto flex gap-2">
            <button
              onClick={fetchCalculations}
              className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button
              onClick={calculateAll}
              disabled={calculating || !selectedPeriod}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
            >
              <Play className="w-4 h-4" />
              {calculating ? 'Calculating...' : 'Calculate All'}
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {calculations.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow p-4">
            <div className="text-xs text-gray-500 mb-1">Total Gross</div>
            <div className="text-2xl font-bold text-blue-700">
              ₹{(totalGross || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <div className="text-xs text-gray-500 mb-1">Total Deductions</div>
            <div className="text-2xl font-bold text-red-600">
              ₹{(totalDeductions || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <div className="text-xs text-gray-500 mb-1">Total Net Pay</div>
            <div className="text-2xl font-bold text-green-700">
              ₹{(totalNet || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      )}

      {/* Results Table */}
      <div className="bg-white rounded-xl shadow">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-800">
            Calculation Results — {calculations.length} employees
          </h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : calculations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No calculations yet for this period</p>
            <p className="text-sm mt-1">Click "Calculate All" to process salaries</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-right">Present Days</th>
                  <th className="px-4 py-3 text-right">Absent Days</th>
                  <th className="px-4 py-3 text-right">Leave Days</th>
                  <th className="px-4 py-3 text-right">OT Hours</th>
                  <th className="px-4 py-3 text-right">Gross</th>
                  <th className="px-4 py-3 text-right">Deductions</th>
                  <th className="px-4 py-3 text-right">Net Pay</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {calculations.map(c => {
                  const presentDays = c?.present_days ?? 0
                  const absentDays = c?.absent_days ?? 0
                  const leaveDays = c?.leave_days ?? 0
                  const overtimeHours = c?.overtime_hours ?? 0
                  const grossSalary = Number(c?.gross_salary) || 0
                  const totalDeductions = Number(c?.total_deductions) || 0
                  const netSalary = Number(c?.net_salary || c?.net_pay) || 0
                  
                  return (
                    <tr key={c?.id || Math.random()} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <div>
                            <div className="font-medium text-gray-800">{c?.emp_name || c?.employee_name || '—'}</div>
                            <div className="text-xs text-gray-400">{c?.emp_code || c?.employee_code || '—'}</div>
                          </div>
                          <AttendanceWarning presentDays={presentDays} />
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${presentDays === 0 ? 'text-orange-600' : 'text-green-600'}`}>
                        {presentDays}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {absentDays}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {leaveDays}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {Number(overtimeHours).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        ₹{grossSalary.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600">
                        ₹{totalDeductions.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green-700">
                        ₹{netSalary.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c?.status] || 'bg-gray-100 text-gray-600'}`}>
                          {c?.status || 'CALCULATED'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c?.status !== 'APPROVED' && (
                          <button
                            onClick={() => approveCalculation(c?.id)}
                            className="flex items-center gap-1 mx-auto text-xs text-green-600 hover:text-green-800 font-medium"
                          >
                            <CheckCircle className="w-4 h-4" /> Approve
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
