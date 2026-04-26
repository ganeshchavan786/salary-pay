import { useState, useEffect } from 'react'
import { Save, History, User, Plus, X, Settings } from 'lucide-react'
import { api } from '../services/api'
import toast from 'react-hot-toast'

const TAX_REGIMES = [
  { value: 'NEW', label: 'New Regime (FY 2026-27)' },
  { value: 'OLD', label: 'Old Regime' },
]

const DEFAULT_FORM = {
  basic_salary: '',
  hra_percentage: 0,
  special_allowance: '',
  travel_allowance: '',
  medical_allowance: '',
  pf_applicable: true,
  esi_applicable: true,
  pt_applicable: true,
  tax_regime: 'NEW',
}

// Task 4.1: diffConfigs utility — returns Set of field keys that differ between two config objects
function diffConfigs(prev, curr) {
  const fields = [
    'basic_salary', 'hra_percentage', 'special_allowance',
    'travel_allowance', 'medical_allowance',
    'pf_applicable', 'esi_applicable', 'pt_applicable',
    'tax_regime', 'custom_payheads',
  ]
  return new Set(fields.filter(f => JSON.stringify(prev[f]) !== JSON.stringify(curr[f])))
}

const HIGHLIGHT_CLASS = 'bg-yellow-50 border-l-2 border-yellow-400 pl-2'

