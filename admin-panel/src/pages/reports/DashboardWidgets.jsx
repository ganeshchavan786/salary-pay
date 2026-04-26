import { useState, useEffect, useCallback } from 'react'
import { Users, UserX, Clock, DollarSign, Timer, AlertCircle } from 'lucide-react'
import { reportApi } from '../../services/api'

/**
 * Dashboard widget bar — 6 metric cards with 60s auto-refresh.
 * Requirement 1.1–1.5
 */
const METRICS = [
  { key: 'total_present', label: 'Total Present', icon: Users, color: 'text-green-600', bg: 'bg-green-50' },
  { key: 'total_absent', label: 'Total Absent', icon: UserX, color: 'text-red-600', bg: 'bg-red-50' },
  { key: 'total_ot_hours', label: 'Total OT Hours', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', format: 'hours' },
  { key: 'total_ot_cost', label: 'Total OT Cost', icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50', format: 'currency' },
  { key: 'avg_working_hours', label: 'Avg Working Hours', icon: Timer, color: 'text-orange-600', bg: 'bg-orange-50', format: 'hours' },
  { key: 'late_count', label: 'Late Count', icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-50' },
]

function formatValue(value, format) {
  if (value === null || value === undefined) return '0'
  if (format === 'currency') return `₹${Number(value).toLocaleString('en-IN')}`
  if (format === 'hours') return `${Number(value).toFixed(2)}h`
  return String(value)
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg shadow p-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-3 bg-gray-200 rounded w-24 mb-2"></div>
          <div className="h-6 bg-gray-200 rounded w-16"></div>
        </div>
        <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
      </div>
    </div>
  )
}

export default function DashboardWidgets() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await reportApi.dashboardToday()
      setData(res.data)
    } catch {
      // On error, show zeros (Req 1.5)
      setData({
        total_present: 0, total_absent: 0, total_ot_hours: 0,
        total_ot_cost: 0, avg_working_hours: 0, late_count: 0
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    // Auto-refresh every 60 seconds (Req 1.2)
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [fetchData])

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {METRICS.map(m => <SkeletonCard key={m.key} />)}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      {METRICS.map(metric => {
        const Icon = metric.icon
        const value = data?.[metric.key] ?? 0
        return (
          <div key={metric.key} className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">{metric.label}</p>
                <p className={`text-xl font-bold mt-1 ${metric.color}`}>
                  {formatValue(value, metric.format)}
                </p>
              </div>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${metric.bg}`}>
                <Icon className={`w-5 h-5 ${metric.color}`} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
