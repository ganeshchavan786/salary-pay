import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    const savedUser = localStorage.getItem('user')
    const mustChangeFlag = localStorage.getItem('must_change_password')
    
    if (token && savedUser) {
      setUser(JSON.parse(savedUser))
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      setMustChangePassword(mustChangeFlag === 'true')
    }
    setLoading(false)
  }, [])

  const login = async (username, password) => {
    const formData = new FormData()
    formData.append('username', username)
    formData.append('password', password)
    
    const response = await api.post('/auth/login', formData)
    const { access_token, refresh_token, user: userData, must_change_password } = response.data
    
    localStorage.setItem('access_token', access_token)
    if (refresh_token) {
      localStorage.setItem('refresh_token', refresh_token)
    }
    localStorage.setItem('user', JSON.stringify(userData))
    localStorage.setItem('must_change_password', must_change_password ? 'true' : 'false')
    api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
    
    setUser(userData)
    setMustChangePassword(Boolean(must_change_password))
    return response.data
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    localStorage.removeItem('must_change_password')
    delete api.defaults.headers.common['Authorization']
    setUser(null)
    setMustChangePassword(false)
  }

  const completePasswordChange = () => {
    localStorage.setItem('must_change_password', 'false')
    setMustChangePassword(false)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, mustChangePassword, completePasswordChange }}>
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
