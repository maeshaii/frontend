import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { changePassword } from '../../../services/api';
import PasswordVisibilityIcon from '../../../components/PasswordVisibilityIcon';
import { validatePassword } from '../../../utils/passwordValidator';
import './FirstLoginChangePassword.css';
import '../authAnimations.css';

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
      {/* Left form card */}
      <div style={styles.formSection} className="first-login-left-section">
        <div 
          style={styles.card} 
          className={`first-login-card ${location.state && (location.state as any).animate === 'right' ? 'slide-in-right' : ''}`}
        >
        <div style={styles.headerRow}><button onClick={() => navigate('/login', { state: { animate: 'right', animateHero: 'left' } })} style={styles.backBtn}>←</button><h1 style={styles.title} className="first-login-title">First Time Log In</h1></div>
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

      {/* Right hero section to match Login */}
      <div 
        style={styles.heroSection}
        className={`first-login-hero ${location.state && (location.state as any).animateHero === 'right' ? 'slide-in-right' : (location.state as any)?.animateHero === 'left' ? 'slide-in-left' : ''}`}
      >
        <div style={styles.backgroundOverlay}></div>
        <img src={require('../../../images/ctu.jpg')} alt="CTU" style={styles.backgroundImage} />
        <div style={styles.heroContent}>
          <div style={{ marginTop: '-10rem' }}>
            <h2 style={styles.brandTitle}>WHERENAYOU : Connecting OJT's & Alumni Journeys</h2>
            <p style={styles.brandSubtitle}>Excellence in Technology Education</p>
          </div>
          <div style={styles.collaborationContainer}>
            <h3 style={styles.collaborationTitle}>IN COLLABORATION WITH</h3>
            <div style={styles.partnersContainer}>
              <div style={styles.partnerItem}>
                <div style={styles.partnerLogo}>
                  <img src={require('../../../images/ccict.png')} alt="CCICT Logo" style={styles.partnerLogoImage} />
                </div>
                <p style={styles.partnerName}>College of Computer, Information and Communications Technology</p>
              </div>
              <div style={styles.partnerItem}>
                <div style={styles.partnerLogo}>
                  <img src={require('../../../images/ctu alumni logo.jpg')} alt="CTU MC Alumni Association Logo" style={styles.partnerLogoImage} />
                </div>
                <p style={styles.partnerName}>CTU - MC Alumni Association</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { 
    display: 'flex', 
    height: '100vh', 
    fontFamily: 'Arial, sans-serif',
    overflow: 'hidden',
  },
  heroSection: {
    width: '50%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundImage: { 
    width: '100%', height: '100vh', objectFit: 'cover', position: 'absolute', top: 0, left: 0, zIndex: 1 
  },
  backgroundOverlay: {
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
    background: 'linear-gradient(135deg, rgba(0, 51, 102, 0.8) 0%, rgba(0, 102, 204, 0.6) 100%)', zIndex: 2
  },
  heroContent: {
    position: 'relative', zIndex: 3, textAlign: 'center', color: 'white', padding: '2rem', paddingTop: '3rem'
  },
  brandTitle: {
    fontSize: '2.5rem', fontWeight: '700', margin: '0 0 0.5rem 0', textShadow: '0 4px 8px rgba(0, 0, 0, 0.8), 0 2px 4px rgba(0, 0, 0, 0.6)', letterSpacing: '-0.02em', color: '#ffffff', background: 'rgba(0, 0, 0, 0.3)', padding: '0.5rem 1rem', borderRadius: '8px', backdropFilter: 'blur(10px)', opacity: 0.7
  },
  brandSubtitle: {
    fontSize: '1.1rem', fontWeight: '400', margin: 0, opacity: 0.9, textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
  },
  collaborationContainer: {
    position: 'absolute', bottom: '-130px', left: '50%', transform: 'translateX(-50%)', padding: '0.3rem 1rem 0.5rem 1rem', background: 'transparent', border: 'none', width: '90%'
  },
  collaborationTitle: {
    fontSize: '0.65rem', fontWeight: '500', margin: '0 0 0.6rem 0', color: 'rgba(255, 255, 255, 0.85)', textAlign: 'center', textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)', letterSpacing: '0.5px', textTransform: 'uppercase'
  },
  partnersContainer: { display: 'flex', justifyContent: 'space-around', alignItems: 'center', gap: '1.5rem' },
  partnerItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' },
  partnerLogo: { width: '35px', height: '35px', borderRadius: '50%', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  partnerLogoImage: { width: '24px', height: '24px', objectFit: 'contain', opacity: 0.9, filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6))' },
  partnerName: { fontSize: '0.6rem', fontWeight: '400', margin: 0, color: 'rgba(255, 255, 255, 0.8)', textAlign: 'center', textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)', lineHeight: '1.1' },

  formSection: {
    width: '50%',
    background: 'linear-gradient(135deg, #003366 0%, #0066cc 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    boxSizing: 'border-box',
  },
  card: { width: '100%', maxWidth: 560, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16, padding: 24, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', backdropFilter: 'blur(6px)' },
  headerRow: { display: 'flex', alignItems: 'center', marginBottom: 12 },
  backBtn: { background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer', marginRight: 12, padding: 5 },
  title: { fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: '#ffffff' },
  subtitle: { fontSize: '0.95rem', marginBottom: 16, lineHeight: 1.5, color: 'rgba(255, 255, 255, 0.8)' },
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
  hint: { fontSize: 12, marginBottom: 8, color: 'rgba(255, 255, 255, 0.8)' },
  strength: { fontSize: 12, marginBottom: 10, color: 'rgba(255, 255, 255, 0.8)' },
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

