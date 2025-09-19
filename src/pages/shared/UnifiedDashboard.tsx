import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AlumniTopBar from '../alumni/AlumniTopBar';
import PostCreate from '../alumni/PostCreate';
import PostCard from '../../components/PostCard';
import ctulogo from '../../images/ctulogo.png';
import './UnifiedDashboard.css';
import { likePost, repostPost, unlikePost, deletePost, editPost, deleteRepost, editComment, deleteComment, getPosts, followUser, unfollowUser, checkFollowStatus, commentOnPost } from '../../services/api';
// axios removed; use backend API helpers instead where needed

interface UnifiedDashboardProps {
  userType: 'alumni' | 'peso' | 'admin' | 'ojt';
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
    account_type?: { admin?: boolean; peso?: boolean };
  };
  comments?: CommentItem[];
  reposts?: RepostItem[];
  likes?: { user_id: number }[];
  liked_by_user?: boolean;
}
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

const UnifiedDashboard: React.FC<UnifiedDashboardProps> = ({ userType }) => {
  // All state and logic from AlumniDashboard, but use userType for admin/peso logic
  const [user, setUser] = useState<AlumniUser | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const [followLoading, setFollowLoading] = useState<{ [key: number]: boolean }>({});
  const [showComposer, setShowComposer] = useState(false);
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
  const navigate = useNavigate();
  const mainContentRef = useRef<HTMLDivElement>(null);
  const [pesoId, setPesoId] = useState<number | null>(null);
  const [adminId, setAdminId] = useState<number | null>(null);

  const isAdmin = userType === 'admin';
  const isPeso = userType === 'peso';
  const isOjt = userType === 'ojt';

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
    // These legacy endpoints do not exist; default to null and use generic routes
    setPesoId(null);
    setAdminId(null);
  }, [navigate]);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      navigate('/login');
      return;
    }
    const userObj = JSON.parse(userStr);
    setUser(userObj);
    // Fetch posts from backend (backend already includes followed + PESO + admin)
    getPosts()
      .then((postsList) => {
        const fetchedPosts = postsList || [];
        setPosts(fetchedPosts);
        // ... (set likedPosts, repostedPosts, etc.)
      })
      .catch((error) => {
        console.error('Error fetching posts:', error);
        setPosts([]);
      });
  }, [navigate]);

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
      <div className="main-content" ref={mainContentRef}>
        {/* Left Sidebar */}
        <div className="left-sidebar">
          <div
            className="profile-card"
            onClick={() => {
              if (user && (user as any).account_type) {
                if ((user as any).account_type.peso && pesoId) {
                  navigate(`/peso/profile/${pesoId}`);
                } else if ((user as any).account_type.admin && adminId) {
                  navigate(`/ccict/profile/${adminId}`);
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
          {/* Quick Links: show based on userType */}
          {isOjt && (
            <div className="quick-links" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Link to={adminId ? `/ccict/profile/${adminId}` : '/ccict/profile'} className="quick-link-card" style={{ flex: 1, cursor: 'pointer', textDecoration: 'none' }}>
                  <div className="quick-link-orange-header"></div>
                  <div className="quick-link-content">
                    <div className="quick-link-icon ccict-icon">C</div>
                    <div className="quick-link-text">CCICT</div>
                  </div>
                </Link>
                <Link to={pesoId ? `/peso/profile/${pesoId}` : '/peso/profile'} className="quick-link-card" style={{ flex: 1, cursor: 'pointer', textDecoration: 'none' }}>
                  <div className="quick-link-orange-header"></div>
                  <div className="quick-link-content">
                    <div className="quick-link-icon peso-icon">✱</div>
                    <div className="quick-link-text">PESO</div>
                  </div>
                </Link>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="quick-link-card" style={{ flex: 1 }}>
                  <div className="quick-link-orange-header"></div>
                  <div className="quick-link-content">
                    <div className="quick-link-icon peso-icon">✱</div>
                    <div className="quick-link-text">DONATION</div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {userType === 'alumni' && (
            <div className="quick-links" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Link to={adminId ? `/ccict/profile/${adminId}` : '/ccict/profile'} className="quick-link-card" style={{ flex: 1, cursor: 'pointer', textDecoration: 'none' }}>
                  <div className="quick-link-orange-header"></div>
                  <div className="quick-link-content">
                    <div className="quick-link-icon ccict-icon">C</div>
                    <div className="quick-link-text">CCICT</div>
                  </div>
                </Link>
                <Link to={pesoId ? `/peso/profile/${pesoId}` : '/peso/profile'} className="quick-link-card" style={{ flex: 1, cursor: 'pointer', textDecoration: 'none' }}>
                  <div className="quick-link-orange-header"></div>
                  <div className="quick-link-content">
                    <div className="quick-link-icon peso-icon">✱</div>
                    <div className="quick-link-text">PESO</div>
                  </div>
                </Link>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
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
                <div className="quick-link-card" style={{ flex: 1 }}>
                  <div className="quick-link-orange-header"></div>
                  <div className="quick-link-content">
                    <div className="quick-link-icon peso-icon">✱</div>
                    <div className="quick-link-text">DONATION</div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* peso/admin: no quick links, just profile card */}
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
              onPosted={() => {
                getPosts().then(updatedPosts => setPosts(updatedPosts || []));
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
                  isCcict = !!post.user.account_type.admin;
                  isPeso = !!post.user.account_type.peso;
                }
                return isOwn || isFollowed || isCcict || isPeso;
              }).map(post => {
                const currentUserId = getCurrentUserId(user);
                const isOwn = currentUserId !== null && post.user?.user_id && Number(post.user.user_id) === Number(currentUserId);
                const displayName = isOwn && user?.name ? user.name : `${post.user?.f_name || ''} ${post.user?.l_name || ''}`.trim();
                const postUserAvatar = post.user?.profile_pic ? (String(post.user.profile_pic).startsWith('http') ? post.user.profile_pic : `http://127.0.0.1:8000${post.user.profile_pic}`) : undefined;
                const displayAvatar = isOwn && user?.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : (postUserAvatar || ctulogo);
                return (
                  <PostCard
                    key={post.post_id}
                    post={post}
                    currentUserId={currentUserId}
                    isOwn={!!isOwn}
                    displayName={displayName}
                    displayAvatar={displayAvatar}
                    formatTime={formatHybrid}
                    onPostUpdate={() => getPosts().then(updatedPosts => setPosts(updatedPosts || []))}
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
              })
            : posts.map(post => {
                const currentUserId = getCurrentUserId(user);
                const isOwn = currentUserId !== null && post.user?.user_id && Number(post.user.user_id) === Number(currentUserId);
                const displayName = isOwn && user?.name ? user.name : `${post.user?.f_name || ''} ${post.user?.l_name || ''}`.trim();
                const postUserAvatar = post.user?.profile_pic ? (String(post.user.profile_pic).startsWith('http') ? post.user.profile_pic : `http://127.0.0.1:8000${post.user.profile_pic}`) : undefined;
                const displayAvatar = isOwn && user?.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : (postUserAvatar || ctulogo);
                return (
                  <PostCard
                    key={post.post_id}
                    post={post}
                    currentUserId={currentUserId}
                    isOwn={!!isOwn}
                    displayName={displayName}
                    displayAvatar={displayAvatar}
                    formatTime={formatHybrid}
                    onPostUpdate={() => getPosts().then(updatedPosts => setPosts(updatedPosts || []))}
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
              })}
        </div>
        {/* Right Sidebar */}
        <div className="right-sidebar">
          <div className="people-you-may-know-card"> 
            <div className="people-you-may-know-title">People you may know</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {suggestedUsers.length > 0 ? (
                suggestedUsers.map((user) => (
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
    </div>
  );
};

export default UnifiedDashboard;
