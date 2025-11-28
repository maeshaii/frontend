import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { changePassword } from '../../../services/api';
import PasswordVisibilityIcon from '../../../components/PasswordVisibilityIcon';
import { validatePassword } from '../../../utils/passwordValidator';
import { IoArrowBack } from 'react-icons/io5';
import './FirstLoginChangePassword.css';
import '../authAnimations.css';
const background = require('../../../images/ctu.jpg');
const alumniLogo = require('../../../images/ctu alumni logo.jpg');
const ccictLogo = require('../../../images/ccict.png');
const whereNaYouLogo = require('../../../images/final_logos-removebg-preview.png');

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
  // ✅ FIX: Track if password change was successful to prevent redirect loop
  const passwordChangeSuccessful = useRef(false);

  // ✅ SECURITY: Prevent back button bypass and navigation away
  useEffect(() => {
    // ✅ FIX: Don't redirect if password change was just successful
    if (passwordChangeSuccessful.current) {
      console.log('[Security] Password change successful - allowing redirect to proceed');
      return;
    }

    // Check if user still needs to change password
    const mustChangePassword = localStorage.getItem('must_change_password') === 'true';
    
    if (!mustChangePassword) {
      // User already changed password or shouldn't be here
      // But only redirect if password change wasn't just successful
      if (!success) {
        console.warn('[Security] User accessed password change page without must_change_password flag');
        navigate('/login', { replace: true });
      }
      return;
    }

    // ✅ SECURITY: Handle browser back button - redirect to login
    const handlePopState = (event: PopStateEvent) => {
      console.log('[Security] Back button detected on password change page - redirecting to login');
      // Clear the must_change_password flag since user is going back
      localStorage.removeItem('must_change_password');
      // Clear tokens to force fresh login
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      // Navigate to login page
      navigate('/login', { replace: true, state: { animate: 'right', animateHero: 'left' } });
    };

    // ✅ SECURITY: Prevent navigation away from page
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Only warn if password hasn't been changed
      if (!success) {
        event.preventDefault();
        event.returnValue = 'You must change your password before leaving this page. Are you sure you want to leave?';
        return event.returnValue;
      }
    };

    // Push current state to history to catch back button
    window.history.pushState(null, '', window.location.href);
    
    // Add event listeners
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [navigate, success]); // Keep success in deps to handle state changes

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
        // ✅ FIX: Mark password change as successful BEFORE clearing flag
        passwordChangeSuccessful.current = true;
        setSuccess('Password changed. Please login again.');
        // ✅ FIX: Set flag to prevent PublicRoute from redirecting during success message
        localStorage.setItem('password_change_completed', 'true');
        // ✅ SECURITY: Clear must_change_password flag
        localStorage.removeItem('must_change_password');
        // Clear tokens AND user data to force fresh login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user'); // ✅ FIX: Also remove user data
        setTimeout(() => {
          setIsLoading(false);
          // Clear the password_change_completed flag before navigating
          localStorage.removeItem('password_change_completed');
          navigate('/login', { replace: true });
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
        <div style={styles.headerRow}><button onClick={() => {
          // Clear the must_change_password flag and tokens when going back
          localStorage.removeItem('must_change_password');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          navigate('/login', { state: { animate: 'right', animateHero: 'left' } });
        }} style={styles.backBtn}><IoArrowBack /></button><h1 style={styles.title} className="first-login-title">First Time Log In</h1></div>
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
          <div style={styles.requirementsContainer}>
            <div style={styles.requirementsTitle}>📋 Password Requirements:</div>
            <div style={styles.requirementsText}>Must be 16+ chars with upper, lower, number, and symbol.</div>
          </div>
          <div style={{
            ...styles.strengthContainer,
            ...(passwordValidation.message === 'Weak' ? styles.strengthWeak : 
                passwordValidation.message === 'Medium' ? styles.strengthMedium : 
                styles.strengthStrong)
          }}>
            <span style={styles.strengthLabel}>Strength:</span>
            <span style={styles.strengthValue}>{passwordValidation.message}</span>
          </div>
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
        <img src={background} alt="CTU Administration Building" style={styles.backgroundImage} className="first-login-background-image" />
        <div style={styles.heroContent}>
          <div style={{ marginTop: '-10rem' }}>
            <div style={styles.brandContainer}>
              <img 
                src={whereNaYouLogo} 
                alt="WhereNaYou Logo" 
                style={styles.brandLogo}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
              <div style={styles.brandTextContainer}>
                <h2 style={styles.brandTitle} className="first-login-brand-title">WHERENAYOU</h2>
                <p style={styles.brandTagline} className="first-login-brand-tagline">Connecting OJTs & Alumni Journeys</p>
                <p style={styles.brandSubtitle}>Excellence in Technology Education</p>
              </div>
            </div>
          </div>
          <div style={styles.collaborationContainer} className="first-login-collaboration-container">
            <div style={styles.collaborationTitleWrapper}>
              <h3 style={styles.collaborationTitle} className="first-login-collaboration-title">IN COLLABORATION WITH</h3>
            </div>
            <div style={styles.partnersContainer} className="first-login-partners-container">
              <div style={{...styles.partnerItem, ...styles.partnerItemLeft}}>
                <div style={styles.partnerLogo} className="first-login-partner-logo">
                  <img src={ccictLogo} alt="CCICT Logo" style={styles.partnerLogoImage} className="first-login-partner-logo-image" />
                </div>
                <p style={styles.partnerName} className="first-login-partner-name">College of Computer, Information and Communications Technology</p>
              </div>
              <div style={styles.partnerItem}>
                <div style={styles.partnerLogo} className="first-login-partner-logo">
                  <img src={alumniLogo} alt="CTU MC Alumni Association Logo" style={styles.partnerLogoImage} className="first-login-partner-logo-image" />
                </div>
                <p style={styles.partnerName} className="first-login-partner-name">CTU - MC Alumni Association</p>
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
    width: '100%',
    height: '100vh',
    objectFit: 'cover',
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
  },
  backgroundOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, rgba(0, 51, 102, 0.8) 0%, rgba(0, 102, 204, 0.6) 100%)',
    zIndex: 2,
  },
  heroContent: {
    position: 'relative',
    zIndex: 3,
    textAlign: 'center',
    color: 'white',
    padding: '2rem',
    paddingTop: '3rem',
  },
  brandContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1.5rem',
    marginBottom: '0.5rem',
  },
  brandLogo: {
    width: '90px',
    height: '90px',
    objectFit: 'contain',
    filter: 'brightness(0) saturate(100%) invert(100%)',
  },
  brandTextContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.5rem',
    position: 'relative',
  },
  brandTitle: {
    fontSize: '3.5rem',
    fontWeight: '700',
    margin: 0,
    padding: 0,
    textShadow: '0 4px 8px rgba(0, 0, 0, 0.8), 0 2px 4px rgba(0, 0, 0, 0.6)',
    letterSpacing: '0',
    color: '#ffffff',
    lineHeight: '1.2',
    textAlign: 'left',
    width: '100%',
  },
  brandTagline: {
    fontSize: '1.5rem',
    fontWeight: '400',
    margin: 0,
    padding: 0,
    textShadow: '0 2px 4px rgba(0, 0, 0, 0.8), 0 1px 2px rgba(0, 0, 0, 0.6)',
    letterSpacing: '0',
    color: '#ffffff',
    lineHeight: '1.3',
    textAlign: 'left',
    width: '100%',
  },
  brandSubtitle: {
    fontSize: '1.1rem',
    fontWeight: '400',
    margin: '0.5rem 0 0 0',
    padding: 0,
    opacity: 0.9,
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
    textAlign: 'left',
    alignSelf: 'center',
    width: '100%',
  },
  collaborationContainer: {
    position: 'absolute',
    bottom: '-180px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '0.3rem 1rem 0.5rem 1rem',
    background: 'transparent',
    backdropFilter: 'none',
    borderRadius: '0',
    border: 'none',
    boxShadow: 'none',
    width: '90%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collaborationTitleWrapper: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '0.6rem',
    position: 'relative',
  },
  collaborationTitle: {
    fontSize: '0.9rem',
    fontWeight: '500',
    margin: '0 auto',
    padding: 0,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    display: 'block',
    width: 'auto',
  },
  partnersContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: '2rem',
    width: '100%',
    maxWidth: '100%',
    margin: '0 auto',
    position: 'relative',
  },
  partnerItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.4rem',
  },
  partnerItemLeft: {
    marginLeft: '-5.5rem',
  },
  partnerLogo: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: 'transparent',
    backdropFilter: 'none',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'none',
  },
  partnerLogoImage: {
    width: '50px',
    height: '50px',
    objectFit: 'contain',
    opacity: 0.9,
    filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6))',
  },
  partnerName: {
    fontSize: '0.85rem',
    fontWeight: '400',
    margin: 0,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)',
    lineHeight: '1.2',
  },

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
  backBtn: { background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer', marginRight: 12, padding: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' },
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
  requirementsContainer: {
    background: 'rgba(255, 255, 255, 0.15)',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '10px',
    marginTop: '4px',
  },
  requirementsTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  requirementsText: {
    fontSize: '13px',
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.95)',
    lineHeight: '1.4',
  },
  strengthContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    borderRadius: '8px',
    marginBottom: '10px',
    border: '2px solid',
    fontWeight: '600',
  },
  strengthLabel: {
    fontSize: '13px',
    fontWeight: '600',
  },
  strengthValue: {
    fontSize: '14px',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  strengthWeak: {
    background: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(239, 68, 68, 0.5)',
    color: '#fca5a5',
  },
  strengthMedium: {
    background: 'rgba(234, 179, 8, 0.2)',
    borderColor: 'rgba(234, 179, 8, 0.5)',
    color: '#fde047',
  },
  strengthStrong: {
    background: 'rgba(34, 197, 94, 0.2)',
    borderColor: 'rgba(34, 197, 94, 0.5)',
    color: '#86efac',
  },
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

