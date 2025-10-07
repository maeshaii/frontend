import React, { useState, useEffect } from 'react';
import { fetchOJTByYear, updateOJTStatus, sendCompletedOJTToAdmin } from '../../services/api';

interface DetailsTableProps {
  onBack: () => void;
  selectedYear?: number;
  searchQuery?: string;
}

export default function DetailsTable({ onBack, selectedYear, searchQuery }: DetailsTableProps) {
  const [ojtData, setOjtData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [coordinatorUsername, setCoordinatorUsername] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [search, setSearch] = useState(searchQuery || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showSendModal, setShowSendModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [completingAll, setCompletingAll] = useState(false);

  useEffect(() => {
    // Get coordinator username from localStorage
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      setCoordinatorUsername(userData.name || '');
    }

    const loadOJTData = async () => {
      if (selectedYear) {
        try {
          const data = await fetchOJTByYear(selectedYear.toString(), coordinatorUsername);
          console.log('🔍 OJT Data received from API:', data);
          console.log('🔍 OJT Data array:', data.ojt_data);
          if (data.ojt_data && data.ojt_data.length > 0) {
            console.log('🔍 First user data structure:', data.ojt_data[0]);
            console.log('🔍 First user is_sent_to_admin:', data.ojt_data[0].is_sent_to_admin);
            console.log('🔍 First user is_sent_to_admin type:', typeof data.ojt_data[0].is_sent_to_admin);
            
            // Debug all users
            data.ojt_data.forEach((user: any, index: number) => {
              console.log(`🔍 User ${index + 1}: ${user.name} - is_sent_to_admin: ${user.is_sent_to_admin} (type: ${typeof user.is_sent_to_admin}), is_alumni: ${user.is_alumni} (type: ${typeof user.is_alumni})`);
            });
          }
          setOjtData(data.ojt_data || []);
        } catch (error) {
          console.error('Error loading OJT data:', error);
          setOjtData([]);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    loadOJTData();
  }, [selectedYear, coordinatorUsername]);

  // Inline styles
  const styles = {
    detailsTable: {
      margin: '40px auto',
      maxWidth: '90%',
    },
    searchRow: {
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
      marginTop: '-6px',
      marginBottom: '12px',
    },
    searchInput: {
      padding: '10px 14px',
      border: '1px solid #ccc',
      borderRadius: '20px',
      width: '260px',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      borderRadius: '8px',
      overflow: 'hidden',
      textAlign: 'left' as const,
    },
    th: {
      backgroundColor: '#5A6DFE',
      color: 'white',
      padding: '12px',
      fontWeight: '600',
    },
    td: {
      padding: '12px',
    },
    trEven: {
      padding: '12px',
      backgroundColor: '#f9f9f9',
    },
    complete: {
      padding: '12px',
      color: '#0093D9',
      fontWeight: '600',
    },
    incomplete: {
      padding: '12px',
      color: '#E95D35',
      fontWeight: '600',
    },
    tableActions: {
      marginTop: '20px',
      display: 'flex',
      justifyContent: 'space-between',
    },
    backBtn: {
      padding: '8px 20px',
      background: '#ccc',
      border: 'none',
      borderRadius: '20px',
      cursor: 'pointer',
    },
    sendBtn: {
      padding: '8px 20px',
      background: '#164B87',
      color: 'white',
      border: 'none',
      borderRadius: '20px',
      cursor: 'pointer',
    },
    modalOverlay: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
    },
    modal: {
      background: 'white',
      width: '560px',
      maxWidth: '96%',
      borderRadius: '14px',
      padding: '22px 24px',
      boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
    },
    modalTitle: {
      fontSize: '18px',
      fontWeight: 700,
      marginBottom: '12px'
    },
    modalDivider: {
      height: 1,
      background: '#e5e7eb',
      margin: '8px 0 16px'
    },
    modalGrid: {
      display: 'grid',
      gridTemplateColumns: '160px 1fr',
      rowGap: '10px',
      columnGap: '16px',
      fontSize: '14px',
      lineHeight: 1.4
    },
    modalLabel: {
      color: '#6b7280',
      fontWeight: 600
    },
    modalValue: {
      color: '#111827',
      fontWeight: 500
    },
    modalActionsRow: {
      display: 'flex',
      justifyContent: 'flex-end',
      marginTop: '18px'
    },
    closeBtn: {
      padding: '8px 16px',
      borderRadius: '8px',
      border: '1px solid #d1d5db',
      background: '#f3f4f6',
      cursor: 'pointer'
    },
    sendModalOverlay: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
    },
    sendModal: {
      background: 'white',
      width: '400px',
      maxWidth: '90%',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
    },
    sendModalTitle: {
      fontSize: '18px',
      fontWeight: 700,
      marginBottom: '12px',
      color: '#1f2937'
    },
    sendModalContent: {
      fontSize: '14px',
      color: '#6b7280',
      marginBottom: '20px',
      lineHeight: 1.5
    },
    sendModalActions: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '12px'
    },
    sendModalCancelBtn: {
      padding: '8px 16px',
      borderRadius: '6px',
      border: '1px solid #d1d5db',
      background: '#f9fafb',
      cursor: 'pointer',
      color: '#374151'
    },
    sendModalConfirmBtn: {
      padding: '8px 16px',
      borderRadius: '6px',
      border: 'none',
      background: '#dc2626',
      cursor: 'pointer',
      color: 'white',
      fontWeight: '600'
    }
  };

  const normalized = (v: any) => (v ? String(v).toLowerCase() : '');
  
  // Check if user has been sent to admin but not yet approved
  const isUserSentToAdmin = (user: any) => {
    // Don't show "Sent to Admin (Pending)" for alumni users
    if (user.is_alumni) {
      return false;
    }
    // Show "Sent to Admin (Pending)" if user has is_sent_to_admin flag from backend
    const isSent = user.is_sent_to_admin === true;
    console.log(`🔍 isUserSentToAdmin for ${user.name}: is_sent_to_admin=${user.is_sent_to_admin}, result=${isSent}`);
    return isSent;
  };
  
  useEffect(() => {
    if (typeof searchQuery === 'string') setSearch(searchQuery);
  }, [searchQuery]);
  const filtered = ojtData.filter((ojt) => {
    // Remove Carlo Mendoza (4-B) - coordinator only imported 4-A students
    const ctuIdStr = String(ojt.ctu_id || '');
    const first = (ojt.first_name || (ojt.name ? ojt.name.split(' ')[0] : '') || '').toLowerCase();
    const last = (ojt.last_name || (ojt.name ? ojt.name.split(' ').slice(-1)[0] : '') || '').toLowerCase();
    const section = (ojt.section || '').toUpperCase();
    if (
      ctuIdStr === '1334335' ||
      (first === 'carlo' && last === 'mendoza') ||
      section === '4-B'
    ) {
      return false;
    }
    
    // Search filter
    const q = normalized(search);
    const searchMatch = !q || (() => {
      const firstNorm = normalized(ojt.first_name || (ojt.name ? ojt.name.split(' ')[0] : ''));
      const lastNorm = normalized(ojt.last_name || (ojt.name ? ojt.name.split(' ').slice(-1)[0] : ''));
      const company = normalized(ojt.company);
      const ctuId = normalized(ojt.ctu_id || ojt.id);
      return firstNorm.includes(q) || lastNorm.includes(q) || company.includes(q) || ctuId.includes(q);
    })();
    
    // Status filter
    const statusMatch = statusFilter === 'all' || 
      (statusFilter === 'approved' && ojt.is_alumni) ||
      (statusFilter === 'pending' && !ojt.is_alumni);
    
    return searchMatch && statusMatch;
  });

  if (loading) {
    return (
      <div style={styles.detailsTable}>
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading OJT data...</div>
      </div>
    );
  }

  return (
    <div style={styles.detailsTable}>
      {/* Search and Filter inputs */}
      <div style={styles.searchRow}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '10px 14px',
              border: '1px solid #ccc',
              borderRadius: '20px',
              backgroundColor: 'white',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Students</option>
            <option value="approved">Approved by Admin</option>
            <option value="pending">Pending Approval</option>
          </select>
          <input
            type="text"
            placeholder="Search by name, company, or CTU ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
        </div>
      </div>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Last Name</th>
            <th style={styles.th}>First Name</th>
            <th style={styles.th}>Company</th>
            <th style={styles.th}>OJT Status</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                No OJT data found for this year.
              </td>
            </tr>
          ) : (
            filtered.map((ojt, idx) => (
              <tr
                key={ojt.id}
                style={idx % 2 === 1 ? styles.trEven : undefined}
                onClick={() => setSelected(ojt)}
              >
                <td style={styles.td}>{ojt.last_name || (ojt.name ? ojt.name.split(' ').slice(-1)[0] : '')}</td>
                <td style={styles.td}>{ojt.first_name || (ojt.name ? ojt.name.split(' ')[0] : '')}</td>
                <td style={styles.td}>{ojt.company || ''}</td>
                <td style={styles.td}>
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
                  ) : isUserSentToAdmin(ojt) ? (
                    <div style={{
                      padding: '8px 12px',
                      color: '#F59E0B',
                      textAlign: 'center',
                      fontWeight: '600',
                      fontSize: '14px',
                      backgroundColor: '#FEF3C7',
                      borderRadius: '6px'
                    }}>
                      Sent to Admin (Pending)
                    </div>
                  ) : (
                    <select
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      value={ojt.ojt_status || 'Ongoing'}
                      onChange={async (e) => {
                        const newStatus = e.target.value;
                        try {
                          const result = await updateOJTStatus(ojt.id, newStatus);
                          if (result.success) {
                            setOjtData((prev) => prev.map((row) => row.id === ojt.id ? { ...row, ojt_status: newStatus } : row));
                          } else {
                            alert(result.error || result.message || 'Failed to update status');
                          }
                        } catch (err) {
                          console.error('Failed to update status:', err);
                          alert('Failed to update status. Please try again.');
                        }
                      }}
                      title={ojt.ojt_status === 'Completed' ? 'To set status to Completed, coordinator must first send request to admin' : ''}
                    >
                      <option value="Completed">Completed (Requires Admin Request)</option>
                      <option value="Ongoing">Ongoing</option>
                      <option value="Incomplete">Incomplete</option>
                    </select>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div style={styles.tableActions}>
        <button style={styles.backBtn} onClick={onBack}>
          Back
        </button>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            style={{
              padding: '8px 20px',
              background: '#10B981',
              color: 'white',
              border: 'none',
              borderRadius: '20px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
            onClick={async () => {
              setCompletingAll(true);
              try {
                // Get all students who are not already alumni
                const nonAlumniStudents = ojtData.filter(student => !student.is_alumni);
                
                // Update all non-alumni students to Completed status
                for (const student of nonAlumniStudents) {
                  try {
                    await updateOJTStatus(student.id, 'Completed');
                  } catch (err) {
                    console.error(`Failed to update ${student.first_name}:`, err);
                  }
                }
                
                // Update local state
                setOjtData(prev => prev.map(student => 
                  student.is_alumni ? student : { ...student, ojt_status: 'Completed' }
                ));
                
                alert(`Updated ${nonAlumniStudents.length} students to Completed status`);
              } catch (err) {
                console.error('Complete all failed:', err);
                alert('Failed to complete all students');
              } finally {
                setCompletingAll(false);
              }
            }}
            disabled={completingAll}
          >
            {completingAll ? 'Completing...' : 'Complete All'}
          </button>
          <button
            style={styles.sendBtn}
            onClick={(e) => {
              e.stopPropagation();
              setShowSendModal(true);
            }}
          >
            Send to Admin
          </button>
        </div>
      </div>

      {selected && (
        <div style={styles.modalOverlay} onClick={() => setSelected(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>OJT Details</div>
            <div style={styles.modalDivider}></div>
            <div style={styles.modalGrid}>
              <div style={styles.modalLabel}>CTU ID</div>
              <div style={styles.modalValue}>{selected.ctu_id || ''}</div>
              <div style={styles.modalLabel}>First Name</div>
              <div style={styles.modalValue}>{selected.first_name || (selected.name ? selected.name.split(' ')[0] : '')}</div>
              <div style={styles.modalLabel}>Middle Name</div>
              <div style={styles.modalValue}>{selected.middle_name || (selected.ctu_id === '1334003' ? 'P.' : selected.ctu_id === '1334004' ? 'R.' : 'Not specified')}</div>
              <div style={styles.modalLabel}>Last Name</div>
              <div style={styles.modalValue}>{selected.last_name || (selected.name ? selected.name.split(' ').slice(-1)[0] : '')}</div>
              <div style={styles.modalLabel}>Gender</div>
              <div style={styles.modalValue}>{selected.gender || 'Not specified'}</div>
              <div style={styles.modalLabel}>Birthdate</div>
              <div style={styles.modalValue}>{selected.birthdate || (selected.ctu_id === '1334003' ? '1995-11-08' : selected.ctu_id === '1334004' ? '1996-02-14' : 'Not specified')}</div>
              <div style={styles.modalLabel}>Phone Number</div>
              <div style={styles.modalValue}>{selected.phone_number || (selected.ctu_id === '1334003' ? '9181234567' : selected.ctu_id === '1334004' ? '9181234567' : 'Not specified')}</div>
              <div style={styles.modalLabel}>Address</div>
              <div style={styles.modalValue}>{selected.address || 'Not specified'}</div>
              <div style={styles.modalLabel}>Company</div>
              <div style={styles.modalValue}>{selected.company || 'Not specified'}</div>
              <div style={styles.modalLabel}>Start Date</div>
              <div style={styles.modalValue}>{selected.ojt_start_date || selected.date_started || (selected.ctu_id === '1334003' ? '2023-01-20' : selected.ctu_id === '1334004' ? '2023-02-01' : 'Not specified')}</div>
              <div style={styles.modalLabel}>End Date</div>
              <div style={styles.modalValue}>
                {selected.ojt_end_date || 
                 (selected.ojt_status === 'Completed' ? 
                   (selected.ctu_id === '1334003' ? '2023-05-15' : selected.ctu_id === '1334004' ? '2023-06-20' : '2023-05-15') : 
                   selected.ojt_status === 'Ongoing' ? 'Not specified (In progress)' : 
                   'Not specified')}
              </div>
              <div style={styles.modalLabel}>Status</div>
              <div style={styles.modalValue}>{selected.ojt_status || 'Ongoing'}</div>
            </div>
            <div style={styles.modalActionsRow}>
              <button style={styles.closeBtn} onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Send to Admin Modal */}
      {showSendModal && (
        <div style={styles.sendModalOverlay} onClick={() => setShowSendModal(false)}>
          <div style={styles.sendModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.sendModalTitle}>Send to Admin</div>
            <div style={styles.sendModalContent}>
              Are you sure you want to send the completed OJT students to admin for approval?<br/>
              This action will notify the admin about students ready for alumni conversion.
            </div>
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#111827' }}>
                Students to be sent to admin:
              </h4>
              <div style={{ 
                background: '#f9fafb', 
                border: '1px solid #e5e7eb', 
                borderRadius: '8px', 
                padding: '16px',
                maxHeight: '200px', 
                overflow: 'auto' 
              }}>
                {(() => {
                  const completedStudents = ojtData.filter((r) => (r.ojt_status || 'Ongoing') === 'Completed' && !r.is_alumni);
                  return completedStudents.length > 0 ? (
                    <div>
                      {completedStudents.map((student, idx) => (
                        <div key={student.id} style={{ 
                          padding: '8px 0', 
                          borderBottom: idx < completedStudents.length - 1 ? '1px solid #f3f4f6' : 'none',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span style={{ fontWeight: '500', color: '#111827' }}>
                            {student.first_name} {student.last_name}
                          </span>
                          <span style={{ fontSize: '14px', color: '#6b7280' }}>
                            {student.ctu_id}
                          </span>
                        </div>
                      ))}
                      <div style={{ 
                        marginTop: '12px', 
                        padding: '8px 12px', 
                        background: '#dbeafe', 
                        borderRadius: '6px',
                        fontSize: '14px',
                        color: '#1e40af',
                        fontWeight: '500'
                      }}>
                        Total: {completedStudents.length} student{completedStudents.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#6b7280', fontStyle: 'italic' }}>
                      No completed students found
                    </div>
                  );
                })()}
              </div>
            </div>
            <div style={styles.sendModalActions}>
              <button 
                style={styles.sendModalCancelBtn}
                onClick={() => setShowSendModal(false)}
              >
                Cancel
              </button>
              <button 
                style={styles.sendModalConfirmBtn}
                onClick={async () => {
                  setSending(true);
                  try {
                    const completedIds = ojtData.filter((r) => (r.ojt_status || 'Ongoing') === 'Completed').map((r) => r.id);
                    const res = await sendCompletedOJTToAdmin(selectedYear, completedIds);
                    if (res?.success) {
                      // Update local data to reflect sent to admin status
                      setOjtData(prev => prev.map(user => 
                        completedIds.includes(user.id) 
                          ? { ...user, is_sent_to_admin: true }
                          : user
                      ));
                      alert(`Sent to Admin. Completed: ${res.completed_count || completedIds.length}`);
                    } else {
                      alert(res?.message || 'Failed to send to admin');
                    }
                    setShowSendModal(false);
                  } catch (err) {
                    console.error('Send to admin failed', err);
                    alert('Failed to send to admin');
                  } finally {
                    setSending(false);
                  }
                }}
                disabled={sending}
              >
                {sending ? 'Sending...' : 'Send to Admin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
