import { useState, useEffect } from 'react'
import { reportApi } from '../../services/api'
import ReportTable from './ReportTable'
import ExportButton from './ExportButton'

/**
 * Employee Reports tab — sub-tabs for Req 3–8.
 */
const SUB_TABS = [
  { id: 'attendance-summary', label: 'Attendance Summary' },
  { id: 'working-hours', label: 'Working Hours' },
  { id: 'inout', label: 'In/Out Times' },
  { id: 'late-marks', label: 'Late Marks' },
  { id: 'ot', label: 'Overtime' },
  { id: 'halfday-absent', label: 'Half Day & Absent' },
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

// Attendance Summary sub-tab
function AttendanceSummaryTab({ filters }) {
  const params = buildParams(filters)
  const { data, loading } = useReportData(reportApi.employeeAttendanceSummary, params)
  const columns = [
    { key: 'emp_code', label: 'Emp Code' },
    { key: 'name', label: 'Name' },
    { key: 'department', label: 'Department' },
    { key: 'working_days', label: 'Working Days' },
    { key: 'present_days', label: 'Present' },
    { key: 'absent_days', label: 'Absent' },
    { key: 'half_day_count', label: 'Half Days' },
    { key: 'late_mark_count', label: 'Late Marks' },
    { key: 'lop_days', label: 'LOP Days' },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Employee-Wise Attendance Summary</h3>
        <ExportButton reportName="employee-attendance-summary" filters={filters} />
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : <ReportTable columns={columns} data={data} />}
    </div>
  )
}

// Working Hours sub-tab
function WorkingHoursTab({ filters }) {
  const [granularity, setGranularity] = useState('daily')
  const params = { ...buildParams(filters), granularity }
  const { data, loading } = useReportData(reportApi.employeeWorkingHours, params)

  const dailyColumns = [
    { key: 'emp_code', label: 'Emp Code' },
    { key: 'name', label: 'Name' },
    { key: 'date', label: 'Date' },
    { key: 'check_in', label: 'Check In', render: v => v ? new Date(v).toLocaleTimeString() : '—' },
    { key: 'check_out', label: 'Check Out', render: v => v ? new Date(v).toLocaleTimeString() : '—' },
    { key: 'working_hours', label: 'Working Hours', render: v => v != null ? `${v}h` : '—' },
    { key: 'is_missed_punch', label: 'Missed Punch', render: v => v ? <span className="text-red-500">Yes</span> : 'No' },
  ]
  const monthlyColumns = [
    { key: 'emp_code', label: 'Emp Code' },
    { key: 'name', label: 'Name' },
    { key: 'year', label: 'Year' },
    { key: 'month', label: 'Month' },
    { key: 'total_working_hours', label: 'Total Hours', render: v => v != null ? `${v}h` : '—' },
    { key: 'avg_daily_working_hours', label: 'Avg Daily', render: v => v != null ? `${v}h` : '—' },
    { key: 'scheduled_hours', label: 'Scheduled', render: v => v != null ? `${v}h` : '—' },
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-gray-700">Employee Working Hours</h3>
          <div className="flex rounded-md border border-gray-300 overflow-hidden">
            <button
              onClick={() => setGranularity('daily')}
              className={`px-3 py-1 text-xs ${granularity === 'daily' ? 'bg-primary-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >Daily</button>
            <button
              onClick={() => setGranularity('monthly')}
              className={`px-3 py-1 text-xs ${granularity === 'monthly' ? 'bg-primary-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >Monthly</button>
          </div>
        </div>
        <ExportButton reportName="employee-working-hours" filters={{ ...filters, granularity }} />
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> :
        <ReportTable columns={granularity === 'daily' ? dailyColumns : monthlyColumns} data={data} />}
    </div>
  )
}

// In/Out Times sub-tab
function InOutTab({ filters }) {
  const params = buildParams(filters)
  const { data, loading } = useReportData(reportApi.employeeInOut, params)
  const columns = [
    { key: 'emp_code', label: 'Emp Code' },
    { key: 'name', label: 'Name' },
    { key: 'date', label: 'Date' },
    { key: 'check_in', label: 'Check In', render: v => v ? new Date(v).toLocaleTimeString() : '—' },
    { key: 'check_out', label: 'Check Out', render: v => v ? new Date(v).toLocaleTimeString() : '—' },
    { key: 'shift_start_time', label: 'Shift Start' },
    { key: 'late_mark_status', label: 'Late Mark' },
    { key: 'is_missed_punch', label: 'Missed', render: v => v ? <span className="text-red-500">Yes</span> : 'No' },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Employee In/Out Times</h3>
        <ExportButton reportName="employee-inout" filters={filters} />
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : <ReportTable columns={columns} data={data} />}
    </div>
  )
}

