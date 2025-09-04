import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import Sidebar from '../global/sidebar';
import {
  importAlumni,
  fetchAlumniStatistics,
  fetchAlumniEmploymentStats,
} from '../../../services/api';

type EmploymentData = {
  category: string;
  count: number;
};

const courseOptions = ['ALL', 'BSIT', 'BSIS', 'BIT-CT'];

const initialData: EmploymentData[] = [
  { category: 'Pending', count: 0 },
  { category: 'Employed', count: 0 },
  { category: 'Unemployed', count: 0 },
  { category: 'Absorb', count: 0 },
];

const barColors: Record<string, string> = {
  Pending: '#EE82EE',
  Employed: '#662d91',
  Unemployed: '#800080',
  Absorb: '#1d1160',
};

export default function Statistics() {
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [selectedCourse, setSelectedCourse] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [batchYear, setBatchYear] = useState('');
  const [selectedCourseImport, setSelectedCourseImport] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastImportResult, setLastImportResult] = useState<any>(null);
  const [yearOptions, setYearOptions] = useState<string[]>(['ALL']);
  const [stats, setStats] = useState<{ year: number; count: number }[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [employmentStats, setEmploymentStats] = useState<{ [key: string]: number }>({});
  const navigate = useNavigate();

  useEffect(() => {
    const loadStats = async () => {
      setStatsLoading(true);
      try {
        const data = await fetchAlumniStatistics();
        setStats(data.years || []);
        setYearOptions(['ALL', ...(data.years || []).map((y: any) => String(y.year))]);
      } catch (e) {
        setStats([]);
        setYearOptions(['ALL']);
      } finally {
        setStatsLoading(false);
      }
    };
    loadStats();
  }, []);

  useEffect(() => {
    const loadEmploymentStats = async () => {
      try {
        const data = await fetchAlumniEmploymentStats(selectedYear, selectedCourse);
        setEmploymentStats(data.status_counts || {});
      } catch (e) {
        setEmploymentStats({});
      }
    };
    loadEmploymentStats();
  }, [selectedYear, selectedCourse]);

  // Helper: normalize arbitrary backend status keys to canonical buckets
  const normalizeStatusCounts = (raw: { [key: string]: number } = {}) => {
    const result: { [key: string]: number } = {
      Employed: 0,
      Unemployed: 0,
      Absorb: 0,
      Pending: 0,
    };

    Object.entries(raw || {}).forEach(([key, value]) => {
      const k = (key || '').toString().toLowerCase();
      const n = Number(value) || 0;
      if (k.includes('unemploy')) {
        result.Unemployed += n;
      } else if (k.includes('employ')) {
        // Count only non-unemployed employ terms
        result.Employed += n;
      } else if (k.includes('absorb')) {
        result.Absorb += n;
      } else if (k.includes('pending')) {
        result.Pending += n;
      } else if (k.includes('active')) {
        // Treat 'active' user_status as Pending for the tracker context
        result.Pending += n;
      } else {
        // Unknown bucket -> Pending by default
        result.Pending += n;
      }
    });

    return result;
  };

  // Build chart data from normalized buckets in a stable order
  const chartData = (() => {
    const counts = normalizeStatusCounts(employmentStats);
    return [
      { category: 'Pending', count: counts.Pending },
      { category: 'Employed', count: counts.Employed },
      { category: 'Unemployed', count: counts.Unemployed },
      { category: 'Absorb', count: counts.Absorb },
    ];
  })();

  const maxCount = chartData.length > 0 ? Math.max(...chartData.map((d) => d.count)) : 0;
  const maxTick = Math.ceil(maxCount / 10) * 10;
  const ticks = Array.from({ length: maxTick / 10 + 1 }, (_, i) => i * 10);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        setSelectedFile(file);
        setMessage(null);
      } else {
        setMessage({ type: 'error', text: 'Please select an Excel file (.xlsx or .xls)' });
        setSelectedFile(null);
      }
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !batchYear || !selectedCourseImport) {
      setMessage({ type: 'error', text: 'Please fill in all fields and select a file' });
      return;
    }

    setLoading(true);
    setMessage(null);
    setLastImportResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('batch_year', batchYear);
    formData.append('course', selectedCourseImport);

    const token = localStorage.getItem('accessToken');
    try {
      const response = await fetch('http://localhost:8000/api/import-alumni/', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const contentType = response.headers.get('content-type');
      if (response.ok && contentType && contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
        // It's an Excel file, trigger download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'alumni_passwords.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        setMessage({ type: 'success', text: 'Import successful! Passwords downloaded.' });
        setSelectedFile(null);
        setBatchYear('');
        setSelectedCourseImport('');
        setTimeout(() => {
          setShowModal(false);
          setMessage(null);
          setLastImportResult(null);
        }, 3000);
      } else {
        // It's JSON (error or info)
        const result = await response.json();
        setLastImportResult(result);
        if (result.success) {
          setMessage({
            type: 'success',
            text: `${result.message}. ${result.errors?.length > 0 ? `Errors: ${result.errors.length}` : ''}`,
          });
          setSelectedFile(null);
          setBatchYear('');
          setSelectedCourseImport('');
          setTimeout(() => {
            setShowModal(false);
            setMessage(null);
            setLastImportResult(null);
          }, 3000);
        } else {
          setMessage({ type: 'error', text: result.message });
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedFile(null);
    setBatchYear('');
    setSelectedCourseImport('');
    setMessage(null);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', position: 'relative' }}>
      <Sidebar />

      <div style={{ padding: '32px 48px', fontFamily: 'Arial, sans-serif', flex: 1, position: 'relative', marginLeft: 240, overflowY: 'auto' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '16px' }}>Statistics</h2>

        {/* Filters */}
        <div className="filter-container">
          <div className="filter-group">
            <label className="filter-label">Year:</label>
            <select
              className="filter-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Course:</label>
            <select
              className="filter-select"
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
            >
              {courseOptions.map((course) => (
                <option key={course} value={course}>
                  {course}
                </option>
              ))}
            </select>
          </div>

          {/* Buttons aligned to right */}
          <div className="filter-buttons">
            <button className="action-button" onClick={() => setShowModal(true)}>
              Import Alumni
            </button>
            <button className="action-button" onClick={() => navigate('/ViewStats')}>
              View Statistics
            </button>
          </div>
        </div>

        {/* Bar Chart */}
        <div style={{ width: '100%', height: '600px', marginTop: '24px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis domain={[0, maxTick]} ticks={ticks} />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" name="Statistics" radius={[5, 5, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={barColors[entry.category]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Modal */}
        {showModal && (
          <>
            <div className="modal-overlay" onClick={closeModal} />
            <div className="modal modal-centered">
              <h2 style={{ marginTop: 0 }}>Import Alumni Data</h2>

              {message && (
                <div className={`message ${message.type}`} style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 4 }}>
                    {message.text}
                  </div>
                  {lastImportResult && (
                    <div style={{ fontSize: 14, marginBottom: 4 }}>
                      <span style={{ color: '#155724' }}>
                        Created: {lastImportResult.created_count}
                      </span>{' '}
                      &nbsp;|&nbsp;
                      <span style={{ color: '#856404' }}>
                        Skipped: {lastImportResult.skipped_count}
                      </span>
                    </div>
                  )}
                  {lastImportResult?.errors?.length > 0 && (
                    <div
                      style={{
                        maxHeight: 120,
                        overflowY: 'auto',
                        border: '1px solid #f5c6cb',
                        borderRadius: 6,
                        background: '#fff',
                        marginTop: 8,
                        padding: 8,
                      }}
                    >
                      <ul style={{ color: '#721c24', fontSize: 13, margin: 0, paddingLeft: 18 }}>
                        {lastImportResult.errors.map((err: string, idx: number) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="modal-group">
                <label>Batch Graduated:</label>
                <input
                  type="text"
                  placeholder="Enter batch (e.g., 2023)"
                  value={batchYear}
                  onChange={(e) => setBatchYear(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="modal-group">
                <label>Course:</label>
                <select
                  value={selectedCourseImport}
                  onChange={(e) => setSelectedCourseImport(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Select course</option>
                  {courseOptions
                    .filter((c) => c !== 'ALL')
                    .map((course) => (
                      <option key={course} value={course}>
                        {course}
                      </option>
                    ))}
                </select>
              </div>

              <div className="modal-group">
                <label>Upload Excel File:</label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  disabled={loading}
                />
                <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                  Required columns: CTU_ID, First_Name, Last_Name, Gender, Birthdate
                  <br />
                  Optional: Middle_Name, Phone_Number, Address
                  <br />
                  Date format: MM/DD/YYYY or YYYY-MM-DD
                </small>
                <button
                  type="button"
                  onClick={() => {
                    // Create sample CSV content
                    const csvContent = `CTU_ID,First_Name,Middle_Name,Last_Name,Gender,Birthdate,Phone_Number,Address
1337580,John,Doe,Smith,M,12/04/2003,09123456789,Cebu City
1337581,Jane,Marie,Johnson,F,05/15/2002,09187654321,Mandaue City`;

                    const blob = new Blob([csvContent], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'alumni_template.csv';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                  }}
                  style={{
                    marginTop: '8px',
                    padding: '6px 12px',
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                  disabled={loading}
                >
                  Download Template
                </button>
              </div>

              <div className="modal-actions">
                <button onClick={closeModal} disabled={loading}>
                  Cancel
                </button>
                <button
                  style={{ backgroundColor: '#1D4E89', color: '#fff' }}
                  onClick={handleImport}
                  disabled={loading}
                >
                  {loading ? 'Importing...' : 'Import Alumni'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Embedded CSS */}
        <style>{`
          .filter-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 16px;
            margin-bottom: 16px;
          }

          .filter-group {
            display: flex;
            flex-direction: column;
          }

          .filter-label {
            margin-bottom: 4px;
            font-size: 14px;
          }

          .filter-select {
            padding: 6px 10px;
            font-size: 14px;
            border: 1px solid #ccc;
            border-radius: 4px;
          }

          .filter-buttons {
            display: flex;
            gap: 12px;
            margin-left: auto;
          }

          .action-button {
            padding: 10px 20px;
            background-color: #1D4E89;
            color: #fff;
            border-radius: 20px;
            border: none;
            font-weight: bold;
            font-size: 14px;
            cursor: pointer;
            transition: background-color 0.2s;
          }

          .action-button:hover {
            background-color: #163b66;
          }

          .modal-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background-color: rgba(0,0,0,0.5);
            z-index: 1000;
          }

          .modal-centered {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: white;
            padding: 32px;
            border-radius: 10px;
            z-index: 1001;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            width: 500px;
            max-width: 90%;
          }

          .modal-group {
            margin-bottom: 20px;
          }

          .modal-group label {
            display: block;
            margin-bottom: 6px;
            font-weight: bold;
            font-size: 14px;
          }

          .modal-group input,
          .modal-group select {
            width: 100%;
            padding: 10px;
            font-size: 14px;
            border: 1px solid #ccc;
            border-radius: 6px;
            background-color: transparent;
          }

          .modal-actions {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
          }

          .modal-actions button {
            padding: 10px 18px;
            border: none;
            border-radius: 6px;
            font-weight: bold;
            cursor: pointer;
          }

          .modal-actions button:first-child {
            background-color: #ccc;
            color: #000;
          }

          .modal-actions button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .message {
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 16px;
            font-size: 14px;
          }

          .message.success {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
          }

          .message.error {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
          }
        `}</style>
      </div>
    </div>
  );
}
