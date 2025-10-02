import React, { useState, useEffect, useRef } from 'react';
import * as api from '../services/api';
import { 
  commentOnForumPost, 
  deleteForumComment, 
  editForumComment,
  deleteForumPost,
  editForumPost,
  likeForumPost,
  unlikeForumPost,
  likeRepost,
  unlikeRepost,
  commentOnRepost,
  deleteRepostComment,
  editRepostComment,
  editRepost,
  deleteRepost
} from '../services/api';
import ctulogo from '../images/ctulogo.png';
import RepostModal from './RepostModal';
import PhotoGalleryModal from './PhotoGalleryModal';

interface RepostItem {
  repost_id: number;
  repost_date: string;
  repost_caption?: string;
  user: {
    m_name?: string;
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
    m_name?: string;
    l_name: string;
    profile_pic?: string;
  };
}

interface LikeItem {
  user_id: number;
  f_name: string;
  m_name?: string;
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
  onViewOriginalPost?: (originalPost: PostItem) => void; // Callback to view original post in modal
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
  onViewOriginalPost, // Optional callback to view original post
}) => {
  console.log('PostCard currentUserId:', currentUserId);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const optionsMenuRef = useRef<HTMLDivElement>(null);
  const commentOptionsRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const [showCommentOptions, setShowCommentOptions] = useState<{ [key: number]: boolean }>({});
  const [editingRepostCaption, setEditingRepostCaption] = useState<{ [key: number]: boolean }>({});
  const [editRepostCaptionContent, setEditRepostCaptionContent] = useState<{ [key: number]: string }>({});

  // Helper function to get proper singular/plural form
  const getPluralForm = (count: number, singular: string, plural: string) => {
    return count === 1 ? `${count} ${singular}` : `${count} ${plural}`;
  };

  // Photo gallery helpers
  const getImagesFromPost = (post: PostItem): string[] => {
    const images: string[] = [];
    
    // Add multiple images if available
    if (post.post_images && post.post_images.length > 0) {
      // Sort by order and extract URLs
      const sortedImages = [...post.post_images].sort((a, b) => a.order - b.order);
      images.push(...sortedImages.map(img => img.image_url));
    }
    
    // Add single image if no multiple images and single image exists
    if (images.length === 0 && post.post_image) {
      images.push(post.post_image);
    }
    
    return images;
  };

  const handleImageClick = (index: number) => {
    setCurrentPhotoIndex(index);
    setShowPhotoGallery(true);
  };

  const handlePreviousPhoto = () => {
    const images = getImagesFromPost(post);
    setCurrentPhotoIndex(prev => prev > 0 ? prev - 1 : images.length - 1);
  };

  const handleNextPhoto = () => {
    const images = getImagesFromPost(post);
    setCurrentPhotoIndex(prev => prev < images.length - 1 ? prev + 1 : 0);
  };

  // Helper function to detect and make URLs clickable
  const renderTextWithLinks = (text: string | undefined | null) => {
    if (!text) return null;
    
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
      if (isRepostPost) {
        // Use repost like API with correct repost_id
        await likeRepost(repostData?.repost_id || post.post_id);
      } else if (isForum) {
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
      if (isRepostPost) {
        // Use repost unlike API with correct repost_id
        await unlikeRepost(repostData?.repost_id || post.post_id);
      } else if (isForum) {
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
      if (isRepostPost) {
        // Use repost comment API with correct repost_id
        result = await commentOnRepost(repostData?.repost_id || post.post_id, commentInput[post.post_id]);
      } else if (isForum) {
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
      setShowRepostModal(false);
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
        if (isRepostPost) {
          // Use repost comment API with correct repost_id
          await deleteRepostComment(repostData?.repost_id || post.post_id, commentId);
        } else if (isForum) {
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
      if (isRepostPost) {
        // Use repost comment API with correct repost_id
        await editRepostComment(repostData?.repost_id || post.post_id, commentId, { comment_content: editCommentContent[commentId] });
      } else if (isForum) {
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

  const handleEditRepostCaption = () => {
    if (!isOwn) {
      alert('You can only edit your own repost captions');
      return;
    }
    setEditRepostCaptionContent(prev => ({ ...prev, [post.post_id]: repostData?.repost_caption || '' }));
    setEditingRepostCaption(prev => ({ ...prev, [post.post_id]: true }));
    setShowOptions?.(prev => ({ ...prev, [post.post_id]: false }));
  };

  const handleSaveEditRepostCaption = async () => {
    if (!repostData?.repost_id) return;
    if (!editRepostCaptionContent[post.post_id]?.trim()) return;
    if (!isOwn) {
      alert('You can only edit your own repost captions');
      return;
    }
    
    try {
      // Use repost edit API with correct repost_id
      await editRepost(repostData.repost_id, { caption: editRepostCaptionContent[post.post_id] });
      setEditingRepostCaption(prev => ({ ...prev, [post.post_id]: false }));
      onPostUpdate?.();
    } catch (error) {
      console.error('Error editing repost caption:', error);
      alert('Failed to update repost caption');
    }
  };

  const handleCancelEditRepostCaption = () => {
    setEditingRepostCaption(prev => ({ ...prev, [post.post_id]: false }));
    setEditRepostCaptionContent(prev => ({ ...prev, [post.post_id]: repostData?.repost_caption || '' }));
  };

  const handleDeleteRepost = async () => {
    if (!repostData?.repost_id) return;
    if (!isOwn) {
      alert('You can only delete your own reposts');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this repost?')) {
      try {
        // Use repost delete API with correct repost_id
        await deleteRepost(repostData.repost_id);
        onPostUpdate?.();
        alert('Repost deleted successfully');
      } catch (error) {
        console.error('Error deleting repost:', error);
        alert('Failed to delete repost');
      }
    }
    setShowOptions?.(prev => ({ ...prev, [post.post_id]: false }));
  };

  // Determine if this is a repost and get the appropriate data
  const isRepostPost = isRepost && repostData;
  const displayUser = isRepostPost ? repostData.user : post.user;
  // Render name: {f_name} {m_name} {l_name} if m_name exists, else {f_name} {l_name}
  const renderName = (obj: { f_name: string; m_name?: string; l_name: string }) =>
    `${obj.f_name} ${obj.m_name || ''} ${obj.l_name}`.trim();

  const repostDisplayName = isRepostPost
    ? renderName({ f_name: repostData.user.f_name, m_name: repostData.user.m_name, l_name: repostData.user.l_name })
    : displayName;
  const repostDisplayAvatar = isRepostPost 
    ? (repostData.user.profile_pic ? (String(repostData.user.profile_pic).startsWith('http') ? repostData.user.profile_pic : `http://127.0.0.1:8000${repostData.user.profile_pic}`) : ctulogo)
    : displayAvatar;

  return (
    <>
      {isRepostPost ? (
        // Repost structure
        <>
          {/* Main Repost Card */}
          <div className="profile-repost-card">
            {/* Reposter's header */}
            <div className="profile-repost-header">
              <div className="profile-repost-header-left">
                <img
                  src={repostDisplayAvatar}
                  alt="Profile"
                  className="profile-repost-profile-image"
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
                  <div className="profile-repost-author-details">
                    <span>{formatTime(repostData.repost_date)}</span>
                  </div>
                </div>
              </div>
              {/* Three dots menu for repost owner */}
              {isOwn && setShowOptions && (
                <div className="profile-repost-header-right" style={{ position: 'relative' }} ref={optionsMenuRef}>
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
                        width: '140px'
                      }}
                    >
                      <button
                        onClick={handleEditRepostCaption}
                        style={{
                  display: 'flex',
                  alignItems: 'center',
                          width: '100%',
                          padding: '10px 16px',
                          background: 'none',
                          border: 'none',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '14px',
                          gap: '10px',
                          borderRadius: '6px',
                          transition: 'all 0.2s ease',
                          color: '#374151'
                }}
                onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f3f4f6';
                          e.currentTarget.style.color = '#1f2937';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = '#374151';
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Edit
              </button>
              <button
                        onClick={handleDeleteRepost}
                style={{
                          display: 'flex',
                          alignItems: 'center',
                          width: '100%',
                          padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                          textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px',
                          color: '#dc2626',
                          gap: '10px',
                          borderRadius: '6px',
                          transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#fef2f2';
                          e.currentTarget.style.color = '#b91c1c';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = '#dc2626';
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3,6 5,6 21,6"/>
                          <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                          <line x1="10" y1="11" x2="10" y2="17"/>
                          <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                        Delete
              </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Repost caption */}
            {editingRepostCaption[post.post_id] ? (
              <div style={{ marginTop: 8 }}>
                <textarea
                  value={editRepostCaptionContent[post.post_id] || ''}
                  onChange={(e) => setEditRepostCaptionContent(prev => ({ ...prev, [post.post_id]: e.target.value }))}
                  style={{
                    width: '100%',
                    minHeight: '60px',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                  placeholder="Add a caption..."
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button
                    onClick={handleSaveEditRepostCaption}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      gap: '6px',
                      fontWeight: '500',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.3)';
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                      <polyline points="17,21 17,13 7,13 7,21"/>
                      <polyline points="7,3 7,8 15,8"/>
                    </svg>
                    Save
                  </button>
                  <button
                    onClick={handleCancelEditRepostCaption}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      gap: '6px',
                      fontWeight: '500',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 4px rgba(107, 114, 128, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(107, 114, 128, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(107, 114, 128, 0.3)';
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                    Cancel
                  </button>
            </div>
          </div>
            ) : (
              repostData.repost_caption && (
                <div className="profile-repost-caption">
                  {renderTextWithLinks(repostData.repost_caption)}
                </div>
              )
            )}

          {/* Inner Card - Original post without interactions */}
          {repostData.original_post && (
              <div 
                className="profile-repost-original"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onViewOriginalPost && repostData.original_post) {
                    onViewOriginalPost(repostData.original_post);
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
              {/* Original post header */}
                <div className="profile-repost-original-header">
                  <div className="profile-repost-original-header-left">
                  <img
                    src={repostData.original_post.user?.profile_pic ? (String(repostData.original_post.user.profile_pic).startsWith('http') ? repostData.original_post.user.profile_pic : `http://127.0.0.1:8000${repostData.original_post.user.profile_pic}`) : ctulogo}
                    alt="Profile"
                      className="profile-repost-original-profile-image"
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
                        className="profile-repost-original-author-info"
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
                      {repostData.original_post.user?.f_name} {repostData.original_post.user?.m_name} {repostData.original_post.user?.l_name}
                    </div>
                      <div className="profile-repost-original-author-details">
                      <span>{formatTime(repostData.original_post.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Original post content */}
              {repostData.original_post.post_content && (
                  <div className="profile-repost-original-content">
                  {renderTextWithLinks(repostData.original_post.post_content)}
                </div>
              )}

              {/* Original post images */}
              {(() => {
                const originalImages = getImagesFromPost(repostData.original_post);
                if (originalImages.length === 0) return null;

                return (
                <div style={{ marginTop: 8 }}>
                    {originalImages.length === 1 ? (
                      // Single image
                      <img
                        src={
                          typeof originalImages[0] === 'string' && originalImages[0].startsWith('/media/')
                            ? `http://127.0.0.1:8000${originalImages[0]}`
                            : originalImages[0]
                        }
                        alt="original post"
                      className="profile-repost-original-image"
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleImageClick(0)}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                          console.error('Failed to load original post image:', originalImages[0]);
                        }}
                      />
                    ) : (
                      // Multiple images grid for original post - Facebook style (smaller)
                      <div style={{
                        display: 'grid',
                        gap: 2,
                        borderRadius: 8,
                        overflow: 'hidden',
                        ...(originalImages.length === 2 ? {
                          gridTemplateColumns: '1fr 1fr',
                          height: '120px'
                        } : originalImages.length === 3 ? {
                          gridTemplateColumns: '2fr 1fr',
                          gridTemplateRows: '1fr 1fr',
                          height: '120px'
                        } : originalImages.length === 4 ? {
                          gridTemplateColumns: '1fr 1fr',
                          gridTemplateRows: '1fr 1fr',
                          height: '120px'
                        } : {
                          gridTemplateColumns: '1fr 1fr 1fr',
                          gridTemplateRows: '1fr 1fr',
                          height: '120px'
                        })
                      }}>
                        {originalImages.slice(0, originalImages.length <= 6 ? originalImages.length : 6).map((image, index) => {
                          let gridArea = '';
                          if (originalImages.length === 3) {
                            // Facebook 3-image layout: large left, two stacked right
                            gridArea = index === 0 ? '1 / 1 / 3 / 2' : `1 / 2 / 2 / 3`;
                            if (index === 2) gridArea = '2 / 2 / 3 / 3';
                          }
                          
                          return (
                            <div key={index} style={{ 
                              position: 'relative',
                              gridArea: gridArea,
                              overflow: 'hidden'
                            }}>
                              <img
                                src={
                                  typeof image === 'string' && image.startsWith('/media/')
                                    ? `http://127.0.0.1:8000${image}`
                                    : image
                                }
                                alt={`original post ${index + 1}`}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  cursor: 'pointer',
                                  transition: 'transform 0.2s ease'
                                }}
                                onClick={() => handleImageClick(index)}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'scale(1.02)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'scale(1)';
                                }}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  console.error('Failed to load original post image:', image);
                                }}
                              />
                              {/* Show "+X more" overlay for the 6th image if there are more than 6 */}
                              {index === 5 && originalImages.length > 6 && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    background: 'rgba(0, 0, 0, 0.75)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontSize: 14,
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    borderRadius: 6
                                  }}
                                  onClick={() => handleImageClick(5)}
                                >
                                  +{originalImages.length - 6}
                </div>
              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

            {/* Facebook-style likes and comments display for repost */}
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
                    >👍
                      {post.likes.length === 1 
                        ? `${post.likes[0].f_name} ${post.likes[0].m_name} ${post.likes[0].l_name} liked this`
                        : post.likes.length === 2
                        ? `${post.likes[0].f_name} ${post.likes[0].m_name} ${post.likes[0].l_name} and ${post.likes[1].f_name} ${post.likes[1].m_name} ${post.likes[1].l_name} liked this`
                        : `${post.likes[0].f_name} ${post.likes[0].m_name} ${post.likes[0].l_name} and ${post.likes.length - 1} others liked this`
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

            {/* Interaction buttons for the repost */}
            <div className="profile-repost-actions">
              <button
                onClick={() => {
                  console.log('Repost like button clicked:', {
                    post_id: post.post_id,
                    likedPosts: likedPosts,
                    isLiked: likedPosts[post.post_id],
                    likes: post.likes
                  });
                  likedPosts[post.post_id] ? handleUnlike() : handleLike();
                }}
                className={`profile-repost-action-item ${likedPosts[post.post_id] ? 'liked' : ''}`}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span style={{ fontSize: '14px' }}>
                  {(() => {
                    const isLiked = likedPosts[post.post_id];
                    console.log('Repost heart display:', {
                      post_id: post.post_id,
                      isLiked: isLiked,
                      likedPosts: likedPosts
                    });
                    return isLiked ? '❤️' : '🤍';
                  })()}
                </span>
                {post.likes_count === 1 ? '1 like' : (post.likes_count && post.likes_count > 1) ? `${post.likes_count} likes` : 'Like'}
              </button>
              <button
                onClick={() => setShowCommentInput?.(prev => ({ ...prev, [post.post_id]: !prev[post.post_id] }))}
                className="profile-repost-action-item"
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
                className={`profile-repost-action-item ${repostedPosts[post.post_id] ? 'reposted' : ''}`}
                disabled={repostedPosts[post.post_id]}
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

            {/* Comment input for repost */}
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

            {/* Comments section for repost */}
            {post.comments && post.comments.length > 0 && (
              <div className="comments-section" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #eee' }}>
                {(showAllComments[post.post_id] ? post.comments : post.comments.slice(0, 2)).map((comment) => {
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
                          <span>{comment.user.f_name} {comment.user.m_name} {comment.user.l_name}</span>
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
                                    width: '120px',
                                  }}
                                >
                                  {String(currentUserId) === String(comment.user.user_id) && (
                                    <button
                                      onClick={() => handleEditComment(comment.comment_id)}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        width: '100%',
                                        padding: '8px 12px',
                                        background: 'none',
                                        border: 'none',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        gap: '8px',
                                        borderRadius: '4px',
                                        transition: 'all 0.2s ease',
                                        color: '#374151'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                                        e.currentTarget.style.color = '#1f2937';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                        e.currentTarget.style.color = '#374151';
                                      }}
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                      </svg>
                                      Edit
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteComment(comment.comment_id)}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      width: '100%',
                                      padding: '8px 12px',
                                      background: 'none',
                                      border: 'none',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      fontSize: '14px',
                                      color: '#dc2626',
                                      gap: '8px',
                                      borderRadius: '4px',
                                      transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = '#fef2f2';
                                      e.currentTarget.style.color = '#b91c1c';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = 'transparent';
                                      e.currentTarget.style.color = '#dc2626';
                                    }}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="3,6 5,6 21,6"/>
                                      <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                                      <line x1="10" y1="11" x2="10" y2="17"/>
                                      <line x1="14" y1="11" x2="14" y2="17"/>
                                    </svg>
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
                                  display: 'flex',
                                  alignItems: 'center',
                                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '8px 16px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  gap: '6px',
                                  fontWeight: '500',
                                  transition: 'all 0.2s ease',
                                  boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.4)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'translateY(0)';
                                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.3)';
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                  <polyline points="17,21 17,13 7,13 7,21"/>
                                  <polyline points="7,3 7,8 15,8"/>
                                </svg>
                                Save
                              </button>
                              <button
                                onClick={() => handleCancelEditComment(comment.comment_id)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '8px 16px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  gap: '6px',
                                  fontWeight: '500',
                                  transition: 'all 0.2s ease',
                                  boxShadow: '0 2px 4px rgba(107, 114, 128, 0.3)'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(107, 114, 128, 0.4)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'translateY(0)';
                                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(107, 114, 128, 0.3)';
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18"/>
                                  <line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
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
          </div>
        </>
      ) : (
        // Regular post structure
        <div className="post-feed-card">
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
                  width: '140px'
                }}
              >
                <button
                  onClick={handleEditPost}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    padding: '10px 16px',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    gap: '10px',
                    borderRadius: '6px',
                    transition: 'all 0.2s ease',
                    color: '#374151'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                    e.currentTarget.style.color = '#1f2937';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#374151';
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Edit
                </button>
                <button
                  onClick={handleDeletePost}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    padding: '10px 16px',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#dc2626',
                    gap: '10px',
                    borderRadius: '6px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#fef2f2';
                    e.currentTarget.style.color = '#b91c1c';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#dc2626';
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3,6 5,6 21,6"/>
                    <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                  </svg>
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
                display: 'flex',
                alignItems: 'center',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '12px',
                gap: '6px',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.3)';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17,21 17,13 7,13 7,21"/>
                <polyline points="7,3 7,8 15,8"/>
              </svg>
              Save
            </button>
            <button
              onClick={handleCancelEditPost}
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '12px',
                gap: '6px',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 4px rgba(107, 114, 128, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(107, 114, 128, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(107, 114, 128, 0.3)';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
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

      {/* Multiple Images Display */}
      {(() => {
        const images = getImagesFromPost(post);
        if (images.length === 0) return null;

        return (
        <div style={{ marginTop: 8 }}>
            {images.length === 1 ? (
              // Single image
          <img
            src={
                  typeof images[0] === 'string' && images[0].startsWith('/media/')
                    ? `http://127.0.0.1:8000${images[0]}`
                    : images[0]
            }
            alt="post"
                style={{ 
                  maxWidth: '100%', 
                  borderRadius: 8, 
                  maxHeight: '400px', 
                  objectFit: 'cover',
                  cursor: 'pointer'
                }}
                onClick={() => handleImageClick(0)}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
                  console.error('Failed to load post image:', images[0]);
                }}
              />
            ) : (
              // Multiple images grid - Facebook style
              <div style={{
                display: 'grid',
                gap: 2,
                borderRadius: 12,
                overflow: 'hidden',
                ...(images.length === 2 ? {
                  gridTemplateColumns: '1fr 1fr',
                  height: '300px'
                } : images.length === 3 ? {
                  gridTemplateColumns: '2fr 1fr',
                  gridTemplateRows: '1fr 1fr',
                  height: '300px'
                } : images.length === 4 ? {
                  gridTemplateColumns: '1fr 1fr',
                  gridTemplateRows: '1fr 1fr',
                  height: '300px'
                } : {
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gridTemplateRows: '1fr 1fr',
                  height: '300px'
                })
              }}>
                {images.slice(0, images.length <= 6 ? images.length : 6).map((image, index) => {
                  let gridArea = '';
                  if (images.length === 3) {
                    // Facebook 3-image layout: large left, two stacked right
                    gridArea = index === 0 ? '1 / 1 / 3 / 2' : `1 / 2 / 2 / 3`;
                    if (index === 2) gridArea = '2 / 2 / 3 / 3';
                  }
                  
                  return (
                    <div key={index} style={{ 
                      position: 'relative',
                      gridArea: gridArea,
                      overflow: 'hidden'
                    }}>
                      <img
                        src={
                          typeof image === 'string' && image.startsWith('/media/')
                            ? `http://127.0.0.1:8000${image}`
                            : typeof image === 'string' && image.startsWith('data:')
                            ? image
                            : image
                        }
                        alt={`post ${index + 1}`}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          cursor: 'pointer',
                          transition: 'transform 0.2s ease'
                        }}
                        onClick={() => handleImageClick(index)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.02)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          console.error('Failed to load post image:', image);
                        }}
                      />
                      {/* Show "+X more" overlay for the 6th image if there are more than 6 */}
                      {index === 5 && images.length > 6 && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0, 0, 0, 0.75)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: 20,
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            borderRadius: 8
                          }}
                          onClick={() => handleImageClick(5)}
                        >
                          +{images.length - 6}
        </div>
      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

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
              >👍
                {post.likes.length === 1 
                  ? `${post.likes[0].f_name} ${post.likes[0].m_name} ${post.likes[0].l_name} liked this`
                  : post.likes.length === 2
                  ? `${post.likes[0].f_name} ${post.likes[0].m_name} ${post.likes[0].l_name} and ${post.likes[1].f_name} ${post.likes[1].m_name} ${post.likes[1].l_name} liked this`
                  : `${post.likes[0].f_name} ${post.likes[0].m_name} ${post.likes[0].l_name} and ${post.likes.length - 1} others liked this`
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
          onClick={() => {
            if (post.likes && post.likes.length > 0 && !likedPosts[post.post_id]) {
              setShowLikesModal(true);
            } else {
              likedPosts[post.post_id] ? handleUnlike() : handleLike();
            }
          }}
          className="post-action-item"
          style={{
            color: likedPosts[post.post_id] ? '#ef4444' : '#6c757d',
            fontWeight: likedPosts[post.post_id] ? '600' : '400',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f8f9fa';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <span style={{ 
            fontSize: '16px', 
            color: likedPosts[post.post_id] ? '#3b82f6' : '#6b7280',
            fontWeight: likedPosts[post.post_id] ? '900' : '400'
          }}>
            {likedPosts[post.post_id] ? '👍' : '👍'}
          </span>
          {post.likes_count === 1 ? '1 like' : (post.likes_count && post.likes_count > 1) ? `${post.likes_count} likes` : 'Like'}
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
                            <span>{comment.user.f_name} {comment.user.m_name} {comment.user.l_name}</span>
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
                                      width: '120px',
                                    }}
                                  >
                                    {String(currentUserId) === String(comment.user.user_id) && (
                                      <button
                                        onClick={() => handleEditComment(comment.comment_id)}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          width: '100%',
                                          padding: '8px 12px',
                                          background: 'none',
                                          border: 'none',
                                          textAlign: 'left',
                                          cursor: 'pointer',
                                          fontSize: '14px',
                                          gap: '8px',
                                          borderRadius: '4px',
                                          transition: 'all 0.2s ease',
                                          color: '#374151'
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.backgroundColor = '#f3f4f6';
                                          e.currentTarget.style.color = '#1f2937';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = 'transparent';
                                          e.currentTarget.style.color = '#374151';
                                        }}
                                      >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                        </svg>
                                        Edit
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDeleteComment(comment.comment_id)}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        width: '100%',
                                        padding: '8px 12px',
                                        background: 'none',
                                        border: 'none',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        color: '#dc2626',
                                        gap: '8px',
                                        borderRadius: '4px',
                                        transition: 'all 0.2s ease'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = '#fef2f2';
                                        e.currentTarget.style.color = '#b91c1c';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                        e.currentTarget.style.color = '#dc2626';
                                      }}
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3,6 5,6 21,6"/>
                                        <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                                        <line x1="10" y1="11" x2="10" y2="17"/>
                                        <line x1="14" y1="11" x2="14" y2="17"/>
                                      </svg>
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
                                    display: 'flex',
                                    alignItems: 'center',
                                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '8px 16px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    gap: '6px',
                                    fontWeight: '500',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.4)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.3)';
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                    <polyline points="17,21 17,13 7,13 7,21"/>
                                    <polyline points="7,3 7,8 15,8"/>
                                  </svg>
                                  Save
                                </button>
                                <button
                                  onClick={() => handleCancelEditComment(comment.comment_id)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '8px 16px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    gap: '6px',
                                    fontWeight: '500',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 2px 4px rgba(107, 114, 128, 0.3)'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(107, 114, 128, 0.4)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(107, 114, 128, 0.3)';
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"/>
                                    <line x1="6" y1="6" x2="18" y2="18"/>
                                  </svg>
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
                        {like.f_name} {like.m_name} {like.l_name}
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
              name: `${user.f_name || ''} ${user.m_name || ''} ${user.l_name || ''}`.trim(),
              profile_pic: user.profile_pic
            };
          }
          return { name: '', profile_pic: undefined };
        })()}
        formatTime={formatTime}
      />

      {/* Photo Gallery Modal */}
      <PhotoGalleryModal
        isOpen={showPhotoGallery}
        onClose={() => setShowPhotoGallery(false)}
        images={getImagesFromPost(post)}
        currentIndex={currentPhotoIndex}
        onPrevious={handlePreviousPhoto}
        onNext={handleNextPhoto}
        onImageClick={(index) => setCurrentPhotoIndex(index)}
      />
    </>
  );
};

export default PostCard;
