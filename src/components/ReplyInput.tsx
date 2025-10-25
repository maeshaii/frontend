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
    l_name?: string;
    name: string;
  };
  placeholder?: string;
  initialValue?: string;
  onValueChange?: (value: string) => void;
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
      marginLeft: '32px', 
      marginTop: '8px',
      display: 'flex',
      gap: '8px'
    }}>
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
        {/* Reply Input */}
        <MentionInput
          value={replyContent}
          onChange={setReplyContent}
          placeholder="Write a reply..."
          onSubmit={handleSubmit}
          disabled={isSubmitting}
          style={{
            minHeight: '32px',
            maxHeight: '120px',
            borderRadius: '18px',
            fontSize: '13px',
            border: '1px solid #ccd0d5',
            backgroundColor: '#f0f2f5',
            padding: '8px 12px',
            resize: 'none'
          }}
        />
        
        {/* Submit Buttons */}
        <div style={{ 
          display: 'flex', 
          gap: '12px',
          marginTop: '4px',
          marginLeft: '12px'
        }}>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!replyContent.trim() || isSubmitting}
            style={{
              background: 'none',
              border: 'none',
              color: !replyContent.trim() || isSubmitting ? '#bcc0c4' : '#0866ff',
              cursor: !replyContent.trim() || isSubmitting ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              padding: '0',
              fontWeight: '600'
            }}
            onMouseEnter={(e) => {
              if (replyContent.trim() && !isSubmitting) {
                e.currentTarget.style.textDecoration = 'underline';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textDecoration = 'none';
            }}
          >
            {isSubmitting ? 'Posting...' : 'Reply'}
          </button>
          <button
            type="button"
            onClick={() => {
              setReplyContent('');
              onReplyAdded();
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#65676b',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '0',
              fontWeight: '600'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textDecoration = 'none';
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReplyInput;

