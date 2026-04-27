import axios from 'axios'

// Support zrok/ngrok: set VITE_API_BASE_URL in .env.local
// e.g. VITE_API_BASE_URL=https://xxxx.zrok.io/api
// Falls back to '/api' for local dev
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'

export const api = axios.create({ baseURL })

// Module-level state for queue-based token refresh
let isRefreshing = false
let failedQueue = []

// Helper function to process queued requests after refresh completes
function processQueue(error, token = null) {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // Log outgoing requests for debugging (can be removed in production)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
        hasAuth: !!config.headers.Authorization
      })
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => {
    // Validate response data exists
    if (response.data === null || response.data === undefined) {
      console.warn(`[API Response] ${response.config.url} returned null/undefined data`)
      response.data = {}
    }
    return response
  },
  async (error) => {
    const originalRequest = error.config

    // Log errors for debugging
    if (process.env.NODE_ENV === 'development') {
      console.error(`[API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
        status: error.response?.status,
        message: error.response?.data?.detail || error.message
      })
    }

    // Only handle 401 errors
    if (error.response?.status !== 401) {
      return Promise.reject(error)
    }

    // If already refreshing, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then(token => {
        originalRequest.headers.Authorization = `Bearer ${token}`
        return api(originalRequest)
      }).catch(err => {
        return Promise.reject(err)
      })
    }

    // Start refresh process
    isRefreshing = true
    const refreshToken = localStorage.getItem('admin_refresh_token')

    if (!refreshToken) {
      // No refresh token available, logout
      isRefreshing = false
      processQueue(new Error('No refresh token'), null)
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_refresh_token')
      localStorage.removeItem('admin_user')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    try {
      // Attempt to refresh the token
      const response = await axios.post('/api/auth/refresh', {
        refresh_token: refreshToken
      })

      const newAccessToken = response.data.access_token
      localStorage.setItem('admin_token', newAccessToken)

      // If a new refresh token is provided, update it
      if (response.data.refresh_token) {
        localStorage.setItem('admin_refresh_token', response.data.refresh_token)
      }

      // Update the original request with new token
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`

      // Process queued requests with new token
      processQueue(null, newAccessToken)
      isRefreshing = false

      // Retry the original request
      return api(originalRequest)
    } catch (refreshError) {
      // Refresh failed, logout user
      processQueue(refreshError, null)
      isRefreshing = false
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_refresh_token')
      localStorage.removeItem('admin_user')
      window.location.href = '/login'
      return Promise.reject(refreshError)
    }
  }
)

export const authApi = {
  login: (username, password) => {
    const formData = new FormData()
    formData.append('username', username)
    formData.append('password', password)
    return api.post('/auth/login', formData)
  },
  me: () => api.get('/auth/me')
}

