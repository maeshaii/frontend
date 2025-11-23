import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { getFollowingForMentions } from '../services/api';
import ctulogo from '../images/ctulogo.png';
import { getProfilePicUrl, handleProfilePicError } from '../utils/profilePicUtils';

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}

interface User {
  user_id: number;
  name: string;
  f_name: string;
  m_name: string;
  l_name: string;
  profile_pic: string;
}

const MentionInput: React.FC<MentionInputProps> = ({
  value,
  onChange,
  placeholder = "Write a reply...",
  onSubmit,
  disabled = false,
  style = {}
}) => {
  const [following, setFollowing] = useState<User[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [mentionStart, setMentionStart] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Load following users on component mount
  useEffect(() => {
    const loadFollowing = async () => {
      try {
        const response = await getFollowingForMentions();
        if (response.success) {
          setFollowing(response.following);
        }
      } catch (error) {
        console.error('Error loading following users:', error);
      }
    };
    loadFollowing();
  }, []);

  // Handle text change and detect @mentions
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = newValue.substring(0, cursorPosition);
    
    // Find the last @ symbol before cursor
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      
      // Check if there's no space after @ (meaning we're typing a mention)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionStart(lastAtIndex);
        setMentionQuery(textAfterAt);
        setShowSuggestions(true);
        
        // Filter suggestions based on what's typed after @
        const filteredSuggestions = following.filter(user =>
          user.name.toLowerCase().includes(textAfterAt.toLowerCase()) ||
          user.f_name.toLowerCase().includes(textAfterAt.toLowerCase()) ||
          user.l_name.toLowerCase().includes(textAfterAt.toLowerCase())
        );
        setSuggestions(filteredSuggestions);
        setSelectedIndex(0);
      } else {
        setShowSuggestions(false);
        setMentionQuery('');
      }
    } else {
      setShowSuggestions(false);
      setMentionQuery('');
    }
  };

  // Handle suggestion selection
  const selectSuggestion = (user: User) => {
    if (mentionStart === -1) return;

    const beforeMention = value.substring(0, mentionStart);
    const afterMention = value.substring(value.length);
    
    const newValue = beforeMention + `@${user.name} ` + afterMention;
    onChange(newValue);
    
    setShowSuggestions(false);
    setMentionStart(-1);
    setMentionQuery('');
    
    // Focus back to textarea
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = beforeMention.length + user.name.length + 2; // +2 for @ and space
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions) {
      if (e.key === 'Enter' && !e.shiftKey && onSubmit) {
        e.preventDefault();
        onSubmit();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (suggestions[selectedIndex]) {
          selectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setMentionQuery('');
        break;
      case 'Backspace':
        // If backspacing and we're at the mention start, close suggestions
        if (mentionQuery === '' && mentionStart !== -1) {
          setShowSuggestions(false);
          setMentionStart(-1);
        }
        break;
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) &&
          textareaRef.current && !textareaRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setMentionQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  // Calculate dropdown position when suggestions are shown
  useEffect(() => {
    if (showSuggestions && textareaRef.current) {
      const updatePosition = () => {
        if (textareaRef.current) {
          const rect = textareaRef.current.getBoundingClientRect();
          setDropdownPosition({
            top: rect.bottom + window.scrollY + 4,
            left: rect.left + window.scrollX,
            width: rect.width
          });
        }
      };
      
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    } else {
      setDropdownPosition(null);
    }
  }, [showSuggestions, value]);

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: '100%',
          minHeight: '60px',
          padding: '8px 12px',
          border: '1px solid #ddd',
          borderRadius: '20px',
          fontSize: '13px',
          fontFamily: 'inherit',
          resize: 'vertical',
          outline: 'none',
          transition: 'border-color 0.2s ease',
          ...style
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = '#007bff';
          // Re-trigger mention detection on focus
          const cursorPosition = e.currentTarget.selectionStart;
          const textBeforeCursor = value.substring(0, cursorPosition);
          const lastAtIndex = textBeforeCursor.lastIndexOf('@');
          
          if (lastAtIndex !== -1) {
            const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
            if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
              setMentionStart(lastAtIndex);
              setMentionQuery(textAfterAt);
              setShowSuggestions(true);
              const filteredSuggestions = following.filter(user =>
                user.name.toLowerCase().includes(textAfterAt.toLowerCase()) ||
                user.f_name.toLowerCase().includes(textAfterAt.toLowerCase()) ||
                user.l_name.toLowerCase().includes(textAfterAt.toLowerCase())
              );
              setSuggestions(filteredSuggestions);
              setSelectedIndex(0);
            }
          }
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = '#ddd';
        }}
      />
      
      {/* Facebook-style Mention Suggestions Dropdown - Rendered via portal to avoid clipping */}
      {showSuggestions && suggestions.length > 0 && dropdownPosition && ReactDOM.createPortal(
        <div
          ref={suggestionsRef}
          style={{
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            backgroundColor: 'white',
            border: '1px solid #e4e6ea',
            borderRadius: '8px',
            boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 10000,
            maxHeight: '300px',
            overflowY: 'auto',
            marginTop: '4px'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '8px 12px',
            borderBottom: '1px solid #e4e6ea',
            backgroundColor: '#f8f9fa',
            fontSize: '12px',
            fontWeight: '600',
            color: '#65676b'
          }}>
            Mention someone
          </div>
          
          {/* Suggestions */}
          {suggestions.map((user, index) => (
            <div
              key={user.user_id}
              onClick={() => selectSuggestion(user)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                backgroundColor: index === selectedIndex ? '#e3f2fd' : 'transparent',
                borderBottom: index < suggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'background-color 0.1s ease'
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <img
                src={getProfilePicUrl(user.profile_pic)}
                alt={user.name}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '1px solid #e4e6ea'
                }}
                onError={(e) => handleProfilePicError(e)}
              />
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: '600',
                  color: '#1c1e21',
                  marginBottom: '2px'
                }}>
                  {user.f_name} {user.m_name || ''} {user.l_name}
                </div>
              </div>
            </div>
          ))}
          
          {/* Footer hint */}
          {suggestions.length === 0 && mentionQuery && (
            <div style={{
              padding: '12px',
              textAlign: 'center',
              fontSize: '12px',
              color: '#65676b',
              fontStyle: 'italic'
            }}>
              No users found matching "{mentionQuery}"
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default MentionInput;
