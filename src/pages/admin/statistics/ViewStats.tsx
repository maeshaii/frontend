import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../global/sidebar';
import GenerateStatsModal from '../../../components/GenerateStatsModal';
import { fetchAlumniStatistics } from '../../../services/api';
import { FaChartBar, FaUpload, FaGraduationCap, FaUsers, FaCalendarAlt, FaFilter, FaCog, FaArrowLeft } from 'react-icons/fa';

const ViewStats: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation() as any;
  const [showModal, setShowModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [years, setYears] = useState<{ year: number; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [selectedBatchYear, setSelectedBatchYear] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        const data = await fetchAlumniStatistics();
        setYears(data.years || []);
      } catch (e) {
        setYears([]);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  // If navigated from Dashboard with a request to open the modal, honor it once.
  useEffect(() => {
    if (location?.state?.openGenerate) {
      setShowModal(true);
      // Clear the state so refreshing/back won't re-open unintentionally
      try {
        window.history.replaceState({}, document.title, '/ViewStats');
      } catch {}
    }
  }, [location?.state]);

  const handleGenerateClick = () => setShowModal(true);
  const handleCloseModal = () => setShowModal(false);
  const handleGenerateStats = (statsData: any) => {
    // Only the modal should show the alert for single-type generation
    // You can add additional logic here to handle the generated statistics
    // For example, update the current view or navigate to a detailed statistics page
    console.log('Generated statistics:', statsData);
  };
  const handleCardClick = (year: number) => navigate(`/AlumniData/${year}`);

  const handleExport = async () => {
    if (!selectedBatchYear) { alert('Please select a batch year to export.'); return; }
    const token = localStorage.getItem('accessToken');
    try {
      const response = await fetch(`http://localhost:8000/api/export-alumni/?batch_year=${selectedBatchYear}`, {
        method: 'GET',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!response.ok) { alert('Failed to export data'); return; }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `alumni_export_batch_${selectedBatchYear}.xlsx`;
      document.body.appendChild(a);
      a.click(); a.remove(); window.URL.revokeObjectURL(url);
      alert('Export successful!');
    } catch { alert('Export failed!'); }
  };

  const handleExportedImport = async () => {
    if (!importFile) { alert('Please select a file to import.'); return; }
    const formData = new FormData();
    formData.append('file', importFile);
    // Batch year optional: backend will read Year_Graduated/Batch Year per row; include only if selected
    if (selectedBatchYear) formData.append('batch_year', selectedBatchYear);
    const token = localStorage.getItem('accessToken');
    try {
      const response = await fetch('http://localhost:8000/api/import-alumni/', {
        method: 'POST',
        body: formData,
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      const contentType = response.headers.get('content-type');
      if (response.ok && contentType && contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'alumni_passwords.xlsx';
        document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
        alert('Import successful! Passwords downloaded.');
        setImportFile(null);
      } else {
        const result = await response.json();
        alert(result.message || 'Import completed.');
      }
    } catch { alert('Import failed!'); }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setImportFile(file);
    } else {
      alert('Please drop an Excel file (.xlsx or .xls).');
    }
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleTemplateDownload = async () => {
    try {
      const resp = await fetch('http://localhost:8000/api/import-alumni/template/');
      if (!resp.ok) throw new Error('Failed');
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'alumni_import_template.xlsx';
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
    } catch {
      alert('Template download is not configured on the server.');
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
      <Sidebar />
      
      <div className="admin-content-page" style={{ flex: 1, overflowY: 'auto', backgroundColor: '#f8fafc', marginLeft: 'var(--sidebar-width, 220px)', transition: 'margin-left 0.3s ease' }}>
        {/* Slim toolbar (no heavy header) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '36px 48px 12px 48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0b2a55' }}>Alumni Users</div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
          <button style={styles.actionButton} onClick={() => setShowExportModal(true)}>
            <FaUpload style={{ marginRight: '8px', color: 'white' }} />
            Import/Export
          </button>
          <button style={styles.generateButton} onClick={handleGenerateClick}>
            <FaCog style={{ marginRight: '8px', color: 'white' }} />
            Generate Statistics
          </button>
          </div>
        </div>

        {/* Overview removed per request */}

        {/* Alumni Cards Grid */}
        <div style={styles.cardsContainer}>

          {loading ? (
            <div style={styles.loadingContainer}>
              <div style={styles.spinner}></div>
              <p style={styles.loadingText}>Loading alumni statistics...</p>
            </div>
          ) : years.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>
                <FaGraduationCap />
              </div>
              <h3 style={styles.emptyTitle}>No Alumni Data Found</h3>
              <p style={styles.emptyText}>
                No alumni data is available. Try importing data or generating statistics.
              </p>
            </div>
          ) : (
            <div style={styles.cardsGrid}>
              {years.map((grad) => (
                <div
                  key={grad.year}
                  onClick={() => handleCardClick(grad.year)}
                  style={styles.yearCard}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-6px)';
                    e.currentTarget.style.boxShadow = '0 18px 28px rgba(16, 24, 40, 0.16)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(16, 24, 40, 0.10)';
                  }}
                >
                  <div style={styles.cardHeader}>
                    <div style={styles.cardIcon}>
                      <FaGraduationCap />
                    </div>
                    <div style={styles.cardYear}>CLASS OF {grad.year}</div>
                  </div>
                  <div style={styles.cardContent}>
                    <div style={styles.cardStats}>
                      <div style={styles.statItem}>
                        <FaUsers style={styles.statIcon} />
                        <span style={styles.statNumber}>{grad.count}</span>
                        <span style={styles.statLabel}>Alumni</span>
                      </div>
                    </div>
                    <div style={styles.cardFooter}>
                      <span style={styles.viewText}>Open details</span>
                      <span style={{ marginLeft: 8, transition: 'transform .2s ease' }}>→</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modals */}
        {showModal && <GenerateStatsModal onClose={handleCloseModal} onGenerate={handleGenerateStats} />}

        {showExportModal && (
          <div style={styles.modalOverlay}>
            <div style={{ ...styles.modalContent, maxWidth: 640, paddingBottom: 8 }}>
              <div style={styles.modalHeader}>
                <h2 style={styles.modalTitle}>Import Alumni Data</h2>
                <button onClick={() => setShowExportModal(false)} style={styles.modalCloseButton}>×</button>
              </div>

              <div style={styles.modalBody}>
                {/* Upload */}
                <div
                  style={{
                    border: '2px dashed #d1d5db',
                    borderRadius: 12,
                    padding: 28,
                    textAlign: 'center',
                    background: isDragging ? '#f8fafc' : 'white',
                    transition: 'background 0.15s ease',
                    marginBottom: 16,
                  }}
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                >
                  <input
                    id="alumni-import-file"
                    type="file"
                    accept=".xlsx,.xls"
                    style={{ display: 'none' }}
                    onChange={(e) => setImportFile(e.target.files ? e.target.files[0] : null)}
                  />
                  <label htmlFor="alumni-import-file" style={{ cursor: 'pointer', display: 'inline-block' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 6 }}>
                      {importFile ? importFile.name : 'Choose Excel File'}
                    </div>
                    <div style={{ color: '#6b7280' }}>Click to browse or drag and drop</div>
                    <div style={{ color: '#9ca3af', marginTop: 6, fontSize: 13 }}>Supports .xlsx and .xls files</div>
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                  <button style={styles.importButton} onClick={handleExportedImport}>Import Alumni</button>
                </div>

                <div style={{ height: 1, background: '#e5e7eb', margin: '20px 0' }} />

                {/* Export section */}
                <div style={styles.modalSection}>
                  <h3 style={styles.sectionTitle}>Export Alumni Data</h3>
                  <p style={styles.sectionDescription}>Download alumni data for a specific batch year.</p>
                  <div style={styles.inputGroup}>
                    <label style={styles.inputLabel}>Select Batch Year</label>
                    <select
                      style={styles.selectInput}
                      value={selectedBatchYear}
                      onChange={(e) => setSelectedBatchYear(e.target.value)}
                    >
                      <option value="">Choose a graduation year...</option>
                      {years.map((y) => (
                        <option key={y.year} value={y.year}>Class of {y.year} ({y.count} alumni)</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button style={{ ...styles.importButton, background: '#e5e7eb', color: '#111827' }} onClick={() => setShowExportModal(false)}>Cancel</button>
                    <button style={{ ...styles.importButton }} onClick={handleExport}>Export to Excel</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  // Deprecated header styles removed
  headerActions: {
    display: 'flex',
    gap: '12px',
    position: 'absolute',
    right: '-32px',
  },
  actionButton: {
    background: '#1C4E80',
    border: '2px solid #1C4E80',
    color: 'white',
    padding: '14px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s ease',
  },
  generateButton: {
    background: '#1C4E80',
    border: '2px solid #1C4E80',
    color: 'white',
    padding: '14px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s ease',
  },

  // Stats overview
  statsOverview: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '24px',
    padding: '32px',
    backgroundColor: 'white',
    margin: '0 32px',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  overviewCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '20px',
    background: '#f8fafc',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
  },
  overviewIcon: {
    fontSize: '32px',
    color: '#6C63FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '60px',
    height: '60px',
    background: '#f0f0ff',
    borderRadius: '12px',
  },
  overviewContent: {
    display: 'flex',
    flexDirection: 'column',
  },
  overviewNumber: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1f2937',
    lineHeight: 1,
  },
  overviewLabel: {
    fontSize: '14px',
    color: '#6b7280',
    marginTop: '4px',
  },

  // Cards container
  cardsContainer: {
    padding: '8px 48px 32px 48px',
    display: 'flex',
    justifyContent: 'flex-start',
    width: '100%',
  },
  cardsHeader: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  cardsTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1f2937',
    margin: '0 0 8px 0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardsSubtitle: {
    fontSize: '16px',
    color: '#6b7280',
    margin: '0',
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 280px))',
    gap: '20px',
    width: '100%',
    margin: '0',
    justifyItems: 'start',
  },

  // Year card styles
  yearCard: {
    background: 'white',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 8px 16px rgba(16, 24, 40, 0.10)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: '1px solid #e5e7eb',
    width: '280px',
  },
  cardHeader: {
    background: 'linear-gradient(90deg, #1C4E80 0%, #275f9b 100%)',
    color: 'white',
    padding: '18px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  cardIcon: {
    fontSize: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '42px',
    height: '42px',
    background: 'rgba(255, 255, 255, 0.18)',
    borderRadius: '10px',
  },
  cardYear: {
    fontSize: '16px',
    fontWeight: '600',
  },
  cardContent: {
    padding: '16px',
  },
  cardStats: {
    marginBottom: '8px',
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statIcon: {
    fontSize: '14px',
    color: '#6b7280',
  },
  statNumber: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: '12px',
    color: '#6b7280',
  },
  cardFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    color: '#1c4e80',
  },
  viewText: {
    fontSize: '12px',
    color: '#1c4e80',
    fontWeight: '700',
  },

  // Loading and empty states
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 20px',
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
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 20px',
    minHeight: '50vh',
    textAlign: 'center',
    width: '100%',
  },
  emptyIcon: {
    fontSize: '64px',
    color: '#d1d5db',
    marginBottom: '16px',
  },
  emptyTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#374151',
    margin: '0 0 8px 0',
  },
  emptyText: {
    fontSize: '16px',
    color: '#6b7280',
    margin: 0,
    maxWidth: '400px',
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
    maxWidth: '600px',
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
    fontSize: '20px',
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
  modalSection: {
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1f2937',
    margin: '0 0 8px 0',
  },
  sectionDescription: {
    fontSize: '14px',
    color: '#6b7280',
    margin: '0 0 16px 0',
  },
  inputGroup: {
    marginBottom: '16px',
  },
  inputLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '6px',
    display: 'block',
  },
  selectInput: {
    width: '100%',
    padding: '12px 16px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '16px',
    cursor: 'pointer',
    outline: 'none',
    transition: 'all 0.2s ease',
  },
  fileInput: {
    width: '100%',
    padding: '12px 16px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '16px',
    cursor: 'pointer',
    outline: 'none',
    transition: 'all 0.2s ease',
  },
  exportButton: {
    background: '#1C4E80',
    border: '2px solid #1C4E80',
    color: 'white',
    padding: '12px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s ease',
  },
  importButton: {
    background: '#1C4E80',
    border: '2px solid #1C4E80',
    color: 'white',
    padding: '12px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s ease',
  },
  modalDivider: {
    height: '1px',
    background: '#e5e7eb',
    margin: '24px 0',
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

export default ViewStats;