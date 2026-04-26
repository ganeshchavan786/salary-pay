import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { 
  Camera, CheckCircle, XCircle, Loader2, 
  ArrowLeft, RefreshCw, Save 
} from 'lucide-react'
import * as faceapi from 'face-api.js'
import { employeeApi } from '../services/api'

const MIN_SAMPLES = 5
const MAX_SAMPLES = 10

export default function FaceEnrollment() {
  const { id } = useParams()
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  
  const [employee, setEmployee] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [samples, setSamples] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadEmployee()
    loadModels()
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [id])

  async function loadEmployee() {
    try {
      const response = await employeeApi.getById(id)
      setEmployee(response.data)
    } catch (error) {
      setError('Employee not found')
    } finally {
      setLoading(false)
    }
  }

  async function loadModels() {
    try {
      const MODEL_URL = '/models'
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ])
      setModelsLoaded(true)
      await startCamera()
    } catch (error) {
      setError('Failed to load face recognition models. Make sure models are in public/models folder.')
    }
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          setCameraReady(true)
        }
      }
    } catch (error) {
      setError('Camera access denied. Please allow camera permission.')
    }
  }

  async function captureSample() {
    if (!cameraReady || capturing || samples.length >= MAX_SAMPLES) return
    
    setCapturing(true)
    setError('')

    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current)
        .withFaceLandmarks()
        .withFaceDescriptor()

      if (!detection) {
        setError('No face detected. Please position your face clearly.')
        setCapturing(false)
        return
      }

      const descriptor = Array.from(detection.descriptor)
      
      // Capture thumbnail
      const canvas = document.createElement('canvas')
      canvas.width = 100
      canvas.height = 100
      const ctx = canvas.getContext('2d')
      
      const video = videoRef.current
      const size = Math.min(video.videoWidth, video.videoHeight)
      const x = (video.videoWidth - size) / 2
      const y = (video.videoHeight - size) / 2
      
      ctx.drawImage(video, x, y, size, size, 0, 0, 100, 100)
      const thumbnail = canvas.toDataURL('image/jpeg', 0.7)

      setSamples(prev => [...prev, { descriptor, thumbnail }])
      setSuccess(`Sample ${samples.length + 1} captured!`)
      setTimeout(() => setSuccess(''), 1500)

    } catch (error) {
      setError('Failed to capture face. Please try again.')
    } finally {
      setCapturing(false)
    }
  }

  function removeSample(index) {
    setSamples(prev => prev.filter((_, i) => i !== index))
  }

  function resetSamples() {
    setSamples([])
    setError('')
    setSuccess('')
  }

  async function handleEnroll() {
    if (samples.length < MIN_SAMPLES) {
      setError(`Minimum ${MIN_SAMPLES} samples required. You have ${samples.length}.`)
      return
    }

    setSaving(true)
    setError('')

    try {
      const descriptors = samples.map(s => s.descriptor)
      await employeeApi.enrollFace(id, descriptors)
      setSuccess('Face enrolled successfully!')
      
      setTimeout(() => {
        navigate('/employees')
      }, 2000)
    } catch (error) {
      const detail = error.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Failed to enroll face')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">Employee not found</p>
        <Link to="/employees" className="text-primary-600 hover:underline">
          Back to Employees
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <Link to="/employees" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Employees
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">Face Enrollment</h1>
        <p className="text-gray-500">
          Enrolling face for <span className="font-medium">{employee.name}</span> ({employee.emp_code})
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Camera Section */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Camera</h2>
          
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="camera-video w-full h-full object-cover"
            />
            
            {!modelsLoaded && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                <div className="text-center text-white">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                  <p>Loading face models...</p>
                </div>
              </div>
            )}
            
            {capturing && (
              <div className="absolute inset-0 bg-white/30 flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-primary-600 animate-spin" />
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 bg-green-50 text-green-600 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              {success}
            </div>
          )}

          <div className="mt-4 flex gap-3">
            <button
              onClick={captureSample}
              disabled={!cameraReady || capturing || samples.length >= MAX_SAMPLES}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Camera className="w-5 h-5" />
              Capture ({samples.length}/{MAX_SAMPLES})
            </button>
            <button
              onClick={resetSamples}
              disabled={samples.length === 0}
              className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          <p className="mt-3 text-sm text-gray-500 text-center">
            Capture {MIN_SAMPLES}-{MAX_SAMPLES} face samples from different angles
          </p>
        </div>

        {/* Samples Section */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-gray-800 mb-4">
            Captured Samples ({samples.length}/{MIN_SAMPLES} minimum)
          </h2>

          {samples.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Camera className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No samples captured yet</p>
              <p className="text-sm mt-1">Click "Capture" to take face samples</p>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-2 mb-6">
              {samples.map((sample, index) => (
                <div key={index} className="relative group">
                  <img
                    src={sample.thumbnail}
                    alt={`Sample ${index + 1}`}
                    className="w-full aspect-square object-cover rounded-lg border"
                  />
                  <button
                    onClick={() => removeSample(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                  <span className="absolute bottom-1 left-1 text-xs bg-black/50 text-white px-1 rounded">
                    {index + 1}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="border-t pt-4">
            <h3 className="font-medium text-gray-800 mb-2">Instructions:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Look directly at the camera</li>
              <li>• Capture from slightly different angles</li>
              <li>• Ensure good lighting</li>
              <li>• Remove glasses if possible</li>
              <li>• Minimum {MIN_SAMPLES} samples required</li>
            </ul>
          </div>

          <button
            onClick={handleEnroll}
            disabled={samples.length < MIN_SAMPLES || saving}
            className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Enrolling...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Enroll Face ({samples.length} samples)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
