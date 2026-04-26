import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { reportApi } from '../../services/api'
import ReportTable from './ReportTable'
import ExportButton from './ExportButton'

const SUB_TABS = [
  { id: 'daily-summary', label: 'Daily Summary' },
  { id: 'monthly-trend', label: 'Monthly Trend' },
  { id: 'late-coming', label: 'Late Coming' },
  { id: 'early-leaving', label: 'Early Leaving' },
  { id: 'shift-wise', label: 'Shift-Wise' },
  { id: 'heatmap', label: 'Heatmap' },
  { id: 'department', label: 'Department' },
]

function useReportData(fetchFn, params) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    setLoading(true)
    fetchFn(params)
      .then(res => setData(res.data || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [JSON.stringify(params)])
  return { data, loading }
}

function buildParams(filters) {
  return {
    start_date: filters.startDate,
    end_date: filters.endDate,
    emp_ids: filters.empIds?.length ? filters.empIds : undefined,
    departments: filters.departments?.length ? filters.departments : undefined,
  }
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// Daily Summary
function DailySummaryTab({ filters }) {
  const params = buildParams(filters)
  const { data, loading } = useReportData(reportApi.dailyAttendanceSummary, params)
  const columns = [
    { key: 'date', label: 'Date' },
    { key: 'total_employees', label: 'Total' },
    { key: 'present_count', label: 'Present' },
    { key: 'absent_count', label: 'Absent' },
    { key: 'half_day_count', label: 'Half Day' },
    { key: 'on_leave_count', label: 'On Leave' },
    { key: 'weekly_off_count', label: 'Weekly Off' },
    { key: 'holiday_count', label: 'Holiday' },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Daily Attendance Summary</h3>
        <ExportButton reportName="daily-attendance-summary" filters={filters} />
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : <ReportTable columns={columns} data={data} />}
    </div>
  )
}

// Monthly Trend
function MonthlyTrendTab({ filters }) {
  const params = buildParams(filters)
  const { data, loading } = useReportData(reportApi.monthlyAttendanceTrend, params)
  const chartData = data.map(r => ({
    name: `${MONTH_NAMES[r.month - 1]} ${r.year}`,
    attendance_pct: r.avg_attendance_pct,
    present: r.total_present_days,
    absent: r.total_absent_days,
  }))
  const columns = [
    { key: 'year', label: 'Year' },
    { key: 'month', label: 'Month', render: v => MONTH_NAMES[v - 1] },
    { key: 'avg_attendance_pct', label: 'Attendance %', render: v => `${v}%` },
    { key: 'total_present_days', label: 'Present Days' },
    { key: 'total_absent_days', label: 'Absent Days' },
    { key: 'total_late_marks', label: 'Late Marks' },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Monthly Attendance Trend</h3>
        <ExportButton reportName="monthly-attendance-trend" filters={filters} />
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : (
        <>
          {chartData.length > 0 && (
            <div className="mb-4 bg-white rounded-lg border border-gray-200 p-4">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Legend />
                  <Line type="monotone" dataKey="attendance_pct" stroke="#3b82f6" name="Attendance %" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <ReportTable columns={columns} data={data} />
        </>
      )}
    </div>
  )
}

// Late Coming Analysis
function LateComingTab({ filters }) {
  const params = buildParams(filters)
  const { data, loading } = useReportData(reportApi.lateComingAnalysis, params)
  const columns = [
    { key: 'emp_code', label: 'Emp Code' },
    { key: 'name', label: 'Name' },
    { key: 'department', label: 'Department' },
    { key: 'year', label: 'Year' },
    { key: 'month', label: 'Month', render: v => MONTH_NAMES[v - 1] },
    { key: 'late_mark_count', label: 'Late Marks' },
    { key: 'half_late_mark_count', label: 'Half Late' },
    { key: 'avg_minutes_late', label: 'Avg Mins Late' },
    { key: 'is_org_summary', label: 'Summary', render: v => v ? <span className="text-blue-600 font-medium">Org</span> : '' },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Late Coming Analysis</h3>
        <ExportButton reportName="late-coming-analysis" filters={filters} />
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : <ReportTable columns={columns} data={data} />}
    </div>
  )
}

// Early Leaving
function EarlyLeavingTab({ filters }) {
  const params = buildParams(filters)
  const { data, loading } = useReportData(reportApi.earlyLeavingAnalysis, params)
  const columns = [
    { key: 'emp_code', label: 'Emp Code' },
    { key: 'name', label: 'Name' },
    { key: 'department', label: 'Department' },
    { key: 'date', label: 'Date' },
    { key: 'check_out', label: 'Check Out', render: v => v ? new Date(v).toLocaleTimeString() : '—' },
    { key: 'scheduled_end_time', label: 'Scheduled End' },
    { key: 'minutes_left_early', label: 'Mins Early' },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Early Leaving Analysis</h3>
        <ExportButton reportName="early-leaving-analysis" filters={filters} />
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : <ReportTable columns={columns} data={data} />}
    </div>
  )
}

