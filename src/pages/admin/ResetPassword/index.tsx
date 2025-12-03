import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { api } from '../../../services/api';
import { validatePassword } from '../../../utils/passwordValidator';
import { IoArrowBack, IoLockClosed } from 'react-icons/io5';
import PasswordVisibilityIcon from '../../../components/PasswordVisibilityIcon';
import './ResetPassword.css';
import '../authAnimations.css';

const background = require('../../../images/ctu.jpg');
const ccictLogo = require('../../../images/ccict.png');
const alumniLogo = require('../../../images/ctu alumni logo.jpg');
const whereNaYouLogo = require('../../../images/wny-logo.png');

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [formData, setFormData] = useState({
    new_password: '',
    confirm_password: '',
  });
  const [user, setUser] = useState<{ name: string; email: string | null } | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [expiresInMinutes, setExpiresInMinutes] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordValidation = useMemo(() => {
    return validatePassword(formData.new_password);
  }, [formData.new_password]);

  useEffect(() => {
    // Validate token on component mount
    const validateToken = async () => {
      if (!token) {
        setError('Invalid reset link. Token is missing.');
        setValidating(false);
        setTokenExpired(true);
        return;
      }

      try {
        const response = await axios.get(`${api.defaults.baseURL}reset-password/?token=${token}`);
        
        if (response.data.success) {
          setUser(response.data.user);
          setExpiresInMinutes(response.data.expires_in_minutes);
        }
      } catch (error: any) {
        console.error('Token validation error:', error);
        if (error.response?.data?.expired) {
          setTokenExpired(true);
        }
        setError(error.response?.data?.message || 'Invalid or expired reset link.');
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError(''); // Clear error when user types
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Client-side validation
    if (formData.new_password !== formData.confirm_password) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (!passwordValidation.isValid) {
      const missing = passwordValidation.missingRequirements;
      setError(`Password requirements missing: ${missing.join(', ')}`);
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(`${api.defaults.baseURL}reset-password/`, {
        token,
        new_password: formData.new_password,
        confirm_password: formData.confirm_password,
      });
      
      if (response.data.success) {
        setSuccess(response.data.message);
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login', { state: { animate: 'right', passwordResetSuccess: true } });
        }, 3000);
      } else {
        setError(response.data.message || 'Failed to reset password');
      }
    } catch (error: any) {
      console.error('Reset password error:', error);
      if (error.response?.data?.expired) {
        setTokenExpired(true);
      }
      setError(error.response?.data?.message || 'Network error. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestNewLink = () => {
    navigate('/forgot-password', { state: { animate: 'left' } });
  };

  if (validating) {
    return (
      <div style={styles.container}>
        <div style={styles.centerContent}>
          <div style={styles.loader}></div>
          <p style={styles.loadingText}>Validating reset link...</p>
        </div>
      </div>
    );
  }

  if (tokenExpired || (!user && !validating)) {
    return (
      <div style={styles.container}>
        <div style={styles.centerContent}>
          <div style={styles.expiredContainer}>
            <div style={styles.expiredIcon}>⏰</div>
            <h1 style={styles.expiredTitle}>Link Expired</h1>
            <p style={styles.expiredText}>
              {error || 'This password reset link has expired or has already been used.'}
            </p>
            <button
              onClick={handleRequestNewLink}
              style={styles.requestNewButton}
              className="reset-password-button"
            >
              Request New Reset Link
            </button>
            <button
              onClick={() => navigate('/login')}
              style={styles.backButton}
              className="reset-password-back-button"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container} className="reset-password-container">
      <div style={styles.rightSection} className="reset-password-left-section">
        <div 
          style={styles.formContainer} 
          className="reset-password-form-container slide-in-left"
        >
          <div style={styles.header}>
            <h1 style={styles.title}>
              <IoLockClosed style={{ marginRight: '10px', display: 'inline-block', verticalAlign: 'middle' }} />
              Reset Password
            </h1>
          </div>
          
          {user && (
            <div style={styles.userInfo}>
              <p style={styles.userGreeting}>Hello, <strong>{user.name}</strong>!</p>
              {user.email && <p style={styles.userEmail}>{user.email}</p>}
              {expiresInMinutes !== null && expiresInMinutes > 0 && (
                <p style={styles.expiresText}>
                  ⏱️ This link expires in {expiresInMinutes} minute{expiresInMinutes !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}

          <p style={styles.subtitle}>
            Please enter your new password below. Make sure it's strong and secure!
          </p>

          {success ? (
            <div style={styles.successContainer}>
              <div style={styles.successIcon}>✅</div>
              <p style={styles.successText}>{success}</p>
              <p style={styles.redirectText}>Redirecting to login...</p>
            </div>
          ) : (
            <form style={styles.form} onSubmit={handleSubmit}>
              <div style={styles.inputGroup}>
                <label htmlFor="new_password" style={styles.label}>
                  New Password
                </label>
                <div style={styles.passwordInputContainer}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="new_password"
                    name="new_password"
                    placeholder="Enter new password"
                    required
                    value={formData.new_password}
                    onChange={handleInputChange}
                    style={{
                      ...styles.input,
                      paddingRight: '3rem',
                    }}
                    className="reset-password-input"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={styles.togglePasswordButton}
                    className="reset-password-password-toggle"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    <PasswordVisibilityIcon show={showPassword} size={20} color="#000000" />
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
              </div>

              <div style={styles.inputGroup}>
                <label htmlFor="confirm_password" style={styles.label}>
                  Confirm Password
                </label>
                <div style={styles.passwordInputContainer}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirm_password"
                    name="confirm_password"
                    placeholder="Confirm your new password"
                    required
                    value={formData.confirm_password}
                    onChange={handleInputChange}
                    style={{
                      ...styles.input,
                      paddingRight: '3rem',
                    }}
                    className="reset-password-input"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.togglePasswordButton}
                    className="reset-password-password-toggle"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    <PasswordVisibilityIcon show={showConfirmPassword} size={20} color="#000000" />
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
                  ...(loading ? styles.buttonLoading : {}),
                }}
                className="reset-password-button"
                disabled={loading}
              >
                <span style={styles.buttonText}>
                  {loading ? 'Resetting Password...' : 'Reset Password'}
                </span>
              </button>

              <div style={styles.backToLoginContainer}>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  style={styles.backToLoginButton}
                  className="reset-password-back-to-login"
                >
                  <IoArrowBack style={{ marginRight: '6px', display: 'inline-block' }} /> Back to Login
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      <div style={styles.leftSection} className="reset-password-right-section">
        <div style={styles.backgroundOverlay}></div>
        <img src={background} alt="CTU Administration Building" style={styles.backgroundImage} className="reset-password-background-image" />
        <div style={styles.leftContent}>
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
                <h2 style={styles.brandTitle} className="reset-password-brand-title">WhereNaYou</h2>
                <p style={styles.brandTagline} className="reset-password-brand-tagline">Connecting OJTs & Alumni Journeys</p>
                
              </div>
            </div>
          </div>
          <div style={styles.collaborationContainer} className="reset-password-collaboration-container">
            <div style={styles.collaborationTitleWrapper}>
              <h3 style={styles.collaborationTitle} className="reset-password-collaboration-title">IN COLLABORATION WITH</h3>
            </div>
            <div style={styles.partnersContainer} className="reset-password-partners-container">
              <div style={{...styles.partnerItem, ...styles.partnerItemLeft}}>
                <div style={styles.partnerLogo} className="reset-password-partner-logo">
                  <img src={ccictLogo} alt="CCICT Logo" style={styles.partnerLogoImage} className="reset-password-partner-logo-image" />
                </div>
                <p style={styles.partnerName} className="reset-password-partner-name">College of Computer, Information and Communications Technology</p>
              </div>
              <div style={styles.partnerItem}>
                <div style={styles.partnerLogo} className="reset-password-partner-logo">
                  <img src={alumniLogo} alt="CTU MC Alumni Association Logo" style={styles.partnerLogoImage} className="reset-password-partner-logo-image" />
                </div>
                <p style={styles.partnerName} className="reset-password-partner-name">CTU - MC Alumni Association</p>
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
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    overflow: 'hidden',
  },
  centerContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, #003366 0%, #0066cc 100%)',
  },
  loader: {
    border: '4px solid rgba(255, 255, 255, 0.3)',
    borderTop: '4px solid white',
    borderRadius: '50%',
    width: '50px',
    height: '50px',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    color: 'white',
    marginTop: '1rem',
    fontSize: '1rem',
  },
  expiredContainer: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)',
    borderRadius: '20px',
    padding: '3rem',
    maxWidth: '500px',
    textAlign: 'center',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  },
  expiredIcon: {
    fontSize: '4rem',
    marginBottom: '1rem',
  },
  expiredTitle: {
    color: 'white',
    fontSize: '2rem',
    fontWeight: '700',
    marginBottom: '1rem',
  },
  expiredText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: '1rem',
    marginBottom: '2rem',
    lineHeight: '1.6',
  },
  requestNewButton: {
    background: 'linear-gradient(135deg, #ffffff 0%, #f0f8ff 100%)',
    color: '#003366',
    fontSize: '1rem',
    fontWeight: '600',
    padding: '0.75rem 2rem',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    marginBottom: '1rem',
    width: '100%',
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
  rightSection: {
    width: '50%',
    background: 'linear-gradient(135deg, #003366 0%, #0066cc 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    boxSizing: 'border-box',
  },
  formContainer: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)',
    borderRadius: '20px',
    padding: '2rem',
    width: '100%',
    maxWidth: '500px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
    boxSizing: 'border-box',
  },
  header: {
    textAlign: 'center',
    marginBottom: '1.5rem',
  },
  title: {
    fontSize: '2rem',
    fontWeight: '700',
    margin: 0,
    color: 'white',
    background: 'linear-gradient(135deg, #ffffff 0%, #cce7ff 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  userInfo: {
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '10px',
    padding: '1rem',
    marginBottom: '1rem',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  },
  userGreeting: {
    fontSize: '1rem',
    color: 'white',
    margin: '0 0 0.5rem 0',
  },
  userEmail: {
    fontSize: '0.85rem',
    color: 'rgba(255, 255, 255, 0.7)',
    margin: '0 0 0.5rem 0',
  },
  expiresText: {
    fontSize: '0.8rem',
    color: '#fbbf24',
    margin: 0,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: '0.9rem',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: '1.5rem',
    lineHeight: 1.4,
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
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
  },
  passwordInputContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  input: {
    padding: '0.75rem',
    paddingRight: '3rem',
    borderRadius: '8px',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    background: '#ffffff',
    color: '#000000',
    fontSize: '0.9rem',
    transition: 'all 0.3s ease',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  togglePasswordButton: {
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
  requirementsContainer: {
    background: 'rgba(255, 255, 255, 0.15)',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '8px',
    padding: '12px',
    marginTop: '8px',
    marginBottom: '8px',
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
    marginBottom: '8px',
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
  errorContainer: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '6px',
    padding: '0.75rem',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: '0.85rem',
    margin: 0,
    textAlign: 'center',
  },
  successContainer: {
    background: 'rgba(34, 197, 94, 0.1)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    borderRadius: '10px',
    padding: '2rem',
    textAlign: 'center',
  },
  successIcon: {
    fontSize: '4rem',
    marginBottom: '1rem',
  },
  successText: {
    color: '#bbf7d0',
    fontSize: '1.1rem',
    margin: '0 0 1rem 0',
    fontWeight: '600',
  },
  redirectText: {
    color: 'rgba(187, 247, 208, 0.7)',
    fontSize: '0.9rem',
    margin: 0,
  },
  button: {
    background: 'linear-gradient(135deg, #ffffff 0%, #f0f8ff 100%)',
    color: '#003366',
    fontSize: '1rem',
    fontWeight: '600',
    padding: '0.75rem 1.5rem',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    marginTop: '0.5rem',
  },
  buttonLoading: {
    opacity: 0.8,
    cursor: 'not-allowed',
  },
  buttonText: {
    position: 'relative',
    zIndex: 1,
  },
  backToLoginContainer: {
    marginTop: '1rem',
    textAlign: 'center',
  },
  backToLoginButton: {
    background: 'transparent',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '0.9rem',
    fontWeight: '400',
    padding: '0.5rem 1rem',
    border: 'none',
    cursor: 'pointer',
    transition: 'color 0.3s ease',
  },
  backButton: {
    background: 'transparent',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '0.9rem',
    fontWeight: '400',
    padding: '0.75rem 2rem',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    width: '100%',
  },
};

export default ResetPassword;


