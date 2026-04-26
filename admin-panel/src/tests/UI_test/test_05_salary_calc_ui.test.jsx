/**
 * UI TEST 05: Salary Calculation Page
 * =====================================
 * Tests:
 *  - Page renders with title
 *  - Payroll Period dropdown loads
 *  - Refresh and Calculate All buttons visible
 *  - Empty state message shown
 *  - Summary cards (Gross, Deductions, Net)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('lucide-react', () => {
  const Icon = (props) => React.createElement('span', props)
  return { Play: Icon, CheckCircle: Icon, AlertCircle: Icon, RefreshCw: Icon }
})

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('../../services/api', () => ({
  api: {
    get: vi.fn((url) => {
      if (url.includes('payroll-periods')) {
        return Promise.resolve({
          data: [
            { id: 'p1', period_name: 'April 2026', state: 'OPEN' },
            { id: 'p2', period_name: 'March 2026', state: 'LOCKED' },
          ]
        })
      }
      if (url.includes('salary-calculations')) {
        return Promise.resolve({
          data: [
            {
              id: 'c1', emp_name: 'Rahul Sharma', emp_code: 'EMP001',
              gross_salary: 47000, total_deductions: 2000, net_salary: 45000,
              status: 'CALCULATED',
            },
            {
              id: 'c2', emp_name: 'Priya Patel', emp_code: 'EMP002',
              gross_salary: 35000, total_deductions: 1800, net_salary: 33200,
              status: 'APPROVED',
            },
          ]
        })
      }
      return Promise.resolve({ data: [] })
    }),
    post: vi.fn(() => Promise.resolve({
      data: { processed: 2, errors: 0 }
    })),
    patch: vi.fn(() => Promise.resolve({ data: {} })),
  },
}))

import SalaryCalculation from '../../pages/SalaryCalculation'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('UI Test 05 — Salary Calculation Page', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders page title', async () => {
    render(React.createElement(SalaryCalculation))
    await waitFor(() => {
      expect(screen.getByText('Salary Calculation')).toBeTruthy()
    })
    console.log('  ✓ Page title "Salary Calculation" visible')
  })

  it('shows Payroll Period label', async () => {
    render(React.createElement(SalaryCalculation))
    await waitFor(() => {
      expect(screen.getByText('Payroll Period')).toBeTruthy()
    })
    console.log('  ✓ "Payroll Period" label visible')
  })

  it('payroll period dropdown loads periods', async () => {
    render(React.createElement(SalaryCalculation))
    await waitFor(() => {
      expect(screen.getByText('April 2026')).toBeTruthy()
    })
    console.log('  ✓ Payroll period dropdown loaded: April 2026')
  })

  it('Refresh button visible', async () => {
    render(React.createElement(SalaryCalculation))
    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeTruthy()
    })
    console.log('  ✓ Refresh button visible')
  })

  it('Calculate All button visible', async () => {
    render(React.createElement(SalaryCalculation))
    await waitFor(() => {
      expect(screen.getByText('Calculate All')).toBeTruthy()
    })
    console.log('  ✓ "Calculate All" button visible')
  })

  it('shows calculation results table with employees', async () => {
    render(React.createElement(SalaryCalculation))
    await waitFor(() => {
      expect(screen.getByText('Rahul Sharma')).toBeTruthy()
      expect(screen.getByText('Priya Patel')).toBeTruthy()
    })
    console.log('  ✓ Results table shows: Rahul Sharma, Priya Patel')
  })

  it('shows employee codes in results', async () => {
    render(React.createElement(SalaryCalculation))
    await waitFor(() => {
      expect(screen.getByText('EMP001')).toBeTruthy()
      expect(screen.getByText('EMP002')).toBeTruthy()
    })
    console.log('  ✓ Employee codes visible: EMP001, EMP002')
  })

  it('shows calculation status badges', async () => {
    render(React.createElement(SalaryCalculation))
    await waitFor(() => {
      expect(screen.getByText('CALCULATED')).toBeTruthy()
      expect(screen.getByText('APPROVED')).toBeTruthy()
    })
    console.log('  ✓ Status badges: CALCULATED, APPROVED visible')
  })

  it('shows summary cards (Gross, Deductions, Net)', async () => {
    render(React.createElement(SalaryCalculation))
    await waitFor(() => {
      expect(screen.getByText('Total Gross')).toBeTruthy()
      expect(screen.getByText('Total Deductions')).toBeTruthy()
      expect(screen.getByText('Total Net Pay')).toBeTruthy()
    })
    console.log('  ✓ Summary cards: Total Gross, Total Deductions, Total Net Pay visible')
  })

  it('Approve button visible for CALCULATED status', async () => {
    render(React.createElement(SalaryCalculation))
    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeTruthy()
    })
    console.log('  ✓ Approve button visible for CALCULATED salary')
  })

  it('shows result count in header', async () => {
    render(React.createElement(SalaryCalculation))
    await waitFor(() => {
      expect(screen.getByText(/Calculation Results/)).toBeTruthy()
    })
    console.log('  ✓ "Calculation Results" header visible with count')
  })

})
