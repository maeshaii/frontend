import React, { useState, useEffect, useRef } from 'react';
import * as api from '../services/api';
import { 
  commentOnForumPost, 
  deleteForumComment, 
  editForumComment,
  deleteForumPost,
  editForumPost,
  likeForumPost,
  unlikeForumPost
} from '../services/api';
import ctulogo from '../images/ctulogo.png';
import RepostModal from './RepostModal';

interface RepostItem {
  repost_id: number;
  repost_date: string;
  repost_caption?: string;
  user: {
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

interface PostCardProps {
  post: PostItem;
  currentUserId: number | null;
  isOwn: boolean;
  displayName: string;
  displayAvatar: string;
  formatTime: (iso?: string | null) => string;
  onPostUpdate?: () => void;
  showOptions?: { [key: string | number]: boolean };
  setShowOptions?: (fn: (prev: { [key: string | number]: boolean }) => { [key: string | number]: boolean }) => void;
  editingPost?: { [key: number]: boolean };
  setEditingPost?: (fn: (prev: { [key: number]: boolean }) => { [key: number]: boolean }) => void;
  editPostContent?: { [key: number]: string };
  setEditPostContent?: (fn: (prev: { [key: number]: string }) => { [key: number]: string }) => void;
  likedPosts?: { [key: number]: boolean };
  setLikedPosts?: (fn: (prev: { [key: number]: boolean }) => { [key: number]: boolean }) => void;
  repostedPosts?: { [key: number]: boolean };
  setRepostedPosts?: (fn: (prev: { [key: number]: boolean }) => { [key: number]: boolean }) => void;
  showCommentInput?: { [key: number]: boolean };
  setShowCommentInput?: (fn: (prev: { [key: number]: boolean }) => { [key: number]: boolean }) => void;
  showAllComments?: { [key: number]: boolean };
  setShowAllComments?: (fn: (prev: { [key: number]: boolean }) => { [key: number]: boolean }) => void;
  commentInput?: { [key: number]: string };
  setCommentInput?: (fn: (prev: { [key: number]: string }) => { [key: number]: string }) => void;
  editingComment?: { [key: number]: boolean };
  setEditingComment?: (fn: (prev: { [key: number]: boolean }) => { [key: number]: boolean }) => void;
  editCommentContent?: { [key: number]: string };
  setEditCommentContent?: (fn: (prev: { [key: number]: string }) => { [key: number]: string }) => void;
  isForum?: boolean; // New prop to indicate forum context
  isRepost?: boolean; // New prop to indicate if this is a repost
  repostData?: RepostItem; // Data about the repost
}

const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUserId,
  isOwn,
  displayName,
  displayAvatar,
  formatTime,
  onPostUpdate,
  showOptions = {},
  setShowOptions,
  editingPost = {},
  setEditingPost,
  editPostContent = {},
  setEditPostContent,
  likedPosts = {},
  setLikedPosts,
  repostedPosts = {},
  setRepostedPosts,
  showCommentInput = {},
  setShowCommentInput,
  showAllComments = {},
  setShowAllComments,
  commentInput = {},
  setCommentInput,
  editingComment = {},
  setEditingComment,
  editCommentContent = {},
  setEditCommentContent,
  isForum = false, // Default to false for backward compatibility
  isRepost = false, // Default to false for backward compatibility
  repostData, // Optional repost data
}) => {
  console.log('PostCard currentUserId:', currentUserId);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImageSrc, setModalImageSrc] = useState('');
  const optionsMenuRef = useRef<HTMLDivElement>(null);
  const commentOptionsRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const [showCommentOptions, setShowCommentOptions] = useState<{ [key: number]: boolean }>({});

  // Helper function to get proper singular/plural form
  const getPluralForm = (count: number, singular: string, plural: string) => {
    return count === 1 ? `${count} ${singular}` : `${count} ${plural}`;
  };

  // Handle image click to show modal
  const handleImageClick = (imageSrc: string) => {
    setModalImageSrc(imageSrc);
    setShowImageModal(true);
  };

  // Helper function to detect and make URLs clickable
  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#174f84',
              textDecoration: 'underline',
              cursor: 'pointer'
            }}
            onClick={(e) => {
              e.stopPropagation();
              window.open(part, '_blank', 'noopener,noreferrer');
            }}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  // Handle clicking outside the options menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check post options menu
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target as Node)) {
        if (showOptions[post.post_id] && setShowOptions) {
          setShowOptions(prev => ({ ...prev, [post.post_id]: false }));
        }
      }

      // Check comment options menus
      if (post.comments) {
        post.comments.forEach(comment => {
          const commentRef = commentOptionsRefs.current[comment.comment_id];
          if (commentRef && !commentRef.contains(event.target as Node)) {
            if (showCommentOptions[comment.comment_id]) {
              setShowCommentOptions(prev => ({ ...prev, [comment.comment_id]: false }));
            }
          }
        });
      }
    };

    // Check if any options menu is open
    const hasOpenMenu = showOptions[post.post_id] || 
      (post.comments && post.comments.some(comment => showCommentOptions[comment.comment_id]));

    if (hasOpenMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showOptions, post.post_id, post.comments, setShowOptions, showCommentOptions]);

  const handleLike = async () => {
    if (!setLikedPosts) return;
    try {
      if (isForum) {
        // Use forum like API
        await likeForumPost(post.post_id);
      } else {
        // Use regular post like API
        await api.likePost(post.post_id);
      }
      setLikedPosts(prev => ({ ...prev, [post.post_id]: true }));
      onPostUpdate?.();
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleUnlike = async () => {
    if (!setLikedPosts) return;
    try {
      if (isForum) {
        // Use forum unlike API
        await unlikeForumPost(post.post_id);
      } else {
        // Use regular post unlike API
        await api.unlikePost(post.post_id);
      }
      setLikedPosts(prev => ({ ...prev, [post.post_id]: false }));
      onPostUpdate?.();
    } catch (error) {
      console.error('Error unliking post:', error);
    }
  };

  const handleCommentSubmit = async () => {
    if (!commentInput[post.post_id] || !setCommentInput) return;
    try {
      let result;
      if (isForum) {
        // Use forum comment API
        result = await commentOnForumPost(post.post_id, commentInput[post.post_id]);
      } else {
        // Use regular post comment API
        result = await api.commentOnPost(post.post_id, commentInput[post.post_id]);
      }
      
      if (result.success) {
        setCommentInput(prev => ({ ...prev, [post.post_id]: '' }));
        onPostUpdate?.();
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
    }
  };

  const handleRepost = () => {
    setShowRepostModal(true);
  };

  const handleRepostSubmit = async (caption: string) => {
    if (!setRepostedPosts) return;
    try {
      await api.repostPost(post.post_id, caption);
      setRepostedPosts(prev => ({ ...prev, [post.post_id]: true }));
      onPostUpdate?.();
    } catch (error: any) {
      console.error('Error reposting:', error);
    }
  };

  const handleEditPost = () => {
    if (!setEditPostContent || !setEditingPost) return;
    if (!isOwn) {
      alert('You can only edit your own posts');
      return;
    }
    setEditPostContent(prev => ({ ...prev, [post.post_id]: post.post_content }));
    setEditingPost(prev => ({ ...prev, [post.post_id]: true }));
    setShowOptions?.(prev => ({ ...prev, [post.post_id]: false }));
  };

  const handleDeletePost = async () => {
    if (!isOwn) {
      alert('You can only delete your own posts');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this post?')) {
      try {
        if (isForum) {
          // Use forum post API
          await deleteForumPost(post.post_id);
        } else {
          // Use regular post API
          await api.deletePost(post.post_id);
        }
        onPostUpdate?.();
        alert('Post deleted successfully');
      } catch (error) {
        console.error('Error deleting post:', error);
        alert('Failed to delete post');
      }
    }
    setShowOptions?.(prev => ({ ...prev, [post.post_id]: false }));
  };

  const handleSaveEditPost = async () => {
    if (!editPostContent[post.post_id]?.trim() || !setEditingPost) return;
    if (!isOwn) {
      alert('You can only edit your own posts');
      return;
    }
    
    try {
      if (isForum) {
        // Use forum post API
        await editForumPost(post.post_id, { content: editPostContent[post.post_id] });
      } else {
        // Use regular post API
        await api.editPost(post.post_id, { post_content: editPostContent[post.post_id] });
      }
      setEditingPost(prev => ({ ...prev, [post.post_id]: false }));
      onPostUpdate?.();
    } catch (error) {
      console.error('Error editing post:', error);
      alert('Failed to update post');
    }
  };

  const handleCancelEditPost = () => {
    if (!setEditingPost || !setEditPostContent) return;
    setEditingPost(prev => ({ ...prev, [post.post_id]: false }));
    setEditPostContent(prev => ({ ...prev, [post.post_id]: post.post_content }));
  };

  const handleEditComment = (commentId: number) => {
    if (!setEditCommentContent || !setEditingComment) return;
    const comment = post.comments?.find(c => c.comment_id === commentId);
    if (comment) {
      // Check if current user owns this comment
      if (Number(currentUserId) !== Number(comment.user.user_id)) {
        alert('You can only edit your own comments');
        return;
      }
      setEditCommentContent(prev => ({ ...prev, [commentId]: comment.comment_content }));
      setEditingComment(prev => ({ ...prev, [commentId]: true }));
      setShowCommentOptions(prev => ({ ...prev, [commentId]: false })); // Close the menu
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    const comment = post.comments?.find(c => c.comment_id === commentId);
    if (!comment) return;
    
    // Check if current user owns this comment OR owns the post
    const canDelete = Number(currentUserId) === Number(comment.user.user_id) || isOwn;
    if (!canDelete) {
      alert('You can only delete your own comments or comments on your posts');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this comment?')) {
      try {
        if (isForum) {
          // Use forum comment API
          await deleteForumComment(post.post_id, commentId);
        } else {
          // Use regular post comment API
          await api.deleteComment(post.post_id, commentId);
        }
        onPostUpdate?.();
        alert('Comment deleted successfully');
      } catch (error) {
        console.error('Error deleting comment:', error);
        alert('Failed to delete comment');
      }
    }
  };

  const handleSaveEditComment = async (commentId: number) => {
    if (!editCommentContent[commentId]?.trim() || !setEditingComment) return;
    
    const comment = post.comments?.find(c => c.comment_id === commentId);
    if (!comment) return;
    
    // Check if current user owns this comment
    if (Number(currentUserId) !== Number(comment.user.user_id)) {
      alert('You can only edit your own comments');
      return;
    }
    
    try {
      if (isForum) {
        // Use forum comment API
        await editForumComment(post.post_id, commentId, { comment_content: editCommentContent[commentId] });
      } else {
        // Use regular post comment API
        await api.editComment(post.post_id, commentId, { comment_content: editCommentContent[commentId] });
      }
      setEditingComment?.(prev => ({ ...prev, [commentId]: false }));
      setEditCommentContent?.(prev => ({ ...prev, [commentId]: '' }));
      onPostUpdate?.();
    } catch (error) {
      console.error('Error editing comment:', error);
      alert('Failed to update comment');
    }
  };

  const handleCancelEditComment = (commentId: number) => {
    if (!setEditingComment || !setEditCommentContent) return;
    setEditingComment(prev => ({ ...prev, [commentId]: false }));
    setEditCommentContent(prev => ({ ...prev, [commentId]: '' }));
  };

  // Determine if this is a repost and get the appropriate data
  const isRepostPost = isRepost && repostData;
  const displayUser = isRepostPost ? repostData.user : post.user;
  const repostDisplayName = isRepostPost ? `${repostData.user.f_name} ${repostData.user.l_name}` : displayName;
  const repostDisplayAvatar = isRepostPost 
    ? (repostData.user.profile_pic ? (String(repostData.user.profile_pic).startsWith('http') ? repostData.user.profile_pic : `http://127.0.0.1:8000${repostData.user.profile_pic}`) : ctulogo)
    : displayAvatar;

  return (
    <div className="post-feed-card">
      {isRepostPost ? (
        // Repost structure with two cards
        <>
          {/* Outer Card - Reposter's info and interactions */}
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e1e8ed',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '12px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            {/* Reposter's header */}
            <div className="post-header">
              <div className="post-header-left">
                <img
                  src={repostDisplayAvatar}
                  alt="Profile"
                  className="post-header-profile-image"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    if (displayUser?.user_id) {
                      const currentPath = window.location.pathname;
                      if (currentPath.startsWith('/peso')) {
                        window.location.href = `/peso/profile/${displayUser.user_id}`;
                      } else if (currentPath.startsWith('/ccict')) {
                        window.location.href = `/ccict/profile/${displayUser.user_id}`;
                      } else {
                        window.location.href = `/alumni/profile/${displayUser.user_id}`;
                      }
                    }
                  }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.onerror = null;
                    target.src = ctulogo as unknown as string;
                  }}
                />
                <div>
                  <div 
                    className="post-author-info"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (displayUser?.user_id) {
                        const currentPath = window.location.pathname;
                        if (currentPath.startsWith('/peso')) {
                          window.location.href = `/peso/profile/${displayUser.user_id}`;
                        } else if (currentPath.startsWith('/ccict')) {
                          window.location.href = `/ccict/profile/${displayUser.user_id}`;
                        } else {
                          window.location.href = `/alumni/profile/${displayUser.user_id}`;
                        }
                      }
                    }}
                  >
                    {repostDisplayName || 'User'}
                  </div>
                  <div className="post-author-details" style={{ color: '#666', fontSize: '12px' }}>
                    <span>{formatTime(repostData.repost_date)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Repost caption */}
            {repostData.repost_caption && (
              <div style={{ 
                padding: '0 16px', 
                fontSize: '14px', 
                color: '#333',
                marginBottom: '12px',
                lineHeight: '1.5'
              }}>
                {renderTextWithLinks(repostData.repost_caption)}
              </div>
            )}

            {/* Interaction buttons for repost */}
            <div className="post-actions" style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              borderTop: '1px solid #e9ecef',
              paddingTop: '8px'
            }}>
              <button
                onClick={() => likedPosts[post.post_id] ? handleUnlike() : handleLike()}
                className="post-action-item"
                style={{
                  color: likedPosts[post.post_id] ? '#e0245e' : '#6c757d',
                  fontWeight: likedPosts[post.post_id] ? 'bold' : 'normal',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px 16px',
                  borderRadius: 6,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span style={{ fontSize: '14px' }}>
                  {likedPosts[post.post_id] ? '❤️' : '🤍'}
                </span>
                Like
              </button>
              <button
                onClick={() => setShowCommentInput?.(prev => ({ ...prev, [post.post_id]: !prev[post.post_id] }))}
                className="post-action-item"
                style={{
                  color: '#6c757d',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px 16px',
                  borderRadius: 6,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span style={{ fontSize: '14px' }}>💬</span>
                Comment
              </button>
              <button
                onClick={() => setShowRepostModal(true)}
                className="post-action-item"
                style={{
                  color: repostedPosts[post.post_id] ? '#1da1f2' : '#6c757d',
                  fontWeight: repostedPosts[post.post_id] ? 'bold' : 'normal',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px 16px',
                  borderRadius: 6,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span style={{ fontSize: '14px' }}>🔄</span>
                Repost
              </button>
            </div>
          </div>

          {/* Inner Card - Original post without interactions */}
          {repostData.original_post && (
            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e1e8ed',
              borderRadius: '12px',
              padding: '16px',
              marginTop: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              {/* Original post header */}
              <div className="post-header">
                <div className="post-header-left">
                  <img
                    src={repostData.original_post.user?.profile_pic ? (String(repostData.original_post.user.profile_pic).startsWith('http') ? repostData.original_post.user.profile_pic : `http://127.0.0.1:8000${repostData.original_post.user.profile_pic}`) : ctulogo}
                    alt="Profile"
                    className="post-header-profile-image"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (repostData.original_post?.user?.user_id) {
                        const currentPath = window.location.pathname;
                        if (currentPath.startsWith('/peso')) {
                          window.location.href = `/peso/profile/${repostData.original_post.user.user_id}`;
                        } else if (currentPath.startsWith('/ccict')) {
                          window.location.href = `/ccict/profile/${repostData.original_post.user.user_id}`;
                        } else {
                          window.location.href = `/alumni/profile/${repostData.original_post.user.user_id}`;
                        }
                      }
                    }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.src = ctulogo as unknown as string;
                    }}
                  />
                  <div>
                    <div 
                      className="post-author-info"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        if (repostData.original_post?.user?.user_id) {
                          const currentPath = window.location.pathname;
                          if (currentPath.startsWith('/peso')) {
                            window.location.href = `/peso/profile/${repostData.original_post.user.user_id}`;
                          } else if (currentPath.startsWith('/ccict')) {
                            window.location.href = `/ccict/profile/${repostData.original_post.user.user_id}`;
                          } else {
                            window.location.href = `/alumni/profile/${repostData.original_post.user.user_id}`;
                          }
                        }
                      }}
                    >
                      {repostData.original_post.user?.f_name} {repostData.original_post.user?.l_name}
                    </div>
                    <div className="post-author-details" style={{ color: '#666', fontSize: '12px' }}>
                      <span>{formatTime(repostData.original_post.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Original post content */}
              {repostData.original_post.post_content && (
                <div
                  style={{
                    padding: '0 16px',
                    whiteSpace: 'pre-wrap',
                    maxWidth: '100%',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    color: '#333',
                    marginBottom: '8px'
                  }}
                >
                  {renderTextWithLinks(repostData.original_post.post_content)}
                </div>
              )}

              {/* Original post image */}
              {repostData.original_post.post_image && (
                <div style={{ marginTop: 8 }}>
                  <img
                    src={typeof repostData.original_post?.post_image === 'string' && repostData.original_post?.post_image.startsWith('/media/')
                      ? `http://127.0.0.1:8000${repostData.original_post?.post_image}`
                      : (repostData.original_post?.post_image as string)}
                    alt="post"
                    style={{ maxWidth: '100%', borderRadius: 8, maxHeight: '400px', objectFit: 'cover' }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      console.error('Failed to load post image:', repostData.original_post?.post_image);
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        // Regular post structure
        <>

      <div className="post-header">
        <div className="post-header-left">
          <img
            src={repostDisplayAvatar}
            alt="Profile"
            className="post-header-profile-image"
            style={{ cursor: 'pointer' }}
            onClick={() => {
              if (displayUser?.user_id) {
                // Navigate to user profile based on current path
                const currentPath = window.location.pathname;
                if (currentPath.startsWith('/peso')) {
                  window.location.href = `/peso/profile/${displayUser.user_id}`;
                } else if (currentPath.startsWith('/ccict')) {
                  window.location.href = `/ccict/profile/${displayUser.user_id}`;
                } else {
                  window.location.href = `/alumni/profile/${displayUser.user_id}`;
                }
              }
            }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.onerror = null;
              target.src = ctulogo as unknown as string;
            }}
          />
          <div>
            <div 
              className="post-author-info"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                if (displayUser?.user_id) {
                  // Navigate to user profile based on current path
                  const currentPath = window.location.pathname;
                  if (currentPath.startsWith('/peso')) {
                    window.location.href = `/peso/profile/${displayUser.user_id}`;
                  } else if (currentPath.startsWith('/ccict')) {
                    window.location.href = `/ccict/profile/${displayUser.user_id}`;
                  } else {
                    window.location.href = `/alumni/profile/${displayUser.user_id}`;
                  }
                }
              }}
            >
              {repostDisplayName || 'User'}
            </div>
            <div className="post-author-details" style={{ color: '#666', fontSize: '12px' }}>
              <span>{formatTime(post.created_at) || 'Unknown time'}</span>
            </div>
          </div>
        </div>
        {isOwn && setShowOptions && (
          <div className="post-header-right" style={{ position: 'relative' }} ref={optionsMenuRef}>
            <button
              onClick={() => setShowOptions(prev => ({ ...prev, [post.post_id]: !prev[post.post_id] }))}
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
            {showOptions[post.post_id] && (
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
                  minWidth: '120px'
                }}
              >
                <button
                  onClick={handleEditPost}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={handleDeletePost}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#e0245e'
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {editingPost[post.post_id] ? (
        <div style={{ marginTop: 8 }}>
          <textarea
            value={editPostContent[post.post_id] || ''}
            onChange={(e) => setEditPostContent?.(prev => ({ ...prev, [post.post_id]: e.target.value }))}
            style={{
              width: '100%',
              minHeight: '80px',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              fontSize: '14px',
              resize: 'vertical'
            }}
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button
              onClick={handleSaveEditPost}
              style={{
                background: '#007bff',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Save
            </button>
            <button
              onClick={handleCancelEditPost}
              style={{
                background: '#6c757d',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div 
          className="post-content"
          style={{
            wordWrap: 'break-word',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            whiteSpace: 'pre-wrap',
            maxWidth: '100%',
            fontSize: '14px',
            lineHeight: '1.5',
            color: '#333',
            marginBottom: '8px'
          }}
        >
          {renderTextWithLinks(post.post_content)}
        </div>
      )}

      {post.post_image && (
        <div style={{ marginTop: 8 }}>
          <img
            src={
              typeof post.post_image === 'string' && post.post_image.startsWith('/media/')
                ? `http://127.0.0.1:8000${post.post_image}`
                : (post.post_image as string)
            }
            alt="post"
            style={{ 
              maxWidth: '100%', 
              borderRadius: 8, 
              maxHeight: '400px', 
              objectFit: 'cover',
              cursor: 'pointer',
              transition: 'transform 0.2s ease'
            }}
            onClick={() => handleImageClick(
              typeof post.post_image === 'string' && post.post_image.startsWith('/media/')
                ? `http://127.0.0.1:8000${post.post_image}`
                : (post.post_image as string)
            )}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              console.error('Failed to load post image:', post.post_image);
            }}
          />
        </div>
      )}
        </>
      )}

      {/* Facebook-style likes and comments display */}
      {((post.likes && post.likes.length > 0) || (post.comments && post.comments.length > 0)) && (
        <div style={{ 
          marginTop: 8, 
          padding: '8px 12px', 
          borderRadius: 8,
          color: '#6c757d',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* Likes text */}
            {post.likes && post.likes.length > 0 ? (
              <span
                onClick={() => setShowLikesModal(true)}
                style={{ 
                  cursor: 'pointer', 
                  fontSize: '12px',
                  fontWeight: '500',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >❤️
                {post.likes.length === 1 
                  ? `${post.likes[0].f_name} ${post.likes[0].l_name} liked this`
                  : post.likes.length === 2
                  ? `${post.likes[0].f_name} ${post.likes[0].l_name} and ${post.likes[1].f_name} ${post.likes[1].l_name} liked this`
                  : `${post.likes[0].f_name} ${post.likes[0].l_name} and ${post.likes.length - 1} others liked this`
                }
              </span>
            ) : (
              <div></div>
            )}
            
            {/* Comments count */}
            {post.comments && post.comments.length > 0 && (
              <span
                onClick={() => setShowAllComments?.(prev => ({ ...prev, [post.post_id]: !prev[post.post_id] }))}
                style={{ 
                  cursor: 'pointer', 
                  fontSize: '12px',
                  color: '#6c757d',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {getPluralForm(post.comments.length, 'comment', 'comments')}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="post-actions" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        borderTop: '1px solid #e9ecef'
      }}>
        <button
          onClick={() => likedPosts[post.post_id] ? handleUnlike() : handleLike()}
          className="post-action-item"
          style={{
            color: likedPosts[post.post_id] ? '#e0245e' : '#6c757d',
            fontWeight: likedPosts[post.post_id] ? 'bold' : 'normal',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px 16px',
            borderRadius: 6,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f8f9fa';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <span style={{ fontSize: '14px' }}>
            {likedPosts[post.post_id] ? '❤️' : '🤍'}
          </span>
          Like
        </button>
        <button
          onClick={() => setShowCommentInput?.(prev => ({ ...prev, [post.post_id]: !prev[post.post_id] }))}
          className="post-action-item"
          style={{
            color: '#6c757d',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px 16px',
            borderRadius: 6,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f8f9fa';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <span style={{ fontSize: '14px' }}>💬</span>
          Comment
        </button>
        <button
          onClick={handleRepost}
          className="post-action-item"
          disabled={repostedPosts[post.post_id]}
          style={{
            color: repostedPosts[post.post_id] ? '#007bff' : '#6c757d',
            fontWeight: repostedPosts[post.post_id] ? 'bold' : 'normal',
            background: 'none',
            border: 'none',
            cursor: repostedPosts[post.post_id] ? 'not-allowed' : 'pointer',
            padding: '8px 16px',
            borderRadius: 6,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => {
            if (!repostedPosts[post.post_id]) {
              e.currentTarget.style.backgroundColor = '#f8f9fa';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <span style={{ fontSize: '14px' }}>🔄</span>
          Repost
        </button>
      </div>

      {showCommentInput[post.post_id] && (
        <div className="comment-input-container">
          <input
            type="text"
            placeholder="Type your comment..."
            value={commentInput[post.post_id] || ''}
            onChange={(e) => setCommentInput?.(prev => ({ ...prev, [post.post_id]: e.target.value }))}
          />
          <button onClick={handleCommentSubmit}>➡️</button>
        </div>
      )}

      {post.comments && post.comments.length > 0 && (
        <div className="comments-section" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #eee' }}>
                  {(showAllComments[post.post_id] ? post.comments : post.comments.slice(0, 2)).map((comment) => {
                    console.log('PostCard comment user_id:', comment.user.user_id);
                    return (
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
                          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{comment.user.f_name} {comment.user.l_name}</span>
                            {(Number(currentUserId) === Number(comment.user.user_id) || isOwn) && setEditingComment && setEditCommentContent && !editingComment[comment.comment_id] && (
                              <div style={{ position: 'relative' }} ref={(el) => { commentOptionsRefs.current[comment.comment_id] = el; }}>
                                <button
                                  onClick={() => setShowCommentOptions(prev => ({ ...prev, [comment.comment_id]: !prev[comment.comment_id] }))}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '16px',
                                    color: '#666',
                                    padding: 0,
                                    marginLeft: '8px',
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
                                      background: '#fff',
                                      border: '1px solid #ddd',
                                      borderRadius: '8px',
                                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                      zIndex: 1000,
                                      minWidth: '100px',
                                    }}
                                  >
                                    {String(currentUserId) === String(comment.user.user_id) && (
                                      <button
                                        onClick={() => handleEditComment(comment.comment_id)}
                                        style={{
                                          display: 'block',
                                          width: '100%',
                                          padding: '6px 10px',
                                          background: 'none',
                                          border: 'none',
                                          textAlign: 'left',
                                          cursor: 'pointer',
                                          fontSize: '14px',
                                        }}
                                      >
                                        Edit
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDeleteComment(comment.comment_id)}
                                      style={{
                                        display: 'block',
                                        width: '100%',
                                        padding: '6px 10px',
                                        background: 'none',
                                        border: 'none',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        color: '#e0245e',
                                      }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          {editingComment[comment.comment_id] ? (
                            <div style={{ marginTop: 4 }}>
                              <textarea
                                value={editCommentContent[comment.comment_id] || ''}
                                onChange={(e) => setEditCommentContent?.(prev => ({ ...prev, [comment.comment_id]: e.target.value }))}
                                style={{
                                  width: '100%',
                                  minHeight: '60px',
                                  padding: '6px',
                                  border: '1px solid #ddd',
                                  borderRadius: '8px',
                                  fontSize: '14px',
                                  resize: 'vertical',
                                }}
                              />
                              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                <button
                                  onClick={() => handleSaveEditComment(comment.comment_id)}
                                  style={{
                                    background: '#007bff',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    padding: '6px 12px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => handleCancelEditComment(comment.comment_id)}
                                  style={{
                                    background: '#6c757d',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    padding: '6px 12px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize: '14px', color: '#555' }}>
                              {renderTextWithLinks(comment.comment_content)}
                            </div>
                          )}
                          <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                            {formatTime(comment.date_created)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
          {post.comments.length > 2 && !showAllComments[post.post_id] && (
            <button
              className="view-all-comments-btn"
              style={{ fontSize: '12px', color: '#1C4E80', background: 'none', border: 'none', cursor: 'pointer', marginTop: '4px' }}
              onClick={() => setShowAllComments?.(prev => ({ ...prev, [post.post_id]: true }))}
            >
              View all comments ({post.comments.length})
            </button>
          )}
          {post.comments.length > 2 && showAllComments[post.post_id] && (
            <button
              className="hide-comments-btn"
              style={{ fontSize: '12px', color: '#007bff', background: 'none', border: 'none', cursor: 'pointer', marginTop: '4px' }}
              onClick={() => setShowAllComments?.(prev => ({ ...prev, [post.post_id]: false }))}
            >
              Hide comments
            </button>
          )}
        </div>
      )}

      {/* Likes Modal */}
      {showLikesModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
          onClick={() => setShowLikesModal(false)}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: 12,
              maxWidth: '400px',
              maxHeight: '80vh',
              overflow: 'hidden',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px', borderBottom: '1px solid #eee' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                  {getPluralForm(post.likes?.length || 0, 'Like', 'Likes')}
                </h3>
                <button
                  onClick={() => setShowLikesModal(false)}
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
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {post.likes && post.likes.length > 0 ? (
                post.likes.map((like) => (
                  <div
                    key={like.user_id}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #f0f0f0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    <img
                      src={like.profile_pic ? (String(like.profile_pic).startsWith('http') ? like.profile_pic : `http://127.0.0.1:8000${like.profile_pic}`) : ctulogo}
                      alt="Profile"
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        // Navigate to user profile based on current path
                        const currentPath = window.location.pathname;
                        if (currentPath.startsWith('/peso')) {
                          window.location.href = `/peso/profile/${like.user_id}`;
                        } else if (currentPath.startsWith('/ccict')) {
                          window.location.href = `/ccict/profile/${like.user_id}`;
                        } else {
                          window.location.href = `/alumni/profile/${like.user_id}`;
                        }
                      }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.src = ctulogo as unknown as string;
                      }}
                    />
                    <div>
                      <div 
                        style={{ 
                          fontWeight: 'bold', 
                          fontSize: '14px',
                          cursor: 'pointer',
                          color: '#174f84'
                        }}
                        onClick={() => {
                          // Navigate to user profile based on current path
                          const currentPath = window.location.pathname;
                          if (currentPath.startsWith('/peso')) {
                            window.location.href = `/peso/profile/${like.user_id}`;
                          } else if (currentPath.startsWith('/ccict')) {
                            window.location.href = `/ccict/profile/${like.user_id}`;
                          } else {
                            window.location.href = `/alumni/profile/${like.user_id}`;
                          }
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.textDecoration = 'underline';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.textDecoration = 'none';
                        }}
                      >
                        {like.f_name} {like.l_name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {/* Additional user info could go here */}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                  No likes yet
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Repost Modal */}
      <RepostModal
        isOpen={showRepostModal}
        onClose={() => setShowRepostModal(false)}
        onRepost={handleRepostSubmit}
        originalPost={post}
        currentUser={(() => {
          const userStr = localStorage.getItem('user');
          if (userStr) {
            const user = JSON.parse(userStr);
            return {
              name: `${user.f_name || ''} ${user.l_name || ''}`.trim(),
              profile_pic: user.profile_pic
            };
          }
          return { name: '', profile_pic: undefined };
        })()}
        formatTime={formatTime}
      />

      {/* Image Modal */}
      {showImageModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            cursor: 'pointer'
          }}
          onClick={() => setShowImageModal(false)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '90%',
              maxHeight: '90%',
              cursor: 'default'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={modalImageSrc}
              alt="Full size"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: 8
              }}
            />
            <button
              onClick={() => setShowImageModal(false)}
              style={{
                position: 'absolute',
                top: -40,
                right: 0,
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '50%',
                width: 32,
                height: 32,
                color: 'white',
                fontSize: 18,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostCard;
