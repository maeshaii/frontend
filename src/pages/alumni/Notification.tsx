import React, { useEffect, useState } from 'react';
import { fetchNotifications, deleteNotifications, markNotificationAsRead, api } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import AlumniTopBar from './AlumniTopBar';

function formatHybrid(iso?: string | null): string {
  if (!iso) return 'Unknown time';

  // Parse date string as UTC by appending 'Z' if no timezone info present
  let dateStr = iso;
  if (!iso.endsWith('Z') && !iso.match(/[+-]\d{2}:\d{2}$/)) {
    dateStr = iso + 'Z';
  }

  const ms = Date.parse(dateStr);
  if (Number.isNaN(ms)) return 'Unknown time';

  const diffMs = Date.now() - ms;
  const min = Math.floor(diffMs / 60000);
  const hr  = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (day >= 1) {
    return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
  if (hr  >= 1) return hr  === 1 ? '1 hour ago'   : `${hr} hours ago`;
  if (min >= 1) return min === 1 ? '1 minute ago' : `${min} minutes ago`;
  return 'Just now';
}

const NotificationPage: React.FC = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [openNotif, setOpenNotif] = useState<any | null>(null);
  const [postLoading, setPostLoading] = useState(false);
  const navigate = useNavigate();

  // Add CSS for invisible scrollbar styling
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .notification-scroll::-webkit-scrollbar {
        display: none;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);


  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleDelete = async () => {
    if (selected.length === 0) return;
    const result = await deleteNotifications(selected);
    if (result.success) {
      setNotifications(notifications.filter((n: any) => !selected.includes(n.id)));
      setSelected([]);
    } else {
      alert('Failed to delete notifications.');
    }
  };


  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      navigate('/login');
      return;
    }
    const user = JSON.parse(userStr);
    if (!user.id) return;
    setLoading(true);
    fetchNotifications(user.id)
      .then((data) => {
        setNotifications(data.notifications || []);
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const filteredNotifications = notifications.filter((n: any) =>
    n.content.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (id: number) => {
    setSelected((sel: any[]) => (sel.includes(id) ? sel.filter((i: number) => i !== id) : [...sel, id]));
  };

  const selectAll = () => {
    if (selected.length === filteredNotifications.length) {
      setSelected([]);
    } else {
      setSelected(filteredNotifications.map((n: any) => n.id));
    }
  };

  // Helper to render message with a real button
  function renderMessageWithButton(message: string) {
    // Regex to match the tracker form link or placeholder
    const trackerLinkMatch = message.match(/href=['"]([^'"]*\/alumni\/tracker\?user_id=\d+)['"]/);
    const trackerLink = trackerLinkMatch ? trackerLinkMatch[1] : null;
    // Replace the link or placeholder with a real button
    if (trackerLink) {
      const parts = message.split(/<a [^>]*>.*Tracker Form.*<\/a>/);
      return (
        <>
          <div style={{ whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: parts[0].replace(/\n/g, '<br>') }} />
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
          <div style={{ whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: parts[1].replace(/\n/g, '<br>') }} />
        </>
      );
    }
    // Fallback: render as HTML with line breaks
    return <div style={{ whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: message.replace(/\n/g, '<br>') }} />;
  }

  return (
    <div style={{ background: '#f5f7fa', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      {(() => {
        const currentUserRaw = localStorage.getItem('user');
        const currentUser = currentUserRaw ? JSON.parse(currentUserRaw) : null;
        const isAdmin = !!(currentUser && currentUser.account_type && currentUser.account_type.admin);
        const isPeso = !!(currentUser && currentUser.account_type && currentUser.account_type.peso);
        return (
          <AlumniTopBar
        showProfile={showProfile}
        setShowProfile={setShowProfile}
        handleLogout={handleLogout}
        isAdmin={isAdmin}
        isPeso={!isAdmin && isPeso}
      />
        );
      })()}
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
        {(() => {
          const currentUserRaw = localStorage.getItem('user');
          const currentUser = currentUserRaw ? JSON.parse(currentUserRaw) : null;
          const isAdmin = !!(currentUser && currentUser.account_type && currentUser.account_type.admin);
          const isPeso = !!(currentUser && currentUser.account_type && currentUser.account_type.peso);
          const userId = currentUser?.user_id || currentUser?.id;
          
          let backPath = '';
          if (isAdmin) {
            backPath = `/ccict/dashboard/${userId}`;
          } else if (isPeso) {
            backPath = `/peso/dashboard/${userId}`;
          } else {
            // Check if user is OJT or alumni based on user data
            const userRole = currentUser?.role || currentUser?.user_type;
            if (userRole === 'ojt' || userRole === 'coordinator') {
              backPath = `/ojt/dashboard/${userId}`;
            } else {
              backPath = `/alumni/dashboard/${userId}`;
            }
          }
          
          return (
            <button
          onClick={() => navigate(backPath)}
          style={{
            marginBottom: 16,
            background: '#174f84',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 20px',
            cursor: 'pointer',
          }}
        >
          ← Back to Dashboard
        </button>
          );
        })()}
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
            style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: 8 }}
            onClick={selectAll}
            title="Select All"
          >
            <span role="img" aria-label="select-all">
              ☑️
            </span>
          </button>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            title="Delete Selected"
            disabled={selected.length === 0}
            onClick={handleDelete}
          >
            <span role="img" aria-label="delete">
              🗑️
            </span>
          </button>
        </div>
        <div style={{ borderTop: '1px solid #eee' }}>
          <div 
            className="notification-scroll"
            style={{ 
              maxHeight: '440px', // 10 rows * 44px height per row
              overflowY: 'auto',
              scrollbarWidth: 'none', /* Firefox */
              msOverflowStyle: 'none', /* IE and Edge */
            }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr style={{ background: '#f5f7fa' }}>
                  <th style={{ width: 40 }}></th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Sender</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Subject</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Content</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>Date</th>
                </tr>
              </thead>
              <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24 }}>Loading...</td></tr>
              ) : filteredNotifications.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#888' }}>No notifications found.</td></tr>
              ) : (
                filteredNotifications.map((notif: any) => (
                  <tr
                    key={notif.id}
                    style={{
                      borderBottom: '1px solid #eee',
                      background: selected.includes(notif.id) 
                        ? '#e0e7ef' 
                        : !notif.is_read 
                          ? 'rgba(0, 102, 204, 0.08)' 
                          : 'transparent',
                      cursor: 'pointer',
                      height: 44,
                      fontWeight: !notif.is_read ? '600' : 'normal',
                    }}
                    onClick={async () => {
                      setOpenNotif(notif);
                      // Mark notification as read
                      if (!notif.is_read) {
                        try {
                          await markNotificationAsRead(notif.id);
                          // Update local state
                          setNotifications(prev => 
                            prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n)
                          );
                          // Dispatch event to update notification count in topbar
                          window.dispatchEvent(new CustomEvent('notificationRead'));
                        } catch (error) {
                          console.error('Error marking notification as read:', error);
                        }
                      }
                    }}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.includes(notif.id)}
                        onClick={e => e.stopPropagation()}
                        onChange={() => toggleSelect(notif.id)}
                      />
                    </td>
                    <td style={{ fontWeight: 600, color: '#174f84', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80 }}>{notif.type}</td>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>{notif.subject || 'No Subject'}</td>
                    <td style={{ color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320 }}>
                      {notif.type.toLowerCase() === 'follow' ? (
                        (() => {
                          // Parse format: "Name|user_id started following you."
                          const match = notif.content.match(/^(.+)\|(\d+)\s+started following you\.?/);
                          if (match) {
                            const followerName = match[1];
                            const followerId = match[2];
                            return (
                              <span>
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/alumni/profile/${followerId}`);
                                  }}
                                  style={{
                                    color: '#0066cc',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                  onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                                >
                                  {followerName}
                                </span>
                                {' started following you.'}
                              </span>
                            );
                          }
                          return notif.content;
                        })()
                      ) : (
                        <div 
                          style={{ display: 'inline' }}
                          dangerouslySetInnerHTML={{ 
                            __html: notif.content.length > 60 ? 
                              notif.content.slice(0, 60).replace(/\n/g, ' ').replace(/<br\s*\/?>/gi, ' ') + '...' : 
                              notif.content.replace(/\n/g, ' ').replace(/<br\s*\/?>/gi, ' ')
                          }} 
                        />
                      )}
                    </td>
                    <td style={{
                      textAlign: 'right',
                      color: '#888',
                      fontSize: 13,
                      whiteSpace: 'nowrap',
                      paddingLeft: '8px',
                      paddingRight: '8px',
                      minWidth: '80px',
                      width: '1%',
                    }}>
                      {formatHybrid(notif.date)}
                    </td>
                  </tr>
                ))
              )}
              </tbody>
            </table>
          </div>
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
            <div style={{ fontWeight: 700, fontSize: 22, marginBottom: 8 }}>
              {openNotif.subject || 'No Subject'}
            </div>
            <div style={{ color: '#174f84', fontWeight: 600, marginBottom: 4 }}>
              {openNotif.type}
            </div>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>{openNotif.date}</div>
            <div style={{ fontSize: 16, whiteSpace: 'pre-line', marginBottom: 24 }}>
              {openNotif.type && openNotif.type.toLowerCase() === 'follow' ? (
                <div>
                  {(() => {
                    // Parse format: "Name|user_id started following you."
                    const match = openNotif.content.match(/^(.+)\|(\d+)\s+started following you\.?/);
                    if (match) {
                      const followerName = match[1];
                      const followerId = match[2];
                      return (
                        <span>
                          <span
                            onClick={() => {
                              navigate(`/alumni/profile/${followerId}`);
                              setOpenNotif(null);
                            }}
                            style={{
                              color: '#0066cc',
                              cursor: 'pointer',
                              fontWeight: 700,
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                          >
                            {followerName}
                          </span>
                          {' '}started following you.
                        </span>
                      );
                    }
                    // Fallback for old format notifications
                    return <span>{openNotif.content}</span>;
                  })()}
                </div>
              ) : (openNotif.type && (openNotif.type.toLowerCase() === 'like' || openNotif.type.toLowerCase() === 'comment' || openNotif.type.toLowerCase() === 'admin_peso_post')) ? (
                <div>
                  <div dangerouslySetInnerHTML={{ __html: openNotif.content.replace(/\n/g, '<br>').replace(/<!--[^>]+-->/g, '') }} />
                  <br />
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
                      marginTop: '12px',
                    }}
                    onClick={async () => {
                      // Try to extract post ID from notification content (hidden format: <!--POST_ID:123-->, <!--FORUM_ID:123-->, <!--DONATION_ID:123-->)
                      const postIdMatch = openNotif.content.match(/<!--POST_ID:(\d+)-->/);
                      const forumIdMatch = openNotif.content.match(/<!--FORUM_ID:(\d+)-->/);
                      const donationIdMatch = openNotif.content.match(/<!--DONATION_ID:(\d+)-->/);
                      const visibleIdMatch = openNotif.content.match(/Post ID:\s*(\d+)/i);
                      
                      const matchResult = postIdMatch || forumIdMatch || donationIdMatch || visibleIdMatch;
                      
                      if (matchResult) {
                        const postId = matchResult[1];
                        setPostLoading(true);
                        
                        try {
                          let response;
                          let dashboardPath = '';
                          
                          // Determine which API endpoint to call based on the ID type
                          if (forumIdMatch) {
                            // Forum post
                            response = await api.get(`forums/${postId}/`);
                          } else if (donationIdMatch) {
                            // Donation post
                            response = await api.get(`donations/${postId}/`);
                          } else {
                            // Regular post
                            response = await api.get(`posts/${postId}/detail/`);
                          }
                          
                          if (response.data) {
                            // Post exists, navigate to appropriate dashboard to view it
                            setOpenNotif(null);
                            const userStr = localStorage.getItem('user');
                            const user = userStr ? JSON.parse(userStr) : null;
                            const userId = user?.user_id || user?.id;
                            
                            if (userId) {
                              // Determine dashboard path based on user type
                              const isAdmin = !!(user && user.account_type && user.account_type.admin);
                              const isPeso = !!(user && user.account_type && user.account_type.peso);
                              const userRole = user?.role || user?.user_type;
                              
                              if (isAdmin) {
                                dashboardPath = `/ccict/dashboard/${userId}`;
                              } else if (isPeso) {
                                dashboardPath = `/peso/dashboard/${userId}`;
                              } else if (userRole === 'ojt' || userRole === 'coordinator') {
                                dashboardPath = `/ojt/dashboard/${userId}`;
                              } else {
                                dashboardPath = `/alumni/dashboard/${userId}`;
                              }
                              
                              // Store post ID with type indicator
                              if (forumIdMatch) {
                                localStorage.setItem('pendingPostView', `forum:${postId}`);
                              } else if (donationIdMatch) {
                                localStorage.setItem('pendingPostView', `donation:${postId}`);
                              } else {
                                localStorage.setItem('pendingPostView', postId);
                              }
                              navigate(dashboardPath);
                            }
                          }
                        } catch (error: any) {
                          // Post doesn't exist or error occurred
                          if (error.response && error.response.status === 404) {
                            alert('This post has been deleted by the owner.');
                          } else {
                            alert('Unable to load the post. It may have been deleted.');
                          }
                        } finally {
                          setPostLoading(false);
                        }
                      } else {
                        // Old notification format without Post ID
                        alert('This notification is from an older version. Please check the dashboard to view recent posts.');
                        const userStr = localStorage.getItem('user');
                        const user = userStr ? JSON.parse(userStr) : null;
                        const userId = user?.user_id || user?.id;
                        
                        if (userId) {
                          const isAdmin = !!(user && user.account_type && user.account_type.admin);
                          const isPeso = !!(user && user.account_type && user.account_type.peso);
                          const userRole = user?.role || user?.user_type;
                          let dashboardPath = '';
                          
                          if (isAdmin) {
                            dashboardPath = `/ccict/dashboard/${userId}`;
                          } else if (isPeso) {
                            dashboardPath = `/peso/dashboard/${userId}`;
                          } else if (userRole === 'ojt' || userRole === 'coordinator') {
                            dashboardPath = `/ojt/dashboard/${userId}`;
                          } else {
                            dashboardPath = `/alumni/dashboard/${userId}`;
                          }
                          
                          navigate(dashboardPath);
                          setOpenNotif(null);
                        }
                      }
                    }}
                    disabled={postLoading}
                  >
                    {postLoading ? 'Loading...' : 'View Post'}
                  </button>
                </div>
              ) : (
                renderMessageWithButton(openNotif.content)
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationPage;
