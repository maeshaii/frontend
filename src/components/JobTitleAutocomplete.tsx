import React, { useState, useEffect, useRef } from 'react';
import { api, publicApi } from '../services/api';
import JobAlignmentConfirmation from './JobAlignmentConfirmation';
import './JobTitleAutocomplete.css';

interface JobSuggestion {
  title: string;
  program: string;
  code: string;
}

interface JobTitleAutocompleteProps {
  userId: number;
  value?: string;
  onChange?: (value: string) => void;
  onAlignmentComplete?: (status: string) => void;
  placeholder?: string;
}

const JobTitleAutocomplete: React.FC<JobTitleAutocompleteProps> = ({
  userId,
  value = '',
  onChange,
  onAlignmentComplete,
  placeholder = "Select or type Job Title"
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<JobSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showAlignmentConfirmation, setShowAlignmentConfirmation] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Debounced search function
  const searchJobs = async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);
    try {
      const response = await publicApi.get('/shared/job-autocomplete/', {
        params: { q: query, limit: 20 }
      });

      if (response.data.success) {
        setSuggestions(response.data.suggestions);
        setShowSuggestions(true);
        setSelectedIndex(-1);
      }
    } catch (error) {
      console.error('Error fetching job suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange?.(newValue);

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce search
    debounceRef.current = setTimeout(() => {
      searchJobs(newValue);
    }, 300);
  };

  // Handle suggestion selection
  const handleSuggestionSelect = async (suggestion: JobSuggestion) => {
    setInputValue(suggestion.title);
    setShowSuggestions(false);
    onChange?.(suggestion.title);
    
    // Check alignment for selected job
    await checkJobAlignment(suggestion.title, true);
  };

  // Handle manual input (when user finishes typing)
  const handleInputBlur = async () => {
    // Small delay to allow suggestion clicks
    setTimeout(async () => {
      if (inputValue.trim() && !suggestions.some(s => s.title.toLowerCase() === inputValue.toLowerCase())) {
        // User typed something not in autocomplete
        await checkJobAlignment(inputValue, false);
      }
      setShowSuggestions(false);
    }, 150);
  };

  // Check job alignment
  const checkJobAlignment = async (position: string, fromAutocomplete: boolean) => {
    try {
      const response = await publicApi.post('/shared/check-job-alignment/', {
        position: position,
        user_id: userId,
        from_autocomplete: fromAutocomplete
      });

      const normalizedPosition = response.data.normalized_position || position;
      setInputValue(normalizedPosition);
      onChange?.(normalizedPosition);

      if (response.data.needs_confirmation) {
        setShowAlignmentConfirmation(true);
      } else {
        onAlignmentComplete?.(response.data.job_alignment_status);
      }
    } catch (error) {
      console.error('Error checking job alignment:', error);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (showSuggestions && suggestions.length > 0) {
          setSelectedIndex(prev => 
            prev < suggestions.length - 1 ? prev + 1 : prev
          );
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (showSuggestions && suggestions.length > 0) {
          setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (showSuggestions && selectedIndex >= 0) {
          handleSuggestionSelect(suggestions[selectedIndex]);
        } else if (inputValue.trim()) {
          // Check alignment for manually typed job
          checkJobAlignment(inputValue.trim(), false);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Handle alignment confirmation
  const handleAlignmentComplete = (status: string) => {
    setShowAlignmentConfirmation(false);
    onAlignmentComplete?.(status);
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className="job-title-autocomplete">
      <div className="autocomplete-container">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="autocomplete-input"
          autoComplete="off"
        />
        
        {loading && (
          <div className="autocomplete-loading">
            <div className="spinner"></div>
          </div>
        )}

        {showSuggestions && suggestions.length > 0 && (
          <div ref={suggestionsRef} className="autocomplete-suggestions">
            {suggestions.map((suggestion, index) => (
              <div
                key={`${suggestion.title}-${suggestion.program}`}
                className={`suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleSuggestionSelect(suggestion)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="suggestion-title">
                  <strong>{suggestion.title}</strong>
                </div>
                <div className="suggestion-meta">
                  <span className="suggestion-program">{suggestion.program}</span>
                  <span className="suggestion-code">Code: {suggestion.code}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAlignmentConfirmation && (
        <JobAlignmentConfirmation
          position={inputValue}
          userId={userId}
          onAlignmentComplete={handleAlignmentComplete}
        />
      )}
    </div>
  );
};

export default JobTitleAutocomplete;


