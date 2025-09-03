import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchNotifications } from '../../services/api';
import AlumniTopBar from './AlumniTopBar';

interface AlumniUser {
  name: string;
  course?: string;
  year_graduated?: string | number;
  profile_pic?: string;
  location?: string;
  university?: string;
}

interface Post {
  id: number;
  author: {
    name: string;
    profile_pic: string;
  };
  content: string;
  timestamp: string;
  likes: number;
  comments: number;
  reposts: number;
}

interface SuggestedUser {
  id: number;
  name: string;
  profile_pic: string;
}

const AlumniDashboard: React.FC = () => {
  const [user, setUser] = useState<AlumniUser | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  useEffect(() => {
    // Fetch user info from localStorage
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const userObj = JSON.parse(userStr);
      setUser(userObj);
    } else {
      // Not logged in, redirect to login
      navigate('/login');
    }

    // Mock data for posts
    setPosts([
      {
        id: 1,
        author: {
          name: "Lorem ipsum dolor",
          profile_pic: "https://randomuser.me/api/portraits/men/32.jpg"
        },
        content: "Lorem ipsum dolor sit amet. Quo asperiores enim ut veniam repudiandae eum quisquam voluptatem non dolore veritatis eos quia suscipit sed facere alias nam voluptate quia. Ut neque ipsam sed explicabo nemo ut sapiente consectetur qui omnis ducimus qui voluptatem iusto? Id enim quia quo quam consequatur sit nulla delectus aut accusamus velit est animi sint eos consequatur nemo sit facilis ipsam. Est dolores tenetur in dignissimos velit At rerum minus qui velit autern qui officia sint!",
        timestamp: "2 d",
        likes: 24,
        comments: 8,
        reposts: 3
      },
      {
        id: 2,
        author: {
          name: "Lorem ipsum dolor",
          profile_pic: "https://randomuser.me/api/portraits/men/45.jpg"
        },
        content: "Lorem ipsum dolor sit amet. Quo asperiores enim ut veniam repudiandae eum quisquam voluptatem non dolore veritatis eos quia suscipit sed facere alias nam voluptate quia. Ut neque ipsam sed explicabo nemo ut sapiente consectetur qui omnis ducimus qui voluptatem iusto? Id enim quia quo quam consequatur sit nulla delectus aut accusamus velit est animi sint eos consequatur nemo sit facilis ipsam. Est dolores tenetur in dignissimos velit At rerum minus qui velit autern qui officia sint!",
        timestamp: "1 d",
        likes: 18,
        comments: 5,
        reposts: 2
      }
    ]);

    // Mock data for suggested users
    setSuggestedUsers([
      { id: 1, name: "lorem ipsum dolor", profile_pic: "https://randomuser.me/api/portraits/women/1.jpg" },
      { id: 2, name: "lorem ipsum dolor", profile_pic: "https://randomuser.me/api/portraits/men/2.jpg" },
      { id: 3, name: "lorem ipsum dolor", profile_pic: "https://randomuser.me/api/portraits/women/3.jpg" },
      { id: 4, name: "lorem ipsum dolor", profile_pic: "https://randomuser.me/api/portraits/men/4.jpg" },
      { id: 5, name: "lorem ipsum dolor", profile_pic: "https://randomuser.me/api/portraits/women/5.jpg" },
      { id: 6, name: "lorem ipsum dolor", profile_pic: "https://randomuser.me/api/portraits/men/6.jpg" },
      { id: 7, name: "lorem ipsum dolor", profile_pic: "https://randomuser.me/api/portraits/women/7.jpg" }
    ]);
  }, [navigate]);

  return (
    <div style={{ background: '#f5f7fa', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <AlumniTopBar 
        showProfile={showProfile} 
        setShowProfile={setShowProfile} 
        handleLogout={handleLogout} 
      />

      {/* Main Content */}
      <div style={{ maxWidth: 1200, margin: '24px auto', display: 'flex', gap: 24, padding: '0 24px' }}>
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
              transition: 'transform 0.2s ease-in-out'
            }}
            onClick={() => navigate('/alumni/profile')}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {/* Orange Header Bar */}
            <div style={{ 
              background: '#ff6b35', 
              height: 40, 
              width: '100%'
            }}></div>
            
            {/* Profile Content */}
            <div style={{ padding: '20px 20px 20px 20px' }}>
              <img 
                src={user?.profile_pic || 'https://randomuser.me/api/portraits/women/44.jpg'} 
                alt="Profile" 
                style={{ 
                  width: 80, 
                  height: 80, 
                  borderRadius: '50%', 
                  marginBottom: 12,
                  border: '3px solid white',
                  marginTop: -40
                }} 
              />
              <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 4, color: '#333' }}>
                {user?.name || 'Angel Khyla Marie I. Aboloc'}
              </div>
              <div style={{ fontSize: 14, color: '#666' }}>
                {user?.university || 'Cebu Technological University'}
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ 
              flex: 1, 
              background: 'white', 
              borderRadius: 12, 
              textAlign: 'center',
              color: '#333',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              border: '1px solid #e0e0e0',
              overflow: 'hidden'
            }}>
              {/* Orange Header Bar */}
              <div style={{ 
                background: '#ff6b35', 
                height: 30, 
                width: '100%'
              }}></div>
              
              {/* Content */}
              <div style={{ padding: '12px 8px' }}>
                <div style={{ 
                  width: 40, 
                  height: 40, 
                  background: '#2d5016', 
                  borderRadius: '50%', 
                  margin: '0 auto 8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 'bold',
                  color: '#90EE90'
                }}>
                  C
                </div>
                <div style={{ fontSize: 12, fontWeight: 'bold', color: '#333', textTransform: 'uppercase' }}>CCICT</div>
              </div>
          </div>
            <div style={{ 
              flex: 1, 
              background: 'white', 
              borderRadius: 12, 
              textAlign: 'center',
              color: '#333',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              border: '1px solid #e0e0e0',
              overflow: 'hidden'
            }}>
              {/* Orange Header Bar */}
              <div style={{ 
                background: '#ff6b35', 
                height: 30, 
                width: '100%'
              }}></div>
              
              {/* Content */}
              <div style={{ padding: '12px 8px' }}>
                <div style={{ 
                  width: 40, 
                  height: 40, 
                  background: '#FFD700', 
                  borderRadius: '50%', 
                  margin: '0 auto 8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 'bold',
                  color: '#000080'
                }}>
                  ✱
                </div>
                <div style={{ fontSize: 12, fontWeight: 'bold', color: '#333', textTransform: 'uppercase' }}>PESO</div>
              </div>
            </div>
          </div>

          {/* Forum Link */}
          <div style={{ 
            background: 'white', 
            borderRadius: 12, 
            textAlign: 'center',
            color: '#333',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            border: '1px solid #e0e0e0',
            overflow: 'hidden'
          }}>
            {/* Orange Header Bar */}
            <div style={{ 
              background: '#ff6b35', 
              height: 30, 
              width: '100%'
            }}></div>
            
            {/* Content */}
            <div style={{ padding: '12px 8px' }}>
              <div style={{ 
                width: 40, 
                height: 40, 
                background: '#000080', 
                borderRadius: '50%', 
                margin: '0 auto 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 'bold',
                color: 'white'
              }}>
                W
              </div>
              <div style={{ fontSize: 12, fontWeight: 'bold', color: '#333', textTransform: 'uppercase' }}>FORUM</div>
            </div>
          </div>
        </div>

        {/* Center Content */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Start a Post */}
          <div style={{ 
            background: 'white', 
            borderRadius: 12, 
            padding: 20, 
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            border: '1px solid #e0e0e0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img 
                src={user?.profile_pic || 'https://randomuser.me/api/portraits/women/44.jpg'} 
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

          {/* Posts Feed */}
          {posts.map((post) => (
            <div key={post.id} style={{ 
              background: 'white', 
              borderRadius: 12, 
              padding: 20, 
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              border: '1px solid #e0e0e0'
            }}>
              {/* Post Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img 
                    src={post.author.profile_pic} 
                    alt="Profile" 
                    style={{ width: 40, height: 40, borderRadius: '50%' }} 
                  />
                                <div>
                <div style={{ fontWeight: 'bold', fontSize: 14 }}>{post.author.name}</div>
                <div style={{ fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>3,000,000 Followers</span>
                  <span>•</span>
                  <span>{post.timestamp}</span>
                  <span>🌐</span>
                </div>
              </div>
                </div>
                <button style={{ 
                  background: '#174f84', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: 6, 
                  padding: '6px 12px',
                  fontSize: 12,
                  cursor: 'pointer'
                }}>
                  + Follow
                </button>
              </div>

              {/* Post Content */}
              <div style={{ fontSize: 14, color: '#333', marginBottom: 16, lineHeight: 1.5 }}>
                {post.content}
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
          ))}
        </div>

        {/* Right Sidebar */}
        <div style={{ flex: 1, maxWidth: 280 }}>
          {/* People You May Know */}
          <div style={{ 
            background: 'white', 
            borderRadius: 12, 
            padding: 20, 
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            border: '1px solid #e0e0e0'
          }}>
            <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 16 }}>
              People you may know
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {suggestedUsers.map((suggestedUser) => (
                <div key={suggestedUser.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ 
                    width: 40, 
                    height: 40, 
                    background: '#f0f0f0', 
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    color: '#999'
                  }}>
                    👤
                  </div>
                  <div style={{ flex: 1, fontSize: 14, color: '#666' }}>
                    {suggestedUser.name}
                  </div>
                  <button style={{ 
                    background: '#174f84', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: 6, 
                    padding: '6px 12px',
                    fontSize: 12,
                    cursor: 'pointer'
                  }}>
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

export default AlumniDashboard; 