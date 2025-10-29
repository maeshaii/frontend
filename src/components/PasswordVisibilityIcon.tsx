import React from 'react';

interface PasswordVisibilityIconProps {
  show: boolean;
  size?: number;
  color?: string;
}

/**
 * Password visibility icon component
 * Shows an open eye when password is visible, or an eye with diagonal line when hidden
 */
const PasswordVisibilityIcon: React.FC<PasswordVisibilityIconProps> = ({ 
  show, 
  size = 20, 
  color = 'currentColor' 
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      {/* Almond-shaped eye outline */}
      <ellipse
        cx="12"
        cy="12"
        rx="11"
        ry="7"
        fill="none"
      />
      {/* Pupil (circular) */}
      <circle cx="12" cy="12" r="2.5" fill="none" />
      {/* Diagonal line through the eye when password is hidden */}
      {!show && (
        <line x1="1" y1="1" x2="23" y2="23" strokeWidth="2.5" />
      )}
    </svg>
  );
};

export default PasswordVisibilityIcon;

