import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../global/sidebar';
import {
  fetchAlumniByYear,
  fetchTrackerResponsesByUser,
  fetchAlumniDetails,
} from '../../../services/api';
import { trackerApi } from '../../../services/trackerApi';
import { FaSearch, FaFilter, FaEye, FaDownload, FaSort, FaSortUp, FaSortDown, FaUser, FaBuilding, FaCalendarAlt, FaGraduationCap, FaArrowLeft } from 'react-icons/fa';

const AlumniData: React.FC = () => {
  const { year } = useParams<{ year: string }>();
  const navigate = useNavigate();

  const [selectedProgram, setSelectedProgram] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [alumniList, setAlumniList] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAlumni, setModalAlumni] = useState<any | null>(null);
  const [trackerAnswers, setTrackerAnswers] = useState<any[]>([]);
  const [trackerQuestions, setTrackerQuestions] = useState<any[]>([]);
  const [trackerAnswersMap, setTrackerAnswersMap] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'lastName', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

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

  // Keyboard shortcuts: '/' focuses search, Esc closes modal
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }
      if (e.key === 'Escape' && modalOpen) {
        setModalOpen(false);
        setModalAlumni(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalOpen]);

  // Debounce search for smoother typing
  const debouncedSearchTerm = useMemo(() => searchTerm, [searchTerm]);

  // Enhanced filtering and sorting
  const filteredAlumni = alumniList.filter((alumni) => {
    const matchProgram = selectedProgram === 'All' || 
      alumni.program === selectedProgram ||
      (alumni.program && alumni.program.toLowerCase() === selectedProgram.toLowerCase());
    const matchSearch = 
      (alumni.name || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      (alumni.f_name || alumni.First_Name || alumni.first_name || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      (alumni.l_name || alumni.Last_Name || alumni.last_name || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      (alumni.m_name || alumni.Middle_Name || alumni.middle_name || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase());
    return matchProgram && matchSearch;
  });

  // Sorting functionality
  const sortedAlumni = [...filteredAlumni].sort((a, b) => {
    if (!sortConfig) {
      // Default alphabetical sorting by last name if no sort config
      const aLastName = a.l_name || a.Last_Name || a.last_name || (a.name ? a.name.split(' ').slice(-1)[0] : '');
      const bLastName = b.l_name || b.Last_Name || b.last_name || (b.name ? b.name.split(' ').slice(-1)[0] : '');
      return aLastName.localeCompare(bLastName);
    }
    
    const getValue = (obj: any, key: string) => {
      switch (key) {
        case 'lastName':
          return obj.l_name || obj.Last_Name || obj.last_name || (obj.name ? obj.name.split(' ').slice(-1)[0] : '');
        case 'firstName':
          return obj.f_name || obj.First_Name || obj.first_name || (obj.name ? obj.name.split(' ')[0] : '');
        case 'middleName':
          return obj.m_name || obj.Middle_Name || obj.middle_name || '';
        case 'status':
          return obj.status || obj.Status || obj.user_status || '';
        case 'position':
          return obj.position_current || trackerAnswersMap[obj.id]?.position_current || trackerAnswersMap[obj.user_id]?.position_current || '';
        case 'salary':
          return obj.salary_current || trackerAnswersMap[obj.id]?.salary_current || trackerAnswersMap[obj.user_id]?.salary_current || '';
        case 'program':
          return obj.program || obj.Program_Name || obj.course || '';
        default:
          return '';
      }
    };

    const aVal = getValue(a, sortConfig.key);
    const bVal = getValue(b, sortConfig.key);
    
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination
  const totalPages = Math.ceil(sortedAlumni.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentAlumni = sortedAlumni.slice(startIndex, endIndex);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return <FaSort />;
    return sortConfig.direction === 'asc' ? <FaSortUp /> : <FaSortDown />;
  };

  // Format salary range: "5001_10000" -> "5,001 - 10,000"
  const formatSalaryRange = (salary: string | undefined | null): string => {
    if (!salary || typeof salary !== 'string') return salary || '';
    
    // Check if it contains underscore (range format)
    if (salary.includes('_')) {
      const parts = salary.split('_');
      if (parts.length === 2) {
        const start = parseInt(parts[0], 10);
        const end = parseInt(parts[1], 10);
        if (!isNaN(start) && !isNaN(end)) {
          return `${start.toLocaleString()} - ${end.toLocaleString()}`;
        }
      }
    }
    
    // If not a range, try to format as number if possible
    const num = parseFloat(salary.replace(/[^\d.]/g, ''));
    if (!isNaN(num)) {
      return num.toLocaleString();
    }
    
    return salary;
  };

  // Format employment duration: "1_2_years" -> "1-2 years"
  const formatEmploymentDuration = (duration: string | undefined | null): string => {
    if (!duration || typeof duration !== 'string') return duration || '';
    
    // Handle common patterns
    // Pattern: "1_2_years" -> "1-2 years"
    // Pattern: "1_year" -> "1 year"
    // Pattern: "6_months" -> "6 months"
    
    let formatted = duration.trim();
    
    // Replace underscores with hyphens first
    formatted = formatted.replace(/_/g, '-');
    
    // Format time units: ensure proper spacing
    formatted = formatted.replace(/-years$/i, ' years');
    formatted = formatted.replace(/-year$/i, ' year');
    formatted = formatted.replace(/-months$/i, ' months');
    formatted = formatted.replace(/-month$/i, ' month');
    formatted = formatted.replace(/-days$/i, ' days');
    formatted = formatted.replace(/-day$/i, ' day');
    
    return formatted;
  };

  // Format supporting document: handle JSON objects or URLs
  const formatSupportingDocument = (doc: any): string => {
    if (!doc || doc === '' || doc === null || doc === undefined) return '';
    
    // If it's a string, check if it's a URL or JSON string
    if (typeof doc === 'string') {
      // Try to parse as JSON
      try {
        const parsed = JSON.parse(doc);
        if (parsed && typeof parsed === 'object') {
          // If it's an object (like {"type":"file"}), show "Document Available"
          return 'Document Available';
        }
      } catch {
        // If it's not JSON, check if it's a URL
        if (doc.startsWith('http') || doc.startsWith('/')) {
          return 'Document Available';
        }
        // If it's a regular string that's not empty, return it
        return doc.trim() !== '' ? doc : '';
      }
    }
    
    // If it's already an object (not a string)
    if (typeof doc === 'object') {
      // Any object format means there's a document
      return 'Document Available';
    }
    
    // Fallback: convert to string
    const stringValue = String(doc).trim();
    return stringValue !== '' ? stringValue : '';
  };

  const openModal = async (alumni: any) => {
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
        <span style={{ color: '#888', fontStyle: 'italic', marginLeft: 8 }}>
          No tracker answers available.
        </span>
      );
    }
    return (
      <div>
        <h3 style={{ marginTop: 20, marginBottom: 10 }}>All Tracker Answers</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {entries.map(([question, answer]) => (
            <li key={question} style={{ padding: '6px 12px', borderBottom: '1px solid #eee' }}>
              <>
                <strong>{question}:</strong>{' '}
                {typeof answer === 'object' ? JSON.stringify(answer) : answer}
              </>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
      <Sidebar />

      <div className="admin-content-page" style={{ flex: 1, overflowY: 'auto', backgroundColor: '#f8fafc', marginLeft: 'var(--sidebar-width, 220px)', transition: 'margin-left 0.3s ease' }}>
        {/* Enhanced Header */}
        <div style={styles.header}>
          <div style={styles.headerContent}>
            <button onClick={() => navigate(-1)} style={styles.backButton}>
              <FaArrowLeft style={{ marginRight: '8px' }} />
              
            </button>
            
            <div style={styles.titleSection}>
              <h1 style={styles.title}>
                <FaGraduationCap style={{ marginRight: '12px', color: 'white' }} />
                Alumni Data
              </h1>
              <p style={styles.subtitle}>Class of {year}</p>
            </div>
          </div>
        </div>

        {/* Compact Controls */}
        <div style={styles.controlsSection}>
          <div style={styles.filtersContainer}>
            <div style={styles.searchContainer}>
              <FaSearch style={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search alumni by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                ref={searchInputRef}
                style={styles.searchInput}
              />
            </div>

            <div style={styles.filterGroup}>
              <FaFilter style={styles.filterIcon} />
              <select
                value={selectedProgram}
                onChange={(e) => setSelectedProgram(e.target.value)}
                style={styles.courseSelect}
              >
                <option value="All">All Programs</option>
                {Array.from(new Set(alumniList.map((a) => a.program || a.Program_Name || a.course).filter(Boolean))).map((p: any) => (
                  <option key={String(p)} value={String(p)}>{String(p)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Enhanced Table */}
        <div style={styles.tableContainer}>
          {loading ? (
            <div style={styles.loadingContainer}>
              <div style={styles.spinner}></div>
              <p style={styles.loadingText}>Loading alumni data...</p>
            </div>
          ) : (
            <>
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr style={{...styles.tableHeader, position: 'sticky', top: 0, zIndex: 2}}>
                      <th style={styles.sortableHeader} onClick={() => handleSort('program')}>
                        <div style={styles.headerContent}>
                          <FaGraduationCap style={styles.headerIcon} />
                          Program
                          {getSortIcon('program')}
                        </div>
                      </th>
                      <th style={styles.sortableHeader} onClick={() => handleSort('lastName')}>
                        <div style={styles.headerContent}>
                          <FaUser style={styles.headerIcon} />
                          Last Name
                          {getSortIcon('lastName')}
                        </div>
                      </th>
                      <th style={styles.sortableHeader} onClick={() => handleSort('middleName')}>
                        Middle Name
                        {getSortIcon('middleName')}
                      </th>
                      <th style={styles.sortableHeader} onClick={() => handleSort('firstName')}>
                        First Name
                        {getSortIcon('firstName')}
                      </th>
                      <th style={styles.sortableHeader} onClick={() => handleSort('status')}>
                        Employment Status
                        {getSortIcon('status')}
                      </th>
                      <th style={styles.sortableHeader} onClick={() => handleSort('position')}>
                        <div style={styles.headerContent}>
                          <FaBuilding style={styles.headerIcon} />
                          Current Position
                          {getSortIcon('position')}
                        </div>
                      </th>
                      <th style={styles.sortableHeader} onClick={() => handleSort('salary')}>
                        <div style={styles.headerContent}>
                          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>₱</span>
                          Current Salary
                          {getSortIcon('salary')}
                        </div>
                      </th>
                      <th style={styles.headerCell}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentAlumni.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={styles.emptyState}>
                          <div style={styles.emptyStateContent}>
                            <FaUser style={styles.emptyIcon} />
                            <h3 style={styles.emptyTitle}>No alumni found</h3>
                            <p style={styles.emptyText}>
                              {searchTerm || selectedProgram !== 'All' 
                                ? 'Try adjusting your search or filter criteria'
                                : 'No alumni data available for this batch'
                              }
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      currentAlumni.map((alumni, index) => (
                        <tr
                          key={index}
                          style={{
                            ...styles.tableRow,
                            backgroundColor: index % 2 === 0 ? '#ffffff' : '#fafbff'
                          }}
                          onClick={() => openModal(alumni)}
                        >
                          <td style={styles.tableCell}>
                            <span style={styles.programBadge}>
                              {alumni.program || alumni.Program_Name || alumni.course || 'N/A'}
                            </span>
                          </td>
                          <td style={styles.tableCell}>
                            <div style={styles.nameContainer}>
                              <span style={styles.nameText}>
                                {alumni.l_name ||
                                  alumni.Last_Name ||
                                  alumni.last_name ||
                                  alumni.lastName ||
                                  (alumni.name ? alumni.name.split(' ').slice(-1)[0] : '') ||
                                  'N/A'}
                              </span>
                            </div>
                          </td>
                          <td style={styles.tableCell}>
                            {alumni.m_name ||
                              alumni.Middle_Name ||
                              alumni.middle_name ||
                              alumni.middleName ||
                              (alumni.name && alumni.name.split(' ').length > 2
                                ? alumni.name.split(' ').slice(1, -1).join(' ')
                                : '') ||
                              '-'}
                          </td>
                          <td style={styles.tableCell}>
                            {alumni.f_name ||
                              alumni.First_Name ||
                              alumni.first_name ||
                              alumni.firstName ||
                              (alumni.name ? alumni.name.split(' ')[0] : '') ||
                              'N/A'}
                          </td>
                          <td style={styles.tableCell}>
                            <span style={{
                              ...styles.statusBadge,
                              backgroundColor: (alumni.employment_status || alumni.status || alumni.Status || alumni.user_status) === 'Employed' ? '#10b981' : 
                                             (alumni.employment_status || alumni.status || alumni.Status || alumni.user_status) === 'Unemployed' ? '#ef4444' :
                                             (alumni.employment_status || alumni.status || alumni.Status || alumni.user_status) === 'Pending' ? '#f59e0b' : '#6b7280'
                            }}>
                              {(() => {
                                const status = alumni.employment_status || alumni.status || alumni.Status || alumni.user_status || 'Unknown';
                                return status === 'Pending' ? 'Untracked' : status;
                              })()}
                            </span>
                          </td>
                          <td style={styles.tableCell}>
                            <div style={styles.positionContainer}>
                              {alumni.position_current ||
                                alumni.company_name_current ||
                                trackerAnswersMap[alumni.id]?.position_current ||
                                trackerAnswersMap[alumni.user_id]?.position_current ? (
                                <span>
                                  {alumni.position_current ||
                                    alumni.company_name_current ||
                                    trackerAnswersMap[alumni.id]?.position_current ||
                                    trackerAnswersMap[alumni.user_id]?.position_current}
                                </span>
                              ) : (
                                <span style={styles.noData}>Not specified</span>
                              )}
                            </div>
                          </td>
                          <td style={styles.tableCell}>
                            {alumni.salary_current ||
                              trackerAnswersMap[alumni.id]?.salary_current ||
                              trackerAnswersMap[alumni.user_id]?.salary_current ? (
                              <div style={styles.salaryContainer}>
                                <span style={{ fontSize: '14px', fontWeight: 'bold', marginRight: '6px' }}>₱</span>
                                <span>
                                  {formatSalaryRange(
                                    alumni.salary_current ||
                                    trackerAnswersMap[alumni.id]?.salary_current ||
                                    trackerAnswersMap[alumni.user_id]?.salary_current
                                  )}
                                </span>
                              </div>
                            ) : (
                              <span style={styles.noData}>Not disclosed</span>
                            )}
                          </td>
                          <td style={styles.tableCell}>
                            <button
                              style={styles.viewButton}
                              onClick={(e) => {
                                e.stopPropagation();
                                openModal(alumni);
                              }}
                            >
                              <FaEye />
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={styles.pagination}>
                  <button
                    style={{
                      ...styles.paginationButton,
                      opacity: currentPage === 1 ? 0.5 : 1,
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                    }}
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                  
                  <div style={styles.pageNumbers}>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                      return (
                        <button
                          key={pageNum}
                          style={{
                            ...styles.pageButton,
                            backgroundColor: pageNum === currentPage ? '#3b82f6' : 'transparent',
                            color: pageNum === currentPage ? 'white' : '#374151'
                          }}
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    style={{
                      ...styles.paginationButton,
                      opacity: currentPage === totalPages ? 0.5 : 1,
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                    }}
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        {/* Enhanced Modal */}
        {modalAlumni && modalOpen && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
              <div style={styles.modalHeader}>
                <h2 style={styles.modalTitle}>
                  <FaUser style={{ marginRight: '12px', color: '#6C63FF' }} />
                  Alumni Details
                </h2>
                <button onClick={closeModal} style={styles.modalCloseButton}>
                  ×
                </button>
              </div>
              
              <div style={styles.modalBody}>
                <div style={styles.detailsGrid}>
                  {Object.entries({
                    'CTU ID': modalAlumni.ctu_id || modalAlumni.CTU_ID || getTrackerAnswerByLabel('ctu id'),
                    'First Name': modalAlumni.f_name || modalAlumni.First_Name || modalAlumni.first_name || modalAlumni.firstName || (modalAlumni.name ? modalAlumni.name.split(' ')[0] : '') || getTrackerAnswerByLabel('first name'),
                    'Middle Name': modalAlumni.middleName || modalAlumni.Middle_Name || modalAlumni.middle_name || (modalAlumni.name && modalAlumni.name.split(' ').length > 2 ? modalAlumni.name.split(' ').slice(1, -1).join(' ') : '') || getTrackerAnswerByLabel('middle name'),
                    'Last Name': modalAlumni.l_name || modalAlumni.Last_Name || modalAlumni.last_name || modalAlumni.lastName || (modalAlumni.name ? modalAlumni.name.split(' ').slice(-1)[0] : '') || getTrackerAnswerByLabel('last name'),
                    'Gender': modalAlumni.gender || modalAlumni.Gender || getTrackerAnswerByLabel('gender'),
                    'Birthdate': modalAlumni.birthdate || modalAlumni.Birthdate || modalAlumni.birth_date || getTrackerAnswerByLabel('birthdate'),
                    'Phone Number': modalAlumni.phone_num || modalAlumni.Phone_Number || modalAlumni.phone || getTrackerAnswerByLabel('phone'),
                    'Address': modalAlumni.address || modalAlumni.Address || getTrackerAnswerByLabel('address'),
                    'Social Media': modalAlumni.social_media || modalAlumni.Social_Media || getTrackerAnswerByLabel('social'),
                    'Age': modalAlumni.age || modalAlumni.Age || getTrackerAnswerByLabel('age'),
                    'Email': modalAlumni.email || modalAlumni.Email || getTrackerAnswerByLabel('email'),
                    'Program Name': modalAlumni.program || modalAlumni.Program_Name || modalAlumni.course || getTrackerAnswerByLabel('program'),
                    'Status': modalAlumni.employment_status || modalAlumni.status || modalAlumni.Status || modalAlumni.user_status || getTrackerAnswerByLabel('status'),
                    'Company': modalAlumni.company_name_current || modalAlumni['Company name current'] || modalAlumni.company || getTrackerAnswerByLabel('company') || getTrackerAnswerByLabel('employer') || getTrackerAnswerByLabel('current company'),
                    'Position': modalAlumni.position_current || modalAlumni['Position current'] || getTrackerAnswerByLabel('current position'),
                    'Sector': modalAlumni.sector_current || modalAlumni['Sector current'] || getTrackerAnswerByLabel('sector'),
                    'Employment Duration': formatEmploymentDuration(modalAlumni.employment_duration_current || modalAlumni['Employment duration current'] || modalAlumni.employment_duration || getTrackerAnswerByLabel('employment duration') || getTrackerAnswerByLabel('how long') || getTrackerAnswerByLabel('duration')),
                    'Salary': formatSalaryRange(modalAlumni.salary_current || modalAlumni['Salary current'] || modalAlumni.salary || getTrackerAnswerByLabel('salary')),
                    'Supporting Document': formatSupportingDocument(modalAlumni.supporting_document_current || modalAlumni['Supporting document current'] || getTrackerAnswerByLabel('supporting document')),
                    'Awards': modalAlumni.awards_recognition_current || modalAlumni['Awards recognition current'] || getTrackerAnswerByLabel('awards'),
                    'Unemployment Reason': modalAlumni.unemployment_reason || modalAlumni['Unemployment reason'] || getTrackerAnswerByLabel('unemployment'),
                    'Pursuing Further Study': modalAlumni.pursue_further_study || modalAlumni['Pursue further study'] || getTrackerAnswerByLabel('pursue'),
                    'Date Started': modalAlumni.date_started || modalAlumni['Date started'] || getTrackerAnswerByLabel('date started'),
                    'School Name': modalAlumni.school_name || modalAlumni['School name'] || modalAlumni.institution || modalAlumni.university || getTrackerAnswerByLabel('school') || getTrackerAnswerByLabel('institution') || getTrackerAnswerByLabel('university'),
                  }).map(([label, value]) => (
                    <div key={label} style={styles.detailItem}>
                      <div style={styles.detailLabel}>{label}</div>
                      <div style={styles.detailValue}>
                        {value === undefined || value === null || value === '' ? (
                          <span style={styles.noData}>No data available</span>
                        ) : typeof value === 'object' ? (
                          JSON.stringify(value)
                        ) : (
                          value
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {renderTrackerAnswers()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Comprehensive styles object
const styles: { [key: string]: React.CSSProperties } = {
  // Header styles
  header: {
    background: '#1c4e80',
    color: 'white',
    padding: '24px 32px 24px 0px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '1200px',
    margin: '0 auto',
    position: 'relative',
  },
  backButton: {
    background: 'transparent',
    border: 'none',
    color: 'white',
    padding: '0',
    cursor: 'pointer',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s ease',
    position: 'absolute',
    left: '0',
    zIndex: 1,
    fontSize: '24px',
  },
  titleSection: {
    textAlign: 'center',
    flex: 1,
  },
  title: {
    margin: '0',
    fontSize: '28px',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    margin: '8px 0 0 0',
    fontSize: '16px',
    opacity: 0.9,
  },
  headerActions: {
    display: 'flex',
    gap: '12px',
  },
  exportButton: {
    background: 'white',
    border: '2px solid #6C63FF',
    color: '#6C63FF',
    padding: '10px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s ease',
  },

  // Controls section
  controlsSection: {
    padding: '8px 32px',
    backgroundColor: 'white',
    borderBottom: '1px solid #e5e7eb',
  },
  filtersContainer: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0px',
    width: '100%',
  },
  searchContainer: {
    position: 'relative',
    flex: 1,
    maxWidth: '400px',
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#6b7280',
    fontSize: '16px',
  },
  searchInput: {
    width: '100%',
    padding: '12px 16px 12px 44px',
    border: '2px solid #e5e7eb',
    borderRadius: '12px',
    fontSize: '16px',
    transition: 'all 0.2s ease',
    outline: 'none',
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    maxWidth: '200px',
  },
  filterIcon: {
    color: '#6b7280',
    fontSize: '16px',
  },
  courseSelect: {
    padding: '12px 16px',
    border: '2px solid #e5e7eb',
    borderRadius: '12px',
    fontSize: '16px',
    cursor: 'pointer',
    outline: 'none',
    transition: 'all 0.2s ease',
  },


  // Table styles
  tableContainer: {
    padding: '24px 32px',
    backgroundColor: 'white',
    margin: '0 32px 32px',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e5e7eb',
    borderTop: '4px solid #6C63FF',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: '16px',
    color: '#6b7280',
    fontSize: '16px',
  },
  tableWrapper: {
    overflowX: 'auto',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
  },
  tableHeader: {
    backgroundColor: '#f8fafc',
    borderBottom: '2px solid #e5e7eb',
  },
  sortableHeader: {
    padding: '16px 12px',
    textAlign: 'left',
    fontWeight: '600',
    color: '#374151',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'all 0.2s ease',
    borderRight: '1px solid #e5e7eb',
  },
  headerIcon: {
    fontSize: '14px',
    color: '#6b7280',
  },
  headerCell: {
    padding: '16px 12px',
    textAlign: 'left',
    fontWeight: '600',
    color: '#374151',
    borderRight: '1px solid #e5e7eb',
  },
  tableRow: {
    borderBottom: '1px solid #e5e7eb',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  tableCell: {
    padding: '16px 12px',
    verticalAlign: 'middle',
    borderRight: '1px solid #e5e7eb',
  },
  emptyState: {
    padding: '60px 20px',
    textAlign: 'center',
  },
  emptyStateContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  emptyIcon: {
    fontSize: '48px',
    color: '#d1d5db',
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#374151',
    margin: '0',
  },
  emptyText: {
    fontSize: '14px',
    color: '#6b7280',
    margin: '0',
  },

  // Data display styles
  programBadge: {
    background: '#f0f0ff',
    color: '#4A47E0',
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
  },
  nameContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  nameIcon: {
    fontSize: '14px',
    color: '#6b7280',
  },
  nameText: {
    fontWeight: '500',
  },
  statusBadge: {
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    color: 'white',
  },
  positionContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  positionIcon: {
    fontSize: '14px',
    color: '#6b7280',
  },
  salaryContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: '600',
    color: '#059669',
  },
  salaryIcon: {
    fontSize: '14px',
  },
  noData: {
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  viewButton: {
    background: '#4A47E0',
    color: 'white',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s ease',
  },

  // Pagination styles
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
    marginTop: '24px',
  },
  paginationButton: {
    padding: '8px 16px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    background: 'white',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s ease',
  },
  pageNumbers: {
    display: 'flex',
    gap: '4px',
  },
  pageButton: {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    background: 'white',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s ease',
  },

  // Modal styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px',
  },
  modalContent: {
    background: 'white',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '800px',
    maxHeight: '90vh',
    overflow: 'hidden',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },
  modalHeader: {
    padding: '24px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    margin: 0,
    fontSize: '24px',
    fontWeight: '700',
    color: '#1f2937',
    display: 'flex',
    alignItems: 'center',
  },
  modalCloseButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#6b7280',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    transition: 'all 0.2s ease',
  },
  modalBody: {
    padding: '24px',
    overflowY: 'auto',
    maxHeight: 'calc(90vh - 100px)',
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '16px',
  },
  detailItem: {
    padding: '16px',
    background: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },
  detailLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '8px',
  },
  detailValue: {
    fontSize: '16px',
    color: '#1f2937',
  },
};

// Add CSS animation for spinner
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

export default AlumniData;