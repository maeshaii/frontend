import React, { useEffect, useState, useMemo } from 'react';
import Sidebar from '../global/sidebar';
import { fetchAlumniByYear } from '../../../services/api';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { broadcastCoordinatorRequestCount } from '../utils/requestBadge';
import { toast } from '../../../utils/toast';

const RequestDetailsPage: React.FC = () => {
  const { year } = useParams<{ year: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [alumniRows, setAlumniRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  
  // Get course filter from URL parameters
  const urlParams = new URLSearchParams(location.search);
  const selectedCourse = urlParams.get('course') || 'ALL';

  const filteredRows = useMemo(() => {
    let filtered = alumniRows;
    
    // Filter by course
    if (selectedCourse !== 'ALL') {
      filtered = filtered.filter((r) => {
        const course = (r.program || r.course || '').toLowerCase();
        return course.includes(selectedCourse.toLowerCase());
      });
    }
    
    // Filter by search query
    const q = (search || '').toLowerCase().trim();
    if (q) {
      filtered = filtered.filter((r) => {
        const first = (r.first_name || r.f_name || (r.name ? r.name.split(' ')[0] : '') || '').toLowerCase();
        const last = (r.last_name || r.l_name || (r.name ? r.name.split(' ').slice(-1)[0] : '') || '').toLowerCase();
        const ctu = String(r.ctu_id || r.id || r.acc_username || '').toLowerCase();
        return first.includes(q) || last.includes(q) || ctu.includes(q);
      });
    }
    
    return filtered;
  }, [alumniRows, search, selectedCourse]);

  useEffect(() => {
    const loadAlumniData = async () => {
      if (year) {
        try {
          // Fetch newly converted alumni for this year (converted in last 7 days)
          const data = await fetchAlumniByYear(year);
          // Filter to only show recently converted alumni (last 7 days)
          const recentAlumni = Array.isArray(data?.alumni) ? data.alumni.filter((alum: any) => {
            // Check if user was updated recently (within last 7 days)
            if (alum.updated_at) {
              const updatedDate = new Date(alum.updated_at);
              const sevenDaysAgo = new Date();
              sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
              return updatedDate >= sevenDaysAgo;
            }
            return true; // Include if no updated_at field
          }) : [];
          setAlumniRows(recentAlumni);
        } catch (error) {
          console.error('Error loading alumni data:', error);
          setAlumniRows([]);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    // Initial load
    loadAlumniData();

    // Refresh data every 30 seconds to see new conversions
    const pollInterval = setInterval(() => {
      if (year) {
        loadAlumniData();
      }
    }, 30000); // Poll every 30 seconds

    // Cleanup interval on unmount or when dependencies change
    return () => {
      clearInterval(pollInterval);
    };
  }, [year]);

  // All filtered rows are newly converted alumni (no approval needed)

  // Refined, neat styling
  const styles = {
    pageContainer: {
      flex: 1,
      padding: '32px 40px',
      marginLeft: 'var(--sidebar-width, 220px)',
      backgroundColor: '#f8f9fa',
      minHeight: '100vh',
      width: '100%',
      boxSizing: 'border-box' as const,
    },
    header: {
      marginBottom: '28px',
    },
    title: {
      margin: 0,
      color: '#1a202c',
      fontSize: '28px',
      fontWeight: 700,
      letterSpacing: '-0.5px',
      marginBottom: '4px',
    },
    subtitle: {
      color: '#64748b',
      fontSize: '14px',
      marginTop: '4px',
    },
    toolbar: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '24px',
      flexWrap: 'wrap' as const,
      gap: '16px',
    },
    courseBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '8px 16px',
      backgroundColor: '#e0e7ff',
      color: '#4338ca',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: 600,
    },
    searchInput: {
      padding: '12px 20px',
      border: '1px solid #d1d5db',
      borderRadius: '10px',
      width: '320px',
      fontSize: '14px',
      outline: 'none',
      transition: 'all 0.2s ease',
      backgroundColor: 'white',
    },
    tableContainer: {
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '0',
      marginTop: 0,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
      border: '1px solid #e5e7eb',
      overflow: 'hidden',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      tableLayout: 'fixed' as const,
    },
    th: {
      backgroundColor: '#5A6DFE',
      color: 'white',
      padding: '18px 20px',
      fontWeight: 600,
      textAlign: 'left' as const,
      fontSize: '13px',
      letterSpacing: '0.3px',
      textTransform: 'uppercase' as const,
    },
    td: {
      padding: '18px 20px',
      verticalAlign: 'middle' as const,
      borderBottom: '1px solid #f1f5f9',
      fontSize: '14px',
      color: '#1e293b',
      fontWeight: 400,
    },
    status: {
      padding: '18px 20px',
      fontWeight: 600,
      color: '#059669',
      textAlign: 'center' as const,
      borderBottom: '1px solid #f1f5f9',
      fontSize: '13px',
    },
    rowEven: {
      backgroundColor: '#fafbfc'
    },
    actionBar: {
      marginTop: '28px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    backButton: {
      padding: '12px 24px',
      background: '#f1f5f9',
      color: '#475569',
      border: 'none',
      borderRadius: '10px',
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: '14px',
      transition: 'all 0.2s ease',
    },
    approveButton: {
      padding: '12px 32px',
      background: '#5A6DFE',
      color: 'white',
      border: 'none',
      borderRadius: '10px',
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: '14px',
      transition: 'all 0.2s ease',
      boxShadow: '0 2px 4px rgba(90, 109, 254, 0.2)',
    },
    approveButtonDisabled: {
      padding: '12px 32px',
      background: '#e2e8f0',
      color: '#94a3b8',
      border: 'none',
      borderRadius: '10px',
      cursor: 'not-allowed',
      fontWeight: 600,
      fontSize: '14px',
    },
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <Sidebar />
      <div className="admin-content-page" style={styles.pageContainer}>
        <div style={styles.header}>
          <h2 style={styles.title}>Class of {year} - New Alumni</h2>
          <div style={styles.subtitle}>
            View recently converted alumni (automatically converted from completed OJT students)
          </div>
        </div>

        <div style={styles.toolbar}>
          <div style={styles.courseBadge}>
            {selectedCourse !== 'ALL' ? `Filtered by: ${selectedCourse}` : 'All Courses'}
          </div>
          <input
            type="text"
            placeholder="Search by name or CTU ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#5A6DFE';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(90, 109, 254, 0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {loading ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px 40px', 
            backgroundColor: 'white', 
            borderRadius: '12px', 
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            border: '1px solid #e5e7eb',
            color: '#64748b',
            fontSize: '14px'
          }}>
            Loading OJT data...
          </div>
        ) : (
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <colgroup>
                <col style={{ width: '25%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '35%' }} />
                <col style={{ width: '15%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={styles.th}>Last Name</th>
                  <th style={styles.th}>First Name</th>
                  <th style={styles.th}>Course</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ 
                      textAlign: 'center', 
                      padding: '60px 40px', 
                      color: '#64748b', 
                      fontSize: '14px',
                      backgroundColor: 'white'
                    }}>
                      No newly converted alumni found for this year.
                    </td>
                  </tr>
                ) : (
                   filteredRows.map((alum, idx) => (
                     <tr
                       key={alum.id || alum.user_id}
                       style={{ 
                         ...(idx % 2 === 1 ? styles.rowEven : { backgroundColor: 'white' }), 
                         cursor: 'pointer',
                         transition: 'background-color 0.15s ease',
                       }}
                       onClick={() => setSelectedStudent(alum)}
                       onMouseEnter={(e) => {
                         e.currentTarget.style.backgroundColor = '#f1f5f9';
                       }}
                       onMouseLeave={(e) => {
                         e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#fafbfc' : 'white';
                       }}
                     >
                       <td style={{...styles.td, borderBottom: idx === filteredRows.length - 1 ? 'none' : '1px solid #f1f5f9'}}>
                         {alum.last_name || alum.l_name || (alum.name ? alum.name.split(' ').slice(-1)[0] : '')}
                       </td>
                       <td style={{...styles.td, borderBottom: idx === filteredRows.length - 1 ? 'none' : '1px solid #f1f5f9'}}>
                         {alum.first_name || alum.f_name || (alum.name ? alum.name.split(' ')[0] : '')}
                       </td>
                       <td style={{...styles.td, borderBottom: idx === filteredRows.length - 1 ? 'none' : '1px solid #f1f5f9'}}>
                         {alum.program || alum.course || 'N/A'}
                       </td>
                       <td style={{...styles.status, borderBottom: idx === filteredRows.length - 1 ? 'none' : '1px solid #f1f5f9'}}>
                         <span style={{
                           display: 'inline-block',
                           padding: '6px 12px',
                           backgroundColor: '#dbeafe',
                           color: '#1e40af',
                           borderRadius: '6px',
                           fontSize: '12px',
                           fontWeight: 600,
                         }}>
                           Alumni
                         </span>
                       </td>
                     </tr>
                   ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div style={styles.actionBar}>
          <button 
            onClick={() => navigate('/requests')} 
            style={styles.backButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e2e8f0';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f1f5f9';
            }}
          >
            ← Back
          </button>
        </div>

        {/* Student Details Modal */}
        {selectedStudent && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: 'white', width: '560px', maxWidth: '96%', borderRadius: '14px', padding: '22px 24px', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', margin: 0 }}>Alumni Details</h3>
                <button 
                  onClick={() => setSelectedStudent(null)} 
                  style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#f3f4f6', cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
              <div style={{ height: 1, background: '#e5e7eb', margin: '8px 0 16px' }}></div>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', rowGap: '10px', columnGap: '16px', fontSize: '14px', lineHeight: 1.4 }}>
                <div style={{ color: '#6b7280', fontWeight: 600 }}>CTU ID</div>
                <div style={{ color: '#111827', fontWeight: 500 }}>{selectedStudent.ctu_id || selectedStudent.id || ''}</div>
                <div style={{ color: '#6b7280', fontWeight: 600 }}>First Name</div>
                <div style={{ color: '#111827', fontWeight: 500 }}>{selectedStudent.first_name || (selectedStudent.name ? selectedStudent.name.split(' ')[0] : '')}</div>
                <div style={{ color: '#6b7280', fontWeight: 600 }}>Middle Name</div>
                <div style={{ color: '#111827', fontWeight: 500 }}>{selectedStudent.middle_name || ''}</div>
                <div style={{ color: '#6b7280', fontWeight: 600 }}>Last Name</div>
                <div style={{ color: '#111827', fontWeight: 500 }}>{selectedStudent.last_name || (selectedStudent.name ? selectedStudent.name.split(' ').slice(-1)[0] : '')}</div>
                <div style={{ color: '#6b7280', fontWeight: 600 }}>Gender</div>
                <div style={{ color: '#111827', fontWeight: 500 }}>{selectedStudent.gender || ''}</div>
                <div style={{ color: '#6b7280', fontWeight: 600 }}>Birthdate</div>
                <div style={{ color: '#111827', fontWeight: 500 }}>{selectedStudent.birthdate || ''}</div>
                <div style={{ color: '#6b7280', fontWeight: 600 }}>Phone Number</div>
                <div style={{ color: '#111827', fontWeight: 500 }}>{selectedStudent.phone_number || ''}</div>
                <div style={{ color: '#6b7280', fontWeight: 600 }}>Address</div>
                <div style={{ color: '#111827', fontWeight: 500 }}>{selectedStudent.address || ''}</div>
                <div style={{ color: '#6b7280', fontWeight: 600 }}>Company</div>
                <div style={{ color: '#111827', fontWeight: 500 }}>{selectedStudent.company || ''}</div>
                <div style={{ color: '#6b7280', fontWeight: 600 }}>Status</div>
                <div style={{ color: '#111827', fontWeight: 500 }}>{selectedStudent.ojt_status || 'Ongoing'}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RequestDetailsPage;
