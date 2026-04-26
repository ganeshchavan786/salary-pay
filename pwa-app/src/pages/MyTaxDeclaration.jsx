import { useState, useEffect } from 'react'
import { FileText, Save, TrendingDown } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

function getCurrentFY() {
  const now = new Date()
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return `${year}-${String(year + 1).slice(-2)}`
}

export default function MyTaxDeclaration() {
  const { user } = useAuth()
  const [form, setForm] = useState({
    tax_regime: 'new',
    section_80c: '',
    section_80d: '',
    hra_exemption: '',
  })
  const [projection, setProjection] = useState(null)
  const [saving, setSaving] = useState(false)
  const fy = getCurrentFY()

  useEffect(() => {
    // Load existing declaration if any
    if (user?.employee_id) {
      axios.get(`/api/v1/tax/declarations/${user.employee_id}?financial_year=${fy}`)
        .then(r => {
          const d = r.data
          setForm({
            tax_regime: d.tax_regime || 'new',
            section_80c: d.section_80c || '',
            section_80d: d.section_80d || '',
            hra_exemption: d.hra_exemption || '',
          })
        })
        .catch(() => {}) // No declaration yet is fine
    }
  }, [user])

  async function submitDeclaration() {
    if (!user?.employee_id) return toast.error('Employee ID not found')
    setSaving(true)
    try {
      await axios.post(`/api/v1/tax/declarations/${user.employee_id}`, {
        financial_year: fy,
        tax_regime: form.tax_regime,
        section_80c: parseFloat(form.section_80c) || 0,
        section_80d: parseFloat(form.section_80d) || 0,
        hra_exemption: parseFloat(form.hra_exemption) || 0,
        other_exemptions: {},
      })
      toast.success('Declaration submitted!')
      // Fetch TDS projection
      const r = await axios.get(`/api/v1/tax/tds-projection/${user.employee_id}`)
      setProjection(r.data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit declaration')
    } finally { setSaving(false) }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800">📋 Tax Declaration</h1>
        <p className="text-gray-500 text-sm">FY {fy} — Submit your investment declarations</p>
      </div>

      <div className="bg-white rounded-xl shadow p-5 space-y-4">
        {/* Tax Regime */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tax Regime</label>
          <div className="flex gap-4">
            {[
              { value: 'new', label: 'New Regime' },
              { value: 'old', label: 'Old Regime' },
            ].map(r => (
              <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="regime" value={r.value}
                  checked={form.tax_regime === r.value}
                  onChange={() => setForm({ ...form, tax_regime: r.value })}
                  className="text-blue-600" />
                <span className="text-sm text-gray-700">{r.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Deductions (only relevant for old regime, but show always) */}
        {[
          { key: 'section_80c', label: 'Section 80C (LIC, PPF, ELSS)', max: 150000 },
          { key: 'section_80d', label: 'Section 80D (Health Insurance)', max: 25000 },
          { key: 'hra_exemption', label: 'HRA Exemption', max: null },
        ].map(({ key, label, max }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {label} {max && <span className="text-xs text-gray-400">(max ₹{max.toLocaleString('en-IN')})</span>}
            </label>
            <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="0" value={form[key]}
              onChange={e => setForm({ ...form, [key]: e.target.value })} />
          </div>
        ))}

        <button onClick={submitDeclaration} disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
          <Save className="w-4 h-4" />
          {saving ? 'Submitting...' : 'Submit Declaration'}
        </button>
      </div>

      {/* TDS Projection */}
      {projection && (
        <div className="mt-4 bg-green-50 rounded-xl p-4 border border-green-200">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-5 h-5 text-green-600" />
            <h2 className="font-semibold text-green-800">TDS Projection</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-600">Annual Income</div>
            <div className="font-medium text-right">₹{(projection.annual_income || 0).toLocaleString('en-IN')}</div>
            <div className="text-gray-600">Total Exemptions</div>
            <div className="font-medium text-right text-green-600">-₹{(projection.total_exemptions || 0).toLocaleString('en-IN')}</div>
            <div className="text-gray-600">Taxable Income</div>
            <div className="font-medium text-right">₹{(projection.taxable_income || 0).toLocaleString('en-IN')}</div>
            <div className="text-gray-600 font-semibold">Monthly TDS</div>
            <div className="font-bold text-right text-red-600">₹{(projection.monthly_tds || 0).toLocaleString('en-IN')}</div>
          </div>
        </div>
      )}
    </div>
  )
}
