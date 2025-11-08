  import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AlumniTopBar from './AlumniTopBar';
import ctulogo from '../../images/ctulogo.png';
import './profile.css';
import { fetchFollowers, followUser, unfollowUser, checkFollowStatus, api, createConversation } from '../../services/api';
import { getPosts, likePost, unlikePost, commentOnPost, repostPost, editPost, deletePost, editComment, deleteComment, getUserPoints, getInventoryItems, requestReward, getRewardRequests, claimRewardRequest, getEngagementPointsSettings } from '../../services/api';
import PostCreate from './PostCreate';
import PostCard from '../../components/PostCard';
import RepostCard from '../../components/RepostCard';
import { HiOutlineHeart, HiOutlineChatBubbleLeft, HiOutlineArrowPath, HiOutlineArrowUturnLeft, HiOutlineCamera, HiOutlineDocumentText, HiOutlineClipboardDocumentList, HiOutlineGift, HiOutlineCheckCircle, HiOutlineEye, HiOutlineXMark, HiOutlineInformationCircle, HiOutlineTicket } from 'react-icons/hi2';

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

function formatTimeAgo(iso?: string | null): string {
  if (!iso) return '';
  const then = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day >= 1) return day === 1 ? '1 day ago' : `${day} days ago`;
  if (hr >= 1) return hr === 1 ? '1 hour ago' : `${hr} hours ago`;
  if (min >= 1) return min === 1 ? '1 minute ago' : `${min} minutes ago`;
  return 'Just now';
}

function formatSocialMediaLink(socialMedia: string): { url: string; platform: string } {
  const lowerSocial = socialMedia.toLowerCase().trim();
  
  // Check for common social media patterns
  if (lowerSocial.includes('facebook.com') || lowerSocial.includes('fb.com')) {
    return { url: socialMedia.startsWith('http') ? socialMedia : `https://${socialMedia}`, platform: 'Facebook' };
  } else if (lowerSocial.includes('instagram.com') || lowerSocial.includes('instagr.am')) {
    return { url: socialMedia.startsWith('http') ? socialMedia : `https://${socialMedia}`, platform: 'Instagram' };
  } else if (lowerSocial.includes('twitter.com') || lowerSocial.includes('x.com')) {
    return { url: socialMedia.startsWith('http') ? socialMedia : `https://${socialMedia}`, platform: 'Twitter' };
  } else if (lowerSocial.includes('linkedin.com')) {
    return { url: socialMedia.startsWith('http') ? socialMedia : `https://${socialMedia}`, platform: 'LinkedIn' };
  } else if (lowerSocial.includes('tiktok.com')) {
    return { url: socialMedia.startsWith('http') ? socialMedia : `https://${socialMedia}`, platform: 'TikTok' };
  } else if (lowerSocial.includes('youtube.com') || lowerSocial.includes('youtu.be')) {
    return { url: socialMedia.startsWith('http') ? socialMedia : `https://${socialMedia}`, platform: 'YouTube' };
  } else {
    // Default case - treat as generic URL
    return { url: socialMedia.startsWith('http') ? socialMedia : `https://${socialMedia}`, platform: 'Social Media' };
  }
}

interface AlumniUser {
  name: string;
  course?: string;
  batch?: string | number;
  profile_pic?: string;
  profile_bio?: string;
  profile_resume?: string;
  location?: string;
  university?: string;
  resume?: string;
  id?: number;
  user_id?: number;
  ctu_id?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  year_graduated?: string | number;
  social_media?: string;
  email?: string;
  account_type?: {
    ccict?: boolean;
    admin?: boolean;
    peso?: boolean;
    ojt?: boolean;
    user?: boolean;
    coordinator?: boolean;
  };
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
    l_name?: string; 
    profile_pic?: string;
    name?: string;
  };
  comments?: CommentItem[];
  reposts?: RepostItem[];
  likes?: LikeItem[];
  liked_by_user?: boolean;
}

