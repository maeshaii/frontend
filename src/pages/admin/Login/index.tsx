import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { loginUser, fetchAlumniDetails } from '../../../services/api';
import PasswordVisibilityIcon from '../../../components/PasswordVisibilityIcon';
import './Login.css';
import '../authAnimations.css';
const background = require('../../../images/ctu.jpg');
const alumniLogo = require('../../../images/ctu alumni logo.jpg');
const ccictLogo = require('../../../images/ccict.png');

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [acc_username, setUsername] = useState('');
  const [acc_password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 🔒 SECURITY: Check if user is already authenticated
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const user = localStorage.getItem('user');
    
    if (token && user) {
      try {
        const userData = JSON.parse(user);
        const userId = userData.user_id || userData.id;
        const accountType = userData.account_type || {};
        
        console.log('[Login Security] User already authenticated - redirecting to dashboard');
        
        // Redirect to appropriate dashboard
        if (accountType.admin) {
          navigate('/dashboard', { replace: true });
        } else if (accountType.peso) {
          navigate(`/peso/dashboard/${userId}`, { replace: true });
        } else if (accountType.coordinator) {
          navigate(`/coordinator/dashboard/${userId}`, { replace: true });
        } else if (accountType.user || accountType.ojt) {
          navigate(`/dashboard/${userId}`, { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      } catch (error) {
        console.error('[Login Security] Error parsing user data:', error);
        // Clear invalid data
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      }
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      console.log('Starting login process...');
      const startTime = Date.now();
      
      const data = await loginUser(acc_username, acc_password);
      
      const loginTime = Date.now() - startTime;
      console.log(`Login completed in ${loginTime}ms`);
      
      if (data.success) {
        localStorage.setItem('user', JSON.stringify(data.user));
        // Coordinator and Peso accounts are exempt from first-time login password change
        const isCoordinator = data.user?.account_type?.coordinator;
        const isPeso = data.user?.account_type?.peso;
        
        if (data.must_change_password && !isCoordinator && !isPeso) {
          // Redirect to change password screen for first-time login (only for non-coordinator/peso accounts)
          navigate('/first-login-change-password', { state: { acc_username, animate: 'right', animateHero: 'right' } });
          return;
        }
        if (data.user && data.user.account_type) {
          const userId = data.user.user_id || data.user.id;
          if (data.user.account_type.admin) {
            navigate('/dashboard');
          } else if (data.user.account_type.peso) {
            navigate(`/peso/dashboard/${userId}`);
          } else if (data.user.account_type.coordinator) {
            navigate(`/coordinator/dashboard/${userId}`);
          } else if (data.user.account_type.user || data.user.account_type.ojt) {
            // Unified dashboard for alumni and OJT users
            navigate(`/dashboard/${userId}`);
          } else {
            navigate('/dashboard');
          }
        } else {
          navigate('/dashboard');
        }
      } else {
        setError(data.message || 'Invalid credentials');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      // loginUser returns { success: false, message: '...' } for errors, so this catch
      // should only trigger for unexpected errors. The error message from loginUser
      // will be displayed via data.message in the else block above.
      setError(error.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container} className="login-container">
      <div 
        style={styles.leftSection} 
        className={`login-left-section ${location.state?.animateHero === 'right' ? 'slide-in-right' : location.state?.animateHero === 'left' ? 'slide-in-left' : ''}`}
      >
        <div style={styles.backgroundOverlay}></div>
        <img src={background} alt="CTU Administration Building" style={styles.backgroundImage} className="login-background-image" />
        <div style={styles.leftContent}>
          <div style={{ marginTop: '-10rem' }}>
            <h2 style={styles.brandTitle} className="login-brand-title">WHERENAYOU : Connecting OJT's & Alumni Journeys</h2>
            <p style={styles.brandSubtitle}>Excellence in Technology Education</p>
          </div>
          <div style={styles.collaborationContainer} className="login-collaboration-container">
            <h3 style={styles.collaborationTitle} className="login-collaboration-title">IN COLLABORATION WITH</h3>
            <div style={styles.partnersContainer} className="login-partners-container">
              <div style={styles.partnerItem}>
                <div style={styles.partnerLogo} className="login-partner-logo">
                  <img src={ccictLogo} alt="CCICT Logo" style={styles.partnerLogoImage} className="login-partner-logo-image" />
                </div>
                <p style={styles.partnerName} className="login-partner-name">College of Computer, Information and Communications Technology</p>
              </div>
              <div style={styles.partnerItem}>
                <div style={styles.partnerLogo} className="login-partner-logo">
                  <img src={alumniLogo} alt="CTU MC Alumni Association Logo" style={styles.partnerLogoImage} className="login-partner-logo-image" />
                </div>
                <p style={styles.partnerName} className="login-partner-name">CTU - MC Alumni Association</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style={styles.rightSection} className="login-right-section">
        <div 
          style={styles.formContainer} 
          className={`login-form-container ${location.state?.animate === 'right' ? 'slide-in-right' : location.state?.animate === 'left' ? 'slide-in-left' : ''}`}
        >
          <div style={styles.welcomeSection}>
            <h2 style={styles.h2}>Welcome</h2>
            <h1 style={styles.h1} className="login-main-title">Technologist</h1>
            <p style={styles.p}>Connect & Collaborate with your community</p>
          </div>
          <form style={styles.form} onSubmit={handleLogin}>
            <div style={styles.inputGroup}>
              <label htmlFor="ctu-id" style={styles.label}>
                CTU ID
              </label>
              <input
                type="text"
                id="ctu-id"
                placeholder="Enter your CTU ID"
                required
                value={acc_username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                pattern="[A-Za-z0-9]+"
                title="Only letters and numbers are allowed"
                inputMode="text"
                style={styles.input}
                className="login-input"
              />
            </div>
            <div style={styles.inputGroup}>
              <label htmlFor="password" style={styles.label}>
                Password
              </label>
              <div style={styles.passwordContainer}>
                <input
                  type={show ? 'text' : 'password'}
                  id="password"
                  placeholder="Enter your password"
                  required
                  value={acc_password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    ...styles.input,
                    ...styles.passwordInput,
                    paddingRight: '3rem',
                  }}
                  className="login-input"
                />
                <button 
                  type="button" 
                  onClick={() => setShow((s) => !s)} 
                  style={styles.passwordToggle}
                  className="login-password-toggle"
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  <PasswordVisibilityIcon show={show} size={20} color="#000000" />
                </button>
              </div>
            </div>
            {error && (
              <div style={styles.errorContainer}>
                <p style={styles.errorText}>{error}</p>
              </div>
            )}
            <button 
              type="submit" 
              style={{
                ...styles.button,
                ...(isLoading ? styles.buttonLoading : {}),
              }}
              className="login-button"
              disabled={isLoading}
            >
              <span style={styles.buttonText}>
                {isLoading ? 'Signing In...' : 'Sign In'}
              </span>
            </button>
            <div style={styles.forgotPasswordContainer}>
              <button 
                type="button" 
                onClick={() => navigate('/forgot-password', { state: { animate: 'left', animateHero: 'right' } })}
                style={styles.forgotPasswordLink}
                className="login-forgot-password"
              >
                Forgot Password?
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    overflow: 'hidden',
  },
  leftSection: {
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
  leftContent: {
    position: 'relative',
    zIndex: 3,
    textAlign: 'center',
    color: 'white',
    padding: '2rem',
    paddingTop: '3rem',
  },
  brandTitle: {
    fontSize: '2.5rem',
    fontWeight: '700',
    margin: '0 0 0.5rem 0',
    textShadow: '0 4px 8px rgba(0, 0, 0, 0.8), 0 2px 4px rgba(0, 0, 0, 0.6)',
    letterSpacing: '-0.02em',
    color: '#ffffff',
    background: 'rgba(0, 0, 0, 0.3)',
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    backdropFilter: 'blur(10px)',
    opacity: 0.7,
  },
  brandSubtitle: {
    fontSize: '1.1rem',
    fontWeight: '400',
    margin: 0,
    opacity: 0.9,
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
  },
  collaborationContainer: {
    position: 'absolute',
    bottom: '-130px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '0.3rem 1rem 0.5rem 1rem',
    background: 'transparent',
    backdropFilter: 'none',
    borderRadius: '0',
    border: 'none',
    boxShadow: 'none',
    width: '90%',
  },
  collaborationTitle: {
    fontSize: '0.65rem',
    fontWeight: '500',
    margin: '0 0 0.6rem 0',
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  partnersContainer: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    gap: '1.5rem',
  },
  partnerItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.4rem',
  },
  partnerLogo: {
    width: '35px',
    height: '35px',
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
    width: '24px',
    height: '24px',
    objectFit: 'contain',
    opacity: 0.9,
    filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6))',
  },
  partnerName: {
    fontSize: '0.6rem',
    fontWeight: '400',
    margin: 0,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)',
    lineHeight: '1.1',
  },
  rightSection: {
    width: '50%',
    background: 'linear-gradient(135deg, #003366 0%, #0066cc 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    position: 'relative',
    boxSizing: 'border-box',
  },
  formContainer: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)',
    borderRadius: '20px',
    padding: '2rem',
    width: '100%',
    maxWidth: '400px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
  },
  welcomeSection: {
    textAlign: 'center',
    marginBottom: '2rem',
  },
  h2: {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    margin: '0 0 0.5rem 0',
  },
  h1: {
    fontSize: '2.5rem',
    fontWeight: '700',
    color: 'white',
    margin: '0 0 0.5rem 0',
    background: 'linear-gradient(135deg, #ffffff 0%, #cce7ff 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  p: {
    fontSize: '1rem',
    color: 'rgba(255, 255, 255, 0.8)',
    margin: 0,
    lineHeight: 1.5,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  label: {
    fontSize: '0.9rem',
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: '0.25rem',
  },
  input: {
    padding: '1rem',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    background: 'rgba(255, 255, 255, 0.1)',
    color: 'white',
    fontSize: '1rem',
    transition: 'all 0.3s ease',
    backdropFilter: 'blur(10px)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  passwordInput: {
    background: '#ffffff',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    color: '#000000',
  },
  passwordContainer: {
    position: 'relative',
    width: '100%',
  },
  passwordToggle: {
    position: 'absolute',
    right: '1rem',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1.2rem',
    color: 'rgba(255, 255, 255, 0.7)',
    transition: 'color 0.3s ease',
    padding: '0.25rem',
    borderRadius: '4px',
  },
  errorContainer: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    padding: '0.75rem',
    marginTop: '0.5rem',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: '0.9rem',
    margin: 0,
    textAlign: 'center',
  },
  button: {
    background: 'linear-gradient(135deg, #ffffff 0%, #f0f8ff 100%)',
    color: '#003366',
    fontSize: '1rem',
    fontWeight: '600',
    padding: '1rem 2rem',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    marginTop: '1rem',
    position: 'relative',
    overflow: 'hidden',
  },
  buttonLoading: {
    opacity: 0.8,
    cursor: 'not-allowed',
  },
  buttonText: {
    position: 'relative',
    zIndex: 1,
  },
  forgotPasswordContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: '1rem',
  },
  forgotPasswordLink: {
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: '0.9rem',
    cursor: 'pointer',
    textDecoration: 'none',
    padding: '0.5rem',
    transition: 'all 0.3s ease',
    borderRadius: '6px',
  },
};

export default Login;