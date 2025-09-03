import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AlumniTopBar from './AlumniTopBar';

interface AlumniUser {
  name: string;
  course?: string;
  year_graduated?: string | number;
  profile_pic?: string;
  location?: string;
  university?: string;
  bio?: string;
  resume?: string;
}

const AlumniProfile: React.FC = () => {
  const [user, setUser] = useState<AlumniUser | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const userObj = JSON.parse(userStr);
      setUser(userObj);
    } else {
      navigate('/login');
    }
  }, [navigate, id]);

  return (
    <div style={{ background: '#f5f7fa', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <AlumniTopBar 
        showProfile={showProfile} 
        setShowProfile={setShowProfile} 
        handleLogout={handleLogout} 
      />

      {/* Main Content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', gap: 24, padding: '24px' }}>
        {/* Left Sidebar */}
        <div style={{ flex: 1, maxWidth: 280 }}>
          {/* Introduction */}
          <div style={{ 
            background: 'white', 
            borderRadius: 12, 
            padding: 20, 
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            border: '1px solid #e0e0e0',
            marginBottom: 16
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: 16, fontSize: 16 }}>Introduction</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button style={{ 
                background: 'white', 
                border: '1px solid #e0e0e0', 
                borderRadius: 8, 
                padding: '8px 16px', 
                cursor: 'pointer',
                fontSize: 14
              }}>
                Add Bio
              </button>
              <button style={{ 
                background: 'white', 
                border: '1px solid #e0e0e0', 
                borderRadius: 8, 
                padding: '8px 16px', 
                cursor: 'pointer',
                fontSize: 14
              }}>
                Add Resume
              </button>
            </div>
          </div>

          {/* Followers */}
          <div style={{ 
            background: 'white', 
            borderRadius: 12, 
            padding: 20, 
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            border: '1px solid #e0e0e0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 'bold', fontSize: 16 }}>Followers</div>
              <div style={{ color: '#174f84', fontSize: 12, cursor: 'pointer' }}>See all</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* First Row */}
              <div style={{ display: 'flex', gap: 8 }}>
                {[1, 2, 3].map((f) => (
                  <div key={f} style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ 
                      width: 40, 
                      height: 40, 
                      background: '#f0f0f0', 
                      borderRadius: '50%', 
                      marginBottom: 4 
                    }}></div>
                    <div style={{ fontSize: 12, color: '#666' }}>lorem</div>
                  </div>
                ))}
              </div>
              {/* Second Row */}
              <div style={{ display: 'flex', gap: 8 }}>
                {[4, 5, 6].map((f) => (
                  <div key={f} style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ 
                      width: 40, 
                      height: 40, 
                      background: '#f0f0f0', 
                      borderRadius: '50%', 
                      marginBottom: 4 
                    }}></div>
                    <div style={{ fontSize: 12, color: '#666' }}>lorem</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Center Content */}
        <div style={{ flex: 2 }}>
          {/* Orange Banner */}
          <div style={{ 
            background: '#ff6b35', 
            height: 160, 
            width: '100%',
            borderRadius: 12,
            position: 'relative',
            marginBottom: 60
          }}>
            {/* Edit Profile Button */}
            <div style={{ 
              position: 'absolute', 
              top: 16, 
              right: 16, 
              display: 'flex', 
              alignItems: 'center', 
              gap: 4,
              fontSize: 12,
              color: 'white',
              cursor: 'pointer',
              background: 'rgba(0,0,0,0.2)',
              padding: '6px 12px',
              borderRadius: 6
            }}>
              <span>Edit Profile</span>
              <span>✏️</span>
            </div>
          </div>

                    {/* Profile Info Section */}
          <div style={{ 
            position: 'relative',
            marginTop: -80,
            marginBottom: 24
          }}>
            <div style={{ 
              background: 'white', 
              borderRadius: 12, 
              padding: '60px 20px 20px 20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              border: '1px solid #e0e0e0',
              textAlign: 'center'
            }}>
              <img 
                src={user?.profile_pic || 'https://randomuser.me/api/portraits/women/68.jpg'} 
                alt="Profile" 
                style={{ 
                  width: 80, 
                  height: 80, 
                  borderRadius: '50%', 
                  border: '3px solid white',
                  marginBottom: 12
                }} 
              />
              <div style={{ fontWeight: 'bold', fontSize: 18, color: '#333', marginBottom: 4, textTransform: 'uppercase' }}>
                {user?.name || 'JEFFREY BATUCAN'}
              </div>
              <div style={{ fontSize: 14, color: '#666' }}>
                {user?.university || 'Cebu Technological University'}
              </div>
            </div>
          </div>

          {/* Start a Post */}
          <div style={{ 
            background: 'white', 
            borderRadius: 12, 
            padding: 20, 
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            border: '1px solid #e0e0e0',
            marginBottom: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img 
                src={user?.profile_pic || 'https://randomuser.me/api/portraits/women/68.jpg'} 
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
                  fontSize: 14
                }} 
              />
            </div>
          </div>

          {/* Social Media Post */}
          <div style={{ 
            background: 'white', 
            borderRadius: 12, 
            padding: 20, 
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            border: '1px solid #e0e0e0'
          }}>
            {/* Post Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <img 
                src={user?.profile_pic || 'https://randomuser.me/api/portraits/women/68.jpg'} 
                alt="Profile" 
                style={{ width: 40, height: 40, borderRadius: '50%' }} 
              />
              <div>
                <div style={{ fontWeight: 'bold', fontSize: 14, color: '#333', textTransform: 'uppercase' }}>
                  {user?.name || 'LYKA BAUTISTA'}
                </div>
                <div style={{ fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>3,000,000 Followers</span>
                  <span>•</span>
                  <span>2 d</span>
                  <span>🌐</span>
                </div>
              </div>
            </div>

            {/* Post Content */}
            <div style={{ fontSize: 14, color: '#333', marginBottom: 16, lineHeight: 1.5 }}>
              Lorem ipsum dolor sit amet. Quo asperiores enim ut veniam repudiandae eum quisquam voluptatem non dolore veritatis eos quia suscipit sed facere alias nam voluptate quia. Ut neque ipsam sed explicabo nemo ut sapiente consectetur qui omnis ducimus qui voluptatem iusto? Id enim quia quo quam consequatur sit nulla delectus aut accusamus velit est animi sint eos consequatur nemo sit facilis ipsam. Est dolores tenetur in dignissimos velit At rerum minus qui velit autern qui officia sint!
            </div>

            {/* Post Actions */}
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

        
      </div>
    </div>
  );
};

export default AlumniProfile; 