// Shift-Wise
function ShiftWiseTab({ filters }) {
  const params = buildParams(filters)
  const { data, loading } = useReportData(reportApi.shiftWiseAttendance, params)
  const columns = [
    { key: 'shift_type', label: 'Shift' },
    { key: 'year', label: 'Year' },
    { key: 'month', label: 'Month', render: v => MONTH_NAMES[v - 1] },
    { key: 'total_employees', label: 'Employees' },
    { key: 'avg_attendance_pct', label: 'Attendance %', render: v => `${v}%` },
    { key: 'total_ot_hours', label: 'OT Hours' },
    { key: 'total_late_marks', label: 'Late Marks' },
    { key: 'below_org_avg_flag', label: 'Below Avg', render: v => v ? <span className="text-red-500">⚠ Yes</span> : 'No' },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Shift-Wise Attendance</h3>
        <ExportButton reportName="shift-wise-attendance" filters={filters} />
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : <ReportTable columns={columns} data={data} />}
    </div>
  )
}

// Heatmap status colors
const STATUS_COLORS = {
  PRESENT: '#C6EFCE',
  ABSENT: '#FFC7CE',
  HALFDAY: '#E1D5E7',
  LEAVE: '#FFE0B2',
  HOLIDAY: '#DDEEFF',
  WEEKLYOFF: '#F2F2F2',
  MISSED_PUNCH: '#FFF9C4',
}

// Heatmap
function HeatmapTab({ filters }) {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())
  const [heatmapData, setHeatmapData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const params = {
      month, year,
      emp_ids: filters.empIds?.length ? filters.empIds : undefined,
      departments: filters.departments?.length ? filters.departments : undefined,
    }
    reportApi.attendanceHeatmap(params)
      .then(res => setHeatmapData(res.data))
      .catch(() => setHeatmapData(null))
      .finally(() => setLoading(false))
  }, [month, year, JSON.stringify(filters)])

  const cells = heatmapData?.cells || []
  const employees = heatmapData?.employees || []
  const dates = heatmapData?.dates || []

  // Build lookup: emp_name + date -> status
  const cellMap = {}
  cells.forEach(c => {
    cellMap[`${c.name}|${c.date}`] = c.status
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-gray-700">Attendance Heatmap</h3>
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 text-sm">
            {Array.from({length: 12}, (_, i) => (
              <option key={i+1} value={i+1}>{MONTH_NAMES[i]}</option>
            ))}
          </select>
          <input type="number" value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 text-sm w-20" min="2020" max="2030" />
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-3">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1 text-xs">
            <div className="w-4 h-4 rounded border border-gray-200" style={{ backgroundColor: color }}></div>
            <span className="text-gray-600">{status}</span>
          </div>
        ))}
      </div>

      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : (
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left bg-gray-50 border border-gray-200 sticky left-0 z-10 min-w-32">Employee</th>
                {dates.map(d => (
                  <th key={d} className="px-1 py-1 bg-gray-50 border border-gray-200 text-center min-w-8">
                    {new Date(d).getDate()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map(empName => (
                <tr key={empName}>
                  <td className="px-2 py-1 border border-gray-200 sticky left-0 bg-white z-10 font-medium">{empName}</td>
                  {dates.map(d => {
                    const status = cellMap[`${empName}|${d}`] || 'ABSENT'
                    return (
                      <td
                        key={d}
                        title={status}
                        className="border border-gray-200 text-center"
                        style={{ backgroundColor: STATUS_COLORS[status] || '#fff', width: 28, height: 24 }}
                      >
                        <span className="sr-only">{status}</span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {employees.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No data available</p>}
        </div>
      )}
    </div>
  )
}

// Department Attendance
function DepartmentTab({ filters }) {
  const params = buildParams(filters)
  const { data, loading } = useReportData(reportApi.departmentAttendance, params)
  const columns = [
    { key: 'department', label: 'Department' },
    { key: 'year', label: 'Year' },
    { key: 'month', label: 'Month', render: v => MONTH_NAMES[v - 1] },
    { key: 'employee_count', label: 'Employees' },
    { key: 'avg_attendance_pct', label: 'Attendance %', render: v => `${v}%` },
    { key: 'total_absent_days', label: 'Absent Days' },
    { key: 'total_late_marks', label: 'Late Marks' },
    { key: 'total_ot_hours', label: 'OT Hours' },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Department-Wise Attendance</h3>
        <ExportButton reportName="department-attendance" filters={filters} />
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : <ReportTable columns={columns} data={data} />}
    </div>
  )
}

export default function AttendanceAnalysisTab({ filters }) {
  const [activeSubTab, setActiveSubTab] = useState('daily-summary')

  return (
    <div>
      <div className="flex gap-1 mb-4 flex-wrap">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-3 py-1.5 text-sm rounded-md transition ${
              activeSubTab === tab.id
                ? 'bg-primary-500 text-white'
                : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'daily-summary' && <DailySummaryTab filters={filters} />}
      {activeSubTab === 'monthly-trend' && <MonthlyTrendTab filters={filters} />}
      {activeSubTab === 'late-coming' && <LateComingTab filters={filters} />}
      {activeSubTab === 'early-leaving' && <EarlyLeavingTab filters={filters} />}
      {activeSubTab === 'shift-wise' && <ShiftWiseTab filters={filters} />}
      {activeSubTab === 'heatmap' && <HeatmapTab filters={filters} />}
      {activeSubTab === 'department' && <DepartmentTab filters={filters} />}
    </div>
  )
}
