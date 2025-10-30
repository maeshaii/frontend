import React, { useEffect, useState } from 'react';
import { fetchNotifications, api } from '../../../services/api';
import { useNavigate } from 'react-router-dom';
import AlumniTopBar from '../../alumni/AlumniTopBar';
import { useRealTimeNotifications } from '../../../hooks/useRealTimeNotifications';
import ctulogo from '../../../images/ctulogo.png';

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
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
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
    
    React.useEffect(() => {
      const loadProfilePic = async () => {
        try {
          console.log('Admin ProfilePicComponent - Loading for userId:', userId, 'userName:', userName);
          
          if (userId) {
            // Use the alumni/profile endpoint which works correctly
            const response = await api.get(`alumni/profile/${userId}/`);
            console.log('Admin ProfilePicComponent - API response:', response.data);
            
            if (response.data && response.data.profile_pic) {
              const profilePic = response.data.profile_pic;
              const profilePicUrl = profilePic.startsWith('http') ? profilePic : `http://127.0.0.1:8000${profilePic}`;
              console.log('Admin ProfilePicComponent - Setting profile pic URL:', profilePicUrl);
              setProfilePicUrl(profilePicUrl);
            } else {
              console.log('Admin ProfilePicComponent - No profile_pic in response');
            }
          } else {
            console.log('Admin ProfilePicComponent - No userId provided');
          }
        } catch (error) {
          console.error('Admin ProfilePicComponent - Error loading profile pic:', error);
        } finally {
          setIsLoading(false);
        }
      };
      
      loadProfilePic();
    }, [userId]);
    
    if (isLoading) {
      return (
        <img
          src={ctulogo}
          alt={userName || 'User'}
          style={{
            width: size,
            height: size,
            objectFit: 'cover',
            borderRadius: '50%'
          }}
        />
      );
    }
    
    if (profilePicUrl) {
      return (
        <img
          src={profilePicUrl}
          alt={userName || 'User'}
          style={{
            width: size,
            height: size,
            objectFit: 'cover',
            borderRadius: '50%'
          }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = ctulogo;
          }}
        />
      );
    }
    
    // Fallback to CTU logo
    return (
      <img
        src={ctulogo}
        alt={userName || 'User'}
        style={{
          width: size,
          height: size,
          objectFit: 'cover',
          borderRadius: '50%'
        }}
      />
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
        <button
          onClick={() => {
            const userStr = localStorage.getItem('user');
            if (userStr) {
              const userObj = JSON.parse(userStr);
              const userId = userObj.user_id || userObj.id;
              if (userId) {
                navigate(`/ccict/dashboard/${userId}`);
              }
            }
          }}
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
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotificationPage;
