import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../global/sidebar';
import { getRewardHistory } from '../../../services/api';

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

const RewardHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [rewardHistory, setRewardHistory] = useState<RewardHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyFilter, setHistoryFilter] = useState<string>('all'); // Filter by reward type: 'all', 'Voucher', 'Merchandise', etc.

  useEffect(() => {
    fetchRewardHistoryData();
    
    // Refresh reward history periodically (every 30 seconds) to catch new claims
    const historyInterval = setInterval(() => {
      fetchRewardHistoryData();
    }, 30000);
    
    return () => {
      clearInterval(historyInterval);
    };
  }, []);

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
    }
  };

  // Get unique reward types for filter buttons
  const uniqueTypes = Array.from(new Set(rewardHistory.map(e => e.reward_type))).filter(Boolean);
  
  // Filter history based on selected filter
  const filteredHistory = historyFilter === 'all' 
    ? rewardHistory 
    : rewardHistory.filter(e => e.reward_type.toLowerCase().includes(historyFilter.toLowerCase()));

  return (
    <div style={styles.container}>
      <Sidebar />
      <div style={styles.mainContent}>
        {/* Page Header */}
        <div style={styles.pageHeader}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={styles.headerTitle}>REWARD HISTORY</h1>
              <p style={styles.headerSubtitle}>
                {filteredHistory.length} {filteredHistory.length === 1 ? 'reward' : 'rewards'} {historyFilter !== 'all' ? `(${historyFilter})` : 'distributed'}
              </p>
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
              <span>Back to Rewards Dashboard</span>
            </button>
          </div>
        </div>

        {/* Content Wrapper */}
        <div style={styles.contentWrapper}>
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
            <>
              {/* Filter Dropdown */}
              <div style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '20px',
                alignItems: 'center'
              }}>
                <label style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginRight: '8px'
                }}>
                  Filter by Type:
                </label>
                <select
                  value={historyFilter}
                  onChange={(e) => setHistoryFilter(e.target.value)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '2px solid #e5e7eb',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    backgroundColor: 'white',
                    color: '#1f2937',
                    transition: 'all 0.2s',
                    minWidth: '200px',
                    outline: 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#1e3a5f';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#1e3a5f';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(30, 58, 95, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <option value="all">All ({rewardHistory.length})</option>
                  {uniqueTypes.map(type => (
                    <option key={type} value={type}>
                      {type} ({rewardHistory.filter(e => e.reward_type === type).length})
                    </option>
                  ))}
                </select>
              </div>

              {/* Table Container */}
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}>
                {filteredHistory.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '60px 40px',
                    color: '#6b7280'
                  }}>
                    <div style={{ fontSize: '16px', fontWeight: '500' }}>
                      No {historyFilter !== 'all' ? historyFilter : ''} rewards found
                    </div>
                  </div>
                ) : (
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse'
                  }}>
                    <thead>
                      <tr style={{
                        backgroundColor: '#f9fafb',
                        borderBottom: '2px solid #e5e7eb'
                      }}>
                        <th style={{
                          padding: '14px 16px',
                          textAlign: 'left',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>User</th>
                        <th style={{
                          padding: '14px 16px',
                          textAlign: 'left',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>Reward</th>
                        <th style={{
                          padding: '14px 16px',
                          textAlign: 'left',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>Type</th>
                        <th style={{
                          padding: '14px 16px',
                          textAlign: 'left',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>Value</th>
                        <th style={{
                          padding: '14px 16px',
                          textAlign: 'center',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>Points</th>
                        <th style={{
                          padding: '14px 16px',
                          textAlign: 'left',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>Given By</th>
                        <th style={{
                          padding: '14px 16px',
                          textAlign: 'left',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistory.map((entry, index) => (
                        <tr
                          key={entry.id}
                          style={{
                            borderBottom: index < filteredHistory.length - 1 ? '1px solid #f3f4f6' : 'none',
                            transition: 'background-color 0.15s',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f9fafb';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'white';
                          }}
                        >
                          {/* User Column */}
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              {entry.profile_pic ? (
                                <img 
                                  src={
                                    String(entry.profile_pic).startsWith('http') 
                                      ? entry.profile_pic 
                                      : `http://127.0.0.1:8000${entry.profile_pic}`
                                  }
                                  alt={entry.user_name}
                                  style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    border: '2px solid #e5e7eb'
                                  }}
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    // Show fallback avatar
                                    const parent = target.parentElement;
                                    if (parent) {
                                      const fallback = parent.querySelector('.profile-pic-fallback') as HTMLElement;
                                      if (fallback) {
                                        fallback.style.display = 'flex';
                                      }
                                    }
                                  }}
                                />
                              ) : null}
                              <div 
                                className="profile-pic-fallback"
                                style={{
                                  width: '40px',
                                  height: '40px',
                                  borderRadius: '50%',
                                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                  display: entry.profile_pic ? 'none' : 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '16px',
                                  fontWeight: 'bold',
                                  color: 'white',
                                  border: '2px solid #e5e7eb'
                                }}
                              >
                                {entry.user_name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{
                                  fontSize: '14px',
                                  fontWeight: '600',
                                  color: '#1f2937',
                                  marginBottom: '2px'
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
                          </td>
                          
                          {/* Reward Name Column */}
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#1e3a5f'
                            }}>
                              {entry.reward_name}
                            </div>
                          </td>
                          
                          {/* Type Column */}
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{
                              backgroundColor: '#dbeafe',
                              color: '#1e40af',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}>
                              {entry.reward_type}
                            </span>
                          </td>
                          
                          {/* Value Column */}
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#1f2937'
                            }}>
                              {entry.reward_value}
                            </div>
                          </td>
                          
                          {/* Points Column */}
                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            <div style={{
                              fontSize: '16px',
                              fontWeight: '700',
                              color: '#dc2626'
                            }}>
                              -{entry.points_deducted}
                            </div>
                          </td>
                          
                          {/* Given By Column */}
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{
                              fontSize: '13px',
                              color: '#4b5563'
                            }}>
                              {entry.given_by}
                            </div>
                          </td>
                          
                          {/* Date Column */}
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{
                              fontSize: '13px',
                              color: '#6b7280'
                            }}>
                              {new Date(entry.given_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RewardHistoryPage;

