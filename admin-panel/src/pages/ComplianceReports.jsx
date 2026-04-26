import { useState, useEffect } from 'react'
import { FileText, Download, AlertCircle } from 'lucide-react'
import { api } from '../services/api'
import toast from 'react-hot-toast'

const CURRENT_YEAR = new Date().getFullYear()
const FINANCIAL_YEARS = [
  `${CURRENT_YEAR - 1}-${CURRENT_YEAR}`,
  `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`,
]

export default function ComplianceReports() {
  const [periods, setPeriods] = useState([])
  const [employees, setEmployees] = useState([])
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [selectedFY, setSelectedFY] = useState(FINANCIAL_YEARS[0])
  const [reportData, setReportData] = useState(null)
  const [reportType, setReportType] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchPeriods()
    fetchEmployees()
  }, [])

  async function fetchPeriods() {
    try {
      const r = await api.get('/v1/payroll-periods/')
      const list = r.data || []
      setPeriods(list)
      if (list.length > 0) setSelectedPeriod(list[0].id)
    } catch { toast.error('Failed to load periods') }
  }

  async function fetchEmployees() {
    try {
      const r = await api.get('/employees?limit=200')
      setEmployees(r.data?.employees || r.data || [])
    } catch { /* ignore */ }
  }

  async function generateReport(type, params = {}) {
    setLoading(true)
    setReportType(type)
    setReportData(null)
    try {
      let url = ''
      if (type === 'PF_ECR') url = `/v1/compliance/pf-ecr?period_id=${selectedPeriod}`
      else if (type === 'ESI') url = `/v1/compliance/esi?period_id=${selectedPeriod}`
      else if (type === 'PT') url = `/v1/compliance/pt?period_id=${selectedPeriod}`
      else if (type === 'FORM16') url = `/v1/compliance/form16/${selectedEmployee}/${selectedFY}`

      const r = await api.get(url)
      setReportData(r.data)
      toast.success(`${type} report generated!`)
    } catch (err) {
      toast.error(err.response?.data?.detail || `Failed to generate ${type} report`)
    } finally { setLoading(false) }
  }

  async function downloadReport(type) {
    try {
      let url = ''
      if (type === 'PF_ECR') url = `/v1/compliance/pf-ecr/download?period_id=${selectedPeriod}`
      else if (type === 'ESI') url = `/v1/compliance/esi/download?period_id=${selectedPeriod}`
      else if (type === 'PT') url = `/v1/compliance/pt/download?period_id=${selectedPeriod}`
      else if (type === 'FORM16') url = `/v1/compliance/form16/${selectedEmployee}/${selectedFY}/download`

      const r = await api.get(url, { responseType: 'blob' })
      const blob = new Blob([r.data])
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${type.toLowerCase()}-report.pdf`
      link.click()
      URL.revokeObjectURL(link.href)
    } catch { toast.error('Download failed') }
  }

  const reportButtons = [
    { type: 'PF_ECR', label: 'Generate PF ECR', color: 'bg-blue-600 hover:bg-blue-700' },
    { type: 'ESI', label: 'Generate ESI Report', color: 'bg-purple-600 hover:bg-purple-700' },
    { type: 'PT', label: 'Generate PT Report', color: 'bg-green-600 hover:bg-green-700' },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Compliance Reports</h1>
        <p className="text-gray-500 text-sm mt-1">Generate PF ECR, ESI, PT and Form 16 reports</p>
      </div>

      {/* Period Selector */}
      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <div className="flex items-end gap-4 flex-wrap">
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
          <div className="flex gap-2">
            {reportButtons.map(btn => (
              <button
                key={btn.type}
                onClick={() => generateReport(btn.type)}
                disabled={loading || !selectedPeriod}
                className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg disabled:opacity-50 text-sm font-medium ${btn.color}`}
              >
                <FileText className="w-4 h-4" />
                {loading && reportType === btn.type ? 'Generating...' : btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Form 16 Section */}
      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <h2 className="font-semibold text-gray-800 mb-3">Form 16 (Annual TDS Certificate)</h2>
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Employee</label>
            <select
              className="border rounded-lg px-3 py-2 text-sm min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedEmployee}
              onChange={e => setSelectedEmployee(e.target.value)}
            >
              <option value="">— Select Employee —</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>
                  {e.name || e.full_name} ({e.emp_code || e.employee_code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Financial Year</label>
            <select
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedFY}
              onChange={e => setSelectedFY(e.target.value)}
            >
              {FINANCIAL_YEARS.map(fy => (
                <option key={fy} value={fy}>{fy}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => generateReport('FORM16')}
            disabled={loading || !selectedEmployee}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm font-medium"
          >
            <FileText className="w-4 h-4" />
            {loading && reportType === 'FORM16' ? 'Generating...' : 'Generate Form 16'}
          </button>
        </div>
      </div>

      {/* Report Output */}
      {reportData && (
        <div className="bg-white rounded-xl shadow">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">{reportType} Report</h2>
            <button
              onClick={() => downloadReport(reportType)}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              <Download className="w-4 h-4" /> Download
            </button>
          </div>
          <div className="overflow-x-auto">
            {Array.isArray(reportData) ? (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr>
                    {reportData.length > 0 && Object.keys(reportData[0]).map(k => (
                      <th key={k} className="px-4 py-3 text-left">{k.replace(/_/g, ' ')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reportData.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      {Object.values(row).map((v, j) => (
                        <td key={j} className="px-4 py-3 text-gray-700">{String(v ?? '—')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-4">
                <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                  {JSON.stringify(reportData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {!reportData && !loading && (
        <div className="text-center py-12 text-gray-400">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>Select a period and click a report button to generate</p>
        </div>
      )}
    </div>
  )
}
