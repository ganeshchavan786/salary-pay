import { useState, useEffect } from 'react'
import { Search, Filter, Shield } from 'lucide-react'
import { api } from '../services/api'
import toast from 'react-hot-toast'

const ENTITY_TYPES = ['', 'salary_calculation', 'payroll_period', 'salary_config', 'deduction', 'tax_declaration']
const OPERATIONS = ['', 'CREATE', 'UPDATE', 'DELETE', 'STATE_TRANSITION', 'APPROVE', 'REJECT']

export default function SalaryAuditLog() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    entity_type: '',
    operation: '',
    date_from: '',
    date_to: '',
  })

  useEffect(() => { fetchLogs() }, [])

  async function fetchLogs() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.entity_type) params.append('entity_type', filters.entity_type)
      if (filters.operation) params.append('operation', filters.operation)
      if (filters.date_from) params.append('date_from', filters.date_from)
      if (filters.date_to) params.append('date_to', filters.date_to)

      const r = await api.get(`/v1/salary-audit/?${params.toString()}`)
      setLogs(r.data || [])
    } catch { toast.error('Failed to load audit logs') }
    finally { setLoading(false) }
  }

  function handleFilterChange(key, value) {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  function formatChangedFields(fields) {
    if (!fields) return '—'
    if (typeof fields === 'string') return fields
    if (typeof fields === 'object') {
      return Object.keys(fields).join(', ')
    }
    return String(fields)
  }

  const OPERATION_COLORS = {
    CREATE: 'bg-green-100 text-green-700',
    UPDATE: 'bg-blue-100 text-blue-700',
    DELETE: 'bg-red-100 text-red-700',
    STATE_TRANSITION: 'bg-purple-100 text-purple-700',
    APPROVE: 'bg-teal-100 text-teal-700',
    REJECT: 'bg-orange-100 text-orange-700',
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Salary Audit Log</h1>
        <p className="text-gray-500 text-sm mt-1">Tamper-evident audit trail for all salary operations</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Entity Type</label>
            <select
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.entity_type}
              onChange={e => handleFilterChange('entity_type', e.target.value)}
            >
              {ENTITY_TYPES.map(t => (
                <option key={t} value={t}>{t || 'All Types'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Operation</label>
            <select
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.operation}
              onChange={e => handleFilterChange('operation', e.target.value)}
            >
              {OPERATIONS.map(op => (
                <option key={op} value={op}>{op || 'All Operations'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">From Date</label>
            <input
              type="date"
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.date_from}
              onChange={e => handleFilterChange('date_from', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To Date</label>
            <input
              type="date"
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.date_to}
              onChange={e => handleFilterChange('date_to', e.target.value)}
            />
          </div>
          <button
            onClick={fetchLogs}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Search className="w-4 h-4" /> Search
          </button>
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-white rounded-xl shadow">
        <div className="p-4 border-b flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-gray-800">Audit Trail — {logs.length} records</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No audit logs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Timestamp</th>
                  <th className="px-4 py-3 text-left">Entity Type</th>
                  <th className="px-4 py-3 text-left">Entity ID</th>
                  <th className="px-4 py-3 text-left">Operation</th>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Changed Fields</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log, i) => (
                  <tr key={log.id || i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {log.timestamp
                        ? new Date(log.timestamp).toLocaleString()
                        : log.created_at
                          ? new Date(log.created_at).toLocaleString()
                          : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                        {log.entity_type || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                      {log.entity_id ? String(log.entity_id).slice(0, 8) + '...' : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${OPERATION_COLORS[log.operation] || 'bg-gray-100 text-gray-600'}`}>
                        {log.operation || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {log.user_id ? String(log.user_id).slice(0, 8) + '...' : log.performed_by || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                      {formatChangedFields(log.changed_fields)}
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
