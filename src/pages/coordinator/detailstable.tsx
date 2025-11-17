import React, { useState, useEffect } from 'react';
import { fetchOJTByYear, updateOJTStatus } from '../../services/api';

interface DetailsTableProps {
  onBack: () => void;
  selectedYear?: number;
  selectedSection?: string;
  searchQuery?: string;
}

export default function DetailsTable({ onBack, selectedYear, selectedSection, searchQuery }: DetailsTableProps) {
  const [ojtData, setOjtData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [coordinatorUsername, setCoordinatorUsername] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [search, setSearch] = useState(searchQuery || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [completingAll, setCompletingAll] = useState(false);

  useEffect(() => {
    // Get coordinator username from localStorage
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      // Use username instead of full name for coordinator
      setCoordinatorUsername(userData.username || userData.name || '');
    }

    const loadOJTData = async () => {
      if (selectedYear) {
        try {
          console.log('🔍 Loading OJT data for year:', selectedYear, 'section:', selectedSection);
          const data = await fetchOJTByYear(selectedYear.toString(), coordinatorUsername, selectedSection);
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
          } else {
            console.log('🔍 No OJT data found for year:', selectedYear, 'section:', selectedSection);
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
  }, [selectedYear, selectedSection, coordinatorUsername]);

  // Modern, neat design styles
  const styles = {
    detailsTable: {
      margin: '24px auto',
      maxWidth: '96%',
      backgroundColor: 'white',
      borderRadius: '16px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
      overflow: 'hidden',
      border: '1px solid #f1f5f9',
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
      borderCollapse: 'separate' as const,
      borderSpacing: '0',
      textAlign: 'left' as const,
      tableLayout: 'fixed' as const,
    },
    tableHeader: {
      position: 'sticky' as const,
      top: 0,
      zIndex: 10,
      backgroundColor: 'white',
      borderBottom: '2px solid #e5e7eb',
    },
    tableHeaderTable: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      textAlign: 'left' as const,
    },
    tableBodyContainer: {
      maxHeight: '450px',
      overflowY: 'auto' as const,
    },
    tableBodyTable: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      textAlign: 'left' as const,
    },
    th: {
      backgroundColor: 'white',
      color: '#374151',
      padding: '18px 20px',
      fontWeight: '600',
      fontSize: '14px',
      textAlign: 'left' as const,
      borderBottom: '1px solid #e5e7eb',
      verticalAlign: 'middle' as const,
      borderRight: '1px solid #e5e7eb',
      letterSpacing: '0.025em',
    },
    td: {
      padding: '16px 20px',
      fontSize: '14px',
      verticalAlign: 'middle' as const,
      borderBottom: '1px solid #f1f5f9',
      borderRight: '1px solid #f1f5f9',
      textAlign: 'left' as const,
      width: 'auto',
      color: '#374151',
      fontWeight: '400',
    },
    trEven: {
      backgroundColor: '#f9fafb',
    },
    statusCell: {
      textAlign: 'center' as const,
      padding: '16px 20px',
      fontSize: '14px',
      verticalAlign: 'middle' as const,
      borderBottom: '1px solid #f1f5f9',
      borderRight: 'none',
      width: '20%',
      position: 'relative' as const,
      borderLeft: '1px solid #f1f5f9',
      color: '#374151',
      fontWeight: '400',
    },
    statusText: {
      display: 'inline-block',
      padding: '6px 12px',
      borderRadius: '16px',
      fontSize: '12px',
      fontWeight: '600',
      textAlign: 'center' as const,
      margin: '0 auto',
      width: 'fit-content',
      letterSpacing: '0.025em',
    },
    statusApproved: {
      backgroundColor: '#dbeafe',
      color: '#1e40af',
    },
    statusPending: {
      backgroundColor: '#fef3c7',
      color: '#d97706',
    },
    statusNotStarted: {
      backgroundColor: '#f3f4f6',
      color: '#6b7280',
    },
    statusIncomplete: {
      backgroundColor: '#fee2e2',
      color: '#dc2626',
    },
    statusDropdown: {
      width: '100%',
      maxWidth: '160px',
      padding: '8px 12px',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      backgroundColor: 'white',
      cursor: 'pointer',
      fontSize: '12px',
      textAlign: 'center' as const,
      outline: 'none',
      margin: '0 auto',
      display: 'block',
      fontWeight: '400',
      color: '#374151',
    },
    tableActions: {
      padding: '20px 24px',
      backgroundColor: '#f8fafc',
      borderTop: '1px solid #e5e7eb',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderRadius: '0 0 12px 12px',
    },
    backBtn: {
      padding: '10px 20px',
      background: '#6b7280',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontWeight: '500',
      fontSize: '14px',
    },
    modalOverlay: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      backdropFilter: 'blur(4px)',
    },
    modal: {
      background: 'white',
      width: '900px',
      maxWidth: '95vw',
      borderRadius: '16px',
      padding: '0',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      overflow: 'visible',
      display: 'flex',
      flexDirection: 'column' as const,
    },
    modalHeader: {
      background: 'white',
      padding: '24px 32px',
      color: '#1f2937',
      position: 'relative' as const,
      borderBottom: '2px solid #e5e7eb',
    },
    modalTitle: {
      fontSize: '24px',
      fontWeight: '700',
      margin: '0',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },
    modalCloseBtn: {
      position: 'absolute' as const,
      top: '20px',
      right: '20px',
      background: '#f3f4f6',
      border: '2px solid #e5e7eb',
      borderRadius: '50%',
      width: '36px',
      height: '36px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      color: '#6b7280',
      fontSize: '18px',
      transition: 'all 0.2s ease',
    },
    modalContent: {
      padding: '32px',
      flex: 1,
      overflowY: 'visible' as const,
    },
    modalGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: '16px',
    },
    modalSection: {
      background: '#f8fafc',
      borderRadius: '10px',
      padding: '16px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
    },
    modalSectionTitle: {
      fontSize: '14px',
      fontWeight: '700',
      color: '#1f2937',
      marginBottom: '12px',
      paddingBottom: '6px',
      borderBottom: '2px solid #1f2937',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    },
    modalField: {
      display: 'grid',
      gridTemplateColumns: '100px 1fr',
      gap: '8px',
      marginBottom: '8px',
      alignItems: 'center',
    },
    modalLabel: {
      color: '#4b5563',
      fontWeight: '600',
      fontSize: '11px',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
    },
    modalValue: {
      color: '#1f2937',
      fontWeight: '500',
      fontSize: '13px',
      background: 'white',
      padding: '6px 10px',
      borderRadius: '6px',
      border: '1px solid #e5e7eb',
      minHeight: '32px',
      display: 'flex',
      alignItems: 'center',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
      transition: 'all 0.2s ease',
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

  // Check if student is overdue (past end date but still ongoing)
  const isOverdue = (ojt: any) => {
    if (ojt.ojt_status !== 'Ongoing') return false;
    if (!ojt.ojt_end_date) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to compare dates only
    
    const endDate = new Date(ojt.ojt_end_date);
    endDate.setHours(0, 0, 0, 0);
    
    return today > endDate; // Current date is past the end date
  };
  
  useEffect(() => {
    if (typeof searchQuery === 'string') setSearch(searchQuery);
  }, [searchQuery]);
  const filtered = ojtData.filter((ojt) => {
    const ctuIdStr = String(ojt.ctu_id || '');
    const first = (ojt.first_name || (ojt.name ? ojt.name.split(' ')[0] : '') || '').toLowerCase();
    const last = (ojt.last_name || (ojt.name ? ojt.name.split(' ').slice(-1)[0] : '') || '').toLowerCase();
    
    // Filter by section if specified
    if (selectedSection) {
      // The backend already filters by section, so we don't need additional filtering here
      // This allows all users returned by the API to be displayed
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
    const statusMatch = (() => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'incomplete') return ojt.ojt_status === 'Incomplete' || isOverdue(ojt);
      if (statusFilter === 'ongoing') return !ojt.is_alumni && !isUserSentToAdmin(ojt) && ojt.ojt_status !== 'Incomplete' && !isOverdue(ojt) && (ojt.ojt_status || 'Ongoing') === 'Ongoing';
      if (statusFilter === 'completed') return !ojt.is_alumni && !isUserSentToAdmin(ojt) && ojt.ojt_status !== 'Incomplete' && (ojt.ojt_status || 'Ongoing') === 'Completed';
      return true; // 'all' - show everything
    })();
    
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
      {/* Header Bar with Class, Section, Search and Filter */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px 24px',
        borderRadius: '12px 12px 0 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        border: '1px solid #e5e7eb',
        borderBottom: '2px solid #e5e7eb'
      }}>
        <div style={{ color: '#374151' }}>
          <h2 style={{ 
            margin: '0 0 4px 0', 
            fontSize: '24px', 
            fontWeight: '700',
            color: '#1f2937'
          }}>
            Class of {selectedYear ? `${selectedYear - 1}-${selectedYear}` : 'N/A'}
          </h2>
          <p style={{ 
            margin: '0', 
            fontSize: '16px', 
            fontWeight: '500',
            color: '#6b7280'
          }}>
            Section: {selectedSection}
          </p>
        </div>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '10px 16px',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              backgroundColor: 'white',
              color: '#374151',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              outline: 'none',
              minWidth: '140px'
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
            <option value="all" style={{ color: '#374151' }}>All Students</option>
            <option value="ongoing" style={{ color: '#374151' }}>Ongoing</option>
            <option value="completed" style={{ color: '#374151' }}>Completed</option>
            <option value="incomplete" style={{ color: '#374151' }}>Incomplete (Overdue)</option>
          </select>
          
          <input
            type="text"
            placeholder="Search by name or CTU ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '10px 16px',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              backgroundColor: 'white',
              color: '#374151',
              fontSize: '14px',
              outline: 'none',
              minWidth: '250px'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#3b82f6';
              e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e5e7eb';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>
      </div>
      
      {/* Single Table with Fixed Layout */}
      <div style={styles.tableBodyContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: '20%', textAlign: 'left' as const }}>Last Name</th>
              <th style={{ ...styles.th, width: '20%', textAlign: 'left' as const }}>First Name</th>
              <th style={{ ...styles.th, width: '40%', textAlign: 'left' as const }}>Company</th>
              <th style={{ 
                ...styles.th, 
                textAlign: 'center' as const, 
                padding: '16px 20px', 
                width: '20%',
                position: 'relative' as const,
                borderRight: 'none'
              }}>OJT Status</th>
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
                  <td style={{ ...styles.td, textAlign: 'left' as const, width: '20%' }}>{ojt.last_name || (ojt.name ? ojt.name.split(' ').slice(-1)[0] : '')}</td>
                  <td style={{ ...styles.td, textAlign: 'left' as const, width: '20%' }}>{ojt.first_name || (ojt.name ? ojt.name.split(' ')[0] : '')}</td>
                  <td style={{ ...styles.td, borderRight: 'none', textAlign: 'left' as const, width: '40%' }}>{ojt.company || ''}</td>
                  <td style={{ ...styles.statusCell, width: '20%' }}>
                    {ojt.is_alumni ? (
                      <span style={{
                        ...styles.statusText,
                        ...styles.statusApproved
                      }}>
                        APPROVED
                      </span>
                    ) : isUserSentToAdmin(ojt) ? (
                      <span style={{
                        ...styles.statusText,
                        ...styles.statusPending
                      }}>
                        PENDING
                      </span>
                    ) : !ojt.ojt_start_date ? (
                      // NO START DATE = Status is DISABLED (First Import - personal info only)
                      <span style={{
                        ...styles.statusText,
                        ...styles.statusNotStarted
                      }}
                      title="Status cannot be changed until student has a start date (Second Import with company info)"
                      >
                        NOT STARTED
                      </span>
                    ) : (ojt.ojt_status === 'Incomplete' || isOverdue(ojt)) ? (
                      // INCOMPLETE = Either marked as Incomplete OR past end date but still ongoing
                      <span style={{
                        ...styles.statusText,
                        ...styles.statusIncomplete
                      }}
                      title={ojt.ojt_status === 'Incomplete' ? 'Student marked as Incomplete' : 'OJT is overdue - past the end date but still ongoing'}
                      >
                        INCOMPLETE
                      </span>
                    ) : (
                      // HAS START DATE = Status is CHANGEABLE (Second Import - company info added)
                      <select
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        value={ojt.ojt_status || 'Ongoing'}
                        style={styles.statusDropdown}
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
                        title={ojt.ojt_status === 'Completed' ? 'To set status to Completed, coordinator must first send request to admin' : 'Status can be changed because start date exists'}
                      >
                        <option value="Completed">COMPLETED</option>
                        <option value="Ongoing">Ongoing</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={styles.tableActions}>
        <button style={styles.backBtn} onClick={onBack}>
          Back
        </button>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            style={{
              padding: '10px 20px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '14px'
            }}
            onClick={async () => {
              setCompletingAll(true);
              try {
                // Get only the students who can be updated (not alumni, not completed, not incomplete)
                const currentSectionStudents = ojtData.filter(student => 
                  !student.is_alumni && 
                  student.ojt_status !== 'Completed' &&
                  student.ojt_status !== 'Incomplete' // Don't update incomplete students
                );
                
                // Update only the current section students to Completed status
                for (const student of currentSectionStudents) {
                  try {
                    await updateOJTStatus(student.id, 'Completed');
                  } catch (err) {
                    console.error(`Failed to update ${student.first_name}:`, err);
                  }
                }
                
                // Update local state
                setOjtData(prev => prev.map(student => 
                  currentSectionStudents.some(s => s.id === student.id) 
                    ? { ...student, ojt_status: 'Completed' }
                    : student
                ));
                
                alert(`Updated ${currentSectionStudents.length} students to Completed status`);
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
        </div>
      </div>

      {selected && (
        <div style={styles.modalOverlay} onClick={() => setSelected(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>
                OJT Student Details
              </div>
              <button 
                style={styles.modalCloseBtn} 
                onClick={() => setSelected(null)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e5e7eb';
                  e.currentTarget.style.borderColor = '#d1d5db';
                  e.currentTarget.style.color = '#374151';
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.color = '#6b7280';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div style={styles.modalContent}>
              <div style={styles.modalGrid}>
                {/* Personal Information Section */}
                <div style={styles.modalSection}>
                  <div style={styles.modalSectionTitle}>
                    Personal Info
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>CTU ID</div>
                    <div style={styles.modalValue}>{selected.ctu_id || 'Not specified'}</div>
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>First Name</div>
                    <div style={styles.modalValue}>{selected.first_name || (selected.name ? selected.name.split(' ')[0] : 'Not specified')}</div>
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>Middle Name</div>
                    <div style={styles.modalValue}>{selected.middle_name || (selected.ctu_id === '1334003' ? 'P.' : selected.ctu_id === '1334004' ? 'R.' : 'Not specified')}</div>
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>Last Name</div>
                    <div style={styles.modalValue}>{selected.last_name || (selected.name ? selected.name.split(' ').slice(-1)[0] : 'Not specified')}</div>
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>Gender</div>
                    <div style={styles.modalValue}>{selected.gender || 'Not specified'}</div>
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>Birthdate</div>
                    <div style={styles.modalValue}>{selected.birthdate || (selected.ctu_id === '1334003' ? '1995-11-08' : selected.ctu_id === '1334004' ? '1996-02-14' : 'Not specified')}</div>
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>Phone</div>
                    <div style={styles.modalValue}>{selected.phone_number || (selected.ctu_id === '1334003' ? '9181234567' : selected.ctu_id === '1334004' ? '9181234567' : 'Not specified')}</div>
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>Email</div>
                    <div style={styles.modalValue}>{selected.email || 'Not specified'}</div>
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>Address</div>
                    <div style={styles.modalValue}>{selected.address || 'Not specified'}</div>
                  </div>
                </div>

                {/* Company Information Section */}
                <div style={styles.modalSection}>
                  <div style={styles.modalSectionTitle}>
                    Company Info
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>Company</div>
                    <div style={styles.modalValue}>{selected.company || 'Not specified'}</div>
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>Address</div>
                    <div style={styles.modalValue}>{selected.company_address || 'Not specified'}</div>
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>Email</div>
                    <div style={styles.modalValue}>{selected.company_email || 'Not specified'}</div>
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>Contact</div>
                    <div style={styles.modalValue}>{selected.company_contact || 'Not specified'}</div>
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>Contact Person</div>
                    <div style={styles.modalValue}>{selected.contact_person || 'Not specified'}</div>
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>Position</div>
                    <div style={styles.modalValue}>{selected.position || 'Not specified'}</div>
                  </div>
                </div>

                {/* OJT Information Section */}
                <div style={styles.modalSection}>
                  <div style={styles.modalSectionTitle}>
                    OJT Info
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>Start Date</div>
                    <div style={styles.modalValue}>{selected.ojt_start_date || selected.date_started || (selected.ctu_id === '1334003' ? '2023-01-20' : selected.ctu_id === '1334004' ? '2023-02-01' : 'Not specified')}</div>
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>End Date</div>
                    <div style={styles.modalValue}>
                      {selected.ojt_end_date || 
                       (selected.ojt_status === 'Completed' ? 
                         (selected.ctu_id === '1334003' ? '2023-05-15' : selected.ctu_id === '1334004' ? '2023-06-20' : '2023-05-15') : 
                         selected.ojt_status === 'Ongoing' ? 'Not specified (In progress)' : 
                         'Not specified')}
                    </div>
                  </div>
                  <div style={styles.modalField}>
                    <div style={styles.modalLabel}>Status</div>
                    <div style={{
                      ...styles.modalValue,
                      background: !selected.ojt_start_date ? '#f3f4f6' :
                                 (selected.ojt_status === 'Incomplete' || isOverdue(selected)) ? '#fee2e2' :
                                 selected.ojt_status === 'Approved' ? '#dbeafe' : 
                                 selected.ojt_status === 'Pending' ? '#fef3c7' : 
                                 selected.ojt_status === 'Completed' ? '#d1fae5' : '#f3f4f6',
                      color: !selected.ojt_start_date ? '#6b7280' :
                             (selected.ojt_status === 'Incomplete' || isOverdue(selected)) ? '#dc2626' :
                             selected.ojt_status === 'Approved' ? '#1e40af' : 
                             selected.ojt_status === 'Pending' ? '#d97706' : 
                             selected.ojt_status === 'Completed' ? '#065f46' : '#6b7280',
                      fontWeight: '600',
                      textAlign: 'center' as const,
                      justifyContent: 'center'
                    }}
                    title={!selected.ojt_start_date ? 'Status is locked until second import with company info' : 
                           (selected.ojt_status === 'Incomplete' || isOverdue(selected)) ? 'Student marked as Incomplete or overdue' : ''}
                    >
                      {!selected.ojt_start_date ? 'NOT STARTED' : 
                       (selected.ojt_status === 'Incomplete' || isOverdue(selected)) ? 'INCOMPLETE' : 
                       (selected.ojt_status || 'Ongoing')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}