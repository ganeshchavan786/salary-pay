import { useState, useEffect } from 'react'
import { DollarSign, Download, Loader2, Eye } from 'lucide-react'
import { payrollApi } from '../services/api'
import toast from 'react-hot-toast'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-600',
  processed: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
}

export default function MySalary() {
  const [payrolls, setPayrolls] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(null)

  useEffect(() => {
    payrollApi.getMy()
      .then(r => setPayrolls(r.data.payrolls || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleDownload(id, month, year) {
    setDownloading(id)
    try {
      const r = await payrollApi.downloadSlip(id)
      const blob = new Blob([r.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `salary-slip-${MONTHS[month-1]}-${year}.pdf`
      document.body.appendChild(a)
      a.click()
      
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
    } catch (err) { 
      toast.error('Failed to open slip') 
    }
    finally { setDownloading(null) }
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
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800">💰 My Salary</h1>
        <p className="text-gray-500 text-sm">Payroll history and salary slips</p>
      </div>

      {payrolls.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">
          <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No payroll records yet</p>
          <p className="text-sm mt-1">Your salary slips will appear here once processed</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payrolls.map(p => (
            <div key={p.id} className="bg-white rounded-xl shadow p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold text-gray-800">
                    {MONTHS[(p.month || 1) - 1]} {p.year}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-600'}`}>
                    {p.status}
                  </span>
                </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleView(p.id)}
                      disabled={downloading === p.id + '_view'}
                      className="flex items-center justify-center p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                      title="View PDF"
                    >
                      {downloading === p.id + '_view' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleDownload(p.id, p.month, p.year)}
                      disabled={downloading === p.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 disabled:opacity-50"
                    >
                      {downloading === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      Slip
                    </button>
                  </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-xs text-gray-400">Gross</div>
                  <div className="text-sm font-semibold text-gray-700">₹{(p.gross_salary||0).toLocaleString('en-IN')}</div>
                </div>
                <div className="bg-red-50 rounded-lg p-2">
                  <div className="text-xs text-gray-400">Deductions</div>
                  <div className="text-sm font-semibold text-red-600">₹{(p.total_deductions||0).toLocaleString('en-IN')}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-2">
                  <div className="text-xs text-gray-400">Net Pay</div>
                  <div className="text-sm font-bold text-green-700">₹{(p.net_pay||0).toLocaleString('en-IN')}</div>
                </div>
              </div>

              {/* Breakdown */}
              <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-1 text-xs text-gray-500">
                <span>Basic: ₹{(p.basic_salary||0).toLocaleString('en-IN')}</span>
                <span>HRA: ₹{(p.hra||0).toLocaleString('en-IN')}</span>
                <span>Travel: ₹{(p.travel_allowance||0).toLocaleString('en-IN')}</span>
                <span>PT: ₹{(p.pt_deduction||200).toLocaleString('en-IN')}</span>
                {p.lop_deduction > 0 && <span className="text-red-500">LOP: -₹{p.lop_deduction.toLocaleString('en-IN')}</span>}
                {p.late_mark_deduction > 0 && <span className="text-red-500">Late: -₹{p.late_mark_deduction.toLocaleString('en-IN')}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
