import * as faceapi from 'face-api.js'

let modelsLoaded = false

export async function loadModels() {
  if (modelsLoaded) return true
  
  const MODEL_URL = import.meta.env.BASE_URL + 'models'
  
  try {
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ])
    modelsLoaded = true
    console.log('Face-api models loaded successfully')
    return true
  } catch (error) {
    console.error('Error loading face-api models:', error)
    return false
  }
}

export async function detectFace(videoElement) {
  if (!modelsLoaded) {
    throw new Error('Models not loaded')
  }
  
  const detection = await faceapi
    .detectSingleFace(videoElement)
    .withFaceLandmarks()
    .withFaceDescriptor()
  
  return detection
}

export function euclideanDistance(descriptor1, descriptor2) {
  if (!descriptor1 || !descriptor2) return Infinity
  
  let sum = 0
  for (let i = 0; i < descriptor1.length; i++) {
    sum += Math.pow(descriptor1[i] - descriptor2[i], 2)
  }
  return Math.sqrt(sum)
}

export function findBestMatch(descriptor, employees, threshold = 0.6) {
  let bestMatch = null
  let bestDistance = Infinity
  
  for (const employee of employees) {
    if (!employee.face_descriptor) continue
    
    const distance = euclideanDistance(
      Array.from(descriptor),
      employee.face_descriptor
    )
    
    if (distance < bestDistance && distance < threshold) {
      bestDistance = distance
      bestMatch = employee
    }
  }
  
  return bestMatch ? { employee: bestMatch, distance: bestDistance } : null
}

export async function captureSnapshot(videoElement) {
  const canvas = document.createElement('canvas')
  canvas.width = videoElement.videoWidth
  canvas.height = videoElement.videoHeight
  
  const ctx = canvas.getContext('2d')
  ctx.drawImage(videoElement, 0, 0)
  
  return canvas.toDataURL('image/jpeg', 0.5)
}
