import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Login from './pages/Login'
import Attendance from './pages/Attendance'
import History from './pages/History'
import ChangePassword from './pages/ChangePassword'
import MyLeaves from './pages/MyLeaves'
import MySalary from './pages/MySalary'
import MyTaxDeclaration from './pages/MyTaxDeclaration'
import MyLoans from './pages/MyLoans'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SyncProvider } from './context/SyncContext'

function ProtectedRoute({ children }) {
  const { user, loading, mustChangePassword } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }
  
  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (mustChangePassword) {
    return <Navigate to="/change-password" replace />
  }
  
  return children
}

function PasswordChangeRoute() {
  const { user, loading, mustChangePassword } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!mustChangePassword) return <Navigate to="/" replace />

  return <ChangePassword />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/change-password" element={<PasswordChangeRoute />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Layout>
            <ErrorBoundary
              title="Camera Error"
              description="Face detection failed. Please refresh and try again."
              onReset={() => window.location.reload()}
            >
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
      <Route path="/my-tax-declaration" element={
        <ProtectedRoute>
          <Layout>
            <MyTaxDeclaration />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/my-loans" element={
        <ProtectedRoute>
          <Layout>
            <MyLoans />
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
        <SyncProvider>
          <AppRoutes />
          <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
        </SyncProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
