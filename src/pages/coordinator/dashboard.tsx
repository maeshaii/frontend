import React, { useState, useEffect } from 'react';
import ConfirmModal from '../../components/ConfirmModal';
import { useNavigate } from 'react-router-dom';
import { FaChartBar, FaUser, FaUserCircle, FaTh, FaPowerOff, FaFileImport } from 'react-icons/fa';
import Statistics from './statistics';
import DetailsTable from './detailstable'; // ✅ Your new table component
import { fetchOJTStatistics, importOJT, fetchCoordinatorSections } from '../../services/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [selectedCard, setSelectedCard] = useState<{ year: number; section?: string } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [batchYear, setBatchYear] = useState('');
  const [section, setSection] = useState('');
  const [course, setCourse] = useState('BSIT');
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [ojtYears, setOjtYears] = useState<{ year: number; section?: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [importLoading, setImportLoading] = useState(false);
  const [coordinatorUsername, setCoordinatorUsername] = useState('');
  const [activePage, setActivePage] = useState('dashboard'); // 'dashboard' or 'imports'
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('ALL');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('ALL');
  const [showDateModal, setShowDateModal] = useState(false);
  const [sendDate, setSendDate] = useState('');

  useEffect(() => {
    // Get coordinator username from localStorage
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      setCoordinatorUsername(userData.name || '');
    }
  }, []);

  useEffect(() => {
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

    const loadCoordinatorSections = async () => {
      try {
        console.log('Loading sections for coordinator:', coordinatorUsername);
        const data = await fetchCoordinatorSections(coordinatorUsername);
        if (data.success) {
          setAvailableSections(data.sections || []);
          console.log('Coordinator sections loaded:', data.sections);
        }
      } catch (error) {
        console.error('Error loading coordinator sections:', error);
        setAvailableSections([]);
      }
    };

    if (coordinatorUsername) {
      loadOJTData();
      loadCoordinatorSections();
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
    if (!selectedFile || !batchYear || !section) {
      alert('Please select a file, enter the batch year, and choose a section');
      return;
    }

    setImportLoading(true);
    try {
      const result = await importOJT(selectedFile, batchYear, course, coordinatorUsername, section);
      if (result.success) {
        alert(`OJT import successful for section ${section}!`);
        setShowModal(false);
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
      const data = await fetchOJTStatistics();
      console.log('Refreshed OJT data:', data);
      setOjtYears(data.years || []);
      
      // Also refresh coordinator sections
      const sectionsData = await fetchCoordinatorSections(coordinatorUsername);
      if (sectionsData.success) {
        setAvailableSections(sectionsData.sections || []);
        console.log('Refreshed coordinator sections:', sectionsData.sections);
      }
    } catch (error) {
      console.error('Error refreshing OJT data:', error);
      setOjtYears([]);
    } finally {
      setLoading(false);
    }
  };

  const downloadOJTTemplate = () => {
    // Build CSV template with exact columns shown in the screenshot
    const headers = [
      'CTU_ID',
      'First_Name',
      'Middle_Name',
      'Last_Name',
      'Gender',
      'Birthdate',
      'Contact_No',
      'Email',
      'Address',
      'Course',
      'Section',
      'Company',
      'Start_Date',
      'End_Date',
      'Status',
    ];

    // Only headers, no sample data rows
    const csvLines = [headers.join(',')];
    const csvContent = csvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ojt_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const handleLogout = () => {
    setShowLogoutConfirm(true);
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
    headerSearchInput: {
      padding: '10px 14px',
      borderRadius: '9999px',
      border: '1px solid #E5E7EB',
      width: '360px',
      background: '#F6FAFF',
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
    { to: `/coordinator/dashboard/${coordinatorUsername}`, label: 'Dashboard', icon: <FaTh style={styles.icon} /> },
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
            {activePage === 'imports' && !selectedCard && (
              <>
                <button style={styles.importBtn} onClick={() => setShowModal(true)}>
                  Import OJT
                </button>
                <button
                  style={{ ...styles.importBtn, marginLeft: '10px' }}
                  onClick={downloadOJTTemplate}
                >
                  Download Template
                </button>
                <button
                  style={{ 
                    ...styles.importBtn, 
                    marginLeft: '10px',
                    backgroundColor: '#10B981',
                    borderColor: '#10B981'
                  }}
                  onClick={() => setShowDateModal(true)}
                >
                  Set Send Date
                </button>
              </>
            )}
            {/* Header search removed */}
          </div>
        </div>

        {/* Filters */}
        {!showStats && !selectedCard && (
          <div style={{ 
            display: 'flex', 
            gap: '24px', 
            marginBottom: '24px', 
            alignItems: 'center',
            padding: '16px 0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ 
                fontWeight: 600, 
                color: '#1e3a8a', 
                fontSize: '15px',
                minWidth: '120px'
              }}>
                Filter by Batch:
              </label>
              <select
                value={selectedBatchFilter}
                onChange={(e) => setSelectedBatchFilter(e.target.value)}
                style={{ 
                  padding: '10px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: 12,
                  minWidth: 150,
                  fontSize: '14px',
                  backgroundColor: 'white',
                  color: '#374151',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#5A6DFE';
                  e.target.style.boxShadow = '0 4px 12px rgba(90, 109, 254, 0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                }}
              >
                <option value="ALL">All Batches</option>
                {Array.from(new Set(ojtYears.map(y => y.year))).sort((a, b) => b - a).map(year => (
                  <option key={year} value={year.toString()}>{year}</option>
                ))}
              </select>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ 
                fontWeight: 600, 
                color: '#1e3a8a', 
                fontSize: '15px',
                minWidth: '120px'
              }}>
                Filter by Section:
              </label>
              <select
                value={selectedSectionFilter}
                onChange={(e) => setSelectedSectionFilter(e.target.value)}
                style={{ 
                  padding: '10px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: 12,
                  minWidth: 150,
                  fontSize: '14px',
                  backgroundColor: 'white',
                  color: '#374151',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#5A6DFE';
                  e.target.style.boxShadow = '0 4px 12px rgba(90, 109, 254, 0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                }}
              >
                <option value="ALL">All Sections</option>
                {Array.from(new Set(ojtYears.map(y => y.section).filter(s => s))).sort().map(section => (
                  <option key={section} value={section}>{section}</option>
                ))}
              </select>
            </div>
            
            <button style={{
              ...styles.filter,
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: 12
            }}>
              BSIT
            </button>
          </div>
        )}

        {/* ============== Cards OR Details Table OR Statistics ============== */}
        {!showStats ? (
          selectedCard ? (
            <DetailsTable 
              onBack={() => setSelectedCard(null)} 
              selectedYear={selectedCard.year}
              selectedSection={selectedCard.section}
            />
          ) : (
            <div style={styles.cards}>
              {loading ? (
                <div style={{ width: '100%', textAlign: 'center', padding: '20px' }}>
                  Loading OJT data...
                </div>
              ) : ojtYears.filter(yearData => {
                const batchMatch = selectedBatchFilter === 'ALL' || yearData.year.toString() === selectedBatchFilter;
                const sectionMatch = selectedSectionFilter === 'ALL' || yearData.section === selectedSectionFilter;
                return batchMatch && sectionMatch;
              }).length === 0 ? (
                <div style={{ width: '100%', textAlign: 'center', padding: '20px' }}>
                  No OJT data found for the selected filters.
                </div>
              ) : (
                ojtYears.filter(yearData => {
                  const batchMatch = selectedBatchFilter === 'ALL' || yearData.year.toString() === selectedBatchFilter;
                  const sectionMatch = selectedSectionFilter === 'ALL' || yearData.section === selectedSectionFilter;
                  return batchMatch && sectionMatch;
                }).map((yearData) => (
                  <div
                    key={`${yearData.year}-${yearData.section || 'default'}`}
                    style={styles.card}
                    onClick={() => setSelectedCard({ year: yearData.year, section: yearData.section })}
                  >
                    <div style={styles.cardImage}></div>
                    <p style={styles.cardText}>CLASS OF {yearData.year}</p>
                    {yearData.section && <p style={styles.cardText}>Section: {yearData.section}</p>}
                    <p style={styles.cardText}>OJT: {yearData.count}</p>
                  </div>
                ))
              )}
            </div>
          )
        ) : (
          <Statistics />
        )}
      </main>

      {/* ===================== Logout Confirm Modal ===================== */}
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

      {/* ===================== Modal ===================== */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalH2}>Import OJT Training Data</h2>

            <label style={styles.modalLabel}>Batch Graduated</label>
            <input
              type="number"
              placeholder="Enter batch year..."
              style={styles.modalInput}
              value={batchYear}
              onChange={(e) => setBatchYear(e.target.value)}
              min="2000"
              max="2030"
            />

            <label style={styles.modalLabel}>Section to Import</label>
            <input
              type="text"
              placeholder="Enter section (e.g., 4-A, 4-B, 4-1, etc.)..."
              style={styles.modalInput}
              value={section}
              onChange={(e) => setSection(e.target.value)}
              list="section-options"
            />
            <datalist id="section-options">
              {availableSections.map((sectionOption) => (
                <option key={sectionOption} value={sectionOption}>
                  {sectionOption}
                </option>
              ))}
            </datalist>
            {availableSections.length === 0 && (
              <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                No previous sections found. You can type any section name.
              </div>
            )}

            {/* Course selection removed; default course state will be used */}

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
                onClick={() => {
                  setShowModal(false);
                  // Reset form state
                  setSelectedFile(null);
                  setBatchYear('');
                  setSection('');
                }}
                disabled={importLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Date Modal for Setting Send Date */}
      {showDateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
            width: '400px',
            maxWidth: '90vw'
          }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#1e3a8a' }}>
              Set Date to Send Completed OJT to Admin
            </h3>
            <p style={{ margin: '0 0 15px 0', color: '#6b7280', fontSize: '14px' }}>
              Choose a date when:
            </p>
            <ul style={{ margin: '0 0 15px 0', color: '#6b7280', fontSize: '14px', paddingLeft: '20px' }}>
              <li>All students with "Completed" status will be sent to admin for approval</li>
              <li>All students with "Ongoing" status will be changed to "Incomplete"</li>
            </ul>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151' }}>
                Send Date:
              </label>
              <input
                type="date"
                value={sendDate}
                onChange={(e) => setSendDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none'
                }}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowDateModal(false);
                  setSendDate('');
                }}
                style={{
                  padding: '10px 20px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  color: '#6b7280',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (sendDate) {
                    // TODO: Implement the actual functionality to set the send date
                    alert(`Send date set to: ${sendDate}\n\nOn this date:\n• All completed OJT students will be sent to admin\n• All ongoing students will be marked as incomplete`);
                    setShowDateModal(false);
                    setSendDate('');
                  } else {
                    alert('Please select a date');
                  }
                }}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: '#10B981',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Set Date
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
