import { useState, useEffect } from 'react'
import { DollarSign, Download, Loader2, ChevronDown, ChevronUp, Briefcase, TrendingUp, TrendingDown, Eye, Calendar } from 'lucide-react'
import { payrollApi } from '../services/api'
import toast from 'react-hot-toast'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-600',
  calculated: 'bg-blue-100 text-blue-700',
  processed: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  paid: 'bg-green-100 text-green-700',
}

const STATUS_LABELS = {
  draft: 'Draft',
  calculated: 'Processed',
  processed: 'Processed',
  approved: 'Approved',
  paid: 'Paid',
}

function Row({ label, value, color = 'text-gray-800' }) {
  if (!value || value === 0) return null
  return (
    <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-semibold ${color}`}>
        {color.includes('red') ? '-' : ''}₹{Math.abs(value).toLocaleString('en-IN')}
      </span>
    </div>
  )
}

export default function MySalary() {
  const [payrolls, setPayrolls] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    payrollApi.getMy()
      .then(r => {
        fetch('/api/debug/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'MySalary_getMy', data: r.data })
        }).catch(() => {})
        setPayrolls(r.data.payrolls || [])
      })
      .catch((err) => {
        fetch('/api/debug/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'MySalary_Error', msg: String(err), status: err?.response?.status, detail: err?.response?.data })
        }).catch(() => {})
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleDownload(id, month, year) {
    setDownloading(id)
    try {
      const r = await payrollApi.downloadSlip(id)
      const blob = new Blob([r.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      
      // For mobile, sometimes we need to open in a new tab if download fails
      // We'll try to download first
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `salary-slip-${MONTHS[month-1]}-${year}.pdf`
      
      // Some mobile browsers need the element in the DOM
      document.body.appendChild(a)
      a.click()
      
      // Wait a bit before cleanup
      setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }, 2000)
      
      toast.success('Download started')
    } catch (err) { 
      console.error('Download error:', err)
      toast.error('Failed to download slip') 
    }
    finally { setDownloading(null) }
  }

  async function handleView(id) {
    setDownloading(id + '_view')
    try {
      const r = await payrollApi.downloadSlip(id)
      const blob = new Blob([r.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      // Note: we can't easily revokeObjectURL here because the new window needs it
    } catch (err) { 
      toast.error('Failed to open slip') 
    }
    finally { setDownloading(null) }
  }

  function toggleExpand(id) {
    setExpandedId(expandedId === id ? null : id)
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
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">My Salary</h1>
            <p className="text-gray-400 text-xs">Payroll history and salary slips</p>
          </div>
        </div>
      </div>

      {payrolls.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <DollarSign className="w-8 h-8 text-gray-300" />
          </div>
          <p className="font-semibold text-gray-600 mb-1">No payroll records yet</p>
          <p className="text-sm text-gray-400">Your salary slips will appear here once processed</p>
        </div>
      ) : (
        <div className="space-y-4">
          {payrolls.map(p => {
            const isExpanded = expandedId === p.id
            const monthName = MONTHS[(p.month || 1) - 1]
            const statusLabel = STATUS_LABELS[p.status] || p.status
            const statusColor = STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-600'

            return (
              <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Card Header */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                        {monthName}
                      </div>
                      <div>
                        <div className="font-bold text-gray-800 text-base">
                          {monthName} {p.year}
                        </div>
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleView(p.id)}
                        disabled={downloading === p.id + '_view'}
                        className="flex items-center justify-center p-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-colors shadow-sm"
                        title="View PDF"
                      >
                        {downloading === p.id + '_view' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleDownload(p.id, p.month, p.year)}
                        disabled={downloading === p.id}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                      >
                        {downloading === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        Slip
                      </button>
                    </div>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 text-center">
                      <TrendingUp className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                      <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Gross</div>
                      <div className="text-sm font-bold text-gray-800 mt-0.5">₹{(p.gross_salary||0).toLocaleString('en-IN')}</div>
                    </div>
                    <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-3 text-center">
                      <TrendingDown className="w-4 h-4 text-red-400 mx-auto mb-1" />
                      <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Deductions</div>
                      <div className="text-sm font-bold text-red-600 mt-0.5">₹{(p.total_deductions||0).toLocaleString('en-IN')}</div>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-3 text-center">
                      <DollarSign className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                      <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Net Pay</div>
                      <div className="text-sm font-bold text-emerald-700 mt-0.5">₹{(p.net_pay||0).toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                </div>

                {/* View Details Button */}
                <button
                  onClick={() => toggleExpand(p.id)}
                  className="w-full flex items-center justify-center gap-2 py-3 border-t border-gray-100 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  {isExpanded ? 'Hide Details' : 'View Details'}
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    {/* Attendance Summary */}
                    {(p.working_days > 0) && (
                      <div className="mt-4">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" /> Attendance
                        </h3>
                        <div className="grid grid-cols-4 gap-2">
                          <div className="bg-gray-50 rounded-lg p-2 text-center">
                            <div className="text-[10px] text-gray-400">Working</div>
                            <div className="text-sm font-bold text-gray-700">{p.working_days}</div>
                          </div>
                          <div className="bg-green-50 rounded-lg p-2 text-center">
                            <div className="text-[10px] text-gray-400">Present</div>
                            <div className="text-sm font-bold text-green-700">{p.present_days}</div>
                          </div>
                          <div className="bg-red-50 rounded-lg p-2 text-center">
                            <div className="text-[10px] text-gray-400">Absent</div>
                            <div className="text-sm font-bold text-red-600">{p.absent_days}</div>
                          </div>
                          <div className="bg-blue-50 rounded-lg p-2 text-center">
                            <div className="text-[10px] text-gray-400">Leave</div>
                            <div className="text-sm font-bold text-blue-600">{p.leave_days}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Earnings Section */}
                    <div className="mt-4">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">💰 Earnings</h3>
                      <div className="space-y-1.5">
                        <Row label="Basic Salary" value={p.basic_salary} />
                        <Row label="HRA" value={p.hra} />
                        <Row label="Special Allowance" value={p.special_allowance} />
                        <Row label="Travel Allowance" value={p.travel_allowance} />
                        <Row label="Medical Allowance" value={p.medical_allowance} />
                        <Row label="Overtime" value={p.overtime_amount} />
                        <Row label="Arrears" value={p.arrears_amount} />
                        <div className="flex justify-between items-center py-2 px-3 bg-blue-50 rounded-lg border border-blue-100">
                          <span className="text-sm font-semibold text-blue-700">Total Gross</span>
                          <span className="text-sm font-bold text-blue-700">₹{(p.gross_salary||0).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Deductions Section */}
                    <div className="mt-4">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">📉 Deductions</h3>
                      <div className="space-y-1.5">
                        <Row label="PF (Employee)" value={p.pf_employee} color="text-red-600" />
                        <Row label="ESI (Employee)" value={p.esi_employee} color="text-red-600" />
                        <Row label="Professional Tax" value={p.professional_tax} color="text-red-600" />
                        <Row label="Income Tax (TDS)" value={p.income_tax} color="text-red-600" />
                        <Row label="Loan Recovery" value={p.loan_deductions} color="text-red-600" />
                        <Row label="Loss of Pay (LOP)" value={p.lop_deduction} color="text-red-600" />
                        <Row label="Other Deductions" value={p.other_deductions} color="text-red-600" />
                        <div className="flex justify-between items-center py-2 px-3 bg-red-50 rounded-lg border border-red-100">
                          <span className="text-sm font-semibold text-red-700">Total Deductions</span>
                          <span className="text-sm font-bold text-red-700">-₹{(p.total_deductions||0).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Net Pay */}
                    <div className="mt-4 bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl p-4 text-center">
                      <div className="text-emerald-100 text-xs font-semibold uppercase tracking-wider">Net Salary</div>
                      <div className="text-white text-2xl font-bold mt-1">₹{(p.net_pay||0).toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
