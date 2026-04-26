import { useState, useEffect } from 'react'
import { reportApi } from '../../services/api'
import ReportTable from './ReportTable'
import ExportButton from './ExportButton'

/**
 * Cost Analysis tab — sub-tabs for Req 21–27. Admin only.
 */
const SUB_TABS = [
  { id: 'cost-per-employee', label: 'Cost Per Employee' },
  { id: 'high-absenteeism', label: 'High Absenteeism' },
  { id: 'frequent-late', label: 'Frequent Late Coming' },
  { id: 'missed-punch', label: 'Missed Punch' },
  { id: 'half-day-frequent', label: 'Half Day Frequent' },
  { id: 'absent-cost', label: 'Absent Cost Impact' },
  { id: 'salary-vs-ot', label: 'Salary vs OT' },
]

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

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

function CostPerEmployeeTab({ filters }) {
  const params = buildParams(filters)
  const { data, loading } = useReportData(reportApi.costPerEmployee, params)
  const columns = [
    { key: 'emp_code', label: 'Emp Code' },
    { key: 'name', label: 'Name' },
    { key: 'department', label: 'Department' },
    { key: 'year', label: 'Year' },
    { key: 'month', label: 'Month', render: v => v ? MONTH_NAMES[v - 1] : '—' },
    { key: 'gross_salary', label: 'Gross', render: v => `₹${Number(v).toLocaleString('en-IN')}` },
    { key: 'total_deductions', label: 'Deductions', render: v => `₹${Number(v).toLocaleString('en-IN')}` },
    { key: 'net_pay', label: 'Net Pay', render: v => `₹${Number(v).toLocaleString('en-IN')}` },
    { key: 'ot_cost', label: 'OT Cost', render: v => `₹${Number(v).toLocaleString('en-IN')}` },
    { key: 'total_cost', label: 'Total Cost', render: v => `₹${Number(v).toLocaleString('en-IN')}` },
    { key: 'is_highest_cost', label: 'Highest', render: v => v ? <span className="text-orange-500">★</span> : '' },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Cost Per Employee</h3>
        <ExportButton reportName="cost-per-employee" filters={filters} />
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : <ReportTable columns={columns} data={data} />}
    </div>
  )
}

function HighAbsenteeismTab({ filters }) {
  const params = buildParams(filters)
  const { data, loading } = useReportData(reportApi.highAbsenteeism, params)
  const columns = [
    { key: 'emp_code', label: 'Emp Code' },
    { key: 'name', label: 'Name' },
    { key: 'department', label: 'Department' },
    { key: 'year', label: 'Year' },
    { key: 'month', label: 'Month', render: v => v ? MONTH_NAMES[v - 1] : '—' },
    { key: 'absent_days', label: 'Absent Days' },
    { key: 'lop_days', label: 'LOP Days' },
    { key: 'lop_deduction', label: 'LOP Deduction', render: v => `₹${Number(v).toLocaleString('en-IN')}` },
    { key: 'is_org_summary', label: 'Summary', render: v => v ? <span className="text-blue-600 font-medium">Org</span> : '' },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">High Absenteeism</h3>
        <ExportButton reportName="high-absenteeism" filters={filters} />
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : <ReportTable columns={columns} data={data} />}
    </div>
  )
}

function FrequentLateTab({ filters }) {
  const params = buildParams(filters)
  const { data, loading } = useReportData(reportApi.frequentLateComing, params)
  const columns = [
    { key: 'emp_code', label: 'Emp Code' },
    { key: 'name', label: 'Name' },
    { key: 'department', label: 'Department' },
    { key: 'year', label: 'Year' },
    { key: 'month', label: 'Month', render: v => MONTH_NAMES[v - 1] },
    { key: 'late_mark_count', label: 'Late Marks' },
    { key: 'allowed_limit', label: 'Allowed' },
    { key: 'excess_late_marks', label: 'Excess' },
    { key: 'late_mark_deduction', label: 'Deduction', render: v => `₹${Number(v).toLocaleString('en-IN')}` },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Frequent Late Coming</h3>
        <ExportButton reportName="frequent-late-coming" filters={filters} />
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : <ReportTable columns={columns} data={data} />}
    </div>
  )
}

