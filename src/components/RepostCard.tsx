import React, { useState } from 'react';
import { 
  likeRepost, 
  unlikeRepost, 
  commentOnRepost, 
  deleteRepostComment, 
  editRepostComment,
  editRepost,
  deleteRepost
} from '../services/api';
import ctulogo from '../images/ctulogo.png';

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

  const isOwn = currentUserId === repostData.user.user_id;
  const reposterName = `${repostData.user.f_name} ${repostData.user.m_name || ''} ${repostData.user.l_name}`.trim();
  const reposterAvatar = repostData.user.profile_pic ? 
    (String(repostData.user.profile_pic).startsWith('http') ? 
      repostData.user.profile_pic : 
      `http://127.0.0.1:8000${repostData.user.profile_pic}`) : 
    ctulogo;

  const originalPosterName = `${originalPost.user?.f_name || ''} ${originalPost.user?.l_name || ''}`.trim();
  const originalPosterAvatar = originalPost.user?.profile_pic ? 
    (String(originalPost.user.profile_pic).startsWith('http') ? 
      originalPost.user.profile_pic : 
      `http://127.0.0.1:8000${originalPost.user.profile_pic}`) : 
    ctulogo;

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

        {/* Repost Actions */}
        <div style={{ 
          padding: '12px 16px 0',
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <button
            onClick={handleLike}
            style={{
              background: 'none',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              color: isLiked ? '#e74c3c' : '#666',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            <span style={{ fontSize: '16px' }}>{isLiked ?  '👍' : '👍'}</span>
            <span>{repostData.likes_count || 0}</span>
          </button>

          <button
            onClick={() => setShowCommentInput?.((prev: { [key: number]: boolean }) => ({
              ...prev,
              [repostData.repost_id]: !prev[repostData.repost_id]
            }))}
            style={{
              background: 'none',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              color: '#666',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            <span style={{ fontSize: '16px' }}>💬</span>
            <span>{repostData.comments_count || 0}</span>
          </button>
        </div>

        {/* Comment Input */}
        {showCommentInput[repostData.repost_id] && (
          <div style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <textarea
                value={commentInput[repostData.repost_id] || ''}
                onChange={(e) => setCommentInput?.((prev: { [key: number]: string }) => ({
                  ...prev,
                  [repostData.repost_id]: e.target.value
                }))}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '600', fontSize: '13px', color: '#1a1a1a' }}>
                        {`${comment.user.f_name} ${comment.user.l_name}`}
                      </span>
                      <span style={{ fontSize: '12px', color: '#666' }}>
                        {formatTime(comment.date_created)}
                      </span>
                    </div>
                    
                    {editingComment[comment.comment_id] ? (
                      <div>
                        <textarea
                          value={editCommentContent[comment.comment_id] || comment.comment_content}
                          onChange={(e) => setEditCommentContent(prev => ({ 
                            ...prev, 
                            [comment.comment_id]: e.target.value 
                          }))}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '13px',
                            resize: 'vertical',
                            minHeight: '60px'
                          }}
                        />
                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                          <button
                            onClick={() => handleEditComment(comment.comment_id)}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#007bff',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingComment(prev => ({ ...prev, [comment.comment_id]: false }));
                              setEditCommentContent(prev => ({ ...prev, [comment.comment_id]: '' }));
                            }}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#6c757d',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '13px', color: '#1a1a1a', lineHeight: '1.4' }}>
                        {comment.comment_content}
                      </div>
                    )}
                    
                    {currentUserId === comment.user.user_id && !editingComment[comment.comment_id] && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <button
                          onClick={() => {
                            setEditingComment(prev => ({ ...prev, [comment.comment_id]: true }));
                            setEditCommentContent(prev => ({ 
                              ...prev, 
                              [comment.comment_id]: comment.comment_content 
                            }));
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#007bff',
                            cursor: 'pointer',
                            fontSize: '12px',
                            padding: '0'
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteComment(comment.comment_id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#dc3545',
                            cursor: 'pointer',
                            fontSize: '12px',
                            padding: '0'
                          }}
                        >
                          Delete
                        </button>
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
