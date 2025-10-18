import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ConfirmModal from '../../../components/ConfirmModal';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const styles = {
    sidebar: {
      width: '220px',
      height: '100vh',
      backgroundColor: '#1e4c7a',
      display: 'flex',
      flexDirection: 'column' as const,
      justifyContent: 'space-between',
      color: 'white',
      padding: '20px 10px',
      position: 'fixed' as const,
      top: 0,
      left: 0,
      zIndex: 1000,
    },
    topSection: {
      display: 'flex',
      flexDirection: 'column' as const,
    },
    logo: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      marginBottom: '20px',
    },
    logoImage: {
      width: '80px',
      height: '80px',
      borderRadius: '50%',
    },
    logoText: {
      fontSize: '14px',
      marginTop: '8px',
      textAlign: 'center' as const,
      fontWeight: 'bold' as const,
    },
    navList: {
      listStyleType: 'none' as const,
      padding: 0,
      margin: 0,
    },
    navItem: {
      display: 'flex',
      alignItems: 'center',
      padding: '12px 16px',
      margin: '8px 0',
      cursor: 'pointer',
      borderRadius: '8px',
      transition: 'background 0.3s',
      textDecoration: 'none',
      color: 'white',
    },
    activeNavItem: {
      backgroundColor: '#406b94',
    },
    icon: {
      marginRight: '12px',
      fontSize: '18px',
    },
    logout: {
      display: 'flex',
      alignItems: 'center',
      padding: '32px 32px',
      cursor: 'pointer',
      textDecoration: 'none',
      color: 'white',
      marginBottom: '24px',
    },
  };

  const links = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/statistics', label: 'Statistics' },
    { to: '/users', label: 'Users' },
    { to: '/user-management', label: 'User Management' },
    { to: '/ccict/profile', label: 'Profile' },
    { to: '/tracker', label: 'Tracker' },
    { to: '/requests', label: 'Requests' },
    { to: '/rewards', label: 'Rewards' },
  ];

  return (
    <div style={styles.sidebar}>
      <div style={styles.topSection}>
        <div style={styles.logo}>
          <img src="/logo192.png" alt="Logo" style={styles.logoImage} />
          <h1 style={styles.logoText}>WhereNa You</h1>
        </div>

        <ul style={styles.navList}>
          {links.map((link) => (
            <li key={link.to}>
              <Link
                to={link.to}
                style={{
                  ...styles.navItem,
                  ...(location.pathname === link.to ? styles.activeNavItem : {}),
                }}
              >
                {link.to === '/dashboard' && <span style={styles.icon}>📊</span>}
                {link.to === '/statistics' && <span style={styles.icon}>📈</span>}
                {link.to === '/users' && <span style={styles.icon}>👥</span>}
                {link.to === '/user-management' && <span style={styles.icon}>⚙️</span>}
                {link.to === '/ccict/profile' && <span style={styles.icon}>👤</span>}
                {link.to === '/tracker' && <span style={styles.icon}>📍</span>}
                {link.to === '/requests' && <span style={styles.icon}>📨</span>}
                {link.to === '/rewards' && <span style={styles.icon}>🎁</span>}
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <a
        href="#"
        style={styles.logout}
        onClick={(e) => {
          e.preventDefault();
          setShowLogoutConfirm(true);
        }}
      >
        <span style={styles.icon}>🚪</span> Logout
      </a>

      <ConfirmModal
        open={showLogoutConfirm}
        title="Log out"
        message="Are you sure you want to log out?"
        confirmText="Yes"
        cancelText="Cancel"
        onConfirm={() => {
          setShowLogoutConfirm(false);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          navigate('/login');
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
};

export default Sidebar;
