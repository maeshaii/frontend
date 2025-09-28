import React, { useEffect, useState, useMemo } from 'react';
import Sidebar from '../global/sidebar';
import { fetchOJTByYear, approveCoordinatorRequest, approveOJTToAlumni, updateOJTStatus, approveIndividualOJTToAlumni } from '../../../services/api';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

const RequestDetailsPage: React.FC = () => {
  const { year } = useParams<{ year: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [ojtRows, setOjtRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalResult, setApprovalResult] = useState<any>(null);
  const [individualApprovalLoading, setIndividualApprovalLoading] = useState<number | null>(null);
  
  // Get course filter from URL parameters
  const urlParams = new URLSearchParams(location.search);
  const selectedCourse = urlParams.get('course') || 'ALL';

  const filteredRows = useMemo(() => {
    let filtered = ojtRows;
    
    // Filter out users who are already approved by admin
    filtered = filtered.filter((r) => !r.is_alumni);
    
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

  const handleApprove = async () => {
    if (!year) return;
    setApprovalLoading(true);
    try {
      const res = await approveOJTToAlumni(parseInt(year));
      setApprovalResult(res);
      if (res?.success) {
        // Refresh the data to show updated status
        const data = await fetchOJTByYear(year);
        setOjtRows(Array.isArray(data?.ojt_data) ? data.ojt_data : []);
      }
    } catch (error) {
      console.error('Approval error:', error);
      setApprovalResult({ success: false, message: 'Approval failed' });
    } finally {
      setApprovalLoading(false);
    }
  };

  const handleCloseApprovalModal = () => {
    setShowApprovalModal(false);
    setApprovalResult(null);
    // Always navigate back to coordinator requests page when closing modal
    navigate('/admin/requests');
  };

  const handleIndividualApprove = async (userId: number) => {
    console.log('Attempting to approve user ID:', userId);
    setIndividualApprovalLoading(userId);
    try {
      // Convert the individual student to alumni directly
      const res = await approveIndividualOJTToAlumni(userId);
      console.log('Individual alumni conversion response:', res);
      
      if (res?.success) {
        // Refresh the data to show updated status
        if (year) {
          const data = await fetchOJTByYear(year);
          setOjtRows(Array.isArray(data?.ojt_data) ? data.ojt_data : []);
        }
        alert(`Successfully approved and converted to alumni! Student processed.`);
      } else {
        console.error('Individual alumni conversion failed:', res?.message);
        alert('Approval failed: ' + (res?.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Individual approval error:', error);
      alert('Approval failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIndividualApprovalLoading(null);
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
                     style={{ ...(idx % 2 === 1 ? styles.rowEven : undefined) }}
                   >
                     <td 
                       onClick={() => setSelectedStudent(ojt)}
                       style={{ ...styles.td, cursor: 'pointer' }}
                     >
                       {ojt.last_name || (ojt.name ? ojt.name.split(' ').slice(-1)[0] : '')}
                     </td>
                     <td 
                       onClick={() => setSelectedStudent(ojt)}
                       style={{ ...styles.td, cursor: 'pointer' }}
                     >
                       {ojt.first_name || (ojt.name ? ojt.name.split(' ')[0] : '')}
                     </td>
                     <td 
                       onClick={() => setSelectedStudent(ojt)}
                       style={{ ...styles.td, cursor: 'pointer' }}
                     >
                       {ojt.company || ''}
                     </td>
                     <td style={styles.status}>
                       {ojt.is_alumni ? (
                         <div style={{
                           padding: '8px 12px',
                           color: '#374151',
                           textAlign: 'center',
                           fontWeight: '600',
                           fontSize: '14px'
                         }}>
                           Already Approved by Admin
                         </div>
                       ) : ojt.is_sent_to_admin ? (
                         <div style={{
                           padding: '8px 12px',
                           color: '#F59E0B',
                           textAlign: 'center',
                           fontWeight: '600',
                           fontSize: '14px',
                           backgroundColor: '#FEF3C7',
                           borderRadius: '6px'
                         }}>
                           Completed (Pending)
                         </div>
                       ) : (
                         <div style={{
                           padding: '8px 12px',
                           color: '#0093D9',
                           textAlign: 'center',
                           fontWeight: '600',
                           fontSize: '14px'
                         }}>
                           Completed
                         </div>
                       )}
                     </td>
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
            onClick={() => setShowApprovalModal(true)}
            disabled={completedRows.length === 0}
            style={{ 
              padding: '8px 20px', 
              background: completedRows.length === 0 ? '#ccc' : '#164B87', 
              color: completedRows.length === 0 ? '#666' : 'white', 
              border: 'none', 
              borderRadius: '20px', 
              cursor: completedRows.length === 0 ? 'not-allowed' : 'pointer' 
            }}
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

        {/* Approval Confirmation Modal */}
        {showApprovalModal && !approvalResult && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: 'white', width: '480px', maxWidth: '96%', borderRadius: '14px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', color: '#111827' }}>
                Confirm Approval
              </h3>
              <div style={{ height: 1, background: '#e5e7eb', margin: '8px 0 20px' }}></div>
              <p style={{ fontSize: '16px', color: '#374151', marginBottom: '24px', lineHeight: 1.5 }}>
                Are you sure you want to approve the completed OJT students from Class of {year} to become alumni?
              </p>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px', lineHeight: 1.4 }}>
                This will:
                <br />• Convert {completedRows.length} completed OJT students to alumni
                <br />• Create a new alumni batch if it doesn't exist
                <br />• Generate passwords for the new alumni accounts
                <br />• Remove the OJT data from this view
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button 
                  onClick={() => setShowApprovalModal(false)}
                  style={{ 
                    padding: '10px 20px', 
                    borderRadius: '8px', 
                    border: '1px solid #d1d5db', 
                    background: '#f3f4f6', 
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500
                  }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleApprove}
                  disabled={approvalLoading}
                  style={{ 
                    padding: '10px 20px', 
                    borderRadius: '8px', 
                    border: 'none', 
                    background: '#dc2626', 
                    color: 'white',
                    cursor: approvalLoading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    opacity: approvalLoading ? 0.7 : 1
                  }}
                >
                  {approvalLoading ? 'Processing...' : 'Yes, Approve'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Approval Result Modal */}
        {showApprovalModal && approvalResult && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: 'white', width: '600px', maxWidth: '96%', borderRadius: '14px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.25)', maxHeight: '80vh', overflow: 'auto' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', color: approvalResult.success ? '#059669' : '#dc2626' }}>
                {approvalResult.success ? 'Approval Successful!' : 'Approval Failed'}
              </h3>
              <div style={{ height: 1, background: '#e5e7eb', margin: '8px 0 20px' }}></div>
              
              {approvalResult.success ? (
                <div>
                  <p style={{ fontSize: '16px', color: '#374151', marginBottom: '20px' }}>
                    Successfully approved {approvalResult.approved} students from Class of {year} to become alumni.
                  </p>
                  
                  {approvalResult.batch_created && (
                    <p style={{ fontSize: '14px', color: '#059669', marginBottom: '20px', padding: '12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                      ✓ New alumni batch created for {approvalResult.batch_year}
                    </p>
                  )}

                  {approvalResult.passwords && approvalResult.passwords.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#111827' }}>
                        Generated Alumni Passwords:
                      </h4>
                      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', maxHeight: '200px', overflow: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '12px' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600, color: '#374151' }}>Name</th>
                              <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600, color: '#374151' }}>Username</th>
                              <th style={{ textAlign: 'left', padding: '8px', fontWeight: 600, color: '#374151' }}>Password</th>
                            </tr>
                          </thead>
                          <tbody>
                            {approvalResult.passwords.map((pwd: any, idx: number) => (
                              <tr key={idx} style={{ borderBottom: idx < approvalResult.passwords.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                                <td style={{ padding: '8px', color: '#111827' }}>{pwd.name}</td>
                                <td style={{ padding: '8px', color: '#111827', fontFamily: 'monospace' }}>{pwd.username}</td>
                                <td style={{ padding: '8px', color: '#111827', fontFamily: 'monospace', fontWeight: 600 }}>{pwd.password}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                        Please save these passwords securely. They will not be shown again.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: '16px', color: '#dc2626', marginBottom: '20px' }}>
                  {approvalResult.message || 'An error occurred during approval.'}
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {approvalResult.success && approvalResult.excel_file && (
                  <button 
                    onClick={() => {
                      const downloadUrl = `http://localhost:8000/api/download-excel/${approvalResult.excel_file}`;
                      const link = document.createElement('a');
                      link.href = downloadUrl;
                      link.download = approvalResult.excel_filename || 'alumni_credentials.xlsx';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    style={{ 
                      padding: '10px 20px', 
                      borderRadius: '8px', 
                      border: 'none', 
                      background: '#059669', 
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    📊 Export File
                  </button>
                )}
                
                <button 
                  onClick={handleCloseApprovalModal}
                  style={{ 
                    padding: '10px 20px', 
                    borderRadius: '8px', 
                    border: 'none', 
                    background: '#164B87', 
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500
                  }}
                >
                  {approvalResult.success ? 'Continue' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RequestDetailsPage;
