import * as faceapi from 'face-api.js'

// Eye Aspect Ratio (EAR) threshold for blink detection
// Higher threshold = easier to detect blink (less strict)
const EAR_THRESHOLD = 0.27
const HEAD_TURN_THRESHOLD = 0.12
const DEBUG = false

// Calculate Eye Aspect Ratio from landmarks
function calculateEAR(eye) {
  // eye is array of 6 points
  // EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
  const p1 = eye[0]
  const p2 = eye[1]
  const p3 = eye[2]
  const p4 = eye[3]
  const p5 = eye[4]
  const p6 = eye[5]

  const vertical1 = Math.sqrt(Math.pow(p2.x - p6.x, 2) + Math.pow(p2.y - p6.y, 2))
  const vertical2 = Math.sqrt(Math.pow(p3.x - p5.x, 2) + Math.pow(p3.y - p5.y, 2))
  const horizontal = Math.sqrt(Math.pow(p1.x - p4.x, 2) + Math.pow(p1.y - p4.y, 2))

  if (horizontal === 0) return 0.3
  return (vertical1 + vertical2) / (2.0 * horizontal)
}

// Get eye landmarks from face landmarks
function getEyeLandmarks(landmarks) {
  const positions = landmarks.positions
  
  // Left eye: points 36-41
  const leftEye = [
    positions[36], positions[37], positions[38],
    positions[39], positions[40], positions[41]
  ]
  
  // Right eye: points 42-47
  const rightEye = [
    positions[42], positions[43], positions[44],
    positions[45], positions[46], positions[47]
  ]
  
  return { leftEye, rightEye }
}

function detectHeadTurn(landmarks) {
  const positions = landmarks.positions
  const leftEyeOuter = positions[36]
  const rightEyeOuter = positions[45]
  const noseTip = positions[30]
  const eyeCenterX = (leftEyeOuter.x + rightEyeOuter.x) / 2
  const eyeWidth = Math.abs(rightEyeOuter.x - leftEyeOuter.x)
  if (!eyeWidth) return 'CENTER'

  const normalizedOffset = (noseTip.x - eyeCenterX) / eyeWidth
  if (normalizedOffset <= -HEAD_TURN_THRESHOLD) return 'LEFT'
  if (normalizedOffset >= HEAD_TURN_THRESHOLD) return 'RIGHT'
  return 'CENTER'
}

// Check if eyes are closed (blink)
export function areEyesClosed(landmarks) {
  const { leftEye, rightEye } = getEyeLandmarks(landmarks)
  
  const leftEAR = calculateEAR(leftEye)
  const rightEAR = calculateEAR(rightEye)
  const avgEAR = (leftEAR + rightEAR) / 2
  
  if (DEBUG) {
    console.log(`EAR: ${avgEAR.toFixed(3)} | Threshold: ${EAR_THRESHOLD} | Closed: ${avgEAR < EAR_THRESHOLD}`)
  }
  
  return avgEAR < EAR_THRESHOLD
}

// Liveness detection class
export class LivenessDetector {
  constructor() {
    this.blinkCount = 0
    this.eyesWereClosed = false
    this.isComplete = false
    this.requiredBlinks = 1
    this.challengeType = this.pickChallenge()
    this.challengeComplete = false
    this.turnFrameCount = 0
    this.REQUIRED_TURN_FRAMES = 5
  }

  reset() {
    this.blinkCount = 0
    this.eyesWereClosed = false
    this.isComplete = false
    this.challengeType = this.pickChallenge()
    this.challengeComplete = false
    this.turnFrameCount = 0
  }

  pickChallenge() {
    const challenges = ['BLINK', 'TURN_LEFT', 'TURN_RIGHT']
    return challenges[Math.floor(Math.random() * challenges.length)]
  }

  // Process a frame and check for selected liveness challenge
  processFrame(landmarks) {
    if (this.isComplete) return true
    const headDirection = detectHeadTurn(landmarks)

    const eyesClosed = areEyesClosed(landmarks)

    // Detect blink: eyes were open -> closed -> open
    if (eyesClosed && !this.eyesWereClosed) {
      this.eyesWereClosed = true
      if (DEBUG) console.log('👁️ Eyes CLOSED detected')
    } else if (!eyesClosed && this.eyesWereClosed) {
      // Blink completed
      this.blinkCount++
      this.eyesWereClosed = false
      if (DEBUG) console.log(`✅ BLINK COMPLETE! Count: ${this.blinkCount}`)
      
      if (this.blinkCount >= this.requiredBlinks) {
        this.challengeComplete = true
      }
    }

    if (this.challengeType === 'TURN_LEFT') {
      if (headDirection === 'LEFT') {
        this.turnFrameCount++
        if (this.turnFrameCount >= this.REQUIRED_TURN_FRAMES) {
          this.challengeComplete = true
        }
      } else {
        this.turnFrameCount = 0
      }
    }
    if (this.challengeType === 'TURN_RIGHT') {
      if (headDirection === 'RIGHT') {
        this.turnFrameCount++
        if (this.turnFrameCount >= this.REQUIRED_TURN_FRAMES) {
          this.challengeComplete = true
        }
      } else {
        this.turnFrameCount = 0
      }
    }
    if (this.challengeType === 'BLINK' && this.challengeComplete) {
      this.isComplete = true
    } else if (
      (this.challengeType === 'TURN_LEFT' || this.challengeType === 'TURN_RIGHT') &&
      this.challengeComplete
    ) {
      this.isComplete = true
    }

    if (this.isComplete && DEBUG) console.log('🎉 LIVENESS CHECK PASSED!')
    return this.isComplete
  }

  getStatus() {
    const challengeLabel =
      this.challengeType === 'BLINK' ? 'BLINK' :
      this.challengeType === 'TURN_LEFT' ? 'TURN_LEFT' :
      'TURN_RIGHT'

    return {
      challenge: challengeLabel,
      blinkCount: this.blinkCount,
      requiredBlinks: this.requiredBlinks,
      isComplete: this.isComplete
    }
  }
}

// Continuous liveness check with timeout
export async function performLivenessCheck(videoElement, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const detector = new LivenessDetector()
    let frameCount = 0
    let animationId = null
    
    const timeout = setTimeout(() => {
      if (animationId) cancelAnimationFrame(animationId)
      reject(new Error('Liveness check timed out. Please blink your eyes.'))
    }, timeoutMs)

    async function checkFrame() {
      try {
        const detection = await faceapi
          .detectSingleFace(videoElement)
          .withFaceLandmarks()

        if (detection) {
          const blinkDetected = detector.processFrame(detection.landmarks)
          
          if (blinkDetected) {
            clearTimeout(timeout)
            // Get face descriptor for matching
            const fullDetection = await faceapi
              .detectSingleFace(videoElement)
              .withFaceLandmarks()
              .withFaceDescriptor()
            
            resolve({
              success: true,
              detection: fullDetection,
              blinkCount: detector.blinkCount
            })
            return
          }
        }

        frameCount++
        animationId = requestAnimationFrame(checkFrame)
      } catch (error) {
        clearTimeout(timeout)
        reject(error)
      }
    }

    checkFrame()
  })
}
