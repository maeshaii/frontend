import React, { useState } from 'react';
import Sidebar from '../global/sidebar';

type Reward = {
  id: string;
  recipient: string;
  rewardType: string;
  description: string;
  status: 'pending' | 'delivered' | 'claimed';
  avatar?: string;
};

type RewardHistory = {
  id: string;
  recipient: string;
  rewardType: string;
  timestamp: string;
  avatar?: string;
};

const RewardItem: React.FC<{ reward: Reward }> = ({ reward }) => {
  return (
    <div style={{ 
      display: 'flex',
      alignItems: 'center', 
      padding: '12px 0',
      borderBottom: '1px solid #F3F4F6'
    }}>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        backgroundColor: '#E5E7EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        fontSize: 14,
        fontWeight: 600,
        color: '#374151'
      }}>
        {reward.recipient.split(' ').map(n => n[0]).join('').slice(0, 2)}
      </div>
      
      <div>
        <div style={{ fontWeight: 600, color: '#111827', fontSize: 14 }}>
          {reward.rewardType}
        </div>
        <div style={{ fontSize: 12, color: '#6B7280' }}>
          {reward.description}
        </div>
      </div>
    </div>
  );
};

const HistoryItem: React.FC<{ item: RewardHistory }> = ({ item }) => {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      padding: '8px 0'
    }}>
      <div style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        backgroundColor: '#E5E7EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        fontSize: 12,
        fontWeight: 600,
        color: '#374151'
      }}>
        {item.recipient.split(' ').map(n => n[0]).join('').slice(0, 2)}
      </div>
      
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, color: '#111827', fontSize: 14 }}>
          {item.recipient}
        </div>
        <div style={{ fontSize: 12, color: '#6B7280' }}>
          {item.rewardType}
        </div>
      </div>
      
      <div style={{ fontSize: 12, color: '#6B7280' }}>
        {item.timestamp}
      </div>
    </div>
  );
};

