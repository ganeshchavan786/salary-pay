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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Salary Slip</h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-white hover:text-gray-200 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
              <p className="text-blue-100 text-sm">Face Recognition Attendance System</p>
              <p className="text-blue-200 text-xs mt-1">Period: {selectedPayslip.period_name || 'N/A'}</p>
            </div>

            <div className="p-6">
              {/* Employee Info Card */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Employee Name</p>
                    <p className="font-bold text-gray-800">{selectedPayslip.employee.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Employee Code</p>
                    <p className="font-bold text-gray-800">{selectedPayslip.employee.emp_code}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Department</p>
                    <p className="font-medium text-gray-700">{selectedPayslip.employee.department || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Designation</p>
                    <p className="font-medium text-gray-700">{selectedPayslip.employee.designation || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Earnings & Deductions */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* Earnings */}
                <div className="border border-blue-200 rounded-lg overflow-hidden">
                  <div className="bg-blue-50 px-4 py-2 border-b border-blue-200">
                    <h5 className="font-bold text-sm text-blue-700">EARNINGS</h5>
                  </div>
                  <div className="p-4 space-y-2">
                    {selectedPayslip.earnings.map((e, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-600">{e.label}</span>
                        <span className="font-semibold text-gray-800">
                          ₹{e.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Deductions */}
                <div className="border border-red-200 rounded-lg overflow-hidden">
                  <div className="bg-red-50 px-4 py-2 border-b border-red-200">
                    <h5 className="font-bold text-sm text-red-700">DEDUCTIONS</h5>
                  </div>
                  <div className="p-4 space-y-2">
                    {selectedPayslip.deductions.map((d, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-600">{d.label}</span>
                        <span className="font-semibold text-gray-800">
                          ₹{d.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Summary Card */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-5 border border-gray-200">
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-300">
                    <span className="font-semibold text-gray-700">Gross Salary</span>
                    <span className="font-bold text-lg text-gray-800">
                      ₹{selectedPayslip.gross_salary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-gray-300">
                    <span className="font-semibold text-gray-700">Total Deductions</span>
                    <span className="font-bold text-lg text-red-600">
                      - ₹{selectedPayslip.total_deductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="font-bold text-lg text-gray-800">Net Salary</span>
                    <span className="font-bold text-2xl text-green-600">
                      ₹{selectedPayslip.net_salary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => handleDownload(selectedPayslip)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
                >
                  <Download className="w-5 h-5" /> Download PDF
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
