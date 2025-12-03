import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import ctulogo from '../images/ctulogo.png';
import { getProfilePicUrl, getImageUrl } from '../utils/profilePicUtils';
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
    post_images?: Array<{
      image_id: number;
      image_url: string;
      order: number;
    }>;
    images?: Array<{ // For donation posts
      image_id?: number;
      image_url: string;
      url?: string;
      order?: number;
    } | string>; // Can be array of objects or strings
    created_at?: string | null;
    is_event?: boolean;
    event_date?: string | null;
    event_time?: string | null;
  };
  currentUser: {
    name: string;
    profile_pic?: string;
  };
  formatTime: (iso?: string | null) => string;
}

const MAX_CAPTION_LENGTH = 1000;

// Helper function to extract images from post (similar to PostCard and RepostCard)
// Handles regular posts, forum posts, and donation posts
const getImagesFromPost = (post: RepostModalProps['originalPost']): string[] => {
  const images: string[] = [];
  
  // Add multiple images if available (for regular posts and forum posts)
  if (post.post_images && post.post_images.length > 0) {
    // Sort by order and extract URLs
    const sortedImages = [...post.post_images].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    images.push(...sortedImages.map(img => img.image_url));
  }
  
  // Add donation images if available (for donation posts)
  // Donation posts use 'images' field instead of 'post_images'
  if (images.length === 0 && (post as any).images && Array.isArray((post as any).images) && (post as any).images.length > 0) {
    // Sort by order and extract URLs
    const sortedImages = [...(post as any).images].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
    // Handle both object format {image_url, order} and string format
    images.push(...sortedImages.map((img: any) => {
      if (typeof img === 'string') {
        return img;
      }
      return img.image_url || img.url || img;
    }));
  }
  
  // Add single image if no multiple images and single image exists
  if (images.length === 0 && post.post_image) {
    images.push(post.post_image);
  }
  
  // Remove duplicate URLs while preserving order
  const uniqueImages = Array.from(new Set(images));
  
  return uniqueImages;
};

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
  
  // Extract images from original post
  const originalImages = React.useMemo(() => getImagesFromPost(originalPost), [originalPost]);

  // Dynamically calculate modal width based on content length
  const modalWidth = React.useMemo(() => {
    const contentLength = originalPost.post_content?.length || 0;
    
    // Base width: 430px for short posts
    // Increase width progressively for longer posts
    if (contentLength < 200) {
      return 430;
    } else if (contentLength < 500) {
      return 520;
    } else if (contentLength < 1000) {
      return 620;
    } else {
      return 720; // Maximum width for very long posts
    }
  }, [originalPost.post_content]);

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
      .repost-original-content::-webkit-scrollbar,
      .repost-images-container::-webkit-scrollbar {
        width: 12px;
      }
      .repost-original-content::-webkit-scrollbar-track,
      .repost-images-container::-webkit-scrollbar-track {
        background: #f3f4f6;
        border-radius: 10px;
        border: 2px solid #e5e7eb;
      }
      .repost-original-content::-webkit-scrollbar-thumb,
      .repost-images-container::-webkit-scrollbar-thumb {
        background: #4b5563;
        border-radius: 10px;
        border: 2px solid #374151;
        min-height: 30px;
      }
      .repost-original-content::-webkit-scrollbar-thumb:hover,
      .repost-images-container::-webkit-scrollbar-thumb:hover {
        background: #374151;
        border-color: #1f2937;
      }
      .repost-original-content::-webkit-scrollbar-thumb:active,
      .repost-images-container::-webkit-scrollbar-thumb:active {
        background: #1f2937;
      }
      /* Firefox scrollbar styling */
      .repost-original-content,
      .repost-images-container {
        scrollbar-width: auto;
        scrollbar-color: #4b5563 #f3f4f6;
      }
      /* Ensure textarea text is black, not blue */
      .repost-caption-input {
        color: #111827 !important;
      }
      .repost-caption-input::placeholder {
        color: #9ca3af;
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
          maxWidth: showEmojiPicker ? 750 : modalWidth,
          minWidth: showEmojiPicker ? 600 : 400,
          maxHeight: 'calc(100vh - 48px)',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 15px 40px rgba(15, 23, 42, 0.2)',
          overflow: 'visible', // changed from 'hidden' to 'visible'
          animation: 'slideUp 0.25s ease-out',
          display: 'flex',
          flexDirection: 'column',
          transition: 'max-width 0.3s ease, min-width 0.3s ease',
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
            flexShrink: 0,
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
          <div style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>Create a repost</div>
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

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 18, overflowY: 'auto', flex: 1 }}>
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

          {/* Caption input + Emoji Picker, now horizontal row layout */}
          <div style={{ display: 'flex', flexDirection: 'row', gap: 16, width: '100%', alignItems: 'flex-start' }}>
            {/* Textarea column */}
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <textarea
                placeholder="Add an optional caption..."
                value={caption}
                onChange={(e) => {
                  handleCaptionChange(e.target.value);
                  // Auto-resize textarea with max height
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                }}
                style={{
                  width: '100%',
                  minHeight: 90,
                  maxHeight: 200,
                  borderRadius: 12,
                  border: '1px solid #e5e7eb',
                  padding: '14px 16px 32px 16px',
                  fontSize: 14,
                  resize: 'none',
                  fontFamily: 'inherit',
                  outline: 'none',
                  backgroundColor: '#fff',
                  boxSizing: 'border-box',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  color: '#111827',
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
              {/* Emoji + count BOTTOM RIGHT of textarea */}
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
            {/* Emoji picker as FLEX PEER, not inside textarea column */}
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
                  marginLeft: 0,
                  alignSelf: 'flex-start',
                  width: 340,
                  zIndex: 2
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <EmojiPicker
                  onEmojiClick={handleEmojiSelect}
                  width={340}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                    {originalPost.user?.f_name && originalPost.user?.l_name
                      ? `${originalPost.user.f_name} ${originalPost.user.m_name || ''} ${originalPost.user.l_name}`.trim()
                      : originalPost.user?.f_name || 'User'}
                  </div>
                  {originalPost.is_event && (
                    <>
                      <span style={{
                        backgroundColor: '#3b82f6',
                        color: '#ffffff',
                        fontSize: '10px',
                        fontWeight: '600',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                      }}>
                        Event
                      </span>
                      {(() => {
                        if (!originalPost.event_date) return null;
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const eventDate = new Date(originalPost.event_date);
                        eventDate.setHours(0, 0, 0, 0);
                        const isEventPast = eventDate < today;
                        
                        return isEventPast ? (
                          <span style={{
                            backgroundColor: '#9ca3af',
                            color: '#ffffff',
                            fontSize: '10px',
                            fontWeight: '600',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                            marginLeft: '4px'
                          }}>
                            ENDED
                          </span>
                        ) : null;
                      })()}
                    </>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                  <span>{formatTime(originalPost.created_at)}</span>
                  {originalPost.is_event && originalPost.event_date && (
                    <>
                      <span>•</span>
                      <span style={{ color: '#1e40af', fontWeight: 500 }}>
                        {new Date(originalPost.event_date).toLocaleDateString('en-US', { 
                          weekday: 'short',
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </span>
                      {originalPost.event_time && (
                        <>
                          <span>•</span>
                          <span style={{ color: '#475569' }}>🕐 {originalPost.event_time}</span>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div
              style={{
                fontSize: 14,
                color: '#1f2937',
                lineHeight: 1.6,
                whiteSpace: 'pre-line',
                wordBreak: 'break-word',
                maxHeight: '400px',
                overflowY: 'auto',
                overflowWrap: 'break-word',
              }}
              className="repost-original-content"
            >
              {originalPost.post_content}
            </div>

            {/* Images display - supports both single and multiple images */}
            {originalImages.length > 0 && (
              <div 
                style={{ 
                  marginTop: 12,
                  maxHeight: '500px',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  borderRadius: 12,
                }}
                className="repost-images-container"
              >
                {originalImages.length === 1 ? (
                  // Single image - full width
                  <img
                    src={getImageUrl(originalImages[0])}
                alt="Post"
                style={{
                  width: '100%',
                      borderRadius: 12,
                      objectFit: 'contain',
                      maxHeight: 400,
                      backgroundColor: '#f5f5f5',
                      display: 'block',
                    }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.src = ctulogo as unknown as string;
                    }}
                  />
                ) : (
                  // Multiple images - grid layout
                  <div
                    style={{
                      display: 'grid',
                      gap: 4,
                      borderRadius: 12,
                      overflow: 'hidden',
                      ...(originalImages.length === 2 ? {
                        gridTemplateColumns: '1fr 1fr',
                        height: 250
                      } : originalImages.length === 3 ? {
                        gridTemplateColumns: '2fr 1fr',
                        gridTemplateRows: '1fr 1fr',
                        height: 250
                      } : originalImages.length === 4 ? {
                        gridTemplateColumns: '1fr 1fr',
                        gridTemplateRows: '1fr 1fr',
                        height: 250
                      } : {
                        gridTemplateColumns: '1fr 1fr 1fr',
                        gridTemplateRows: '1fr 1fr',
                        height: 250
                      })
                    }}
                  >
                    {originalImages.slice(0, originalImages.length <= 6 ? originalImages.length : 6).map((image, index) => {
                      let gridArea = '';
                      if (originalImages.length === 3) {
                        // Facebook 3-image layout: large left, two stacked right
                        gridArea = index === 0 ? '1 / 1 / 3 / 2' : `1 / 2 / 2 / 3`;
                        if (index === 2) gridArea = '2 / 2 / 3 / 3';
                      }
                      
                      return (
                        <div key={index} style={{ 
                          position: 'relative',
                          gridArea: gridArea,
                          overflow: 'hidden',
                          backgroundColor: '#f5f5f5'
                        }}>
                          <img
                            src={getImageUrl(image)}
                            alt={`Post ${index + 1}`}
                            style={{
                              width: '100%',
                              height: '100%',
                  objectFit: 'cover',
                              display: 'block'
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                              target.onerror = null;
                              target.src = ctulogo as unknown as string;
                            }}
                          />
                          {originalImages.length > 6 && index === 5 && (
                            <div style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              backgroundColor: 'rgba(0, 0, 0, 0.5)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontSize: 24,
                              fontWeight: 'bold'
                            }}>
                              +{originalImages.length - 6}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