const AlumniProfile: React.FC = () => {
  const [user, setUser] = useState<AlumniUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editProfilePic, setEditProfilePic] = useState<string | undefined>(user?.profile_pic);
  const [editBio, setEditBio] = useState<string>(user?.profile_bio || '');
  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);

  const [isOwnProfile, setIsOwnProfile] = useState(true);
  const [followers, setFollowers] = useState<any[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState<{ [key: number]: boolean }>({});
  const [followingStatus, setFollowingStatus] = useState<{ [key: number]: boolean }>({});
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [showComposer, setShowComposer] = useState(false);
  const [commentInput, setCommentInput] = useState<{ [key: number]: string }>({});
  const [showCommentInput, setShowCommentInput] = useState<{ [key: number]: boolean }>({});
  const [showAllComments, setShowAllComments] = useState<{ [key: number]: boolean }>({});
  const [likedPosts, setLikedPosts] = useState<{ [key: number]: boolean }>({});
  const [repostedPosts, setRepostedPosts] = useState<{ [key: number]: boolean }>({});
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [following, setFollowing] = useState<any[]>([]);
  const [allMembers, setAllMembers] = useState<any[]>([]);
  const [showOptions, setShowOptions] = useState<{ [key: string | number]: boolean }>({});
  const [editingPost, setEditingPost] = useState<{ [key: number]: boolean }>({});
  const [editingComment, setEditingComment] = useState<{ [key: number]: boolean }>({});
  const [editPostContent, setEditPostContent] = useState<{ [key: number]: string }>({});
  const [editCommentContent, setEditCommentContent] = useState<{ [key: number]: string }>({});
  const [showPostModal, setShowPostModal] = useState(false);
  const [modalPost, setModalPost] = useState<any | null>(null);
  const [postLoading, setPostLoading] = useState(false);
  const [repostError, setRepostError] = useState<string | null>(null);
  const [showOriginalPostModal, setShowOriginalPostModal] = useState(false);
  const [userPoints, setUserPoints] = useState<any>(null);
  const [pointsLoading, setPointsLoading] = useState(false);
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
  const [originalPostModalData, setOriginalPostModalData] = useState<any | null>(null);
  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [claimingReward, setClaimingReward] = useState<number | null>(null);
  const [userRewardRequests, setUserRewardRequests] = useState<any[]>([]);
  const [showApprovedRewardsModal, setShowApprovedRewardsModal] = useState(false);
  const [selectedRewardDetail, setSelectedRewardDetail] = useState<any | null>(null);
  const [rewardStatusFilter, setRewardStatusFilter] = useState<'all' | 'pending' | 'approved' | 'claimed' | 'did_not_push_through'>('all');
  const [showRewardFilterDropdown, setShowRewardFilterDropdown] = useState(false);
  const [showMonthlyLimitModal, setShowMonthlyLimitModal] = useState(false);
  const [showConfirmRequestModal, setShowConfirmRequestModal] = useState(false);
  const [pendingRewardRequest, setPendingRewardRequest] = useState<{id: number; name: string; value: string; type?: string} | null>(null);
  const [employmentData, setEmploymentData] = useState<any>(null);
  const [employmentLoading, setEmploymentLoading] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showRewardFilterDropdown && !target.closest('[data-reward-filter-dropdown]')) {
        setShowRewardFilterDropdown(false);
      }
    };

    if (showRewardFilterDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showRewardFilterDropdown]);

  // Get current user ID
  const currentUserObj = JSON.parse(localStorage.getItem('user') || '{}');
  const currentId = currentUserObj.user_id || currentUserObj.id;


  // Load user data based on id param or localStorage user
  useEffect(() => {
    const loadUser = async () => {
      let userId = id;
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        navigate('/login');
        return;
      }
      const userObj = JSON.parse(userStr);
      const currentUserId = userObj.user_id || userObj.id;
      
      if (!userId) {
        // No ID in URL, so this is the current user's profile
        userId = currentUserId;
        setIsOwnProfile(true);
        console.log('Profile: Loading own profile, userId:', userId);
      } else {
        // There's an ID in URL, check if it's the current user's profile
        const viewingOwn = Number(userId) === Number(currentUserId);
        setIsOwnProfile(viewingOwn);
        console.log('Profile: Loading profile for userId:', userId, 'isOwnProfile:', viewingOwn, 'currentUserId:', currentUserId);
      }

      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(`http://127.0.0.1:8000/api/alumni/profile/${userId}/`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        if (res.status === 401) {
          alert('Session expired or unauthorized. Please log in again.');
          navigate('/login');
          return;
        }
        if (res.ok) {
          const profileData = await res.json();
          if (res.status === 401 || !profileData) {
            alert('Profile not found.');
            navigate('/login');
            return;
          }
          
          // Transform the profile data to match the expected format
          const userData = {
            user_id: profileData.user_id,
            id: profileData.user_id,
            name: `${profileData.f_name || ''} ${profileData.m_name || ''} ${profileData.l_name || ''}`.trim(),
            f_name: profileData.f_name,
            l_name: profileData.l_name,
            m_name: profileData.m_name,
            profile_bio: profileData.profile_bio || '',
            profile_pic: profileData.profile_pic,
            social_media: profileData.social_media,
            email: profileData.email,
            account_type: profileData.account_type || currentUserObj.account_type || {},
          };
          
          setUser(userData);
          setEditBio(profileData.profile_bio || '');
          
          // Fetch engagement points (for Alumni and OJT users)
          const isAlumni = profileData.account_type?.user;
          const isOJT = profileData.account_type?.ojt;
          if ((isAlumni || isOJT) && profileData.user_id) {
            setPointsLoading(true);
            try {
              const points = await getUserPoints(profileData.user_id);
              // If points is null or empty object, set to null
              setUserPoints(points && (points.total_points !== undefined || points.points_breakdown) ? points : null);
              
              // Fetch points settings
              try {
                const settingsResponse = await getEngagementPointsSettings();
                if (settingsResponse && settingsResponse.success && settingsResponse.settings) {
                  setPointsSettings({
                    enabled: settingsResponse.settings.enabled !== false,
                    like: settingsResponse.settings.like_points || 0,
                    comment: settingsResponse.settings.comment_points || 0,
                    share: settingsResponse.settings.share_points || 0,
                    reply: settingsResponse.settings.reply_points || 0,
                    post: settingsResponse.settings.post_points || 0,
                    post_with_photo: settingsResponse.settings.post_with_photo_points || 0,
                    tracker_form: settingsResponse.settings.tracker_form_points || 0
                  });
                }
              } catch (settingsError) {
                console.error('Error fetching points settings:', settingsError);
              }
            } catch (error) {
              console.error('Error fetching points:', error);
              setUserPoints(null);
            } finally {
              setPointsLoading(false);
            }
          } else {
            // If not Alumni or OJT, ensure userPoints is null
            setUserPoints(null);
          }
          
          // Update localStorage only if viewing own profile
          if (Number(userId) === Number(currentUserId)) {
            localStorage.setItem('user', JSON.stringify(userData));
          }
          
          const numericUserId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
          
          // Fetch employment data
          if (numericUserId !== undefined && numericUserId !== null && !isNaN(Number(numericUserId))) {
            setEmploymentLoading(true);
            try {
              const token = localStorage.getItem('accessToken');
              const employmentRes = await fetch(`http://127.0.0.1:8000/api/alumni/employment/${numericUserId}/`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
              });
              if (employmentRes.ok) {
                const employmentData = await employmentRes.json();
                setEmploymentData(employmentData);
              } else {
                setEmploymentData(null);
              }
            } catch (error) {
              console.error('Error fetching employment data:', error);
              setEmploymentData(null);
            } finally {
              setEmploymentLoading(false);
            }
          }
          
          if (numericUserId !== undefined && numericUserId !== null && !isNaN(Number(numericUserId))) {
            // Followers list
            fetchFollowers(Number(numericUserId))
              .then((data) => {
                if (data.success && data.followers) {
                  setFollowers(data.followers);
                  // Check follow status for each follower
                  checkFollowStatusForUsers(data.followers);
                } else {
                  setFollowers([]);
                }
              })
              .catch(() => setFollowers([]));

            // Following list
            api.get(`alumni/${numericUserId}/following/`)
              .then((response) => {
                if (response.data.success && response.data.following) {
                  setFollowing(response.data.following);
                  // Check follow status for each followed user
                  checkFollowStatusForUsers(response.data.following);
                } else {
                  setFollowing([]);
                }
              })
              .catch(() => setFollowing([]));

            // Fetch all members for the forum (same batch only)
            api.get('alumni/all/')
              .then((response) => {
                if (response.data.success && response.data.alumni) {
                  // Filter to only show users from the same batch
                  const currentUserBatch = userObj.year_graduated || userObj.batch;
                  const batchMembers = response.data.alumni.filter((member: any) => {
                    const memberBatch = member.batch;
                    return memberBatch === currentUserBatch;
                  });
                  setAllMembers(batchMembers);
                } else {
                  setAllMembers([]);
                }
              })
              .catch(() => setAllMembers([]));

            // Check follow status - only if viewing someone else's profile
            const viewingOwn = Number(numericUserId) === Number(currentUserId);
            console.log('Profile: Checking follow status, viewingOwn:', viewingOwn, 'numericUserId:', numericUserId, 'currentUserId:', currentUserId);
            
            if (!viewingOwn) {
              checkFollowStatus(Number(numericUserId))
                .then((data) => {
                  console.log('Profile: Follow status response:', data);
                  if (data.success) {
                    setIsFollowing(!!data.is_following);
                  }
                })
                .catch((error) => {
                  console.error('Error checking follow status:', error);
                  setIsFollowing(false);
                });
            } else {
              console.log('Profile: Viewing own profile, setting isFollowing to false');
              setIsFollowing(false);
            }

            // Load posts for this user
getPosts()
  .then((all: any[]) => {
    console.log('🔍 Profile DEBUG: Posts fetched:', all);
    console.log('🔍 Profile DEBUG: Posts type:', typeof all);
    console.log('🔍 Profile DEBUG: Posts length:', all?.length);
    console.log('🔍 Profile DEBUG: First few posts:', all?.slice(0, 3));
    
    if (!all || all.length === 0) {
      console.log('🚨 Profile DEBUG: No posts returned from API!');
      setPosts([]);
      return;
    }
    
    const repostItems = all.filter((item: any) => item.item_type === 'repost');
    console.log('Profile repost items:', repostItems);
    console.log('Profile user ID:', numericUserId);
    
    const subset = (all || []).filter(p => {
      // Include original posts by this user
      if (p.user?.user_id === Number(numericUserId)) {
        console.log('Including original post by user:', p.user?.user_id);
        return true;
      }
      
      // Include reposts by this user (reposts are separate feed items)
      if (p.item_type === 'repost' && p.user?.user_id === Number(numericUserId)) {
        console.log('Including repost by user:', p.user?.user_id, 'repost:', p);
        return true;
      }
      
      // Include original posts that have reposts by this user
      if (p.reposts && p.reposts.some((repost: any) => repost.user.user_id === Number(numericUserId))) {
        console.log('Including post with repost by user:', numericUserId);
        return true;
      }
      
      return false;
    });

    // Sort posts by most recent date considering repost_date for reposts and created_at for original posts
    subset.sort((a, b) => {
      let aDate: Date;
      let bDate: Date;
      
      // Handle repost items
      if (a.item_type === 'repost') {
        aDate = new Date(a.repost_date || 0);
      } else if (a.reposts && a.reposts.length > 0) {
        aDate = new Date(a.reposts[0].repost_date);
      } else {
        aDate = new Date(a.created_at || 0);
      }
      
      if (b.item_type === 'repost') {
        bDate = new Date(b.repost_date || 0);
      } else if (b.reposts && b.reposts.length > 0) {
        bDate = new Date(b.reposts[0].repost_date);
      } else {
        bDate = new Date(b.created_at || 0);
      }
      
      return bDate.getTime() - aDate.getTime();
    });

    setPosts(subset);
    
    // Track liked posts for current user
    const liked: { [key: number]: boolean } = {};
    subset.forEach((post: any) => {
      if (post.item_type === 'post' && post.likes && Array.isArray(post.likes)) {
        liked[post.post_id] = post.likes.some((like: any) => like.user_id === currentId);
      } else if (post.item_type === 'repost' && post.likes && Array.isArray(post.likes)) {
        liked[post.repost_id] = post.likes.some((like: any) => like.user_id === currentId);
      }
    });
    setLikedPosts(liked);

    // Track reposted posts for current user
    const reposted: { [key: number]: boolean } = {};
    subset.forEach(post => {
      if (post.reposts && Array.isArray(post.reposts)) {
        reposted[post.post_id] = post.reposts.some((repost: any) => repost.user.user_id === currentId);
      }
    });
    setRepostedPosts(reposted);
  })
  .catch((error) => {
    console.error('Error fetching profile posts:', error);
    setPosts([]);
  });
          } else {
            setFollowers([]);
            setPosts([]);
          }
        } else {
          alert('Failed to load profile.');
          navigate('/login');
        }
      } catch (error) {
        console.error('Network error:', error);
        setLoading(false);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
    
    // Listen for user data updates from Settings
    const handleUserDataUpdate = (event: CustomEvent) => {
      console.log('User data updated event received:', event.detail);
      // If this is the current user's profile, refresh the data
      if (!id || id === String(event.detail.user_id || event.detail.id)) {
        console.log('Refreshing profile data due to user update');
        loadUser();
      }
    };

    window.addEventListener('userDataUpdated', handleUserDataUpdate as EventListener);
    
    return () => {
      window.removeEventListener('userDataUpdated', handleUserDataUpdate as EventListener);
    };
  }, [id, navigate]);

  const [bioModalOpen, setBioModalOpen] = useState(false);
  const [bioInput, setBioInput] = useState('');
  const [bioLoading, setBioLoading] = useState(false);

  const [socialMediaModalOpen, setSocialMediaModalOpen] = useState(false);
  const [socialMediaInput, setSocialMediaInput] = useState('');
  const [socialMediaLoading, setSocialMediaLoading] = useState(false);

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  // PESO Partnered Companies modal state
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);
  const [partnerCompaniesDraft, setPartnerCompaniesDraft] = useState<{ name: string; url: string }[]>([]);

  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const handleResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setResumeFile(file);
    } else {
      alert('Please upload a valid PDF file.');
    }
  };

  const handleSaveResume = async () => {
    if (!resumeFile) {
      alert('No resume file selected.');
      return;
    }

    const formData = new FormData();
    formData.append('resume', resumeFile);

    const userObj = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = userObj.user_id || userObj.id;
    const url = `http://127.0.0.1:8000/api/resume/update/?user_id=${userId}`;

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        const updatedUser = { ...userObj, profile_resume: data.resume };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        alert('Resume uploaded!');
      } else {
        const err = await res.json();
        alert('Failed to upload resume: ' + (err.message || 'Unknown error'));
      }
    } catch (err) {
      alert('Network error: ' + err);
    }
  };
  const handleDeleteResume = async () => {
    const userObj = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = userObj.user_id || userObj.id;

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`http://127.0.0.1:8000/api/resume/delete/?user_id=${userId}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const updatedUser = { ...userObj, profile_resume: null };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        alert('Resume deleted.');
      } else {
        const err = await res.json();
        alert('Failed to delete resume: ' + (err.message || 'Unknown error'));
      }
    } catch (err) {
      alert('Network error: ' + err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleFollow = async () => {
    if (!id) return;
    // Do not allow following own account, even if UI state is wrong
    const me = JSON.parse(localStorage.getItem('user') || '{}');
    const meId = me.user_id || me.id;
    if (Number(id) === Number(meId)) {
      setIsFollowing(false);
      return;
    }
    setFollowLoading(prev => ({ ...prev, [Number(id)]: true }));
    try {
      const result = await followUser(Number(id));
      if (result.success) {
        setIsFollowing(true);
        // Refresh followers list
        const followersData = await fetchFollowers(Number(id));
        setFollowers(followersData.followers || []);
      } else {
        alert(result.message || 'Failed to follow user.');
      }
    } catch (error: any) {
      alert(error?.response?.data?.error || error?.message || 'Failed to follow user.');
    } finally {
      setFollowLoading(prev => ({ ...prev, [Number(id)]: false }));
    }
  };

  const handleUnfollow = async () => {
    if (!id) return;
    setFollowLoading(prev => ({ ...prev, [Number(id)]: true }));
    try {
      const result = await unfollowUser(Number(id));
      if (result.success) {
        setIsFollowing(false);
        // Refresh followers list
        const followersData = await fetchFollowers(Number(id));
        setFollowers(followersData.followers || []);
      } else {
        alert(result.message || 'Failed to unfollow user.');
      }
    } catch (error: any) {
      alert(error?.response?.data?.error || error?.message || 'Failed to unfollow user.');
    } finally {
      setFollowLoading(prev => ({ ...prev, [Number(id)]: false }));
    }
  };

  // Check follow status for multiple users
  const checkFollowStatusForUsers = async (users: any[]) => {
    const userObj = JSON.parse(localStorage.getItem('user') || '{}');
    const currentUserId = getCurrentUserId(userObj);
    if (!currentUserId) return;
    
    const followStatusPromises = users.map(async (user) => {
      if (user.user_id && Number(user.user_id) !== Number(currentUserId)) {
        try {
          const followData = await checkFollowStatus(Number(user.user_id));
          return { userId: user.user_id, isFollowing: followData.success ? followData.is_following : false };
        } catch (error) {
          return { userId: user.user_id, isFollowing: false };
        }
      }
      return null;
    });
    
    const followStatuses = await Promise.all(followStatusPromises);
    const followStatusMap: { [key: number]: boolean } = {};
    followStatuses.forEach(status => {
      if (status) {
        followStatusMap[status.userId] = status.isFollowing;
      }
    });
    setFollowingStatus(followStatusMap);
  };

  // Handle follow/unfollow for follower/following cards and modals
  const handleFollowUser = async (userId: number) => {
    const userObj = JSON.parse(localStorage.getItem('user') || '{}');
    const currentUserId = getCurrentUserId(userObj);
    
    if (!userId || userId === Number(currentUserId)) return;
    
    setFollowLoading(prev => ({ ...prev, [userId]: true }));
    
    try {
      const isCurrentlyFollowing = followingStatus[userId];
      
      if (isCurrentlyFollowing) {
        // Unfollow
        const result = await unfollowUser(userId);
        if (result.success) {
          setFollowingStatus(prev => ({ ...prev, [userId]: false }));
          // Refresh followers/following data
          if (currentUserId) {
            fetchFollowers(currentUserId);
          }
        } else {
          alert(result.message || 'Failed to unfollow user.');
        }
      } else {
        // Follow
        const result = await followUser(userId);
        if (result.success) {
          setFollowingStatus(prev => ({ ...prev, [userId]: true }));
          // Refresh followers/following data
          if (currentUserId) {
            fetchFollowers(currentUserId);
          }
        } else {
          alert(result.message || 'Failed to follow user.');
        }
      }
    } catch (error: any) {
      console.error('Follow/unfollow error:', error);
      alert(error?.response?.data?.error || error?.message || 'Failed to follow/unfollow user.');
    } finally {
      setFollowLoading(prev => ({ ...prev, [userId]: false }));
    }
  };


  const fetchInventoryItems = async () => {
    try {
      setRewardsLoading(true);
      const response = await getInventoryItems();
      if (response.success) {
        setInventoryItems(response.items || []);
      } else {
        alert(response.message || 'Failed to load rewards');
      }
    } catch (error: any) {
      console.error('Error fetching inventory:', error);
      alert(error.response?.data?.message || 'Failed to load rewards');
    } finally {
      setRewardsLoading(false);
    }
  };

  const handleRequestReward = async (rewardId: number) => {
    if (claimingReward !== null) return;
    
    const reward = inventoryItems.find(item => item.id === rewardId);
    if (!reward) return;

    const pointsMatch = reward.value?.match(/(\d+)/);
    const requiredPoints = pointsMatch ? parseInt(pointsMatch[1]) : 0;
    const canAfford = (userPoints?.total_points || 0) >= requiredPoints;

    if (!canAfford) {
      alert(`Insufficient points. You need ${requiredPoints} points but only have ${userPoints?.total_points || 0}.`);
      return;
    }

    if (reward.quantity <= 0) {
      alert('This reward is out of stock.');
      return;
    }

    // Check if user has already requested a reward this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyRequests = userRewardRequests.filter((req: any) => {
      const requestedDate = new Date(req.requested_at);
      return requestedDate >= startOfMonth;
    });

    if (monthlyRequests.length >= 1) {
      setShowMonthlyLimitModal(true);
      return;
    }

    // Show confirmation modal instead of browser confirm
    setPendingRewardRequest({
      id: rewardId,
      name: reward.name,
      value: reward.value,
      type: reward.type
    });
    setShowConfirmRequestModal(true);
  };

  const confirmRequestReward = async () => {
    if (!pendingRewardRequest) return;
    
    const rewardId = pendingRewardRequest.id;
    setShowConfirmRequestModal(false);
    
    try {
      setClaimingReward(rewardId);
      const response = await requestReward(rewardId);
      
      if (response.success) {
        // Refresh requests
        await fetchUserRewardRequests();
        
        // Refresh inventory
        await fetchInventoryItems();
        
        // Close modal
        setPendingRewardRequest(null);
      } else {
        alert(response.message || 'Failed to request reward');
      }
    } catch (error: any) {
      console.error('Error requesting reward:', error);
      alert(error.response?.data?.message || 'Failed to request reward');
    } finally {
      setClaimingReward(null);
    }
  };

  const fetchUserRewardRequests = async () => {
    try {
      const response = await getRewardRequests();
      if (response.success) {
        setUserRewardRequests(response.requests || []);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error fetching reward requests:', error);
      return false;
    }
  };

  // Check for openRewardRequests flag from notification - check when component mounts and when user loads
  useEffect(() => {
    const checkAndOpenRewardRequests = () => {
      const openRewardRequests = localStorage.getItem('openRewardRequests');
      if (openRewardRequests === 'true' && user && user.user_id) {
        localStorage.removeItem('openRewardRequests');
        console.log('Opening reward requests modal from notification');
        // Fetch reward requests first, then open modal
        fetchUserRewardRequests().then(() => {
          // Use setTimeout to ensure state updates are processed
          setTimeout(() => {
            setShowApprovedRewardsModal(true);
          }, 200);
        }).catch(() => {
          // Even if fetch fails, try to open modal
          setTimeout(() => {
            setShowApprovedRewardsModal(true);
          }, 200);
        });
      }
    };
    
    // Check immediately and also when user loads
    checkAndOpenRewardRequests();
  }, [user]);

  // Check for openRewardDetail flag from notification - opens specific reward detail modal
  useEffect(() => {
    const checkAndOpenRewardDetail = async () => {
      const openRewardDetailId = localStorage.getItem('openRewardDetail');
      if (openRewardDetailId && user && user.user_id) {
        localStorage.removeItem('openRewardDetail');
        console.log('Opening reward detail modal from notification for request ID:', openRewardDetailId);
        try {
          // Fetch reward requests directly to get fresh data
          const response = await getRewardRequests();
          if (response.success && response.requests) {
            // Find the specific reward request by ID
            const rewardDetail = response.requests.find(
              (req: any) => req.request_id === Number(openRewardDetailId)
            );
            if (rewardDetail) {
              // Update state and open detail modal
              setUserRewardRequests(response.requests);
              setTimeout(() => {
                setSelectedRewardDetail(rewardDetail);
              }, 200);
            } else {
              // If not found, update state and fallback to opening the list modal
              console.log('Reward detail not found, opening list modal instead');
              setUserRewardRequests(response.requests);
              setTimeout(() => {
                setShowApprovedRewardsModal(true);
              }, 200);
            }
          } else {
            // If fetch failed, try to open list modal
            setTimeout(() => {
              setShowApprovedRewardsModal(true);
            }, 200);
          }
        } catch (error) {
          console.error('Error fetching reward detail:', error);
          // On error, try to open list modal
          setTimeout(() => {
            setShowApprovedRewardsModal(true);
          }, 200);
        }
      }
    };
    
    // Check immediately and also when user loads
    checkAndOpenRewardDetail();
  }, [user]);

  // Listen for points updates from other components (like PostCard, PostCreate)
  useEffect(() => {
    const handlePointsUpdate = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { userId, points } = customEvent.detail;
      // Only update if viewing own profile and the userId matches
      if (isOwnProfile && currentId && Number(userId) === Number(currentId)) {
        console.log('Points updated, refreshing display:', points);
        setUserPoints(points);
      }
    };

    window.addEventListener('pointsUpdated', handlePointsUpdate);
    return () => {
      window.removeEventListener('pointsUpdated', handlePointsUpdate);
    };
  }, [isOwnProfile, currentId]);

  // Listen for WebSocket points updates for cross-platform real-time updates
  useEffect(() => {
    if (!isOwnProfile || !currentId) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const wsBase = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const wsHost = window.location.host.replace(':3000', ':8000'); // Adjust port if needed
    const wsUrl = `${wsBase}${wsHost}/ws/notifications/?token=${encodeURIComponent(token)}`;

    let ws: WebSocket | null = null;

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected for points updates');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'points_update' && data.points) {
            const pointsData = data.points;
            // Only update if it's for the current user
            if (Number(pointsData.user_id) === Number(currentId)) {
              console.log('Points updated via WebSocket:', pointsData);
              setUserPoints(pointsData);
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected for points updates');
        // Optionally reconnect after a delay
        setTimeout(() => {
          if (isOwnProfile && currentId) {
            // This will trigger the effect again
          }
        }, 5000);
      };
    } catch (error) {
      console.error('Error setting up WebSocket:', error);
    }

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [isOwnProfile, currentId]);

  const handleClaimApprovedReward = async (requestId: number) => {
    if (claimingReward !== null) return;

    const request = userRewardRequests.find(req => req.request_id === requestId);
    if (!request) return;

    const confirm = window.confirm(`Claim "${request.reward_name}"?\n\nPoints will be deducted: ${request.points_cost}`);
    if (!confirm) return;

    try {
      setClaimingReward(requestId);
      const response = await claimRewardRequest(requestId);
      
      if (response.success) {
        alert(response.message || 'Reward claimed successfully!');
        
        // Refresh points
        if (currentId) {
          try {
            const pointsData = await getUserPoints(Number(currentId));
            setUserPoints(pointsData);
          } catch (err) {
            console.error('Error refreshing points:', err);
          }
        }
        
        // Refresh requests
        await fetchUserRewardRequests();
        
        // Refresh inventory
        await fetchInventoryItems();
      } else {
        alert(response.message || 'Failed to claim reward');
      }
    } catch (error: any) {
      console.error('Error claiming reward:', error);
      alert(error.response?.data?.message || 'Failed to claim reward');
    } finally {
      setClaimingReward(null);
    }
  };

  const handleEditProfile = () => {
    // Set the current user's profile picture as the initial edit value
    setEditProfilePic(user?.profile_pic || undefined);
    setEditBio(user?.profile_bio || '');
    setEditModalOpen(true);
  };

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log('Selected file:', file);
    if (file) {
      setProfilePicFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setEditProfilePic(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveProfilePic = async () => {
    const userObj = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = userObj.user_id || userObj.id;
    if (!userId) {
      alert('User ID not found. Please log in again.');
      return;
    }
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(
        `http://127.0.0.1:8000/api/alumni/profile/delete/?user_id=${userId}`,
        {
          method: 'DELETE',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        }
      );
      if (res.ok) {
        setEditProfilePic(undefined);
        setProfilePicFile(null);
        const updatedUser = { ...userObj, profile_pic: null };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setEditModalOpen(false); // Close the modal after successful removal
        alert('Profile picture removed.');
      } else {
        const err = await res.json();
        alert('Failed to remove profile picture: ' + (err.message || 'Unknown error'));
      }
    } catch (error) {
      alert('Network error: ' + error);
    }
  };

  // Call this on edit/save
  const handleSave = async () => {
    if (!profilePicFile && !editBio) {
      alert('No changes to save.');
      return;
    }

    const userObj = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = userObj.user_id || userObj.id;
    if (!userId) {
      alert('User ID not found. Please log in again.');
      return;
    }

    const formData = new FormData();
    if (profilePicFile) {
      formData.append('profile_pic', profilePicFile);
    }
    formData.append('bio', editBio);

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `http://127.0.0.1:8000/api/alumni/profile/update/?user_id=${userId}`,
        {
          method: 'PUT',
          body: formData,
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        }
      );

      if (response.ok) {
        const data = await response.json();
        const updatedUser = {
          ...userObj,
          ...data.user,
          profile_pic: data.user.profile_pic + '?t=' + new Date().getTime(), // force reload
        };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        // Dispatch custom event to notify other components (like messaging) of profile update
        window.dispatchEvent(new CustomEvent('profileUpdated'));
        setEditModalOpen(false);
        setProfilePicFile(null);
        alert('Profile updated successfully.');
      } else {
        const err = await response.json();
        alert('Failed to update profile: ' + (err.message || 'Unknown error'));
      }
    } catch (error) {
      alert('Network error: ' + error);
    }
  };

  const handleSaveProfile = async () => {
    await handleSave();
  };

  const handleSaveBio = async () => {
    setBioLoading(true);
    const userObj = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = userObj.user_id || userObj.id;
    if (!userId) {
      alert('User ID not found. Please log in again.');
      setBioLoading(false);
      return;
    }
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://127.0.0.1:8000/api/admin/${userId}/profile_bio/`, {
        method: 'PUT',
        headers: token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_bio: bioInput }),
      });
      if (response.ok) {
        const data = await response.json();
        setUser((prev) => (prev ? { ...prev, profile_bio: data.profile_bio } : prev));
        // Update localStorage as well
        const updatedUser = { ...userObj, profile_bio: data.profile_bio };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setBioModalOpen(false);
      } else {
        alert('Failed to save bio.');
      }
    } catch (error) {
      alert('Network error: ' + error);
    }
    setBioLoading(false);
  };

  const handleDeleteBio = async () => {
    setBioLoading(true);
    const userObj = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = userObj.user_id || userObj.id;
    if (!userId) {
      alert('User ID not found. Please log in again.');
      setBioLoading(false);
      return;
    }
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://127.0.0.1:8000/api/admin/${userId}/profile_bio/`, {
        method: 'PUT',
        headers: token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_bio: '' }),
      });
      if (response.ok) {
        setUser((prev) => (prev ? { ...prev, profile_bio: '' } : prev));
        const updatedUser = { ...userObj, profile_bio: '' };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setBioInput('');
        setBioModalOpen(false);
      } else {
        alert('Failed to delete bio.');
      }
    } catch (error) {
      alert('Network error: ' + error);
    }
    setBioLoading(false);
  };

  // Social Media handlers
  const handleSaveSocialMedia = async () => {
    setSocialMediaLoading(true);
    const userObj = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = userObj.user_id || userObj.id;
    if (!userId) {
      alert('User ID not found. Please log in again.');
      setSocialMediaLoading(false);
      return;
    }
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://127.0.0.1:8000/api/userprofile/${userId}/social_media/`, {
        method: 'PUT',
        headers: token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ social_media: socialMediaInput }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setUser((prev) => (prev ? { ...prev, social_media: data.social_media } : prev));
        const updatedUser = { ...userObj, social_media: data.social_media };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setSocialMediaModalOpen(false);
        setSocialMediaInput('');
        alert(data.message || 'Social media updated successfully.');
      } else {
        alert(data.error || 'Failed to update social media.');
      }
    } catch (error) {
      alert('Network error: ' + error);
    }
    setSocialMediaLoading(false);
  };

  const handleDeleteSocialMedia = async () => {
    setSocialMediaLoading(true);
    const userObj = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = userObj.user_id || userObj.id;
    if (!userId) {
      alert('User ID not found. Please log in again.');
      setSocialMediaLoading(false);
      return;
    }
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://127.0.0.1:8000/api/userprofile/${userId}/social_media/`, {
        method: 'PUT',
        headers: token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ social_media: '' }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setUser((prev) => (prev ? { ...prev, social_media: '' } : prev));
        const updatedUser = { ...userObj, social_media: '' };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setSocialMediaInput('');
        setSocialMediaModalOpen(false);
        alert(data.message || 'Social media deleted successfully.');
      } else {
        alert(data.error || 'Failed to delete social media.');
      }
    } catch (error) {
      alert('Network error: ' + error);
    }
    setSocialMediaLoading(false);
  };

  // Email handlers
  const handleSaveEmail = async () => {
    setEmailLoading(true);
    const userObj = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = userObj.user_id || userObj.id;
    if (!userId) {
      alert('User ID not found. Please log in again.');
      setEmailLoading(false);
      return;
    }
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://127.0.0.1:8000/api/userprofile/${userId}/email/`, {
        method: 'PUT',
        headers: token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setUser((prev) => (prev ? { ...prev, email: data.email } : prev));
        const updatedUser = { ...userObj, email: data.email };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setEmailModalOpen(false);
        setEmailInput('');
        alert(data.message || 'Email updated successfully.');
      } else {
        alert(data.error || 'Failed to update email.');
      }
    } catch (error) {
      alert('Network error: ' + error);
    }
    setEmailLoading(false);
  };

  const handleDeleteEmail = async () => {
    setEmailLoading(true);
    const userObj = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = userObj.user_id || userObj.id;
    if (!userId) {
      alert('User ID not found. Please log in again.');
      setEmailLoading(false);
      return;
    }
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://127.0.0.1:8000/api/userprofile/${userId}/email/`, {
        method: 'PUT',
        headers: token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: '' }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setUser((prev) => (prev ? { ...prev, email: '' } : prev));
        const updatedUser = { ...userObj, email: '' };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setEmailInput('');
        setEmailModalOpen(false);
        alert(data.message || 'Email deleted successfully.');
      } else {
        alert(data.error || 'Failed to delete email.');
      }
    } catch (error) {
      alert('Network error: ' + error);
    }
    setEmailLoading(false);
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

  const onPosted = async () => {
    // Force refresh posts from backend with proper typing and delay
    try {
      console.log('Post created, refreshing profile posts...');
      // Small delay to ensure database write is complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const allPosts: PostItem[] = await getPosts();
      console.log('All posts from API:', allPosts);
      const currentUserId = Number(id) || Number(JSON.parse(localStorage.getItem('user') || '{}').user_id || JSON.parse(localStorage.getItem('user') || '{}').id);
      
      if (currentUserId) {
        const subset = (allPosts || []).filter((p: any) => {
          // Include original posts by this user
          if (p.user?.user_id === Number(currentUserId)) {
            return true;
          }
          
          // Include reposts by this user (reposts are separate feed items)
          if (p.item_type === 'repost' && p.user?.user_id === Number(currentUserId)) {
            return true;
          }
          
          // Include original posts that have reposts by this user
          if (p.reposts && p.reposts.some((repost: any) => repost.user.user_id === Number(currentUserId))) {
            return true;
          }
          
          return false;
        });
        console.log('Refreshed posts:', subset.length, 'posts for user', currentUserId);
        setPosts(subset);
        
        // Update likedPosts state
        const liked: { [key: number]: boolean } = {};
        subset.forEach((post: any) => {
          if (post.item_type === 'post' && post.likes && Array.isArray(post.likes)) {
            liked[post.post_id] = post.likes.some((like: any) => like.user_id === currentId);
          } else if (post.item_type === 'repost' && post.likes && Array.isArray(post.likes)) {
            liked[post.repost_id] = post.likes.some((like: any) => like.user_id === currentId);
          }
        });
        setLikedPosts(liked);

        // Update repostedPosts state
        const reposted: { [key: number]: boolean } = {};
        subset.forEach(post => {
          if (post.reposts && Array.isArray(post.reposts)) {
            reposted[post.post_id] = post.reposts.some((repost: any) => repost.user.user_id === currentId);
          }
        });
        setRepostedPosts(reposted);
      }
    } catch (error) {
      console.error('Error refreshing profile posts:', error);
      // Fallback: reload the entire page if refresh fails
      window.location.reload();
    }
  };

  // Defensive render guard: show minimal loading state while fetching
  if (!user) {
    return (
      <div style={{ 
        minHeight: '100vh',
        background: '#f5f5f5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          {/* Simple animated spinner */}
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e0e0e0',
            borderTop: '4px solid #174f84',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // Get current user info for admin/peso detection
  const currentUserStr = localStorage.getItem('user');
  const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
  const isAdmin = currentUser?.account_type?.admin || currentUser?.account_type?.ccict;
  const isPeso = currentUser?.account_type?.peso;

  return (
    <div className="profile-container">
      <AlumniTopBar
        showProfile={showProfile}
        setShowProfile={setShowProfile}
        handleLogout={handleLogout}
        isAdmin={isAdmin}
        isPeso={isPeso}
      />

      {/* Main Content */}
      <div className="profile-main-content">
        {/* Left Sidebar */}
        <div className="profile-left-sidebar">
          {/* Introduction */}
          <div>
            <div className="profile-intro-title">Introduction</div>
            <div className="profile-bio-container">
              {/* Show bio if exists, otherwise show Add Bio button */}
              {user && user.profile_bio && user.profile_bio.trim() ? (
                <div className="profile-bio-text">
                  <span>{user.profile_bio}</span>
                  {isOwnProfile ? (
                    <button
                      className="profile-bio-edit-btn"
                      onClick={() => {
                        setBioInput(user.profile_bio?.trim() || '');
                        setBioModalOpen(true);
                      }}
                    >
                      Edit Bio
                    </button>
                  ) : null}
                </div>
              ) : isOwnProfile ? (
                <button className="profile-add-bio-btn" onClick={() => setBioModalOpen(true)}>
                  Add Bio
                </button>
              ) : null}
            </div>

            {/* Social Media and Email for Alumni/OJT accounts */}
            {user && ((!user.account_type?.admin && !user.account_type?.peso && !user.account_type?.ccict) || (isOwnProfile && (user.account_type?.admin || user.account_type?.ccict || user.account_type?.peso))) && (
              <div className="profile-contact-info">
                {/* Social Media */}
                <div className="profile-contact-item">
                  <span className="profile-contact-label">Social Media:</span>
                  {user.social_media && user.social_media.trim() ? (
                    <div className="profile-contact-display">
                      <a 
                        href={formatSocialMediaLink(user.social_media).url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="profile-contact-link"
                      >
                        {formatSocialMediaLink(user.social_media).platform}
                      </a>
                      {isOwnProfile && (
                        <button
                          className="profile-contact-edit-btn"
                          onClick={() => {
                            setSocialMediaInput(user.social_media?.trim() || '');
                            setSocialMediaModalOpen(true);
                          }}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  ) : isOwnProfile ? (
                    <button 
                      className="profile-contact-add-btn" 
                      onClick={() => {
                        setSocialMediaInput('');
                        setSocialMediaModalOpen(true);
                      }}
                    >
                      Add social media acc
                    </button>
                  ) : (
                    <span className="profile-contact-empty">No social media added</span>
                  )}
                </div>

                {/* Email */}
                <div className="profile-contact-item">
                  <span className="profile-contact-label">Email:</span>
                  {user.email && user.email.trim() ? (
                    <div className="profile-contact-display">
                      <a 
                        href={`mailto:${user.email}`}
                        className="profile-contact-link"
                      >
                        {user.email}
                      </a>
                      {isOwnProfile && (
                        <button
                          className="profile-contact-edit-btn"
                          onClick={() => {
                            setEmailInput(user.email?.trim() || '');
                            setEmailModalOpen(true);
                          }}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  ) : isOwnProfile ? (
                    <button 
                      className="profile-contact-add-btn" 
                      onClick={() => {
                        setEmailInput('');
                        setEmailModalOpen(true);
                      }}
                    >
                      Add Email
                    </button>
                  ) : (
                    <span className="profile-contact-empty">No email added</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Engagement Points - For Alumni and OJT users viewing their own profile */}
          {(() => {
            const hasRewardsAccess = user && (user.account_type?.user || user.account_type?.ojt) && isOwnProfile;
            if (process.env.NODE_ENV === 'development') {
              console.log('Rewards Card Debug:', {
                user: !!user,
                account_type: user?.account_type,
                isAlumni: user?.account_type?.user,
                isOJT: user?.account_type?.ojt,
                isOwnProfile,
                hasRewardsAccess
              });
            }
            return hasRewardsAccess;
          })() && (
            <div style={{ marginTop: '16px' }}>
              <div className="profile-intro-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🏆</span>
                <span>Engagement Points</span>
              </div>
              
              {pointsLoading ? (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '14px', color: '#666' }}>Loading points...</div>
                </div>
              ) : (
                <div>
                  {/* Total Points - Show even if userPoints is null/undefined */}
                  {userPoints && (
                    <div style={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      borderRadius: '12px',
                      padding: '20px',
                      color: 'white',
                      marginBottom: '16px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>Total Points</div>
                      <div style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '8px' }}>{userPoints.total_points || 0}</div>
                      {userPoints.rank && (
                        <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '12px' }}>Rank #{userPoints.rank}</div>
                      )}
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => {
                            setShowRewardsModal(true);
                            fetchInventoryItems();
                            fetchUserRewardRequests();
                          }}
                          style={{
                            background: 'rgba(255, 255, 255, 0.2)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            borderRadius: '8px',
                            padding: '8px 16px',
                            color: 'white',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <HiOutlineGift size={16} strokeWidth={1.5} />
                            <span>View Rewards</span>
                          </span>
                        </button>
                        <button
                          onClick={() => {
                            setShowApprovedRewardsModal(true);
                            fetchUserRewardRequests();
                          }}
                          style={{
                            background: 'rgba(255, 255, 255, 0.2)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            borderRadius: '8px',
                            padding: '8px 16px',
                            color: 'white',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <HiOutlineCheckCircle size={16} strokeWidth={1.5} />
                            <span>My Requests</span>
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Reward Card - Always show for OJT and Alumni users, even without points */}
                  {!userPoints && (
                    <div style={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      borderRadius: '12px',
                      padding: '20px',
                      color: 'white',
                      marginBottom: '16px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>Total Points</div>
                      <div style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '8px' }}>0</div>
                      {userPoints?.rank ? (
                        <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '12px' }}>Rank #{userPoints.rank}</div>
                      ) : (
                        <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '12px' }}>Rank -</div>
                      )}
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => {
                            setShowRewardsModal(true);
                            fetchInventoryItems();
                            fetchUserRewardRequests();
                          }}
                          style={{
                            background: 'rgba(255, 255, 255, 0.2)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            borderRadius: '8px',
                            padding: '8px 16px',
                            color: 'white',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <HiOutlineGift size={16} strokeWidth={1.5} />
                            <span>View Rewards</span>
                          </span>
                        </button>
                        <button
                          onClick={() => {
                            setShowApprovedRewardsModal(true);
                            fetchUserRewardRequests();
                          }}
                          style={{
                            background: 'rgba(255, 255, 255, 0.2)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            borderRadius: '8px',
                            padding: '8px 16px',
                            color: 'white',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <HiOutlineCheckCircle size={16} strokeWidth={1.5} />
                            <span>My Requests</span>
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Points Breakdown - Only show if userPoints exists */}
                  {userPoints && (
                    <div style={{ fontSize: '14px', color: '#333' }}>
                      <div style={{ fontWeight: '600', marginBottom: '12px', color: '#174f84' }}>Points Breakdown</div>
                      
                      {/* Likes */}
                      {(() => {
                        const count = userPoints.points_breakdown?.likes?.count || 0;
                        const pointsPerAction = pointsSettings.like;
                        const calculatedPoints = count * pointsPerAction;
                        return (
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 0',
                            borderBottom: '1px solid #f0f0f0'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <HiOutlineHeart size={16} color="#6b7280" strokeWidth={1.5} />
                              <span>Likes</span>
                              <span style={{ fontSize: '12px', color: '#999' }}>
                                ({count})
                              </span>
                            </div>
                            <div style={{ fontWeight: '600', color: '#667eea' }}>
                              +{calculatedPoints}
                            </div>
                          </div>
                        );
                      })()}

                    {/* Comments */}
                    {(() => {
                      const count = userPoints.points_breakdown?.comments?.count || 0;
                      const pointsPerAction = pointsSettings.comment;
                      const calculatedPoints = count * pointsPerAction;
                      return (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 0',
                          borderBottom: '1px solid #f0f0f0'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <HiOutlineChatBubbleLeft size={16} color="#6b7280" strokeWidth={1.5} />
                            <span>Comments</span>
                            <span style={{ fontSize: '12px', color: '#999' }}>
                              ({count})
                            </span>
                          </div>
                          <div style={{ fontWeight: '600', color: '#667eea' }}>
                            +{calculatedPoints}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Repost */}
                    {(() => {
                      const count = userPoints.points_breakdown?.shares?.count || 0;
                      const pointsPerAction = pointsSettings.share;
                      const calculatedPoints = count * pointsPerAction;
                      return (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 0',
                          borderBottom: '1px solid #f0f0f0'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <HiOutlineArrowPath size={16} color="#6b7280" strokeWidth={1.5} />
                            <span>Repost</span>
                            <span style={{ fontSize: '12px', color: '#999' }}>
                              ({count})
                            </span>
                          </div>
                          <div style={{ fontWeight: '600', color: '#667eea' }}>
                            +{calculatedPoints}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Replies */}
                    {(() => {
                      const count = userPoints.points_breakdown?.replies?.count || 0;
                      const pointsPerAction = pointsSettings.reply;
                      const calculatedPoints = count * pointsPerAction;
                      return (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 0',
                          borderBottom: '1px solid #f0f0f0'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <HiOutlineArrowUturnLeft size={16} color="#6b7280" strokeWidth={1.5} />
                            <span>Replies</span>
                            <span style={{ fontSize: '12px', color: '#999' }}>
                              ({count})
                            </span>
                          </div>
                          <div style={{ fontWeight: '600', color: '#667eea' }}>
                            +{calculatedPoints}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Posts */}
                    {(() => {
                      const count = userPoints.points_breakdown?.posts?.count || 0;
                      const pointsPerAction = pointsSettings.post;
                      const calculatedPoints = count * pointsPerAction;
                      return (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 0',
                          borderBottom: '1px solid #f0f0f0'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <HiOutlineDocumentText size={16} color="#6b7280" strokeWidth={1.5} />
                            <span>Posts</span>
                            <span style={{ fontSize: '12px', color: '#999' }}>
                              ({count})
                            </span>
                          </div>
                          <div style={{ fontWeight: '600', color: '#667eea' }}>
                            +{calculatedPoints}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Posts with Photos */}
                    {(() => {
                      const count = userPoints.points_breakdown?.posts_with_photos?.count || 0;
                      const pointsPerAction = pointsSettings.post_with_photo;
                      const calculatedPoints = count * pointsPerAction;
                      return (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 0',
                          borderBottom: '1px solid #f0f0f0'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <HiOutlineCamera size={16} color="#6b7280" strokeWidth={1.5} />
                            <span>Posts w/ Photos</span>
                            <span style={{ fontSize: '12px', color: '#999' }}>
                              ({count})
                            </span>
                          </div>
                          <div style={{ fontWeight: '600', color: '#667eea' }}>
                            +{calculatedPoints}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Tracker Form - Only show for Alumni users, not OJT */}
                    {user && user.account_type?.user && !user.account_type?.ojt && (() => {
                      const count = userPoints.points_breakdown?.tracker_form?.count || 0;
                      const pointsPerAction = pointsSettings.tracker_form;
                      const calculatedPoints = count * pointsPerAction;
                      return (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 0'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <HiOutlineClipboardDocumentList size={16} color="#6b7280" strokeWidth={1.5} />
                            <span>Tracker Form</span>
                            <span style={{ fontSize: '12px', color: '#999' }}>
                              ({count})
                            </span>
                          </div>
                          <div style={{ fontWeight: '600', color: '#667eea' }}>
                            +{calculatedPoints}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Followers - Hide for admin and PESO accounts */}
          {!user?.account_type?.peso && (!user?.account_type?.admin || isOwnProfile) && (!user?.account_type?.ccict || isOwnProfile) && (
          <div style={{ marginBottom: '24px' }}>
            <div className="profile-followers-header">
              <div className="profile-followers-title">Followers ({followers.length})</div>
              <div
                className="profile-followers-seeall"
                onClick={() => {
                  setShowFollowersModal(true);
                }}
                style={{ cursor: 'pointer' }}
              >
                See all
              </div>
            </div>
            <div className="profile-followers-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {followers.length === 0 ? (
                <div>No followers yet.</div>
              ) : (
                <>
                  {/* Render followers in rows of 3, max 9 users */}
                  {Array.from({ length: Math.ceil(Math.min(followers.length, 9) / 3) }).map((_, rowIndex) => (
                    <div key={`row-${rowIndex}`} className="profile-followers-row">
                      {followers.slice(rowIndex * 3, Math.min(rowIndex * 3 + 3, 9)).map((follower) => (
                        <div
                          key={follower.user_id ?? follower.id}
                          className="profile-follower-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            const destId = follower.user_id ?? follower.id;

                            // Always navigate to the follower's profile if we have a valid ID
                            if (destId && !isNaN(Number(destId))) {
                              console.log('Followers: Navigating to follower profile:', destId);
                              navigate(`/profile/${destId}`);
                            } else {
                              console.log('Followers: Invalid follower ID:', destId);
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <img
                            src={follower.profile_pic ? (String(follower.profile_pic).startsWith('http') ? follower.profile_pic : `http://127.0.0.1:8000${follower.profile_pic}`) : ctulogo}
                            alt={follower.name}
                            className="profile-follower-img"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.onerror = null;
                              target.src = ctulogo as unknown as string;
                            }}
                          />
                          <div className="profile-follower-name">
                            {follower.name || 
                             (follower.f_name || follower.m_name || follower.l_name ? 
                              `${follower.f_name || ''} ${follower.m_name || ''} ${follower.l_name || ''}`.trim() : 
                              `User ${follower.user_id || follower.id}`)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
          )}

          {/* Following - Hide for admin and PESO accounts */}
          {!user?.account_type?.peso && (!user?.account_type?.admin || isOwnProfile) && (!user?.account_type?.ccict || isOwnProfile) && (
          <div style={{ marginBottom: '24px' }}>
            <div className="profile-followers-header">
              <div className="profile-followers-title">Following ({following.length})</div>
              <div
                className="profile-followers-seeall"
                onClick={() => {
                  setShowFollowingModal(true);
                }}
                style={{ cursor: 'pointer' }}
              >
                See all
              </div>
            </div>
            <div className="profile-followers-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {following.length === 0 ? (
                <div>No following yet.</div>
              ) : (
                <>
                  {/* Render following in rows of 3, max 9 users */}
                  {Array.from({ length: Math.ceil(Math.min(following.length, 9) / 3) }).map((_, rowIndex) => (
                    <div key={`following-row-${rowIndex}`} className="profile-followers-row">
                      {following.slice(rowIndex * 3, Math.min(rowIndex * 3 + 3, 9)).map((followedUser) => (
                        <div
                          key={followedUser.user_id ?? followedUser.id}
                          className="profile-follower-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            const destId = followedUser.user_id ?? followedUser.id;

                            // Always navigate to the followed user's profile if we have a valid ID
                            if (destId && !isNaN(Number(destId))) {
                              console.log('Following: Navigating to followed user profile:', destId);
                              navigate(`/profile/${destId}`);
                            } else {
                              console.log('Following: Invalid followed user ID:', destId);
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <img
                            src={followedUser.profile_pic ? (String(followedUser.profile_pic).startsWith('http') ? followedUser.profile_pic : `http://127.0.0.1:8000${followedUser.profile_pic}`) : ctulogo}
                            alt={followedUser.name}
                            className="profile-follower-img"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.onerror = null;
                              target.src = ctulogo as unknown as string;
                            }}
                          />
                          <div className="profile-follower-name">
                            {followedUser.name || 
                             (followedUser.f_name || followedUser.m_name || followedUser.l_name ? 
                              `${followedUser.f_name || ''} ${followedUser.m_name || ''} ${followedUser.l_name || ''}`.trim() : 
                              `User ${followedUser.user_id || followedUser.id}`)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
          )}
        </div>

        {/* Center Content */}
        <div className="profile-center-content">
          {/* Orange Banner */}
          <div className="profile-orange-banner">
            {isOwnProfile && (
              <div className="profile-edit-profile-button" onClick={handleEditProfile}>
                <span>Edit Profile</span>
                <span>✏️</span>
              </div>
            )}
          </div>
          {/* Profile Info Section */}
          <div className="profile-info-section">
            <div className="profile-info-card">
              <img 
                src={user?.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : ctulogo}
                alt="Profile" 
                className="profile-image"
              />
              <div className="profile-name">{user?.name || 'no name detected'}</div>
              
              <div className="profile-other-actions-below-university">
                {!isOwnProfile && !user?.account_type?.peso && !user?.account_type?.admin && !user?.account_type?.ccict && (
                  <button
                    className={`profile-follow-button ${isFollowing ? 'following' : ''}`}
                    onClick={isFollowing ? handleUnfollow : handleFollow}
                    disabled={followLoading[Number(id)]}
                  >
                    {followLoading[Number(id)] ? '...' : isFollowing ? 'Unfollow' : 'Follow'}
                  </button>
                )}  
                {!isOwnProfile && (
                  <button
                    className="profile-message-button"
                    onClick={async () => {
                      try {
                        // Create or open conversation with this user, then navigate
                        const convo = await createConversation(Number(id));
                        window.location.href = `/messages?conversation_id=${convo.conversation_id}`;
                      } catch (e) {
                        console.error('Failed to open conversation:', e);
                      }
                    }}
                  >
                    Message
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Start a Post */}
          {isOwnProfile && (
            <div className="profile-start-post-card" onClick={() => setShowComposer(true)} style={{ cursor: 'pointer' }}>
              <div className="profile-start-post-input-container">
                <img 
                  src={user?.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : ctulogo}
                  alt="Profile" 
                  className="profile-start-post-profile-image"
                />
                <input
                  type="text"
                  placeholder="Start a post"
                  className="profile-start-post-input"
                  readOnly
                />
              </div>
            </div>
          )}

          {/* Show the composer modal */}
          {showComposer && (
            <PostCreate
              onPosted={onPosted}
              onCancel={() => setShowComposer(false)}
              user={user ?? { name: '', profile_pic: undefined }}
            />
          )}

          {/* Posts List for this profile */}
          {posts.length === 0 && !isOwnProfile && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666', fontSize: '16px' }}>
              {(user?.account_type?.admin || user?.account_type?.peso || user?.account_type?.ccict ||
                user?.name?.toLowerCase().includes('admin') || user?.name?.toLowerCase().includes('peso'))
                ? "This user has not posted anything yet."
                : (isFollowing
                    ? "This user has not posted anything yet."
                    : "Follow this user to view their posts")}
            </div>
          )}
          {posts.map((item: any) => {
            // Handle repost items (separate feed items)
            if (item.item_type === 'repost') {
              const repostItem = item;
              const isOwnRepost = currentId && repostItem.user?.user_id && Number(repostItem.user.user_id) === Number(currentId);
              const repostDisplayName = formatDisplayName(repostItem.user, isOwnRepost, user);
              const repostUserAvatar = repostItem.user?.profile_pic ? (String(repostItem.user.profile_pic).startsWith('http') ? repostItem.user.profile_pic : `http://127.0.0.1:8000${repostItem.user.profile_pic}`) : undefined;
              const repostDisplayAvatar = isOwnRepost && user?.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : (repostUserAvatar || ctulogo);
              
              return (
                <RepostCard
                  key={`repost-${repostItem.repost_id}`}
                  repost={{
                    repost_id: repostItem.repost_id,
                    repost_date: repostItem.repost_date,
                    repost_caption: repostItem.repost_caption,
                    user: { 
                      user_id: repostItem.user?.user_id || 0, 
                      f_name: repostItem.user?.f_name, 
                      l_name: repostItem.user?.l_name, 
                      profile_pic: repostItem.user?.profile_pic 
                    },
                    likes: repostItem.likes || [],
                    likes_count: repostItem.likes_count || 0,
                    comments: repostItem.comments || [],
                    comments_count: repostItem.comments_count || 0,
                    original_post: repostItem.original_post ? {
                      post_id: repostItem.original_post.post_id,
                      created_at: repostItem.original_post.created_at,
                      post_content: repostItem.original_post.post_content,
                      post_images: repostItem.original_post.post_images || (repostItem.original_post.post_image ? [{ image_id: 0, image_url: repostItem.original_post.post_image, order: 0 }] : undefined),
                      user: repostItem.original_post.user ? { 
                        user_id: repostItem.original_post.user.user_id || 0, 
                        f_name: repostItem.original_post.user.f_name, 
                        m_name: repostItem.original_post.user.m_name,
                        l_name: repostItem.original_post.user.l_name, 
                        profile_pic: repostItem.original_post.user.profile_pic 
                      } : undefined
                    } : undefined
                  }}
                  currentUserId={currentId}
                  formatTime={formatTimeAgo}
                  onRefresh={() => {
                    getPosts().then(updatedPosts => {
                      const currentUserId = Number(id) || Number(JSON.parse(localStorage.getItem('user') || '{}').user_id || JSON.parse(localStorage.getItem('user') || '{}').id);
                      
                      if (currentUserId) {
                        const subset = (updatedPosts || []).filter((p: any) => {
                          // Include original posts by this user
                          if (p.user?.user_id === Number(currentUserId)) {
                            return true;
                          }
                          
                          // Include reposts by this user (reposts are separate feed items)
                          if (p.item_type === 'repost' && p.user?.user_id === Number(currentUserId)) {
                            return true;
                          }
                          
                          // Include original posts that have reposts by this user
                          if (p.reposts && p.reposts.some((repost: any) => repost.user.user_id === Number(currentUserId))) {
                            return true;
                          }
                          
                          return false;
                        });
                        
                        // Sort posts by most recent date considering repost_date for reposts and created_at for original posts
                        subset.sort((a: any, b: any) => {
                          let aDate: Date;
                          let bDate: Date;
                          
                          // Handle repost items
                          if (a.item_type === 'repost') {
                            aDate = new Date(a.repost_date || 0);
                          } else if (a.reposts && a.reposts.length > 0) {
                            aDate = new Date(a.reposts[0].repost_date);
                          } else {
                            aDate = new Date(a.created_at || 0);
                          }
                          
                          if (b.item_type === 'repost') {
                            bDate = new Date(b.repost_date || 0);
                          } else if (b.reposts && b.reposts.length > 0) {
                            bDate = new Date(b.reposts[0].repost_date);
                          } else {
                            bDate = new Date(b.created_at || 0);
                          }
                          
                          return bDate.getTime() - aDate.getTime();
                        });
                        
                        setPosts(subset);
                        
                        // Update liked posts state
                        const liked: { [key: number]: boolean } = {};
                        subset.forEach((post: any) => {
                          if (post.item_type === 'post' && post.likes && Array.isArray(post.likes)) {
                            liked[post.post_id] = post.likes.some((like: any) => like.user_id === currentId);
                          } else if (post.item_type === 'repost' && post.likes && Array.isArray(post.likes)) {
                            liked[post.repost_id] = post.likes.some((like: any) => like.user_id === currentId);
                          }
                        });
                        setLikedPosts(liked);

                        // Update repostedPosts state
                        const reposted: { [key: number]: boolean } = {};
                        subset.forEach((post: any) => {
                          if (post.item_type === 'post' && post.reposts && Array.isArray(post.reposts)) {
                            reposted[post.post_id] = post.reposts.some((repost: any) => repost.user.user_id === currentId);
                          }
                        });
                        setRepostedPosts(reposted);
                      }
                    });
                  }}
                  context={'post'}
                />
              );
            }
            
            // Handle regular posts
            const post = item;
            const isOwn = currentId && post.user?.user_id && Number(post.user.user_id) === Number(currentId);
            const displayName = formatDisplayName(post.user, isOwn, user);
            const postUserAvatar = post.user?.profile_pic ? (String(post.user.profile_pic).startsWith('http') ? post.user.profile_pic : `http://127.0.0.1:8000${post.user.profile_pic}`) : undefined;
            const displayAvatar = isOwn && user?.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : (postUserAvatar || ctulogo);
            
            // Check if this post has reposts and render them
            if (post.reposts && post.reposts.length > 0) {
              const repostCards = post.reposts.map((repost: any) => (
                <PostCard
                  key={`repost-${repost.repost_id}`}
                  post={{
                    ...post,
                    post_id: repost.repost_id, // Use repost_id for interactions
                    likes: repost.likes || [],
                    comments: repost.comments || [],
                    likes_count: repost.likes_count || 0,
                    comments_count: repost.comments_count || 0,
                  }}
                  currentUserId={currentId}
                  isOwn={currentId === repost.user.user_id}
                  displayName={displayName}
                  displayAvatar={displayAvatar}
                  formatTime={formatTimeAgo}
                  
                  onViewOriginalPost={handleViewOriginalPost}
                  onPostUpdate={() => {
                    getPosts().then(updatedPosts => {
                      const currentUserId = Number(id) || Number(JSON.parse(localStorage.getItem('user') || '{}').user_id || JSON.parse(localStorage.getItem('user') || '{}').id);
                      
                      if (currentUserId) {
                        const subset = (updatedPosts || []).filter((p: any) => {
                          // Include original posts by this user
                          if (p.user?.user_id === Number(currentUserId)) {
                            return true;
                          }
                          
                          // Include reposts by this user (reposts are separate feed items)
                          if (p.item_type === 'repost' && p.user?.user_id === Number(currentUserId)) {
                            return true;
                          }
                          
                          // Include original posts that have reposts by this user
                          if (p.reposts && p.reposts.some((repost: any) => repost.user.user_id === Number(currentUserId))) {
                            return true;
                          }
                          
                          return false;
                        });
                        
                        setPosts(subset);
                        
                        // Update likedPosts state
                        const liked: { [key: number]: boolean } = {};
                        subset.forEach((post: any) => {
                          if (post.item_type === 'post' && post.likes && Array.isArray(post.likes)) {
                            liked[post.post_id] = post.likes.some((like: any) => like.user_id === currentId);
                          } else if (post.item_type === 'repost' && post.likes && Array.isArray(post.likes)) {
                            liked[post.repost_id] = post.likes.some((like: any) => like.user_id === currentId);
                          }
                        });
                        setLikedPosts(liked);

                        // Update repostedPosts state
                        const reposted: { [key: number]: boolean } = {};
                        subset.forEach((post: any) => {
                          if (post.item_type === 'post') {
                            reposted[post.post_id] = false; // Will be calculated from reposts_count
                          }
                        });
                        setRepostedPosts(reposted);
                      }
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
              ));
              return repostCards;
            }
            
            // Render original post
            return (
              <PostCard
                key={post.post_id}
                post={post}
                currentUserId={currentId}
                isOwn={!!isOwn}
                displayName={displayName}
                displayAvatar={displayAvatar}
                formatTime={formatTimeAgo}
                onViewOriginalPost={handleViewOriginalPost}
                onPostUpdate={() => {
                  getPosts().then(updatedPosts => {
                    const currentUserId = Number(id) || Number(JSON.parse(localStorage.getItem('user') || '{}').user_id || JSON.parse(localStorage.getItem('user') || '{}').id);
                    
                    if (currentUserId) {
                      const subset = (updatedPosts || []).filter((p: any) => {
                        // Include original posts by this user
                        if (p.user?.user_id === Number(currentUserId)) {
                          return true;
                        }
                        
                        // Include reposts by this user (reposts are separate feed items)
                        if (p.item_type === 'repost' && p.user?.user_id === Number(currentUserId)) {
                          return true;
                        }
                        
                        // Include original posts that have reposts by this user
                        if (p.reposts && p.reposts.some((repost: any) => repost.user.user_id === Number(currentUserId))) {
                          return true;
                        }
                        
                        return false;
                      });
                      
                      setPosts(subset);
                      
                      // Update likedPosts state
                      const liked: { [key: number]: boolean } = {};
                      subset.forEach((post: any) => {
                        if (post.item_type === 'post' && post.likes && Array.isArray(post.likes)) {
                          liked[post.post_id] = post.likes.some((like: any) => like.user_id === currentId);
                        } else if (post.item_type === 'repost' && post.likes && Array.isArray(post.likes)) {
                          liked[post.repost_id] = post.likes.some((like: any) => like.user_id === currentId);
                        }
                      });
                      setLikedPosts(liked);

                      // Update repostedPosts state
                      const reposted: { [key: number]: boolean } = {};
                      subset.forEach((post: any) => {
                        if (post.item_type === 'post') {
                          reposted[post.post_id] = false; // Will be calculated from reposts_count
                        }
                      });
                      setRepostedPosts(reposted);
                    }
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
          }).flat()}
        </div>

        {/* Bio Modal */}
        {bioModalOpen && (
          <div 
            className="profile-bio-modal-overlay" 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}
            onClick={(e) => {
              // Close modal when clicking on the overlay (outside the modal content)
              if (e.target === e.currentTarget) {
                setBioModalOpen(false);
              }
            }}
          >
            <div 
              className="profile-bio-modal-content" 
              style={{
                background: 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)',
                borderRadius: '16px',
                padding: '20px',
                maxWidth: '360px',
                width: '90%',
                maxHeight: '60vh',
                overflowY: 'auto',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',
                position: 'relative',
                border: '1px solid rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(10px)'
              }}
            >
              <button
                onClick={() => setBioModalOpen(false)}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f5f5f5';
                  e.currentTarget.style.color = '#333';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#666';
                }}
                title="Close"
              >
                ×
              </button>
              
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#2c2c2c',
                marginBottom: '16px',
                textAlign: 'center'
              }}>
                {user && user.profile_bio && user.profile_bio.trim() ? 'Edit Bio' : 'Add Bio'}
              </h3>
              
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <textarea
                  value={bioInput}
                  onChange={(e) => {
                    setBioInput(e.target.value);
                    // Auto-resize textarea
                    const textarea = e.target;
                    textarea.style.height = 'auto';
                    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
                  }}
                  rows={4}
                  style={{
                    width: '100%',
                    maxWidth: '300px',
                    padding: '12px',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'none',
                    minHeight: '80px',
                    maxHeight: '150px',
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    transition: 'border-color 0.2s ease',
                    outline: 'none',
                    overflow: 'auto'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#ff6b35';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                  }}
                  placeholder="Tell us about yourself..."
                />
              </div>
              
              <div style={{ 
                display: 'flex', 
                gap: '10px', 
                justifyContent: 'center', 
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid rgba(0, 0, 0, 0.06)'
              }}>
                <button
                  onClick={() => setBioModalOpen(false)}
                  disabled={bioLoading}
                  style={{
                    flex: 1,
                    maxWidth: '100px',
                    padding: '10px 16px',
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    color: '#666',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s ease',
                    opacity: bioLoading ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!bioLoading) {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
                      e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.15)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!bioLoading) {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
                      e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  Cancel
                </button>
                
                {user && user.profile_bio && user.profile_bio.trim() && (
                  <button
                    onClick={handleDeleteBio}
                    disabled={bioLoading}
                    style={{
                      flex: 1,
                      maxWidth: '100px',
                      padding: '10px 16px',
                      backgroundColor: 'rgba(255, 71, 87, 0.9)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      transition: 'all 0.2s ease',
                      opacity: bioLoading ? 0.6 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!bioLoading) {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 55, 66, 0.95)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!bioLoading) {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 71, 87, 0.9)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }
                    }}
                  >
                    {bioLoading ? 'Deleting...' : 'Delete Bio'}
                  </button>
                )}
                
                <button
                  onClick={handleSaveBio}
                  disabled={bioLoading}
                  style={{
                    flex: 1,
                    maxWidth: '100px',
                    padding: '10px 16px',
                    backgroundColor: '#ff6b35',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.2s ease',
                    opacity: bioLoading ? 0.6 : 1,
                    boxShadow: '0 2px 8px rgba(255, 107, 53, 0.25)'
                  }}
                  onMouseEnter={(e) => {
                    if (!bioLoading) {
                      e.currentTarget.style.backgroundColor = '#e55a2b';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 107, 53, 0.35)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!bioLoading) {
                      e.currentTarget.style.backgroundColor = '#ff6b35';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(255, 107, 53, 0.25)';
                    }
                  }}
                >
                  {bioLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {editModalOpen && (
        <div 
          className="profile-edit-modal-overlay" 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={(e) => {
            // Close modal when clicking on the overlay (outside the modal content)
            if (e.target === e.currentTarget) {
              setEditModalOpen(false);
            }
          }}
        >
          <div className="profile-edit-modal-content" style={{
            background: 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)',
            borderRadius: '16px',
            padding: '20px',
            maxWidth: '360px',
            width: '90%',
            maxHeight: '60vh',
            overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',
            position: 'relative',
            border: '1px solid rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(10px)'
          }}>
            <button
              onClick={() => setEditModalOpen(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f5f5f5';
                e.currentTarget.style.color = '#333';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#666';
              }}
              title="Close"
            >
              ×
            </button>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#2c2c2c',
              marginBottom: '16px',
              textAlign: 'center'
            }}>Edit Profile</h2>
            
            {/* Profile Pic Section */}
            <div style={{ 
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#4a4a4a',
                marginBottom: '12px'
              }}>Profile Picture</label>
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px'
              }}>
                <div style={{
                  position: 'relative',
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '2px solid rgba(255, 255, 255, 0.9)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
                }}>
              <img
                src={
                  editProfilePic 
                    ? (String(editProfilePic).startsWith('data:') || String(editProfilePic).startsWith('http') 
                        ? editProfilePic 
                        : `http://127.0.0.1:8000${editProfilePic}`)
                    : (user?.profile_pic 
                        ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`)
                        : ctulogo)
                }
                alt="Profile Preview"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src = ctulogo as unknown as string;
                }}
              />
                </div>
                
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  width: '100%',
                  maxWidth: '250px'
                }}>
                  <label style={{
                    display: 'inline-block',
                    padding: '10px 16px',
                    backgroundColor: '#ff6b35',
                    color: 'white',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '500',
                    textAlign: 'center',
                    transition: 'all 0.2s ease',
                    border: 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#e55a2b';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ff6b35';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}>
                    Choose New Photo
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleProfilePicChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                  
                  <button 
                    onClick={handleRemoveProfilePic} 
                    style={{
                      padding: '10px 16px',
                      backgroundColor: 'transparent',
                      color: '#666',
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '500',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f5f5f5';
                      e.currentTarget.style.borderColor = '#ccc';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.borderColor = '#e0e0e0';
                    }}
                  >
                    Remove Current Photo
                </button>
                </div>
              </div>
            </div>

            {/* Save and Cancel Buttons */}
            <div style={{ 
              display: 'flex', 
              gap: '10px', 
              justifyContent: 'center', 
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(0, 0, 0, 0.06)'
            }}>
              <button
                onClick={() => setEditModalOpen(false)}
                style={{
                  flex: 1,
                  maxWidth: '100px',
                  padding: '10px 16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  color: '#666',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
                  e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.15)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
                  e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                style={{
                  flex: 1,
                  maxWidth: '100px',
                  padding: '10px 16px',
                  backgroundColor: '#ff6b35',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(255, 107, 53, 0.25)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e55a2b';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 107, 53, 0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ff6b35';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(255, 107, 53, 0.25)';
                }}
              >
                Save Changes
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Partnered Companies Modal (PESO only) */}
      {partnerModalOpen && (
        <div 
          className="profile-bio-modal-overlay" 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setPartnerModalOpen(false); }}
        >
          <div
            className="profile-bio-modal-content"
            style={{
              background: '#fff', borderRadius: 12, padding: 20, width: '90%', maxWidth: 520, maxHeight: '70vh', overflowY: 'auto', position: 'relative'
            }}
          >
            <button
              onClick={() => setPartnerModalOpen(false)}
              style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}
              title="Close"
            >
              ×
            </button>
            <h3 style={{ margin: 0, marginBottom: 12 }}>Edit Partnered Companies</h3>
            <p style={{ marginTop: 0, color: '#666' }}>Add company name and website/page URL.</p>

            {/* Editor rows */}
            {(partnerCompaniesDraft.length === 0 ? [{ name: '', url: '' }] : partnerCompaniesDraft).map((c, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  placeholder="Company name"
                  value={c.name}
                  onChange={(e) => {
                    const next = [...(partnerCompaniesDraft.length ? partnerCompaniesDraft : [{ name: '', url: '' }])];
                    next[idx] = { ...next[idx], name: e.target.value };
                    setPartnerCompaniesDraft(next);
                  }}
                  style={{ flex: 1, padding: 8, border: '1px solid #ddd', borderRadius: 8 }}
                />
                <input
                  type="text"
                  placeholder="https://example.com"
                  value={c.url}
                  onChange={(e) => {
                    const next = [...(partnerCompaniesDraft.length ? partnerCompaniesDraft : [{ name: '', url: '' }])];
                    next[idx] = { ...next[idx], url: e.target.value };
                    setPartnerCompaniesDraft(next);
                  }}
                  style={{ flex: 1, padding: 8, border: '1px solid #ddd', borderRadius: 8 }}
                />
                <button
                  onClick={() => {
                    const base = partnerCompaniesDraft.length ? partnerCompaniesDraft : [{ name: '', url: '' }];
                    const next = base.filter((_, i) => i !== idx);
                    setPartnerCompaniesDraft(next);
                  }}
                  style={{ padding: '8px 10px', border: '1px solid #ddd', background: '#fafafa', borderRadius: 8, cursor: 'pointer' }}
                >
                  Remove
                </button>
              </div>
            ))}

            <div style={{ marginBottom: 12 }}>
              <button
                onClick={() => setPartnerCompaniesDraft([...(partnerCompaniesDraft || []), { name: '', url: '' }])}
                style={{ padding: '8px 12px', border: '1px solid #ddd', background: '#f7f7f7', borderRadius: 8, cursor: 'pointer' }}
              >
                + Add Company
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setPartnerModalOpen(false)} style={{ padding: '10px 14px', border: '1px solid #ddd', background: '#fff', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={async () => {
                  try {
                    const meRaw = localStorage.getItem('user');
                    const me = meRaw ? JSON.parse(meRaw) : null;
                    const meId = me?.user_id || me?.id;
                    const payloadCompanies = partnerCompaniesDraft.filter((c) => (c.name || '').trim());
                    const res = await fetch(`http://127.0.0.1:8000/api/alumni/profile/${meId}/`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}` },
                      body: JSON.stringify({})
                    });
                    if (res.ok) {
                      // update local state to reflect changes immediately
                      setUser((prev: any) => prev ? { ...prev } : prev);
                      setPartnerModalOpen(false);
                    } else {
                      alert('Failed to save companies');
                    }
                  } catch (e) {
                    console.error(e);
                    alert('Error saving companies');
                  }
                }}
                style={{ padding: '10px 14px', border: 'none', background: '#174f84', color: '#fff', borderRadius: 8, cursor: 'pointer' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Followers Modal */}
      {showFollowersModal && (
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
          onClick={() => setShowFollowersModal(false)}
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
              }}>Followers ({followers.length})</h3>
              <button
                onClick={() => setShowFollowersModal(false)}
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
              {followers.length === 0 ? (
                <div style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  color: '#666',
                  fontSize: 16,
                  padding: '40px 20px'
                }}>No followers yet.</div>
              ) : (
                followers.map((follower) => (
                  <div
                    key={follower.user_id ?? follower.id}
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
                      const destId = follower.user_id ?? follower.id;
                      const me = JSON.parse(localStorage.getItem('user') || '{}');
                      const meId = me.user_id || me.id;
                      if (destId && Number(destId) !== Number(meId)) {
                        navigate(`/alumni/profile/${destId}`);
                        setShowFollowersModal(false);
                      }
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
                      src={follower.profile_pic ? (String(follower.profile_pic).startsWith('http') ? follower.profile_pic : `http://127.0.0.1:8000${follower.profile_pic}`) : ctulogo}
                      alt={`${follower.f_name} ${follower.l_name}`}
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        marginBottom: 12,
                        border: '3px solid #f0f0f0',
                      }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.src = ctulogo as unknown as string;
                      }}
                    />
                    <div style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: '#1a1a1a',
                      textAlign: 'center',
                      marginBottom: 4,
                    }}>
                      {follower.name || 
                       (follower.f_name || follower.m_name || follower.l_name ? 
                        `${follower.f_name || ''} ${follower.m_name || ''} ${follower.l_name || ''}`.trim() : 
                        `User ${follower.user_id || follower.id}`)}
                    </div>
                    <div style={{
                      fontSize: 13,
                      color: '#666',
                      marginBottom: 12,
                    }}>
                      {follower.batch ? `Batch ${follower.batch}` : ''}
                    </div>
                    {Number(follower.user_id || follower.id) !== Number(getCurrentUserId(JSON.parse(localStorage.getItem('user') || '{}'))) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFollowUser(Number(follower.user_id || follower.id));
                        }}
                        disabled={followLoading[Number(follower.user_id || follower.id)]}
                        className={`suggested-user-follow-button ${followingStatus[Number(follower.user_id || follower.id)] ? 'following' : ''}`}
                      >
                        {followLoading[Number(follower.user_id || follower.id)] ? '...' : 
                         followingStatus[Number(follower.user_id || follower.id)] ? 'Unfollow' : 'Follow'}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Following Modal */}
      {showFollowingModal && (
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
          onClick={() => setShowFollowingModal(false)}
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
              }}>Following ({following.length})</h3>
              <button
                onClick={() => setShowFollowingModal(false)}
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
              {following.length === 0 ? (
                <div style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  color: '#666',
                  fontSize: 16,
                  padding: '40px 20px'
                }}>No following yet.</div>
              ) : (
                following.map((followedUser) => (
                  <div
                    key={followedUser.user_id ?? followedUser.id}
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
                      const destId = followedUser.user_id ?? followedUser.id;
                      const me = JSON.parse(localStorage.getItem('user') || '{}');
                      const meId = me.user_id || me.id;
                      if (destId && Number(destId) !== Number(meId)) {
                        navigate(`/alumni/profile/${destId}`);
                        setShowFollowingModal(false);
                      }
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
                      src={followedUser.profile_pic ? (String(followedUser.profile_pic).startsWith('http') ? followedUser.profile_pic : `http://127.0.0.1:8000${followedUser.profile_pic}`) : ctulogo}
                      alt={`${followedUser.f_name} ${followedUser.l_name}`}
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        marginBottom: 12,
                        border: '3px solid #f0f0f0',
                      }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.src = ctulogo as unknown as string;
                      }}
                    />
                    <div style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: '#1a1a1a',
                      textAlign: 'center',
                      marginBottom: 4,
                    }}>
                      {followedUser.name || 
                       (followedUser.f_name || followedUser.m_name || followedUser.l_name ? 
                        `${followedUser.f_name || ''} ${followedUser.m_name || ''} ${followedUser.l_name || ''}`.trim() : 
                        `User ${followedUser.user_id || followedUser.id}`)}
                    </div>
                    <div style={{
                      fontSize: 13,
                      color: '#666',
                      marginBottom: 12,
                    }}>
                      {followedUser.batch ? `Batch ${followedUser.batch}` : ''}
                    </div>
                    {Number(followedUser.user_id || followedUser.id) !== Number(getCurrentUserId(JSON.parse(localStorage.getItem('user') || '{}'))) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFollowUser(Number(followedUser.user_id || followedUser.id));
                        }}
                        disabled={followLoading[Number(followedUser.user_id || followedUser.id)]}
                        className={`suggested-user-follow-button ${followingStatus[Number(followedUser.user_id || followedUser.id)] ? 'following' : ''}`}
                      >
                        {followLoading[Number(followedUser.user_id || followedUser.id)] ? '...' : 
                         followingStatus[Number(followedUser.user_id || followedUser.id)] ? 'Unfollow' : 'Follow'}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Members Modal */}
      {showMembersModal && (
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
          onClick={() => setShowMembersModal(false)}
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
              }}>Members ({allMembers.length}) - Batch {user?.batch || 'Unknown'}</h3>
              <button
                onClick={() => setShowMembersModal(false)}
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
              {allMembers.length === 0 ? (
                <div style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  color: '#666',
                  fontSize: 16,
                  padding: '40px 20px'
                }}>No members found.</div>
              ) : (
                allMembers.map((member) => (
                  <div
                    key={member.user_id ?? member.id}
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
                      const destId = member.user_id ?? member.id;
                      const me = JSON.parse(localStorage.getItem('user') || '{}');
                      const meId = me.user_id || me.id;
                      if (destId && Number(destId) !== Number(meId)) {
                        navigate(`/alumni/profile/${destId}`);
                        setShowMembersModal(false);
                      }
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
                      src={member.profile_pic ? (String(member.profile_pic).startsWith('http') ? member.profile_pic : `http://127.0.0.1:8000${member.profile_pic}`) : ctulogo}
                      alt={member.name || 'Unknown User'}
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        marginBottom: 12,
                        border: '3px solid #f0f0f0',
                      }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.src = ctulogo as unknown as string;
                      }}
                    />
                    <div style={{ 
                      fontSize: 15,
                      fontWeight: 600,
                      color: '#1a1a1a',
                      textAlign: 'center',
                      marginBottom: 4,
                    }}>
                      {member.f_name} {member.m_name} {member.l_name}
                    </div>
                    <div style={{ 
                      fontSize: 13,
                      color: '#666',
                      marginBottom: 12,
                    }}>
                      Batch {member.batch || 'Unknown'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Social Media Modal */}
      {socialMediaModalOpen && (
        <div 
          className="profile-bio-modal-overlay" 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSocialMediaModalOpen(false);
            }
          }}
        >
          <div 
            className="profile-bio-modal-content" 
            style={{
              background: 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)',
              borderRadius: '16px',
              padding: '20px',
              maxWidth: '360px',
              width: '90%',
              maxHeight: '60vh',
              overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',
              position: 'relative',
              border: '1px solid rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <button
              onClick={() => setSocialMediaModalOpen(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f5f5f5';
                e.currentTarget.style.color = '#333';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#666';
              }}
              title="Close"
            >
              ×
            </button>
            
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#2c2c2c',
              marginBottom: '16px',
              textAlign: 'center'
            }}>
              {user && user.social_media && user.social_media.trim() ? 'Edit Social Media' : 'Add Social Media'}
            </h3>
            
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <input
                type="text"
                value={socialMediaInput}
                onChange={(e) => setSocialMediaInput(e.target.value)}
                style={{
                  width: '100%',
                  maxWidth: '300px',
                  padding: '12px',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  transition: 'border-color 0.2s ease',
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#ff6b35';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                }}
                placeholder="Add social media acc"
              />
            </div>
            
            <div style={{ 
              display: 'flex', 
              gap: '10px', 
              justifyContent: 'center', 
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(0, 0, 0, 0.06)'
            }}>
              <button
                onClick={() => setSocialMediaModalOpen(false)}
                disabled={socialMediaLoading}
                style={{
                  flex: 1,
                  maxWidth: '140px',
                  padding: '10px 16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  color: '#666',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease',
                  opacity: socialMediaLoading ? 0.6 : 1
                }}
              >
                Cancel
              </button>
              
              <button
                onClick={handleSaveSocialMedia}
                disabled={socialMediaLoading}
                style={{
                  flex: 1,
                  maxWidth: '140px',
                  padding: '10px 16px',
                  backgroundColor: '#ff6b35',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.2s ease',
                  opacity: socialMediaLoading ? 0.6 : 1,
                  boxShadow: '0 2px 8px rgba(255, 107, 53, 0.25)'
                }}
              >
                {socialMediaLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {emailModalOpen && (
        <div 
          className="profile-bio-modal-overlay" 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEmailModalOpen(false);
            }
          }}
        >
          <div 
            className="profile-bio-modal-content" 
            style={{
              background: 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)',
              borderRadius: '16px',
              padding: '20px',
              maxWidth: '360px',
              width: '90%',
              maxHeight: '60vh',
              overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',
              position: 'relative',
              border: '1px solid rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <button
              onClick={() => setEmailModalOpen(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f5f5f5';
                e.currentTarget.style.color = '#333';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#666';
              }}
              title="Close"
            >
              ×
            </button>
            
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#2c2c2c',
              marginBottom: '16px',
              textAlign: 'center'
            }}>
              {user && user.email && user.email.trim() ? 'Edit Email' : 'Add Email'}
            </h3>
            
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                style={{
                  width: '100%',
                  maxWidth: '300px',
                  padding: '12px',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  transition: 'border-color 0.2s ease',
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#ff6b35';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                }}
                placeholder="Enter email address"
              />
            </div>
            
            <div style={{ 
              display: 'flex', 
              gap: '10px', 
              justifyContent: 'center', 
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(0, 0, 0, 0.06)'
            }}>
              <button
                onClick={() => setEmailModalOpen(false)}
                disabled={emailLoading}
                style={{
                  flex: 1,
                  maxWidth: '100px',
                  padding: '10px 16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  color: '#666',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease',
                  opacity: emailLoading ? 0.6 : 1
                }}
              >
                Cancel
              </button>
              
              {user && user.email && user.email.trim() && (
                <button
                  onClick={handleDeleteEmail}
                  disabled={emailLoading}
                  style={{
                    flex: 1,
                    maxWidth: '100px',
                    padding: '10px 16px',
                    backgroundColor: 'rgba(255, 71, 87, 0.9)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s ease',
                    opacity: emailLoading ? 0.6 : 1
                  }}
                >
                  {emailLoading ? 'Deleting...' : 'Delete'}
                </button>
              )}
              
              <button
                onClick={handleSaveEmail}
                disabled={emailLoading}
                style={{
                  flex: 1,
                  maxWidth: '100px',
                  padding: '10px 16px',
                  backgroundColor: '#ff6b35',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.2s ease',
                  opacity: emailLoading ? 0.6 : 1,
                  boxShadow: '0 2px 8px rgba(255, 107, 53, 0.25)'
                }}
              >
                {emailLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                displayAvatar={modalPost.user?.profile_pic ? (String(modalPost.user.profile_pic).startsWith('http') ? modalPost.user.profile_pic : `http://127.0.0.1:8000${modalPost.user.profile_pic}`) : ctulogo}
                formatTime={formatTimeAgo}
                
                onViewOriginalPost={handleViewOriginalPost}
                onPostUpdate={() => {
                  // Refresh the post data in modal and update the main posts list
                  const postId = modalPost.post_id;
                  if (postId) {
                    handleViewPost(postId.toString());
                  }
                  
                  // Also refresh the main posts list to keep everything in sync
                  getPosts().then(updatedPosts => {
                    const currentUserId = Number(id) || Number(JSON.parse(localStorage.getItem('user') || '{}').user_id || JSON.parse(localStorage.getItem('user') || '{}').id);
                    
                    if (currentUserId) {
                      const subset = (updatedPosts || []).filter((p: any) => {
                        // Include original posts by this user
                        if (p.user?.user_id === Number(currentUserId)) {
                          return true;
                        }
                        
                        // Include reposts by this user (reposts are separate feed items)
                        if (p.item_type === 'repost' && p.user?.user_id === Number(currentUserId)) {
                          return true;
                        }
                        
                        // Include original posts that have reposts by this user
                        if (p.reposts && p.reposts.some((repost: any) => repost.user.user_id === Number(currentUserId))) {
                          return true;
                        }
                        
                        return false;
                      });
                      
                      setPosts(subset);
                      
                      // Update likedPosts state
                      const liked: { [key: number]: boolean } = {};
                      subset.forEach((post: any) => {
                        if (post.item_type === 'post' && post.likes && Array.isArray(post.likes)) {
                          liked[post.post_id] = post.likes.some((like: any) => like.user_id === currentId);
                        } else if (post.item_type === 'repost' && post.likes && Array.isArray(post.likes)) {
                          liked[post.repost_id] = post.likes.some((like: any) => like.user_id === currentId);
                        }
                      });
                      setLikedPosts(liked);

                      // Update repostedPosts state
                      const reposted: { [key: number]: boolean } = {};
                      subset.forEach((post: any) => {
                        if (post.item_type === 'post') {
                          reposted[post.post_id] = false; // Will be calculated from reposts_count
                        }
                      });
                      setRepostedPosts(reposted);
                    }
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
                formatTime={formatTimeAgo}
                
                onViewOriginalPost={handleViewOriginalPost}
                onPostUpdate={() => {
                  // Refresh the original post data in modal
                  const postId = originalPostModalData.post_id;
                  if (postId) {
                    handleViewOriginalPost(originalPostModalData);
                  }
                  
                  // Also refresh the main posts list to keep everything in sync
                  getPosts().then(updatedPosts => {
                    const currentUserId = Number(id) || Number(JSON.parse(localStorage.getItem('user') || '{}').user_id || JSON.parse(localStorage.getItem('user') || '{}').id);
                    
                    if (currentUserId) {
                      const subset = (updatedPosts || []).filter((p: any) => {
                        // Include original posts by this user
                        if (p.user?.user_id === Number(currentUserId)) {
                          return true;
                        }
                        
                        // Include reposts by this user (reposts are separate feed items)
                        if (p.item_type === 'repost' && p.user?.user_id === Number(currentUserId)) {
                          return true;
                        }
                        
                        // Include original posts that have reposts by this user
                        if (p.reposts && p.reposts.some((repost: any) => repost.user.user_id === Number(currentUserId))) {
                          return true;
                        }
                        
                        return false;
                      });
                      
                      setPosts(subset);
                      
                      // Update likedPosts state
                      const liked: { [key: number]: boolean } = {};
                      subset.forEach((post: any) => {
                        if (post.item_type === 'post' && post.likes && Array.isArray(post.likes)) {
                          liked[post.post_id] = post.likes.some((like: any) => like.user_id === currentId);
                        } else if (post.item_type === 'repost' && post.likes && Array.isArray(post.likes)) {
                          liked[post.repost_id] = post.likes.some((like: any) => like.user_id === currentId);
                        }
                      });
                      setLikedPosts(liked);

                      // Update repostedPosts state
                      const reposted: { [key: number]: boolean } = {};
                      subset.forEach((post: any) => {
                        if (post.item_type === 'post') {
                          reposted[post.post_id] = false; // Will be calculated from reposts_count
                        }
                      });
                      setRepostedPosts(reposted);
                    }
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

      {/* Rewards Modal */}
      {showRewardsModal && (
        <div
          style={{
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
            padding: '20px'
          }}
          onClick={() => setShowRewardsModal(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e3a5f', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HiOutlineGift size={24} color="#1e3a5f" strokeWidth={1.5} />
                <span>Available Rewards</span>
              </h2>
              <button
                onClick={() => setShowRewardsModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '4px 8px',
                  lineHeight: '1',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#1f2937'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}
              >
                ×
              </button>
            </div>

            {rewardsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '16px', color: '#6b7280' }}>Loading rewards...</div>
              </div>
            ) : (() => {
              // Filter to only show rewards user can afford
              const affordableRewards = inventoryItems.filter((item) => {
                const pointsMatch = item.value?.match(/(\d+)/);
                const requiredPoints = pointsMatch ? parseInt(pointsMatch[1]) : 0;
                const canAfford = (userPoints?.total_points || 0) >= requiredPoints;
                // Also check if item has stock
                return canAfford && item.quantity > 0;
              });
              
              return affordableRewards.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>📭</div>
                  <div style={{ fontSize: '16px', color: '#6b7280', marginBottom: '8px' }}>No rewards available that you can afford at the moment</div>
                  <div style={{ fontSize: '14px', color: '#9ca3af', marginTop: '8px' }}>
                    You currently have {userPoints?.total_points || 0} points
                  </div>
                </div>
              ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                {affordableRewards.map((item) => {
                  const isVoucher = item.type?.toLowerCase().includes('voucher') || 
                                    item.type?.toLowerCase().includes('gift card') ||
                                    item.type?.toLowerCase().includes('coupon');
                  const isMerchandise = item.type?.toLowerCase().includes('merchandise') || 
                                       item.type?.toLowerCase().includes('merch') ||
                                       item.type?.toLowerCase().includes('product') ||
                                       item.type?.toLowerCase().includes('item');
                  
                  // Extract points required
                  const pointsMatch = item.value?.match(/(\d+)/);
                  const requiredPoints = pointsMatch ? parseInt(pointsMatch[1]) : 0;
                  const canAfford = (userPoints?.total_points || 0) >= requiredPoints;
                  const isClaiming = claimingReward === item.id;

                  return (
                    <div
                      key={item.id}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        background: 'white',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                        transition: 'all 0.2s',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '16px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.08)';
                        e.currentTarget.style.borderColor = '#cbd5e1';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
                        e.currentTarget.style.borderColor = '#e5e7eb';
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>
                          {item.name}
                        </h3>
                        <div style={{ fontSize: '12px', color: '#6b7280', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                          <span>Type: {item.type}</span>
                          <span>Cost: <strong style={{ color: '#1e3a5f', fontWeight: '700' }}>{item.value}</strong></span>
                          <span>Stock: {item.quantity} available</span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleRequestReward(item.id)}
                        disabled={!canAfford || item.quantity <= 0 || isClaiming}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '6px',
                          border: 'none',
                          background: canAfford && item.quantity > 0 ? '#1e3a5f' : '#e5e7eb',
                          color: canAfford && item.quantity > 0 ? 'white' : '#9ca3af',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: canAfford && item.quantity > 0 ? 'pointer' : 'not-allowed',
                          transition: 'all 0.2s',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}
                        onMouseEnter={(e) => {
                          if (canAfford && item.quantity > 0) {
                            e.currentTarget.style.backgroundColor = '#153e75';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (canAfford && item.quantity > 0) {
                            e.currentTarget.style.backgroundColor = '#1e3a5f';
                          }
                        }}
                      >
                        {isClaiming ? 'Processing...' : canAfford && item.quantity > 0 ? 'Request to Claim Reward' : 
                          item.quantity <= 0 ? 'Out of Stock' : 'Insufficient Points'}
                      </button>
                      
                    </div>
                  );
                })}
              </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Approved Rewards Modal - Shows user's reward requests */}
      {showApprovedRewardsModal && (
        <div
          style={{
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
            padding: '20px'
          }}
          onClick={() => setShowApprovedRewardsModal(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '1000px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#174f84', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HiOutlineCheckCircle size={24} color="#174f84" strokeWidth={1.5} />
                <span>My Reward Requests</span>
                <span style={{ fontSize: '14px', fontWeight: '500', color: '#64748b', marginLeft: '8px' }}>
                  ({userRewardRequests.length})
                </span>
              </h2>
              <button
                onClick={() => {
                  setShowApprovedRewardsModal(false);
                  setSelectedRewardDetail(null);
                  setRewardStatusFilter('all');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ×
              </button>
            </div>

            {userRewardRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>📭</div>
                <div style={{ fontSize: '16px', color: '#666' }}>No reward requests yet</div>
              </div>
            ) : (
              <>
                {/* Filters and View Toggle */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '16px',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  {/* Status Filter */}
                  <div style={{ position: 'relative' }} data-reward-filter-dropdown>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>Filter by status:</span>
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          role="button"
                          aria-expanded={showRewardFilterDropdown}
                          aria-haspopup="true"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowRewardFilterDropdown(!showRewardFilterDropdown);
                          }}
                          data-reward-filter-dropdown
                          style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            backgroundColor: 'white',
                            color: '#1e3a5f',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            minWidth: '180px',
                            justifyContent: 'space-between',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#cbd5e1';
                          }}
                          onMouseLeave={(e) => {
                            if (!showRewardFilterDropdown) {
                              e.currentTarget.style.borderColor = '#e5e7eb';
                            }
                          }}
                        >
                          <span>
                            {rewardStatusFilter === 'all' ? 'All' : 
                             rewardStatusFilter === 'pending' ? 'Pending' : 
                             rewardStatusFilter === 'approved' ? 'Ready' : 
                             rewardStatusFilter === 'claimed' ? 'Claimed' : 
                             'Did Not Push Through'}
                          </span>
                          <span style={{ 
                            fontSize: '10px',
                            transform: showRewardFilterDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s'
                          }}>▼</span>
                        </button>
                        {showRewardFilterDropdown && (
                          <div 
                            data-reward-filter-dropdown
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              backgroundColor: 'white',
                              borderRadius: '8px',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                              border: '1px solid #e5e7eb',
                              zIndex: 100,
                              marginTop: '4px',
                              overflow: 'hidden',
                              minWidth: '180px'
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                          >
                            {(['all', 'pending', 'approved', 'claimed', 'did_not_push_through'] as const).map((filter) => (
                              <div
                                key={filter}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setRewardStatusFilter(filter);
                                  setShowRewardFilterDropdown(false);
                                }}
                                style={{
                                  padding: '10px 16px',
                                  cursor: 'pointer',
                                  backgroundColor: rewardStatusFilter === filter ? '#f3f4f6' : 'white',
                                  color: rewardStatusFilter === filter ? '#1e3a5f' : '#374151',
                                  fontSize: '13px',
                                  fontWeight: rewardStatusFilter === filter ? '600' : '400',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  if (rewardStatusFilter !== filter) {
                                    e.currentTarget.style.backgroundColor = '#f9fafb';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (rewardStatusFilter !== filter) {
                                    e.currentTarget.style.backgroundColor = 'white';
                                  }
                                }}
                              >
                                {filter === 'all' ? 'All' : 
                                 filter === 'approved' ? 'Ready' : 
                                 filter === 'did_not_push_through' ? 'Did Not Push Through' : 
                                 filter.charAt(0).toUpperCase() + filter.slice(1)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>

                {/* Filtered Rewards */}
                {(() => {
                  const filteredRewards = userRewardRequests.filter((req: any) => {
                    if (rewardStatusFilter === 'all') return true;
                    if (rewardStatusFilter === 'pending') return req.status === 'pending';
                    if (rewardStatusFilter === 'approved') return req.status === 'approved' || req.status === 'ready_for_pickup';
                    if (rewardStatusFilter === 'claimed') return req.status === 'claimed';
                    if (rewardStatusFilter === 'did_not_push_through') {
                      // Reward that was approved but expired before being claimed
                      const isApproved = req.status === 'approved' || req.status === 'ready_for_pickup';
                      const isNotClaimed = req.status !== 'claimed';
                      const hasExpired = req.expires_at && new Date(req.expires_at) < new Date();
                      return isApproved && isNotClaimed && hasExpired;
                    }
                    return true;
                  });

                  if (filteredRewards.length === 0) {
                    return (
                      <div style={{ textAlign: 'center', padding: '40px' }}>
                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔍</div>
                        <div style={{ fontSize: '16px', color: '#666' }}>No rewards found for this filter</div>
                      </div>
                    );
                  }

                  // Check if any reward can be claimed (to show Expires column)
                  const hasClaimableRewards = filteredRewards.some((req: any) => {
                    const isApproved = req.status === 'approved' || req.status === 'ready_for_pickup';
                    const isClaimed = req.status === 'claimed';
                    return isApproved && !isClaimed;
                  });

                  // Table View
                  return (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                            <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Reward</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Type</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Status</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Cost</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Requested</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Approved</th>
                            {hasClaimableRewards && (
                              <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Expires</th>
                            )}
                            <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRewards.map((req: any) => {
                  const isApproved = req.status === 'approved' || req.status === 'ready_for_pickup';
                  const isClaimed = req.status === 'claimed';
                  const isPending = req.status === 'pending';
                            const hasExpired = req.expires_at && new Date(req.expires_at) < new Date();
                            const didNotPushThrough = isApproved && !isClaimed && hasExpired;
                            const isMerchandise = req.reward_type?.toLowerCase().includes('merchandise') || 
                                                 req.reward_type?.toLowerCase().includes('merch') ||
                                                 req.reward_type?.toLowerCase().includes('product') ||
                                                 req.reward_type?.toLowerCase().includes('item');
                            // Only vouchers can be claimed by user, merchandise must be released by admin
                            const canClaim = isApproved && !isClaimed && !isMerchandise;

                  return (
                              <tr 
                      key={req.request_id}
                      style={{
                                  borderBottom: '1px solid #f1f5f9',
                                  cursor: 'pointer',
                                  transition: 'background-color 0.2s',
                                  backgroundColor: didNotPushThrough ? '#fef2f2' : 'transparent'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = didNotPushThrough ? '#fee2e2' : '#f8fafc';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = didNotPushThrough ? '#fef2f2' : 'transparent';
                                }}
                              >
                                <td style={{ padding: '12px', fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>
                                  {req.reward_name}
                                </td>
                                <td style={{ padding: '12px', color: '#64748b', fontSize: '13px' }}>
                                  {req.reward_type}
                                </td>
                                <td style={{ padding: '12px' }}>
                                  <span style={{
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    background: didNotPushThrough ? '#fee2e2' : isPending ? '#fef9c3' : isApproved ? '#fee2e2' : isClaimed ? '#dbeafe' : '#f3f4f6',
                                    color: didNotPushThrough ? '#991b1b' : isPending ? '#a16207' : isApproved ? '#991b1b' : isClaimed ? '#1e40af' : '#374151'
                                  }}>
                                    {didNotPushThrough ? 'Expired' :
                                     req.status === 'pending' ? 'Pending' : 
                                     req.status === 'approved' ? 'Ready' :
                                     req.status === 'ready_for_pickup' ? 'Ready' :
                                     req.status === 'claimed' ? 'Claimed' : req.status}
                                  </span>
                                </td>
                                <td style={{ padding: '12px', color: '#667eea', fontWeight: '600', fontSize: '13px' }}>
                                  {req.points_cost} pts
                                </td>
                                <td style={{ padding: '12px', color: '#64748b', fontSize: '13px' }}>
                                  {req.requested_at ? new Date(req.requested_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  }) : '-'}
                                </td>
                                <td style={{ padding: '12px', color: '#64748b', fontSize: '13px' }}>
                                  {req.approved_at ? new Date(req.approved_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  }) : '-'}
                                </td>
                                {hasClaimableRewards && (
                                  <td style={{ padding: '12px', color: canClaim ? (hasExpired ? '#dc2626' : '#64748b') : '#64748b', fontSize: '13px', fontWeight: canClaim && hasExpired ? '600' : '400' }}>
                                    {canClaim && req.expires_at ? new Date(req.expires_at).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric'
                                    }) : '-'}
                                  </td>
                                )}
                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                  <button
                                    onClick={() => setSelectedRewardDetail(req)}
                                    style={{
                                      padding: '6px 12px',
                                      borderRadius: '6px',
                                      border: '1px solid #667eea',
                                      background: 'white',
                                      color: '#667eea',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = '#667eea';
                                      e.currentTarget.style.color = 'white';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'white';
                                      e.currentTarget.style.color = '#667eea';
                                    }}
                                  >
                                    <HiOutlineEye size={14} />
                                    View
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}

      {/* Reward Detail Modal */}
      {selectedRewardDetail && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
            padding: '20px'
          }}
          onClick={() => setSelectedRewardDetail(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '20px',
              padding: '24px',
              maxWidth: '520px',
              width: '100%',
              maxHeight: '85vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Render the same detailed card view for selectedRewardDetail */}
            {(() => {
              const req = selectedRewardDetail;
              const isApproved = req.status === 'approved' || req.status === 'ready_for_pickup';
              const isClaimed = req.status === 'claimed';
              const isPending = req.status === 'pending';
              const isMerchandise = req.reward_type?.toLowerCase().includes('merchandise') || 
                                   req.reward_type?.toLowerCase().includes('merch') ||
                                   req.reward_type?.toLowerCase().includes('product') ||
                                   req.reward_type?.toLowerCase().includes('item');
              // Only vouchers can be claimed by user, merchandise must be released by admin
              const canClaim = isApproved && !isClaimed && !isMerchandise;
              const isClaiming = claimingReward === req.request_id;

                  return (
                <>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#1e3a5f', marginBottom: '4px' }}>
                        Reward Details
                      </h2>
                      <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: '#174f84', lineHeight: '1.2' }}>
                        {req.reward_name}
                      </h3>
                    </div>
                    <button
                      onClick={() => setSelectedRewardDetail(null)}
                      style={{
                        background: '#f5f7fa',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#666',
                        padding: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '8px',
                        transition: 'all 0.2s',
                        width: '36px',
                        height: '36px',
                        flexShrink: 0
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#e0e0e0';
                        e.currentTarget.style.color = '#333';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#f5f7fa';
                        e.currentTarget.style.color = '#666';
                      }}
                    >
                      <HiOutlineXMark size={20} />
                    </button>
                  </div>

                  {/* Key Info Cards */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
                    gap: '12px',
                    marginBottom: '20px'
                  }}>
                    <div style={{ 
                      padding: '14px', 
                      background: 'linear-gradient(135deg, #e8f0f8 0%, #d0e1f0 100%)',
                      borderRadius: '10px',
                      border: '1px solid #a8c5e0'
                    }}>
                      <div style={{ fontSize: '11px', color: '#666', fontWeight: '500', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Type
                      </div>
                      <div style={{ fontSize: '14px', color: '#174f84', fontWeight: '600' }}>
                        {req.reward_type}
                      </div>
                    </div>
                    
                    <div style={{ 
                      padding: '14px', 
                      background: 'linear-gradient(135deg, #e0ecf5 0%, #c8ddeb 100%)',
                      borderRadius: '10px',
                      border: '1px solid #9bb8d6'
                    }}>
                      <div style={{ fontSize: '11px', color: '#666', fontWeight: '500', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Cost
                      </div>
                      <div style={{ fontSize: '14px', color: '#174f84', fontWeight: '600' }}>
                        {req.points_cost} pts
                      </div>
                      <div style={{ fontSize: '11px', color: '#1e3a5f', marginTop: '2px' }}>
                        ({req.reward_value})
                      </div>
                    </div>
                    
                    <div style={{ 
                      padding: '14px', 
                      background: isPending ? 'linear-gradient(135deg, #d8e6f2 0%, #c0d9ea 100%)' : 
                                  isApproved ? 'linear-gradient(135deg, #c8ddeb 0%, #b0d0e2 100%)' : 
                                  isClaimed ? 'linear-gradient(135deg, #e8f0f8 0%, #d0e1f0 100%)' : 
                                  'linear-gradient(135deg, #e0ecf5 0%, #d0e1f0 100%)',
                      borderRadius: '10px',
                      border: `1px solid ${isPending ? '#8fb3d1' : isApproved ? '#7aa3c4' : isClaimed ? '#a8c5e0' : '#9bb8d6'}`
                    }}>
                      <div style={{ fontSize: '11px', color: '#666', fontWeight: '500', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Status
                      </div>
                      <div style={{ 
                        fontSize: '14px', 
                        color: isPending ? '#1e3a5f' : isApproved ? '#174f84' : isClaimed ? '#174f84' : '#666',
                        fontWeight: '600'
                      }}>
                        {req.status === 'pending' ? 'Pending Approval' : 
                         req.status === 'approved' ? 'Approved - Ready' :
                         req.status === 'ready_for_pickup' ? 'Ready for Pickup' :
                         req.status === 'claimed' ? 'Claimed' : req.status}
                      </div>
                    </div>
                  </div>

                  {/* Dates */}
                  {(req.requested_at || req.approved_at || req.expires_at) && (
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
                      gap: '12px',
                      marginBottom: '20px'
                    }}>
                      {req.requested_at && (
                        <div style={{ padding: '12px', background: 'linear-gradient(135deg, #e8f0f8 0%, #d8e6f2 100%)', borderRadius: '8px', border: '1px solid #a8c5e0' }}>
                          <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px', fontWeight: '500' }}>Requested</div>
                          <div style={{ fontSize: '13px', color: '#174f84', fontWeight: '500' }}>
                            {new Date(req.requested_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </div>
                        </div>
                      )}
                      {req.approved_at && (
                        <div style={{ padding: '12px', background: 'linear-gradient(135deg, #d0e1f0 0%, #c0d9ea 100%)', borderRadius: '8px', border: '1px solid #9bb8d6' }}>
                          <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px', fontWeight: '500' }}>Approved</div>
                          <div style={{ fontSize: '13px', color: '#174f84', fontWeight: '500' }}>
                            {new Date(req.approved_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </div>
                        </div>
                      )}
                      {req.expires_at && (
                        <div style={{ padding: '12px', background: 'linear-gradient(135deg, #e0ecf5 0%, #d0e1f0 100%)', borderRadius: '8px', border: '1px solid #a8c5e0' }}>
                          <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px', fontWeight: '500' }}>Expires</div>
                          <div style={{ fontSize: '13px', color: '#1e3a5f', fontWeight: '500' }}>
                            {new Date(req.expires_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                      {/* Instructions Section */}
                      {req.notes && (
                        <div style={{ 
                          marginBottom: '20px',
                          padding: '16px', 
                          background: 'linear-gradient(135deg, #e8f0f8 0%, #d0e1f0 100%)',
                          borderRadius: '12px',
                          border: '1px solid #a8c5e0'
                        }}>
                          <div style={{ 
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px'
                          }}>
                            <HiOutlineInformationCircle size={18} color="#174f84" style={{ marginTop: '2px', flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: '600', color: '#1e3a5f', fontSize: '13px', marginBottom: '8px' }}>
                                Instructions
                              </div>
                              <div style={{ lineHeight: '1.6', color: '#174f84', fontSize: '13px' }}>
                                {req.notes}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Voucher Code Section */}
                      {req.voucher_code && (
                        <div style={{ 
                          marginBottom: '20px',
                          padding: '16px', 
                          background: 'linear-gradient(135deg, #e0ecf5 0%, #c8ddeb 100%)',
                          borderRadius: '12px',
                          border: '1px solid #9bb8d6'
                        }}>
                          <div style={{ 
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '12px'
                          }}>
                            <HiOutlineTicket size={18} color="#174f84" />
                            <span style={{ fontWeight: '600', color: '#1e3a5f', fontSize: '13px' }}>
                              Voucher Code
                            </span>
                          </div>
                          <div style={{ 
                            fontSize: '24px',
                            fontWeight: '700',
                            color: '#174f84',
                            fontFamily: '"SF Mono", "Monaco", "Inconsolata", "Roboto Mono", monospace',
                            letterSpacing: '2px',
                            padding: '14px 16px',
                            background: 'white',
                            borderRadius: '8px',
                            textAlign: 'center',
                            border: '2px solid #174f84',
                            boxShadow: '0 2px 4px rgba(23, 79, 132, 0.2)'
                          }}>
                            {req.voucher_code}
                          </div>
                          <div style={{ fontSize: '11px', color: '#1e3a5f', textAlign: 'center', marginTop: '10px', fontWeight: '500' }}>
                            Save this code for redemption
                          </div>
                        </div>
                      )}
                      
                      {canClaim && (
                        <button
                          onClick={() => handleClaimApprovedReward(req.request_id)}
                          disabled={isClaiming}
                          style={{
                            width: '100%',
                            padding: '14px 20px',
                            borderRadius: '10px',
                            border: 'none',
                            background: 'linear-gradient(135deg, #174f84 0%, #1e3a5f 100%)',
                            color: 'white',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: isClaiming ? 'not-allowed' : 'pointer',
                            opacity: isClaiming ? 0.6 : 1,
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 6px rgba(23, 79, 132, 0.3)'
                          }}
                          onMouseEnter={(e) => {
                            if (!isClaiming) {
                              e.currentTarget.style.background = 'linear-gradient(135deg, #1e3a5f 0%, #15304a 100%)';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 6px 12px rgba(23, 79, 132, 0.4)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isClaiming) {
                              e.currentTarget.style.background = 'linear-gradient(135deg, #174f84 0%, #1e3a5f 100%)';
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 4px 6px rgba(23, 79, 132, 0.3)';
                            }
                          }}
                        >
                          {isClaiming ? (
                            'Claiming...'
                          ) : (
                            <>
                              <HiOutlineGift size={16} />
                              <span>Claim Reward</span>
                            </>
                          )}
                        </button>
                      )}
                </>
                  );
            })()}
          </div>
        </div>
      )}

      {/* Monthly Limit Modal */}
      {showMonthlyLimitModal && (
        <div
          style={{
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
            padding: '20px'
          }}
          onClick={() => setShowMonthlyLimitModal(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
              textAlign: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '24px', marginBottom: '16px' }}>⚠️</div>
            <h2 style={{ 
              margin: '0 0 16px 0', 
              fontSize: '20px', 
              fontWeight: '600', 
              color: '#1e3a5f' 
            }}>
              Monthly Limit Reached
            </h2>
            <p style={{ 
              margin: '0 0 24px 0', 
              fontSize: '15px', 
              color: '#6b7280',
              lineHeight: '1.6'
            }}>
              You can only request 1 reward per month. Please wait until next month to request another reward.
            </p>
            <button
              onClick={() => setShowMonthlyLimitModal(false)}
              style={{
                padding: '12px 32px',
                background: '#1e3a5f',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                width: '100%',
                maxWidth: '200px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#2d5a8f';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#1e3a5f';
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Confirm Request Reward Modal */}
      {showConfirmRequestModal && pendingRewardRequest && (
        <div
          style={{
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
            padding: '20px'
          }}
          onClick={() => {
            setShowConfirmRequestModal(false);
            setPendingRewardRequest(null);
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '24px',
              paddingBottom: '20px',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <h2 style={{ 
                margin: 0,
                fontSize: '20px', 
                fontWeight: '700', 
                color: '#1e3a5f',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <HiOutlineGift size={24} color="#1e3a5f" strokeWidth={1.5} />
                <span>Request Reward</span>
              </h2>
              <button
                onClick={() => {
                  setShowConfirmRequestModal(false);
                  setPendingRewardRequest(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '4px 8px',
                  lineHeight: '1',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#1f2937'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div>
              {(() => {
                // Extract points from value (e.g., "1 pt" or "10 pts" -> "1" or "10")
                const pointsMatch = pendingRewardRequest.value?.match(/(\d+)/);
                const pointsValue = pointsMatch ? parseInt(pointsMatch[1]) : 0;
                const pointsText = pointsValue === 1 ? 'point' : 'points';
                
                return (
                  <p style={{ 
                    margin: '0 0 20px 0', 
                    fontSize: '16px', 
                    color: '#374151',
                    lineHeight: '1.6'
                  }}>
                    You are about to redeem <strong style={{ color: '#1e3a5f', fontWeight: '600' }}>{pendingRewardRequest.name}</strong> as your reward for accumulating <strong style={{ color: '#1e3a5f', fontWeight: '600' }}>{pointsValue} {pointsText}</strong>.
                  </p>
                );
              })()}
              
              {/* CTU Claim Notice - Only show for merchandise */}
              {pendingRewardRequest.type && 
               pendingRewardRequest.type.toLowerCase().includes('merchandise') && (
                <div style={{
                  background: '#fef3c7',
                  border: '1px solid #fcd34d',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}>
                  <div style={{
                    fontSize: '18px',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}>
                    ⚠️
                  </div>
                  <p style={{
                    margin: 0,
                    fontSize: '14px',
                    color: '#92400e',
                    lineHeight: '1.6'
                  }}>
                    Please take note that this needs to be claimed in the CTU.
                  </p>
                </div>
              )}

              <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px'
              }}>
                <div style={{
                  fontSize: '16px',
                  flexShrink: 0,
                  marginTop: '2px',
                  color: '#1e40af'
                }}>
                  ℹ️
                </div>
                <p style={{
                  margin: 0,
                  fontSize: '13px',
                  color: '#1e40af',
                  lineHeight: '1.5'
                }}>
                  Note: You can only redeem 1 reward per month.
                </p>
              </div>

              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                justifyContent: 'flex-end',
                marginTop: '24px'
              }}>
                <button
                  onClick={() => {
                    setShowConfirmRequestModal(false);
                    setPendingRewardRequest(null);
                  }}
                  style={{
                    padding: '12px 24px',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#e5e7eb';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRequestReward}
                  disabled={claimingReward !== null}
                  style={{
                    padding: '12px 24px',
                    background: claimingReward !== null ? '#9ca3af' : '#1e3a5f',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: claimingReward !== null ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (claimingReward === null) {
                      e.currentTarget.style.backgroundColor = '#2d5a8f';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (claimingReward === null) {
                      e.currentTarget.style.backgroundColor = '#1e3a5f';
                    }
                  }}
                >
                  {claimingReward !== null ? 'Processing...' : 'Confirm Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlumniProfile;
