import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Search, Edit2, Trash2, Camera, CheckCircle, XCircle,
  Loader2, UserCheck, KeyRound, LayoutGrid, List, Download,
  Upload, Users, UserX, Clock, ScanFace, FileSpreadsheet, X, ShieldCheck
} from 'lucide-react'
import toast from 'react-hot-toast'
import { employeeApi, api } from '../services/api'

// ── Avatar helper ─────────────────────────────────────────────────────────────
function Avatar({ emp, size = 'md' }) {
  const sz = size === 'lg' ? 'w-16 h-16 text-xl' : 'w-10 h-10 text-sm'
  if (emp.photo_url) {
    return <img src={emp.photo_url} alt={emp.name} className={`${sz} rounded-full object-cover`} />
  }
  return (
    <div className={`${sz} bg-primary-100 rounded-full flex items-center justify-center font-semibold text-primary-600`}>
      {emp.name.charAt(0).toUpperCase()}
    </div>
  )
}

// ── Stats Bar ─────────────────────────────────────────────────────────────────
function StatsBar({ summary, loading }) {
  const cards = [
    { label: 'Total', value: summary?.total ?? 0, icon: Users, color: 'text-blue-600 bg-blue-50' },
    { label: 'Active', value: summary?.active ?? 0, icon: CheckCircle, color: 'text-green-600 bg-green-50' },
    { label: 'On Probation', value: summary?.on_probation ?? 0, icon: Clock, color: 'text-orange-600 bg-orange-50' },
    { label: 'Face Enrolled', value: summary?.face_enrolled ?? 0, icon: ScanFace, color: 'text-purple-600 bg-purple-50' },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      {cards.map(c => {
        const Icon = c.icon
        return (
          <div key={c.label} className="bg-white rounded-xl shadow p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${c.color}`}><Icon className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className="text-xl font-bold text-gray-800">{loading ? '…' : c.value}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Employee Card ─────────────────────────────────────────────────────────────
function EmployeeCard({ emp, selected, onSelect, onEdit, onDelete, onConfirm, onLoginModal }) {
  return (
    <div className={`bg-white rounded-xl shadow p-4 relative ${selected ? 'ring-2 ring-primary-500' : ''}`}>
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onSelect(emp.id)}
        className="absolute top-3 left-3 w-4 h-4 accent-primary-600"
      />
      <Link to={`/employees/${emp.id}`} className="flex flex-col items-center text-center pt-2">
        <Avatar emp={emp} size="lg" />
        <p className="mt-2 font-semibold text-gray-800 text-sm">{emp.name}</p>
        <p className="text-xs text-gray-400">{emp.emp_code}</p>
        <p className="text-xs text-gray-500 mt-0.5">{emp.department || '—'}</p>
        <p className="text-xs text-gray-400">{emp.designation || '—'}</p>
        <div className="flex gap-1 mt-2 flex-wrap justify-center">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${emp.is_confirmed ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
            {emp.is_confirmed ? 'Confirmed' : 'Probation'}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${emp.face_enrolled ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
            {emp.face_enrolled ? 'Face ✓' : 'No Face'}
          </span>
        </div>
      </Link>
      <div className="flex justify-center gap-1 mt-3 pt-3 border-t">
        {!emp.is_confirmed && (
          <button onClick={() => onConfirm(emp)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Confirm"><UserCheck className="w-3.5 h-3.5" /></button>
        )}
        <button onClick={() => onLoginModal(emp)} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded" title="Create Login"><KeyRound className="w-3.5 h-3.5" /></button>
        <Link to={`/employees/${emp.id}/enroll`} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Enroll Face"><Camera className="w-3.5 h-3.5" /></Link>
        <button onClick={() => onEdit(emp)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
        <button onClick={() => onDelete(emp)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Employees() {
  // Data
  const [employees, setEmployees] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [summaryLoading, setSummaryLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterConfirmed, setFilterConfirmed] = useState('')
  const [filterFace, setFilterFace] = useState('')

  // View mode
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('emp_view_mode') || 'table')

  // Selection
  const [selectedIds, setSelectedIds] = useState(new Set())

  // Modals
  const [showModal, setShowModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginEmp, setLoginEmp] = useState(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [importing, setImporting] = useState(false)
  const importFileRef = useRef(null)

  // Form
  const emptyForm = { 
    emp_code: '', name: '', email: '', department: '', salary: '', 
    designation: '', joining_date: '', phone: '', remarks: '',
    aadhaar_no: '', pan_no: '', bank_name: '', account_no: '', ifsc_code: '',
    current_address: '', permanent_address: '', emergency_name: '', emergency_phone: ''
  }
  const [formData, setFormData] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginSaving, setLoginSaving] = useState(false)
  const [resending, setResending] = useState(false)

  // Derived
  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))]

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    await Promise.all([loadEmployees(), loadSummary()])
  }

  async function loadEmployees() {
    setLoading(true)
    try {
      const params = { limit: 200 }
      if (filterDept) params.department = filterDept
      if (filterStatus) params.status = filterStatus
      if (filterConfirmed !== '') params.is_confirmed = filterConfirmed === 'true'
      if (filterFace !== '') params.face_enrolled = filterFace === 'true'
      if (search) params.search = search
      const r = await employeeApi.getAll(params)
      setEmployees(r.data.employees || [])
    } catch { toast.error('Failed to load employees') }
    finally { setLoading(false) }
  }

  async function loadSummary() {
    setSummaryLoading(true)
    try {
      const r = await employeeApi.getSummary()
      setSummary(r.data)
    } catch { /* ignore */ }
    finally { setSummaryLoading(false) }
  }

  // Re-fetch when filters change
  useEffect(() => { loadEmployees() }, [search, filterDept, filterStatus, filterConfirmed, filterFace])

  function toggleView(mode) {
    setViewMode(mode)
    localStorage.setItem('emp_view_mode', mode)
  }

  // Selection
  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleSelectAll() {
    if (selectedIds.size === employees.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(employees.map(e => e.id)))
    }
  }

  // Bulk actions
  async function handleBulkAction(action) {
    try {
      const r = await employeeApi.bulkAction(action, [...selectedIds])
      toast.success(r.data.message)
      setSelectedIds(new Set())
      loadAll()
    } catch (err) {
      toast.error(err.response?.data?.detail || `Failed to ${action}`)
    }
  }

  // CRUD
  function openAddModal() {
    setEditingEmployee(null)
    setFormData(emptyForm)
    setFormError('')
    setShowModal(true)
  }
  function openEditModal(emp) {
    setEditingEmployee(emp)
    setFormData({
      emp_code: emp.emp_code, name: emp.name, email: emp.email || '',
      department: emp.department || '', salary: emp.salary ?? '',
      designation: emp.designation || '', joining_date: emp.joining_date || '',
      phone: emp.phone || '', remarks: emp.remarks || '',
      aadhaar_no: emp.aadhaar_no || '', pan_no: emp.pan_no || '',
      bank_name: emp.bank_name || '', account_no: emp.account_no || '',
      ifsc_code: emp.ifsc_code || '', current_address: emp.current_address || '',
      permanent_address: emp.permanent_address || '', emergency_name: emp.emergency_name || '',
      emergency_phone: emp.emergency_phone || ''
    })
    setFormError('')
    setShowModal(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setFormError('')

    // Client-side validation
    if (!formData.name?.trim()) {
      setFormError('Name is required')
      setSaving(false)
      return
    }
    // =====================================================================
    // FEATURE: Auto-Generate Employee Code
    // We purposely removed the validation block that forced the user to enter
    // an Employee Code. If the code is left empty during creation, the backend
    // will now intercept it and auto-generate the next code (e.g. EMP0001).
    // =====================================================================

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email?.trim() || null,
        department: formData.department?.trim() || null,
        salary: formData.salary !== '' && formData.salary !== null ? Number(formData.salary) : null,
        designation: formData.designation?.trim() || null,
        joining_date: formData.joining_date || null,
        phone: formData.phone?.trim() || null,
        remarks: formData.remarks?.trim() || null,
        aadhaar_no: formData.aadhaar_no?.trim() || null,
        pan_no: formData.pan_no?.trim() || null,
        bank_name: formData.bank_name?.trim() || null,
        account_no: formData.account_no?.trim() || null,
        ifsc_code: formData.ifsc_code?.trim() || null,
        current_address: formData.current_address?.trim() || null,
        permanent_address: formData.permanent_address?.trim() || null,
        emergency_name: formData.emergency_name?.trim() || null,
        emergency_phone: formData.emergency_phone?.trim() || null,
      }
      if (editingEmployee) {
        await employeeApi.update(editingEmployee.id, payload)
      } else {
        await employeeApi.create({ ...payload, emp_code: formData.emp_code.trim() })
      }
      setShowModal(false)
      setFormData(emptyForm)
      toast.success(editingEmployee ? 'Employee updated' : 'Employee created')
      // Direct API call to avoid stale closure issue
      try {
        const fresh = await employeeApi.getAll({ limit: 200 })
        setEmployees(fresh.data.employees || [])
        const sum = await employeeApi.getSummary()
        setSummary(sum.data)
      } catch { /* ignore, loadAll will retry */ }
      await loadAll()
    } catch (err) {
      const detail = err.response?.data?.detail
      let msg = 'Failed to save'
      if (typeof detail === 'string') {
        msg = detail
      } else if (Array.isArray(detail)) {
        msg = detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ')
      } else if (detail) {
        msg = JSON.stringify(detail)
      } else if (err.message) {
        msg = err.message
      }
      setFormError(msg)
      toast.error(msg)
      console.error('[Employee Save Error]', err.response?.status, err.response?.data)
    } finally { setSaving(false) }
  }

  async function handleDelete(emp) {
    if (!confirm(`Delete ${emp.name}?`)) return
    try { await employeeApi.delete(emp.id); loadAll() }
    catch { toast.error('Failed to delete') }
  }

  async function handleConfirm(emp) {
    try { await employeeApi.confirm(emp.id); toast.success('Confirmed! 12 CL credited.'); loadAll() }
    catch { toast.error('Failed to confirm') }
  }

  // Login modal
  function openLoginModal(emp) {
    setLoginEmp(emp)
    setLoginForm({ username: emp.email || emp.emp_code, password: 'emp@123' })
    setShowLoginModal(true)
  }
  async function handleCreateLogin(e) {
    e.preventDefault()
    setLoginSaving(true)
    try {
      // Send empty password to trigger backend auto-generation
      await api.post('/auth/register', { username: loginForm.username, password: '', role: 'EMPLOYEE', emp_id: loginEmp.id })
      toast.success(`Login created & Credentials sent to email!`)
      setShowLoginModal(false)
    } catch (err) {
      const detail = err.response?.data?.detail
      if (detail === "Username already registered") {
        toast.error("User already exists. Use the 'Resend Email' option below.")
      } else {
        toast.error(detail || 'Failed to create login')
      }
    } finally { setLoginSaving(false) }
  }

  async function handleResendEmail() {
    if (!loginEmp) return
    setResending(true)
    try {
      await api.post('/auth/resend-welcome-email', {
        emp_id: loginEmp.id,
        username: loginForm.username,
        password: '' // Backend will generate new password
      })
      toast.success('New credentials generated & sent to email! 📧')
      setShowLoginModal(false)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to resend email')
    } finally {
      setResending(false)
    }
  }

  // Export
  async function handleExport(format) {
    try {
      const params = { format }
      if (filterDept) params.department = filterDept
      if (filterStatus) params.status = filterStatus
      if (filterConfirmed !== '') params.is_confirmed = filterConfirmed === 'true'
      if (filterFace !== '') params.face_enrolled = filterFace === 'true'
      if (search) params.search = search
      const r = await employeeApi.export(params)
      const ext = format === 'xlsx' ? 'xlsx' : 'csv'
      const url = URL.createObjectURL(new Blob([r.data]))
      const a = document.createElement('a'); a.href = url; a.download = `employees.${ext}`; a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported as ${ext.toUpperCase()}`)
    } catch { toast.error('Export failed') }
  }

  // CSV Import
  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const fd = new FormData(); fd.append('file', file)
      const r = await employeeApi.bulkImport(fd)
      setImportResult(r.data)
      if (r.data.created > 0) { loadAll(); toast.success(`${r.data.created} employees imported`) }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Import failed')
    } finally { setImporting(false); if (importFileRef.current) importFileRef.current.value = '' }
  }

  if (loading && employees.length === 0) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div></div>
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Employees</h1>
          <p className="text-gray-500 text-sm">{employees.length} employees</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowImportModal(true)} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"><Upload className="w-4 h-4" /> Import</button>
          <button onClick={() => handleExport('csv')} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"><Download className="w-4 h-4" /> CSV</button>
          <button onClick={() => handleExport('xlsx')} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"><FileSpreadsheet className="w-4 h-4" /> Excel</button>
          <button onClick={openAddModal} className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"><Plus className="w-4 h-4" /> Add Employee</button>
        </div>
      </div>

      {/* Stats Bar */}
      <StatsBar summary={summary} loading={summaryLoading} />

      {/* Filters */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or code..." className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="border rounded-lg px-3 py-2 text-sm outline-none">
            <option value="">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border rounded-lg px-3 py-2 text-sm outline-none">
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select value={filterConfirmed} onChange={e => setFilterConfirmed(e.target.value)} className="border rounded-lg px-3 py-2 text-sm outline-none">
            <option value="">All Confirmation</option>
            <option value="true">Confirmed</option>
            <option value="false">On Probation</option>
          </select>
          <select value={filterFace} onChange={e => setFilterFace(e.target.value)} className="border rounded-lg px-3 py-2 text-sm outline-none">
            <option value="">All Face Status</option>
            <option value="true">Enrolled</option>
            <option value="false">Not Enrolled</option>
          </select>
          {/* View toggle */}
          <div className="flex border rounded-lg overflow-hidden ml-auto">
            <button onClick={() => toggleView('table')} className={`px-3 py-2 ${viewMode === 'table' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}><List className="w-4 h-4" /></button>
            <button onClick={() => toggleView('card')} className={`px-3 py-2 ${viewMode === 'card' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}><LayoutGrid className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* Bulk action toolbar */}
      {selectedIds.size > 0 && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-3 mb-4 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-primary-700">{selectedIds.size} selected</span>
          <button onClick={() => handleBulkAction('confirm')} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Bulk Confirm</button>
          <button onClick={() => handleBulkAction('deactivate')} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Bulk Deactivate</button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto p-1 text-gray-500 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Card View */}
      {viewMode === 'card' && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <input type="checkbox" checked={selectedIds.size === employees.length && employees.length > 0} onChange={toggleSelectAll} className="w-4 h-4 accent-primary-600" />
            <span className="text-sm text-gray-500">Select All</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {employees.map(emp => (
              <EmployeeCard key={emp.id} emp={emp} selected={selectedIds.has(emp.id)}
                onSelect={toggleSelect} onEdit={openEditModal} onDelete={handleDelete}
                onConfirm={handleConfirm} onLoginModal={openLoginModal} />
            ))}
          </div>
          {employees.length === 0 && <div className="text-center py-12 text-gray-400">No employees found</div>}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left w-8">
                    <input type="checkbox" checked={selectedIds.size === employees.length && employees.length > 0} onChange={toggleSelectAll} className="w-4 h-4 accent-primary-600" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Designation</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Salary</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Face</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {employees.length === 0 ? (
                  <tr><td colSpan="9" className="px-4 py-8 text-center text-gray-500">No employees found</td></tr>
                ) : employees.map(emp => (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedIds.has(emp.id)} onChange={() => toggleSelect(emp.id)} className="w-4 h-4 accent-primary-600" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar emp={emp} />
                        <div>
                          <Link to={`/employees/${emp.id}`} className="font-medium text-gray-800 hover:text-primary-600">{emp.name}</Link>
                          <p className="text-xs text-gray-500">{emp.email || '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm">{emp.emp_code}</td>
                    <td className="px-4 py-3 text-gray-600 text-sm">{emp.department || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 text-sm">{emp.designation || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 text-sm">{emp.salary ? '₹' + Number(emp.salary).toLocaleString('en-IN') : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${emp.is_confirmed ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {emp.is_confirmed ? 'Confirmed' : 'Probation'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {emp.face_enrolled
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full"><CheckCircle className="w-3 h-3" /> Yes</span>
                        : <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full"><XCircle className="w-3 h-3" /> No</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {!emp.is_confirmed && <button onClick={() => handleConfirm(emp)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Confirm"><UserCheck className="w-4 h-4" /></button>}
                        <button onClick={() => openLoginModal(emp)} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded" title="Create Login"><KeyRound className="w-4 h-4" /></button>
                        <Link to={`/employees/${emp.id}/enroll`} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Enroll Face"><Camera className="w-4 h-4" /></Link>
                        <button onClick={() => openEditModal(emp)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded" title="Edit"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(emp)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-white">{editingEmployee ? '✏️ Edit Employee' : '👤 Add New Employee'}</h2>
                <p className="text-blue-100 text-xs mt-0.5">{editingEmployee ? 'Update employee information' : 'Fill in the details to create a new employee'}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">⚠️</span>
                  <span>{formError}</span>
                </div>
              )}

              {/* Basic Info Section */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Basic Information</p>
                <div className="grid grid-cols-2 gap-3">
                  {/* =====================================================================
                      FEATURE: Auto-Generate Employee Code
                      1. The 'required' attribute has been removed.
                      2. If the user is adding a NEW employee (!editingEmployee), the placeholder
                         hints that the code will be Auto-generated.
                      ===================================================================== */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Employee Code</label>
                    <input type="text" value={formData.emp_code}
                      onChange={e => setFormData(d => ({...d, emp_code: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
                      placeholder={editingEmployee ? "" : "Auto-generated (e.g. EMP0001)"} disabled={!!editingEmployee} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Full Name <span className="text-red-500">*</span></label>
                    <input type="text" value={formData.name}
                      onChange={e => setFormData(d => ({...d, name: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      placeholder="John Doe" required />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                    <input type="email" value={formData.email}
                      onChange={e => setFormData(d => ({...d, email: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      placeholder="john@company.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                    <input type="text" value={formData.phone}
                      onChange={e => setFormData(d => ({...d, phone: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      placeholder="+91 98765 43210" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
                    <input type="text" value={formData.department}
                      onChange={e => setFormData(d => ({...d, department: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      placeholder="Engineering" />
                  </div>
                </div>
              </div>

              {/* Job Details Section */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Job Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Designation</label>
                    <input type="text" value={formData.designation}
                      onChange={e => setFormData(d => ({...d, designation: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      placeholder="Software Engineer" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Salary (₹)</label>
                    <input type="number" value={formData.salary} min={0}
                      onChange={e => setFormData(d => ({...d, salary: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      placeholder="50000" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Joining Date</label>
                    <input type="date" value={formData.joining_date}
                      onChange={e => setFormData(d => ({...d, joining_date: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent" />
                  </div>
                </div>
              </div>

              {/* Identity & Documents */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 text-blue-600">🪪 Identity & Documents</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Aadhaar Number</label>
                    <input type="text" value={formData.aadhaar_no}
                      onChange={e => setFormData(d => ({...d, aadhaar_no: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      placeholder="1234 5678 9012" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">PAN Card Number</label>
                    <input type="text" value={formData.pan_no}
                      onChange={e => setFormData(d => ({...d, pan_no: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      placeholder="ABCDE1234F" />
                  </div>
                </div>
              </div>

              {/* Bank Details */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 text-green-600">🏦 Bank Details (Salary Transfer)</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Bank Name</label>
                    <input type="text" value={formData.bank_name}
                      onChange={e => setFormData(d => ({...d, bank_name: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                      placeholder="HDFC Bank / SBI" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Account Number</label>
                      <input type="text" value={formData.account_no}
                        onChange={e => setFormData(d => ({...d, account_no: e.target.value}))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                        placeholder="0123456789" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">IFSC Code</label>
                      <input type="text" value={formData.ifsc_code}
                        onChange={e => setFormData(d => ({...d, ifsc_code: e.target.value}))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                        placeholder="HDFC0001234" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Address & Emergency Contact */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 text-red-600">🏠 Address & Emergency</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Current Address</label>
                    <textarea value={formData.current_address}
                      onChange={e => setFormData(d => ({...d, current_address: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent resize-none"
                      rows={2} placeholder="Building, Street, Area..." />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Permanent Address</label>
                    <textarea value={formData.permanent_address}
                      onChange={e => setFormData(d => ({...d, permanent_address: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent resize-none"
                      rows={2} placeholder="Same as current or different..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Emergency Name</label>
                      <input type="text" value={formData.emergency_name}
                        onChange={e => setFormData(d => ({...d, emergency_name: e.target.value}))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
                        placeholder="Spouse / Parent Name" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Emergency Phone</label>
                      <input type="text" value={formData.emergency_phone}
                        onChange={e => setFormData(d => ({...d, emergency_phone: e.target.value}))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
                        placeholder="+91 9988776655" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Remarks / Notes</label>
                <textarea value={formData.remarks}
                  onChange={e => setFormData(d => ({...d, remarks: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none"
                  rows={2} maxLength={2000} placeholder="Optional notes about this employee..." />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 font-medium transition">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingEmployee ? 'Update Employee' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Login Modal */}
      {showLoginModal && loginEmp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">🔑 Create PWA Login</h2>
              <p className="text-sm text-gray-500 mt-1">For: <strong>{loginEmp.name}</strong> ({loginEmp.emp_code})</p>
            </div>
            <form onSubmit={handleCreateLogin} className="p-4 space-y-4">
              <div className="p-3 bg-purple-50 rounded-xl text-[11px] text-purple-700 border border-purple-100 flex gap-2.5">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <p>Security Notice: Passwords are now automatically generated and sent directly to the employee's registered email. Admins cannot see or set manual passwords.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username (Employee Code)</label>
                <input type="text" value={loginForm.username} readOnly className="w-full px-3 py-2 border border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed rounded-lg text-sm outline-none" required />
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button type="submit" disabled={loginSaving || resending} className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loginSaving && <Loader2 className="w-4 h-4 animate-spin" />}Create Login & Send Email
                </button>
                <button type="button" onClick={handleResendEmail} disabled={resending || loginSaving || !loginEmp} className="w-full px-4 py-2 border border-purple-200 text-purple-600 rounded-lg text-sm hover:bg-purple-50 disabled:opacity-50 flex items-center justify-center gap-2">
                   {resending && <Loader2 className="w-4 h-4 animate-spin" />}
                   Resend Credentials Email
                </button>
                <button type="button" onClick={() => setShowLoginModal(false)} className="w-full px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">📥 Import Employees (CSV)</h2>
              <button onClick={() => { setShowImportModal(false); setImportResult(null) }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
                <p className="font-medium mb-1">Required CSV columns:</p>
                <code>emp_code, name</code>
                <p className="mt-1">Optional: email, department, designation, salary, joining_date (YYYY-MM-DD), phone</p>
              </div>
              <div>
                <input ref={importFileRef} type="file" accept=".csv" onChange={handleImportFile} className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100" />
              </div>
              {importing && <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Importing...</div>}
              {importResult && (
                <div className="space-y-2">
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-600 font-medium">✅ Created: {importResult.created}</span>
                    <span className="text-red-600 font-medium">⚠️ Skipped: {importResult.skipped}</span>
                  </div>
                  {importResult.errors?.length > 0 && (
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {importResult.errors.map((e, i) => (
                        <div key={i} className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded">Row {e.row}: {e.reason}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button onClick={() => { setShowImportModal(false); setImportResult(null) }} className="w-full px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
