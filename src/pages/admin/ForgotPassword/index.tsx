import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { api } from '../../../services/api';

const background = require('../../../images/ctu.jpg');

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    ctu_id: '',
    email: '',
    last_name: '',
    first_name: '',
    middle_name: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${api.defaults.baseURL}forgot-password/`, formData);
      
      if (response.data.success) {
        // Navigate to temporary password page with the generated password
        navigate('/temporary-password', { 
          state: { 
            tempPassword: response.data.temp_password,
            userName: response.data.user_name 
          } 
        });
      } else {
        setError(response.data.message || 'Failed to generate temporary password');
      }
    } catch (error: any) {
      console.error('Forgot password error:', error);
      if (error.response?.data?.message) {
        setError(error.response.data.message);
      } else if (error.response?.status === 404) {
        setError('Invalid credentials. Please check your information and try again.');
      } else if (error.response?.status === 403) {
        setError('Password reset is only available for alumni and OJT students.');
      } else {
        setError('Network error. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.leftSection}>
        <img src={background} alt="Background" style={styles.backgroundImage} />
      </div>
      <div style={styles.rightSection}>
        <div style={styles.contentWrapper}>
          <div style={styles.card}>
            <div style={styles.header}>
              <button 
                onClick={() => navigate('/login')}
                style={styles.backButton}
              >
                ←
              </button>
              <h1 style={styles.title}>Forgot Password</h1>
            </div>
            
            <p style={styles.subtitle}>
              Please enter your credentials to generate a temporary password
            </p>

            <form style={styles.form} onSubmit={handleSubmit}>
          <label htmlFor="ctu_id" style={styles.label}>
            CTU ID
          </label>
          <input
            type="text"
            id="ctu_id"
            name="ctu_id"
            placeholder="Enter your CTU ID"
            required
            value={formData.ctu_id}
            onChange={handleInputChange}
            style={styles.input}
          />

          <label htmlFor="email" style={styles.label}>
            EMAIL
          </label>
          <input
            type="email"
            id="email"
            name="email"
            placeholder="Enter your email"
            required
            value={formData.email}
            onChange={handleInputChange}
            style={styles.input}
          />

          <label htmlFor="last_name" style={styles.label}>
            LAST NAME
          </label>
          <input
            type="text"
            id="last_name"
            name="last_name"
            placeholder="Enter your last name"
            required
            value={formData.last_name}
            onChange={handleInputChange}
            style={styles.input}
          />

          <label htmlFor="first_name" style={styles.label}>
            FIRST NAME
          </label>
          <input
            type="text"
            id="first_name"
            name="first_name"
            placeholder="Enter your first name"
            required
            value={formData.first_name}
            onChange={handleInputChange}
            style={styles.input}
          />

          <label htmlFor="middle_name" style={styles.label}>
            MIDDLE NAME
          </label>
          <input
            type="text"
            id="middle_name"
            name="middle_name"
            placeholder="Enter your middle name"
            value={formData.middle_name}
            onChange={handleInputChange}
            style={styles.input}
          />

          {error && <p style={styles.errorText}>{error}</p>}
          
          <button 
            type="submit" 
            style={styles.button}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Confirm'}
          </button>
            </form>
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
  },
  leftSection: {
    width: '50%',
  },
  backgroundImage: {
    width: '100%',
    height: '100vh',
    objectFit: 'cover',
  },
  rightSection: {
    width: '50%',
    backgroundColor: '#1e3a8a',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    position: 'relative',
    overflowY: 'auto',
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 560,
  },
  card: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 24,
    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
    backdropFilter: 'blur(6px)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 16,
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
  subtitle: {
    fontSize: '0.95rem',
    marginBottom: 20,
    opacity: 0.95,
    lineHeight: 1.5,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },
  label: {
    marginBottom: 5,
    textAlign: 'left',
    fontWeight: 'bold',
    fontSize: '0.9rem',
    color: 'white',
  },
  input: {
    padding: 12,
    marginBottom: 18,
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.25)',
    backgroundColor: '#f5f7fa',
    width: '100%',
    fontSize: '1rem',
    boxSizing: 'border-box',
  },
  button: {
    backgroundColor: 'white',
    color: '#1e3a8a',
    fontSize: '1rem',
    fontWeight: 'bold',
    padding: 12,
    width: '100%',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    marginTop: 8,
    transition: 'opacity 0.2s, transform 0.05s',
  },
  errorText: {
    color: '#ff6b6b',
    marginBottom: 15,
    fontSize: '0.9rem',
    textAlign: 'center',
  },
};

export default ForgotPassword;
