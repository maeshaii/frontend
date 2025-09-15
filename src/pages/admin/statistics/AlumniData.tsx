import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../global/sidebar';
import {
  fetchAlumniByYear,
  fetchTrackerResponsesByUser,
  fetchAlumniDetails,
} from '../../../services/api';
import { trackerApi } from '../../../services/trackerApi';

const AlumniData: React.FC = () => {
  const { year } = useParams<{ year: string }>();
  const navigate = useNavigate();

  const [selectedCourse, setSelectedCourse] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [alumniList, setAlumniList] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAlumni, setModalAlumni] = useState<any | null>(null);
  const [trackerAnswers, setTrackerAnswers] = useState<any[]>([]);
  const [trackerQuestions, setTrackerQuestions] = useState<any[]>([]);
  const [trackerAnswersMap, setTrackerAnswersMap] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(true);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    const loadAlumni = async () => {
      setLoading(true);
      try {
        if (year) {
          const data = await fetchAlumniByYear(year);
          setAlumniList(data.alumni || []);
          // Fetch tracker answers for all alumni in the list
          const trackerMap: Record<number, any> = {};
          if (data.alumni && data.alumni.length > 0) {
            const qData = await trackerApi.getQuestions();
            const trackerQuestions = qData.categories
              ? qData.categories.flatMap((cat: any) => cat.questions)
              : [];
            // Helper to get tracker answer by label for a given answers object
            const getTrackerAnswerByLabel = (answers: any, label: string) => {
              if (!trackerQuestions || !answers) return '';
              const q = trackerQuestions.find((q: any) =>
                q.text.toLowerCase().includes(label.toLowerCase())
              );
              if (!q) return '';
              const ans = answers[q.id];
              if (Array.isArray(ans)) return ans.join(', ');
              return ans || '';
            };

            // Helper to get tracker answer by question ID
            const getTrackerAnswerById = (answers: any, questionId: number) => {
              if (!answers) return '';
              const ans = answers[questionId];
              if (Array.isArray(ans)) return ans.join(', ');
              return ans || '';
            };

            await Promise.all(
              data.alumni.map(async (alumni: any) => {
                const userId = alumni.id || alumni.user_id;
                if (userId) {
                  const res = await fetchTrackerResponsesByUser(userId);
                  if (res.responses && res.responses.length > 0) {
                    trackerMap[userId] = {
                      company: getTrackerAnswerByLabel(res.responses[0].answers, 'company'),
                      position_current: getTrackerAnswerById(res.responses[0].answers, 26), // Question 26: Current Position
                      salary_current: getTrackerAnswerByLabel(res.responses[0].answers, 'salary'),
                    };
                  }
                }
              })
            );
          }
          setTrackerAnswersMap(trackerMap);
        }
      } catch (e) {
        setAlumniList([]);
        setTrackerAnswersMap({});
      } finally {
        setLoading(false);
      }
    };
    loadAlumni();
  }, [year]);

  const filteredAlumni = alumniList.filter((alumni) => {
    const matchCourse = selectedCourse === 'All' || alumni.course === selectedCourse;
    const matchSearch = (alumni.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchCourse && matchSearch;
  });

  const openModal = async (alumni: any) => {
    setModalLoading(true);
    // Fetch the latest alumni data from the backend
    let latestAlumni = alumni;
    try {
      const userId = alumni.id || alumni.user_id;
      if (userId) {
        const res = await fetchAlumniDetails(userId);
        if (res.success && res.alumni) {
          latestAlumni = res.alumni;
        }
      }
    } catch (e) {
      /* fallback to passed alumni */
    }
    setModalAlumni(latestAlumni);
    setModalOpen(true);
    // Fetch tracker answers for this alumni
    if (latestAlumni.id || latestAlumni.user_id) {
      const userId = latestAlumni.id || latestAlumni.user_id;
      const res = await fetchTrackerResponsesByUser(userId);
      setTrackerAnswers(res.responses && res.responses.length > 0 ? res.responses[0].answers : {});
    } else {
      setTrackerAnswers([]);
    }
    // Fetch tracker questions for mapping
    const qData = await trackerApi.getQuestions();
    setTrackerQuestions(
      qData.categories ? qData.categories.flatMap((cat: any) => cat.questions) : []
    );
    setModalLoading(false);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalAlumni(null);
  };

  // Helper to get tracker answer by question text
  const getTrackerAnswerByLabel = (label: string) => {
    if (!trackerQuestions || !trackerAnswers) return '';
    // Try to match by question text containing the label (case-insensitive)
    const q = trackerQuestions.find((q: any) => q.text.toLowerCase().includes(label.toLowerCase()));
    if (!q) return '';
    const ans = trackerAnswers[q.id];
    if (Array.isArray(ans)) return ans.join(', ');
    return ans || '';
  };

  function renderTrackerAnswers(): React.ReactNode {
    if (!modalAlumni || !modalAlumni.tracker_answers) {
      return null;
    }
    const entries = Object.entries(modalAlumni.tracker_answers);
    if (!entries || entries.length === 0) {
      return (
        <div style={{ 
          color: '#6b7280', 
          fontStyle: 'italic', 
          textAlign: 'center',
          padding: '20px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          marginTop: '20px'
        }}>
          No tracker answers available.
        </div>
      );
    }
    return (
      <div style={{ marginTop: '24px' }}>
        <h3 style={{ 
          marginBottom: '16px', 
          color: '#1f2937',
          fontSize: '18px',
          fontWeight: '600'
        }}>All Tracker Answers</h3>
        <div style={{ 
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          padding: '16px',
          maxHeight: '300px',
          overflowY: 'auto'
        }}>
          {entries.map(([question, answer]) => (
            <div key={question} style={{ 
              padding: '12px 0', 
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <strong style={{ color: '#374151', fontSize: '14px' }}>{question}:</strong>
              <span style={{ color: '#6b7280', fontSize: '14px' }}>
                {typeof answer === 'object' ? JSON.stringify(answer) : String(answer)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Modern styles
  const styles = {
    container: {
      display: 'flex',
      height: '100vh',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      backgroundColor: '#f8fafc'
    },
    mainContent: {
      flex: 1,
      overflowY: 'auto' as const,
      backgroundColor: '#f8fafc',
      marginLeft: '250px' // Account for sidebar width
    },
    header: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
      padding: '20px 32px 20px 40px', // Extra left padding to account for sidebar
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      minHeight: '80px',
      position: 'relative' as const
    },
    backButton: {
      background: 'rgba(255, 255, 255, 0.2)',
      border: '2px solid rgba(255, 255, 255, 0.4)',
      color: 'white',
      fontSize: '16px',
      cursor: 'pointer',
      fontWeight: '600',
      padding: '12px 20px',
      borderRadius: '10px',
      transition: 'all 0.3s ease',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)',
      whiteSpace: 'nowrap' as const
    },
    searchContainer: {
      position: 'relative' as const,
      display: 'flex',
      alignItems: 'center'
    },
    searchInput: {
      padding: '12px 16px 12px 44px',
      borderRadius: '12px',
      border: 'none',
      fontSize: '16px',
      width: '280px',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      color: '#374151',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      transition: 'all 0.3s ease',
      backdropFilter: 'blur(10px)'
    },
    searchIcon: {
      position: 'absolute' as const,
      left: '16px',
      color: '#6b7280',
      fontSize: '18px'
    },
    controlsSection: {
      padding: '20px 32px 20px 40px', // Extra left padding to account for sidebar
      backgroundColor: 'white',
      borderBottom: '1px solid #e5e7eb',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
    },
    batchLabel: {
      fontSize: '20px',
      fontWeight: '700',
      color: '#1f2937',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text'
    },
    courseFilter: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },
    courseLabel: {
      fontSize: '16px',
      fontWeight: '600',
      color: '#374151'
    },
    courseSelect: {
      padding: '12px 20px',
      borderRadius: '12px',
      backgroundColor: '#667eea',
      color: 'white',
      border: 'none',
      fontWeight: '600',
      cursor: 'pointer',
      fontSize: '14px',
      transition: 'all 0.3s ease',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)',
      minWidth: '120px'
    },
    tableContainer: {
      padding: '24px',
      backgroundColor: 'white',
      margin: '20px 32px 20px 40px', // Extra left margin to account for sidebar
      borderRadius: '20px',
      boxShadow: '0 8px 25px -5px rgba(0, 0, 0, 0.1)',
      overflow: 'auto',
      border: '1px solid rgba(0, 0, 0, 0.05)'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      fontSize: '14px',
      borderRadius: '8px',
      overflow: 'hidden',
      minWidth: '800px'
    },
    tableHeader: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
    },
    headerCell: {
      padding: '18px 16px',
      textAlign: 'left' as const,
      fontWeight: '700',
      fontSize: '15px',
      letterSpacing: '0.025em',
      whiteSpace: 'nowrap' as const,
      textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
    },
    tableRow: {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      borderBottom: '1px solid #f3f4f6'
    },
    tableRowHover: {
      backgroundColor: '#f8fafc'
    },
    bodyCell: {
      padding: '18px 16px',
      textAlign: 'left' as const,
      color: '#374151',
      fontSize: '14px',
      fontWeight: '500'
    },
    emptyState: {
      textAlign: 'center' as const,
      padding: '60px 20px',
      color: '#6b7280',
      fontSize: '16px'
    },
    loadingSpinner: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '60px',
      fontSize: '16px',
      color: '#6b7280'
    },
    modalOverlay: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      backdropFilter: 'blur(4px)'
    },
    modalContent: {
      background: 'white',
      padding: '32px',
      borderRadius: '20px',
      minWidth: '600px',
      maxWidth: '90vw',
      maxHeight: '90vh',
      overflowY: 'auto' as const,
      position: 'relative' as const,
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
    },
    modalHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '24px',
      paddingBottom: '16px',
      borderBottom: '2px solid #f3f4f6'
    },
    modalTitle: {
      fontSize: '24px',
      fontWeight: '700',
      color: '#1f2937',
      margin: 0
    },
    modalCloseButton: {
      background: '#ef4444',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      padding: '8px 16px',
      fontSize: '14px',
      cursor: 'pointer',
      fontWeight: '600',
      transition: 'all 0.2s ease'
    },
    detailsTable: {
      width: '100%',
      fontSize: '14px',
      borderCollapse: 'collapse' as const
    },
    detailsRow: {
      borderBottom: '1px solid #f3f4f6'
    },
    detailsLabel: {
      fontWeight: '600',
      padding: '12px 16px',
      textAlign: 'right' as const,
      width: '35%',
      color: '#374151',
      backgroundColor: '#f9fafb'
    },
    detailsValue: {
      padding: '12px 16px',
      color: '#6b7280'
    },
    statusBadge: {
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '600',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em'
    },
    statusActive: {
      backgroundColor: '#dcfce7',
      color: '#166534'
    },
    statusInactive: {
      backgroundColor: '#fee2e2',
      color: '#991b1b'
    }
  };

  return (
    <div style={styles.container}>
      <Sidebar />

      <div style={styles.mainContent}>
        {/* Modern Header */}
        <div style={styles.header}>
          {/* Left Side - Back Button */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
          <button
            onClick={() => navigate(-1)}
              style={styles.backButton}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
              }}
            >
              ← Back
          </button>
          </div>

          {/* Center - Title */}
          <div style={{ 
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center'
          }}>
            <h2 style={{ 
              margin: 0,
              color: 'white',
              fontSize: '28px', 
              fontWeight: '700', 
              letterSpacing: '-0.025em',
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
            }}>Alumni Data</h2>
          </div>

          {/* Right Side - Search */}
          <div style={styles.searchContainer}>
            <span style={styles.searchIcon}>🔍</span>
          <input
            type="text"
              placeholder="Search alumni..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
              onFocus={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
              }}
            />
          </div>
        </div>

        {/* Controls Section */}
        <div style={styles.controlsSection}>
          <div style={styles.batchLabel}>BATCH {year}</div>
          <div style={styles.courseFilter}>
            <span style={styles.courseLabel}>COURSE:</span>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              style={styles.courseSelect}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#5a67d8';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#667eea';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <option value="All">All</option>
              <option value="BSIT">BSIT</option>
              <option value="BSIS">BSIS</option>
              <option value="BSCT">BIT-CT</option>
            </select>
          </div>
        </div>

        {/* Table Section */}
        <div style={styles.tableContainer}>
          {loading ? (
            <div style={styles.loadingSpinner}>
              <div>Loading alumni data...</div>
            </div>
          ) : (
            <table style={styles.table}>
              <thead style={styles.tableHeader}>
                <tr>
                  <th style={{...styles.headerCell, width: '120px'}}>Program</th>
                  <th style={{...styles.headerCell, width: '150px'}}>Last Name</th>
                  <th style={{...styles.headerCell, width: '150px'}}>Middle Name</th>
                  <th style={{...styles.headerCell, width: '150px'}}>First Name</th>
                  <th style={{...styles.headerCell, width: '100px'}}>Status</th>
                  <th style={{...styles.headerCell, width: '200px'}}>Current Position</th>
                  <th style={{...styles.headerCell, width: '120px'}}>Salary</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlumni.length === 0 ? (
                <tr>
                    <td colSpan={7} style={styles.emptyState}>
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                      <div>No alumni found matching your criteria.</div>
                      <div style={{ fontSize: '14px', marginTop: '8px', color: '#9ca3af' }}>
                        Try adjusting your search or filter settings.
                      </div>
                  </td>
                </tr>
              ) : (
                filteredAlumni.map((alumni, index) => (
                  <tr
                    key={index}
                      style={styles.tableRow}
                    onClick={() => openModal(alumni)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') openModal(alumni);
                    }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 8px 25px -5px rgba(0, 0, 0, 0.15)';
                        e.currentTarget.style.borderLeft = '4px solid #667eea';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = '';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '';
                        e.currentTarget.style.borderLeft = '';
                      }}
                    >
                      <td style={{...styles.bodyCell, width: '120px'}}>
                        <span style={{
                          backgroundColor: '#e0e7ff',
                          color: '#3730a3',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          {alumni.program || alumni.Program_Name || alumni.course || 'N/A'}
                        </span>
                    </td>
                      <td style={{...styles.bodyCell, width: '150px'}}>
                      {alumni.l_name ||
                        alumni.Last_Name ||
                        alumni.last_name ||
                        alumni.lastName ||
                        (alumni.name ? alumni.name.split(' ').slice(-1)[0] : '') ||
                          'N/A'}
                    </td>
                      <td style={{...styles.bodyCell, width: '150px'}}>
                      {alumni.m_name ||
                        alumni.Middle_Name ||
                        alumni.middle_name ||
                        alumni.middleName ||
                        (alumni.name && alumni.name.split(' ').length > 2
                          ? alumni.name.split(' ').slice(1, -1).join(' ')
                          : '') ||
                          'N/A'}
                    </td>
                      <td style={{...styles.bodyCell, width: '150px'}}>
                      {alumni.f_name ||
                        alumni.First_Name ||
                        alumni.first_name ||
                        alumni.firstName ||
                        (alumni.name ? alumni.name.split(' ')[0] : '') ||
                          'N/A'}
                    </td>
                      <td style={{...styles.bodyCell, width: '100px'}}>
                        <span style={{
                          ...styles.statusBadge,
                          ...(alumni.status === 'active' || alumni.Status === 'active' || alumni.user_status === 'active' 
                            ? styles.statusActive 
                            : styles.statusInactive)
                        }}>
                          {alumni.status || alumni.Status || alumni.user_status || 'Unknown'}
                        </span>
                    </td>
                      <td style={{...styles.bodyCell, width: '200px'}}>
                      {alumni.position_current ||
                        trackerAnswersMap[alumni.id]?.position_current ||
                        trackerAnswersMap[alumni.user_id]?.position_current ||
                          <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Not specified</span>}
                    </td>
                      <td style={{...styles.bodyCell, width: '120px'}}>
                      {alumni.salary_current ||
                        trackerAnswersMap[alumni.id]?.salary_current ||
                        trackerAnswersMap[alumni.user_id]?.salary_current ||
                          <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Not specified</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          )}
        </div>

        {/* Enhanced Modal */}
        {modalAlumni && modalOpen && (
          <div style={styles.modalOverlay} onClick={closeModal}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h2 style={styles.modalTitle}>Alumni Details</h2>
              <button
                onClick={closeModal}
                  style={styles.modalCloseButton}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#dc2626';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#ef4444';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  ✕ Close
              </button>
              </div>

              {modalLoading ? (
                <div style={styles.loadingSpinner}>
                  <div>Loading details...</div>
                </div>
              ) : (
                <table style={styles.detailsTable}>
                <tbody>
                  {Object.entries({
                    'CTU ID':
                      modalAlumni.ctu_id || modalAlumni.CTU_ID || getTrackerAnswerByLabel('ctu id'),
                    'First Name':
                      modalAlumni.f_name ||
                      modalAlumni.First_Name ||
                      modalAlumni.first_name ||
                      modalAlumni.firstName ||
                      (modalAlumni.name ? modalAlumni.name.split(' ')[0] : '') ||
                      getTrackerAnswerByLabel('first name'),
                    'Middle Name':
                      modalAlumni.middleName ||
                      modalAlumni.Middle_Name ||
                      modalAlumni.middle_name ||
                      (modalAlumni.name && modalAlumni.name.split(' ').length > 2
                        ? modalAlumni.name.split(' ').slice(1, -1).join(' ')
                        : '') ||
                      getTrackerAnswerByLabel('middle name'),
                    'Last Name':
                      modalAlumni.l_name ||
                      modalAlumni.Last_Name ||
                      modalAlumni.last_name ||
                      modalAlumni.lastName ||
                      (modalAlumni.name ? modalAlumni.name.split(' ').slice(-1)[0] : '') ||
                      getTrackerAnswerByLabel('last name'),
                    Gender:
                      modalAlumni.gender || modalAlumni.Gender || getTrackerAnswerByLabel('gender'),
                    Birthdate:
                      modalAlumni.birthdate ||
                      modalAlumni.Birthdate ||
                      modalAlumni.birth_date ||
                      getTrackerAnswerByLabel('birthdate'),
                    'Phone Number':
                      modalAlumni.phone_num ||
                      modalAlumni.Phone_Number ||
                      modalAlumni.phone ||
                      getTrackerAnswerByLabel('phone'),
                    Address:
                      modalAlumni.address ||
                      modalAlumni.Address ||
                      getTrackerAnswerByLabel('address'),
                    'Social Media':
                      modalAlumni.social_media ||
                      modalAlumni.Social_Media ||
                      getTrackerAnswerByLabel('social'),
                    Age: modalAlumni.age || modalAlumni.Age || getTrackerAnswerByLabel('age'),
                    Email:
                      modalAlumni.email || modalAlumni.Email || getTrackerAnswerByLabel('email'),
                    'Program Name':
                      modalAlumni.program ||
                      modalAlumni.Program_Name ||
                      modalAlumni.course ||
                      getTrackerAnswerByLabel('program'),
                    Status:
                      modalAlumni.status ||
                      modalAlumni.Status ||
                      modalAlumni.user_status ||
                      getTrackerAnswerByLabel('status'),
                    'Company name current':
                      modalAlumni.company_name_current ||
                      modalAlumni['Company name current'] ||
                      modalAlumni.company ||
                      getTrackerAnswerByLabel('company') ||
                      getTrackerAnswerByLabel('employer') ||
                      getTrackerAnswerByLabel('current company'),
                    'Position current':
                      modalAlumni.position_current ||
                      modalAlumni['Position current'] ||
                      getTrackerAnswerByLabel('current position'),
                    'Sector current':
                      modalAlumni.sector_current ||
                      modalAlumni['Sector current'] ||
                      getTrackerAnswerByLabel('sector'),
                    'Employment duration current':
                      modalAlumni.employment_duration_current ||
                      modalAlumni['Employment duration current'] ||
                      modalAlumni.employment_duration ||
                      getTrackerAnswerByLabel('employment duration') ||
                      getTrackerAnswerByLabel('how long') ||
                      getTrackerAnswerByLabel('duration'),
                    'Salary current':
                      modalAlumni.salary_current ||
                      modalAlumni['Salary current'] ||
                      modalAlumni.salary ||
                      getTrackerAnswerByLabel('salary'),
                    'Supporting document current':
                      modalAlumni.supporting_document_current ||
                      modalAlumni['Supporting document current'] ||
                      getTrackerAnswerByLabel('supporting document'),
                    'Awards recognition current':
                      modalAlumni.awards_recognition_current ||
                      modalAlumni['Awards recognition current'] ||
                      getTrackerAnswerByLabel('awards'),
                    'Supporting document awards recognition':
                      modalAlumni.supporting_document_awards_recognition ||
                      modalAlumni['Supporting document awards recognition'] ||
                      getTrackerAnswerByLabel('awards'),
                    'Unemployment reason':
                      modalAlumni.unemployment_reason ||
                      modalAlumni['Unemployment reason'] ||
                      getTrackerAnswerByLabel('unemployment'),
                    'Pursue further study':
                      modalAlumni.pursue_further_study ||
                      modalAlumni['Pursue further study'] ||
                      getTrackerAnswerByLabel('pursue'),
                    'Date started':
                      modalAlumni.date_started ||
                      modalAlumni['Date started'] ||
                      getTrackerAnswerByLabel('date started'),
                    'School name':
                      modalAlumni.school_name ||
                      modalAlumni['School name'] ||
                      modalAlumni.institution ||
                      modalAlumni.university ||
                      getTrackerAnswerByLabel('school') ||
                      getTrackerAnswerByLabel('institution') ||
                      getTrackerAnswerByLabel('university'),
                  }).map(([label, value]) => (
                      <tr key={label} style={styles.detailsRow}>
                        <td style={styles.detailsLabel}>{label}:</td>
                        <td style={styles.detailsValue}>
                        {value === undefined || value === null || value === '' ? (
                            <em style={{ color: '#9ca3af' }}>No answer</em>
                        ) : typeof value === 'object' ? (
                          JSON.stringify(value)
                        ) : (
                            String(value)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
              {renderTrackerAnswers()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlumniData;