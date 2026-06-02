import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { useLicense } from './context/LicenseContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import EmployeeProfile from './pages/EmployeeProfile'
import EmployeeReports from './pages/EmployeeReports'
import FaceEnrollment from './pages/FaceEnrollment'
import Attendance from './pages/Attendance'
import Leaves from './pages/Leaves'
import Holidays from './pages/Holidays'
import AuditLog from './pages/AuditLog'
import Settings from './pages/Settings'
import Reports from './pages/Reports'
import PayrollPeriods from './pages/PayrollPeriods'
import SalaryCalculation from './pages/SalaryCalculation'
import PayheadConfig from './pages/PayheadConfig'
import DeductionManagement from './pages/DeductionManagement'
import ComplianceReports from './pages/ComplianceReports'
import SalaryAuditLog from './pages/SalaryAuditLog'
import SmartInsights from './pages/SmartInsights'
import Payslips from './pages/Payslips'
import RealTimeSalaryTracker from './pages/RealTimeSalaryTracker'
import Layout from './components/Layout'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }
  
  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  return <Layout>{children}</Layout>
}

// Locked route — READ_ONLY असेल तर Upgrade Modal दाखवतो
function LockedRoute({ children }) {
  const { user, loading } = useAuth()
  const [licenseStatus, setLicenseStatus] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    fetch('/api/v1/license/info')
      .then(r => r.json())
      .then(d => {
        setLicenseStatus(d.status)
        setChecking(false)
      })
      .catch(() => {
        setLicenseStatus('NORMAL')
        setChecking(false)
      })
  }, [])

  if (loading || checking) return null
  if (!user) return <Navigate to="/login" replace />

  if (licenseStatus === 'READ_ONLY') {
    return (
      <Layout>
        <UpgradePrompt />
      </Layout>
    )
  }

  return <Layout>{children}</Layout>
}

function UpgradePrompt() {
  const [show, setShow] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/', { replace: true })
  }, [])

  return null
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
      <Route path="/employees/reports" element={<ProtectedRoute><EmployeeReports /></ProtectedRoute>} />
      <Route path="/employees/:id/enroll" element={<ProtectedRoute><FaceEnrollment /></ProtectedRoute>} />
      <Route path="/employees/:id" element={<ProtectedRoute><EmployeeProfile /></ProtectedRoute>} />
      <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
      <Route path="/leaves" element={<LockedRoute><Leaves /></LockedRoute>} />
      {/* <Route path="/payroll" element={<ProtectedRoute><Payroll /></ProtectedRoute>} /> */}
      <Route path="/holidays" element={<LockedRoute><Holidays /></LockedRoute>} />
      <Route path="/audit" element={<LockedRoute><AuditLog /></LockedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/reports" element={<LockedRoute><Reports /></LockedRoute>} />
      <Route path="/salary/periods" element={<LockedRoute><PayrollPeriods /></LockedRoute>} />
      <Route path="/salary/realtime" element={<LockedRoute><RealTimeSalaryTracker /></LockedRoute>} />
      <Route path="/salary/calculation" element={<LockedRoute><SalaryCalculation /></LockedRoute>} />
      <Route path="/salary/payslips" element={<LockedRoute><Payslips /></LockedRoute>} />
      <Route path="/salary/payheads" element={<LockedRoute><PayheadConfig /></LockedRoute>} />
      <Route path="/salary/deductions" element={<LockedRoute><DeductionManagement /></LockedRoute>} />
      <Route path="/salary/compliance" element={<LockedRoute><ComplianceReports /></LockedRoute>} />
      <Route path="/salary/audit" element={<LockedRoute><SalaryAuditLog /></LockedRoute>} />
      <Route path="/salary/insights" element={<LockedRoute><SmartInsights /></LockedRoute>} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <Toaster position="top-right" />
    </AuthProvider>
  )
}
