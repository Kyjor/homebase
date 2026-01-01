import React, { useState, useEffect } from 'react';

const DebugPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [errors, setErrors] = useState<any[]>([]);

  useEffect(() => {
    // Check for stored errors
    const checkErrors = () => {
      const errorList: any[] = [];
      
      if ((window as any).lastError) {
        errorList.push({ type: 'React Error Boundary', ...(window as any).lastError });
      }
      if ((window as any).lastGlobalError) {
        errorList.push({ type: 'Global Error', ...(window as any).lastGlobalError });
      }
      if ((window as any).lastUnhandledRejection) {
        errorList.push({ type: 'Unhandled Promise Rejection', ...(window as any).lastUnhandledRejection });
      }
      
      setErrors(errorList);
    };

    checkErrors();
    const interval = setInterval(checkErrors, 1000);
    return () => clearInterval(interval);
  }, []);

  if (errors.length === 0 && !isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 10000,
      background: errors.length > 0 ? '#dc2626' : '#6366f1',
      color: '#fff',
      padding: '8px 12px',
      fontSize: 12,
      fontFamily: 'monospace',
      maxHeight: isOpen ? '50vh' : 'auto',
      overflow: 'auto',
      boxShadow: '0 -2px 8px rgba(0,0,0,0.2)'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: isOpen ? 8 : 0
      }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 600
          }}
        >
          {errors.length > 0 ? `⚠️ ${errors.length} Error(s)` : '🐛 Debug'}
          {isOpen ? ' ▼' : ' ▲'}
        </button>
        {errors.length > 0 && (
          <button
            onClick={() => {
              delete (window as any).lastError;
              delete (window as any).lastGlobalError;
              delete (window as any).lastUnhandledRejection;
              setErrors([]);
            }}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: '#fff',
              padding: '4px 8px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 11
            }}
          >
            Clear
          </button>
        )}
      </div>
      
      {isOpen && (
        <div style={{ marginTop: 8 }}>
          {errors.length === 0 ? (
            <div style={{ padding: '8px 0', fontSize: 11 }}>
              No errors detected. Check console for logs.
            </div>
          ) : (
            errors.map((error, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(0,0,0,0.2)',
                  padding: 8,
                  borderRadius: 4,
                  marginBottom: 8,
                  fontSize: 11,
                  wordBreak: 'break-word'
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  {error.type} ({error.timestamp ? new Date(error.timestamp).toLocaleTimeString() : 'Unknown time'})
                </div>
                <div style={{ marginBottom: 4 }}>
                  {error.error || error.reason || 'No error message'}
                </div>
                {error.stack && (
                  <details style={{ marginTop: 4 }}>
                    <summary style={{ cursor: 'pointer', fontSize: 10, opacity: 0.8 }}>
                      Stack Trace
                    </summary>
                    <pre style={{
                      marginTop: 4,
                      fontSize: 9,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxHeight: 100,
                      overflow: 'auto'
                    }}>
                      {error.stack}
                    </pre>
                  </details>
                )}
              </div>
            ))
          )}
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.2)', fontSize: 10, opacity: 0.8 }}>
            Check window.lastError, window.lastGlobalError, or window.lastUnhandledRejection in console
          </div>
        </div>
      )}
    </div>
  );
};

export default DebugPanel;

