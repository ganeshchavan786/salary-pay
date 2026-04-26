import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { reportApi } from '../../services/api'
import ReportTable from './ReportTable'
import ExportButton from './ExportButton'

/**
 * Leave Reports tab — sub-tabs for Req 28–31.
 */
const SUB_TABS = [
  { id: 'leave-balance', label: 'Leave Balance' },
  { id: 'leave-trend', label: 'Leave Usage Trend' },
  { id: 'compoff-balance', label: 'Comp-Off Balance' },
  { id: 'expiring-compoff', label: 'Expiring Comp-Off' },
]

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function useReportData(fetchFn, params) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    setLoading(true)
    fetchFn(params)
      .then(res => {
        const d = res.data
        if (Array.isArray(d)) setData(d)
        else if (d?.data) setData(d.data)
        else setData([])
      })
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

function LeaveBalanceTab({ filters }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const params = {
      year,
      emp_ids: filters.empIds?.length ? filters.empIds : undefined,
      departments: filters.departments?.length ? filters.departments : undefined,
    }
    reportApi.leaveBalance(params)
      .then(res => setData(res.data || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [year, JSON.stringify(filters)])

  const columns = [
    { key: 'emp_code', label: 'Emp Code' },
    { key: 'name', label: 'Name' },
    { key: 'department', label: 'Department' },
    { key: 'cl_total', label: 'CL Total' },
    { key: 'cl_used', label: 'CL Used' },
    { key: 'cl_remaining', label: 'CL Remaining' },
    { key: 'sl_used', label: 'SL Used' },
    { key: 'el_used', label: 'EL Used' },
    { key: 'lwp_days', label: 'LWP Days' },
    { key: 'compoff_balance', label: 'Comp-Off' },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-gray-700">Leave Balance</h3>
          <input type="number" value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 text-sm w-20" min="2020" max="2030" />
        </div>
        <ExportButton reportName="leave-balance" filters={{ ...filters, year }} />
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : <ReportTable columns={columns} data={data} />}
    </div>
  )
}

function LeaveUsageTrendTab({ filters }) {
  const params = buildParams(filters)
  const { data, loading } = useReportData(reportApi.leaveUsageTrend, params)

  // Chart data: group by month, show bars per leave type
  const chartData = {}
  data.filter(r => !r.is_total_row).forEach(r => {
    const key = `${MONTH_NAMES[r.month - 1]} ${r.year}`
    if (!chartData[key]) chartData[key] = { name: key }
    chartData[key][r.leave_type] = (chartData[key][r.leave_type] || 0) + r.total_days
  })
  const chartArr = Object.values(chartData)

  const columns = [
    { key: 'year', label: 'Year' },
    { key: 'month', label: 'Month', render: v => MONTH_NAMES[v - 1] },
    { key: 'leave_type', label: 'Leave Type', render: v => v || 'Total' },
    { key: 'total_days', label: 'Total Days' },
    { key: 'employee_count', label: 'Employees' },
    { key: 'is_total_row', label: 'Total Row', render: v => v ? <span className="text-blue-600">Total</span> : '' },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Leave Usage Trend</h3>
        <ExportButton reportName="leave-usage-trend" filters={filters} />
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : (
        <>
          {chartArr.length > 0 && (
            <div className="mb-4 bg-white rounded-lg border border-gray-200 p-4">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartArr}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="CL" fill="#3b82f6" name="CL" />
                  <Bar dataKey="SL" fill="#10b981" name="SL" />
                  <Bar dataKey="EL" fill="#f59e0b" name="EL" />
                  <Bar dataKey="LWP" fill="#ef4444" name="LWP" />
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

function CompoffBalanceTab({ filters }) {
  const params = {
    emp_ids: filters.empIds?.length ? filters.empIds : undefined,
    departments: filters.departments?.length ? filters.departments : undefined,
  }
  const { data, loading } = useReportData(reportApi.compoffBalance, params)
  const columns = [
    { key: 'emp_code', label: 'Emp Code' },
    { key: 'name', label: 'Name' },
    { key: 'department', label: 'Department' },
    { key: 'total_credits_earned', label: 'Credits Earned' },
    { key: 'total_used', label: 'Used' },
    { key: 'remaining_balance', label: 'Balance' },
    { key: 'expiring_within_30_days', label: 'Expiring (30d)', render: v => v > 0 ? <span className="text-orange-500 font-medium">{v}</span> : v },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Comp-Off Balance</h3>
        <ExportButton reportName="compoff-balance" filters={filters} />
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : <ReportTable columns={columns} data={data} />}
    </div>
  )
}

function ExpiringCompoffTab({ filters }) {
  const [result, setResult] = useState({ data: [], message: null })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const params = {
      emp_ids: filters.empIds?.length ? filters.empIds : undefined,
      departments: filters.departments?.length ? filters.departments : undefined,
    }
    reportApi.expiringCompoff(params)
      .then(res => {
        const d = res.data
        if (d?.message) setResult(d)
        else setResult({ data: Array.isArray(d) ? d : [], message: null })
      })
      .catch(() => setResult({ data: [], message: null }))
      .finally(() => setLoading(false))
  }, [JSON.stringify(filters)])

  const columns = [
    { key: 'emp_code', label: 'Emp Code' },
    { key: 'name', label: 'Name' },
    { key: 'department', label: 'Department' },
    { key: 'credit_date', label: 'Credit Date' },
    { key: 'expiry_date', label: 'Expiry Date' },
    { key: 'days_remaining', label: 'Days Remaining', render: v => <span className={v <= 7 ? 'text-red-500 font-medium' : 'text-orange-500'}>{v}</span> },
    { key: 'credit_hours', label: 'Credit Hours' },
  ]
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700">Expiring Comp-Off Alert</h3>
        <ExportButton reportName="expiring-compoff" filters={filters} />
      </div>
      {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : (
        result.message ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
            {result.message}
          </div>
        ) : (
          <ReportTable columns={columns} data={result.data} />
        )
      )}
    </div>
  )
}

export default function LeaveReportsTab({ filters }) {
  const [activeSubTab, setActiveSubTab] = useState('leave-balance')

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

      {activeSubTab === 'leave-balance' && <LeaveBalanceTab filters={filters} />}
      {activeSubTab === 'leave-trend' && <LeaveUsageTrendTab filters={filters} />}
      {activeSubTab === 'compoff-balance' && <CompoffBalanceTab filters={filters} />}
      {activeSubTab === 'expiring-compoff' && <ExpiringCompoffTab filters={filters} />}
    </div>
  )
}
