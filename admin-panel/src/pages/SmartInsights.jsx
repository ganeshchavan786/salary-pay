import { useState, useEffect } from 'react'
import { Lightbulb, AlertTriangle, TrendingUp, RefreshCw } from 'lucide-react'
import { api } from '../services/api'
import toast from 'react-hot-toast'

const SEVERITY_COLORS = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-blue-100 text-blue-700 border-blue-200',
}

const SEVERITY_ICONS = {
  high: AlertTriangle,
  medium: TrendingUp,
  low: Lightbulb,
}

const INSIGHT_LABELS = {
  HIGH_OT_COST: 'High Overtime Cost',
  FREQUENT_ABSENTEE: 'Frequent Absenteeism',
  SALARY_ANOMALY: 'Salary Anomaly',
  ATTRITION_RISK: 'Attrition Risk',
}

export default function SmartInsights() {
  const [periods, setPeriods] = useState([])
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [insights, setInsights] = useState([])
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState(null)

  useEffect(() => { fetchPeriods() }, [])
  useEffect(() => { if (selectedPeriod) fetchInsights() }, [selectedPeriod])

  async function fetchPeriods() {
    try {
      const r = await api.get('/v1/payroll-periods/')
      const list = r.data || []
      setPeriods(list)
      if (list.length > 0) setSelectedPeriod(list[0].id)
    } catch { toast.error('Failed to load periods') }
  }

  async function fetchInsights() {
    setLoading(true)
    try {
      const r = await api.get(`/v1/insights/period/${selectedPeriod}`)
      const data = r.data || {}
      setInsights(data.insights || data || [])
      setSummary(data.summary || null)
    } catch { toast.error('Failed to load insights') }
    finally { setLoading(false) }
  }

  const highCount = insights.filter(i => i.severity === 'high').length
  const mediumCount = insights.filter(i => i.severity === 'medium').length

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Smart Insights</h1>
        <p className="text-gray-500 text-sm mt-1">AI-powered anomaly detection and salary analytics</p>
      </div>

      {/* Period Selector */}
      <div className="bg-white rounded-xl shadow p-4 mb-6 flex items-end gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Payroll Period</label>
          <select
            className="border rounded-lg px-3 py-2 text-sm min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedPeriod}
            onChange={e => setSelectedPeriod(e.target.value)}
          >
            {periods.map(p => (
              <option key={p.id} value={p.id}>{p.period_name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={fetchInsights}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      {insights.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow p-4">
            <div className="text-xs text-gray-500 mb-1">Total Insights</div>
            <div className="text-2xl font-bold text-gray-800">{insights.length}</div>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <div className="text-xs text-gray-500 mb-1">High Severity</div>
            <div className="text-2xl font-bold text-red-600">{highCount}</div>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <div className="text-xs text-gray-500 mb-1">Medium Severity</div>
            <div className="text-2xl font-bold text-yellow-600">{mediumCount}</div>
          </div>
        </div>
      )}

      {/* Insights List */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : insights.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Lightbulb className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No insights for this period</p>
          <p className="text-sm mt-1">Insights are generated after salary calculations are complete</p>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((insight, i) => {
            const severity = insight.severity || 'low'
            const Icon = SEVERITY_ICONS[severity] || Lightbulb
            return (
              <div
                key={insight.id || i}
                className={`bg-white rounded-xl shadow-sm p-4 border-l-4 ${
                  severity === 'high' ? 'border-red-500' :
                  severity === 'medium' ? 'border-yellow-500' : 'border-blue-500'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    severity === 'high' ? 'bg-red-100' :
                    severity === 'medium' ? 'bg-yellow-100' : 'bg-blue-100'
                  }`}>
                    <Icon className={`w-4 h-4 ${
                      severity === 'high' ? 'text-red-600' :
                      severity === 'medium' ? 'text-yellow-600' : 'text-blue-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-800">
                        {INSIGHT_LABELS[insight.insight_type] || insight.insight_type || 'Insight'}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${SEVERITY_COLORS[severity] || 'bg-gray-100 text-gray-600'}`}>
                        {severity.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{insight.message || insight.description || '—'}</p>
                    {insight.employee_name && (
                      <p className="text-xs text-gray-400 mt-1">Employee: {insight.employee_name}</p>
                    )}
                    {insight.value !== undefined && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Value: <span className="font-medium">{insight.value}</span>
                        {insight.threshold && <> · Threshold: {insight.threshold}</>}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
