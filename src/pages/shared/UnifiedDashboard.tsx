import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AlumniTopBar from '../alumni/AlumniTopBar';
import PostCreate from '../alumni/PostCreate';
import PostCard from '../../components/PostCard';
import ctulogo from '../../images/ctulogo.png';
import '../alumni/dashboard.css';
import '../alumni/profile.css';
import { getPosts, followUser, getAdminPesoUsers, api } from '../../services/api';

interface UnifiedDashboardProps {
  userType: 'alumni' | 'peso' | 'admin' | 'ojt';
  userId?: string;
}

// Types from AlumniDashboard
interface AlumniUser {
  name: string;
  course?: string;
  year_graduated?: string | number;
  profile_pic?: string;
  location?: string;
  university?: string;
  user_id?: number;
  id?: number;
  following?: { user_id: number }[];
}
interface RepostItem {
  repost_id: number;
  repost_date: string;
  repost_caption?: string;
  user: {
    m_name: any;
    user_id: number;
    f_name: string;
    l_name: string;
    profile_pic?: string;
  };
  original_post?: PostItem;
}
interface CommentItem {
  comment_id: number;
  comment_content: string;
  date_created: string;
  user: {
    user_id: number;
    f_name: string;
    l_name: string;
    profile_pic?: string;
  };
}
interface LikeItem {
  user_id: number;
  f_name: string;
  l_name: string;
  profile_pic?: string;
  initials?: string;
}

interface PostItem {
  post_id: number;
  post_title?: string;
  post_content: string;
  post_image?: string | null;
  created_at?: string | null;
  likes_count?: number;
  comments_count?: number;
  user?: {
    user_id?: number;
    f_name?: string;
    l_name?: string;
    profile_pic?: string;
    name?: string;
    account_type?: { ccict?: boolean; peso?: boolean; admin?: boolean };
  };
  comments?: CommentItem[];
  reposts?: RepostItem[];
  likes?: LikeItem[];
  liked_by_user?: boolean;
  item_type?: 'post' | 'repost';  // New: distinguish between post and repost items
  sort_date?: string;  // New: for sorting feed items
}

interface RepostFeedItem {
  repost_id: number;
  repost_date: string;
  repost_caption?: string;
  likes_count?: number;
  comments_count?: number;
  likes?: LikeItem[];
  comments?: CommentItem[];
  user: {
    user_id: number;
    f_name: string;
    l_name: string;
    profile_pic?: string;
  };
  original_post: PostItem;
  item_type: 'repost';
  sort_date: string;
}

type FeedItem = PostItem | RepostFeedItem;
interface SuggestedUser {
  id: number;
  name: string;
  profile_pic: string;
  batch?: string | number;
  isFollowing?: boolean;
}

