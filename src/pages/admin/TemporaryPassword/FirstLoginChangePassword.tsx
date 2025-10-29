import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { changePassword } from '../../../services/api';
import PasswordVisibilityIcon from '../../../components/PasswordVisibilityIcon';
import { validatePassword } from '../../../utils/passwordValidator';
import './FirstLoginChangePassword.css';

const FirstLoginChangePassword: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const username = (location.state as any)?.acc_username;

  const passwordValidation = useMemo(() => {
    return validatePassword(newPassword);
  }, [newPassword]);

  const canSubmit = passwordValidation.isValid && newPassword === confirmPassword && oldPassword.length > 0;

  const handlePasswordKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newPassword && !passwordValidation.isValid) {
      e.preventDefault();
      const missing = passwordValidation.missingRequirements;
      if (missing.length > 0) {
        alert(`Password requirements missing:\n• Need ${missing.join('\n• Need ')}`);
      }
    }
  };

  const handleConfirmKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (canSubmit && !isLoading) {
        handleSubmit();
      } else if (!passwordValidation.isValid) {
        const missing = passwordValidation.missingRequirements;
        if (missing.length > 0) {
          alert(`Password requirements missing:\n• Need ${missing.join('\n• Need ')}`);
        }
      } else if (newPassword !== confirmPassword) {
        alert('Passwords do not match. Please ensure both password fields match.');
      }
    }
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    if (!canSubmit) {
      if (!passwordValidation.isValid) {
        const missing = passwordValidation.missingRequirements;
        alert(`Password requirements missing:\n• Need ${missing.join('\n• Need ')}`);
      } else if (newPassword !== confirmPassword) {
        alert('Passwords do not match. Please ensure both password fields match.');
      }
      return;
    }

    setIsLoading(true);
    try {
      const resp = await changePassword(oldPassword, newPassword);
      if (resp.success) {
        setSuccess('Password changed. Please login again.');
        // Clear tokens to force fresh login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setTimeout(() => {
          setIsLoading(false);
          navigate('/login');
        }, 1000);
      } else {
        setIsLoading(false);
        setError(resp.message || 'Failed to change password');
      }
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Failed to change password');
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSubmit();
  };

  return (
    <div style={styles.container} className="first-login-container">
      <div style={styles.leftSection} className="first-login-left-section">
        <div style={styles.card} className="first-login-card">
        <div style={styles.headerRow}><button onClick={() => navigate('/login')} style={styles.backBtn}>←</button><h1 style={styles.title} className="first-login-title">First Time Log In</h1></div>
        <p style={styles.subtitle} className="first-login-subtitle">Please change your temporary password to continue.</p>
        <form onSubmit={onSubmit} style={styles.form} className="first-login-form">
          <label style={styles.label}>Old Password</label>
          <div style={styles.inputWrap}>
            <input type={showOld ? 'text' : 'password'} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} style={styles.input} className="first-login-input" disabled={isLoading} />
            <button type="button" onClick={() => setShowOld((s) => !s)} style={styles.eyeBtn} disabled={isLoading}>
              <PasswordVisibilityIcon show={showOld} size={18} color="#0f172a" />
            </button>
          </div>
          <label style={styles.label}>New Password</label>
          <div style={styles.inputWrap}>
            <input 
              type={showNew ? 'text' : 'password'} 
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)}
              onKeyPress={handlePasswordKeyPress}
              style={styles.input}
              className="first-login-input"
              disabled={isLoading}
            />
            <button type="button" onClick={() => setShowNew((s) => !s)} style={styles.eyeBtn} disabled={isLoading}>
              <PasswordVisibilityIcon show={showNew} size={18} color="#0f172a" />
            </button>
          </div>
          <div style={styles.hint}>Must be 16+ chars with upper, lower, number, and symbol.</div>
          <div style={styles.strength}>Strength: {passwordValidation.message}</div>
          <label style={styles.label}>Confirm Password</label>
          <div style={styles.inputWrap}>
            <input 
              type={showConfirm ? 'text' : 'password'} 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyPress={handleConfirmKeyPress}
              style={styles.input}
              className="first-login-input"
              disabled={isLoading}
            />
            <button type="button" onClick={() => setShowConfirm((s) => !s)} style={styles.eyeBtn} disabled={isLoading}>
              <PasswordVisibilityIcon show={showConfirm} size={18} color="#0f172a" />
            </button>
          </div>
          {error && <div style={styles.error}>{error}</div>}
          {success && <div style={styles.success}>{success}</div>}
          <button 
            type="submit" 
            className="first-login-button"
            style={{ 
              ...styles.button, 
              opacity: canSubmit && !isLoading ? 1 : 0.6,
              ...(isLoading ? styles.buttonLoading : {})
            }} 
            disabled={!canSubmit || isLoading}
          >
            {isLoading ? (
              <>
                <span style={{ marginRight: '8px' }}>⏳</span>
                Changing Password...
              </>
            ) : (
              'Confirm'
            )}
          </button>
        </form>
        </div>
      </div>
      <div style={styles.rightSection} className="first-login-right-section">
        <img src={require('../../../images/ctu.jpg')} alt="CTU" style={styles.backgroundImage} />
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { 
    display: 'flex', 
    height: '100vh', 
    fontFamily: 'Arial, sans-serif',
    flexDirection: 'column',
  },
  leftSection: { 
    width: '100%',
    flex: 1,
    backgroundColor: '#1e3a8a', 
    color: 'white', 
    display: 'flex', 
    flexDirection: 'column', 
    justifyContent: 'center', 
    padding: 24, 
    alignItems: 'center',
    overflowY: 'auto',
  },
  rightSection: { 
    display: 'none',
  },
  backgroundImage: { width: '100%', height: '100vh', objectFit: 'cover' },
  card: { width: '100%', maxWidth: 560, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16, padding: 24, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', backdropFilter: 'blur(6px)' },
  headerRow: { display: 'flex', alignItems: 'center', marginBottom: 12 },
  backBtn: { background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer', marginRight: 12, padding: 5 },
  title: { fontSize: '1.5rem', fontWeight: 'bold', margin: 0 },
  subtitle: { fontSize: '0.95rem', marginBottom: 16, opacity: 0.95, lineHeight: 1.5 },
  form: { width: '100%', display: 'flex', flexDirection: 'column', gap: 8 },
  label: { marginBottom: 5, color: '#ffffff', fontWeight: 700 },
  inputWrap: { position: 'relative' },
  input: { 
    padding: 12, 
    marginBottom: 14, 
    borderRadius: 8, 
    border: '1px solid rgba(255,255,255,0.25)', 
    backgroundColor: '#ffffff', 
    width: '100%', 
    paddingRight: 40, 
    boxSizing: 'border-box', 
    color: '#0f172a',
    fontSize: '16px', // Prevent zoom on iOS
  },
  eyeBtn: { position: 'absolute', right: 8, top: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 },
  hint: { fontSize: 12, opacity: 0.9, marginBottom: 8 },
  strength: { fontSize: 12, marginBottom: 10 },
  button: { 
    backgroundColor: '#ffffff', 
    color: '#1e3a8a', 
    fontWeight: 'bold', 
    padding: 14, 
    borderRadius: 12, 
    border: 'none', 
    cursor: 'pointer', 
    width: '100%', 
    boxShadow: '0 6px 16px rgba(0,0,0,0.25)', 
    position: 'relative', 
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s ease',
  },
  buttonLoading: {
    cursor: 'not-allowed',
    opacity: 0.7,
  },
  error: { color: '#ffadad', marginTop: 6 },
  success: { color: '#b2f2bb', marginTop: 6 },
};

export default FirstLoginChangePassword;