export default function PayheadConfig() {
  const [employees, setEmployees] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [form, setForm] = useState(DEFAULT_FORM)
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(false)
  // Task 8.1: custom payheads state
  const [customPayheads, setCustomPayheads] = useState([])
  const [customPayheadError, setCustomPayheadError] = useState('')
  // Task 13.1: auto-fill state
  const [autoFilled, setAutoFilled] = useState(false)
  // Task 14.1: statutory rates state
  const [statutoryRates, setStatutoryRates] = useState([])
  const [showRatesEditor, setShowRatesEditor] = useState(false)
  const [ratesForm, setRatesForm] = useState({ pf_employee: '', esi_employee: '', pt: '' })
  const [savingRates, setSavingRates] = useState(false)

  useEffect(() => {
    fetchEmployees()
    fetchStatutoryRates()
  }, [])

  useEffect(() => {
    if (selectedEmployee) {
      fetchConfig()
      setShowHistory(false)
    }
  }, [selectedEmployee])

  async function fetchEmployees() {
    try {
      const r = await api.get('/employees?limit=200')
      setEmployees(r.data?.employees || r.data || [])
    } catch { toast.error('Failed to load employees') }
  }

  // Task 14.1: fetch statutory rates on mount
  async function fetchStatutoryRates() {
    try {
      const r = await api.get('/v1/statutory-rates/')
      const rates = r.data || []
      setStatutoryRates(rates)
      // Pre-fill rates editor
      const pfEmp = rates.find(r => r.deduction_type === 'PF_EMPLOYEE')
      const esiEmp = rates.find(r => r.deduction_type === 'ESI_EMPLOYEE')
      const pt = rates.find(r => r.deduction_type === 'PT')
      setRatesForm({
        pf_employee: pfEmp ? String(pfEmp.rate_value) : '12',
        esi_employee: esiEmp ? String(esiEmp.rate_value) : '0.75',
        pt: pt ? String(pt.rate_value) : '200',
      })
    } catch {
      console.warn('Failed to fetch statutory rates, using hardcoded defaults')
    }
  }

  async function fetchConfig() {
    setLoadingConfig(true)
    setAutoFilled(false)  // Task 13.1: clear autoFilled at start
    try {
      const r = await api.get(`/v1/salary-configs/employee/${selectedEmployee}`)
      const config = r.data
      if (config) {
        setForm({
          basic_salary: config.basic_salary ?? '',
          hra_percentage: config.hra_percentage ?? 0,
          special_allowance: config.special_allowance ?? '',
          travel_allowance: config.travel_allowance ?? '',
          medical_allowance: config.medical_allowance ?? '',
          pf_applicable: config.pf_applicable ?? true,
          esi_applicable: config.esi_applicable ?? true,
          pt_applicable: config.pt_applicable ?? true,
          tax_regime: config.tax_regime ?? 'NEW',
        })
        // Task 8.1: populate custom payheads from config
        setCustomPayheads(config.custom_payheads || [])
      } else {
        setForm(DEFAULT_FORM)
        setCustomPayheads([])
      }
    } catch (err) {
      // Task 13.1: on 404, auto-populate from employee profile
      if (err.response?.status === 404) {
        const emp = employees.find(e => String(e.id) === String(selectedEmployee))
        setForm({ ...DEFAULT_FORM, basic_salary: emp?.salary ?? '' })
        setCustomPayheads([])
        if (emp?.salary) setAutoFilled(true)
      } else {
        setForm(DEFAULT_FORM)
        setCustomPayheads([])
      }
    } finally { setLoadingConfig(false) }
  }

  async function fetchHistory() {
    try {
      const r = await api.get(`/v1/salary-configs/employee/${selectedEmployee}/history`)
      setHistory(r.data || [])
      setShowHistory(true)
    } catch {
      toast.error('Failed to load history')
      setShowHistory(false)
    }
  }

  async function saveConfig() {
    if (!selectedEmployee) return toast.error('Select an employee first')
    // Task 8.1: validate custom payheads
    for (const ph of customPayheads) {
      if (!ph.name || ph.name.trim() === '') {
        setCustomPayheadError('All earning component names must be filled in.')
        return
      }
    }
    setCustomPayheadError('')
    setSaving(true)
    try {
      await api.post('/v1/salary-configs/', {
        ...form,
        employee_id: selectedEmployee,
        effective_date: new Date().toISOString(),
        basic_salary: parseFloat(form.basic_salary) || 0,
        special_allowance: parseFloat(form.special_allowance) || 0,
        travel_allowance: parseFloat(form.travel_allowance) || 0,
        medical_allowance: parseFloat(form.medical_allowance) || 0,
        hra_percentage: isNaN(parseFloat(form.hra_percentage)) ? 0 : parseFloat(form.hra_percentage),
        tax_regime: (form.tax_regime || 'NEW').toLowerCase(),
        cost_center_allocations: [],
        custom_payheads: customPayheads.map(ph => ({
          name: ph.name,
          amount: parseFloat(ph.amount) || 0,
          is_percentage_of_basic: ph.is_percentage_of_basic || false,
        })),
      })
      toast.success('Salary configuration saved!')
    } catch (err) {
      const detail = err.response?.data?.detail
      let msg = 'Failed to save configuration'
      if (typeof detail === 'string') {
        msg = detail
      } else if (Array.isArray(detail)) {
        msg = detail.map(d => d.msg || d.message || JSON.stringify(d)).join(', ')
      }
      toast.error(msg)
    } finally { setSaving(false) }
  }

  // Task 14.2: save statutory rates
  async function saveStatutoryRates() {
    setSavingRates(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const ratesToSave = [
        { deduction_type: 'PF_EMPLOYEE', rate_type: 'PERCENTAGE', rate_value: parseFloat(ratesForm.pf_employee), effective_from: today },
        { deduction_type: 'ESI_EMPLOYEE', rate_type: 'PERCENTAGE', rate_value: parseFloat(ratesForm.esi_employee), effective_from: today },
        { deduction_type: 'PT', rate_type: 'PERCENTAGE', rate_value: parseFloat(ratesForm.pt), effective_from: today },
      ]
      for (const rate of ratesToSave) {
        await api.post('/v1/statutory-rates/', rate)
      }
      toast.success('Statutory rates saved!')
      await fetchStatutoryRates()
      setShowRatesEditor(false)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save rates')
    } finally { setSavingRates(false) }
  }

  // Task 14.1: build dynamic labels from fetched rates
  function getPFLabel() {
    const r = statutoryRates.find(r => r.deduction_type === 'PF_EMPLOYEE')
    return r ? `PF (${r.rate_value}%)` : 'PF (12%)'
  }
  function getESILabel() {
    const r = statutoryRates.find(r => r.deduction_type === 'ESI_EMPLOYEE')
    return r ? `ESI (${r.rate_value}%)` : 'ESI (0.75%)'
  }

  // Task 8.1: custom payhead handlers
  function addCustomPayhead() {
    if (customPayheads.length >= 10) return
    setCustomPayheads([...customPayheads, { name: '', amount: '', is_percentage_of_basic: false }])
  }
  function removeCustomPayhead(idx) {
    setCustomPayheads(customPayheads.filter((_, i) => i !== idx))
  }
  function updateCustomPayhead(idx, field, value) {
    const updated = customPayheads.map((ph, i) => i === idx ? { ...ph, [field]: value } : ph)
    setCustomPayheads(updated)
  }

  const selectedEmp = employees.find(e => String(e.id) === String(selectedEmployee))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Payhead Configuration</h1>
        <p className="text-gray-500 text-sm mt-1">Configure employee salary structure and components</p>
      </div>

      {/* Employee Selector */}
      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <label className="block text-xs text-gray-500 mb-1">Select Employee</label>
        <select
          className="border rounded-lg px-3 py-2 text-sm w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={selectedEmployee}
          onChange={e => setSelectedEmployee(e.target.value)}
        >
          <option value="">— Choose an employee —</option>
          {employees.map(e => (
            <option key={e.id} value={e.id}>
              {e.name || e.full_name} ({e.emp_code || e.employee_code})
            </option>
          ))}
        </select>
      </div>

      {selectedEmployee && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Config Form */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">
                {selectedEmp ? `${selectedEmp.name || selectedEmp.full_name} — Salary Structure` : 'Salary Structure'}
              </h2>
              <button
                onClick={fetchHistory}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
              >
                <History className="w-4 h-4" /> History
              </button>
            </div>

            {loadingConfig ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Earnings */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Earnings</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Basic Salary ()</label>
                      <input
                        type="number"
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                        value={form.basic_salary}
                        onChange={e => { setForm({ ...form, basic_salary: e.target.value }); setAutoFilled(false) }}
                      />
                      {/* Task 13.2: auto-fill indicator */}
                      {autoFilled && (
                        <p className="text-xs text-blue-500 mt-1">Auto-filled from employee profile</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">HRA % of Basic</label>
                      <input
                        type="number"
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                        value={form.hra_percentage}
                        onChange={e => setForm({ ...form, hra_percentage: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Special Allowance ()</label>
                      <input
                        type="number"
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                        value={form.special_allowance}
                        onChange={e => setForm({ ...form, special_allowance: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Travel Allowance ()</label>
                      <input
                        type="number"
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                        value={form.travel_allowance}
                        onChange={e => setForm({ ...form, travel_allowance: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Medical Allowance ()</label>
                      <input
                        type="number"
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                        value={form.medical_allowance}
                        onChange={e => setForm({ ...form, medical_allowance: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Custom Payheads — professional card layout */}
                  {customPayheads.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="grid grid-cols-12 gap-2 px-1 mb-1">
                        <div className="col-span-4 text-xs text-gray-400 font-medium">Component Name</div>
                        <div className="col-span-3 text-xs text-gray-400 font-medium">Type</div>
                        <div className="col-span-4 text-xs text-gray-400 font-medium">Value</div>
                        <div className="col-span-1"></div>
                      </div>
                      {customPayheads.map((ph, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                          {/* Name */}
                          <div className="col-span-4">
                            <input
                              type="text"
                              className="w-full bg-white border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="e.g. Night Allowance"
                              value={ph.name}
                              onChange={e => updateCustomPayhead(idx, 'name', e.target.value)}
                            />
                          </div>
                          {/* Type dropdown */}
                          <div className="col-span-3">
                            <select
                              className="w-full bg-white border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={ph.is_percentage_of_basic ? 'percent' : 'fixed'}
                              onChange={e => updateCustomPayhead(idx, 'is_percentage_of_basic', e.target.value === 'percent')}
                            >
                              <option value="fixed">Fixed (₹)</option>
                              <option value="percent">% of Basic</option>
                            </select>
                          </div>
                          {/* Value with dynamic label */}
                          <div className="col-span-4 relative">
                            <input
                              type="number"
                              className="w-full bg-white border rounded-md pl-2 pr-8 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder={ph.is_percentage_of_basic ? '0.00' : '0'}
                              value={ph.amount}
                              onChange={e => updateCustomPayhead(idx, 'amount', e.target.value)}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                              {ph.is_percentage_of_basic ? '%' : '₹'}
                            </span>
                          </div>
                          {/* Remove */}
                          <div className="col-span-1 flex justify-center">
                            <button
                              onClick={() => removeCustomPayhead(idx)}
                              className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded p-0.5"
                              title="Remove component"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {customPayheadError && (
                    <p className="text-xs text-red-500 mt-1">{customPayheadError}</p>
                  )}
                  {customPayheads.length < 10 && (
                    <button
                      onClick={addCustomPayhead}
                      className="mt-3 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      <Plus className="w-4 h-4" /> Add Earning Component
                      {customPayheads.length > 0 && (
                        <span className="ml-1 text-xs text-gray-400">({customPayheads.length}/10)</span>
                      )}
                    </button>
                  )}
                </div>

                {/* Statutory Deductions */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Statutory Deductions</h3>
                    {/* Task 14.1: Configure Rates toggle */}
                    <button
                      onClick={() => setShowRatesEditor(v => !v)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                    >
                      <Settings className="w-3 h-3" /> Configure Rates
                    </button>
                  </div>
                  <div className="flex gap-6">
                    {[
                      { key: 'pf_applicable', label: getPFLabel() },
                      { key: 'esi_applicable', label: getESILabel() },
                      { key: 'pt_applicable', label: 'Prof. Tax' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded text-blue-600"
                          checked={form[key]}
                          onChange={e => setForm({ ...form, [key]: e.target.checked })}
                        />
                        <span className="text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>

                  {/* Task 14.1: Rates editor */}
                  {showRatesEditor && (
                    <div className="mt-3 p-3 border rounded-lg bg-gray-50 space-y-2">
                      <p className="text-xs font-semibold text-gray-600 mb-2">Edit Statutory Rates</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">PF Employee %</label>
                          <input
                            type="number"
                            step="0.01"
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={ratesForm.pf_employee}
                            onChange={e => setRatesForm({ ...ratesForm, pf_employee: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">ESI Employee %</label>
                          <input
                            type="number"
                            step="0.01"
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={ratesForm.esi_employee}
                            onChange={e => setRatesForm({ ...ratesForm, esi_employee: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">PT Amount ()</label>
                          <input
                            type="number"
                            step="1"
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={ratesForm.pt}
                            onChange={e => setRatesForm({ ...ratesForm, pt: e.target.value })}
                          />
                        </div>
                      </div>
                      <button
                        onClick={saveStatutoryRates}
                        disabled={savingRates}
                        className="mt-2 bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs hover:bg-blue-700 disabled:opacity-50"
                      >
                        {savingRates ? 'Saving...' : 'Save Rates'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Tax Regime */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Tax Regime</h3>
                  <div className="flex gap-4">
                    {TAX_REGIMES.map(r => (
                      <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="tax_regime"
                          value={r.value}
                          checked={form.tax_regime === r.value}
                          onChange={() => setForm({ ...form, tax_regime: r.value })}
                          className="text-blue-600"
                        />
                        <span className="text-sm text-gray-700">{r.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  onClick={saveConfig}
                  disabled={saving}
                  className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium mt-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            )}
          </div>

          {/* Preview / History */}
          <div className="bg-white rounded-xl shadow p-6">
            {showHistory ? (
              <>
                <h2 className="font-semibold text-gray-800 mb-4">Config History</h2>
                {history.length === 0 ? (
                  <p className="text-sm text-gray-400">No history available</p>
                ) : (
                  <div className="space-y-3">
                    {history.map((h, i) => {
                      // Task 4.1: compute diff vs previous entry (history is descending, so prev = history[i+1])
                      const prev = history[i + 1]
                      const changed = prev ? diffConfigs(prev, h) : new Set()
                      const field = (key, label, value) => (
                        <div key={key} className={`text-gray-500 mt-0.5 ${changed.has(key) ? HIGHLIGHT_CLASS : ''}`}>
                          {label}: {value}
                        </div>
                      )
                      return (
                        <div key={i} className="border rounded-lg p-3 text-xs">
                          <div className="font-medium text-gray-700 mb-1 flex items-center justify-between">
                            <span>{new Date(h.effective_date || h.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            <span className="text-gray-400 font-normal">{new Date(h.effective_date || h.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}</span>
                          </div>
                          {field('basic_salary', 'Basic', `₹${(h.basic_salary || 0).toLocaleString('en-IN')}`)}
                          {field('hra_percentage', 'HRA%', `${h.hra_percentage ?? 0}%`)}
                          {field('special_allowance', 'Special Allow.', `₹${(h.special_allowance || 0).toLocaleString('en-IN')}`)}
                          {field('travel_allowance', 'Travel Allow.', `₹${(h.travel_allowance || 0).toLocaleString('en-IN')}`)}
                          {field('medical_allowance', 'Medical Allow.', `₹${(h.medical_allowance || 0).toLocaleString('en-IN')}`)}
                          {field('pf_applicable', 'PF', h.pf_applicable ? 'Yes' : 'No')}
                          {field('esi_applicable', 'ESI', h.esi_applicable ? 'Yes' : 'No')}
                          {field('pt_applicable', 'PT', h.pt_applicable ? 'Yes' : 'No')}
                          {field('tax_regime', 'Tax Regime', (h.tax_regime || '—').toUpperCase())}
                          {/* Custom payheads in history */}
                          {(h.custom_payheads || []).length > 0 ? (
                            <div className={`mt-1.5 pt-1.5 border-t border-gray-100 ${changed.has('custom_payheads') ? HIGHLIGHT_CLASS : ''}`}>
                              <span className="text-gray-600 font-semibold">Custom Earnings:</span>
                              <ul className="ml-2 mt-0.5 space-y-0.5">
                                {h.custom_payheads.map((ph, pi) => (
                                  <li key={pi} className="text-gray-500 flex justify-between">
                                    <span>{ph.name}</span>
                                    <span className="font-medium text-gray-600">
                                      {ph.is_percentage_of_basic ? `${ph.amount}% of Basic` : `₹${Number(ph.amount).toLocaleString('en-IN')}`}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : (
                            <div className="mt-1 text-gray-400 italic">No custom earnings</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 className="font-semibold text-gray-800 mb-4">Salary Preview</h2>
                {form.basic_salary ? (
                  <div className="space-y-2 text-sm">
                    {[
                      { label: 'Basic', value: parseFloat(form.basic_salary) || 0 },
                      { label: 'HRA', value: ((parseFloat(form.basic_salary) || 0) * (isNaN(parseFloat(form.hra_percentage)) ? 0 : parseFloat(form.hra_percentage))) / 100 },
                      { label: 'Special Allowance', value: parseFloat(form.special_allowance) || 0 },
                      { label: 'Travel Allowance', value: parseFloat(form.travel_allowance) || 0 },
                      { label: 'Medical Allowance', value: parseFloat(form.medical_allowance) || 0 },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between text-gray-600">
                        <span>{label}</span>
                        <span>{value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                      </div>
                    ))}
                    {customPayheads.map((ph, idx) => {
                      const basic = parseFloat(form.basic_salary) || 0
                      const amt = ph.is_percentage_of_basic
                        ? basic * (parseFloat(ph.amount) || 0) / 100
                        : parseFloat(ph.amount) || 0
                      return (
                        <div key={idx} className="flex justify-between text-gray-600">
                          <span>{ph.name || `Custom ${idx + 1}`}</span>
                          <span>{amt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                        </div>
                      )
                    })}
                    <div className="border-t pt-2 flex justify-between font-semibold text-gray-800">
                      <span>Gross CTC</span>
                      <span>{(
                        (parseFloat(form.basic_salary) || 0) +
                        ((parseFloat(form.basic_salary) || 0) * (isNaN(parseFloat(form.hra_percentage)) ? 0 : parseFloat(form.hra_percentage))) / 100 +
                        (parseFloat(form.special_allowance) || 0) +
                        (parseFloat(form.travel_allowance) || 0) +
                        (parseFloat(form.medical_allowance) || 0) +
                        customPayheads.reduce((sum, ph) => {
                          const basic = parseFloat(form.basic_salary) || 0
                          return sum + (ph.is_percentage_of_basic
                            ? basic * (parseFloat(ph.amount) || 0) / 100
                            : parseFloat(ph.amount) || 0)
                        }, 0)
                      ).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Enter basic salary to see preview</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
