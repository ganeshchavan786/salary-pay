import { useState, useEffect } from 'react'
import { RefreshCw, Search, AlertCircle, Zap, DollarSign, Users, TrendingUp } from 'lucide-react'
import { salaryCalculationApi } from '../services/api'
import toast from 'react-hot-toast'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const STATUS_COLORS = {
  LIVE: 'bg-amber-100 text-amber-700 border-amber-200',
  NO_CONFIG: 'bg-red-100 text-red-700 border-red-200',
  ERROR: 'bg-red-100 text-red-700 border-red-200'
}

export default function RealTimeSalaryTracker() {
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [previews, setPreviews] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchLivePreviews()
  }, [selectedMonth, selectedYear])

  async function fetchLivePreviews() {
    setLoading(true)
    try {
      const r = await salaryCalculationApi.getLivePreview({
        month: selectedMonth,
        year: selectedYear
      })
      setPreviews(r.data || [])
    } catch (err) {
      console.error('Failed to fetch live previews:', err)
      toast.error('Failed to load real-time salary updates')
    } finally {
      setLoading(false)
    }
  }

  // Filter previews based on search query
  const filteredPreviews = previews.filter(p => 
    p.emp_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.emp_code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Calculations for Summary Cards
  const activeCalculations = previews.filter(p => p.status === 'LIVE')
  const totalAccrued = activeCalculations.reduce((s, p) => s + p.net_salary, 0)
  const averageAccrued = activeCalculations.length > 0 ? totalAccrued / activeCalculations.length : 0
  const activeCount = previews.length

  return (
    <div>
      {/* Title */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-500 fill-amber-500 animate-pulse" />
            Real-time Salary Tracker
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            View accrued and projected salaries for the current month in real time.
          </p>
        </div>
        <button
          onClick={fetchLivePreviews}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm font-medium transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Month</label>
              <select
                className="border rounded-lg px-3 py-2 text-sm min-w-[150px] focus:outline-none focus:ring-2 focus:ring-amber-500"
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
              >
                {MONTHS.map((m, idx) => (
                  <option key={m} value={idx + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Year</label>
              <select
                className="border rounded-lg px-3 py-2 text-sm min-w-[120px] focus:outline-none focus:ring-2 focus:ring-amber-500"
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
              >
                {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative min-w-[280px]">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="w-4 h-4 text-gray-400" />
            </span>
            <input
              type="text"
              className="w-full border pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Search by name or code..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow p-5 border-l-4 border-amber-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Total Accrued Cost</span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-500"><DollarSign className="w-5 h-5" /></span>
          </div>
          <div className="text-2xl font-bold text-gray-800">
            ₹{totalAccrued.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-amber-600 font-medium mt-1">Accumulated company payroll cost so far</p>
        </div>

        <div className="bg-white rounded-xl shadow p-5 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Average Net Accrued</span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-500"><TrendingUp className="w-5 h-5" /></span>
          </div>
          <div className="text-2xl font-bold text-gray-800">
            ₹{averageAccrued.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-blue-600 font-medium mt-1">Average pay per active employee till date</p>
        </div>

        <div className="bg-white rounded-xl shadow p-5 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Active Employees</span>
            <span className="p-1.5 rounded-lg bg-green-50 text-green-500"><Users className="w-5 h-5" /></span>
          </div>
          <div className="text-2xl font-bold text-gray-800">
            {activeCount}
          </div>
          <p className="text-xs text-green-600 font-medium mt-1">Total headcount processed for preview</p>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl shadow">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-800">Real-time Payroll Preview</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
          </div>
        ) : filteredPreviews.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-gray-600">No employee records found</p>
            <p className="text-sm mt-1">Ensure you have active employees matching your search criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-5 py-3.5 text-left">Employee</th>
                  <th className="px-5 py-3.5 text-center">Accrued Attendance</th>
                  <th className="px-5 py-3.5 text-right">Gross Salary</th>
                  <th className="px-5 py-3.5 text-right">LOP Deductions</th>
                  <th className="px-5 py-3.5 text-right">Statutory Deductions</th>
                  <th className="px-5 py-3.5 text-right">Accrued Net Pay</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPreviews.map(p => {
                  const gross = p.gross_salary || 0
                  const net = p.net_salary || 0
                  const lop = p.lop_deduction || 0
                  const totalDeductions = p.total_deductions || 0
                  const statutory = Math.max(0, totalDeductions - lop)
                  const presents = p.present_days || 0
                  const working = p.working_days || 0
                  
                  return (
                    <tr key={p.employee_id} className="hover:bg-gray-50 transition">
                      <td className="px-5 py-4">
                        <div className="font-medium text-gray-900">{p.emp_name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{p.emp_code}</div>
                      </td>
                      <td className="px-5 py-4 text-center font-medium text-gray-700">
                        {p.status === 'NO_CONFIG' ? (
                          <span className="text-gray-400">—</span>
                        ) : (
                          <span>
                            {presents} <span className="text-gray-400 font-normal font-sans">/ {p.total_days} days</span>
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right text-gray-700 font-medium">
                        ₹{gross.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-4 text-right text-red-500">
                        {p.status === 'NO_CONFIG' ? '—' : `₹${lop.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
                      </td>
                      <td className="px-5 py-4 text-right text-red-500">
                        {p.status === 'NO_CONFIG' ? '—' : `₹${statutory.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-green-700 text-base">
                        ₹{net.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {p.status === 'LIVE' ? 'LIVE' : p.status === 'NO_CONFIG' ? 'NO CONFIG' : 'ERROR'}
                        </span>
                        {p.status === 'NO_CONFIG' && (
                          <div className="text-[10px] text-red-500 mt-1">Configure payhead first</div>
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
