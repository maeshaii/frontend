import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { api } from '../../../services/api';
import './ForgotPassword.css';
import '../authAnimations.css';

const background = require('../../../images/ctu.jpg');
const ccictLogo = require('../../../images/ccict.png');
const alumniLogo = require('../../../images/ctu alumni logo.jpg');

const ForgotPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await axios.post(`${api.defaults.baseURL}forgot-password/`, { email });
      
      if (response.data.success) {
        setSuccess(response.data.message);
        setEmail(''); // Clear the form
      } else {
        setError(response.data.message || 'Failed to send reset link');
      }
    } catch (error: any) {
      console.error('Forgot password error:', error);
      if (error.response?.data?.message) {
        setError(error.response.data.message);
      } else {
        setError('Network error. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container} className="forgot-password-container">
      {/* Swapped positions: form on the left, hero on the right */}
      <div style={styles.rightSection} className="forgot-password-left-section">
        <div 
          style={styles.formContainer} 
          className={`forgot-password-form-container ${location.state?.animate === 'left' ? 'slide-in-left' : location.state?.animate === 'right' ? 'slide-in-right' : 'slide-in-left'}`}
        >
          <div style={styles.header}>
            <button 
              onClick={() => navigate('/login', { state: { animate: 'right', animateHero: 'left' } })}
              style={styles.backButton}
              className="forgot-password-back-button"
            >
              ←
            </button>
            <h1 style={styles.title}>Forgot Password</h1>
          </div>
          
          <p style={styles.subtitle}>
            Enter your email address and we'll send you a secure link to reset your password.
          </p>

          <form style={styles.form} onSubmit={handleSubmit}>
            <div style={styles.inputGroup}>
              <label htmlFor="email" style={styles.label}>
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="Enter your registered email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                className="forgot-password-input"
                disabled={loading}
              />
            </div>

            {error && (
              <div style={styles.errorContainer}>
                <p style={styles.errorText}>{error}</p>
              </div>
            )}

            {success && (
              <div style={styles.successContainer}>
                <p style={styles.successText}>
                  ✅ {success}
                </p>
                <p style={styles.successSubtext}>
                  Please check your email inbox (and spam folder) for the password reset link.
                </p>
              </div>
            )}
            
            <button 
              type="submit" 
              style={{
                ...styles.button,
                ...(loading ? styles.buttonLoading : {}),
              }}
              className="forgot-password-button"
              disabled={loading}
            >
              <span style={styles.buttonText}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </span>
            </button>

            <div style={styles.backToLoginContainer}>
              <button
                type="button"
                onClick={() => navigate('/login', { state: { animate: 'right', animateHero: 'left' } })}
                style={styles.backToLoginButton}
                className="forgot-password-back-to-login"
              >
                ← Back to Login
              </button>
            </div>
          </form>
        </div>
      </div>
      <div style={styles.leftSection} className={`forgot-password-right-section ${location.state?.animateHero === 'right' ? 'slide-in-right' : location.state?.animateHero === 'left' ? 'slide-in-left' : ''}`}>
        <div style={styles.backgroundOverlay}></div>
        <img src={background} alt="CTU Administration Building" style={styles.backgroundImage} className="forgot-password-background-image" />
        <div style={styles.leftContent}>
          <div style={{ marginTop: '-10rem' }}>
            <h2 style={styles.brandTitle} className="forgot-password-brand-title">WHERENAYOU : Connecting OJT's & Alumni Journeys</h2>
            <p style={styles.brandSubtitle}>Excellence in Technology Education</p>
          </div>
          <div style={styles.collaborationContainer} className="forgot-password-collaboration-container">
            <h3 style={styles.collaborationTitle} className="forgot-password-collaboration-title">IN COLLABORATION WITH</h3>
            <div style={styles.partnersContainer} className="forgot-password-partners-container">
              <div style={styles.partnerItem}>
                <div style={styles.partnerLogo} className="forgot-password-partner-logo">
                  <img src={ccictLogo} alt="CCICT Logo" style={styles.partnerLogoImage} className="forgot-password-partner-logo-image" />
                </div>
                <p style={styles.partnerName} className="forgot-password-partner-name">College of Computer, Information and Communications Technology</p>
              </div>
              <div style={styles.partnerItem}>
                <div style={styles.partnerLogo} className="forgot-password-partner-logo">
                  <img src={alumniLogo} alt="CTU MC Alumni Association Logo" style={styles.partnerLogoImage} className="forgot-password-partner-logo-image" />
                </div>
                <p style={styles.partnerName} className="forgot-password-partner-name">CTU - MC Alumni Association</p>
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
  // No standalone logo for this hero; using same heading layout as Login
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
    padding: '1.2rem',
    width: '100%',
    maxWidth: '500px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  backButton: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    color: 'white',
    fontSize: '1.5rem',
    cursor: 'pointer',
    marginRight: '1rem',
    padding: '0.5rem',
    borderRadius: '8px',
    transition: 'all 0.3s ease',
    backdropFilter: 'blur(10px)',
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
  subtitle: {
    fontSize: '0.9rem',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: '1rem',
    lineHeight: 1.4,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.8rem',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3rem',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: '0.2rem',
  },
  input: {
    padding: '0.6rem',
    borderRadius: '8px',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    background: '#ffffff',
    color: '#000000',
    fontSize: '0.85rem',
    transition: 'all 0.3s ease',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  errorContainer: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '6px',
    padding: '0.5rem',
    marginTop: '0.3rem',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: '0.8rem',
    margin: 0,
    textAlign: 'center',
  },
  successContainer: {
    background: 'rgba(34, 197, 94, 0.1)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    borderRadius: '6px',
    padding: '0.75rem',
    marginTop: '0.5rem',
  },
  successText: {
    color: '#bbf7d0',
    fontSize: '0.9rem',
    margin: '0 0 0.5rem 0',
    textAlign: 'center',
    fontWeight: '600',
  },
  successSubtext: {
    color: 'rgba(187, 247, 208, 0.8)',
    fontSize: '0.75rem',
    margin: 0,
    textAlign: 'center',
    lineHeight: '1.4',
  },
  backToLoginContainer: {
    marginTop: '1rem',
    textAlign: 'center',
  },
  backToLoginButton: {
    background: 'transparent',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '0.85rem',
    fontWeight: '400',
    padding: '0.5rem 1rem',
    border: 'none',
    cursor: 'pointer',
    transition: 'color 0.3s ease',
  },
  button: {
    background: 'linear-gradient(135deg, #ffffff 0%, #f0f8ff 100%)',
    color: '#003366',
    fontSize: '0.85rem',
    fontWeight: '600',
    padding: '0.6rem 1.2rem',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    marginTop: '0.3rem',
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
};

export default ForgotPassword;