import { useState, useEffect } from 'react'
import { Loader2, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts'
import { employeeApi } from '../services/api'

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16']
const TABS = ['Department', 'Headcount Trend', 'Salary Distribution', 'Probation Ending']

export default function EmployeeReports() {
  const [activeTab, setActiveTab] = useState('Department')
  const [loading, setLoading] = useState(true)
  const [deptData, setDeptData] = useState([])
  const [headcountData, setHeadcountData] = useState([])
  const [salaryData, setSalaryData] = useState([])
  const [probationData, setProbationData] = useState([])
  const [confirmingId, setConfirmingId] = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [dept, hc, sal, prob] = await Promise.all([
        employeeApi.reportDepartment(),
        employeeApi.reportHeadcount(),
        employeeApi.reportSalary(),
        employeeApi.reportProbation(),
      ])
      setDeptData(dept.data || [])
      setHeadcountData(hc.data || [])
      setSalaryData(sal.data || [])
      setProbationData(prob.data || [])
    } catch { toast.error('Failed to load reports') }
    finally { setLoading(false) }
  }

  async function handleConfirm(emp) {
    setConfirmingId(emp.id)
    try {
      await employeeApi.confirm(emp.id)
      toast.success(`${emp.name} confirmed!`)
      const r = await employeeApi.reportProbation()
      setProbationData(r.data || [])
    } catch { toast.error('Failed to confirm') }
    finally { setConfirmingId(null) }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div></div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Employee Reports</h1>
        <p className="text-gray-500">Analytics and insights about your workforce</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6 bg-white rounded-t-xl shadow-sm overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition ${activeTab === tab ? 'border-b-2 border-primary-600 text-primary-600 bg-primary-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Department Report */}
      {activeTab === 'Department' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl shadow p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Employees by Department (Bar)</h3>
            {deptData.length === 0 ? <p className="text-gray-400 text-center py-8">No data</p> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={deptData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="department" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="bg-white rounded-xl shadow p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Employees by Department (Pie)</h3>
            {deptData.length === 0 ? <p className="text-gray-400 text-center py-8">No data</p> : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={deptData} dataKey="count" nameKey="department" cx="50%" cy="50%" outerRadius={90} label={({ department, percent }) => `${department} ${(percent*100).toFixed(0)}%`}>
                    {deptData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {/* Table */}
          <div className="bg-white rounded-xl shadow p-5 lg:col-span-2">
            <h3 className="font-semibold text-gray-800 mb-3">Department Summary</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr><th className="px-4 py-2 text-left">Department</th><th className="px-4 py-2 text-right">Employees</th></tr>
                </thead>
                <tbody className="divide-y">
                  {deptData.map(d => (
                    <tr key={d.department} className="hover:bg-gray-50">
                      <td className="px-4 py-2">{d.department}</td>
                      <td className="px-4 py-2 text-right font-semibold">{d.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Headcount Trend */}
      {activeTab === 'Headcount Trend' && (
        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Monthly Joining Trend (Last 12 Months)</h3>
          {headcountData.length === 0 ? <p className="text-gray-400 text-center py-8">No data</p> : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={headcountData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Salary Distribution */}
      {activeTab === 'Salary Distribution' && (
        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Salary Distribution</h3>
          {salaryData.length === 0 ? <p className="text-gray-400 text-center py-8">No data</p> : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={salaryData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#10b981" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr><th className="px-4 py-2 text-left">Salary Range</th><th className="px-4 py-2 text-right">Employees</th></tr>
              </thead>
              <tbody className="divide-y">
                {salaryData.map(s => (
                  <tr key={s.range} className="hover:bg-gray-50">
                    <td className="px-4 py-2">₹{s.range}</td>
                    <td className="px-4 py-2 text-right font-semibold">{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Probation Ending */}
      {activeTab === 'Probation Ending' && (
        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="font-semibold text-gray-800 mb-1">Probation Ending in Next 30 Days</h3>
          <p className="text-sm text-gray-500 mb-4">Employees who need to be confirmed soon</p>
          {probationData.length === 0 ? (
            <div className="text-center py-12">
              <UserCheck className="w-12 h-12 mx-auto text-green-300 mb-3" />
              <p className="text-gray-500">No employees have probation ending in the next 30 days 🎉</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Employee</th>
                    <th className="px-4 py-3 text-left">Department</th>
                    <th className="px-4 py-3 text-left">Probation End</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {probationData.map(emp => {
                    const daysLeft = Math.ceil((new Date(emp.probation_end_date) - new Date()) / (1000*60*60*24))
                    return (
                      <tr key={emp.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{emp.name}</p>
                          <p className="text-xs text-gray-400">{emp.emp_code}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{emp.department || '—'}</td>
                        <td className="px-4 py-3">
                          <p className="text-gray-800">{emp.probation_end_date}</p>
                          <p className={`text-xs ${daysLeft <= 7 ? 'text-red-600 font-medium' : 'text-orange-500'}`}>{daysLeft} days left</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => handleConfirm(emp)} disabled={confirmingId === emp.id}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 disabled:opacity-50 mx-auto">
                            {confirmingId === emp.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                            Confirm
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
