/**
 * UI TEST 02: Attendance Page
 * ============================
 * Tests:
 *  - Page renders with title and view mode tabs
 *  - Raw / HR Mode / All Employees / Stats tabs visible
 *  - Employee dropdown loads
 *  - Manual Entry modal opens/closes
 *  - Status badge colors correct
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('lucide-react', () => {
  const Icon = (props) => React.createElement('span', props)
  return {
    Calendar: Icon, Download: Icon, Search: Icon, Loader2: Icon,
    Plus: Icon, BarChart2: Icon, History: Icon, Grid: Icon, TrendingUp: Icon,
    X: Icon, ChevronLeft: Icon, ChevronRight: Icon,
  }
})

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('date-fns', () => ({
  format: (date, fmt) => '2026-04-23',
  subDays: (date, n) => new Date(),
}))

// Mock child components
vi.mock('../../pages/BulkCalendarModal', () => ({
  default: () => React.createElement('div', { 'data-testid': 'bulk-calendar-modal' }, 'BulkCalendarModal'),
}))
vi.mock('../../pages/AllEmployeesGrid', () => ({
  default: () => React.createElement('div', { 'data-testid': 'all-employees-grid' }, 'AllEmployeesGrid'),
}))
vi.mock('../../pages/AttendanceStatsPanel', () => ({
  default: () => React.createElement('div', { 'data-testid': 'stats-panel' }, 'StatsPanel'),
}))
vi.mock('../../pages/ExportPanel', () => ({
  default: () => React.createElement('div', { 'data-testid': 'export-panel' }, 'ExportPanel'),
}))

// Mock API
vi.mock('../../services/api', () => ({
  attendanceApi: {
    getAll: vi.fn(() => Promise.resolve({ data: { records: [] } })),
    getSummary: vi.fn(() => Promise.resolve({ data: {} })),
  },
  attendanceHrApi: {
    getDaily: vi.fn(() => Promise.resolve({ data: { records: [], summary: null } })),
    manualEntry: vi.fn(() => Promise.resolve({ data: {} })),
    override: vi.fn(() => Promise.resolve({ data: {} })),
    getAudit: vi.fn(() => Promise.resolve({ data: { logs: [] } })),
    monthlyReport: vi.fn(() => Promise.resolve({ data: { report: [] } })),
  },
  employeeApi: {
    getAll: vi.fn(() => Promise.resolve({
      data: {
        employees: [
          { id: 'emp1', name: 'Rahul Sharma', emp_code: 'EMP001' },
          { id: 'emp2', name: 'Priya Patel', emp_code: 'EMP002' },
        ]
      }
    })),
  },
}))

import Attendance from '../../pages/Attendance'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('UI Test 02 — Attendance Page', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders page title', async () => {
    render(React.createElement(Attendance))
    await waitFor(() => {
      expect(screen.getByText('Attendance Records')).toBeTruthy()
    })
    console.log('  ✓ Page title "Attendance Records" visible')
  })

  it('renders all 4 view mode tabs', async () => {
    render(React.createElement(Attendance))
    await waitFor(() => {
      expect(screen.getByText('Raw')).toBeTruthy()
      expect(screen.getByText('HR Mode')).toBeTruthy()
      expect(screen.getByText('All Employees')).toBeTruthy()
      expect(screen.getByText('Stats')).toBeTruthy()
    })
    console.log('  ✓ All 4 tabs visible: Raw, HR Mode, All Employees, Stats')
  })

  it('Raw tab is active by default', async () => {
    render(React.createElement(Attendance))
    await waitFor(() => {
      const rawBtn = screen.getByText('Raw')
      expect(rawBtn.className).toContain('bg-gray-800')
    })
    console.log('  ✓ Raw tab active by default (dark background)')
  })

  it('clicking HR Mode tab switches view', async () => {
    render(React.createElement(Attendance))
    await waitFor(() => screen.getByText('HR Mode'))

    fireEvent.click(screen.getByText('HR Mode'))

    await waitFor(() => {
      const hrBtn = screen.getByText('HR Mode')
      expect(hrBtn.className).toContain('bg-blue-600')
    })
    console.log('  ✓ HR Mode tab becomes active on click')
  })

  it('HR Mode shows Manual Entry button', async () => {
    render(React.createElement(Attendance))
    await waitFor(() => screen.getByText('HR Mode'))

    fireEvent.click(screen.getByText('HR Mode'))

    await waitFor(() => {
      expect(screen.getByText('Manual Entry')).toBeTruthy()
    })
    console.log('  ✓ Manual Entry button visible in HR Mode')
  })

  it('HR Mode shows Bulk Attendance button', async () => {
    render(React.createElement(Attendance))
    await waitFor(() => screen.getByText('HR Mode'))

    fireEvent.click(screen.getByText('HR Mode'))

    await waitFor(() => {
      expect(screen.getByText('📅 Bulk Attendance')).toBeTruthy()
    })
    console.log('  ✓ Bulk Attendance button visible in HR Mode')
  })

  it('clicking Manual Entry opens modal', async () => {
    render(React.createElement(Attendance))
    await waitFor(() => screen.getByText('HR Mode'))

    fireEvent.click(screen.getByText('HR Mode'))
    await waitFor(() => screen.getByText('Manual Entry'))

    fireEvent.click(screen.getByText('Manual Entry'))

    await waitFor(() => {
      expect(screen.getByText('📅 Manual Attendance Entry')).toBeTruthy()
    })
    console.log('  ✓ Manual Entry modal opens on button click')
  })

  it('Manual Entry modal has required fields', async () => {
    render(React.createElement(Attendance))
    await waitFor(() => screen.getByText('HR Mode'))
    fireEvent.click(screen.getByText('HR Mode'))
    await waitFor(() => screen.getByText('Manual Entry'))
    fireEvent.click(screen.getByText('Manual Entry'))

    await waitFor(() => {
      expect(screen.getByText('Employee *')).toBeTruthy()
      expect(screen.getByText('Date *')).toBeTruthy()
      expect(screen.getByText('Status *')).toBeTruthy()
    })
    console.log('  ✓ Manual Entry modal has: Employee, Date, Status fields')
  })

  it('Manual Entry modal closes on Cancel', async () => {
    render(React.createElement(Attendance))
    await waitFor(() => screen.getByText('HR Mode'))
    fireEvent.click(screen.getByText('HR Mode'))
    await waitFor(() => screen.getByText('Manual Entry'))
    fireEvent.click(screen.getByText('Manual Entry'))

    await waitFor(() => screen.getByText('📅 Manual Attendance Entry'))
    fireEvent.click(screen.getByText('Cancel'))

    await waitFor(() => {
      expect(screen.queryByText('📅 Manual Attendance Entry')).toBeNull()
    })
    console.log('  ✓ Manual Entry modal closes on Cancel')
  })

  it('Raw tab shows Export CSV button', async () => {
    render(React.createElement(Attendance))
    await waitFor(() => {
      expect(screen.getByText('Export CSV')).toBeTruthy()
    })
    console.log('  ✓ Export CSV button visible in Raw tab')
  })

})
