/**
 * App.jsx - Employee App
 * Simplified routing for the GPS + Selfie Employee Attendance App.
 * Removed SyncContext (employee doesn't need manual sync control).
 */
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Login from './pages/Login'
import Attendance from './pages/Attendance'
import History from './pages/History'
import MyLeaves from './pages/MyLeaves'
import MySalary from './pages/MySalary'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider, useAuth } from './context/AuthContext'

function ProtectedRoute({ children }) {
  const { employee, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
      </div>
    )
  }

  if (!employee) {
    return <Navigate to="/login" replace />
  }

  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Layout>
            <ErrorBoundary title="Attendance Error" description="Something went wrong. Please refresh." onReset={() => window.location.reload()}>
              <Attendance />
            </ErrorBoundary>
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/history" element={
        <ProtectedRoute>
          <Layout>
            <History />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/my-leaves" element={
        <ProtectedRoute>
          <Layout>
            <MyLeaves />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/my-salary" element={
        <ProtectedRoute>
          <Layout>
            <MySalary />
          </Layout>
        </ProtectedRoute>
      } />
    </Routes>
  )
}

export default function App() {
  return (
    <ErrorBoundary title="Application Error" description="The app encountered an unexpected error.">
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      </AuthProvider>
    </ErrorBoundary>
  )
}
