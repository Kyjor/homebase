import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });
    
    // Log error to console for debugging
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#fef2f2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 12,
            padding: 32,
            maxWidth: 600,
            width: '100%',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
            border: '1px solid #fecaca'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 20
            }}>
              <span style={{ fontSize: 32 }}>⚠️</span>
              <h1 style={{
                margin: 0,
                color: '#dc2626',
                fontSize: 24,
                fontWeight: 600
              }}>
                Something went wrong
              </h1>
            </div>
            
            <p style={{
              color: '#6b7280',
              marginBottom: 24,
              lineHeight: 1.5
            }}>
              An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
            </p>

            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#dc2626',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                marginRight: 12,
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#b91c1c'}
              onMouseOut={(e) => e.currentTarget.style.background = '#dc2626'}
            >
              Refresh Page
            </button>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={{
                marginTop: 24,
                padding: 16,
                background: '#f9fafb',
                borderRadius: 8,
                border: '1px solid #e5e7eb'
              }}>
                <summary style={{
                  cursor: 'pointer',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: 8
                }}>
                  Error Details (Development)
                </summary>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: 14,
                  color: '#dc2626',
                  background: '#fef2f2',
                  padding: 12,
                  borderRadius: 4,
                  overflow: 'auto',
                  maxHeight: 200
                }}>
                  <div style={{ marginBottom: 8 }}>
                    <strong>Error:</strong> {this.state.error.toString()}
                  </div>
                  {this.state.errorInfo && (
                    <div>
                      <strong>Component Stack:</strong>
                      <pre style={{
                        margin: '8px 0 0 0',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}>
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 