function getPostTimestamp(post: PostItem): string | null {
  const candidates: unknown[] = [
    (post as any).created_at,
    (post as any).date_created,
    (post as any).createdAt,
    (post as any).created,
    (post as any).timestamp,
    (post as any).posted_at,
  ];
  for (const raw of candidates) {
    const iso = normalizeToISO(raw);
    if (iso) return iso;
  }
  return null;
}
function normalizeToISO(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date && !isNaN(raw.valueOf())) {
    return raw.toISOString();
  }
  if (typeof raw === 'number') {
    const ms = raw > 1e12 ? raw : raw * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof raw === 'string') {
    let ms = Date.parse(raw);
    if (!Number.isNaN(ms)) return new Date(ms).toISOString();
    const hasOffset = /[+\-]\d{2}:?\d{2}$/.test(raw);
    const withT = raw.replace(' ', 'T');
    ms = Date.parse(withT + (hasOffset ? '' : 'Z'));
    if (!Number.isNaN(ms)) return new Date(ms).toISOString();
  }
  return null;
}
function formatHybrid(iso?: string | null): string {
  if (!iso) return 'Unknown time';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return 'Unknown time';
  const diffMs = Date.now() - ms;
  const min = Math.floor(diffMs / 60000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day >= 1) {
    return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
  if (hr >= 1) return hr === 1 ? '1 hour ago' : `${hr} hours ago`;
  if (min >= 1) return min === 1 ? '1 minute ago' : `${min} minutes ago`;
  return 'Just now';
}

function getCurrentUserId(user: AlumniUser | null): number | null {
  if (!user) return null;
  if (typeof user.user_id === 'number') return user.user_id;
  if (typeof user.id === 'number') return user.id;
  return null;
}

function formatDisplayName(user: any, isOwn: boolean, currentUser: AlumniUser | null): string {
  if (isOwn && currentUser?.name) {
    return currentUser.name;
  }
  
  // For other users, construct name from f_name, m_name, l_name
  const parts = [];
  if (user?.f_name) parts.push(user.f_name);
  if (user?.m_name) parts.push(user.m_name);
  if (user?.l_name) parts.push(user.l_name);
  
  return parts.join(' ').trim() || 'Unknown User';
}

const UnifiedDashboard: React.FC<UnifiedDashboardProps> = ({ userType, userId }) => {
  // All state and logic from AlumniDashboard, but use userType for admin/peso logic
  const [user, setUser] = useState<AlumniUser | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const [followLoading, setFollowLoading] = useState<{ [key: number]: boolean }>({});
  const [showComposer, setShowComposer] = useState(false);
  const [adminUserIds, setAdminUserIds] = useState<number[]>([]);
  const [pesoUserIds, setPesoUserIds] = useState<number[]>([]);
  const [adminUserData, setAdminUserData] = useState<AlumniUser | null>(null);
  const [pesoUserData, setPesoUserData] = useState<AlumniUser | null>(null);
  const [commentInput, setCommentInput] = useState<{ [key: number]: string }>({});
  const [showCommentInput, setShowCommentInput] = useState<{ [key: number]: boolean }>({});
  const [showAllComments, setShowAllComments] = useState<{ [key: number]: boolean }>({});
  const [likedPosts, setLikedPosts] = useState<{ [key: number]: boolean }>({});
  const [repostedPosts, setRepostedPosts] = useState<{ [key: number]: boolean }>({});
  const [repostError, setRepostError] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState<{ [key: string | number]: boolean }>({});
  const [editingPost, setEditingPost] = useState<{ [key: number]: boolean }>({});
  const [editPostContent, setEditPostContent] = useState<{ [key: number]: string }>({});
  const [editingComment, setEditingComment] = useState<{ [key: number]: boolean }>({});
  const [editCommentContent, setEditCommentContent] = useState<{ [key: number]: string }>({});
  const [following, setFollowing] = useState<any[]>([]);
  const [showPostModal, setShowPostModal] = useState(false);
  const [modalPost, setModalPost] = useState<any | null>(null);
  const [postLoading, setPostLoading] = useState(false);
  const [showAllUsersModal, setShowAllUsersModal] = useState(false);
  const [showOriginalPostModal, setShowOriginalPostModal] = useState(false);
  const [originalPostModalData, setOriginalPostModalData] = useState<any | null>(null);
  const navigate = useNavigate();

  // Determine user type from localStorage instead of props
  const [actualUserType, setActualUserType] = useState<string>('');
  
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const userObj = JSON.parse(userStr);
      // Check account_type to determine actual user type
      if (userObj.account_type) {
        if (userObj.account_type.admin) {
          setActualUserType('admin');
        } else if (userObj.account_type.peso) {
          setActualUserType('peso');
        } else if (userObj.account_type.coordinator) {
          setActualUserType('coordinator');
        } else if (userObj.account_type.user) {
          setActualUserType('alumni');
        } else {
          setActualUserType('alumni'); // default
        }
      } else {
        setActualUserType('alumni'); // default
      }
    }
  }, []);

  const isAdmin = actualUserType === 'admin';
  const isPeso = actualUserType === 'peso';
  const isOjt = actualUserType === 'ojt' || actualUserType === 'alumni'; // OJT and alumni are similar
  
  // Debug logging for quicklinks
  console.log('Quicklinks Debug - actualUserType:', actualUserType);
  console.log('Quicklinks Debug - should show quicklinks:', actualUserType === 'alumni');
  

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      navigate('/login');
      return;
    }
    const userObj = JSON.parse(userStr);
    setUser(userObj);

    // Fetch following list for current user
    const currentUserId = userObj.user_id || userObj.id;
    if (currentUserId) {
      import('../../services/api').then(({ api }) => {
        api.get(`alumni/${currentUserId}/following/`)
          .then((response) => {
            if (response.data.success && response.data.following) {
              setFollowing(response.data.following);
            } else {
              setFollowing([]);
            }
          })
          .catch(() => setFollowing([]));
      });
    }

    // Fetch suggested users
    import('../../services/api').then(({ api, checkFollowStatus }) => {
      api
        .get('users_list_view/', { params: { current_user_id: userObj.id || userObj.user_id } })
        .then(async ({ data }) => {
          if (data.success) {
            const usersWithFollowStatus = await Promise.all(
              data.users.map(async (usr: any) => {
                try {
                  const followStatus = await checkFollowStatus(usr.id);
                  return { ...usr, isFollowing: followStatus.is_following };
                } catch {
                  return { ...usr, isFollowing: false };
                }
              })
            );
            // Only show users that are not being followed and not the current user
            const unfollowedUsers = usersWithFollowStatus
              .filter(user => !user.isFollowing)
              .filter(user => Number(user.id) !== Number(userObj.id))
              .filter(user => Number(user.id) !== Number(userObj.user_id));
            setSuggestedUsers(unfollowedUsers);
          }
        })
        .catch((error) => console.error('Error fetching users:', error));
    });
  }, [navigate]);

  // Fetch admin and PESO user IDs dynamically
  const fetchAdminPesoUsers = async () => {
    try {
      const response = await getAdminPesoUsers();
      if (response.success) {
        setAdminUserIds(response.admin_user_ids || []);
        setPesoUserIds(response.peso_user_ids || []);
        console.log('Full API response:', response);
        console.log('Dynamic admin IDs:', response.admin_user_ids);
        console.log('Dynamic PESO IDs:', response.peso_user_ids);
        console.log('Admin IDs length:', response.admin_user_ids?.length);
        console.log('PESO IDs length:', response.peso_user_ids?.length);
        
        // Fetch admin user data
        if (response.admin_user_ids && response.admin_user_ids.length > 0) {
          console.log('Fetching admin user data for ID:', response.admin_user_ids[0]);
          try {
            const token = localStorage.getItem('accessToken');
            const adminResponse = await fetch(`http://127.0.0.1:8000/api/alumni/${response.admin_user_ids[0]}/`, {
              headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            });
            console.log('Admin API response status:', adminResponse.status);
            if (adminResponse.ok) {
              const adminData = await adminResponse.json();
              console.log('Admin API response data:', adminData);
              if (adminData.success && adminData.alumni) {
                console.log('Setting admin user data:', adminData.alumni);
                console.log('Admin profile pic URL:', adminData.alumni.profile_pic);
                setAdminUserData(adminData.alumni);
              } else {
                console.log('Admin API response not successful or no alumni data');
              }
            } else {
              console.log('Admin API response not ok:', adminResponse.status);
            }
          } catch (error) {
            console.error('Error fetching admin user data:', error);
          }
        } else {
          console.log('No admin user IDs found in response');
        }
        
        // Fetch PESO user data
        if (response.peso_user_ids && response.peso_user_ids.length > 0) {
          console.log('Fetching PESO user data for ID:', response.peso_user_ids[0]);
          try {
            const token = localStorage.getItem('accessToken');
            const pesoResponse = await fetch(`http://127.0.0.1:8000/api/alumni/${response.peso_user_ids[0]}/`, {
              headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            });
            console.log('PESO API response status:', pesoResponse.status);
            if (pesoResponse.ok) {
              const pesoData = await pesoResponse.json();
              console.log('PESO API response data:', pesoData);
              if (pesoData.success && pesoData.alumni) {
                console.log('Setting PESO user data:', pesoData.alumni);
                console.log('PESO profile pic URL:', pesoData.alumni.profile_pic);
                setPesoUserData(pesoData.alumni);
              } else {
                console.log('PESO API response not successful or no alumni data');
              }
            } else {
              console.log('PESO API response not ok:', pesoResponse.status);
            }
          } catch (error) {
            console.error('Error fetching PESO user data:', error);
          }
        } else {
          console.log('No PESO user IDs found in response');
        }
      }
    } catch (error) {
      console.error('Error fetching admin/PESO users:', error);
    }
  };

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      navigate('/login');
      return;
    }
    const userObj = JSON.parse(userStr);
    setUser(userObj);
    
    // Fetch admin and PESO user IDs
    fetchAdminPesoUsers();
    
    // Fetch posts from backend (backend already includes followed + PESO + admin)
    getPosts().then((fetchedPosts) => {
      setPosts(fetchedPosts);
      
      // Initialize likedPosts state based on current user's likes
      const currentUserId = getCurrentUserId(userObj);
      const liked: { [key: number]: boolean } = {};
      fetchedPosts.forEach((post: any) => {
        if (post.item_type === 'post' && post.likes && Array.isArray(post.likes)) {
          liked[post.post_id] = post.likes.some((like: any) => like.user_id === currentUserId);
        } else if (post.item_type === 'repost' && post.likes && Array.isArray(post.likes)) {
          liked[post.repost_id] = post.likes.some((like: any) => like.user_id === currentUserId);
        }
      });
      setLikedPosts(liked);

      // Initialize repostedPosts state based on current user's reposts
      const reposted: { [key: number]: boolean } = {};
      fetchedPosts.forEach((post: any) => {
        if (post.reposts && Array.isArray(post.reposts)) {
          reposted[post.post_id] = post.reposts.some((repost: any) => repost.user.user_id === currentUserId);
        }
      });
      setRepostedPosts(reposted);
    }).catch((error) => {
      console.error('Error fetching posts:', error);
      setPosts([]);
    });
  }, [navigate]);

  // Listen for user data updates from Settings
  useEffect(() => {
    const handleUserDataUpdate = (event: CustomEvent) => {
      console.log('User data updated event received in UnifiedDashboard:', event.detail);
      // Update the user state with new data
      setUser(event.detail);
    };

    window.addEventListener('userDataUpdated', handleUserDataUpdate as EventListener);
    
    return () => {
      window.removeEventListener('userDataUpdated', handleUserDataUpdate as EventListener);
    };
  }, []);

  // Check for pending post view when component mounts or navigates here
  useEffect(() => {
    const pendingPostId = localStorage.getItem('pendingPostView');
    if (pendingPostId) {
      console.log('Found pending post view:', pendingPostId);
      // Clear the pending post ID
      localStorage.removeItem('pendingPostView');
      // Show the post modal
      handleViewPost(pendingPostId);
    }
  }, [userId]); // Check when userId changes (navigation)

  // ... (all handlers from AlumniDashboard, unchanged)

  // ... (feed, modal, and all JSX from AlumniDashboard, but use isAdmin/isPeso from userType)

  const handleFollow = async (userId: number) => {
    setFollowLoading(prev => ({ ...prev, [userId]: true }));
    try {
      const result = await followUser(userId);
      if (result.success) {
        setSuggestedUsers(prev => prev.filter(u => u.id !== userId));
        setFollowing(prev => [...prev, { user_id: userId }]);
      }
    } catch (error) {
      console.error('Error following user:', error);
    } finally {
      setFollowLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleViewPost = async (postId: string) => {
    console.log('handleViewPost called with postId:', postId);
    setPostLoading(true);
    try {
      console.log('Fetching post from API...');
      const response = await api.get(`posts/${postId}/detail/`);
      console.log('API response:', response.data);
      if (response.data) {
        setModalPost(response.data);
        setShowPostModal(true);
        console.log('Post modal should now be visible');
      }
    } catch (error) {
      console.error('Error fetching post:', error);
      alert('Failed to load post.');
    } finally {
      setPostLoading(false);
    }
  };

  const handleViewOriginalPost = async (originalPost: any) => {
    console.log('handleViewOriginalPost called with original post:', originalPost);
    setPostLoading(true);
    try {
      // Fetch the full post data from the API
      const response = await api.get(`posts/${originalPost.post_id}/detail/`);
      console.log('Original post API response:', response.data);
      if (response.data) {
        setOriginalPostModalData(response.data);
        setShowOriginalPostModal(true);
        console.log('Original post modal should now be visible');
      }
    } catch (error) {
      console.error('Error fetching original post:', error);
      alert('Failed to load original post.');
    } finally {
      setPostLoading(false);
    }
  };

  return (
    <div className="page-container">
      <AlumniTopBar
        showProfile={showProfile}
        setShowProfile={setShowProfile}
        handleLogout={() => {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          navigate('/login');
        }}
        isAdmin={isAdmin}
        isPeso={isPeso}
        onTrackerClick={isAdmin ? () => navigate('/tracker') : undefined}
      />
      <div className="main-content">
        {/* Left Sidebar */}
        <div className="left-sidebar">
          <div
            className="profile-card"
            onClick={() => {
              if (user && (user as any).account_type) {
                if ((user as any).account_type.peso) {
                  navigate('/peso/profile');
                } else if ((user as any).account_type.ccict) {
                  navigate('/ccict/profile');
                } else if ((user as any).account_type.ojt) {
                  navigate('/ojt/profile');
                } else {
                  navigate('/alumni/profile');
                }
              } else {
                navigate('/alumni/profile');
              }
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <div className="orange-header-bar"></div>
            <div className="profile-content">
              <img src={user?.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : ctulogo} alt="Profile" className="profile-image" />
              <div className="profile-name">{user?.name }</div>
              <div className="profile-university">{user?.university}</div>
            </div>
          </div>
          {/* Quick Links: show based on actual user type */}
          {actualUserType === 'alumni' && (
            <div className="quick-links" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <div 
                  className="quick-link-card" 
                  style={{ flex: 1, cursor: 'pointer' }}
                  onClick={() => {
                    // Use the first admin user ID from the dynamic list
                    const adminId = adminUserIds.length > 0 ? adminUserIds[0] : null;
                    if (adminId) {
                      navigate(`/ccict/profile/${adminId}`);
                    } else {
                      console.log('No admin user found');
                    }
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <div className="quick-link-orange-header"></div>
                  <div className="quick-link-content">
                    <img 
                      src={adminUserData?.profile_pic ? (String(adminUserData.profile_pic).startsWith('http') ? adminUserData.profile_pic : `http://127.0.0.1:8000${adminUserData.profile_pic}`) : ctulogo} 
                      alt="Admin Profile" 
                      className="quick-link-icon"
                      style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div className="quick-link-text">CCICT</div>
                  </div>
                </div>
                <div 
                  className="quick-link-card" 
                  style={{ flex: 1, cursor: 'pointer' }}
                  onClick={() => {
                    // Use the first PESO user ID from the dynamic list
                    const pesoId = pesoUserIds.length > 0 ? pesoUserIds[0] : null;
                    if (pesoId) {
                      navigate(`/peso/profile/${pesoId}`);
                    } else {
                      console.log('No PESO user found');
                    }
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <div className="quick-link-orange-header"></div>
                  <div className="quick-link-content">
                    <img 
                      src={pesoUserData?.profile_pic ? (String(pesoUserData.profile_pic).startsWith('http') ? pesoUserData.profile_pic : `http://127.0.0.1:8000${pesoUserData.profile_pic}`) : ctulogo} 
                      alt="PESO Profile" 
                      className="quick-link-icon"
                      style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div className="quick-link-text">PESO</div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {actualUserType === 'alumni' && (
                  <div
                    className="quick-link-card"
                    onClick={() => navigate('/alumni/forum')}
                    style={{ flex: 1, cursor: 'pointer', transition: 'transform 0.2s ease-in-out' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    <div className="quick-link-orange-header"></div>
                    <div className="quick-link-content">
                      <div className="quick-link-icon forum-icon">C</div>
                      <div className="quick-link-text">FORUM</div>
                    </div>
                  </div>
                )}
                <div
                  className="quick-link-card"
                  onClick={() => navigate('/alumni/donation')}
                  style={{ flex: 1, cursor: 'pointer', transition: 'transform 0.2s ease-in-out' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <div className="quick-link-orange-header"></div>
                  <div className="quick-link-content">
                    <div className="quick-link-icon peso-icon">✱</div>
                    <div className="quick-link-text">DONATION</div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* admin: no quick links, just profile card */}
        </div>
        {/* Center Content */}
        <div className="center-content">
          <div className="post-start" onClick={() => setShowComposer(true)} style={{ cursor: 'pointer' }}>
            <div className="post-start-input-container">
              <img src={user?.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : ctulogo} alt="Profile" className="post-start-profile-image" />
              <input type="text" placeholder="Start a post" className="post-start-input" readOnly />
            </div>
          </div>
          {showComposer && (
            <PostCreate
              onPosted={async () => {
                console.log('Post created, refreshing feed...');
                try {
                  const updatedPosts = await getPosts();
                  console.log('Updated posts:', updatedPosts);
                  setPosts(updatedPosts || []);
                } catch (error) {
                  console.error('Error refreshing posts:', error);
                }
                setShowComposer(false);
              }}
              onCancel={() => setShowComposer(false)}
              user={user ?? { name: '', profile_pic: undefined }}
            />
          )}
          {(userType === 'alumni' || userType === 'ojt')
            ? posts.filter(post => {
                const currentUserId = getCurrentUserId(user);
                const postUserId = post.user?.user_id;
                const isOwn = currentUserId && postUserId && Number(postUserId) === Number(currentUserId);
                let isFollowed = false;
                if (Array.isArray(following) && postUserId) {
                  isFollowed = following.some(f => {
                    let followedId: number | undefined = undefined;
                    if (typeof f === 'object' && f !== null) {
                      if ('user' in f && f.user && typeof f.user === 'object' && 'user_id' in f.user && typeof f.user.user_id === 'number') {
                        followedId = f.user.user_id;
                      } else if ('user_id' in f && typeof f.user_id === 'number') {
                        followedId = f.user_id;
                      }
                    }
                    return followedId !== undefined && Number(followedId) === Number(postUserId);
                  });
                }
                let isCcict = false, isPeso = false;
                
                if (post.user && post.user.account_type) {
                  // Check for both possible field names (ccict/admin, peso)
                  isCcict = !!(post.user.account_type.ccict || post.user.account_type.admin);
                  isPeso = !!post.user.account_type.peso;
                }
                
                // DYNAMIC CHECK: Use fetched admin and PESO user IDs
                const postUserIdForCheck = post.user?.user_id;
                if (postUserIdForCheck && pesoUserIds.includes(postUserIdForCheck)) {
                  isPeso = true;
                  console.log('Dynamic PESO check - post from user', postUserIdForCheck);
                } else if (postUserIdForCheck && adminUserIds.includes(postUserIdForCheck)) {
                  isCcict = true;
                  console.log('Dynamic admin check - post from user', postUserIdForCheck);
                }
                
                // Show posts from: own posts, followed users, PESO posts, or admin posts
                // PESO and admin posts are always visible regardless of follow status
                return isOwn || isFollowed || isCcict || isPeso;
              }).reduce((acc: any[], item: FeedItem) => {
                const currentUserId = getCurrentUserId(user);
                
                // Check if this is a repost item or a regular post item
                if (item.item_type === 'repost' && 'repost_id' in item) {
                  // Render as repost card (nested structure)
                  const repostItem = item as RepostFeedItem;
                  const repostCard = (
                    <PostCard
                      key={`repost-${repostItem.repost_id}`}
                      post={{
                        ...repostItem.original_post,
                        post_id: repostItem.repost_id, // Use repost_id for interactions
                        likes: repostItem.likes || [],
                        comments: repostItem.comments || [],
                        likes_count: repostItem.likes_count || 0,
                        comments_count: repostItem.comments_count || 0,
                      } as PostItem}
                      currentUserId={currentUserId}
                      isOwn={currentUserId === repostItem.user.user_id}
                      displayName={formatDisplayName(repostItem.user, currentUserId === repostItem.user.user_id, user)}
                      displayAvatar={repostItem.user.profile_pic ? (String(repostItem.user.profile_pic).startsWith('http') ? repostItem.user.profile_pic : `http://127.0.0.1:8000${repostItem.user.profile_pic}`) : ctulogo}
                      formatTime={formatHybrid}
                      isRepost={true}
                      repostData={repostItem as any}
                      onViewOriginalPost={handleViewOriginalPost}
                      onPostUpdate={() => {
                        getPosts().then(updatedPosts => {
                          setPosts(updatedPosts || []);
                          
                          const currentUserId = getCurrentUserId(user);
                          const liked: { [key: number]: boolean } = {};
                          (updatedPosts || []).forEach((post: any) => {
                            if (post.item_type === 'post' && post.likes && Array.isArray(post.likes)) {
                              liked[post.post_id] = post.likes.some((like: any) => like.user_id === currentUserId);
                            } else if (post.item_type === 'repost' && post.likes && Array.isArray(post.likes)) {
                              liked[post.repost_id] = post.likes.some((like: any) => like.user_id === currentUserId);
                            }
                          });
                          setLikedPosts(liked);

                          const reposted: { [key: number]: boolean} = {};
                          (updatedPosts || []).forEach((post: any) => {
                            if (post.item_type === 'post') {
                              reposted[post.post_id] = false; // Will be calculated from reposts_count
                            }
                          });
                          setRepostedPosts(reposted);
                        });
                      }}
                      showOptions={showOptions}
                      setShowOptions={setShowOptions}
                      editingPost={editingPost}
                      setEditingPost={setEditingPost}
                      editPostContent={editPostContent}
                      setEditPostContent={setEditPostContent}
                      likedPosts={likedPosts}
                      setLikedPosts={setLikedPosts}
                      repostedPosts={repostedPosts}
                      setRepostedPosts={setRepostedPosts}
                      showCommentInput={showCommentInput}
                      setShowCommentInput={setShowCommentInput}
                      showAllComments={showAllComments}
                      setShowAllComments={setShowAllComments}
                      commentInput={commentInput}
                      setCommentInput={setCommentInput}
                      editingComment={editingComment}
                      setEditingComment={setEditingComment}
                      editCommentContent={editCommentContent}
                      setEditCommentContent={setEditCommentContent}
                    />
                  );
                  acc.push(repostCard);
                  return acc;
                }
                
                // Regular post rendering
                const post = item;
                const isOwn = currentUserId !== null && post.user?.user_id && Number(post.user.user_id) === Number(currentUserId);
                const displayName = formatDisplayName(post.user, !!isOwn, user);
                const postUserAvatar = post.user?.profile_pic ? (String(post.user.profile_pic).startsWith('http') ? post.user.profile_pic : `http://127.0.0.1:8000${post.user.profile_pic}`) : undefined;
                const displayAvatar = isOwn && user?.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : (postUserAvatar || ctulogo);
                
                // Render regular post
                const originalPostCard = (
                  <PostCard
                    key={post.post_id}
                    post={post}
                    currentUserId={currentUserId}
                    isOwn={!!isOwn}
                    displayName={displayName}
                    displayAvatar={displayAvatar}
                    formatTime={formatHybrid}
                    onViewOriginalPost={handleViewOriginalPost}
                    onPostUpdate={() => {
                      getPosts().then(updatedPosts => {
                        setPosts(updatedPosts || []);
                        
                        // Update likedPosts state
                        const currentUserId = getCurrentUserId(user);
                        const liked: { [key: number]: boolean } = {};
                        (updatedPosts || []).forEach((post: any) => {
                          if (post.item_type === 'post' && post.likes && Array.isArray(post.likes)) {
                            liked[post.post_id] = post.likes.some((like: any) => like.user_id === currentUserId);
                          } else if (post.item_type === 'repost' && post.likes && Array.isArray(post.likes)) {
                            liked[post.repost_id] = post.likes.some((like: any) => like.user_id === currentUserId);
                          }
                        });
                        setLikedPosts(liked);

                        // Update repostedPosts state
                        const reposted: { [key: number]: boolean } = {};
                        (updatedPosts || []).forEach((post: any) => {
                          if (post.reposts && Array.isArray(post.reposts)) {
                            reposted[post.post_id] = post.reposts.some((repost: any) => repost.user.user_id === currentUserId);
                          }
                        });
                        setRepostedPosts(reposted);
                      });
                    }}
                    showOptions={showOptions}
                    setShowOptions={setShowOptions}
                    editingPost={editingPost}
                    setEditingPost={setEditingPost}
                    editPostContent={editPostContent}
                    setEditPostContent={setEditPostContent}
                    likedPosts={likedPosts}
                    setLikedPosts={setLikedPosts}
                    repostedPosts={repostedPosts}
                    setRepostedPosts={setRepostedPosts}
                    showCommentInput={showCommentInput}
                    setShowCommentInput={setShowCommentInput}
                    showAllComments={showAllComments}
                    setShowAllComments={setShowAllComments}
                    commentInput={commentInput}
                    setCommentInput={setCommentInput}
                    editingComment={editingComment}
                    setEditingComment={setEditingComment}
                    editCommentContent={editCommentContent}
                    setEditCommentContent={setEditCommentContent}
                  />
                );
                acc.push(originalPostCard);
                
                return acc;
              }, [])
            : posts.reduce((acc: any[], item: FeedItem) => {
                const currentUserId = getCurrentUserId(user);
                
                // Check if this is a repost item or a regular post item
                if (item.item_type === 'repost' && 'repost_id' in item) {
                  // Render as repost card (nested structure)
                  const repostItem = item as RepostFeedItem;
                  const repostCard = (
                    <PostCard
                      key={`repost-${repostItem.repost_id}`}
                      post={{
                        ...repostItem.original_post,
                        post_id: repostItem.repost_id, // Use repost_id for interactions
                        likes: repostItem.likes || [],
                        comments: repostItem.comments || [],
                        likes_count: repostItem.likes_count || 0,
                        comments_count: repostItem.comments_count || 0,
                      } as PostItem}
                      currentUserId={currentUserId}
                      isOwn={currentUserId === repostItem.user.user_id}
                      displayName={formatDisplayName(repostItem.user, currentUserId === repostItem.user.user_id, user)}
                      displayAvatar={repostItem.user.profile_pic ? (String(repostItem.user.profile_pic).startsWith('http') ? repostItem.user.profile_pic : `http://127.0.0.1:8000${repostItem.user.profile_pic}`) : ctulogo}
                      formatTime={formatHybrid}
                      isRepost={true}
                      repostData={repostItem as any}
                      onViewOriginalPost={handleViewOriginalPost}
                      onPostUpdate={() => {
                        getPosts().then(updatedPosts => {
                          setPosts(updatedPosts || []);
                        });
                      }}
                      showOptions={showOptions}
                      setShowOptions={setShowOptions}
                      editingPost={editingPost}
                      setEditingPost={setEditingPost}
                      editPostContent={editPostContent}
                      setEditPostContent={setEditPostContent}
                      likedPosts={likedPosts}
                      setLikedPosts={setLikedPosts}
                      repostedPosts={repostedPosts}
                      setRepostedPosts={setRepostedPosts}
                      showCommentInput={showCommentInput}
                      setShowCommentInput={setShowCommentInput}
                      showAllComments={showAllComments}
                      setShowAllComments={setShowAllComments}
                      commentInput={commentInput}
                      setCommentInput={setCommentInput}
                      editingComment={editingComment}
                      setEditingComment={setEditingComment}
                      editCommentContent={editCommentContent}
                      setEditCommentContent={setEditCommentContent}
                    />
                  );
                  acc.push(repostCard);
                  return acc;
                }
                
                // Regular post rendering
                const post = item;
                const isOwn = currentUserId !== null && post.user?.user_id && Number(post.user.user_id) === Number(currentUserId);
                const displayName = formatDisplayName(post.user, !!isOwn, user);
                const postUserAvatar = post.user?.profile_pic ? (String(post.user.profile_pic).startsWith('http') ? post.user.profile_pic : `http://127.0.0.1:8000${post.user.profile_pic}`) : undefined;
                const displayAvatar = isOwn && user?.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : (postUserAvatar || ctulogo);
                
                // Render regular post
                const originalPostCard = (
                  <PostCard
                    key={post.post_id}
                    post={post}
                    currentUserId={currentUserId}
                    isOwn={!!isOwn}
                    displayName={displayName}
                    displayAvatar={displayAvatar}
                    formatTime={formatHybrid}
                    onViewOriginalPost={handleViewOriginalPost}
                    onPostUpdate={() => {
                      getPosts().then(updatedPosts => {
                        setPosts(updatedPosts || []);
                        
                        // Update likedPosts state
                        const currentUserId = getCurrentUserId(user);
                        const liked: { [key: number]: boolean } = {};
                        (updatedPosts || []).forEach((post: any) => {
                          if (post.item_type === 'post' && post.likes && Array.isArray(post.likes)) {
                            liked[post.post_id] = post.likes.some((like: any) => like.user_id === currentUserId);
                          } else if (post.item_type === 'repost' && post.likes && Array.isArray(post.likes)) {
                            liked[post.repost_id] = post.likes.some((like: any) => like.user_id === currentUserId);
                          }
                        });
                        setLikedPosts(liked);

                        // Update repostedPosts state
                        const reposted: { [key: number]: boolean } = {};
                        (updatedPosts || []).forEach((post: any) => {
                          if (post.reposts && Array.isArray(post.reposts)) {
                            reposted[post.post_id] = post.reposts.some((repost: any) => repost.user.user_id === currentUserId);
                          }
                        });
                        setRepostedPosts(reposted);
                      });
                    }}
                    showOptions={showOptions}
                    setShowOptions={setShowOptions}
                    editingPost={editingPost}
                    setEditingPost={setEditingPost}
                    editPostContent={editPostContent}
                    setEditPostContent={setEditPostContent}
                    likedPosts={likedPosts}
                    setLikedPosts={setLikedPosts}
                    repostedPosts={repostedPosts}
                    setRepostedPosts={setRepostedPosts}
                    showCommentInput={showCommentInput}
                    setShowCommentInput={setShowCommentInput}
                    showAllComments={showAllComments}
                    setShowAllComments={setShowAllComments}
                    commentInput={commentInput}
                    setCommentInput={setCommentInput}
                    editingComment={editingComment}
                    setEditingComment={setEditingComment}
                    editCommentContent={editCommentContent}
                    setEditCommentContent={setEditCommentContent}
                  />
                );
                acc.push(originalPostCard);
                
                return acc;
              }, [])}
        </div>
        {/* Right Sidebar */}
        <div className="right-sidebar">
          <div className="people-you-may-know-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="people-you-may-know-title" style={{ marginBottom: 0 }}>People you may know</div>
              {suggestedUsers.length > 6 && (
                <button
                  onClick={() => setShowAllUsersModal(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#0066cc',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: 6,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 102, 204, 0.1)';
                    e.currentTarget.style.textDecoration = 'underline';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.textDecoration = 'none';
                  }}
                >
                  See all
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {suggestedUsers.length > 0 ? (
                suggestedUsers.slice(0, 6).map((user) => (
                  <div key={user.id} className="suggested-user-item" onClick={() => navigate(`/alumni/profile/${user.id}`)} style={{ cursor: 'pointer' }}>
                    <img src={user.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : ctulogo} alt={user.name} className="suggested-user-profile-image" />
                    <div className="suggested-user-name">{user.name} {user.batch ? `(${user.batch})` : ''}</div>
                    <button className="suggested-user-follow-button" onClick={e => { e.stopPropagation(); handleFollow(user.id); }} disabled={followLoading[user.id]}>
                      {followLoading[user.id] ? '...' : 'Follow'}
                    </button>
                  </div>
                ))
              ) : (
                <div>No users to display</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Post Modal */}
      {showPostModal && modalPost && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px',
          }}
          onClick={() => setShowPostModal(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowPostModal(false)}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: 'none',
                border: 'none',
                fontSize: 24,
                cursor: 'pointer',
                color: '#666',
                zIndex: 10,
              }}
              title="Close"
            >
              ×
            </button>
            <div style={{ padding: '20px' }}>
              <PostCard
                post={modalPost}
                currentUserId={getCurrentUserId(user)}
                isOwn={getCurrentUserId(user) === modalPost.user?.user_id}
                displayName={formatDisplayName(modalPost.user, getCurrentUserId(user) === modalPost.user?.user_id, user)}
                displayAvatar={modalPost.user?.profile_pic || '/default-avatar.png'}
                formatTime={formatHybrid}
                onViewOriginalPost={handleViewOriginalPost}
                onPostUpdate={() => {
                  // Refresh the post data in modal and update the main posts list
                  const postId = modalPost.post_id;
                  if (postId) {
                    handleViewPost(postId.toString());
                  }
                  
                  // Also refresh the main posts list to keep everything in sync
                  getPosts().then(updatedPosts => {
                    setPosts(updatedPosts || []);
                    
                    // Update likedPosts state
                    const currentUserId = getCurrentUserId(user);
                    const liked: { [key: number]: boolean } = {};
                    (updatedPosts || []).forEach((post: any) => {
                      if (post.item_type === 'post' && post.likes && Array.isArray(post.likes)) {
                        liked[post.post_id] = post.likes.some((like: any) => like.user_id === currentUserId);
                      } else if (post.item_type === 'repost' && post.likes && Array.isArray(post.likes)) {
                        liked[post.repost_id] = post.likes.some((like: any) => like.user_id === currentUserId);
                      }
                    });
                    setLikedPosts(liked);

                    // Update repostedPosts state
                    const reposted: { [key: number]: boolean } = {};
                    (updatedPosts || []).forEach((post: any) => {
                      if (post.reposts && Array.isArray(post.reposts)) {
                        reposted[post.post_id] = post.reposts.some((repost: any) => repost.user.user_id === currentUserId);
                      }
                    });
                    setRepostedPosts(reposted);
                  });
                }}
                showOptions={showOptions}
                setShowOptions={setShowOptions}
                editingPost={editingPost}
                setEditingPost={setEditingPost}
                editPostContent={editPostContent}
                setEditPostContent={setEditPostContent}
                likedPosts={likedPosts}
                setLikedPosts={setLikedPosts}
                repostedPosts={repostedPosts}
                setRepostedPosts={setRepostedPosts}
                showCommentInput={showCommentInput}
                setShowCommentInput={setShowCommentInput}
                showAllComments={showAllComments}
                setShowAllComments={setShowAllComments}
                commentInput={commentInput}
                setCommentInput={setCommentInput}
                editingComment={editingComment}
                setEditingComment={setEditingComment}
                editCommentContent={editCommentContent}
                setEditCommentContent={setEditCommentContent}
              />
            </div>
          </div>
        </div>
      )}

      {/* All Users Modal */}
      {showAllUsersModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px',
          }}
          onClick={() => setShowAllUsersModal(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
              maxWidth: '800px',
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              position: 'sticky',
              top: 0,
              background: 'white',
              borderBottom: '1px solid #e0e0e0',
              padding: '20px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderRadius: '16px 16px 0 0',
              zIndex: 1,
            }}>
              <h3 style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                color: '#1a1a1a',
              }}>People you may know ({suggestedUsers.length})</h3>
              <button
                onClick={() => setShowAllUsersModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 28,
                  cursor: 'pointer',
                  color: '#666',
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f5f5f5';
                  e.currentTarget.style.color = '#333';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#666';
                }}
                title="Close"
              >
                ×
              </button>
            </div>
            <div style={{
              padding: '20px 24px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 16,
            }}>
              {suggestedUsers.map((user) => (
                <div
                  key={user.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: 16,
                    borderRadius: 12,
                    border: '1px solid #e0e0e0',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    background: 'white',
                  }}
                  onClick={() => {
                    navigate(`/alumni/profile/${user.id}`);
                    setShowAllUsersModal(false);
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                    e.currentTarget.style.borderColor = '#0066cc';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = '#e0e0e0';
                  }}
                >
                  <img
                    src={user.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : ctulogo}
                    alt={user.name}
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      marginBottom: 12,
                      border: '3px solid #f0f0f0',
                    }}
                  />
                  <div style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: '#1a1a1a',
                    textAlign: 'center',
                    marginBottom: 4,
                  }}>
                    {user.name}
                  </div>
                  <div style={{
                    fontSize: 13,
                    color: '#666',
                    marginBottom: 12,
                  }}>
                    {user.batch ? `(${user.batch})` : ''}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFollow(user.id);
                    }}
                    disabled={followLoading[user.id]}
                    className="suggested-user-follow-button"
                  >
                    {followLoading[user.id] ? '...' : 'Follow'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Original Post Modal */}
      {showOriginalPostModal && originalPostModalData && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px',
          }}
          onClick={() => setShowOriginalPostModal(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowOriginalPostModal(false)}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: 'none',
                border: 'none',
                fontSize: 24,
                cursor: 'pointer',
                color: '#666',
                zIndex: 10,
              }}
              title="Close"
            >
              ×
            </button>
            <div style={{ padding: '20px' }}>
              <PostCard
                post={originalPostModalData}
                currentUserId={getCurrentUserId(user)}
                isOwn={getCurrentUserId(user) === originalPostModalData.user?.user_id}
                displayName={formatDisplayName(originalPostModalData.user, getCurrentUserId(user) === originalPostModalData.user?.user_id, user)}
                displayAvatar={originalPostModalData.user?.profile_pic ? (String(originalPostModalData.user.profile_pic).startsWith('http') ? originalPostModalData.user.profile_pic : `http://127.0.0.1:8000${originalPostModalData.user.profile_pic}`) : ctulogo}
                formatTime={formatHybrid}
                onViewOriginalPost={handleViewOriginalPost}
                onPostUpdate={() => {
                  // Refresh the original post data in modal
                  const postId = originalPostModalData.post_id;
                  if (postId) {
                    handleViewOriginalPost(originalPostModalData);
                  }
                  
                  // Also refresh the main posts list to keep everything in sync
                  getPosts().then(updatedPosts => {
                    setPosts(updatedPosts || []);
                    
                    // Update likedPosts state
                    const currentUserId = getCurrentUserId(user);
                    const liked: { [key: number]: boolean } = {};
                    (updatedPosts || []).forEach((post: any) => {
                      if (post.item_type === 'post' && post.likes && Array.isArray(post.likes)) {
                        liked[post.post_id] = post.likes.some((like: any) => like.user_id === currentUserId);
                      } else if (post.item_type === 'repost' && post.likes && Array.isArray(post.likes)) {
                        liked[post.repost_id] = post.likes.some((like: any) => like.user_id === currentUserId);
                      }
                    });
                    setLikedPosts(liked);

                    // Update repostedPosts state
                    const reposted: { [key: number]: boolean } = {};
                    (updatedPosts || []).forEach((post: any) => {
                      if (post.reposts && Array.isArray(post.reposts)) {
                        reposted[post.post_id] = post.reposts.some((repost: any) => repost.user.user_id === currentUserId);
                      }
                    });
                    setRepostedPosts(reposted);
                  });
                }}
                showOptions={showOptions}
                setShowOptions={setShowOptions}
                editingPost={editingPost}
                setEditingPost={setEditingPost}
                editPostContent={editPostContent}
                setEditPostContent={setEditPostContent}
                likedPosts={likedPosts}
                setLikedPosts={setLikedPosts}
                repostedPosts={repostedPosts}
                setRepostedPosts={setRepostedPosts}
                showCommentInput={showCommentInput}
                setShowCommentInput={setShowCommentInput}
                showAllComments={showAllComments}
                setShowAllComments={setShowAllComments}
                commentInput={commentInput}
                setCommentInput={setCommentInput}
                editingComment={editingComment}
                setEditingComment={setEditingComment}
                editCommentContent={editCommentContent}
                setEditCommentContent={setEditCommentContent}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedDashboard;
