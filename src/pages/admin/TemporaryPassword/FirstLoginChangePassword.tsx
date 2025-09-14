import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { changePassword } from '../../../services/api';

const FirstLoginChangePassword: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const username = (location.state as any)?.acc_username;

  const strength = useMemo(() => {
    const s = { score: 0, message: '' } as { score: number; message: string };
    const val = newPassword;
    let score = 0;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[a-z]/.test(val)) score++;
    if (/\d/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    s.score = score;
    if (score <= 2) s.message = 'Weak';
    else if (score === 3 || score === 4) s.message = 'Medium';
    else s.message = 'Strong';
    return s;
  }, [newPassword]);

  const canSubmit = strength.score >= 5 && newPassword === confirmPassword && oldPassword.length > 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!canSubmit) {
      setError('Please provide a strong password and confirm it.');
      return;
    }
    const resp = await changePassword(oldPassword, newPassword);
    if (resp.success) {
      setSuccess('Password changed. Please login again.');
      // Clear tokens to force fresh login
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setTimeout(() => navigate('/login'), 800);
    } else {
      setError(resp.message || 'Failed to change password');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.leftSection}>
        <div style={styles.card}>
        <div style={styles.headerRow}><button onClick={() => navigate('/login')} style={styles.backBtn}>←</button><h1 style={styles.title}>First Time Log In</h1></div>
        <p style={styles.subtitle}>Please change your temporary password to continue.</p>
        <form onSubmit={onSubmit} style={styles.form}>
          <label style={styles.label}>Old Password</label>
          <div style={styles.inputWrap}>
            <input type={showOld ? 'text' : 'password'} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} style={styles.input} />
            <button type="button" onClick={() => setShowOld((s) => !s)} style={styles.eyeBtn}>{showOld ? '🙈' : '👁️'}</button>
          </div>
          <label style={styles.label}>New Password</label>
          <div style={styles.inputWrap}>
            <input type={showNew ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={styles.input} />
            <button type="button" onClick={() => setShowNew((s) => !s)} style={styles.eyeBtn}>{showNew ? '🙈' : '👁️'}</button>
          </div>
          <div style={styles.hint}>Must be 10+ chars with upper, lower, number, and symbol.</div>
          <div style={styles.strength}>Strength: {strength.message}</div>
          <label style={styles.label}>Confirm Password</label>
          <div style={styles.inputWrap}>
            <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={styles.input} />
            <button type="button" onClick={() => setShowConfirm((s) => !s)} style={styles.eyeBtn}>{showConfirm ? '🙈' : '👁️'}</button>
          </div>
          {error && <div style={styles.error}>{error}</div>}
          {success && <div style={styles.success}>{success}</div>}
          <button type="submit" style={{ ...styles.button, opacity: canSubmit ? 1 : 0.6 }} disabled={!canSubmit}>Confirm</button>
        </form>
        </div>
      </div>
      <div style={styles.rightSection}>
        <img src={require('../../../images/ctu.jpg')} alt="CTU" style={styles.backgroundImage} />
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', height: '100vh', fontFamily: 'Arial, sans-serif' },
  leftSection: { width: '50%', backgroundColor: '#1e3a8a', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24, alignItems: 'center' },
  rightSection: { width: '50%' },
  backgroundImage: { width: '100%', height: '100vh', objectFit: 'cover' },
  card: { width: '100%', maxWidth: 560, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16, padding: 24, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', backdropFilter: 'blur(6px)' },
  headerRow: { display: 'flex', alignItems: 'center', marginBottom: 12 },
  backBtn: { background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer', marginRight: 12, padding: 5 },
  title: { fontSize: '1.5rem', fontWeight: 'bold', margin: 0 },
  subtitle: { fontSize: '0.95rem', marginBottom: 16, opacity: 0.95, lineHeight: 1.5 },
  form: { width: '100%', display: 'flex', flexDirection: 'column', gap: 8 },
  label: { marginBottom: 5, color: '#ffffff', fontWeight: 700 },
  inputWrap: { position: 'relative' },
  input: { padding: 12, marginBottom: 14, borderRadius: 8, border: '1px solid  rgba(255,255,255,0.25)', backgroundColor: '#ffffff', width: '100%', paddingRight: 40, boxSizing: 'border-box', color: '#0f172a' },
  eyeBtn: { position: 'absolute', right: 8, top: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 },
  hint: { fontSize: 12, opacity: 0.9, marginBottom: 8 },
  strength: { fontSize: 12, marginBottom: 10 },
  button: { backgroundColor: 'white', color: '#1e3a8a', fontWeight: 'bold', padding: 14, borderRadius: 12, border: 'none', cursor: 'pointer', width: '100%', boxShadow: '0 6px 16px rgba(0,0,0,0.25)', position: 'relative', zIndex: 1 },
  error: { color: '#ffadad', marginTop: 6 },
  success: { color: '#b2f2bb', marginTop: 6 },
};

export default FirstLoginChangePassword;


