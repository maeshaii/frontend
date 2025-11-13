import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../global/sidebar';
import { fetchTrackerResponses, fetchAlumniDetails, getInventoryItems, giveReward, getUserPoints, getRewardHistory, getEngagementPointsSettings } from '../../../services/api';
import { HiOutlineGift, HiOutlineHeart, HiOutlineChatBubbleLeft, HiOutlineArrowPath, HiOutlineArrowUturnLeft, HiOutlineCamera, HiOutlineDocumentText, HiOutlineClipboardDocumentList } from 'react-icons/hi2';

interface TrackerResponse {
  user_id: number;
  name: string;
  program?: string;
  year_graduated?: string;
  submitted_at?: string;
}

interface TrackerRewardHistory {
  id: number;
  user_id: number;
  user_name: string;
  profile_pic: string | null;
  program: string | null;
  year_graduated: number | null;
  reward_name: string;
  reward_type: string;
  reward_value: string;
  points_deducted: number;
  given_by: string;
  given_at: string;
}

interface LeaderboardEntry {
  rank: number;
  user_id: number;
  name: string;
  profile_pic: string | null;
  user_type: string;
  year_graduated?: string;
  program?: string;
  total_points: number;
  points_breakdown: {
    likes: { points: number; count: number };
    comments: { points: number; count: number };
    shares: { points: number; count: number };
    replies: { points: number; count: number };
    posts: { points: number; count: number };
    posts_with_photos: { points: number; count: number };
    tracker_form?: { points: number; count: number };
  };
  last_updated: string;
}

