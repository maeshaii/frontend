import React, { useEffect, useState, useRef } from 'react';
import { likeRepost, unlikeRepost, commentOnRepost, getRepostLikes, editRepost, deleteRepost, editPost, deletePost } from '../services/api';
import { getProfilePicUrl, handleProfilePicError } from '../utils/profilePicUtils';
import RepostButton from './RepostButton';

// Minimal, reusable types for the repost card
interface UserLite {
  user_id: number;
  f_name?: string;
  m_name?: string;
  l_name?: string;
  profile_pic?: string;
}

interface PostItemLite {
  post_id?: number; // original post id
  created_at?: string | null;
  post_content?: string;
  post_images?: Array<{ image_id: number; image_url: string; order: number }>;
  user?: UserLite;
}

interface CommentLite {
  comment_id: number;
  comment_content: string;
  date_created?: string;
  user: UserLite;
}

interface RepostLite {
  repost_id: number;
  repost_date: string;
  repost_caption?: string;
  user: UserLite;
  likes?: Array<{ user_id: number }>;
  likes_count?: number;
  comments?: CommentLite[];
  comments_count?: number;
  original_post?: PostItemLite;
}

type RepostContext = 'post' | 'forum' | 'donation';

interface RepostCardProps {
  repost: RepostLite;
  currentUserId: number | null;
  formatTime: (iso?: string | null) => string;
  onRefresh?: () => void;
  context?: RepostContext;
  showOptions?: { [key: string | number]: boolean };
  setShowOptions?: (fn: (prev: { [key: string | number]: boolean }) => { [key: string | number]: boolean }) => void;
  editingRepost?: { [key: string | number]: boolean };
  setEditingRepost?: (fn: (prev: { [key: string | number]: boolean }) => { [key: string | number]: boolean }) => void;
  editRepostContent?: { [key: string | number]: string };
  setEditRepostContent?: (fn: (prev: { [key: string | number]: string }) => { [key: string | number]: string }) => void;
}

const getSortedImages = (post?: PostItemLite) => {
  if (!post?.post_images || !Array.isArray(post.post_images)) return [] as Array<{ image_id: number; image_url: string; order: number }>;
  return [...post.post_images].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
};

