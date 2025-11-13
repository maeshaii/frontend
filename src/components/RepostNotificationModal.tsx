import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { api } from '../services/api';
import { getProfilePicUrl, handleProfilePicError } from '../utils/profilePicUtils';
import ReplyInput from './ReplyInput';
import Reply from './Reply';
import ctulogo from '../images/ctulogo.png';
import RepostCard from './RepostCard';

interface RepostNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  repostId: string;
  reposterName?: string;
  commentId?: string;
  replyId?: string;
}

const RepostNotificationModal: React.FC<RepostNotificationModalProps> = ({ isOpen, onClose, repostId, reposterName, commentId, replyId }) => {
  const [repost, setRepost] = useState<any>(null);
  const [originalPost, setOriginalPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [likedReposts, setLikedReposts] = useState<{ [key: number]: boolean }>({});
  const [repostedReposts, setRepostedReposts] = useState<{ [key: number]: boolean }>({});
  const [showReplyInput, setShowReplyInput] = useState<{ [key: number]: boolean }>({});
  const [showMainCommentInput, setShowMainCommentInput] = useState(false);
  const [mainCommentValue, setMainCommentValue] = useState('');
  const [commentReplies, setCommentReplies] = useState<{ [key: number]: any[] }>({});
  const [showReplies, setShowReplies] = useState<{ [key: number]: boolean }>({});

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

      const token = localStorage.getItem('accessToken');
      console.log('fetchRepostData - Access Token present:', !!token);
      console.log('fetchRepostData - Repost ID:', repostId);

      // Fetch the specific repost by ID
      const repostResponse = await api.get(`reposts/${repostId}/detail/`);
      const repostData = repostResponse.data;
      
      // Check if this is a donation repost and fetch comments if needed
      if (repostData.original && repostData.original.donation_id) {
        // This is a donation repost, fetch donation with comments
        try {
          const donationResponse = await api.get(`donations/${repostData.original.donation_id}/`);
          if (donationResponse.data && donationResponse.data.comments) {
            // Merge donation comments into repost data
            repostData.comments = donationResponse.data.comments;
          }
        } catch (err) {
          console.log('Could not fetch donation comments:', err);
        }
      }
      
      // Transform fetched data into RepostCard-compatible structure
      const original = repostData.original || {};
      const transformed = {
        repost_id: repostData.repost_id,
        repost_date: repostData.repost_date,
        repost_caption: repostData.caption || repostData.repost_caption,
        user: repostData.user,
        likes: repostData.likes || [],
        likes_count: repostData.likes_count || 0,
        comments: repostData.comments || [],
        comments_count: repostData.comments_count || 0,
        original_post: {
          post_id: original.post_id || original.forum_id || original.donation_id,
          post_content: original.post_content || original.content || original.description,
          post_images: original.post_images || original.images || [],
          created_at: original.created_at,
          user: original.user,
        },
      };

      setRepost(transformed);
      setOriginalPost(transformed.original_post);
    } catch (err: any) {
      console.error('Error fetching repost data:', err);
      setError(err.response?.data?.detail || 'Failed to load repost data');
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
    setShowMainCommentInput(prev => !prev);
  };

  const handleReplyAdded = async (commentId: string) => {
    setShowReplyInput(prev => ({ ...prev, [commentId]: false }));
    fetchRepostData(); // Refresh all comments and replies
  };

  const handleMainCommentSubmit = async () => {
    if (!mainCommentValue.trim()) return;
    if (!repost?.repost_id) return;
    if (!repost.user?.user_id) return; // Ensure we have a user ID for context

    try {
      const result = await api.post(`reposts/${repost.repost_id}/comments/`, {
        comment_content: mainCommentValue.trim(),
      });

      if (result.data && result.data.success) {
        setMainCommentValue('');
        setShowMainCommentInput(false);
        fetchRepostData(); // Refresh all comments and replies
      } else {
        alert('Failed to post comment. Please try again.');
      }
    } catch (error) {
      console.error('Error posting main comment:', error);
      alert('Failed to post comment. Please try again.');
    }
  };

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const modalContent = (
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
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        margin: 0,
        padding: 0,
        overflow: 'auto'
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
            <div style={{ padding: '16px', backgroundColor: 'white' }}>
              <RepostCard
                repost={repost}
                currentUserId={(JSON.parse(localStorage.getItem('user') || '{}').id) || (JSON.parse(localStorage.getItem('user') || '{}').user_id) || null}
                formatTime={formatTime}
                onRefresh={fetchRepostData}
                autoOpenComments={!!(commentId || replyId)}
                highlightCommentId={commentId}
                highlightReplyId={replyId}
              />
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

  // Render modal using portal to ensure it's outside any parent container constraints
  return ReactDOM.createPortal(modalContent, document.body);
};

export default RepostNotificationModal;