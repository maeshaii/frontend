import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../global/sidebar';
import GenerateStatsModal from '../../../components/GenerateStatsModal';
import { fetchAlumniStatistics } from '../../../services/api';

const App: React.FC = () => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [years, setYears] = useState<{ year: number; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [selectedBatchYear, setSelectedBatchYear] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');

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

  const handleGenerateClick = () => {
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleGenerateStats = (statsData: any) => {
    console.log('Generated statistics:', statsData);
    // You can add additional logic here to handle the generated statistics
    // For example, update the current view or navigate to a detailed statistics page
    
    // Show a success message or update the UI
    alert(`Successfully generated ${statsData.type} statistics for ${statsData.total_alumni} alumni!`);
  };

  const handleCardClick = (year: number) => {
    navigate(`/AlumniData/${year}`);
  };

  const handleExport = async () => {
    if (!selectedBatchYear) {
      alert('Please select a batch year to export.');
      return;
    }
    try {
      const response = await fetch(`http://localhost:8000/api/export-alumni/?batch_year=${selectedBatchYear}`, {
        method: 'GET',
      });
      if (!response.ok) {
        alert('Failed to export data');
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `alumni_export_batch_${selectedBatchYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      alert('Export successful!');
    } catch (error) {
      alert('Export failed!');
    }
  };

  const handleExportedImport = async () => {
    if (!importFile || !selectedBatchYear) {
      alert('Please select a file and batch year to import.');
      return;
    }
    const formData = new FormData();
    formData.append('file', importFile);
    formData.append('batch_year', selectedBatchYear);
    try {
      const response = await fetch('http://localhost:8000/api/import-exported-alumni/', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (result.success) {
        let debugMsg = 'Import successful!';
        if (result.debug && Array.isArray(result.debug)) {
          debugMsg += '\n\n' + result.debug.join('\n');
        }
        alert(debugMsg);
        setImportFile(null);
      } else {
        alert('Import failed: ' + result.message);
      }
    } catch (error) {
      alert('Import failed!');
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar />

      <div style={styles.container}>
        <div style={styles.header}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <button
              onClick={() => navigate(-1)}
              style={styles.backButton}
            >
              &lt; Back
            </button>
            <div style={styles.viewStatistics}>
              <span role="img" aria-label="chart">📊</span> View Statistics
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <button style={styles.generateBtn} onClick={() => setShowExportModal(true)}>
              Export Data
            </button>
            <button style={styles.generateBtn} onClick={handleGenerateClick}>
              Generate Statistics
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '32px',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            width: '100%',
            marginTop: 24,
          }}
        >
          {loading ? (
            <div>Loading...</div>
          ) : years.length === 0 ? (
            <div>No alumni data found.</div>
          ) : (
            years.map((grad, index) => (
              <div
                key={grad.year}
                onClick={() => handleCardClick(grad.year)}
                style={{
                  width: '220px',
                  borderRadius: '20px',
                  backgroundColor: 'white',
                  overflow: 'hidden',
                  boxShadow: '0 6px 18px rgba(0, 0, 0, 0.08)',
                  transition: 'transform 0.2s ease',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ height: '80px', backgroundColor: '#e3e9f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: '#174f84' }}>
                  <span role="img" aria-label="batch">🎓</span>
                </div>
                <div style={{ backgroundColor: '#174f84', color: 'white', padding: '15px' }}>
                  <strong style={{ fontSize: '15px', display: 'block', marginBottom: '5px' }}>YEAR GRADUATED: {grad.year}</strong>
                  <div style={{ fontSize: '13px' }}>Imported: {grad.count}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {showModal && (
          <GenerateStatsModal 
            onClose={handleCloseModal}
            onGenerate={handleGenerateStats}
          />
        )}

{showExportModal && (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  }}>
    <div style={{ background: '#b2e0e6', padding: '40px', borderRadius: '28px', minWidth: '340px', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
      <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: 24 }}>Export Alumni Data</h2>
      <div style={{ marginBottom: 18, textAlign: 'left' }}>
        <label style={{ fontWeight: 500 }}>Batch Graduated</label>
        <select
          style={{ width: '100%', padding: '12px', borderRadius: '20px', border: 'none', marginTop: 6, marginBottom: 12, background: 'white' }}
          value={selectedBatchYear}
          onChange={e => setSelectedBatchYear(e.target.value)}
        >
          <option value="">Select batch...</option>
          {years.map(y => (
            <option key={y.year} value={y.year}>{y.year}</option>
          ))}
        </select>
        <label style={{ fontWeight: 500 }}>Upload Excel File</label>
        <input
          type="file"
          accept=".xlsx,.xls"
          style={{ width: '100%', padding: '12px', borderRadius: '20px', border: 'none', marginTop: 6, marginBottom: 12, background: 'white' }}
          onChange={e => setImportFile(e.target.files ? e.target.files[0] : null)}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 18 }}>
        <button
          style={{ background: '#f26c4f', color: 'white', border: 'none', borderRadius: '12px', padding: '10px 32px', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}
          onClick={handleExport}
        >
          Export
        </button>
        <button
          style={{ background: '#4f46e5', color: 'white', border: 'none', borderRadius: '12px', padding: '10px 32px', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}
          onClick={handleExportedImport}
        >
          Import
        </button>
        <button style={{ background: 'white', color: '#222', border: '1px solid #888', borderRadius: '12px', padding: '10px 32px', fontWeight: 600, fontSize: 16, cursor: 'pointer' }} onClick={() => setShowExportModal(false)}>Cancel</button>
      </div>
    </div>
  </div>
)}

      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    padding: '30px',
    fontFamily: 'Arial, sans-serif',
    flex: 1,
    overflowY: 'auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  leftSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '10px'
  },
  viewStatistics: {
    fontSize: '20px',
    fontWeight: 500,
    fontFamily: 'Arial, sans-serif'
  },
  backButton: {
    background: 'none',
    border: 'none',
    color: '#1D4E89',
    fontSize: '20px',
    cursor: 'pointer',
    fontWeight: 'bold',
    marginBottom: '20px',
  },
  generateBtn: {
    backgroundColor: '#4f46e5',
    color: 'white',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '20px',
    cursor: 'pointer',
    fontWeight: 500
  },
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    width: '100%'
  },
  card: {
    backgroundColor: '#17406a',
    color: 'white',
    borderRadius: '15px',
    padding: '15px',
    cursor: 'pointer',
    transition: 'transform 0.2s',
    display: 'flex',
    flexDirection: 'column',
    width: '90%'
  },
  cardImage: {
    backgroundColor: 'white',
    height: '100px',
    width: '100%',
    borderRadius: '5px',
    marginBottom: '1px'
  },
  cardText: {
    textAlign: 'left',
    width: '100%'
  }
};

const modalStyles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modal: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '12px',
    width: '350px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
  },
  dropdown: {
    padding: '8px',
    borderRadius: '8px',
    border: '1px solid #ccc'
  },
  button: {
    marginTop: '15px',
    padding: '10px',
    backgroundColor: '#4f46e5',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer'
  }
};

export default App;
