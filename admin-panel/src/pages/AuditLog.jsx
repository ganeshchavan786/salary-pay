import { useState, useEffect } from 'react'
import { ClipboardList, Loader2 } from 'lucide-react'
import { auditApi, employeeApi } from '../services/api'
import toast from 'react-hot-toast'

const ACTION_COLORS = {
  INSERT: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
}

export default function AuditLog() {
  const [logs, setLogs] = useState([])
  const [employees, setEmployees] = useState([])
  const [selEmp, setSelEmp] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    employeeApi.getAll({ limit: 200 }).then(r => {
      setEmployees(r.data.employees || [])
    }).catch(() => {})
    fetchLogs()
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [selEmp])

  async function fetchLogs() {
    setLoading(true)
    try {
      const params = selEmp ? { emp_id: selEmp } : {}
      const r = await auditApi.getAll(params)
      setLogs(r.data.logs || [])
    } catch {
      toast.error('Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dt) {
    if (!dt) return '—'
    return new Date(dt).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Audit Log</h1>
          <p className="text-gray-500">{logs.length} recent changes</p>
        </div>
        <select
          className="border rounded-lg px-3 py-2 text-sm w-56"
          value={selEmp}
          onChange={e => setSelEmp(e.target.value)}
        >
          <option value="">All Employees</option>
          {employees.map(e => (
            <option key={e.id} value={e.id}>{e.name} ({e.emp_code})</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-800">📋 Change History</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No audit logs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Date/Time</th>
                  <th className="px-4 py-3 text-left">Action</th>
                  <th className="px-4 py-3 text-left">Table</th>
                  <th className="px-4 py-3 text-left">Field</th>
                  <th className="px-4 py-3 text-left">Old Value</th>
                  <th className="px-4 py-3 text-left">New Value</th>
                  <th className="px-4 py-3 text-left">Changed By</th>
                  <th className="px-4 py-3 text-left">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {formatDate(l.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[l.action] || 'bg-gray-100 text-gray-600'}`}>
                        {l.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{l.table_name}</td>
                    <td className="px-4 py-3 text-gray-700 font-medium">{l.field_name}</td>
                    <td className="px-4 py-3">
                      {l.old_value ? (
                        <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-xs line-through">{l.old_value}</span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {l.new_value ? (
                        <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">{l.new_value}</span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{l.changed_by_name}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-32 truncate">{l.note || '—'}</td>
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
