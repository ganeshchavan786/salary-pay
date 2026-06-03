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
      {showPreview && selectedPayslip && (() => {
        // Helper to get month index and year from period_name (e.g. "January 2026")
        const getPeriodMonthYear = (periodName) => {
          if (!periodName) return { month: 1, year: 2026 };
          const parts = periodName.split(' ');
          if (parts.length === 2) {
            const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            const monthIdx = months.indexOf(parts[0]);
            const year = parseInt(parts[1]) || 2026;
            return { month: monthIdx !== -1 ? monthIdx + 1 : 1, year };
          }
          return { month: 1, year: 2026 };
        };

        const { month, year } = getPeriodMonthYear(selectedPayslip.period_name);
        const multiplier = month >= 4 ? month - 3 : month + 9;

        // Calculate pay date
        let payDateStr = 'N/A';
        if (selectedPayslip.paid_at) {
          try {
            const dt = new Date(selectedPayslip.paid_at);
            payDateStr = dt.toLocaleDateString('en-GB'); // DD/MM/YYYY
          } catch (err) {}
        }
        if (payDateStr === 'N/A' && year && month) {
          const lastDay = new Date(year, month, 0).getDate();
          payDateStr = `${lastDay.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
        }

        // Joining Date
        let joiningDateStr = selectedPayslip.employee?.joining_date || '-';
        if (joiningDateStr && joiningDateStr.includes('-')) {
          try {
            const parts = joiningDateStr.split('-');
            if (parts.length === 3) {
              joiningDateStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
          } catch (e) {}
        }

        // Paid Days / LOP Days
        const calcDetails = selectedPayslip.calculation_details || {};
        const lopDays = parseFloat(calcDetails.lop_days || selectedPayslip.lop_days || 0);
        const totalDays = selectedPayslip.total_days || new Date(year, month, 0).getDate();
        const paidDays = totalDays - lopDays;
        
        const paidDaysStr = Number.isInteger(paidDays) ? paidDays.toString() : paidDays.toFixed(1);
        const lopDaysStr = Number.isInteger(lopDays) ? lopDays.toString() : lopDays.toFixed(1);

        // Word representation
        let words = selectedPayslip.net_pay_words || 'Zero Only';
        if (!words.toLowerCase().startsWith('indian rupee')) {
          words = 'Indian Rupee ' + words;
        }

        // Symmetric padding for tables
        const earningsList = selectedPayslip.earnings || [];
        const deductionsList = selectedPayslip.deductions || [];
        const maxRows = Math.max(earningsList.length, deductionsList.length, 4);

        const paddedEarnings = [...earningsList];
        while (paddedEarnings.length < maxRows) paddedEarnings.push({ label: '', amount: null });

        const paddedDeductions = [...deductionsList];
        while (paddedDeductions.length < maxRows) paddedDeductions.push({ label: '', amount: null });

        return (
          <div className="fixed inset-0 bg-slate-900 bg-opacity-65 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto border border-slate-200">
              {/* Modal Top Header Bar */}
              <div className="bg-slate-800 px-6 py-4 text-white flex justify-between items-center border-b border-slate-700">
                <h3 className="text-lg font-bold tracking-tight">Payslip Preview</h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-slate-400 hover:text-white text-3xl leading-none transition-colors"
                >
                  &times;
                </button>
              </div>

              {/* Zoho Layout Sheet Container */}
              <div className="p-6">
                <div className="border border-slate-300 p-6 md:p-8 bg-white shadow-sm font-sans text-slate-800 rounded-lg">
                  {/* Bounding box header */}
                  <div className="flex justify-between items-start pb-4 border-b border-slate-200">
                    <div>
                      <h4 className="text-lg font-bold text-slate-900">SalaryPay HR Solutions</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">123 Business Hub, Pune, Maharashtra - 411045</p>
                    </div>
                    
                    {/* Zoho style logo representation */}
                    <div className="flex flex-col items-center">
                      <div className="grid grid-cols-2 gap-1 w-6 h-6">
                        <div className="w-2.5 h-2.5 bg-[#0f9d58]"></div>
                        <div className="w-2.5 h-2.5 bg-[#f4b400]"></div>
                        <div className="w-2.5 h-2.5 bg-[#1a73e8]"></div>
                        <div className="w-2.5 h-2.5 bg-[#db4437]"></div>
                      </div>
                      <span className="text-[7px] font-bold text-slate-400 mt-1 tracking-wider">SALARYPAY</span>
                    </div>
                  </div>

                  {/* Centered month bar */}
                  <div className="bg-slate-50 border-b border-slate-200 text-center py-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                    Payslip for the month of {selectedPayslip.period_name || 'N/A'}
                  </div>

                  {/* Employee Pay Summary Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-12 border-b border-slate-200">
                    {/* Left: Metadata list */}
                    <div className="md:col-span-7 p-4">
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">EMPLOYEE PAY SUMMARY</h5>
                      <div className="space-y-1.5 text-xs">
                        <div className="grid grid-cols-12">
                          <span className="col-span-4 text-slate-500">Employee Name</span>
                          <span className="col-span-1">:</span>
                          <span className="col-span-7 font-bold text-slate-800">
                            {selectedPayslip.employee.name}, {selectedPayslip.employee.emp_code}
                          </span>
                        </div>
                        <div className="grid grid-cols-12">
                          <span className="col-span-4 text-slate-500">Designation</span>
                          <span className="col-span-1">:</span>
                          <span className="col-span-7 font-bold text-slate-800">{selectedPayslip.employee.designation || 'N/A'}</span>
                        </div>
                        <div className="grid grid-cols-12">
                          <span className="col-span-4 text-slate-500">Date of Joining</span>
                          <span className="col-span-1">:</span>
                          <span className="col-span-7 font-bold text-slate-800">{joiningDateStr}</span>
                        </div>
                        <div className="grid grid-cols-12">
                          <span className="col-span-4 text-slate-500">Pay Period</span>
                          <span className="col-span-1">:</span>
                          <span className="col-span-7 font-bold text-slate-800">{selectedPayslip.period_name || 'N/A'}</span>
                        </div>
                        <div className="grid grid-cols-12">
                          <span className="col-span-4 text-slate-500">Pay Date</span>
                          <span className="col-span-1">:</span>
                          <span className="col-span-7 font-bold text-slate-800">{payDateStr}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Net Pay Callout */}
                    <div className="md:col-span-5 p-4 flex flex-col justify-center items-center border-t md:border-t-0 md:border-l border-slate-200 bg-slate-50/30">
                      <span className="text-[11px] text-slate-500 font-medium">Employee Net Pay</span>
                      <span className="text-2xl font-black text-slate-900 my-1">
                        Rs. {selectedPayslip.net_salary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded-full mt-0.5">
                        Paid Days : {paidDaysStr} | LOP Days : {lopDaysStr}
                      </span>
                    </div>
                  </div>

                  {/* Side-by-side Tables */}
                  <div className="grid grid-cols-1 md:grid-cols-2 border-b border-slate-200 divide-x divide-slate-200">
                    {/* Left side: Earnings */}
                    <div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
                            <th className="px-3 py-2 text-left">Earnings</th>
                            <th className="px-3 py-2 text-right">Amount</th>
                            <th className="px-3 py-2 text-right">YTD</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {paddedEarnings.map((e, idx) => (
                            <tr key={idx} className="h-9">
                              <td className="px-3 py-2 text-left text-slate-600 font-medium">{e.label}</td>
                              <td className="px-3 py-2 text-right text-slate-800 font-bold">
                                {e.amount !== null ? `${e.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : ''}
                              </td>
                              <td className="px-3 py-2 text-right text-slate-500">
                                {e.amount !== null ? `${(e.amount * multiplier).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Right side: Deductions */}
                    <div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
                            <th className="px-3 py-2 text-left">Deductions</th>
                            <th className="px-3 py-2 text-right">Amount</th>
                            <th className="px-3 py-2 text-right">YTD</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {paddedDeductions.map((d, idx) => (
                            <tr key={idx} className="h-9">
                              <td className="px-3 py-2 text-left text-slate-600 font-medium">{d.label}</td>
                              <td className="px-3 py-2 text-right text-slate-800 font-bold">
                                {d.amount !== null ? `${d.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : ''}
                              </td>
                              <td className="px-3 py-2 text-right text-slate-500">
                                {d.amount !== null ? `${(d.amount * multiplier).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Totals Row */}
                  <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 bg-slate-50/50 font-bold text-xs">
                    <div className="flex justify-between items-center px-3 py-2.5">
                      <span className="text-slate-700">Gross Earnings</span>
                      <span className="text-slate-800">
                        {selectedPayslip.gross_salary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center px-3 py-2.5">
                      <span className="text-slate-700">Total Deductions</span>
                      <span className="text-rose-600">
                        {selectedPayslip.total_deductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Math Calculation breakdown table */}
                  <div className="mt-5 border border-slate-200 rounded-lg overflow-hidden text-xs">
                    <div className="grid grid-cols-12 bg-slate-50 font-bold text-slate-700 border-b border-slate-200 text-[10px]">
                      <div className="col-span-9 px-3 py-2">NET PAY</div>
                      <div className="col-span-3 px-3 py-2 text-right border-l border-slate-200">AMOUNT</div>
                    </div>
                    <div className="grid grid-cols-12 border-b border-slate-100">
                      <div className="col-span-9 px-3 py-2 text-slate-600 font-medium">Gross Earnings</div>
                      <div className="col-span-3 px-3 py-2 text-right border-l border-slate-200 text-slate-800 font-semibold">
                        {selectedPayslip.gross_salary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="grid grid-cols-12 border-b border-slate-200">
                      <div className="col-span-9 px-3 py-2 text-slate-600 font-medium">Total Deductions</div>
                      <div className="col-span-3 px-3 py-2 text-right border-l border-slate-200 text-slate-800 font-semibold">
                        (-) {selectedPayslip.total_deductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="grid grid-cols-12 bg-slate-50/50 font-bold">
                      <div className="col-span-9 px-3 py-2 text-right text-slate-700">Total Net Payable</div>
                      <div className="col-span-3 px-3 py-2 text-right border-l border-slate-200 text-slate-800 text-sm">
                        Rs. {selectedPayslip.net_salary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  {/* Words translation & Footnote */}
                  <div className="mt-6 text-center space-y-1">
                    <div className="text-slate-800 font-bold text-xs">
                      Total Net Payable Rs. {selectedPayslip.net_salary.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({words})
                    </div>
                    <div className="text-[10px] text-slate-400 italic">
                      **Total Net Payable = Gross Earnings - Total Deductions
                    </div>
                  </div>

                  {/* Decl footer */}
                  <div className="mt-8 text-center text-[9px] text-slate-400">
                    -- This document has been automatically generated by SalaryPay; therefore, a signature is not required. --
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => handleDownload(selectedPayslip)}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-semibold shadow-md transition hover:shadow-lg focus:outline-none"
                  >
                    <Download className="w-5 h-5" /> Download PDF Payslip
                  </button>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="px-6 py-3 bg-slate-100 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition focus:outline-none"
                  >
                    Close Preview
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  )
}
