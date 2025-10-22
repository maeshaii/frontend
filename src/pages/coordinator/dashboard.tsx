import React, { useState, useEffect } from 'react';
import ConfirmModal from '../../components/ConfirmModal';
import { useNavigate } from 'react-router-dom';
import Statistics from './statistics';
import DetailsTable from './detailstable'; // ✅ Your new table component
import { fetchOJTStatistics, importOJT, fetchCoordinatorSections, setSendDate } from '../../services/api';
import logoLogin from '../../images/logo_login.png';

export default function Dashboard() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [selectedCard, setSelectedCard] = useState<{ year: number; section?: string } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [program, setProgram] = useState('BSIT');
  // Generate years from 2000 to 2025 (descending order)
  const availableYears = Array.from({ length: 26 }, (_, i) => 2025 - i);
  const [ojtYears, setOjtYears] = useState<{ year: number; section?: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [importLoading, setImportLoading] = useState(false);
  const [coordinatorUsername, setCoordinatorUsername] = useState('');
  const [activePage, setActivePage] = useState('dashboard'); // 'dashboard' or 'imports'
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('ALL');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('ALL');
  const [showDateModal, setShowDateModal] = useState(false);
  const [sendDate, setSendDateState] = useState('');

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

    const loadAvailableYears = async () => {
      // Years are now generated locally, no API call needed
      console.log('Using fixed year range: 2000-2025');
    };

    if (coordinatorUsername) {
      loadOJTData();
      loadAvailableYears();
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
    if (!selectedFile || !selectedYear) {
      alert('Please select a file and choose a graduation year');
      return;
    }

    setImportLoading(true);
    try {
      const result = await importOJT(selectedFile, selectedYear.toString(), program, coordinatorUsername);
      if (result.success) {
        alert(`OJT import successful! Found ${result.sections?.length || 0} sections.`);
        
        // Handle password download if passwords were generated
        if (result.passwords && result.passwords.length > 0) {
          downloadPasswords(result.passwords);
        }
        
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

  const downloadPasswords = (passwords: any[]) => {
    // Create CSV content
    const csvContent = [
      'CTU_ID,First_Name,Last_Name,Password',
      ...passwords.map(p => `${p.CTU_ID},"${p.First_Name}","${p.Last_Name}","${p.Password}"`)
    ].join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `ojt_passwords_${selectedYear}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const refreshOJTData = async () => {
    setLoading(true);
    try {
      console.log('Refreshing OJT data for coordinator:', coordinatorUsername);
      const data = await fetchOJTStatistics(coordinatorUsername);
      console.log('Refreshed OJT data:', data);
      setOjtYears(data.years || []);
      
      // Also refresh available years
      console.log('Using fixed year range: 2000-2025');
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
      borderRadius: '8px',
      background: 'white',
      padding: '8px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
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
    { to: `/coordinator/dashboard/${coordinatorUsername}`, label: 'Dashboard' },
    { to: '/coordinator/imports', label: 'Imports' },
  ];

  return (
    <div style={styles.container}>
      {/* ===================== Sidebar ===================== */}
      <div style={styles.sidebar}>
        <div style={styles.topSection}>
          <div style={styles.logo}>
            <img src={logoLogin} alt="Logo" style={styles.logoImage} />
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
                  {link.label}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div style={styles.logout} onClick={handleLogout}>
          <span style={styles.icon}>🚪</span> Logout
        </div>
      </div>

      {/* ===================== Modern Main Content ===================== */}
      <main style={{
        flex: 1,
        padding: '32px',
        backgroundColor: '#f8fafc',
        minHeight: '100vh',
        overflowY: 'auto' as const
      }}>

        {/* Modern Filters */}
        {!showStats && !selectedCard && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '32px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'flex-start',
            gap: '24px', 
              flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div>
              <label style={{ 
                    fontWeight: '600',
                    color: '#374151',
                    fontSize: '14px',
                    display: 'block',
                    marginBottom: '4px'
                  }}>
                    Filter by Batch
              </label>
              <select
                value={selectedBatchFilter}
                onChange={(e) => setSelectedBatchFilter(e.target.value)}
                style={{ 
                      padding: '12px 16px',
                  border: '2px solid #e5e7eb',
                      borderRadius: '12px',
                      minWidth: '180px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  color: '#374151',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                      fontWeight: '500'
                }}
                onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                }}
              >
                <option value="ALL">All Batches</option>
                {Array.from(new Set(ojtYears.map(y => y.year))).sort((a, b) => b - a).map(year => (
                  <option key={year} value={year.toString()}>{year}</option>
                ))}
              </select>
                </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div>
              <label style={{ 
                    fontWeight: '600',
                    color: '#374151',
                    fontSize: '14px',
                    display: 'block',
                    marginBottom: '4px'
                  }}>
                    Filter by Section
              </label>
              <select
                value={selectedSectionFilter}
                onChange={(e) => setSelectedSectionFilter(e.target.value)}
                style={{ 
                      padding: '12px 16px',
                  border: '2px solid #e5e7eb',
                      borderRadius: '12px',
                      minWidth: '180px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  color: '#374151',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                      fontWeight: '500'
                }}
                onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                }}
              >
                <option value="ALL">All Sections</option>
                {Array.from(new Set(ojtYears.map(y => y.section).filter(s => s))).sort().map(section => (
                  <option key={section} value={section}>{section}</option>
                ))}
              </select>
                </div>
            </div>
            
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div>
                  <label style={{
                    fontWeight: '600',
                    color: '#374151',
              fontSize: '14px',
                    display: 'block',
                    marginBottom: '4px'
                  }}>
                    Program
                  </label>
                  <div style={{
                    padding: '12px 20px',
                    backgroundColor: '#f0f9ff',
                    border: '2px solid #0ea5e9',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#0369a1',
                    minWidth: '100px',
                    textAlign: 'center'
            }}>
              BSIT
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                marginLeft: 'auto'
              }}>
                <button 
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.3)'
                  }}
                  onClick={() => setShowModal(true)}
                  onMouseEnter={(e) => {
                    const target = e.currentTarget as HTMLButtonElement;
                    target.style.backgroundColor = '#2563eb';
                    target.style.transform = 'translateY(-1px)';
                    target.style.boxShadow = '0 6px 8px -1px rgba(59, 130, 246, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    const target = e.currentTarget as HTMLButtonElement;
                    target.style.backgroundColor = '#3b82f6';
                    target.style.transform = 'translateY(0)';
                    target.style.boxShadow = '0 4px 6px -1px rgba(59, 130, 246, 0.3)';
                  }}
                >
                  Import OJT
                </button>
                <button
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#6366f1',
                    color: 'white',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.3)'
                  }}
                  onClick={downloadOJTTemplate}
                  onMouseEnter={(e) => {
                    const target = e.currentTarget as HTMLButtonElement;
                    target.style.backgroundColor = '#4f46e5';
                    target.style.transform = 'translateY(-1px)';
                    target.style.boxShadow = '0 6px 8px -1px rgba(99, 102, 241, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    const target = e.currentTarget as HTMLButtonElement;
                    target.style.backgroundColor = '#6366f1';
                    target.style.transform = 'translateY(0)';
                    target.style.boxShadow = '0 4px 6px -1px rgba(99, 102, 241, 0.3)';
                  }}
                >
                  Download Template
                </button>
                <button
                  style={{ 
                    padding: '12px 24px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.3)'
                  }}
                  onClick={() => setShowDateModal(true)}
                  onMouseEnter={(e) => {
                    const target = e.currentTarget as HTMLButtonElement;
                    target.style.backgroundColor = '#059669';
                    target.style.transform = 'translateY(-1px)';
                    target.style.boxShadow = '0 6px 8px -1px rgba(16, 185, 129, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    const target = e.currentTarget as HTMLButtonElement;
                    target.style.backgroundColor = '#10b981';
                    target.style.transform = 'translateY(0)';
                    target.style.boxShadow = '0 4px 6px -1px rgba(16, 185, 129, 0.3)';
                  }}
                >
                  Set Send Date
            </button>
              </div>
            </div>
          </div>
        )}

        {/* Modern Cards Grid */}
        {!showStats ? (
          selectedCard ? (
            <DetailsTable 
              onBack={() => setSelectedCard(null)} 
              selectedYear={selectedCard.year}
              selectedSection={selectedCard.section}
            />
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '24px',
              marginBottom: '32px'
            }}>
              {loading ? (
                <div style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  padding: '60px 20px',
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    backgroundColor: '#dbeafe',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px'
                  }}>
                  </div>
                  <p style={{
                    fontSize: '16px',
                    color: '#64748b',
                    margin: '0',
                    fontWeight: '500'
                  }}>
                  Loading OJT data...
                  </p>
                </div>
              ) : ojtYears.filter(yearData => {
                const batchMatch = selectedBatchFilter === 'ALL' || yearData.year.toString() === selectedBatchFilter;
                const sectionMatch = selectedSectionFilter === 'ALL' || yearData.section === selectedSectionFilter;
                return batchMatch && sectionMatch;
              }).length === 0 ? (
                <div style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  padding: '60px 20px',
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    backgroundColor: '#fef3c7',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px'
                  }}>
                    <span style={{ fontSize: '24px' }}>🔍</span>
                  </div>
                  <p style={{
                    fontSize: '16px',
                    color: '#64748b',
                    margin: '0',
                    fontWeight: '500'
                  }}>
                  No OJT data found for the selected filters.
                  </p>
                </div>
              ) : (
                ojtYears.filter(yearData => {
                  const batchMatch = selectedBatchFilter === 'ALL' || yearData.year.toString() === selectedBatchFilter;
                  const sectionMatch = selectedSectionFilter === 'ALL' || yearData.section === selectedSectionFilter;
                  return batchMatch && sectionMatch;
                }).map((yearData) => (
                  <div
                    key={`${yearData.year}-${yearData.section || 'default'}`}
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '20px',
                      padding: '24px',
                      boxShadow: '0 8px 16px -4px rgba(0, 0, 0, 0.1)',
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    onClick={() => setSelectedCard({ year: yearData.year, section: yearData.section })}
                    onMouseEnter={(e) => {
                      const target = e.currentTarget as HTMLDivElement;
                      target.style.transform = 'translateY(-4px)';
                      target.style.boxShadow = '0 16px 32px -8px rgba(0, 0, 0, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      const target = e.currentTarget as HTMLDivElement;
                      target.style.transform = 'translateY(0)';
                      target.style.boxShadow = '0 8px 16px -4px rgba(0, 0, 0, 0.1)';
                    }}
                  >
                    {/* Decorative gradient circle */}
                    <div style={{
                      position: 'absolute',
                      top: '-20px',
                      right: '-20px',
                      width: '80px',
                      height: '80px',
                      background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                      borderRadius: '50%',
                      opacity: '0.1'
                    }}></div>
                    
                    {/* Card content */}
                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: '20px'
                      }}>
                        <div>
                          <h3 style={{
                            fontSize: '20px',
                            fontWeight: '700',
                            color: '#1e293b',
                            margin: '0 0 4px 0',
                            letterSpacing: '-0.025em'
                          }}>
                            CLASS OF {yearData.year}
                          </h3>
                          {yearData.section && (
                            <p style={{
                              fontSize: '14px',
                              color: '#64748b',
                              margin: '0',
                              fontWeight: '500'
                            }}>
                              Section: {yearData.section}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div style={{
                        backgroundColor: '#f8fafc',
                        borderRadius: '12px',
                        padding: '16px',
                        border: '1px solid #e2e8f0'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <span style={{
                            fontSize: '14px',
                            color: '#64748b',
                            fontWeight: '500'
                          }}>
                            OJT Students
                          </span>
                          <span style={{
                            fontSize: '24px',
                            fontWeight: '800',
                            color: '#3b82f6'
                          }}>
                            {yearData.count}
                          </span>
                        </div>
                      </div>
                      
                      <div style={{
                        marginTop: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '8px',
                        backgroundColor: '#f0f9ff',
                        borderRadius: '8px',
                        border: '1px solid #bae6fd'
                      }}>
                        <span style={{
                          fontSize: '12px',
                          color: '#0369a1',
                          fontWeight: '600'
                        }}>
                          Click to view details →
                        </span>
                      </div>
                    </div>
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

      {/* Modern Import Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '24px',
            padding: '0',
            boxShadow: '0 32px 64px -12px rgba(0, 0, 0, 0.35)',
            width: '420px',
            maxWidth: '85vw',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            position: 'relative',
            animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            overflow: 'hidden'
          }}>
            {/* Gradient Header */}
            <div style={{
              background: 'white',
              padding: '32px 32px 24px 32px',
              color: '#1f2937',
              position: 'relative',
              borderBottom: '2px solid #e5e7eb'
            }}>
              {/* Close button */}
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedFile(null);
                  setSelectedYear(null);
                }}
                style={{
                  position: 'absolute',
                  top: '20px',
                  right: '20px',
                  background: '#f3f4f6',
                  border: '2px solid #e5e7eb',
                  fontSize: '20px',
                  color: '#6b7280',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '12px',
                  transition: 'all 0.2s ease',
                  backdropFilter: 'blur(10px)'
                }}
                onMouseEnter={(e) => {
                  const target = e.currentTarget as HTMLButtonElement;
                  target.style.backgroundColor = '#e5e7eb';
                  target.style.borderColor = '#d1d5db';
                    target.style.color = 'white';
                  target.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  const target = e.currentTarget as HTMLButtonElement;
                  target.style.backgroundColor = '#f3f4f6';
                  target.style.borderColor = '#e5e7eb';
                  target.style.color = '#6b7280';
                  target.style.transform = 'scale(1)';
                }}
              >
                ✕
              </button>

              {/* Header Content */}
              <div style={{ 
                marginBottom: '16px'
              }}>
                <h3 style={{ 
                  margin: '0 0 8px 0', 
                  fontSize: '24px',
                  fontWeight: '800',
                  lineHeight: '1.2',
                  letterSpacing: '-0.025em',
                  color: '#000000'
                }}>
                  Import OJT Data
                </h3>
                <p style={{ 
                  margin: '0', 
                  fontSize: '16px',
                  fontWeight: '500',
                  opacity: '0.9'
                }}>
                  Upload and process training data for students
                </p>
              </div>
            </div>

            {/* Content Area */}
            <div style={{ padding: '32px 40px 32px 28px' }}>
              {/* Form Fields */}
              <div style={{ marginBottom: '32px' }}>
                {/* Graduation Year Dropdown */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '600', 
                    color: '#374151',
                    fontSize: '14px'
                  }}>
                    Select Graduation Year:
                  </label>
                  <select
                    value={selectedYear || ''}
                    onChange={(e) => setSelectedYear(e.target.value ? parseInt(e.target.value) : null)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '15px',
                      color: '#374151',
                      backgroundColor: 'white',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      fontWeight: '500',
                      cursor: 'pointer',
                      appearance: 'none',
                      backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 12px center',
                      backgroundSize: '16px',
                      paddingRight: '40px'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <option value="" style={{ color: '#9ca3af' }}>Select graduation year</option>
                    {availableYears.map((year) => (
                      <option key={year} value={year} style={{ color: '#374151' }}>
                        {year}
                      </option>
                    ))}
                  </select>
                  <p style={{ 
                    margin: '8px 0 0 0', 
                    fontSize: '12px', 
                    color: '#64748b',
                    fontStyle: 'italic'
                  }}>
                    Sections will be automatically detected from the Excel file
                  </p>
                </div>

                {/* File Upload Field */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '700', 
                    color: '#1e293b',
                    fontSize: '14px'
                  }}>
                    Upload Excel File
                  </label>
                  <div style={{
                    border: '2px dashed #cbd5e1',
                    borderRadius: '12px',
                    padding: '24px',
                    textAlign: 'center',
                    backgroundColor: '#f8fafc',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    const target = e.currentTarget as HTMLDivElement;
                    target.style.borderColor = '#3b82f6';
                    target.style.backgroundColor = '#f0f9ff';
                  }}
                  onMouseLeave={(e) => {
                    const target = e.currentTarget as HTMLDivElement;
                    target.style.borderColor = '#cbd5e1';
                    target.style.backgroundColor = '#f8fafc';
                  }}
                  >
              <input
                type="file"
                onChange={handleFileChange}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'pointer'
                      }}
                accept=".xlsx,.xls"
              />
                    <div style={{
                      width: '48px',
                      height: '48px',
                      backgroundColor: '#dbeafe',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px'
                    }}>
                      <span style={{ fontSize: '24px', color: '#3b82f6' }}>📄</span>
                    </div>
                    <p style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#374151',
                      margin: '0 0 4px 0'
                    }}>
                      {selectedFile ? selectedFile.name : 'Choose Excel File'}
                    </p>
                    <p style={{
                      fontSize: '14px',
                      color: '#64748b',
                      margin: '0'
                    }}>
                      Click to browse or drag and drop
                    </p>
                    <p style={{
                      fontSize: '12px',
                      color: '#9ca3af',
                      margin: '8px 0 0 0'
                    }}>
                      Supports .xlsx and .xls files
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ 
                display: 'flex', 
                gap: '16px', 
                justifyContent: 'flex-end' 
              }}>
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedFile(null);
                  setSelectedYear(null);
                }}
                disabled={importLoading}
                  style={{
                    padding: '14px 28px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '12px',
                    backgroundColor: 'white',
                    color: '#64748b',
                    cursor: importLoading ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    fontSize: '15px',
                    transition: 'all 0.3s ease',
                    opacity: importLoading ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!importLoading) {
                      const target = e.currentTarget as HTMLButtonElement;
                      target.style.borderColor = '#cbd5e1';
                      target.style.backgroundColor = '#f1f5f9';
                      target.style.transform = 'translateY(-2px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!importLoading) {
                      const target = e.currentTarget as HTMLButtonElement;
                      target.style.borderColor = '#e2e8f0';
                      target.style.backgroundColor = 'white';
                      target.style.transform = 'translateY(0)';
                    }
                  }}
              >
                Cancel
              </button>
                <button
                  onClick={handleImport}
                  disabled={importLoading || !selectedFile || !selectedYear}
                  style={{
                    padding: '14px 28px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    background: importLoading || !selectedFile || !selectedYear 
                      ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'
                      : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: 'white',
                    cursor: importLoading || !selectedFile || !selectedYear ? 'not-allowed' : 'pointer',
                    fontWeight: '700',
                    fontSize: '15px',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    if (!importLoading && selectedFile && selectedYear) {
                      const target = e.currentTarget as HTMLButtonElement;
                      target.style.transform = 'translateY(-2px)';
                      target.style.boxShadow = '0 8px 16px -4px rgba(245, 158, 11, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!importLoading && selectedFile && selectedYear) {
                      const target = e.currentTarget as HTMLButtonElement;
                      target.style.transform = 'translateY(0)';
                      target.style.boxShadow = '0 4px 6px -1px rgba(245, 158, 11, 0.3)';
                    }
                  }}
                >
                  {importLoading ? (
                    <>
                      Importing...
                    </>
                  ) : (
                    <>
                      Import Data
                    </>
                  )}
              </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modern Redesigned Modal */}
      {showDateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '24px',
            padding: '0',
            boxShadow: '0 32px 64px -12px rgba(0, 0, 0, 0.35)',
            width: '520px',
            maxWidth: '95vw',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            position: 'relative',
            animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            overflow: 'hidden'
          }}>
            {/* Gradient Header */}
            <div style={{
              background: 'white',
              padding: '32px 32px 24px 32px',
              color: '#1f2937',
              position: 'relative',
              borderBottom: '2px solid #e5e7eb'
            }}>
              {/* Close button */}
              <button
                onClick={() => {
                  setShowDateModal(false);
                  setSendDateState('');
                }}
                style={{
                  position: 'absolute',
                  top: '20px',
                  right: '20px',
                  background: '#f3f4f6',
                  border: '2px solid #e5e7eb',
                  fontSize: '20px',
                  color: '#6b7280',
                  cursor: 'pointer',
                  padding: '8px',
            borderRadius: '12px',
                  transition: 'all 0.2s ease',
                  backdropFilter: 'blur(10px)'
                }}
                onMouseEnter={(e) => {
                  const target = e.currentTarget as HTMLButtonElement;
                  target.style.backgroundColor = '#e5e7eb';
                  target.style.borderColor = '#d1d5db';
                    target.style.color = 'white';
                  target.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  const target = e.currentTarget as HTMLButtonElement;
                  target.style.backgroundColor = '#f3f4f6';
                  target.style.borderColor = '#e5e7eb';
                  target.style.color = '#6b7280';
                  target.style.transform = 'scale(1)';
                }}
              >
                ✕
              </button>

              {/* Header Content */}
              <div style={{ 
                marginBottom: '16px'
              }}>
                <h3 style={{ 
                  margin: '0 0 8px 0', 
                  fontSize: '24px',
                  fontWeight: '800',
                  lineHeight: '1.2',
                  letterSpacing: '-0.025em',
                  color: 'white'
                }}>
                  Auto-Process Batch
            </h3>
                <p style={{ 
                  margin: '0', 
                  fontSize: '16px',
                  fontWeight: '500',
                  opacity: '0.9'
                }}>
                  Schedule automatic processing for batch {selectedBatchFilter}
                </p>
              </div>
            </div>

            {/* Content Area */}
            <div style={{ padding: '32px' }}>
              {/* Process Overview Card */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '28px',
                position: 'relative',
                overflow: 'hidden'
              }}>
                
                <div style={{ 
                  marginBottom: '16px' 
                }}>
                  <span style={{ 
                    fontWeight: '700', 
                    color: '#1e293b',
                    fontSize: '16px'
                  }}>
                    Processing Actions
                  </span>
                </div>
                
                <div style={{ paddingLeft: '52px' }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    marginBottom: '12px',
                    fontSize: '15px',
                    color: '#475569'
                  }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      backgroundColor: '#10b981',
                      borderRadius: '50%',
                      marginRight: '16px',
                      boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.2)'
                    }}></div>
                    <span><strong style={{ color: '#059669' }}>Completed</strong> students → Sent to admin</span>
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    marginBottom: '12px',
                    fontSize: '15px',
                    color: '#475569'
                  }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      backgroundColor: '#f59e0b',
                      borderRadius: '50%',
                      marginRight: '16px',
                      boxShadow: '0 0 0 3px rgba(245, 158, 11, 0.2)'
                    }}></div>
                    <span><strong style={{ color: '#d97706' }}>Ongoing</strong> students → Marked incomplete</span>
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    fontSize: '15px',
                    color: '#475569'
                  }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      backgroundColor: '#8b5cf6',
                      borderRadius: '50%',
                      marginRight: '16px',
                      boxShadow: '0 0 0 3px rgba(139, 92, 246, 0.2)'
                    }}></div>
                    <span>Processes <strong style={{ color: '#7c3aed' }}>ALL sections</strong> in batch {selectedBatchFilter}</span>
                  </div>
                </div>
              </div>

              {/* Date Selection */}
              <div style={{ marginBottom: '32px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '12px', 
                  fontWeight: '700', 
                  color: '#1e293b',
                  fontSize: '16px'
                }}>
                  Select Processing Date
              </label>
                <div style={{ position: 'relative' }}>
              <input
                type="date"
                value={sendDate}
                    onChange={(e) => setSendDateState(e.target.value)}
                style={{
                  width: '100%',
                      padding: '16px 20px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '16px',
                      fontSize: '16px',
                      color: '#1e293b',
                      backgroundColor: 'white',
                      transition: 'all 0.3s ease',
                      outline: 'none',
                      fontWeight: '500'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.1)';
                      e.target.style.transform = 'translateY(-2px)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.boxShadow = 'none';
                      e.target.style.transform = 'translateY(0)';
                }}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
              </div>

              {/* Action Buttons */}
              <div style={{ 
                display: 'flex', 
                gap: '16px', 
                justifyContent: 'flex-end' 
              }}>
              <button
                onClick={() => {
                  setShowDateModal(false);
                    setSendDateState('');
                }}
                style={{
                    padding: '14px 28px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '16px',
                  backgroundColor: 'white',
                    color: '#64748b',
                  cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '15px',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    const target = e.currentTarget as HTMLButtonElement;
                    target.style.borderColor = '#cbd5e1';
                    target.style.backgroundColor = '#f1f5f9';
                    target.style.transform = 'translateY(-2px)';
                    target.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    const target = e.currentTarget as HTMLButtonElement;
                    target.style.borderColor = '#e2e8f0';
                    target.style.backgroundColor = 'white';
                    target.style.transform = 'translateY(0)';
                    target.style.boxShadow = 'none';
                }}
              >
                Cancel
              </button>
              <button
                  onClick={async () => {
                  if (sendDate) {
                      try {
                        const result = await setSendDate(
                          coordinatorUsername,
                          parseInt(selectedBatchFilter),
                          null, // Always process entire batch
                          sendDate
                        );
                        
                        if (result.success) {
                          alert(`Schedule Set Successfully!\n\nDate: ${sendDate}\nBatch: ${selectedBatchFilter} (ENTIRE BATCH)\n\nOn this date:\n• ALL completed OJT students will be automatically sent to admin\n• ALL ongoing students will be marked as incomplete\n\nThe entire batch will be processed automatically!`);
                    setShowDateModal(false);
                          setSendDateState('');
                  } else {
                          alert(`Error: ${result.message}`);
                        }
                      } catch (error) {
                        console.error('Error setting send date:', error);
                        alert('Failed to set schedule. Please try again.');
                      }
                    } else {
                      alert('Please select a date first');
                  }
                }}
                style={{
                    padding: '14px 28px',
                  border: '2px solid #e5e7eb',
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                  color: '#000000',
                  cursor: 'pointer',
                    fontWeight: '700',
                    fontSize: '15px',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 8px 16px rgba(59, 130, 246, 0.3)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    const target = e.currentTarget as HTMLButtonElement;
                    target.style.transform = 'translateY(-3px)';
                    target.style.boxShadow = '0 12px 24px rgba(59, 130, 246, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    const target = e.currentTarget as HTMLButtonElement;
                    target.style.transform = 'translateY(0)';
                    target.style.boxShadow = '0 8px 16px rgba(59, 130, 246, 0.3)';
                  }}
                >
                  Schedule Processing
              </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
