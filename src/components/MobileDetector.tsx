import React, { useState, useEffect } from 'react';
import './MobileDetector.css';

interface MobileDetectorProps {
  children: React.ReactNode;
}

const MobileDetector: React.FC<MobileDetectorProps> = ({ children }) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      // Mobile is typically < 768px
      // Tablet is 768px - 1024px (or 1280px)
      // Desktop is > 1024px (or 1280px)
      const width = window.innerWidth;
      setIsMobile(width < 768);
    };

    // Check on mount
    checkScreenSize();

    // Listen for resize events
    window.addEventListener('resize', checkScreenSize);

    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);

  if (isMobile) {
    return (
      <div className="mobile-message-container">
        <div className="mobile-message-content">
          <div className="mobile-icon">📱</div>
          <h2>Mobile Version Required</h2>
          <p>You need to download the mobile version to access this application on mobile devices.</p>
          <div className="mobile-buttons">
            <a 
              href="https://play.google.com/store" 
              target="_blank" 
              rel="noopener noreferrer"
              className="mobile-download-btn android"
            >
              Download for Android
            </a>
            <a 
              href="https://apps.apple.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="mobile-download-btn ios"
            >
              Download for iOS
            </a>
          </div>
          <p className="mobile-note">
            This web application is optimized for tablet and desktop screens. Please use the mobile app for the best experience on mobile devices.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default MobileDetector;





