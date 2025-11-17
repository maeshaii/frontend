import React, { useState, useEffect } from 'react';
import ConfirmModal from '../../components/ConfirmModal';
import { useNavigate } from 'react-router-dom';
import Statistics from './statistics';
import DetailsTable from './detailstable'; // ✅ Your new table component
import { fetchOJTStatistics, importOJT, setSendDate, getSendDates, checkAllSentStatus, deleteSendDate } from '../../services/api';
import logoLogin from '../../images/logo.png';
import { FaUpload, FaChartBar, FaSignOutAlt, FaDownload, FaCalendarAlt, FaUsers } from 'react-icons/fa';

export default function Dashboard() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [selectedCard, setSelectedCard] = useState<{ year: number; section?: string } | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [program, setProgram] = useState('BSIT');
  // Generate years from 2000 to 2025 (descending order)
  const availableYears = Array.from({ length: 26 }, (_, i) => 2025 - i);
  const [ojtYears, setOjtYears] = useState<{ year: number; section?: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [importLoading, setImportLoading] = useState(false);
  const [coordinatorUsername, setCoordinatorUsername] = useState('');
  const [activePage, setActivePage] = useState('imports'); // 'imports' or 'statistics'
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('ALL');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('ALL');
  const [showDateModal, setShowDateModal] = useState(false);
  const [showNoStudentsModal, setShowNoStudentsModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [exportSection, setExportSection] = useState<string>('ALL');
  const [sendDate, setSendDateState] = useState('');
  const [existingSendDates, setExistingSendDates] = useState<any[]>([]);
  const [allDataSent, setAllDataSent] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    // Get coordinator username from localStorage
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      // Use username instead of full name for coordinator
      const username = userData.username || userData.name || '';
      setCoordinatorUsername(username);
      
      // Set program based on coordinator username
      if (username === 'ITCOORDINATOR') {
        setProgram('BSIT');
      } else if (username === 'CTCOORDINATOR') {
        setProgram('BIT-CT');
      } else if (username === 'ISCOORDINATOR') {
        setProgram('BSIS');
      } else {
        // Default fallback
        setProgram('BSIT');
      }
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
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      // Append new files to existing files, avoiding duplicates
      setSelectedFiles(prevFiles => {
        const existingFileNames = new Set(prevFiles.map(f => f.name));
        const uniqueNewFiles = newFiles.filter(f => !existingFileNames.has(f.name));
        return [...prevFiles, ...uniqueNewFiles];
      });
      // Reset input value so same file can be selected again
      e.target.value = '';
    }
  };

  const removeFile = (indexToRemove: number) => {
    setSelectedFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
  };

  const handleImport = async () => {
    if (selectedFiles.length === 0) {
      alert('Please select at least one file');
      return;
    }

    setImportLoading(true);
    try {
      console.log(`Starting OJT import for ${selectedFiles.length} file(s)...`);
      
      let totalCreated = 0;
      let totalUpdated = 0;
      let allPasswords: any[] = [];
      let allSections: string[] = [];
      let failedFiles: string[] = [];
      let batchYear: number | string | null = null;
      let batchYears: Set<number | string> = new Set(); // Track all batch years from multiple files
      let fileResults: Array<{fileName: string, batchYear: number | string | null, sections: string[], created: number, updated: number}> = [];
      
      // Import each file sequentially - supports multiple files with different batch years/sections
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        console.log(`Importing file ${i + 1}/${selectedFiles.length}: ${file.name}`);
        
        try {
          // Year is auto-detected: from existing users or from Excel "Batch_Year" column
          // Each file can have its own batch year and sections
          const result = await importOJT(file, '', program, coordinatorUsername);
          console.log(`Import result for ${file.name}:`, result);
          
          if (result.success) {
            totalCreated += result.created_count || 0;
            totalUpdated += result.updating_count || 0;
            
            // Track batch year from this file
            if (result.batch_year) {
              batchYears.add(result.batch_year);
              if (!batchYear) {
                batchYear = result.batch_year; // Use first batch year for password filename
              }
            }
            
            // Track sections from this file
            if (result.sections && Array.isArray(result.sections)) {
              result.sections.forEach((section: string) => {
                if (!allSections.includes(section)) {
                  allSections.push(section);
                }
              });
            }
            
            // Collect passwords from this file
            if (result.passwords && Array.isArray(result.passwords)) {
              allPasswords = [...allPasswords, ...result.passwords];
            }
            
            // Store file result for detailed reporting
            fileResults.push({
              fileName: file.name,
              batchYear: result.batch_year || null,
              sections: result.sections || [],
              created: result.created_count || 0,
              updated: result.updating_count || 0
            });
          } else {
            failedFiles.push(file.name);
            fileResults.push({
              fileName: file.name,
              batchYear: null,
              sections: [],
              created: 0,
              updated: 0
            });
          }
        } catch (error) {
          console.error(`Error importing ${file.name}:`, error);
          failedFiles.push(file.name);
          fileResults.push({
            fileName: file.name,
            batchYear: null,
            sections: [],
            created: 0,
            updated: 0
          });
        }
      }
      
      // Set import result for modal - supports multiple batch years from different files
      setImportResult({
        filesProcessed: selectedFiles.length,
        totalCreated,
        totalUpdated,
        sections: allSections,
        failedFiles,
        passwords: allPasswords,
        batchYear: batchYear, // Primary batch year for password filename
        batchYears: Array.from(batchYears), // All batch years from multiple files
        fileResults: fileResults // Detailed results per file
      });
      
      // Download all passwords if any exist
      if (allPasswords.length > 0) {
        console.log('Downloading passwords for', allPasswords.length, 'students');
        downloadPasswords(allPasswords, batchYear);
      } else {
        console.log('No passwords to download');
      }
      
      // Close import modal and refresh data
      setShowModal(false);
      setSelectedFiles([]);
      setSelectedYear(null);
      
      // Show import completion modal
      setShowImportModal(true);
      
      // Refresh the OJT data to update cards
      await refreshOJTData();
    } catch (error: any) {
      console.error('OJT import error:', error);
      alert(`❌ Import failed: ${error?.message || 'Please try again.'}`);
    } finally {
      setImportLoading(false);
    }
  };

  const downloadPasswords = (passwords: any[], batchYear: number | string | null = null) => {
    // Create CSV content
    const csvContent = [
      'CTU_ID,First_Name,Last_Name,Password',
      ...passwords.map(p => `${p.CTU_ID},"${p.First_Name}","${p.Last_Name}","${p.Password}"`)
    ].join('\n');
    
    // Use batch year from import result, fallback to selectedYear, or use current year
    const yearForFilename = batchYear || selectedYear || new Date().getFullYear();
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `ojt_passwords_${yearForFilename}.csv`);
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
    // Template for FIRST IMPORT - Creating new students
    // Required: CTU_ID, First Name, Last Name, Gender, Section
    // Optional: Middle Name, Birthdate, Contact No, Email, Address
    // Company info can be added later via "Update Template"
    const headers = [
      'CTU_ID',
      'First Name',
      'Middle Name',
      'Last Name',
      'Gender',
      'Birthdate',
      'Contact No',
      'Email',
      'Address',
      'Section'
    ];

    const csvContent = headers.join(',');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ojt_first_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const exportStudentsForUpdate = async (selectedSection: string = 'ALL') => {
    try {
      setLoading(true);
      setShowExportModal(false); // Close modal after selection
      
      // Build API URL with optional section filter
      let apiUrl = `http://localhost:8000/api/ojt/students/?coordinator=${coordinatorUsername}`;
      if (selectedSection && selectedSection !== 'ALL') {
        apiUrl += `&section=${encodeURIComponent(selectedSection)}`;
      }
      
      // Fetch OJT students for this coordinator (optionally filtered by section)
      let token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      let response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      // If unauthorized, try to refresh token
      if (response.status === 401) {
        console.log('Token expired, refreshing...');
        const refreshToken = localStorage.getItem('refreshToken');
        const refreshResponse = await fetch('http://localhost:8000/api/token/refresh/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh: refreshToken }),
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          localStorage.setItem('accessToken', refreshData.access);
          token = refreshData.access;

          // Retry the original request with new token
          response = await fetch(apiUrl, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
        }
      }

      if (!response.ok) {
        throw new Error('Failed to fetch students');
      }

      const data = await response.json();
      const students = data.students || [];

      if (students.length === 0) {
        setShowNoStudentsModal(true);
        setLoading(false);
        return;
      }

      // Import ExcelJS dynamically
      const ExcelJS = (await import('exceljs')).default;
      const FileSaver = (await import('file-saver')).default;

      // Create Excel workbook with dropdown
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('OJT Students');

      // Define headers
      const headers = [
        'CTU_ID',
        'First Name',
        'Last Name',
        'Section',
        'Company',
        'Company Address',
        'Company Email',
        'Company Contact',
        'Contact Person',
        'Position',
        'Status',
      ];

      // Add headers
      worksheet.addRow(headers);
      
      // Make header row bold
      worksheet.getRow(1).font = { bold: true };

      // Add student data
      students.forEach((student: any) => {
        worksheet.addRow([
          student.ctu_id || '',
          student.first_name || '',
          student.last_name || '',
          student.section || '',
          '', // Empty Company
          '', // Empty Company Address
          '', // Empty Company Email
          '', // Empty Company Contact
          '', // Empty Contact Person
          '', // Empty Position
          student.status || 'Ongoing', // Default Status
        ]);
      });

      // Add dropdown validation to Status column (column K = 11)
      // Apply data validation to each cell in the Status column
      const statusColumn = worksheet.getColumn(11); // Column K = 11
      const statusOptions = ['Ongoing', 'Completed'];
      const statusFormula = `"${statusOptions.join(',')}"`;
      
      statusColumn.eachCell((cell, rowNumber) => {
        if (rowNumber > 1) { // Skip header row
          cell.dataValidation = {
            type: 'list',
            allowBlank: false,
            formulae: [statusFormula],
            showErrorMessage: true,
            errorStyle: 'error',
            errorTitle: 'Invalid Status',
            error: "Please select either 'Ongoing' or 'Completed'"
          };
        }
      });

      // Auto-size columns
      worksheet.columns.forEach((column) => {
        column.width = 15;
      });

      // Generate file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const sectionSuffix = selectedSection && selectedSection !== 'ALL' ? `_${selectedSection}` : '_all_sections';
      const filename = `ojt_students_update_${new Date().toISOString().split('T')[0]}${sectionSuffix}.xlsx`;
      
      FileSaver.saveAs(blob, filename);

      alert(`✅ Exported ${students.length} student${students.length !== 1 ? 's' : ''}${selectedSection && selectedSection !== 'ALL' ? ` from section ${selectedSection}` : ' from all sections'}! Status column has dropdown (Ongoing/Completed). Open in Excel desktop app to use dropdown.`);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export students. Please try again.');
    } finally {
      setLoading(false);
    }
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
      overflow: 'hidden',
    },
    sidebar: {
      width: '240px',
      height: '100vh',
      background: 'linear-gradient(180deg, #1C4E80 0%, #1b3f6b 100%)',
      display: 'flex',
      flexDirection: 'column' as const,
      justifyContent: 'space-between',
      color: '#ffffff',
      padding: '24px 18px',
      overflow: 'hidden' as const,
      position: 'relative' as const,
      boxShadow: '2px 0 10px rgba(15, 35, 60, 0.35)',
      borderRight: '1px solid rgba(255, 255, 255, 0.08)',
    },
    topSection: {
      display: 'flex',
      flexDirection: 'column' as const,
      flex: '0 1 auto',
      minHeight: 0,
      overflow: 'hidden' as const,
      gap: '28px',
    },
    bottomSection: {
      marginTop: 'auto',
      paddingTop: '12px',
    },
    logo: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      marginBottom: '12px',
      flexShrink: 0,
      gap: '16px',
    },
    logoContainer: {
      width: '100%',
      maxWidth: '180px',
      height: '64px',
      background: '#ffffff',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 6px 18px rgba(12, 32, 55, 0.18)',
      padding: '6px 12px',
    },
    logoImage: {
      height: '100%',
      width: 'auto',
      objectFit: 'contain' as const,
    },
    logoText: {
      fontSize: '16px',
      textAlign: 'center' as const,
      fontWeight: '700' as const,
      letterSpacing: '0.4px',
      color: '#ffffff',
    },
    navList: {
      listStyleType: 'none' as const,
      padding: 0,
      margin: 0,
    },
    navItem: {
      display: 'flex',
      alignItems: 'center',
      padding: '12px 18px',
      margin: '6px 0',
      cursor: 'pointer',
      borderRadius: '10px',
      transition: 'all 0.25s ease',
      textDecoration: 'none',
      color: '#f8fbff',
      fontSize: '14px',
      fontWeight: 600,
      backgroundColor: 'transparent',
    },
    activeNavItem: {
      backgroundColor: 'rgba(248, 251, 255, 0.18)',
      color: '#ffffff',
      boxShadow: '0 6px 14px rgba(13, 42, 72, 0.3)',
    },
    icon: {
      marginRight: '12px',
      fontSize: '18px',
      display: 'flex',
      alignItems: 'center',
    },
    navItemText: {
      letterSpacing: '0.2px',
      whiteSpace: 'nowrap' as const,
    },
    logout: {
      display: 'flex',
      alignItems: 'center',
      padding: '12px 16px',
      cursor: 'pointer',
      textDecoration: 'none',
      color: '#f8fbff',
      width: '100%',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: 600,
      transition: 'all 0.25s ease',
      background: 'transparent',
      border: 'none',
      outline: 'none',
      justifyContent: 'flex-start',
      marginBottom: '24px',
    },
    main: {
      flex: 1,
      padding: '20px',
      background: '#f3f4f6',
      height: '100%',
      boxSizing: 'border-box' as const,
      overflow: 'hidden' as const,
      display: 'flex',
      flexDirection: 'column' as const,
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
    { to: '/coordinator/imports', label: 'Imports', icon: <FaUpload /> },
    { to: '/coordinator/statistics', label: 'Statistics', icon: <FaChartBar /> },
  ];

  return (
    <div style={styles.container}>
      {/* ===================== Sidebar ===================== */}
      <div style={styles.sidebar}>
        <div style={styles.topSection}>
          <div style={styles.logo}>
            <div style={styles.logoContainer}>
              <img src={logoLogin} alt="WhereNa You logo" style={styles.logoImage} />
            </div>
          </div>

          <ul style={styles.navList}>
            {links.map((link) => {
              const isActive = (link.label === 'Imports' && activePage === 'imports') ||
                              (link.label === 'Statistics' && activePage === 'statistics');
              return (
                <li key={link.to}>
                  <div
                    style={{
                      ...styles.navItem,
                      ...(isActive ? styles.activeNavItem : {}),
                    }}
                    onClick={() => {
                      if (link.label === 'Imports') {
                        setActivePage('imports');
                        setSelectedCard(null);
                        setShowStats(false);
                        refreshOJTData();
                      } else if (link.label === 'Statistics') {
                        setActivePage('statistics');
                        setShowStats(true);
                      }
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'rgba(248, 251, 255, 0.12)';
                        e.currentTarget.style.color = 'white';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#f8fbff';
                      }
                    }}
                  >
                    <span style={styles.icon}>{link.icon}</span>
                    <span style={styles.navItemText}>{link.label}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div style={styles.bottomSection}>
          <button
            type="button"
            style={styles.logout}
            onClick={handleLogout}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.10)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <span style={styles.icon}><FaSignOutAlt /></span>
            <span style={styles.navItemText}>Logout</span>
          </button>
        </div>
      </div>

      {/* ===================== Modern Main Content ===================== */}
      <main style={styles.main}>
        <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* Modern Filters & Actions */}
        {!showStats && !selectedCard && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e5e7eb'
          }}>
            {/* Class Year Header - Shows newest batch */}
            {ojtYears.length > 0 && (
              <div style={{
                marginBottom: '24px',
                paddingBottom: '20px',
                borderBottom: '2px solid #f1f5f9'
              }}>
                <h2 style={{
                  margin: 0,
                  fontSize: '24px',
                  fontWeight: '800',
                  color: '#1e293b',
                  letterSpacing: '-0.025em'
                }}>
                  CLASS OF {(() => {
                    // Get the newest/latest batch year from imported data
                    const latestYear = Math.max(...ojtYears.map(y => y.year));
                    return latestYear ? `${latestYear - 1}-${latestYear}` : '2025-2026';
                  })()}
                </h2>
              </div>
            )}
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'flex-start',
              gap: '20px', 
              flexWrap: 'wrap'
            }}>
              {/* Program */}
              <div>
                <label style={{
                  fontWeight: '600',
                  color: '#374151',
                  fontSize: '14px',
                  display: 'block',
                  marginBottom: '8px'
                }}>
                  Program
                </label>
                <div style={{
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: 'white',
                  minWidth: '80px',
                  textAlign: 'center',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 3px 8px rgba(102, 126, 234, 0.25)',
                  letterSpacing: '0.5px',
                  border: 'none'
                }}>
                  {program}
                </div>
              </div>
            
              {/* Filter by Section */}
              <div>
                <label style={{ 
                  fontWeight: '600',
                  color: '#374151',
                  fontSize: '14px',
                  display: 'block',
                  marginBottom: '8px'
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
              
              {/* Action Buttons */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'flex-start', 
                gap: '12px',
                marginLeft: 'auto',
                flexWrap: 'wrap',
                paddingTop: '28px'
              }}>
                <button 
                  style={{
                    padding: '11px 20px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onClick={() => setShowModal(true)}
                  onMouseEnter={(e) => {
                    const target = e.currentTarget as HTMLButtonElement;
                    target.style.backgroundColor = '#2563eb';
                    target.style.transform = 'translateY(-2px)';
                    target.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    const target = e.currentTarget as HTMLButtonElement;
                    target.style.backgroundColor = '#3b82f6';
                    target.style.transform = 'translateY(0)';
                    target.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.3)';
                  }}
                >
                  Import OJT
                </button>
                <button
                  style={{
                    padding: '11px 20px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onClick={downloadOJTTemplate}
                  onMouseEnter={(e) => {
                    const target = e.currentTarget as HTMLButtonElement;
                    target.style.backgroundColor = '#2563eb';
                    target.style.transform = 'translateY(-2px)';
                    target.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    const target = e.currentTarget as HTMLButtonElement;
                    target.style.backgroundColor = '#3b82f6';
                    target.style.transform = 'translateY(0)';
                    target.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.3)';
                  }}
                >
                  Download Template
                </button>
                <button
                  style={{
                    padding: '11px 20px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onClick={() => setShowExportModal(true)}
                  onMouseEnter={(e) => {
                    const target = e.currentTarget as HTMLButtonElement;
                    target.style.backgroundColor = '#2563eb';
                    target.style.transform = 'translateY(-2px)';
                    target.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    const target = e.currentTarget as HTMLButtonElement;
                    target.style.backgroundColor = '#3b82f6';
                    target.style.transform = 'translateY(0)';
                    target.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.3)';
                  }}
                >
                  Export Students
                </button>
                <button
                  style={{ 
                    padding: '11px 20px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onClick={async () => {
                    // Fetch existing send dates before showing modal
                    try {
                      const result = await getSendDates(coordinatorUsername);
                      console.log('📅 Get Send Dates Result:', result);
                      if (result.success && result.scheduled_dates) {
                        console.log('📋 Scheduled dates found:', result.scheduled_dates.length, result.scheduled_dates);
                        const processedCount = result.scheduled_dates.filter((sd: any) => sd.is_processed).length;
                        const unprocessedCount = result.scheduled_dates.filter((sd: any) => !sd.is_processed).length;
                        console.log(`   → Processed: ${processedCount}, Unprocessed: ${unprocessedCount}`);
                        console.log(`   → Selected batch: ${selectedBatchFilter}`);
                        setExistingSendDates(result.scheduled_dates);
                      } else {
                        console.log('ℹ️ No scheduled dates found');
                        setExistingSendDates([]);
                      }
                    } catch (error) {
                      console.error('❌ Error fetching send dates:', error);
                      setExistingSendDates([]);
                    }
                    
                    // Check if all completed students are already sent to admin for this specific batch
                    try {
                      const statusResult = await checkAllSentStatus(coordinatorUsername, selectedBatchFilter);
                      console.log('🔍 All Sent Status:', statusResult);
                      if (statusResult.success) {
                        setAllDataSent(statusResult.all_sent);
                        setCompletedCount(statusResult.total_completed || 0);
                        console.log(`✅ Batch ${selectedBatchFilter} - All data sent: ${statusResult.all_sent}, Completed: ${statusResult.total_completed}, Sent: ${statusResult.completed_sent}, Not Sent: ${statusResult.completed_not_sent}`);
                      }
                    } catch (error) {
                      console.error('❌ Error checking sent status:', error);
                      setAllDataSent(false);
                    }
                    
                    setShowDateModal(true);
                  }}
                  onMouseEnter={(e) => {
                    const target = e.currentTarget as HTMLButtonElement;
                    target.style.backgroundColor = '#2563eb';
                    target.style.transform = 'translateY(-2px)';
                    target.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    const target = e.currentTarget as HTMLButtonElement;
                    target.style.backgroundColor = '#3b82f6';
                    target.style.transform = 'translateY(0)';
                    target.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.3)';
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
                  padding: '20px',
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
                  padding: '20px',
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}>
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
                }).map((yearData) => {
                  const studentLabel = `${yearData.count} Student${yearData.count === 1 ? '' : 's'}`;
                  return (
                    <div
                      key={`${yearData.year}-${yearData.section || 'default'}`}
                      style={{
                        backgroundColor: 'white',
                        borderRadius: '20px',
                        padding: '24px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                        border: '1px solid rgba(226, 232, 240, 0.8)',
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                      onClick={() => setSelectedCard({ year: yearData.year, section: yearData.section })}
                      onMouseEnter={(e) => {
                        const target = e.currentTarget as HTMLDivElement;
                        target.style.transform = 'translateY(-6px) scale(1.02)';
                        target.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                        target.style.borderColor = 'rgba(29, 78, 216, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                        const target = e.currentTarget as HTMLDivElement;
                        target.style.transform = 'translateY(0) scale(1)';
                        target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                        target.style.borderColor = 'rgba(226, 232, 240, 0.8)';
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px'
                      }}>
                        <div style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '18px',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          fontSize: '24px',
                          boxShadow: '0 10px 15px -3px rgba(102, 126, 234, 0.3), 0 4px 6px -2px rgba(102, 126, 234, 0.2)',
                          position: 'relative',
                          overflow: 'hidden',
                          flexShrink: 0
                        }}>
                          <div style={{
                            position: 'absolute',
                            top: '-50%',
                            right: '-50%',
                            width: '100%',
                            height: '100%',
                            background: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: '50%'
                          }}></div>
                          <FaUsers style={{ position: 'relative', zIndex: 1 }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ 
                            margin: 0, 
                            fontSize: '20px', 
                            fontWeight: 700, 
                            color: '#1e293b',
                            letterSpacing: '-0.02em',
                            lineHeight: '1.3',
                            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                          }}>
                            Section : {yearData.section || 'N/A'}
                          </h3>
                        </div>
                      </div>
                      <div style={{
                        marginTop: 'auto',
                        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        borderRadius: '14px',
                        padding: '14px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#1e40af',
                        fontWeight: 600,
                        boxShadow: '0 1px 3px 0 rgba(59, 130, 246, 0.1)'
                      }}>
                        <span style={{ 
                          fontSize: '18px', 
                          fontWeight: 700,
                          color: '#1e40af',
                          letterSpacing: '-0.01em',
                          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                        }}>{studentLabel}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )
        ) : (
          <Statistics />
        )}
        </div>
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
                  setSelectedFiles([]);
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
                multiple
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
                      {selectedFiles.length > 0 ? `${selectedFiles.length} file(s) selected` : 'Choose Excel Files'}
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
                      Supports .xlsx and .xls files (multiple selection)
                    </p>
                  </div>
                </div>

                {/* Selected Files List */}
                {selectedFiles.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <p style={{ 
                      fontSize: '13px', 
                      fontWeight: '600', 
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Selected Files:
                    </p>
                    <div style={{ 
                      maxHeight: '150px', 
                      overflowY: 'auto',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '8px'
                    }}>
                      {selectedFiles.map((file, index) => (
                        <div key={index} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          backgroundColor: index % 2 === 0 ? '#f9fafb' : 'white',
                          borderRadius: '6px',
                          marginBottom: '4px'
                        }}>
                          <span style={{
                            fontSize: '13px',
                            color: '#374151',
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            📄 {file.name}
                          </span>
                          <button
                            onClick={() => removeFile(index)}
                            style={{
                              marginLeft: '8px',
                              padding: '4px 8px',
                              backgroundColor: '#fee2e2',
                              color: '#dc2626',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#fecaca';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#fee2e2';
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                  setSelectedFiles([]);
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
                  disabled={importLoading || selectedFiles.length === 0}
                  style={{
                    padding: '14px 28px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    background: importLoading || selectedFiles.length === 0 
                      ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'
                      : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: 'white',
                    cursor: importLoading || selectedFiles.length === 0 ? 'not-allowed' : 'pointer',
                    fontWeight: '700',
                    fontSize: '15px',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    if (!importLoading && selectedFiles.length > 0) {
                      const target = e.currentTarget as HTMLButtonElement;
                      target.style.transform = 'translateY(-2px)';
                      target.style.boxShadow = '0 8px 16px -4px rgba(245, 158, 11, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!importLoading && selectedFiles.length > 0) {
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
            borderRadius: '36px',
            padding: '0',
            boxShadow: '0 32px 64px -12px rgba(0, 0, 0, 0.35)',
            width: '420px',
            maxWidth: '90vw',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            position: 'relative',
            animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            overflow: 'hidden'
          }}>
            {/* Gradient Header */}
            <div style={{
              background: 'white',
              padding: '16px 24px 12px 24px',
              color: '#1f2937',
              position: 'relative',
              borderBottom: '2px solid #e5e7eb',
              borderTopLeftRadius: '36px',
              borderTopRightRadius: '36px'
            }}>
              {/* Header Content */}
              <div style={{ 
                marginBottom: '12px'
              }}>
                <h3 style={{ 
                  margin: '0 0 6px 0', 
                  fontSize: '20px',
                  fontWeight: '800',
                  lineHeight: '1.2',
                  letterSpacing: '-0.025em',
                  color: '#1e293b'
                }}>
                  Auto-Process Batch
            </h3>
                <p style={{ 
                  margin: '0', 
                  fontSize: '14px',
                  fontWeight: '500',
                  opacity: '0.9'
                }}>
                  Schedule automatic processing for batch {selectedBatchFilter}
                </p>
              </div>
            </div>

            {/* Content Area */}
            <div style={{ padding: '16px 24px 20px 24px' }}>
              {/* No Data Warning - for testing */}
              {ojtYears.length === 0 && (
                <div style={{
                  backgroundColor: '#e0f2fe',
                  border: '2px solid #0ea5e9',
                  borderRadius: '24px',
                  padding: '16px 20px',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: '#075985', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
                      No OJT Data Available
                    </strong>
                    <div style={{ color: '#0c4a6e', fontSize: '12px', lineHeight: '1.5' }}>
                      Please import OJT students first before scheduling automatic processing.
                    </div>
                  </div>
                </div>
              )}
              
              {/* Batch Already Processed Warning */}
              {(() => {
                // For specific batch selection
                if (selectedBatchFilter !== 'ALL') {
                  const processedBatch = existingSendDates.find(
                    sd => sd.batch_year.toString() === selectedBatchFilter && sd.is_processed
                  );
                  return processedBatch && (
                    <div style={{
                      backgroundColor: '#fef2f2',
                      border: '2px solid #ef4444',
                      borderRadius: '24px',
                      padding: '14px 18px',
                      marginBottom: '20px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px'
                    }}>
                      <div style={{ flex: 1 }}>
                        <strong style={{ color: '#991b1b', fontSize: '13px', display: 'block', marginBottom: '5px' }}>
                          Batch {selectedBatchFilter} Already Processed
                        </strong>
                        <div style={{ color: '#b91c1c', fontSize: '12px', lineHeight: '1.4' }}>
                          This batch was processed on {new Date(processedBatch.processed_at || processedBatch.send_date).toLocaleDateString()}.
                          The send date cannot be modified for completed batches.
                        </div>
                        <div style={{ marginTop: '5px', fontSize: '11px', color: '#991b1b', fontStyle: 'italic' }}>
                          All completed students have been sent to admin and ongoing students marked as incomplete.
                        </div>
                      </div>
                    </div>
                  );
                }
                
                // For "ALL" selection - show if any batches are processed
                if (selectedBatchFilter === 'ALL') {
                  const processedBatches = existingSendDates.filter(sd => sd.is_processed);
                  return processedBatches.length > 0 && (
                    <div style={{
                      backgroundColor: '#fef3c7',
                      border: '2px solid #f59e0b',
                      borderRadius: '24px',
                      padding: '12px 16px',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px'
                    }}>
                      <div style={{ flex: 1 }}>
                        <strong style={{ color: '#92400e', fontSize: '13px', display: 'block', marginBottom: '5px' }}>
                          Some Batches Already Processed
                        </strong>
                        <div style={{ color: '#78350f', fontSize: '12px', lineHeight: '1.4', marginBottom: '6px' }}>
                          The following batches have already been processed and will be skipped:
                        </div>
                        <div style={{ color: '#78350f', fontSize: '12px', lineHeight: '1.5' }}>
                          {processedBatches.map((batch, idx) => (
                            <div key={idx} style={{ marginBottom: '2px' }}>
                              • <strong>Batch {batch.batch_year}</strong> (processed on {new Date(batch.processed_at || batch.send_date).toLocaleDateString()})
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: '6px', fontSize: '11px', color: '#92400e', fontStyle: 'italic' }}>
                          Only unprocessed batches will be scheduled.
                        </div>
                      </div>
                    </div>
                  );
                }
                
                return null;
              })()}
              
              {/* All Data Already Sent Warning */}
              {allDataSent && (
                <div style={{
                  backgroundColor: '#dcfce7',
                  border: '2px solid #22c55e',
                  borderRadius: '24px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: '#166534', fontSize: '13px', display: 'block', marginBottom: '5px' }}>
                      All Completed OJT Data Already Sent to Admin
                    </strong>
                    <div style={{ color: '#15803d', fontSize: '12px', lineHeight: '1.4' }}>
                      All {completedCount} completed OJT students have been successfully sent to admin for approval.
                    </div>
                    <div style={{ marginTop: '5px', fontSize: '11px', color: '#166534', fontStyle: 'italic' }}>
                      Note: Scheduling is not needed as all data has already been processed.
                    </div>
                  </div>
                </div>
              )}
              
              {/* Existing Schedule Warning - Only show unprocessed dates for selected batch */}
              {(() => {
                // Filter to show only schedules for the selected batch
                const relevantSchedules = selectedBatchFilter === 'ALL'
                  ? existingSendDates.filter(sd => !sd.is_processed)
                  : existingSendDates.filter(sd => {
                      const batchYear = parseInt(selectedBatchFilter);
                      return sd.batch_year === batchYear && !sd.is_processed;
                    });
                return relevantSchedules.length > 0 && !allDataSent;
              })() && (
                <div style={{
                  backgroundColor: '#fef3c7',
                  border: '2px solid #fbbf24',
                  borderRadius: '24px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  position: 'relative'
                }}>
                  {/* X Button to Remove Schedule */}
                  <button
                    onClick={async () => {
                      if (!window.confirm('Are you sure you want to remove the scheduled send dates? This action cannot be undone.')) {
                        return;
                      }

                      try {
                        // If "ALL" is selected, remove schedules for all batches
                        if (selectedBatchFilter === 'ALL') {
                          let successCount = 0;
                          let failCount = 0;
                          const errors: string[] = [];

                          // Get all unique years from existing UNPROCESSED send dates
                          const yearsToRemove = [...new Set(existingSendDates.filter(sd => !sd.is_processed).map(sd => sd.batch_year))];

                          for (const year of yearsToRemove) {
                            try {
                              const result = await deleteSendDate(coordinatorUsername, year);
                              if (result.success) {
                                successCount++;
                                console.log(`✅ Removed schedule for batch ${year}`);
                              } else {
                                failCount++;
                                errors.push(`Batch ${year}: ${result.message}`);
                              }
                            } catch (error: any) {
                              console.error(`Error removing schedule for year ${year}:`, error);
                              failCount++;
                              errors.push(`Batch ${year}: ${error.message || 'Unknown error'}`);
                            }
                          }

                          // Refresh the send dates list
                          try {
                            const result = await getSendDates(coordinatorUsername);
                            if (result.success && result.scheduled_dates) {
                              setExistingSendDates(result.scheduled_dates);
                            } else {
                              setExistingSendDates([]);
                            }
                          } catch (error) {
                            console.error('Error refreshing send dates:', error);
                            setExistingSendDates([]);
                          }

                          if (successCount > 0) {
                            const message = failCount > 0 
                              ? `Schedules Removed!\n\n✓ Removed: ${successCount}\n✗ Failed: ${failCount}\n\n${errors.slice(0, 3).join('\n')}`
                              : `All ${successCount} schedule(s) removed successfully!`;
                            alert(message);
                          } else {
                            alert(`Failed to remove schedules.\n\n${errors.slice(0, 3).join('\n')}`);
                          }
                        } else {
                          // Remove schedule for specific year
                          const batchYear = parseInt(selectedBatchFilter);
                          if (isNaN(batchYear)) {
                            alert('Invalid batch year selected');
                            return;
                          }

                          const result = await deleteSendDate(coordinatorUsername, batchYear);

                          // Refresh the send dates list after removal
                          try {
                            const refreshResult = await getSendDates(coordinatorUsername);
                            if (refreshResult.success && refreshResult.scheduled_dates) {
                              setExistingSendDates(refreshResult.scheduled_dates);
                            } else {
                              setExistingSendDates([]);
                            }
                          } catch (error) {
                            console.error('Error refreshing send dates:', error);
                            setExistingSendDates([]);
                          }

                          if (result.success) {
                            const message = result.deleted_count > 0
                              ? `Schedule removed successfully for batch ${selectedBatchFilter}!`
                              : `No active schedule found for batch ${selectedBatchFilter} (already removed or never existed)`;
                            alert(message);
                          } else {
                            alert(`Error: ${result.message}`);
                          }
                        }
                      } catch (error: any) {
                        console.error('Error removing schedule:', error);
                        alert(`Failed to remove schedule: ${error.message || 'Please try again.'}`);
                        
                        // Still try to refresh the list
                        try {
                          const result = await getSendDates(coordinatorUsername);
                          if (result.success && result.scheduled_dates) {
                            setExistingSendDates(result.scheduled_dates);
                          } else {
                            setExistingSendDates([]);
                          }
                        } catch (refreshError) {
                          console.error('Error refreshing send dates:', refreshError);
                        }
                      }
                    }}
                    title="Remove scheduled send date"
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      border: 'none',
                      backgroundColor: '#dc2626',
                      color: 'white',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      padding: '0',
                      lineHeight: '1'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#b91c1c';
                      e.currentTarget.style.transform = 'scale(1.1)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(220, 38, 38, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#dc2626';
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    ✕
                  </button>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <strong style={{ color: '#92400e', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
                        Existing Scheduled Dates Found
                      </strong>
                      <div style={{ color: '#78350f', fontSize: '12px', lineHeight: '1.5' }}>
                        {(() => {
                          // Show only schedules for the selected batch
                          const relevantSchedules = selectedBatchFilter === 'ALL'
                            ? existingSendDates.filter(sd => !sd.is_processed)
                            : existingSendDates.filter(sd => {
                                const batchYear = parseInt(selectedBatchFilter);
                                return sd.batch_year === batchYear && !sd.is_processed;
                              });
                          return relevantSchedules.map((sd, idx) => (
                            <div key={idx} style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>• <strong>Batch {sd.batch_year}</strong>{sd.section && ` (Section ${sd.section})`}: {new Date(sd.send_date).toLocaleDateString()}</span>
                              <span style={{ fontSize: '11px', marginLeft: 'auto', opacity: 0.8 }}>
                                (Set on {new Date(sd.created_at).toLocaleDateString()})
                              </span>
                            </div>
                          ));
                        })()}
                      </div>
                      <div style={{ marginTop: '6px', fontSize: '11px', color: '#92400e', fontStyle: 'italic' }}>
                        Set a new date below to update the existing schedule
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Process Overview Card */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '24px',
                padding: '14px 18px',
                marginBottom: '16px',
                position: 'relative',
                overflow: 'hidden'
              }}>
                
                <div style={{ 
                  marginBottom: '12px' 
                }}>
                  <span style={{ 
                    fontWeight: '700', 
                    color: '#1e293b',
                    fontSize: '13px'
                  }}>
                    Processing Actions
                  </span>
                </div>
                
                <div style={{ paddingLeft: '6px' }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    marginBottom: '8px',
                    fontSize: '12px',
                    color: '#475569'
                  }}>
                    <div style={{
                      width: '6px',
                      height: '6px',
                      backgroundColor: '#10b981',
                      borderRadius: '50%',
                      marginRight: '12px',
                      marginLeft: '3px',
                      flexShrink: 0,
                      boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.2)'
                    }}></div>
                    <span><strong style={{ color: '#059669' }}>Completed</strong> students → Sent to admin</span>
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    marginBottom: '8px',
                    fontSize: '12px',
                    color: '#475569'
                  }}>
                    <div style={{
                      width: '6px',
                      height: '6px',
                      backgroundColor: '#f59e0b',
                      borderRadius: '50%',
                      marginRight: '12px',
                      marginLeft: '3px',
                      flexShrink: 0,
                      boxShadow: '0 0 0 2px rgba(245, 158, 11, 0.2)'
                    }}></div>
                    <span><strong style={{ color: '#d97706' }}>Ongoing</strong> students → Marked incomplete</span>
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    fontSize: '12px',
                    color: '#475569'
                  }}>
                    <div style={{
                      width: '6px',
                      height: '6px',
                      backgroundColor: '#8b5cf6',
                      borderRadius: '50%',
                      marginRight: '12px',
                      marginLeft: '3px',
                      flexShrink: 0,
                      boxShadow: '0 0 0 2px rgba(139, 92, 246, 0.2)'
                    }}></div>
                    <span>Processes <strong style={{ color: '#7c3aed' }}>ALL sections</strong> in batch {selectedBatchFilter}</span>
                  </div>
                </div>
              </div>

              {/* Date Selection */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '700', 
                  color: '#1e293b',
                  fontSize: '13px'
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
                      padding: '10px 12px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '24px',
                      fontSize: '13px',
                      color: '#1e293b',
                      backgroundColor: 'white',
                      transition: 'all 0.3s ease',
                      outline: 'none',
                      fontWeight: '500',
                      boxSizing: 'border-box'
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
                gap: '12px', 
                justifyContent: 'flex-end' 
              }}>
              <button
                onClick={() => {
                  setShowDateModal(false);
                  setSendDateState('');
                  setExistingSendDates([]);
                  setAllDataSent(false);
                  setCompletedCount(0);
                }}
                style={{
                    padding: '10px 20px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '24px',
                  backgroundColor: 'white',
                    color: '#64748b',
                  cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '13px',
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
                  disabled={(() => {
                    // Check if there's an existing unprocessed send date for the selected batch
                    if (selectedBatchFilter === 'ALL') {
                      // For "ALL", check if there are any unprocessed send dates
                      return existingSendDates.filter(sd => !sd.is_processed).length > 0 && !allDataSent;
                    } else {
                      // For specific batch, check only that batch
                      const batchYear = parseInt(selectedBatchFilter);
                      const hasExistingForBatch = existingSendDates.some(
                        sd => sd.batch_year === batchYear && !sd.is_processed
                      );
                      return hasExistingForBatch && !allDataSent;
                    }
                  })()}
                  onClick={async () => {
                    // Prevent action if there's an existing schedule for the selected batch
                    const hasExistingSchedule = (() => {
                      if (selectedBatchFilter === 'ALL') {
                        return existingSendDates.filter(sd => !sd.is_processed).length > 0;
                      } else {
                        const batchYear = parseInt(selectedBatchFilter);
                        return existingSendDates.some(
                          sd => sd.batch_year === batchYear && !sd.is_processed
                        );
                      }
                    })();
                    
                    if (hasExistingSchedule && !allDataSent) {
                      const batchText = selectedBatchFilter === 'ALL' 
                        ? 'one or more batches' 
                        : `batch ${selectedBatchFilter}`;
                      alert(`⚠️ Existing Schedule Found!\n\nYou already have a scheduled date for ${batchText}.\n\nPlease remove the existing scheduled date first by clicking the ✕ button above.`);
                      return;
                    }
                    
                    if (allDataSent) {
                      alert('✅ All Completed OJT Data Already Sent!\n\nAll completed students have been sent to admin for approval.\nScheduling is not needed at this time.');
                      return;
                    }
                    
                    if (!sendDate) {
                      alert('Please select a date first');
                      return;
                    }
                    
                    try {
                      // If "ALL" is selected, schedule for all available years
                      if (selectedBatchFilter === 'ALL') {
                        let successCount = 0;
                        let failCount = 0;
                        
                        // Get all unique years from the stats
                        const yearsToProcess = [...new Set(ojtYears.map(y => y.year))];
                        
                        if (yearsToProcess.length === 0) {
                          alert('No OJT batches found to schedule');
                          return;
                        }
                        
                        const failedBatches: string[] = [];
                        for (const year of yearsToProcess) {
                          try {
                            const result = await setSendDate(
                              coordinatorUsername,
                              year,
                              null,
                              sendDate
                            );
                            if (result.success) {
                              successCount++;
                            } else {
                              failCount++;
                              failedBatches.push(`${year}: ${result.message || 'Unknown error'}`);
                            }
                          } catch (error) {
                            console.error(`Error scheduling year ${year}:`, error);
                            failCount++;
                            failedBatches.push(`${year}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                          }
                        }
                        
                        if (successCount > 0) {
                          let message = `✅ Schedule Set Successfully!\n\nDate: ${sendDate}\nBatches scheduled: ${successCount}\nFailed: ${failCount}`;
                          if (failedBatches.length > 0) {
                            const processedBatchErrors = failedBatches.filter(fb => fb.includes('already been processed'));
                            const otherErrors = failedBatches.filter(fb => !fb.includes('already been processed'));
                            
                            if (processedBatchErrors.length > 0) {
                              message += `\n\n🔒 Already Processed (Skipped):\n${processedBatchErrors.map(fb => fb.split(': ')[0]).join(', ')}`;
                            }
                            if (otherErrors.length > 0) {
                              message += `\n\n❌ Failed:\n${otherErrors.join('\n')}`;
                            }
                          }
                          message += '\n\n📅 On this date, ALL completed OJT students from scheduled batches will be automatically sent to admin!';
                          alert(message);
                          setShowDateModal(false);
                          setSendDateState('');
                          setExistingSendDates([]);
                        } else {
                          let errorMessage = '❌ Failed to schedule any batches.\n\n';
                          const processedBatchErrors = failedBatches.filter(fb => fb.includes('already been processed'));
                          const otherErrors = failedBatches.filter(fb => !fb.includes('already been processed'));
                          
                          if (processedBatchErrors.length > 0) {
                            errorMessage += `🔒 Already Processed:\n${processedBatchErrors.map(fb => fb.split(': ')[0]).join(', ')}\n\n`;
                            errorMessage += 'These batches have been completed and cannot be modified.\n\n';
                          }
                          if (otherErrors.length > 0) {
                            errorMessage += `Other Errors:\n${otherErrors.join('\n')}`;
                          }
                          alert(errorMessage);
                        }
                      } else {
                        // Schedule for specific year
                        const batchYear = parseInt(selectedBatchFilter);
                        if (isNaN(batchYear)) {
                          alert('Invalid batch year selected');
                          return;
                        }
                        
                        const result = await setSendDate(
                          coordinatorUsername,
                          batchYear,
                          null,
                          sendDate
                        );
                        
                        if (result.success) {
                          alert(`Schedule Set Successfully!\n\nDate: ${sendDate}\nBatch: ${selectedBatchFilter}\n\nOn this date:\n• ALL completed OJT students will be automatically sent to admin\n• ALL ongoing students will be marked as incomplete`);
                          setShowDateModal(false);
                          setSendDateState('');
                          setExistingSendDates([]);
                        } else {
                          // Check if it's a processed batch error
                          if (result.message && result.message.includes('already been processed')) {
                            alert(`🔒 Batch Already Processed\n\n${result.message}\n\n💡 Tip: Processed batches cannot be modified. You can only schedule unprocessed batches.`);
                          } else {
                            alert(`Error: ${result.message}`);
                          }
                        }
                      }
                    } catch (error) {
                      console.error('Error setting send date:', error);
                      alert('Failed to set schedule. Please try again.');
                    }
                  }}
                style={{
                    padding: '10px 20px',
                  border: '2px solid #e5e7eb',
                    borderRadius: '24px',
                    background: (() => {
                      if (allDataSent) return 'linear-gradient(135deg, #94a3b8 0%, #cbd5e1 100%)';
                      if (selectedBatchFilter === 'ALL') {
                        return existingSendDates.filter(sd => !sd.is_processed).length > 0
                          ? 'linear-gradient(135deg, #94a3b8 0%, #cbd5e1 100%)'
                          : 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)';
                      } else {
                        const batchYear = parseInt(selectedBatchFilter);
                        const hasExisting = existingSendDates.some(sd => sd.batch_year === batchYear && !sd.is_processed);
                        return hasExisting
                          ? 'linear-gradient(135deg, #94a3b8 0%, #cbd5e1 100%)'
                          : 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)';
                      }
                    })(),
                  color: '#000000',
                  cursor: (() => {
                    if (allDataSent) return 'not-allowed';
                    if (selectedBatchFilter === 'ALL') {
                      return existingSendDates.filter(sd => !sd.is_processed).length > 0 ? 'not-allowed' : 'pointer';
                    } else {
                      const batchYear = parseInt(selectedBatchFilter);
                      const hasExisting = existingSendDates.some(sd => sd.batch_year === batchYear && !sd.is_processed);
                      return hasExisting ? 'not-allowed' : 'pointer';
                    }
                  })(),
                    fontWeight: '700',
                    fontSize: '13px',
                    transition: 'all 0.3s ease',
                    boxShadow: (() => {
                      if (allDataSent) return '0 4px 8px rgba(148, 163, 184, 0.2)';
                      if (selectedBatchFilter === 'ALL') {
                        return existingSendDates.filter(sd => !sd.is_processed).length > 0
                          ? '0 4px 8px rgba(148, 163, 184, 0.2)'
                          : '0 8px 16px rgba(59, 130, 246, 0.3)';
                      } else {
                        const batchYear = parseInt(selectedBatchFilter);
                        const hasExisting = existingSendDates.some(sd => sd.batch_year === batchYear && !sd.is_processed);
                        return hasExisting
                          ? '0 4px 8px rgba(148, 163, 184, 0.2)'
                          : '0 8px 16px rgba(59, 130, 246, 0.3)';
                      }
                    })(),
                    position: 'relative',
                    overflow: 'hidden',
                    opacity: (() => {
                      if (allDataSent) return 0.6;
                      if (selectedBatchFilter === 'ALL') {
                        return existingSendDates.filter(sd => !sd.is_processed).length > 0 ? 0.6 : 1;
                      } else {
                        const batchYear = parseInt(selectedBatchFilter);
                        const hasExisting = existingSendDates.some(sd => sd.batch_year === batchYear && !sd.is_processed);
                        return hasExisting ? 0.6 : 1;
                      }
                    })()
                  }}
                  onMouseEnter={(e) => {
                    const isDisabled = (() => {
                      if (allDataSent) return true;
                      if (selectedBatchFilter === 'ALL') {
                        return existingSendDates.filter(sd => !sd.is_processed).length > 0;
                      } else {
                        const batchYear = parseInt(selectedBatchFilter);
                        return existingSendDates.some(sd => sd.batch_year === batchYear && !sd.is_processed);
                      }
                    })();
                    if (!isDisabled) {
                      const target = e.currentTarget as HTMLButtonElement;
                      target.style.transform = 'translateY(-3px)';
                      target.style.boxShadow = '0 12px 24px rgba(59, 130, 246, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    const isDisabled = (() => {
                      if (allDataSent) return true;
                      if (selectedBatchFilter === 'ALL') {
                        return existingSendDates.filter(sd => !sd.is_processed).length > 0;
                      } else {
                        const batchYear = parseInt(selectedBatchFilter);
                        return existingSendDates.some(sd => sd.batch_year === batchYear && !sd.is_processed);
                      }
                    })();
                    if (!isDisabled) {
                      const target = e.currentTarget as HTMLButtonElement;
                      target.style.transform = 'translateY(0)';
                      target.style.boxShadow = '0 8px 16px rgba(59, 130, 246, 0.3)';
                    }
                  }}
                >
                  {(() => {
                    if (allDataSent) return 'All Data Already Sent';
                    if (selectedBatchFilter === 'ALL') {
                      return existingSendDates.filter(sd => !sd.is_processed).length > 0
                        ? 'Remove Existing Schedule First'
                        : 'Schedule Processing';
                    } else {
                      const batchYear = parseInt(selectedBatchFilter);
                      const hasExisting = existingSendDates.some(sd => sd.batch_year === batchYear && !sd.is_processed);
                      return hasExisting ? 'Remove Existing Schedule First' : 'Schedule Processing';
                    }
                  })()}
              </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Students Found Modal */}
      {showNoStudentsModal && (
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
        }} onClick={() => setShowNoStudentsModal(false)}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            zIndex: 1001
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: '700',
                color: '#1e293b'
              }}>
                No Students Found
              </h2>
              <button
                onClick={() => setShowNoStudentsModal(false)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontSize: '24px',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                ✕
              </button>
            </div>
            <p style={{
              margin: '0 0 24px 0',
              fontSize: '16px',
              color: '#64748b',
              lineHeight: '1.5'
            }}>
              No students found. Please import students first.
            </p>
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={() => setShowNoStudentsModal(false)}
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#3b82f6';
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Students Modal - Redesigned */}
      {showExportModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease-out'
        }} onClick={() => setShowExportModal(false)}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '20px',
            padding: '0',
            maxWidth: '480px',
            width: '90%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            zIndex: 1001,
            overflow: 'hidden',
            animation: 'slideUp 0.3s ease-out'
          }} onClick={(e) => e.stopPropagation()}>
            {/* Header with gradient */}
            <div style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              padding: '24px 32px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(10px)'
                }}>
                  <FaDownload style={{ color: 'white', fontSize: '20px' }} />
                </div>
                <h2 style={{
                  margin: 0,
                  fontSize: '22px',
                  fontWeight: '700',
                  color: 'white',
                  letterSpacing: '-0.02em'
                }}>
                  Export Students
                </h2>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  fontSize: '20px',
                  color: 'white',
                  cursor: 'pointer',
                  padding: '0',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '10px',
                  transition: 'all 0.2s',
                  backdropFilter: 'blur(10px)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
                  e.currentTarget.style.transform = 'rotate(90deg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.transform = 'rotate(0deg)';
                }}
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '32px' }}>
              <div style={{ marginBottom: '28px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#475569',
                  marginBottom: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Select Section to Export
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={exportSection}
                    onChange={(e) => setExportSection(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      paddingRight: '48px',
                      borderRadius: '12px',
                      border: '2px solid #e2e8f0',
                      fontSize: '15px',
                      color: '#1e293b',
                      backgroundColor: '#f8fafc',
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'all 0.2s',
                      fontWeight: '500',
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      MozAppearance: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#f59e0b';
                      e.currentTarget.style.backgroundColor = 'white';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <option value="ALL">📋 All Sections</option>
                    {ojtYears
                      .map(yearData => yearData.section || 'Unknown')
                      .filter((section, index, self) => self.indexOf(section) === index)
                      .sort()
                      .map((section) => (
                        <option key={section} value={section}>
                          Section {section}
                        </option>
                      ))}
                  </select>
                  <div style={{
                    position: 'absolute',
                    right: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    color: '#64748b',
                    fontSize: '18px'
                  }}>
                    ▼
                  </div>
                </div>
                <p style={{
                  margin: '10px 0 0 0',
                  fontSize: '12px',
                  color: '#94a3b8',
                  fontStyle: 'italic'
                }}>
                  {exportSection === 'ALL' 
                    ? 'Export all students from all sections' 
                    : `Export only students from Section ${exportSection}`}
                </p>
              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                paddingTop: '8px',
                borderTop: '1px solid #f1f5f9'
              }}>
                <button
                  onClick={() => setShowExportModal(false)}
                  style={{
                    padding: '12px 28px',
                    backgroundColor: 'transparent',
                    color: '#64748b',
                    border: '2px solid #e2e8f0',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => exportStudentsForUpdate(exportSection)}
                  style={{
                    padding: '12px 28px',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(245, 158, 11, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.3)';
                  }}
                >
                  <FaDownload style={{ fontSize: '14px' }} />
                  Export CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Completion Modal */}
      {showImportModal && importResult && (
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
        }} onClick={() => {
          setShowImportModal(false);
          setImportResult(null);
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            zIndex: 1001
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <span style={{ fontSize: '24px' }}>✅</span>
              <h2 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '600',
                color: '#1e293b'
              }}>
                Import completed!
              </h2>
            </div>

            <div style={{
              marginBottom: '20px',
              fontSize: '14px',
              color: '#475569',
              lineHeight: '1.6'
            }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>Files processed:</strong> {importResult.filesProcessed}
              </div>
              {importResult.totalCreated > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <strong>Total students created:</strong> {importResult.totalCreated}
                </div>
              )}
              {importResult.totalUpdated > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <strong>Total students updated:</strong> {importResult.totalUpdated}
                </div>
              )}
              {importResult.batchYears && importResult.batchYears.length > 1 && (
                <div style={{ marginBottom: '8px', color: '#059669' }}>
                  <strong>📅 Batch Years:</strong> {importResult.batchYears.join(', ')} (Multiple batches imported)
                </div>
              )}
              {importResult.batchYear && (!importResult.batchYears || importResult.batchYears.length === 1) && (
                <div style={{ marginBottom: '8px' }}>
                  <strong>📅 Batch Year:</strong> {importResult.batchYear}
                </div>
              )}
              {importResult.sections && importResult.sections.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <strong>Sections:</strong> {importResult.sections.join(', ')}
                </div>
              )}
              {importResult.fileResults && importResult.fileResults.length > 1 && (
                <div style={{ marginBottom: '12px', marginTop: '12px', padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '6px' }}>
                  <strong style={{ display: 'block', marginBottom: '8px' }}>📋 File-by-File Results:</strong>
                  {importResult.fileResults.map((fileResult: any, idx: number) => (
                    <div key={idx} style={{ marginBottom: '6px', fontSize: '14px', paddingLeft: '12px', borderLeft: '3px solid #3b82f6' }}>
                      <strong>{fileResult.fileName}:</strong> {fileResult.created} created, {fileResult.updated} updated
                      {fileResult.batchYear && <span> (Batch {fileResult.batchYear})</span>}
                      {fileResult.sections && fileResult.sections.length > 0 && <span> - Sections: {fileResult.sections.join(', ')}</span>}
                    </div>
                  ))}
                </div>
              )}
              {importResult.failedFiles && importResult.failedFiles.length > 0 && (
                <div style={{ marginBottom: '8px', color: '#dc2626' }}>
                  <strong>⚠️ Failed files:</strong> {importResult.failedFiles.join(', ')}
                </div>
              )}
              {importResult.passwords && importResult.passwords.length > 0 && (
                <div style={{ marginBottom: '8px', color: '#059669' }}>
                  <strong>📥 Password file downloaded:</strong> {importResult.passwords.length} student passwords
                </div>
              )}
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportResult(null);
                }}
                style={{
                  padding: '8px 24px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#3b82f6';
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
