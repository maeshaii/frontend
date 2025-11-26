import React, { useState, useRef, useEffect } from 'react';
import { createReply } from '../services/api';
import MentionInput from './MentionInput';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);

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

  // Close emoji picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showEmojiPicker && emojiPickerRef.current && !emojiPickerRef.current.contains(target)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

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
      
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
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
            padding: '10px 0px 10px 5px',
            resize: 'none'
          }}
        />
        {/* Emoji Button */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowEmojiPicker(!showEmojiPicker);
          }}
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            transition: 'background-color 0.2s ease, color 0.2s ease',
            color: '#65676b',
            zIndex: 1,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
            e.currentTarget.style.color = '#333';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#65676b';
          }}
          title="Add emoji"
        >
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <circle cx="8.5" cy="9.5" r="1.5" fill="currentColor" />
            <circle cx="15.5" cy="9.5" r="1.5" fill="currentColor" />
            <path d="M8 14c1.5 2.5 4.5 2.5 6 0" />
          </svg>
        </button>
        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div
            ref={emojiPickerRef}
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 8px)',
              right: 0,
              zIndex: 1000,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              borderRadius: '12px',
              overflow: 'hidden',
              background: '#fff',
              border: '1px solid #e0e0e0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <EmojiPicker
              onEmojiClick={(emojiData: EmojiClickData) => {
                setReplyContent(prev => prev + emojiData.emoji);
              }}
              width={280}
              height={320}
              previewConfig={{ showPreview: false }}
              skinTonesDisabled
            />
          </div>
        )}
        
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

