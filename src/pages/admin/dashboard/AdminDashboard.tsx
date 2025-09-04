import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AlumniTopBar from '../../alumni/AlumniTopBar';

interface SuggestedUser {
  id: number;
  name: string;
  profile_pic: string;
}

const AdminDashboard: React.FC = () => {
  const [showProfile, setShowProfile] = useState(false);
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const navigate = useNavigate();

  const admin = {
    name: 'CCICT',
    university: 'Cebu Technological University',
    profile_pic: 'https://randomuser.me/api/portraits/men/32.jpg',
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  useEffect(() => {
    setSuggestedUsers([
      {
        id: 1,
        name: 'lorem ipsum dolor',
        profile_pic: 'https://randomuser.me/api/portraits/women/1.jpg',
      },
      {
        id: 2,
        name: 'lorem ipsum dolor',
        profile_pic: 'https://randomuser.me/api/portraits/men/2.jpg',
      },
      {
        id: 3,
        name: 'lorem ipsum dolor',
        profile_pic: 'https://randomuser.me/api/portraits/women/3.jpg',
      },
      {
        id: 4,
        name: 'lorem ipsum dolor',
        profile_pic: 'https://randomuser.me/api/portraits/men/4.jpg',
      },
      {
        id: 5,
        name: 'lorem ipsum dolor',
        profile_pic: 'https://randomuser.me/api/portraits/women/5.jpg',
      },
      {
        id: 6,
        name: 'lorem ipsum dolor',
        profile_pic: 'https://randomuser.me/api/portraits/men/6.jpg',
      },
      {
        id: 7,
        name: 'lorem ipsum dolor',
        profile_pic: 'https://randomuser.me/api/portraits/women/7.jpg',
      },
    ]);
  }, []);

  return (
    <div style={{ background: '#f5f7fa', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <AlumniTopBar
        showProfile={showProfile}
        setShowProfile={setShowProfile}
        handleLogout={handleLogout}
        isAdmin={true}
        onTrackerClick={() => navigate('/tracker')}
      />

      <div
        style={{ maxWidth: 1200, margin: '24px auto', display: 'flex', gap: 24, padding: '0 24px' }}
      >
        {/* Left Sidebar */}
        <div style={{ flex: 1, maxWidth: 280, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Profile Card */}
          <div
            style={{
              background: 'white',
              borderRadius: 12,
              color: '#333',
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              border: '1px solid #e0e0e0',
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'transform 0.2s ease-in-out',
            }}
            onClick={() => navigate('/ccict/profile')}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') navigate('/ccict/profile');
            }}
          >
            <div style={{ background: '#ff6b35', height: 40, width: '100%' }}></div>
            <div style={{ padding: 20 }}>
              <img
                src={admin.profile_pic}
                alt="Profile"
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  marginBottom: 12,
                  border: '3px solid white',
                  marginTop: -40,
                }}
              />
              <div
                style={{
                  fontWeight: 'bold',
                  fontSize: 16,
                  marginBottom: 4,
                  color: '#333',
                  textTransform: 'uppercase',
                }}
              >
                {admin.name}
              </div>
              <div style={{ fontSize: 14, color: '#666' }}>{admin.university}</div>
            </div>
          </div>
        </div>

        {/* Center Content */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Start a Post */}
          <div
            style={{
              background: 'white',
              borderRadius: 12,
              padding: 20,
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              border: '1px solid #e0e0e0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img
                src={admin.profile_pic}
                alt="Profile"
                style={{ width: 40, height: 40, borderRadius: '50%' }}
              />
              <input
                type="text"
                placeholder="Start a post"
                style={{
                  flex: 1,
                  borderRadius: 20,
                  border: '1px solid #e0e0e0',
                  padding: '10px 16px',
                  fontSize: 14,
                }}
              />
            </div>
          </div>

          {/* Posts Feed (mock) */}
          <div
            style={{
              background: 'white',
              borderRadius: 12,
              padding: 20,
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              border: '1px solid #e0e0e0',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img
                  src={admin.profile_pic}
                  alt="Profile"
                  style={{ width: 40, height: 40, borderRadius: '50%' }}
                />
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: 14, textTransform: 'uppercase' }}>
                    {admin.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#666',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span>3,000,000 Followers</span>
                    <span>•</span>
                    <span>2 d</span>
                    <span>🌐</span>
                  </div>
                </div>
              </div>
              <button
                style={{
                  background: '#174f84',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                + Follow
              </button>
            </div>
            <div style={{ fontSize: 14, color: '#333', marginBottom: 16, lineHeight: 1.5 }}>
              Lorem ipsum dolor sit amet. Quo asperiores enim ut veniam repudiandae eum quisquam
              voluptatem non dolore veritatis eos quia suscipit sed facere alias nam voluptate quia.
            </div>
            <div style={{ display: 'flex', gap: 24, fontSize: 13, color: '#666' }}>
              <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                ❤️ Like
              </span>
              <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                💬 Comment
              </span>
              <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                🔄 Repost
              </span>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div style={{ flex: 1, maxWidth: 280 }}>
          <div
            style={{
              background: 'white',
              borderRadius: 12,
              padding: 20,
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              border: '1px solid #e0e0e0',
            }}
          >
            <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 16 }}>
              People you may know
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {suggestedUsers.map((user) => (
                <div key={user.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img
                    src={user.profile_pic}
                    alt={user.name}
                    style={{ width: 40, height: 40, borderRadius: '50%' }}
                  />
                  <div style={{ flex: 1, fontSize: 14, color: '#666' }}>{user.name}</div>
                  <button
                    style={{
                      background: '#174f84',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 12px',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Follow
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
