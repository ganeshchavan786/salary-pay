import { useState, useRef, useEffect } from 'react'
import { Download, ChevronDown, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { reportApi } from '../../services/api'

/**
 * CSV/Excel export dropdown button.
 * Requirement 33.1–33.4
 */
export default function ExportButton({ reportName, filters = {} }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleExport = async (format) => {
    setOpen(false)
    setLoading(true)
    try {
      const params = {
        format,
        start_date: filters.startDate,
        end_date: filters.endDate,
        emp_ids: filters.empIds,
        departments: filters.departments,
        month: filters.month,
        year: filters.year,
        granularity: filters.granularity,
      }
      // Remove undefined values
      Object.keys(params).forEach(k => params[k] === undefined && delete params[k])

      const response = await reportApi.export(reportName, params)
      const blob = new Blob([response.data], {
        type: format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${reportName}_export.${format}`
      // Try to get filename from Content-Disposition header
      const disposition = response.headers?.['content-disposition']
      if (disposition) {
        const match = disposition.match(/filename=([^;]+)/)
        if (match) a.download = match[1].trim()
      }
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Exported as ${format.toUpperCase()}`)
    } catch (err) {
      toast.error('Export failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        Export
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded-md shadow-lg z-10">
          <button
            onClick={() => handleExport('csv')}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Export CSV
          </button>
          <button
            onClick={() => handleExport('xlsx')}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Export Excel
          </button>
        </div>
      )}
    </div>
  )
}
