/**
 * Attendance.jsx - Employee App (GPS + Selfie)
 *
 * This page replaces the old Face Recognition attendance system.
 * Flow:
 *  1. Employee opens app (already logged in)
 *  2. App auto-fetches GPS location
 *  3. Employee presses "Check In" or "Check Out"
 *  4. App opens camera → employee takes selfie
 *  5. Record is sent to /api/attendance/sync
 *  6. Shows a success/error message
 */
import { useState, useEffect, useRef } from 'react'
import { MapPin, Camera, CheckCircle, XCircle, Loader2, LogIn, LogOut, RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { attendanceApi } from '../services/api'
import { format } from 'date-fns'

const ATTENDANCE_TYPE = {
  CHECK_IN: 'CHECK_IN',
  CHECK_OUT: 'CHECK_OUT',
}

export default function Attendance() {
  const { employee } = useAuth()
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const canvasRef = useRef(null)

  const [location, setLocation] = useState(null)
  const [locationError, setLocationError] = useState(null)
  const [locationLoading, setLocationLoading] = useState(true)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [pendingType, setPendingType] = useState(null)  // 'CHECK_IN' or 'CHECK_OUT'
  const [status, setStatus] = useState('idle') // idle | camera | submitting | success | error
  const [lastResult, setLastResult] = useState(null)
  const [todayRecords, setTodayRecords] = useState([])
  const [loadingRecords, setLoadingRecords] = useState(true)

  // ── GPS: fetch location on mount ──────────────────────────────────────────
  useEffect(() => {
    fetchLocation()
    fetchTodayRecords()
  }, [])

  function fetchLocation() {
    setLocationLoading(true)
    setLocationError(null)
    if (!navigator.geolocation) {
      setLocationError('GPS not supported on this device.')
      setLocationLoading(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
        setLocationLoading(false)
      },
      (err) => {
        setLocationError('GPS permission denied. Please allow location access.')
        setLocationLoading(false)
        console.warn('GPS error:', err)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function fetchTodayRecords() {
    try {
      setLoadingRecords(true)
      const today = format(new Date(), 'yyyy-MM-dd')
      const res = await attendanceApi.getMy({ start_date: today, end_date: today, limit: 20 })
      const records = (res.data.records || res.data || []).filter(
        r => r.emp_id === employee?.emp_id
      )
      setTodayRecords(records)
    } catch (e) {
      console.log('Could not load today records:', e)
    } finally {
      setLoadingRecords(false)
    }
  }

  // ── Camera ─────────────────────────────────────────────────────────────────
  async function openCamera(type) {
    setPendingType(type)
    setStatus('camera')
    setCameraOpen(true)
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API is not supported in this browser. (Make sure you use HTTPS)")
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch (e) {
      console.error("Camera Error:", e)
      setStatus('error')
      
      let errMsg = "Unknown camera error";
      if (e instanceof Error) {
        errMsg = `${e.name}: ${e.message}`;
      } else if (typeof e === 'string') {
        errMsg = e;
      } else if (e && e.message) {
        errMsg = e.message;
      }
      
      alert(`Debug: Camera failed -> ${errMsg}`)
      
      setLastResult({ message: `Camera access failed: ${errMsg}` })
      setCameraOpen(false)
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraOpen(false)
  }

  function captureAndSubmit() {
    try {
      if (!videoRef.current || !canvasRef.current) return
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      canvas.getContext('2d').drawImage(video, 0, 0)
      
      // Some browsers (like Brave) block canvas.toDataURL for fingerprinting protection
      let photoBase64 = ""
      try {
        photoBase64 = canvas.toDataURL('image/jpeg', 0.7)
      } catch (err) {
        console.warn("Canvas export blocked, sending empty image", err)
      }
      
      stopCamera()
      submitAttendance(photoBase64)
    } catch (e) {
      console.error("Capture Error:", e)
      stopCamera()
      setStatus('error')
      setLastResult({ message: `Capture failed: ${e.message || String(e)}` })
    }
  }

  // ── Submit Attendance ──────────────────────────────────────────────────────
  async function submitAttendance(photo) {
    if (!location) {
      setStatus('error')
      setLastResult({ message: 'GPS location not available. Please allow location and try again.' })
      return
    }

    setStatus('submitting')

    const now = new Date()
    const safeUUID = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : Date.now().toString() + Math.random().toString(36).substring(2);

    const record = {
      local_id: safeUUID,
      emp_id: employee?.emp_id,
      emp_code: employee?.emp_code,
      emp_name: employee?.name || employee?.username,
      attendance_type: pendingType,
      date: format(now, 'yyyy-MM-dd'),
      time: format(now, 'HH:mm:ss'),
      latitude: location.latitude,
      longitude: location.longitude,
      photo: photo,
      sync_status: 'PENDING',
      created_at: now.toISOString(),
    }

    try {
      await attendanceApi.sync('employee-app', [record])
      setStatus('success')
      setLastResult({
        type: pendingType,
        message: pendingType === ATTENDANCE_TYPE.CHECK_IN ? 'Check-In successful! ✅' : 'Check-Out successful! ✅',
        time: format(now, 'hh:mm a'),
      })
      fetchTodayRecords()
    } catch (e) {
      setStatus('error')
      
      let errMsg = 'Submission failed. Please try again.'
      if (e.response?.data?.detail) {
        if (Array.isArray(e.response.data.detail)) {
          // Pydantic validation error array
          errMsg = e.response.data.detail.map(err => `${err.loc.join('.')}: ${err.msg}`).join(', ')
        } else {
          errMsg = String(e.response.data.detail)
        }
      }
      
      setLastResult({ message: errMsg })
    }
  }

  // ── Determine next action ──────────────────────────────────────────────────
  const sortedRecords = [...todayRecords].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const lastRecord = sortedRecords[0]
  const nextType = !lastRecord || lastRecord.attendance_type === ATTENDANCE_TYPE.CHECK_OUT
    ? ATTENDANCE_TYPE.CHECK_IN
    : ATTENDANCE_TYPE.CHECK_OUT

  return (
    <div className="pb-20 px-1">
      {/* Date Header */}
      <div className="text-center mb-5">
        <h2 className="text-xl font-bold text-gray-800">Mark Attendance</h2>
        <p className="text-gray-400 text-sm">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Employee Info */}
      <div className="bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-2xl p-4 mb-5 shadow-lg">
        <p className="font-bold text-lg">{employee?.name || employee?.username}</p>
        <p className="text-sky-100 text-sm">{employee?.emp_code || 'Employee'}</p>
      </div>

      {/* GPS Status */}
      <div className={`flex items-center gap-2 rounded-xl px-4 py-3 mb-5 text-sm font-medium ${
        locationLoading ? 'bg-yellow-50 text-yellow-700' :
        location ? 'bg-green-50 text-green-700' :
        'bg-red-50 text-red-600'
      }`}>
        {locationLoading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Getting GPS location...</>
          : location
            ? <><MapPin className="w-4 h-4" /> GPS Location Captured ✓</>
            : <><XCircle className="w-4 h-4" /> {locationError}</>
        }
        {!locationLoading && !location && (
          <button onClick={fetchLocation} className="ml-auto flex items-center gap-1 underline text-xs">
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        )}
      </div>

      {/* Success/Error Result */}
      {(status === 'success' || status === 'error') && lastResult && (
        <div className={`rounded-2xl p-5 mb-5 text-center shadow-md ${
          status === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          {status === 'success'
            ? <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
            : <XCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
          }
          <p className={`font-semibold text-lg ${status === 'success' ? 'text-green-700' : 'text-red-600'}`}>
            {lastResult.message}
          </p>
          {lastResult.time && <p className="text-green-500 text-sm mt-1">At {lastResult.time}</p>}
          <button
            id="mark-again-btn"
            onClick={() => setStatus('idle')}
            className="mt-3 text-sm text-gray-500 underline"
          >
            Mark Again
          </button>
        </div>
      )}

      {/* Main Action Buttons */}
      {status === 'idle' && (
        <div className="grid grid-cols-2 gap-4 mb-5">
          <button
            id="check-in-btn"
            onClick={() => openCamera(ATTENDANCE_TYPE.CHECK_IN)}
            disabled={!location || nextType !== ATTENDANCE_TYPE.CHECK_IN}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl py-8 font-bold text-white text-lg shadow-lg transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
          >
            <LogIn className="w-8 h-8" />
            Check In
          </button>
          <button
            id="check-out-btn"
            onClick={() => openCamera(ATTENDANCE_TYPE.CHECK_OUT)}
            disabled={!location || nextType !== ATTENDANCE_TYPE.CHECK_OUT}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl py-8 font-bold text-white text-lg shadow-lg transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
          >
            <LogOut className="w-8 h-8" />
            Check Out
          </button>
        </div>
      )}

      {/* Submitting */}
      {status === 'submitting' && (
        <div className="text-center py-10">
          <Loader2 className="w-12 h-12 animate-spin text-sky-500 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Submitting attendance...</p>
        </div>
      )}

      {/* Camera View */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-black/80">
            <p className="text-white font-semibold">
              {pendingType === ATTENDANCE_TYPE.CHECK_IN ? '📸 Take Selfie for Check-In' : '📸 Take Selfie for Check-Out'}
            </p>
            <button onClick={() => { stopCamera(); setStatus('idle') }} className="text-white text-sm underline">
              Cancel
            </button>
          </div>
          <div className="flex-1 relative overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          </div>
          <div className="px-4 py-5 bg-black/80 flex justify-center">
            <button
              id="capture-btn"
              onClick={captureAndSubmit}
              className="w-20 h-20 rounded-full bg-white border-4 border-sky-400 flex items-center justify-center shadow-xl active:scale-90 transition"
            >
              <Camera className="w-8 h-8 text-sky-500" />
            </button>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* Today's Records */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-700">Today's Records</h3>
          <button onClick={fetchTodayRecords} className="text-sky-500 text-sm flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
        {loadingRecords ? (
          <div className="text-center py-4 text-gray-400 text-sm">Loading...</div>
        ) : sortedRecords.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm bg-gray-50 rounded-xl">
            No records found for today
          </div>
        ) : (
          <div className="space-y-2">
            {sortedRecords.map((r, i) => (
              <div key={i} className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                r.attendance_type === ATTENDANCE_TYPE.CHECK_IN
                  ? 'bg-green-50 border border-green-100'
                  : 'bg-red-50 border border-red-100'
              }`}>
                <div className="flex items-center gap-2">
                  {r.attendance_type === ATTENDANCE_TYPE.CHECK_IN
                    ? <LogIn className="w-4 h-4 text-green-600" />
                    : <LogOut className="w-4 h-4 text-red-500" />
                  }
                  <span className={`font-medium text-sm ${
                    r.attendance_type === ATTENDANCE_TYPE.CHECK_IN ? 'text-green-700' : 'text-red-600'
                  }`}>
                    {r.attendance_type === ATTENDANCE_TYPE.CHECK_IN ? 'Check In' : 'Check Out'}
                  </span>
                </div>
                <span className="text-gray-400 text-xs">{r.time || '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
