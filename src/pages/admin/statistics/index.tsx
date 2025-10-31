import React, { useState, useEffect, useCallback } from 'react';
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
import { FaFilter, FaChartLine, FaUsers, FaDownload, FaUpload, FaBriefcase, FaClock, FaTimes, FaBullseye } from 'react-icons/fa';
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
  { category: 'Untracked', count: 0 },
  { category: 'Employed', count: 0 },
  { category: 'Unemployed', count: 0 },
  { category: 'Absorb', count: 0 },
];

const barColors: Record<string, string> = {
  Untracked: '#DEC0F1',
  Employed: '#B79CED',  // Light purple for employed
  Unemployed: '#957FEF',
  // Removed 'Absorb' - now shown as indicator on 'Employed'
};

export default function Statistics() {
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [selectedProgram, setSelectedProgram] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [batchYear, setBatchYear] = useState('');
  const [selectedProgramImport, setSelectedProgramImport] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastImportResult, setLastImportResult] = useState<any>(null);
  const [yearOptions, setYearOptions] = useState<string[]>(['ALL']);
  
  // Generate year options from 2000 to current year
  const currentYear = new Date().getFullYear();
  const batchYearOptions = Array.from({ length: currentYear - 2000 + 1 }, (_, i) => String(2000 + i)).reverse();
  const [stats, setStats] = useState<{ year: number; count: number }[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [employmentStats, setEmploymentStats] = useState<{ [key: string]: number }>({});
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [selectedBar, setSelectedBar] = useState<string | null>(null);
  const [chartAnimation, setChartAnimation] = useState(true);
  const navigate = useNavigate();

  // Dynamic data loading
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await fetchAlumniStatistics();
      setStats(data.years || []);
      setYearOptions(['ALL', ...(data.years || []).map((y: any) => String(y.year))]);
      setLastUpdated(new Date());
    } catch (e) {
      setStats([]);
      setYearOptions(['ALL']);
    } finally {
      setStatsLoading(false);
    }
  }, []);


  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Dynamic employment stats loading
  const loadEmploymentStats = useCallback(async () => {
    try {
      const data = await fetchAlumniEmploymentStats(selectedYear, selectedProgram);
      setEmploymentStats(data.status_counts || {});
      setLastUpdated(new Date());
    } catch (e) {
      setEmploymentStats({});
    }
  }, [selectedYear, selectedProgram]);

  useEffect(() => {
    loadEmploymentStats();
  }, [loadEmploymentStats]);


  // Helper: normalize arbitrary backend status keys to canonical buckets
  const normalizeStatusCounts = (raw: { [key: string]: number } = {}) => {
    const result: { [key: string]: number } = {
      Employed: 0,
      Unemployed: 0,
      Absorb: 0,
      Pending: 0,
      Absorbed_Count: 0,  // Add this for the absorbed indicator
    };

    Object.entries(raw || {}).forEach(([key, value]) => {
      const k = (key || '').toString().toLowerCase();
      const n = Number(value) || 0;
      if (k.includes('unemploy')) {
        result.Unemployed += n;
      } else if (k.includes('employ')) {
        // Count only non-unemployed employ terms
        result.Employed += n;
      } else if (k.includes('absorbed_count')) {
        // Keep Absorbed_Count separate for the indicator
        result.Absorbed_Count += n;
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
    console.log('🔍 DEBUG: Raw employmentStats:', employmentStats);
    console.log('🔍 DEBUG: Normalized counts:', counts);
    console.log('🔍 DEBUG: Absorbed_Count:', counts.Absorbed_Count);
    
    return [
      { category: 'Untracked', count: counts.Pending },
      { category: 'Employed', count: counts.Employed, absorbedCount: counts.Absorbed_Count || 0 },
      { category: 'Unemployed', count: counts.Unemployed },
      // Removed 'Absorb' as separate category - now combined with 'Employed'
    ];
  })();

  const maxCount = chartData.length > 0 ? Math.max(...chartData.map((d) => d.count)) : 0;
  
  // Dynamic scaling for large numbers (up to 5000+ alumni)
  const getScaleInfo = (max: number) => {
    if (max <= 50) {
      return { step: 10, maxTick: Math.ceil(max / 10) * 10 };
    } else if (max <= 500) {
      return { step: 50, maxTick: Math.ceil(max / 50) * 50 };
    } else if (max <= 1000) {
      return { step: 100, maxTick: Math.ceil(max / 100) * 100 };
    } else if (max <= 5000) {
      return { step: 250, maxTick: Math.ceil(max / 250) * 250 };
    } else {
      return { step: 500, maxTick: Math.ceil(max / 500) * 500 };
    }
  };
  
  const { step, maxTick } = getScaleInfo(maxCount);
  const ticks = Array.from({ length: maxTick / step + 1 }, (_, i) => i * step);


  const handleFilterChange = useCallback((type: 'year' | 'program', value: string) => {
    if (type === 'year') {
      setSelectedYear(value);
    } else {
      setSelectedProgram(value);
    }
    setChartAnimation(false);
    setTimeout(() => setChartAnimation(true), 100);
  }, []);

  const handleBarClick = useCallback((data: any) => {
    setSelectedBar(selectedBar === data.category ? null : data.category);
  }, [selectedBar]);

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
    if (!selectedFile || !batchYear || !selectedProgramImport) {
      setMessage({ type: 'error', text: 'Please fill in all fields and select a file' });
      return;
    }

    setLoading(true);
    setMessage(null);
    setLastImportResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('batch_year', batchYear);
    formData.append('program', selectedProgramImport);

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
        // Refresh statistics lists and chart after successful import
        await refreshStatisticsState();
        broadcastStatsUpdate();
        setSelectedFile(null);
        setBatchYear('');
        setSelectedProgramImport('');
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
          // Refresh statistics lists and chart after successful import
          await refreshStatisticsState();
          broadcastStatsUpdate();
          setSelectedFile(null);
          setBatchYear('');
          setSelectedProgramImport('');
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

  // Refresh in-page statistics state (years list and bar chart)
  const refreshStatisticsState = async () => {
    try {
      const data = await fetchAlumniStatistics();
      setStats(data.years || []);
      setYearOptions(['ALL', ...(data.years || []).map((y: any) => String(y.year))]);
    } catch {
      // ignore
    }
    try {
      const employment = await fetchAlumniEmploymentStats(selectedYear, selectedProgram);
      setEmploymentStats(employment.status_counts || {});
    } catch {
      // ignore
    }
  };

  // Notify other tabs/pages (e.g., Dashboard) to refresh
  const broadcastStatsUpdate = () => {
    const ts = String(Date.now());
    try {
      localStorage.setItem('statsUpdatedAt', ts);
    } catch {}
    try {
      const evt = new CustomEvent('stats-update', { detail: { ts } });
      window.dispatchEvent(evt);
    } catch {}
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedFile(null);
    setBatchYear('');
    setSelectedProgramImport('');
    setMessage(null);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', position: 'relative' }}>
      <Sidebar />

      <div className="admin-content-page" style={{ padding: '32px 48px', fontFamily: 'Arial, sans-serif', flex: 1, position: 'relative', overflowY: 'auto', marginLeft: 'var(--sidebar-width, 220px)' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '16px' }}>Statistics</h2>

        {/* Filters */}
        <div className="filter-container">
          <div style={styles.filterControls}>
            <div style={styles.filterGroup}>
              <label htmlFor="year-filter" style={styles.filterLabel}>
                <FaChartLine style={{ marginRight: '6px' }} />
                Year:
              </label>
              <select
                id="year-filter"
                value={selectedYear}
                onChange={(e) => handleFilterChange('year', e.target.value)}
                style={styles.filterSelect}
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.filterGroup}>
              <label htmlFor="program-filter" style={styles.filterLabel}>
                <FaUsers style={{ marginRight: '6px' }} />
                Program:
              </label>
              <select
                id="program-filter"
                value={selectedProgram}
                onChange={(e) => handleFilterChange('program', e.target.value)}
                style={styles.filterSelect}
              >
                {courseOptions.map((course) => (
                  <option key={course} value={course}>
                    {course}
                  </option>
                ))}
              </select>
            </div>

          </div>

          <div style={styles.lastUpdated}>
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>

          {/* Buttons aligned to right */}
          <div className="filter-buttons">
            <button className="action-button" onClick={() => setShowModal(true)}>
              <FaUpload style={{ marginRight: '8px' }} />
              Import Alumni
            </button>
          </div>
        </div>

        {/* Enhanced Bar Chart */}
        <div style={styles.chartContainer}>
          <div style={styles.chartHeader}>
            <div>
              <div style={styles.chartTitleContainer}>
                <div style={styles.chartIcon}>
                  <FaChartLine />
                </div>
                <div>
                  <h3 style={styles.chartTitle}>
                    Alumni Employment Statistics
                  </h3>
                  <span style={styles.lastUpdated}>Last updated: 12:10:00 AM</span>
                </div>
              </div>
            </div>
            <div style={styles.totalCount}>
              <span style={styles.totalValue}>{chartData.reduce((sum, item) => sum + item.count, 0).toLocaleString()}</span>
              <span style={styles.totalLabel}>Alumni</span>
            </div>
          </div>
          
          <div style={styles.chartWrapper}>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart 
                data={chartData} 
                margin={{ top: 30, right: 40, left: 40, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="1 1" stroke="#E5E7EB" strokeOpacity={0.3} />
                <XAxis 
                  dataKey="category" 
                  tick={{ fontSize: 13, fill: '#6B7280', fontWeight: '600', letterSpacing: '0.025em' }}
                  tickLine={{ stroke: '#D1D5DB' }}
                  axisLine={{ stroke: '#D1D5DB' }}
                  height={60}
                />
                <YAxis 
                  domain={[0, maxTick]} 
                  ticks={ticks}
                  tick={{ fontSize: 13, fill: '#6B7280', fontWeight: '600' }}
                  tickLine={{ stroke: '#D1D5DB' }}
                  axisLine={{ stroke: '#D1D5DB' }}
                  width={60}
                />
                <Tooltip 
                  contentStyle={styles.tooltip}
                  labelStyle={styles.tooltipLabel}
                  formatter={(value: any, name: any, props: any) => {
                    const entry = props.payload;
                    if (entry && entry.category === 'Employed' && (entry.absorbedCount || 0) > 0) {
                      return [
                        <div key="employed-tooltip">
                          <div style={styles.tooltipValue}>{value.toLocaleString()} alumni</div>
                          <div style={{...styles.tooltipValue, fontSize: '12px', color: '#7161EF', marginTop: '4px'}}>
                            📌 {entry.absorbedCount || 0} absorbed
                          </div>
                        </div>,
                        name
                      ];
                    }
                    return [
                      <span style={styles.tooltipValue}>{value.toLocaleString()} alumni</span>,
                      name
                    ];
                  }}
                  cursor={{ fill: '#F3F4F6', fillOpacity: 0.8 }}
                />
                <Bar 
                  dataKey="count" 
                  name="Alumni Count" 
                  radius={[8, 8, 0, 0]}
                  maxBarSize={80}
                  onClick={handleBarClick}
                >
                  {chartData.map((entry, index) => {
                    // Special handling for Employed bar with absorbed indicator
                    console.log(`🔍 DEBUG: Processing bar ${entry.category}, absorbedCount: ${entry.absorbedCount}`);
                    if (entry.category === 'Employed' && (entry.absorbedCount || 0) > 0) {
                      console.log('🔍 DEBUG: Rendering Employed bar with absorbed indicator');
                      return (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={barColors[entry.category]}
                          stroke={selectedBar === entry.category ? '#1F2937' : 'none'}
                          strokeWidth={selectedBar === entry.category ? 3 : 0}
                          style={{ 
                            cursor: 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            filter: selectedBar === entry.category ? 'brightness(1.1)' : 'brightness(1)',
                            transform: selectedBar === entry.category ? 'scaleY(1.05)' : 'scaleY(1)',
                            background: `linear-gradient(to right, ${barColors[entry.category]} 0%, ${barColors[entry.category]} 70%, #7161EF 70%, #7161EF 100%)`,
                          }}
                        />
                      );
                    }
                    
                    // Regular bars
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={barColors[entry.category]}
                        stroke={selectedBar === entry.category ? '#1F2937' : 'none'}
                        strokeWidth={selectedBar === entry.category ? 3 : 0}
                        style={{ 
                          cursor: 'pointer',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          filter: selectedBar === entry.category ? 'brightness(1.1)' : 'brightness(1)',
                          transform: selectedBar === entry.category ? 'scaleY(1.05)' : 'scaleY(1)',
                        }}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Dynamic Chart Summary Cards */}
          <div style={styles.summaryCards}>
            {chartData.map((entry, index) => (
              <div 
                key={entry.category} 
                style={{
                  ...styles.summaryCard,
                  ...(selectedBar === entry.category ? styles.summaryCardSelected : {}),
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  borderLeft: `4px solid ${barColors[entry.category]}`,
                }}
                onClick={() => handleBarClick({ category: entry.category })}
                onMouseEnter={(e) => {
                  if (selectedBar !== entry.category) {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedBar !== entry.category) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                  }
                }}
              >
                <div style={styles.summaryIconContainer}>
                  <div 
                    style={{
                      ...styles.summaryIcon,
                      backgroundColor: barColors[entry.category],
                    }}
                  >
                    {entry.category === 'Employed' && <FaBriefcase />}
                    {entry.category === 'Untracked' && <FaClock />}
                    {entry.category === 'Unemployed' && <FaTimes />}
                    {entry.category === 'Absorb' && <FaBullseye />}
                  </div>
                </div>
                <div style={styles.summaryContent}>
                  <div style={{
                    ...styles.summaryNumber,
                    color: selectedBar === entry.category ? '#1f2937' : '#1f2937',
                  }}>
                    {entry.count.toLocaleString()}
                  </div>
                  <div style={{
                    ...styles.summaryLabel,
                    fontWeight: selectedBar === entry.category ? '600' : '400',
                  }}>
                    {entry.category}
                  </div>
                </div>
              </div>
            ))}
          </div>
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
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '600', 
                  color: '#374151',
                  fontSize: '14px'
                }}>
                  Batch Graduated:
                </label>
                <select
                  value={batchYear}
                  onChange={(e) => setBatchYear(e.target.value)}
                  disabled={loading}
                  style={{ 
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '15px',
                    color: '#374151',
                    backgroundColor: 'white',
                    transition: 'all 0.2s ease',
                    outline: 'none',
                    fontWeight: '500',
                    cursor: 'pointer',
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    backgroundSize: '16px',
                    paddingRight: '40px'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#d1d5db';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <option value="" style={{ color: '#9ca3af' }}>Select graduation year</option>
                  {batchYearOptions.map((year) => (
                    <option key={year} value={year} style={{ color: '#374151' }}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-group">
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '600', 
                  color: '#374151',
                  fontSize: '14px'
                }}>
                  Program:
                </label>
                <select
                  value={selectedProgramImport}
                  onChange={(e) => setSelectedProgramImport(e.target.value)}
                  disabled={loading}
                  style={{ 
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '15px',
                    color: '#374151',
                    backgroundColor: 'white',
                    transition: 'all 0.2s ease',
                    outline: 'none',
                    fontWeight: '500',
                    cursor: 'pointer',
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    backgroundSize: '16px',
                    paddingRight: '40px'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#d1d5db';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <option value="" style={{ color: '#9ca3af' }}>Select course</option>
                  {courseOptions
                    .filter((c) => c !== 'ALL')
                    .map((course) => (
                      <option key={course} value={course} style={{ color: '#374151' }}>
                        {course}
                      </option>
                    ))}
                </select>
              </div>

              <div className="modal-group">
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '600', 
                  color: '#374151',
                  fontSize: '14px'
                }}>
                  Upload Excel File:
                </label>
                <div style={{
                  border: '2px dashed #d1d5db',
                  borderRadius: '8px',
                  padding: '20px',
                  textAlign: 'center',
                  backgroundColor: '#f9fafb',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.backgroundColor = '#f0f9ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#d1d5db';
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                }}>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    disabled={loading}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      opacity: 0,
                      cursor: 'pointer'
                    }}
                  />
                  <div style={{ fontSize: '48px', color: '#6b7280', marginBottom: '12px' }}>📄</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                    Choose Excel File
                  </div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>
                    Click to browse or drag and drop
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>
                    Supports .xlsx and .xls files
                  </div>
                </div>
                <small style={{ 
                  color: '#6b7280', 
                  marginTop: '8px', 
                  display: 'block',
                  fontSize: '12px',
                  lineHeight: '1.4'
                }}>
                  <strong>Required columns:</strong> CTU_ID, First_Name, Last_Name, Gender, Birthdate<br />
                  <strong>Optional:</strong> Middle_Name, Phone_Number, Address<br />
                  <strong>Date format:</strong> MM/DD/YYYY or YYYY-MM-DD
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

        {/* Enhanced Chart Styles */}
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
          
          .chart-container {
            animation: fadeIn 0.5s ease-out;
          }
          
          .summary-card:hover {
            animation: pulse 0.3s ease-in-out;
          }
        `}</style>

        {/* Enhanced Chart Styles */}
        <style>{`
          /* Chart Styles */
          .chart-container {
            background: white;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            border: 1px solid #e5e7eb;
            margin-top: 24px;
          }

          .chart-header {
            text-align: center;
            margin-bottom: 24px;
          }

          .chart-title {
            font-size: 24px;
            font-weight: 700;
            color: #1f2937;
            margin: 0 0 8px 0;
          }

          .chart-subtitle {
            font-size: 16px;
            color: #6b7280;
            margin: 0;
          }

          .chart-wrapper {
            height: 400px;
            margin-bottom: 24px;
          }

          .summary-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 16px;
            margin-top: 24px;
          }

          .summary-card {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px;
            background: #f8fafc;
            border-radius: 12px;
            border: 1px solid #e5e7eb;
          }

          .summary-indicator {
            width: 12px;
            height: 12px;
            border-radius: 50%;
          }

          .summary-content {
            display: flex;
            flex-direction: column;
          }

          .summary-number {
            font-size: 20px;
            font-weight: 700;
            color: #1f2937;
            line-height: 1;
          }

          .summary-label {
            font-size: 14px;
            color: #6b7280;
            margin-top: 2px;
          }

          .tooltip {
            background: white !important;
            border: 1px solid #e5e7eb !important;
            border-radius: 8px !important;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
            padding: 12px !important;
          }

          .tooltip-label {
            font-weight: 600 !important;
            color: #374151 !important;
            margin-bottom: 4px !important;
          }

          .tooltip-value {
            font-weight: 700 !important;
            color: #1f2937 !important;
          }

          .legend {
            padding-top: 16px !important;
          }
        `}</style>

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

// Enhanced Chart Styles
const styles: { [key: string]: React.CSSProperties } = {
  chartContainer: {
    background: 'white',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
    border: '1px solid #e5e7eb',
    marginTop: '16px',
    maxHeight: 'fit-content',
  },
  chartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '1px solid #E5E7EB',
  },
  chartTitleContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  chartIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #1C4E80 0%, #3B82F6 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '20px',
  },
  chartTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#1f2937',
    margin: '0 0 4px 0',
    letterSpacing: '-0.025em',
  },
  chartSubtitle: {
    fontSize: '14px',
    color: '#6b7280',
    margin: '0',
    fontWeight: '500',
  },
  lastUpdated: {
    fontSize: '12px',
    color: '#6b7280',
    margin: '0',
    fontWeight: '500',
    display: 'block',
    marginTop: '4px',
  },
  totalCount: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '4px',
  },
  totalLabel: {
    fontSize: '12px',
    color: '#6B7280',
    fontWeight: '500',
    letterSpacing: '0.025em',
    textAlign: 'center',
  },
  totalValue: {
    fontSize: '24px',
    color: '#1F2937',
    fontWeight: '500',
    lineHeight: '1',
    textAlign: 'center',
  },
  chartWrapper: {
    height: '400px',
    marginBottom: '24px',
  },
  summaryCards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px',
    marginTop: '24px',
  },
  summaryCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    padding: '20px',
    background: '#FFFFFF',
    borderRadius: '16px',
    border: '1px solid #E5E7EB',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
    position: 'relative',
    overflow: 'hidden',
  },
  summaryIconContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '18px',
    fontWeight: '600',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)',
  },
  summaryIndicator: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
  },
  summaryContent: {
    display: 'flex',
    flexDirection: 'column',
  },
  summaryNumber: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#1f2937',
    lineHeight: '1',
    letterSpacing: '-0.025em',
  },
  summaryLabel: {
    fontSize: '13px',
    color: '#6b7280',
    marginTop: '4px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  tooltip: {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    padding: '12px',
  },
  tooltipLabel: {
    fontWeight: '600',
    color: '#374151',
    marginBottom: '4px',
  },
  tooltipValue: {
    fontWeight: '700',
    color: '#1f2937',
  },
  legend: {
    paddingTop: '16px',
  },
  filterContainer: {
    background: 'white',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
    border: '1px solid #e5e7eb',
  },
  filterControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    flexWrap: 'wrap',
    marginBottom: '12px',
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  filterLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    display: 'flex',
    alignItems: 'center',
  },
  filterSelect: {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    backgroundColor: 'white',
    cursor: 'pointer',
    transition: 'border-color 0.2s ease',
  },
  summaryCardSelected: {
    backgroundColor: '#f3f4f6',
    borderColor: '#3b82f6',
    borderWidth: '2px',
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 20px rgba(59, 130, 246, 0.15)',
  },
};
