import { describe, it, expect, beforeEach } from 'vitest'
import { LivenessDetector, areEyesClosed } from '../livenessService'

// Helper: build fake landmarks with given EAR and head direction
function makeLandmarks({ leftEAR = 0.35, rightEAR = 0.35, noseOffset = 0 } = {}) {
  // We need 68 landmark positions
  // EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
  // To get EAR = X with horizontal = 1:
  //   X = (v1 + v2) / (2 * 1)  →  v1 = v2 = X
  // So set p2 at (0, X), p6 at (0, 0) → ||p2-p6|| = X
  //    set p3 at (0, X), p5 at (0, 0) → ||p3-p5|| = X
  //    set p1 at (0, 0), p4 at (1, 0) → ||p1-p4|| = 1
  const positions = Array.from({ length: 68 }, () => ({ x: 0, y: 0 }))

  // Left eye (36-41): p1=36, p2=37, p3=38, p4=39, p5=40, p6=41
  positions[36] = { x: 0, y: 0 }          // p1
  positions[37] = { x: 0, y: leftEAR }    // p2 — vertical distance from p6
  positions[38] = { x: 0, y: leftEAR }    // p3 — vertical distance from p5
  positions[39] = { x: 1, y: 0 }          // p4 — horizontal endpoint
  positions[40] = { x: 0, y: 0 }          // p5
  positions[41] = { x: 0, y: 0 }          // p6

  // Right eye (42-47): same pattern
  positions[42] = { x: 0, y: 0 }
  positions[43] = { x: 0, y: rightEAR }
  positions[44] = { x: 0, y: rightEAR }
  positions[45] = { x: 1, y: 0 }
  positions[46] = { x: 0, y: 0 }
  positions[47] = { x: 0, y: 0 }

  // Head turn: left eye outer=36 (x=0), right eye outer=45 (x=1), nose=30
  // eyeCenterX = (0 + 1) / 2 = 0.5, eyeWidth = 1
  // normalizedOffset = (noseTip.x - 0.5) / 1
  // LEFT:  noseTip.x < 0.5 - 0.12 → noseTip.x < 0.38
  // RIGHT: noseTip.x > 0.5 + 0.12 → noseTip.x > 0.62
  positions[30] = { x: 0.5 + noseOffset, y: 0 }

  return { positions }
}

describe('LivenessDetector', () => {
  let detector

  beforeEach(() => {
    detector = new LivenessDetector()
  })

  it('initializes with correct defaults', () => {
    expect(detector.blinkCount).toBe(0)
    expect(detector.eyesWereClosed).toBe(false)
    expect(detector.isComplete).toBe(false)
    expect(detector.turnFrameCount).toBe(0)
    expect(detector.REQUIRED_TURN_FRAMES).toBe(5)
    expect(['BLINK', 'TURN_LEFT', 'TURN_RIGHT']).toContain(detector.challengeType)
  })

  it('reset() clears all state including turnFrameCount', () => {
    detector.blinkCount = 3
    detector.turnFrameCount = 4
    detector.isComplete = true
    detector.eyesWereClosed = true
    detector.reset()
    expect(detector.blinkCount).toBe(0)
    expect(detector.turnFrameCount).toBe(0)
    expect(detector.isComplete).toBe(false)
    expect(detector.eyesWereClosed).toBe(false)
  })

  it('BLINK challenge: completes after open→close→open sequence', () => {
    detector.challengeType = 'BLINK'
    detector.challengeComplete = false

    // Eyes open
    const openLandmarks = makeLandmarks({ leftEAR: 0.35, rightEAR: 0.35 })
    detector.processFrame(openLandmarks)
    expect(detector.isComplete).toBe(false)

    // Eyes closed (EAR < 0.27)
    const closedLandmarks = makeLandmarks({ leftEAR: 0.15, rightEAR: 0.15 })
    detector.processFrame(closedLandmarks)
    expect(detector.eyesWereClosed).toBe(true)
    expect(detector.isComplete).toBe(false)

    // Eyes open again → blink complete
    detector.processFrame(openLandmarks)
    expect(detector.blinkCount).toBe(1)
    expect(detector.isComplete).toBe(true)
  })

  it('TURN_LEFT challenge: does NOT complete on fewer than 5 consecutive frames', () => {
    detector.challengeType = 'TURN_LEFT'
    const leftLandmarks = makeLandmarks({ noseOffset: -0.2 }) // nose at 0.3 → LEFT

    for (let i = 0; i < 4; i++) {
      detector.processFrame(leftLandmarks)
    }
    expect(detector.turnFrameCount).toBe(4)
    expect(detector.isComplete).toBe(false)
  })

  it('TURN_LEFT challenge: completes after exactly 5 consecutive frames', () => {
    detector.challengeType = 'TURN_LEFT'
    const leftLandmarks = makeLandmarks({ noseOffset: -0.2 })

    for (let i = 0; i < 5; i++) {
      detector.processFrame(leftLandmarks)
    }
    expect(detector.turnFrameCount).toBe(5)
    expect(detector.isComplete).toBe(true)
  })

  it('TURN_LEFT challenge: resets counter when direction is lost', () => {
    detector.challengeType = 'TURN_LEFT'
    const leftLandmarks = makeLandmarks({ noseOffset: -0.2 })
    const centerLandmarks = makeLandmarks({ noseOffset: 0 })

    // 3 frames left
    for (let i = 0; i < 3; i++) detector.processFrame(leftLandmarks)
    expect(detector.turnFrameCount).toBe(3)

    // 1 frame center → reset
    detector.processFrame(centerLandmarks)
    expect(detector.turnFrameCount).toBe(0)
    expect(detector.isComplete).toBe(false)

    // 5 more frames left → now completes
    for (let i = 0; i < 5; i++) detector.processFrame(leftLandmarks)
    expect(detector.isComplete).toBe(true)
  })

  it('TURN_RIGHT challenge: completes after 5 consecutive right frames', () => {
    detector.challengeType = 'TURN_RIGHT'
    const rightLandmarks = makeLandmarks({ noseOffset: 0.2 }) // nose at 0.7 → RIGHT

    for (let i = 0; i < 5; i++) {
      detector.processFrame(rightLandmarks)
    }
    expect(detector.isComplete).toBe(true)
  })

  it('getStatus() returns correct shape', () => {
    const status = detector.getStatus()
    expect(status).toHaveProperty('challenge')
    expect(status).toHaveProperty('blinkCount')
    expect(status).toHaveProperty('requiredBlinks')
    expect(status).toHaveProperty('isComplete')
  })
})

describe('areEyesClosed', () => {
  it('returns true when EAR is below threshold', () => {
    const landmarks = makeLandmarks({ leftEAR: 0.15, rightEAR: 0.15 })
    expect(areEyesClosed(landmarks)).toBe(true)
  })

  it('returns false when EAR is above threshold', () => {
    const landmarks = makeLandmarks({ leftEAR: 0.35, rightEAR: 0.35 })
    expect(areEyesClosed(landmarks)).toBe(false)
  })
})