// Late Marks sub-tab
function LateMarksTab({ filters }) {
  const params = buildParams(filters)
  const { data, loading } = useReportData(reportApi.employeeLateMarks, params)
  const columns = [
    { key: 'emp_code', label: 'Emp Code' },
    { key: 'name', label: 'Name' },
    { key: 'department', label: 'Department' },
    { key: 'total_late_marks', label: 'Late Marks' },
    { key: 'total_half_late_marks', label: 'Half Late' },
    { key: 'total_half_days_from_late', label: 'Half Days (Late)' },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Employee Late Marks</h3>
        <ExportButton reportName="employee-late-marks" filters={filters} />
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : <ReportTable columns={columns} data={data} />}
    </div>
  )
}

// OT sub-tab
function OTTab({ filters }) {
  const params = buildParams(filters)
  const { data, loading } = useReportData(reportApi.employeeOT, params)
  const columns = [
    { key: 'emp_code', label: 'Emp Code' },
    { key: 'name', label: 'Name' },
    { key: 'department', label: 'Department' },
    { key: 'total_ot_hours', label: 'OT Hours', render: v => `${v}h` },
    { key: 'total_ot_cost', label: 'OT Cost', render: v => `₹${Number(v).toLocaleString('en-IN')}` },
    { key: 'ot_days_count', label: 'OT Days' },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Employee Overtime</h3>
        <ExportButton reportName="employee-ot" filters={filters} />
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : <ReportTable columns={columns} data={data} />}
    </div>
  )
}

// Half Day & Absent sub-tab
function HalfdayAbsentTab({ filters }) {
  const params = buildParams(filters)
  const { data, loading } = useReportData(reportApi.employeeHalfdayAbsent, params)
  const columns = [
    { key: 'emp_code', label: 'Emp Code' },
    { key: 'name', label: 'Name' },
    { key: 'department', label: 'Department' },
    { key: 'absent_days', label: 'Absent Days' },
    { key: 'half_day_count', label: 'Half Days' },
    { key: 'lop_days', label: 'LOP Days' },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Half Day & Absent Days</h3>
        <ExportButton reportName="employee-halfday-absent" filters={filters} />
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : <ReportTable columns={columns} data={data} />}
    </div>
  )
}

export default function EmployeeReportsTab({ filters }) {
  const [activeSubTab, setActiveSubTab] = useState('attendance-summary')

  return (
    <div>
      {/* Sub-tab navigation */}
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

      {/* Sub-tab content */}
      {activeSubTab === 'attendance-summary' && <AttendanceSummaryTab filters={filters} />}
      {activeSubTab === 'working-hours' && <WorkingHoursTab filters={filters} />}
      {activeSubTab === 'inout' && <InOutTab filters={filters} />}
      {activeSubTab === 'late-marks' && <LateMarksTab filters={filters} />}
      {activeSubTab === 'ot' && <OTTab filters={filters} />}
      {activeSubTab === 'halfday-absent' && <HalfdayAbsentTab filters={filters} />}
    </div>
  )
}
