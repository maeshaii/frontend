import React, { useState } from 'react';

interface SeeMoreTextProps {
  text: string;
  maxLength?: number;
  renderText?: (text: string) => React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  buttonBelow?: boolean; // If true, button appears below text instead of inline
}

const SeeMoreText: React.FC<SeeMoreTextProps> = ({
  text,
  maxLength = 500,
  renderText,
  className,
  style,
  buttonBelow = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!text || text.length <= maxLength) {
    return (
      <div className={className} style={style}>
        {renderText ? renderText(text) : text}
      </div>
    );
  }

  const truncatedText = text.substring(0, maxLength);
  const displayText = isExpanded ? text : truncatedText;

  const buttonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#1da1f2',
    cursor: 'pointer',
    padding: 0,
    margin: 0,
    fontSize: 'inherit',
    fontWeight: 600,
    textDecoration: 'none',
    display: buttonBelow ? 'block' : 'inline',
    ...(buttonBelow ? { marginTop: '4px' } : {})
  };

  return (
    <div 
      className={className} 
      style={style}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {renderText ? renderText(displayText) : displayText}
      {!isExpanded && (
        buttonBelow ? (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsExpanded(true);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            style={buttonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textDecoration = 'none';
            }}
          >
            See more
          </button>
        ) : (
          <>
            {' '}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsExpanded(true);
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              style={buttonStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = 'none';
              }}
            >
              See more
            </button>
          </>
        )
      )}
      {isExpanded && (
        buttonBelow ? (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsExpanded(false);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            style={buttonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textDecoration = 'none';
            }}
          >
            See less
          </button>
        ) : (
          <>
            {' '}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsExpanded(false);
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              style={buttonStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = 'none';
              }}
            >
              See less
            </button>
          </>
        )
      )}
    </div>
  );
};

export default SeeMoreText;

