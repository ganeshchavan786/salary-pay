import { useState, useEffect } from 'react'
import { Calendar, Clock, MapPin, Loader2 } from 'lucide-react'
import { attendanceApi } from '../services/api'

export default function History() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [activeTab, setActiveTab] = useState('HISTORY') // 'HISTORY' | 'REQUESTS'
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [requests, setRequests] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    check_in: '09:30',
    check_out: '18:30',
    reason: ''
  })

  useEffect(() => {
    loadRecords()
    loadRequests()
  }, [])

  async function loadRequests() {
    try {
      const res = await attendanceApi.listMissedPunches()
      setRequests(res.data || [])
    } catch (e) { console.log(e) }
  }

  async function handleSubmitRequest(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await attendanceApi.submitMissedPunch(form)
      alert('Request submitted successfully!')
      setShowRequestModal(false)
      loadRequests()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  async function loadRecords() {
    setLoading(true)
    try {
      const res = await attendanceApi.getMy({ limit: 100 })
      const allRecords = res.data.records || res.data || []
      const sorted = allRecords.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      )
      setRecords(sorted)
    } catch (error) {
      console.error('Error loading records:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredRecords = records.filter((record) => {
    if (typeFilter !== 'ALL' && record.attendance_type !== typeFilter) return false
    if (startDate && record.date < startDate) return false
    if (endDate && record.date > endDate) return false
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="pb-20">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Attendance History</h2>
          <p className="text-sm text-gray-500">{activeTab === 'HISTORY' ? `${filteredRecords.length} records` : `${requests.length} requests`}</p>
        </div>
        {activeTab !== 'HISTORY' && (
          <button
            onClick={() => setShowRequestModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-bold shadow-lg"
          >
            + New Request
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('HISTORY')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'HISTORY' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}
        >
          History
        </button>
        <button
          onClick={() => setActiveTab('REQUESTS')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'REQUESTS' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}
        >
          Requests
        </button>
      </div>

      {activeTab === 'HISTORY' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 mb-4">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="border rounded-lg p-2 text-sm">
              <option value="ALL">All Types</option>
              <option value="CHECK_IN">Check-In</option>
              <option value="CHECK_OUT">Check-Out</option>
            </select>
          </div>
          {filteredRecords.map((record) => (
            <div key={record.id} className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-primary-500">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-gray-800">{record.attendance_type}</p>
                  <p className="text-xs text-gray-500">{record.date} • {record.time}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold text-gray-800">{req.date}</p>
                  <p className="text-xs text-gray-500">{req.reason}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${req.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {req.status}
                </span>
              </div>
              <div className="flex gap-4 mt-2 pt-2 border-t border-dashed">
                <div className="text-xs font-bold text-gray-600">In: {req.requested_check_in}</div>
                <div className="text-xs font-bold text-gray-600">Out: {req.requested_check_out}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showRequestModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-gray-800">Missed Punch</h3>
              <button onClick={() => setShowRequestModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full bg-gray-50 rounded-xl p-3" />
              <div className="grid grid-cols-2 gap-4">
                <input type="time" value={form.check_in} onChange={e => setForm({...form, check_in: e.target.value})} className="w-full bg-gray-50 rounded-xl p-3" />
                <input type="time" value={form.check_out} onChange={e => setForm({...form, check_out: e.target.value})} className="w-full bg-gray-50 rounded-xl p-3" />
              </div>
              <textarea placeholder="Reason" value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} className="w-full bg-gray-50 rounded-xl p-3" rows="3" />
              <button type="submit" disabled={submitting} className="w-full bg-primary-600 text-white font-bold py-3 rounded-xl">
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
