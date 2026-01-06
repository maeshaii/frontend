import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../global/sidebar';
import { generateSpecificStats, fetchAlumniEmploymentStats, fetchNewUsersCount, getCalendarEventsByMonth, CalendarEventData, getRewardRequests } from '../../../services/api';
import { broadcastCoordinatorRequestCount } from '../utils/requestBadge';
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
  const [rewardRequestCount, setRewardRequestCount] = useState(0);
  const [rewardRequestLoading, setRewardRequestLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [timeAgo, setTimeAgo] = useState('');
  const [prevSnapshot, setPrevSnapshot] = useState<{ employed: number; absorb: number; unemployed: number; untracked: number; requests: number } | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedProgram, setSelectedProgram] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<{ [key: string]: CalendarEventData[] }>({});
  const [todayEventsReminder, setTodayEventsReminder] = useState<CalendarEventData[]>([]);
  const [showTodayReminderModal, setShowTodayReminderModal] = useState(false);

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

  // Fetch new users count (recently converted alumni)
  useEffect(() => {
    const loadNewUsers = async () => {
      try {
        const res = await fetchNewUsersCount();
        const c = Number(res?.count || res?.new_users) || 0;

        // Subtract acknowledged (seen) count to show only unseen items
        let ack = 0;
        try {
          ack = Number(localStorage.getItem('ackNewUsersCount')) || 0;
        } catch {
          ack = 0;
        }
        const pending = Math.max(c - ack, 0);

        setCoordinatorReqCount(pending);
        broadcastCoordinatorRequestCount(pending);
      } catch (e) {
        console.error('Error fetching new users count:', e);
      }
    };
    loadNewUsers();
    const interval = setInterval(loadNewUsers, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const applyCount = (count: number) => {
      if (isMounted) {
        setRewardRequestCount(count);
      }
    };

    const readCountFromStorage = (): boolean => {
      try {
        const stored = localStorage.getItem('rewardReqCount');
        if (stored !== null) {
          const parsed = Number(stored);
          if (!Number.isNaN(parsed)) {
            applyCount(parsed);
            setRewardRequestLoading(false);
            return true;
          }
        }
      } catch (error) {
        console.error('Error reading reward request count cache:', error);
      }
      return false;
    };

    const fetchRewardRequestCount = async () => {
      try {
        setRewardRequestLoading(true);
        const response = await getRewardRequests();
        if (!isMounted) return;
        if (response?.success && Array.isArray(response.requests)) {
          const pendingCount = response.requests.filter((req: any) => req.status === 'pending').length;
          applyCount(pendingCount);
          try {
            localStorage.setItem('rewardReqCount', String(pendingCount));
          } catch {}
        } else {
          applyCount(0);
        }
      } catch (error) {
        console.error('Error fetching reward request count:', error);
        applyCount(0);
      } finally {
        if (isMounted) {
          setRewardRequestLoading(false);
        }
      }
    };

    if (!readCountFromStorage()) {
      fetchRewardRequestCount();
    }

    const handleCountUpdated = (_event?: Event) => {
      if (!readCountFromStorage()) {
        fetchRewardRequestCount();
      }
    };

    const handleRealtimeRewardUpdate = (_event?: Event) => {
      fetchRewardRequestCount();
    };

    window.addEventListener('rewardRequestCountUpdated', handleCountUpdated as EventListener);
    window.addEventListener('rewardRequestUpdated', handleRealtimeRewardUpdate as EventListener);

    return () => {
      isMounted = false;
      window.removeEventListener('rewardRequestCountUpdated', handleCountUpdated as EventListener);
      window.removeEventListener('rewardRequestUpdated', handleRealtimeRewardUpdate as EventListener);
    };
  }, []);

  // Fetch calendar events for the current month
  useEffect(() => {
    const loadCalendarEvents = async () => {
      try {
        const year = today.getFullYear();
        const month = today.getMonth() + 1; // JavaScript months are 0-indexed
        const response = await getCalendarEventsByMonth(year, month);
        if (response.success && response.events_by_date) {
          const normalized: { [key: string]: CalendarEventData[] } = {};
          Object.entries(response.events_by_date as Record<string, CalendarEventData[] | undefined>).forEach(
            ([dateKey, items]) => {
              const safeItems = Array.isArray(items) ? items : [];
              const filtered = safeItems
                .filter((event: CalendarEventData) => event?.event_type !== 'deadline')
                .map((event: CalendarEventData) => ({
                  ...event,
                  color: event?.color || CAL_EVENT_COLOR_MAP[event?.event_type] || '#3b82f6',
                }));
            if (filtered.length) {
              normalized[dateKey] = filtered;
            }
          });
          setCalendarEvents(normalized);

          const now = new Date();
          const todayKeyStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          const todaysList = (normalized[todayKeyStr] || []).filter((evt) => evt.event_type === 'event' || evt.event_type === 'reminder');
          setTodayEventsReminder(todaysList);
          setShowTodayReminderModal(todaysList.length > 0);
        } else {
          setCalendarEvents({});
          setTodayEventsReminder([]);
          setShowTodayReminderModal(false);
        }
      } catch (e) {
        console.error('Error fetching calendar events:', e);
        setCalendarEvents({});
        setTodayEventsReminder([]);
        setShowTodayReminderModal(false);
      }
    };
    loadCalendarEvents();
  }, [today]); // Reload when month/year changes

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
    height: '100vh',
    overflow: 'hidden',
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    padding: '24px 32px',
    backgroundColor: '#f5f6fa',
    marginLeft: 'var(--sidebar-width, 220px)',
    height: '100vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
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
    gridTemplateColumns: '1fr 280px',
    gridTemplateRows: 'auto 1fr',
    gap: 16,
    alignItems: 'stretch',
    minHeight: 0,
  };

  const calendarStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    padding: 12,
    minHeight: 220,
    maxHeight: 'fit-content',
    height: 'fit-content',
  };

  // Helper functions for calendar events
  const getDateKey = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const hasEvents = (d: number) => d > 0 && calendarEvents[getDateKey(d)];

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
    marginTop: '8px',
    gap: '24px',
    flex: '0 0 auto',
    minHeight: 0,
  };

  // Unified color mapping across widgets
  const COLORS = {
    employed: '#7c8cff',
    absorb: '#9db5ff',
    unemployed: '#9de1a5',
  } as const;

  const CAL_EVENT_COLOR_MAP: Record<string, string> = {
    event: '#10b981',
    reminder: '#f59e0b',
    meeting: '#6366f1',
    holiday: '#0ea5e9',
    announcement: '#8b5cf6',
  };

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
        <div style={{ ...topGridStyle, flex: '0 0 auto', minHeight: 0, overflow: 'hidden' }}>
          {/* Left column container */}
          <div style={{ display: 'grid', gridTemplateRows: 'auto auto 1fr', gap: 16, gridColumn: 1 }}>
            {/* Banner (left only) */}
            <div style={bannerStyle}>
              <div style={bannerLeftStyle}>
                <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#2c5282' }}>Dashboard</div>
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
                <div style={{ fontSize: 16, opacity: 0.9 }}>New User</div>
                <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>
                  {statsLoading ? <div style={{ height: 28, borderRadius: 8, background: '#e5e7eb', width: 40, margin: '0 auto' }} /> : coordinatorReqCount}
                </div>
              </div>

              <div
                style={{ ...cardStyle, backgroundColor: '#143a6d', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
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
                <div style={{ fontSize: 16, opacity: 0.9, marginBottom: 6 }}>Reward Requests</div>
                <div style={{ fontSize: 36, fontWeight: 800 }}>
                  {rewardRequestLoading ? (
                    <div style={{ height: 36, borderRadius: 8, background: '#0f2d52', width: 64 }} />
                  ) : (
                    rewardRequestCount
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Calendar (right column, spanning both rows) */}
          <div style={{ ...calendarStyle, gridRow: '1 / span 2', gridColumn: 2, alignSelf: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', letterSpacing: '0.3px' }}>{monthNames[month]} {year}</div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button 
                  onClick={() => setToday(new Date(year, month - 1, 1))} 
                  style={{ 
                    border: '1px solid #d1d5db', 
                    background: 'white', 
                    borderRadius: 6, 
                    padding: '4px 8px', 
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#475569',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.borderColor = '#94a3b8';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                >
                  {'<'}
                </button>
                <button 
                  onClick={() => setToday(new Date())} 
                  style={{ 
                    border: '1px solid #3b82f6', 
                    background: '#3b82f6', 
                    color: 'white',
                    borderRadius: 6, 
                    padding: '4px 10px', 
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(59,130,246,0.2)'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = '#2563eb';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(59,130,246,0.3)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = '#3b82f6';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(59,130,246,0.2)';
                  }}
                >
                  Today
                </button>
                <button 
                  onClick={() => setToday(new Date(year, month + 1, 1))} 
                  style={{ 
                    border: '1px solid #d1d5db', 
                    background: 'white', 
                    borderRadius: 6, 
                    padding: '4px 8px', 
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#475569',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.borderColor = '#94a3b8';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                >
                  {'>'}
                </button>
              </div>
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 4,
              marginTop: 8,
              fontSize: 11,
              color: '#374151'
            }}>
              {weekDays.map((d, i) => (
                <div key={d} style={{ 
                  textAlign: 'center', 
                  fontWeight: 700, 
                  color: i === 0 || i === 6 ? '#dc2626' : '#1e40af',
                  fontSize: 10,
                  paddingBottom: 4,
                  letterSpacing: '0.3px'
                }}>{d}</div>
              ))}
              {cells.map((day, idx) => {
                const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
                const dayOfWeek = idx % 7;
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const events = day > 0 ? calendarEvents[getDateKey(day)] : null;
                const hasEvent = events && events.length > 0;
                
                // Check if THIS DATE is in the past or upcoming
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const cellDate = day > 0 ? new Date(year, month, day) : null;
                
                // Check if the CALENDAR DATE is upcoming (not the event date)
                let hasAnyUpcomingEvent = false;
                let allEventsEnded = false;
                
                if (hasEvent && events && cellDate) {
                  // Compare the CALENDAR CELL DATE to today
                  cellDate.setHours(0, 0, 0, 0);
                  const isCellDateUpcoming = cellDate >= today;
                  
                  hasAnyUpcomingEvent = isCellDateUpcoming;
                  allEventsEnded = !isCellDateUpcoming;
                }
                
                return (
                  <div 
                    key={idx} 
                    onClick={() => {
                      if (day > 0) {
                        const clickedDate = new Date(year, month, day);
                        setSelectedDate(clickedDate);
                        if (hasEvent) {
                          setShowEventModal(true);
                        }
                      }
                    }}
                    style={{
                    textAlign: 'center',
                      padding: '6px 2px',
                    borderRadius: 6,
                      background: isToday ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 
                                  hasAnyUpcomingEvent ? '#fef3c7' :  // Yellow bg for upcoming events
                                  allEventsEnded ? '#f3f4f6' :       // Grey bg for ended events
                                  isWeekend && day > 0 ? '#fef2f2' : 
                                  day > 0 ? '#f8fafc' : 'transparent',
                      border: isToday ? '2px solid #1e40af' : 
                              hasAnyUpcomingEvent ? '2px solid #fbbf24' :  // Yellow border for upcoming
                              allEventsEnded ? '2px solid #9ca3af' :        // Grey border for ended
                              '1px solid transparent',
                      color: day === 0 ? 'transparent' : 
                             isToday ? 'white' : 
                             hasAnyUpcomingEvent ? '#92400e' :  // Dark amber text for upcoming
                             allEventsEnded ? '#6b7280' :       // Grey text for ended
                             isWeekend ? '#dc2626' : '#334155',
                      fontWeight: isToday ? 700 : hasEvent ? 600 : 500,
                      cursor: day > 0 ? 'pointer' : 'default',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      fontSize: 11,
                      boxShadow: isToday ? '0 4px 8px rgba(59,130,246,0.3)' : 
                                 hasAnyUpcomingEvent ? '0 2px 4px rgba(251,191,36,0.3)' : 
                                 allEventsEnded ? '0 2px 4px rgba(156,163,175,0.2)' : 
                                 'none'
                    }}
                    onMouseOver={(e) => {
                      if (day > 0) {
                        if (!isToday) {
                          e.currentTarget.style.background = hasAnyUpcomingEvent ? '#fde68a' :   // Darker yellow hover for upcoming
                                                              allEventsEnded ? '#e5e7eb' :         // Darker grey hover for ended
                                                              '#e0e7ff';
                          e.currentTarget.style.transform = 'scale(1.05)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                        }
                      }
                    }}
                    onMouseOut={(e) => {
                      if (day > 0) {
                        if (!isToday) {
                          e.currentTarget.style.background = hasAnyUpcomingEvent ? '#fef3c7' : 
                                                              allEventsEnded ? '#f3f4f6' :
                                                              isWeekend ? '#fef2f2' : '#f8fafc';
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.boxShadow = hasAnyUpcomingEvent ? '0 2px 4px rgba(251,191,36,0.3)' : 
                                                            allEventsEnded ? '0 2px 4px rgba(156,163,175,0.2)' : 'none';
                        }
                      }
                    }}
                  >
                    <div>{day || ''}</div>
                    {hasEvent && (
                      <div style={{
                        position: 'absolute',
                        bottom: 1,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        gap: 1
                      }}>
                        {events.slice(0, 3).map((event: CalendarEventData, i: number) => {
                          // Always show event type color, never grey out
                          return (
                            <div key={i} style={{
                              width: 3,
                              height: 3,
                              borderRadius: '50%',
                              backgroundColor: event.color,
                              opacity: 1
                            }} />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div style={{ 
              marginTop: 8, 
              padding: '6px 0',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              gap: 12,
              fontSize: 9,
              color: '#64748b',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                <span>Event</span>
              </div>
              <div style={{ borderLeft: '1px solid #e5e7eb', height: 12, margin: '0 4px' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 10, height: 10, border: '2px solid #fbbf24', borderRadius: 2 }} />
                <span>Upcoming</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 10, height: 10, border: '2px solid #9ca3af', borderRadius: 2 }} />
                <span>Ended</span>
              </div>
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
              border: '2px solid #d1d5db'
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

        {/* Today's Event Reminder Modal */}
        {showTodayReminderModal && todayEventsReminder.length > 0 && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9998,
              backdropFilter: 'blur(4px)'
            }}
            onClick={() => setShowTodayReminderModal(false)}
          >
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: 16,
                padding: 24,
                width: '90%',
                maxWidth: 420,
                boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>Today's Events</div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <button
                  onClick={() => setShowTodayReminderModal(false)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: 22,
                    cursor: 'pointer',
                    color: '#94a3b8',
                    padding: 4,
                    borderRadius: 8
                  }}
                >
                  ×
                </button>
              </div>

              <div style={{ fontSize: 14, color: '#475569' }}>
                Heads up! You have {todayEventsReminder.length} event{todayEventsReminder.length > 1 ? 's' : ''} scheduled for today.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '40vh', overflowY: 'auto' }}>
                {todayEventsReminder.map((event, idx) => {
                  // Check if event has ended
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const eventDate = event.event_date ? new Date(event.event_date) : null;
                  const isEventEnded = eventDate ? (() => {
                    const ed = new Date(eventDate);
                    ed.setHours(0, 0, 0, 0);
                    return ed < today;
                  })() : false;
                  
                  return (
                    <div
                      key={`${event.event_id || idx}-today`}
                      style={{
                        border: `1px solid ${event.color || '#10b981'}30`,
                        backgroundColor: `${event.color || '#10b981'}12`,
                        borderRadius: 12,
                        padding: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4
                      }}
                    >
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{event.title}</div>
                      {event.event_time && (
                        <div style={{ fontSize: 13, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span role="img" aria-label="clock">🕐</span>
                          <span>{event.event_time}</span>
                        </div>
                      )}
                      {event.description && (
                        <div style={{ fontSize: 13, color: '#475569' }}>{event.description}</div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: event.color || '#10b981', textTransform: 'uppercase' }}>
                          {event.event_type || 'EVENT'}
                        </div>
                        {isEventEnded && (
                          <div style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            backgroundColor: '#9ca3af',
                            color: 'white',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            ENDED
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: 10,
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    setShowTodayReminderModal(false);
                    const now = new Date();
                    setSelectedDate(now);
                    if ((calendarEvents[`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`] || []).length > 0) {
                      setShowEventModal(true);
                    }
                  }}
                >
                  View Details
                </button>
                <button
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: 10,
                    backgroundColor: '#e2e8f0',
                    color: '#1e293b',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  onClick={() => setShowTodayReminderModal(false)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Event Modal */}
        {showEventModal && selectedDate && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              backdropFilter: 'blur(4px)'
            }}
            onClick={() => setShowEventModal(false)}
          >
            <div 
              style={{
                backgroundColor: 'white',
                borderRadius: 16,
                padding: 24,
                maxWidth: 500,
                width: '90%',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                maxHeight: '80vh',
                overflow: 'auto'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </h3>
                <button 
                  onClick={() => setShowEventModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 24,
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: 0,
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                    e.currentTarget.style.color = '#1e293b';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#64748b';
                  }}
                >
                  ×
                </button>
              </div>
              
              {(() => {
                const dateKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
                const events = calendarEvents[dateKey];
                
                if (!events || events.length === 0) {
                  return (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '40px 20px',
                      color: '#64748b'
                    }}>
                      <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
                      <p style={{ margin: 0, fontSize: 16 }}>No events scheduled for this date</p>
                      <p style={{ margin: '8px 0 0 0', fontSize: 13, color: '#94a3b8' }}>Click here to add an event (feature coming soon)</p>
                    </div>
                  );
                }
                
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {events.map((event, i) => (
                      <div 
                        key={i}
                        style={{
                          padding: 16,
                          borderRadius: 12,
                          border: `2px solid ${event.color}20`,
                          backgroundColor: `${event.color}10`,
                          transition: 'all 0.2s ease',
                          cursor: 'pointer'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.transform = 'translateX(4px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.transform = 'translateX(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                        onClick={() => {
                          if (event.post_id && event.created_by?.user_id) {
                            navigate(`/profile/${event.created_by.user_id}`);
                          }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
                          <div style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: event.color,
                            marginTop: 6,
                            flexShrink: 0
                          }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ 
                              fontSize: 14, 
                              fontWeight: 600, 
                              color: '#1e293b',
                              marginBottom: 4
                            }}>
                              {event.title}
                            </div>
                            {event.event_time && (
                              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                                🕐 {event.event_time}
                              </div>
                            )}
                            {event.description && (
                              <div style={{ fontSize: 13, color: '#475569', marginBottom: 6 }}>
                                {event.description}
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <div style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 600,
                                backgroundColor: event.color,
                                color: 'white',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}>
                                {event.event_type}
                              </div>
                              {(() => {
                                // Check if the SELECTED DATE (modal date) is in the past
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                
                                const modalDate = selectedDate ? new Date(selectedDate) : null;
                                const isDateInPast = modalDate ? (() => {
                                  const md = new Date(modalDate);
                                  md.setHours(0, 0, 0, 0);
                                  return md < today;
                                })() : false;
                                
                                console.log('Modal Date Check:', {
                                  modalDate: modalDate?.toISOString(),
                                  today: today.toISOString(),
                                  isDateInPast,
                                  eventTitle: event.title,
                                  eventDate: event.event_date
                                });
                                
                                return isDateInPast ? (
                                  <div style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: 6,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    backgroundColor: '#9ca3af',
                                    color: 'white',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                  }}>
                                    ENDED
                                  </div>
                                ) : null;
                              })()}
                            </div>
                            {event.post_id && (
                              <div style={{ 
                                fontSize: 11, 
                                color: '#3b82f6', 
                                marginTop: 4,
                                fontWeight: 500 
                              }}>
                                📌 Linked to post
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;