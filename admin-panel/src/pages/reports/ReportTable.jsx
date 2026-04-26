import { useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

/**
 * Generic sortable table component.
 * Accepts columns (array of { key, label, render? }) and data (array of row objects).
 * Requirement 3.1, 9.1
 */
export default function ReportTable({ columns = [], data = [], className = '' }) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedData = [...data].sort((a, b) => {
    if (!sortKey) return 0
    const aVal = a[sortKey]
    const bVal = b[sortKey]
    if (aVal === null || aVal === undefined) return 1
    if (bVal === null || bVal === undefined) return -1
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    }
    const aStr = String(aVal).toLowerCase()
    const bStr = String(bVal).toLowerCase()
    if (aStr < bStr) return sortDir === 'asc' ? -1 : 1
    if (aStr > bStr) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  if (data.length === 0) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
        <div className="flex items-center justify-center py-12 text-gray-400">
          <p className="text-sm">No data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key ? (
                      sortDir === 'asc' ? (
                        <ChevronUp className="w-3 h-3 text-primary-500" />
                      ) : (
                        <ChevronDown className="w-3 h-3 text-primary-500" />
                      )
                    ) : (
                      <ChevronsUpDown className="w-3 h-3 text-gray-300" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {sortedData.map((row, idx) => (
              <tr
                key={idx}
                className={`hover:bg-gray-50 transition ${
                  row.is_grand_total ? 'bg-blue-50 font-semibold' :
                  row.is_subtotal ? 'bg-gray-50 font-medium' :
                  row.is_org_summary ? 'bg-yellow-50 font-medium' :
                  row.is_highest_cost ? 'bg-orange-50' : ''
                }`}
              >
                {columns.map(col => (
                  <td key={col.key} className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
        {data.length} row{data.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
