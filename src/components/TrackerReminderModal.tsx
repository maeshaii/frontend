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
            📋
          </div>
          <h3>Complete Your Graduate Tracer Survey</h3>
          <p>
            Help us track your career success and improve our programs for future students. Your input shapes the future of education.
          </p>
          <div className="tracker-modal-benefits">
            <div className="benefit-item">
              <span className="benefit-icon">💼</span>
              <span>Share your career journey and current employment status</span>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">🏅</span>
              <span>Highlight your achievements and professional milestones</span>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">⏰</span>
              <span>Quick 5-minute survey - your time makes a difference</span>
            </div>
            <div className="benefit-item special-incentive">
              <span className="benefit-icon">🎁</span>
              <span>Maybe you're one of the lucky ones who will receive an award for completing the survey!</span>
            </div>
          </div>
        </div>
        
        <div className="tracker-modal-footer">
          <button className="tracker-modal-button secondary" onClick={handleRemindLater}>
            Maybe Later
          </button>
          <button className="tracker-modal-button primary" onClick={handleTakeSurvey}>
            Start Survey
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrackerReminderModal;
