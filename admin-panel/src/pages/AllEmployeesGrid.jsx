import { useState, useEffect } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { attendanceHrApi } from '../services/api'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const STATUS_COLORS = {
  present: 'bg-green-100 text-green-700',
  absent: 'bg-red-100 text-red-700',
  halfday: 'bg-purple-100 text-purple-700',
  leave: 'bg-orange-100 text-orange-700',
  holiday: 'bg-blue-100 text-blue-700',
  weeklyoff: 'bg-gray-100 text-gray-600',
}

const STATUS_ABBREV = {
  present: 'P',
  absent: 'A',
  halfday: 'H',
  leave: 'L',
  holiday: 'Ho',
  weeklyoff: 'WO',
}

export default function AllEmployeesGrid({ month, year, onNavigateToEmployee }) {
  const [data, setData] = useState({ employees: [], working_days: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [departmentFilter, setDepartmentFilter] = useState('')

  useEffect(() => {
    fetchData()
  }, [month, year])

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const res = await attendanceHrApi.monthlyAll(month, year)
      setData(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load attendance data')
    } finally {
      setLoading(false)
    }
  }

  // Extract unique departments from employee list
  const departments = [...new Set(
    (data.employees || []).map(e => e.department).filter(Boolean)
  )].sort()

  const filteredEmployees = (data.employees || []).filter(
    e => !departmentFilter || e.department === departmentFilter
  )

  // Days in the selected month (to know which day columns are valid)
  const daysInMonth = new Date(year, month, 0).getDate()

  function getDayStatus(emp, day) {
    if (!emp.days) return null
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const record = emp.days.find(d => d.date === dateStr)
    return record?.status || null
  }

  return (
    <div className="bg-white rounded-xl shadow">
      {/* Header */}
      <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-gray-800">
          All Employees — {MONTHS[month - 1]} {year}
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={departmentFilter}
            onChange={e => setDepartmentFilter(e.target.value)}
            className="border rounded-lg px-2 py-1 text-sm"
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-1 mb-1">
              <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
              {Array.from({ length: 33 }).map((_, j) => (
                <div key={j} className="h-8 w-8 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="p-8 text-center">
          <p className="text-red-500 mb-3">{error}</p>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead className="bg-gray-50 text-gray-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-left sticky left-0 bg-gray-50 z-10 min-w-[140px]">
                  Employee
                </th>
                <th className="px-2 py-2 text-left min-w-[80px]">Dept</th>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                  <th
                    key={day}
                    className={`px-1 py-2 text-center w-8 ${day > daysInMonth ? 'text-gray-300' : ''}`}
                  >
                    {day}
                  </th>
                ))}
                <th className="px-2 py-2 text-center text-green-700">P</th>
                <th className="px-2 py-2 text-center text-red-700">A</th>
                <th className="px-2 py-2 text-center text-purple-700">H</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={35} className="px-4 py-8 text-center text-gray-400">
                    No employees found
                  </td>
                </tr>
              ) : (
                filteredEmployees.map(emp => (
                  <tr key={emp.emp_id} className="hover:bg-gray-50">
                    {/* Employee name — sticky left */}
                    <td className="px-3 py-1.5 sticky left-0 bg-white z-10 border-r border-gray-100">
                      <div className="font-medium text-gray-800 truncate max-w-[130px]">{emp.name}</div>
                      <div className="text-gray-400 text-[10px]">{emp.emp_code}</div>
                    </td>

                    {/* Department */}
                    <td className="px-2 py-1.5 text-gray-500 truncate max-w-[80px]">
                      {emp.department || '—'}
                    </td>

                    {/* Day cells 1–31 */}
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                      if (day > daysInMonth) {
                        return (
                          <td key={day} className="px-1 py-1 text-center">
                            <span className="text-gray-300">-</span>
                          </td>
                        )
                      }
                      const status = getDayStatus(emp, day)
                      return (
                        <td
                          key={day}
                          className="px-1 py-1 text-center cursor-pointer hover:bg-gray-50"
                          onClick={() => onNavigateToEmployee(emp.emp_id)}
                        >
                          {status ? (
                            <span
                              className={`px-1 rounded text-[10px] font-medium ${STATUS_COLORS[status] || 'bg-gray-50 text-gray-400'}`}
                            >
                              {STATUS_ABBREV[status] || '-'}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      )
                    })}

                    {/* Summary: P / A / H */}
                    <td className="px-2 py-1.5 text-center font-medium text-green-700">
                      {emp.summary?.present ?? 0}
                    </td>
                    <td className="px-2 py-1.5 text-center font-medium text-red-700">
                      {emp.summary?.absent ?? 0}
                    </td>
                    <td className="px-2 py-1.5 text-center font-medium text-purple-700">
                      {emp.summary?.halfday ?? 0}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
