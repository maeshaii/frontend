import React, { useEffect, useState } from 'react';
import { fetchNotifications, deleteNotifications, markNotificationAsRead, api, getPostFromComment } from '../../services/api';
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
  const [userProfilePics, setUserProfilePics] = useState<{[key: string]: string}>({});
  const navigate = useNavigate();

  // Add CSS for animations and styling
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .notification-scroll::-webkit-scrollbar {
        display: none;
      }
      
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      @keyframes slideInRight {
        from {
          transform: translateX(100%);
        }
        to {
          transform: translateX(0);
        }
      }
      
      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
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

  const handleReplyNotificationClick = async (notif: any) => {
    try {
      // Extract comment ID from notification content
      const commentIdMatch = notif.content.match(/<!--COMMENT_ID:(\d+)-->/);
      if (commentIdMatch) {
        const commentId = parseInt(commentIdMatch[1]);
        const response = await getPostFromComment(commentId);
        if (response.success) {
          // Redirect to the post page
          const currentPath = window.location.pathname;
          if (currentPath.startsWith('/peso')) {
            window.location.href = `/peso/dashboard/${response.post_id}`;
          } else if (currentPath.startsWith('/ccict')) {
            window.location.href = `/ccict/dashboard/${response.post_id}`;
          } else {
            window.location.href = `/alumni/dashboard/${response.post_id}`;
          }
        }
      }
    } catch (error) {
      console.error('Error redirecting to post:', error);
      alert('Error redirecting to post. Please try again.');
    }
  };

  const handleDelete = async (deleteAll: boolean = false) => {
    try {
      let notificationIds: number[];
      let confirmMessage: string;
      
      if (deleteAll) {
        notificationIds = notifications.map(n => n.id);
        confirmMessage = `Are you sure you want to delete ALL ${notifications.length} notifications? This action cannot be undone.`;
      } else {
    if (selected.length === 0) return;
        notificationIds = selected;
        confirmMessage = `Are you sure you want to delete ${selected.length} selected notification${selected.length > 1 ? 's' : ''}?`;
      }
      
      if (window.confirm(confirmMessage)) {
        const result = await deleteNotifications(notificationIds);
    if (result.success) {
          if (deleteAll) {
            setNotifications([]);
      setSelected([]);
          } else {
            setNotifications(prev => prev.filter(n => !selected.includes(n.id)));
            setSelected([]);
          }
    } else {
      alert('Failed to delete notifications.');
        }
      }
    } catch (error) {
      console.error('Error deleting notifications:', error);
      alert('Failed to delete notifications. Please try again.');
    }
  };

  const handleSelectAll = () => {
    if (selected.length === notifications.length) {
      // If all are selected, unselect all
      setSelected([]);
    } else {
      // Otherwise, select all
      const allIds = notifications.map(n => n.id);
      setSelected(allIds);
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
              background: '#0066cc',
              color: '#fff',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '13px',
              margin: '12px 0',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#0056b3';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#0066cc';
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

  // Helper function to get notification type styling
  const getNotificationTypeStyle = (type: string) => {
    const typeLower = type.toLowerCase();
    if (typeLower.includes('repost')) {
      return { color: '#10b981', icon: '🔁', bgColor: '#ecfdf5', borderColor: '#d1fae5' };
    } else if (typeLower.includes('comment')) {
      return { color: '#3b82f6', icon: '💬', bgColor: '#eff6ff', borderColor: '#dbeafe' };
    } else if (typeLower.includes('mention')) {
      return { color: '#8b5cf6', icon: '✨', bgColor: '#f3e8ff', borderColor: '#e9d5ff' };
    } else if (typeLower.includes('follow')) {
      return { color: '#f59e0b', icon: '👥', bgColor: '#fffbeb', borderColor: '#fef3c7' };
    } else if (typeLower.includes('admin') || typeLower.includes('system')) {
      return { color: '#6b7280', icon: '📢', bgColor: '#f9fafb', borderColor: '#e5e7eb' };
    }
    return { color: '#6b7280', icon: '📢', bgColor: '#f9fafb', borderColor: '#e5e7eb' };
  };

  // Mark all as read function
  const markAllAsRead = async () => {
    const unreadNotifications = notifications.filter(n => !n.is_read);
    if (unreadNotifications.length === 0) return;
    
    try {
      for (const notif of unreadNotifications) {
        await markNotificationAsRead(notif.id);
      }
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );
      window.dispatchEvent(new CustomEvent('notificationRead'));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleNotificationRedirect = async (notif: any) => {
    try {
      console.log('Attempting to redirect for notification:', notif);
      console.log('Notification content:', notif.content);
      
      // Handle ALL post-related notifications (like, comment, repost, mention) - redirect to dashboard with post ID
      const isPostRelated = ['like', 'comment', 'repost', 'mention'].some(type => 
        notif.type.toLowerCase().includes(type)
      );
      
      if (isPostRelated) {
        const postIdMatch = notif.content.match(/<!--POST_ID:(\d+)-->/);
        const forumIdMatch = notif.content.match(/<!--FORUM_ID:(\d+)-->/);
        const donationIdMatch = notif.content.match(/<!--DONATION_ID:(\d+)-->/);
        const commentIdMatch = notif.content.match(/<!--COMMENT_ID:(\d+)-->/);
        const repostIdMatch = notif.content.match(/<!--REPOST_ID:(\d+)-->/);
        const replyIdMatch = notif.content.match(/<!--REPLY_ID:(\d+)-->/);
        
        // Prioritize original post IDs over comment/reply IDs for better redirects
        const originalPostId = postIdMatch?.[1] || forumIdMatch?.[1] || donationIdMatch?.[1];
        const commentId = commentIdMatch?.[1];
        const repostId = repostIdMatch?.[1];
        const replyId = replyIdMatch?.[1];
        
        if (originalPostId || commentId || repostId || replyId) {
          const notificationType = notif.type.toLowerCase();
          
          // If we have a REPOST_ID, store it for repost modal and use the original post ID for URL
          if (repostId) {
            console.log('Found REPOST_ID, storing for repost modal:', repostId);
            localStorage.setItem('pendingRepostView', repostId);
            
            // Use original post ID for URL if available, otherwise use repost ID
            const urlPostId = originalPostId || repostId;
            console.log('Using post ID for URL:', urlPostId);
            
            // Redirect to dashboard with the correct post ID in URL
            const currentPath = window.location.pathname;
            if (currentPath.startsWith('/peso')) {
              window.location.href = `/peso/dashboard/${urlPostId}`;
            } else if (currentPath.startsWith('/ccict')) {
              window.location.href = `/ccict/dashboard/${urlPostId}`;
            } else {
              window.location.href = `/alumni/dashboard/${urlPostId}`;
            }
            return;
          }
          
          // For mention notifications, prioritize original post IDs over comment/reply IDs
          if (notificationType === 'mention') {
            if (originalPostId) {
              console.log('Mention notification - redirecting to original post:', originalPostId);
              // Determine the type based on which ID was found
              if (postIdMatch) {
                localStorage.setItem('pendingPostView', originalPostId);
              } else if (forumIdMatch) {
                localStorage.setItem('pendingPostView', `forum:${originalPostId}`);
              } else if (donationIdMatch) {
                localStorage.setItem('pendingPostView', `donation:${originalPostId}`);
              }
              
              // Redirect to dashboard
              const currentPath = window.location.pathname;
              if (currentPath.startsWith('/peso')) {
                window.location.href = `/peso/dashboard/${originalPostId}`;
              } else if (currentPath.startsWith('/ccict')) {
                window.location.href = `/ccict/dashboard/${originalPostId}`;
              } else {
                window.location.href = `/alumni/dashboard/${originalPostId}`;
              }
              return;
            } else if (commentId) {
              console.log('Mention notification - redirecting via comment:', commentId);
              localStorage.setItem('pendingPostView', `comment:${commentId}`);
              
              // Redirect to dashboard
              const currentPath = window.location.pathname;
              if (currentPath.startsWith('/peso')) {
                window.location.href = `/peso/dashboard/${commentId}`;
              } else if (currentPath.startsWith('/ccict')) {
                window.location.href = `/ccict/dashboard/${commentId}`;
              } else {
                window.location.href = `/alumni/dashboard/${commentId}`;
              }
              return;
            } else if (replyId) {
              console.log('Mention notification - redirecting via reply:', replyId);
              localStorage.setItem('pendingPostView', `reply:${replyId}`);
              
              // Redirect to dashboard
              const currentPath = window.location.pathname;
              if (currentPath.startsWith('/peso')) {
                window.location.href = `/peso/dashboard/${replyId}`;
              } else if (currentPath.startsWith('/ccict')) {
                window.location.href = `/ccict/dashboard/${replyId}`;
              } else {
                window.location.href = `/alumni/dashboard/${replyId}`;
              }
              return;
            }
          }
          
          // For other notification types (like, comment), use the same logic as before
          let postId = originalPostId || commentId || replyId;
          console.log(`${notificationType} notification - redirecting to dashboard for post:`, postId);
          
          // Store the appropriate pending view based on notification type
          if (notificationType.includes('repost')) {
            localStorage.setItem('pendingRepostView', postId);
          } else if (commentIdMatch && !originalPostId) {
            // For comment notifications without original post ID, use comment ID
            localStorage.setItem('pendingPostView', `comment:${postId}`);
          } else if (forumIdMatch) {
            localStorage.setItem('pendingPostView', `forum:${postId}`);
          } else if (donationIdMatch) {
            localStorage.setItem('pendingPostView', `donation:${postId}`);
          } else {
            localStorage.setItem('pendingPostView', postId);
          }
          
          // Redirect to dashboard with post ID in URL
          const currentPath = window.location.pathname;
          if (currentPath.startsWith('/peso')) {
            window.location.href = `/peso/dashboard/${postId}`;
          } else if (currentPath.startsWith('/ccict')) {
            window.location.href = `/ccict/dashboard/${postId}`;
          } else {
            window.location.href = `/alumni/dashboard/${postId}`;
          }
          return;
        }
      }
      
      // Fallback for non-post-related notifications (follow, system, etc.)
      console.log('Non-post-related notification, using fallback logic');
      const visibleIdMatch = notif.content.match(/Post ID:\s*(\d+)/i);
      
      if (visibleIdMatch) {
        const postId = visibleIdMatch[1];
        console.log('Found visible post ID:', postId);
        
        // Store and redirect
        localStorage.setItem('pendingPostView', postId);
        
        const currentPath = window.location.pathname;
        if (currentPath.startsWith('/peso')) {
          window.location.href = `/peso/dashboard/${postId}`;
        } else if (currentPath.startsWith('/ccict')) {
          window.location.href = `/ccict/dashboard/${postId}`;
        } else {
          window.location.href = `/alumni/dashboard/${postId}`;
        }
        return;
      } else {
        console.log('No post ID found in notification content');
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
        }
      }
    } catch (error) {
      console.error('Error handling notification redirect:', error);
      alert('Unable to redirect to the post. Please try again.');
    }
  };

  const fetchUserProfilePic = async (userId: string) => {
    try {
      const response = await api.get(`users/${userId}/`);
      if (response.data && response.data.profile_pic) {
        const profilePic = response.data.profile_pic;
        const profilePicUrl = profilePic.startsWith('http') ? profilePic : `http://127.0.0.1:8000${profilePic}`;
        setUserProfilePics(prev => ({ ...prev, [userId]: profilePicUrl }));
        return profilePicUrl;
      }
    } catch (error) {
      console.error('Error fetching user profile pic:', error);
    }
    return null;
  };

  const searchUserByName = async (userName: string) => {
    try {
      const response = await api.get(`alumni/search/?query=${encodeURIComponent(userName)}`);
      if (response.data && response.data.alumni && response.data.alumni.length > 0) {
        // Find exact match or first close match
        const exactMatch = response.data.alumni.find((user: any) => 
          user.full_name === userName || 
          `${user.f_name} ${user.m_name || ''} ${user.l_name}`.trim() === userName
        );
        const user = exactMatch || response.data.alumni[0];
        return {
          user_id: user.user_id,
          profile_pic: user.profile_pic
        };
      }
    } catch (error) {
      console.error('Error searching user by name:', error);
    }
    return null;
  };

  const getUserProfilePic = async (userId: string, userName: string) => {
    if (userProfilePics[userId]) {
  return (
        <img
          src={userProfilePics[userId]}
          alt={userName}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '50%'
          }}
          onError={(e) => {
            // Fallback to initial letter if image fails to load
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML = `
                <div style="
                  width: 100%;
                  height: 100%;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: white;
                  font-size: 18px;
                  font-weight: 600;
                  border-radius: 50%;
                ">
                  ${userName.charAt(0).toUpperCase()}
                </div>
              `;
            }
          }}
        />
      );
    } else {
      // Fetch profile pic and show initial letter as fallback
      fetchUserProfilePic(userId);
      return (
        <div style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '16px',
          fontWeight: '600'
        }}>
          {userName.charAt(0).toUpperCase()}
        </div>
      );
    }
  };

  const getUserProfilePicByName = async (userName: string) => {
    // Search for user by name and get their profile picture
    const userData = await searchUserByName(userName);
    if (userData) {
      const profilePicUrl = userData.profile_pic && userData.profile_pic.startsWith('http') 
        ? userData.profile_pic 
        : userData.profile_pic 
          ? `http://127.0.0.1:8000${userData.profile_pic}`
          : null;
      
      if (profilePicUrl) {
        return (
          <img
            src={profilePicUrl}
            alt={userName}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '50%'
            }}
            onError={(e) => {
              // Fallback to initial letter if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = `
                  <div style="
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 18px;
                    font-weight: 600;
                    border-radius: 50%;
                  ">
                    ${userName.charAt(0).toUpperCase()}
                  </div>
                `;
              }
            }}
          />
        );
      }
    }
    
    // Fallback to initial letter
    return (
      <div style={{
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '16px',
        fontWeight: '600'
      }}>
        {userName.charAt(0).toUpperCase()}
      </div>
    );
  };

  const ProfilePicComponent = ({ userId, userName, size = '40px' }: { userId?: string, userName: string, size?: string }) => {
    const [profilePicUrl, setProfilePicUrl] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    
    React.useEffect(() => {
      const loadProfilePic = async () => {
        try {
          console.log('ProfilePicComponent loading:', { userId, userName });
          
          if (userId) {
            // Try to get from cache first
            if (userProfilePics[userId]) {
              console.log('Found cached profile pic for user:', userId);
              setProfilePicUrl(userProfilePics[userId]);
              setIsLoading(false);
              return;
            }
            
            // Fetch from API
            console.log('Fetching profile pic from API for user:', userId);
            const response = await api.get(`users/${userId}/`);
            console.log('API response for user:', userId, response.data);
            
            if (response.data && response.data.profile_pic) {
              const profilePic = response.data.profile_pic;
              const profilePicUrl = profilePic.startsWith('http') ? profilePic : `http://127.0.0.1:8000${profilePic}`;
              console.log('Setting profile pic URL:', profilePicUrl);
              setUserProfilePics(prev => ({ ...prev, [userId]: profilePicUrl }));
              setProfilePicUrl(profilePicUrl);
            } else {
              console.log('No profile pic found for user:', userId);
            }
          } else if (userName) {
            // Search by name
            console.log('Searching user by name:', userName);
            const userData = await searchUserByName(userName);
            console.log('Search result:', userData);
            
            if (userData && userData.profile_pic) {
              const profilePicUrl = userData.profile_pic.startsWith('http') 
                ? userData.profile_pic 
                : `http://127.0.0.1:8000${userData.profile_pic}`;
              console.log('Setting profile pic URL from search:', profilePicUrl);
              setProfilePicUrl(profilePicUrl);
            } else {
              console.log('No profile pic found for user name:', userName);
            }
          }
        } catch (error) {
          console.error('Error loading profile pic:', error);
        } finally {
          setIsLoading(false);
        }
      };
      
      loadProfilePic();
    }, [userId, userName]);
    
    if (isLoading) {
      return (
        <div style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '16px',
          fontWeight: '600'
        }}>
          {userName.charAt(0).toUpperCase()}
        </div>
      );
    }
    
    if (profilePicUrl) {
      return (
        <img
          src={profilePicUrl}
          alt={userName}
          style={{
            width: size,
            height: size,
            objectFit: 'cover',
            borderRadius: '50%'
          }}
          onError={(e) => {
            // Fallback to initial letter if image fails to load
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML = `
                <div style="
                  width: ${size};
                  height: ${size};
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: white;
                  font-size: 16px;
                  font-weight: 600;
                  border-radius: 50%;
                ">
                  ${userName.charAt(0).toUpperCase()}
                </div>
              `;
            }
          }}
        />
      );
    }
    
    // Fallback to initial letter
    return (
      <div style={{
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '16px',
        fontWeight: '600'
      }}>
        {userName.charAt(0).toUpperCase()}
      </div>
    );
  };

  return (
    <div style={{ 
      background: 'white', 
      minHeight: '100vh', 
      fontFamily: 'Arial, sans-serif'
    }}>
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
      
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '30px 50px' }}>
        {/* Header */}
        <div style={{ 
          background: 'white', 
          borderRadius: '12px', 
          padding: '20px', 
          marginBottom: '20px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e9ecef'
        }}>
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
                  background: '#f8f9fa',
                  color: '#6c757d',
                  border: '1px solid #e9ecef',
                  borderRadius: '8px',
                  padding: '8px 16px',
            cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '16px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e9ecef';
                  e.currentTarget.style.borderColor = '#dee2e6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f8f9fa';
                  e.currentTarget.style.borderColor = '#e9ecef';
          }}
        >
          ← Back to Dashboard
        </button>
          );
        })()}
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ 
                margin: 0, 
                fontSize: '24px', 
                fontWeight: '600',
                color: '#1a1a1a',
                marginBottom: '8px'
              }}>
                Notifications
              </h1>
              <p style={{ margin: 0, color: '#6c757d', fontSize: '14px' }}>
                {notifications.filter(n => !n.is_read).length} unread notifications
              </p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
          <input
            type="text"
                  placeholder="Search notifications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
                    borderRadius: '8px',
                    border: '1px solid #e9ecef',
                    padding: '8px 12px 8px 36px',
                    background: 'white',
                    fontSize: '14px',
                    width: '250px',
                    outline: 'none',
                    transition: 'border-color 0.2s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#0066cc'}
                  onBlur={(e) => e.target.style.borderColor = '#e9ecef'}
                />
                <div style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#6c757d',
                  fontSize: '14px'
                }}>
                  🔍
                </div>
              </div>
              
          <button
                onClick={markAllAsRead}
                style={{ 
                  background: '#0066cc', 
                  color: 'white',
                  border: 'none', 
                  cursor: 'pointer', 
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#0056b3';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#0066cc';
                }}
              >
                Mark All as Read
          </button>
              
              {/* Delete Controls */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
                  onClick={handleSelectAll}
                  style={{ 
                    background: '#6c757d', 
                    color: 'white',
                    border: 'none', 
                    cursor: 'pointer', 
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#5a6268';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#6c757d';
                  }}
                  title={selected.length === notifications.length ? "Unselect All" : "Select All"}
                >
                  {selected.length === notifications.length ? "Unselect All" : "Select All"}
          </button>
                
                <button
                  onClick={() => {
                    if (selected.length > 1) {
                      // More than 1 selected - delete all
                      handleDelete(true);
                    } else {
                      // 0 or 1 selected - delete selected
                      handleDelete(false);
                    }
                  }}
            style={{ 
                    background: '#dc3545', 
                    color: 'white',
                    border: 'none', 
                    cursor: 'pointer', 
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#c82333';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#dc3545';
                  }}
                  title={selected.length > 1 ? "Delete All" : "Delete"}
                >
                  {selected.length > 1 ? "Delete All" : "Delete"}
                </button>
              </div>
        </div>
          </div>
        </div>

        {/* Notifications List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {loading ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '60px 24px',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e9ecef'
            }}>
              <div style={{ 
                fontSize: '32px', 
                marginBottom: '16px',
                animation: 'spin 1s linear infinite'
              }}>⏳</div>
              <div style={{ color: '#6c757d', fontSize: '14px' }}>Loading notifications...</div>
            </div>
              ) : filteredNotifications.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '60px 24px',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e9ecef'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
              <div style={{ color: '#6c757d', fontSize: '14px' }}>No notifications found.</div>
            </div>
          ) : (
            filteredNotifications.map((notif: any, index: number) => {
              const isTrackerNotification = notif.type.toLowerCase().includes('tracker') || notif.content.includes('Tracker Form');
              
              return (
                <div
                    key={notif.id}
                    style={{
                    background: 'white',
                    borderRadius: '8px',
                    padding: '16px',
                      cursor: 'pointer',
                    border: selected.includes(notif.id) 
                      ? '2px solid #0066cc' 
                      : !notif.is_read 
                        ? '1px solid #0066cc' 
                        : '1px solid #e9ecef',
                    boxShadow: !notif.is_read 
                      ? '0 2px 8px rgba(0, 102, 204, 0.2)' 
                      : '0 1px 3px rgba(0, 0, 0, 0.1)',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    opacity: 0,
                    animation: `fadeInUp 0.3s ease forwards ${index * 0.05}s`,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px'
                    }}
                    onClick={async () => {
                    if (isTrackerNotification) {
                      // Show modal for tracker notifications
                      setOpenNotif(notif);
                    } else {
                      // Direct redirect for post-related notifications
                      await handleNotificationRedirect(notif);
                    }
                    
                      if (!notif.is_read) {
                        try {
                          await markNotificationAsRead(notif.id);
                          setNotifications(prev => 
                            prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n)
                          );
                          window.dispatchEvent(new CustomEvent('notificationRead'));
                        } catch (error) {
                          console.error('Error marking notification as read:', error);
                        }
                      }
                    }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = !notif.is_read 
                      ? '0 4px 12px rgba(0, 102, 204, 0.25)' 
                      : '0 2px 6px rgba(0, 0, 0, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = !notif.is_read 
                      ? '0 2px 8px rgba(0, 102, 204, 0.2)' 
                      : '0 1px 3px rgba(0, 0, 0, 0.1)';
                  }}
                >
                  {/* Checkbox */}
                  <div style={{ 
                    position: 'absolute', 
                    top: '12px', 
                    left: '12px',
                    zIndex: 2
                  }}>
                      <input
                        type="checkbox"
                        checked={selected.includes(notif.id)}
                        onClick={e => e.stopPropagation()}
                        onChange={() => toggleSelect(notif.id)}
                      style={{
                        width: '14px',
                        height: '14px',
                        accentColor: '#0066cc'
                      }}
                    />
                  </div>
                  
                  {/* Profile Picture */}
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: '#f8f9fa',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #e9ecef',
                    flexShrink: 0,
                    marginLeft: '20px',
                    overflow: 'hidden'
                  }}>
                    {(() => {
                      // Try to extract user info from notification content
                      let userId = '';
                      let userName = '';
                      
                      console.log('Processing notification:', notif.type, notif.content);
                      
                      // For follow notifications: "Name|user_id started following you."
                      if (notif.type.toLowerCase() === 'follow') {
                        const match = notif.content.match(/^(.+)\|(\d+)\s+started following you\.?/);
                        if (match) {
                          userName = match[1];
                          userId = match[2];
                          console.log('Follow notification - extracted:', { userName, userId });
                        }
                      }
                      // For other notifications, try to extract from content
                      else {
                        // Look for patterns like "User Name commented on..." or "User Name mentioned you..."
                        const nameMatch = notif.content.match(/^([^<]+?)\s+(commented|mentioned|liked|reposted)/i);
                        if (nameMatch) {
                          userName = nameMatch[1].trim();
                          console.log('Other notification - extracted user name:', userName);
                        }
                      }
                      
                      console.log('Final extracted data:', { userId, userName });
                      
                      // Show profile picture or fallback
                      if (userId && userName) {
                        // For users with ID, try to get profile pic from cache or show initial
                        const cachedPic = userProfilePics[userId];
                        if (cachedPic) {
                          return (
                            <img
                              src={cachedPic}
                              alt={userName}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                borderRadius: '50%'
                              }}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.innerHTML = `
                                    <div style="
                                      width: 100%;
                                      height: 100%;
                                      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                      display: flex;
                                      align-items: center;
                                      justify-content: center;
                                      color: white;
                                      font-size: 18px;
                                      font-weight: 600;
                                      border-radius: 50%;
                                    ">
                                      ${userName.charAt(0).toUpperCase()}
                                    </div>
                                  `;
                                }
                              }}
                            />
                          );
                        } else {
                          // Fetch profile pic in background
                          fetchUserProfilePic(userId);
                          return (
                            <div style={{
                              width: '100%',
                              height: '100%',
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontSize: '16px',
                              fontWeight: '600'
                            }}>
                              {userName.charAt(0).toUpperCase()}
                            </div>
                          );
                        }
                      } else if (userName) {
                        // For users without ID, search by name and show initial
                        // Trigger background search for profile picture
                        searchUserByName(userName).then(userData => {
                          if (userData && userData.profile_pic) {
                            const profilePicUrl = userData.profile_pic.startsWith('http') 
                              ? userData.profile_pic 
                              : `http://127.0.0.1:8000${userData.profile_pic}`;
                            // Store in cache for future use
                            setUserProfilePics(prev => ({ ...prev, [userData.user_id]: profilePicUrl }));
                          }
                        }).catch(error => {
                          console.error('Error searching user by name:', error);
                        });
                        
                        return (
                          <div style={{
                            width: '100%',
                            height: '100%',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '16px',
                            fontWeight: '600'
                          }}>
                            {userName.charAt(0).toUpperCase()}
                          </div>
                        );
                      } else {
                        // Fallback to emoji based on notification type
                        return (
                          <div style={{
                            fontSize: '20px',
                            color: '#6c757d'
                          }}>
                            {notif.type.toLowerCase().includes('comment') ? '💬' : 
                             notif.type.toLowerCase().includes('like') ? '❤️' : 
                             notif.type.toLowerCase().includes('repost') ? '🔄' : 
                             notif.type.toLowerCase().includes('mention') ? '✨' : 
                             notif.type.toLowerCase().includes('follow') ? '👥' : '📢'}
                          </div>
                        );
                      }
                    })()}
                  </div>
                  
                  {/* Notification Icon Overlay */}
                  <div style={{
                    position: 'absolute',
                    top: '44px',
                    left: '68px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: notif.type.toLowerCase().includes('comment') ? '#28a745' :
                               notif.type.toLowerCase().includes('like') ? '#dc3545' :
                               notif.type.toLowerCase().includes('repost') ? '#17a2b8' :
                               notif.type.toLowerCase().includes('mention') ? '#6f42c1' :
                               notif.type.toLowerCase().includes('follow') ? '#ffc107' : '#6c757d',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '8px',
                    color: 'white',
                    border: '2px solid white',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }}>
                    {notif.type.toLowerCase().includes('comment') ? '💬' : 
                     notif.type.toLowerCase().includes('like') ? '❤️' : 
                     notif.type.toLowerCase().includes('repost') ? '🔄' : 
                     notif.type.toLowerCase().includes('mention') ? '✨' : 
                     notif.type.toLowerCase().includes('follow') ? '👥' : '📢'}
                  </div>
                  
                  {/* Content */}
                  <div style={{ flex: 1, marginRight: '20px' }}>
                    <div style={{ 
                      color: '#333', 
                      fontSize: '14px',
                      lineHeight: '1.4',
                      marginBottom: '4px',
                      fontWeight: !notif.is_read ? '500' : '400'
                    }}>
                      {notif.type.toLowerCase() === 'follow' ? (
                        (() => {
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
                                    fontWeight: '600',
                                    textDecoration: 'none'
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
                            __html: notif.content.length > 80 ? 
                              notif.content.slice(0, 80).replace(/\n/g, ' ').replace(/<br\s*\/?>/gi, ' ') + '...' : 
                              notif.content.replace(/\n/g, ' ').replace(/<br\s*\/?>/gi, ' ')
                          }} 
                        />
                      )}
                    </div>
                    
                    <div style={{
                      color: '#6c757d',
                      fontSize: '12px',
                      fontWeight: '400'
                    }}>
                      {formatHybrid(notif.date)}
                    </div>
                  </div>
                  
                  {/* Unread indicator */}
                  {!notif.is_read && (
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      width: '6px',
                      height: '6px',
                      background: '#0066cc',
                      borderRadius: '50%'
                    }} />
                  )}
          </div>
              );
            })
          )}
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
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setOpenNotif(null)}
        >
          <div
            style={{
              background: 'white',
              width: '400px',
              maxWidth: '90vw',
              borderRadius: '12px',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
              animation: 'fadeInUp 0.2s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setOpenNotif(null)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(0,0,0,0.1)',
                border: 'none',
                fontSize: 16,
                cursor: 'pointer',
                color: '#666',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                zIndex: 10
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
                e.currentTarget.style.color = '#333';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.1)';
                e.currentTarget.style.color = '#666';
              }}
              title="Close"
            >
              ×
            </button>
            
            {/* Header */}
            <div style={{
              background: '#f8f9fa',
              padding: '20px',
              borderBottom: '1px solid #e9ecef',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
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
                    if (openNotif.type && openNotif.type.toLowerCase() === 'follow') {
                      const match = openNotif.content.match(/^(.+)\|(\d+)\s+started following you\.?/);
                      return match ? match[2] : undefined;
                    }
                    return undefined;
                  })()}
                  userName={(() => {
                    if (openNotif.type && openNotif.type.toLowerCase() === 'follow') {
                      const match = openNotif.content.match(/^(.+)\|(\d+)\s+started following you\.?/);
                      return match ? match[1] : '';
                    } else {
                      const nameMatch = openNotif.content.match(/^([^<]+?)\s+(commented|mentioned|liked|reposted)/i);
                      return nameMatch ? nameMatch[1].trim() : '';
                    }
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
                  {openNotif.subject || 'Notification'}
                </div>
                <div style={{ 
                  fontSize: '12px',
                  color: '#666'
                }}>
                  {formatHybrid(openNotif.date)}
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div style={{ padding: '20px' }}>
              <div style={{ 
                fontSize: 14, 
                lineHeight: '1.5', 
                color: '#555',
                marginBottom: '20px'
              }}>
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
              ) : (openNotif.type && (openNotif.type.toLowerCase() === 'like' || openNotif.type.toLowerCase() === 'comment' || openNotif.type.toLowerCase() === 'admin_peso_post' || openNotif.type.toLowerCase() === 'reply' || openNotif.type.toLowerCase() === 'mention')) ? (
                <div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {openNotif.content.replace(/<!--[^>]+-->/g, '')}
                  </div>
                  <br />
                  <br />
                  <button
                    style={{
                      background: '#0066cc',
                      color: '#fff',
                      padding: '10px 20px',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 500,
                      fontSize: '14px',
                      marginTop: '16px',
                      transition: 'all 0.2s ease',
                      width: '100%'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#0056b3';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#0066cc';
                    }}
                    onClick={async () => {
                      // Handle reply notifications specially
                      if (openNotif.type && openNotif.type.toLowerCase() === 'reply' && openNotif.content.includes('replied to your comment')) {
                        await handleReplyNotificationClick(openNotif);
                        return;
                      }
                      
                      // Handle mention notifications specially
                      if (openNotif.type && openNotif.type.toLowerCase() === 'mention' && openNotif.content.includes('mentioned you')) {
                        await handleReplyNotificationClick(openNotif);
                        return;
                      }
                      
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
        </div>
      )}
    </div>
  );
};

export default NotificationPage;
