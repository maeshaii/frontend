import React, { useState } from 'react';
import RepostModal from './RepostModal';
import { repostPost, repostForumPost, repostDonation } from '../services/api';

interface RepostButtonProps {
  originalPost: {
    post_id: number;
    post_content: string;
    post_image?: string | null;
    post_images?: Array<{
      image_id: number;
      image_url: string;
      order: number;
    }>;
    user: {
      user_id: number;
      f_name: string;
      l_name: string;
      profile_pic?: string;
    };
    created_at: string;
  };
  currentUser: {
    name: string;
    profile_pic?: string;
  };
  isReposted?: boolean;
  onRepost?: () => void;
  formatTime: (iso?: string | null) => string;
  style?: React.CSSProperties;
  className?: string;
  isForum?: boolean; // New prop to indicate if this is a forum post
  isDonation?: boolean; // New prop to indicate if this is a donation post
}

const RepostButton: React.FC<RepostButtonProps> = ({
  originalPost,
  currentUser,
  isReposted = false,
  onRepost,
  formatTime,
  style,
  className,
  isForum = false,
  isDonation = false
}) => {
  const [showRepostModal, setShowRepostModal] = useState(false);

  const handleRepostClick = () => {
    console.log('RepostButton - Opening modal with originalPost:', originalPost);
    console.log('RepostButton - post_images:', originalPost.post_images);
    console.log('RepostButton - post_image:', originalPost.post_image);
    setShowRepostModal(true);
  };

  const handleRepostSubmit = async (caption: string) => {
    try {
      console.log('Creating repost for post:', originalPost.post_id, 'with caption:', caption);
      console.log('Post ID type:', typeof originalPost.post_id);
      console.log('Post ID value:', originalPost.post_id);
      console.log('Is Forum:', isForum);
      
      // Ensure post_id is a valid number
      const postId = Number(originalPost.post_id);
      if (isNaN(postId)) {
        throw new Error(`Invalid post ID: ${originalPost.post_id}`);
      }
      
      let result;
      if (isForum) {
        // Use forum repost API
        console.log('Using forum repost API');
        result = await repostForumPost(postId, caption);
      } else if (isDonation) {
        // Use donation repost API
        console.log('Using donation repost API');
        result = await repostDonation(postId, caption);
      } else {
        // Use regular post repost API
        console.log('Using regular post repost API');
        result = await repostPost(postId, caption);
      }
      
      console.log('Repost result:', result);
      setShowRepostModal(false);
      onRepost?.(); // This will refresh the posts to show the new repost
    } catch (error: any) {
      console.error('Error creating repost:', error);
      alert('Failed to create repost. Please try again.');
    }
  };

  return (
    <>
      <button
        onClick={handleRepostClick}
        style={{
          background: 'none',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer',
          color: isReposted ? '#28a745' : '#666',
          fontSize: '14px',
          fontWeight: '500',
          ...style
        }}
        className={className}
      >
        <span style={{ fontSize: '16px' }}>
          {isReposted ? '🔄' : '🔄'}
        </span>
        <span>{isReposted ? 'Reposted' : 'Repost'}</span>
      </button>

      <RepostModal
        isOpen={showRepostModal}
        onClose={() => setShowRepostModal(false)}
        onRepost={handleRepostSubmit}
        originalPost={originalPost}
        currentUser={currentUser}
        formatTime={formatTime}
      />
    </>
  );
};

export default RepostButton;
