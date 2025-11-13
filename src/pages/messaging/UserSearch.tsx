import React, { useState, useCallback, useEffect, useRef } from 'react';
import { searchUsersForMessaging, createConversation } from '../../services/api';
import './Messaging.css';

interface UserSearchProps {
  onConversationCreated: (conversation: any) => void;
  onClose: () => void;
}

type UserRow = { 
  user_id: number; 
  f_name: string; 
  l_name: string;
  avatar_url?: string | null;
  profile_pic?: string | null;
};

const UserSearch: React.FC<UserSearchProps> = ({ onConversationCreated, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingConversation, setIsCreatingConversation] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search - auto-search as user types
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const data = await searchUsersForMessaging(trimmedQuery);
        setResults(data.users || []);
        setError(null);
      } catch (err) {
        console.error('Search failed:', err);
        setError('Search failed. Please try again.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Close on overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const startConversation = async (user: UserRow) => {
    if (isCreatingConversation) return;
    
    setIsCreatingConversation(user.user_id);
    setError(null);
    
    try {
      const conversation = await createConversation(user.user_id);
      onConversationCreated(conversation);
      onClose();
    } catch (err) {
      console.error('Create conversation failed:', err);
      setError('Failed to start conversation. Please try again.');
      setIsCreatingConversation(null);
    }
  };

  const getInitials = (user: UserRow) => {
    const first = user.f_name?.charAt(0).toUpperCase() || '';
    const last = user.l_name?.charAt(0).toUpperCase() || '';
    return first + last;
  };

  const getAvatarUrl = (user: UserRow) => {
    const avatar = user.avatar_url || user.profile_pic;
    if (!avatar) return null;
    
    if (avatar.startsWith('http')) {
      return avatar;
    }
    
    return `${window.location.origin}${avatar}`;
  };

  return (
    <div 
      className="new-conversation-modal-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div 
        ref={modalRef}
        className="new-conversation-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="new-conversation-modal-header">
          <div className="new-conversation-modal-header-content">
            <h2 id="modal-title" className="new-conversation-modal-title">
              Start New Conversation
            </h2>
            <p className="new-conversation-modal-subtitle">
              Search for users to start a conversation
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="new-conversation-modal-close"
            aria-label="Close modal"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Search Input */}
        <div className="new-conversation-search-container">
          <div className="new-conversation-search-wrapper">
            <svg 
              className="new-conversation-search-icon" 
              width="20" 
              height="20" 
              viewBox="0 0 20 20" 
              fill="none"
            >
              <path 
                d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16zM18 18l-4-4" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search by name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="new-conversation-search-input"
              aria-label="Search for users"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="new-conversation-search-clear"
                aria-label="Clear search"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
          {query.length > 0 && query.length < 2 && (
            <p className="new-conversation-search-hint">
              Type at least 2 characters to search
            </p>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="new-conversation-error" role="alert">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path 
                d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM10 6v4M10 14h.01" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Results */}
        <div className="new-conversation-results">
          {loading ? (
            <div className="new-conversation-loading">
              {[1, 2, 3].map((i) => (
                <div key={i} className="new-conversation-skeleton">
                  <div className="skeleton-avatar"></div>
                  <div className="skeleton-content">
                    <div className="skeleton-line skeleton-name"></div>
                    <div className="skeleton-line skeleton-subtitle"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : query.length < 2 ? (
            <div className="new-conversation-empty-state">
              <div className="empty-state-icon">🔍</div>
              <h3 className="empty-state-title">Start typing to search</h3>
              <p className="empty-state-message">
                Enter at least 2 characters to find users
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="new-conversation-empty-state">
              <div className="empty-state-icon">👤</div>
              <h3 className="empty-state-title">No users found</h3>
              <p className="empty-state-message">
                No users found matching "{query}". Try a different search term.
              </p>
            </div>
          ) : (
            <div className="new-conversation-results-list">
              {results.map((user) => {
                const avatarUrl = getAvatarUrl(user);
                const isCreating = isCreatingConversation === user.user_id;
                
                return (
                  <div
                    key={user.user_id}
                    className={`new-conversation-user-item ${isCreating ? 'creating' : ''}`}
                    onClick={() => !isCreating && startConversation(user)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isCreating) {
                        startConversation(user);
                      }
                    }}
                    aria-label={`Start conversation with ${user.f_name} ${user.l_name}`}
                  >
                    <div className="user-item-avatar">
                      {avatarUrl ? (
                        <img 
                          src={avatarUrl} 
                          alt={`${user.f_name} ${user.l_name}`}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              const initials = getInitials(user);
                              parent.innerHTML = `<div class="avatar-fallback">${initials}</div>`;
                            }
                          }}
                        />
                      ) : (
                        <div className="avatar-fallback">
                          {getInitials(user)}
                        </div>
                      )}
                    </div>
                    <div className="user-item-info">
                      <div className="user-item-name">
                        {user.f_name} {user.l_name}
                      </div>
                      <div className="user-item-subtitle">
                        Tap to start chatting
                      </div>
                    </div>
                    <div className="user-item-action">
                      {isCreating ? (
                        <div className="action-spinner"></div>
                      ) : (
                        <svg 
                          className="action-icon" 
                          width="20" 
                          height="20" 
                          viewBox="0 0 20 20" 
                          fill="none"
                        >
                          <path 
                            d="M4 10h12M10 4l6 6-6 6" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserSearch;


