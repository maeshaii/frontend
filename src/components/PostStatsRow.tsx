import React, { useState, useEffect } from 'react';

interface PostStatsRowProps {
  likes?: Array<{ user?: { f_name?: string; m_name?: string; l_name?: string }; f_name?: string; m_name?: string; l_name?: string }>;
  comments?: Array<any>;
  reposts?: Array<{ user?: { f_name?: string; m_name?: string; l_name?: string } }>;
  repostCount?: number;
  onLikesClick: () => void;
  onCommentsClick: () => void;
  onRepostsClick?: () => void;
  animate?: boolean; // if false, update immediately without transition
}

const PostStatsRow: React.FC<PostStatsRowProps> = ({
  likes,
  comments,
  reposts,
  repostCount,
  onLikesClick,
  onCommentsClick,
  onRepostsClick,
}) => {
  const hasLikes = (likes && likes.length > 0) || false;
  const commentsTotal = comments?.length || 0;
  const hasComments = commentsTotal > 0;
  const computedRepostCount = typeof repostCount === 'number'
    ? repostCount
    : (reposts?.length || 0);
  const hasReposts = computedRepostCount > 0;
  const [likesDisplay, setLikesDisplay] = useState('');

  // Update likes display immediately (no animation to avoid glitches)
  useEffect(() => {
    if (!likes || likes.length === 0) {
      setLikesDisplay('');
      return;
    }

    const displayText = likes.length === 1 
      ? `${(likes[0] as any).user?.f_name || likes[0].f_name || ''} ${(likes[0] as any).user?.m_name || (likes[0] as any).m_name || ''} ${(likes[0] as any).user?.l_name || likes[0].l_name || ''}`.trim() + ' liked this'
      : likes.length === 2
      ? `${(likes[0] as any).user?.f_name || likes[0].f_name || ''} ${(likes[0] as any).user?.m_name || (likes[0] as any).m_name || ''} ${(likes[0] as any).user?.l_name || likes[0].l_name || ''}`.trim() + ` and ${(likes[1] as any).user?.f_name || likes[1].f_name || ''} ${(likes[1] as any).user?.m_name || (likes[1] as any).m_name || ''} ${(likes[1] as any).user?.l_name || likes[1].l_name || ''}`.trim() + ' liked this'
      : `${(likes[0] as any).user?.f_name || likes[0].f_name || ''} ${(likes[0] as any).user?.m_name || (likes[0] as any).m_name || ''} ${(likes[0] as any).user?.l_name || likes[0].l_name || ''}`.trim() + ` and ${likes.length - 1} others liked this`;
    
    setLikesDisplay(displayText);
  }, [likes, hasLikes]);

  if (!hasLikes && !hasComments && !hasReposts) return null;

  return (
    <div style={{ 
      marginTop: 8, 
      padding: '8px 12px', 
      borderRadius: 8,
      color: '#6c757d',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Left side - Likes text or empty space */}
        {hasLikes ? (
          <span
            onClick={onLikesClick}
            style={{ 
              flex: 1,
              fontSize: '12px',
              fontWeight: '500',
              padding: '4px 8px',
              borderRadius: '4px',
              color: '#6b7280',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f8f9fa';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            👍 {likesDisplay}
          </span>
        ) : (
          <div style={{ flex: 1 }}></div> // Empty spacer to keep layout balanced
        )}
          
        {/* Center - Comments count */}
        {hasComments ? (
          <span
            onClick={onCommentsClick}
            style={{ 
              flex: 1,
              cursor: 'pointer', 
              fontSize: '12px',
              color: '#6c757d',
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'background-color 0.2s ease',
              textAlign: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f8f9fa';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {commentsTotal} {commentsTotal === 1 ? 'comment' : 'comments'}
          </span>
        ) : (
          <div style={{ flex: 1 }}></div>
        )}

        {/* Right side - Repost count */}
        {hasReposts ? (
          <span
            onClick={() => onRepostsClick?.()}
            style={{
              flex: 1,
              cursor: onRepostsClick ? 'pointer' : 'default',
              fontSize: '12px',
              color: '#6c757d',
              padding: '4px 8px',
              borderRadius: '4px',
              transition: onRepostsClick ? 'background-color 0.2s ease' : 'none',
              textAlign: 'right',
            }}
            onMouseEnter={(e) => {
              if (onRepostsClick) {
                e.currentTarget.style.backgroundColor = '#f8f9fa';
              }
            }}
            onMouseLeave={(e) => {
              if (onRepostsClick) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            {computedRepostCount} {computedRepostCount === 1 ? 'repost' : 'reposts'}
          </span>
        ) : (
          <div style={{ flex: 1 }}></div>
        )}
      </div>
    </div>
  );
};

export default PostStatsRow;
