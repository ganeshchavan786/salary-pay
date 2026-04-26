/**
 * leaveUtils.js — Pure utility functions for leave management.
 * These are extracted for independent testability.
 */

/**
 * Filter leaves by multiple criteria (AND logic).
 * @param {Array} leaves
 * @param {Object} filters - { status, leave_type, emp_id, from_date, to_date }
 * @returns {Array}
 */
export function filterLeaves(leaves, filters = {}) {
  return leaves.filter(l => {
    if (filters.status && l.status !== filters.status) return false
    if (filters.leave_type && l.leave_type !== filters.leave_type) return false
    if (filters.emp_id && l.emp_id !== filters.emp_id) return false
    if (filters.from_date && l.from_date < filters.from_date) return false
    if (filters.to_date && l.to_date > filters.to_date) return false
    return true
  })
}

/**
 * Get leaves that overlap a given date (ISO string YYYY-MM-DD).
 * Returns approved and pending leaves only.
 * @param {Array} leaves
 * @param {string} dateISO - "YYYY-MM-DD"
 * @returns {Array}
 */
export function getCalendarDayLeaves(leaves, dateISO) {
  return leaves.filter(l => {
    if (l.status !== 'approved' && l.status !== 'pending') return false
    return l.from_date <= dateISO && l.to_date >= dateISO
  })
}

/**
 * Export leaves to CSV string.
 * Returns null if leaves array is empty.
 * @param {Array} leaves
 * @returns {string|null}
 */
export function exportLeavesToCSV(leaves) {
  if (!leaves || leaves.length === 0) return null

  const HEADERS = [
    'Employee Name', 'Employee Code', 'Leave Type', 'From Date', 'To Date',
    'Total Days', 'Reason', 'Status', 'Applied At', 'Approver Comment', 'Action Date'
  ]

  const rows = leaves.map(l => [
    l.emp_name || '',
    l.emp_code || '',
    l.leave_type || '',
    l.from_date || '',
    l.to_date || '',
    l.total_days || 0,
    (l.reason || '').replace(/,/g, ';'),
    l.status || '',
    l.applied_at ? l.applied_at.slice(0, 10) : '',
    (l.approver_comment || '').replace(/,/g, ';'),
    l.action_at ? l.action_at.slice(0, 10) : '',
  ])

  return [HEADERS, ...rows].map(row => row.join(',')).join('\n')
}
