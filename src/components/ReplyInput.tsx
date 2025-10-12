import React, { useState, useRef } from 'react';
import { createReply } from '../services/api';
import MentionInput from './MentionInput';

interface ReplyInputProps {
  commentId: number;
  currentUserId: number | null | undefined;
  displayName: string;
  displayAvatar: string;
  onReplyAdded: () => void;
  commentAuthor?: {
    user_id: number;
    f_name: string;
    m_name?: string;
    l_name: string;
    name: string;
  };
}

const ReplyInput: React.FC<ReplyInputProps> = ({ 
  commentId, 
  currentUserId: _currentUserId, 
  displayName, 
  displayAvatar, 
  onReplyAdded,
  commentAuthor
}) => {
  // Initialize reply content with mention if comment author is provided
  const getInitialReplyContent = () => {
    if (commentAuthor && commentAuthor.user_id !== _currentUserId) {
      return `@${commentAuthor.name} `;
    }
    return '';
  };

  const [replyContent, setReplyContent] = useState(getInitialReplyContent());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async () => {
    if (!replyContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await createReply(commentId, replyContent.trim());
      setReplyContent('');
      onReplyAdded();
    } catch (error) {
      console.error('Error creating reply:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ 
      marginLeft: '40px', 
      marginTop: '8px',
      paddingLeft: '12px',
      borderLeft: '2px solid #e0e0e0'
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          {/* User Avatar */}
          <img
            src={displayAvatar || '/default-avatar.png'}
            alt={displayName}
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              objectFit: 'cover',
              flexShrink: 0
            }}
          />
          
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* User Name */}
            <div style={{ 
              fontSize: '12px', 
              color: '#666', 
              marginBottom: '4px',
              fontWeight: '500'
            }}>
              Replying as {displayName}
            </div>
            
            {/* Reply Input */}
            <MentionInput
              value={replyContent}
              onChange={setReplyContent}
              placeholder="Write a reply..."
              onSubmit={handleSubmit}
              disabled={isSubmitting}
              style={{
                minHeight: '60px',
                borderRadius: '20px',
                fontSize: '13px',
                transition: 'border-color 0.2s ease'
              }}
            />
            
            {/* Submit Button */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'flex-end', 
              marginTop: '8px' 
            }}>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!replyContent.trim() || isSubmitting}
              style={{
                padding: '6px 16px',
                backgroundColor: replyContent.trim() ? '#007bff' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '16px',
                cursor: replyContent.trim() ? 'pointer' : 'not-allowed',
                fontSize: '12px',
                fontWeight: '500',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (replyContent.trim()) {
                  e.currentTarget.style.backgroundColor = '#0056b3';
                }
              }}
              onMouseLeave={(e) => {
                if (replyContent.trim()) {
                  e.currentTarget.style.backgroundColor = '#007bff';
                }
              }}
            >
              {isSubmitting ? 'Posting...' : 'Reply'}
            </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReplyInput;

