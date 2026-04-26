import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import EmployeeProfile from './pages/EmployeeProfile'
import EmployeeReports from './pages/EmployeeReports'
import FaceEnrollment from './pages/FaceEnrollment'
import Attendance from './pages/Attendance'
import Leaves from './pages/Leaves'
// import Payroll from './pages/Payroll' // Disabled old Payroll menu as per user request
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
      <Route path="/leaves" element={<ProtectedRoute><Leaves /></ProtectedRoute>} />
      {/* <Route path="/payroll" element={<ProtectedRoute><Payroll /></ProtectedRoute>} /> */}
      <Route path="/holidays" element={<ProtectedRoute><Holidays /></ProtectedRoute>} />
      <Route path="/audit" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/salary/periods" element={<ProtectedRoute><PayrollPeriods /></ProtectedRoute>} />
      <Route path="/salary/calculation" element={<ProtectedRoute><SalaryCalculation /></ProtectedRoute>} />
      <Route path="/salary/payslips" element={<ProtectedRoute><Payslips /></ProtectedRoute>} />
      <Route path="/salary/payheads" element={<ProtectedRoute><PayheadConfig /></ProtectedRoute>} />
      <Route path="/salary/deductions" element={<ProtectedRoute><DeductionManagement /></ProtectedRoute>} />
      <Route path="/salary/compliance" element={<ProtectedRoute><ComplianceReports /></ProtectedRoute>} />
      <Route path="/salary/audit" element={<ProtectedRoute><SalaryAuditLog /></ProtectedRoute>} />
      <Route path="/salary/insights" element={<ProtectedRoute><SmartInsights /></ProtectedRoute>} />
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
