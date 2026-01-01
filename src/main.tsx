import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import "@ncdai/react-wheel-picker/style.css";

// Global error handlers for better debugging
window.addEventListener('error', (event) => {
  console.error('=== GLOBAL ERROR HANDLER ===');
  console.error('Error:', event.error);
  console.error('Message:', event.message);
  console.error('Filename:', event.filename);
  console.error('Line:', event.lineno);
  console.error('Column:', event.colno);
  console.error('============================');
  
  // Store error for debugging
  if (typeof window !== 'undefined') {
    (window as any).lastGlobalError = {
      error: event.error?.toString() || event.message,
      stack: event.error?.stack,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      timestamp: new Date().toISOString()
    };
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('=== UNHANDLED PROMISE REJECTION ===');
  console.error('Reason:', event.reason);
  console.error('====================================');
  
  // Store error for debugging
  if (typeof window !== 'undefined') {
    (window as any).lastUnhandledRejection = {
      reason: event.reason?.toString() || String(event.reason),
      stack: event.reason?.stack,
      timestamp: new Date().toISOString()
    };
  }
});

// Log when React fails to render
const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

try {
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (error) {
  console.error('=== ROOT RENDER ERROR ===');
  console.error('Error:', error);
  console.error('=========================');
  
  // Show error in DOM if root render fails
  const rootElement = document.getElementById("root");
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: system-ui; color: #dc2626;">
        <h1>⚠️ Critical Error</h1>
        <p>Failed to render application. Check console for details.</p>
        <pre style="background: #fef2f2; padding: 12px; border-radius: 4px; overflow: auto;">
          ${error instanceof Error ? error.toString() : String(error)}
        </pre>
        <p>Last error stored in window.lastError, window.lastGlobalError, or window.lastUnhandledRejection</p>
      </div>
    `;
  }
}
