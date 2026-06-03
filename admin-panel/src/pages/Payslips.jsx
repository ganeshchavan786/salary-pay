import { useState, useEffect } from 'react'
import { Download, Eye, FileText, Printer } from 'lucide-react'
import { api } from '../services/api'
import toast from 'react-hot-toast'

export default function Payslips() {
  const [periods, setPeriods] = useState([])
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [payslips, setPayslips] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedPayslip, setSelectedPayslip] = useState(null)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => { fetchPeriods() }, [])
  useEffect(() => { if (selectedPeriod) fetchPayslips() }, [selectedPeriod])

  async function fetchPeriods() {
    try {
      const r = await api.get('/v1/payroll-periods/')
      const list = r.data || []
      setPeriods(list)
      if (list.length > 0) setSelectedPeriod(list[0].id)
    } catch (err) {
      console.error('Failed to load periods:', err)
      toast.error('Failed to load periods')
    }
  }

  async function fetchPayslips() {
    setLoading(true)
    try {
      const r = await api.post(`/v1/payslips/bulk-generate/${selectedPeriod}`)
      setPayslips(r.data?.payslips || [])
    } catch (err) {
      console.error('Failed to load payslips:', err)
      if (err.response?.status === 404) {
        setPayslips([])
        toast.error('No approved salaries found for this period')
      } else {
        toast.error('Failed to load payslips')
      }
    } finally {
      setLoading(false)
    }
  }

  /**
   * PDF Generation Note:
   * This frontend-based PDF generation (jsPDF) is now DEPRECATED.
   * We have migrated to Backend-based PDF generation for better aesthetics and consistency.
   * 
   * [LEGACY CODE - FOR REFERENCE ONLY]
   * function generatePDF(payslip) {
   *   const doc = new jsPDF()
   *   doc.text('SALARY SLIP', 105, 18, { align: 'center' })
   *   // ... (rest of old logic was here)
   * }
   */
  async function handleDownload(payslip) {
    const calcId = payslip.id // Note: bulk-generate returns calculation objects
    try {
      toast.loading('Generating PDF...', { id: 'pdf' })
      const r = await api.get(`/v1/payslips/admin/${calcId}/slip-download`, { responseType: 'blob' })
      const blob = new Blob([r.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `salary-slip-${payslip.employee?.emp_code || 'EMP'}.pdf`
      document.body.appendChild(a)
      a.click()
      
      setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }, 2000)
      
      toast.success('Downloaded successfully', { id: 'pdf' })
    } catch (err) {
      toast.error('Failed to generate PDF', { id: 'pdf' })
    }
  }

  async function handleViewBackendPDF(payslip) {
    const calcId = payslip.id
    try {
      toast.loading('Opening PDF...', { id: 'view-pdf' })
      const r = await api.get(`/v1/payslips/admin/${calcId}/slip-download`, { responseType: 'blob' })
      const blob = new Blob([r.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      toast.dismiss('view-pdf')
    } catch (err) {
      toast.error('Failed to open PDF', { id: 'view-pdf' })
    }
  }

  function viewPayslip(payslip) {
    setSelectedPayslip(payslip)
    setShowPreview(true)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Payslips</h1>
        <p className="text-gray-500 text-sm mt-1">View and download employee payslips</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <div className="flex items-center gap-4">
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
        </div>
      </div>

      {/* Payslips Table */}
      <div className="bg-white rounded-xl shadow">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-800">
            Payslips — {payslips.length} employees
          </h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : payslips.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No payslips available for this period</p>
            <p className="text-sm mt-1">Approve salaries first to generate payslips</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-right">Gross Salary</th>
                  <th className="px-4 py-3 text-right">Deductions</th>
                  <th className="px-4 py-3 text-right">Net Salary</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payslips.map((p, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{p.employee.name}</div>
                      <div className="text-xs text-gray-400">{p.employee.emp_code}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      ₹{p.gross_salary.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600">
                      ₹{p.total_deductions.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-green-700">
                      ₹{p.net_salary.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => viewPayslip(p)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleViewBackendPDF(p)}
                          className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"
                          title="View Backend PDF"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownload(p)}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && selectedPayslip && (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-65 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto border border-slate-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 text-white relative">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold tracking-tight">Salary Slip</h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-slate-400 hover:text-white text-3xl leading-none transition-colors"
                >
                  &times;
                </button>
              </div>
              <p className="text-teal-400 font-semibold text-sm">SalaryPay HR Solutions</p>
              <p className="text-slate-300 text-xs mt-1">Payroll Period: {selectedPayslip.period_name || 'N/A'}</p>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-teal-500"></div>
            </div>

            <div className="p-6">
              {/* Employee Info Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Employee Information</h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Employee Name</span>
                    <span className="font-bold text-slate-800 text-sm">{selectedPayslip.employee.name}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Employee Code</span>
                    <span className="font-bold text-slate-800 text-sm">{selectedPayslip.employee.emp_code}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Department</span>
                    <span className="font-medium text-slate-700 text-sm">{selectedPayslip.employee.department || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Designation</span>
                    <span className="font-medium text-slate-700 text-sm">{selectedPayslip.employee.designation || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Earnings & Deductions Tables */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Earnings Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center">
                    <h5 className="font-bold text-xs text-slate-700 uppercase tracking-wider">EARNINGS</h5>
                    <span className="text-[10px] text-slate-400 font-medium">Description & Amount</span>
                  </div>
                  <div className="p-4 space-y-3 min-h-[160px]">
                    {selectedPayslip.earnings.length === 0 ? (
                      <p className="text-slate-400 text-xs italic text-center py-8">No earnings items</p>
                    ) : (
                      selectedPayslip.earnings.map((e, i) => (
                        <div key={i} className="flex justify-between items-center text-sm pb-2 border-b border-slate-100 last:border-0 last:pb-0">
                          <span className="text-slate-600 font-medium">{e.label}</span>
                          <span className="font-bold text-slate-800">
                            ₹{e.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Deductions Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center">
                    <h5 className="font-bold text-xs text-slate-700 uppercase tracking-wider">DEDUCTIONS</h5>
                    <span className="text-[10px] text-slate-400 font-medium">Description & Amount</span>
                  </div>
                  <div className="p-4 space-y-3 min-h-[160px]">
                    {selectedPayslip.deductions.length === 0 ? (
                      <p className="text-slate-400 text-xs italic text-center py-8">No deduction items</p>
                    ) : (
                      selectedPayslip.deductions.map((d, i) => (
                        <div key={i} className="flex justify-between items-center text-sm pb-2 border-b border-slate-100 last:border-0 last:pb-0">
                          <span className="text-slate-600 font-medium">{d.label}</span>
                          <span className="font-bold text-rose-600">
                            ₹{d.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Summary Banner */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-md">
                <div className="bg-slate-50 p-4 border-b border-slate-200 grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-slate-500 font-medium block">Gross Earnings</span>
                    <span className="text-lg font-bold text-slate-800">
                      ₹{selectedPayslip.gross_salary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="text-right border-l border-slate-200 pl-4">
                    <span className="text-xs text-slate-500 font-medium block">Total Deductions</span>
                    <span className="text-lg font-bold text-rose-600">
                      ₹{selectedPayslip.total_deductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-teal-600 to-teal-700 p-5 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                  <div>
                    <span className="text-xs text-teal-200 font-medium uppercase tracking-wider block">Net Take Home (Net Pay)</span>
                    <span className="text-xs text-teal-100 italic mt-0.5 block">
                      Rupees {selectedPayslip.net_pay_words || 'Zero Only'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl md:text-3xl font-extrabold tracking-tight">
                      ₹{selectedPayslip.net_salary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => handleDownload(selectedPayslip)}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold shadow-md transition hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
                >
                  <Download className="w-5 h-5" /> Download PDF Payslip
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-6 py-3 bg-slate-100 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition focus:outline-none focus:ring-2 focus:ring-slate-300"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
