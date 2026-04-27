import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Edit2, Save, X, Camera, Trash2, Loader2,
  UserCheck, CheckCircle, XCircle, User, Mail, Phone,
  Building, Briefcase, Calendar, DollarSign, FileText,
  Landmark, CreditCard, MapPin, PhoneCall
} from 'lucide-react'
import toast from 'react-hot-toast'
import { employeeApi, attendanceHrApi, leaveApi, payrollApi } from '../services/api'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const TABS = ['Overview', 'Attendance', 'Leaves', 'Payroll', 'Policy Override']

function Avatar({ emp, size = 'xl' }) {
  const sz = size === 'xl' ? 'w-24 h-24 text-3xl' : 'w-16 h-16 text-xl'
  if (emp?.photo_url) return <img src={emp.photo_url} alt={emp.name} className={`${sz} rounded-full object-cover`} />
  return (
    <div className={`${sz} bg-primary-100 rounded-full flex items-center justify-center font-bold text-primary-600`}>
      {emp?.name?.charAt(0)?.toUpperCase() || '?'}
    </div>
  )
}

export default function EmployeeProfile() {
  const { id } = useParams()
  const [employee, setEmployee] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState('Overview')

  // Edit
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)

  // Photo
  const photoRef = useRef(null)
  const [photoUploading, setPhotoUploading] = useState(false)

  // Tab data
  const [attendance, setAttendance] = useState(null)
  const [leaves, setLeaves] = useState(null)
  const [payrolls, setPayrolls] = useState([])
  const [tabLoading, setTabLoading] = useState(false)

  // Policy override state
  const [policyData, setPolicyData] = useState(null)
  const [policyForm, setPolicyForm] = useState({})
  const [policySaving, setPolicySaving] = useState(false)
  const [policyError, setPolicyError] = useState(null)
  const [formErrors, setFormErrors] = useState({})

  useEffect(() => { loadEmployee() }, [id])
  useEffect(() => { if (employee && activeTab !== 'Overview') loadTabData(activeTab) }, [activeTab, employee])

  async function loadEmployee() {
    setLoading(true)
    try {
      const r = await employeeApi.getById(id)
      setEmployee(r.data)
    } catch (err) {
      if (err.response?.status === 404) setNotFound(true)
      else toast.error('Failed to load employee')
    } finally { setLoading(false) }
  }

  async function loadTabData(tab) {
    setTabLoading(true)
    const now = new Date()
    try {
      if (tab === 'Attendance') {
        const r = await attendanceHrApi.getDaily(id, now.getMonth() + 1, now.getFullYear())
        setAttendance(r.data)
      } else if (tab === 'Leaves') {
        const r = await leaveApi.getBalance(id, { year: now.getFullYear() })
        setLeaves(r.data)
      } else if (tab === 'Payroll') {
        const r = await payrollApi.getHistory(id)
        setPayrolls((r.data.payrolls || []).slice(0, 6))
      } else if (tab === 'Policy Override') {
        setPolicyError(null)
        const r = await employeeApi.getPolicy(id)
        setPolicyData(r.data)
        const ov = r.data.override || {}
        const form = {}
        POLICY_FIELDS.forEach(f => {
          form[f.key] = ov[f.key] != null ? String(ov[f.key]) : ''
        })
        setPolicyForm(form)
      }
    } catch { /* ignore */ }
    finally { setTabLoading(false) }
  }

  function startEdit() {
    setEditForm({
      name: employee.name, email: employee.email || '', phone: employee.phone || '',
      department: employee.department || '', designation: employee.designation || '',
      salary: employee.salary ?? '', joining_date: employee.joining_date || '',
      remarks: employee.remarks || '',
      aadhaar_no: employee.aadhaar_no || '', pan_no: employee.pan_no || '',
      bank_name: employee.bank_name || '', account_no: employee.account_no || '',
      ifsc_code: employee.ifsc_code || '', current_address: employee.current_address || '',
      permanent_address: employee.permanent_address || '', emergency_name: employee.emergency_name || '',
      emergency_phone: employee.emergency_phone || '',
    })
    setEditing(true)
  }

  async function saveEdit() {
    setSaving(true)
    try {
      await employeeApi.update(id, {
        name: editForm.name, email: editForm.email || null, phone: editForm.phone || null,
        department: editForm.department || null, designation: editForm.designation || null,
        salary: editForm.salary !== '' ? Number(editForm.salary) : null,
        joining_date: editForm.joining_date || null, remarks: editForm.remarks || null,
        aadhaar_no: editForm.aadhaar_no || null, pan_no: editForm.pan_no || null,
        bank_name: editForm.bank_name || null, account_no: editForm.account_no || null,
        ifsc_code: editForm.ifsc_code || null, current_address: editForm.current_address || null,
        permanent_address: editForm.permanent_address || null, emergency_name: editForm.emergency_name || null,
        emergency_phone: editForm.emergency_phone || null,
      })
      toast.success('Employee updated')
      setEditing(false)
      loadEmployee()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update')
    } finally { setSaving(false) }
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUploading(true)
    try {
      const dataUri = await new Promise((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => res(reader.result)
        reader.onerror = rej
        reader.readAsDataURL(file)
      })
      await employeeApi.uploadPhoto(id, dataUri)
      toast.success('Photo uploaded')
      loadEmployee()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to upload photo')
    } finally { setPhotoUploading(false); if (photoRef.current) photoRef.current.value = '' }
  }

  async function handlePhotoDelete() {
    if (!confirm('Remove photo?')) return
    try { await employeeApi.deletePhoto(id); toast.success('Photo removed'); loadEmployee() }
    catch { toast.error('Failed to remove photo') }
  }

  async function handleConfirm() {
    try { await employeeApi.confirm(id); toast.success('Confirmed! 12 CL credited.'); loadEmployee() }
    catch { toast.error('Failed to confirm') }
  }

  // ── Policy Override ──────────────────────────────────────────────────────
  const POLICY_FIELDS = [
    { key: 'shift_type',                    label: 'Shift Type',              type: 'select',  options: ['general','morning','evening','night'] },
    { key: 'shift_start_time',              label: 'Shift Start Time',        type: 'time'   },
    { key: 'shift_end_time',                label: 'Shift End Time',          type: 'time'   },
    { key: 'shift_hours',                   label: 'Shift Hours',             type: 'number', min: 1,   max: 24  },
    { key: 'grace_period_minutes',          label: 'Grace Period (min)',      type: 'number', min: 0,   max: 60  },
    { key: 'ot_enabled',                    label: 'OT Enabled',              type: 'toggle' },
    { key: 'min_working_hours_for_halfday', label: 'Min Hours for Half Day',  type: 'number', min: 0.5, max: 12, step: 0.5 },
    { key: 'weekly_off_day',                label: 'Weekly Off Day',          type: 'select',  options: ['sunday','saturday','rotational'] },
    { key: 'second_fourth_saturday_off',    label: '2nd & 4th Saturday Off',  type: 'toggle' },
    { key: 'comp_off_enabled',              label: 'Comp Off Enabled',        type: 'toggle' },
    { key: 'night_shift_allowance',         label: 'Night Shift Allowance (₹)', type: 'number', min: 0, step: 0.01 },
  ]

  function validatePolicyForm() {
    const errs = {}
    const sh = parseFloat(policyForm.shift_hours)
    if (policyForm.shift_hours !== '' && (isNaN(sh) || sh < 1 || sh > 24)) errs.shift_hours = '1–24'
    const gp = parseFloat(policyForm.grace_period_minutes)
    if (policyForm.grace_period_minutes !== '' && (isNaN(gp) || gp < 0 || gp > 60)) errs.grace_period_minutes = '0–60'
    const mh = parseFloat(policyForm.min_working_hours_for_halfday)
    if (policyForm.min_working_hours_for_halfday !== '' && (isNaN(mh) || mh < 0.5 || mh > 12)) errs.min_working_hours_for_halfday = '0.5–12'
    const na = parseFloat(policyForm.night_shift_allowance)
    if (policyForm.night_shift_allowance !== '' && (isNaN(na) || na < 0)) errs.night_shift_allowance = '≥ 0'
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSavePolicy() {
    if (!validatePolicyForm()) return
    setPolicySaving(true)
    try {
      const payload = {}
      POLICY_FIELDS.forEach(f => {
        const val = policyForm[f.key]
        if (val === '' || val === undefined) {
          payload[f.key] = null
        } else if (f.type === 'toggle') {
          payload[f.key] = val === 'true' || val === true
        } else if (f.type === 'number') {
          payload[f.key] = parseFloat(val)
        } else {
          payload[f.key] = val
        }
      })
      await employeeApi.setPolicy(id, payload)
      toast.success('Policy overrides saved ✅')
      await loadTabData('Policy Override')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save policy')
    } finally { setPolicySaving(false) }
  }

  async function handleResetPolicy() {
    if (!confirm('Reset all overrides to company defaults?')) return
    setPolicySaving(true)
    try {
      await employeeApi.resetPolicy(id)
      toast.success('Policy reset to company defaults')
      await loadTabData('Policy Override')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reset policy')
    } finally { setPolicySaving(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div></div>
  if (notFound) return (
    <div className="text-center py-20">
      <User className="w-16 h-16 mx-auto text-gray-300 mb-4" />
      <h2 className="text-xl font-semibold text-gray-700 mb-2">Employee Not Found</h2>
      <p className="text-gray-500 mb-6">The employee you're looking for doesn't exist.</p>
      <Link to="/employees" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">← Back to Employees</Link>
    </div>
  )

  const emp = employee

  return (
    <div>
      {/* Back */}
      <Link to="/employees" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5">
        <ArrowLeft className="w-4 h-4" /> Back to Employees
      </Link>

      {/* Profile Header */}
      <div className="bg-white rounded-xl shadow p-6 mb-5">
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          {/* Photo */}
          <div className="relative">
            <Avatar emp={emp} size="xl" />
            <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoUpload} className="hidden" />
            <button onClick={() => photoRef.current?.click()} disabled={photoUploading}
              className="absolute -bottom-1 -right-1 p-1.5 bg-primary-600 text-white rounded-full hover:bg-primary-700 disabled:opacity-50">
              {photoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">{emp.name}</h1>
                <p className="text-gray-500">{emp.emp_code} · {emp.designation || '—'}</p>
                <p className="text-gray-400 text-sm">{emp.department || '—'}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {emp.photo_url && (
                  <button onClick={handlePhotoDelete} className="flex items-center gap-1 px-3 py-1.5 text-red-600 border border-red-200 rounded-lg text-xs hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" /> Remove Photo
                  </button>
                )}
                {!emp.is_confirmed && (
                  <button onClick={handleConfirm} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700">
                    <UserCheck className="w-3.5 h-3.5" /> Confirm
                  </button>
                )}
                {!editing ? (
                  <button onClick={startEdit} className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs hover:bg-primary-700">
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={saveEdit} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 disabled:opacity-50">
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                    </button>
                    <button onClick={() => setEditing(false)} className="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-xs text-gray-600 hover:bg-gray-50">
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-3 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${emp.is_confirmed ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                {emp.is_confirmed ? '✓ Confirmed' : '⏳ Probation'}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${emp.face_enrolled ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                {emp.face_enrolled ? '🔍 Face Enrolled' : 'No Face'}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${emp.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {emp.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-5 bg-white rounded-t-xl shadow-sm overflow-hidden">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-sm font-medium transition ${activeTab === tab ? 'border-b-2 border-primary-600 text-primary-600 bg-primary-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Details */}
          <div className="bg-white rounded-xl shadow p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Employee Details</h3>
            {editing ? (
              <div className="space-y-3">
                {[
                  { label: 'Full Name', key: 'name', type: 'text' },
                  { label: 'Email', key: 'email', type: 'email' },
                  { label: 'Phone', key: 'phone', type: 'text' },
                  { label: 'Department', key: 'department', type: 'text' },
                  { label: 'Designation', key: 'designation', type: 'text' },
                  { label: 'Salary (₹)', key: 'salary', type: 'number' },
                  { label: 'Joining Date', key: 'joining_date', type: 'date' },
                  { label: 'Aadhaar Number', key: 'aadhaar_no', type: 'text' },
                  { label: 'PAN Card Number', key: 'pan_no', type: 'text' },
                  { label: 'Bank Name', key: 'bank_name', type: 'text' },
                  { label: 'Account Number', key: 'account_no', type: 'text' },
                  { label: 'IFSC Code', key: 'ifsc_code', type: 'text' },
                  { label: 'Current Address', key: 'current_address', type: 'text' },
                  { label: 'Permanent Address', key: 'permanent_address', type: 'text' },
                  { label: 'Emergency Contact Name', key: 'emergency_name', type: 'text' },
                  { label: 'Emergency Contact Phone', key: 'emergency_phone', type: 'text' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                    <input type={f.type} value={editForm[f.key] || ''} onChange={e => setEditForm(d => ({...d, [f.key]: e.target.value}))}
                      className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { icon: User, label: 'Name', value: emp.name },
                  { icon: Mail, label: 'Email', value: emp.email || '—' },
                  { icon: Phone, label: 'Phone', value: emp.phone || '—' },
                  { icon: Building, label: 'Department', value: emp.department || '—' },
                  { icon: Briefcase, label: 'Designation', value: emp.designation || '—' },
                  { icon: DollarSign, label: 'Salary', value: emp.salary ? '₹' + Number(emp.salary).toLocaleString('en-IN') : '—' },
                  { icon: Calendar, label: 'Joining Date', value: emp.joining_date || '—' },
                  { icon: Calendar, label: 'Probation End', value: emp.probation_end_date || '—' },
                  { icon: FileText, label: 'Aadhaar No', value: emp.aadhaar_no || '—' },
                  { icon: FileText, label: 'PAN Card', value: emp.pan_no || '—' },
                  { icon: Landmark, label: 'Bank Name', value: emp.bank_name || '—' },
                  { icon: CreditCard, label: 'Account No', value: emp.account_no || '—' },
                  { icon: CreditCard, label: 'IFSC Code', value: emp.ifsc_code || '—' },
                  { icon: MapPin, label: 'Address (C)', value: emp.current_address || '—' },
                  { icon: MapPin, label: 'Address (P)', value: emp.permanent_address || '—' },
                  { icon: PhoneCall, label: 'Emergency', value: emp.emergency_name ? `${emp.emergency_name} (${emp.emergency_phone || '—'})` : '—' },
                ].map(f => {
                  const Icon = f.icon || User
                  return (
                    <div key={f.label} className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-xs text-gray-500 w-28">{f.label}</span>
                      <span className="text-sm text-gray-800">{f.value}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl shadow p-5">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><FileText className="w-4 h-4" /> Notes / Remarks</h3>
            {editing ? (
              <textarea value={editForm.remarks || ''} onChange={e => setEditForm(d => ({...d, remarks: e.target.value}))}
                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 h-40" maxLength={2000}
                placeholder="Add notes about this employee..." />
            ) : (
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{emp.remarks || <span className="text-gray-400 italic">No notes added yet.</span>}</p>
            )}
          </div>
        </div>
      )}

      {/* Attendance Tab */}
      {activeTab === 'Attendance' && (
        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="font-semibold text-gray-800 mb-4">This Month's Attendance</h3>
          {tabLoading ? <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div> : (
            attendance ? (
              <div>
                <div className="grid grid-cols-3 gap-4 mb-5">
                  {[
                    { label: 'Present', value: attendance.summary?.present ?? 0, color: 'text-green-600 bg-green-50' },
                    { label: 'Absent', value: attendance.summary?.absent ?? 0, color: 'text-red-600 bg-red-50' },
                    { label: 'Late Marks', value: attendance.summary?.late_mark ?? 0, color: 'text-yellow-600 bg-yellow-50' },
                  ].map(s => (
                    <div key={s.label} className={`rounded-xl p-4 text-center ${s.color}`}>
                      <p className="text-2xl font-bold">{s.value}</p>
                      <p className="text-xs mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>
                {attendance.records?.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                        <tr>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">Check In</th>
                          <th className="px-3 py-2 text-left">Check Out</th>
                          <th className="px-3 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {attendance.records.slice(0, 10).map(r => (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2">{r.date}</td>
                            <td className="px-3 py-2">{r.check_in ? r.check_in.slice(11,16) : '—'}</td>
                            <td className="px-3 py-2">{r.check_out ? r.check_out.slice(11,16) : '—'}</td>
                            <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${r.status === 'present' ? 'bg-green-100 text-green-700' : r.status === 'absent' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{r.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : <p className="text-gray-400 text-center py-8">No attendance data</p>
          )}
        </div>
      )}

      {/* Leaves Tab */}
      {activeTab === 'Leaves' && (
        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Leave Balance — {new Date().getFullYear()}</h3>
          {tabLoading ? <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div> : (
            leaves ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'CL Available', value: `${Math.max(0,(leaves.cl_total||0)-(leaves.cl_used||0))} / ${leaves.cl_total||0}`, color: 'border-blue-400 text-blue-700' },
                  { label: 'SL Used', value: leaves.sl_used || 0, color: 'border-green-400 text-green-700' },
                  { label: 'EL Used', value: leaves.el_used || 0, color: 'border-purple-400 text-purple-700' },
                  { label: 'LWP Days', value: leaves.lwp_days || 0, color: 'border-red-400 text-red-700' },
                ].map(c => (
                  <div key={c.label} className={`rounded-xl p-4 text-center border-t-4 bg-gray-50 ${c.color.split(' ')[0]}`}>
                    <p className={`text-2xl font-bold ${c.color.split(' ')[1]}`}>{c.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{c.label}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-gray-400 text-center py-8">No leave data</p>
          )}
        </div>
      )}

      {/* Payroll Tab */}
      {activeTab === 'Payroll' && (
        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Payroll History (Last 6 Months)</h3>
          {tabLoading ? <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div> : (
            payrolls.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Month</th>
                      <th className="px-3 py-2 text-right">Gross</th>
                      <th className="px-3 py-2 text-right">Deductions</th>
                      <th className="px-3 py-2 text-right">Net Pay</th>
                      <th className="px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {payrolls.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">{MONTHS[(p.month||1)-1]} {p.year}</td>
                        <td className="px-3 py-2 text-right">₹{(p.gross_salary||0).toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-right text-red-600">₹{(p.total_deductions||0).toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-right font-semibold text-green-700">₹{(p.net_pay||0).toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded-full text-xs ${p.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{p.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-gray-400 text-center py-8">No payroll records</p>
          )}
        </div>
      )}

      {/* Policy Override Tab */}
      {activeTab === 'Policy Override' && (
        <div className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">⚙️ Policy Override</h3>
            <span className="text-xs text-gray-400">Null fields use company defaults</span>
          </div>

          {tabLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>
          ) : policyError ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">{policyError}</div>
          ) : policyData ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {POLICY_FIELDS.map(f => {
                  const isCustom = policyData.override?.[f.key] != null
                  const companyDefault = policyData.company_policy?.[f.key]
                  return (
                    <div key={f.key}>
                      <div className="flex items-center gap-2 mb-1">
                        <label className="text-xs font-medium text-gray-600">{f.label}</label>
                        {isCustom && (
                          <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-medium rounded">Custom</span>
                        )}
                      </div>
                      {f.type === 'select' ? (
                        <select
                          value={policyForm[f.key] || ''}
                          onChange={e => setPolicyForm(p => ({...p, [f.key]: e.target.value}))}
                          className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                        >
                          <option value="">— Company default ({companyDefault}) —</option>
                          {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : f.type === 'toggle' ? (
                        <div className="flex items-center gap-3">
                          <select
                            value={policyForm[f.key] !== '' ? policyForm[f.key] : ''}
                            onChange={e => setPolicyForm(p => ({...p, [f.key]: e.target.value}))}
                            className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                          >
                            <option value="">— Default ({String(companyDefault)}) —</option>
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
                        </div>
                      ) : f.type === 'time' ? (
                        <input
                          type="time"
                          value={policyForm[f.key] || ''}
                          onChange={e => setPolicyForm(p => ({...p, [f.key]: e.target.value}))}
                          placeholder={String(companyDefault)}
                          className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      ) : (
                        <input
                          type="number"
                          min={f.min}
                          max={f.max}
                          step={f.step || 1}
                          value={policyForm[f.key] || ''}
                          onChange={e => setPolicyForm(p => ({...p, [f.key]: e.target.value}))}
                          placeholder={`Default: ${companyDefault}`}
                          className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      )}
                      {formErrors[f.key] && (
                        <p className="text-red-500 text-xs mt-1">Valid range: {formErrors[f.key]}</p>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={handleSavePolicy}
                  disabled={policySaving}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {policySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save Overrides
                </button>
                <button
                  onClick={handleResetPolicy}
                  disabled={policySaving}
                  className="px-5 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                >
                  Reset All to Default
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}
