import { useState, useEffect } from 'react'
import { CreditCard, AlertCircle } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

const TYPE_COLORS = {
  LOAN: 'bg-blue-100 text-blue-700',
  ADVANCE: 'bg-purple-100 text-purple-700',
}

export default function MyLoans() {
  const { user } = useAuth()
  const [deductions, setDeductions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.employee_id) {
      axios.get(`/api/v1/deductions/employee/${user.employee_id}`)
        .then(r => setDeductions((r.data || []).filter(d => ['LOAN', 'ADVANCE'].includes(d.deduction_type))))
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [user])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800">💳 My Loans &amp; Advances</h1>
        <p className="text-gray-500 text-sm">Active loan and advance balances</p>
      </div>

      {deductions.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">
          <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No active loans or advances</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deductions.map(d => {
            const progress = d.total_amount > 0
              ? Math.round((parseFloat(d.recovered || 0) / parseFloat(d.total_amount)) * 100)
              : 0
            return (
              <div key={d.id} className="bg-white rounded-xl shadow p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[d.deduction_type] || 'bg-gray-100'}`}>
                    {d.deduction_type}
                  </span>
                  <span className="text-xs text-gray-400">{d.status}</span>
                </div>
                {d.description && <p className="text-sm text-gray-600 mb-3">{d.description}</p>}
                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className="text-xs text-gray-400">Total</div>
                    <div className="text-sm font-semibold text-gray-700">₹{parseFloat(d.total_amount || 0).toLocaleString('en-IN')}</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2">
                    <div className="text-xs text-gray-400">Recovered</div>
                    <div className="text-sm font-semibold text-green-700">₹{parseFloat(d.recovered || 0).toLocaleString('en-IN')}</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-2">
                    <div className="text-xs text-gray-400">Remaining</div>
                    <div className="text-sm font-semibold text-red-600">₹{parseFloat(d.remaining || 0).toLocaleString('en-IN')}</div>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>{progress}% recovered</span>
                  {d.emi_amount && <span>EMI: ₹{parseFloat(d.emi_amount).toLocaleString('en-IN')}/month</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
