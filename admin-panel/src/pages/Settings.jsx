import { useState, useEffect } from 'react'
import { Save, Loader2 } from 'lucide-react'
import { settingsApi } from '../services/api'
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
function Section({ title, description, children }) {
  return (
    <div className="bg-white rounded-xl shadow p-6 mb-4">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-800">{title}</h2>
        {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {children}
      </div>
    </div>
  )
}

// Field wrapper
function Field({ label, error, children, fullWidth }) {
  return (
    <div className={fullWidth ? 'sm:col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
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

function validate(policy) {
  const errors = {}
  if (policy.shift_hours < 1 || policy.shift_hours > 24)
    errors.shift_hours = 'Must be between 1 and 24'
  if (policy.grace_period_minutes < 0 || policy.grace_period_minutes > 60)
    errors.grace_period_minutes = 'Must be between 0 and 60'
  if (policy.allowed_late_marks_per_month < 0 || policy.allowed_late_marks_per_month > 31)
    errors.allowed_late_marks_per_month = 'Must be between 0 and 31'
  if (policy.min_working_hours_for_halfday < 0.5 || policy.min_working_hours_for_halfday > 12)
    errors.min_working_hours_for_halfday = 'Must be between 0.5 and 12'
  if (policy.comp_off_expiry_days < 1 || policy.comp_off_expiry_days > 365)
    errors.comp_off_expiry_days = 'Must be between 1 and 365'
  if (policy.missed_punch_requests_per_month < 0 || policy.missed_punch_requests_per_month > 10)
    errors.missed_punch_requests_per_month = 'Must be between 0 and 10'
  return errors
}

export default function Settings() {
  const [policy, setPolicy] = useState(DEFAULTS)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fetchError, setFetchError] = useState(null)

  useEffect(() => {
    settingsApi.getPolicy()
      .then(r => {
        setPolicy({ ...DEFAULTS, ...r.data })
        setFetchError(null)
      })
      .catch(() => setFetchError('Failed to load policy settings. Please refresh.'))
      .finally(() => setLoading(false))
  }, [])

  function set(field, value) {
    setPolicy(p => ({ ...p, [field]: value }))
    setErrors(e => { const n = { ...e }; delete n[field]; return n })
  }

  async function handleSave() {
    const errs = validate(policy)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      toast.error('Please fix validation errors before saving')
      return
    }
    setSaving(true)
    try {
      const r = await settingsApi.updatePolicy(policy)
      setPolicy({ ...DEFAULTS, ...r.data })
      toast.success('Settings saved successfully ✅')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600">{fetchError}</p>
      </div>
    )
  }

  const numInput = (field, min, max, step = 1) => (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={policy[field]}
      onChange={e => set(field, parseFloat(e.target.value))}
      className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
    />
  )

  const selectInput = (field, options) => (
    <select
      value={policy[field]}
      onChange={e => set(field, e.target.value)}
      className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
    >
      {options.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
    </select>
  )

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Attendance Policy Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Configure company-wide attendance rules. Changes apply to all future calculations.</p>
      </div>

      {/* Section 1: Working Hours & Shift */}
      <Section title="⏰ Working Hours & Shift" description="Define shift timings and working hour requirements">
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
            onChange={e => set('shift_start_time', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400" />
        </Field>
        <Field label="Shift End Time">
          <input type="time" value={policy.shift_end_time}
            onChange={e => set('shift_end_time', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400" />
        </Field>
        <Field label="Daily Shift Hours" error={errors.shift_hours}>
          {numInput('shift_hours', 1, 24)}
        </Field>
        <Field label="Weekly Limit Hours">
          {numInput('weekly_limit_hours', 1, 168)}
        </Field>
        <Field label="Break Time (minutes)">
          {numInput('break_time_minutes', 0, 120)}
        </Field>
        <Field label="Night Shift Allowance (₹)">
          {numInput('night_shift_allowance', 0, 99999, 0.01)}
        </Field>
      </Section>

      {/* Section 2: Late Coming */}
      <Section title="🕐 Late Coming Policy" description="Rules for employees who arrive after shift start">
        <Field label="Grace Period (minutes)" error={errors.grace_period_minutes}>
          {numInput('grace_period_minutes', 0, 60)}
        </Field>
        <Field label="Allowed Late Marks / Month" error={errors.allowed_late_marks_per_month}>
          {numInput('allowed_late_marks_per_month', 0, 31)}
        </Field>
        <Field label="Action After Limit Exceeded">
          {selectInput('late_action', [
            ['half_day', 'Mark Half Day'],
            ['salary_deduction', 'Salary Deduction'],
          ])}
        </Field>
      </Section>

      {/* Section 3: Early Leaving */}
      <Section title="🚶 Early Leaving Policy" description="Rules for employees who leave before shift end">
        <Field label="Min Working Hours for Half Day" error={errors.min_working_hours_for_halfday}>
          {numInput('min_working_hours_for_halfday', 0.5, 12, 0.5)}
        </Field>
        <Field label="Early Leaving Action">
          {selectInput('early_leaving_action', [
            ['half_day', 'Mark Half Day'],
            ['salary_deduction', 'Salary Deduction'],
          ])}
        </Field>
      </Section>

      {/* Section 4: Absent Policy */}
      <Section title="🚫 Absent Policy" description="Rules for consecutive absences">
        <Field label="Consecutive Absent Threshold (days)">
          {numInput('consecutive_absent_threshold', 1, 30)}
        </Field>
      </Section>

      {/* Section 5: Overtime */}
      <Section title="⏱️ Overtime (OT)" description="Configure overtime calculation rules">
        <Field label="Enable Overtime" fullWidth>
          <div className="flex items-center gap-3">
            <Toggle checked={policy.ot_enabled} onChange={v => set('ot_enabled', v)} />
            <span className="text-sm text-gray-600">{policy.ot_enabled ? 'Enabled' : 'Disabled'}</span>
          </div>
        </Field>
        {policy.ot_enabled && (
          <>
            <Field label="Normal Day OT Multiplier">
              {numInput('ot_normal_multiplier', 1, 5, 0.5)}
            </Field>
            <Field label="Holiday / Weekly Off OT Multiplier">
              {numInput('ot_holiday_multiplier', 1, 5, 0.5)}
            </Field>
          </>
        )}
      </Section>

      {/* Section 6: Weekly Off & Holidays */}
      <Section title="🏖️ Weekly Off & Holidays" description="Configure weekly off days">
        <Field label="Weekly Off Day">
          {selectInput('weekly_off_day', [
            ['sunday', 'Sunday'],
            ['saturday', 'Saturday'],
            ['rotational', 'Rotational'],
          ])}
        </Field>
        <Field label="2nd & 4th Saturday Off">
          <div className="flex items-center gap-3 mt-1">
            <Toggle checked={policy.second_fourth_saturday_off}
              onChange={v => set('second_fourth_saturday_off', v)} />
            <span className="text-sm text-gray-600">{policy.second_fourth_saturday_off ? 'Yes' : 'No'}</span>
          </div>
        </Field>
      </Section>

      {/* Section 7: Comp-Off */}
      <Section title="🔁 Comp-Off Policy" description="Compensatory leave for working on holidays/weekly off">
        <Field label="Enable Comp-Off">
          <div className="flex items-center gap-3 mt-1">
            <Toggle checked={policy.comp_off_enabled} onChange={v => set('comp_off_enabled', v)} />
            <span className="text-sm text-gray-600">{policy.comp_off_enabled ? 'Enabled' : 'Disabled'}</span>
          </div>
        </Field>
        {policy.comp_off_enabled && (
          <Field label="Comp-Off Expiry (days)" error={errors.comp_off_expiry_days}>
            {numInput('comp_off_expiry_days', 1, 365)}
          </Field>
        )}
      </Section>

      {/* Section 8: Missed Punch */}
      <Section title="⚠️ Missed Punch Policy" description="Regularization request limits">
        <Field label="Max Requests / Month" error={errors.missed_punch_requests_per_month}>
          {numInput('missed_punch_requests_per_month', 0, 10)}
        </Field>
      </Section>

      {/* Save button */}
      <div className="sticky bottom-0 bg-gray-50 py-4 border-t mt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save All Settings'}
        </button>
      </div>
    </div>
  )
}
