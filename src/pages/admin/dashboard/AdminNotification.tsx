import React, { useEffect, useState } from 'react';
import { fetchNotifications, api } from '../../../services/api';
import { useNavigate } from 'react-router-dom';
import AlumniTopBar from '../../alumni/AlumniTopBar';
import { useRealTimeNotifications } from '../../../hooks/useRealTimeNotifications';
import ctulogo from '../../../images/ctulogo.png';

// Simple in-memory cache to prevent refetch/flicker of profile pics
const profilePicCache: { [userId: string]: string } = {};

const AdminNotificationPage: React.FC = () => {
  // Use real-time notifications hook
  const { 
    notifications: realTimeNotifications, 
    isLoading, 
    error,
    refreshNotifications,
    markAsRead: markAsReadRealTime
  } = useRealTimeNotifications({
    enablePolling: true,
    pollingInterval: 30000,
    autoConnect: true
  });

  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [openNotif, setOpenNotif] = useState<any | null>(null);
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [postModalData, setPostModalData] = useState<any | null>(null);
  const [postModalLoading, setPostModalLoading] = useState(false);
  const [postModalError, setPostModalError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    sessionStorage.removeItem('userManagementVerified');
    navigate('/login');
  };

  //   const handleDelete = async () => {
  //     if (selected.length === 0) return;
  //     const result = await deleteNotifications(selected);
  //     if (result.success) {
  //       setNotifications(notifications.filter(n => !selected.includes(n.id)));
  //       setSelected([]);
  //     } else {
  //       alert('Failed to delete notifications.');
  //     }
  //   };

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      navigate('/login');
      return;
    }
  }, [navigate]);

  // Use real-time notifications instead of manual fetching
  const filteredNotifications = realTimeNotifications.filter((n: any) =>
    (n.content || '').toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (id: number) => {
    setSelected((sel) => (sel.includes(id) ? sel.filter((i) => i !== id) : [...sel, id]));
  };

  const selectAll = () => {
    if (selected.length === filteredNotifications.length) {
      setSelected([]);
    } else {
      setSelected(filteredNotifications.map((n) => n.id));
    }
  };

  const ProfilePicComponent = ({ userId, userName, size = '40px' }: { userId?: string, userName?: string, size?: string }) => {
    const [profilePicUrl, setProfilePicUrl] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [imgLoaded, setImgLoaded] = React.useState(false);

    React.useEffect(() => {
      let mounted = true;
      const loadProfilePic = async () => {
        try {
          if (!userId) {
            setIsLoading(false);
            return;
          }
          // Show cached immediately if present to avoid flicker, but still refresh in background
          const cached = profilePicCache[userId];
          if (cached && mounted) {
            setProfilePicUrl(cached);
            setIsLoading(false);
          }
          // Always fetch latest profile pic
          const response = await api.get(`alumni/profile/${userId}/`);
          const raw = response?.data?.profile_pic as string | undefined;
          const baseUrl = raw ? (raw.startsWith('http') ? raw : `http://127.0.0.1:8000${raw}`) : '';
          if (!baseUrl) {
            return;
          }
          // Add cache-busting query to ensure we show the current picture
          const resolvedUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}cb=${Date.now()}`;
          // Preload image before swapping
          await new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = resolvedUrl;
          });
          if (!mounted) return;
          profilePicCache[userId] = resolvedUrl;
          setProfilePicUrl(resolvedUrl);
        } catch {
          // ignore; cached/fallback will be used
        } finally {
          if (mounted) setIsLoading(false);
        }
      };
      loadProfilePic();
      return () => { mounted = false; };
    }, [userId]);

    const displaySrc = profilePicUrl || ctulogo;
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', background: '#eef2f7' }}>
        <img
          src={displaySrc}
          alt={userName || 'User'}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '50%',
            transition: 'opacity 150ms ease',
            opacity: imgLoaded ? 1 : 0
          }}
          onLoad={() => setImgLoaded(true)}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = ctulogo;
            setImgLoaded(true);
          }}
        />
      </div>
    );
  };

  function renderMessageWithButton(message: string) {
    const trackerLinkMatch = message.match(/href=['"]([^'"]*\/alumni\/tracker\?user_id=\d+)['"]/);
    const trackerLink = trackerLinkMatch ? trackerLinkMatch[1] : null;
    if (trackerLink) {
      const parts = message.split(/<a [^>]*>.*Tracker Form.*<\/a>/);
      return (
        <>
          {parts[0]}
          <br />
          <button
            style={{
              background: '#1e4c7a',
              color: '#fff',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '1rem',
              margin: '12px 0',
            }}
            onClick={() => (window.location.href = trackerLink)}
          >
            📒 Tracker Form
          </button>
          {parts[1]}
        </>
      );
    }
    return <span style={{ whiteSpace: 'pre-line' }}>{message}</span>;
  }

  const extractOriginalIds = (content: string) => {
    const postIdMatch = content.match(/<!--POST_ID:(\d+)-->/);
    const repostIdMatch = content.match(/<!--REPOST_ID:(\d+)-->/);
    const forumIdMatch = content.match(/<!--FORUM_ID:(\d+)-->/);
    const donationIdMatch = content.match(/<!--DONATION_ID:(\d+)-->/);
    return {
      postId: postIdMatch ? postIdMatch[1] : null,
      repostId: repostIdMatch ? repostIdMatch[1] : null,
      forumId: forumIdMatch ? forumIdMatch[1] : null,
      donationId: donationIdMatch ? donationIdMatch[1] : null,
    };
  };

  const openOriginalPost = async (content: string) => {
    const { postId, repostId, forumId, donationId } = extractOriginalIds(content);
    // Only handle regular posts here; forum/donation can be handled separately if needed
    const targetId = postId || repostId;
    if (!targetId) return;
    try {
      setPostModalLoading(true);
      setPostModalError(null);
      const response = await api.get(`posts/${targetId}/detail/`);
      setPostModalData(response.data);
      setPostModalOpen(true);
    } catch (e: any) {
      setPostModalError('Unable to load the original post.');
    } finally {
      setPostModalLoading(false);
    }
  };

  return (
    <div style={{ background: '#f5f7fa', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <AlumniTopBar
        showProfile={showProfile}
        setShowProfile={setShowProfile}
        handleLogout={handleLogout}
        isAdmin={true}
        onTrackerClick={() => navigate('/tracker')}
      />
      <div
        style={{
          maxWidth: 900,
          margin: '40px auto',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ flex: 1 }}>Notifications</h2>
          <input
            type="text"
            placeholder="Search notif"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              borderRadius: 8,
              border: '1px solid #ccc',
              padding: '6px 12px',
              marginRight: 16,
            }}
          />
          <button
            type="button"
            style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: 8 }}
            onClick={selectAll}
            title="Select All"
          >
            <span role="img" aria-label="select-all">
              ☑️
            </span>
          </button>
          {/* <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} title="Delete Selected" disabled={selected.length === 0} onClick={handleDelete}>
            <span role="img" aria-label="delete">🗑️</span>
          </button> */}
        </div>
        <div style={{ borderTop: '1px solid #eee' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
            <thead>
              <tr style={{ background: '#f5f7fa' }}>
                <th style={{ width: 40 }}></th>
                <th style={{ width: 40 }}></th>
                <th style={{ textAlign: 'left', padding: 8 }}>Sender</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Subject</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Content</th>
                <th style={{ textAlign: 'right', padding: 8 }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>
                    Loading...
                  </td>
                </tr>
              ) : filteredNotifications.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#888' }}>
                    No notifications found.
                  </td>
                </tr>
              ) : (
                filteredNotifications.map((notif) => (
                  <tr
                    key={notif.id}
                    style={{
                      borderBottom: '1px solid #eee',
                      background: selected.includes(notif.id) ? '#e0e7ef' : undefined,
                      cursor: 'pointer',
                    }}
                    onClick={() => setOpenNotif(notif)}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.includes(notif.id)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleSelect(notif.id)}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        title="Expand"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenNotif(notif);
                        }}
                      >
                        <span role="img" aria-label="expand">▾</span>
                      </button>
                    </td>
                    <td style={{ fontWeight: 600, color: '#174f84' }}>{notif.type}</td>
                    <td style={{ fontWeight: 600 }}>{notif.subject || 'No Subject'}</td>
                    <td style={{ color: '#333' }}>
                      {notif.content.length > 60
                        ? notif.content.slice(0, 60) + '...'
                        : notif.content}
                    </td>
                    <td style={{ textAlign: 'right', color: '#888', fontSize: 13 }}>
                      {notif.date}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {openNotif && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setOpenNotif(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              boxShadow: '0 2px 16px rgba(0,0,0,0.18)',
              padding: 32,
              minWidth: 340,
              maxWidth: 480,
              width: '90%',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpenNotif(null)}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: 'none',
                border: 'none',
                fontSize: 22,
                cursor: 'pointer',
                color: '#888',
              }}
              title="Close"
            >
              ×
            </button>
            
            {/* Header with avatar */}
            <div style={{
              background: '#f8f9fa',
              padding: '20px',
              borderBottom: '1px solid #e9ecef',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              margin: '-32px -32px 20px -32px'
            }}>
              {/* User Profile Picture */}
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                overflow: 'hidden',
                flexShrink: 0
              }}>
                <ProfilePicComponent 
                  userId={(() => {
                    const actorIdMatch = openNotif.content?.match(/<!--ACTOR_ID:(\d+)-->/);
                    const userId = actorIdMatch ? actorIdMatch[1] : undefined;
                    console.log('Admin Notification - Extracted userId:', userId, 'from content:', openNotif.content);
                    return userId;
                  })()}
                  userName={(() => {
                    const nameMatch = openNotif.content?.match(/^([^<]+?)\s+(commented|mentioned|liked|reposted|started following)/i);
                    return nameMatch ? nameMatch[1].trim() : openNotif.type;
                  })()}
                  size="40px"
                />
              </div>

              {/* Notification Info */}
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: '600',
                  color: '#333',
                  marginBottom: '4px'
                }}>
                  {openNotif.subject || 'No Subject'}
                </div>
                <div style={{ 
                  fontSize: '12px',
                  color: '#666'
                }}>
                  {openNotif.date}
                </div>
              </div>
            </div>
            
            <div style={{ color: '#174f84', fontWeight: 600, marginBottom: 12, fontSize: 14 }}>
              {openNotif.type}
            </div>
            <div style={{ fontSize: 16, whiteSpace: 'pre-line', marginBottom: 24 }}>
              {renderMessageWithButton(openNotif.content)}
            </div>

            {/* Original Post inline card for repost-related notifications */}
            {(() => {
              const { postId, repostId, forumId, donationId } = extractOriginalIds(openNotif.content || '');
              const isRepostContext = !!repostId || /repost(ed)?/i.test(openNotif.type || '') || /repost(ed)?/i.test(openNotif.content || '');
              // Only show for regular posts (skip forum/donation here)
              if ((postId || repostId) && !forumId && !donationId && isRepostContext) {
                return (
                  <div
                    role="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); openOriginalPost(openNotif.content); }}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 10,
                      padding: 14,
                      background: '#fafbfc',
                      cursor: 'pointer',
                      transition: 'background 0.2s ease',
                      marginBottom: 8
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#f2f5f8'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#fafbfc'; }}
                 >
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Original post</div>
                    <div style={{
                      fontSize: 14,
                      color: '#333',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 3 as any,
                      WebkitBoxOrient: 'vertical' as any
                    }}>
                      {(openNotif.content || '').replace(/<!--[^>]+-->/g, '').replace(/^[^:]+:\s*/, '').trim() || 'View original content'}
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>
      )}
      {postModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
          }}
          onClick={() => setPostModalOpen(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              boxShadow: '0 2px 16px rgba(0,0,0,0.18)',
              padding: 24,
              minWidth: 360,
              maxWidth: 720,
              width: '92%',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPostModalOpen(false)}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: 'none',
                border: 'none',
                fontSize: 20,
                cursor: 'pointer',
                color: '#888',
              }}
              title="Close"
            >
              ×
            </button>

            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Original Post</h3>
            {postModalLoading && (
              <div style={{ padding: 12 }}>Loading...</div>
            )}
            {postModalError && (
              <div style={{ padding: 12, color: '#b00020' }}>{postModalError}</div>
            )}
            {!postModalLoading && !postModalError && postModalData && (
              <div>
                <div style={{ fontSize: 14, color: '#555', marginBottom: 8 }}>
                  {postModalData.author_name || postModalData.author || 'User'} • {postModalData.created_at || ''}
                </div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 16, color: '#222' }}>
                  {postModalData.content || postModalData.text || 'No content'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotificationPage;
