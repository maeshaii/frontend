import React, { useState } from 'react';
import * as api from '../services/api';
import ctulogo from '../images/ctulogo.png';

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
  likes?: { user_id: number }[];
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
}) => {
  console.log('PostCard currentUserId:', currentUserId);
  const [repostError, setRepostError] = useState<string | null>(null);

  const handleLike = async () => {
    if (!setLikedPosts) return;
    try {
      await api.likePost(post.post_id);
      setLikedPosts(prev => ({ ...prev, [post.post_id]: true }));
      onPostUpdate?.();
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleUnlike = async () => {
    if (!setLikedPosts) return;
    try {
      await api.unlikePost(post.post_id);
      setLikedPosts(prev => ({ ...prev, [post.post_id]: false }));
      onPostUpdate?.();
    } catch (error) {
      console.error('Error unliking post:', error);
    }
  };

  const handleCommentSubmit = async () => {
    if (!commentInput[post.post_id] || !setCommentInput) return;
    try {
      const result = await api.commentOnPost(post.post_id, commentInput[post.post_id]);
      if (result.success) {
        setCommentInput(prev => ({ ...prev, [post.post_id]: '' }));
        onPostUpdate?.();
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
    }
  };

  const handleRepost = async () => {
    if (!setRepostedPosts) return;
    setRepostError(null);
    try {
      await api.repostPost(post.post_id);
      setRepostedPosts(prev => ({ ...prev, [post.post_id]: true }));
      onPostUpdate?.();
    } catch (error: any) {
      setRepostError(error?.response?.data?.error || error?.message || 'Failed to repost');
    }
  };

  const handleEditPost = () => {
    if (!setEditPostContent || !setEditingPost) return;
    setEditPostContent(prev => ({ ...prev, [post.post_id]: post.post_content }));
    setEditingPost(prev => ({ ...prev, [post.post_id]: true }));
    setShowOptions?.(prev => ({ ...prev, [post.post_id]: false }));
  };

  const handleDeletePost = async () => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      try {
        await api.deletePost(post.post_id);
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
    try {
      // Implement edit post functionality here
      await api.editPost(post.post_id, { post_content: editPostContent[post.post_id] });
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
      setEditCommentContent(prev => ({ ...prev, [commentId]: comment.comment_content }));
      setEditingComment(prev => ({ ...prev, [commentId]: true }));
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (window.confirm('Are you sure you want to delete this comment?')) {
      try {
        await api.deleteComment(post.post_id, commentId);
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
    try {
      await api.editComment(post.post_id, commentId, { comment_content: editCommentContent[commentId] });
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

  return (
    <div className="post-feed-card">
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
              <span>{formatTime(post.created_at) || 'Unknown time'}</span>
            </div>
          </div>
        </div>
        {isOwn && setShowOptions && (
          <div className="post-header-right" style={{ position: 'relative' }}>
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
        <div className="post-content">{post.post_content}</div>
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
          onClick={() => likedPosts[post.post_id] ? handleUnlike() : handleLike()}
          className="post-action-item"
          style={{
            color: likedPosts[post.post_id] ? '#e0245e' : '#555',
            fontWeight: likedPosts[post.post_id] ? 'bold' : 'normal',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          {likedPosts[post.post_id] ? '❤️' : '🤍'} Like ({post.likes?.length || 0})
        </button>
        <button
          onClick={() => setShowCommentInput?.(prev => ({ ...prev, [post.post_id]: !prev[post.post_id] }))}
          className="post-action-item"
        >
          💬 Comment ({post.comments?.length || 0})
        </button>
        <button
          onClick={handleRepost}
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
          🔄 Repost ({post.reposts?.length || 0})
        </button>
      </div>

      {repostError && (
        <div style={{ color: 'red', fontSize: '12px', marginTop: '4px' }}>
          {repostError}
        </div>
      )}

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
                            {String(currentUserId) === String(comment.user.user_id) && setEditingComment && setEditCommentContent && setShowOptions && (
                              <div style={{ position: 'relative' }}>
                                <button
                                  onClick={() => setShowOptions?.(prev => ({ ...prev, [comment.comment_id]: !prev[comment.comment_id] }))}
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
                                {showOptions[comment.comment_id] && (
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
                              {comment.comment_content}
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
              style={{ fontSize: '12px', color: '#007bff', background: 'none', border: 'none', cursor: 'pointer', marginTop: '4px' }}
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
  );
};

export default PostCard;
