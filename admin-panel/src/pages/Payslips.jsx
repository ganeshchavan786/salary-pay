import { useState, useEffect } from 'react'
import { Download, Eye, FileText, Printer } from 'lucide-react'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

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

  function generatePDF(payslip) {
    const doc = new jsPDF()
    
    // ═══════════════════════════════════════════════════════════
    // HEADER - Blue gradient background
    // ═══════════════════════════════════════════════════════════
    doc.setFillColor(37, 99, 235) // blue-600
    doc.rect(0, 0, 210, 45, 'F')
    
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text('SALARY SLIP', 105, 18, { align: 'center' })
    
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text('Face Recognition Attendance System', 105, 27, { align: 'center' })
    
    doc.setFontSize(10)
    doc.setTextColor(191, 219, 254) // blue-200
    doc.text(`Period: ${payslip.period_name || 'N/A'}`, 105, 35, { align: 'center' })
    
    // ═══════════════════════════════════════════════════════════
    // EMPLOYEE INFO CARD
    // ═══════════════════════════════════════════════════════════
    const cardY = 55
    
    // Card background
    doc.setFillColor(249, 250, 251) // gray-50
    doc.roundedRect(15, cardY, 180, 28, 2, 2, 'F')
    
    // Card border
    doc.setDrawColor(229, 231, 235) // gray-200
    doc.setLineWidth(0.3)
    doc.roundedRect(15, cardY, 180, 28, 2, 2, 'S')
    
    doc.setTextColor(107, 114, 128) // gray-500
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    
    // Left column labels
    doc.text('Employee Name', 20, cardY + 6)
    doc.text('Employee Code', 20, cardY + 16)
    
    // Left column values
    doc.setTextColor(31, 41, 55) // gray-800
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(payslip.employee.name || 'N/A', 20, cardY + 11)
    doc.text(payslip.employee.emp_code || 'N/A', 20, cardY + 21)
    
    // Right column labels
    doc.setTextColor(107, 114, 128)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('Department', 110, cardY + 6)
    doc.text('Designation', 110, cardY + 16)
    
    // Right column values
    doc.setTextColor(31, 41, 55)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(payslip.employee.department || 'N/A', 110, cardY + 11)
    doc.text(payslip.employee.designation || 'N/A', 110, cardY + 21)
    
    // ═══════════════════════════════════════════════════════════
    // EARNINGS & DEDUCTIONS TABLES
    // ═══════════════════════════════════════════════════════════
    const tablesY = cardY + 38
    
    // Earnings Table (Left)
    const earningsData = payslip.earnings.map(e => [
      e.label,
      `₹ ${e.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ])
    
    autoTable(doc, {
      startY: tablesY,
      head: [['EARNINGS', 'AMOUNT']],
      body: earningsData,
      theme: 'plain',
      headStyles: {
        fillColor: [219, 234, 254], // blue-100
        textColor: [30, 64, 175], // blue-800
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'left',
        cellPadding: 3
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [31, 41, 55],
        cellPadding: 2.5
      },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'normal' },
        1: { cellWidth: 35, halign: 'right', fontStyle: 'bold', textColor: [31, 41, 55] }
      },
      margin: { left: 15, right: 105 },
      tableWidth: 90,
      tableLineColor: [229, 231, 235],
      tableLineWidth: 0.3,
    })
    
    // Deductions Table (Right)
    const deductionsData = payslip.deductions.map(d => [
      d.label,
      `₹ ${d.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ])
    
    autoTable(doc, {
      startY: tablesY,
      head: [['DEDUCTIONS', 'AMOUNT']],
      body: deductionsData,
      theme: 'plain',
      headStyles: {
        fillColor: [254, 226, 226], // red-100
        textColor: [153, 27, 27], // red-900
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'left',
        cellPadding: 3
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [31, 41, 55],
        cellPadding: 2.5
      },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'normal' },
        1: { cellWidth: 35, halign: 'right', fontStyle: 'bold', textColor: [31, 41, 55] }
      },
      margin: { left: 105, right: 15 },
      tableWidth: 90,
      tableLineColor: [229, 231, 235],
      tableLineWidth: 0.3,
    })
    
    // ═══════════════════════════════════════════════════════════
    // SUMMARY SECTION
    // ═══════════════════════════════════════════════════════════
    const summaryY = Math.max(
      doc.lastAutoTable.finalY || tablesY + 80,
      tablesY + 80
    ) + 12
    
    // Summary card background with gradient effect
    doc.setFillColor(249, 250, 251) // gray-50
    doc.roundedRect(15, summaryY, 180, 42, 2, 2, 'F')
    
    // Summary card border
    doc.setDrawColor(209, 213, 219) // gray-300
    doc.setLineWidth(0.5)
    doc.roundedRect(15, summaryY, 180, 42, 2, 2, 'S')
    
    // Gross Salary
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(75, 85, 99) // gray-600
    doc.text('Gross Salary', 20, summaryY + 8)
    
    doc.setFontSize(12)
    doc.setTextColor(31, 41, 55) // gray-800
    doc.text(`₹ ${payslip.gross_salary.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 190, summaryY + 8, { align: 'right' })
    
    // Total Deductions
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(75, 85, 99)
    doc.text('Total Deductions', 20, summaryY + 18)
    
    doc.setFontSize(12)
    doc.setTextColor(220, 38, 38) // red-600
    doc.text(`- ₹ ${payslip.total_deductions.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 190, summaryY + 18, { align: 'right' })
    
    // Divider line
    doc.setDrawColor(209, 213, 219)
    doc.setLineWidth(0.5)
    doc.line(20, summaryY + 23, 190, summaryY + 23)
    
    // Net Salary (highlighted)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(31, 41, 55)
    doc.text('NET SALARY', 20, summaryY + 33)
    
    doc.setFontSize(16)
    doc.setTextColor(22, 163, 74) // green-600
    doc.text(`₹ ${payslip.net_salary.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 190, summaryY + 33, { align: 'right' })
    
    // ═══════════════════════════════════════════════════════════
    // FOOTER
    // ═══════════════════════════════════════════════════════════
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(156, 163, 175) // gray-400
    doc.text('This is a computer-generated payslip and does not require a signature.', 105, 270, { align: 'center' })
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 105, 276, { align: 'center' })
    
    // Save
    const fileName = `Payslip_${payslip.employee.emp_code}_${(payslip.period_name || 'Unknown').replace(/\s+/g, '_')}.pdf`
    doc.save(fileName)
    toast.success('Payslip downloaded successfully!')
  }

  function viewPayslip(payslip) {
    setSelectedPayslip(payslip)
    setShowPreview(true)
  }

  function printPayslip(payslip) {
    generatePDF(payslip)
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
                          onClick={() => generatePDF(p)}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => printPayslip(p)}
                          className="p-1.5 text-gray-600 hover:bg-gray-50 rounded"
                          title="Print"
                        >
                          <Printer className="w-4 h-4" />
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
                  onClick={() => generatePDF(selectedPayslip)}
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
