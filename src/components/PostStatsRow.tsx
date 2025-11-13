import React, { useState, useEffect } from 'react';

interface PostStatsRowProps {
  likes?: Array<{ user?: { f_name?: string; m_name?: string; l_name?: string }; f_name?: string; m_name?: string; l_name?: string }>;
  comments?: Array<any>;
  onLikesClick: () => void;
  onCommentsClick: () => void;
  animate?: boolean; // if false, update immediately without transition
}

const PostStatsRow: React.FC<PostStatsRowProps> = ({ likes, comments, onLikesClick, onCommentsClick }) => {
  const hasLikes = likes && likes.length > 0;
  const hasComments = comments && comments.length > 0;
  const [likesDisplay, setLikesDisplay] = useState('');

  // Update likes display immediately (no animation to avoid glitches)
  useEffect(() => {
    if (!hasLikes) {
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

  if (!hasLikes && !hasComments) return null;

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
              fontSize: '12px',
              fontWeight: '500',
              padding: '4px 8px',
              borderRadius: '4px',
              color: '#6b7280',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f8f9fa';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >👍 {likesDisplay}
          </span>
        ) : (
          <div></div> // Empty spacer to push comments to the right
        )}
          
        {/* Right side - Comments count */}
        {hasComments && (
          <span
            onClick={onCommentsClick}
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
            {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
          </span>
        )}
      </div>
    </div>
  );
};

export default PostStatsRow;