const CreateRewardModal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  onSubmit: (reward: Omit<Reward, 'id'>) => void;
}> = ({ isOpen, onClose, onSubmit }) => {
  const [recipient, setRecipient] = useState('');
  const [rewardType, setRewardType] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (recipient && rewardType && description) {
      onSubmit({
        recipient,
        rewardType,
        description,
        status: 'pending'
      });
      setRecipient('');
      setRewardType('');
      setDescription('');
      onClose();
    }
  };

  return (
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
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 24,
        width: '100%',
        maxWidth: 500,
        margin: 20
      }}>
        <h3 style={{ margin: '0 0 20px 0', color: '#111827' }}>Create New Reward</h3>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, color: '#374151' }}>
              Recipient Name
            </label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: 6,
                fontSize: 14
              }}
              placeholder="Enter recipient name"
              required
            />
          </div>
          
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, color: '#374151' }}>
              Reward Type
            </label>
            <select
              value={rewardType}
              onChange={(e) => setRewardType(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: 6,
                fontSize: 14
              }}
              required
            >
              <option value="">Select reward type</option>
              <option value="Gift Card">Gift Card</option>
              <option value="Bonus Points">Bonus Points</option>
              <option value="Free Lunch">Free Lunch</option>
              <option value="Certificate">Certificate</option>
            </select>
          </div>
          
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, color: '#374151' }}>
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: 6,
                fontSize: 14
              }}
              placeholder="Enter reward description"
              required
            />
          </div>
          
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                border: '1px solid #D1D5DB',
                borderRadius: 6,
                backgroundColor: 'white',
                color: '#374151',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: 6,
                backgroundColor: '#3B82F6',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Create Reward
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const RewardsPage: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [rewards, setRewards] = useState<Reward[]>([
    {
      id: '1',
      recipient: 'Gift Card',
      rewardType: 'Gift Card',
      description: 'Email Use Available',
      status: 'pending'
    },
    {
      id: '2',
      recipient: 'Bonus Points',
      rewardType: 'Bonus Points',
      description: 'Free Lunch',
      status: 'delivered'
    },
    {
      id: '3',
      recipient: 'Free Lunch',
      rewardType: 'Free Lunch',
      description: 'Email Pending',
      status: 'pending'
    },
    {
      id: '4',
      recipient: 'Jane Johnson',
      rewardType: 'Free Lunch',
      description: 'Free Lunch',
      status: 'claimed'
    },
    {
      id: '5',
      recipient: 'Mezei Agnes',
      rewardType: 'Certificate',
      description: 'Unanitza Logistics',
      status: 'delivered'
    },
    {
      id: '6',
      recipient: 'Katona Beatrix',
      rewardType: 'Gift Card',
      description: 'Email Mfmt Cordova',
      status: 'pending'
    },
    {
      id: '7',
      recipient: 'George Litz',
      rewardType: 'Bonus Points',
      description: 'Email Small',
      status: 'delivered'
    }
  ]);

  const [rewardHistory] = useState<RewardHistory[]>([
    {
      id: '1',
      recipient: 'George Litz',
      rewardType: 'Gift Card',
      timestamp: '2025-10-26 14:30'
    },
    {
      id: '2',
      recipient: 'George Litz',
      rewardType: 'Free Lunch',
      timestamp: '2025-10-26 14:30'
    }
  ]);

  const handleCreateReward = (newReward: Omit<Reward, 'id'>) => {
    const reward: Reward = {
      ...newReward,
      id: Date.now().toString()
    };
    setRewards([...rewards, reward]);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, padding: '24px 32px', backgroundColor: '#f5f6fa', marginLeft: 240 }}>
        {/* Header */}
        <div style={{
          backgroundColor: '#2D3748',
          borderRadius: 12,
          padding: '20px 24px',
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h1 style={{ 
            margin: 0, 
            color: 'white', 
            fontSize: 24, 
            fontWeight: 600 
          }}>
            REWARD DASHBOARD
          </h1>
          <button
            onClick={() => setShowModal(true)}
            style={{
              backgroundColor: '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            CREATE NEW REWARD
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 }}>
          {/* Left Column - Progress Card */}
          <div>
            <div style={{
              backgroundColor: '#1E40AF',
              borderRadius: 12,
              padding: 24,
              color: 'white',
              marginBottom: 24
            }}>
              <h3 style={{ 
                margin: '0 0 8px 0', 
                fontSize: 16, 
                fontWeight: 500,
                color: 'white'
              }}>
                REWARD PROGRESS
              </h3>
              <div style={{ 
                fontSize: 36, 
                fontWeight: 700, 
                marginBottom: 4 
              }}>
                1
              </div>
              <div style={{ 
                fontSize: 14, 
                opacity: 0.8,
                marginBottom: 12
              }}>
                /10 Available
              </div>
            </div>

            {/* Reward History */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: 12,
              padding: 20
            }}>
              <h3 style={{ 
                margin: '0 0 16px 0', 
                fontSize: 16, 
                fontWeight: 600,
                color: '#111827'
              }}>
                REWARD HISTORY
              </h3>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>
                Amail denisenmaches
              </div>
              
              {rewardHistory.map((item) => (
                <HistoryItem key={item.id} item={item} />
              ))}
            </div>
          </div>

          {/* Right Column - Reward List */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: 12,
            padding: 20
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20
            }}>
              <h3 style={{ 
                margin: 0, 
                fontSize: 16, 
                fontWeight: 600,
                color: '#111827'
              }}>
                REWARD LIST
              </h3>
            </div>

            {/* Table Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              padding: '12px 0',
              borderBottom: '2px solid #F3F4F6',
              fontSize: 12,
              fontWeight: 600,
              color: '#6B7280',
              textTransform: 'uppercase'
            }}>
              <div>Recipient</div>
            </div>

            {/* Reward Items */}
            <div>
              {rewards.map((reward) => (
                <RewardItem key={reward.id} reward={reward} />
              ))}
            </div>
          </div>
        </div>

        <CreateRewardModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSubmit={handleCreateReward}
        />
      </div>
    </div>
  );
};

export default RewardsPage;


