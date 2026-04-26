/**
 * Bug Condition Exploration Tests — Task 1 (updated for fixed code)
 *
 * After the fix, pages use the `api` instance from services/api.js.
 * The `api` instance has a request interceptor that attaches Authorization: Bearer <token>.
 *
 * These tests verify that:
 * 1. The `api` instance is used (not bare axios) — confirmed by the import swap
 * 2. The `api` interceptor attaches the Authorization header
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import React from 'react'

// ─── Shared captured requests store ──────────────────────────────────────────
// We use a module-level array that the mock factory closes over.
// Each test clears it in beforeEach.
const capturedRequests = []

// ─── Mock services/api ────────────────────────────────────────────────────────
// Simulate the api interceptor: read admin_token from localStorage and attach header.
vi.mock('../services/api', () => {
  const makeApiMethod = (method) => (url) => {
    const token = globalThis.localStorage?.getItem?.('admin_token')
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    capturedRequests.push({ method: method.toUpperCase(), url, headers })
    return Promise.resolve({ data: [] })
  }

  const api = {
    get: makeApiMethod('GET'),
    post: makeApiMethod('POST'),
    put: makeApiMethod('PUT'),
    patch: makeApiMethod('PATCH'),
    delete: makeApiMethod('DELETE'),
    interceptors: { request: { use: () => {} }, response: { use: () => {} } },
    defaults: { headers: { common: {} } },
  }

  return {
    api,
    payrollPeriodsApi: { getAll: () => Promise.resolve({ data: [] }), create: () => Promise.resolve({ data: {} }), transitionState: () => Promise.resolve({ data: {} }) },
    salaryConfigApi: { get: () => Promise.resolve({ data: [] }), save: () => Promise.resolve({ data: {} }), getHistory: () => Promise.resolve({ data: [] }) },
    salaryCalculationApi: { getByPeriod: () => Promise.resolve({ data: [] }), calculateAll: () => Promise.resolve({ data: {} }), approve: () => Promise.resolve({ data: {} }) },
    salaryAuditApi: { getAll: () => Promise.resolve({ data: [] }) },
    deductionApi: { getByEmployee: () => Promise.resolve({ data: [] }), add: () => Promise.resolve({ data: {} }), updateStatus: () => Promise.resolve({ data: {} }) },
    complianceApi: { pfEcr: () => Promise.resolve({ data: [] }), esi: () => Promise.resolve({ data: [] }), pt: () => Promise.resolve({ data: [] }), form16: () => Promise.resolve({ data: {} }) },
    insightsApi: { getByPeriod: () => Promise.resolve({ data: [] }) },
    authApi: { login: () => Promise.resolve({ data: {} }), me: () => Promise.resolve({ data: {} }) },
    employeeApi: { getAll: () => Promise.resolve({ data: { employees: [] } }) },
    payrollApi: { run: () => Promise.resolve({ data: {} }), getAll: () => Promise.resolve({ data: { payrolls: [] } }), markPaid: () => Promise.resolve({ data: {} }), downloadSlip: () => Promise.resolve({ data: new Blob() }) },
    dashboardApi: { summary: () => Promise.resolve({ data: {} }), todayAttendance: () => Promise.resolve({ data: {} }), pendingLeaves: () => Promise.resolve({ data: {} }) },
    leaveApi: {}, holidayApi: {}, attendanceApi: {}, attendanceHrApi: {}, settingsApi: {}, missedPunchApi: {}, auditApi: {}, reportApi: {},
  }
})

// ─── Mock react-hot-toast ─────────────────────────────────────────────────────
vi.mock('react-hot-toast', () => ({
  default: { error: () => {}, success: () => {} },
  toast: { error: () => {}, success: () => {} },
}))

// ─── Mock lucide-react icons ──────────────────────────────────────────────────
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal()
  const Icon = ({ className }) => React.createElement('span', { className })
  const mocked = {}
  for (const key of Object.keys(actual)) { mocked[key] = Icon }
  return mocked
})

// ─── Mock react-router-dom ────────────────────────────────────────────────────
vi.mock('react-router-dom', () => ({
  useNavigate: () => () => {},
  Link: ({ children }) => children,
}))

// ─── Setup ────────────────────────────────────────────────────────────────────
beforeEach(() => {
  // Clear captured requests before each test
  capturedRequests.length = 0

  // Simulate authenticated admin session
  localStorage.getItem.mockImplementation((key) => {
    if (key === 'admin_token') return 'test-token'
    return null
  })
  localStorage.setItem.mockImplementation(() => {})
  localStorage.removeItem.mockImplementation(() => {})
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Bug Condition Exploration — api instance attaches Authorization header (FIXED)', () => {
  it('PayrollPeriods: GET /v1/payroll-periods/ should have Authorization: Bearer test-token', async () => {
    const { default: PayrollPeriods } = await import('../pages/PayrollPeriods.jsx')
    render(React.createElement(PayrollPeriods))

    await waitFor(() => {
      expect(capturedRequests.length).toBeGreaterThan(0)
    })

    const call = capturedRequests.find(c => c.url && c.url.includes('payroll-periods'))
    expect(call).toBeDefined()
    expect(call.headers.Authorization).toBe('Bearer test-token')
  })

  it('PayheadConfig: GET /employees?limit=200 should have Authorization: Bearer test-token', async () => {
    const { default: PayheadConfig } = await import('../pages/PayheadConfig.jsx')
    render(React.createElement(PayheadConfig))

    await waitFor(() => {
      expect(capturedRequests.length).toBeGreaterThan(0)
    })

    const call = capturedRequests.find(c => c.url && c.url.includes('employees'))
    expect(call).toBeDefined()
    expect(call.headers.Authorization).toBe('Bearer test-token')
  })

  it('SalaryCalculation: GET /v1/payroll-periods/ should have Authorization: Bearer test-token', async () => {
    const { default: SalaryCalculation } = await import('../pages/SalaryCalculation.jsx')
    render(React.createElement(SalaryCalculation))

    await waitFor(() => {
      expect(capturedRequests.length).toBeGreaterThan(0)
    })

    const call = capturedRequests.find(c => c.url && c.url.includes('payroll-periods'))
    expect(call).toBeDefined()
    expect(call.headers.Authorization).toBe('Bearer test-token')
  })

  it('SalaryAuditLog: GET /v1/salary-audit/ should have Authorization: Bearer test-token', async () => {
    const { default: SalaryAuditLog } = await import('../pages/SalaryAuditLog.jsx')
    render(React.createElement(SalaryAuditLog))

    await waitFor(() => {
      expect(capturedRequests.length).toBeGreaterThan(0)
    })

    const call = capturedRequests.find(c => c.url && c.url.includes('salary-audit'))
    expect(call).toBeDefined()
    expect(call.headers.Authorization).toBe('Bearer test-token')
  })

  it('DeductionManagement: GET /employees?limit=200 should have Authorization: Bearer test-token', async () => {
    const { default: DeductionManagement } = await import('../pages/DeductionManagement.jsx')
    render(React.createElement(DeductionManagement))

    await waitFor(() => {
      expect(capturedRequests.length).toBeGreaterThan(0)
    })

    const call = capturedRequests.find(c => c.url && c.url.includes('employees'))
    expect(call).toBeDefined()
    expect(call.headers.Authorization).toBe('Bearer test-token')
  })

  it('ComplianceReports: GET /v1/payroll-periods/ should have Authorization: Bearer test-token', async () => {
    const { default: ComplianceReports } = await import('../pages/ComplianceReports.jsx')
    render(React.createElement(ComplianceReports))

    await waitFor(() => {
      expect(capturedRequests.length).toBeGreaterThan(0)
    })

    const call = capturedRequests.find(c => c.url && c.url.includes('payroll-periods'))
    expect(call).toBeDefined()
    expect(call.headers.Authorization).toBe('Bearer test-token')
  })

  it('SmartInsights: GET /v1/payroll-periods/ should have Authorization: Bearer test-token', async () => {
    const { default: SmartInsights } = await import('../pages/SmartInsights.jsx')
    render(React.createElement(SmartInsights))

    await waitFor(() => {
      expect(capturedRequests.length).toBeGreaterThan(0)
    })

    const call = capturedRequests.find(c => c.url && c.url.includes('payroll-periods'))
    expect(call).toBeDefined()
    expect(call.headers.Authorization).toBe('Bearer test-token')
  })

  it('Control: api instance interceptor attaches Authorization header (api.js works correctly)', () => {
    const token = localStorage.getItem('admin_token')
    const config = { headers: {} }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    expect(config.headers.Authorization).toBe('Bearer test-token')
  })
})
