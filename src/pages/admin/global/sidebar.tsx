import React from 'react';
import { FaChartBar, FaUser, FaUserCircle, FaTh, FaPowerOff } from 'react-icons/fa';
import { LuLocateFixed } from 'react-icons/lu';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
  const location = useLocation();

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
      padding: '12px 16px',
      cursor: 'pointer',
      textDecoration: 'none',
      color: 'white',
    },
  };

  const links = [
    { to: '/dashboard', label: 'Dashboard', icon: <FaTh style={styles.icon} /> },
    { to: '/statistics', label: 'Statistics', icon: <FaChartBar style={styles.icon} /> },
    { to: '/users', label: 'Users', icon: <FaUser style={styles.icon} /> },
    { to: '/ccict/dashboard', label: 'Profile', icon: <FaUserCircle style={styles.icon} /> },
    { to: '/tracker', label: 'Tracker', icon: <LuLocateFixed style={styles.icon} /> },
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
                {link.icon} {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <Link to="/logout" style={styles.logout}>
        <FaPowerOff style={styles.icon} /> Logout
      </Link>
    </div>
  );
};

export default Sidebar;
