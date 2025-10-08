import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../global/sidebar';
import { generateSpecificStats, fetchAlumniEmploymentStats, fetchCoordinatorRequestsCount } from '../../../services/api';

const Dashboard = () => {
  const navigate = useNavigate();
  const [untrackedCount, setUntrackedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [employedPct, setEmployedPct] = useState(0);
  const [absorbedPct, setAbsorbedPct] = useState(0);
  const [unemployedPct, setUnemployedPct] = useState(0);
  const [employedCount, setEmployedCount] = useState(0);
  const [absorbedCount, setAbsorbedCount] = useState(0);
  const [unemployedCount, setUnemployedCount] = useState(0);
  const [totalAlumni, setTotalAlumni] = useState(0);
  const [today, setToday] = useState(new Date());
  const [coordinatorReqCount, setCoordinatorReqCount] = useState(0);

  useEffect(() => {
    const fetchUntrackedCount = async () => {
      try {
        const data = await generateSpecificStats('ALL', 'ALL', 'QPRO');
        setUntrackedCount(Number(data?.untracked_count) || 0);
      } catch (error) {
        console.error('Error fetching untracked count:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUntrackedCount();
    // Listen for cross-page statistics updates (after imports)
    const refreshAll = async () => {
      try {
        const data = await fetchAlumniEmploymentStats('ALL', 'ALL');
        const counts = data?.status_counts || data?.statusCounts || {};
        const employed = Number(counts.Employed) || 0;
        const unemployed = Number(counts.Unemployed) || 0;
        const absorb = Number(counts.Absorb) || 0;
        const pending = Number(counts.Pending) || 0;
        const total = employed + unemployed + absorb + pending;
        setEmployedCount(employed);
        setUnemployedCount(unemployed);
        setAbsorbedCount(absorb);
        setTotalAlumni(total);
        const denom = total > 0 ? total : 1;
        setEmployedPct((employed / denom) * 100);
        setUnemployedPct((unemployed / denom) * 100);
        setAbsorbedPct((absorb / denom) * 100);
      } catch (e) {
        console.error('Dashboard refresh after stats update failed:', e);
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'statsUpdatedAt') refreshAll();
    };
    const onCustom = () => refreshAll();
    window.addEventListener('storage', onStorage);
    window.addEventListener('stats-update' as any, onCustom as any);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('stats-update' as any, onCustom as any);
    };
  }, []);

  // Fetch coordinator requests count (Completed sent by coordinators)
  useEffect(() => {
    const loadCoordinatorReq = async () => {
      try {
        const res = await fetchCoordinatorRequestsCount();
        setCoordinatorReqCount(Number(res?.count) || 0);
      } catch (e) {
        console.error('Error fetching coordinator requests count:', e);
      }
    };
    loadCoordinatorReq();
    const interval = setInterval(loadCoordinatorReq, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch employment stats for charts (employed, absorbed, unemployed)
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await fetchAlumniEmploymentStats('ALL', 'ALL');
        const counts = data?.status_counts || data?.statusCounts || {};
        const employed = Number(counts.Employed) || 0;
        const unemployed = Number(counts.Unemployed) || 0;
        const absorb = Number(counts.Absorb) || 0;
        const pending = Number(counts.Pending) || 0;
        const total = employed + unemployed + absorb + pending;
        setEmployedCount(employed);
        setUnemployedCount(unemployed);
        setAbsorbedCount(absorb);
        setTotalAlumni(total);
        const denom = total > 0 ? total : 1;
        setEmployedPct((employed / denom) * 100);
        setUnemployedPct((unemployed / denom) * 100);
        setAbsorbedPct((absorb / denom) * 100);
      } catch (e) {
        console.error('Error fetching alumni stats:', e);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const handleUntrackedClick = () => {
    navigate('/tracker/settings');
  };
  const layoutStyle: React.CSSProperties = {
    display: 'flex',
    minHeight: '100vh',
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    padding: '24px 32px',
    backgroundColor: '#f5f6fa',
    marginLeft: 240, // space for fixed sidebar
    height: '100vh',
    overflowY: 'auto',
  };

  // Top banner (light blue strip)
  const bannerStyle: React.CSSProperties = {
    background: 'linear-gradient(180deg, #bfe0f1 0%, #cfe8f6 100%)',
    borderRadius: 12,
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    border: '1px solid #e3eef6'
  };

  const bannerLeftStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  };

  const todoTitleStyle: React.CSSProperties = {
    fontWeight: 700,
    color: '#0f2f5f',
    textAlign: 'center' as const,
    flex: 1
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    height: '100%'
  };

  const untrackedCardStyle: React.CSSProperties = {
    ...cardStyle,
    backgroundColor: '#153e75',
    color: 'white',
    border: '2px solid #1c4e8a',
  };

  const cardsContainerStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateRows: 'repeat(3, 1fr)',
    gap: '12px',
    height: '100%'
  };

  const topGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 320px',
    gridTemplateRows: 'auto 1fr',
    gap: 16,
    alignItems: 'stretch'
  };

  const calendarStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    padding: 12,
    minHeight: 220,
  };

  // Calendar helpers
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const weekDays = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) => (i < firstDay ? 0 : i - firstDay + 1));

  const chartContainerStyle: React.CSSProperties = {
    display: 'flex',
    marginTop: '32px',
    gap: '24px',
  };

  const pieChartStyle: React.CSSProperties = {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    minHeight: '300px',
  };

  const barChartStyle: React.CSSProperties = {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    minHeight: '300px',
  };

  return (
    <div style={layoutStyle}>
      <Sidebar />
      <div style={contentStyle}>
        {/* Left column: Banner on top, cards below | Right column: Calendar spanning both rows */}
        <div style={topGridStyle}>
          {/* Left column container */}
          <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: 16, gridColumn: 1 }}>
            {/* Banner (left only) */}
            <div style={bannerStyle}>
              <div style={bannerLeftStyle}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0b2a55' }}>DASHBOARD</div>
                <div style={{ fontSize: 12, color: '#2b6cb0' }}>Welcome, Admin</div>
              </div>
              <div style={todoTitleStyle}>To Do's</div>
              <div style={{ width: 160 }} />
            </div>

            {/* Cards under banner */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <div
                style={untrackedCardStyle}
                onClick={handleUntrackedClick}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                }}
              >
                <div style={{ fontSize: 16, opacity: 0.9 }}>Untracked</div>
                <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{loading ? '…' : untrackedCount}</div>
              </div>

              <div
                style={{ ...cardStyle, backgroundColor: '#143a6d', color: 'white' }}
                onClick={() => navigate('/requests')}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                }}
              >
                <div style={{ fontSize: 16, opacity: 0.9 }}>Coordinator Request</div>
                <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{coordinatorReqCount}</div>
              </div>

              <div
                style={{ ...cardStyle, backgroundColor: '#143a6d', color: 'white' }}
                onClick={() => navigate('/rewards')}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                }}
              >
                <div style={{ fontSize: 16, opacity: 0.9 }}>Awards</div>
                <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>0</div>
              </div>
            </div>
          </div>

          {/* Calendar (right column, spanning both rows) */}
          <div style={{ ...calendarStyle, gridRow: '1 / span 2', gridColumn: 2, alignSelf: 'stretch' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, color: '#0b2a55' }}>{monthNames[month]} {year}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setToday(new Date(year, month - 1, 1))} style={{ border: '1px solid #e5e7eb', background: 'white', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>{'<'}</button>
                <button onClick={() => setToday(new Date())} style={{ border: '1px solid #e5e7eb', background: 'white', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>Today</button>
                <button onClick={() => setToday(new Date(year, month + 1, 1))} style={{ border: '1px solid #e5e7eb', background: 'white', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>{'>'}</button>
              </div>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 6,
              marginTop: 8,
              fontSize: 12,
              color: '#374151'
            }}>
              {weekDays.map((d) => (
                <div key={d} style={{ textAlign: 'center', fontWeight: 700, color: '#0b2a55' }}>{d}</div>
              ))}
              {cells.map((day, idx) => {
                const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
                return (
                  <div key={idx} style={{
                    textAlign: 'center',
                    padding: '6px 0',
                    borderRadius: 8,
                    background: isToday ? '#e8f1ff' : 'transparent',
                    border: isToday ? '1px solid #bcd3ff' : '1px solid transparent',
                    color: day === 0 ? 'transparent' : '#374151'
                  }}>
                    {day || ''}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div style={chartContainerStyle}>
          {/* Pie Chart - Left Side */}
          <div style={pieChartStyle}>
            <h3 style={{ margin: '0 0 16px 0', color: '#374151' }}>Employed vs. Unemployed Graduates</h3>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              height: '200px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '2px dashed #d1d5db'
            }}>
              {/* Simple donut chart using CSS only */}
              <div style={{ position: 'relative', width: 180, height: 180 }}>
                {/* base circle */}
                <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%' }}>
                  {/* background ring */}
                  <path
                    d="M18 2.0845
                       a 15.9155 15.9155 0 0 1 0 31.831
                       a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="3.8"
                  />
                  {/* employed */}
                  <path
                    d="M18 2.0845
                       a 15.9155 15.9155 0 0 1 0 31.831
                       a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#7c8cff"
                    strokeWidth="3.8"
                    strokeDasharray={`${Math.round(employedPct)}, 100`}
                  />
                  {/* absorbed sits after employed */}
                  <path
                    d="M18 2.0845
                       a 15.9155 15.9155 0 0 1 0 31.831
                       a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#9db5ff"
                    strokeWidth="3.8"
                    strokeDasharray={`${Math.round(absorbedPct)}, 100`}
                    strokeDashoffset={-Math.round(employedPct)}
                  />
                  {/* unemployed after employed+absorbed */}
                  <path
                    d="M18 2.0845
                       a 15.9155 15.9155 0 0 1 0 31.831
                       a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#9de1a5"
                    strokeWidth="3.8"
                    strokeDasharray={`${Math.round(unemployedPct)}, 100`}
                    strokeDashoffset={-(Math.round(employedPct + absorbedPct))}
                  />
                </svg>
                {/* inner label */}
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#374151' }}>{statsLoading ? '…' : `${Math.round((employedPct + absorbedPct + unemployedPct))}%`}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>Total</div>
                </div>
              </div>
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 12, fontSize: 12, color: '#374151' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, background: '#7c8cff', borderRadius: 2 }}></span>Employed ({Math.round(employedPct)}%)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, background: '#9db5ff', borderRadius: 2 }}></span>Absorb ({Math.round(absorbedPct)}%)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, background: '#9de1a5', borderRadius: 2 }}></span>Unemployed ({Math.round(unemployedPct)}%)</div>
            </div>
          </div>

          {/* Right Side: Small stats cards mimicking legend */}
          <div style={barChartStyle}>
            <h3 style={{ margin: '0 0 16px 0', color: '#374151' }}>Statistics Overview</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', borderRadius: 12, padding: '12px 14px', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#7c8cff' }} />
                  <div style={{ color: '#374151', fontWeight: 600 }}>Employed</div>
                </div>
                <div style={{ color: '#374151', fontSize: 12 }}>{statsLoading ? '…' : `${employedCount} (${Math.round(employedPct)}%)`}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', borderRadius: 12, padding: '12px 14px', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#9db5ff' }} />
                  <div style={{ color: '#374151', fontWeight: 600 }}>Absorb</div>
                </div>
                <div style={{ color: '#374151', fontSize: 12 }}>{statsLoading ? '…' : `${absorbedCount} (${Math.round(absorbedPct)}%)`}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', borderRadius: 12, padding: '12px 14px', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#9de1a5' }} />
                  <div style={{ color: '#374151', fontWeight: 600 }}>Unemployed</div>
                </div>
                <div style={{ color: '#374151', fontSize: 12 }}>{statsLoading ? '…' : `${unemployedCount} (${Math.round(unemployedPct)}%)`}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff', borderRadius: 12, padding: '12px 14px', border: '1px solid #e5e7eb' }}>
                <div style={{ color: '#374151', fontWeight: 700 }}>Total Alumni</div>
                <div style={{ color: '#374151', fontSize: 12 }}>{statsLoading ? '…' : totalAlumni}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
