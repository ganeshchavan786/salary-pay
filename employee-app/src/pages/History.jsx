import { useState, useEffect } from 'react'
import { Calendar, Clock, MapPin, RefreshCw, Loader2 } from 'lucide-react'
import { attendanceDB } from '../db'
import { checkAndSync, getLastSyncMeta } from '../services/syncService'

export default function History() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncMeta, setLastSyncMeta] = useState(null)
  const [syncFilter, setSyncFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    loadRecords()
    setLastSyncMeta(getLastSyncMeta())
  }, [])

  async function loadRecords() {
    setLoading(true)
    try {
      const allRecords = await attendanceDB.getAll()
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

  async function handleSync() {
    if (!navigator.onLine) {
      alert('You are offline. Please connect to internet to sync.')
      return
    }

    setSyncing(true)
    try {
      const result = await checkAndSync()
      if (result) {
        alert(`Synced: ${result.synced}, Failed: ${result.failed}`)
        await loadRecords()
        setLastSyncMeta(getLastSyncMeta())
      }
    } catch (error) {
      alert('Sync failed. Please try again.')
      setLastSyncMeta(getLastSyncMeta())
    } finally {
      setSyncing(false)
    }
  }

  const pendingCount = records.filter(r => r.sync_status === 'PENDING').length
  const filteredRecords = records.filter((record) => {
    if (syncFilter !== 'ALL' && record.sync_status !== syncFilter) return false
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
          <p className="text-sm text-gray-500">{filteredRecords.length} of {records.length} records</p>
        </div>
        
        <button
          onClick={handleSync}
          disabled={syncing || pendingCount === 0}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm disabled:opacity-50"
        >
          {syncing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Sync ({pendingCount})
        </button>
      </div>

      {lastSyncMeta && (
        <div className={`mb-4 rounded-lg px-3 py-2 text-sm ${
          lastSyncMeta.status === 'success' ? 'bg-green-100 text-green-700' :
          lastSyncMeta.status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
          lastSyncMeta.status === 'failed' ? 'bg-red-100 text-red-700' :
          'bg-gray-100 text-gray-600'
        }`}>
          Last sync: {lastSyncMeta.message}
          {` | synced ${lastSyncMeta.synced}, failed ${lastSyncMeta.failed}, retries ${lastSyncMeta.retries}`}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Sync Status</label>
          <select
            value={syncFilter}
            onChange={(e) => setSyncFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="ALL">All</option>
            <option value="SYNCED">Synced</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Attendance Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="ALL">All</option>
            <option value="CHECK_IN">Check-In</option>
            <option value="CHECK_OUT">Check-Out</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      {filteredRecords.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No matching attendance records</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRecords.map((record) => (
            <div
              key={record.id}
              className="bg-white rounded-lg shadow p-4 border-l-4"
              style={{
                borderLeftColor: record.sync_status === 'SYNCED' ? '#22c55e' : '#f59e0b'
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-800">
                    {record.emp_name || 'Unknown'}
                  </p>
                  <p className="text-sm text-gray-500">{record.emp_code} • {record.attendance_type || 'CHECK_IN'}</p>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  record.sync_status === 'SYNCED' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {record.sync_status}
                </div>
              </div>
              
              <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>{record.date}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{record.time}</span>
                </div>
              </div>
              
              {record.latitude && record.longitude && (
                <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                  <MapPin className="w-3 h-3" />
                  <span>{record.latitude.toFixed(4)}, {record.longitude.toFixed(4)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
