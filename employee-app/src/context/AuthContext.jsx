/**
 * AuthContext.jsx - Employee App
 * Simple Employee Code-based authentication.
 * Employees log in with their Employee Code (e.g. EMP001).
 * Credentials are fetched from backend and stored in localStorage.
 */
import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [employee, setEmployee] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restore session from localStorage on page load
    const savedEmployee = localStorage.getItem('employee_session')
    if (savedEmployee) {
      const parsed = JSON.parse(savedEmployee)
      setEmployee(parsed)
      api.defaults.headers.common['Authorization'] = `Bearer ${parsed.access_token}`
    }
    setLoading(false)
  }, [])

  /**
   * Login with Employee Code + Password.
   * Uses the standard /auth/login endpoint.
   */
  const login = async (empCode, password) => {
    const formData = new FormData()
    formData.append('username', empCode)
    formData.append('password', password)

    const response = await api.post('/auth/login', formData)
    const { access_token, refresh_token, user: userData } = response.data

    const session = {
      ...userData,
      access_token,
      refresh_token,
    }

    localStorage.setItem('employee_session', JSON.stringify(session))
    api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
    setEmployee(session)
    return session
  }

  const logout = () => {
    localStorage.removeItem('employee_session')
    delete api.defaults.headers.common['Authorization']
    setEmployee(null)
    // Redirect to main landing page
    window.location.href = '/'
  }

  return (
    <AuthContext.Provider value={{ employee, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
