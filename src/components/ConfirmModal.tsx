import React from 'react';

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
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  };

  const modalStyle: React.CSSProperties = {
    background: 'white',
    borderRadius: 8,
    padding: 20,
    width: '90%',
    maxWidth: 360,
    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
  };

  const titleStyle: React.CSSProperties = {
    margin: 0,
    marginBottom: 8,
    fontSize: 18,
    color: '#1e4c7a',
  };

  const messageStyle: React.CSSProperties = {
    margin: 0,
    marginBottom: 16,
    color: '#333',
  };

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
  };

  const cancelBtn: React.CSSProperties = {
    background: '#e5e7eb',
    color: '#111827',
    padding: '8px 12px',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  };

  const confirmBtn: React.CSSProperties = {
    background: '#1e4c7a',
    color: 'white',
    padding: '8px 12px',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  };

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div style={modalStyle}>
        <h3 id="confirm-title" style={titleStyle}>{title}</h3>
        <p style={messageStyle}>{message}</p>
        <div style={actionsStyle}>
          <button type="button" onClick={onCancel} style={cancelBtn}>{cancelText}</button>
          <button type="button" onClick={onConfirm} style={confirmBtn}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;


