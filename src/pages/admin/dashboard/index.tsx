import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../global/sidebar';
import { generateSpecificStats, fetchAlumniEmploymentStats, fetchCoordinatorRequestsCount } from '../../../services/api';
import { normalizeStatusCounts } from '../statistics/index';

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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [timeAgo, setTimeAgo] = useState('');
  const [prevSnapshot, setPrevSnapshot] = useState<{ employed: number; absorb: number; unemployed: number; untracked: number; requests: number } | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedProgram, setSelectedProgram] = useState<string>('ALL');

  // UNIFIED: Single effect to fetch all dashboard statistics
  useEffect(() => {
    const fetchAllStats = async () => {
      setLoading(true);
      setStatsLoading(true);
      try {
        // Fetch with selected filters for accurate display
        const data = await fetchAlumniEmploymentStats(selectedYear || 'ALL', selectedProgram || 'ALL');
        const counts = data?.status_counts || data?.statusCounts || {};
        const employed = Number(counts.Employed) || 0;
        const unemployed = Number(counts.Unemployed) || 0;
        const absorb =
          Number(counts.Absorb) ||
          Number((counts as any).Absorbed) ||
          Number((counts as any).Absorbed_Count) || 0;
        const pending = Number(counts.Pending) || 0;
        
        // Calculate employed pure (not absorbed)
        const employedPure = Math.max(employed - absorb, 0);
        const total = employedPure + absorb + unemployed + pending;
        
        // Store snapshot for delta calculation
        const nextSnapshot = { 
          employed: employedPure, 
          absorb, 
          unemployed, 
          untracked: pending, 
          requests: coordinatorReqCount 
        };
        setPrevSnapshot((prev) => prev ?? nextSnapshot);
        
        // Update all state variables in one batch
        setUntrackedCount(pending);
        setEmployedCount(employedPure);
        setUnemployedCount(unemployed);
        setAbsorbedCount(absorb);
        setTotalAlumni(total);
        
        // Calculate percentages
        const denom = total > 0 ? total : 1;
        setEmployedPct((employedPure / denom) * 100);
        setUnemployedPct((unemployed / denom) * 100);
        setAbsorbedPct((absorb / denom) * 100);
        setLastUpdated(new Date());
        
        // Update snapshot after state updates
        setTimeout(() => setPrevSnapshot(nextSnapshot), 0);
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        setUntrackedCount(0);
        setTotalAlumni(0);
      } finally {
        setLoading(false);
        setStatsLoading(false);
      }
    };

    // Initial fetch
    fetchAllStats();
    
    // Set up auto-refresh every 60 seconds
    const intervalId = setInterval(fetchAllStats, 60000);
    
    // Listen for cross-page statistics updates (after imports)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'statsUpdatedAt') fetchAllStats();
    };
    const onCustom = () => fetchAllStats();
    
    window.addEventListener('storage', onStorage);
    window.addEventListener('stats-update' as any, onCustom as any);
    
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('stats-update' as any, onCustom as any);
    };
  }, [selectedYear, selectedProgram]);

  // Fetch coordinator requests count (Completed sent by coordinators)
  useEffect(() => {
    const loadCoordinatorReq = async () => {
      try {
        const res = await fetchCoordinatorRequestsCount();
        const c = Number(res?.count) || 0;
        setCoordinatorReqCount(c);
        try { localStorage.setItem('coordinatorReqCount', String(c)); } catch {}
      } catch (e) {
        console.error('Error fetching coordinator requests count:', e);
      }
    };
    loadCoordinatorReq();
    const interval = setInterval(loadCoordinatorReq, 10000);
    return () => clearInterval(interval);
  }, []);

  // Update "updated ago" clock every second
  useEffect(() => {
    const tick = () => {
      if (!lastUpdated) return setTimeAgo('');
      const diff = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
      if (diff < 0) return setTimeAgo('');
      setTimeAgo(diff < 60 ? `${diff}s ago` : `${Math.floor(diff / 60)}m ago`);
    };
    const t = setInterval(tick, 1000);
    tick();
    return () => clearInterval(t);
  }, [lastUpdated]);

  // Small helper to render delta badge
  const Delta = ({ current, prev, suffix }: { current: number; prev?: number; suffix?: string }) => {
    if (prev === undefined || prev === null) return null as any;
    const diff = current - prev;
    if (diff === 0) return null as any;
    const up = diff > 0;
    const color = up ? '#16a34a' : '#dc2626';
    const arrow = up ? '▲' : '▼';
    return (
      <div style={{ fontSize: 12, color, marginTop: 4 }}>{arrow} {Math.abs(diff)}{suffix || ''}</div>
    ) as any;
  };

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
    marginLeft: 'var(--sidebar-width, 220px)',
    height: '100vh',
    overflowY: 'auto',
    transition: 'margin-left 0.3s ease',
  };

  // For mobile, adjust margin dynamically
  useEffect(() => {
    const updateMargin = () => {
      const sidebarWidth = getComputedStyle(document.documentElement)
        .getPropertyValue('--sidebar-width') || '220px';
      const content = document.querySelector('[data-dashboard-content]') as HTMLElement;
      if (content) {
        content.style.marginLeft = window.innerWidth < 768 ? '0' : sidebarWidth;
      }
    };
    window.addEventListener('resize', updateMargin);
    updateMargin();
    return () => window.removeEventListener('resize', updateMargin);
  }, []);

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

  // Unified color mapping across widgets
  const COLORS = {
    employed: '#7c8cff',
    absorb: '#9db5ff',
    unemployed: '#9de1a5',
  } as const;

  // Quick filters removed from toolbar

  // Verse of the Day: fetch from APIs with daily cache and graceful fallback
  const BIBLE_VERSES = [
    { ref: 'Psalm 23:1', text: 'The Lord is my shepherd; I shall not want.' },
    { ref: 'Philippians 4:13', text: 'I can do all things through Christ who strengthens me.' },
    { ref: 'Jeremiah 29:11', text: 'For I know the plans I have for you, declares the Lord...' },
    { ref: 'Proverbs 3:5-6', text: 'Trust in the Lord with all your heart and lean not on your own understanding.' },
    { ref: 'Isaiah 41:10', text: 'Fear not, for I am with you; be not dismayed, for I am your God.' },
    { ref: 'Matthew 11:28', text: 'Come to me, all who labor and are heavy laden, and I will give you rest.' },
    { ref: 'Romans 8:28', text: 'And we know that in all things God works for the good of those who love him.' },
    { ref: 'Joshua 1:9', text: 'Be strong and courageous... for the Lord your God is with you wherever you go.' },
    { ref: 'Psalm 46:1', text: 'God is our refuge and strength, a very present help in trouble.' },
    { ref: 'John 14:27', text: 'Peace I leave with you; my peace I give to you.' },
    { ref: 'Lamentations 3:22-23', text: 'His mercies never come to an end; they are new every morning.' },
    { ref: 'Psalm 121:1-2', text: 'I lift up my eyes to the hills—from where does my help come?' }
  ];
  const todayKey = `${new Date().getFullYear()}-${new Date().getMonth()}-${new Date().getDate()}`;
  const [verse, setVerse] = useState<{ text: string; ref: string; source?: string } | null>(null);
  const [verseLoading, setVerseLoading] = useState<boolean>(true);

  useEffect(() => {
    const seededFallback = () => {
      const idx = Math.abs(Array.from(todayKey).reduce((a, c) => a + c.charCodeAt(0), 0)) % BIBLE_VERSES.length;
      return BIBLE_VERSES[idx];
    };

    const fetchWithTimeout = async (url: string, timeoutMs = 6000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { signal: controller.signal });
        return res;
      } finally {
        clearTimeout(id);
      }
    };

    const loadVerse = async () => {
      setVerseLoading(true);
      try {
        const cached = localStorage.getItem(`votd::${todayKey}`);
        if (cached) {
          setVerse(JSON.parse(cached));
          setVerseLoading(false);
          return;
        }

        // 1) OurManna random verse
        try {
          const res = await fetchWithTimeout('https://beta.ourmanna.com/api/v1/get/?format=json&order=random');
          if (res.ok) {
            const data = await res.json();
            const text = data?.verse?.details?.text?.trim();
            const ref = data?.verse?.details?.reference?.trim();
            if (text && ref) {
              const payload = { text, ref, source: 'ourmanna' };
              setVerse(payload);
              try { localStorage.setItem(`votd::${todayKey}`, JSON.stringify(payload)); } catch {}
              setVerseLoading(false);
              return;
            }
          }
        } catch {}

        // 2) labs.bible.org random verse
        try {
          const res2 = await fetchWithTimeout('https://labs.bible.org/api/?passage=random&type=json');
          if (res2.ok) {
            const arr = await res2.json();
            const v = Array.isArray(arr) && arr[0] ? arr[0] : null;
            const text = v?.text?.trim();
            const ref = v ? `${v.bookname} ${v.chapter}:${v.verse}` : '';
            if (text && ref) {
              const payload = { text, ref, source: 'labs.bible' };
              setVerse(payload);
              try { localStorage.setItem(`votd::${todayKey}`, JSON.stringify(payload)); } catch {}
              setVerseLoading(false);
              return;
            }
          }
        } catch {}

        // 3) Seeded local fallback
        const fb = seededFallback();
        const payload = { text: fb.text, ref: fb.ref, source: 'local' };
        setVerse(payload);
        try { localStorage.setItem(`votd::${todayKey}`, JSON.stringify(payload)); } catch {}
      } finally {
        setVerseLoading(false);
      }
    };

    loadVerse();
  }, [todayKey]);

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
      <div style={contentStyle} data-dashboard-content>
        {/* Left column: Banner on top, quick filters + actions, cards below | Right column: Calendar spanning both rows */}
        <div style={topGridStyle}>
          {/* Left column container */}
          <div style={{ display: 'grid', gridTemplateRows: 'auto auto 1fr', gap: 16, gridColumn: 1 }}>
            {/* Banner (left only) */}
            <div style={bannerStyle}>
              <div style={bannerLeftStyle}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0b2a55' }}>DASHBOARD</div>
                <div style={{ fontSize: 12, color: '#2b6cb0' }}>Welcome, Admin</div>
              </div>
              <div style={todoTitleStyle}>To Do's</div>
              <div style={{ fontSize: 12, color: '#0b2a55' }}>{lastUpdated ? `Updated ${timeAgo}` : 'Loading…'}</div>
            </div>

            {/* Quick Actions (filters and extra buttons removed) */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'flex-end' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {/* Keep only the Generate Statistics entry point via the card below */}
              </div>
            </div>

            {/* Cards under banner with skeleton support */}
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
                <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>
                  {loading ? <div style={{ height: 28, borderRadius: 8, background: '#e5e7eb', width: 80, margin: '0 auto' }} /> : `${untrackedCount}/${totalAlumni}`}
                </div>
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
                <div style={{ fontSize: 16, opacity: 0.9 }}>OJT Submissions</div>
                <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>
                  {statsLoading ? <div style={{ height: 28, borderRadius: 8, background: '#e5e7eb', width: 40, margin: '0 auto' }} /> : coordinatorReqCount}
                </div>
              </div>

              <div
                style={{ ...cardStyle, backgroundColor: '#143a6d', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => navigate('/ViewStats', { state: { openGenerate: true } })}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                  const arrow = e.currentTarget.querySelector('[data-arrow]') as HTMLElement | null;
                  if (arrow) arrow.style.transform = 'translateX(4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                  const arrow = e.currentTarget.querySelector('[data-arrow]') as HTMLElement | null;
                  if (arrow) arrow.style.transform = 'translateX(0)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 700 }}>
                  <span>Generate Statistics</span>
                  <span data-arrow aria-hidden="true" style={{ display: 'inline-block', transition: 'transform 0.2s ease' }}>→</span>
                </div>
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
                    stroke={COLORS.employed}
                    strokeWidth="3.8"
                    style={{ transition: 'stroke-dasharray 0.6s ease' }}
                    strokeDasharray={`${Math.round(employedPct)}, 100`}
                  />
                  {/* absorbed sits after employed */}
                  <path
                    d="M18 2.0845
                       a 15.9155 15.9155 0 0 1 0 31.831
                       a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke={COLORS.absorb}
                    strokeWidth="3.8"
                    style={{ transition: 'stroke-dasharray 0.6s ease' }}
                    strokeDasharray={`${Math.round(absorbedPct)}, 100`}
                    strokeDashoffset={-Math.round(employedPct)}
                  />
                  {/* unemployed after employed+absorbed */}
                  <path
                    d="M18 2.0845
                       a 15.9155 15.9155 0 0 1 0 31.831
                       a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke={COLORS.unemployed}
                    strokeWidth="3.8"
                    style={{ transition: 'stroke-dasharray 0.6s ease' }}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, background: COLORS.employed, borderRadius: 2 }}></span>Employed ({Math.round(employedPct)}%)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, background: COLORS.absorb, borderRadius: 2 }}></span>Absorbed ({Math.round(absorbedPct)}%)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, background: COLORS.unemployed, borderRadius: 2 }}></span>Unemployed ({Math.round(unemployedPct)}%)</div>
            </div>

            {/* Verse of the Day (moved below the pie chart) */}
            <div style={{ marginTop: 16, background: '#f8fafc', borderRadius: 12, padding: '12px 14px', border: '1px solid #e5e7eb' }}>
              <div style={{ color: '#0b2a55', fontWeight: 700, marginBottom: 6 }}>Verse of the Day</div>
              <div style={{ color: '#374151', fontSize: 13, lineHeight: 1.5 }}>{verseLoading ? 'Loading…' : (verse?.text || '')}</div>
              <div style={{ color: '#1c4e80', fontSize: 12, marginTop: 6, fontWeight: 600 }}>{verseLoading ? '' : (verse?.ref || '')}</div>
            </div>
          </div>

          {/* Right Side: Small stats cards + Insights */}
          <div style={barChartStyle}>
            <h3 style={{ margin: '0 0 16px 0', color: '#374151' }}>Statistics Overview</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', borderRadius: 12, padding: '12px 14px', border: '1px solid #e5e7eb', cursor: 'pointer', transition: 'background 0.2s ease' }}
                onClick={() => navigate('/statistics')}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#eef2ff'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#f8fafc'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: COLORS.employed }} />
                  <div style={{ color: '#374151', fontWeight: 600 }}>Employed</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{ color: '#374151', fontSize: 12 }}>{statsLoading ? '…' : `${employedCount} (${Math.round(employedPct)}%)`}</div>
                  {prevSnapshot && (<Delta current={employedCount} prev={prevSnapshot.employed} />)}
                </div>
              </div>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', borderRadius: 12, padding: '12px 14px', border: '1px solid #e5e7eb', cursor: 'pointer', transition: 'background 0.2s ease' }}
                onClick={() => navigate('/statistics')}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#eef2ff'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#f8fafc'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: COLORS.absorb }} />
                  <div style={{ color: '#374151', fontWeight: 600 }}>Absorbed</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{ color: '#374151', fontSize: 12 }}>{statsLoading ? '…' : `${absorbedCount} (${Math.round(absorbedPct)}%)`}</div>
                  {prevSnapshot && (<Delta current={absorbedCount} prev={prevSnapshot.absorb} />)}
                </div>
              </div>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', borderRadius: 12, padding: '12px 14px', border: '1px solid #e5e7eb', cursor: 'pointer', transition: 'background 0.2s ease' }}
                onClick={() => navigate('/statistics')}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#eef2ff'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#f8fafc'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: COLORS.unemployed }} />
                  <div style={{ color: '#374151', fontWeight: 600 }}>Unemployed</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{ color: '#374151', fontSize: 12 }}>{statsLoading ? '…' : `${unemployedCount} (${Math.round(unemployedPct)}%)`}</div>
                  {prevSnapshot && (<Delta current={unemployedCount} prev={prevSnapshot.unemployed} />)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff', borderRadius: 12, padding: '12px 14px', border: '1px solid #e5e7eb' }}>
                <div style={{ color: '#374151', fontWeight: 700 }}>Total Alumni</div>
                <div style={{ color: '#374151', fontSize: 12 }}>{statsLoading ? '…' : totalAlumni}</div>
              </div>
              {/* Insights removed; verse displayed under pie chart */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;