import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, TrendingUp, Users, Clock, AlertTriangle, Calendar } from 'lucide-react'
import { reportApi } from '../../services/api'

/**
 * Auto Insights tab — 5 insight cards with refresh button.
 * Requirement 32.1–32.4
 */
const INSIGHT_ICONS = {
  top_ot_employees: Clock,
  top_absent_departments: Users,
  late_trend: TrendingUp,
  unnecessary_ot: AlertTriangle,
  consistent_late: Calendar,
}

const INSIGHT_COLORS = {
  top_ot_employees: 'border-blue-200 bg-blue-50',
  top_absent_departments: 'border-red-200 bg-red-50',
  late_trend: 'border-yellow-200 bg-yellow-50',
  unnecessary_ot: 'border-orange-200 bg-orange-50',
  consistent_late: 'border-purple-200 bg-purple-50',
}

const ICON_COLORS = {
  top_ot_employees: 'text-blue-600',
  top_absent_departments: 'text-red-600',
  late_trend: 'text-yellow-600',
  unnecessary_ot: 'text-orange-600',
  consistent_late: 'text-purple-600',
}

function InsightCard({ insight }) {
  const Icon = INSIGHT_ICONS[insight.insight_type] || AlertTriangle
  const colorClass = INSIGHT_COLORS[insight.insight_type] || 'border-gray-200 bg-gray-50'
  const iconColor = ICON_COLORS[insight.insight_type] || 'text-gray-600'

  return (
    <div className={`rounded-lg border p-4 ${colorClass}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-800 text-sm">{insight.title}</h4>
          <p className="text-gray-600 text-sm mt-1">{insight.description}</p>
          {insight.data && insight.data.length > 0 && (
            <div className="mt-2 space-y-1">
              {insight.data.slice(0, 5).map((item, idx) => (
                <div key={idx} className="text-xs text-gray-600 bg-white/60 rounded px-2 py-1">
                  {typeof item === 'object' ? Object.entries(item).map(([k, v]) => `${k}: ${v}`).join(' | ') : String(item)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AutoInsightsTab() {
  const [insights, setInsights] = useState([])
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchInsights = useCallback(async () => {
    setLoading(true)
    try {
      const res = await reportApi.insights()
      const data = res.data
      setInsights(data.insights || [])
      setMessage(data.message || null)
    } catch {
      setMessage('Failed to load insights. Please try again.')
      setInsights([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInsights()
  }, [fetchInsights])

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-medium text-gray-700">Auto-Generated Insights</h3>
        <button
          onClick={fetchInsights}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 p-4 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 bg-gray-200 rounded mt-0.5"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-full"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && message && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
          {message}
        </div>
      )}

      {!loading && !message && insights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {insights.map((insight, idx) => (
            <InsightCard key={idx} insight={insight} />
          ))}
        </div>
      )}

      {!loading && !message && insights.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">No insights available</p>
        </div>
      )}
    </div>
  )
}
