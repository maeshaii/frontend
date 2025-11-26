import React, { useState, useRef, useEffect } from 'react';
import { editReply, deleteReply, createReply, searchAlumni, getUserPoints, getFollowingForMentions } from '../services/api';
import ctulogo from '../images/ctulogo.png';
import { getProfilePicUrl, handleProfilePicError } from '../utils/profilePicUtils';
import ConfirmModal from './ConfirmModal';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

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
  registerHighlightRef?: (replyId: number, element: HTMLDivElement | null) => void;
  isHighlighted?: boolean;
  highlightColor?: string;
}

const Reply: React.FC<ReplyProps> = ({ 
  reply, 
  commentId, 
  currentUserId, 
  formatTime, 
  onReplyUpdate,
  displayName,
  displayAvatar,
  registerHighlightRef,
  isHighlighted = false,
  highlightColor
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(reply.reply_content);
  const [showOptions, setShowOptions] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [followingUsers, setFollowingUsers] = useState<any[]>([]);
  const [showDeleteReplyModal, setShowDeleteReplyModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load following users for @mentions
  useEffect(() => {
    const loadFollowing = async () => {
      try {
        const response = await getFollowingForMentions();
        if (response.success) {
          setFollowingUsers(response.following);
        }
      } catch (error) {
        console.error('Error loading following users:', error);
      }
    };
    loadFollowing();
  }, []);

  useEffect(() => {
    if (!registerHighlightRef) return;
    registerHighlightRef(reply.reply_id, containerRef.current);
    return () => {
      registerHighlightRef(reply.reply_id, null);
    };
  }, [registerHighlightRef, reply.reply_id]);

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
      return `/profile/${userId}`;
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
          window.location.href = `/profile/${user.id}`;
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

  const handleDelete = () => {
    setShowOptions(false);
    setShowDeleteReplyModal(true);
  };

  const confirmDeleteReply = async () => {
    try {
      await deleteReply(commentId, reply.reply_id);
      onReplyUpdate();
      setShowDeleteReplyModal(false);
    } catch (error) {
      console.error('Error deleting reply:', error);
      setShowDeleteReplyModal(false);
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
      
      // Refresh points after successful reply (for Alumni and OJT users)
      if (currentUserId) {
        // Add a small delay to ensure backend has processed points update
        setTimeout(async () => {
          try {
            const points = await getUserPoints(currentUserId);
            // Dispatch event to notify Profile component
            window.dispatchEvent(new CustomEvent('pointsUpdated', { 
              detail: { userId: currentUserId, points } 
            }));
          } catch (error) {
            console.error('Error refreshing points after reply:', error);
          }
        }, 500); // 500ms delay to ensure backend has processed
      }
    } catch (error) {
      console.error('Error creating reply:', error);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const mentionRegex = /@([A-Za-z0-9_.]+(?:\s+[A-Za-z0-9_.]+)*)/g;
    // Do not auto-detect plain names to avoid over-highlighting
    
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
      
      // Handle mentions (@username) with support for partial matches
      // Helper function to check if a mention matches a known user
      const checkMentionMatch = (mentionText: string): { matched: boolean; user?: any; matchedName?: string } => {
        const normalizedMention = mentionText.toLowerCase().replace(/\s+/g, '');
        
        // Check reply author
        const replyAuthorName = `${reply.user.f_name} ${reply.user.m_name || ''} ${reply.user.l_name}`.trim();
        const normalizedReplyAuthor = replyAuthorName.toLowerCase().replace(/\s+/g, '');
        if (normalizedMention === normalizedReplyAuthor) {
          return { matched: true, user: reply.user, matchedName: replyAuthorName };
        }
        
        // Check if mention starts with reply author name (partial match)
        if (normalizedMention.startsWith(normalizedReplyAuthor)) {
          return { matched: true, user: reply.user, matchedName: replyAuthorName };
        }
        
        // Check following users
        for (const user of followingUsers) {
          const userName = `${user.f_name} ${user.m_name || ''} ${user.l_name}`.trim();
          const normalizedUserName = userName.toLowerCase().replace(/\s+/g, '');
          if (normalizedMention === normalizedUserName) {
            return { matched: true, user, matchedName: userName };
          }
          // Check partial match
          if (normalizedMention.startsWith(normalizedUserName)) {
            return { matched: true, user, matchedName: userName };
          }
        }
        
        return { matched: false };
      };
      
      const result: React.ReactNode[] = [];
      let lastIndex = 0;
      let match;
      mentionRegex.lastIndex = 0;
      
      while ((match = mentionRegex.exec(part)) !== null) {
        // Add text before the mention
        if (match.index > lastIndex) {
          result.push(part.substring(lastIndex, match.index));
        }
        
        const mentionText = match[1]; // Don't trim yet, we need the original spacing
        if (mentionText) {
          const matchResult = checkMentionMatch(mentionText);
          
          if (matchResult.matched && matchResult.user && matchResult.matchedName) {
            const normalizedMention = mentionText.toLowerCase().replace(/\s+/g, '');
            const normalizedMatchedName = matchResult.matchedName.toLowerCase().replace(/\s+/g, '');
            const isExactMatch = normalizedMention === normalizedMatchedName;
            const startsWithName = normalizedMention.startsWith(normalizedMatchedName);
            
            if (isExactMatch) {
              // Exact match - highlight the entire mention
              const matchedUser = matchResult.user;
              result.push(
                <button
                  key={`${index}-mention-${match.index}`}
                  onClick={() => {
                    const userId = matchedUser.user_id || matchedUser.id;
                    if (userId) {
                      window.location.href = getProfilePath(userId);
                    } else {
                      handleUserSearch(mentionText);
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
                  @{mentionText}
                </button>
              );
            } else if (startsWithName) {
              // Partial match - find where the user's name ends in the mention text
              const mentionWords = mentionText.split(/\s+/);
              const nameWords = matchResult.matchedName.split(/\s+/);
              
              let matchedWordCount = 0;
              for (let i = 0; i < Math.min(mentionWords.length, nameWords.length); i++) {
                if (mentionWords[i].toLowerCase() === nameWords[i].toLowerCase()) {
                  matchedWordCount++;
                } else {
                  break;
                }
              }
              
              if (matchedWordCount > 0 && matchedWordCount <= mentionWords.length) {
                // Build a regex pattern to match the exact name at the start of mentionText
                // Escape special regex characters in the name
                const escapedName = matchResult.matchedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                // Create a pattern that matches the name followed by optional whitespace and more text
                const namePattern = new RegExp(`^(${escapedName})(\\s+.*)?$`, 'i');
                const nameMatch = mentionText.match(namePattern);
                
                if (nameMatch && nameMatch[1]) {
                  // Found exact match of the name at the start
                  const matchedPart = nameMatch[1];
                  const remainingPart = mentionText.substring(matchedPart.length);
                  const matchedUser = matchResult.user;
                  
                  result.push(
                    <button
                      key={`${index}-mention-${match.index}`}
                      onClick={() => {
                        const userId = matchedUser.user_id || matchedUser.id;
                        if (userId) {
                          window.location.href = getProfilePath(userId);
                        } else {
                          handleUserSearch(matchedPart.trim());
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
                      @{matchedPart}
                    </button>
                  );
                  
                  // Add remaining text as normal text
                  if (remainingPart.trim()) {
                    result.push(remainingPart);
                  }
                } else {
                  // Fallback: use word-based matching
                  const matchedWords = mentionWords.slice(0, matchedWordCount);
                  // Find the position where these words end in the original text
                  let searchPos = 0;
                  for (let i = 0; i < matchedWords.length; i++) {
                    const wordPos = mentionText.indexOf(matchedWords[i], searchPos);
                    if (wordPos !== -1) {
                      searchPos = wordPos + matchedWords[i].length;
                    } else {
                      break;
                    }
                  }
                  
                  const matchedPart = mentionText.substring(0, searchPos);
                  const remainingPart = mentionText.substring(searchPos);
                  const matchedUser = matchResult.user;
                  
                  result.push(
                    <button
                      key={`${index}-mention-${match.index}`}
                      onClick={() => {
                        const userId = matchedUser.user_id || matchedUser.id;
                        if (userId) {
                          window.location.href = getProfilePath(userId);
                        } else {
                          handleUserSearch(matchedPart.trim());
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
                      @{matchedPart}
                    </button>
                  );
                  
                  if (remainingPart.trim()) {
                    result.push(remainingPart);
                  }
                }
              } else {
                // No match found - but still highlight in blue and make clickable
                result.push(
                  <button
                    key={`${index}-mention-${match.index}`}
                    onClick={() => handleUserSearch(mentionText)}
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
                    @{mentionText}
                  </button>
                );
              }
            } else {
              // No match found - but still highlight in blue and make clickable
              result.push(
                <button
                  key={`${index}-mention-${match.index}`}
                  onClick={() => handleUserSearch(mentionText)}
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
                  @{mentionText}
                </button>
              );
            }
          } else {
            // No match found - but still highlight in blue and make clickable
            result.push(
              <button
                key={`${index}-mention-${match.index}`}
                onClick={() => handleUserSearch(mentionText)}
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
                @{mentionText}
              </button>
            );
          }
        }
        
        lastIndex = mentionRegex.lastIndex;
      }
      
      // Add remaining text after the last mention
      if (lastIndex < part.length) {
        result.push(part.substring(lastIndex));
      }
      
      // If no mentions found, return the original part
      if (result.length === 0) {
        return part;
      }
      
      return result;
    });
  };

  return (
    <div
      ref={containerRef}
      style={{ 
        marginTop: '4px', 
        marginLeft: '32px',
        display: 'flex',
        gap: '8px',
        scrollMarginTop: '96px'
      }}
    >
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
          backgroundColor: isHighlighted ? (highlightColor || '#fff2e6') : '#f0f2f5',
          boxShadow: isHighlighted && highlightColor === '#fff3e0' 
            ? '0 0 0 2px rgba(255,137,33,0.25)' 
            : isHighlighted && highlightColor === '#fff8e1'
              ? '0 0 0 1px #ffb74d'
              : 'none',
          transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
          borderRadius: '18px',
          padding: '6px 10px',
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
            gap: '8px', 
            marginTop: '1px',
            marginLeft: '10px'
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
                  // Only add mention if not replying to your own reply
                  if (!isOwnReply) {
                    setReplyContent(`@${userName} `);
                  } else {
                    setReplyContent('');
                  }
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
            marginTop: '4px',
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
              <div style={{ flex: 1, position: 'relative' }}>
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder={`Reply to ${userName}...`}
                  style={{
                    width: '100%',
                    minHeight: '32px',
                    maxHeight: '120px',
                    padding: '10px 0px 10px 5px',
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
                <div style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  marginTop: '2px',
                  marginLeft: '10px'
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

      {/* Delete Reply Confirmation Modal */}
      <ConfirmModal
        open={showDeleteReplyModal}
        title="Delete Reply"
        message="Are you sure you want to delete this reply?"
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteReply}
        onCancel={() => setShowDeleteReplyModal(false)}
      />
    </div>
  );
};

export default Reply;

