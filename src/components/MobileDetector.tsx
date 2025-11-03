import React, { useState, useEffect } from 'react';
import './MobileDetector.css';

interface MobileDetectorProps {
  children: React.ReactNode;
}

const MobileDetector: React.FC<MobileDetectorProps> = ({ children }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [shouldShowMobileMessage, setShouldShowMobileMessage] = useState(false);

  useEffect(() => {
    // Check user type from localStorage
    const checkUserType = () => {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const userObj = JSON.parse(userStr);
          if (userObj.account_type) {
            // Only show mobile message for alumni and ojt users
            const isAlumni = userObj.account_type.user;
            const isOjt = userObj.account_type.ojt;
            const shouldShow = isAlumni || isOjt;
            setShouldShowMobileMessage(shouldShow);
            return;
          }
        } catch (e) {
          console.error('Error parsing user data:', e);
        }
      }
      // If no user data, assume mobile message should not show (web-only users like admin, peso, coordinator)
      setShouldShowMobileMessage(false);
    };

    const checkScreenSize = () => {
      // Mobile is typically < 768px
      // Tablet is 768px - 1024px (or 1280px)
      // Desktop is > 1024px (or 1280px)
      const width = window.innerWidth;
      setIsMobile(width < 768);
    };

    // Check on mount
    checkScreenSize();
    checkUserType();

    // Listen for resize events
    window.addEventListener('resize', checkScreenSize);

    // Poll localStorage periodically to handle login/logout
    // This is necessary because storage event doesn't fire for changes in the same window
    // Poll every 1 second - light enough to catch login/logout quickly, but not too heavy
    const pollInterval = setInterval(checkUserType, 1000);

    return () => {
      window.removeEventListener('resize', checkScreenSize);
      clearInterval(pollInterval);
    };
  }, []);

  // Only show mobile message for alumni and ojt users on mobile devices
  if (isMobile && shouldShowMobileMessage) {
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







