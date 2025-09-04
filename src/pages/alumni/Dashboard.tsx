import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchNotifications, followUser, unfollowUser, checkFollowStatus, getPosts, commentOnPost } from '../../services/api';
import AlumniTopBar from './AlumniTopBar';
import PostCreate from './PostCreate';
import ctulogo from '../../images/ctulogo.png';
import './dashboard.css';
import { likePost, repostPost, unlikePost } from '../../services/api';
import { api } from '../../services/api';
// 1) Grab the created time from ANY common key and normalize it to ISO
function getPostTimestamp(post: PostItem): string | null {
  const candidates: unknown[] = [
    (post as any).created_at,     // your DB column
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

// 2) Normalize numbers, Date objects, and a variety of string shapes to ISO
function normalizeToISO(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;

  // Date object
  if (raw instanceof Date && !isNaN(raw.valueOf())) {
    return raw.toISOString();
  }

  // Numeric epoch (seconds or ms)
  if (typeof raw === 'number') {
    const ms = raw > 1e12 ? raw : raw * 1000;
    return new Date(ms).toISOString();
  }

  if (typeof raw === 'string') {
    // Already ISO or parseable -> great
    let ms = Date.parse(raw);
    if (!Number.isNaN(ms)) return new Date(ms).toISOString();

    // "YYYY-MM-DD HH:mm:ss[.SSS][±HH[:MM]]"
    // keep existing offset if present
    const hasOffset = /[+\-]\d{2}:?\d{2}$/.test(raw);
    const withT = raw.replace(' ', 'T');
    ms = Date.parse(withT + (hasOffset ? '' : 'Z'));
    if (!Number.isNaN(ms)) return new Date(ms).toISOString();
  }

  return null;
}

// 3) Your hybrid display: within 24h -> "x ago"; otherwise -> "Mon DD, YYYY"
function formatHybrid(iso?: string | null): string {
  if (!iso) return 'Unknown time';
  const ms = Date.parse(iso);
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





interface AlumniUser {
  name: string;
  course?: string;
  year_graduated?: string | number;
  profile_pic?: string;
  location?: string;
  university?: string;
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
}

interface SuggestedUser {
  id: number;
  name: string;
  profile_pic: string;
  batch?: string | number;
  isFollowing?: boolean;
}

const AlumniDashboard: React.FC = () => {
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
  const [refreshSuggestedUsers, setRefreshSuggestedUsers] = useState(0); // Add this to trigger refresh
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleFollow = async (userId: number) => {
    // Guard: never allow following own account
    if ((currentId && Number(userId) === Number(currentId))) return;
    setFollowLoading((prev) => ({ ...prev, [userId]: true }));
    try {
      const result = await followUser(userId);
      if (result.success) {
        // Remove from suggestions immediately after following
        setSuggestedUsers((prev) => prev.filter((u) => u.id !== userId));
        // Don't trigger refresh here as it will fetch the user again
        // setRefreshSuggestedUsers(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error following user:', error);
    } finally {
      setFollowLoading((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleUnfollow = async (userId: number) => {
    setFollowLoading((prev) => ({ ...prev, [userId]: true }));
    try {
      const result = await unfollowUser(userId);
      if (result.success) {
        // Remove from suggestions if they were there, or update their status
        setSuggestedUsers((prev) => prev.filter((u) => u.id !== userId));
        // Don't trigger refresh here as it will fetch the user again
        // setRefreshSuggestedUsers(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error unfollowing user:', error);
    } finally {
      setFollowLoading((prev) => ({ ...prev, [userId]: false }));
    }
  };

  // Separate useEffect for fetching suggested users
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      navigate('/login');
      return;
    }
    const userObj = JSON.parse(userStr);
    setUser(userObj);

    // Use axios instance (adds Authorization header) instead of unauthenticated fetch
    api
      .get('users_list_view/', { params: { current_user_id: userObj.id } })
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
            .filter(user => Number(user.id) !== Number(userObj.id)) // Ensure self is not suggested
            .filter(user => Number(user.id) !== Number(userObj.user_id)); // Double check for user_id
          setSuggestedUsers(unfollowedUsers);
        }
      })
      .catch((error) => console.error('Error fetching users:', error));
  }, [navigate]); // Remove refreshSuggestedUsers dependency to prevent unnecessary refetches

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      navigate('/login');
      return;
    }
    const userObj = JSON.parse(userStr);
    setUser(userObj);

    // Fix: Ensure posts are properly fetched and displayed
    getPosts().then((list: any[]) => {
      console.log('Fetched posts:', list); // Log the fetched posts
      // Ensure posts are properly fetched and displayed
      setPosts(list || []);
        // Track liked posts for current user
        const currentUserId = currentUser?.user_id || currentUser?.id;
        const liked: { [key: number]: boolean } = {};
        (list || []).forEach(post => {
          if (post.likes && Array.isArray(post.likes)) {
            liked[post.post_id] = post.likes.some((like: any) => like.user_id === currentUserId);
          } else if (post.liked_by_user !== undefined) {
            liked[post.post_id] = !!post.liked_by_user;
          }
        });
        setLikedPosts(liked);

        // Track reposted posts for current user
        const reposted: { [key: number]: boolean } = {};
        (list || []).forEach(post => {
          if (post.reposts && Array.isArray(post.reposts)) {
            reposted[post.post_id] = post.reposts.some((repost: any) => repost.user.user_id === currentUserId);
          }
        });
        setRepostedPosts(reposted);
      })
      .catch((error) => {
        console.error('Error fetching posts:', error);
        setPosts([]);
      });
  }, [navigate]);

  const handlePosted = async () => {
    // Refresh posts from backend after a new post is created
    try {
      const updatedPosts = await getPosts();
      setPosts(updatedPosts || []);
    } catch (error) {
      console.error('Error refreshing posts:', error);
    }
    setShowComposer(false);
  };

  // Ensure to pass handlePosted to PostCreate

  const currentUserRaw = localStorage.getItem('user');
  const currentUser = currentUserRaw ? JSON.parse(currentUserRaw) : null;
  const currentId = currentUser?.user_id || currentUser?.id;

  const handleCommentSubmit = async (postId: number) => {
    if (!commentInput[postId]) return; // No comment to submit
    try {
        const result = await commentOnPost(postId, commentInput[postId]);
        if (result.success) {
            setCommentInput(prev => ({ ...prev, [postId]: '' })); // Clear input after submission
            
            // Refresh posts to show new comment
            const updatedPosts = await getPosts();
            setPosts(updatedPosts || []);
        }
    } catch (error) {
        console.error('Error submitting comment:', error);
    }
  };

  const handleLike = async (postId: number) => {
    try {
      await likePost(postId); // POST /api/posts/{postId}/like/
      setLikedPosts(prev => ({ ...prev, [postId]: true }));
      const updatedPosts = await getPosts();
      setPosts(updatedPosts || []);
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleUnlike = async (postId: number) => {
    try {
      await unlikePost(postId); // DELETE /api/posts/{postId}/like/
      setLikedPosts(prev => ({ ...prev, [postId]: false }));
      const updatedPosts = await getPosts();
      setPosts(updatedPosts || []);
    } catch (error) {
      console.error('Error unliking post:', error);
    }
  };
const [repostLoading, setRepostLoading] = useState<Record<number, boolean>>({});

const handleRepost = async (postId: number) => {
  setRepostError(null);
  setRepostLoading(prev => ({ ...prev, [postId]: true }));
  try {
    // Try to get the newly created repost feed item directly
    const created = await repostPost(postId); // <- should return the repost feed item

    if (created && created.post_id) {
      // Prepend new repost without touching the original
      setPosts(prev => {
        // Avoid duplicates if this repost is already present
        const already = prev.some(p =>
          (p.reposts && p.reposts[0]?.repost_id) === (created.reposts && created.reposts[0]?.repost_id)
        );
        return already ? prev : [created, ...prev];
      });
    } else {
      // Graceful fallback: re-fetch the list if API didn't return the item
      const updatedPosts = await getPosts();
      setPosts(updatedPosts || []);
    }

    // Disable the Repost button for the original post
    setRepostedPosts(prev => ({ ...prev, [postId]: true }));
  } catch (error: any) {
    setRepostError(error?.response?.data?.error || error?.message || 'Failed to repost');
  } finally {
    setRepostLoading(prev => ({ ...prev, [postId]: false }));
  }
};
// Flatten posts into a feed that contains BOTH:
// - the original post item
// - one item per repost (so originals never get replaced)
const feed = useMemo(() => {
  type FeedItem =
    | { type: 'original'; key: string; date: number; post: PostItem }
    | { type: 'repost'; key: string; date: number; post: PostItem; repost: RepostItem };

  const items: FeedItem[] = [];

  for (const p of posts) {
  const createdISO = getPostTimestamp(p);               // ✅
  items.push({
    type: 'original',
    key: `post-${p.post_id}`,
    date: createdISO ? Date.parse(createdISO) : 0,      // ✅
    post: p,
  });

    // Each repost becomes its own separate card
    if (Array.isArray(p.reposts)) {
      for (const r of p.reposts) {
        items.push({
          type: 'repost',
          key: `repost-${p.post_id}-${r.repost_id}`,
          date: r.repost_date ? new Date(r.repost_date).getTime() : 0,
          post: p,
          repost: r,
        });
      }
    }
  }

  // Sort by most recent activity (repost_date vs created_at)
  items.sort((a, b) => b.date - a.date);
  return items;
}, [posts]);

const [selectedPost, setSelectedPost] = useState<PostItem | null>(null);

  return (
    <div className="page-container">
      <AlumniTopBar
        showProfile={showProfile}
        setShowProfile={setShowProfile}
        handleLogout={handleLogout}
      />

      <div className="main-content">
        <div className="left-sidebar">
          <div className="profile-card" onClick={() => navigate('/alumni/profile')} onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}>
            <div className="orange-header-bar"></div>
            <div className="profile-content">
              <img src={user?.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : ctulogo} alt="Profile" className="profile-image" />
              <div className="profile-name">{user?.name }</div>
              <div className="profile-university">{user?.university}</div>
            </div>
          </div>

          <div className="quick-links">
            <div className="quick-link-card">
              <div className="quick-link-orange-header"></div>
              <div className="quick-link-content">
                <div className="quick-link-icon ccict-icon">C</div>
                <div className="quick-link-text">CCICT</div>
              </div>
            </div>
            <div className="quick-link-card">
              <div className="quick-link-orange-header"></div>
              <div className="quick-link-content">
                <div className="quick-link-icon peso-icon">✱</div>
                <div className="quick-link-text">PESO</div>
              </div>
            </div>
          </div>
        </div>

        <div className="center-content">
          <div className="post-start" onClick={() => setShowComposer(true)} style={{ cursor: 'pointer' }}>
            <div className="post-start-input-container">
              <img src={user?.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : ctulogo} alt="Profile" className="post-start-profile-image" />
              <input type="text" placeholder="Start a post" className="post-start-input" readOnly />
            </div>
          </div>
          {showComposer && (
            <PostCreate
              onPosted={handlePosted}
              onCancel={() => setShowComposer(false)}
              user={user ?? { name: '', profile_pic: undefined }}
            />
          )}
{feed.map(item => {
  if (item.type === 'repost') {
    const { post, repost } = item;
    const reposterAvatar = repost.user.profile_pic
      ? (String(repost.user.profile_pic).startsWith('http')
          ? repost.user.profile_pic
          : `http://127.0.0.1:8000${repost.user.profile_pic}`)
      : ctulogo;

    const reposterName = `${repost.user.f_name} ${repost.user.l_name}`;

    return (
      <div
        key={item.key}
        className="post-feed-card"
        style={{
          background: '#f5f6fa',
          border: '1px solid #dedede',
          marginBottom: 24,
          borderRadius: 12,
          padding: 0
        }}
      >
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
            <div style={{ fontSize: 13, color: '#888' }}>{formatHybrid(repost.repost_date)}</div>
            <div style={{ fontSize: 13, color: '#b0b3b8', marginTop: 2 }}>reposted</div>
          </div>
        </div>

        {/* Inner card: original author's name + content + image (CLICKABLE) */}
        <div
          onClick={() => setSelectedPost(post)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedPost(post); }}
          style={{
            margin: 16,
            background: '#fff',
            borderRadius: 10,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            padding: '16px',
            cursor: 'pointer'
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
            {post.user?.f_name} {post.user?.l_name}
          </div>

          <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
            {formatHybrid(getPostTimestamp(post))}
          </div>

          <div className="post-content" style={{ fontSize: 14, color: '#333' }}>
            {post.post_content}
          </div>

          {post.post_image && (
            <div style={{ marginTop: 10 }}>
              <img
                src={
                  typeof post.post_image === 'string' && post.post_image.startsWith('/media/')
                    ? `http://127.0.0.1:8000${post.post_image}`
                    : (post.post_image as string)
                }
                alt="post"
                style={{ width: '100%', borderRadius: 8, maxHeight: '400px', objectFit: 'cover' }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  console.error('Failed to load post image:', post.post_image);
                }}
              />
            </div>
          )}
        </div>


        {/* Actions attached to the repost */}
        {/* <div className="post-actions" style={{ display: 'flex', gap: 16, marginTop: 8, padding: '0 16px 16px 16px' }}>
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
        </div> */}

 
        {repostError && (
          <div style={{ color: 'red', fontSize: '12px', marginTop: '4px' }}>
            {repostError}
          </div>
        )}
      </div>
    );
  }

  // --- ORIGINAL POST CARD ---
  const post = item.post;
  const isOwn = currentId && post.user?.user_id && Number(post.user.user_id) === Number(currentId);
  const displayName = isOwn && user?.name ? user.name : `${post.user?.f_name || ''} ${post.user?.l_name || ''}`.trim();
  const postUserAvatar = post.user?.profile_pic ? (String(post.user.profile_pic).startsWith('http') ? post.user.profile_pic : `http://127.0.0.1:8000${post.user.profile_pic}`) : undefined;
  const displayAvatar = isOwn && user?.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : (postUserAvatar || ctulogo);
  const tsISO = getPostTimestamp(post);
 
  return (

    <div key={item.key} id={`post-${post.post_id}`} className="post-feed-card">
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
            <span>{formatHybrid(tsISO)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="post-content">{post.post_content}</div>

      {post.post_image && (
        <div style={{ marginTop: 8 }}>
          <img
            src={
              typeof post.post_image === 'string' && post.post_image.startsWith('/media/')
                ? `http://127.0.0.1:8000${post.post_image}`
                : (post.post_image as string)
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
                  {formatHybrid(comment.date_created)}
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
          {selectedPost && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
          onClick={() => setSelectedPost(null)}
        >
          <div
            className="modal-card"
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 20,
              width: "min(680px, 92vw)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Original post UI in modal */}
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>
              {selectedPost.user?.f_name} {selectedPost.user?.l_name}
            </div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
              {formatHybrid(getPostTimestamp(selectedPost))}
            </div>
            <div className="post-content" style={{ fontSize: 14, color: "#333" }}>
              {selectedPost.post_content}
            </div>
            {selectedPost.post_image && (
              <div style={{ marginTop: 10 }}>
                <img
                  src={
                    typeof selectedPost.post_image === "string" && selectedPost.post_image.startsWith("/media/")
                      ? `http://127.0.0.1:8000${selectedPost.post_image}`
                      : (selectedPost.post_image as string)
                  }
                  alt="post"
                  style={{ width: "100%", borderRadius: 8, maxHeight: "400px", objectFit: "cover" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            )}
            {selectedPost.comments && selectedPost.comments.length > 0 && (
              <div style={{ marginTop: 16 }}>
                {selectedPost.comments.map((comment) => (
                  <div
                    key={comment.comment_id}
                    style={{
                      display: "flex",
                      gap: "8px",
                      marginBottom: "8px",
                      padding: "8px",
                      backgroundColor: "#f9f9f9",
                      borderRadius: "8px",
                    }}
                  >
                    <img
                      src={
                        comment.user.profile_pic
                          ? (String(comment.user.profile_pic).startsWith("http")
                              ? comment.user.profile_pic
                              : `http://127.0.0.1:8000${comment.user.profile_pic}`)
                          : ctulogo
                      }
                      alt="Profile"
                      style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.src = ctulogo as unknown as string;
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: "bold", color: "#333" }}>
                        {comment.user.f_name} {comment.user.l_name}
                      </div>
                      <div style={{ fontSize: 14, color: "#555" }}>
                        {comment.comment_content}
                      </div>
                      <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                        {formatHybrid(comment.date_created)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                onClick={() => setSelectedPost(null)}
                style={{
                  background: "#007bff",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "8px 16px",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

        </div>

        <div className="right-sidebar">
          <div className="people-you-may-know-card">
            <div className="people-you-may-know-title">People you may know</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {suggestedUsers.length > 0 ? (
                suggestedUsers.map((user) => (
                  <div key={user.id} className="suggested-user-item" onClick={() => navigate(`/alumni/profile/${user.id}`)} style={{ cursor: 'pointer' }}>
                    <img src={user.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : ctulogo} alt={user.name} className="suggested-user-profile-image" />
                    <div className="suggested-user-name">{user.name} {user.batch ? `(${user.batch})` : ''}</div>
                    <button className="suggested-user-follow-button" onClick={(e) => { e.stopPropagation(); handleFollow(user.id); }} disabled={followLoading[user.id]}>
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

export default AlumniDashboard;
