import React from 'react';

/**
 * Detects URLs in text and renders them as clickable links
 * Supports http://, https://, www., and plain domain patterns
 */
export const renderTextWithLinks = (text: string, linkStyle?: React.CSSProperties): React.ReactNode[] => {
  if (!text) return [];
  
  // Enhanced URL regex that matches:
  // - http:// or https:// URLs
  // - www. URLs
  // - plain domains (like example.com)
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.(com|net|org|edu|gov|io|co|uk|ph|info|biz|xyz|me|tv|cc|ws|name|mobi|asia|jobs|museum|travel)[^\s]*)/gi;
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;
  
  // Reset regex for global search
  urlRegex.lastIndex = 0;
  
  while ((match = urlRegex.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      parts.push(<span key={`text-${key++}`}>{text.substring(lastIndex, match.index)}</span>);
    }
    
    // Create clickable link
    let url = match[0];
    
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    parts.push(
      <a
        key={`link-${key++}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          e.stopPropagation();
          window.open(url, '_blank', 'noopener,noreferrer');
        }}
        style={{
          color: '#007bff',
          textDecoration: 'underline',
          cursor: 'pointer',
          wordBreak: 'break-all',
          ...linkStyle
        }}
      >
        {match[0]}
      </a>
    );
    
    lastIndex = urlRegex.lastIndex;
  }
  
  // Add remaining text after the last URL
  if (lastIndex < text.length) {
    parts.push(<span key={`text-${key++}`}>{text.substring(lastIndex)}</span>);
  }
  
  // If no URLs found, return the original text
  if (parts.length === 0) {
    return [<span key="text-only">{text}</span>];
  }
  
  return parts;
};

