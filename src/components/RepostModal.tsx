import React, { useState } from 'react';
  import ctulogo from '../images/ctulogo.png';
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

const RepostModal: React.FC<RepostModalProps> = ({
  isOpen,
  onClose,
  onRepost,
  originalPost,
  currentUser,
  formatTime
}) => {
  const [caption, setCaption] = useState('');

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

  const handleSubmit = () => {
    // Caption is optional, so we can proceed with or without it
    onRepost(caption || ''); // Pass empty string if no caption
    setCaption('');
    onClose();
  };

  const handleCancel = () => {
    setCaption('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          borderRadius: 14,
          boxShadow: '0 20px 40px rgba(0,0,0,0.15), 0 8px 16px rgba(0,0,0,0.1)',
          maxWidth: 360,
          width: '90%',
          padding: 20,
          position: 'relative',
          border: '1px solid rgba(255,255,255,0.2)',
          animation: 'slideUp 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'rgba(0,0,0,0.05)',
            border: 'none',
            borderRadius: '50%',
            width: 28,
            height: 28,
            fontSize: 14,
            cursor: 'pointer',
            color: '#666',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0,0,0,0.1)';
            e.currentTarget.style.color = '#333';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
            e.currentTarget.style.color = '#666';
          }}
        >
          ×
        </button>

        <h2 style={{ 
          margin: '0 0 16px 0', 
          fontSize: 18, 
          fontWeight: '700',
          background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          textAlign: 'center',
        }}>
          🔄 Repost
        </h2>

        {/* Current user info - the person who is reposting */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: 12,
          padding: '10px',
          backgroundColor: 'rgba(59, 130, 246, 0.05)',
          borderRadius: '8px',
          border: '1px solid rgba(59, 130, 246, 0.1)',
        }}>
          <img
            src={currentUser.profile_pic ? (String(currentUser.profile_pic).startsWith('http') ? currentUser.profile_pic : `http://127.0.0.1:8000${currentUser.profile_pic}`) : ctulogo}
            alt="Profile"
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              objectFit: 'cover',
              marginRight: 10,
              border: '2px solid rgba(59, 130, 246, 0.2)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
            }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.onerror = null;
              target.src = ctulogo as unknown as string;
            }}
          />
          <div>
            <div style={{ fontWeight: '600', fontSize: 15, color: '#1e40af', marginBottom: 1 }}>
              {currentUser.name}
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              is reposting
            </div>
          </div>
        </div>

        {/* Caption input */}
        <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <textarea
            placeholder="Add a caption (optional)..."
            value={caption}
            onChange={(e) => {
              setCaption(e.target.value);
              // Auto-resize textarea
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
            }}
            style={{
              width: '90%',
              minHeight: 50,
              maxHeight: 100,
              padding: 10,
              border: '2px solid #e5e7eb',
              borderRadius: 8,
              fontSize: 13,
              resize: 'none',
              fontFamily: 'inherit',
              backgroundColor: '#ffffff',
              transition: 'all 0.2s ease',
              outline: 'none',
              overflow: 'hidden',
              textAlign: 'center',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#3b82f6';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Original post preview */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ 
            display: 'block', 
            fontSize: 12, 
            fontWeight: '600', 
            color: '#374151', 
            marginBottom: 6,
            textAlign: 'left'
          }}>
            Original Post
          </label>
          <div
            style={{
              border: '2px solid #f1f5f9',
              borderRadius: 10,
              padding: 12,
              backgroundColor: '#ffffff',
              boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
              borderLeft: '3px solid #3b82f6',
              maxHeight: '200px',
              overflowY: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
            className="repost-original-content"
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
              <img
                src={originalPost.user?.profile_pic ? (String(originalPost.user.profile_pic).startsWith('http') ? originalPost.user.profile_pic : `http://127.0.0.1:8000${originalPost.user.profile_pic}`) : ctulogo}
                alt="Profile"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  marginRight: 8,
                  border: '2px solid #e5e7eb',
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src = ctulogo as unknown as string;
                }}
              />
              <div>
                <div style={{ fontWeight: '600', fontSize: 13, color: '#1f2937', marginBottom: 1 }}>
                  {originalPost.user?.f_name} {originalPost.user?.m_name} {originalPost.user?.l_name}
                </div>
                <div style={{ fontSize: 10, color: '#6b7280' }}>
                  {formatTime(originalPost.created_at)}
                </div>
              </div>
            </div>
            <div 
              className="repost-original-content"
              style={{ 
                fontSize: 13, 
                color: '#374151', 
                lineHeight: 1.4, 
                marginBottom: 6,
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
              }}>
              {originalPost.post_content}
            </div>
          {originalPost.post_image && (
            <img
              src={typeof originalPost.post_image === 'string' && originalPost.post_image.startsWith('/media/')
                ? `http://127.0.0.1:8000${originalPost.post_image}`
                : typeof originalPost.post_image === 'string' && !originalPost.post_image.startsWith('http')
                ? `http://127.0.0.1:8000${originalPost.post_image}`
                : (originalPost.post_image as string)}
              alt="post"
              style={{ maxWidth: '100%', borderRadius: 8, maxHeight: 200, objectFit: 'cover' }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          )}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={handleCancel}
            style={{
              background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: '600',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 6px rgba(107, 114, 128, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 3px 8px rgba(107, 114, 128, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(107, 114, 128, 0.3)';
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: '600',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 6px rgba(59, 130, 246, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 3px 8px rgba(59, 130, 246, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(59, 130, 246, 0.3)';
            }}
          >
            🔄 Repost
          </button>
        </div>
      </div>
    </div>
  );
};

export default RepostModal;
