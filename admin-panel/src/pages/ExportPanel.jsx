import { useState } from 'react'
import { X, Download } from 'lucide-react'
import { attendanceHrApi } from '../services/api'
import toast from 'react-hot-toast'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function ExportPanel({ month, year, employees, onClose }) {
  const [format, setFormat] = useState('csv')
  const [scope, setScope] = useState('all')
  const [selectedEmpId, setSelectedEmpId] = useState(employees[0]?.id || '')
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    setDownloading(true)
    try {
      const params = {
        month,
        year,
        format,
        ...(scope === 'single' ? { emp_id: selectedEmpId } : {}),
      }

      const res = await attendanceHrApi.export(params)

      // Determine filename from Content-Disposition header or use fallback
      const disposition = res.headers['content-disposition'] || ''
      let filename = `attendance_${month}_${year}.${format}`
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      if (match && match[1]) {
        filename = match[1].replace(/['"]/g, '').trim()
      }

      // Create blob URL and trigger download
      const blob = new Blob([res.data], { type: res.headers['content-type'] })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to download')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">📥 Export Attendance</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Month/Year display */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-600">
            <span className="font-medium text-gray-700">Period:</span>
            <span>{MONTHS[month - 1]} {year}</span>
          </div>

          {/* Format selector */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Format</label>
            <div className="flex gap-2">
              <button
                onClick={() => setFormat('csv')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  format === 'csv'
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                CSV
              </button>
              <button
                onClick={() => setFormat('xlsx')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  format === 'xlsx'
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Excel (.xlsx)
              </button>
            </div>
          </div>

          {/* Scope selector */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Scope</label>
            <div className="flex gap-2">
              <button
                onClick={() => setScope('all')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  scope === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                All Employees
              </button>
              <button
                onClick={() => setScope('single')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  scope === 'single'
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Single Employee
              </button>
            </div>
          </div>

          {/* Employee dropdown — only shown for single scope */}
          {scope === 'single' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Employee</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                value={selectedEmpId}
                onChange={e => setSelectedEmpId(e.target.value)}
              >
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.emp_code})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
            <Download className="w-4 h-4" />
            {downloading ? 'Downloading...' : `Download ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  )
}
