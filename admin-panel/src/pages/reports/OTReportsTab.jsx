import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { reportApi } from '../../services/api'
import ReportTable from './ReportTable'
import ExportButton from './ExportButton'

/**
 * OT Reports tab — sub-tabs for Req 16–20. Admin only.
 */
const SUB_TABS = [
  { id: 'department-ot', label: 'Department OT' },
  { id: 'monthly-trend', label: 'Monthly OT Trend' },
  { id: 'ot-cost', label: 'OT Cost' },
  { id: 'holiday-ot', label: 'Holiday OT' },
  { id: 'excess-ot', label: 'Excess OT Alert' },
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

function DepartmentOTTab({ filters }) {
  const params = buildParams(filters)
  const { data, loading } = useReportData(reportApi.departmentOT, params)
  const columns = [
    { key: 'department', label: 'Department' },
    { key: 'year', label: 'Year' },
    { key: 'month', label: 'Month', render: v => MONTH_NAMES[v - 1] },
    { key: 'total_ot_hours', label: 'OT Hours' },
    { key: 'total_ot_cost', label: 'OT Cost', render: v => `₹${Number(v).toLocaleString('en-IN')}` },
    { key: 'employee_count_with_ot', label: 'Employees w/ OT' },
    { key: 'avg_ot_hours_per_employee', label: 'Avg OT/Emp' },
    { key: 'exceeds_scheduled_flag', label: 'Exceeds 20%', render: v => v ? <span className="text-red-500">⚠ Yes</span> : 'No' },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Department-Wise OT</h3>
        <ExportButton reportName="department-ot" filters={filters} />
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : <ReportTable columns={columns} data={data} />}
    </div>
  )
}

function MonthlyOTTrendTab({ filters }) {
  const params = buildParams(filters)
  const { data, loading } = useReportData(reportApi.monthlyOTTrend, params)
  const chartData = data.map(r => ({
    name: `${MONTH_NAMES[r.month - 1]} ${r.year}`,
    ot_hours: r.total_ot_hours,
  }))
  const columns = [
    { key: 'year', label: 'Year' },
    { key: 'month', label: 'Month', render: v => MONTH_NAMES[v - 1] },
    { key: 'total_ot_hours', label: 'OT Hours' },
    { key: 'total_ot_cost', label: 'OT Cost', render: v => `₹${Number(v).toLocaleString('en-IN')}` },
    { key: 'employee_count_with_ot', label: 'Employees w/ OT' },
    { key: 'mom_change_pct', label: 'MoM Change', render: v => v != null ? `${v}%` : '—' },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Monthly OT Trend</h3>
        <ExportButton reportName="monthly-ot-trend" filters={filters} />
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : (
        <>
          {chartData.length > 0 && (
            <div className="mb-4 bg-white rounded-lg border border-gray-200 p-4">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="ot_hours" fill="#3b82f6" name="OT Hours" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <ReportTable columns={columns} data={data} />
        </>
      )}
    </div>
  )
}

function OTCostTab({ filters }) {
  const params = buildParams(filters)
  const { data, loading } = useReportData(reportApi.otCost, params)
  const columns = [
    { key: 'emp_code', label: 'Emp Code' },
    { key: 'name', label: 'Name' },
    { key: 'department', label: 'Department' },
    { key: 'year', label: 'Year' },
    { key: 'month', label: 'Month', render: v => MONTH_NAMES[v - 1] },
    { key: 'gross_salary', label: 'Gross', render: v => `₹${Number(v).toLocaleString('en-IN')}` },
    { key: 'ot_hours', label: 'OT Hours' },
    { key: 'cost_per_hour', label: 'Cost/Hr', render: v => `₹${Number(v).toFixed(2)}` },
    { key: 'ot_cost', label: 'OT Cost', render: v => `₹${Number(v).toLocaleString('en-IN')}` },
    { key: 'ot_cost_pct_of_gross', label: 'OT % of Gross', render: v => `${v}%` },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">OT Cost Report</h3>
        <ExportButton reportName="ot-cost" filters={filters} />
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : <ReportTable columns={columns} data={data} />}
    </div>
  )
}

function HolidayOTTab({ filters }) {
  const params = buildParams(filters)
  const { data, loading } = useReportData(reportApi.holidayOT, params)
  const columns = [
    { key: 'emp_code', label: 'Emp Code' },
    { key: 'name', label: 'Name' },
    { key: 'department', label: 'Department' },
    { key: 'holiday_name', label: 'Holiday' },
    { key: 'date', label: 'Date' },
    { key: 'working_hours', label: 'Working Hours' },
    { key: 'ot_hours', label: 'OT Hours' },
    { key: 'ot_cost', label: 'OT Cost', render: v => `₹${Number(v).toLocaleString('en-IN')}` },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Holiday OT Report</h3>
        <ExportButton reportName="holiday-ot" filters={filters} />
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : <ReportTable columns={columns} data={data} />}
    </div>
  )
}

function ExcessOTTab({ filters }) {
  const params = buildParams(filters)
  const { data, loading } = useReportData(reportApi.excessOTAlert, params)
  const columns = [
    { key: 'emp_code', label: 'Emp Code' },
    { key: 'name', label: 'Name' },
    { key: 'department', label: 'Department' },
    { key: 'year', label: 'Year' },
    { key: 'month', label: 'Month', render: v => MONTH_NAMES[v - 1] },
    { key: 'total_ot_hours', label: 'Total OT' },
    { key: 'monthly_ot_limit', label: 'OT Limit' },
    { key: 'excess_hours', label: 'Excess Hours' },
    { key: 'excess_ot_cost', label: 'Excess Cost', render: v => `₹${Number(v).toLocaleString('en-IN')}` },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Excess OT Alert</h3>
        <ExportButton reportName="excess-ot-alert" filters={filters} />
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : <ReportTable columns={columns} data={data} />}
    </div>
  )
}

export default function OTReportsTab({ filters }) {
  const [activeSubTab, setActiveSubTab] = useState('department-ot')

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

      {activeSubTab === 'department-ot' && <DepartmentOTTab filters={filters} />}
      {activeSubTab === 'monthly-trend' && <MonthlyOTTrendTab filters={filters} />}
      {activeSubTab === 'ot-cost' && <OTCostTab filters={filters} />}
      {activeSubTab === 'holiday-ot' && <HolidayOTTab filters={filters} />}
      {activeSubTab === 'excess-ot' && <ExcessOTTab filters={filters} />}
    </div>
  )
}
