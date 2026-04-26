import { Component } from 'react'
import { RefreshCw } from 'lucide-react'

/**
 * ErrorBoundary — catches unhandled render/lifecycle errors in child components.
 * Prevents white screen by showing a fallback UI with a retry button.
 *
 * Props:
 *   title       — heading shown in fallback UI
 *   description — subtext shown in fallback UI
 *   fallback    — custom fallback element (overrides default UI)
 *   onReset     — optional callback when user clicks "Try Again"
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
    this.handleReset = this.handleReset.bind(this)
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught error:', error)
    console.error('[ErrorBoundary] Component stack:', info.componentStack)
    
    // Automatically send crash log to the backend
    try {
      fetch('https://drne2yi2f6fd.share.zrok.io/api/debug/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: error.message,
          stack: error.stack,
          componentStack: info.componentStack
        })
      }).catch(e => console.error("Failed to send crash log", e))
    } catch (e) {}
  }

  handleReset() {
    this.setState({ hasError: false, error: null })
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="min-h-[200px] flex flex-col items-center justify-center p-6 text-center bg-red-50 rounded-xl">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">
            {this.props.title || 'Something went wrong'}
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            {this.props.description || 'An unexpected error occurred. Please try again.'}
          </p>
          <div className="w-full text-left bg-white p-3 rounded border border-red-100 mb-4 overflow-auto max-h-32 text-xs font-mono text-red-600">
            <strong>{this.state.error && this.state.error.toString()}</strong>
            <br />
            {this.state.error && this.state.error.stack}
          </div>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <RefreshCw size={14} />
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
