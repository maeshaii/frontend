import React, { useState, useEffect } from 'react';
import { fetchOJTByYear, updateOJTStatus } from '../../services/api';

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
          const data = await fetchOJTByYear(selectedYear.toString());
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
      width: '480px',
      maxWidth: '95%',
      borderRadius: '12px',
      padding: '20px 24px',
      boxShadow: '0 12px 30px rgba(0,0,0,0.2)'
    },
    modalTitle: {
      fontWeight: 700,
      marginBottom: '12px'
    },
    modalItem: {
      margin: '6px 0',
      fontSize: '14px'
    },
    closeBtn: {
      marginTop: '12px',
      padding: '6px 14px',
      borderRadius: '6px',
      border: '1px solid #ccc',
      background: '#eef2ff',
      cursor: 'pointer'
    }
  };

  const normalized = (v: any) => (v ? String(v).toLowerCase() : '');
  useEffect(() => {
    if (typeof searchQuery === 'string') setSearch(searchQuery);
  }, [searchQuery]);
  const filtered = ojtData.filter((ojt) => {
    const q = normalized(search);
    if (!q) return true;
    const first = normalized(ojt.first_name || (ojt.name ? ojt.name.split(' ')[0] : ''));
    const last = normalized(ojt.last_name || (ojt.name ? ojt.name.split(' ').slice(-1)[0] : ''));
    const company = normalized(ojt.company);
    return first.includes(q) || last.includes(q) || company.includes(q);
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
      {/* Search input removed per request */}
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
                  <select
                    value={ojt.ojt_status || 'Pending'}
                    onChange={async (e) => {
                      const newStatus = e.target.value;
                      try {
                        await updateOJTStatus(ojt.id, newStatus);
                        setOjtData((prev) => prev.map((row) => row.id === ojt.id ? { ...row, ojt_status: newStatus } : row));
                      } catch (err) {
                        console.error('Failed to update status:', err);
                        alert('Failed to update status');
                      }
                    }}
                  >
                    <option value="Completed">Completed</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Incomplete">Incomplete</option>
                    <option value="Pending">Pending</option>
                  </select>
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
        <button style={styles.sendBtn}>Send to Admin</button>
      </div>

      {selected && (
        <div style={styles.modalOverlay} onClick={() => setSelected(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>OJT Details</div>
            <div style={styles.modalItem}><strong>CTU ID:</strong> {selected.ctu_id || ''}</div>
            <div style={styles.modalItem}><strong>First Name:</strong> {selected.first_name || (selected.name ? selected.name.split(' ')[0] : '')}</div>
            <div style={styles.modalItem}><strong>Middle Name:</strong> {selected.middle_name || ''}</div>
            <div style={styles.modalItem}><strong>Last Name:</strong> {selected.last_name || (selected.name ? selected.name.split(' ').slice(-1)[0] : '')}</div>
            <div style={styles.modalItem}><strong>Gender:</strong> {selected.gender || ''}</div>
            <div style={styles.modalItem}><strong>Birthdate:</strong> {selected.birthdate || ''}</div>
            <div style={styles.modalItem}><strong>Phone Number:</strong> {selected.phone_number || ''}</div>
            <div style={styles.modalItem}><strong>Address:</strong> {selected.address || ''}</div>
            <div style={styles.modalItem}><strong>Company:</strong> {selected.company || ''}</div>
            <div style={styles.modalItem}><strong>Start Date:</strong> {selected.ojt_start_date || selected.date_started || ''}</div>
            <div style={styles.modalItem}><strong>End Date:</strong> {selected.ojt_end_date || ''}</div>
            <div style={styles.modalItem}><strong>Status:</strong> {selected.ojt_status || 'Pending'}</div>
            <button style={styles.closeBtn} onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
