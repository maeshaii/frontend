import React, { useState, useEffect, useCallback } from 'react';
import { 
  likeRepost, 
  unlikeRepost, 
  commentOnRepost, 
  deleteRepostComment, 
  editRepostComment,
  editRepost,
  deleteRepost,
  createReply,
  getCommentReplies,
  editReply,
  deleteReply,
  searchAlumni,
  getFollowingForMentions
} from '../services/api';
import ctulogo from '../images/ctulogo.png';
import { getProfilePicUrl, handleProfilePicError } from '../utils/profilePicUtils';
import Reply from './Reply';
import ReplyInput from './ReplyInput';
import MentionInput from './MentionInput';

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
  replies_count?: number;
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
  post_images?: Array<{
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

interface RepostCardProps {
  repostData: RepostItem;
  originalPost: PostItem;
  currentUserId: number | null;
  formatTime: (iso?: string | null) => string;
  onPostUpdate?: () => void;
  showOptions?: { [key: string | number]: boolean };
  setShowOptions?: (fn: (prev: { [key: string | number]: boolean }) => { [key: string | number]: boolean }) => void;
  likedPosts?: { [key: number]: boolean };
  setLikedPosts?: (fn: (prev: { [key: number]: boolean }) => { [key: number]: boolean }) => void;
  showCommentInput?: { [key: number]: boolean };
  setShowCommentInput?: (fn: (prev: { [key: number]: boolean }) => { [key: number]: boolean }) => void;
  commentInput?: { [key: number]: string };
  setCommentInput?: (fn: (prev: { [key: number]: string }) => { [key: number]: string }) => void;
}

const RepostCard: React.FC<RepostCardProps> = ({
  repostData,
  originalPost,
  currentUserId,
  formatTime,
  onPostUpdate,
  showOptions = {},
  setShowOptions,
  likedPosts = {},
  setLikedPosts,
  showCommentInput = {},
  setShowCommentInput,
  commentInput = {},
  setCommentInput,
}) => {
  const [editingCaption, setEditingCaption] = useState(false);
  const [editCaptionContent, setEditCaptionContent] = useState(repostData.repost_caption || '');
  const [editingComment, setEditingComment] = useState<{ [key: number]: boolean }>({});
  const [editCommentContent, setEditCommentContent] = useState<{ [key: number]: string }>({});
  const [showCommentOptions, setShowCommentOptions] = useState<{ [key: number]: boolean }>({});
  
  // Reply state management
  const [showReplyInput, setShowReplyInput] = useState<{ [key: number]: boolean }>({});
  const [showReplies, setShowReplies] = useState<{ [key: number]: boolean }>({});
  const [commentReplies, setCommentReplies] = useState<{ [key: number]: any[] }>({});

  // @mention functionality for comments
  const [followingUsers, setFollowingUsers] = useState<any[]>([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState<{ [key: number]: boolean }>({});
  const [mentionSuggestions, setMentionSuggestions] = useState<{ [key: number]: any[] }>({});
  const [mentionStart, setMentionStart] = useState<{ [key: number]: number }>({});
  const [selectedMentionIndex, setSelectedMentionIndex] = useState<{ [key: number]: number }>({});

  // Helper function to get the correct profile path
  const getProfilePath = (userId: number) => {
    const currentPath = window.location.pathname;
    if (currentPath.startsWith('/peso')) {
      return `/peso/profile/${userId}`;
    } else if (currentPath.startsWith('/ccict')) {
      return `/ccict/profile/${userId}`;
    } else {
      return `/alumni/profile/${userId}`;
    }
  };

  const handleUserSearch = async (searchTerm: string) => {
    try {
      const response = await searchAlumni(searchTerm);
      if (response.results && response.results.length > 0) {
        // Take the first result (most relevant match)
        const user = response.results[0];
        const currentPath = window.location.pathname;
        if (currentPath.startsWith('/peso')) {
          window.location.href = `/peso/profile/${user.id}`;
        } else if (currentPath.startsWith('/ccict')) {
          window.location.href = `/ccict/profile/${user.id}`;
        } else {
          window.location.href = `/alumni/profile/${user.id}`;
        }
      } else {
        alert(`No user found with name "${searchTerm}"`);
      }
    } catch (error) {
      console.error('Error searching for user:', error);
      alert('Error searching for user. Please try again.');
    }
  };

  // Helper function to detect and make URLs and names clickable
  const renderTextWithLinks = (text: string | undefined | null) => {
    if (!text) return null;
    
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const mentionRegex = /@(\w+)/g;
    
    // Enhanced regex to detect names (First Last format)
    const nameRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
    
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
      
      // Handle mentions (@username)
      const mentionParts = part.split(mentionRegex);
      const processedMentionParts = mentionParts.map((mentionPart, mentionIndex) => {
        if (mentionRegex.test(mentionPart)) {
          // Extract username from @username
          const username = mentionPart.substring(1); // Remove @
          
          return (
            <button
              key={`${index}-${mentionIndex}`}
              onClick={(e) => {
                e.stopPropagation();
                // Search for the user and redirect to their profile
                handleUserSearch(username);
              }}
              style={{ 
                color: '#007bff', 
                fontWeight: '600',
                background: 'none',
                border: 'none',
                padding: '0',
                cursor: 'pointer',
                textDecoration: 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = 'none';
              }}
            >
              {mentionPart}
            </button>
          );
        }
        
        // Handle names (First Last format)
        const nameParts = mentionPart.split(nameRegex);
        return nameParts.map((namePart, nameIndex) => {
          if (nameRegex.test(namePart)) {
            return (
              <button
                key={`${index}-${mentionIndex}-${nameIndex}`}
                onClick={(e) => {
                  e.stopPropagation();
                  // Search for the user and redirect to their profile
                  handleUserSearch(namePart);
                }}
                style={{ 
                  color: '#007bff', 
                  fontWeight: '600',
                  background: 'none',
                  border: 'none',
                  padding: '0',
                  cursor: 'pointer',
                  textDecoration: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                {namePart}
              </button>
            );
          }
          return namePart;
        });
      });
      
      return processedMentionParts;
    });
  };

  // Reply helper functions
  const loadReplies = useCallback(async (commentId: number) => {
    try {
      console.log(`RepostCard: Loading replies for comment ${commentId}`);
      const response = await getCommentReplies(commentId);
      console.log(`RepostCard: Replies response for comment ${commentId}:`, response);
      setCommentReplies(prev => ({ ...prev, [commentId]: response.replies || [] }));
    } catch (error) {
      console.error('RepostCard: Error loading replies:', error);
    }
  }, []);

  const handleReplyAdded = (commentId: number) => {
    loadReplies(commentId);
    setShowReplyInput(prev => ({ ...prev, [commentId]: false }));
    // Automatically show replies after creating one
    setShowReplies(prev => ({ ...prev, [commentId]: true }));
    // Update the post to refresh replies_count
    onPostUpdate?.();
  };

  const toggleReplies = (commentId: number) => {
    if (!showReplies[commentId]) {
      loadReplies(commentId);
    }
    setShowReplies(prev => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  // Facebook-style: Load ALL replies for ALL comments immediately
  useEffect(() => {
    if (repostData.comments && repostData.comments.length > 0) {
      console.log('RepostCard: Facebook-style loading ALL replies for ALL comments');
      repostData.comments.forEach((comment: any) => {
        // Load replies for every comment (Facebook approach)
        loadReplies(comment.comment_id);
        // Always show replies (Facebook shows them by default)
        setShowReplies(prev => ({ ...prev, [comment.comment_id]: true }));
      });
    }
  }, [repostData.comments, loadReplies]);

  const isOwn = currentUserId === repostData.user.user_id;
  const reposterName = `${repostData.user.f_name} ${repostData.user.m_name || ''} ${repostData.user.l_name}`.trim();
  const reposterAvatar = getProfilePicUrl(repostData.user.profile_pic);

  const originalPosterName = `${originalPost.user?.f_name || ''} ${originalPost.user?.l_name || ''}`.trim();
  const originalPosterAvatar = getProfilePicUrl(originalPost.user?.profile_pic);

  const isLiked = likedPosts[repostData.repost_id] || false;

  const handleLike = async () => {
    if (!currentUserId) return;
    
    try {
      if (isLiked) {
        await unlikeRepost(repostData.repost_id);
        setLikedPosts?.((prev: { [key: number]: boolean }) => ({
          ...prev,
          [repostData.repost_id]: false
        }));
      } else {
        await likeRepost(repostData.repost_id);
        setLikedPosts?.((prev: { [key: number]: boolean }) => ({
          ...prev,
          [repostData.repost_id]: true
        }));
      }
      onPostUpdate?.();
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleCommentSubmit = async () => {
    if (!currentUserId || !commentInput[repostData.repost_id]?.trim()) return;
    
    try {
      await commentOnRepost(repostData.repost_id, commentInput[repostData.repost_id]);
      setCommentInput?.((prev: { [key: number]: string }) => ({
        ...prev,
        [repostData.repost_id]: ''
      }));
      setShowCommentInput?.((prev: { [key: number]: boolean }) => ({
        ...prev,
        [repostData.repost_id]: false
      }));
      onPostUpdate?.();
    } catch (error) {
      console.error('Error submitting comment:', error);
    }
  };

  // Load following users for @mentions
  useEffect(() => {
    const loadFollowing = async () => {
      try {
        const response = await getFollowingForMentions();
        if (response.success) {
          setFollowingUsers(response.following);
        }
      } catch (error) {
        console.error('Error loading following users:', error);
      }
    };
    loadFollowing();
  }, []);

  // @mention functionality for comments
  const handleCommentInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>, itemId: number) => {
    const newValue = e.target.value;
    setCommentInput?.((prev: { [key: number]: string }) => ({
      ...prev,
      [itemId]: newValue
    }));

    const cursorPosition = e.target.selectionStart || 0;
    const textBeforeCursor = newValue.substring(0, cursorPosition);
    
    // Find the last @ symbol before cursor
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      
      // Check if there's no space after @ (meaning we're typing a mention)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionStart(prev => ({ ...prev, [itemId]: lastAtIndex }));
        setShowMentionSuggestions(prev => ({ ...prev, [itemId]: true }));
        
        // Filter suggestions based on what's typed after @
        const filteredSuggestions = followingUsers.filter(user =>
          user.name.toLowerCase().includes(textAfterAt.toLowerCase()) ||
          user.f_name.toLowerCase().includes(textAfterAt.toLowerCase()) ||
          user.l_name.toLowerCase().includes(textAfterAt.toLowerCase())
        );
        setMentionSuggestions(prev => ({ ...prev, [itemId]: filteredSuggestions }));
        setSelectedMentionIndex(prev => ({ ...prev, [itemId]: 0 }));
      } else {
        setShowMentionSuggestions(prev => ({ ...prev, [itemId]: false }));
      }
    } else {
      setShowMentionSuggestions(prev => ({ ...prev, [itemId]: false }));
    }
  };

  const selectMention = (user: any, itemId: number) => {
    const mentionStartPos = mentionStart[itemId];
    if (mentionStartPos === undefined) return;

    const currentValue = commentInput[itemId] || '';
    const beforeMention = currentValue.substring(0, mentionStartPos);
    const afterMention = currentValue.substring(currentValue.length);
    
    const newValue = beforeMention + `@${user.name} ` + afterMention;
    setCommentInput?.((prev: { [key: number]: string }) => ({
      ...prev,
      [itemId]: newValue
    }));
    
    setShowMentionSuggestions(prev => ({ ...prev, [itemId]: false }));
    setMentionStart(prev => ({ ...prev, [itemId]: -1 }));
  };

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, itemId: number) => {
    if (!showMentionSuggestions[itemId]) {
      return; // Let default behavior handle Enter for textarea
    }

    const suggestions = mentionSuggestions[itemId] || [];
    const selectedIndex = selectedMentionIndex[itemId] || 0;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedMentionIndex(prev => ({ 
          ...prev, 
          [itemId]: selectedIndex < suggestions.length - 1 ? selectedIndex + 1 : 0 
        }));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedMentionIndex(prev => ({ 
          ...prev, 
          [itemId]: selectedIndex > 0 ? selectedIndex - 1 : suggestions.length - 1 
        }));
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (suggestions[selectedIndex]) {
          selectMention(suggestions[selectedIndex], itemId);
        }
        break;
      case 'Escape':
        setShowMentionSuggestions(prev => ({ ...prev, [itemId]: false }));
        break;
    }
  };

  const handleSaveCaption = async () => {
    try {
      await editRepost(repostData.repost_id, { caption: editCaptionContent });
      setEditingCaption(false);
      onPostUpdate?.();
    } catch (error) {
      console.error('Error saving caption:', error);
    }
  };

  const handleDeleteRepost = async () => {
    if (!window.confirm('Are you sure you want to delete this repost?')) return;
    
    try {
      await deleteRepost(repostData.repost_id);
      onPostUpdate?.();
    } catch (error) {
      console.error('Error deleting repost:', error);
    }
  };

  const handleEditComment = async (commentId: number) => {
    try {
      await editRepostComment(repostData.repost_id, commentId, { comment_content: editCommentContent[commentId] });
      setEditingComment((prev) => ({ ...prev, [commentId]: false }));
      setEditCommentContent((prev) => ({ ...prev, [commentId]: '' }));
      onPostUpdate?.();
    } catch (error) {
      console.error('Error editing comment:', error);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    
    try {
      await deleteRepostComment(repostData.repost_id, commentId);
      onPostUpdate?.();
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const getImagesFromPost = (post: PostItem) => {
    const images = [];
    
    // Add main post image if exists
    if (post.post_image) {
      images.push({
        image_id: 0,
        image_url: post.post_image,
        order: 0
      });
    }
    
    // Add post_images array if exists
    if (post.post_images && Array.isArray(post.post_images)) {
      images.push(...post.post_images);
    }
    
    return images.sort((a, b) => a.order - b.order);
  };

  return (
    <div style={{
      marginBottom: '16px',
      border: '1px solid #e1e5e9',
      borderRadius: '12px',
      overflow: 'hidden',
      backgroundColor: '#fafbfc'
    }}>
      {/* Repost Header */}
      <div style={{
        padding: '12px 16px',
        backgroundColor: '#f8f9fa',
        borderBottom: '1px solid #e1e5e9'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img 
            src={reposterAvatar} 
            alt={reposterName}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              objectFit: 'cover'
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '600', fontSize: '14px', color: '#1a1a1a' }}>
              {reposterName}
            </div>
            <div style={{ fontSize: '12px', color: '#666', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>🔄</span>
              <span>Reposted</span>
              <span>•</span>
              <span>{formatTime(repostData.repost_date)}</span>
            </div>
          </div>
          {isOwn && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowOptions?.(prev => ({ 
                  ...prev, 
                  [`repost-${repostData.repost_id}`]: !prev[`repost-${repostData.repost_id}`] 
                }))}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: '#666',
                  padding: '4px'
                }}
              >
                ⋯
              </button>
              {showOptions[`repost-${repostData.repost_id}`] && (
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  backgroundColor: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  zIndex: 1000,
                  minWidth: '120px'
                }}>
                  <button
                    onClick={() => {
                      setEditingCaption(true);
                      setShowOptions?.(prev => ({ ...prev, [`repost-${repostData.repost_id}`]: false }));
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: 'none',
                      background: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDeleteRepost}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: 'none',
                      background: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: '#dc3545'
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Repost Caption */}
        {editingCaption ? (
          <div style={{ marginTop: '8px' }}>
            <textarea
              value={editCaptionContent}
              onChange={(e) => setEditCaptionContent(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                resize: 'vertical',
                minHeight: '60px'
              }}
              placeholder="Add a caption..."
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                onClick={handleSaveCaption}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingCaption(false);
                  setEditCaptionContent(repostData.repost_caption || '');
                }}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          repostData.repost_caption && (
            <div style={{ 
              marginTop: '8px', 
              fontSize: '14px', 
              color: '#1a1a1a',
              lineHeight: '1.4'
            }}>
              {repostData.repost_caption}
            </div>
          )
        )}
      </div>

      {/* Original Post Content */}
      <div style={{ padding: '16px' }}>
        <div style={{
          border: '1px solid #e1e5e9',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: 'white'
        }}>
          {/* Original Post Header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img 
                src={originalPosterAvatar} 
                alt={originalPosterName}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  objectFit: 'cover'
                }}
              />
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px', color: '#1a1a1a' }}>
                  {originalPosterName}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {formatTime(originalPost.created_at)}
                </div>
              </div>
            </div>
          </div>

          {/* Original Post Content */}
          <div style={{ padding: '12px 16px' }}>
            {originalPost.post_content && (
              <div style={{ 
                fontSize: '14px', 
                color: '#1a1a1a', 
                lineHeight: '1.5',
                marginBottom: '12px'
              }}>
                {originalPost.post_content}
              </div>
            )}

            {/* Original Post Images */}
            {getImagesFromPost(originalPost).length > 0 && (
              <div style={{ marginTop: '12px' }}>
                {getImagesFromPost(originalPost).map((image, index) => (
                  <img
                    key={image.image_id}
                    src={image.image_url}
                    alt={`Post image ${index + 1}`}
                    style={{
                      width: '100%',
                      maxHeight: '400px',
                      objectFit: 'cover',
                      borderRadius: '6px',
                      marginBottom: index < getImagesFromPost(originalPost).length - 1 ? '8px' : '0'
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Like Display Section */}
        {repostData.likes && repostData.likes.length > 0 && (
          <div style={{ 
            padding: '8px 16px',
            borderTop: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span
              style={{ 
                cursor: 'pointer', 
                fontSize: '12px',
                fontWeight: '500',
                padding: '4px 8px',
                borderRadius: '4px',
                transition: 'background-color 0.2s ease',
                color: '#6b7280'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f8f9fa';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >👍
              {repostData.likes.length === 1 
                ? `${repostData.likes[0].f_name || ''} ${repostData.likes[0].l_name || ''}`.trim() + ' liked this'
                : repostData.likes.length === 2
                ? `${repostData.likes[0].f_name || ''} ${repostData.likes[0].l_name || ''}`.trim() + ` and ${repostData.likes[1].f_name || ''} ${repostData.likes[1].l_name || ''}`.trim() + ' liked this'
                : `${repostData.likes[0].f_name || ''} ${repostData.likes[0].l_name || ''}`.trim() + ` and ${repostData.likes.length - 1} others liked this`
              }
            </span>
          </div>
        )}


        {/* Comment Input */}
        {showCommentInput[repostData.repost_id] && (
          <div style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', position: 'relative' }}>
              <textarea
                value={commentInput[repostData.repost_id] || ''}
                onChange={(e) => handleCommentInputChange(e, repostData.repost_id)}
                onKeyDown={(e) => handleCommentKeyDown(e, repostData.repost_id)}
                placeholder="Write a comment..."
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '20px',
                  fontSize: '14px',
                  resize: 'none',
                  minHeight: '36px',
                  maxHeight: '100px'
                }}
              />
              <button
                onClick={handleCommentSubmit}
                disabled={!commentInput[repostData.repost_id]?.trim()}
                style={{
                  padding: '8px 16px',
                  backgroundColor: commentInput[repostData.repost_id]?.trim() ? '#007bff' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '20px',
                  cursor: commentInput[repostData.repost_id]?.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Post
              </button>
              
              {/* @mention suggestions dropdown */}
              {showMentionSuggestions[repostData.repost_id] && mentionSuggestions[repostData.repost_id]?.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: '80px', // Leave space for the Post button
                  backgroundColor: 'white',
                  border: '1px solid #e4e6ea',
                  borderRadius: '8px',
                  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)',
                  zIndex: 1000,
                  maxHeight: '200px',
                  overflowY: 'auto',
                  marginTop: '4px'
                }}>
                  <div style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid #e4e6ea',
                    backgroundColor: '#f8f9fa',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#65676b'
                  }}>
                    Mention someone
                  </div>
                  {mentionSuggestions[repostData.repost_id]?.map((user, index) => (
                    <div
                      key={user.user_id}
                      onClick={() => selectMention(user, repostData.repost_id)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        backgroundColor: index === selectedMentionIndex[repostData.repost_id] ? '#e3f2fd' : 'transparent',
                        borderBottom: index < (mentionSuggestions[repostData.repost_id]?.length - 1) ? '1px solid #f0f0f0' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        transition: 'background-color 0.1s ease'
                      }}
                      onMouseEnter={() => setSelectedMentionIndex(prev => ({ ...prev, [repostData.repost_id]: index }))}
                    >
                      <img
                        src={getProfilePicUrl(user.profile_pic)}
                        alt={user.name}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '1px solid #e4e6ea'
                        }}
                        onError={(e) => handleProfilePicError(e)}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontSize: '14px', 
                          fontWeight: '600',
                          color: '#1c1e21',
                          marginBottom: '2px'
                        }}>
                          {user.f_name} {user.m_name || ''} {user.l_name}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Comments */}
        {repostData.comments && repostData.comments.length > 0 && (
          <div style={{ padding: '0 16px 12px' }}>
            {repostData.comments.map((comment) => (
              <div key={comment.comment_id} style={{ 
                marginBottom: '8px',
                padding: '8px 0',
                borderBottom: '1px solid #f0f0f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <img 
                    src={comment.user.profile_pic ? 
                      (String(comment.user.profile_pic).startsWith('http') ? 
                        comment.user.profile_pic : 
                        `http://127.0.0.1:8000${comment.user.profile_pic}`) : 
                      ctulogo
                    }
                    alt={`${comment.user.f_name} ${comment.user.l_name}`}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      objectFit: 'cover'
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => window.location.href = getProfilePath(comment.user.user_id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '0',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '13px',
                            color: '#1a1a1a',
                            textDecoration: 'none'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#007bff';
                            e.currentTarget.style.textDecoration = 'underline';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#1a1a1a';
                            e.currentTarget.style.textDecoration = 'none';
                          }}
                        >
                          {`${comment.user.f_name} ${comment.user.l_name}`}
                        </button>
                        <span style={{ fontSize: '12px', color: '#666' }}>
                          {formatTime(comment.date_created)}
                        </span>
                      </div>
                      {currentUserId === comment.user.user_id && !editingComment[comment.comment_id] && (
                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={() => setShowCommentOptions(prev => ({ 
                              ...prev, 
                              [comment.comment_id]: !prev[comment.comment_id] 
                            }))}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '16px',
                              color: '#666',
                              padding: '4px',
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
                              <button
                                onClick={() => {
                                  setEditingComment(prev => ({ ...prev, [comment.comment_id]: true }));
                                  setEditCommentContent(prev => ({ 
                                    ...prev, 
                                    [comment.comment_id]: comment.comment_content 
                                  }));
                                  setShowCommentOptions(prev => ({ ...prev, [comment.comment_id]: false }));
                                }}
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
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm('Are you sure you want to delete this comment?')) {
                                    handleDeleteComment(comment.comment_id);
                                  }
                                  setShowCommentOptions(prev => ({ ...prev, [comment.comment_id]: false }));
                                }}
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
                                  color: '#dc2626'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#fef2f2';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3,6 5,6 21,6"></polyline>
                                  <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
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
                          value={editCommentContent[comment.comment_id] || comment.comment_content}
                          onChange={(e) => setEditCommentContent(prev => ({ 
                            ...prev, 
                            [comment.comment_id]: e.target.value 
                          }))}
                          style={{
                            width: '100%',
                            minHeight: '60px',
                            padding: '6px',
                            border: '1px solid #ddd',
                            borderRadius: '8px',
                            fontSize: '14px',
                            resize: 'vertical',
                          }}
                          placeholder="Edit your comment..."
                        />
                        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                          <button
                            onClick={() => handleEditComment(comment.comment_id)}
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
                            onClick={() => {
                              setEditingComment(prev => ({ ...prev, [comment.comment_id]: false }));
                              setEditCommentContent(prev => ({ ...prev, [comment.comment_id]: '' }));
                            }}
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
                      <div style={{ fontSize: '14px', color: '#555', marginTop: '2px' }}>
                        {renderTextWithLinks(comment.comment_content)}
                      </div>
                    )}
                    
                    {/* Reply button */}
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button
                        onClick={() => setShowReplyInput(prev => ({ ...prev, [comment.comment_id]: !prev[comment.comment_id] }))}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#007bff',
                          cursor: 'pointer',
                          fontSize: '11px',
                          padding: '2px 4px',
                          borderRadius: '4px',
                          transition: 'background-color 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f0f8ff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        Reply
                      </button>
                    </div>
                    
                    {/* Reply Input */}
                    {showReplyInput[comment.comment_id] && (
                      <ReplyInput
                        commentId={comment.comment_id}
                        currentUserId={currentUserId || undefined}
                        displayName={`${repostData.user.f_name} ${repostData.user.l_name}`}
                        displayAvatar={reposterAvatar}
                        onReplyAdded={() => handleReplyAdded(comment.comment_id)}
                        commentAuthor={{
                          user_id: comment.user.user_id,
                          f_name: comment.user.f_name,
                          m_name: '',
                          l_name: comment.user.l_name,
                          name: `${comment.user.f_name} ${comment.user.l_name}`.trim()
                        }}
                      />
                    )}
                    
                    {/* Facebook-style Replies - Always show if available */}
                    {(() => {
                      const replies = commentReplies[comment.comment_id];
                      console.log(`RepostCard: Facebook-style rendering replies for comment ${comment.comment_id}:`, {
                        hasReplies: !!replies,
                        repliesLength: replies?.length || 0,
                        repliesData: replies
                      });
                      return replies && replies.length > 0;
                    })() && (
                      <div style={{ marginTop: '8px' }}>
                        {/* Facebook-style: Show ALL replies by default */}
                        {commentReplies[comment.comment_id].map((reply) => (
                          <Reply
                            key={reply.reply_id}
                            reply={reply}
                            commentId={comment.comment_id}
                            currentUserId={currentUserId || undefined}
                            formatTime={formatTime}
                            onReplyUpdate={() => loadReplies(comment.comment_id)}
                            displayName={`${repostData.user.f_name} ${repostData.user.l_name}`}
                            displayAvatar={reposterAvatar}
                          />
                        ))}
                      </div>
                    )}
                    
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default RepostCard;
