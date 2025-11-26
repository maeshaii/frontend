import React from 'react';
import ReactDOM from 'react-dom';

type ConfirmModalProps = {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title = 'Confirm',
  message,
  confirmText = 'Yes',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    margin: 0,
    padding: 0,
  };

  const modalStyle: React.CSSProperties = {
    background: 'white',
    borderRadius: 12,
    padding: '24px',
    width: '90%',
    maxWidth: 400,
    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
    maxHeight: '90vh',
    overflow: 'auto',
  };

  const titleStyle: React.CSSProperties = {
    margin: 0,
    marginBottom: 12,
    fontSize: 20,
    fontWeight: 600,
    color: '#1e4c7a',
    lineHeight: '1.4',
  };

  const messageStyle: React.CSSProperties = {
    margin: 0,
    marginBottom: 24,
    color: '#333',
    fontSize: 15,
    lineHeight: '1.5',
    wordWrap: 'break-word',
    overflowWrap: 'break-word',
  };

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  };

  const cancelBtn: React.CSSProperties = {
    background: '#e5e7eb',
    color: '#111827',
    padding: '10px 20px',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    transition: 'all 0.2s ease',
  };

  const confirmBtn: React.CSSProperties = {
    background: '#1e4c7a',
    color: 'white',
    padding: '10px 20px',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    transition: 'all 0.2s ease',
  };

  const modalContent = (
    <div 
      style={overlayStyle} 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="confirm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div style={modalStyle}>
        <h3 id="confirm-title" style={titleStyle}>{title}</h3>
        <p style={messageStyle}>{message}</p>
        <div style={actionsStyle}>
          <button 
            type="button" 
            onClick={onCancel} 
            style={cancelBtn}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#d1d5db';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#e5e7eb';
            }}
          >
            {cancelText}
          </button>
          <button 
            type="button" 
            onClick={onConfirm} 
            style={confirmBtn}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#1a3d6b';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#1e4c7a';
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default ConfirmModal;