export const employeeApi = {
  getAll: (params) => api.get('/employees', { params }),
  getById: (id) => api.get(`/employees/${id}`),
  create: (data) => api.post('/employees', data),
  update: (id, data) => api.put(`/employees/${id}`, data),
  delete: (id) => api.delete(`/employees/${id}`),
  confirm: (id) => api.put(`/employees/${id}/confirm`),
  enrollFace: (id, descriptors) => api.post(`/employees/${id}/enroll-face`, { face_descriptors: descriptors }),
  getFaceStatus: (id) => api.get(`/employees/${id}/face-status`),
  deleteFace: (id) => api.delete(`/employees/${id}/face`),
  // Photo
  uploadPhoto: (id, photoData) => api.post(`/employees/${id}/photo`, { photo_data: photoData }),
  deletePhoto: (id) => api.delete(`/employees/${id}/photo`),
  // Bulk operations
  bulkImport: (formData) => api.post('/employees/bulk-import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  bulkAction: (action, empIds) => api.post('/employees/bulk-action', { action, emp_ids: empIds }),
  // Summary & export
  getSummary: () => api.get('/employees/summary'),
  export: (params) => api.get('/employees/export', { params, responseType: 'blob' }),
  // Reports
  reportDepartment: () => api.get('/employees/reports/department'),
  reportHeadcount: () => api.get('/employees/reports/headcount'),
  reportSalary: () => api.get('/employees/reports/salary'),
  reportProbation: () => api.get('/employees/reports/probation'),
  // Policy override
  getPolicy: (id) => api.get(`/employees/${id}/policy`),
  setPolicy: (id, data) => api.put(`/employees/${id}/policy`, data),
  resetPolicy: (id) => api.delete(`/employees/${id}/policy`),
}

export const attendanceApi = {
  getAll: (params) => api.get('/attendance', { params }),
  getSummary: (params) => api.get('/attendance/summary', { params })
}

export const leaveApi = {
  getAll: (params) => api.get('/leaves', { params }),
  getBalance: (empId, params) => api.get(`/leaves/balance/${empId}`, { params }),
  apply: (data) => api.post('/leaves', data),
  approve: (id, data = {}) => api.put(`/leaves/${id}/approve`, data),
  reject: (id, data = {}) => api.put(`/leaves/${id}/reject`, data),
  // New
  getStats: () => api.get('/leaves/stats'),
  cancel: (id) => api.put(`/leaves/${id}/cancel`),
  bulkAction: (data) => api.post('/leaves/bulk-action', data),
  getBalances: () => api.get('/leaves/balances'),
  updateBalance: (empId, data) => api.put(`/leaves/balance/${empId}`, data),
  getReportSummary: (year) => api.get('/leaves/report/summary', { params: { year } }),
  getReportMonthly: (year) => api.get('/leaves/report/monthly', { params: { year } }),
}

export const holidayApi = {
  getAll: (year) => api.get('/holidays', { params: { year } }),
  create: (data) => api.post('/holidays', data),
  delete: (id) => api.delete(`/holidays/${id}`),
  // New
  getStats: (year) => api.get('/holidays/stats', { params: { year } }),
  getUpcoming: () => api.get('/holidays/upcoming'),
  bulkDelete: (ids) => api.post('/holidays/bulk-delete', { ids }),
  copyToNextYear: (fromYear) => api.post('/holidays/copy-to-next-year', null, { params: { from_year: fromYear } }),
  importCsv: (formData) => api.post('/holidays/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, data) => api.put(`/holidays/${id}`, data),
  seed: (year) => api.post(`/holidays/seed-${year}`),
}

export const payrollApi = {
  run: (month, year) => api.post('/payroll/run', { month, year }),
  getAll: (params) => api.get('/payroll', { params }),
  getHistory: (empId) => api.get(`/payroll/${empId}/history`),
  markPaid: (id) => api.put(`/payroll/${id}/mark-paid`),
  downloadSlip: (id) => api.get(`/payroll/${id}/slip`, { responseType: 'blob' }),
}

export const dashboardApi = {
  summary: () => api.get('/dashboard/summary'),
  todayAttendance: () => api.get('/dashboard/today-attendance'),
  pendingLeaves: () => api.get('/dashboard/pending-leaves'),
}

export const attendanceHrApi = {
  getDaily: (empId, month, year) => api.get(`/attendance/daily/${empId}`, { params: { month, year } }),
  manualEntry: (data) => api.post('/attendance/manual', data),
  override: (id, status, note) => api.put(`/attendance/daily/${id}/override`, { status, note }),
  getAudit: (id) => api.get(`/attendance/daily/${id}/audit`),
  monthlyReport: (month, year) => api.get('/attendance/daily/report/monthly', { params: { month, year } }),
  // Advanced attendance features
  bulkSave: (data) => api.post('/attendance/bulk-save', data),
  monthlyAll: (month, year) => api.get('/attendance/monthly-all', { params: { month, year } }),
  workingDays: (month, year) => api.get('/attendance/working-days', { params: { month, year } }),
  export: (params) => api.get('/attendance/export', { params, responseType: 'blob' }),
  stats: (month, year) => api.get('/attendance/stats', { params: { month, year } }),
}

export const settingsApi = {
  getPolicy: () => api.get('/settings/policy'),
  updatePolicy: (data) => api.put('/settings/policy', data),
  getSmtp: () => api.get('/settings/smtp'),
  updateSmtp: (data) => api.put('/settings/smtp', data),
  testSmtp: (data) => api.post('/settings/smtp/test', data),
}

export const missedPunchApi = {
  submit: (data) => api.post('/attendance/missed-punch', data),
  getAll: (params) => api.get('/attendance/missed-punch', { params }),
  approve: (id) => api.put(`/attendance/missed-punch/${id}/approve`),
  reject: (id, reason) => api.put(`/attendance/missed-punch/${id}/reject`, { reason }),
}

export const auditApi = {
  getAll: (params) => api.get('/audit/all', { params }),
  getEmployee: (empId, params) => api.get(`/audit/employee/${empId}`, { params }),
}

export const reportApi = {
  // Dashboard
  dashboardToday: () => api.get('/reports/dashboard/today'),
  insights: () => api.get('/reports/insights'),

  // Employee reports
  employeeAttendanceSummary: (params) => api.get('/reports/employee-attendance-summary', { params }),
  employeeWorkingHours: (params) => api.get('/reports/employee-working-hours', { params }),
  employeeInOut: (params) => api.get('/reports/employee-inout', { params }),
  employeeLateMarks: (params) => api.get('/reports/employee-late-marks', { params }),
  employeeOT: (params) => api.get('/reports/employee-ot', { params }),
  employeeHalfdayAbsent: (params) => api.get('/reports/employee-halfday-absent', { params }),

  // Attendance analysis
  dailyAttendanceSummary: (params) => api.get('/reports/daily-attendance-summary', { params }),
  monthlyAttendanceTrend: (params) => api.get('/reports/monthly-attendance-trend', { params }),
  lateComingAnalysis: (params) => api.get('/reports/late-coming-analysis', { params }),
  earlyLeavingAnalysis: (params) => api.get('/reports/early-leaving-analysis', { params }),
  shiftWiseAttendance: (params) => api.get('/reports/shift-wise-attendance', { params }),
  attendanceHeatmap: (params) => api.get('/reports/attendance-heatmap', { params }),
  departmentAttendance: (params) => api.get('/reports/department-attendance', { params }),

  // OT reports (admin only)
  departmentOT: (params) => api.get('/reports/department-ot', { params }),
  monthlyOTTrend: (params) => api.get('/reports/monthly-ot-trend', { params }),
  otCost: (params) => api.get('/reports/ot-cost', { params }),
  holidayOT: (params) => api.get('/reports/holiday-ot', { params }),
  excessOTAlert: (params) => api.get('/reports/excess-ot-alert', { params }),

  // Cost analysis (admin only)
  costPerEmployee: (params) => api.get('/reports/cost-per-employee', { params }),
  highAbsenteeism: (params) => api.get('/reports/high-absenteeism', { params }),
  frequentLateComing: (params) => api.get('/reports/frequent-late-coming', { params }),
  missedPunch: (params) => api.get('/reports/missed-punch', { params }),
  halfDayFrequent: (params) => api.get('/reports/half-day-frequent', { params }),
  absentCostImpact: (params) => api.get('/reports/absent-cost-impact', { params }),
  salaryVsOT: (params) => api.get('/reports/salary-vs-ot', { params }),

  // Leave reports
  leaveBalance: (params) => api.get('/reports/leave-balance', { params }),
  leaveUsageTrend: (params) => api.get('/reports/leave-usage-trend', { params }),
  compoffBalance: (params) => api.get('/reports/compoff-balance', { params }),
  expiringCompoff: (params) => api.get('/reports/expiring-compoff', { params }),

  // Export (any report)
  export: (reportName, params) =>
    api.get(`/reports/${reportName}/export`, { params, responseType: 'blob' }),
}

// ─── Salary Module API Objects ────────────────────────────────────────────────
// These wrap the /v1/ salary endpoints using the authenticated `api` instance.
// Pages MUST use these (or import { api } directly) — never bare axios.

export const payrollPeriodsApi = {
  getAll: (params) => api.get('/v1/payroll-periods/', { params }),
  create: (data) => api.post('/v1/payroll-periods/', data),
  getById: (id) => api.get(`/v1/payroll-periods/${id}`),
  transitionState: (id, newState) => api.patch(`/v1/payroll-periods/${id}/state`, { new_state: newState }),
  lock: (id) => api.patch(`/v1/payroll-periods/${id}/lock`),
}

export const salaryConfigApi = {
  get: (employeeId) => api.get(`/v1/salary-configs/employee/${employeeId}`),
  save: (data) => api.post('/v1/salary-configs/', data),
  getHistory: (employeeId) => api.get(`/v1/salary-configs/employee/${employeeId}/history`),
}

export const salaryCalculationApi = {
  getByPeriod: (periodId) => api.get(`/v1/payroll/period/${periodId}`),
  calculateAll: (periodId) => api.post(`/v1/payroll/calculate/${periodId}`),
  approve: (calcId) => api.patch(`/v1/payroll/calculation/${calcId}/approve`),
}

export const salaryAuditApi = {
  getAll: (params) => api.get('/v1/salary-audit/', { params }),
}

export const deductionApi = {
  getByEmployee: (employeeId) => api.get(`/v1/deductions/employee/${employeeId}`),
  add: (data) => api.post('/v1/deductions/', data),
  pause: (id) => api.patch(`/v1/deductions/${id}/pause`),
  resume: (id) => api.patch(`/v1/deductions/${id}/resume`),
}

export const complianceApi = {
  pfEcr: (periodId) => api.get('/v1/compliance/pf-ecr', { params: { period_id: periodId } }),
  pfEcrDownload: (periodId) => api.get('/v1/compliance/pf-ecr/download', { params: { period_id: periodId }, responseType: 'blob' }),
  esi: (periodId) => api.get('/v1/compliance/esi', { params: { period_id: periodId } }),
  esiDownload: (periodId) => api.get('/v1/compliance/esi/download', { params: { period_id: periodId }, responseType: 'blob' }),
  pt: (periodId) => api.get('/v1/compliance/pt', { params: { period_id: periodId } }),
  ptDownload: (periodId) => api.get('/v1/compliance/pt/download', { params: { period_id: periodId }, responseType: 'blob' }),
  form16: (employeeId, fy) => api.get(`/v1/compliance/form16/${employeeId}/${fy}`),
  form16Download: (employeeId, fy) => api.get(`/v1/compliance/form16/${employeeId}/${fy}/download`, { responseType: 'blob' }),
}

export const insightsApi = {
  getByPeriod: (periodId) => api.get(`/v1/insights/period/${periodId}`),
}

export const statutoryRatesApi = {
  getAll: () => api.get('/v1/statutory-rates/'),
  create: (data) => api.post('/v1/statutory-rates/', data),
}

export const installmentsApi = {
  getByEmployee: (employeeId) => api.get(`/v1/deductions/employee/${employeeId}/installments`),
}

export const companyApi = {
  get: () => api.get('/v1/company/'),
  update: (data) => api.put('/v1/company/', data),
}
