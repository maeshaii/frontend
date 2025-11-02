import React, { useEffect, useState } from 'react';
import { fetchNotifications, deleteNotifications, markNotificationAsRead, api, getPostFromComment } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import AlumniTopBar from './AlumniTopBar';
import { getProfilePicUrl } from '../../utils/profilePicUtils';
import { useRealTimeNotifications } from '../../hooks/useRealTimeNotifications';
import ctulogo from '../../images/ctulogo.png';

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
  const [postLoading, setPostLoading] = useState(false);
  // Persist profile pic cache across sessions so avatars remain after logout/login
  const [userProfilePics, setUserProfilePics] = useState<{[key: string]: string}>(() => {
    try {
      const stored = localStorage.getItem('notifUserProfilePics');
      return stored ? JSON.parse(stored) : {};
    } catch (_) {
      return {};
    }
  });
  const [profilePicUpdateTrigger, setProfilePicUpdateTrigger] = useState(0);
  const [loadingProfilePics, setLoadingProfilePics] = useState<Set<string>>(new Set());
  const [lastApiCall, setLastApiCall] = useState<number>(0);
  const loadedProfilePics = React.useRef<Set<string>>(new Set());
  const navigate = useNavigate();

  // Debug profile picture updates
  React.useEffect(() => {
    console.log('Profile pictures updated:', userProfilePics);
    // Persist to localStorage so we keep avatars after logout/login
    try {
      localStorage.setItem('notifUserProfilePics', JSON.stringify(userProfilePics));
    } catch (_) {}
  }, [userProfilePics]);

  // Load profile pictures for notifications
  React.useEffect(() => {
    const loadProfilePics = async () => {
      console.log('🔍 Loading profile pics for notifications:', realTimeNotifications.length);

      for (const notif of realTimeNotifications) {
        // Extract user info from ALL notification types
        let userId: string | null = null;
        let userName: string | null = null;
        
        console.log('🔍 Processing notification for profile pic loading:', notif.type, notif.content);
        
        // Method 1: Look for ACTOR_ID or AUTHOR_ID in the notification content (most reliable)
        const actorIdMatch = notif.content.match(/<!--ACTOR_ID:(\d+)-->/);
        const authorIdMatch = notif.content.match(/<!--AUTHOR_ID:(\d+)-->/);
        if (actorIdMatch) {
          userId = actorIdMatch[1];
          console.log('🔍 Found ACTOR_ID for profile pic loading:', userId);
        } else if (authorIdMatch) {
          userId = authorIdMatch[1];
          console.log('🔍 Found AUTHOR_ID for profile pic loading:', userId);
        }
        
        // Method 2: For follow notifications: "Name|user_id started following you."
        if (!userId && notif.type?.toLowerCase() === 'follow') {
          const match = notif.content.match(/^(.+)\|(\d+)\s+started following you\.?/);
          if (match) {
            userName = match[1];
            userId = match[2];
            console.log('🔍 Follow notification for profile pic loading:', { userName, userId });
          }
        }
        
        // Method 3: Look for AUTHOR_NAME marker (most reliable for peso notifications)
        if (!userName) {
          const authorNameMatch = notif.content.match(/<!--AUTHOR_NAME:([^>]+)-->/);
          if (authorNameMatch) {
            userName = authorNameMatch[1];
            console.log('🔍 Found AUTHOR_NAME for profile pic loading:', userName);
          }
        }
        
        // Method 4: Extract user name from the beginning of the content for all types
        if (!userName) {
          const patterns = [
            /^([^<]+?)\s+(commented|mentioned|liked|started following)/i,
            /^([^<]+?)\s+(commented on|mentioned you in|liked your)/i,
            /^([^<]+?)\s+(donation|post)/i
          ];
          
          for (const pattern of patterns) {
            const nameMatch = notif.content.match(pattern);
            if (nameMatch) {
              userName = nameMatch[1].trim();
              console.log('🔍 Extracted user name for profile pic loading:', userName);
              break;
            }
          }
        }
        
        // Method 5: If we have userName but no userId, try to find userId from the content
        if (userName && !userId) {
          const idMatch = notif.content.match(/(\d+)/);
          if (idMatch) {
            userId = idMatch[1];
            console.log('🔍 Found potential userId for profile pic loading:', userId);
          }
        }
        
        console.log('🔍 Processing notification for profile pic:', { userId, userName, type: notif.type });
        
        // Check for AUTHOR_PIC marker first (most efficient for peso notifications)
        const authorPicMatch = notif.content.match(/<!--AUTHOR_PIC:([^>]+)-->/);
        if (authorPicMatch && userId) {
          const profilePicUrl = getProfilePicUrl(authorPicMatch[1]);
          console.log('🔍 Found AUTHOR_PIC for profile pic loading:', profilePicUrl);
          setUserProfilePics(prev => ({ ...prev, [userId!]: profilePicUrl }));
          loadedProfilePics.current.add(userId);
        } else if (userId && !loadedProfilePics.current.has(userId)) {
          console.log('🔍 Loading profile pic for userId:', userId);
          loadedProfilePics.current.add(userId);
          await fetchUserProfilePic(userId);
        } else if (userName && !userId && !loadedProfilePics.current.has(userName)) {
          console.log('🔍 Loading profile pic for userName:', userName);
          loadedProfilePics.current.add(userName);
          const userData = await searchUserByName(userName);
          if (userData && userData.profile_pic) {
            const profilePicUrl = getProfilePicUrl(userData.profile_pic);
            setUserProfilePics(prev => ({ ...prev, [userData.user_id]: profilePicUrl }));
          }
        }
      }
    };

    if (realTimeNotifications.length > 0) {
      loadProfilePics();
    }
  }, [realTimeNotifications]);

  // Cleanup old cache entries on component mount
  React.useEffect(() => {
    const cleanupCache = () => {
      const now = Date.now();
      const keysToRemove: string[] = [];
      
      // Clean up old cache entries
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.startsWith('profile_pic_') || key.startsWith('search_') || key.startsWith('searching_'))) {
          try {
            const value = sessionStorage.getItem(key);
            if (value) {
              const data = JSON.parse(value);
              // If it's a timestamp-based cache, check if expired
              if (data && data.timestamp && now - data.timestamp > 300000) { // 5 minutes
                keysToRemove.push(key);
              }
            }
          } catch (e) {
            // Remove corrupted entries
            keysToRemove.push(key);
          }
        }
      }
      
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    };

    cleanupCache();
    
    // Set up periodic cleanup every 5 minutes
    const cleanupInterval = setInterval(cleanupCache, 300000);
    
    return () => clearInterval(cleanupInterval);
  }, []);

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
            window.location.href = `/dashboard/${response.post_id}`;
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
        notificationIds = realTimeNotifications.map(n => n.id);
        confirmMessage = `Are you sure you want to delete ALL ${realTimeNotifications.length} notifications? This action cannot be undone.`;
      } else {
    if (selected.length === 0) return;
        notificationIds = selected;
        confirmMessage = `Are you sure you want to delete ${selected.length} selected notification${selected.length > 1 ? 's' : ''}?`;
      }
      
      if (window.confirm(confirmMessage)) {
        const result = await deleteNotifications(notificationIds);
    if (result.success) {
      // Refresh notifications after deletion
      await refreshNotifications();
      setSelected([]);
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
    if (selected.length === realTimeNotifications.length) {
      // If all are selected, unselect all
      setSelected([]);
    } else {
      // Otherwise, select all
      const allIds = realTimeNotifications.map(n => n.id);
      setSelected(allIds);
    }
  };


  // Real-time notifications are handled by the hook
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      navigate('/login');
      return;
    }
  }, [navigate]);

  const filteredNotifications = realTimeNotifications.filter((n: any) =>
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
    if (typeLower.includes('comment')) {
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
    const unreadNotifications = realTimeNotifications.filter(n => !n.is_read);
    if (unreadNotifications.length === 0) return;
    
    try {
      for (const notif of unreadNotifications) {
        await markNotificationAsRead(notif.id);
      }
      // Refresh notifications after marking all as read
      await refreshNotifications();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleNotificationRedirect = async (notif: any) => {
    try {
      console.log('Attempting to redirect for notification:', notif);
      console.log('Notification content:', notif.content);
      
      // Handle ALL post-related notifications (like, comment, mention, reply, repost, admin_peso_post)
      const isPostRelated = ['like', 'comment', 'mention', 'reply', 'repost', 'admin_peso_post'].some(type => 
        notif.type.toLowerCase().includes(type)
      );
      
      if (isPostRelated) {
        const postIdMatch = notif.content.match(/<!--POST_ID:(\d+)-->/);
        const forumIdMatch = notif.content.match(/<!--FORUM_ID:(\d+)-->/);
        const donationIdMatch = notif.content.match(/<!--DONATION_ID:(\d+)-->/);
        const commentIdMatch = notif.content.match(/<!--COMMENT_ID:(\d+)-->/);
        const replyIdMatch = notif.content.match(/<!--REPLY_ID:(\d+)-->/);
        const repostIdMatch = notif.content.match(/<!--REPOST_ID:(\d+)-->/);
        
        // Prioritize original post IDs over comment/reply IDs for better redirects
        const originalPostId = postIdMatch?.[1] || forumIdMatch?.[1] || donationIdMatch?.[1];
        const commentId = commentIdMatch?.[1];
        const replyId = replyIdMatch?.[1];
        const repostId = repostIdMatch?.[1];
        
        console.log('handleNotificationRedirect - Extracted IDs:', { 
          originalPostId, 
          commentId, 
          replyId,
          repostId,
          hasForumId: !!forumIdMatch,
          hasDonationId: !!donationIdMatch,
          notificationType: notif.type 
        });
        
        if (originalPostId || commentId || replyId || repostId) {
          const notificationType = notif.type.toLowerCase();
          
          // Check if it's a repost notification - handle it differently
          if (notificationType === 'repost' && repostId) {
            console.log('Repost notification detected - redirecting to repost:', repostId);
            if (forumIdMatch) {
              console.log('Forum repost notification - redirecting to forum page with repost_id:', repostId);
              localStorage.setItem('pendingForumPostView', forumIdMatch[1]); // Store forum_id for reference
              localStorage.setItem('pendingRepostId', repostId); // Store repost_id to display
              navigate('/forum');
              return;
            } else if (donationIdMatch) {
              console.log('Donation repost notification - redirecting to donation page with repost_id:', repostId);
              localStorage.setItem('pendingDonationPostView', donationIdMatch[1]); // Store donation_id for reference
              localStorage.setItem('pendingRepostId', repostId); // Store repost_id to display
              navigate('/donation');
              return;
            }
          }
          
          // Check if it's a forum or donation notification and redirect accordingly
          // This catches ALL types of notifications (like, comment, mention, etc.)
          if (forumIdMatch) {
            console.log('Forum notification detected - redirecting to forum page with forum_id:', forumIdMatch[1]);
            localStorage.setItem('pendingForumPostView', forumIdMatch[1]); // Use forum_id directly
            navigate('/forum');
            return;
          } else if (donationIdMatch) {
            console.log('Donation notification detected - redirecting to donation page with donation_id:', donationIdMatch[1]);
            localStorage.setItem('pendingDonationPostView', donationIdMatch[1]); // Use donation_id directly
            navigate('/donation');
            return;
          }
          
          // For mention notifications, prioritize original post IDs over comment/reply IDs
          if (notificationType === 'mention') {
            if (originalPostId) {
              console.log('Mention notification - redirecting to original post:', originalPostId);
              
              // Check if it's a forum or donation mention
              if (forumIdMatch) {
                console.log('Forum mention - redirecting to forum page with forum_id:', forumIdMatch[1]);
                localStorage.setItem('pendingForumPostView', forumIdMatch[1]); // Use forum_id directly
                navigate('/forum');
                return;
              } else if (donationIdMatch) {
                console.log('Donation mention - redirecting to donation page with donation_id:', donationIdMatch[1]);
                localStorage.setItem('pendingDonationPostView', donationIdMatch[1]); // Use donation_id directly
                navigate('/donation');
                return;
              } else {
                // Regular post mention
                localStorage.setItem('pendingPostView', originalPostId);
              
                // Redirect to dashboard
                const currentPath = window.location.pathname;
                if (currentPath.startsWith('/peso')) {
                  window.location.href = `/peso/dashboard/${originalPostId}`;
                } else if (currentPath.startsWith('/ccict')) {
                  window.location.href = `/ccict/dashboard/${originalPostId}`;
                } else {
                  window.location.href = `/dashboard/${originalPostId}`;
                }
                return;
              }
            } else if (commentId) {
              console.log('Mention notification - resolving comment to post:', commentId);
              // Need to resolve comment to post first
              try {
                const response = await getPostFromComment(parseInt(commentId));
                if (response.success && response.post_id) {
                  const resolvedPostId = response.post_id.toString();
                  const resolvedPostType = response.post_type;
                  console.log('Resolved comment to post ID:', resolvedPostId, 'Type:', resolvedPostType);
                  
                  // Check if this is a repost
                  if (resolvedPostType === 'repost') {
                    console.log('Repost comment mention - redirecting to repost modal');
                    localStorage.setItem('pendingRepostView', resolvedPostId);
                    
                    // Redirect to dashboard
                    const currentPath = window.location.pathname;
                    if (currentPath.startsWith('/peso')) {
                      window.location.href = `/peso/dashboard/${resolvedPostId}`;
                    } else if (currentPath.startsWith('/ccict')) {
                      window.location.href = `/ccict/dashboard/${resolvedPostId}`;
                    } else {
                      window.location.href = `/dashboard/${resolvedPostId}`;
                    }
                  }
                  // Check if this is a forum or donation post
                  else if (forumIdMatch) {
                    console.log('Forum comment mention - redirecting to forum page with forum_id:', forumIdMatch[1]);
                    localStorage.setItem('pendingForumPostView', forumIdMatch[1]); // Use forum_id directly
                    navigate('/forum');
                  } else if (donationIdMatch) {
                    console.log('Donation comment mention - redirecting to donation page with donation_id:', donationIdMatch[1]);
                    localStorage.setItem('pendingDonationPostView', donationIdMatch[1]); // Use donation_id directly
                    navigate('/donation');
                  } else {
                    // Regular post
                    localStorage.setItem('pendingPostView', resolvedPostId);
                    
                    // Redirect to dashboard with resolved post ID
                    const currentPath = window.location.pathname;
                    if (currentPath.startsWith('/peso')) {
                      window.location.href = `/peso/dashboard/${resolvedPostId}`;
                    } else if (currentPath.startsWith('/ccict')) {
                      window.location.href = `/ccict/dashboard/${resolvedPostId}`;
                    } else {
                      window.location.href = `/dashboard/${resolvedPostId}`;
                    }
                  }
                } else {
                  alert('Could not find the post for this mention.');
                }
              } catch (error) {
                console.error('Error resolving comment to post:', error);
                alert('Error loading the post. Please try again.');
              }
              return;
            } else if (replyId) {
              console.log('Mention notification - resolving reply to post:', replyId);
              // Need to resolve reply to post first
              try {
                const response = await getPostFromComment(parseInt(replyId));
                if (response.success && response.post_id) {
                  const resolvedPostId = response.post_id.toString();
                  const resolvedPostType = response.post_type;
                  console.log('Resolved reply to post ID:', resolvedPostId, 'Type:', resolvedPostType);
                  
                  // Check if this is a repost
                  if (resolvedPostType === 'repost') {
                    console.log('Repost reply mention - redirecting to repost modal');
                    localStorage.setItem('pendingRepostView', resolvedPostId);
                    
                    // Redirect to dashboard
                    const currentPath = window.location.pathname;
                    if (currentPath.startsWith('/peso')) {
                      window.location.href = `/peso/dashboard/${resolvedPostId}`;
                    } else if (currentPath.startsWith('/ccict')) {
                      window.location.href = `/ccict/dashboard/${resolvedPostId}`;
                    } else {
                      window.location.href = `/dashboard/${resolvedPostId}`;
                    }
                  }
                  // Check if this is a forum or donation post
                  else if (forumIdMatch) {
                    console.log('Forum reply mention - redirecting to forum page with forum_id:', forumIdMatch[1]);
                    localStorage.setItem('pendingForumPostView', forumIdMatch[1]); // Use forum_id directly
                    navigate('/forum');
                  } else if (donationIdMatch) {
                    console.log('Donation reply mention - redirecting to donation page with donation_id:', donationIdMatch[1]);
                    localStorage.setItem('pendingDonationPostView', donationIdMatch[1]); // Use donation_id directly
                    navigate('/donation');
                  } else {
                    // Regular post
                    localStorage.setItem('pendingPostView', resolvedPostId);
                    
                    // Redirect to dashboard with resolved post ID
                    const currentPath = window.location.pathname;
                    if (currentPath.startsWith('/peso')) {
                      window.location.href = `/peso/dashboard/${resolvedPostId}`;
                    } else if (currentPath.startsWith('/ccict')) {
                      window.location.href = `/ccict/dashboard/${resolvedPostId}`;
                    } else {
                      window.location.href = `/dashboard/${resolvedPostId}`;
                    }
                  }
                } else {
                  alert('Could not find the post for this mention.');
                }
              } catch (error) {
                console.error('Error resolving reply to post:', error);
                alert('Error loading the post. Please try again.');
              }
              return;
            }
          }
          
          // For other notification types (like, comment, reply), check if it's forum/donation first
          let postId = originalPostId || commentId || replyId;
          console.log(`${notificationType} notification - checking redirect for post:`, postId);
          
          // Validate post ID before redirecting
          if (postId && !isNaN(parseInt(postId))) {
            // Check if this is a forum or donation notification (even for like/comment/reply/repost)
            // Handle forum notifications (posts, reposts, comments, replies)
            if (forumIdMatch) {
              console.log(`${notificationType} notification - redirecting to forum page with forum_id:`, forumIdMatch[1]);
              localStorage.setItem('pendingForumPostView', forumIdMatch[1]); // Use forum_id directly
              if (repostId) {
                localStorage.setItem('pendingRepostId', repostId);
              }
              navigate('/forum');
              return;
            } 
            // Handle donation notifications (posts, reposts, comments, replies)
            else if (donationIdMatch) {
              console.log(`${notificationType} notification - redirecting to donation page with donation_id:`, donationIdMatch[1]);
              localStorage.setItem('pendingDonationPostView', donationIdMatch[1]); // Use donation_id directly
              if (repostId) {
                localStorage.setItem('pendingRepostId', repostId);
              }
              navigate('/donation');
              return;
            }
            
            // For regular posts with replies, we don't need to resolve - the IDs are already in the notification
            // This handles reply notifications that now include POST_ID/FORUM_ID/DONATION_ID
            
            // For regular posts (not forum/donation), we need to resolve comment IDs first
            console.log(`Regular post notification - checking for post:`, postId);
            
            // If this is a comment-only notification for regular posts, we need to get the post ID first
            if (commentIdMatch && !originalPostId) {
              console.log('Regular comment-only notification - resolving to post before redirect');
              try {
                const commentIdNum = parseInt(commentId!);
                const response = await getPostFromComment(commentIdNum);
                if (response.success && response.post_id) {
                  const resolvedPostId = response.post_id.toString();
                  const resolvedPostType = response.post_type;
                  console.log('Resolved comment to post ID:', resolvedPostId, 'Type:', resolvedPostType);
                  
                  // Check if this is a repost
                  if (resolvedPostType === 'repost') {
                    console.log('Comment is on a repost - redirecting to repost modal');
                    localStorage.setItem('pendingRepostView', resolvedPostId);
                    
                    // Redirect to dashboard
                    const currentPath = window.location.pathname;
                    if (currentPath.startsWith('/peso')) {
                      window.location.href = `/peso/dashboard/${resolvedPostId}`;
                    } else if (currentPath.startsWith('/ccict')) {
                      window.location.href = `/ccict/dashboard/${resolvedPostId}`;
                    } else {
                      window.location.href = `/dashboard/${resolvedPostId}`;
                    }
                    return;
                  } else {
                    postId = resolvedPostId;
                  }
                } else {
                  console.error('Could not resolve comment to post');
                  alert('Could not find the post for this comment. It may have been deleted.');
                  return;
                }
              } catch (error) {
                console.error('Error resolving comment to post:', error);
                alert('Error loading the post. Please try again.');
                return;
              }
            }
            
            // Clear any existing pending views first
            localStorage.removeItem('pendingPostView');
            localStorage.removeItem('pendingRepostView');
            
            const typeStr = (notif.type || '').toLowerCase();
            const contentStr = (notif.content || '').toLowerCase();
            const isRepostContext = !!repostId || typeStr.includes('repost') || contentStr.includes('your repost') || contentStr.includes('reposted');
            if (repostId) {
              // Open the repost modal directly when we have a valid repost ID
              localStorage.setItem('pendingRepostView', repostId);
            } else {
              // Otherwise open the original post modal
              localStorage.setItem('pendingPostView', postId);
            }
            
            // Store profile picture information from notification for peso posts
            const authorPicMatch = notif.content.match(/<!--AUTHOR_PIC:([^>]+)-->/);
            const authorIdMatch = notif.content.match(/<!--AUTHOR_ID:(\d+)-->/);
            if (authorPicMatch && authorIdMatch) {
              const profilePicData = {
                userId: authorIdMatch[1],
                profilePicUrl: authorPicMatch[1],
                timestamp: Date.now()
              };
              localStorage.setItem('pendingProfilePic', JSON.stringify(profilePicData));
              console.log('🔍 Stored profile pic data for redirect:', profilePicData);
            }
            
            // Add a small delay to ensure proper navigation
            setTimeout(() => {
              // Redirect to dashboard with post ID in URL
              const currentPath = window.location.pathname;
              if (currentPath.startsWith('/peso')) {
                navigate(`/peso/dashboard/${postId}`);
              } else if (currentPath.startsWith('/ccict')) {
                navigate(`/ccict/dashboard/${postId}`);
              } else {
                navigate(`/dashboard/${postId}`);
              }
            }, 100);
            return;
          } else {
            console.log('Invalid post ID, redirecting to main dashboard');
            // Fallback to main dashboard
            const userStr = localStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;
            const userId = user?.user_id || user?.id;
            if (userId) {
              const currentPath = window.location.pathname;
              if (currentPath.startsWith('/peso')) {
                window.location.href = `/peso/dashboard/${userId}`;
              } else if (currentPath.startsWith('/ccict')) {
                window.location.href = `/ccict/dashboard/${userId}`;
              } else {
                window.location.href = `/dashboard/${userId}`;
              }
              return;
            }
          }
        }
      }
      
      // Fallback for non-post-related notifications (follow, system, etc.)
      console.log('Non-post-related notification, using fallback logic');
      
      // Handle follow/following notifications - redirect to user's profile
      const isFollowNotification = notif.type.toLowerCase().includes('follow');
      if (isFollowNotification) {
        console.log('Follow notification detected - attempting to extract user ID');
        // Extract user ID from notification content (format: "Name|user_id started following you")
        const userIdMatch = notif.content.match(/\|(\d+)\s/);
        if (userIdMatch) {
          const userId = userIdMatch[1];
          console.log('Found user ID in follow notification:', userId);
          
          // Redirect to the user's profile
          const currentPath = window.location.pathname;
          if (currentPath.startsWith('/peso')) {
            window.location.href = `/peso/profile/${userId}`;
          } else if (currentPath.startsWith('/ccict')) {
            window.location.href = `/ccict/profile/${userId}`;
          } else {
            window.location.href = `/profile/${userId}`;
          }
          return;
        } else {
          console.log('No user ID found in follow notification content');
        }
      }
      
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
          window.location.href = `/dashboard/${postId}`;
        }
        return;
      } else {
        console.log('No post ID found in notification content');
        // Only show alert for notifications that aren't follow notifications
        if (!isFollowNotification) {
          // Old notification format without Post ID
          alert('This notification is from an older version. Please check the dashboard to view recent posts.');
        }
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
            dashboardPath = `/dashboard/${userId}`;
          } else {
            dashboardPath = `/dashboard/${userId}`;
          }
          
          navigate(dashboardPath);
        }
      }
    } catch (error) {
      console.error('Error handling notification redirect:', error);
      // Instead of showing an alert, redirect to the main dashboard
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
          dashboardPath = `/dashboard/${userId}`;
        } else {
          dashboardPath = `/dashboard/${userId}`;
        }
        
        console.log('Redirecting to main dashboard due to error:', dashboardPath);
        navigate(dashboardPath);
      } else {
        alert('Unable to redirect. Please try refreshing the page.');
      }
    }
  };

  const fetchUserProfilePic = async (userId: string) => {
    // Check if we already have this profile pic cached
    if (userProfilePics[userId]) {
      return userProfilePics[userId];
    }

    // Check if we're already loading this profile pic
    if (loadingProfilePics.has(userId)) {
      console.log('Profile pic already loading for user', userId);
      return null;
    }

    // Check session storage cache
    const cacheKey = `profile_pic_${userId}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const cachedData = JSON.parse(cached);
        console.log('Using cached profile pic for user', userId);
        setUserProfilePics(prev => ({ ...prev, [userId]: cachedData }));
        return cachedData;
      } catch (e) {
        // If cache is corrupted, remove it
        sessionStorage.removeItem(cacheKey);
      }
    }

    // Rate limiting: prevent too many API calls in a short period
    const now = Date.now();
    if (now - lastApiCall < 1000) { // Wait at least 1 second between API calls
      console.log('Rate limiting: waiting before API call for user', userId);
      return null; // Don't make the call, just return null
    }
    setLastApiCall(now);

    // Mark as loading
    setLoadingProfilePics(prev => new Set(prev).add(userId));

    try {
      const response = await api.get(`alumni/profile/${userId}/`);
      console.log('🔍 Profile API response for user', userId, ':', response.data);
      if (response.data && response.data.profile_pic) {
        const baseUrl = getProfilePicUrl(response.data.profile_pic);
        const profilePicUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}cb=${Date.now()}`;
        console.log('🔍 Setting profile pic URL:', profilePicUrl);
        setUserProfilePics(prev => {
          const newPics = { ...prev, [userId]: profilePicUrl };
          console.log('🔍 Updated userProfilePics:', newPics);
          return newPics;
        });
        setProfilePicUpdateTrigger(prev => prev + 1);
        
        // Cache the result for 10 minutes
        sessionStorage.setItem(cacheKey, JSON.stringify(profilePicUrl));
        return profilePicUrl;
      } else {
        console.log('🔍 No profile picture found in API response for user', userId);
        // Cache null result for 5 minutes to prevent repeated failed requests
        sessionStorage.setItem(cacheKey, JSON.stringify(null));
        setTimeout(() => sessionStorage.removeItem(cacheKey), 300000);
      }
    } catch (error) {
      console.error('🔍 Error fetching user profile pic:', error);
      // Cache null result for 2 minutes to prevent repeated failed requests
      sessionStorage.setItem(cacheKey, JSON.stringify(null));
      setTimeout(() => sessionStorage.removeItem(cacheKey), 120000);
    } finally {
      // Remove from loading set
      setLoadingProfilePics(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
    return null;
  };

  const searchUserByName = async (userName: string) => {
    // Add caching to prevent repeated API calls
    const cacheKey = `search_${userName}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const cachedData = JSON.parse(cached);
        console.log('Using cached search result for', userName);
        return cachedData;
      } catch (e) {
        // If cache is corrupted, remove it
        sessionStorage.removeItem(cacheKey);
      }
    }

    // Check if we're already searching for this user
    const searchKey = `searching_${userName}`;
    if (sessionStorage.getItem(searchKey)) {
      console.log('Search already in progress for', userName);
      return null;
    }

    // Rate limiting: prevent too many API calls in a short period
    const now = Date.now();
    if (now - lastApiCall < 1000) { // Wait at least 1 second between API calls
      console.log('Rate limiting: waiting before search for', userName);
      return null; // Don't make the call, just return null
    }
    setLastApiCall(now);

    // Mark as searching
    sessionStorage.setItem(searchKey, 'true');

    try {
      const response = await api.get(`alumni/search/?q=${encodeURIComponent(userName)}`);
      console.log('Search response for', userName, ':', response.data);
      
      if (response.data && response.data.results && response.data.results.length > 0) {
        // Find exact match or first close match
        const exactMatch = response.data.results.find((user: any) => 
          user.name === userName || 
          user.full_name === userName ||
          `${user.f_name || ''} ${user.m_name || ''} ${user.l_name || ''}`.trim() === userName
        );
        const user = exactMatch || response.data.results[0];
        console.log('Found user:', user);
        const result = {
          user_id: user.user_id || user.id,
          profile_pic: user.profile_pic
        };
        
        // Cache the result for 5 minutes
        sessionStorage.setItem(cacheKey, JSON.stringify(result));
        return result;
      }
    } catch (error) {
      console.error('Error searching user by name:', error);
      // Cache null result for 1 minute to prevent repeated failed requests
      sessionStorage.setItem(cacheKey, JSON.stringify(null));
      setTimeout(() => sessionStorage.removeItem(cacheKey), 60000);
    } finally {
      // Remove searching flag
      sessionStorage.removeItem(searchKey);
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
      const profilePicUrl = userData.profile_pic 
        ? getProfilePicUrl(userData.profile_pic)
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
              // Fallback to CTU logo if image fails to load
              const target = e.target as HTMLImageElement;
              target.src = ctulogo;
            }}
          />
        );
      }
    }
    
    // Fallback to CTU logo
    return (
      <img
        src={ctulogo}
        alt={userName}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: '50%'
        }}
      />
    );
  };

  const ProfilePicComponent = ({ userId, userName, size = '40px', directPicUrl }: { userId?: string, userName: string, size?: string, directPicUrl?: string }) => {
    const [profilePicUrl, setProfilePicUrl] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    
    React.useEffect(() => {
      const loadProfilePic = async () => {
        try {
          console.log('ProfilePicComponent loading:', { userId, userName, directPicUrl });
          
          // If we have a direct profile picture URL, use it immediately
          if (directPicUrl) {
            const normalizedUrl = getProfilePicUrl(directPicUrl);
            console.log('Using direct profile pic URL:', normalizedUrl);
            // Persist mapping by userId when available so list items reuse it by ID
            if (userId) {
              setUserProfilePics(prev => ({ ...prev, [userId]: normalizedUrl }));
            }
            setProfilePicUrl(normalizedUrl);
            setIsLoading(false);
            return;
          }
          
          if (userId) {
            // Try to get from cache first
            if (userProfilePics[userId]) {
              console.log('Found cached profile pic for user:', userId);
              setProfilePicUrl(userProfilePics[userId]);
              setIsLoading(false);
              return;
            }
            
            // Fetch from API using the correct alumni/profile endpoint
            console.log('Fetching profile pic from API for user:', userId);
            const response = await api.get(`alumni/profile/${userId}/`);
            console.log('API response for user:', userId, response.data);
            
            if (response.data && response.data.profile_pic) {
              const baseUrl = getProfilePicUrl(response.data.profile_pic);
              const withBust = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}cb=${Date.now()}`;
              console.log('Setting profile pic URL:', withBust);
              setUserProfilePics(prev => ({ ...prev, [userId]: withBust }));
              setProfilePicUrl(withBust);
            } else {
              console.log('No profile pic found for user:', userId);
            }
          } else if (userName) {
            // Search by name
            console.log('Searching user by name:', userName);
            const userData = await searchUserByName(userName);
            console.log('Search result:', userData);
            
            if (userData && userData.profile_pic) {
              const normalizedUrl = getProfilePicUrl(userData.profile_pic);
              console.log('Setting profile pic URL from search:', normalizedUrl);
              // Bind to actual user id from search for future lookups by ID
              if (userData.user_id) {
                setUserProfilePics(prev => ({ ...prev, [String(userData.user_id)]: normalizedUrl }));
              }
              setProfilePicUrl(normalizedUrl);
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
    }, [userId, userName, directPicUrl]);
    
    if (isLoading) {
      return (
        <img
          src={ctulogo}
          alt={userName}
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
          alt={userName}
          style={{
            width: size,
            height: size,
            objectFit: 'cover',
            borderRadius: '50%'
          }}
          onError={(e) => {
            // Fallback to CTU logo if image fails to load
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
        alt={userName}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: '50%'
        }}
      />
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
                {realTimeNotifications.filter(n => !n.is_read).length} unread notifications
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
                  title={selected.length === realTimeNotifications.length ? "Unselect All" : "Select All"}
                >
                  {selected.length === realTimeNotifications.length ? "Unselect All" : "Select All"}
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
              {isLoading ? (
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
                    key={`${notif.id}-${profilePicUpdateTrigger}`}
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
                          // Use real-time hook to mark as read
                          await markAsReadRealTime(notif.id);
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
                    overflow: 'visible',
                    position: 'relative'
                  }}>
                    {(() => {
                      // Extract basic actor identity from content to resolve avatar
                      let userId: string = '';
                      let userName: string = '';

                      const actorIdMatch = notif.content.match(/<!--ACTOR_ID:(\d+)-->/);
                      const authorIdMatch = notif.content.match(/<!--AUTHOR_ID:(\d+)-->/);
                      if (actorIdMatch) {
                        userId = actorIdMatch[1];
                      } else if (authorIdMatch) {
                        userId = authorIdMatch[1];
                      }

                      if (!userId && notif.type?.toLowerCase() === 'follow') {
                        const match = notif.content.match(/^(.+)\|(\d+)\s+started following you\.?/);
                        if (match) {
                          userName = match[1];
                          userId = match[2];
                        }
                      }

                      // Check for AUTHOR_NAME marker (most reliable for peso notifications)
                      if (!userName) {
                        const authorNameMatch = notif.content.match(/<!--AUTHOR_NAME:([^>]+)-->/);
                        if (authorNameMatch) {
                          userName = authorNameMatch[1];
                        }
                      }

                      if (!userName) {
                        const nameMatch = notif.content.match(/^([^<]+?)\s+(commented|mentioned|liked|started following|donation|post)/i);
                        if (nameMatch) {
                          userName = nameMatch[1].trim();
                        }
                      }

                      // Check for AUTHOR_PIC marker (most efficient for peso notifications)
                      const authorPicMatch = notif.content.match(/<!--AUTHOR_PIC:([^>]+)-->/);
                      const directPicUrl = authorPicMatch ? authorPicMatch[1] : undefined;

                      return (
                        <ProfilePicComponent
                          userId={userId || undefined}
                          userName={userName || 'User'}
                          size="48px"
                          directPicUrl={directPicUrl}
                        />
                      );
                    })()}

                    {/* Minimalist type icon badge */}
                    <div style={{
                      position: 'absolute',
                      right: '-6px',
                      bottom: '-6px',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: '#ffffff',
                      border: '2px solid #ffffff',
                      outline: '1px solid #e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.12)'
                    }}>
                      {(() => {
                        const t = (notif.type || '').toLowerCase();
                        const svgProps = { width: 10, height: 10, viewBox: '0 0 24 24', fill: 'none', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
                        if (t.includes('like')) {
                          return (
                            <svg {...svgProps} stroke="#ef4444">
                              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                            </svg>
                          );
                        }
                        if (t.includes('comment')) {
                          return (
                            <svg {...svgProps} stroke="#3b82f6">
                              <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                            </svg>
                          );
                        }
                        if (t.includes('repost') || t.includes('re-share') || t.includes('share')) {
                          return (
                            <svg {...svgProps} stroke="#10b981">
                              <polyline points="17 1 21 5 17 9" />
                              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                              <polyline points="7 23 3 19 7 15" />
                              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                            </svg>
                          );
                        }
                        if (t.includes('follow')) {
                          return (
                            <svg {...svgProps} stroke="#f59e0b">
                              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                              <circle cx="9" cy="7" r="4" />
                              <path d="M20 8v6" />
                              <path d="M23 11h-6" />
                            </svg>
                          );
                        }
                        if (t.includes('mention')) {
                          return (
                            <svg {...svgProps} stroke="#8b5cf6">
                              <path d="M16 8a6 6 0 1 0 2 4.9V8" />
                              <path d="M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
                            </svg>
                          );
                        }
                        // default: notification bell
                        return (
                          <svg {...svgProps} stroke="#6b7280">
                            <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                            <path d="M13.73 21a2 2 0 01-3.46 0" />
                          </svg>
                        );
                      })()}
                    </div>
                  </div>
                  
                  {/* Notification Icon Overlay removed */}
                  
                  
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
                                    navigate(`/profile/${followerId}`);
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
                  
                  {/* Unread indicator removed */}
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
            
            {/* Header with avatar */}
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
                    const actorIdMatch = openNotif.content?.match(/<!--ACTOR_ID:(\d+)-->/);
                    const authorIdMatch = openNotif.content?.match(/<!--AUTHOR_ID:(\d+)-->/);
                    return actorIdMatch?.[1] || authorIdMatch?.[1] || undefined;
                  })()}
                  userName={(() => {
                    if (openNotif.type && openNotif.type.toLowerCase() === 'follow') {
                      const match = openNotif.content.match(/^(.+)\|(\d+)\s+started following you\.?/);
                      return match ? match[1] : '';
                    }
                    // Check for AUTHOR_NAME marker (for PESO/Admin posts)
                    const authorNameMatch = openNotif.content.match(/<!--AUTHOR_NAME:([^>]+)-->/);
                    if (authorNameMatch) {
                      return authorNameMatch[1];
                    }
                    // Fallback to pattern matching
                    const nameMatch = openNotif.content.match(/^([^<]+?)\s+(commented|mentioned|liked|reposted|shared|posted|created)/i);
                    return nameMatch ? nameMatch[1].trim() : '';
                  })()}
                  size="40px"
                  directPicUrl={(() => {
                    // Extract AUTHOR_PIC marker for PESO/Admin posts
                    const authorPicMatch = openNotif.content?.match(/<!--AUTHOR_PIC:([^>]+)-->/);
                    return authorPicMatch ? authorPicMatch[1] : undefined;
                  })()}
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
                              navigate(`/profile/${followerId}`);
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
              ) : (openNotif.type && openNotif.type.toLowerCase() === 'repost') ? (
                <div style={{
                  background: '#f8f9fa',
                  borderRadius: '12px',
                  padding: '16px',
                  border: '1px solid #e9ecef'
                }}>
                  {/* Main Post Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '16px'
                  }}>
                    {/* Profile Picture */}
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
                          const authorIdMatch = openNotif.content?.match(/<!--AUTHOR_ID:(\d+)-->/);
                          return actorIdMatch?.[1] || authorIdMatch?.[1] || undefined;
                        })()}
                        userName={(() => {
                          // Check for AUTHOR_NAME marker first
                          const authorNameMatch = openNotif.content.match(/<!--AUTHOR_NAME:([^>]+)-->/);
                          if (authorNameMatch) {
                            return authorNameMatch[1];
                          }
                          const nameMatch = openNotif.content.match(/^([^<]+?)\s+(reposted)/i);
                          return nameMatch ? nameMatch[1].trim() : '';
                        })()}
                        size="40px"
                        directPicUrl={(() => {
                          const authorPicMatch = openNotif.content?.match(/<!--AUTHOR_PIC:([^>]+)-->/);
                          return authorPicMatch ? authorPicMatch[1] : undefined;
                        })()}
                      />
                    </div>
                    
                    {/* User Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '700',
                        color: '#333',
                        marginBottom: '2px'
                      }}>
                        {(() => {
                          const nameMatch = openNotif.content.match(/^([^<]+?)\s+(reposted)/i);
                          return nameMatch ? nameMatch[1].trim() : 'User';
                        })()}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#666'
                      }}>
                        {formatHybrid(openNotif.date)}
                      </div>
                    </div>
                    
                    {/* More Options */}
                    <div style={{
                      color: '#666',
                      cursor: 'pointer',
                      fontSize: '18px',
                      fontWeight: 'bold'
                    }}>
                      ⋯
                    </div>
                  </div>
                  
                  {/* Reposted Content Block */}
                  <div style={{
                    background: 'white',
                    borderRadius: '8px',
                    padding: '16px',
                    border: '1px solid #e9ecef',
                    marginBottom: '16px'
                  }}>
                    {/* Original Post Header */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '12px'
                    }}>
                      {/* Original Poster Profile Picture */}
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        flexShrink: 0
                      }}>
                      <ProfilePicComponent 
                        userId={(() => {
                            const originalPosterMatch = openNotif.content.match(/<!--ORIGINAL_POSTER_ID:(\d+)-->/);
                            return originalPosterMatch ? originalPosterMatch[1] : undefined;
                          })()}
                          userName={(() => {
                            const originalPosterMatch = openNotif.content.match(/<!--ORIGINAL_POSTER_NAME:([^>]+)-->/);
                            return originalPosterMatch ? originalPosterMatch[1] : 'Original Poster';
                          })()}
                          size="32px"
                          directPicUrl={(() => {
                            const picMatch = openNotif.content.match(/<!--ORIGINAL_POSTER_PIC:([^>]+)-->/);
                            return picMatch ? picMatch[1] : undefined;
                          })()}
                        />
                      </div>
                      
                      {/* Original Poster Info */}
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '700',
                          color: '#333',
                          marginBottom: '2px'
                        }}>
                          {(() => {
                            const originalPosterMatch = openNotif.content.match(/<!--ORIGINAL_POSTER_NAME:([^>]+)-->/);
                            return originalPosterMatch ? originalPosterMatch[1] : 'Original Poster';
                          })()}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: '#666'
                        }}>
                          {(() => {
                            const originalDateMatch = openNotif.content.match(/<!--ORIGINAL_DATE:([^>]+)-->/);
                            return originalDateMatch ? formatHybrid(originalDateMatch[1]) : 'Some time ago';
                          })()}
                        </div>
                      </div>
                    </div>
                    
                    {/* Original Post Content */}
                    <div style={{
                      fontSize: '14px',
                      color: '#333',
                      lineHeight: '1.4',
                      marginBottom: '12px'
                    }}>
                      {(() => {
                        // Extract original post content, removing HTML comments
                        const contentMatch = openNotif.content.match(/reposted your post[^:]*:\s*([\s\S]+?)(?:\s*<!--|$)/);
                        if (contentMatch) {
                          return contentMatch[1].replace(/<!--[^>]+-->/g, '').trim();
                        }
                        // Fallback: show cleaned content
                        return openNotif.content.replace(/<!--[^>]+-->/g, '').replace(/^[^:]+:\s*/, '').trim();
                      })()}
                    </div>
                    
                    {/* No likes yet */}
                    <div style={{
                      fontSize: '12px',
                      color: '#666',
                      marginBottom: '12px'
                    }}>
                      No likes yet
                    </div>
                    
                    {/* Interaction Buttons */}
                    <div style={{
                      display: 'flex',
                      gap: '24px',
                      alignItems: 'center'
                    }}>
                      {/* Like Button */}
                      <button style={{
                        background: 'none',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        color: '#666',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}>
                        <span style={{ fontSize: '16px' }}>👍</span>
                        Like
                      </button>
                      
                      {/* Comment Button */}
                      <button style={{
                        background: 'none',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        color: '#666',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}>
                        <span style={{ fontSize: '16px' }}>💬</span>
                        Comment
                      </button>
                      
                      {/* Repost Button */}
                      <button style={{
                        background: 'none',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        color: '#666',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}>
                        <span style={{ fontSize: '16px' }}>🔄</span>
                        Repost
                      </button>
                    </div>
                  </div>
                  
                  {/* View Post Button */}
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
                      width: '100%',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#0056b3';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#0066cc';
                    }}
                    onClick={async () => {
                      // Extract repost ID and/or original post ID
                      const repostIdMatch = openNotif.content.match(/<!--REPOST_ID:(\d+)-->/);
                      const postIdMatch = openNotif.content.match(/<!--POST_ID:(\d+)-->/);
                      
                      if (repostIdMatch || postIdMatch) {
                        const repostId = repostIdMatch?.[1] || null;
                        const postId = postIdMatch?.[1] || null;
                        // Detect repost context even if REPOST_ID isn't embedded
                        const typeStr = (openNotif.type || '').toLowerCase();
                        const contentStr = (openNotif.content || '').toLowerCase();
                        const isRepostContext = !!repostId || typeStr.includes('repost') || contentStr.includes('your repost') || contentStr.includes('reposted');
                        setPostLoading(true);
                        
                        try {
                          // If we have a repost ID, prioritize showing the repost UI
                          const response = await api.get(`posts/${(postId || repostId)}/detail/`);
                          if (response.data) {
                            setOpenNotif(null);
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
                                dashboardPath = `/dashboard/${userId}`;
                              } else {
                                dashboardPath = `/dashboard/${userId}`;
                              }
                              
                              // Clear previous pending keys to avoid double-opening
                              localStorage.removeItem('pendingPostView');
                              localStorage.removeItem('pendingRepostView');
                              if (repostId) {
                                localStorage.setItem('pendingRepostView', repostId);
                              } else if (postId) {
                                localStorage.setItem('pendingPostView', postId);
                              }
                              navigate(dashboardPath);
                            }
                          }
                        } catch (error: any) {
                          if (error.response && error.response.status === 404) {
                            console.log('Post not found (404) - likely deleted');
                            // Don't show alert for deleted posts to avoid spam
                          } else {
                            alert('Unable to load the post. It may have been deleted.');
                          }
                        } finally {
                          setPostLoading(false);
                        }
                      }
                    }}
                    disabled={postLoading}
                  >
                    {postLoading ? 'Loading...' : 'View Post'}
                  </button>
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
                      // Try to extract IDs from notification content first
                      const postIdMatch = openNotif.content.match(/<!--POST_ID:(\d+)-->/);
                      const repostIdMatch = openNotif.content.match(/<!--REPOST_ID:(\d+)-->/);
                      const forumIdMatch = openNotif.content.match(/<!--FORUM_ID:(\d+)-->/);
                      const donationIdMatch = openNotif.content.match(/<!--DONATION_ID:(\d+)-->/);
                      const visibleIdMatch = openNotif.content.match(/Post ID:\s*(\d+)/i);
                      
                      const matchResult = postIdMatch || forumIdMatch || donationIdMatch || visibleIdMatch;
                      
                      // Handle forum and donation posts first (for any notification type)
                      if (forumIdMatch && matchResult) {
                        // Forum post - redirect to forum page directly
                        const postId = matchResult[1];
                        setOpenNotif(null);
                        localStorage.setItem('pendingForumPostView', postId);
                        navigate('/forum');
                        return;
                      } else if (donationIdMatch && matchResult) {
                        // Donation post - redirect to donation page directly
                        const postId = matchResult[1];
                        setOpenNotif(null);
                        localStorage.setItem('pendingDonationPostView', postId);
                        navigate('/donation');
                        return;
                      }
                      
                      // Handle reply notifications specially (only for regular posts)
                      if (openNotif.type && openNotif.type.toLowerCase() === 'reply' && openNotif.content.includes('replied to your comment')) {
                        await handleReplyNotificationClick(openNotif);
                        return;
                      }
                      
                      // Handle mention notifications specially (only for regular posts)
                      if (openNotif.type && openNotif.type.toLowerCase() === 'mention' && openNotif.content.includes('mentioned you')) {
                        await handleReplyNotificationClick(openNotif);
                        return;
                      }
                      
                      if (matchResult) {
                        const postId = matchResult[1];
                        const repostId = repostIdMatch?.[1] || null;
                        setPostLoading(true);
                        
                        try {
                          let dashboardPath = '';
                          let actualPostId = postId;
                          
                          // If this is a comment ID, we need to get the post from the comment
                          const commentIdMatch = openNotif.content.match(/<!--COMMENT_ID:(\d+)-->/);
                          if (commentIdMatch && !postIdMatch && !forumIdMatch && !donationIdMatch) {
                            console.log('Comment-only notification - resolving to post');
                            const commentId = parseInt(commentIdMatch[1]);
                            const commentResponse = await getPostFromComment(commentId);
                            if (commentResponse.success && commentResponse.post_id) {
                              actualPostId = commentResponse.post_id.toString();
                            } else {
                              throw new Error('Could not resolve comment to post');
                            }
                          }
                          
                          // Regular post (forum and donation already handled above)
                          const response = await api.get(`posts/${actualPostId}/detail/`);
                          
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
                                dashboardPath = `/dashboard/${userId}`;
                              } else {
                                dashboardPath = `/dashboard/${userId}`;
                              }
                              
                              // Store repost or post ID for dashboard to open
                              if (repostId) {
                                localStorage.setItem('pendingRepostView', repostId);
                              } else if (postId) {
                                localStorage.setItem('pendingPostView', postId);
                              }
                              navigate(dashboardPath);
                            }
                          }
                        } catch (error: any) {
                          // Post doesn't exist or error occurred
                          if (error.response && error.response.status === 404) {
                            console.log('Post not found (404) - likely deleted');
                            // Don't show alert for deleted posts to avoid spam
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
                          } else {
                            // Unified dashboard for alumni and OJT users
                            dashboardPath = `/dashboard/${userId}`;
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

