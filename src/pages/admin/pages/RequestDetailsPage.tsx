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

  // Consistent table styling to fix header/body alignment
  const styles = {
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      tableLayout: 'fixed' as const,
      marginTop: 16
    },
    th: {
      backgroundColor: '#5A6DFE',
      color: 'white',
      padding: '12px',
      fontWeight: 600,
      textAlign: 'left' as const,
    },
    td: {
      padding: '12px',
      verticalAlign: 'middle' as const,
    },
    status: {
      padding: '12px',
      fontWeight: 600,
      color: '#0093D9',
      textAlign: 'center' as const,
    },
    rowEven: {
      backgroundColor: '#f9f9f9'
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <Sidebar />
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
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 600, color: '#0b2a55' }}>
              {selectedCourse !== 'ALL' ? `Filtered by: ${selectedCourse}` : 'All Courses'}
            </span>
          </div>
          <input
            type="text"
            placeholder="Search by name, company, or CTU ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '10px 14px', border: '1px solid #ccc', borderRadius: 20, width: 280 }}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading OJT data...</div>
        ) : (
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
                  <td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                    No completed OJT data found for this year.
                  </td>
                </tr>
              ) : (
                 completedRows.map((ojt, idx) => (
                   <tr
                     key={ojt.id}
                     style={{ ...(idx % 2 === 1 ? styles.rowEven : undefined), cursor: 'pointer' }}
                     onClick={() => setSelectedStudent(ojt)}
                   >
                     <td style={styles.td}>{ojt.last_name || (ojt.name ? ojt.name.split(' ').slice(-1)[0] : '')}</td>
                     <td style={styles.td}>{ojt.first_name || (ojt.name ? ojt.name.split(' ')[0] : '')}</td>
                     <td style={styles.td}>{ojt.company || ''}</td>
                     <td style={styles.status}>Completed</td>
                   </tr>
                 ))
              )}
            </tbody>
          </table>
        )}

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
          <button 
            onClick={() => navigate('/requests')} 
            style={{ padding: '8px 20px', background: '#ccc', border: 'none', borderRadius: '20px', cursor: 'pointer' }}
          >
            Back
          </button>
          <button
            onClick={handleApprove}
            disabled={completedRows.length === 0}
            style={{ 
              padding: '8px 20px', 
              background: completedRows.length > 0 ? '#5A6DFE' : '#ccc', 
              color: completedRows.length > 0 ? 'white' : '#666', 
              border: 'none', 
              borderRadius: '20px', 
              cursor: completedRows.length > 0 ? 'pointer' : 'not-allowed',
              fontWeight: '600'
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
