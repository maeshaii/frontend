import React, { useState, useCallback } from 'react';
import { searchUsersForMessaging, createConversation } from '../../services/api';
import './Messaging.css';

interface UserSearchProps {
  onConversationCreated: (conversation: any) => void;
  onClose: () => void;
}

type UserRow = { user_id: number; f_name: string; l_name: string };

const UserSearch: React.FC<UserSearchProps> = ({ onConversationCreated, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchUsers = useCallback(async () => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await searchUsersForMessaging(trimmedQuery);
      setResults(data.users || []);
    } catch (err) {
      console.error('Search failed:', err);
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchUsers();
  };

  const startConversation = async (user: UserRow) => {
    try {
      const conversation = await createConversation(user.user_id);
      onConversationCreated(conversation);
      onClose();
    } catch (err) {
      console.error('Create conversation failed:', err);
      setError('Failed to start conversation. Please try again.');
    }
  };

  return (
    <div className="user-search-overlay">
      <div className="user-search-modal">
        <div className="user-search-header">
          <h2>Start New Conversation</h2>
          <button onClick={onClose} className="close-button">
            ×
          </button>
        </div>

        <form onSubmit={handleSearch} className="user-search-form">
          <div className="search-input-wrapper">
            <input
              type="text"
              placeholder="Search for users..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="search-input"
              autoFocus
            />
            <button type="submit" className="search-button" disabled={loading}>
              {loading ? '...' : 'Search'}
            </button>
          </div>
        </form>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="search-results">
          {results.length === 0 && query.length >= 2 && !loading ? (
            <div className="no-results">
              <p>No users found for "{query}"</p>
            </div>
          ) : (
            results.map((user) => (
              <div
                key={user.user_id}
                className="user-result-item"
                onClick={() => startConversation(user)}
              >
                <div className="user-avatar">
                  {user.f_name.charAt(0)}
                </div>
                <div className="user-info">
                  <div className="user-name">
                    {user.f_name} {user.l_name}
                  </div>
                </div>
                <div className="start-chat-button">
                  Start Chat
                </div>
              </div>
            ))
          )}
        </div>

        {query.length < 2 && (
          <div className="search-hint">
            <p>Type at least 2 characters to search for users</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserSearch;


