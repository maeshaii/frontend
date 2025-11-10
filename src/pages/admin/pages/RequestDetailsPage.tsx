import React, { useEffect, useState, useMemo } from 'react';
import Sidebar from '../global/sidebar';
import { fetchOJTByYear, approveCoordinatorRequest } from '../../../services/api';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

const RequestDetailsPage: React.FC = () => {
  const { year } = useParams<{ year: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [ojtRows, setOjtRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  
  // Get course filter from URL parameters
  const urlParams = new URLSearchParams(location.search);
  const selectedCourse = urlParams.get('course') || 'ALL';

  const filteredRows = useMemo(() => {
    let filtered = ojtRows;
    
    // Filter by course
    if (selectedCourse !== 'ALL') {
      filtered = filtered.filter((r) => {
        const course = (r.course || '').toLowerCase();
        return course.includes(selectedCourse.toLowerCase());
      });
    }
    
    // Filter by search query
    const q = (search || '').toLowerCase().trim();
    if (q) {
      filtered = filtered.filter((r) => {
        const first = (r.first_name || (r.name ? r.name.split(' ')[0] : '') || '').toLowerCase();
        const last = (r.last_name || (r.name ? r.name.split(' ').slice(-1)[0] : '') || '').toLowerCase();
        const company = (r.company || '').toLowerCase();
        const ctu = String(r.ctu_id || r.id || '').toLowerCase();
        return first.includes(q) || last.includes(q) || company.includes(q) || ctu.includes(q);
      });
    }
    
    return filtered;
  }, [ojtRows, search, selectedCourse]);

  useEffect(() => {
    const loadOJTData = async () => {
      if (year) {
        try {
          const data = await fetchOJTByYear(year);
          setOjtRows(Array.isArray(data?.ojt_data) ? data.ojt_data : []);
        } catch (error) {
          console.error('Error loading OJT data:', error);
          setOjtRows([]);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    loadOJTData();
  }, [year]);

  const downloadPasswords = (passwords: any[]) => {
    // Create CSV content
    const csvContent = [
      'Username,Password,Name',
      ...passwords.map(p => `${p.username},${p.password},"${p.name}"`)
    ].join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `alumni_passwords_${year}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleApprove = async () => {
    if (!year) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to approve all completed OJT students for Class of ${year}? This will convert them to alumni and generate new passwords.`
    );
    
    if (!confirmed) return;
    
    try {
      const res = await approveCoordinatorRequest(parseInt(year));
      if (res?.success) {
        alert(`Successfully approved ${res.approved} students from Class of ${year}!`);
        
        // Download passwords file if available
        if (res.passwords && res.passwords.length > 0) {
          downloadPasswords(res.passwords);
          alert(`Password file downloaded successfully! ${res.passwords.length} alumni accounts created.`);
        }
        
        // Navigate back to requests list - the card should now be gone since status changed to "Approved"
        // Force a page reload to ensure fresh data
        window.location.href = '/requests';
      } else {
        alert('Approval failed. Please try again.');
      }
    } catch (error) {
      console.error('Approval error:', error);
      alert('Approval failed. Please try again.');
    }
  };

  const completedRows = filteredRows.filter((r) => 
    (r.ojt_status || 'Ongoing') === 'Completed' && !r.is_alumni
  );

  // Debug logging
  console.log('🔍 Admin Debug - All filtered rows:', filteredRows.map(r => ({
    name: r.name,
    ojt_status: r.ojt_status,
    is_alumni: r.is_alumni
  })));
  console.log('🔍 Admin Debug - Completed rows for approval:', completedRows.map(r => ({
    name: r.name,
    ojt_status: r.ojt_status,
    is_alumni: r.is_alumni
  })));

  // Refined, neat styling
  const styles = {
    pageContainer: {
      flex: 1,
      padding: '32px 40px',
      backgroundColor: '#f8f9fa',
      minHeight: '100vh',
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
          <h2 style={styles.title}>Class of {year} - OJT Details</h2>
          <div style={styles.subtitle}>
            Review and approve completed OJT students
          </div>
        </div>
      <div
        className="admin-content-page"
        style={{
          flex: 1,
          padding: '24px 32px',
          backgroundColor: '#f5f6fa',
          marginLeft: 'var(--sidebar-width, 220px)'
        }}
      >
        <h2 style={{ margin: 0, color: '#0b2a55' }}>Class of {year} - OJT Details</h2>
        
        {/* Search and Course Info */}
        <div style={styles.toolbar}>
          <div style={styles.courseBadge}>
            {selectedCourse !== 'ALL' ? `Filtered by: ${selectedCourse}` : 'All Courses'}
          </div>
          <input
            type="text"
            placeholder="Search by name, company, or CTU ID..."
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
                  <th style={styles.th}>Company</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>OJT Status</th>
                </tr>
              </thead>
              <tbody>
                {completedRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ 
                      textAlign: 'center', 
                      padding: '60px 40px', 
                      color: '#64748b', 
                      fontSize: '14px',
                      backgroundColor: 'white'
                    }}>
                      No completed OJT data found for this year.
                    </td>
                  </tr>
                ) : (
                   completedRows.map((ojt, idx) => (
                     <tr
                       key={ojt.id}
                       style={{ 
                         ...(idx % 2 === 1 ? styles.rowEven : { backgroundColor: 'white' }), 
                         cursor: 'pointer',
                         transition: 'background-color 0.15s ease',
                       }}
                       onClick={() => setSelectedStudent(ojt)}
                       onMouseEnter={(e) => {
                         e.currentTarget.style.backgroundColor = '#f1f5f9';
                       }}
                       onMouseLeave={(e) => {
                         e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#fafbfc' : 'white';
                       }}
                     >
                       <td style={{...styles.td, borderBottom: idx === completedRows.length - 1 ? 'none' : '1px solid #f1f5f9'}}>
                         {ojt.last_name || (ojt.name ? ojt.name.split(' ').slice(-1)[0] : '')}
                       </td>
                       <td style={{...styles.td, borderBottom: idx === completedRows.length - 1 ? 'none' : '1px solid #f1f5f9'}}>
                         {ojt.first_name || (ojt.name ? ojt.name.split(' ')[0] : '')}
                       </td>
                       <td style={{...styles.td, borderBottom: idx === completedRows.length - 1 ? 'none' : '1px solid #f1f5f9'}}>
                         {ojt.company || ''}
                       </td>
                       <td style={{...styles.status, borderBottom: idx === completedRows.length - 1 ? 'none' : '1px solid #f1f5f9'}}>
                         <span style={{
                           display: 'inline-block',
                           padding: '6px 12px',
                           backgroundColor: '#d1fae5',
                           color: '#059669',
                           borderRadius: '6px',
                           fontSize: '12px',
                           fontWeight: 600,
                         }}>
                           Completed
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
          <button
            onClick={handleApprove}
            disabled={completedRows.length === 0}
            style={completedRows.length > 0 ? styles.approveButton : styles.approveButtonDisabled}
            onMouseEnter={(e) => {
              if (completedRows.length > 0) {
                e.currentTarget.style.background = '#4c5ee8';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(90, 109, 254, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (completedRows.length > 0) {
                e.currentTarget.style.background = '#5A6DFE';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(90, 109, 254, 0.2)';
              }
            }}
          >
            Approve ({completedRows.length})
          </button>
        </div>

        {/* Student Details Modal */}
        {selectedStudent && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: 'white', width: '560px', maxWidth: '96%', borderRadius: '14px', padding: '22px 24px', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', margin: 0 }}>OJT Details</h3>
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
