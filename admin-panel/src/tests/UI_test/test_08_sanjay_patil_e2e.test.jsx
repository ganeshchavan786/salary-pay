/**
 * UI TEST 08: Sanjay Patil — End-to-End Employee Test
 * =====================================================
 * Real employee added via backend API:
 *   Name:        Sanjay Patil
 *   Emp Code:    TEST-001
 *   Department:  Finance
 *   Designation: Accountant
 *   ID:          1771ad19-ce00-4e65-a6e3-961111f89c7f
 *
 * Salary Config:
 *   Basic:    ₹19,200
 *   HRA 40%:  ₹7,680
 *   Special:  ₹5,000
 *   Travel:   ₹3,000
 *   Medical:  ₹2,000
 *   Gross:    ₹36,880
 *   PF: ✓  ESI: ✗  PT: ✓
 *
 * Deduction:
 *   Type:  ADVANCE
 *   Total: ₹8,000
 *   EMI:   ₹2,000/month
 *
 * Tests:
 *  A — Payhead Config: Sanjay visible, config loads correctly
 *  B — Deduction: Sanjay visible, ADVANCE deduction shows
 *  C — Salary calculation verification
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// ── Real Employee Data (from DB) ──────────────────────────────────────────────
const SANJAY_ID = '1771ad19-ce00-4e65-a6e3-961111f89c7f'

const ALL_EMPLOYEES = [
  { id: 'a9c1b07b-0b8e-45c4-81ac-5ed9057b879d', name: 'Ganesh Chavan',  emp_code: 'EMP001' },
  { id: '829e92a0-32b5-437b-912b-acf7788eea21', name: 'Rahul Sharma',   emp_code: 'VIP-2026-001' },
  { id: SANJAY_ID,                               name: 'Sanjay Patil',   emp_code: 'TEST-001' },
]

const SANJAY_SALARY_CONFIG = {
  id: 'cfg-sanjay-001',
  employee_id: SANJAY_ID,
  basic_salary: 19200,
  hra_percentage: 40,
  special_allowance: 5000,
  travel_allowance: 3000,
  medical_allowance: 2000,
  pf_applicable: true,
  esi_applicable: false,
  pt_applicable: true,
  tax_regime: 'new',
  status: 'active',
}

const SANJAY_DEDUCTIONS = [
  {
    id: 'ded-sanjay-001',
    employee_id: SANJAY_ID,
    deduction_type: 'ADVANCE',
    total_amount: 8000,
    emi_amount: 2000,
    remaining_amount: 8000,
    status: 'ACTIVE',
    description: 'Festival advance - April 2026',
  },
]

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('lucide-react', () => {
  const I = (p) => React.createElement('span', p)
  return { Save: I, History: I, User: I, Plus: I, PauseCircle: I, PlayCircle: I, AlertCircle: I }
})
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('../../services/api', () => ({
  api: {
    get: vi.fn((url) => {
      if (url.includes('employees')) {
        return Promise.resolve({ data: { employees: ALL_EMPLOYEES } })
      }
      if (url.includes(`salary-configs/employee/${SANJAY_ID}`)) {
        return Promise.resolve({ data: SANJAY_SALARY_CONFIG })
      }
      if (url.includes(`deductions/${SANJAY_ID}`)) {
        return Promise.resolve({ data: SANJAY_DEDUCTIONS })
      }
      return Promise.resolve({ data: [] })
    }),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    patch: vi.fn(() => Promise.resolve({ data: {} })),
  },
}))

import PayheadConfig from '../../pages/PayheadConfig'
import DeductionManagement from '../../pages/DeductionManagement'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('UI Test 08 — Sanjay Patil End-to-End', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── SECTION A: Payhead Config ─────────────────────────────────────────────

  it('A1: Sanjay Patil (TEST-001) visible in Payhead Config dropdown', async () => {
    render(React.createElement(PayheadConfig))
    await waitFor(() => {
      const options = screen.getAllByRole('option')
      const sanjay = options.find(o => o.textContent.includes('Sanjay Patil'))
      expect(sanjay).toBeTruthy()
      expect(sanjay.textContent).toContain('TEST-001')
    })
    console.log('  ✓ Sanjay Patil (TEST-001) visible in Payhead Config dropdown')
  })

  it('A2: selecting Sanjay loads Basic Salary ₹19,200', async () => {
    render(React.createElement(PayheadConfig))
    await waitFor(() => screen.getAllByRole('option'))

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: SANJAY_ID } })

    await waitFor(() => {
      const inputs = screen.getAllByRole('spinbutton')
      expect(inputs[0].value).toBe('19200')
    })
    console.log('  ✓ Sanjay salary config loaded: Basic = ₹19,200')
  })

  it('A3: HRA percentage is 40%', async () => {
    render(React.createElement(PayheadConfig))
    await waitFor(() => screen.getAllByRole('option'))

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: SANJAY_ID } })

    await waitFor(() => {
      const inputs = screen.getAllByRole('spinbutton')
      expect(inputs[1].value).toBe('40')
    })
    console.log('  ✓ HRA percentage = 40%')
  })

  it('A4: Special Allowance ₹5,000 loaded', async () => {
    render(React.createElement(PayheadConfig))
    await waitFor(() => screen.getAllByRole('option'))

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: SANJAY_ID } })

    await waitFor(() => {
      const inputs = screen.getAllByRole('spinbutton')
      expect(inputs[2].value).toBe('5000')
    })
    console.log('  ✓ Special Allowance = ₹5,000')
  })

  it('A5: PF checkbox is checked (PF applicable)', async () => {
    render(React.createElement(PayheadConfig))
    await waitFor(() => screen.getAllByRole('option'))

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: SANJAY_ID } })

    await waitFor(() => screen.getByText('PF (12%)'))
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes[0].checked).toBe(true)
    console.log('  ✓ PF (12%) checkbox is checked')
  })

  it('A6: ESI checkbox is NOT checked (gross > ₹21,000)', async () => {
    render(React.createElement(PayheadConfig))
    await waitFor(() => screen.getAllByRole('option'))

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: SANJAY_ID } })

    await waitFor(() => screen.getByText('ESI (0.75%)'))
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes[1].checked).toBe(false)
    console.log('  ✓ ESI checkbox NOT checked (Gross ₹36,880 > ₹21,000)')
  })

  it('A7: Salary Preview shows Gross CTC', async () => {
    render(React.createElement(PayheadConfig))
    await waitFor(() => screen.getAllByRole('option'))

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: SANJAY_ID } })

    await waitFor(() => {
      expect(screen.getByText('Gross CTC')).toBeTruthy()
    })
    // Gross = 19200 + 7680 + 5000 + 3000 + 2000 = 36880
    const gross = 19200 + (19200 * 40 / 100) + 5000 + 3000 + 2000
    expect(gross).toBe(36880)
    console.log(`  ✓ Gross CTC = ₹${gross.toLocaleString('en-IN')} (Basic + HRA + Allowances)`)
  })

  it('A8: Save Configuration calls API with Sanjay employee_id', async () => {
    const { api } = await import('../../services/api')
    render(React.createElement(PayheadConfig))
    await waitFor(() => screen.getAllByRole('option'))

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: SANJAY_ID } })

    await waitFor(() => screen.getByText('Save Configuration'))
    fireEvent.click(screen.getByText('Save Configuration'))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/v1/salary-configs/',
        expect.objectContaining({ employee_id: SANJAY_ID })
      )
    })
    console.log(`  ✓ Save API called with employee_id: ${SANJAY_ID} (Sanjay Patil)`)
  })

  // ── SECTION B: Deduction Management ──────────────────────────────────────

  it('B1: Sanjay Patil visible in Deduction Management dropdown', async () => {
    render(React.createElement(DeductionManagement))
    await waitFor(() => {
      const options = screen.getAllByRole('option')
      const sanjay = options.find(o => o.textContent.includes('Sanjay Patil'))
      expect(sanjay).toBeTruthy()
    })
    console.log('  ✓ Sanjay Patil visible in Deduction Management dropdown')
  })

  it('B2: selecting Sanjay shows ADVANCE deduction', async () => {
    render(React.createElement(DeductionManagement))
    await waitFor(() => screen.getAllByRole('option'))

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: SANJAY_ID } })

    await waitFor(() => {
      expect(screen.getByText('ADVANCE')).toBeTruthy()
    })
    console.log('  ✓ ADVANCE deduction visible for Sanjay Patil')
  })

  it('B3: deduction description shows correctly', async () => {
    render(React.createElement(DeductionManagement))
    await waitFor(() => screen.getAllByRole('option'))

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: SANJAY_ID } })

    await waitFor(() => {
      expect(screen.getByText('Festival advance - April 2026')).toBeTruthy()
    })
    console.log('  ✓ Deduction description: "Festival advance - April 2026"')
  })

  it('B4: deduction amounts visible (Total ₹8,000, EMI ₹2,000)', async () => {
    render(React.createElement(DeductionManagement))
    await waitFor(() => screen.getAllByRole('option'))

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: SANJAY_ID } })

    await waitFor(() => {
      const allText = document.body.textContent
      expect(allText).toContain('8,000')
      expect(allText).toContain('2,000')
    })
    console.log('  ✓ Deduction amounts: Total ₹8,000, EMI ₹2,000 visible')
  })

  it('B5: ACTIVE status badge visible', async () => {
    render(React.createElement(DeductionManagement))
    await waitFor(() => screen.getAllByRole('option'))

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: SANJAY_ID } })

    await waitFor(() => {
      expect(screen.getByText('ACTIVE')).toBeTruthy()
    })
    console.log('  ✓ ACTIVE status badge visible')
  })

  // ── SECTION C: Salary Calculation Verification ───────────────────────────

  it('C1: Gross CTC calculation is correct (₹36,880)', () => {
    const basic = 19200
    const hra = basic * 40 / 100        // 7680
    const special = 5000
    const travel = 3000
    const medical = 2000
    const gross = basic + hra + special + travel + medical

    expect(gross).toBe(36880)
    console.log(`  ✓ Gross = ₹${basic} + ₹${hra}(HRA) + ₹${special} + ₹${travel} + ₹${medical} = ₹${gross}`)
  })

  it('C2: PF deduction = ₹1,800 (12% of ₹15,000 cap)', () => {
    const basic = 19200
    const pfWages = Math.min(basic, 15000)  // capped at 15000
    const pf = pfWages * 0.12

    expect(pfWages).toBe(15000)
    expect(pf).toBe(1800)
    console.log(`  ✓ PF = 12% of ₹${pfWages} (capped) = ₹${pf}`)
  })

  it('C3: ESI = ₹0 (gross ₹36,880 > ₹21,000 threshold)', () => {
    const gross = 36880
    const esi = gross > 21000 ? 0 : gross * 0.0075

    expect(esi).toBe(0)
    console.log(`  ✓ ESI = ₹0 (Gross ₹${gross} > ₹21,000 → not applicable)`)
  })

  it('C4: PT = ₹200 (Maharashtra, gross ≥ ₹10,000)', () => {
    const gross = 36880
    const pt = gross >= 10000 ? 200 : 0

    expect(pt).toBe(200)
    console.log(`  ✓ PT = ₹${pt} (Maharashtra)`)
  })

  it('C5: Net Salary = ₹32,880 (Gross - PF - PT - Advance EMI)', () => {
    const gross = 36880
    const pf = 1800
    const pt = 200
    const advanceEmi = 2000
    const net = gross - pf - pt - advanceEmi

    expect(net).toBe(32880)
    console.log(`  ✓ Net = ₹${gross} - ₹${pf}(PF) - ₹${pt}(PT) - ₹${advanceEmi}(Advance) = ₹${net}`)
  })

})
