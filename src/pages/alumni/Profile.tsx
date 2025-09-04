import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AlumniTopBar from './AlumniTopBar';
import ctulogo from '../../images/ctulogo.png';
import './profile.css';
import { fetchFollowers, followUser, unfollowUser, checkFollowStatus } from '../../services/api';
import { getPosts, likePost, unlikePost, commentOnPost, repostPost } from '../../services/api';
import PostCreate from './PostCreate';

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
  likes?: any[];
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
  const [repostError, setRepostError] = useState<string | null>(null);
  const [showFollowersModal, setShowFollowersModal] = useState(false); // Add this for followers modal

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
        const res = await fetch(`http://127.0.0.1:8000/api/alumni/${userId}/`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        if (res.status === 401) {
          alert('Session expired or unauthorized. Please log in again.');
          navigate('/login');
          return;
        }
        if (res.ok) {
          const profile = await res.json();
          if (res.status === 401 || !profile || !profile.alumni) {
            alert('Profile not found.');
            navigate('/login');
            return;
          }
          setUser(profile.alumni);
          setEditBio(profile.alumni.profile_bio || '');
          
          // Update localStorage only if viewing own profile
          if (Number(userId) === Number(currentUserId)) {
            localStorage.setItem('user', JSON.stringify(profile.alumni));
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
  }, [id, navigate]);

  const [bioModalOpen, setBioModalOpen] = useState(false);
  const [bioInput, setBioInput] = useState('');
  const [bioLoading, setBioLoading] = useState(false);

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

  const handleLike = async (postId: number) => {
    try {
      await likePost(postId);
      setLikedPosts(prev => ({ ...prev, [postId]: true }));
      const updatedPosts: PostItem[] = await getPosts();
      const currentUserId = Number(id) || Number(JSON.parse(localStorage.getItem('user') || '{}').user_id || JSON.parse(localStorage.getItem('user') || '{}').id);
      const subset = (updatedPosts || []).filter((p: PostItem) => 
        p.user?.user_id === currentUserId || 
        (p.reposts && p.reposts.some((repost: any) => repost.user.user_id === currentUserId))
      );
      setPosts(subset);
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleUnlike = async (postId: number) => {
    try {
      await unlikePost(postId);
      setLikedPosts(prev => ({ ...prev, [postId]: false }));
      const updatedPosts: PostItem[] = await getPosts();
      const currentUserId = Number(id) || Number(JSON.parse(localStorage.getItem('user') || '{}').user_id || JSON.parse(localStorage.getItem('user') || '{}').id);
      const subset = (updatedPosts || []).filter((p: PostItem) => 
        p.user?.user_id === currentUserId || 
        (p.reposts && p.reposts.some((repost: any) => repost.user.user_id === currentUserId))
      );
      setPosts(subset);
    } catch (error) {
      console.error('Error unliking post:', error);
    }
  };

  const handleCommentSubmit = async (postId: number) => {
    if (!commentInput[postId]) return;
    try {
      const result = await commentOnPost(postId, commentInput[postId]);
      if (result.success) {
        setCommentInput(prev => ({ ...prev, [postId]: '' }));
        const updatedPosts: PostItem[] = await getPosts();
        const currentUserId = Number(id) || Number(JSON.parse(localStorage.getItem('user') || '{}').user_id || JSON.parse(localStorage.getItem('user') || '{}').id);
        const subset = (updatedPosts || []).filter((p: PostItem) => 
          p.user?.user_id === currentUserId || 
          (p.reposts && p.reposts.some((repost: any) => repost.user.user_id === currentUserId))
        );
        setPosts(subset);
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
    }
  };

  const handleRepost = async (postId: number) => {
    setRepostError(null);
    try {
      await repostPost(postId);
      setRepostedPosts(prev => ({ ...prev, [postId]: true }));
      const updatedPosts: PostItem[] = await getPosts();
      const currentUserId = Number(id) || Number(JSON.parse(localStorage.getItem('user') || '{}').user_id || JSON.parse(localStorage.getItem('user') || '{}').id);
      const subset = (updatedPosts || []).filter((p: PostItem) => 
        p.user?.user_id === currentUserId || 
        (p.reposts && p.reposts.some((repost: any) => repost.user.user_id === currentUserId))
      );
      setPosts(subset);
    } catch (error: any) {
      setRepostError(error?.response?.data?.error || error?.message || 'Failed to repost');
    }
  };

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const userObj = JSON.parse(userStr);
      setUser(userObj);
      setBioInput(userObj.profile_bio || '');

      // Fetch latest profile from backend with proper error handling
      const userId = userObj.user_id || userObj.id;
      const token = localStorage.getItem('accessToken');
      fetch(`http://127.0.0.1:8000/api/alumni/${userId}/`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })
        .then(async (res) => {
          if (res.status === 401) {
            navigate('/login');
            return null;
          }
          const profile = await res.json();
          if (!profile || !profile.alumni) {
            navigate('/login');
            return null;
          }
          return profile;
        })
        .then((profile) => {
          if (!profile || !profile.alumni) return;
          setUser(profile.alumni);
          setBioInput(profile.alumni.profile_bio || '');
          localStorage.setItem('user', JSON.stringify(profile.alumni));
        });
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const handleEditProfile = () => {
    setEditProfilePic(user?.profile_pic);
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
          </div>

          {/* Followers */}
          <div className="profile-followers-card">
            <div className="profile-followers-header">
              <div className="profile-followers-title">Followers</div>
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
            <div className="profile-followers-list">
              {followers.length === 0 ? (
                <div>No followers yet.</div>
              ) : (
                <>
                  {/* Render followers in rows of 3 */}
                  {Array.from({ length: Math.ceil(followers.length / 3) }).map((_, rowIndex) => (
                    <div key={`row-${rowIndex}`} className="profile-followers-row">
                      {followers.slice(rowIndex * 3, rowIndex * 3 + 3).map((follower) => (
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
              <div className="profile-name">{user?.name || 'Loading...'}</div>
              <div className="profile-university">{user?.course || 'Loading...'}</div>
              <div className="profile-other-actions-below-university">
                {!isOwnProfile && (
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
          {posts.map((post) => {
            const repostInfo = post.reposts && post.reposts.length > 0 ? post.reposts[0] : null;
            const repostedBy = repostInfo ? `${repostInfo.user.f_name} ${repostInfo.user.l_name}` : null;
            const isOwn = currentId && post.user?.user_id && Number(post.user.user_id) === Number(currentId);
            const displayName = isOwn && user?.name ? user.name : `${post.user?.f_name || ''} ${post.user?.l_name || ''}`.trim();
            const postUserAvatar = post.user?.profile_pic ? (String(post.user.profile_pic).startsWith('http') ? post.user.profile_pic : `http://127.0.0.1:8000${post.user.profile_pic}`) : undefined;
            const displayAvatar = isOwn && user?.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : (postUserAvatar || ctulogo);

            // If repostInfo exists, show repost card
            if (repostInfo) {
              const reposterAvatar = repostInfo.user.profile_pic
                ? (String(repostInfo.user.profile_pic).startsWith('http')
                  ? repostInfo.user.profile_pic
                  : `http://127.0.0.1:8000${repostInfo.user.profile_pic}`)
                : ctulogo;
              const reposterName = `${repostInfo.user.f_name} ${repostInfo.user.l_name}`;
              return (
                <div key={post.post_id + '_repost'} className="post-feed-card" style={{ background: '#f5f6fa', border: '1px solid #dedede', marginBottom: 24, borderRadius: 12, padding: 0 }}>
                  {/* Reposter info */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '16px 16px 0 16px', gap: 12 }}>
                    <img
                      src={reposterAvatar}
                      alt="Reposter"
                      style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid #23272a' }}
                      onError={e => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.src = ctulogo as unknown as string;
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 17 }}>{reposterName}</div>
                      <div style={{ fontSize: 13, color: '#888' }}>{formatTimeAgo(repostInfo.repost_date)}</div>
                      <div style={{ fontSize: 13, color: '#b0b3b8', marginTop: 2 }}>reposted</div>
                    </div>
                  </div>
                  {/* Inner card: original post */}
                  <div style={{ margin: 16, background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: 0 }}>
                    <div className="post-header" style={{ padding: '16px 16px 0 16px' }}>
                      <div className="post-header-left">
                        <img 
                          src={displayAvatar} 
                          alt="Profile" 
                          className="post-header-profile-image"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.onerror = null;
                            target.src = ctulogo as unknown as string;
                          }}
                        />
                        <div>
                          <div className="post-author-info">{displayName || 'User'}</div>
                          <div className="post-author-details" style={{ color: '#666', fontSize: '12px' }}>
                            <span>{formatTimeAgo(post.created_at) || 'Unknown time'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="post-content" style={{ padding: '0 16px 8px 16px' }}>{post.post_content}</div>
                    {post.post_image && (
                      <div style={{ marginTop: 8, padding: '0 16px 16px 16px' }}>
                        <img 
                          src={
                            post.post_image.startsWith('/media/')
                              ? `http://127.0.0.1:8000${post.post_image}`
                              : post.post_image
                          }
                          alt="post" 
                          style={{ maxWidth: '100%', borderRadius: 8, maxHeight: '400px', objectFit: 'cover' }}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            console.error('Failed to load post image:', post.post_image);
                          }}
                        />
                      </div>
                    )}
                    {/* Repost actions (like, comment, repost) */}
                    <div className="post-actions" style={{ display: 'flex', gap: 16, marginTop: 8, padding: '0 16px 16px 16px' }}>
                      <button
                        onClick={() => likedPosts[post.post_id] ? handleUnlike(post.post_id) : handleLike(post.post_id)}
                        className="post-action-item"
                        style={{
                          color: likedPosts[post.post_id] ? '#e0245e' : '#555',
                          fontWeight: likedPosts[post.post_id] ? 'bold' : 'normal',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        {likedPosts[post.post_id] ? '❤️' : '🤍'} Like
                      </button>
                      <button
                        onClick={() => setShowCommentInput(prev => ({ ...prev, [post.post_id]: !prev[post.post_id] }))}
                        className="post-action-item"
                      >
                        💬 Comment
                      </button>
                      <button
                        onClick={() => handleRepost(post.post_id)}
                        className="post-action-item"
                        disabled={repostedPosts[post.post_id]}
                        style={{
                          color: repostedPosts[post.post_id] ? '#007bff' : '#555',
                          fontWeight: repostedPosts[post.post_id] ? 'bold' : 'normal',
                          background: 'none',
                          border: 'none',
                          cursor: repostedPosts[post.post_id] ? 'not-allowed' : 'pointer'
                        }}
                      >
                        🔄 Repost
                      </button>
                    </div>
                    {/* Show error message if repost failed */}
                    {repostError && (
                      <div style={{ color: 'red', fontSize: '12px', marginTop: '4px' }}>
                        {repostError}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // Normal post card (not a repost)
            return (
              <div key={post.post_id} className="post-feed-card">
                <div className="post-header">
                  <div className="post-header-left">
                    <img 
                      src={displayAvatar} 
                      alt="Profile" 
                      className="post-header-profile-image"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.src = ctulogo as unknown as string;
                      }}
                    />
                    <div>
                      <div className="post-author-info">{displayName || 'User'}</div>
                      <div className="post-author-details" style={{ color: '#666', fontSize: '12px' }}>
                        <span>{formatTimeAgo(post.created_at) || 'Unknown time'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="post-content">{post.post_content}</div>
                {post.post_image && (
                  <div style={{ marginTop: 8 }}>
                    <img 
                      src={
                        post.post_image.startsWith('/media/')
                          ? `http://127.0.0.1:8000${post.post_image}`
                          : post.post_image
                      }
                      alt="post" 
                      style={{ maxWidth: '100%', borderRadius: 8, maxHeight: '400px', objectFit: 'cover' }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        console.error('Failed to load post image:', post.post_image);
                      }}
                    />
                  </div>
                )}
                <div className="post-actions" style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                  <button
                    onClick={() => likedPosts[post.post_id] ? handleUnlike(post.post_id) : handleLike(post.post_id)}
                    className="post-action-item"
                    style={{
                      color: likedPosts[post.post_id] ? '#e0245e' : '#555',
                      fontWeight: likedPosts[post.post_id] ? 'bold' : 'normal',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {likedPosts[post.post_id] ? '❤️' : '🤍'} Like
                  </button>
                  <button onClick={() => setShowCommentInput(prev => ({ ...prev, [post.post_id]: !prev[post.post_id] }))} className="post-action-item">💬 Comment</button>
                  <button
                    onClick={() => handleRepost(post.post_id)}
                    className="post-action-item"
                    disabled={repostedPosts[post.post_id]}
                    style={{
                      color: repostedPosts[post.post_id] ? '#007bff' : '#555',
                      fontWeight: repostedPosts[post.post_id] ? 'bold' : 'normal',
                      background: 'none',
                      border: 'none',
                      cursor: repostedPosts[post.post_id] ? 'not-allowed' : 'pointer'
                    }}
                  >
                    🔄 Repost
                  </button>
                </div>
                {showCommentInput[post.post_id] && (
                  <div className="comment-input-container">
                    <input 
                        type="text" 
                        placeholder="Type your comment..." 
                        value={commentInput[post.post_id] || ''} 
                        onChange={(e) => setCommentInput(prev => ({ ...prev, [post.post_id]: e.target.value }))} 
                    />
                    <button onClick={() => handleCommentSubmit(post.post_id)}>➡️</button>
                  </div>
                )}
                
                {/* Display comments */}
                {post.comments && post.comments.length > 0 && (
                  <div className="comments-section" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #eee' }}>
                    {(showAllComments[post.post_id] ? post.comments : post.comments.slice(0, 2)).map((comment) => (
                      <div key={comment.comment_id} className="comment-item" style={{ display: 'flex', gap: '8px', marginBottom: '8px', padding: '8px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
                        <img 
                          src={comment.user.profile_pic ? (String(comment.user.profile_pic).startsWith('http') ? comment.user.profile_pic : `http://127.0.0.1:8000${comment.user.profile_pic}`) : ctulogo} 
                          alt="Profile" 
                          className="comment-profile-image"
                          style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.onerror = null;
                            target.src = ctulogo as unknown as string;
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#333' }}>
                            {comment.user.f_name} {comment.user.l_name}
                          </div>
                          <div style={{ fontSize: '14px', color: '#555' }}>
                            {comment.comment_content}
                          </div>
                          <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                            {formatTimeAgo(comment.date_created)}
                          </div>
                        </div>
                      </div>
                    ))}
                    {post.comments.length > 2 && !showAllComments[post.post_id] && (
                      <button
                        className="view-all-comments-btn"
                        style={{ fontSize: '12px', color: '#007bff', background: 'none', border: 'none', cursor: 'pointer', marginTop: '4px' }}
                        onClick={() => setShowAllComments(prev => ({ ...prev, [post.post_id]: true }))}
                      >
                        View all comments ({post.comments.length})
                      </button>
                    )}
                    {post.comments.length > 2 && showAllComments[post.post_id] && (
                      <button
                        className="hide-comments-btn"
                        style={{ fontSize: '12px', color: '#007bff', background: 'none', border: 'none', cursor: 'pointer', marginTop: '4px' }}
                        onClick={() => setShowAllComments(prev => ({ ...prev, [post.post_id]: false }))}
                      >
                        Hide comments
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bio Modal */}
        {bioModalOpen && (
          <div className="profile-bio-modal-overlay">
            <div className="profile-bio-modal-content">
              <h3 className="profile-bio-modal-title">Add Bio</h3>
              <textarea
                value={bioInput}
                onChange={(e) => setBioInput(e.target.value)}
                rows={4}
                className="profile-bio-textarea"
                placeholder="Enter your bio..."
              />
              <div className="profile-bio-modal-buttons">
                <button
                  onClick={() => setBioModalOpen(false)}
                  className="profile-bio-cancel-btn"
                  disabled={bioLoading}
                >
                  Cancel
                </button>
                {user && user.profile_bio && user.profile_bio.trim() && (
                  <button
                    onClick={handleDeleteBio}
                    className="profile-bio-delete-btn"
                    disabled={bioLoading}
                  >
                    {bioLoading ? 'Deleting...' : 'Delete Bio'}
                  </button>
                )}
                <button
                  onClick={handleSaveBio}
                  className="profile-bio-save-btn"
                  disabled={bioLoading}
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
        <div className="profile-edit-modal-overlay">
          <div className="profile-edit-modal-content">
            <button
              onClick={() => setEditModalOpen(false)}
              className="profile-edit-modal-close-btn"
              title="Close"
            >
              ×
            </button>
            <h2 className="profile-edit-modal-title">Edit Profile</h2>
            {/* Profile Pic */}
            <div className="profile-edit-pic-section" style={{ marginBottom: 16 }}>
              <label className="profile-edit-pic-label">Profile Picture</label>
              <br />
              <img
                src={editProfilePic || ctulogo}
                alt="Profile Preview"
                className="profile-edit-pic-preview"
              />
              <div className="profile-edit-pic-controls">
                <input type="file" accept="image/*" onChange={handleProfilePicChange} />
                <button onClick={handleRemoveProfilePic} className="profile-edit-pic-remove-btn">
                  Remove
                </button>
              </div>
            </div>

            {/* Resume (PDF) - Feature coming soon */}
            <div className="profile-edit-modal-buttons">
              <button
                onClick={() => setEditModalOpen(false)}
                className="profile-edit-modal-cancel-btn"
              >
                Cancel
              </button>
              <button onClick={handleSave} className="profile-edit-modal-save-btn">
                Save
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
    </div>
  );
};

export default AlumniProfile;
