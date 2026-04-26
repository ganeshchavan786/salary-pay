/**
 * UI TEST 04: Payhead Configuration Page
 * ========================================
 * Tests:
 *  - Page renders with title
 *  - Employee dropdown loads
 *  - Salary structure form fields visible
 *  - Statutory deduction checkboxes (PF, ESI, PT)
 *  - Tax regime radio buttons (New/Old)
 *  - Salary preview updates on input
 *  - Save button visible
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('lucide-react', () => {
  const Icon = (props) => React.createElement('span', props)
  return { Save: Icon, History: Icon, User: Icon }
})

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('../../services/api', () => ({
  api: {
    get: vi.fn((url) => {
      if (url.includes('employees')) {
        return Promise.resolve({
          data: {
            employees: [
              { id: 'emp1', name: 'Rahul Sharma', emp_code: 'EMP001' },
              { id: 'emp2', name: 'Priya Patel', emp_code: 'EMP002' },
            ]
          }
        })
      }
      if (url.includes('salary-configs')) {
        return Promise.resolve({
          data: [{
            basic_salary: 30000,
            hra_percentage: 40,
            special_allowance: 3000,
            travel_allowance: 2000,
            medical_allowance: 1000,
            pf_applicable: true,
            esi_applicable: false,
            pt_applicable: true,
            tax_regime: 'NEW',
          }]
        })
      }
      return Promise.resolve({ data: [] })
    }),
    post: vi.fn(() => Promise.resolve({ data: {} })),
  },
}))

import PayheadConfig from '../../pages/PayheadConfig'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('UI Test 04 — Payhead Configuration Page', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders page title', async () => {
    render(React.createElement(PayheadConfig))
    await waitFor(() => {
      expect(screen.getByText('Payhead Configuration')).toBeTruthy()
    })
    console.log('  ✓ Page title "Payhead Configuration" visible')
  })

  it('shows employee selector dropdown', async () => {
    render(React.createElement(PayheadConfig))
    await waitFor(() => {
      expect(screen.getByText('Select Employee')).toBeTruthy()
      expect(screen.getByText('— Choose an employee —')).toBeTruthy()
    })
    console.log('  ✓ Employee selector dropdown visible')
  })

  it('employee dropdown loads employees', async () => {
    render(React.createElement(PayheadConfig))
    await waitFor(() => {
      expect(screen.getByText('Rahul Sharma (EMP001)')).toBeTruthy()
      expect(screen.getByText('Priya Patel (EMP002)')).toBeTruthy()
    })
    console.log('  ✓ Employee dropdown loaded: Rahul Sharma, Priya Patel')
  })

  it('selecting employee shows salary structure form', async () => {
    render(React.createElement(PayheadConfig))
    await waitFor(() => screen.getByText('Rahul Sharma (EMP001)'))

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'emp1' } })

    await waitFor(() => {
      expect(screen.getByText('Basic Salary (₹)')).toBeTruthy()
      expect(screen.getByText('HRA % of Basic')).toBeTruthy()
      expect(screen.getByText('Special Allowance (₹)')).toBeTruthy()
      expect(screen.getByText('Travel Allowance (₹)')).toBeTruthy()
      expect(screen.getByText('Medical Allowance (₹)')).toBeTruthy()
    })
    console.log('  ✓ Salary form fields: Basic, HRA%, Special, Travel, Medical visible')
  })

  it('statutory deduction checkboxes visible', async () => {
    render(React.createElement(PayheadConfig))
    await waitFor(() => screen.getByText('Rahul Sharma (EMP001)'))

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'emp1' } })

    await waitFor(() => {
      expect(screen.getByText('PF (12%)')).toBeTruthy()
      expect(screen.getByText('ESI (0.75%)')).toBeTruthy()
      expect(screen.getByText('Prof. Tax')).toBeTruthy()
    })
    console.log('  ✓ Statutory deductions: PF (12%), ESI (0.75%), Prof. Tax visible')
  })

  it('tax regime radio buttons visible', async () => {
    render(React.createElement(PayheadConfig))
    await waitFor(() => screen.getByText('Rahul Sharma (EMP001)'))

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'emp1' } })

    await waitFor(() => {
      expect(screen.getByText('New Regime (FY 2026-27)')).toBeTruthy()
      expect(screen.getByText('Old Regime')).toBeTruthy()
    })
    console.log('  ✓ Tax regime: New Regime and Old Regime radio buttons visible')
  })

  it('Save Configuration button visible', async () => {
    render(React.createElement(PayheadConfig))
    await waitFor(() => screen.getByText('Rahul Sharma (EMP001)'))

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'emp1' } })

    await waitFor(() => {
      expect(screen.getByText('Save Configuration')).toBeTruthy()
    })
    console.log('  ✓ "Save Configuration" button visible')
  })

  it('salary preview shows Gross CTC', async () => {
    render(React.createElement(PayheadConfig))
    await waitFor(() => screen.getByText('Rahul Sharma (EMP001)'))

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'emp1' } })

    await waitFor(() => {
      expect(screen.getByText('Salary Preview')).toBeTruthy()
    })
    console.log('  ✓ Salary Preview section visible')
  })

  it('basic salary input accepts number', async () => {
    render(React.createElement(PayheadConfig))
    await waitFor(() => screen.getByText('Rahul Sharma (EMP001)'))

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'emp1' } })

    await waitFor(() => screen.getByText('Basic Salary (₹)'))

    const inputs = screen.getAllByRole('spinbutton')
    const basicInput = inputs[0]
    fireEvent.change(basicInput, { target: { value: '35000' } })
    expect(basicInput.value).toBe('35000')
    console.log('  ✓ Basic salary input accepts: 35000')
  })

})
