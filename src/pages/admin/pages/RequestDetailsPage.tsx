import React, { useEffect, useState, useMemo } from 'react';
import Sidebar from '../global/sidebar';
import { fetchOJTByYear, approveCoordinatorRequest } from '../../../services/api';
import { useParams, useNavigate } from 'react-router-dom';

const RequestDetailsPage: React.FC = () => {
  const { year } = useParams<{ year: string }>();
  const navigate = useNavigate();
  const [ojtRows, setOjtRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);

  const filteredRows = useMemo(() => {
    const q = (search || '').toLowerCase().trim();
    if (!q) return ojtRows;
    return ojtRows.filter((r) => {
      const first = (r.first_name || (r.name ? r.name.split(' ')[0] : '') || '').toLowerCase();
      const last = (r.last_name || (r.name ? r.name.split(' ').slice(-1)[0] : '') || '').toLowerCase();
      const company = (r.company || '').toLowerCase();
      const ctu = String(r.ctu_id || r.id || '').toLowerCase();
      return first.includes(q) || last.includes(q) || company.includes(q) || ctu.includes(q);
    });
  }, [ojtRows, search]);

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

  const handleApprove = async () => {
    if (!year) return;
    try {
      const res = await approveCoordinatorRequest(parseInt(year));
      if (res?.success) {
        alert(`Approved ${year}. Records updated: ${res.approved}`);
        navigate('/admin/requests');
      } else {
        alert('Approval failed');
      }
    } catch {
      alert('Approval failed');
    }
  };

  const completedRows = filteredRows.filter((r) => (r.ojt_status || 'Ongoing') === 'Completed');

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
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, padding: '24px 32px', backgroundColor: '#f5f6fa', marginLeft: 240 }}>
        <h2 style={{ margin: 0, color: '#0b2a55' }}>Class of {year} - OJT Details</h2>
        
        {/* Search input */}
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
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
            disabled
            style={{ padding: '8px 20px', background: '#ccc', color: '#666', border: 'none', borderRadius: '20px', cursor: 'not-allowed' }}
          >
            Approve
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
