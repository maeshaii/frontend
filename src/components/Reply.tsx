import React, { useState, useRef, useEffect } from 'react';
import { editReply, deleteReply, createReply, searchAlumni } from '../services/api';
import ctulogo from '../images/ctulogo.png';
import { getProfilePicUrl, handleProfilePicError } from '../utils/profilePicUtils';

interface ReplyProps {
  reply: {
    reply_id: number;
    reply_content: string;
    date_created: string;
    user: {
      user_id: number;
      f_name: string;
      m_name: string;
      l_name: string;
      profile_pic: string;
    };
  };
  commentId: number;
  currentUserId: number | null | undefined;
  formatTime: (dateString: string) => string;
  onReplyUpdate: () => void;
  displayName?: string;
  displayAvatar?: string;
}

const Reply: React.FC<ReplyProps> = ({ 
  reply, 
  commentId, 
  currentUserId, 
  formatTime, 
  onReplyUpdate,
  displayName,
  displayAvatar
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(reply.reply_content);
  const [showOptions, setShowOptions] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);

  const isOwnReply = currentUserId === reply.user.user_id;
  const userName = `${reply.user.f_name} ${reply.user.m_name || ''} ${reply.user.l_name}`.trim();
  const userAvatar = getProfilePicUrl(reply.user.profile_pic);

  // Helper function to get the correct profile path
  const getProfilePath = (userId: number) => {
    const currentPath = window.location.pathname;
    if (currentPath.startsWith('/peso')) {
      return `/peso/profile/${userId}`;
    } else if (currentPath.startsWith('/ccict')) {
      return `/ccict/profile/${userId}`;
    } else {
      return `/alumni/profile/${userId}`;
    }
  };

  const handleUserSearch = async (searchTerm: string) => {
    try {
      const response = await searchAlumni(searchTerm);
      if (response.results && response.results.length > 0) {
        // Take the first result (most relevant match)
        const user = response.results[0];
        const currentPath = window.location.pathname;
        if (currentPath.startsWith('/peso')) {
          window.location.href = `/peso/profile/${user.id}`;
        } else if (currentPath.startsWith('/ccict')) {
          window.location.href = `/ccict/profile/${user.id}`;
        } else {
          window.location.href = `/alumni/profile/${user.id}`;
        }
      } else {
        alert(`No user found with name "${searchTerm}"`);
      }
    } catch (error) {
      console.error('Error searching for user:', error);
      alert('Error searching for user. Please try again.');
    }
  };

  // Close options when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) {
        setShowOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleEdit = async () => {
    if (editContent.trim() === '') return;

    try {
      await editReply(commentId, reply.reply_id, { reply_content: editContent });
      setIsEditing(false);
      onReplyUpdate();
    } catch (error) {
      console.error('Error editing reply:', error);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this reply?')) {
      try {
        await deleteReply(commentId, reply.reply_id);
        onReplyUpdate();
      } catch (error) {
        console.error('Error deleting reply:', error);
      }
    }
  };

  const handleReplySubmit = async () => {
    if (!replyContent.trim() || isSubmittingReply) return;

    setIsSubmittingReply(true);
    try {
      await createReply(commentId, replyContent);
      setReplyContent('');
      setShowReplyInput(false);
      onReplyUpdate();
    } catch (error) {
      console.error('Error creating reply:', error);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const mentionRegex = /@(\w+)/g;
    
    // Enhanced regex to detect names (First Last format)
    const nameRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
    
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        return (
          <a 
            key={index} 
            href={part} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: '#007bff', textDecoration: 'underline' }}
          >
            {part}
          </a>
        );
      }
      
      // Handle mentions (@username)
      const mentionParts = part.split(mentionRegex);
      const processedMentionParts = mentionParts.map((mentionPart, mentionIndex) => {
        if (mentionRegex.test(mentionPart)) {
          // Extract username from @username
          const username = mentionPart.substring(1); // Remove @
          
          // Check if this mention matches the reply author's name
          const replyAuthorName = `${reply.user.f_name} ${reply.user.m_name || ''} ${reply.user.l_name}`.trim();
          const isReplyAuthor = username.toLowerCase() === replyAuthorName.toLowerCase().replace(/\s+/g, '');
          
          return (
            <button
              key={`${index}-${mentionIndex}`}
              onClick={() => {
                if (isReplyAuthor) {
                  // If it's the reply author, go directly to their profile
                  window.location.href = getProfilePath(reply.user.user_id);
                } else {
                  // Search for the user and redirect to their profile
                  handleUserSearch(username);
                }
              }}
              style={{ 
                color: '#007bff', 
                fontWeight: '600',
                background: 'none',
                border: 'none',
                padding: '0',
                cursor: 'pointer',
                textDecoration: 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = 'none';
              }}
            >
              {mentionPart}
            </button>
          );
        }
        
        // Handle names (First Last format)
        const nameParts = mentionPart.split(nameRegex);
        return nameParts.map((namePart, nameIndex) => {
          if (nameRegex.test(namePart)) {
            // Check if this name matches the reply author's name
            const replyAuthorName = `${reply.user.f_name} ${reply.user.m_name || ''} ${reply.user.l_name}`.trim();
            const isReplyAuthor = namePart.toLowerCase() === replyAuthorName.toLowerCase();
            
            return (
              <button
                key={`${index}-${mentionIndex}-${nameIndex}`}
                onClick={() => {
                  if (isReplyAuthor) {
                    // If it's the reply author, go directly to their profile
                    window.location.href = getProfilePath(reply.user.user_id);
                  } else {
                    // Search for the user and redirect to their profile
                    handleUserSearch(namePart);
                  }
                }}
                style={{ 
                  color: '#007bff', 
                  fontWeight: '600',
                  background: 'none',
                  border: 'none',
                  padding: '0',
                  cursor: 'pointer',
                  textDecoration: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                {namePart}
              </button>
            );
          }
          return namePart;
        });
      });
      
      return processedMentionParts;
    });
  };

  return (
    <div style={{ 
      marginTop: '6px', 
      marginLeft: '32px',
      display: 'flex',
      gap: '8px'
    }}>
      {/* User Avatar */}
      <img
        src={userAvatar}
        alt={userName}
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
          cursor: 'pointer'
        }}
        onClick={() => window.location.href = getProfilePath(reply.user.user_id)}
      />
      
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Reply Content Container */}
        <div style={{
          backgroundColor: '#f0f2f5',
          borderRadius: '18px',
          padding: '8px 12px',
          display: 'inline-block',
          maxWidth: '100%'
        }}>
          {/* User Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
            <button
              onClick={() => window.location.href = getProfilePath(reply.user.user_id)}
              style={{
                background: 'none',
                border: 'none',
                padding: '0',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px',
                color: '#050505',
                textDecoration: 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = 'none';
              }}
            >
              {userName}
            </button>
            
            {/* Three dots menu for own replies - inside bubble */}
            {isOwnReply && (
              <div style={{ position: 'relative', marginLeft: 'auto' }} ref={optionsRef}>
                <button
                  onClick={() => setShowOptions(!showOptions)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0 4px',
                    fontSize: '14px',
                    color: '#65676b',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#050505';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#65676b';
                  }}
                >
                  ⋯
                </button>
                
                {showOptions && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: '0',
                    marginTop: '4px',
                    backgroundColor: 'white',
                    border: '1px solid #e4e6eb',
                    borderRadius: '8px',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    minWidth: '120px',
                    overflow: 'hidden'
                  }}>
                    <button
                      onClick={() => {
                        setIsEditing(true);
                        setShowOptions(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: 'none',
                        background: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '13px',
                        color: '#050505',
                        fontWeight: '400'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f2f3f5';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        handleDelete();
                        setShowOptions(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: 'none',
                        background: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '13px',
                        color: '#050505',
                        fontWeight: '400'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f2f3f5';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Reply Content */}
          {isEditing ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              style={{
                width: '100%',
                minHeight: '50px',
                padding: '8px 12px',
                border: '1px solid #ccd0d5',
                borderRadius: '18px',
                fontSize: '13px',
                resize: 'vertical',
                fontFamily: 'inherit',
                backgroundColor: '#ffffff'
              }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleEdit();
                } else if (e.key === 'Escape') {
                  setIsEditing(false);
                  setEditContent(reply.reply_content);
                }
              }}
            />
          ) : (
            <div style={{ 
              fontSize: '13px', 
              color: '#050505', 
              lineHeight: '1.38',
              wordBreak: 'break-word'
            }}>
              {renderTextWithLinks(reply.reply_content)}
            </div>
          )}
        </div>
        
        {/* Actions below the bubble - Time and Reply button */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          marginTop: '2px',
          marginLeft: '12px'
        }}>
          <span style={{ 
            fontSize: '12px', 
            color: '#65676b',
            fontWeight: '400'
          }}>
            {formatTime(reply.date_created)}
          </span>
          
          {!isEditing && (
            <button
              onClick={() => {
                setShowReplyInput(!showReplyInput);
                if (!showReplyInput) {
                  setReplyContent(`@${userName} `);
                }
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
              Reply
            </button>
          )}
          
          {isEditing && (
            <>
              <button
                onClick={handleEdit}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0866ff',
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
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(reply.reply_content);
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
            </>
          )}
        </div>

        {/* Reply Input */}
        {showReplyInput && (
          <div style={{ 
            marginTop: '8px',
            marginLeft: '0'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <img
                src={displayAvatar || ctulogo}
                alt={displayName || 'User'}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  flexShrink: 0
                }}
              />
              <div style={{ flex: 1 }}>
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder={`Reply to ${userName}...`}
                  style={{
                    width: '100%',
                    minHeight: '32px',
                    maxHeight: '120px',
                    padding: '8px 12px',
                    border: '1px solid #ccd0d5',
                    borderRadius: '18px',
                    fontSize: '13px',
                    resize: 'none',
                    fontFamily: 'inherit',
                    backgroundColor: '#f0f2f5'
                  }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleReplySubmit();
                    } else if (e.key === 'Escape') {
                      setShowReplyInput(false);
                      setReplyContent('');
                    }
                  }}
                />
                <div style={{ 
                  display: 'flex', 
                  gap: '12px', 
                  marginTop: '4px',
                  marginLeft: '12px'
                }}>
                  <button
                    onClick={handleReplySubmit}
                    disabled={!replyContent.trim() || isSubmittingReply}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: !replyContent.trim() || isSubmittingReply ? '#bcc0c4' : '#0866ff',
                      cursor: !replyContent.trim() || isSubmittingReply ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      padding: '0',
                      fontWeight: '600'
                    }}
                    onMouseEnter={(e) => {
                      if (replyContent.trim() && !isSubmittingReply) {
                        e.currentTarget.style.textDecoration = 'underline';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.textDecoration = 'none';
                    }}
                  >
                    {isSubmittingReply ? 'Posting...' : 'Reply'}
                  </button>
                  <button
                    onClick={() => {
                      setShowReplyInput(false);
                      setReplyContent('');
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
          </div>
        )}
      </div>
    </div>
  );
};

export default Reply;

