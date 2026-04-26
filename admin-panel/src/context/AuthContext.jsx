import { createContext, useContext, useState, useEffect } from 'react'
import { api, authApi } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    const savedUser = localStorage.getItem('admin_user')
    
    if (token && savedUser) {
      const userData = JSON.parse(savedUser)
      if (userData.role === 'ADMIN') {
        setUser(userData)
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      } else {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_user')
      }
    }
    setLoading(false)
  }, [])

  const login = async (username, password) => {
    const response = await authApi.login(username, password)
    const { access_token, refresh_token, user: userData } = response.data
    
    if (userData.role !== 'ADMIN') {
      throw new Error('Access denied. Admin role required.')
    }
    
    localStorage.setItem('admin_token', access_token)
    localStorage.setItem('admin_user', JSON.stringify(userData))
    
    // Store refresh token if provided
    if (refresh_token) {
      localStorage.setItem('admin_refresh_token', refresh_token)
    }
    
    api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
    
    setUser(userData)
    return userData
  }

  const logout = () => {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_refresh_token')
    localStorage.removeItem('admin_user')
    delete api.defaults.headers.common['Authorization']
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
