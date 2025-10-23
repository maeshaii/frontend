import React, { useEffect, useState, useRef } from 'react';
import { likeRepost, unlikeRepost, commentOnRepost, getRepostLikes, editRepostComment, deleteRepostComment, editRepost, deleteRepost, editPost, deletePost, getCommentReplies } from '../services/api';
import { getProfilePicUrl, handleProfilePicError } from '../utils/profilePicUtils';
import RepostButton from './RepostButton';
import ReplyInput from './ReplyInput';
import Reply from './Reply';

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
  donation_id?: number; // for donation reposts
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
  replies_count?: number;
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
  
  // Local state for options menu (internal state management)
  const [localShowRepostOptions, setLocalShowRepostOptions] = useState(false);
  const [localShowOriginalOptions, setLocalShowOriginalOptions] = useState(false);
  const [localEditingRepost, setLocalEditingRepost] = useState(false);
  const [localEditingOriginal, setLocalEditingOriginal] = useState(false);
  const [localEditRepostContent, setLocalEditRepostContent] = useState('');
  const [localEditOriginalContent, setLocalEditOriginalContent] = useState('');
  
  // Comments state
  const [comments, setComments] = useState<CommentLite[]>(repost.comments || []);
  const [showAllComments, setShowAllComments] = useState(false);
  const [editingComment, setEditingComment] = useState<{ [key: number]: boolean }>({});
  const [editCommentContent, setEditCommentContent] = useState<{ [key: number]: string }>({});
  const [showCommentOptions, setShowCommentOptions] = useState<{ [key: number]: boolean }>({});
  const [showReplyInput, setShowReplyInput] = useState<{ [key: number]: boolean }>({});
  const [commentReplies, setCommentReplies] = useState<{ [key: number]: any[] }>({});
  const [showReplies, setShowReplies] = useState<{ [key: number]: boolean }>({});
  
  const optionsMenuRef = useRef<HTMLDivElement>(null);
  const commentOptionsRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  // Check if current user owns this repost
  const isOwn = repost.user.user_id === currentUserId;

  const handleLikeToggle = async () => {
    if (!currentUserId) {
      console.warn('Cannot like: No current user');
      return;
    }
    
    const previousLiked = liked;
    const previousCount = likesCount;
    
    try {
      // Optimistic update
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
      console.error('Error toggling like on repost:', e);
      // Revert on error
      setLiked(previousLiked);
      setLikesCount(previousCount);
      alert('Failed to update like. Please try again.');
    }
  };

  const handleCommentSubmit = async () => {
    if (!commentValue.trim()) return;
    if (!currentUserId) {
      console.warn('Cannot comment: No current user');
      alert('Please log in to comment');
      return;
    }
    
    try {
      await commentOnRepost(repost.repost_id, commentValue.trim());
      setCommentValue('');
      setShowCommentInput(false);
      // Reload comments
      await loadComments();
      onRefresh?.();
    } catch (e) {
      console.error('Error submitting comment:', e);
      alert('Failed to submit comment. Please try again.');
    }
  };

  const loadComments = async () => {
    // Repost comments are included in the repost data itself
    // Just refresh the parent to get updated comments
    onRefresh?.();
  };

  const handleEditComment = (commentId: number) => {
    const comment = comments.find(c => c.comment_id === commentId);
    if (comment) {
      setEditCommentContent(prev => ({ ...prev, [commentId]: comment.comment_content }));
      setEditingComment(prev => ({ ...prev, [commentId]: true }));
      setShowCommentOptions(prev => ({ ...prev, [commentId]: false }));
    }
  };

  const handleSaveEditComment = async (commentId: number) => {
    const newContent = editCommentContent[commentId];
    if (!newContent?.trim()) return;

    try {
      await editRepostComment(repost.repost_id, commentId, { comment_content: newContent.trim() });
      setEditingComment(prev => ({ ...prev, [commentId]: false }));
      setEditCommentContent(prev => ({ ...prev, [commentId]: '' }));
      await loadComments();
    } catch (error) {
      console.error('Error editing comment:', error);
      alert('Failed to edit comment');
    }
  };

  const handleCancelEditComment = (commentId: number) => {
    setEditingComment(prev => ({ ...prev, [commentId]: false }));
    setEditCommentContent(prev => ({ ...prev, [commentId]: '' }));
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    
    try {
      await deleteRepostComment(repost.repost_id, commentId);
      await loadComments();
      onRefresh?.();
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Failed to delete comment');
    }
  };

  const handleReplyAdded = async (commentId: number) => {
    setShowReplyInput(prev => ({ ...prev, [commentId]: false }));
    await loadReplies(commentId);
  };

  const loadReplies = async (commentId: number) => {
    try {
      const response = await getCommentReplies(commentId);
      if (response && response.replies) {
        setCommentReplies(prev => ({ ...prev, [commentId]: response.replies }));
      }
    } catch (error) {
      console.error('Error loading replies:', error);
      setCommentReplies(prev => ({ ...prev, [commentId]: [] }));
    }
  };

  // Auto-load replies for comments that have replies_count > 0
  useEffect(() => {
    if (comments && comments.length > 0) {
      comments.forEach(comment => {
        if (comment.replies_count && comment.replies_count > 0) {
          // Only load if not already loaded
          if (!commentReplies[comment.comment_id]) {
            loadReplies(comment.comment_id);
          }
        }
      });
    }
  }, [comments]);

  const getProfilePath = (userId: number) => {
    const path = window.location.pathname;
    if (path.startsWith('/peso')) {
      return `/peso/profile/${userId}`;
    } else if (path.startsWith('/ccict')) {
      return `/ccict/profile/${userId}`;
    } else {
      return `/alumni/profile/${userId}`;
    }
  };

  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#007bff', textDecoration: 'underline' }}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const handleEditRepost = () => {
    if (!isOwn) {
      alert('You can only edit your own reposts');
      return;
    }
    setLocalEditRepostContent(repost.repost_caption || '');
    setLocalEditingRepost(true);
    setLocalShowRepostOptions(false);
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
    setLocalShowRepostOptions(false);
  };

  const handleSaveEditRepost = async () => {
    const newContent = localEditRepostContent;
    
    if (!newContent?.trim()) {
      alert('Repost caption cannot be empty');
      return;
    }

    try {
      await editRepost(repost.repost_id, { caption: newContent.trim() });
      setLocalEditingRepost(false);
      setLocalEditRepostContent('');
      onRefresh?.();
    } catch (error) {
      console.error('Error editing repost:', error);
      alert('Failed to edit repost');
    }
  };

  const handleCancelEditRepost = () => {
    setLocalEditingRepost(false);
    setLocalEditRepostContent('');
  };

  const handleEditOriginalPost = () => {
    if (original.user?.user_id !== currentUserId) {
      alert('You can only edit your own posts');
      return;
    }
    setLocalEditOriginalContent(original.post_content || '');
    setLocalEditingOriginal(true);
    setLocalShowOriginalOptions(false);
    
    // Also update props if provided
    if (setEditRepostContent && setEditingRepost) {
      setEditRepostContent(prev => ({ ...prev, [`original_${original.post_id}`]: original.post_content || '' }));
      setEditingRepost(prev => ({ ...prev, [`original_${original.post_id}`]: true }));
      setShowOptions?.(prev => ({ ...prev, [`original_${original.post_id}`]: false }));
    }
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
    setLocalShowOriginalOptions(false);
    setShowOptions?.(prev => ({ ...prev, [`original_${original.post_id}`]: false }));
  };

  const handleSaveEditOriginalPost = async () => {
    const newContent = localEditOriginalContent;
    
    if (!newContent?.trim()) {
      alert('Post content cannot be empty');
      return;
    }

    try {
      await editPost(original.post_id!, { post_content: newContent.trim() });
      setLocalEditingOriginal(false);
      setLocalEditOriginalContent('');
      
      // Also update props if provided
      if (setEditingRepost && setEditRepostContent) {
        setEditingRepost(prev => ({ ...prev, [`original_${original.post_id}`]: false }));
        setEditRepostContent(prev => ({ ...prev, [`original_${original.post_id}`]: '' }));
      }
      
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

  // Sync comments from prop
  useEffect(() => {
    setComments(repost.comments || []);
  }, [repost.comments, repost.comments_count, repost.repost_id]);

  // Handle clicking outside the options menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Don't close if clicking on Edit or Delete button
      if (target.tagName === 'BUTTON' && target.textContent && 
          (target.textContent.trim() === 'Edit' || target.textContent.trim() === 'Delete')) {
        return;
      }
      
      // Check main options menu
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(target)) {
        if (localShowRepostOptions) {
          setLocalShowRepostOptions(false);
        }
        if (localShowOriginalOptions) {
          setLocalShowOriginalOptions(false);
        }
      }
      
      // Check comment options menus
      Object.keys(showCommentOptions).forEach((commentId) => {
        const ref = commentOptionsRefs.current[Number(commentId)];
        if (ref && !ref.contains(target) && showCommentOptions[Number(commentId)]) {
          setShowCommentOptions(prev => ({ ...prev, [Number(commentId)]: false }));
        }
      });
    };

    const hasOpenMenu = localShowRepostOptions || localShowOriginalOptions || Object.values(showCommentOptions).some(v => v);
    
    if (hasOpenMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [localShowRepostOptions, localShowOriginalOptions, showCommentOptions]);

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
    <div className="post-feed-card" style={{ 
      marginBottom: '16px', 
      backgroundColor: '#fff',
      borderRadius: 16,
      padding: 16,
      boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
      overflow: 'hidden'
    }}>
      {/* Repost header */}
      <div className="post-header">
        <div className="post-header-left">
          <img
            src={reposterAvatar}
            alt={reposterName}
            className="post-header-profile-image"
            style={{ cursor: 'pointer' }}
            onError={handleProfilePicError}
            onClick={() => {
              if (repost.user.user_id) {
                window.location.href = getProfilePath(repost.user.user_id);
              }
            }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div 
                className="post-author-info"
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  if (repost.user.user_id) {
                    window.location.href = getProfilePath(repost.user.user_id);
                  }
                }}
              >
                {reposterName || 'User'}
              </div>
              {context === 'donation' && (
                <span style={{
                  background: 'linear-gradient(135deg, #174f84 0%, #2d5aa0 100%)',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: '600',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}>
                  💝 Donation
                </span>
              )}
            </div>
            <div className="post-author-details" style={{ color: '#666', fontSize: '12px' }}>
              <span>{formatTime(repost.repost_date)}</span>
            </div>
          </div>
        </div>
        
        {/* Three dots menu */}
        <div className="post-header-right" style={{ position: 'relative' }} ref={optionsMenuRef}>
          <button
            onClick={() => {
              setLocalShowRepostOptions(!localShowRepostOptions);
              // Also update props if provided
              setShowOptions?.(prev => ({ ...prev, [repost.repost_id]: !prev[repost.repost_id] }));
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '18px',
              color: '#666'
            }}
          >
            ⋯
          </button>
          
          {localShowRepostOptions && (
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
              {isOwn ? (
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
              ) : (
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
      </div>

      {/* Edit repost caption */}
      {localEditingRepost && (
        <div style={{ marginBottom: 12 }}>
          <textarea
            value={localEditRepostContent}
            onChange={(e) => {
              setLocalEditRepostContent(e.target.value);
              // Also update props if provided
              setEditRepostContent?.(prev => ({ ...prev, [repost.repost_id]: e.target.value }));
            }}
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
      {!localEditingRepost && repost.repost_caption && repost.repost_caption.trim() && (
        <div style={{ fontSize: 14, color: '#333', lineHeight: 1.5, marginBottom: 12 }}>
          {repost.repost_caption}
        </div>
      )}

      {/* Nested original preview */}
      <div className="post-content" style={{ background: '#fff' }}>
        <div
          role="button"
          onClick={goToOriginal}
          style={{
            border: '1px solid #e9ecef',
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: '#f8f9fa',
            cursor: original.post_id ? 'pointer' : 'default',
            transition: 'all 0.15s ease',
            marginBottom: 12
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 10px rgba(0,0,0,0.06)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.boxShadow = 'none')}
        >
          <div style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img
                src={originalPosterAvatar}
                alt={originalPosterName}
                style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
                onError={handleProfilePicError}
              />
              <div>
                <div style={{ fontWeight: 'bold', fontSize: 13, color: '#333' }}>{originalPosterName || 'Original Post'}</div>
                <div style={{ fontSize: 11, color: '#666' }}>{formatTime(original.created_at)}</div>
              </div>
            </div>
            
            {/* Three dots menu for original post owner */}
            {original.user?.user_id === currentUserId && (
              <div style={{ position: 'relative' }} ref={optionsMenuRef}>
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent triggering the goToOriginal function
                    setLocalShowOriginalOptions(!localShowOriginalOptions);
                    // Also update props if provided
                    setShowOptions?.(prev => ({ ...prev, [`original_${original.post_id}`]: !prev[`original_${original.post_id}`] }));
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
                
                {localShowOriginalOptions && (
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
          <div style={{ padding: '0 12px 12px 12px' }}>
            {/* Edit original post content */}
            {localEditingOriginal ? (
              <div>
                <textarea
                  value={localEditOriginalContent}
                  onChange={(e) => {
                    setLocalEditOriginalContent(e.target.value);
                    // Also update props if provided
                    setEditRepostContent?.(prev => ({ ...prev, [`original_${original.post_id}`]: e.target.value }));
                  }}
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
                      setLocalEditingOriginal(false);
                      setLocalEditOriginalContent('');
                      // Also update props if provided
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
                <div style={{ fontSize: 13, color: '#333', lineHeight: 1.5, marginBottom: 8 }}>{original.post_content}</div>
              )
            )}
            {getSortedImages(original).length > 0 && (
              <div style={{ marginTop: 8 }}>
                {getSortedImages(original).map((img, idx) => (
                  <img
                    key={img.image_id}
                    src={img.image_url}
                    alt={`Post image ${idx + 1}`}
                    style={{ width: '100%', maxHeight: 400, objectFit: 'cover', borderRadius: 8, marginBottom: idx < getSortedImages(original).length - 1 ? 8 : 0 }}
                    onError={handleProfilePicError}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats Row - Like Mobile */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px', marginBottom: 8 }}>
                <span
                  onClick={() => setShowLikesModal(true)}
                  style={{ 
                    fontSize: '12px',
              color: '#666',
              cursor: 'pointer'
            }}
          >
            {likesCount} {likesCount === 1 ? 'like' : 'likes'}
                </span>
                <span
            onClick={() => setShowCommentInput(v => !v)}
                  style={{ 
                    fontSize: '12px',
              color: '#666',
              cursor: 'pointer'
            }}
          >
            {repost.comments_count || 0} comments
          </span>
          <span style={{ fontSize: '12px', color: '#666' }}>
            0 reposts
                </span>
          </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-around', borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
          <button
            onClick={handleLikeToggle}
            className="post-action-item"
            style={{ 
              color: liked ? '#1e3a8a' : '#555', 
              background: 'transparent', 
              border: 'none', 
              cursor: 'pointer', 
              padding: '8px', 
              fontSize: 12, 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6,
              fontWeight: liked ? 'bold' : 'normal'
            }}
          >
            <span style={{ fontSize: 18 }}>👍</span>
            <span>Like</span>
          </button>
          <button
            onClick={() => setShowCommentInput(v => !v)}
            className="post-action-item"
            style={{ 
              color: '#555', 
              background: 'transparent', 
              border: 'none', 
              cursor: 'pointer', 
              padding: '8px', 
              fontSize: 12, 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6 
            }}
          >
            <span style={{ fontSize: 18 }}>💬</span>
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
            style={{ color: '#555', padding: '8px', fontSize: 12 }}
            className="post-action-item"
          />
        </div>

        {/* Comment input */}
        {showCommentInput && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={commentValue}
                onChange={(e) => setCommentValue(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && commentValue.trim()) {
                    handleCommentSubmit();
                  }
                }}
                placeholder="Write a comment..."
                style={{ flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: 20, fontSize: 14 }}
                autoFocus
              />
              <button onClick={handleCommentSubmit} disabled={!commentValue.trim()} style={{ padding: '8px 16px', borderRadius: 20, border: 'none', color: '#fff', background: commentValue.trim() ? '#007bff' : '#ccc', cursor: commentValue.trim() ? 'pointer' : 'not-allowed' }}>
                Post
              </button>
            </div>
          </div>
        )}

        {/* Comments section */}
        {(comments && comments.length > 0) || (repost.comments_count && repost.comments_count > 0) ? (
          <div className="comments-section" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #eee' }}>
            {comments && comments.length > 0 ? (
              (showAllComments ? comments : comments.slice(0, 2)).map((comment) => (
              <div key={comment.comment_id} className="comment-item" style={{ 
                display: 'flex', 
                gap: '8px', 
                marginBottom: '12px', 
                marginLeft: '12px',
                marginRight: '12px'
              }}>
                <img
                  src={getProfilePicUrl(comment.user.profile_pic)}
                  alt="Profile"
                  className="comment-profile-image"
                  style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }}
                  onError={handleProfilePicError}
                  onClick={() => {
                    const profilePath = window.location.pathname.startsWith('/peso') 
                      ? `/peso/profile/${comment.user.user_id}` 
                      : window.location.pathname.startsWith('/ccict')
                      ? `/ccict/profile/${comment.user.user_id}`
                      : `/alumni/profile/${comment.user.user_id}`;
                    window.location.href = profilePath;
                  }}
                />
                <div style={{ flex: 1 }}>
                  {/* Comment bubble container */}
                  <div style={{
                    backgroundColor: '#f0f2f5',
                    borderRadius: '18px',
                    padding: '8px 12px',
                    display: 'inline-block',
                    maxWidth: '100%',
                    position: 'relative'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <button
                        onClick={() => window.location.href = getProfilePath(comment.user.user_id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '0',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '13px',
                          color: '#050505',
                          textDecoration: 'none'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.textDecoration = 'underline';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.textDecoration = 'none';
                        }}
                      >
                        {`${comment.user.f_name} ${comment.user.m_name || ''} ${comment.user.l_name}`.trim()}
                      </button>
                    {((Number(currentUserId) === Number(comment.user.user_id)) || isOwn) && !editingComment[comment.comment_id] && (
                      <div style={{ position: 'relative' }} ref={(el) => { commentOptionsRefs.current[comment.comment_id] = el; }}>
                        <button
                          onClick={() => setShowCommentOptions(prev => ({ ...prev, [comment.comment_id]: !prev[comment.comment_id] }))}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '14px',
                            color: '#65676b',
                            padding: '0 4px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#050505';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#65676b';
                          }}
                        >
                          ⋯
                        </button>
                        {showCommentOptions[comment.comment_id] && (
                          <div
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: '100%',
                              marginTop: '4px',
                              background: '#fff',
                              border: '1px solid #e4e6eb',
                              borderRadius: '8px',
                              boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                              zIndex: 1000,
                              minWidth: '120px',
                              overflow: 'hidden'
                            }}
                          >
                            {(String(currentUserId) === String(comment.user.user_id)) && (
                              <button
                                onClick={() => handleEditComment(comment.comment_id)}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  background: 'none',
                                  border: 'none',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  color: '#050505',
                                  fontWeight: '400'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#f2f3f5';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                              >
                                Edit
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteComment(comment.comment_id)}
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                background: 'none',
                                border: 'none',
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontSize: '13px',
                                color: '#050505',
                                fontWeight: '400'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#f2f3f5';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    </div>
                    
                    {/* Comment Content */}
                    {editingComment[comment.comment_id] ? (
                      <textarea
                        value={editCommentContent[comment.comment_id] || ''}
                        onChange={(e) => setEditCommentContent(prev => ({ ...prev, [comment.comment_id]: e.target.value }))}
                        style={{
                          width: '100%',
                          minHeight: '50px',
                          padding: '8px 12px',
                          border: '1px solid #ccd0d5',
                          borderRadius: '18px',
                          fontSize: '13px',
                          resize: 'vertical',
                          backgroundColor: '#ffffff',
                          fontFamily: 'inherit'
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSaveEditComment(comment.comment_id);
                          } else if (e.key === 'Escape') {
                            handleCancelEditComment(comment.comment_id);
                          }
                        }}
                      />
                    ) : (
                      <div style={{ fontSize: '13px', color: '#050505', lineHeight: '1.38', wordBreak: 'break-word' }}>
                        {renderTextWithLinks(comment.comment_content)}
                      </div>
                    )}
                  </div>
                  
                  {/* Actions below bubble */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '2px', marginLeft: '12px' }}>
                    <span style={{ fontSize: '12px', color: '#65676b', fontWeight: '400' }}>
                      {formatTime(comment.date_created)}
                    </span>
                    
                    {!editingComment[comment.comment_id] && (
                      <button
                        onClick={() => {
                          setShowReplyInput(prev => ({ ...prev, [comment.comment_id]: !prev[comment.comment_id] }));
                          if (!showReplyInput[comment.comment_id]) {
                            loadReplies(comment.comment_id);
                          }
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#65676b',
                          cursor: 'pointer',
                          fontSize: '12px',
                          padding: '0',
                          fontWeight: '600'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.textDecoration = 'underline';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.textDecoration = 'none';
                        }}
                      >
                        Reply
                      </button>
                    )}
                    
                    {editingComment[comment.comment_id] && (
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                          onClick={() => handleSaveEditComment(comment.comment_id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#0866ff',
                            cursor: 'pointer',
                            fontSize: '12px',
                            padding: '0',
                            fontWeight: '600'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.textDecoration = 'underline';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.textDecoration = 'none';
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => handleCancelEditComment(comment.comment_id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#65676b',
                            cursor: 'pointer',
                            fontSize: '12px',
                            padding: '0',
                            fontWeight: '600'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.textDecoration = 'underline';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.textDecoration = 'none';
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Reply Input */}
                  {showReplyInput[comment.comment_id] && (
                    <ReplyInput
                      commentId={comment.comment_id}
                      currentUserId={currentUserId || undefined}
                      displayName={reposterName}
                      displayAvatar={reposterAvatar}
                      onReplyAdded={() => handleReplyAdded(comment.comment_id)}
                      commentAuthor={{
                        user_id: comment.user.user_id,
                        f_name: comment.user.f_name || '',
                        m_name: comment.user.m_name || '',
                        l_name: comment.user.l_name || '',
                        name: `${comment.user.f_name || ''} ${comment.user.m_name || ''} ${comment.user.l_name || ''}`.trim()
                      }}
                    />
                  )}
                  
                  {/* Replies */}
                  {commentReplies[comment.comment_id] && commentReplies[comment.comment_id].length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      {/* Show all replies if less than 2, otherwise show first 2 with toggle */}
                      {commentReplies[comment.comment_id].slice(0, 
                        commentReplies[comment.comment_id].length < 2 ? 
                          commentReplies[comment.comment_id].length : 
                          (showReplies[comment.comment_id] ? commentReplies[comment.comment_id].length : 2)
                      ).map((reply) => (
                        <Reply
                          key={reply.reply_id}
                          reply={reply}
                          commentId={comment.comment_id}
                          currentUserId={currentUserId || undefined}
                          formatTime={formatTime}
                          onReplyUpdate={() => loadReplies(comment.comment_id)}
                          displayName={reposterName}
                          displayAvatar={reposterAvatar}
                        />
                      ))}
                      
                      {/* Show more/less replies button */}
                      {commentReplies[comment.comment_id].length > 2 && (
                        <button
                          onClick={() => setShowReplies(prev => ({ ...prev, [comment.comment_id]: !prev[comment.comment_id] }))}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#007bff',
                            cursor: 'pointer',
                            fontSize: '11px',
                            padding: '4px 0',
                            marginTop: '4px'
                          }}
                        >
                          {showReplies[comment.comment_id] 
                            ? 'Hide replies' 
                            : `View ${commentReplies[comment.comment_id].length - 2} more ${commentReplies[comment.comment_id].length - 2 === 1 ? 'reply' : 'replies'}`
                          }
                        </button>
                      )}
                    </div>
                  )}
                  
                </div>
              </div>
              ))
            ) : (
              <div style={{ padding: '12px 16px', textAlign: 'center', color: '#666', fontSize: '14px' }}>
                {repost.comments_count} comment{repost.comments_count === 1 ? '' : 's'} - Click to refresh
                <button 
                  onClick={() => onRefresh?.()} 
                  style={{ 
                    marginLeft: '8px', 
                    padding: '4px 12px', 
                    borderRadius: '6px', 
                    border: '1px solid #007bff', 
                    background: '#fff', 
                    color: '#007bff', 
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Refresh
                </button>
              </div>
            )}
            {comments && comments.length > 2 && !showAllComments && (
              <button
                className="view-all-comments-btn"
                style={{ fontSize: '12px', color: '#1C4E80', background: 'none', border: 'none', cursor: 'pointer', marginTop: '4px', marginLeft: '8px' }}
                onClick={() => setShowAllComments(true)}
              >
                View all comments ({comments.length})
              </button>
            )}
            {comments && comments.length > 2 && showAllComments && (
              <button
                className="hide-comments-btn"
                style={{ fontSize: '12px', color: '#007bff', background: 'none', border: 'none', cursor: 'pointer', marginTop: '4px', marginLeft: '8px' }}
                onClick={() => setShowAllComments(false)}
              >
                Hide comments
              </button>
            )}
          </div>
        ) : null}
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
  