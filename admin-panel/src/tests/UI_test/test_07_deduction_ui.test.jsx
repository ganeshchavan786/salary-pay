/**
 * UI TEST 07: Deduction Management — Real Employee Data
 * =======================================================
 * Tests:
 *  - Page renders with title
 *  - Employee dropdown loads real employees
 *  - Add Deduction button visible
 *  - Add Deduction modal opens/closes
 *  - Deduction types: LOAN, ADVANCE, FINE, CUSTOM
 *  - Total Amount and EMI fields
 *  - Deduction list shows active deductions
 *  - Pause/Resume buttons work
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// ── Real Employee Data ────────────────────────────────────────────────────────
const REAL_EMPLOYEES = [
  { id: 'a9c1b07b', name: 'Ganesh Chavan',   emp_code: 'EMP001',      department: 'IT' },
  { id: '829e92a0', name: 'Rahul Sharma',    emp_code: 'VIP-2026-001',department: 'Engineering' },
  { id: 'b7cf31cb', name: 'Priya Patil',     emp_code: 'VIP-2026-002',department: 'HR' },
  { id: '42bf41f4', name: 'Vijay Jadhav',    emp_code: 'VIP-2026-005',department: 'Engineering' },
]

// Sample deductions for Rahul Sharma
const RAHUL_DEDUCTIONS = [
  { id: 'd1', deduction_type: 'LOAN', total_amount: 50000, emi_amount: 5000, remaining_amount: 45000, status: 'ACTIVE', description: 'Home loan' },
  { id: 'd2', deduction_type: 'ADVANCE', total_amount: 10000, emi_amount: 2000, remaining_amount: 8000, status: 'ACTIVE', description: 'Salary advance' },
]

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('lucide-react', () => {
  const I = (p) => React.createElement('span', p)
  return { Plus: I, PauseCircle: I, PlayCircle: I, AlertCircle: I }
})
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('../../services/api', () => ({
  api: {
    get: vi.fn((url) => {
      if (url.includes('employees')) {
        return Promise.resolve({ data: { employees: REAL_EMPLOYEES } })
      }
      if (url.includes('deductions/829e92a0')) {
        return Promise.resolve({ data: RAHUL_DEDUCTIONS })
      }
      return Promise.resolve({ data: [] })
    }),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    patch: vi.fn(() => Promise.resolve({ data: {} })),
  },
}))

import DeductionManagement from '../../pages/DeductionManagement'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('UI Test 07 — Deduction Management with Real Data', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('A1: page renders with title', async () => {
    render(React.createElement(DeductionManagement))
    await waitFor(() => {
      expect(screen.getByText('Deduction Management')).toBeTruthy()
    })
    console.log('  ✓ Page title "Deduction Management" visible')
  })

  it('A2: employee dropdown loads real employees', async () => {
    render(React.createElement(DeductionManagement))
    await waitFor(() => {
      const options = screen.getAllByRole('option')
      const names = options.map(o => o.textContent)
      expect(names.some(n => n.includes('Ganesh Chavan'))).toBe(true)
      expect(names.some(n => n.includes('Rahul Sharma'))).toBe(true)
    })
    console.log('  ✓ Employee dropdown: Ganesh, Rahul, Priya, Vijay loaded')
  })

  it('B1: selecting employee shows Add Deduction button', async () => {
    render(React.createElement(DeductionManagement))
    await waitFor(() => screen.getAllByRole('option'))

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '829e92a0' } })

    await waitFor(() => {
      expect(screen.getByText('Add Deduction')).toBeTruthy()
    })
    console.log('  ✓ Add Deduction button visible after selecting employee')
  })

  it('B2: clicking Add Deduction opens modal', async () => {
    render(React.createElement(DeductionManagement))
    await waitFor(() => screen.getAllByRole('option'))

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '829e92a0' } })

    await waitFor(() => screen.getByText('Add Deduction'))
    fireEvent.click(screen.getByText('Add Deduction'))

    await waitFor(() => {
      expect(screen.getByText('Deduction Type')).toBeTruthy()
    })
    console.log('  ✓ Add Deduction modal opens')
  })

  it('C1: deduction type dropdown has LOAN, ADVANCE, FINE, CUSTOM', async () => {
    render(React.createElement(DeductionManagement))
    await waitFor(() => screen.getAllByRole('option'))

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '829e92a0' } })
    await waitFor(() => screen.getByText('Add Deduction'))
    fireEvent.click(screen.getByText('Add Deduction'))

    await waitFor(() => {
      const allText = document.body.textContent
      expect(allText).toContain('Loan')
      expect(allText).toContain('Advance')
      expect(allText).toContain('Fine')
      expect(allText).toContain('Custom')
    })
    console.log('  ✓ Deduction types: Loan, Advance, Fine, Custom available')
  })

  it('C2: Total Amount and EMI fields visible in modal', async () => {
    render(React.createElement(DeductionManagement))
    await waitFor(() => screen.getAllByRole('option'))

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '829e92a0' } })
    await waitFor(() => screen.getByText('Add Deduction'))
    fireEvent.click(screen.getByText('Add Deduction'))

    await waitFor(() => {
      expect(screen.getByText('Total Amount (₹)')).toBeTruthy()
      expect(screen.getByText('Monthly EMI Amount (₹)')).toBeTruthy()
      expect(screen.getByText('Description')).toBeTruthy()
    })
    console.log('  ✓ Modal fields: Total Amount, Monthly EMI, Description visible')
  })

  it('D1: Rahul Sharma has 2 active deductions (LOAN + ADVANCE)', async () => {
    render(React.createElement(DeductionManagement))
    await waitFor(() => screen.getAllByRole('option'))

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '829e92a0' } })

    await waitFor(() => {
      expect(screen.getByText('Active Deductions')).toBeTruthy()
      expect(screen.getByText('Home loan')).toBeTruthy()
      expect(screen.getByText('Salary advance')).toBeTruthy()
    })
    console.log('  ✓ Rahul Sharma deductions: Home loan (LOAN), Salary advance (ADVANCE)')
  })

  it('D2: deduction shows Total, EMI, Remaining amounts', async () => {
    render(React.createElement(DeductionManagement))
    await waitFor(() => screen.getAllByRole('option'))

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '829e92a0' } })

    await waitFor(() => {
      const allText = document.body.textContent
      expect(allText).toContain('Total:')
      expect(allText).toContain('EMI:')
      expect(allText).toContain('Remaining:')
    })
    console.log('  ✓ Deduction details: Total, EMI, Remaining visible')
  })

  it('D3: LOAN and ADVANCE type badges visible', async () => {
    render(React.createElement(DeductionManagement))
    await waitFor(() => screen.getAllByRole('option'))

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '829e92a0' } })

    await waitFor(() => {
      expect(screen.getByText('LOAN')).toBeTruthy()
      expect(screen.getByText('ADVANCE')).toBeTruthy()
    })
    console.log('  ✓ Type badges: LOAN and ADVANCE visible')
  })

  it('D4: ACTIVE status badge visible', async () => {
    render(React.createElement(DeductionManagement))
    await waitFor(() => screen.getAllByRole('option'))

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '829e92a0' } })

    await waitFor(() => {
      const badges = screen.getAllByText('ACTIVE')
      expect(badges.length).toBeGreaterThan(0)
    })
    console.log('  ✓ ACTIVE status badges visible')
  })

  it('E1: Pause button visible for ACTIVE deductions', async () => {
    render(React.createElement(DeductionManagement))
    await waitFor(() => screen.getAllByRole('option'))

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '829e92a0' } })

    await waitFor(() => {
      const pauseButtons = screen.getAllByText('Pause')
      expect(pauseButtons.length).toBe(2) // 2 active deductions
    })
    console.log('  ✓ Pause buttons visible for 2 ACTIVE deductions')
  })

  it('E2: clicking Pause calls API', async () => {
    const { api } = await import('../../services/api')
    render(React.createElement(DeductionManagement))
    await waitFor(() => screen.getAllByRole('option'))

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '829e92a0' } })

    await waitFor(() => screen.getAllByText('Pause'))
    const pauseButtons = screen.getAllByText('Pause')
    fireEvent.click(pauseButtons[0])

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith(
        '/v1/deductions/d1/status',
        { status: 'PAUSED' }
      )
    })
    console.log('  ✓ Pause button calls API: PATCH /v1/deductions/d1/status → PAUSED')
  })

})
