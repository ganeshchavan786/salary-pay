import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock localStorage
global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

// Mock window.location
delete window.location
window.location = { href: '', reload: vi.fn() }
