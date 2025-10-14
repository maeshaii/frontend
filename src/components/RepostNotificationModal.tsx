import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { getProfilePicUrl, handleProfilePicError } from '../utils/profilePicUtils';
import ctulogo from '../images/ctulogo.png';

interface RepostNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  repostId: string;
  reposterName?: string;
}

const RepostNotificationModal: React.FC<RepostNotificationModalProps> = ({ isOpen, onClose, repostId, reposterName }) => {
  const [repost, setRepost] = useState<any>(null);
  const [originalPost, setOriginalPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [likedReposts, setLikedReposts] = useState<{ [key: number]: boolean }>({});
  const [repostedReposts, setRepostedReposts] = useState<{ [key: number]: boolean }>({});

  useEffect(() => {
    if (isOpen && repostId) {
      fetchRepostData();
    }
  }, [isOpen, repostId]);

  // Initialize liked/reposted states when repost data is loaded
  useEffect(() => {
    if (repost) {
      const initialLiked: { [key: number]: boolean } = {};
      const initialReposted: { [key: number]: boolean } = {};
      
      // Get current user ID from localStorage
      const userStr = localStorage.getItem('user');
      const currentUserId = userStr ? JSON.parse(userStr).id || JSON.parse(userStr).user_id : null;
      
      // Check if current user has liked this repost
      if (repost.likes && Array.isArray(repost.likes) && currentUserId) {
        const hasLiked = repost.likes.some((like: any) => 
          like.user?.user_id === currentUserId || like.user_id === currentUserId
        );
        initialLiked[repost.repost_id] = hasLiked;
      } else {
        initialLiked[repost.repost_id] = false;
      }
      
      // Check if current user has reposted this repost (for now, assume false)
      initialReposted[repost.repost_id] = false;
      
      setLikedReposts(initialLiked);
      setRepostedReposts(initialReposted);
    }
  }, [repost]);

  const fetchRepostData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch the specific repost by ID
      const repostResponse = await api.get(`reposts/${repostId}/detail/`);
      console.log('Repost data received:', repostResponse.data);
      console.log('Likes data:', repostResponse.data.likes);
      setRepost(repostResponse.data);
      setOriginalPost(repostResponse.data.original);

    } catch (err) {
      console.error('Error fetching repost data:', err);
      setError('Failed to load repost data');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (iso?: string | null): string => {
    if (!iso) return 'Unknown time';
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  const renderName = (user: any) => {
    if (!user) return 'Unknown User';
    return `${user.f_name || ''} ${user.m_name || ''} ${user.l_name || ''}`.trim() || 'Unknown User';
  };

  const renderTextWithLinks = (text: string) => {
    if (!text) return '';
    
    // Split by URLs and @mentions
    const parts = text.split(/(https?:\/\/[^\s]+|@\w+)/);
    
    return parts.map((part, index) => {
      if (part.match(/^https?:\/\/.+/)) {
        return (
          <a key={index} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc', textDecoration: 'underline' }}>
            {part}
          </a>
        );
      } else if (part.startsWith('@')) {
        return (
          <span key={index} style={{ color: '#0066cc', fontWeight: '500' }}>
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const getImagesFromPost = (post: any) => {
    const images = [];
    
    // Add single image if exists
    if (post.post_image) {
      images.push(post.post_image);
    }
    
    // Add multiple images if exists (for regular posts)
    if (post.post_images && post.post_images.length > 0) {
      images.push(...post.post_images.map((img: any) => img.image_url));
    }
    
    // Add donation images if exists (for donation posts)
    if (post.images && post.images.length > 0) {
      images.push(...post.images.map((img: any) => img.image_url));
    }
    
    return images;
  };

  const handleLike = async (repostId: number) => {
    try {
      if (likedReposts[repostId]) {
        // Unlike
        await api.delete(`reposts/${repostId}/like/`);
        setLikedReposts(prev => ({ ...prev, [repostId]: false }));
        console.log('Repost unliked successfully');
      } else {
        // Like
        await api.post(`reposts/${repostId}/like/`);
        setLikedReposts(prev => ({ ...prev, [repostId]: true }));
        console.log('Repost liked successfully');
      }
      
      // Refresh the repost data to update likes display
      fetchRepostData();
    } catch (error) {
      console.error('Error liking/unliking repost:', error);
      alert('Failed to like/unlike repost. Please try again.');
    }
  };

  const handleRepost = async (repostId: number) => {
    try {
      if (repostedReposts[repostId]) {
        // Unrepost (delete repost)
        await api.delete(`reposts/${repostId}/`);
        setRepostedReposts(prev => ({ ...prev, [repostId]: false }));
        console.log('Repost deleted successfully');
      } else {
        // Repost
        await api.post(`posts/${originalPost?.post_id}/repost/`, { caption: '' });
        setRepostedReposts(prev => ({ ...prev, [repostId]: true }));
        console.log('Repost created successfully');
      }
    } catch (error) {
      console.error('Error reposting:', error);
      alert('Failed to repost. Please try again.');
    }
  };

  const handleComment = async (repostId: number) => {
    try {
      // For now, create a simple comment
      const commentContent = prompt('Enter your comment:');
      if (commentContent && commentContent.trim()) {
        const result = await api.post(`reposts/${repostId}/comments/`, {
          comment_content: commentContent.trim()
        });
        
        if (result.data && result.data.success) {
          alert('Comment posted successfully!');
          // Refresh the repost data to show the new comment
          fetchRepostData();
        } else {
          alert('Failed to post comment. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      alert('Failed to post comment. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Add CSS styles for repost card */}
      <style>
        {`
          .profile-repost-card {
            background: white;
            border: 1px solid #e1e8ed;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }

          .profile-repost-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 12px;
          }

          .profile-repost-header-left {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .profile-repost-header-right {
            display: flex;
            align-items: center;
          }

          .profile-repost-profile-image {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            object-fit: cover;
            cursor: pointer;
          }

          .profile-repost-author-info {
            cursor: pointer;
            font-weight: 600;
            font-size: 14px;
            color: #333;
            text-transform: uppercase;
          }

          .profile-repost-author-details {
            color: #666;
            font-size: 12px;
          }

          .profile-repost-caption {
            font-size: 14px;
            color: #333;
            margin-bottom: 12px;
            line-height: 1.5;
          }

          .profile-repost-original {
            background: #f8f9fa;
            border: 1px solid #e1e8ed;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 12px;
          }

          .profile-repost-original-header {
            margin-bottom: 8px;
          }

          .profile-repost-original-header-left {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .profile-repost-original-profile-image {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            object-fit: cover;
            cursor: pointer;
          }

          .profile-repost-original-author-info {
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            color: #333;
          }

          .profile-repost-original-author-details {
            color: #666;
            font-size: 11px;
          }

          .profile-repost-original-content {
            font-size: 13px;
            color: #333;
            line-height: 1.4;
            margin-bottom: 8px;
          }

          .profile-repost-original-image {
            width: 100%;
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            object-fit: cover;
          }

          .profile-repost-actions {
            display: flex;
            justify-content: space-around;
            border-top: 1px solid #e1e8ed;
            padding-top: 8px;
          }

          .profile-repost-action-item {
            background: none;
            border: none;
            cursor: pointer;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 14px;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 4px;
          }

          .profile-repost-action-item:hover {
            background-color: #f8f9fa;
          }

          .profile-repost-action-item.liked {
            color: #e0245e;
            font-weight: 600;
          }

          .profile-repost-action-item.reposted {
            color: #1da1f2;
            font-weight: 600;
          }
        `}
      </style>

      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          position: 'relative'
        }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666',
              zIndex: 1001,
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold'
            }}
            title="Close"
          >
            ×
          </button>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              Loading repost...
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#dc3545' }}>
              {error}
            </div>
          ) : repost ? (
            <div style={{
              padding: '16px',
              backgroundColor: 'white'
            }}>
              {/* EXACT REPOST CARD STRUCTURE FROM PostCard.tsx */}
              <div className="profile-repost-card">
                {/* Reposter's header */}
                <div className="profile-repost-header">
                  <div className="profile-repost-header-left">
                    <img
                      src={getProfilePicUrl(repost.user?.profile_pic)}
                      alt="Profile"
                      className="profile-repost-profile-image"
                      onError={handleProfilePicError}
                      onClick={() => {
                        if (repost.user?.user_id) {
                          const currentPath = window.location.pathname;
                          if (currentPath.startsWith('/peso')) {
                            window.location.href = `/peso/profile/${repost.user.user_id}`;
                          } else if (currentPath.startsWith('/ccict')) {
                            window.location.href = `/ccict/profile/${repost.user.user_id}`;
                          } else {
                            window.location.href = `/alumni/profile/${repost.user.user_id}`;
                          }
                        }
                      }}
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div 
                          className="profile-repost-author-info"
                          onClick={() => {
                            if (repost.user?.user_id) {
                              const currentPath = window.location.pathname;
                              if (currentPath.startsWith('/peso')) {
                                window.location.href = `/peso/profile/${repost.user.user_id}`;
                              } else if (currentPath.startsWith('/ccict')) {
                                window.location.href = `/ccict/profile/${repost.user.user_id}`;
                              } else {
                                window.location.href = `/alumni/profile/${repost.user.user_id}`;
                              }
                            }
                          }}
                        >
                          {renderName(repost.user) || 'User'}
                        </div>
                      </div>
                      <div className="profile-repost-author-details">
                        <span>{formatTime(repost.repost_date)}</span>
                      </div>
                    </div>
                  </div>
                  {/* Three dots menu */}
                  <div className="profile-repost-header-right" style={{ position: 'relative' }}>
                    <button
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
                  </div>
                </div>

                {/* Repost caption */}
                {repost.caption && (
                  <div className="profile-repost-caption">
                    {renderTextWithLinks(repost.caption)}
                  </div>
                )}

                {/* Inner Card - Original post without interactions */}
                {originalPost && (
                  <div 
                    className="profile-repost-original"
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Original post header */}
                    <div className="profile-repost-original-header">
                      <div className="profile-repost-original-header-left">
                        <img
                          src={getProfilePicUrl(originalPost.user?.profile_pic)}
                          alt="Profile"
                          className="profile-repost-original-profile-image"
                          onClick={() => {
                            if (originalPost.user?.user_id) {
                              const currentPath = window.location.pathname;
                              if (currentPath.startsWith('/peso')) {
                                window.location.href = `/peso/profile/${originalPost.user.user_id}`;
                              } else if (currentPath.startsWith('/ccict')) {
                                window.location.href = `/ccict/profile/${originalPost.user.user_id}`;
                              } else {
                                window.location.href = `/alumni/profile/${originalPost.user.user_id}`;
                              }
                            }
                          }}
                          onError={handleProfilePicError}
                        />
                        <div>
                          <div 
                            className="profile-repost-original-author-info"
                            onClick={() => {
                              if (originalPost.user?.user_id) {
                                const currentPath = window.location.pathname;
                                if (currentPath.startsWith('/peso')) {
                                  window.location.href = `/peso/profile/${originalPost.user.user_id}`;
                                } else if (currentPath.startsWith('/ccict')) {
                                  window.location.href = `/ccict/profile/${originalPost.user.user_id}`;
                                } else {
                                  window.location.href = `/alumni/profile/${originalPost.user.user_id}`;
                                }
                              }
                            }}
                          >
                            {renderName(originalPost.user)}
                          </div>
                          <div className="profile-repost-original-author-details">
                            <span>{formatTime(originalPost.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Original post content */}
                    {(originalPost.post_content || originalPost.content) && (
                      <div className="profile-repost-original-content">
                        {renderTextWithLinks(originalPost.post_content || originalPost.content)}
                      </div>
                    )}

                    {/* Original post images */}
                    {(() => {
                      const originalImages = getImagesFromPost(originalPost);
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
                              style={{ 
                                cursor: 'pointer',
                                width: 'auto',
                                height: 'auto',
                                maxWidth: '100%',
                                maxHeight: '40vh',
                                borderRadius: '8px',
                                objectFit: 'contain'
                              }}
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
                                height: '300px'
                              } : originalImages.length === 3 ? {
                                gridTemplateColumns: '2fr 1fr',
                                gridTemplateRows: '1fr 1fr',
                                height: '300px'
                              } : originalImages.length === 4 ? {
                                gridTemplateColumns: '1fr 1fr',
                                gridTemplateRows: '1fr 1fr',
                                height: '300px'
                              } : {
                                gridTemplateColumns: 'repeat(3, 1fr)',
                                gridTemplateRows: 'repeat(2, 1fr)',
                                height: '300px'
                              })
                            }}>
                              {originalImages.slice(0, 6).map((img, index) => (
                                <img
                                  key={index}
                                  src={
                                    typeof img === 'string' && img.startsWith('/media/')
                                      ? `http://127.0.0.1:8000${img}`
                                      : img
                                  }
                                  alt={`original post ${index + 1}`}
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    cursor: 'pointer'
                                  }}
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    console.error('Failed to load original post image:', img);
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Repost likes and comments display */}
                <div style={{ 
                  marginTop: 8, 
                  padding: '8px 12px', 
                  borderRadius: 8,
                  color: '#6c757d',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {/* Repost likes text */}
                    {repost.likes && repost.likes.length > 0 ? (
                      <span style={{ 
                        fontSize: '12px',
                        fontWeight: '500',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        color: '#6b7280'
                      }}>
                        👍 {repost.likes.length === 1 
                          ? `${repost.likes[0].f_name || ''} ${repost.likes[0].l_name || ''}`.trim() + ' liked this'
                          : repost.likes.length === 2
                          ? `${repost.likes[0].f_name || ''} ${repost.likes[0].l_name || ''}`.trim() + ` and ${repost.likes[1].f_name || ''} ${repost.likes[1].l_name || ''}`.trim() + ' liked this'
                          : `${repost.likes[0].f_name || ''} ${repost.likes[0].l_name || ''}`.trim() + ` and ${repost.likes.length - 1} others liked this`
                        }
                      </span>
                    ) : (
                      <span style={{ 
                        fontSize: '12px',
                        fontWeight: '500',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        color: '#9ca3af'
                      }}>
                        No likes yet
                      </span>
                    )}
                    
                    {/* Repost comments count */}
                    {repost.comments && repost.comments.length > 0 && (
                      <span style={{ 
                        fontSize: '12px',
                        fontWeight: '500',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        color: '#6b7280',
                        cursor: 'pointer'
                      }}>
                        {repost.comments.length} comment{repost.comments.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Interaction buttons for the repost */}
                <div className="profile-repost-actions">
                  <button
                    onClick={() => handleLike(repost.repost_id)}
                    className={`profile-repost-action-item ${likedReposts[repost.repost_id] ? 'liked' : ''}`}
                    style={{
                      color: likedReposts[repost.repost_id] ? '#e0245e' : '#6c757d',
                      fontWeight: likedReposts[repost.repost_id] ? '600' : '400',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '8px 16px',
                      borderRadius: 8,
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8f9fa';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    👍 Like
                  </button>
                  <button
                    onClick={() => handleComment(repost.repost_id)}
                    className="profile-repost-action-item"
                    style={{
                      color: '#6c757d',
                      fontWeight: '400',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '8px 16px',
                      borderRadius: 8,
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8f9fa';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    💬 Comment
                  </button>
                  <button
                    onClick={() => handleRepost(repost.repost_id)}
                    className={`profile-repost-action-item ${repostedReposts[repost.repost_id] ? 'reposted' : ''}`}
                    style={{
                      color: repostedReposts[repost.repost_id] ? '#1da1f2' : '#6c757d',
                      fontWeight: repostedReposts[repost.repost_id] ? '600' : '400',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '8px 16px',
                      borderRadius: 8,
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8f9fa';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    🔄 Repost
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              No repost found.
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default RepostNotificationModal;