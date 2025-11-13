import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Global error handlers for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  // Check if it's a WebSocket connection error
  const errorMessage = event.reason?.message || String(event.reason);
  
  if (errorMessage.includes('WebSocket') || errorMessage.includes('WebSocketConnectionError')) {
    // Suppress WebSocket errors from showing in the UI
    // They're expected when the backend is not running
    console.warn('Suppressed unhandled promise rejection (WebSocket):', errorMessage);
    event.preventDefault(); // Prevent the error from being logged to console
    return;
  }
  
  // For other errors, log them but don't crash the app
  console.error('Unhandled promise rejection:', event.reason);
  event.preventDefault(); // Prevent default browser behavior
});

// Global error handler for synchronous errors
window.addEventListener('error', (event) => {
  const errorMessage = event.message || String(event.error);
  
  if (errorMessage.includes('WebSocket') || event.error?.name === 'WebSocketConnectionError') {
    // Suppress WebSocket errors from showing in the UI
    console.warn('Suppressed error (WebSocket):', errorMessage);
    event.preventDefault(); // Prevent the error from being logged to console
    return;
  }
  
  // For other errors, log them but don't crash the app
  console.error('Unhandled error:', event.error);
  event.preventDefault(); // Prevent default browser behavior
});

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
