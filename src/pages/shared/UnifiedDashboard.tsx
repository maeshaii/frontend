import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import AlumniTopBar from '../alumni/AlumniTopBar';
import PostCreate from '../alumni/PostCreate';
import PostCard from '../../components/PostCard';
import RepostCard from '../../components/RepostCard';
import TrackerReminderModal from '../../components/TrackerReminderModal';
import EmploymentUpdateReminderModal from '../../components/EmploymentUpdateReminderModal';
import ctulogo from '../../images/ctulogo.png';
import '../alumni/dashboard.css';
import '../alumni/profile.css';
import { getPosts, followUser, getAdminPesoUsers, api, getDonationRequests, checkEmploymentReminder } from '../../services/api';
import { trackerApi } from '../../services/trackerApi';
import RepostNotificationModal from '../../components/RepostNotificationModal';
import RepostModal from '../../components/RepostModal';
import { getProfilePicUrl } from '../../utils/profilePicUtils';
import { HiOutlineUsers, HiOutlineHeart } from 'react-icons/hi2';

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
  likes?: LikeItem[];
  comments?: CommentItem[];
  likes_count?: number;
  comments_count?: number;
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
  post_image?: string | null; // Backward compatibility
  post_images?: Array<{ // Multiple images
    image_id: number;
    image_url: string;
    order: number;
  }>;
  created_at?: string | null;
  likes_count?: number;
  comments_count?: number;
  user?: {
    user_id?: number;
    f_name?: string;
    m_name?: string;
    l_name?: string;
    profile_pic?: string;
    name?: string;
    account_type?: { ccict?: boolean; peso?: boolean; admin?: boolean; ojt?: boolean; user?: boolean; coordinator?: boolean };
  };
  comments?: CommentItem[];
  reposts?: RepostItem[];
  likes?: LikeItem[];
  liked_by_user?: boolean;
  item_type?: 'post' | 'repost';  // New: distinguish between post and repost items
  sort_date?: string;  // New: for sorting feed items
  // Event fields
  is_event?: boolean;
  event_date?: string | null;
  event_time?: string | null;
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
    m_name?: string;
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
  account_type?: {
    admin?: boolean;
    peso?: boolean;
    user?: boolean;
    coordinator?: boolean;
    ojt?: boolean;
  };
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
  // Get URL parameters
  const params = useParams();
  
  // All state and logic from AlumniDashboard, but use userType for admin/peso logic
  const [user, setUser] = useState<AlumniUser | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [donations, setDonations] = useState<any[]>([]);
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
  const [likedDonations, setLikedDonations] = useState<{ [key: number]: boolean }>({});
  const [repostedPosts, setRepostedPosts] = useState<{ [key: number]: boolean }>({});
  const [repostedDonations, setRepostedDonations] = useState<{ [key: number]: boolean }>({});
  const [repostError, setRepostError] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState<{ [key: string | number]: boolean }>({});
  const [editingPost, setEditingPost] = useState<{ [key: number]: boolean }>({});
  const [editPostContent, setEditPostContent] = useState<{ [key: number]: string }>({});
  const [editingComment, setEditingComment] = useState<{ [key: number]: boolean }>({});
  const [editCommentContent, setEditCommentContent] = useState<{ [key: number]: string }>({});
  const [editingDonationComment, setEditingDonationComment] = useState<{ [key: number]: boolean }>({});

  // Helper function to determine if a post is liked
  const getIsLiked = (post: any, currentUserId: number | null) => {
    if (post.is_liked !== undefined) {
      return post.is_liked;
    }
    if (post.likes && Array.isArray(post.likes) && currentUserId) {
      return post.likes.some((like: any) => like.user_id === currentUserId);
    }
    return false;
  };
  const [editDonationCommentContent, setEditDonationCommentContent] = useState<{ [key: number]: string }>({});
  const [following, setFollowing] = useState<any[]>([]);
  const [showPostModal, setShowPostModal] = useState(false);
  const [modalPost, setModalPost] = useState<any | null>(null);
  const [postLoading, setPostLoading] = useState(false);
  const [postHighlightCommentId, setPostHighlightCommentId] = useState<string | undefined>(undefined);
  const [postHighlightReplyId, setPostHighlightReplyId] = useState<string | undefined>(undefined);
  const [showAllUsersModal, setShowAllUsersModal] = useState(false);
  const [showOriginalPostModal, setShowOriginalPostModal] = useState(false);
  const [originalPostModalData, setOriginalPostModalData] = useState<any | null>(null);
  const [showTrackerModal, setShowTrackerModal] = useState(false);
  const [showEmploymentUpdateModal, setShowEmploymentUpdateModal] = useState(false);
  const [trackerReminderSuppressed, setTrackerReminderSuppressed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('suppressTrackerModal') === 'true';
    } catch (_) {
      return false;
    }
  });
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [repostModalData, setRepostModalData] = useState<{repostId: string, reposterName?: string} | null>(null);
  const [showRepostNotificationModal, setShowRepostNotificationModal] = useState(false);
  const [repostNotificationModalData, setRepostNotificationModalData] = useState<{repostId: string; reposterName?: string; commentId?: string; replyId?: string} | null>(null);
  const [showPhotoGalleryModal, setShowPhotoGalleryModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const isRefreshingRef = React.useRef(false);
  const trackerReminderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackerReminderSuppressedRef = useRef(trackerReminderSuppressed);

  useEffect(() => {
    trackerReminderSuppressedRef.current = trackerReminderSuppressed;
  }, [trackerReminderSuppressed]);
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
        } else if (userObj.account_type.ojt) {
          setActualUserType('ojt');
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
  console.log('Quicklinks Debug - should show quicklinks:', actualUserType === 'alumni' || actualUserType === 'ojt');
  

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    const token = localStorage.getItem('accessToken');
    
    console.log('🔍 AUTH DEBUG: User in localStorage:', userStr ? 'Present' : 'Missing');
    console.log('🔍 AUTH DEBUG: Token in localStorage:', token ? 'Present' : 'Missing');
    
    if (!userStr) {
      console.log('🚨 AUTH DEBUG: No user found, redirecting to login');
      navigate('/login');
      return;
    }
    
    if (!token) {
      console.log('🚨 AUTH DEBUG: No token found, redirecting to login');
      navigate('/login');
      return;
    }
    
    const userObj = JSON.parse(userStr);
    console.log('🔍 AUTH DEBUG: User object:', userObj);
    setUser(userObj);

    // Check tracker status for alumni users
    const currentUserId = userObj.user_id || userObj.id;
    if (currentUserId && (userObj.account_type?.user || userObj.account_type?.alumni)) {
      trackerApi.checkSubmissionStatus(String(currentUserId))
        .then((response) => {
          console.log('🔍 Tracker status:', response);
          if (!response.has_submitted) {
            const shouldSuppressTrackerModal =
              trackerReminderSuppressedRef.current ||
              (() => {
                try {
                  return localStorage.getItem('suppressTrackerModal') === 'true';
                } catch (_) {
                  return false;
                }
              })();

            if (!shouldSuppressTrackerModal) {
              if (trackerReminderTimeoutRef.current) {
                clearTimeout(trackerReminderTimeoutRef.current);
              }
              trackerReminderTimeoutRef.current = setTimeout(() => {
                setTrackerReminderSuppressed(false);
                setShowTrackerModal(true);
                try {
                  localStorage.removeItem('suppressTrackerModal');
                } catch (_) {}
                trackerReminderTimeoutRef.current = null;
              }, 2000);
            } else {
              setTrackerReminderSuppressed(true);
            }
          }
        })
        .catch((error) => {
          console.error('Error checking tracker status:', error);
        });
      
      // Check employment update reminder (for alumni who have submitted tracker)
      // FOR TESTING: Shows after 2 minutes. FOR PRODUCTION: Change to 6 months (180 days)
      if (currentUserId && (userObj.account_type?.user || userObj.account_type?.alumni)) {
        checkEmploymentReminder(currentUserId)
          .then((data) => {
            console.log('🔍 Employment update reminder check:', data);
            const shouldShow = !!data?.should_show_reminder;
            if (!shouldShow) {
              console.log('ℹ️ Employment reminder not shown by API (fallback will show). Reason:', data?.reason);
            }

            try {
              localStorage.removeItem('employmentUpdateReminderDismissedUntil');
            } catch (_) {}

            // Always show (user request) even if API said no; delay to avoid clashing with tracker modal
            setTimeout(() => setShowEmploymentUpdateModal(true), 3000);
          })
          .catch((error) => {
            console.error('Error checking employment update reminder:', error);
            // On error, still show once to avoid blocking the user
            setTimeout(() => setShowEmploymentUpdateModal(true), 3000);
          });
      }
    }

    // Fetch following list for current user
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

  useEffect(() => {
    const handleSuppressTrackerModal = (_event?: Event) => {
      if (trackerReminderTimeoutRef.current) {
        clearTimeout(trackerReminderTimeoutRef.current);
        trackerReminderTimeoutRef.current = null;
      }
      setTrackerReminderSuppressed(true);
      setShowTrackerModal(false);
      try {
        localStorage.removeItem('suppressTrackerModal');
      } catch (_) {}
    };

    window.addEventListener('suppressTrackerModal', handleSuppressTrackerModal as EventListener);
    if (localStorage.getItem('suppressTrackerModal') === 'true') {
      handleSuppressTrackerModal();
    }

    return () => {
      window.removeEventListener('suppressTrackerModal', handleSuppressTrackerModal as EventListener);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (trackerReminderTimeoutRef.current) {
        clearTimeout(trackerReminderTimeoutRef.current);
      }
    };
  }, []);

  // Close tracker reminder modal when post/repost modals are open
  useEffect(() => {
    if (showPostModal || showRepostNotificationModal) {
      // Suppress and close tracker reminder when post/repost modals are open
      if (trackerReminderTimeoutRef.current) {
        clearTimeout(trackerReminderTimeoutRef.current);
        trackerReminderTimeoutRef.current = null;
      }
      setShowTrackerModal(false);
      setTrackerReminderSuppressed(true);
    }
  }, [showPostModal, showRepostNotificationModal]);

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
    
    // Function to refresh posts
    const refreshPosts = async () => {
      try {
        const fetchedPosts = await getPosts();
        console.log('🔄 Auto-refreshing feed...');
        console.log('🔍 Posts response:', fetchedPosts?.length, 'posts');
        return fetchedPosts;
      } catch (error) {
        console.error('Error refreshing posts:', error);
        return [];
      }
    };
    
    // Fetch posts from backend (backend already includes followed + PESO + admin)
    refreshPosts().then((fetchedPosts) => {
      console.log('🔍 OJT DEBUG: Posts response:', fetchedPosts);
      console.log('🔍 OJT DEBUG: Posts type:', typeof fetchedPosts);
      console.log('🔍 OJT DEBUG: Posts length:', fetchedPosts?.length);
      console.log('🔍 OJT DEBUG: First few posts:', fetchedPosts?.slice(0, 3));
      console.log('🔍 OJT DEBUG: Current user object:', userObj);
      console.log('🔍 OJT DEBUG: User ID:', userObj?.user_id || userObj?.id);
      
      if (!fetchedPosts || fetchedPosts.length === 0) {
        console.log('🚨 OJT DEBUG: No posts returned from API!');
        console.log('🚨 OJT DEBUG: This might be normal for OJT users if they have no followed users or admin/PESO posts');
        setPosts([]);
        return;
      }
      
      // Use backend sorting for now - let backend handle the ordering
      const sortedPosts = fetchedPosts;
      
      // Debug: Log the first few posts to see their order and dates
      console.log('🔍 BACKEND SORTED POSTS:', sortedPosts.slice(0, 3).map((p: any, index: number) => ({
        index,
        type: p.item_type || 'post',
        sort_date: p.sort_date,
        created_at: p.created_at,
        repost_date: p.repost_date,
        user: p.user?.f_name || 'unknown'
      })));
      
      
      const repostItems = sortedPosts.filter((item: any) => item.item_type === 'repost');
      console.log('🔍 DEBUG: Repost items:', repostItems);
      console.log('🔍 DEBUG: Total posts:', sortedPosts.length);
      console.log('🔍 DEBUG: Posts breakdown:', {
        regular: sortedPosts.filter((item: any) => item.item_type === 'post' || !item.item_type).length,
        reposts: repostItems.length
      });
      if (repostItems.length > 0) {
        console.log('🔍 DEBUG: Sample repost item:', repostItems[0]);
        console.log('🔍 DEBUG: Sample repost keys:', Object.keys(repostItems[0]));
        console.log('🔍 DEBUG: Sample repost user:', repostItems[0].user);
        console.log('🔍 DEBUG: Sample repost original_post:', repostItems[0].original_post);
      } else {
        console.log('🔍 DEBUG: No repost items found in API response!');
        // Check if there are any items with repost-related fields
        const itemsWithRepostFields = fetchedPosts.filter((item: any) => 
          item.repost_id || item.repost_date || item.repost_caption
        );
        console.log('🔍 DEBUG: Items with repost fields:', itemsWithRepostFields);
      }
      setPosts(sortedPosts);
      
      // Initialize likedPosts state based on current user's likes
      const currentUserId = getCurrentUserId(userObj);
      const liked: { [key: number]: boolean } = {};
      console.log('🔍 DEBUG: Initializing likedPosts for currentUserId:', currentUserId);
      sortedPosts.forEach((post: any) => {
        if (post.item_type === 'post') {
          const isLiked = getIsLiked(post, currentUserId);
          liked[post.post_id] = isLiked;
          console.log('🔍 DEBUG: Post', post.post_id, 'isLiked:', isLiked, 'is_liked field:', post.is_liked, 'likes:', post.likes);
        } else if (post.item_type === 'repost') {
          const isLiked = getIsLiked(post, currentUserId);
          liked[post.repost_id] = isLiked;
          console.log('🔍 DEBUG: Repost', post.repost_id, 'isLiked:', isLiked, 'is_liked field:', post.is_liked, 'likes:', post.likes);
        }
      });
      console.log('🔍 DEBUG: Final likedPosts state:', liked);
      setLikedPosts(liked);

      // Initialize repostedPosts state based on current user's reposts
      const reposted: { [key: number]: boolean } = {};
      sortedPosts.forEach((post: any) => {
        if (post.reposts && Array.isArray(post.reposts)) {
          reposted[post.post_id] = post.reposts.some((repost: any) => repost.user.user_id === currentUserId);
        }
      });
      setRepostedPosts(reposted);
    }).catch((error) => {
      console.error('🚨 OJT DEBUG: Error fetching posts:', error);
      console.error('🚨 OJT DEBUG: Error response:', error.response?.data);
      console.error('🚨 OJT DEBUG: Error status:', error.response?.status);
      console.error('🚨 OJT DEBUG: Error message:', error.message);
      console.error('🚨 OJT DEBUG: Current user:', userObj);
      
      // Show user-friendly error message
      if (error.response?.status === 401) {
        console.log('🚨 OJT DEBUG: Authentication error - redirecting to login');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      } else if (error.response?.status === 403) {
        console.log('🚨 OJT DEBUG: Permission denied for posts');
        alert('You do not have permission to view posts. Please contact an administrator.');
      } else {
        console.log('🚨 OJT DEBUG: Other error - setting empty posts');
        setPosts([]);
      }
    });

    // Fetch donation requests
    getDonationRequests().then((response) => {
      if (response.success) {
        // Transform donation data to match PostItem interface
        const transformedDonations: any[] = response.donations.map((donation: any) => ({
          donation_id: donation.donation_id,
          description: donation.description,
          status: donation.status,
          created_at: donation.created_at,
          user: donation.user,
          images: donation.images || [],
          likes_count: donation.likes_count || 0,
          comments_count: donation.comments_count || 0,
          reposts_count: donation.reposts_count || 0,
          is_liked: donation.is_liked,
          likes: donation.likes || [],
          comments: donation.comments || [],
          reposts: donation.reposts || []
        }));
        
        // Build a mixed feed of donations and donation reposts, sorted by date (newest first)
        const mixedFeed: any[] = [];
        
        // Original donations
        transformedDonations.forEach(donation => {
          mixedFeed.push({
            ...donation,
            post_id: donation.donation_id,
            post_content: donation.description,
            post_image: donation.images && donation.images.length > 0 ? donation.images[0].image_url : null,
            post_images: donation.images,
            item_type: 'post',
            sort_date: donation.created_at,
            feed_type: 'donation'
          });
          
          // Donation reposts
          if (donation.reposts && donation.reposts.length > 0) {
            donation.reposts.forEach((repost: any) => {
              mixedFeed.push({
                donation_id: donation.donation_id,
                post_id: repost.repost_id,
                post_content: donation.description,
                post_image: donation.images && donation.images.length > 0 ? donation.images[0].image_url : null,
                post_images: donation.images,
                created_at: repost.repost_date,
                type: 'donation',
                item_type: 'repost',
                sort_date: repost.repost_date,
                feed_type: 'donation_repost',
                user: repost.user,
                likes: repost.likes || [],
                comments: repost.comments || [],
                likes_count: repost.likes_count || 0,
                comments_count: repost.comments_count || 0,
                reposts: [],
                repostData: {
                  repost_id: repost.repost_id,
                  repost_date: repost.repost_date,
                  repost_caption: repost.repost_caption,
                  user: repost.user,
                  likes: repost.likes || [],
                  likes_count: repost.likes_count || 0,
                  comments: repost.comments || [],
                  comments_count: repost.comments_count || 0,
                  original_post: {
                    donation_id: donation.donation_id,
                    post_content: donation.description,
                    post_images: donation.images,
                    created_at: donation.created_at,
                    user: donation.user
                  }
                }
              });
            });
          }
        });
        
        const sortedFeed = mixedFeed.sort((a: any, b: any) => {
          const dateA = a.sort_date || a.created_at || '';
          const dateB = b.sort_date || b.created_at || '';
          
          const dateAObj = new Date(dateA);
          const dateBObj = new Date(dateB);
          
          return dateBObj.getTime() - dateAObj.getTime();
        });
        
        setDonations(sortedFeed);
        
        // Update liked and reposted states for donations
        const currentUserId = getCurrentUserId(userObj);
        const liked: { [key: number]: boolean } = {};
        const reposted: { [key: number]: boolean } = {};
        
        sortedFeed.forEach((item: any) => {
          if (item.item_type === 'repost') {
            // For reposts, use repost_id as the key for likes
            liked[item.repostData?.repost_id] = item.repostData?.likes?.some((like: any) => 
              (like.user?.user_id === currentUserId) || (like.user_id === currentUserId)
            ) || false;
            reposted[item.repostData?.repost_id] = false;
            
            // IMPORTANT: Also initialize the like state for the ORIGINAL donation post inside the repost
            if (item.repostData && item.repostData.original_post && item.repostData.original_post.donation_id) {
              const originalDonation = response.donations.find((d: any) => d.donation_id === item.repostData.original_post.donation_id);
              if (originalDonation) {
                liked[item.repostData.original_post.donation_id] = originalDonation.likes?.some((like: any) => like.user.user_id === currentUserId) || false;
                console.log('Initialized like state for original donation in repost:', item.repostData.original_post.donation_id, liked[item.repostData.original_post.donation_id]);
              }
            }
          } else {
            const donation = response.donations.find((d: any) => d.donation_id === item.donation_id);
            if (donation) {
              liked[item.donation_id] = donation.likes?.some((like: any) => like.user.user_id === currentUserId) || false;
              reposted[item.donation_id] = donation.reposts?.some((r: any) => r.user.user_id === currentUserId) || false;
            }
          }
        });
        
        // Merge with existing liked/reposted states
        setLikedDonations(prev => ({ ...prev, ...liked }));
        setRepostedDonations(prev => ({ ...prev, ...reposted }));
        console.log('Initialized donation states:', { liked, reposted });
      } else {
        console.error('Failed to fetch donation requests:', response.message);
        setDonations([]);
      }
    }).catch((error) => {
      console.error('Error fetching donation requests:', error);
      setDonations([]);
    });
  }, [navigate]);

  // Handle pull-to-refresh
  const handlePullToRefresh = async () => {
    if (isRefreshingRef.current || isRefreshing) return;
    
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    try {
      const updatedPosts = await getPosts();
      setPosts(updatedPosts || []);
      
      // Update likedPosts state
      const currentUserId = getCurrentUserId(user);
      const liked: { [key: number]: boolean } = {};
      (updatedPosts || []).forEach((post: any) => {
        if (post.item_type === 'post') {
          liked[post.post_id] = getIsLiked(post, currentUserId);
        } else if (post.item_type === 'repost') {
          liked[post.repost_id] = getIsLiked(post, currentUserId);
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
      
      console.log('✅ Feed refreshed via pull-to-refresh');
    } catch (error) {
      console.error('❌ Error refreshing feed:', error);
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
      setPullDistance(0);
    }
  };

  // Reset pull distance when not refreshing with smooth animation
  useEffect(() => {
    if (!isRefreshing && pullDistance > 0) {
      // Gradually decrease pull distance for smooth return animation
      const interval = setInterval(() => {
        setPullDistance(prev => {
          if (prev <= 0) {
            clearInterval(interval);
            return 0;
          }
          return Math.max(prev - 3, 0);
        });
      }, 16); // ~60fps animation
      
      return () => clearInterval(interval);
    }
  }, [isRefreshing, pullDistance]);

  // Donation feature removed: no donationRequests sync

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

  // Check for pending views when component mounts or navigates here
  useEffect(() => {
    // PRIORITIZE REPOSTS FIRST
    const pendingRepostId = localStorage.getItem('pendingRepostView');
    const pendingRepostCommentId = localStorage.getItem('pendingRepostCommentId');
    const pendingRepostReplyId = localStorage.getItem('pendingRepostReplyId');
    if (pendingRepostId) {
      console.log('Found pending repost view:', pendingRepostId);
      localStorage.removeItem('pendingRepostView');
      if (pendingRepostCommentId) {
        console.log('Found pending repost comment view:', pendingRepostCommentId);
        localStorage.removeItem('pendingRepostCommentId');
      }
      if (pendingRepostReplyId) {
        console.log('Found pending repost reply view:', pendingRepostReplyId);
        localStorage.removeItem('pendingRepostReplyId');
      }
      setRepostNotificationModalData({
        repostId: pendingRepostId,
        commentId: pendingRepostCommentId || undefined,
        replyId: pendingRepostReplyId || undefined
      });
      setShowRepostNotificationModal(true);
      // Suppress tracker reminder when repost modal opens
      if (trackerReminderTimeoutRef.current) {
        clearTimeout(trackerReminderTimeoutRef.current);
        trackerReminderTimeoutRef.current = null;
      }
      setShowTrackerModal(false);
      setTrackerReminderSuppressed(true);
      console.log('Opening repost notification modal for repost:', pendingRepostId);
    }

    // Then handle original post modal if any
    const pendingPostId = localStorage.getItem('pendingPostView');
    const pendingPostCommentId = localStorage.getItem('pendingPostCommentId');
    const pendingPostReplyId = localStorage.getItem('pendingPostReplyId');
    if (pendingPostId && !pendingRepostId) {
      console.log('Found pending post view:', pendingPostId);
      localStorage.removeItem('pendingPostView');
      
      // Store highlight IDs if present
      if (pendingPostCommentId) {
        console.log('Found pending post comment ID:', pendingPostCommentId);
        localStorage.removeItem('pendingPostCommentId');
        setPostHighlightCommentId(pendingPostCommentId);
      }
      if (pendingPostReplyId) {
        console.log('Found pending post reply ID:', pendingPostReplyId);
        localStorage.removeItem('pendingPostReplyId');
        setPostHighlightReplyId(pendingPostReplyId);
      }
      
      // Check if this is a comment or reply ID that needs to be resolved
      if (pendingPostId.startsWith('comment:') || pendingPostId.startsWith('reply:')) {
        const idType = pendingPostId.startsWith('comment:') ? 'comment' : 'reply';
        const id = parseInt(pendingPostId.replace(`${idType}:`, ''));
        console.log(`Resolving ${idType} ID to post:`, id);
        
        // Import and use getPostFromComment (works for both comments and replies)
        import('../../services/api').then(({ getPostFromComment }) => {
          getPostFromComment(id).then(response => {
            if (response.success && response.post_id) {
              console.log('Resolved to post ID:', response.post_id);
              handleViewPost(response.post_id.toString());
            } else {
              console.error(`Could not resolve ${idType} to post`);
            }
          }).catch(error => {
            console.error(`Error resolving ${idType} to post:`, error);
          });
        });
      } else {
        handleViewPost(pendingPostId);
      }
    }

    const pendingProfilePic = localStorage.getItem('pendingProfilePic');
    if (pendingProfilePic) {
      try {
        const profilePicData = JSON.parse(pendingProfilePic);
        console.log('🔍 Found pending profile pic data for posts update:', profilePicData);
        setPosts(prevPosts => {
          return prevPosts.map(post => {
            if (post.user && post.user.user_id == profilePicData.userId) {
              return {
                ...post,
                user: {
                  ...post.user,
                  profile_pic: profilePicData.profilePicUrl
                }
              };
            }
            return post;
          });
        });
        localStorage.removeItem('pendingProfilePic');
      } catch (error) {
        console.error('Error parsing pending profile pic data for posts:', error);
        localStorage.removeItem('pendingProfilePic');
      }
    }

  }, [userId, params]); // Check when userId or params change (navigation)

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

  const handleViewPost = async (postId: string, clearHighlights: boolean = false) => {
    // Clear highlight IDs if explicitly requested or if opening a different post
    if (clearHighlights || !postId) {
      setPostHighlightCommentId(undefined);
      setPostHighlightReplyId(undefined);
    }
    // Suppress tracker reminder when post modal opens
    if (trackerReminderTimeoutRef.current) {
      clearTimeout(trackerReminderTimeoutRef.current);
      trackerReminderTimeoutRef.current = null;
    }
    setShowTrackerModal(false);
    setTrackerReminderSuppressed(true);
    console.log('🔍 OJT DEBUG: handleViewPost called with postId:', postId);
    console.log('🔍 OJT DEBUG: Current user:', user);
    console.log('🔍 OJT DEBUG: User ID:', user?.user_id || user?.id);
    setPostLoading(true);
    try {
      console.log('🔍 OJT DEBUG: Fetching post from API...');
      const response = await api.get(`posts/${postId}/detail/`);
      console.log('🔍 OJT DEBUG: API response:', response.data);
      if (response.data) {
        // Check for pending profile picture data from notification
        const pendingProfilePic = localStorage.getItem('pendingProfilePic');
        console.log('🔍 Checking for pending profile pic data:', pendingProfilePic);
        if (pendingProfilePic) {
          try {
            const profilePicData = JSON.parse(pendingProfilePic);
            console.log('🔍 Found pending profile pic data:', profilePicData);
            console.log('🔍 Post author user_id:', response.data.user?.user_id);
            console.log('🔍 Profile pic data user_id:', profilePicData.userId);
            
            // Check if the profile pic data is for this post's author
            if (response.data.user && response.data.user.user_id == profilePicData.userId) {
              // Override the profile picture with the one from the notification
              console.log('🔍 Before update - post user profile_pic:', response.data.user.profile_pic);
              response.data.user.profile_pic = profilePicData.profilePicUrl;
              console.log('🔍 After update - post user profile_pic:', response.data.user.profile_pic);
              console.log('🔍 Updated post user profile pic with notification data:', profilePicData.profilePicUrl);
            } else {
              console.log('🔍 Profile pic data user ID does not match post author user ID');
            }
            
            // Clear the pending profile pic data after use
            localStorage.removeItem('pendingProfilePic');
          } catch (error) {
            console.error('Error parsing pending profile pic data:', error);
            localStorage.removeItem('pendingProfilePic');
          }
        } else {
          console.log('🔍 No pending profile pic data found');
        }
        
        setModalPost(response.data);
        setShowPostModal(true);
        console.log('🔍 OJT DEBUG: Post modal should now be visible');
      }
    } catch (error: any) {
      console.error('🚨 OJT DEBUG: Error fetching post:', error);
      console.error('🚨 OJT DEBUG: Error response:', error.response);
      console.error('🚨 OJT DEBUG: Error status:', error.response?.status);
      console.error('🚨 OJT DEBUG: Error data:', error.response?.data);
      
      // Better error handling with specific messages - only show alerts for user-initiated actions
      if (error.response?.status === 404) {
        console.log('🚨 OJT DEBUG: Post not found (404)');
        // Only show alert if this is a user-initiated action, not automatic loading
        if (postId && !postId.startsWith('pending')) {
          alert('This post has been deleted or is no longer available.');
        }
      } else if (error.response?.status === 403) {
        console.log('🚨 OJT DEBUG: Permission denied (403)');
        alert('You do not have permission to view this post.');
      } else if (error.response?.status === 401) {
        console.log('🚨 OJT DEBUG: Unauthorized (401)');
        alert('Please log in again to continue.');
        // Optionally redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      } else if (error.code === 'ERR_NETWORK') {
        console.log('🚨 OJT DEBUG: Network error');
        alert('Network error. Please check your connection and try again.');
      } else {
        console.error('🚨 OJT DEBUG: Unexpected error details:', error);
        // Only show alert for user-initiated actions
        if (postId && !postId.startsWith('pending')) {
          alert('Failed to load post. Please try again later.');
        }
      }
    } finally {
      setPostLoading(false);
    }
  };

  const handleViewForumPost = async (forumId: string) => {
    console.log('handleViewForumPost called with forumId:', forumId);
    setPostLoading(true);
    try {
      const response = await api.get(`forums/${forumId}/`);
      console.log('Forum API response:', response.data);
      if (response.data) {
        setModalPost(response.data);
        setShowPostModal(true);
      }
    } catch (error: any) {
      console.error('Error fetching forum post:', error);
      
      // Better error handling with specific messages
      if (error.response?.status === 404) {
        alert('This forum post has been deleted or is no longer available.');
      } else if (error.response?.status === 403) {
        alert('You do not have permission to view this forum post.');
      } else if (error.response?.status === 401) {
        alert('Please log in again to continue.');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      } else if (error.code === 'ERR_NETWORK') {
        alert('Network error. Please check your connection and try again.');
      } else {
        console.error('Unexpected error details:', error);
        alert('Failed to load forum post. Please try again later.');
      }
    } finally {
      setPostLoading(false);
    }
  };

  const handleViewDonationPost = async (donationId: string) => {
    console.log('handleViewDonationPost called with donationId:', donationId);
    setPostLoading(true);
    try {
      const response = await api.get(`donations/${donationId}/`);
      console.log('Donation API response:', response.data);
      if (response.data) {
        // Transform donation data to match post structure
        const donationPost = {
          ...response.data,
          post_id: response.data.donation_id,
          post_content: response.data.description,
          isDonation: true
        };
        setModalPost(donationPost);
        setShowPostModal(true);
      }
    } catch (error: any) {
      console.error('Error fetching donation post:', error);
      
      // Better error handling with specific messages
      if (error.response?.status === 404) {
        alert('This donation request has been deleted or is no longer available.');
      } else if (error.response?.status === 403) {
        alert('You do not have permission to view this donation request.');
      } else if (error.response?.status === 401) {
        alert('Please log in again to continue.');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      } else if (error.code === 'ERR_NETWORK') {
        alert('Network error. Please check your connection and try again.');
      } else {
        console.error('Unexpected error details:', error);
        alert('Failed to load donation request. Please try again later.');
      }
    } finally {
      setPostLoading(false);
    }
  };

  const handleViewPostFromComment = async (commentId: string) => {
    console.log('handleViewPostFromComment called with commentId:', commentId);
    setPostLoading(true);
    try {
      // First get the post ID from the comment
      const commentResponse = await api.get(`comments/${commentId}/post/`);
      console.log('Comment to post API response:', commentResponse.data);
      
      if (commentResponse.data && commentResponse.data.post_id) {
        const postId = commentResponse.data.post_id;
        const postType = commentResponse.data.post_type;
        console.log('Found post ID from comment:', postId, 'Type:', postType);
        
        // Handle different post types
        if (postType === 'post') {
          // Regular post
        const postResponse = await api.get(`posts/${postId}/detail/`);
        console.log('Post API response:', postResponse.data);
        
        if (postResponse.data) {
          setModalPost(postResponse.data);
          setShowPostModal(true);
          console.log('Post modal should now be visible for comment');
        }
        } else if (postType === 'forum') {
          // Forum post
          handleViewForumPost(postId);
        } else if (postType === 'donation') {
          // Donation post
          handleViewDonationPost(postId);
        } else if (postType === 'repost') {
          // Repost - show repost modal
          setRepostModalData({ repostId: postId });
          setShowRepostModal(true);
        }
      }
    } catch (error: any) {
      console.error('Error fetching post from comment:', error);
      
      // Better error handling - don't show alert for 404s, just log and continue
      if (error.response?.status === 404) {
        console.log('Comment not found, this might be a deleted comment or invalid ID');
        // Don't show error alert for missing comments
      } else {
        console.error('Unexpected error:', error);
        // Only show alert for unexpected errors
        alert('Failed to load post from comment. The comment may have been deleted.');
      }
    } finally {
      setPostLoading(false);
    }
  };

  const handleViewPostFromReply = async (replyId: string) => {
    console.log('handleViewPostFromReply called with replyId:', replyId);
    setPostLoading(true);
    try {
      // First get the comment ID from the reply, then get the post ID from the comment
      const replyResponse = await api.get(`replies/${replyId}/comment/`);
      console.log('Reply to comment API response:', replyResponse.data);
      
      if (replyResponse.data && replyResponse.data.comment_id) {
        const commentId = replyResponse.data.comment_id;
        console.log('Found comment ID from reply:', commentId);
        
        // Now get the post ID from the comment
        const commentResponse = await api.get(`comments/${commentId}/post/`);
        console.log('Comment to post API response:', commentResponse.data);
        
        if (commentResponse.data && commentResponse.data.post_id) {
          const postId = commentResponse.data.post_id;
          const postType = commentResponse.data.post_type;
          console.log('Found post ID from reply:', postId, 'Type:', postType);
          
          // Handle different post types
          if (postType === 'post') {
            // Regular post
            const postResponse = await api.get(`posts/${postId}/detail/`);
            console.log('Post API response:', postResponse.data);
            
            if (postResponse.data) {
              setModalPost(postResponse.data);
              setShowPostModal(true);
              console.log('Post modal should now be visible for reply');
            }
          } else if (postType === 'forum') {
            // Forum post
            handleViewForumPost(postId);
          } else if (postType === 'donation') {
            // Donation post
            handleViewDonationPost(postId);
          } else if (postType === 'repost') {
            // Repost - show repost modal
            setRepostModalData({ repostId: postId });
            setShowRepostModal(true);
          }
        }
      }
    } catch (error: any) {
      console.error('Error fetching post from reply:', error);
      
      // Better error handling - don't show alert for 404s, just log and continue
      if (error.response?.status === 404) {
        console.log('Reply not found, this might be a deleted reply or invalid ID');
        // Don't show error alert for missing replies
      } else {
        console.error('Unexpected error:', error);
        // Only show alert for unexpected errors
        alert('Failed to load post from reply. The reply may have been deleted.');
      }
    } finally {
      setPostLoading(false);
    }
  };

  const handleViewOriginalPost = async (originalPost: any) => {
    console.log('handleViewOriginalPost called with original post:', originalPost);
    setPostLoading(true);
    try {
      // Check if this is a donation post or regular post
      const postId = originalPost.donation_id || originalPost.post_id;
      
      if (!postId) {
        console.error('No valid post ID found:', originalPost);
        alert('Cannot load post: Invalid post ID');
        setPostLoading(false);
        return;
      }

      // For donation posts, fetch full data (likes, comments, etc.) for consistency
      if (originalPost.donation_id) {
        console.log('Fetching donation detail for modal:', originalPost.donation_id);
        const response = await api.get(`donations/${postId}/`);
        console.log('Original donation API response:', response.data);
        if (response.data) {
          const d = response.data;
          const donationModalData = {
            donation_id: d.donation_id,
            post_id: d.donation_id,
            description: d.description,
            post_content: d.description || originalPost.post_content,
            images: d.images || [],
            post_images: d.images || [],
            created_at: d.created_at,
            user: d.user,
            likes: d.likes || [],
            comments: d.comments || [],
            likes_count: d.likes_count || 0,
            comments_count: d.comments_count || 0,
            reposts_count: d.reposts_count || 0,
          } as any;
          setOriginalPostModalData(donationModalData);
          setShowOriginalPostModal(true);
        }
      } else {
        // This is a regular post, fetch from API
        const response = await api.get(`posts/${postId}/detail/`);
        console.log('Original post API response:', response.data);
        if (response.data) {
          setOriginalPostModalData(response.data);
          setShowOriginalPostModal(true);
          console.log('Original post modal should now be visible');
        }
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
        onTrackerClick={isAdmin ? () => navigate('/tracker/questions') : undefined}
      />
      <div className="main-content">
        {/* Left Sidebar */}
        <div className="left-sidebar">
          <div
            className="profile-card"
            onClick={() => {
              if (isAdmin) {
                navigate('/ccict/profile');
                return;
              }
              if (user && (user as any).account_type) {
                if ((user as any).account_type.peso) {
                  navigate('/peso/profile');
                } else if ((user as any).account_type.ccict) {
                  navigate('/ccict/profile');
                } else if ((user as any).account_type.ojt) {
                  navigate('/ojt/profile');
                } else {
                  navigate('/profile');
                }
              } else {
                navigate('/profile');
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
          {(actualUserType === 'alumni' || actualUserType === 'ojt') && (
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
                      style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div className="quick-link-text">{adminUserData?.name || 'CCICT'}</div>
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
                      style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div className="quick-link-text">{pesoUserData?.name || 'PESO'}</div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {actualUserType === 'alumni' && (
                <div
                  className="quick-link-card"
                  onClick={() => navigate('/forum')}
                  style={{ flex: 1, cursor: 'pointer', transition: 'transform 0.2s ease-in-out' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <div className="quick-link-orange-header"></div>
                  <div className="quick-link-content">
                    <div className="quick-link-icon" style={{ fontSize: '28px', color: '#333', background: 'transparent' }}>
                      <HiOutlineUsers />
                    </div>
                    <div className="quick-link-text">FORUM</div>
                  </div>
                </div>
                )}
                {actualUserType === 'alumni' && (
                <div
                  className="quick-link-card"
                  onClick={() => navigate('/donation')}
                  style={{ flex: 1, cursor: 'pointer', transition: 'transform 0.2s ease-in-out' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <div className="quick-link-orange-header"></div>
                  <div className="quick-link-content">
                    <div className="quick-link-icon" style={{ fontSize: '28px', color: '#333', background: 'transparent' }}>
                      <HiOutlineHeart />
                    </div>
                    <div className="quick-link-text">DONATION</div>
                  </div>
                </div>
                )}
              </div>
            </div>
          )}
          {/* admin: no quick links, just profile card */}
        </div>
        {/* Center Content */}
        <div className="center-content">
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
          {/* Pull-to-Refresh Indicator */}
          {pullDistance > 0 && (
            <div style={{
              textAlign: 'center',
              padding: `${Math.min(pullDistance * 0.15, 15)}px 8px`,
              background: 'linear-gradient(180deg, #e3f2fd 0%, #f8f9fa 100%)',
              transition: 'all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1)',
              opacity: Math.min(pullDistance / 40, 1),
              transform: `scale(${Math.min(0.8 + pullDistance / 200, 1)})`,
              borderBottom: pullDistance >= 50 ? '2px solid #1e3a8a' : '2px solid #e0e0e0',
              boxShadow: pullDistance >= 50 ? '0 2px 8px rgba(30, 58, 138, 0.15)' : 'none'
            }}>
              {isRefreshing ? (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: '8px'
                }}>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid #e0e0e0',
                    borderTopColor: '#1e3a8a',
                    borderRadius: '50%',
                    animation: 'spin 0.6s linear infinite'
                  }}></div>
                  <span style={{ color: '#1e3a8a', fontSize: '14px', fontWeight: '500' }}>
                    Refreshing...
                  </span>
                </div>
              ) : pullDistance >= 50 ? (
                <span style={{ color: '#1e3a8a', fontSize: '14px', fontWeight: '500' }}>
                  ↓ Release to refresh
                </span>
              ) : (
                <span style={{ color: '#666', fontSize: '14px' }}>
                  ↓ Pull down to refresh
                </span>
              )}
            </div>
          )}
          
          {/* Scrollable Feed Container */}
          <div 
            className="scrollable-feed"
            style={{
              maxHeight: 'calc(100vh - 140px)',
              overflowY: 'auto',
              overflowX: 'hidden',
              paddingRight: '8px',
              scrollbarWidth: 'none', /* Firefox */
              msOverflowStyle: 'none',  /* IE and Edge */
              transform: pullDistance > 0 ? `translateY(${Math.min(pullDistance * 0.4, 70)}px)` : 'translateY(0)',
              transition: isRefreshing 
                ? 'transform 0.4s cubic-bezier(0.4, 0.0, 0.2, 1)' 
                : 'transform 0.15s cubic-bezier(0.4, 0.0, 0.2, 1)',
              willChange: 'transform'
            }}
            onWheel={(e) => {
              const scrollableFeed = e.currentTarget;
              // Prevent action during refresh
              if (isRefreshingRef.current || isRefreshing) return;
              
              // Only trigger pull-to-refresh when at the top and scrolling up
              if (scrollableFeed.scrollTop === 0 && e.deltaY < 0) {
                setPullDistance(prev => {
                  // Balanced sensitivity
                  const newDistance = Math.min(prev + Math.abs(e.deltaY) * 0.8, 100);
                  // Only trigger once when crossing threshold
                  if (newDistance >= 50 && prev < 50 && !isRefreshingRef.current) {
                    // Small delay to prevent glitches
                    setTimeout(() => handlePullToRefresh(), 50);
                  }
                  return newDistance;
                });
              } else if (scrollableFeed.scrollTop > 0 && pullDistance > 0) {
                setPullDistance(0);
              }
            }}
            onScroll={(e) => {
              const scrollableFeed = e.currentTarget;
              if (scrollableFeed.scrollTop > 0) {
                setPullDistance(0);
              }
            }}
          >
          <div className="post-start" onClick={() => setShowComposer(true)} style={{ cursor: 'pointer', marginBottom: '16px' }}>
            <div className="post-start-input-container">
              <img src={user?.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : ctulogo} alt="Profile" className="post-start-profile-image" />
              <input type="text" placeholder="Start a post" className="post-start-input" readOnly />
            </div>
          </div>
          {(() => {
            if (userType === 'alumni' || userType === 'ojt') {
              // Create a unified feed with both posts and donations, sorted by date
              const unifiedFeed: any[] = [];
              
              // Add posts to the unified feed
              posts.forEach(post => {
                unifiedFeed.push({
                  ...post,
                  feed_type: 'post',
                  sort_date: post.sort_date || post.created_at || new Date().toISOString()
                });
              });
              
              // Add donations to the unified feed
              donations.forEach(donation => {
                unifiedFeed.push({
                  ...donation,
                  sort_date: donation.sort_date || donation.created_at || new Date().toISOString()
                });
              });
              
              // Sort the unified feed with CCICT/PESO posts prioritized, then by date
              const sortedUnifiedFeed = unifiedFeed.sort((a: any, b: any) => {
                // Helper function to check if post is from CCICT or PESO
                const isPriority = (item: any): boolean => {
                  let itemUserId: number | undefined;
                  let itemUser: any;
                  
                  if (item.feed_type === 'post') {
                    if (item.item_type === 'repost' && 'repost_id' in item) {
                      itemUserId = item.user?.user_id;
                      itemUser = item.user;
                    } else {
                      itemUserId = item.user?.user_id;
                      itemUser = item.user;
                    }
                  } else if (item.feed_type === 'donation' || item.feed_type === 'donation_repost') {
                    itemUserId = item.user?.user_id;
                    itemUser = item.user;
                  }
                  
                  // Check if user is CCICT or PESO
                  let isCcict = false, isPeso = false;
                  if (itemUser && itemUser.account_type) {
                    isCcict = !!(itemUser.account_type.ccict || itemUser.account_type.admin);
                    isPeso = !!itemUser.account_type.peso;
                  }
                  
                  // Also check against fetched admin and PESO user IDs
                  if (itemUserId && pesoUserIds.includes(itemUserId)) {
                    isPeso = true;
                  } else if (itemUserId && adminUserIds.includes(itemUserId)) {
                    isCcict = true;
                  }
                  
                  return isCcict || isPeso;
                };
                
                const aPriority = isPriority(a);
                const bPriority = isPriority(b);
                
                // First, sort by date to ensure recent posts are at the top
                const dateA = new Date(a.sort_date);
                const dateB = new Date(b.sort_date);
                
                // Sort by date in descending order (most recent first)
                if (dateA.getTime() !== dateB.getTime()) {
                  return dateB.getTime() - dateA.getTime();
                }
                
                // If dates are the same, apply priority for admin/PESO posts
                if (aPriority && !bPriority) return -1;
                if (!aPriority && bPriority) return 1;
                
                // If both are priority or both are not, maintain original order (or any stable sort)
                return 0;
              });
              
              const filteredFeed = sortedUnifiedFeed.filter(item => {
                // Hide donations for OJT accounts (robust across shapes)
                if (userType === 'ojt') {
                  const isDonationFeed = item.feed_type === 'donation' || item.feed_type === 'donation_repost';
                  const isDonationType = item.type === 'donation' || item.post_type === 'donation';
                  const isDonationRepost = (item.item_type === 'repost') && (item.type === 'donation' || item.feed_type === 'donation_repost' || item.post_type === 'donation');
                  if (isDonationFeed || isDonationType || isDonationRepost) {
                    return false;
                  }
                }
                
                const currentUserId = getCurrentUserId(user);
                
                // Handle different feed item types
                let itemUserId: number | undefined;
                let itemUser: any;
                
                if (item.feed_type === 'post') {
                  // This is a regular post
                  if (item.item_type === 'repost' && 'repost_id' in item) {
                    // This is a post repost item
                    itemUserId = item.user?.user_id;
                    itemUser = item.user;
                  } else {
                    // This is a regular post item
                    itemUserId = item.user?.user_id;
                    itemUser = item.user;
                  }
                } else if (item.feed_type === 'donation' || item.feed_type === 'donation_repost') {
                  // Handle donation items
                  if (item.feed_type === 'donation_repost') {
                    // This is a donation repost item
                    itemUserId = item.user?.user_id;
                    itemUser = item.user;
                  } else {
                    // This is a regular donation item
                    itemUserId = item.user?.user_id;
                    itemUser = item.user;
                  }
                }
                
                const isOwn = currentUserId && itemUserId && Number(itemUserId) === Number(currentUserId);
                let isFollowed = false;
                if (Array.isArray(following) && itemUserId) {
                  isFollowed = following.some(f => {
                    let followedId: number | undefined = undefined;
                    if (typeof f === 'object' && f !== null) {
                      if ('user' in f && f.user && typeof f.user === 'object' && 'user_id' in f.user && typeof f.user.user_id === 'number') {
                        followedId = f.user.user_id;
                      } else if ('user_id' in f && typeof f.user_id === 'number') {
                        followedId = f.user_id;
                      }
                    }
                    return followedId !== undefined && Number(followedId) === Number(itemUserId);
                  });
                }
                let isCcict = false, isPeso = false;
                
                if (itemUser && itemUser.account_type) {
                  // Check for both possible field names (ccict/admin, peso)
                  isCcict = !!(itemUser.account_type.ccict || itemUser.account_type.admin);
                  isPeso = !!itemUser.account_type.peso;
                }
                
                // DYNAMIC CHECK: Use fetched admin and PESO user IDs
                const itemUserIdForCheck = itemUserId;
                if (itemUserIdForCheck && pesoUserIds.includes(itemUserIdForCheck)) {
                  isPeso = true;
                  console.log('Dynamic PESO check - item from user', itemUserIdForCheck);
                } else if (itemUserIdForCheck && adminUserIds.includes(itemUserIdForCheck)) {
                  isCcict = true;
                  console.log('Dynamic admin check - item from user', itemUserIdForCheck);
                }
                
                // For reposts, show if the reposter is visible (original post visibility is not required)
                // This allows reposts to be shown based on who reposted it, not who originally posted it
                
                // Show items from: own items, followed users, PESO items, or admin items
                // PESO and admin items are always visible regardless of follow status
                const shouldShow = isOwn || isFollowed || isCcict || isPeso;
                
                
                // Debug filtering
                if (item.feed_type === 'donation_repost' || item.item_type === 'repost') {
                  console.log('🔍 DEBUG: Item filter result:', {
                    feed_type: item.feed_type,
                    shouldShow,
                    isOwn,
                    isFollowed,
                    isCcict,
                    isPeso,
                    itemUserId,
                    currentUserId
                  });
                }
                
                return shouldShow;
              });
              
              const renderedItems = filteredFeed.reduce((acc: any[], item: any) => {
                const currentUserId = getCurrentUserId(user);
                
                // Handle different feed item types
                // Hard block donations for OJT at render time as well (belt & suspenders)
                if (userType === 'ojt') {
                  const isDonation = item.feed_type === 'donation' || item.type === 'donation' || item.post_type === 'donation';
                  const isDonationRep = (item.item_type === 'repost') && (item.type === 'donation' || item.feed_type === 'donation_repost' || item.post_type === 'donation');
                  if (isDonation || isDonationRep) {
                    return acc; // skip
                  }
                }

                if (item.feed_type === 'donation' || item.feed_type === 'donation_repost') {
                  // Handle donation items
                  if (item.feed_type === 'donation_repost' && item.repostData) {
                    // Render as donation repost card using RepostCard
                    const donationRepostCard = (
                      <RepostCard
                          key={`donation-repost-${item.repostData.repost_id}`}
                          repost={{
                            repost_id: item.repostData.repost_id,
                            repost_date: item.repostData.repost_date,
                            repost_caption: item.repostData.repost_caption,
                            user: item.repostData.user,
                            likes: item.repostData.likes || item.likes || [],
                            likes_count: item.repostData.likes_count || item.likes_count || 0,
                            comments: item.repostData.comments || item.comments || [],
                            comments_count: item.repostData.comments_count || item.comments_count || 0,
                            original_post: item.repostData.original_post ? {
                              donation_id: item.repostData.original_post.donation_id,
                              post_content: item.repostData.original_post.post_content,
                              post_images: item.repostData.original_post.post_images,
                              created_at: item.repostData.original_post.created_at,
                              user: item.repostData.original_post.user
                            } : undefined
                          }}
                          currentUserId={currentUserId}
                          formatTime={formatHybrid}
                          onViewOriginalPost={handleViewOriginalPost}
                          context="donation"
                          currentUserAvatar={user?.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : ctulogo}
                          onRefresh={() => {
                            // Refresh donations
                            getDonationRequests().then((donationResponse) => {
                            if (donationResponse.success) {
                              // Transform donation data
                              const transformedDonations: any[] = donationResponse.donations.map((donation: any) => ({
                                donation_id: donation.donation_id,
                                description: donation.description,
                                status: donation.status,
                                created_at: donation.created_at,
                                user: donation.user,
                                images: donation.images || [],
                                likes_count: donation.likes_count || 0,
                                comments_count: donation.comments_count || 0,
                                reposts_count: donation.reposts_count || 0,
                                is_liked: donation.is_liked,
                                likes: donation.likes || [],
                                comments: donation.comments || [],
                                reposts: donation.reposts || []
                              }));
                              
                              // Build mixed feed
                              const mixedFeed: any[] = [];
                              transformedDonations.forEach(donation => {
                                mixedFeed.push({
                                  ...donation,
                                  post_id: donation.donation_id,
                                  post_content: donation.description,
                                  post_image: donation.images && donation.images.length > 0 ? donation.images[0].image_url : null,
                                  post_images: donation.images,
                                  item_type: 'post',
                                  sort_date: donation.created_at,
                                  feed_type: 'donation'
                                });
                                
                                if (donation.reposts && donation.reposts.length > 0) {
                                  donation.reposts.forEach((repost: any) => {
                                    mixedFeed.push({
                                      donation_id: donation.donation_id,
                                      post_id: repost.repost_id,
                                      post_content: donation.description,
                                      post_image: donation.images && donation.images.length > 0 ? donation.images[0].image_url : null,
                                      post_images: donation.images,
                                      created_at: repost.repost_date,
                                      type: 'donation',
                                      item_type: 'repost',
                                      sort_date: repost.repost_date,
                                      feed_type: 'donation_repost',
                                      user: repost.user,
                                      likes: repost.likes || [],
                                      comments: repost.comments || [],
                                      likes_count: repost.likes_count || 0,
                                      comments_count: repost.comments_count || 0,
                                      reposts: [],
                                      repostData: {
                                        repost_id: repost.repost_id,
                                        repost_date: repost.repost_date,
                                        repost_caption: repost.repost_caption,
                                        user: repost.user,
                                        likes: repost.likes || [],
                                        likes_count: repost.likes_count || 0,
                                        comments: repost.comments || [],
                                        comments_count: repost.comments_count || 0,
                                        original_post: {
                                          donation_id: donation.donation_id,
                                          post_content: donation.description,
                                          post_images: donation.images,
                                          created_at: donation.created_at,
                                          user: donation.user
                                        }
                                      }
                                    });
                                  });
                                }
                              });
                              
                              setDonations(mixedFeed);
                            }
                            });
                          }}
                      />
                    );
                    acc.push(donationRepostCard);
                  return acc;
                  } else {
                    // Render as regular donation post
                    const donationItem = item;
                    const isOwn = currentUserId !== null && donationItem.user?.user_id && Number(donationItem.user.user_id) === Number(currentUserId);
                    const displayName = formatDisplayName(donationItem.user, !!isOwn, user);
                    const donationUserAvatar = donationItem.user?.profile_pic ? (String(donationItem.user.profile_pic).startsWith('http') ? donationItem.user.profile_pic : `http://127.0.0.1:8000${donationItem.user.profile_pic}`) : undefined;
                    const displayAvatar = isOwn && user?.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : (donationUserAvatar || ctulogo);
                    
                    const donationCard = (
                      <PostCard
                          key={donationItem.donation_id}
                          post={donationItem}
                          currentUserId={currentUserId}
                          isOwn={!!isOwn}
                          displayName={displayName}
                          displayAvatar={displayAvatar}
                          formatTime={formatHybrid}
                          onViewOriginalPost={handleViewOriginalPost}
                          likedPosts={likedDonations}
                          setLikedPosts={setLikedDonations}
                          showCommentInput={showCommentInput}
                          setShowCommentInput={setShowCommentInput}
                          commentInput={commentInput}
                          setCommentInput={setCommentInput}
                          editingComment={editingComment}
                          setEditingComment={setEditingComment}
                          editCommentContent={editCommentContent}
                          setEditCommentContent={setEditCommentContent}
                        onPostUpdate={() => {
                          console.log('onPostUpdate called for donation - refreshing...');
                          // Refresh both posts and donations
                          Promise.all([getPosts(), getDonationRequests()]).then(([updatedPosts, donationResponse]) => {
                            if (donationResponse.success) {
                              // Transform donation data
                              const transformedDonations: any[] = donationResponse.donations.map((donation: any) => ({
                                donation_id: donation.donation_id,
                                description: donation.description,
                                status: donation.status,
                                created_at: donation.created_at,
                                user: donation.user,
                                images: donation.images || [],
                                likes_count: donation.likes_count || 0,
                                comments_count: donation.comments_count || 0,
                                reposts_count: donation.reposts_count || 0,
                                is_liked: donation.is_liked,
                                likes: donation.likes || [],
                                comments: donation.comments || [],
                                reposts: donation.reposts || []
                              }));
                              
                              // Build mixed feed
                              const mixedFeed: any[] = [];
                              transformedDonations.forEach(donation => {
                                mixedFeed.push({
                                  ...donation,
                                  post_id: donation.donation_id,
                                  post_content: donation.description,
                                  post_image: donation.images && donation.images.length > 0 ? donation.images[0].image_url : null,
                                  post_images: donation.images,
                                  item_type: 'post',
                                  sort_date: donation.created_at,
                                  feed_type: 'donation'
                                });
                                
                                if (donation.reposts && donation.reposts.length > 0) {
                                  donation.reposts.forEach((repost: any) => {
                                    mixedFeed.push({
                                      donation_id: donation.donation_id,
                                      post_id: repost.repost_id,
                                      post_content: donation.description,
                                      post_image: donation.images && donation.images.length > 0 ? donation.images[0].image_url : null,
                                      post_images: donation.images,
                                      created_at: repost.repost_date,
                                      type: 'donation',
                                      item_type: 'repost',
                                      sort_date: repost.repost_date,
                                      feed_type: 'donation_repost',
                                      user: repost.user,
                                      likes: repost.likes || [],
                                      comments: repost.comments || [],
                                      likes_count: repost.likes_count || 0,
                                      comments_count: repost.comments_count || 0,
                                      reposts: [],
                                      repostData: {
                                        repost_id: repost.repost_id,
                                        repost_date: repost.repost_date,
                                        repost_caption: repost.repost_caption,
                                        user: repost.user,
                                        original_post: {
                                          donation_id: donation.donation_id,
                                          description: donation.description,
                                          post_content: donation.description, // Add post_content for compatibility with PostCard
                                          images: donation.images,
                                          post_images: donation.images, // Add post_images for compatibility with getImagesFromPost
                                          post_image: donation.images && donation.images.length > 0 ? donation.images[0].image_url : null, // Add post_image for single image compatibility
                                          created_at: donation.created_at,
                                          user: donation.user,
                                          likes: donation.likes || [],
                                          likes_count: donation.likes_count || 0
                                        }
                                      }
                                    });
                                  });
                                }
                              });
                              
                              setDonations(mixedFeed);
                            }
                            setPosts(updatedPosts || []);
                            
                            // Update likedPosts state
                            const currentUserId = getCurrentUserId(user);
                            const liked: { [key: number]: boolean } = {};
                            (updatedPosts || []).forEach((post: any) => {
                              if (post.item_type === 'post') {
                                liked[post.post_id] = getIsLiked(post, currentUserId);
                              } else if (post.item_type === 'repost') {
                                liked[post.repost_id] = getIsLiked(post, currentUserId);
                              }
                            });
                            setLikedPosts(liked);
                          });
                        }}
                        showOptions={showOptions}
                        setShowOptions={setShowOptions}
                        editingPost={editingPost}
                        setEditingPost={setEditingPost}
                        editPostContent={editPostContent}
                        setEditPostContent={setEditPostContent}
                        repostedPosts={repostedDonations}
                        setRepostedPosts={setRepostedDonations}
                        isForum={false}
                        isDonation={true}
                      />
                    );
                    acc.push(donationCard);
                    return acc;
                  }
                } else if (item.feed_type === 'post') {
                  // Handle post items (existing logic)
                  // Render repost items with new RepostCard
                  if (item.item_type === 'repost' && 'repost_id' in item) {
                    const r = item as RepostFeedItem;
                    acc.push(
                      <RepostCard
                        key={`repost-${r.repost_id}`}
                        repost={{
                          repost_id: r.repost_id,
                          repost_date: r.repost_date,
                          repost_caption: r.repost_caption,
                          user: { user_id: r.user?.user_id || 0, f_name: r.user?.f_name, m_name: r.user?.m_name, l_name: r.user?.l_name, profile_pic: r.user?.profile_pic },
                          likes: r.likes || [],
                          likes_count: r.likes_count || 0,
                          comments: r.comments || [],
                          comments_count: r.comments_count || 0,
                          original_post: {
                            post_id: r.original_post?.post_id,
                            created_at: r.original_post?.created_at,
                            post_content: r.original_post?.post_content,
                            post_images: r.original_post?.post_images || [],
                            is_event: r.original_post?.is_event,
                            event_date: r.original_post?.event_date,
                            event_time: r.original_post?.event_time,
                            user: {
                              user_id: r.original_post?.user?.user_id || 0,
                              f_name: r.original_post?.user?.f_name,
                              m_name: r.original_post?.user?.m_name,
                              l_name: r.original_post?.user?.l_name,
                              profile_pic: r.original_post?.user?.profile_pic
                            },
                          },
                        }}
                        currentUserId={currentUserId}
                        formatTime={formatHybrid}
                        onRefresh={() => getPosts().then(setPosts)}
                        context={'post'}
                        onViewOriginalPost={handleViewOriginalPost}
                        currentUserAvatar={user?.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : ctulogo}
                      />
                    );
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
                            if (post.item_type === 'post') {
                              liked[post.post_id] = getIsLiked(post, currentUserId);
                            } else if (post.item_type === 'repost') {
                              liked[post.repost_id] = getIsLiked(post, currentUserId);
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
                }
                return acc;
              }, []);

              if (renderedItems.length === 0) {
                return (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px',
                    color: '#666',
                    fontSize: '16px'
                  }}>
                    No posts yet. Start following users or create your first post.
                  </div>
                );
              }

              return renderedItems;
            } else {
              // For admin/peso users, show regular posts
              const renderedItems = posts.reduce((acc: any[], item: FeedItem) => {
                const currentUserId = getCurrentUserId(user);
                
                // Check if this is a repost item or a regular post item
                if (item.item_type === 'repost' && 'repost_id' in item) {
                  const r = item as RepostFeedItem;
                  acc.push(
                    <RepostCard
                      key={`repost-${r.repost_id}`}
                      repost={{
                        repost_id: r.repost_id,
                        repost_date: r.repost_date,
                        repost_caption: r.repost_caption,
                        user: { user_id: r.user?.user_id || 0, f_name: r.user?.f_name, m_name: r.user?.m_name, l_name: r.user?.l_name, profile_pic: r.user?.profile_pic },
                        likes: r.likes || [],
                        likes_count: r.likes_count || 0,
                        comments: r.comments || [],
                        comments_count: r.comments_count || 0,
                        original_post: r.original_post ? {
                          post_id: r.original_post.post_id,
                          created_at: r.original_post.created_at,
                          post_content: r.original_post.post_content,
                          post_images: r.original_post.post_images || (r.original_post.post_image ? [{ image_id: 0, image_url: r.original_post.post_image, order: 0 }] : undefined),
                          user: r.original_post.user ? { user_id: r.original_post.user.user_id || 0, f_name: r.original_post.user.f_name, m_name: r.original_post.user.m_name, l_name: r.original_post.user.l_name, profile_pic: r.original_post.user.profile_pic } : undefined
                        } : undefined
                      }}
                      currentUserId={currentUserId}
                      formatTime={formatHybrid}
                      onRefresh={() => getPosts().then(setPosts)}
                      context={'post'}
                      currentUserAvatar={user?.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : ctulogo}
                    />
                  );
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
                          if (post.item_type === 'post') {
                            liked[post.post_id] = getIsLiked(post, currentUserId);
                          } else if (post.item_type === 'repost') {
                            liked[post.repost_id] = getIsLiked(post, currentUserId);
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
              }, []);

              if (renderedItems.length === 0) {
                return (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px',
                    color: '#666',
                    fontSize: '16px'
                  }}>
                    No posts available.
                  </div>
                );
              }

              return renderedItems;
            }
          })()}
          </div>
          {/* End Scrollable Feed Container */}
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
                  <div key={user.id} className="suggested-user-item" onClick={() => {
                    const currentUserRole = (user as any)?.role || (user as any)?.user_type;
                    if ((user as any)?.account_type?.ojt || currentUserRole === 'ojt' || currentUserRole === 'coordinator') {
                      navigate(`/ojt/profile/${user.id}`);
                    } else {
                      navigate(`/profile/${user.id}`);
                    }
                  }} style={{ cursor: 'pointer' }}>
                    <img src={user.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : ctulogo} alt={user.name} className="suggested-user-profile-image" />
                    <div className="suggested-user-name">{user.name} {user.batch ? `(${user.batch})` : ''}</div>
                    {/* Hide Follow button when current user is admin/peso (auto-follows everyone) or when suggested user is admin/peso */}
                    {!isAdmin && !isPeso && !user.account_type?.admin && !user.account_type?.peso && (
                      <button className="suggested-user-follow-button" onClick={e => { e.stopPropagation(); handleFollow(user.id); }} disabled={followLoading[user.id]}>
                        {followLoading[user.id] ? '...' : 'Follow'}
                      </button>
                    )}
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
                displayAvatar={getProfilePicUrl(modalPost.user?.profile_pic) || '/default-avatar.png'}
                formatTime={formatHybrid}
                onViewOriginalPost={handleViewOriginalPost}
                highlightCommentId={postHighlightCommentId}
                highlightReplyId={postHighlightReplyId}
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
                      if (post.item_type === 'post') {
                        liked[post.post_id] = getIsLiked(post, currentUserId);
                      } else if (post.item_type === 'repost') {
                        liked[post.repost_id] = getIsLiked(post, currentUserId);
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
                    const currentUserRole = (user as any)?.role || (user as any)?.user_type;
                    if ((user as any)?.account_type?.ojt || currentUserRole === 'ojt' || currentUserRole === 'coordinator') {
                      navigate(`/ojt/profile/${user.id}`);
                    } else {
                      navigate(`/profile/${user.id}`);
                    }
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
                  {/* Hide Follow button when current user is admin/peso (auto-follows everyone) or when suggested user is admin/peso */}
                  {!isAdmin && !isPeso && !user.account_type?.admin && !user.account_type?.peso && (
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
                  )}
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
                displayAvatar={(() => {
                  // Normalize via util and add cache-buster if we have a real pic
                  const raw = originalPostModalData.user?.profile_pic;
                  const normalized = getProfilePicUrl(raw, ctulogo);
                  if (!raw) return normalized; // fallback image, no bust
                  const sep = normalized.includes('?') ? '&' : '?';
                  return `${normalized}${sep}cb=${Date.now()}`;
                })()}
                formatTime={formatHybrid}
                onViewOriginalPost={handleViewOriginalPost}
                onPostUpdate={() => {
                  // Refresh the original post data in modal
                  const postId = originalPostModalData.post_id || originalPostModalData.donation_id;
                  if (postId) {
                    handleViewOriginalPost(originalPostModalData);
                  }
                  
                  // Also refresh the main posts list to keep everything in sync
                  Promise.all([getPosts(), getDonationRequests()]).then(([updatedPosts, donationResponse]) => {
                    setPosts(updatedPosts || []);
                    
                    // Update likedPosts state for forum posts
                    const currentUserId = getCurrentUserId(user);
                    const liked: { [key: number]: boolean } = {};
                    (updatedPosts || []).forEach((post: any) => {
                      if (post.item_type === 'post') {
                        liked[post.post_id] = getIsLiked(post, currentUserId);
                      } else if (post.item_type === 'repost') {
                        liked[post.repost_id] = getIsLiked(post, currentUserId);
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
                    
                    // Update donation likes if this is a donation
                    if (donationResponse.success && originalPostModalData.donation_id) {
                      const donationLiked: { [key: number]: boolean } = {};
                      donationResponse.donations.forEach((donation: any) => {
                        donationLiked[donation.donation_id] = donation.likes?.some((like: any) => like.user.user_id === currentUserId) || false;
                      });
                      setLikedDonations(prev => ({ ...prev, ...donationLiked }));
                    }
                  });
                }}
                showOptions={showOptions}
                setShowOptions={setShowOptions}
                editingPost={editingPost}
                setEditingPost={setEditingPost}
                editPostContent={editPostContent}
                setEditPostContent={setEditPostContent}
                likedPosts={originalPostModalData.donation_id ? likedDonations : likedPosts}
                setLikedPosts={originalPostModalData.donation_id ? setLikedDonations : setLikedPosts}
                repostedPosts={originalPostModalData.donation_id ? repostedDonations : repostedPosts}
                setRepostedPosts={originalPostModalData.donation_id ? setRepostedDonations : setRepostedPosts}
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
                isDonation={!!originalPostModalData.donation_id}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Tracker Reminder Modal */}
      <TrackerReminderModal
        isOpen={showTrackerModal}
        onClose={() => setShowTrackerModal(false)}
        userId={user?.user_id || user?.id || 0}
      />

      <EmploymentUpdateReminderModal
        open={showEmploymentUpdateModal}
        onClose={() => {
          setShowEmploymentUpdateModal(false);
        }}
        onUpdateNow={() => {
          setShowEmploymentUpdateModal(false);
          const userId = user?.user_id || user?.id;
          if (userId) {
            navigate(`/settings`);
            // Small delay to ensure navigation happens, then switch to employment tab
            setTimeout(() => {
              localStorage.setItem('settingsActiveSection', 'employment');
              window.location.reload(); // Force reload to show employment section
            }, 100);
          }
        }}
        onMaybeLater={() => {
          // Match tracker modal behavior: simply close, no long-term suppression
          try {
            localStorage.removeItem('employmentUpdateReminderDismissedUntil');
          } catch (_) {}
          setShowEmploymentUpdateModal(false);
        }}
        onNoChanges={() => {
          // Also allow future prompts; just close
          try {
            localStorage.removeItem('employmentUpdateReminderDismissedUntil');
          } catch (_) {}
          setShowEmploymentUpdateModal(false);
        }}
      />
      
      {/* Repost Notification Modal */}
      <RepostNotificationModal
        isOpen={showRepostNotificationModal}
        onClose={() => {
          setShowRepostNotificationModal(false);
          setRepostNotificationModalData(null);
        }}
        repostId={repostNotificationModalData?.repostId || ''}
        reposterName={repostNotificationModalData?.reposterName}
        commentId={repostNotificationModalData?.commentId}
        replyId={repostNotificationModalData?.replyId}
      />
    </div>
  );
};

export default UnifiedDashboard;
