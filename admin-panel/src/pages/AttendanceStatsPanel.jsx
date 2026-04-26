import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { attendanceHrApi } from '../services/api'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function AttendanceStatsPanel({ month, year, onMonthChange, onYearChange }) {
  const [stats, setStats] = useState({ summary_cards: null, daily_trend: [], department_stats: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchStats()
  }, [month, year])

  async function fetchStats() {
    setLoading(true)
    setError(null)
    try {
      const res = await attendanceHrApi.stats(month, year)
      setStats({
        summary_cards: res.data.summary_cards ?? null,
        daily_trend: res.data.daily_trend ?? [],
        department_stats: res.data.department_stats ?? [],
      })
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }

  const cards = [
    { label: 'Working Days', value: stats.summary_cards?.working_days ?? 0, color: 'border-blue-400', textColor: 'text-blue-700' },
    { label: 'Present %', value: `${stats.summary_cards?.present_pct ?? 0}%`, color: 'border-green-400', textColor: 'text-green-700' },
    { label: 'Late Marks', value: stats.summary_cards?.total_late_marks ?? 0, color: 'border-yellow-400', textColor: 'text-yellow-700' },
    { label: 'LOP Days', value: stats.summary_cards?.total_lop_days ?? 0, color: 'border-red-400', textColor: 'text-red-700' },
  ]

  return (
    <div>
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-xl font-bold text-gray-800">
          Attendance Stats — {MONTHS[month - 1]} {year}
        </h2>
        <div className="flex items-center gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Month</label>
            <select
              className="border rounded-lg px-3 py-2 text-sm"
              value={month}
              onChange={e => onMonthChange(+e.target.value)}
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Year</label>
            <select
              className="border rounded-lg px-3 py-2 text-sm"
              value={year}
              onChange={e => onYearChange(+e.target.value)}
            >
              {[2024, 2025, 2026].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <>
          <div className="grid grid-cols-4 gap-3 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
            <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
          </div>
        </>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 mb-3">{error}</p>
          <button
            onClick={fetchStats}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {cards.map((card, i) => (
              <div key={i} className={`bg-white rounded-xl shadow p-4 border-t-4 ${card.color}`}>
                <div className="text-xs text-gray-500 mb-1">{card.label}</div>
                <div className={`text-2xl font-bold ${card.textColor}`}>{card.value}</div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-2 gap-4">
            {/* Line Chart — Daily Present Trend */}
            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Daily Present Trend</h3>
              {stats.daily_trend.length === 0 ? (
                <div className="h-[250px] flex items-center justify-center text-gray-400 text-sm">
                  No data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={stats.daily_trend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} label={{ value: 'Day', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="present_count"
                      name="Present"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Bar Chart — Department Attendance */}
            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Department Attendance</h3>
              {stats.department_stats.length === 0 ? (
                <div className="h-[250px] flex items-center justify-center text-gray-400 text-sm">
                  No data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={stats.department_stats} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="department" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="present" name="Present" fill="#22c55e" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="absent" name="Absent" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
