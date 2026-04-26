import axios from 'axios'

// Support ngrok deployment: set VITE_API_BASE_URL in .env.local to the ngrok URL
// e.g. VITE_API_BASE_URL=https://xxxx.ngrok-free.app/api
// Falls back to '/api' for local dev (unchanged behaviour)
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'

export const api = axios.create({
  baseURL
})

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
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

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
    const refreshToken = localStorage.getItem('refresh_token')

    if (!refreshToken) {
      // No refresh token available, logout
      isRefreshing = false
      processQueue(new Error('No refresh token'), null)
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    try {
      // Attempt to refresh the token
      const response = await axios.post(`${baseURL}/auth/refresh`, {
        refresh_token: refreshToken
      })

      const newAccessToken = response.data.access_token
      localStorage.setItem('access_token', newAccessToken)

      // If a new refresh token is provided, update it
      if (response.data.refresh_token) {
        localStorage.setItem('refresh_token', response.data.refresh_token)
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
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user')
      window.location.href = '/login'
      return Promise.reject(refreshError)
    }
  }
)

export const employeeApi = {
  getAll: (includeDescriptors = false) => api.get('/employees', { params: { include_descriptors: includeDescriptors } }),
  getById: (id) => api.get(`/employees/${id}`),
  create: (data) => api.post('/employees', data),
  update: (id, data) => api.put(`/employees/${id}`, data),
  delete: (id) => api.delete(`/employees/${id}`),
  enrollFace: (id, descriptors) => api.post(`/employees/${id}/enroll-face`, { face_descriptors: descriptors })
}

export const attendanceApi = {
  sync: (deviceId, records) => api.post('/attendance/sync', { device_id: deviceId, records }),
  getAll: (params) => api.get('/attendance', { params }),
  getMy: (params) => api.get('/attendance/my', { params }),
  getSummary: (params) => api.get('/attendance/summary', { params })
}

export const authApi = {
  changePassword: (oldPassword, newPassword) =>
    api.post('/auth/change-password', { old_password: oldPassword, new_password: newPassword })
}

export const leaveApi = {
  getMyBalance: (empId) => api.get(`/leaves/balance/${empId}`),
  applyLeave: (data) => api.post('/leaves', data),
  getMyLeaves: () => api.get('/leaves/my'),
}

export const payrollApi = {
  getMy: () => api.get('/v1/payslips/my'),
  downloadSlip: (id) => api.get(`/v1/payslips/${id}/slip-download`, { responseType: 'blob' }),
}
