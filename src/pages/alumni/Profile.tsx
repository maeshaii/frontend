  import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AlumniTopBar from './AlumniTopBar';
import ctulogo from '../../images/ctulogo.png';
import './profile.css';
import { fetchFollowers, followUser, unfollowUser, checkFollowStatus, api } from '../../services/api';
import { getPosts, likePost, unlikePost, commentOnPost, repostPost, editPost, deletePost, editComment, deleteComment } from '../../services/api';
import PostCreate from './PostCreate';
import PostCard from '../../components/PostCard';

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
  };
}

interface RepostItem {
  repost_id: number;
  repost_date: string;
  user: {
    user_id: number;
    f_name: string;
    l_name: string;
    profile_pic?: string;
  };
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
  const [followLoading, setFollowLoading] = useState(false);
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
            account_type: currentUserObj.account_type || {} // Use current user's account type
          };
          
          setUser(userData);
          setEditBio(profileData.profile_bio || '');
          
          
          // Update localStorage only if viewing own profile
          if (Number(userId) === Number(currentUserId)) {
            localStorage.setItem('user', JSON.stringify(userData));
          }
          
          const numericUserId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
          if (numericUserId !== undefined && numericUserId !== null && !isNaN(Number(numericUserId))) {
            // Followers list
            fetchFollowers(Number(numericUserId))
              .then((data) => {
                if (data.success && data.followers) {
                  setFollowers(data.followers);
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
    console.log('Profile posts fetched:', all);
    const subset = (all || []).filter(p => 
      p.user?.user_id === Number(numericUserId) || 
      (p.reposts && p.reposts.some((repost: any) => repost.user.user_id === Number(numericUserId)))
    );

    // Sort posts by most recent date considering repost_date for reposts and created_at for original posts
    subset.sort((a, b) => {
      const aDate = a.reposts && a.reposts.length > 0 ? new Date(a.reposts[0].repost_date) : new Date(a.created_at || 0);
      const bDate = b.reposts && b.reposts.length > 0 ? new Date(b.reposts[0].repost_date) : new Date(b.created_at || 0);
      return bDate.getTime() - aDate.getTime();
    });

    setPosts(subset);
    
    // Track liked posts for current user
    const liked: { [key: number]: boolean } = {};
    subset.forEach(post => {
      if (post.likes && Array.isArray(post.likes)) {
        liked[post.post_id] = post.likes.some((like: any) => like.user_id === currentId);
      } else if (post.liked_by_user !== undefined) {
        liked[post.post_id] = !!post.liked_by_user;
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
        alert('Network error: ' + error);
        navigate('/login');
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
    setFollowLoading(true);
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
      setFollowLoading(false);
    }
  };

  const handleUnfollow = async () => {
    if (!id) return;
    setFollowLoading(true);
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
      setFollowLoading(false);
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

  const onPosted = async () => {
    // Force refresh posts from backend with proper typing and delay
    try {
      // Small delay to ensure database write is complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const allPosts: PostItem[] = await getPosts();
      const currentUserId = Number(id) || Number(JSON.parse(localStorage.getItem('user') || '{}').user_id || JSON.parse(localStorage.getItem('user') || '{}').id);
      
      if (currentUserId) {
        const subset = (allPosts || []).filter((p: PostItem) => Number(p.user?.user_id) === currentUserId);
        console.log('Refreshed posts:', subset.length, 'posts for user', currentUserId);
        setPosts(subset);
        
        // Update likedPosts state
        const liked: { [key: number]: boolean } = {};
        subset.forEach(post => {
          if (post.likes && Array.isArray(post.likes)) {
            liked[post.post_id] = post.likes.some((like: any) => like.user_id === currentId);
          } else if (post.liked_by_user !== undefined) {
            liked[post.post_id] = !!post.liked_by_user;
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

  // Defensive render guard: if user is not loaded, show fallback and login button
  if (!user) {
    return (
      <div style={{ color: 'red', textAlign: 'center', marginTop: 40 }}>
        Unable to load profile. You may not be authorized or your session has expired.<br/>
        <button onClick={() => navigate('/login')} style={{ marginTop: 20, padding: '8px 16px', borderRadius: 6, background: '#174f84', color: '#fff', border: 'none', cursor: 'pointer' }}>Go to Login</button>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <AlumniTopBar
        showProfile={showProfile}
        setShowProfile={setShowProfile}
        handleLogout={handleLogout}
      />

      {/* Main Content */}
      <div className="profile-main-content">
        {/* Left Sidebar */}
        <div className="profile-left-sidebar">
          {/* Introduction */}
          <div className="profile-card">
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
            {user && !user.account_type?.admin && !user.account_type?.peso && !user.account_type?.ccict && (
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

          {/* Followers - Hide for admin and PESO accounts */}
          {!user?.account_type?.admin && 
           !user?.account_type?.peso && 
           !user?.account_type?.ccict &&
           !user?.name?.toLowerCase().includes('admin') &&
           !user?.name?.toLowerCase().includes('peso') && (
          <div className="profile-followers-card">
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
                              navigate(`/alumni/profile/${destId}`);
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
                          <div className="profile-follower-name">{follower.name}</div>
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
          {!user?.account_type?.admin && 
           !user?.account_type?.peso && 
           !user?.account_type?.ccict &&
           !user?.name?.toLowerCase().includes('admin') &&
           !user?.name?.toLowerCase().includes('peso') && (
          <div className="profile-followers-card">
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
                              navigate(`/alumni/profile/${destId}`);
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
                          <div className="profile-follower-name">{followedUser.name}</div>
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
                {!isOwnProfile && 
                 !user?.account_type?.admin && 
                 !user?.account_type?.peso && 
                 !user?.name?.toLowerCase().includes('admin') &&
                 !user?.name?.toLowerCase().includes('peso') && (
                  <button
                    className={`profile-follow-button ${isFollowing ? 'following' : ''}`}
                    onClick={isFollowing ? handleUnfollow : handleFollow}
                    disabled={followLoading}
                  >
                    {followLoading ? '...' : isFollowing ? 'Unfollow' : 'Follow'}
                  </button>
                )}  
                {!isOwnProfile && (
                  <button className="profile-message-button">Message</button>
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
              This user has not posted anything yet.
            </div>
          )}
          {posts.reduce((acc: any[], post) => {
            const isOwn = currentId && post.user?.user_id && Number(post.user.user_id) === Number(currentId);
            const displayName = isOwn && user?.name ? user.name : `${post.user?.f_name || ''} ${post.user?.l_name || ''}`.trim();
            const postUserAvatar = post.user?.profile_pic ? (String(post.user.profile_pic).startsWith('http') ? post.user.profile_pic : `http://127.0.0.1:8000${post.user.profile_pic}`) : undefined;
            const displayAvatar = isOwn && user?.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : (postUserAvatar || ctulogo);
            
            // Check if this post has reposts and render them
            if (post.reposts && post.reposts.length > 0) {
              const repostCards = post.reposts.map((repost: any) => (
                <PostCard
                  key={`repost-${repost.repost_id}`}
                  post={post}
                  currentUserId={currentId}
                  isOwn={false}
                  displayName={displayName}
                  displayAvatar={displayAvatar}
                  formatTime={formatTimeAgo}
                  isRepost={true}
                  repostData={repost}
                  onPostUpdate={onPosted}
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
              acc.push(...repostCards);
            }
            
            // Also render original post
            const originalPostCard = (
              <PostCard
                key={post.post_id}
                post={post}
                currentUserId={currentId}
                isOwn={!!isOwn}
                displayName={displayName}
                displayAvatar={displayAvatar}
                formatTime={formatTimeAgo}
                onPostUpdate={onPosted}
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

      {/* Followers Modal */}
      {showFollowersModal && (
        <div className="profile-followers-modal-overlay">
          <div className="profile-followers-modal-content">
            <div className="profile-followers-modal-header">
              <h3 className="profile-followers-modal-title">Followers</h3>
              <button
                onClick={() => setShowFollowersModal(false)}
                className="profile-followers-modal-close-btn"
                title="Close"
              >
                ×
              </button>
            </div>
            <div className="profile-followers-modal-list">
              {followers.length === 0 ? (
                <div className="profile-followers-modal-empty">No followers yet.</div>
              ) : (
                followers.map((follower) => (
                  <div
                    key={follower.user_id ?? follower.id}
                    className="profile-followers-modal-item"
                    onClick={() => {
                      const destId = follower.user_id ?? follower.id;
                      const me = JSON.parse(localStorage.getItem('user') || '{}');
                      const meId = me.user_id || me.id;
                      if (destId && Number(destId) !== Number(meId)) {
                        navigate(`/alumni/profile/${destId}`);
                        setShowFollowersModal(false);
                      }
                    }}
                  >
                    <img
                      src={follower.profile_pic ? (String(follower.profile_pic).startsWith('http') ? follower.profile_pic : `http://127.0.0.1:8000${follower.profile_pic}`) : ctulogo}
                      alt={follower.name}
                      className="profile-followers-modal-img"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.src = ctulogo as unknown as string;
                      }}
                    />
                    <div className="profile-followers-modal-info">
                      <div className="profile-followers-modal-name">{follower.name}</div>
                      <div className="profile-followers-modal-course">{follower.course || ''}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Following Modal */}
      {showFollowingModal && (
        <div className="profile-followers-modal-overlay">
          <div className="profile-followers-modal-content">
            <div className="profile-followers-modal-header">
              <h3 className="profile-followers-modal-title">Following</h3>
              <button
                onClick={() => setShowFollowingModal(false)}
                className="profile-followers-modal-close-btn"
                title="Close"
              >
                ×
              </button>
            </div>
            <div className="profile-followers-modal-list">
              {following.length === 0 ? (
                <div className="profile-followers-modal-empty">No following yet.</div>
              ) : (
                following.map((followedUser) => (
                  <div
                    key={followedUser.user_id ?? followedUser.id}
                    className="profile-followers-modal-item"
                    onClick={() => {
                      const destId = followedUser.user_id ?? followedUser.id;
                      const me = JSON.parse(localStorage.getItem('user') || '{}');
                      const meId = me.user_id || me.id;
                      if (destId && Number(destId) !== Number(meId)) {
                        navigate(`/alumni/profile/${destId}`);
                        setShowFollowingModal(false);
                      }
                    }}
                  >
                    <img
                      src={followedUser.profile_pic ? (String(followedUser.profile_pic).startsWith('http') ? followedUser.profile_pic : `http://127.0.0.1:8000${followedUser.profile_pic}`) : ctulogo}
                      alt={followedUser.name}
                      className="profile-followers-modal-img"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.src = ctulogo as unknown as string;
                      }}
                    />
                    <div className="profile-followers-modal-info">
                      <div className="profile-followers-modal-name">{followedUser.name}</div>
                      <div className="profile-followers-modal-course">{followedUser.course || ''}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Members Modal */}
      {showMembersModal && (
        <div className="profile-followers-modal-overlay">
          <div className="profile-followers-modal-content" style={{ maxWidth: '800px', width: '90%' }}>
            <div className="profile-followers-modal-header">
              <h3 className="profile-followers-modal-title">Members ({allMembers.length}) - Batch {user?.batch || 'Unknown'}</h3>
              <button
                onClick={() => setShowMembersModal(false)}
                className="profile-followers-modal-close-btn"
                title="Close"
              >
                ×
              </button>
            </div>
            <div className="profile-followers-modal-list" style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)', 
              gap: '16px',
              padding: '20px'
            }}>
              {allMembers.length === 0 ? (
                <div className="profile-followers-modal-empty" style={{ gridColumn: '1 / -1', textAlign: 'center' }}>
                  No members found.
                </div>
              ) : (
                allMembers.map((member) => (
                  <div
                    key={member.user_id ?? member.id}
                    className="profile-followers-modal-item"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '16px',
                      borderRadius: '12px',
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                      backgroundColor: 'rgba(255, 255, 255, 0.8)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      textAlign: 'center'
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
                      e.currentTarget.style.backgroundColor = 'rgba(255, 107, 53, 0.1)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <img
                      src={member.profile_pic ? (String(member.profile_pic).startsWith('http') ? member.profile_pic : `http://127.0.0.1:8000${member.profile_pic}`) : ctulogo}
                      alt={member.name}
                      style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        marginBottom: '12px',
                        border: '2px solid rgba(255, 255, 255, 0.9)',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                      }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.src = ctulogo as unknown as string;
                      }}
                    />
                    <div style={{ 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      color: '#2c2c2c',
                      wordBreak: 'break-word',
                      marginBottom: '4px'
                    }}>
                      {member.name || 'Unknown User'}
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#666',
                      wordBreak: 'break-word'
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
    </div>
  );
};

export default AlumniProfile;
