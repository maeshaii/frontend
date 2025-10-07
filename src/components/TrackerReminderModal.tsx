import React from 'react';
import { useNavigate } from 'react-router-dom';
import './TrackerReminderModal.css';

interface TrackerReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
}

const TrackerReminderModal: React.FC<TrackerReminderModalProps> = ({ isOpen, onClose, userId }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleTakeSurvey = () => {
    onClose();
    // Navigate to tracker page (route does not require userId)
    navigate('/alumni/tracker');
  };

  const handleRemindLater = () => {
    onClose();
  };

  return (
    <div className="tracker-modal-overlay">
      <div className="tracker-modal-content">
        <div className="tracker-modal-header">
          <h2>📋 Graduate Tracer Survey</h2>
          <button className="tracker-modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className="tracker-modal-body">
          <div className="tracker-modal-icon">
            🎓
          </div>
          <h3>Complete Your Graduate Tracer Survey</h3>
          <p>
            Help us improve our programs by sharing your post-graduation journey. 
            Your responses will help future students and enhance our curriculum.
          </p>
          <div className="tracker-modal-benefits">
            <div className="benefit-item">
              <span className="benefit-icon">📊</span>
              <span>Contribute to program improvement</span>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">🎯</span>
              <span>Help future students make informed decisions</span>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">⏱️</span>
              <span>Takes only 5-10 minutes to complete</span>
            </div>
          </div>
        </div>
        
        <div className="tracker-modal-footer">
          <button className="tracker-modal-button secondary" onClick={handleRemindLater}>
            Remind Me Later
          </button>
          <button className="tracker-modal-button primary" onClick={handleTakeSurvey}>
            Take Survey Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrackerReminderModal;
