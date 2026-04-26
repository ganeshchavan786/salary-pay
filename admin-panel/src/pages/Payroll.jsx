import { useState, useEffect } from 'react'
import { DollarSign, Download, CheckCircle, Play, AlertCircle } from 'lucide-react'
import { payrollApi } from '../services/api'
import toast from 'react-hot-toast'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-600',
  processed: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
}

export default function Payroll() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [payrolls, setPayrolls] = useState([])
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState(null)

  useEffect(() => {
    fetchPayrolls()
  }, [month, year])

  async function fetchPayrolls() {
    setLoading(true)
    try {
      const r = await payrollApi.getAll({ month, year })
      setPayrolls(r.data.payrolls || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function handleRunPayroll() {
    if (!confirm(`Run payroll for ${MONTHS[month-1]} ${year}? This will process all active employees.`)) return
    setRunning(true)
    setRunResult(null)
    try {
      const r = await payrollApi.run(month, year)
      setRunResult(r.data)
      toast.success('Payroll run complete ✅')
      fetchPayrolls()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to run payroll')
    } finally { setRunning(false) }
  }

  async function handleMarkPaid(id) {
    try {
      await payrollApi.markPaid(id)
      toast.success('Marked as paid ✅')
      fetchPayrolls()
    } catch { toast.error('Failed to mark as paid') }
  }

  async function handleDownloadSlip(id, empCode) {
    try {
      const r = await payrollApi.downloadSlip(id)
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `salary-slip-${empCode}-${MONTHS[month-1]}-${year}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Failed to download slip') }
  }

  const totalGross = payrolls.reduce((s, p) => s + (p.gross_salary || 0), 0)
  const totalNet = payrolls.reduce((s, p) => s + (p.net_pay || 0), 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Payroll</h1>
        <p className="text-gray-500">Manage monthly salary processing</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Month</label>
            <select className="border rounded-lg px-3 py-2 text-sm" value={month} onChange={e => setMonth(+e.target.value)}>
              {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Year</label>
            <select className="border rounded-lg px-3 py-2 text-sm" value={year} onChange={e => setYear(+e.target.value)}>
              {[2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
          <div className="ml-auto">
            <button
              onClick={handleRunPayroll}
              disabled={running}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
            >
              <Play className="w-4 h-4" />
              {running ? 'Processing...' : `Run Payroll — ${MONTHS[month-1]} ${year}`}
            </button>
          </div>
        </div>

        {/* Run Result */}
        {runResult && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            <div className="font-medium text-blue-800 mb-1">✅ Payroll Run Complete</div>
            <div className="text-blue-700">
              Processed: <strong>{runResult.processed}</strong> &nbsp;|&nbsp;
              Errors: <strong className={runResult.errors > 0 ? 'text-red-600' : ''}>{runResult.errors}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {payrolls.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow p-4">
            <div className="text-xs text-gray-500 mb-1">Total Employees</div>
            <div className="text-2xl font-bold text-gray-800">{payrolls.length}</div>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <div className="text-xs text-gray-500 mb-1">Total Gross</div>
            <div className="text-2xl font-bold text-blue-700">₹{totalGross.toLocaleString('en-IN')}</div>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <div className="text-xs text-gray-500 mb-1">Total Net Pay</div>
            <div className="text-2xl font-bold text-green-700">₹{totalNet.toLocaleString('en-IN')}</div>
          </div>
        </div>
      )}

      {/* Payroll Table */}
      <div className="bg-white rounded-xl shadow">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-800">
            📊 {MONTHS[month-1]} {year} — {payrolls.length} records
          </h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : payrolls.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No payroll records for {MONTHS[month-1]} {year}</p>
            <p className="text-sm mt-1">Click "Run Payroll" to process salaries</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-right">Gross</th>
                  <th className="px-4 py-3 text-right">Basic</th>
                  <th className="px-4 py-3 text-right">HRA</th>
                  <th className="px-4 py-3 text-right">Deductions</th>
                  <th className="px-4 py-3 text-right">Net Pay</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payrolls.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{p.emp_name || '—'}</div>
                      <div className="text-xs text-gray-400">{p.emp_code} · {p.designation || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">₹{(p.gross_salary||0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-right text-gray-600">₹{(p.basic_salary||0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-right text-gray-600">₹{(p.hra||0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-right text-red-600">₹{(p.total_deductions||0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-right font-bold text-green-700">₹{(p.net_pay||0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-600'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleDownloadSlip(p.id, p.emp_code)}
                          className="p-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          title="Download Slip"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {p.status !== 'paid' && (
                          <button
                            onClick={() => handleMarkPaid(p.id)}
                            className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200"
                            title="Mark as Paid"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
