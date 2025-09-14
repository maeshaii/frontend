import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const TemporaryPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [tempPassword, setTempPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Get data from navigation state
    if (location.state?.tempPassword && location.state?.userName) {
      setTempPassword(location.state.tempPassword);
      setUserName(location.state.userName);
    } else {
      // If no data, redirect back to login
      navigate('/login');
    }
  }, [location.state, navigate]);

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy password:', err);
    }
  };

  const handleGoToLogin = () => {
    navigate('/login');
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button 
          onClick={() => navigate('/forgot-password')}
          style={styles.backButton}
        >
          ←
        </button>
        <h1 style={styles.title}>Temporary Password</h1>
      </div>

      <div style={styles.content}>
        <div style={styles.passwordContainer}>
          <p style={styles.instruction}>
            Your temporary password is <strong>{tempPassword}</strong> please copy this then log in
          </p>
          
          <div style={styles.passwordBox}>
            <span style={styles.passwordText}>{tempPassword}</span>
            <button 
              onClick={handleCopyPassword}
              style={styles.copyButton}
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div style={styles.warningBox}>
          <p style={styles.warningText}>
            <strong>Important:</strong> Please change your password after logging in for security reasons.
          </p>
        </div>

        <button 
          onClick={handleGoToLogin}
          style={styles.confirmButton}
        >
          Go to Login
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#1e3a8a',
    color: 'white',
    fontFamily: 'Arial, sans-serif',
    padding: 20,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 30,
    maxWidth: 600,
    margin: '0 auto 30px auto',
  },
  backButton: {
    background: 'none',
    border: 'none',
    color: 'white',
    fontSize: '1.5rem',
    cursor: 'pointer',
    marginRight: 15,
    padding: 5,
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    margin: 0,
  },
  content: {
    maxWidth: 600,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  passwordContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 30,
    color: '#333',
    textAlign: 'center',
  },
  instruction: {
    fontSize: '1rem',
    marginBottom: 20,
    lineHeight: 1.5,
  },
  passwordBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    border: '2px solid #e9ecef',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
  },
  passwordText: {
    fontSize: '1.2rem',
    fontWeight: 'bold',
    color: '#1e3a8a',
    fontFamily: 'monospace',
    letterSpacing: '1px',
  },
  copyButton: {
    backgroundColor: '#1e3a8a',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    padding: '8px 16px',
    fontSize: '0.9rem',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  warningBox: {
    backgroundColor: '#fff3cd',
    border: '1px solid #ffeaa7',
    borderRadius: 8,
    padding: 15,
    color: '#856404',
  },
  warningText: {
    margin: 0,
    fontSize: '0.9rem',
    lineHeight: 1.4,
  },
  confirmButton: {
    backgroundColor: 'white',
    color: '#1e3a8a',
    border: 'none',
    borderRadius: 8,
    padding: 15,
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
    alignSelf: 'center',
    minWidth: 150,
  },
};

export default TemporaryPassword;
