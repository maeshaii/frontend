import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../global/sidebar';
import { getEngagementLeaderboard, getInventoryItems, giveReward, getRewardHistory } from '../../../services/api';

interface LeaderboardEntry {
  rank: number;
  user_id: number;
  name: string;
  profile_pic: string | null;
  user_type: string;
  year_graduated: number | null;
  program: string | null;
  total_points: number;
  points_breakdown: {
    likes: { points: number; count: number };
    comments: { points: number; count: number };
    shares: { points: number; count: number };
    replies: { points: number; count: number };
    posts_with_photos: { points: number; count: number };
  };
  last_updated: string;
}

interface InventoryItem {
  id: number;
  name: string;
  type: string;
  quantity: number;
  value: string;
  created_at: string;
  updated_at: string;
}

interface RewardHistoryEntry {
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

const RewardsPage: React.FC = () => {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'alumni'>('alumni');  // Only Alumni now
  const [selectedUser, setSelectedUser] = useState<LeaderboardEntry | null>(null);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [selectedReward, setSelectedReward] = useState<number | null>(null);
  const [rewardHistory, setRewardHistory] = useState<RewardHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  useEffect(() => {
    fetchLeaderboardData();
    fetchRewardHistoryData();
  }, [filter]);

  const fetchLeaderboardData = async () => {
    setLoading(true);
    try {
      const data = await getEngagementLeaderboard(50, filter);
      setLeaderboard(data.leaderboard || []);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRewardHistoryData = async () => {
    setHistoryLoading(true);
    try {
      const data = await getRewardHistory(50);
      setRewardHistory(data.history || []);
    } catch (error) {
      console.error('Error fetching reward history:', error);
      setRewardHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleGiveRewardClick = async () => {
    if (!selectedUser) return;
    
    try {
      const response = await getInventoryItems();
      if (response.success) {
        // Filter items that have stock available AND user can afford
        const availableItems = response.items.filter((item: InventoryItem) => {
          if (item.quantity <= 0) return false;
          
          // Extract numeric value from value string (e.g., "100pts" -> 100)
          const pointsMatch = item.value.match(/(\d+)/);
          if (pointsMatch) {
            const requiredPoints = parseInt(pointsMatch[1]);
            return selectedUser.total_points >= requiredPoints;
          }
          
          // If we can't parse points, include the item
          return true;
        });
        
        setInventoryItems(availableItems);
        setShowRewardModal(true);
      } else {
        alert('Failed to load inventory items');
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
      alert('Failed to load inventory items');
    }
  };

  const handleGiveReward = async () => {
    if (!selectedReward || !selectedUser) return;

    const reward = inventoryItems.find(item => item.id === selectedReward);
    if (!reward) return;

    try {
      const response = await giveReward(selectedUser.user_id, reward.id);
      
      if (response.success) {
        const pointsDeducted = response.points_deducted || 0;
        const remainingPoints = response.user_remaining_points || 0;
        
        alert(
          `✅ ${reward.name} has been given to ${selectedUser.name}!\n\n` +
          `💰 Points Deducted: ${pointsDeducted}\n` +
          `💎 Remaining Points: ${remainingPoints}\n\n` +
          `📢 ${selectedUser.name} will receive a notification.`
        );
        
        // Close modals
        setShowRewardModal(false);
        setSelectedReward(null);
        setSelectedUser(null);
        
        // Refresh leaderboard and reward history
        fetchLeaderboardData();
        fetchRewardHistoryData();
      } else {
        alert(`❌ Failed to give reward: ${response.message}`);
      }
    } catch (error: any) {
      console.error('Error giving reward:', error);
      alert(`❌ Error: ${error.response?.data?.message || 'Failed to give reward'}`);
    }
  };

  // Sample data - in a real app, this would come from an API
  const rewardProgress = { current: 1, total: 10 };

  const rewardList = [
    { id: 1, recipient: 'John Doe', type: 'Gift Card', status: 'Email Use Available', initials: 'GC' },
    { id: 2, recipient: 'Bob Smith', type: 'Bonus Points', status: 'Free Lunch', initials: 'BP' },
    { id: 3, recipient: 'Alice Johnson', type: 'Free Lunch', status: 'Email Pending', initials: 'FL' },
    { id: 4, recipient: 'Mike Wilson', type: 'Certificate', status: 'Unanitza Logistics', initials: 'JJ' },
    { id: 5, recipient: 'Sarah Brown', type: 'Gift Card', status: 'Email Mfmt Cordova', initials: 'MA' },
    { id: 6, recipient: 'Tom Davis', type: 'Bonus Points', status: 'Email Small', initials: 'KB' },
    { id: 7, recipient: 'George Litz', type: 'Gift Card', status: 'Email Use Available', initials: 'GL' }
  ];

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
      textTransform: 'uppercase' as const,
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
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
    contentGrid: {
      display: 'grid',
      gridTemplateColumns: '320px 1fr',
      gap: '32px'
    },
    leftPanel: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '24px'
    },
    historyCard: {
      backgroundColor: 'white',
      padding: '24px',
      borderRadius: '16px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      border: '1px solid #e2e8f0',
      overflow: 'hidden',
      transition: 'all 0.2s'
    },
    historyTitle: {
      fontSize: '18px',
      fontWeight: '700',
      color: '#1e3a5f',
      margin: '0 0 6px 0',
      letterSpacing: '0.5px'
    },
    historySubtitle: {
      fontSize: '13px',
      color: '#6b7280',
      margin: '0 0 16px 0',
      fontWeight: '400'
    },
    historyList: {
      maxHeight: '500px',
      overflowY: 'auto' as const,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '12px'
    },
    historyItem: {
      padding: '12px',
      backgroundColor: '#fafbfc',
      borderRadius: '10px',
      border: '1px solid #e5e7eb',
      transition: 'all 0.2s'
    },
    inventoryCard: {
      backgroundColor: 'white',
      padding: '32px 28px',
      borderRadius: '16px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      flex: 1,
      cursor: 'pointer',
      transition: 'all 0.2s',
      textAlign: 'center' as const,
      border: '2px solid transparent'
    },
    inventoryTitle: {
      fontSize: '20px',
      fontWeight: '700',
      color: '#1e3a5f',
      margin: '0 0 8px 0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      letterSpacing: '0.5px'
    },
    inventorySubtitle: {
      fontSize: '14px',
      color: '#6b7280',
      margin: 0,
      fontWeight: '400'
    },
    inventoryTable: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      fontSize: '13px'
    },
    tableHeader: {
      backgroundColor: '#f9fafb',
      borderBottom: '2px solid #e5e7eb'
    },
    tableHeaderCell: {
      padding: '12px 8px',
      textAlign: 'left' as const,
      fontSize: '12px',
      fontWeight: '600',
      color: '#6b7280',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px'
    },
    tableRow: {
      borderBottom: '1px solid #f3f4f6',
      transition: 'background-color 0.2s'
    },
    tableCell: {
      padding: '12px 8px',
      color: '#374151'
    },
    itemIcon: {
      fontSize: '20px',
      display: 'inline-block',
      marginRight: '8px'
    },
    itemName: {
      fontWeight: '500',
      color: '#1f2937'
    },
    quantityBadge: {
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '600',
      backgroundColor: '#dbeafe',
      color: '#1e40af'
    },
    lowStockBadge: {
      backgroundColor: '#fee2e2',
      color: '#991b1b'
    },
    rightPanel: {
      backgroundColor: 'white',
      padding: '32px',
      borderRadius: '16px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      border: '1px solid #e2e8f0',
      overflow: 'hidden'
    },
    rightPanelTitle: {
      fontSize: '24px',
      fontWeight: '700',
      color: '#1e3a5f',
      margin: '0 0 8px 0',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      letterSpacing: '0.5px'
    },
    rightPanelSubtitle: {
      fontSize: '14px',
      color: '#6b7280',
      margin: '0 0 28px 0',
      fontWeight: '400'
    },
    rewardList: {
      maxHeight: 'calc(100vh - 200px)',
      overflowY: 'auto' as const
    },
    rewardItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '16px 0',
      borderBottom: '1px solid #f3f4f6'
    },
    rewardType: {
      fontSize: '14px',
      fontWeight: '500',
      color: '#374151',
      margin: '0 0 4px 0'
    },
    rewardStatus: {
      fontSize: '12px',
      color: '#6b7280',
      margin: 0
    }
  };

  return (
    <div style={styles.container}>
      <Sidebar />
      <div style={styles.mainContent}>
        {/* Page Header */}
        <div style={styles.pageHeader}>
          <h1 style={styles.headerTitle}>
            REWARDS DASHBOARD
          </h1>
          <p style={styles.headerSubtitle}>Manage alumni engagement rewards and leaderboard</p>
        </div>

        {/* Content Wrapper */}
        <div style={styles.contentWrapper}>
          <div style={styles.contentGrid}>
            {/* Left Panel */}
            <div style={styles.leftPanel}>
            {/* Reward History Card */}
            <div 
              style={{...styles.historyCard, cursor: 'pointer'}}
              onClick={() => setShowHistoryModal(true)}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.12)';
                e.currentTarget.style.borderColor = '#1e3a5f';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <h3 style={styles.historyTitle}>REWARD HISTORY</h3>
              <p style={styles.historySubtitle}>Recent rewards given to users</p>
              
              <div style={styles.historyList}>
                {historyLoading ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
                    <div style={{ fontSize: '13px' }}>Loading...</div>
                  </div>
                ) : rewardHistory.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎁</div>
                    <div style={{ fontSize: '13px' }}>No rewards given yet</div>
                    <div style={{ fontSize: '12px', marginTop: '8px', color: '#9ca3af' }}>Click to view history</div>
                  </div>
                ) : (
                  <>
                  {rewardHistory.slice(0, 3).map((entry) => (
                    <div key={entry.id} style={styles.historyItem}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {entry.profile_pic ? (
                          <img 
                            src={entry.profile_pic} 
                            alt={entry.user_name}
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              objectFit: 'cover'
                            }}
                          />
                        ) : (
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            backgroundColor: '#e5e7eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            color: '#6b7280'
                          }}>
                            {entry.user_name.charAt(0)}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '13px',
                            fontWeight: '600',
                            color: '#1f2937',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {entry.user_name}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: '#6b7280',
                            marginTop: '2px'
                          }}>
                            {entry.program ? `${entry.program} • ${entry.year_graduated}` : 'Alumni'}
                          </div>
                        </div>
                      </div>
                      <div style={{
                        marginTop: '8px',
                        padding: '8px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '6px'
                      }}>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#1e3a5f',
                          marginBottom: '4px'
                        }}>
                          {entry.reward_name}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: '#6b7280',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span>{entry.reward_type}</span>
                          <span style={{ fontWeight: '600', color: '#dc2626' }}>
                            -{entry.points_deducted} pts
                          </span>
                        </div>
                      </div>
                      <div style={{
                        fontSize: '10px',
                        color: '#9ca3af',
                        marginTop: '6px',
                        textAlign: 'right'
                      }}>
                        {new Date(entry.given_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  ))}
                  {rewardHistory.length > 3 && (
                    <div style={{
                      textAlign: 'center',
                      marginTop: '12px',
                      padding: '8px',
                      fontSize: '12px',
                      color: '#1e3a5f',
                      fontWeight: '600'
                    }}>
                      Click to view all {rewardHistory.length} rewards
                    </div>
                  )}
                  </>
                )}
              </div>
            </div>

            {/* Inventory - Clickable Card */}
            <div 
              style={styles.inventoryCard}
              onClick={() => navigate('/inventory')}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.12)';
                e.currentTarget.style.borderColor = '#1e3a5f';
                e.currentTarget.style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                e.currentTarget.style.borderColor = 'transparent';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <h3 style={styles.inventoryTitle}>INVENTORY</h3>
              <p style={styles.inventorySubtitle}>View and manage reward items</p>
              <div style={{ 
                marginTop: '20px', 
                fontSize: '32px', 
                fontWeight: 'bold', 
                color: '#1e3a5f' 
              }}>
                -
              </div>
              <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                Click to manage
              </div>
            </div>
          </div>

          {/* Right Panel - Leaderboard */}
          <div style={styles.rightPanel}>
            <div style={{ marginBottom: '28px' }}>
              <h2 style={styles.rightPanelTitle}>
                ALUMNI ENGAGEMENT LEADERBOARD
              </h2>
              <p style={styles.rightPanelSubtitle}>Top alumni contributors ranked by engagement points</p>
            </div>
            
            <div style={styles.rewardList}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  <div style={{ fontSize: '32px', marginBottom: '16px' }}>⏳</div>
                  <div>Loading leaderboard...</div>
                </div>
              ) : leaderboard.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎯</div>
                  <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>No data yet</div>
                  <div style={{ fontSize: '14px' }}>Start engaging to appear on the leaderboard!</div>
                </div>
              ) : (
                leaderboard.map((entry, index) => (
                  <div
                    key={entry.user_id}
                    style={{
                      ...styles.rewardItem,
                      cursor: 'pointer',
                      backgroundColor: index === 0 ? '#fff7ed' : index === 1 ? '#f0f9ff' : index === 2 ? '#fef3c7' : 'transparent',
                      padding: '16px',
                      marginBottom: '8px',
                      borderRadius: '12px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                    onClick={() => setSelectedUser(entry)}
                  >
                    {/* Rank Badge */}
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                      fontWeight: 'bold',
                      background: index === 0 ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' : 
                                  index === 1 ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)' :
                                  index === 2 ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' :
                                  '#e5e7eb',
                      color: index < 3 ? 'white' : '#6b7280',
                      boxShadow: index < 3 ? '0 4px 6px rgba(0,0,0,0.1)' : 'none'
                    }}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${entry.rank}`}
                    </div>

                    {/* User Info */}
                    <div style={{ flex: 1, marginLeft: '16px' }}>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1f2937',
                        marginBottom: '4px'
                      }}>
                        {entry.name}
                      </div>
                      <div style={{
                        fontSize: '13px',
                        color: '#6b7280',
                        marginBottom: '4px'
                      }}>
                        {entry.user_type} • {entry.program || 'No Program'} • {entry.year_graduated || 'N/A'}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#9ca3af',
                        display: 'flex',
                        gap: '12px',
                        flexWrap: 'wrap'
                      }}>
                        <span>👍 {entry.points_breakdown.likes.count}</span>
                        <span>💬 {entry.points_breakdown.comments.count}</span>
                        <span>🔄 {entry.points_breakdown.shares.count}</span>
                        <span>↩️ {entry.points_breakdown.replies.count}</span>
                        <span>📸 {entry.points_breakdown.posts_with_photos.count}</span>
                      </div>
                    </div>

                    {/* Points */}
                    <div style={{
                      textAlign: 'right',
                      marginLeft: '16px'
                    }}>
                      <div style={{
                        fontSize: '28px',
                        fontWeight: 'bold',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                      }}>
                        {entry.total_points}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#9ca3af',
                        fontWeight: '500'
                      }}>
                        points
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          </div>
        </div>

        {/* User Detail Modal */}
        {selectedUser && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setSelectedUser(null)}
          >
            <div style={{
              backgroundColor: 'white',
              padding: '32px',
              borderRadius: '16px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              width: '600px',
              maxWidth: '90%'
            }}
            onClick={(e) => e.stopPropagation()}
            >
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{
                  fontSize: '48px',
                  fontWeight: 'bold',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  marginBottom: '8px'
                }}>
                  {selectedUser.total_points}
                </div>
                <h2 style={{ margin: '0 0 8px 0', color: '#1f2937', fontSize: '24px', fontWeight: '600' }}>
                  {selectedUser.name}
                </h2>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
                  Rank #{selectedUser.rank} • {selectedUser.user_type}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                {/* Likes */}
                <div style={{
                  background: '#f0f9ff',
                  padding: '16px',
                  borderRadius: '12px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>👍</div>
                  <div style={{ fontSize: '24px', fontWeight: '600', color: '#0369a1', marginBottom: '4px' }}>
                    {selectedUser.points_breakdown.likes.count}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Likes</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#667eea' }}>
                    +{selectedUser.points_breakdown.likes.points} pts
                  </div>
                </div>

                {/* Comments */}
                <div style={{
                  background: '#f0fdf4',
                  padding: '16px',
                  borderRadius: '12px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
                  <div style={{ fontSize: '24px', fontWeight: '600', color: '#065f46', marginBottom: '4px' }}>
                    {selectedUser.points_breakdown.comments.count}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Comments</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#667eea' }}>
                    +{selectedUser.points_breakdown.comments.points} pts
                  </div>
                </div>

                {/* Shares */}
                <div style={{
                  background: '#fef3c7',
                  padding: '16px',
                  borderRadius: '12px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔄</div>
                  <div style={{ fontSize: '24px', fontWeight: '600', color: '#92400e', marginBottom: '4px' }}>
                    {selectedUser.points_breakdown.shares.count}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Shares</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#667eea' }}>
                    +{selectedUser.points_breakdown.shares.points} pts
                  </div>
                </div>

                {/* Replies */}
                <div style={{
                  background: '#fce7f3',
                  padding: '16px',
                  borderRadius: '12px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>↩️</div>
                  <div style={{ fontSize: '24px', fontWeight: '600', color: '#831843', marginBottom: '4px' }}>
                    {selectedUser.points_breakdown.replies.count}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Replies</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#667eea' }}>
                    +{selectedUser.points_breakdown.replies.points} pts
                  </div>
                </div>

                {/* Posts with Photos */}
                <div style={{
                  background: '#ede9fe',
                  padding: '16px',
                  borderRadius: '12px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📸</div>
                  <div style={{ fontSize: '24px', fontWeight: '600', color: '#5b21b6', marginBottom: '4px' }}>
                    {selectedUser.points_breakdown.posts_with_photos.count}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Posts with Photos</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#667eea' }}>
                    +{selectedUser.points_breakdown.posts_with_photos.points} pts
                  </div>
                </div>

                {/* Tracker Form */}
                {(selectedUser.points_breakdown as any).tracker_form && (
                  <div style={{
                    background: '#fef3c7',
                    padding: '16px',
                    borderRadius: '12px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📝</div>
                    <div style={{ fontSize: '24px', fontWeight: '600', color: '#92400e', marginBottom: '4px' }}>
                      {(selectedUser.points_breakdown as any).tracker_form.count}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Tracker Form</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#667eea' }}>
                      +{(selectedUser.points_breakdown as any).tracker_form.points} pts
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button
                  onClick={handleGiveRewardClick}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'transform 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  🎁 Give Reward
                </button>
                <button
                  onClick={() => setSelectedUser(null)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Give Reward Modal */}
        {showRewardModal && selectedUser && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
          }}
          onClick={() => setShowRewardModal(false)}
          >
            <div style={{
              backgroundColor: 'white',
              padding: '32px',
              borderRadius: '16px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              width: '600px',
              maxWidth: '90%'
            }}
            onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ 
                margin: '0 0 24px 0', 
                color: '#1f2937', 
                fontSize: '24px', 
                fontWeight: '600',
                textAlign: 'center'
              }}>
                🎁 Select Reward for {selectedUser.name}
              </h2>

              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '16px',
                borderRadius: '12px',
                marginBottom: '24px',
                textAlign: 'center'
              }}>
                <div style={{ color: 'white', fontSize: '14px', marginBottom: '4px' }}>
                  Available Points
                </div>
                <div style={{ color: 'white', fontSize: '32px', fontWeight: 'bold' }}>
                  {selectedUser.total_points}
                </div>
              </div>

              {inventoryItems.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  background: '#f9fafb',
                  borderRadius: '12px',
                  marginBottom: '24px'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>😔</div>
                  <div style={{ fontSize: '16px', fontWeight: '500', color: '#6b7280', marginBottom: '8px' }}>
                    No rewards available
                  </div>
                  <div style={{ fontSize: '14px', color: '#9ca3af' }}>
                    User doesn't have enough points or no items in stock
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                    Select a reward:
                  </div>
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {inventoryItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setSelectedReward(item.id)}
                        style={{
                          padding: '16px',
                          border: selectedReward === item.id ? '2px solid #667eea' : '2px solid #e5e7eb',
                          borderRadius: '12px',
                          marginBottom: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          background: selectedReward === item.id ? '#f0f9ff' : 'white'
                        }}
                        onMouseEnter={(e) => {
                          if (selectedReward !== item.id) {
                            e.currentTarget.style.borderColor = '#cbd5e1';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedReward !== item.id) {
                            e.currentTarget.style.borderColor = '#e5e7eb';
                          }
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>
                              {item.name}
                            </div>
                            <div style={{ fontSize: '13px', color: '#6b7280' }}>
                              {item.type} • Stock: {item.quantity}
                            </div>
                          </div>
                          <div style={{
                            fontSize: '18px',
                            fontWeight: 'bold',
                            color: '#667eea',
                            marginLeft: '16px'
                          }}>
                            {item.value}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => {
                    setShowRewardModal(false);
                    setSelectedReward(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4b5563'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6b7280'}
                >
                  Cancel
                </button>
                <button
                  onClick={handleGiveReward}
                  disabled={!selectedReward || inventoryItems.length === 0}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: selectedReward && inventoryItems.length > 0 
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                      : '#d1d5db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: selectedReward && inventoryItems.length > 0 ? 'pointer' : 'not-allowed',
                    transition: 'transform 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedReward && inventoryItems.length > 0) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  Confirm Give Reward
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reward History Modal */}
        {showHistoryModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setShowHistoryModal(false)}
          >
            <div style={{
              backgroundColor: 'white',
              padding: '0',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '1000px',
              maxHeight: '85vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{
                background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8f 100%)',
                padding: '28px 32px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '3px solid #fbbf24'
              }}>
                <div>
                  <h2 style={{
                    fontSize: '28px',
                    fontWeight: '700',
                    color: 'white',
                    margin: '0 0 8px 0',
                    letterSpacing: '0.5px'
                  }}>
                    Reward History
                  </h2>
                  <p style={{
                    fontSize: '14px',
                    color: '#b8daf0',
                    margin: 0
                  }}>
                    {rewardHistory.length} {rewardHistory.length === 1 ? 'reward' : 'rewards'} distributed
                  </p>
                </div>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    fontSize: '20px',
                    cursor: 'pointer',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.25)';
                    e.currentTarget.style.transform = 'rotate(90deg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.transform = 'rotate(0deg)';
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div style={{
                overflowY: 'auto',
                flex: 1,
                backgroundColor: '#f8fafc',
                padding: '24px 32px'
              }}>
                {historyLoading ? (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '60px 40px',
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    border: '2px dashed #e5e7eb'
                  }}>
                    <div style={{
                      fontSize: '16px',
                      color: '#6b7280',
                      fontWeight: '500'
                    }}>Loading reward history...</div>
                  </div>
                ) : rewardHistory.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '80px 40px',
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    border: '2px dashed #e5e7eb'
                  }}>
                    <div style={{ 
                      fontSize: '18px', 
                      fontWeight: '600', 
                      marginBottom: '8px',
                      color: '#1f2937'
                    }}>No rewards given yet</div>
                    <div style={{ 
                      fontSize: '14px',
                      color: '#6b7280',
                      maxWidth: '400px',
                      margin: '0 auto'
                    }}>
                      Start rewarding your top contributors! Rewards will appear here once you distribute them.
                    </div>
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gap: '12px'
                  }}>
                    {rewardHistory.map((entry, index) => (
                      <div key={entry.id} style={{
                        padding: '0',
                        backgroundColor: 'white',
                        borderRadius: '16px',
                        border: '1px solid #e5e7eb',
                        overflow: 'hidden',
                        transition: 'all 0.2s',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.12)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                      >
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'auto 1fr auto',
                          gap: '20px',
                          alignItems: 'center',
                          padding: '20px 24px'
                        }}>
                          {/* User Profile */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ position: 'relative' }}>
                              {entry.profile_pic ? (
                                <img 
                                  src={entry.profile_pic} 
                                  alt={entry.user_name}
                                  style={{
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    border: '3px solid #1e3a5f'
                                  }}
                                />
                              ) : (
                                <div style={{
                                  width: '56px',
                                  height: '56px',
                                  borderRadius: '50%',
                                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '22px',
                                  fontWeight: 'bold',
                                  color: 'white',
                                  border: '3px solid #1e3a5f'
                                }}>
                                  {entry.user_name.charAt(0)}
                                </div>
                              )}
                            </div>
                            <div>
                              <div style={{
                                fontSize: '16px',
                                fontWeight: '700',
                                color: '#1f2937',
                                marginBottom: '4px'
                              }}>
                                {entry.user_name}
                              </div>
                              <div style={{
                                fontSize: '12px',
                                color: '#6b7280'
                              }}>
                                {entry.program ? `${entry.program} • ${entry.year_graduated}` : 'Alumni'}
                              </div>
                            </div>
                          </div>

                          {/* Reward Details */}
                          <div style={{
                            backgroundColor: '#f8fafc',
                            padding: '14px 16px',
                            borderRadius: '12px',
                            border: '1px solid #e5e7eb'
                          }}>
                            <div style={{
                              fontSize: '15px',
                              fontWeight: '700',
                              color: '#1e3a5f',
                              marginBottom: '6px'
                            }}>
                              {entry.reward_name}
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#6b7280',
                              marginBottom: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <span style={{
                                backgroundColor: '#dbeafe',
                                color: '#1e40af',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '600'
                              }}>
                                {entry.reward_type}
                              </span>
                              <span>•</span>
                              <span style={{ fontWeight: '600' }}>{entry.reward_value}</span>
                            </div>
                            <div style={{
                              fontSize: '11px',
                              color: '#9ca3af'
                            }}>
                              <span>Given by <strong>{entry.given_by}</strong></span>
                              <span> • </span>
                              <span>{new Date(entry.given_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}</span>
                            </div>
                          </div>

                          {/* Points Deducted */}
                          <div style={{
                            textAlign: 'center',
                            backgroundColor: '#fee2e2',
                            padding: '12px 20px',
                            borderRadius: '12px',
                            minWidth: '100px'
                          }}>
                            <div style={{
                              fontSize: '24px',
                              fontWeight: '800',
                              color: '#dc2626',
                              lineHeight: '1',
                              marginBottom: '4px'
                            }}>
                              -{entry.points_deducted}
                            </div>
                            <div style={{
                              fontSize: '11px',
                              color: '#991b1b',
                              fontWeight: '600',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Points
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default RewardsPage;

