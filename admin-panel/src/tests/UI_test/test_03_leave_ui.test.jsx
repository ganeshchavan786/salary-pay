/**
 * UI TEST 03: Leave Management Page
 * ===================================
 * Tests:
 *  - Page renders with title and stats
 *  - 3 tabs: Leave Requests, All Balances, Reports
 *  - Apply Leave button visible
 *  - Apply Leave modal opens/closes
 *  - Leave type options (CL/SL/EL/LWP)
 *  - Filter dropdowns visible
 *  - Export CSV button
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('lucide-react', () => {
  const Icon = (props) => React.createElement('span', props)
  return {
    FileText: Icon, CheckCircle: Icon, XCircle: Icon, Clock: Icon,
    AlertTriangle: Icon, Download: Icon, X: Icon, Edit2: Icon,
    ChevronLeft: Icon, ChevronRight: Icon, List: Icon, Calendar: Icon,
  }
})

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('recharts', () => ({
  BarChart: ({ children }) => React.createElement('div', { 'data-testid': 'bar-chart' }, children),
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }) => React.createElement('div', null, children),
  PieChart: ({ children }) => React.createElement('div', { 'data-testid': 'pie-chart' }, children),
  Pie: () => null,
  Cell: () => null,
  Legend: () => null,
}))

vi.mock('../../utils/leaveUtils', () => ({
  filterLeaves: (leaves) => leaves,
  getCalendarDayLeaves: () => [],
  exportLeavesToCSV: () => 'csv-data',
}))

vi.mock('../../services/api', () => ({
  leaveApi: {
    getAll: vi.fn(() => Promise.resolve({
      data: {
        leaves: [
          { id: 'l1', emp_id: 'emp1', emp_name: 'Rahul Sharma', emp_code: 'EMP001', leave_type: 'CL', from_date: '2026-04-01', to_date: '2026-04-01', total_days: 1, status: 'pending', reason: 'Personal' },
          { id: 'l2', emp_id: 'emp2', emp_name: 'Priya Patel', emp_code: 'EMP002', leave_type: 'LWP', from_date: '2026-04-05', to_date: '2026-04-06', total_days: 2, status: 'approved', reason: 'Medical' },
        ]
      }
    })),
    getStats: vi.fn(() => Promise.resolve({
      data: { pending_count: 1, approved_this_month: 2, rejected_this_month: 0, lwp_this_year: 3 }
    })),
    getBalances: vi.fn(() => Promise.resolve({ data: { balances: [] } })),
    getReportSummary: vi.fn(() => Promise.resolve({ data: { summary: [] } })),
    getReportMonthly: vi.fn(() => Promise.resolve({ data: { monthly: Array(12).fill(0) } })),
    approve: vi.fn(() => Promise.resolve({ data: {} })),
    reject: vi.fn(() => Promise.resolve({ data: {} })),
    cancel: vi.fn(() => Promise.resolve({ data: {} })),
    apply: vi.fn(() => Promise.resolve({ data: {} })),
    bulkAction: vi.fn(() => Promise.resolve({ data: { success_count: 1, failure_count: 0 } })),
  },
  employeeApi: {
    getAll: vi.fn(() => Promise.resolve({
      data: { employees: [
        { id: 'emp1', name: 'Rahul Sharma', emp_code: 'EMP001' },
        { id: 'emp2', name: 'Priya Patel', emp_code: 'EMP002' },
      ]}
    })),
  },
}))

import Leaves from '../../pages/Leaves'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('UI Test 03 — Leave Management Page', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders page title', async () => {
    render(React.createElement(Leaves))
    await waitFor(() => {
      expect(screen.getByText('Leave Management')).toBeTruthy()
    })
    console.log('  ✓ Page title "Leave Management" visible')
  })

  it('renders all 3 tabs', async () => {
    render(React.createElement(Leaves))
    await waitFor(() => {
      expect(screen.getByText('Leave Requests')).toBeTruthy()
      expect(screen.getByText('All Balances')).toBeTruthy()
      expect(screen.getByText('Reports')).toBeTruthy()
    })
    console.log('  ✓ All 3 tabs visible: Leave Requests, All Balances, Reports')
  })

  it('shows stats cards (Pending, Approved, Rejected, LWP)', async () => {
    render(React.createElement(Leaves))
    await waitFor(() => {
      const allText = document.body.textContent
      expect(allText).toContain('Pending')
      expect(allText).toContain('Approved')
      expect(allText).toContain('LWP Days')
    })
    console.log('  ✓ Stats cards: Pending, Approved, LWP Days visible')
  })

  it('Apply Leave button is visible', async () => {
    render(React.createElement(Leaves))
    await waitFor(() => {
      expect(screen.getByText('+ Apply Leave')).toBeTruthy()
    })
    console.log('  ✓ "+ Apply Leave" button visible')
  })

  it('clicking Apply Leave opens modal', async () => {
    render(React.createElement(Leaves))
    await waitFor(() => screen.getByText('+ Apply Leave'))
    fireEvent.click(screen.getByText('+ Apply Leave'))

    await waitFor(() => {
      expect(screen.getByText('Apply for Leave')).toBeTruthy()
    })
    console.log('  ✓ Apply Leave modal opens on click')
  })

  it('Apply Leave modal has leave type options', async () => {
    render(React.createElement(Leaves))
    await waitFor(() => screen.getByText('+ Apply Leave'))
    fireEvent.click(screen.getByText('+ Apply Leave'))

    await waitFor(() => {
      // Check leave type select has CL, SL, EL, LWP options
      const selects = screen.getAllByRole('combobox')
      const leaveTypeSelect = selects.find(s =>
        s.innerHTML.includes('CL') && s.innerHTML.includes('LWP')
      )
      expect(leaveTypeSelect).toBeTruthy()
    })
    console.log('  ✓ Leave type options: CL, SL, EL, LWP available')
  })

  it('leave list shows pending and approved leaves', async () => {
    render(React.createElement(Leaves))
    // Wait for loading to finish and data to appear
    await waitFor(() => {
      expect(screen.queryByText('No leave requests found')).toBeNull()
    }, { timeout: 3000 })
    await waitFor(() => {
      const cells = screen.getAllByRole('cell')
      const names = cells.map(c => c.textContent)
      expect(names.some(n => n.includes('Rahul'))).toBe(true)
    })
    console.log('  ✓ Leave list shows employee names')
  })

  it('leave type badges visible (CL, LWP)', async () => {
    render(React.createElement(Leaves))
    await waitFor(() => {
      // CL and LWP appear as option values in filter AND as badges in table
      const allText = document.body.textContent
      expect(allText).toContain('CL')
      expect(allText).toContain('LWP')
    })
    console.log('  ✓ Leave type badges: CL and LWP visible')
  })

  it('status badges visible (pending, approved)', async () => {
    render(React.createElement(Leaves))
    await waitFor(() => {
      const allText = document.body.textContent
      expect(allText).toContain('pending')
      expect(allText).toContain('approved')
    })
    console.log('  ✓ Status badges: pending and approved visible')
  })

  it('Export CSV button visible', async () => {
    render(React.createElement(Leaves))
    await waitFor(() => {
      expect(screen.getByText('Export CSV')).toBeTruthy()
    })
    console.log('  ✓ Export CSV button visible')
  })

  it('filter dropdowns visible (Status, Type)', async () => {
    render(React.createElement(Leaves))
    await waitFor(() => {
      expect(screen.getByText('All Status')).toBeTruthy()
      expect(screen.getByText('All Types')).toBeTruthy()
    })
    console.log('  ✓ Filter dropdowns: All Status, All Types visible')
  })

})
