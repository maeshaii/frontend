import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaChartBar, FaUser, FaUserCircle, FaTh, FaPowerOff, FaFileImport } from 'react-icons/fa';
import Statistics from './statistics';
import DetailsTable from './detailstable'; // ✅ Your new table component
import { fetchOJTStatistics, importOJT } from '../../services/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [batchYear, setBatchYear] = useState('');
  const [course, setCourse] = useState('BSIT');
  const [ojtYears, setOjtYears] = useState<{ year: number; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [importLoading, setImportLoading] = useState(false);
  const [coordinatorUsername, setCoordinatorUsername] = useState('');
  const [activePage, setActivePage] = useState('dashboard'); // 'dashboard' or 'imports'

  useEffect(() => {
    // Get coordinator username from localStorage
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      setCoordinatorUsername(userData.name || '');
    }

    const loadOJTData = async () => {
      try {
        console.log('Loading OJT data for coordinator:', coordinatorUsername);
        const data = await fetchOJTStatistics(coordinatorUsername);
        console.log('OJT data received:', data);
        setOjtYears(data.years || []);
      } catch (error) {
        console.error('Error loading OJT data:', error);
        setOjtYears([]);
      } finally {
        setLoading(false);
      }
    };

    if (coordinatorUsername) {
      loadOJTData();
    }
  }, [coordinatorUsername]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !batchYear) {
      alert('Please select a file and enter the batch year');
      return;
    }

    setImportLoading(true);
    try {
      const result = await importOJT(selectedFile, batchYear, course, coordinatorUsername);
      if (result.success) {
        alert('OJT import successful!');
        setShowModal(false);
        // Reload OJT data
        await refreshOJTData();
      } else {
        alert(result.message || 'OJT import failed');
      }
    } catch (error) {
      console.error('OJT import error:', error);
      alert('OJT import failed. Please try again.');
    } finally {
      setImportLoading(false);
    }
  };

  const refreshOJTData = async () => {
    setLoading(true);
    try {
      console.log('Refreshing OJT data for coordinator:', coordinatorUsername);
      const data = await fetchOJTStatistics(coordinatorUsername);
      console.log('Refreshed OJT data:', data);
      setOjtYears(data.years || []);
    } catch (error) {
      console.error('Error refreshing OJT data:', error);
      setOjtYears([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    // Clear localStorage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    // Navigate to login
    navigate('/login');
  };

  // Inline styles
  const styles = {
    container: {
      display: 'flex',
      height: '100vh',
      fontFamily: 'Arial, sans-serif',
    },
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
    main: {
      flex: 1,
      padding: '30px 50px',
      background: 'white',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    actions: {
      display: 'flex',
    },
    btn: {
      marginLeft: '10px',
      padding: '6px 16px',
      borderRadius: '9999px',
      border: 'none',
      cursor: 'pointer',
    },
    statsBtn: {
      marginLeft: '10px',
      padding: '6px 16px',
      borderRadius: '9999px',
      border: 'none',
      cursor: 'pointer',
      backgroundColor: '#164B87',
      color: 'white',
    },
    importBtn: {
      marginLeft: '10px',
      padding: '6px 16px',
      borderRadius: '9999px',
      border: 'none',
      cursor: 'pointer',
      backgroundColor: '#5A6DFE',
      color: 'white',
    },
    filter: {
      display: 'inline-block',
      backgroundColor: '#5A6DFE',
      color: 'white',
      border: 'none',
      borderRadius: '9999px',
      padding: '4px 12px',
      margin: '20px 0',
      cursor: 'pointer',
    },
    cards: {
      display: 'flex',
      gap: '30px',
      flexWrap: 'wrap' as const,
    },
    card: {
      backgroundColor: '#5A6DFE',
      borderRadius: '20px',
      padding: '20px',
      width: '200px',
      color: 'white',
      textAlign: 'left' as const,
      cursor: 'pointer',
    },
    cardImage: {
      backgroundColor: 'white',
      height: '100px',
      borderRadius: '0',
      marginBottom: '12px',
    },
    cardText: {
      fontSize: '12px',
      margin: '0',
    },
    modalOverlay: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(0, 0, 0, 0.4)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },
    modal: {
      background: '#a2d5db',
      borderRadius: '30px',
      padding: '30px 40px',
      width: '400px',
      maxWidth: '90%',
      textAlign: 'center' as const,
    },
    modalH2: {
      marginBottom: '20px',
      fontSize: '20px',
    },
    modalLabel: {
      display: 'block',
      textAlign: 'left' as const,
      margin: '10px 0 5px',
      fontWeight: '500',
    },
    modalInput: {
      width: '90%',
      maxWidth: '300px',
      padding: '12px 20px',
      border: 'none',
      borderRadius: '30px',
      margin: '0 auto 20px',
      display: 'block',
    },
    fileLabel: {
      width: '90%',
      maxWidth: '300px',
      display: 'block',
      margin: '0 auto 20px',
      padding: '12px 20px',
      background: 'white',
      borderRadius: '30px',
      cursor: 'pointer',
      textAlign: 'left' as const,
    },
    fileInput: {
      display: 'none',
    },
    modalActions: {
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: '10px',
    },
    addBtn: {
      background: '#e76f51',
      color: 'white',
      border: 'none',
      borderRadius: '10px',
      padding: '10px 30px',
      cursor: 'pointer',
    },
    cancelBtn: {
      background: '#ddd',
      border: '1px solid #333',
      borderRadius: '10px',
      padding: '10px 30px',
      cursor: 'pointer',
    },
  };

  const links = [
    { to: '/coordinator/dashboard', label: 'Dashboard', icon: <FaTh style={styles.icon} /> },
    { to: '/coordinator/imports', label: 'Imports', icon: <FaFileImport style={styles.icon} /> },
  ];

  return (
    <div style={styles.container}>
      {/* ===================== Sidebar ===================== */}
      <div style={styles.sidebar}>
        <div style={styles.topSection}>
          <div style={styles.logo}>
            <img src="/logo192.png" alt="Logo" style={styles.logoImage} />
            <h1 style={styles.logoText}>WhereNa You</h1>
          </div>

          <ul style={styles.navList}>
            {links.map((link) => (
              <li key={link.to}>
                <div
                  style={{
                    ...styles.navItem,
                    ...(link.label === 'Imports' && activePage === 'imports'
                      ? styles.activeNavItem
                      : {}),
                    ...(link.label === 'Dashboard' && activePage === 'dashboard'
                      ? styles.activeNavItem
                      : {}),
                  }}
                  onClick={() => {
                    if (link.label === 'Dashboard') {
                      setActivePage('dashboard');
                      setSelectedCard(null);
                    } else if (link.label === 'Imports') {
                      setActivePage('imports');
                      refreshOJTData();
                    }
                  }}
                >
                  {link.icon} {link.label}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div style={styles.logout} onClick={handleLogout}>
          <FaPowerOff style={styles.icon} /> Logout
        </div>
      </div>

      {/* ===================== Main Content ===================== */}
      <main style={styles.main}>
        <div style={styles.header}>
          <h1>OJT Imports</h1>
          <div style={styles.actions}>
            {activePage === 'imports' && (
              <>
                <button style={styles.statsBtn} onClick={() => setShowStats(!showStats)}>
                  {showStats ? 'Hide Statistics' : 'View Statistics'}
                </button>
                <button style={styles.importBtn} onClick={() => setShowModal(true)}>
                  Import OJT
                </button>
                <button
                  style={{ ...styles.importBtn, marginLeft: '10px' }}
                  onClick={refreshOJTData}
                >
                  Refresh
                </button>
              </>
            )}
          </div>
        </div>

        <button style={styles.filter}>BSIT</button>

        {/* ============== Cards OR Details Table OR Statistics ============== */}
        {!showStats ? (
          selectedCard ? (
            <DetailsTable onBack={() => setSelectedCard(null)} selectedYear={selectedCard} />
          ) : (
            <div style={styles.cards}>
              {loading ? (
                <div style={{ width: '100%', textAlign: 'center', padding: '20px' }}>
                  Loading OJT data...
                </div>
              ) : ojtYears.length === 0 ? (
                <div style={{ width: '100%', textAlign: 'center', padding: '20px' }}>
                  No OJT data found.
                </div>
              ) : (
                ojtYears.map((yearData) => (
                  <div
                    key={yearData.year}
                    style={styles.card}
                    onClick={() => setSelectedCard(yearData.year)}
                  >
                    <div style={styles.cardImage}></div>
                    <p style={styles.cardText}>CLASS OF {yearData.year}</p>
                    <p style={styles.cardText}>Alumni: {yearData.count}</p>
                  </div>
                ))
              )}
            </div>
          )
        ) : (
          <Statistics />
        )}
      </main>

      {/* ===================== Modal ===================== */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalH2}>Import OJT Training Data</h2>

            <label style={styles.modalLabel}>Batch Graduated</label>
            <input
              type="text"
              placeholder="Enter batch year..."
              style={styles.modalInput}
              value={batchYear}
              onChange={(e) => setBatchYear(e.target.value)}
            />

            <label style={styles.modalLabel}>Course</label>
            <select
              style={styles.modalInput}
              value={course}
              onChange={(e) => setCourse(e.target.value)}
            >
              <option value="BSIT">BSIT</option>
              <option value="BSCS">BSCS</option>
              <option value="BSIS">BSIS</option>
            </select>

            <label style={styles.modalLabel}>Upload File</label>
            <label style={styles.fileLabel}>
              {selectedFile ? selectedFile.name : 'Choose File'}
              <input
                type="file"
                onChange={handleFileChange}
                style={styles.fileInput}
                accept=".xlsx,.xls"
              />
            </label>

            <div style={styles.modalActions}>
              <button style={styles.addBtn} onClick={handleImport} disabled={importLoading}>
                {importLoading ? 'Importing...' : 'Import'}
              </button>
              <button
                style={styles.cancelBtn}
                onClick={() => setShowModal(false)}
                disabled={importLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
