import React from 'react';
import Sidebar from '../global/sidebar';

const RewardsPage: React.FC = () => {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, padding: '24px 32px', backgroundColor: '#f5f6fa', marginLeft: 240 }}>
        <h2 style={{ margin: 0, color: '#0b2a55' }}>Rewards</h2>
        <div style={{ marginTop: 16, background: 'white', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
          <div>This is a placeholder Rewards page. Add your rewards logic here.</div>
        </div>
      </div>
    </div>
  );
};

export default RewardsPage;


