import { useState, useEffect } from 'react'
import { 
  Save, Loader2, Mail, Settings as SettingsIcon, Send, 
  ShieldCheck, Server, TrendingUp, Building2, Landmark 
} from 'lucide-react'
import { settingsApi, companyApi } from '../services/api'
import toast from 'react-hot-toast'

// Toggle switch component
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
        ${checked ? 'bg-blue-600' : 'bg-gray-300'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
        ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

// Section card wrapper
function Section({ title, description, children, icon: Icon }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
      <div className="mb-6 flex items-start gap-3">
        {Icon && (
          <div className="p-2 bg-blue-50 rounded-lg">
            <Icon className="w-5 h-5 text-blue-600" />
          </div>
        )}
        <div>
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {children}
      </div>
    </div>
  )
}

// Field wrapper
function Field({ label, error, children, fullWidth, hint }) {
  return (
    <div className={fullWidth ? 'sm:col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wider">{label}</label>
      {children}
      {hint && <p className="text-gray-400 text-[11px] mt-1.5 italic">{hint}</p>}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

const COMPANY_DEFAULTS = {
  name: '',
  logo_url: '',
  tagline: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  registration_no: '',
  gst_no: '',
  pan_no: '',
  pf_code: '',
  esi_code: '',
  tan_no: '',
  professional_tax_no: '',
  bank_name: '',
  account_no: '',
  ifsc_code: '',
  branch_name: '',
  account_type: 'Current'
}

const DEFAULTS = {
  shift_hours: 8,
  weekly_limit_hours: 48,
  break_time_minutes: 30,
  grace_period_minutes: 5,
  allowed_late_marks_per_month: 3,
  late_action: 'half_day',
  min_working_hours_for_halfday: 4.5,
  early_leaving_action: 'half_day',
  consecutive_absent_threshold: 3,
  ot_enabled: false,
  ot_normal_multiplier: 2.0,
  ot_holiday_multiplier: 3.0,
  weekly_off_day: 'sunday',
  second_fourth_saturday_off: true,
  comp_off_enabled: true,
  comp_off_expiry_days: 30,
  missed_punch_requests_per_month: 2,
  shift_type: 'general',
  shift_start_time: '09:30',
  shift_end_time: '18:30',
  night_shift_allowance: 0,
}

const SMTP_DEFAULTS = {
  smtp_host: '',
  smtp_port: 587,
  smtp_user: '',
  smtp_password: '',
  sender_email: '',
  sender_name: 'HRMS Admin',
  use_tls: true,
  app_url: 'https://drne2yi2f6fd.share.zrok.io/employee',
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('policy') 
  const [policy, setPolicy] = useState(DEFAULTS)
  const [smtp, setSmtp] = useState(SMTP_DEFAULTS)
  const [company, setCompany] = useState(COMPANY_DEFAULTS)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    setLoading(true)
    if (activeTab === 'policy') {
      settingsApi.getPolicy()
        .then(r => setPolicy({ ...DEFAULTS, ...r.data }))
        .catch(() => toast.error('Failed to load policy settings'))
        .finally(() => setLoading(false))
    } else if (activeTab === 'smtp') {
      settingsApi.getSmtp()
        .then(r => setSmtp({ ...SMTP_DEFAULTS, ...r.data }))
        .catch(() => toast.error('Failed to load SMTP settings'))
        .finally(() => setLoading(false))
    } else {
      // For company, legal, bank tabs
      companyApi.get()
        .then(r => setCompany({ ...COMPANY_DEFAULTS, ...r.data }))
        .catch(() => toast.error('Failed to load company details'))
        .finally(() => setLoading(false))
    }
  }, [activeTab])

  function setPolicyField(field, value) {
    setPolicy(p => ({ ...p, [field]: value }))
    setErrors(e => { const n = { ...e }; delete n[field]; return n })
  }

  function setSmtpField(field, value) {
    setSmtp(s => ({ ...s, [field]: value }))
  }

  function setCompanyField(field, value) {
    setCompany(c => ({ ...c, [field]: value }))
  }

  async function handleSaveCompany() {
    setSaving(true)
    try {
      await companyApi.update(company)
      toast.success('Company details updated ✅')
    } catch (err) {
      toast.error('Failed to save company details')
    } finally {
      setSaving(false)
    }
  }

    async function handleSaveSmtp() {
    if (!smtp.smtp_host || !smtp.smtp_user || !smtp.smtp_password || !smtp.sender_email) {
      toast.error('Please fill all required SMTP fields')
      return
    }
    setSaving(true)
    try {
      await settingsApi.updateSmtp(smtp)
      toast.success('SMTP settings updated ✅')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save SMTP settings')
    } finally {
      setSaving(false)
    }
  }

  async function handleTestSmtp() {
    if (!smtp.smtp_host || !smtp.smtp_user || !smtp.smtp_password || !smtp.sender_email) {
      toast.error('Fill details before testing')
      return
    }
    setTesting(true)
    try {
      const r = await settingsApi.testSmtp(smtp)
      if (r.data.error) {
        toast.error(`Error: ${r.data.error}`)
      } else {
        toast.success(r.data.message || 'Test email sent! Check your inbox.')
      }
    } catch (err) {
      toast.error('SMTP test failed')
    } finally {
      setTesting(false)
    }
  }

  async function handleSavePolicy() {
    setSaving(true)
    try {
      await settingsApi.updatePolicy(policy)
      toast.success('Attendance policy updated ✅')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveSmtp() {
    if (!smtp.smtp_host || !smtp.smtp_user || !smtp.smtp_password || !smtp.sender_email) {
      toast.error('Please fill all required SMTP fields')
      return
    }
    setSaving(true)
    try {
      await settingsApi.updateSmtp(smtp)
      toast.success('SMTP settings updated ✅')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save SMTP settings')
    } finally {
      setSaving(false)
    }
  }

  async function handleTestSmtp() {
    if (!smtp.smtp_host || !smtp.smtp_user || !smtp.smtp_password || !smtp.sender_email) {
      toast.error('Fill details before testing')
      return
    }
    setTesting(true)
    try {
      const r = await settingsApi.testSmtp(smtp)
      if (r.data.error) {
        toast.error(`Error: ${r.data.error}`)
      } else {
        toast.success(r.data.message || 'Test email sent! Check your inbox.')
      }
    } catch (err) {
      toast.error('SMTP test failed')
    } finally {
      setTesting(false)
    }
  }

  const numInput = (field, min, max, step = 1) => (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={policy[field]}
      onChange={e => setPolicyField(field, parseFloat(e.target.value))}
      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
    />
  )

  const selectInput = (field, options) => (
    <select
      value={policy[field]}
      onChange={e => setPolicyField(field, e.target.value)}
      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
    >
      {options.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
    </select>
  )

  return (
    <div className="max-w-4xl pb-20">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage company policies and system configurations</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-8 overflow-x-auto max-w-full no-scrollbar">
        {[
          { id: 'policy', label: 'Attendance Policy', icon: SettingsIcon },
          { id: 'company', label: 'Company Details', icon: Building2 },
          { id: 'smtp', label: 'SMTP Settings', icon: Mail },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-2xl border border-dashed border-gray-200">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : activeTab === 'policy' ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Section title="Working Hours & Shift" description="Define shift timings and working hour requirements" icon={Server}>
            <Field label="Shift Type">
              {selectInput('shift_type', [
                ['general', 'General Shift'],
                ['morning', 'Morning Shift'],
                ['evening', 'Evening Shift'],
                ['night', 'Night Shift'],
              ])}
            </Field>
            <Field label="Shift Start Time">
              <input type="time" value={policy.shift_start_time}
                onChange={e => setPolicyField('shift_start_time', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
            </Field>
            <Field label="Shift End Time">
              <input type="time" value={policy.shift_end_time}
                onChange={e => setPolicyField('shift_end_time', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
            </Field>
            <Field label="Daily Shift Hours">
              {numInput('shift_hours', 1, 24)}
            </Field>
            <Field label="Weekly Limit Hours">
              {numInput('weekly_limit_hours', 1, 168)}
            </Field>
            <Field label="Break Time (minutes)">
              {numInput('break_time_minutes', 0, 120)}
            </Field>
          </Section>

          <Section title="Late Coming & Early Leaving" description="Rules for attendance punctuality" icon={ShieldCheck}>
            <Field label="Grace Period (minutes)">
              {numInput('grace_period_minutes', 0, 60)}
            </Field>
            <Field label="Allowed Late Marks / Month">
              {numInput('allowed_late_marks_per_month', 0, 31)}
            </Field>
            <Field label="Action After Limit">
              {selectInput('late_action', [
                ['half_day', 'Mark Half Day'],
                ['salary_deduction', 'Salary Deduction'],
              ])}
            </Field>
            <Field label="Min Working Hours for Half Day">
              {numInput('min_working_hours_for_halfday', 0.5, 12, 0.5)}
            </Field>
          </Section>

          <Section title="Overtime & Comp-Off" description="Calculation rules for extra work" icon={TrendingUp}>
             <Field label="Enable Overtime" fullWidth>
              <div className="flex items-center gap-3">
                <Toggle checked={policy.ot_enabled} onChange={v => setPolicyField('ot_enabled', v)} />
                <span className="text-sm text-gray-600 font-medium">{policy.ot_enabled ? 'Enabled' : 'Disabled'}</span>
              </div>
            </Field>
            {policy.ot_enabled && (
              <>
                <Field label="Normal Day Multiplier">
                  {numInput('ot_normal_multiplier', 1, 5, 0.5)}
                </Field>
                <Field label="Holiday Multiplier">
                  {numInput('ot_holiday_multiplier', 1, 5, 0.5)}
                </Field>
              </>
            )}
            <Field label="Enable Comp-Off" fullWidth>
              <div className="flex items-center gap-3">
                <Toggle checked={policy.comp_off_enabled} onChange={v => setPolicyField('comp_off_enabled', v)} />
                <span className="text-sm text-gray-600 font-medium">{policy.comp_off_enabled ? 'Enabled' : 'Disabled'}</span>
              </div>
            </Field>
          </Section>

          <div className="fixed bottom-6 right-6">
            <button
              onClick={handleSavePolicy}
              disabled={saving}
              className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 hover:-translate-y-0.5 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Save Changes
            </button>
          </div>
        </div>
      ) : activeTab === 'company' ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Basic Info */}
          <Section title="Basic Information" description="General details about your company" icon={Building2}>
            <Field label="Company Name" fullWidth>
              <input type="text" value={company.name} onChange={e => setCompanyField('name', e.target.value)}
                placeholder="e.g. Acme Corporation"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
            </Field>
            <Field label="Tagline">
              <input type="text" value={company.tagline} onChange={e => setCompanyField('tagline', e.target.value)}
                placeholder="Company slogan"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
            </Field>
            <Field label="Website">
              <input type="url" value={company.website} onChange={e => setCompanyField('website', e.target.value)}
                placeholder="https://example.com"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
            </Field>
            <Field label="Contact Email">
              <input type="email" value={company.email} onChange={e => setCompanyField('email', e.target.value)}
                placeholder="hr@company.com"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
            </Field>
            <Field label="Phone Number">
              <input type="text" value={company.phone} onChange={e => setCompanyField('phone', e.target.value)}
                placeholder="+91 ..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
            </Field>
            <Field label="Address" fullWidth>
              <textarea value={company.address} onChange={e => setCompanyField('address', e.target.value)}
                rows={3}
                placeholder="Full registered address"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none" />
            </Field>
          </Section>

          {/* Legal/Tax Info */}
          <Section title="Statutory Registration" description="Tax and compliance registration details" icon={ShieldCheck}>
            <Field label="Registration / CIN No.">
              <input type="text" value={company.registration_no} onChange={e => setCompanyField('registration_no', e.target.value)}
                placeholder="U12345MH..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
            </Field>
            <Field label="GST Number">
              <input type="text" value={company.gst_no} onChange={e => setCompanyField('gst_no', e.target.value)}
                placeholder="27AA..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
            </Field>
            <Field label="PAN Card Number">
              <input type="text" value={company.pan_no} onChange={e => setCompanyField('pan_no', e.target.value)}
                placeholder="ABCDP1234E"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
            </Field>
            <Field label="TAN Number">
              <input type="text" value={company.tan_no} onChange={e => setCompanyField('tan_no', e.target.value)}
                placeholder="MUMB12345F"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
            </Field>
            <Field label="PF Code">
              <input type="text" value={company.pf_code} onChange={e => setCompanyField('pf_code', e.target.value)}
                placeholder="MH/..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
            </Field>
            <Field label="ESI Code">
              <input type="text" value={company.esi_code} onChange={e => setCompanyField('esi_code', e.target.value)}
                placeholder="3100..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
            </Field>
            <Field label="Professional Tax No.">
              <input type="text" value={company.professional_tax_no} onChange={e => setCompanyField('professional_tax_no', e.target.value)}
                placeholder="PTEC/..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
            </Field>
          </Section>

          {/* Bank Info */}
          <Section title="Corporate Bank Account" description="Details for salary disbursements and billing" icon={Landmark}>
            <Field label="Bank Name" fullWidth>
              <input type="text" value={company.bank_name} onChange={e => setCompanyField('bank_name', e.target.value)}
                placeholder="e.g. HDFC Bank"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
            </Field>
            <Field label="Account Number">
              <input type="text" value={company.account_no} onChange={e => setCompanyField('account_no', e.target.value)}
                placeholder="50100..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
            </Field>
            <Field label="IFSC Code">
              <input type="text" value={company.ifsc_code} onChange={e => setCompanyField('ifsc_code', e.target.value)}
                placeholder="HDFC0001234"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
            </Field>
            <Field label="Branch Name">
              <input type="text" value={company.branch_name} onChange={e => setCompanyField('branch_name', e.target.value)}
                placeholder="Mumbai Central"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
            </Field>
            <Field label="Account Type">
              <select value={company.account_type} onChange={e => setCompanyField('account_type', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white">
                <option value="Current">Current Account</option>
                <option value="Savings">Savings Account</option>
                <option value="OD">Overdraft Account</option>
              </select>
            </Field>
          </Section>

          <div className="fixed bottom-6 right-6">
            <button
              onClick={handleSaveCompany}
              disabled={saving}
              className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 hover:-translate-y-0.5 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Save Company Details
            </button>
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Section title="Email Server Configuration" description="SMTP server details for sending automated notifications" icon={Mail}>
            <Field label="SMTP Host" hint="e.g. smtp.gmail.com">
              <input
                type="text"
                value={smtp.smtp_host}
                onChange={e => setSmtpField('smtp_host', e.target.value)}
                placeholder="smtp.example.com"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </Field>
            <Field label="SMTP Port" hint="Usually 587 (TLS) or 465 (SSL)">
              <input
                type="number"
                value={smtp.smtp_port}
                onChange={e => setSmtpField('smtp_port', parseInt(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </Field>
            <Field label="SMTP Username" hint="Your email or username">
              <input
                type="text"
                value={smtp.smtp_user}
                onChange={e => setSmtpField('smtp_user', e.target.value)}
                placeholder="user@example.com"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </Field>
            <Field label="SMTP Password" hint="Use an App Password if using Gmail">
              <input
                type="password"
                value={smtp.smtp_password}
                onChange={e => setSmtpField('smtp_password', e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </Field>
          </Section>

          <Section title="Sender Identity" description="How the email appears to the recipient" icon={ShieldCheck}>
            <Field label="Sender Email" hint="Should be same as SMTP user usually">
              <input
                type="email"
                value={smtp.sender_email}
                onChange={e => setSmtpField('sender_email', e.target.value)}
                placeholder="no-reply@company.com"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </Field>
            <Field label="Sender Name" hint="Display name in inbox">
              <input
                type="text"
                value={smtp.sender_name}
                onChange={e => setSmtpField('sender_name', e.target.value)}
                placeholder="HR Department"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </Field>
            <Field label="PWA Portal URL" hint="URL sent to employees in welcome email">
              <input
                type="text"
                value={smtp.app_url}
                onChange={e => setSmtpField('app_url', e.target.value)}
                placeholder="https://..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </Field>
            <Field label="Use TLS / SSL" fullWidth>
              <div className="flex items-center gap-3">
                <Toggle checked={smtp.use_tls} onChange={v => setSmtpField('use_tls', v)} />
                <span className="text-sm text-gray-600 font-medium">{smtp.use_tls ? 'Enabled (Secure)' : 'Disabled'}</span>
              </div>
            </Field>
          </Section>

          <div className="fixed bottom-6 right-6 flex gap-3">
            <button
              onClick={handleTestSmtp}
              disabled={testing || saving}
              className="flex items-center gap-2 px-6 py-3 bg-white text-blue-600 border border-blue-200 rounded-2xl font-bold shadow-lg hover:bg-blue-50 hover:-translate-y-0.5 transition-all disabled:opacity-50"
            >
              {testing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              Test Connection
            </button>
            <button
              onClick={handleSaveSmtp}
              disabled={saving || testing}
              className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 hover:-translate-y-0.5 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Save SMTP Settings
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
