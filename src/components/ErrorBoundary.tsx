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
    console.error('=== ERROR CAUGHT BY BOUNDARY ===');
    console.error('Error:', error);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    console.error('Component Stack:', errorInfo.componentStack);
    console.error('================================');
    
    // Also log to window for mobile debugging
    if (typeof window !== 'undefined') {
      (window as any).lastError = {
        error: error.toString(),
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString()
      };
    }
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

            {this.state.error && (
              <details open style={{
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
                  marginBottom: 8,
                  fontSize: 16
                }}>
                  Error Details (Click to expand/collapse)
                </summary>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: 13,
                  color: '#dc2626',
                  background: '#fef2f2',
                  padding: 12,
                  borderRadius: 4,
                  overflow: 'auto',
                  maxHeight: 300,
                  wordBreak: 'break-word'
                }}>
                  <div style={{ marginBottom: 12, fontWeight: 600 }}>
                    <strong>Error Message:</strong>
                  </div>
                  <div style={{ marginBottom: 16, padding: '8px 12px', background: '#fff', borderRadius: 4 }}>
                    {this.state.error.toString()}
                  </div>
                  {this.state.error.stack && (
                    <>
                      <div style={{ marginBottom: 8, fontWeight: 600 }}>
                        <strong>Stack Trace:</strong>
                      </div>
                      <pre style={{
                        margin: '8px 0 0 0',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontSize: 11,
                        lineHeight: 1.4,
                        padding: '8px 12px',
                        background: '#fff',
                        borderRadius: 4
                      }}>
                        {this.state.error.stack}
                      </pre>
                    </>
                  )}
                  {this.state.errorInfo && (
                    <>
                      <div style={{ marginTop: 16, marginBottom: 8, fontWeight: 600 }}>
                        <strong>Component Stack:</strong>
                      </div>
                      <pre style={{
                        margin: '8px 0 0 0',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontSize: 11,
                        lineHeight: 1.4,
                        padding: '8px 12px',
                        background: '#fff',
                        borderRadius: 4
                      }}>
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </>
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