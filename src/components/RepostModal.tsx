import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import ctulogo from '../images/ctulogo.png';
import { getProfilePicUrl } from '../utils/profilePicUtils';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
interface RepostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRepost: (caption: string) => void;
  originalPost: {
    user?: {
      user_id?: number;
      f_name?: string;
      m_name?: string;
      l_name?: string;
      profile_pic?: string;
      name?: string;
    };
    post_content: string;
    post_image?: string | null;
    created_at?: string | null;
  };
  currentUser: {
    name: string;
    profile_pic?: string;
  };
  formatTime: (iso?: string | null) => string;
}

const MAX_CAPTION_LENGTH = 1000;

const RepostModal: React.FC<RepostModalProps> = ({
  isOpen,
  onClose,
  onRepost,
  originalPost,
  currentUser,
  formatTime
}) => {
  const [caption, setCaption] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);

  // Resolve the actual logged-in user from localStorage to ensure correctness
  const effectiveCurrentUser = React.useMemo(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        const fullName = [u.f_name, u.m_name, u.l_name].filter(Boolean).join(' ').trim() || (u.name || currentUser.name);
        const avatar = getProfilePicUrl(u.profile_pic || currentUser.profile_pic);
        return { name: fullName, profile_pic: avatar };
      }
    } catch (_) {}
    return { name: currentUser.name, profile_pic: getProfilePicUrl(currentUser.profile_pic) };
  }, [currentUser]);

  // Add CSS animations and scrollbar styling
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { 
          opacity: 0;
          transform: translateY(20px) scale(0.95);
        }
        to { 
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      .repost-original-content::-webkit-scrollbar {
        display: none;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Lock body scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleSubmit = () => {
    const trimmed = caption.trim();
    onRepost(trimmed || '');
    setCaption('');
    onClose();
  };

  const handleCancel = () => {
    setCaption('');
    onClose();
  };

  const handleEmojiSelect = (emojiData: EmojiClickData) => {
    setCaption((prev) => {
      const next = (prev + emojiData.emoji).slice(0, MAX_CAPTION_LENGTH);
      return next;
    });
  };

  const handleCaptionChange = (value: string) => {
    setCaption(value.slice(0, MAX_CAPTION_LENGTH));
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showEmojiPicker && emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.45)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '24px 16px',
        zIndex: 9999,
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 430,
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 15px 40px rgba(15, 23, 42, 0.2)',
          overflow: 'hidden',
          animation: 'slideUp 0.25s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <button
            onClick={handleCancel}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 22,
              cursor: 'pointer',
              color: '#111827',
              padding: 4,
            }}
            aria-label="Close repost modal"
          >
            ×
          </button>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>Repost</div>
          <button
            onClick={handleSubmit}
            style={{
              background: 'none',
              color: '#2563eb',
              border: 'none',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              padding: 4,
            }}
          >
            Repost
          </button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Current user */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img
              src={effectiveCurrentUser.profile_pic || ctulogo}
              alt="Profile"
              style={{
                width: 46,
                height: 46,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '1px solid #e5e7eb',
              }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.onerror = null;
                target.src = ctulogo as unknown as string;
              }}
            />
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{effectiveCurrentUser.name}</div>
          </div>

          {/* Caption input */}
          <div style={{ display: 'flex', gap: 16, width: '100%', alignItems: 'flex-start' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <textarea
              placeholder="Add an optional caption..."
              value={caption}
              onChange={(e) => handleCaptionChange(e.target.value)}
              style={{
                width: '100%',
                minHeight: 90,
                borderRadius: 12,
                border: '1px solid #e5e7eb',
                padding: '14px 16px 32px 16px',
                fontSize: 14,
                resize: 'none',
                fontFamily: 'inherit',
                outline: 'none',
                backgroundColor: '#fff',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#2563eb';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb';
              }}
              className="repost-caption-input"
              maxLength={MAX_CAPTION_LENGTH}
              />
              {/* Emoji + count */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 8,
                  right: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowEmojiPicker((prev) => !prev);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 4,
                    borderRadius: '50%',
                    width: 28,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#666',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)';
                    e.currentTarget.style.color = '#333';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#666';
                  }}
                  title="Add emoji"
                >
                  <svg
                    width="18"
                    height="18"
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
                <div style={{ fontSize: 12, color: '#888' }}>
                  {caption.length}/{MAX_CAPTION_LENGTH}
                </div>
              </div>
            </div>

            {showEmojiPicker && (
              <div
                ref={emojiPickerRef}
                style={{
                  flexShrink: 0,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: '#fff',
                  border: '1px solid #e0e0e0',
                  alignSelf: 'flex-start',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <EmojiPicker
                  onEmojiClick={handleEmojiSelect}
                  width={320}
                  height={360}
                  previewConfig={{ showPreview: false }}
                  skinTonesDisabled
                />
              </div>
            )}
          </div>

          {/* Original post preview */}
          <div
            style={{
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              background: '#fff',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              boxShadow: '0 4px 14px rgba(15,23,42,0.08)',
            }}
          >
            <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Original post
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img
                src={originalPost.user?.profile_pic ? (String(originalPost.user.profile_pic).startsWith('http') ? originalPost.user.profile_pic : `http://127.0.0.1:8000${originalPost.user.profile_pic}`) : ctulogo}
                alt="Original author"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '1px solid #e5e7eb',
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src = ctulogo as unknown as string;
                }}
              />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                  {originalPost.user?.f_name && originalPost.user?.l_name
                    ? `${originalPost.user.f_name} ${originalPost.user.m_name || ''} ${originalPost.user.l_name}`.trim()
                    : originalPost.user?.f_name || 'User'}
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>{formatTime(originalPost.created_at)}</div>
              </div>
            </div>

            <div
              style={{
                fontSize: 14,
                color: '#1f2937',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {originalPost.post_content}
            </div>

            {originalPost.post_image && (
              <img
                src={
                  typeof originalPost.post_image === 'string' && originalPost.post_image.startsWith('/media/')
                    ? `http://127.0.0.1:8000${originalPost.post_image}`
                    : typeof originalPost.post_image === 'string' && !originalPost.post_image.startsWith('http')
                    ? `http://127.0.0.1:8000${originalPost.post_image}`
                    : (originalPost.post_image as string)
                }
                alt="Post"
                style={{
                  width: '100%',
                  borderRadius: 18,
                  objectFit: 'cover',
                  maxHeight: 260,
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Render modal using portal to ensure it's outside any parent container constraints
  return ReactDOM.createPortal(modalContent, document.body);
};

export default RepostModal;