const TrackerResponsesPage: React.FC = () => {
  const navigate = useNavigate();
  const [trackerResponses, setTrackerResponses] = useState<TrackerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<LeaderboardEntry | null>(null);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [selectedReward, setSelectedReward] = useState<number | null>(null);
  const [trackerRewardHistory, setTrackerRewardHistory] = useState<TrackerRewardHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [tableFilter, setTableFilter] = useState<'responses' | 'history'>('responses');
  const [pointsSettings, setPointsSettings] = useState({
    enabled: true,
    like: 1,
    comment: 3,
    share: 5,
    reply: 2,
    post: 0,
    post_with_photo: 15,
    tracker_form: 0
  });

  useEffect(() => {
    fetchTrackerResponsesWithDetails();
    fetchTrackerRewardHistory();
  }, []);

  const fetchTrackerRewardHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await getRewardHistory(100, true); // Get tracker rewards only
      if (response && response.success && response.history) {
        setTrackerRewardHistory(response.history);
      } else {
        setTrackerRewardHistory([]);
      }
    } catch (error) {
      console.error('Error fetching tracker reward history:', error);
      setTrackerRewardHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchTrackerResponsesWithDetails = async () => {
    setLoading(true);
    try {
      const response = await fetchTrackerResponses();
      if (response && response.success && response.responses) {
        const currentYear = new Date().getFullYear();
        
        // Filter responses to only include those submitted in the current year
        const currentYearResponses = response.responses.filter((resp: any) => {
          if (!resp.submitted_at) return false;
          const submittedDate = new Date(resp.submitted_at);
          return submittedDate.getFullYear() === currentYear;
        });
        
        // Fetch user details to get graduation year
        const responsesWithDetails = await Promise.all(
          currentYearResponses.map(async (resp: any) => {
            try {
              const userDetails = await fetchAlumniDetails(resp.user_id);
              return {
                ...resp,
                year_graduated: userDetails?.alumni?.year_graduated || userDetails?.alumni?.batch || null,
                program: userDetails?.alumni?.program || null
              };
            } catch (error) {
              console.error(`Error fetching details for user ${resp.user_id}:`, error);
              return {
                ...resp,
                year_graduated: null,
                program: null
              };
            }
          })
        );
        setTrackerResponses(responsesWithDetails);
      } else {
        setTrackerResponses([]);
      }
    } catch (error) {
      console.error('Error fetching tracker responses:', error);
      setTrackerResponses([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchInventoryItems = async () => {
    try {
      const response = await getInventoryItems();
      if (response.success) {
        setInventoryItems(response.items || []);
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
  };

  const fetchPointsSettings = async () => {
    try {
      const response = await getEngagementPointsSettings();
      if (response && response.success && response.settings) {
        setPointsSettings({
          enabled: response.settings.enabled !== false,
          like: response.settings.like_points || 0,
          comment: response.settings.comment_points || 0,
          share: response.settings.share_points || 0,
          reply: response.settings.reply_points || 0,
          post: response.settings.post_points || 0,
          post_with_photo: response.settings.post_with_photo_points || 0,
          tracker_form: response.settings.tracker_form_points || 0
        });
      }
    } catch (error) {
      console.error('Error fetching points settings:', error);
    }
  };

  const handleAssignReward = async (resp: TrackerResponse) => {
    try {
      // Fetch both user details and points separately to ensure accuracy
      const [userDetails, userPointsData] = await Promise.all([
        fetchAlumniDetails(resp.user_id),
        getUserPoints(resp.user_id)
      ]);
      
      if (userDetails?.success && userDetails?.alumni) {
        // Use points from getUserPoints which comes directly from the database
        const totalPoints = userPointsData?.total_points ?? 0;
        const pointsBreakdown = userPointsData?.points_breakdown || {
          likes: { points: 0, count: 0 },
          comments: { points: 0, count: 0 },
          shares: { points: 0, count: 0 },
          replies: { points: 0, count: 0 },
          posts: { points: 0, count: 0 },
          posts_with_photos: { points: 0, count: 0 }
        };

        const userEntry: LeaderboardEntry = {
          rank: userPointsData?.rank || 0,
          user_id: resp.user_id,
          name: resp.name,
          profile_pic: userDetails.alumni.profile_pic,
          user_type: 'alumni',
          year_graduated: resp.year_graduated || undefined,
          program: resp.program || undefined,
          total_points: totalPoints,
          points_breakdown: pointsBreakdown,
          last_updated: new Date().toISOString()
        };
        setSelectedUser(userEntry);
        await fetchInventoryItems();
        await fetchPointsSettings();
        setShowRewardModal(true);
      } else {
        alert('Unable to fetch user details');
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
      alert('Error fetching user details');
    }
  };

  // Group responses by graduation year and format batch display
  const groupedByYear: { [key: string]: TrackerResponse[] } = {};
  trackerResponses.forEach((resp) => {
    const year = resp.year_graduated || 'Unknown';
    if (!groupedByYear[year]) {
      groupedByYear[year] = [];
    }
    groupedByYear[year].push(resp);
  });

  // Format batch display: show as range (e.g., "2024-2025" for year 2024)
  const formatBatchLabel = (year: string): string => {
    if (year === 'Unknown') return 'Unknown';
    const gradYear = parseInt(year);
    const currentYear = new Date().getFullYear();
    
    // If graduation year is the previous year (e.g., 2024 in 2025), show as "2024-2025"
    // If graduation year is older, show as "2023-2024", etc.
    if (gradYear === currentYear - 1) {
      return `${gradYear}-${currentYear}`;
    } else if (gradYear < currentYear - 1) {
      return `${gradYear}-${gradYear + 1}`;
    } else {
      // If graduation year is current year or future, show as is
      return `${gradYear}-${gradYear + 1}`;
    }
  };

  const sortedYears = Object.keys(groupedByYear).sort((a, b) => {
    if (a === 'Unknown') return 1;
    if (b === 'Unknown') return -1;
    // Sort by graduation year descending (most recent first)
    return Number(b) - Number(a);
  });

  const styles = {
    container: {
      display: 'flex',
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      backgroundColor: '#f0f4f8'
    },
    mainContent: {
      flex: 1,
      padding: '0',
      marginLeft: 'var(--sidebar-width, 220px)',
      transition: 'margin-left 0.3s ease',
      backgroundColor: '#f0f4f8'
    },
    pageHeader: {
      backgroundColor: '#b8daf0',
      padding: '32px 40px',
      marginBottom: '32px'
    },
    headerTitle: {
      fontSize: '32px',
      fontWeight: 'bold',
      margin: 0,
      color: '#1e3a5f',
      letterSpacing: '1px',
      textTransform: 'uppercase' as const
    },
    headerSubtitle: {
      fontSize: '14px',
      color: '#4a5568',
      marginTop: '8px',
      fontWeight: '400'
    },
    contentWrapper: {
      padding: '0 40px 40px 40px'
    },
    tableSection: {
      backgroundColor: 'white',
      padding: '32px',
      borderRadius: '16px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      border: '1px solid #e2e8f0'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      fontSize: '14px'
    },
    tableHeader: {
      backgroundColor: '#1e3a5f',
      position: 'sticky' as const,
      top: 0,
      zIndex: 10
    },
    tableHeaderCell: {
      padding: '18px 16px',
      textAlign: 'left' as const,
      fontSize: '13px',
      fontWeight: '700',
      color: 'white',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.8px'
    },
    tableRow: {
      borderBottom: '1px solid #f3f4f6',
      transition: 'background-color 0.2s'
    },
    tableCell: {
      padding: '16px 12px',
      color: '#374151'
    },
    batchHeader: {
      backgroundColor: '#f8fafc',
      padding: '12px 16px',
      borderBottom: '2px solid #e5e7eb',
      fontWeight: '600',
      fontSize: '16px',
      color: '#1e3a5f'
    },
    actionButton: {
      padding: '8px 16px',
      background: '#1e3a5f',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s'
    },
    modalOverlay: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1004
    },
    modalContent: {
      backgroundColor: 'white',
      padding: '32px',
      borderRadius: '16px',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
      width: '600px',
      maxWidth: '90%',
      maxHeight: '90vh',
      overflowY: 'auto' as const
    }
  };

  return (
    <div style={styles.container}>
      <Sidebar />
      <div style={styles.mainContent}>
        {/* Page Header */}
        <div style={styles.pageHeader}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={styles.headerTitle}>TRACKER RESPONDENTS</h1>
              <p style={styles.headerSubtitle}>Reward users who answered the tracker form</p>
            </div>
            <button
              onClick={() => navigate('/rewards')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'white',
                border: '2px solid #1e3a5f',
                color: '#1e3a5f',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                padding: '12px 24px',
                borderRadius: '10px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#1e3a5f';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
                e.currentTarget.style.color = '#1e3a5f';
              }}
            >
              <span style={{ fontSize: '18px' }}>←</span>
              <span>Back to Rewards</span>
            </button>
          </div>
        </div>

        {/* Content Wrapper */}
        <div style={styles.contentWrapper}>
          <div style={styles.tableSection}>
            {/* Header with Filter Buttons */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
              flexWrap: 'wrap',
              gap: '16px'
            }}>
              <div>
                <h2 style={{
                  margin: 0,
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#1e3a5f',
                  marginBottom: '4px'
                }}>
                  {tableFilter === 'responses' ? 'RESPONDENTS' : 'TRACKER REWARD HISTORY'}
                </h2>
                <p style={{
                  fontSize: '13px',
                  color: '#6b7280',
                  margin: '4px 0 0 0'
                }}>
                  {tableFilter === 'responses' 
                    ? `${trackerResponses.length} ${trackerResponses.length === 1 ? 'user' : 'users'} answered the tracker form`
                    : `${trackerRewardHistory.length} ${trackerRewardHistory.length === 1 ? 'reward' : 'rewards'} given for tracker form responses`
                  }
                </p>
              </div>
              
              {/* Filter Buttons */}
              <div style={{
                display: 'flex',
                gap: '8px',
                backgroundColor: '#f3f4f6',
                padding: '4px',
                borderRadius: '8px'
              }}>
                <button
                  onClick={() => setTableFilter('responses')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    backgroundColor: tableFilter === 'responses' ? 'white' : 'transparent',
                    color: tableFilter === 'responses' ? '#1e3a5f' : '#6b7280',
                    boxShadow: tableFilter === 'responses' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  Responses
                </button>
                <button
                  onClick={() => setTableFilter('history')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    backgroundColor: tableFilter === 'history' ? 'white' : 'transparent',
                    color: tableFilter === 'history' ? '#1e3a5f' : '#6b7280',
                    boxShadow: tableFilter === 'history' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  History
                </button>
              </div>
            </div>

            {/* Table Content */}
            {tableFilter === 'responses' ? (
              <>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
                    <div>Loading tracker responses...</div>
                  </div>
                ) : trackerResponses.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                    <div style={{ fontSize: '48px', marginBottom: '8px' }}>📋</div>
                    <div>No tracker form responses found</div>
                  </div>
                ) : (
                  <div style={{
                    maxHeight: '650px',
                    overflowY: 'auto',
                    overflowX: 'auto',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}>
                    <table style={styles.table}>
                      <thead style={styles.tableHeader}>
                        <tr>
                          <th style={{ ...styles.tableHeaderCell, width: '25%' }}>Batch</th>
                          <th style={{ ...styles.tableHeaderCell, width: '30%' }}>User</th>
                          <th style={{ ...styles.tableHeaderCell, width: '25%' }}>Program</th>
                          <th style={{ ...styles.tableHeaderCell, width: '20%', textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedYears.map((year) =>
                          groupedByYear[year].map((resp, index) => (
                            <tr
                              key={`${year}-${resp.user_id}-${index}`}
                              style={styles.tableRow}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              {index === 0 && (
                                <td
                                  rowSpan={groupedByYear[year].length}
                                  style={{
                                    ...styles.tableCell,
                                    ...styles.batchHeader,
                                    verticalAlign: 'middle'
                                  }}
                                >
                                  Batch {formatBatchLabel(year)} ({groupedByYear[year].length} {groupedByYear[year].length === 1 ? 'user' : 'users'})
                                </td>
                              )}
                              <td style={styles.tableCell}>
                                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                                  {resp.name}
                                </div>
                              </td>
                              <td style={styles.tableCell}>
                                {resp.program ? (
                                  <div style={{ fontSize: '13px', color: '#6b7280' }}>{resp.program}</div>
                                ) : (
                                  <div style={{ fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>No program</div>
                                )}
                              </td>
                              <td style={{ ...styles.tableCell, textAlign: 'center' }}>
                                <button
                                  onClick={() => handleAssignReward(resp)}
                                  style={styles.actionButton}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#2d5a8f';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#1e3a5f';
                                  }}
                                >
                                  Assign Reward
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <>
                {historyLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
                    <div>Loading reward history...</div>
                  </div>
                ) : trackerRewardHistory.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                    <div style={{ fontSize: '48px', marginBottom: '8px' }}>📜</div>
                    <div>No tracker rewards given yet</div>
                  </div>
                ) : (
                  <div style={{
                    maxHeight: '650px',
                    overflowY: 'auto',
                    overflowX: 'auto',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}>
                    <table style={styles.table}>
                      <thead style={styles.tableHeader}>
                        <tr>
                          <th style={{ ...styles.tableHeaderCell, width: '20%' }}>Date</th>
                          <th style={{ ...styles.tableHeaderCell, width: '25%' }}>User</th>
                          <th style={{ ...styles.tableHeaderCell, width: '15%' }}>Program</th>
                          <th style={{ ...styles.tableHeaderCell, width: '25%' }}>Reward</th>
                          <th style={{ ...styles.tableHeaderCell, width: '15%' }}>Given By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trackerRewardHistory.map((entry) => (
                          <tr
                            key={entry.id}
                            style={styles.tableRow}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <td style={styles.tableCell}>
                              <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                {new Date(entry.given_at).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </td>
                            <td style={styles.tableCell}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                  {entry.profile_pic ? (
                                    <img
                                      src={String(entry.profile_pic).startsWith('http') ? entry.profile_pic : `http://127.0.0.1:8000${entry.profile_pic}`}
                                      alt={entry.user_name}
                                      style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                        display: 'block'
                                      }}
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        const fallback = target.parentElement?.querySelector('.profile-pic-fallback') as HTMLElement;
                                        if (fallback) fallback.style.display = 'flex';
                                      }}
                                    />
                                  ) : null}
                                  <div
                                    className="profile-pic-fallback"
                                    style={{
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '50%',
                                      backgroundColor: '#e5e7eb',
                                      display: entry.profile_pic ? 'none' : 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '14px',
                                      fontWeight: '600',
                                      color: '#6b7280',
                                      position: entry.profile_pic ? 'absolute' : 'relative',
                                      top: entry.profile_pic ? 0 : 'auto',
                                      left: entry.profile_pic ? 0 : 'auto'
                                    }}
                                  >
                                    {entry.user_name.charAt(0).toUpperCase()}
                                  </div>
                                </div>
                                <div>
                                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                                    {entry.user_name}
                                  </div>
                                  {entry.year_graduated && (
                                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                                      Batch {entry.year_graduated}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td style={styles.tableCell}>
                              {entry.program ? (
                                <div style={{ fontSize: '13px', color: '#6b7280' }}>{entry.program}</div>
                              ) : (
                                <div style={{ fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>N/A</div>
                              )}
                            </td>
                            <td style={styles.tableCell}>
                              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e3a5f' }}>
                                {entry.reward_name}
                              </div>
                              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                                {entry.reward_type} • {entry.reward_value}
                              </div>
                            </td>
                            <td style={styles.tableCell}>
                              <div style={{ fontSize: '13px', color: '#6b7280' }}>{entry.given_by}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Reward Modal - Same as in RewardsPage */}
        {showRewardModal && selectedUser && (
          <div style={styles.modalOverlay} onClick={() => setShowRewardModal(false)}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e3a5f' }}>
                  Select Reward for {selectedUser.name}
                </h2>
                <button
                  onClick={() => {
                    setShowRewardModal(false);
                    setSelectedReward(null);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '24px',
                    color: '#6b7280',
                    padding: '4px 8px'
                  }}
                >
                  ×
                </button>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>Available Points</div>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1e3a5f' }}>
                  {selectedUser.total_points || 0}
                </div>
              </div>

              <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '24px' }}>
                {inventoryItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
                    No rewards available
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {inventoryItems.map((item) => {
                      const pointsMatch = item.value?.match(/(\d+)/);
                      const requiredPoints = pointsMatch ? parseInt(pointsMatch[1]) : 0;
                      const canAfford = (selectedUser.total_points || 0) >= requiredPoints;

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (canAfford && item.quantity > 0) {
                              setSelectedReward(item.id);
                            }
                          }}
                          style={{
                            padding: '16px',
                            border: selectedReward === item.id ? '2px solid #1e3a5f' : '1px solid #e5e7eb',
                            borderRadius: '8px',
                            cursor: canAfford && item.quantity > 0 ? 'pointer' : 'not-allowed',
                            backgroundColor: selectedReward === item.id ? '#f0f7ff' : 'white',
                            opacity: canAfford && item.quantity > 0 ? 1 : 0.5
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>
                                {item.name}
                              </div>
                              <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                {item.type} • Stock: {item.quantity}
                              </div>
                            </div>
                            <div style={{ fontSize: '16px', fontWeight: '600', color: '#dc2626' }}>
                              {item.value}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowRewardModal(false);
                    setSelectedReward(null);
                  }}
                  style={{
                    padding: '12px 24px',
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!selectedReward || !selectedUser) return;
                    
                    const reward = inventoryItems.find(item => item.id === selectedReward);
                    if (!reward) return;

                    try {
                      const response = await giveReward(selectedUser.user_id, reward.id, true); // Pass true for tracker reward
                      
                      if (response.success) {
                        const pointsDeducted = response.points_deducted || 0;
                        const remainingPoints = response.user_remaining_points || 0;
                        
                        alert(
                          `✅ ${reward.name} has been given to ${selectedUser.name}!\n\n` +
                          `🎁 This is a token of appreciation for answering the tracker form.\n` +
                          `No points were deducted.\n\n` +
                          `📢 ${selectedUser.name} will receive a notification.`
                        );
                        
                        setShowRewardModal(false);
                        setSelectedReward(null);
                        setSelectedUser(null);
                        
                        // Refresh the responses list and history
                        fetchTrackerResponsesWithDetails();
                        fetchTrackerRewardHistory();
                      } else {
                        alert(`❌ Failed to give reward: ${response.message}`);
                      }
                    } catch (error: any) {
                      console.error('Error giving reward:', error);
                      alert(`❌ Error: ${error.response?.data?.message || 'Failed to give reward'}`);
                    }
                  }}
                  disabled={!selectedReward}
                  style={{
                    padding: '12px 24px',
                    background: selectedReward ? '#1e3a5f' : '#d1d5db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: selectedReward ? 'pointer' : 'not-allowed'
                  }}
                >
                  Confirm Give Reward
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackerResponsesPage;

