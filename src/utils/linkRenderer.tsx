import React from 'react';

/**
 * Detects URLs and mentions (@username) in text and renders them appropriately
 * Supports http://, https://, www., and plain domain patterns
 * Handles mentions with proper word boundaries to prevent over-highlighting
 */
export const renderTextWithLinks = (text: string, linkStyle?: React.CSSProperties): React.ReactNode[] => {
  if (!text) return [];
  
  // Enhanced URL regex that matches:
  // - http:// or https:// URLs
  // - www. URLs
  // - plain domains (like example.com)
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.(com|net|org|edu|gov|io|co|uk|ph|info|biz|xyz|me|tv|cc|ws|name|mobi|asia|jobs|museum|travel)[^\s]*)/gi;
  
  // Mention regex with word boundary at the end to prevent over-matching
  // Matches @ followed by word characters, allowing spaces between words
  // CRITICAL: The (?=\s|$|[.,!?;:]) lookahead ensures it stops at:
  //   - whitespace (space, tab, newline) 
  //   - end of string
  //   - punctuation marks
  // This prevents text after the mention from being highlighted in blue
  // Example: "@Stephanie Mari sdsadass" matches only "@Stephanie Mari" (stops at space before "sdsadass")
  // Using non-greedy *? to match the shortest possible mention text
  const mentionRegex = /@([A-Za-z0-9_.]+(?:\s+[A-Za-z0-9_.]+)*?)(?=\s|$|[.,!?;:])/g;
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  
  // First, split text by URLs
  const urlParts: string[] = [];
  let urlLastIndex = 0;
  let urlMatch;
  urlRegex.lastIndex = 0;
  
  while ((urlMatch = urlRegex.exec(text)) !== null) {
    // Add text before the URL
    if (urlMatch.index > urlLastIndex) {
      urlParts.push(text.substring(urlLastIndex, urlMatch.index));
    }
    // Add URL marker (we'll process this separately)
    urlParts.push(`__URL_MARKER_${urlMatch.index}__${urlMatch[0]}__URL_MARKER_END__`);
    urlLastIndex = urlRegex.lastIndex;
  }
  
  // Add remaining text after the last URL
  if (urlLastIndex < text.length) {
    urlParts.push(text.substring(urlLastIndex));
  }
  
  // If no URLs found, use the original text
  if (urlParts.length === 0) {
    urlParts.push(text);
  }
  
  // Process each part (either text or URL)
  urlParts.forEach((part, urlIndex) => {
    // Check if this is a URL marker
    const urlMarkerMatch = part.match(/__URL_MARKER_(\d+)__(.+?)__URL_MARKER_END__/);
    if (urlMarkerMatch) {
      // This is a URL - render it as a link
      let url = urlMarkerMatch[2];
      
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
          {urlMarkerMatch[2]}
        </a>
      );
      return;
    }
    
    // This is text - process mentions within it
    let textLastIndex = 0;
    let mentionMatch;
    mentionRegex.lastIndex = 0;
    const mentionParts: React.ReactNode[] = [];
    
    while ((mentionMatch = mentionRegex.exec(part)) !== null) {
      // Add text before the mention
      if (mentionMatch.index > textLastIndex) {
        mentionParts.push(
          <span key={`text-${key++}`} style={linkStyle}>
            {part.substring(textLastIndex, mentionMatch.index)}
          </span>
        );
      }
      
      // Add the mention as a clickable button/link (blue highlighted)
      const mentionText = mentionMatch[1];
      mentionParts.push(
        <button
          key={`mention-${key++}`}
          onClick={(e) => {
            e.stopPropagation();
            // Navigate to user profile or search
            // For now, just prevent default behavior
          }}
          style={{
            color: '#007bff',
            fontWeight: '600',
            background: 'none',
            border: 'none',
            padding: '0',
            cursor: 'pointer',
            textDecoration: 'none',
            ...linkStyle
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
      
      // CRITICAL: Update lastIndex to move past the full mention match (including @ and word boundary)
      // This ensures text after the mention is not highlighted in blue
      textLastIndex = mentionRegex.lastIndex;
    }
    
    // Add remaining text after the last mention
    // This text should be in the original color (not blue), respecting linkStyle
    if (textLastIndex < part.length) {
      mentionParts.push(
        <span key={`text-after-${key++}`} style={linkStyle}>
          {part.substring(textLastIndex)}
        </span>
      );
    }
    
    // If no mentions found in this part, add it as regular text
    if (mentionParts.length === 0) {
      parts.push(
        <span key={`text-${key++}`} style={linkStyle}>
          {part}
        </span>
      );
    } else {
      parts.push(...mentionParts);
    }
  });
  
  // If no URLs or mentions found, return the original text with style
  if (parts.length === 0) {
    return [<span key="text-only" style={linkStyle}>{text}</span>];
  }
  
  return parts;
};


