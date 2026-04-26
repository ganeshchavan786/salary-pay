import { useState, useEffect } from 'react'
import { employeeApi } from '../../services/api'

/**
 * Shared filter panel for all reports.
 * Provides date range, employee multi-select, and department multi-select.
 * Requirement 2.1–2.6
 */
export default function FilterPanel({ filters, onChange }) {
  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [dateError, setDateError] = useState('')

  useEffect(() => {
    employeeApi.getAll({ status: 'ACTIVE', limit: 1000 })
      .then(res => {
        const emps = res.data?.employees || res.data || []
        setEmployees(emps)
        const depts = [...new Set(emps.map(e => e.department).filter(Boolean))].sort()
        setDepartments(depts)
      })
      .catch(() => {})
  }, [])

  const handleStartDate = (e) => {
    const val = e.target.value
    const newFilters = { ...filters, startDate: val }
    if (val && filters.endDate && val > filters.endDate) {
      setDateError('Start date must be before or equal to end date')
    } else {
      setDateError('')
    }
    onChange(newFilters)
  }

  const handleEndDate = (e) => {
    const val = e.target.value
    const newFilters = { ...filters, endDate: val }
    if (filters.startDate && val && filters.startDate > val) {
      setDateError('Start date must be before or equal to end date')
    } else {
      setDateError('')
    }
    onChange(newFilters)
  }

  const handleEmpSelect = (e) => {
    const selected = Array.from(e.target.selectedOptions).map(o => o.value)
    onChange({ ...filters, empIds: selected.length > 0 ? selected : [] })
  }

  const handleDeptSelect = (e) => {
    const selected = Array.from(e.target.selectedOptions).map(o => o.value)
    onChange({ ...filters, departments: selected.length > 0 ? selected : [] })
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Start Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
          <input
            type="date"
            value={filters.startDate || ''}
            onChange={handleStartDate}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* End Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
          <input
            type="date"
            value={filters.endDate || ''}
            onChange={handleEndDate}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Employee Multi-Select */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Employees <span className="text-gray-400 text-xs">(hold Ctrl/Cmd for multi)</span>
          </label>
          <select
            multiple
            value={filters.empIds || []}
            onChange={handleEmpSelect}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 h-20"
          >
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.emp_code} - {emp.name}
              </option>
            ))}
          </select>
        </div>

        {/* Department Multi-Select */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Departments <span className="text-gray-400 text-xs">(hold Ctrl/Cmd for multi)</span>
          </label>
          <select
            multiple
            value={filters.departments || []}
            onChange={handleDeptSelect}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 h-20"
          >
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>

      {dateError && (
        <p className="mt-2 text-sm text-red-600">{dateError}</p>
      )}
    </div>
  )
}
