/**
 * ErrorBoundary.tsx
 *
 * Catches uncaught render errors anywhere in the component tree and
 * shows a recovery screen instead of a blank white page.
 *
 * Usage — wrap your App and high-risk pages:
 *
 *   // In index.tsx:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 *
 *   // Optionally also around individual routes:
 *   <ErrorBoundary>
 *     <BrowsePage />
 *   </ErrorBoundary>
 */

import React from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  errorMessage: string
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || 'Unknown error' }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console — PostHog/Sentry can be added here
    console.error('[ErrorBoundary] Caught render error:', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return <>{this.props.fallback}</>

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F8F6F1',
          padding: 24,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🍺</div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1A1612', marginBottom: 8 }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: 14, color: '#888', maxWidth: 320, marginBottom: 24, lineHeight: 1.5 }}>
            An unexpected error occurred. Your favorites and data are safe — this is just a display issue.
          </p>
          <button
            onClick={this.handleReset}
            style={{
              background: '#E85D1A',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '12px 28px',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Go back home
          </button>
          {process.env.NODE_ENV === 'development' && (
            <details style={{ marginTop: 24, fontSize: 11, color: '#aaa', maxWidth: 500, textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer' }}>Error details (dev only)</summary>
              <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {this.state.errorMessage}
              </pre>
            </details>
          )}
        </div>
      )
    }

    return this.props.children
  }
}