function MissedPunchTab({ filters }) {
  const params = buildParams(filters)
  const { data, loading } = useReportData(reportApi.missedPunch, params)
  const columns = [
    { key: 'emp_code', label: 'Emp Code' },
    { key: 'name', label: 'Name' },
    { key: 'department', label: 'Department' },
    { key: 'date', label: 'Date' },
    { key: 'check_in', label: 'Check In', render: v => v ? new Date(v).toLocaleTimeString() : '—' },
    { key: 'check_out', label: 'Check Out', render: v => v ? new Date(v).toLocaleTimeString() : '—' },
    { key: 'missing_punch', label: 'Missing' },
    { key: 'source', label: 'Source' },
    { key: 'request_status', label: 'Request Status' },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Missed Punch Records</h3>
        <ExportButton reportName="missed-punch" filters={filters} />
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : <ReportTable columns={columns} data={data} />}
    </div>
  )
}

function HalfDayFrequentTab({ filters }) {
  const params = buildParams(filters)
  const { data, loading } = useReportData(reportApi.halfDayFrequent, params)
  const columns = [
    { key: 'emp_code', label: 'Emp Code' },
    { key: 'name', label: 'Name' },
    { key: 'department', label: 'Department' },
    { key: 'year', label: 'Year' },
    { key: 'month', label: 'Month', render: v => MONTH_NAMES[v - 1] },
    { key: 'half_day_count', label: 'Half Days' },
    { key: 'late_mark_triggered_count', label: 'Late Triggered' },
    { key: 'manual_entry_count', label: 'Manual Entry' },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Frequent Half Day Employees</h3>
        <ExportButton reportName="half-day-frequent" filters={filters} />
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : <ReportTable columns={columns} data={data} />}
    </div>
  )
}

function AbsentCostTab({ filters }) {
  const params = buildParams(filters)
  const { data, loading } = useReportData(reportApi.absentCostImpact, params)
  const columns = [
    { key: 'emp_code', label: 'Emp Code' },
    { key: 'name', label: 'Name' },
    { key: 'department', label: 'Department' },
    { key: 'year', label: 'Year' },
    { key: 'month', label: 'Month', render: v => v ? MONTH_NAMES[v - 1] : '—' },
    { key: 'absent_days', label: 'Absent Days' },
    { key: 'lop_days', label: 'LOP Days' },
    { key: 'gross_salary', label: 'Gross', render: v => `₹${Number(v).toLocaleString('en-IN')}` },
    { key: 'per_day_rate', label: 'Per Day Rate', render: v => `₹${Number(v).toFixed(2)}` },
    { key: 'lop_deduction', label: 'LOP Deduction', render: v => `₹${Number(v).toLocaleString('en-IN')}` },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Absent Cost Impact (LOP)</h3>
        <ExportButton reportName="absent-cost-impact" filters={filters} />
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : <ReportTable columns={columns} data={data} />}
    </div>
  )
}

function SalaryVsOTTab({ filters }) {
  const params = buildParams(filters)
  const { data, loading } = useReportData(reportApi.salaryVsOT, params)
  const columns = [
    { key: 'department', label: 'Department' },
    { key: 'year', label: 'Year' },
    { key: 'month', label: 'Month', render: v => v ? MONTH_NAMES[v - 1] : '—' },
    { key: 'total_gross_salary', label: 'Gross Salary', render: v => `₹${Number(v).toLocaleString('en-IN')}` },
    { key: 'total_ot_cost', label: 'OT Cost', render: v => `₹${Number(v).toLocaleString('en-IN')}` },
    { key: 'ot_cost_pct_of_gross', label: 'OT % of Gross', render: v => `${v}%` },
    {
      key: 'exceeds_15pct_flag',
      label: 'Exceeds 15%',
      render: (v, row) => v ? (
        <span className="text-red-600 font-medium">⚠ Yes</span>
      ) : 'No'
    },
    { key: 'is_org_summary', label: 'Summary', render: v => v ? <span className="text-blue-600 font-medium">Org</span> : '' },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Salary vs OT Cost Comparison</h3>
        <ExportButton reportName="salary-vs-ot" filters={filters} />
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : <ReportTable columns={columns} data={data} />}
    </div>
  )
}

export default function CostAnalysisTab({ filters }) {
  const [activeSubTab, setActiveSubTab] = useState('cost-per-employee')

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

      {activeSubTab === 'cost-per-employee' && <CostPerEmployeeTab filters={filters} />}
      {activeSubTab === 'high-absenteeism' && <HighAbsenteeismTab filters={filters} />}
      {activeSubTab === 'frequent-late' && <FrequentLateTab filters={filters} />}
      {activeSubTab === 'missed-punch' && <MissedPunchTab filters={filters} />}
      {activeSubTab === 'half-day-frequent' && <HalfDayFrequentTab filters={filters} />}
      {activeSubTab === 'absent-cost' && <AbsentCostTab filters={filters} />}
      {activeSubTab === 'salary-vs-ot' && <SalaryVsOTTab filters={filters} />}
    </div>
  )
}
