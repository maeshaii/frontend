import React, { useState } from 'react';
import Sidebar from '../global/sidebar';

interface Reward {
  id: number;
  recipient: string;
  type: string;
  status: string;
  date: string;
  initials: string;
  details?: string;
}

const RewardsPage: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRewardRecipient, setNewRewardRecipient] = useState('');
  const [newRewardType, setNewRewardType] = useState('');
  const [newRewardDetails, setNewRewardDetails] = useState('');

  const handleCreateNewReward = () => {
    // For now, just log the new reward and close the modal
    console.log({
      recipient: newRewardRecipient,
      type: newRewardType,
      details: newRewardDetails,
    });
    setShowCreateModal(false);
    setNewRewardRecipient('');
    setNewRewardType('');
    setNewRewardDetails('');
    // In a real application, you would send this data to a backend API
  };

  // Sample data - in a real app, this would come from an API
  const rewardProgress = { current: 1, total: 10 };
  
  const rewardHistory = [
    { id: 1, recipient: 'George Litz', type: 'Gift Card', date: '2025-10-26 14:30', initials: 'GL' },
    { id: 2, recipient: 'George Litz', type: 'Free Lunch', date: '2025-10-26 14:30', initials: 'GL' }
  ];

  const rewardList = [
    { id: 1, recipient: 'John Doe', type: 'Gift Card', status: 'Email Use Available', initials: 'GC' },
    { id: 2, recipient: 'Bob Smith', type: 'Bonus Points', status: 'Free Lunch', initials: 'BP' },
    { id: 3, recipient: 'Alice Johnson', type: 'Free Lunch', status: 'Email Pending', initials: 'FL' },
    { id: 4, recipient: 'Mike Wilson', type: 'Certificate', status: 'Unanitza Logistics', initials: 'JJ' },
    { id: 5, recipient: 'Sarah Brown', type: 'Gift Card', status: 'Email Mfmt Cordova', initials: 'MA' },
    { id: 6, recipient: 'Tom Davis', type: 'Bonus Points', status: 'Email Small', initials: 'KB' },
    { id: 7, recipient: 'George Litz', type: 'Gift Card', status: 'Email Use Available', initials: 'GL' }
  ];

  const styles = {
    container: {
      display: 'flex',
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif'
    },
    mainContent: {
      flex: 1,
      padding: '24px 32px',
      backgroundColor: '#f5f6fa',
      marginLeft: 240
    },
    header: {
      backgroundColor: '#6b7280',
      color: 'white',
      padding: '16px 24px',
      margin: '-24px -32px 24px -32px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    headerTitle: {
      fontSize: '24px',
      fontWeight: 'bold',
      margin: 0
    },
    createButton: {
      backgroundColor: '#3b82f6',
      color: 'white',
      border: 'none',
      padding: '12px 24px',
      borderRadius: '6px',
      fontSize: '16px',
      fontWeight: '500',
      cursor: 'pointer'
    },
    contentGrid: {
      display: 'grid',
      gridTemplateColumns: '300px 1fr',
      gap: '24px',
      height: 'calc(100vh - 120px)'
    },
    leftPanel: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '16px'
    },
    progressCard: {
      backgroundColor: '#1e40af',
      color: 'white',
      padding: '32px 24px',
      borderRadius: '12px',
      textAlign: 'center' as const
    },
    progressNumber: {
      fontSize: '48px',
      fontWeight: 'bold',
      margin: '0 0 8px 0'
    },
    progressText: {
      fontSize: '16px',
      margin: 0
    },
    historyCard: {
      backgroundColor: 'white',
      padding: '24px',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    },
    historyTitle: {
      fontSize: '18px',
      fontWeight: '600',
      color: '#374151',
      margin: '0 0 16px 0'
    },
    historyItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 0',
      borderBottom: '1px solid #f3f4f6'
    },
    avatar: {
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      backgroundColor: '#9ca3af',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '14px',
      fontWeight: '600'
    },
    historyDetails: {
      flex: 1
    },
    historyName: {
      fontSize: '14px',
      fontWeight: '500',
      color: '#374151',
      margin: '0 0 4px 0'
    },
    historyType: {
      fontSize: '12px',
      color: '#6b7280',
      margin: 0
    },
    historyDate: {
      fontSize: '12px',
      color: '#9ca3af',
      margin: 0
    },
    rightPanel: {
      backgroundColor: 'white',
      padding: '24px',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      overflow: 'hidden'
    },
    rightPanelTitle: {
      fontSize: '20px',
      fontWeight: '600',
      color: '#374151',
      margin: '0 0 8px 0'
    },
    rightPanelSubtitle: {
      fontSize: '14px',
      color: '#6b7280',
      margin: '0 0 24px 0'
    },
    rewardList: {
      maxHeight: 'calc(100vh - 200px)',
      overflowY: 'auto' as const
    },
    rewardItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '16px 0',
      borderBottom: '1px solid #f3f4f6'
    },
    rewardType: {
      fontSize: '14px',
      fontWeight: '500',
      color: '#374151',
      margin: '0 0 4px 0'
    },
    rewardStatus: {
      fontSize: '12px',
      color: '#6b7280',
      margin: 0
    }
  };

  return (
    <div style={styles.container}>
      <Sidebar />
      <div style={styles.mainContent}>
        <div style={styles.header}>
          <h1 style={styles.headerTitle}>REWARD DASHBOARD</h1>
          <button 
            style={styles.createButton}
            onClick={() => setShowCreateModal(true)}
          >
            CREATE NEW REWARD
          </button>
        </div>

        <div style={styles.contentGrid}>
          {/* Left Panel */}
          <div style={styles.leftPanel}>
            {/* Reward Progress */}
            <div style={styles.progressCard}>
              <div style={styles.progressNumber}>{rewardProgress.current}</div>
              <div style={styles.progressText}>/10 Available</div>
            </div>

            {/* Reward History */}
            <div style={styles.historyCard}>
              <h3 style={styles.historyTitle}>REWARD HISTORY</h3>
              <div>Amail denisenmaches.</div>
              {rewardHistory.map((reward) => (
                <div key={reward.id} style={styles.historyItem}>
                  <div style={styles.avatar}>{reward.initials}</div>
                  <div style={styles.historyDetails}>
                    <div style={styles.historyName}>{reward.recipient}</div>
                    <div style={styles.historyType}>{reward.type}</div>
                  </div>
                  <div style={styles.historyDate}>{reward.date}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Panel */}
          <div style={styles.rightPanel}>
            <h2 style={styles.rightPanelTitle}>REWARD LIST</h2>
            <p style={styles.rightPanelSubtitle}>RECIPIENT</p>
            
            <div style={styles.rewardList}>
              {rewardList.map((reward) => (
                <div key={reward.id} style={styles.rewardItem}>
                  <div style={styles.avatar}>{reward.initials}</div>
                  <div style={styles.historyDetails}>
                    <div style={styles.rewardType}>{reward.type}</div>
                    <div style={styles.rewardStatus}>{reward.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Create New Reward Modal */}
        {showCreateModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '32px',
              borderRadius: '16px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              width: '500px',
              maxWidth: '90%',
              maxHeight: '90vh',
              overflow: 'auto'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <h2 style={{ 
                  margin: '0 0 8px 0', 
                  color: '#1e40af', 
                  fontSize: '24px',
                  fontWeight: '600'
                }}>
                  Create New Reward
                </h2>
                <p style={{ 
                  margin: 0, 
                  color: '#6b7280', 
                  fontSize: '14px'
                }}>
                  Fill in the details to create a new reward for a recipient
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Recipient Field */}
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '600', 
                    color: '#374151',
                    fontSize: '14px'
                  }}>
                    Recipient *
                  </label>
                  <input
                    type="text"
                    value={newRewardRecipient}
                    onChange={(e) => setNewRewardRecipient(e.target.value)}
                    placeholder="Enter recipient name or email"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      boxSizing: 'border-box',
                      fontSize: '14px',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  />
                </div>

                {/* Reward Type Field */}
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '600', 
                    color: '#374151',
                    fontSize: '14px'
                  }}>
                    Reward Type *
                  </label>
                  <select
                    value={newRewardType}
                    onChange={(e) => setNewRewardType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      boxSizing: 'border-box',
                      fontSize: '14px',
                      backgroundColor: 'white',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  >
                    <option value="">Select a reward type</option>
                    <option value="Gift Card">🎁 Gift Card</option>
                    <option value="Bonus Points">⭐ Bonus Points</option>
                    <option value="Free Lunch">🍽️ Free Lunch</option>
                    <option value="Certificate">🏆 Certificate</option>
                    <option value="Voucher">🎫 Voucher</option>
                    <option value="Recognition">👏 Recognition</option>
                  </select>
                </div>

                {/* Amount/Value Field */}
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '600', 
                    color: '#374151',
                    fontSize: '14px'
                  }}>
                    Value/Amount
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., $50, 100 points, etc."
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      boxSizing: 'border-box',
                      fontSize: '14px',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  />
                </div>

                {/* Details Field */}
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '600', 
                    color: '#374151',
                    fontSize: '14px'
                  }}>
                    Additional Details
                  </label>
                  <textarea
                    value={newRewardDetails}
                    onChange={(e) => setNewRewardDetails(e.target.value)}
                    placeholder="Add any specific details, message, or instructions..."
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      boxSizing: 'border-box',
                      resize: 'vertical',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  />
                </div>

                {/* Expiry Date Field */}
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '600', 
                    color: '#374151',
                    fontSize: '14px'
                  }}>
                    Expiry Date (Optional)
                  </label>
                  <input
                    type="date"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      boxSizing: 'border-box',
                      fontSize: '14px',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-end', 
                gap: '12px', 
                marginTop: '32px',
                paddingTop: '20px',
                borderTop: '1px solid #e5e7eb'
              }}>
                <button
                  style={{
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseOver={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#4b5563'}
                  onMouseOut={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#6b7280'}
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  style={{
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseOver={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#059669'}
                  onMouseOut={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#10b981'}
                  onClick={handleCreateNewReward}
                  disabled={!newRewardRecipient || !newRewardType}
                >
                  Create Reward
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RewardsPage;