const RepostCard: React.FC<RepostCardProps> = ({ 
  repost, 
  currentUserId, 
  formatTime, 
  onRefresh, 
  context = 'post',
  showOptions = {},
  setShowOptions,
  editingRepost = {},
  setEditingRepost,
  editRepostContent = {},
  setEditRepostContent
}) => {
  const reposterName = `${repost.user.f_name || ''} ${repost.user.m_name || ''} ${repost.user.l_name || ''}`.trim();
  const reposterAvatar = getProfilePicUrl(repost.user.profile_pic);

  const original = repost.original_post || {};
  const originalPosterName = `${original.user?.f_name || ''} ${original.user?.l_name || ''}`.trim();
  const originalPosterAvatar = getProfilePicUrl(original.user?.profile_pic);

  const [liked, setLiked] = useState<boolean>(!!repost.likes?.some(l => l.user_id === currentUserId));
  const [likesCount, setLikesCount] = useState<number>(repost.likes_count || repost.likes?.length || 0);

  // Sync like state when repost data changes (e.g., after refresh)
  useEffect(() => {
    const isLikedByCurrentUser = !!repost.likes?.some(l => l.user_id === currentUserId);
    setLiked(isLikedByCurrentUser);
    setLikesCount(repost.likes_count || repost.likes?.length || 0);
  }, [repost.likes, repost.likes_count, currentUserId]);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [likesLoading, setLikesLoading] = useState(false);
  const [fetchedLikes, setFetchedLikes] = useState<any[]>([]);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentValue, setCommentValue] = useState('');
  const optionsMenuRef = useRef<HTMLDivElement>(null);

  // Check if current user owns this repost
  const isOwn = repost.user.user_id === currentUserId;

  const handleLikeToggle = async () => {
    try {
      if (!currentUserId) return;
      if (liked) {
        setLiked(false);
        setLikesCount(c => Math.max(0, c - 1));
        await unlikeRepost(repost.repost_id);
      } else {
        setLiked(true);
        setLikesCount(c => c + 1);
        await likeRepost(repost.repost_id);
      }
      onRefresh?.();
    } catch (e) {
      // swallow
    }
  };

  const handleCommentSubmit = async () => {
    if (!commentValue.trim()) return;
    try {
      await commentOnRepost(repost.repost_id, commentValue.trim());
      setCommentValue('');
      setShowCommentInput(false);
      onRefresh?.();
    } catch (e) {
      // swallow
    }
  };

  const handleEditRepost = () => {
    if (!setEditRepostContent || !setEditingRepost) return;
    if (!isOwn) {
      alert('You can only edit your own reposts');
      return;
    }
    setEditRepostContent(prev => ({ ...prev, [repost.repost_id]: repost.repost_caption || '' }));
    setEditingRepost(prev => ({ ...prev, [repost.repost_id]: true }));
    setShowOptions?.(prev => ({ ...prev, [repost.repost_id]: false }));
  };

  const handleDeleteRepost = async () => {
    if (!isOwn) {
      alert('You can only delete your own reposts');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this repost?')) {
      try {
        await deleteRepost(repost.repost_id);
        onRefresh?.();
        alert('Repost deleted successfully');
      } catch (error) {
        console.error('Error deleting repost:', error);
        alert('Failed to delete repost');
      }
    }
    setShowOptions?.(prev => ({ ...prev, [repost.repost_id]: false }));
  };

  const handleSaveEditRepost = async () => {
    if (!setEditRepostContent || !setEditingRepost) return;
    const newContent = editRepostContent[repost.repost_id];
    
    if (!newContent?.trim()) {
      alert('Repost content cannot be empty');
      return;
    }

    try {
      await editRepost(repost.repost_id, { caption: newContent.trim() });
      setEditingRepost(prev => ({ ...prev, [repost.repost_id]: false }));
      setEditRepostContent(prev => ({ ...prev, [repost.repost_id]: '' }));
      onRefresh?.();
    } catch (error) {
      console.error('Error editing repost:', error);
      alert('Failed to edit repost');
    }
  };

  const handleCancelEditRepost = () => {
    if (!setEditRepostContent || !setEditingRepost) return;
    setEditingRepost(prev => ({ ...prev, [repost.repost_id]: false }));
    setEditRepostContent(prev => ({ ...prev, [repost.repost_id]: '' }));
  };

  const handleEditOriginalPost = () => {
    if (!setEditRepostContent || !setEditingRepost) return;
    if (original.user?.user_id !== currentUserId) {
      alert('You can only edit your own posts');
      return;
    }
    setEditRepostContent(prev => ({ ...prev, [`original_${original.post_id}`]: original.post_content || '' }));
    setEditingRepost(prev => ({ ...prev, [`original_${original.post_id}`]: true }));
    setShowOptions?.(prev => ({ ...prev, [`original_${original.post_id}`]: false }));
  };

  const handleDeleteOriginalPost = async () => {
    if (original.user?.user_id !== currentUserId) {
      alert('You can only delete your own posts');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this original post?')) {
      try {
        await deletePost(original.post_id!);
        onRefresh?.();
        alert('Original post deleted successfully');
      } catch (error) {
        console.error('Error deleting original post:', error);
        alert('Failed to delete original post');
      }
    }
    setShowOptions?.(prev => ({ ...prev, [`original_${original.post_id}`]: false }));
  };

  const handleSaveEditOriginalPost = async () => {
    if (!setEditRepostContent || !setEditingRepost) return;
    const newContent = editRepostContent[`original_${original.post_id}`];
    
    if (!newContent?.trim()) {
      alert('Post content cannot be empty');
      return;
    }

    try {
      await editPost(original.post_id!, { post_content: newContent.trim() });
      setEditingRepost(prev => ({ ...prev, [`original_${original.post_id}`]: false }));
      setEditRepostContent(prev => ({ ...prev, [`original_${original.post_id}`]: '' }));
      onRefresh?.();
    } catch (error) {
      console.error('Error editing original post:', error);
      alert('Failed to edit original post');
    }
  };

  // Load likes data when component mounts to display usernames in summary
  useEffect(() => {
    if (likesCount > 0) {
      let mounted = true;
      (async () => {
        try {
          const data = await getRepostLikes(repost.repost_id);
          if (mounted) {
            setFetchedLikes(data?.likes || []);
            // Update like state based on fetched data
            const isLikedByCurrentUser = data?.likes?.some((like: any) => {
              const likeUser = like.user || like;
              return likeUser.user_id === currentUserId;
            });
            if (isLikedByCurrentUser !== undefined) {
              setLiked(isLikedByCurrentUser);
            }
          }
        } catch {
          if (mounted) setFetchedLikes([]);
        }
      })();
      return () => {
        mounted = false;
      };
    }
  }, [repost.repost_id, likesCount, currentUserId]);

  // Handle clicking outside the options menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target as Node)) {
        if (showOptions[repost.repost_id] && setShowOptions) {
          setShowOptions(prev => ({ ...prev, [repost.repost_id]: false }));
        }
        if (showOptions[`original_${original.post_id}`] && setShowOptions) {
          setShowOptions(prev => ({ ...prev, [`original_${original.post_id}`]: false }));
        }
      }
    };

    const hasOpenMenu = showOptions[repost.repost_id] || showOptions[`original_${original.post_id}`];
    
    if (hasOpenMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showOptions, repost.repost_id, original.post_id, setShowOptions]);

  useEffect(() => {
    if (!showLikesModal) return;
    let mounted = true;
    (async () => {
      setLikesLoading(true);
      try {
        const data = await getRepostLikes(repost.repost_id);
        if (mounted) setFetchedLikes(data?.likes || []);
      } catch {
        if (mounted) setFetchedLikes([]);
      } finally {
        if (mounted) setLikesLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [showLikesModal, repost.repost_id]);

  const goToOriginal = () => {
    const id = original.post_id;
    if (!id) return;
    localStorage.setItem('pendingPostView', String(id));
    const path = window.location.pathname;
    if (path.startsWith('/peso')) {
      window.location.href = `/peso/dashboard/${id}`;
    } else if (path.startsWith('/ccict')) {
      window.location.href = `/ccict/dashboard/${id}`;
    } else {
      window.location.href = `/alumni/dashboard/${id}`;
    }
  };

  return (
    <div className="post-feed-card" style={{ marginBottom: '16px', overflow: 'hidden' }}>
      {/* Repost header */}
      <div className="post-header" style={{ padding: '12px 16px', borderBottom: '1px solid #e1e5e9', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="post-header-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img
            src={reposterAvatar}
            alt={reposterName}
            style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
            onError={handleProfilePicError}
          />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a' }}>{reposterName || 'User'}</div>
            <div style={{ fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🔄</span>
              <span>Reposted</span>
              <span>•</span>
              <span>{formatTime(repost.repost_date)}</span>
            </div>
          </div>
        </div>
        
        {/* Three dots menu */}
        {setShowOptions && (
          <div style={{ position: 'relative', marginLeft: 'auto' }} ref={optionsMenuRef}>
            <button
              onClick={() => setShowOptions(prev => ({ ...prev, [repost.repost_id]: !prev[repost.repost_id] }))}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '18px',
                color: '#666',
                padding: '8px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '32px',
                minHeight: '32px'
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f0f0f0')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
            >
              ⋯
            </button>
            
            {showOptions[repost.repost_id] && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  background: '#fff',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  zIndex: 1000,
                  minWidth: '120px',
                  overflow: 'hidden'
                }}
              >
                {isOwn && (
                  <>
                    <button
                      onClick={handleEditRepost}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: 'none',
                        background: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#333'
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f8f9fa')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
                    >
                      Edit
                    </button>
                    <button
                      onClick={handleDeleteRepost}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: 'none',
                        background: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#dc3545'
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f8f9fa')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
                    >
                      Delete
                    </button>
                  </>
                )}
                {!isOwn && (
                  <div style={{
                    padding: '8px 12px',
                    fontSize: '14px',
                    color: '#666',
                    textAlign: 'center'
                  }}>
                    No options available
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit repost caption */}
      {editingRepost[repost.repost_id] && (
        <div style={{ padding: '16px', background: '#fff', borderBottom: '1px solid #e1e5e9' }}>
          <textarea
            value={editRepostContent[repost.repost_id] || ''}
            onChange={(e) => setEditRepostContent?.(prev => ({ ...prev, [repost.repost_id]: e.target.value }))}
            placeholder="Edit your repost caption..."
            style={{
              width: '100%',
              minHeight: '80px',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              fontSize: '14px',
              fontFamily: 'inherit',
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box'
            }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
            <button
              onClick={handleCancelEditRepost}
              style={{
                padding: '6px 12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                background: '#fff',
                color: '#666',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEditRepost}
              style={{
                padding: '6px 12px',
                border: 'none',
                borderRadius: '6px',
                background: '#007bff',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Repost caption (if not editing) */}
      {!editingRepost[repost.repost_id] && repost.repost_caption && (
        <div style={{ padding: '16px', background: '#fff', borderBottom: '1px solid #e1e5e9' }}>
          <div style={{ fontSize: '14px', color: '#1a1a1a', lineHeight: '1.5' }}>
            {repost.repost_caption}
          </div>
        </div>
      )}

      {/* Nested original preview */}
      <div className="post-content" style={{ padding: '16px', background: '#fff' }}>
        <div
          role="button"
          onClick={goToOriginal}
          style={{
            border: '1px solid #e1e5e9',
            borderRadius: 10,
            overflow: 'hidden',
            backgroundColor: '#fff',
            cursor: original.post_id ? 'pointer' : 'default',
            transition: 'box-shadow 0.15s ease'
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 10px rgba(0,0,0,0.06)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.boxShadow = 'none')}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img
                src={originalPosterAvatar}
                alt={originalPosterName}
                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                onError={handleProfilePicError}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a' }}>{originalPosterName || 'Original Post'}</div>
                <div style={{ fontSize: 12, color: '#666' }}>{formatTime(original.created_at)}</div>
              </div>
            </div>
            
            {/* Three dots menu for original post owner */}
            {original.user?.user_id === currentUserId && setShowOptions && (
              <div style={{ position: 'relative' }} ref={optionsMenuRef}>
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent triggering the goToOriginal function
                    setShowOptions(prev => ({ ...prev, [`original_${original.post_id}`]: !prev[`original_${original.post_id}`] }));
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '18px',
                    color: '#666',
                    padding: '4px',
                    borderRadius: '4px'
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f0f0f0')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
                >
                  ⋯
                </button>
                
                {showOptions[`original_${original.post_id}`] && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '100%',
                      background: '#fff',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      zIndex: 1000,
                      minWidth: '120px',
                      overflow: 'hidden'
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditOriginalPost();
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: 'none',
                        background: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#333'
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f8f9fa')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteOriginalPost();
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: 'none',
                        background: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#dc3545'
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f8f9fa')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{ padding: '12px 16px' }}>
            {/* Edit original post content */}
            {editingRepost[`original_${original.post_id}`] ? (
              <div>
                <textarea
                  value={editRepostContent[`original_${original.post_id}`] || ''}
                  onChange={(e) => setEditRepostContent?.(prev => ({ ...prev, [`original_${original.post_id}`]: e.target.value }))}
                  placeholder="Edit your post content..."
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    outline: 'none',
                    boxSizing: 'border-box',
                    marginBottom: '12px'
                  }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingRepost?.(prev => ({ ...prev, [`original_${original.post_id}`]: false }));
                      setEditRepostContent?.(prev => ({ ...prev, [`original_${original.post_id}`]: '' }));
                    }}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      background: '#fff',
                      color: '#666',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveEditOriginalPost();
                    }}
                    style={{
                      padding: '6px 12px',
                      border: 'none',
                      borderRadius: '6px',
                      background: '#007bff',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              original.post_content && (
                <div style={{ fontSize: 14, color: '#1a1a1a', lineHeight: 1.5, marginBottom: 12 }}>{original.post_content}</div>
              )
            )}
            {getSortedImages(original).length > 0 && (
              <div style={{ marginTop: 8 }}>
                {getSortedImages(original).map((img, idx) => (
                  <img
                    key={img.image_id}
                    src={img.image_url}
                    alt={`Post image ${idx + 1}`}
                    style={{ width: '100%', maxHeight: 400, objectFit: 'cover', borderRadius: 6, marginBottom: idx < getSortedImages(original).length - 1 ? 8 : 0 }}
                    onError={handleProfilePicError}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        {likesCount > 0 && (
          <div style={{ padding: '8px 16px', borderTop: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {/* Likes text */}
              {fetchedLikes.length > 0 ? (
                <span
                  onClick={() => setShowLikesModal(true)}
                  style={{ 
                    fontSize: '12px',
                    fontWeight: '500',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    color: '#6b7280',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8f9fa';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >👍
                  {fetchedLikes.length === 1 
                    ? `${(fetchedLikes[0] as any).user?.f_name || fetchedLikes[0].f_name || ''} ${(fetchedLikes[0] as any).user?.l_name || fetchedLikes[0].l_name || ''}`.trim() + ' liked this'
                    : fetchedLikes.length === 2
                    ? `${(fetchedLikes[0] as any).user?.f_name || fetchedLikes[0].f_name || ''} ${(fetchedLikes[0] as any).user?.l_name || fetchedLikes[0].l_name || ''}`.trim() + ` and ${(fetchedLikes[1] as any).user?.f_name || fetchedLikes[1].f_name || ''} ${(fetchedLikes[1] as any).user?.l_name || fetchedLikes[1].l_name || ''}`.trim() + ' liked this'
                    : `${(fetchedLikes[0] as any).user?.f_name || fetchedLikes[0].f_name || ''} ${(fetchedLikes[0] as any).user?.l_name || fetchedLikes[0].l_name || ''}`.trim() + ` and ${fetchedLikes.length - 1} others liked this`
                  }
                </span>
              ) : (
                <span
                  style={{ 
                    fontSize: '12px',
                    fontWeight: '500',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    color: '#6b7280'
                  }}
                >👍
                  {likesCount} {likesCount === 1 ? 'like' : 'likes'}
                </span>
              )}
              <span style={{ fontSize: 12, color: '#9ca3af' }}>{repost.comments_count ? `${repost.comments_count} comments` : ''}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e9ecef', padding: '8px 16px', backgroundColor: '#fafbfc' }}>
          <button
            onClick={handleLikeToggle}
            className="post-action-item"
            style={{ color: liked ? '#ef4444' : '#6c757d', background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px 16px', borderRadius: 6, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f8f9fa')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
          >
            <span style={{ fontSize: 16, color: liked ? '#3b82f6' : '#6b7280', fontWeight: liked ? 900 as any : 400 as any }}>👍</span>
            <span onClick={() => setShowLikesModal(true)} style={{ color: liked ? '#ef4444' : '#6c757d', fontWeight: liked ? 600 : 400, cursor: 'pointer' }}>
              {likesCount === 1 ? '1 like' : likesCount > 1 ? `${likesCount} likes` : 'Like'}
            </span>
          </button>
          <button
            onClick={() => setShowCommentInput(v => !v)}
            className="post-action-item"
            style={{ color: '#6c757d', background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px 16px', borderRadius: 6, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f8f9fa')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
          >
            <span style={{ fontSize: 14 }}>💬</span>
            Comment
          </button>
          <RepostButton
            originalPost={{
              post_id: original.post_id || 0,
              post_content: original.post_content || '',
              post_image: undefined,
              post_images: getSortedImages(original),
              user: {
                user_id: original.user?.user_id || 0,
                f_name: original.user?.f_name || '',
                l_name: original.user?.l_name || '',
                profile_pic: original.user?.profile_pic
              },
              created_at: (original.created_at as any) || ''
            }}
            currentUser={{ name: reposterName, profile_pic: reposterAvatar }}
            onRepost={onRefresh}
            formatTime={formatTime}
            isForum={context === 'forum'}
            isDonation={context === 'donation'}
            style={{ color: '#6c757d', padding: '8px 16px', borderRadius: 6 }}
            className="post-action-item"
          />
        </div>

        {/* Comment input */}
        {showCommentInput && (
          <div style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={commentValue}
                onChange={(e) => setCommentValue(e.target.value)}
                placeholder="Write a comment..."
                style={{ flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: 20, fontSize: 14 }}
              />
              <button onClick={handleCommentSubmit} disabled={!commentValue.trim()} style={{ padding: '8px 16px', borderRadius: 20, border: 'none', color: '#fff', background: commentValue.trim() ? '#007bff' : '#ccc', cursor: commentValue.trim() ? 'pointer' : 'not-allowed' }}>
                Post
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Likes modal */}
      {showLikesModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowLikesModal(false)}>
          <div style={{ background: '#fff', borderRadius: 12, width: '90%', maxWidth: 400, padding: 20, position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowLikesModal(false)} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.05)', border: 'none', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer' }}>×</button>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 700, color: '#1e4c7a', textAlign: 'center' }}>👍 People who liked this</h3>
            {likesLoading ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#6c757d' }}>Loading likes...</div>
            ) : fetchedLikes.length ? (
              fetchedLikes.map((like: any, i: number) => {
                const u = like.user || like;
                const name = `${u.f_name || ''} ${u.m_name || ''} ${u.l_name || ''}`.trim() || 'Unknown User';
                const pic = getProfilePicUrl(u.profile_pic);
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '10px 6px', borderBottom: i < fetchedLikes.length - 1 ? '1px solid #eee' : 'none' }}>
                    <img src={pic} alt={name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', marginRight: 12 }} onError={handleProfilePicError} />
                    <div style={{ fontWeight: 600, fontSize: 15, color: '#333' }}>{name}</div>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: 20, color: '#6c757d' }}>No likes yet</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RepostCard;
