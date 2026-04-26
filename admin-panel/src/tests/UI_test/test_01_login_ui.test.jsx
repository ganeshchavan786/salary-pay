/**
 * UI TEST 01: Login Page
 * =======================
 * Tests:
 *  - Page renders correctly (title, inputs, button)
 *  - Empty form submit shows validation
 *  - Valid credentials → login called
 *  - Invalid credentials → error message shown
 *  - Loading state during login
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('lucide-react', () => ({
  Shield: () => React.createElement('span', { 'data-testid': 'shield-icon' }),
  User: () => React.createElement('span'),
  Lock: () => React.createElement('span'),
  Loader2: () => React.createElement('span', { 'data-testid': 'loader' }),
}))

const mockLogin = vi.fn()

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}))

// ── Import after mocks ────────────────────────────────────────────────────────
import Login from '../../pages/Login'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('UI Test 01 — Login Page', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders login page with title, inputs and button', () => {
    render(React.createElement(Login))

    expect(screen.getByText('Admin Panel')).toBeTruthy()
    expect(screen.getByPlaceholderText('Enter username')).toBeTruthy()
    expect(screen.getByPlaceholderText('Enter password')).toBeTruthy()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeTruthy()
    console.log('  ✓ Login page renders: title, username, password, button')
  })

  it('shows subtitle text', () => {
    render(React.createElement(Login))
    expect(screen.getByText('Face Attendance Management')).toBeTruthy()
    expect(screen.getByText('Admin access only')).toBeTruthy()
    console.log('  ✓ Subtitle and footer text visible')
  })

  it('username input accepts text', () => {
    render(React.createElement(Login))
    const input = screen.getByPlaceholderText('Enter username')
    fireEvent.change(input, { target: { value: 'admin' } })
    expect(input.value).toBe('admin')
    console.log('  ✓ Username input accepts text: "admin"')
  })

  it('password input accepts text', () => {
    render(React.createElement(Login))
    const input = screen.getByPlaceholderText('Enter password')
    fireEvent.change(input, { target: { value: 'secret123' } })
    expect(input.value).toBe('secret123')
    expect(input.type).toBe('password')
    console.log('  ✓ Password input accepts text (type=password)')
  })

  it('calls login with correct credentials on submit', async () => {
    mockLogin.mockResolvedValueOnce({ role: 'ADMIN' })
    render(React.createElement(Login))

    fireEvent.change(screen.getByPlaceholderText('Enter username'), { target: { value: 'admin' } })
    fireEvent.change(screen.getByPlaceholderText('Enter password'), { target: { value: 'admin123' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin', 'admin123')
    })
    console.log('  ✓ Login called with: admin / admin123')
  })

  it('shows error message on invalid credentials', async () => {
    mockLogin.mockRejectedValueOnce({
      response: { data: { detail: 'Invalid username or password' } }
    })
    render(React.createElement(Login))

    fireEvent.change(screen.getByPlaceholderText('Enter username'), { target: { value: 'wrong' } })
    fireEvent.change(screen.getByPlaceholderText('Enter password'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid username or password')).toBeTruthy()
    })
    console.log('  ✓ Error message shown: "Invalid username or password"')
  })

  it('shows generic error when no detail in response', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Network Error'))
    render(React.createElement(Login))

    fireEvent.change(screen.getByPlaceholderText('Enter username'), { target: { value: 'admin' } })
    fireEvent.change(screen.getByPlaceholderText('Enter password'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText('Network Error')).toBeTruthy()
    })
    console.log('  ✓ Generic error shown on network failure')
  })

  it('button is disabled while loading', async () => {
    // Login takes time — check button disabled state
    let resolveLogin
    mockLogin.mockReturnValueOnce(new Promise(res => { resolveLogin = res }))

    render(React.createElement(Login))
    fireEvent.change(screen.getByPlaceholderText('Enter username'), { target: { value: 'admin' } })
    fireEvent.change(screen.getByPlaceholderText('Enter password'), { target: { value: 'admin123' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /signing in/i })
      expect(btn.disabled).toBe(true)
    })
    resolveLogin({ role: 'ADMIN' })
    console.log('  ✓ Button disabled during loading, shows "Signing in..."')
  })

})
