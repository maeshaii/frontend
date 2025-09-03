import React from 'react';
import Sidebar from '../global/sidebar';

const Dashboard = () => {
 const layoutStyle: React.CSSProperties = {
  display: 'flex',
  minHeight: '100vh',
};

  const contentStyle: React.CSSProperties = {
    flex: 1,
    padding: '20px',
    backgroundColor: '#f5f6fa',
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    flex: 1,
    minWidth: '200px',
    margin: '10px',
    textAlign: 'center',
  };

  const cardsContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    marginTop: '20px',
  };

  return (
    <div style={layoutStyle}>
      <Sidebar />
      <div style={contentStyle}>
        <h2>Welcome to Your Dashboard</h2>
        <p>Here is a quick summary of your data:</p>

        <div style={cardsContainerStyle}>
          <div style={cardStyle}>
            <h3>Users</h3>
            <p>120</p>
          </div>
          <div style={cardStyle}>
            <h3>Active Sessions</h3>
            <p>15</p>
          </div>
          <div style={cardStyle}>
            <h3>Trackers Online</h3>
            <p>9</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
