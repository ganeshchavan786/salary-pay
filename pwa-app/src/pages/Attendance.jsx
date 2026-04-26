import { useState, useEffect, useRef } from 'react'
import { CheckCircle, XCircle, Loader2, MapPin, Eye, Scan, RefreshCw } from 'lucide-react'
import { loadModels, findBestMatch, captureSnapshot } from '../services/faceService'
import { LivenessDetector } from '../services/livenessService'
import { employeeDB, attendanceDB } from '../db'
import { employeeApi } from '../services/api'
import { checkAndSync } from '../services/syncService'
import { showNotification } from '../services/notificationService'
import { format } from 'date-fns'
import * as faceapi from 'face-api.js'

// Cooldown time after successful attendance (ms)
const SUCCESS_COOLDOWN = 5000
// Minimum gap between entries for same person (ms) - 5 minutes
const MIN_GAP_MS = 5 * 60 * 1000
// Cooldown for too soon message (ms)
const TOO_SOON_COOLDOWN = 3000

// Attendance types
const ATTENDANCE_TYPE = {
  CHECK_IN: 'CHECK_IN',
  CHECK_OUT: 'CHECK_OUT'
}

export default function Attendance() {
  const videoRef = useRef(null)
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('Loading...')
  const [employees, setEmployees] = useState([])
  const [matchedEmployee, setMatchedEmployee] = useState(null)
  const [location, setLocation] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  // Track last entry time and next expected type for each employee
  const [employeeStatus, setEmployeeStatus] = useState({}) // { empId: { lastTime, nextType, totalIn, totalOut } }
  
  const streamRef = useRef(null)
  const scanningRef = useRef(false)
  const livenessDetectorRef = useRef(null)
  const currentMatchRef = useRef(null)
  const employeesRef = useRef([])

  // Keep employeesRef in sync
  useEffect(() => {
    employeesRef.current = employees
  }, [employees])

  useEffect(() => {
    initializeApp()
    return () => {
      scanningRef.current = false
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // Refresh employee cache when connectivity is restored
  useEffect(() => {
    function handleOnline() {
      loadEmployees()
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  async function initializeApp() {
    try {
      setMessage('Loading face models...')
      const modelsLoaded = await loadModels()
      if (!modelsLoaded) {
        setStatus('error')
        setMessage('Failed to load face recognition models')
        return
      }

      setMessage('Loading employees...')
      await loadEmployees()
      
      setMessage('Starting camera...')
      await startCamera()
      
      await loadTodayAttendance()
      getLocation()
      
      // Start continuous scanning
      setStatus('scanning')
      setMessage('📷 Scanning for faces...')
      scanningRef.current = true
      startContinuousScanning()
      
    } catch (error) {
      console.error('Initialization error:', error)
      setStatus('error')
      setMessage(error.message || 'Failed to initialize')
    }
  }

  async function loadEmployees() {
    try {
      if (navigator.onLine) {
        const response = await employeeApi.getAll(true)
        const empList = response.data.employees || []
        const enrolledEmployees = empList.filter(e => e.face_enrolled && e.face_descriptor)
        await employeeDB.saveMany(enrolledEmployees)
        setEmployees(enrolledEmployees)
        employeesRef.current = enrolledEmployees
      } else {
        const cached = await employeeDB.getAll()
        setEmployees(cached)
        employeesRef.current = cached
      }
    } catch (error) {
      console.log('Loading from cache...')
      const cached = await employeeDB.getAll()
      setEmployees(cached)
      employeesRef.current = cached
    }
  }

  async function handleManualRefresh() {
    if (!navigator.onLine || refreshing) return
    setRefreshing(true)
    await loadEmployees()
    setRefreshing(false)
  }

  async function loadTodayAttendance() {
    const today = format(new Date(), 'yyyy-MM-dd')
    const todayRecords = await attendanceDB.getByDate(today)
    
    // Build status for each employee
    const statusMap = {}
    
    // Sort by time to get correct sequence
    const sortedRecords = [...todayRecords].sort((a, b) => 
      new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`)
    )
    
    sortedRecords.forEach(r => {
      if (!statusMap[r.emp_id]) {
        statusMap[r.emp_id] = { lastTime: null, nextType: ATTENDANCE_TYPE.CHECK_IN, totalIn: 0, totalOut: 0 }
      }
      
      const recordTime = new Date(`${r.date}T${r.time}`).getTime()
      statusMap[r.emp_id].lastTime = recordTime
      
      if (r.attendance_type === ATTENDANCE_TYPE.CHECK_OUT) {
        statusMap[r.emp_id].totalOut++
        statusMap[r.emp_id].nextType = ATTENDANCE_TYPE.CHECK_IN
      } else {
        statusMap[r.emp_id].totalIn++
        statusMap[r.emp_id].nextType = ATTENDANCE_TYPE.CHECK_OUT
      }
    })
    
    setEmployeeStatus(statusMap)
  }

  async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 640, height: 480 }
    })
    streamRef.current = stream
    if (videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }

  function getLocation() {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          })
        },
        (error) => console.log('Location error:', error)
      )
    }
  }

  async function startContinuousScanning() {
    while (scanningRef.current) {
      try {
        if (!videoRef.current || videoRef.current.readyState !== 4) {
          await sleep(100)
          continue
        }

        // Detect face with landmarks
        const detection = await faceapi
          .detectSingleFace(videoRef.current)
          .withFaceLandmarks()
          .withFaceDescriptor()

        if (!detection) {
          setStatus('scanning')
          setMessage('📷 Scanning for faces...')
          setMatchedEmployee(null)
          currentMatchRef.current = null
          livenessDetectorRef.current = null
          await sleep(200)
          continue
        }

        // Face detected - try to match
        const match = findBestMatch(detection.descriptor, employeesRef.current)
        
        if (!match) {
          setStatus('scanning')
          setMessage('👤 Face detected - Not recognized')
          setMatchedEmployee(null)
          currentMatchRef.current = null
          livenessDetectorRef.current = null
          await sleep(500)
          continue
        }

        // Get employee's current status
        const empStatus = employeeStatus[match.employee.id] || { 
          lastTime: null, 
          nextType: ATTENDANCE_TYPE.CHECK_IN, 
          totalIn: 0, 
          totalOut: 0 
        }
        
        // Check 5 minute gap
        const now = Date.now()
        if (empStatus.lastTime && (now - empStatus.lastTime) < MIN_GAP_MS) {
          const remainingMs = MIN_GAP_MS - (now - empStatus.lastTime)
          const remainingMin = Math.ceil(remainingMs / 60000)
          setStatus('too_soon')
          setMessage(`⏳ ${match.employee.name} - ${remainingMin} मिनिटे थांबा`)
          setMatchedEmployee(match.employee)
          await sleep(TOO_SOON_COOLDOWN)
          continue
        }

        // Determine next type (auto-alternate)
        const nextType = empStatus.nextType
        const modeLabel = nextType === ATTENDANCE_TYPE.CHECK_IN ? '🟢 IN' : '🔴 OUT'

        // New match or same match - start/continue liveness check
        if (currentMatchRef.current?.id !== match.employee.id) {
          currentMatchRef.current = match.employee
          livenessDetectorRef.current = new LivenessDetector()
          setMatchedEmployee(match.employee)
        }

        const livenessStatus = livenessDetectorRef.current.getStatus()
        const challengeMessage =
          livenessStatus.challenge === 'TURN_LEFT' ? 'कृपया चेहरा डावीकडे वळवा' :
          livenessStatus.challenge === 'TURN_RIGHT' ? 'कृपया चेहरा उजवीकडे वळवा' :
          'कृपया डोळे मिटा'

        setStatus('blink_check')
        setMessage(`👁️ ${match.employee.name} [${modeLabel}] - ${challengeMessage}`)

        // Check for blink
        const blinkDetected = livenessDetectorRef.current.processFrame(detection.landmarks)

        if (blinkDetected) {
          // Liveness verified! Mark attendance
          await markAttendance(match.employee, detection)
        }

        await sleep(50) // Fast polling during blink check
        
      } catch (error) {
        console.error('Scanning error:', error)
        await sleep(500)
      }
    }
  }

  async function markAttendance(employee, detection) {
    // Get current status to determine type
    const empStatus = employeeStatus[employee.id] || { 
      lastTime: null, 
      nextType: ATTENDANCE_TYPE.CHECK_IN, 
      totalIn: 0, 
      totalOut: 0 
    }
    
    const attendanceType = empStatus.nextType
    const modeText = attendanceType === ATTENDANCE_TYPE.CHECK_IN ? 'Check-In' : 'Check-Out'
    const modeEmoji = attendanceType === ATTENDANCE_TYPE.CHECK_IN ? '🟢' : '🔴'
    
    setStatus('success')
    setMessage(`${modeEmoji} ${modeText} marked for ${employee.name}!`)
    showNotification(`Attendance Marked ${modeEmoji}`, `${employee.name} — ${modeText} recorded`)

    const photo = await captureSnapshot(videoRef.current)
    const today = format(new Date(), 'yyyy-MM-dd')
    const currentTime = format(new Date(), 'HH:mm:ss')

    const attendanceRecord = {
      id: crypto.randomUUID(),
      emp_id: employee.id,
      emp_code: employee.emp_code,
      emp_name: employee.name,
      attendance_type: attendanceType,
      date: today,
      time: currentTime,
      latitude: location?.latitude || null,
      longitude: location?.longitude || null,
      photo: photo,
      sync_status: 'PENDING',
      created_at: new Date().toISOString()
    }

    await attendanceDB.save(attendanceRecord)
    
    // Update employee status
    const newNextType = attendanceType === ATTENDANCE_TYPE.CHECK_IN 
      ? ATTENDANCE_TYPE.CHECK_OUT 
      : ATTENDANCE_TYPE.CHECK_IN
    
    setEmployeeStatus(prev => ({
      ...prev,
      [employee.id]: {
        lastTime: Date.now(),
        nextType: newNextType,
        totalIn: empStatus.totalIn + (attendanceType === ATTENDANCE_TYPE.CHECK_IN ? 1 : 0),
        totalOut: empStatus.totalOut + (attendanceType === ATTENDANCE_TYPE.CHECK_OUT ? 1 : 0)
      }
    }))

    if (navigator.onLine) {
      checkAndSync()
    }

    // Reset for next person
    currentMatchRef.current = null
    livenessDetectorRef.current = null

    // Cooldown before scanning again
    await sleep(SUCCESS_COOLDOWN)
    
    setMatchedEmployee(null)
    setStatus('scanning')
    setMessage('📷 Scanning for faces...')
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  return (
    <div className="pb-20">
      <div className="text-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Auto Attendance</h2>
        <p className="text-gray-500 text-sm mt-1">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-center text-sm text-blue-700">
        Auto Mode: 🟢 IN → 🔴 OUT → 🟢 IN → 🔴 OUT (5 min gap)
      </div>

      <div className="relative bg-black rounded-xl overflow-hidden shadow-lg aspect-[4/3]">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover transform scale-x-[-1]"
        />

        {/* Refresh employee list button */}
        <button
          onClick={handleManualRefresh}
          disabled={!navigator.onLine || refreshing}
          title={navigator.onLine ? 'Refresh employee list' : 'Offline — cannot refresh'}
          className="absolute top-2 right-2 z-10 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
        </button>
        
        {/* Scanning overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {status === 'scanning' && (
            <div className="absolute inset-4 border-2 border-blue-400 rounded-lg animate-pulse" />
          )}
          {status === 'blink_check' && (
            <div className="absolute inset-4 border-2 border-yellow-400 rounded-lg">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-yellow-400 text-black px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                <Eye className="w-4 h-4" />
                Blink Now!
              </div>
            </div>
          )}
          {status === 'success' && (
            <div className="absolute inset-4 border-4 border-green-500 rounded-lg bg-green-500/20" />
          )}
          {status === 'already_marked' && (
            <div className="absolute inset-4 border-2 border-gray-400 rounded-lg bg-gray-500/20" />
          )}
        </div>
      </div>

      {/* Status message */}
      <div className={`mt-4 p-4 rounded-lg text-center ${
        status === 'success' ? 'bg-green-100 text-green-700' :
        status === 'too_soon' ? 'bg-orange-100 text-orange-700' :
        status === 'blink_check' ? 'bg-yellow-100 text-yellow-700' :
        status === 'error' ? 'bg-red-100 text-red-700' :
        'bg-blue-100 text-blue-700'
      }`}>
        <div className="flex items-center justify-center gap-2">
          {status === 'success' && <CheckCircle className="w-5 h-5" />}
          {status === 'already_marked' && <CheckCircle className="w-5 h-5" />}
          {status === 'blink_check' && <Eye className="w-5 h-5 animate-bounce" />}
          {status === 'scanning' && <Scan className="w-5 h-5 animate-pulse" />}
          {status === 'loading' && <Loader2 className="w-5 h-5 animate-spin" />}
          {status === 'error' && <XCircle className="w-5 h-5" />}
          <span className="font-medium">{message}</span>
        </div>
      </div>

      {/* Matched employee card */}
      {matchedEmployee && (
        <div className={`mt-4 p-4 rounded-lg shadow border ${
          status === 'success' ? 'bg-green-50 border-green-200' :
          status === 'already_marked' ? 'bg-gray-50 border-gray-200' :
          'bg-white'
        }`}>
          <p className="font-semibold text-gray-800 text-lg">{matchedEmployee.name}</p>
          <p className="text-sm text-gray-500">{matchedEmployee.emp_code} • {matchedEmployee.department || 'N/A'}</p>
        </div>
      )}

      {/* Location indicator */}
      {location && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
          <MapPin className="w-4 h-4" />
          <span>Location captured</span>
        </div>
      )}

      {/* Today's totals */}
      <div className="mt-6 flex justify-center gap-6 text-sm">
        <div className="text-center">
          <span className="text-green-600 font-semibold text-lg">
            {Object.values(employeeStatus).reduce((sum, s) => sum + s.totalIn, 0)}
          </span>
          <p className="text-gray-500">Total IN</p>
        </div>
        <div className="text-center">
          <span className="text-red-600 font-semibold text-lg">
            {Object.values(employeeStatus).reduce((sum, s) => sum + s.totalOut, 0)}
          </span>
          <p className="text-gray-500">Total OUT</p>
        </div>
        <div className="text-center">
          <span className="text-blue-600 font-semibold text-lg">
            {Object.keys(employeeStatus).length}
          </span>
          <p className="text-gray-500">Employees</p>
        </div>
      </div>
    </div>
  )
}
