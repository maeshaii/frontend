import React, { useEffect, useState } from 'react';
import { toast, Toast as ToastType } from '../utils/toast';
import './Toast.css';

const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastType[]>([]);

  useEffect(() => {
    const unsubscribe = toast.subscribe((newToasts) => {
      console.log('🔔 [TOAST CONTAINER] Received toasts update:', newToasts.length, newToasts);
      setToasts(newToasts);
    });
    
    // Expose toast test function to window for debugging
    if (process.env.NODE_ENV === 'development') {
      (window as any).testToast = () => {
        console.log('🧪 Testing toast system...');
        toast.success('Test toast notification! This is a test.', 5000);
      };
    }
    
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (toasts.length > 0) {
      console.log('🔔 [TOAST CONTAINER] Rendering toasts:', toasts.length);
    }
  }, [toasts]);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" style={{ zIndex: 10000 }}>
      {toasts.map(toastItem => {
        console.log('🔔 [TOAST CONTAINER] Rendering toast item:', toastItem);
        return (
        <div
          key={toastItem.id}
          className={`toast toast-${toastItem.type}`}
          onClick={() => toast.remove(toastItem.id)}
          style={{ zIndex: 10001 }}
        >
          <div className="toast-content">
            <div className="toast-icon">
              {toastItem.type === 'success' && '✓'}
              {toastItem.type === 'error' && '✕'}
              {toastItem.type === 'warning' && '⚠'}
              {toastItem.type === 'info' && 'ℹ'}
            </div>
            <div className="toast-message">{toastItem.message}</div>
          </div>
          <button
            className="toast-close"
            onClick={(e) => {
              e.stopPropagation();
              toast.remove(toastItem.id);
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        );
      })}
    </div>
  );
};

export default ToastContainer;

