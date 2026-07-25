import { Component } from 'react'

/**
 * Error boundary that catches Three.js/Canvas crashes
 * and shows a fallback instead of killing the entire app
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: '400px',
          gap: '16px',
          color: 'var(--color-text-secondary)',
        }}>
          <i className="bx bx-error-circle" style={{ fontSize: '48px', color: 'var(--color-warning)' }} />
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {this.props.fallbackTitle || 'Something went wrong'}
          </div>
          <div style={{ fontSize: 'var(--text-sm)', maxWidth: '400px', textAlign: 'center' }}>
            {this.props.fallbackMessage || 'This view encountered an error. Your data is safe — try another view.'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: '8px',
              padding: '8px 20px',
              background: 'var(--color-accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
