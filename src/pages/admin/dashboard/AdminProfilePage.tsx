import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AlumniTopBar from '../../alumni/AlumniTopBar';

const user = JSON.parse(localStorage.getItem('user') || '{}');
const userId = user.user_id;

const AdminProfilePage: React.FC = () => {
  const [showProfile, setShowProfile] = useState(false);
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

  const [profileBio, setProfileBio] = useState('');
  const [isBioModalOpen, setIsBioModalOpen] = useState(false);
  const [bioInput, setBioInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch bio from backend on mount
  useEffect(() => {
    fetch(`/api/admin/${userId}/profile_bio/`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.profile_bio) {
          setProfileBio(data.profile_bio);
        } else {
          setProfileBio('');
        }
      });
  }, []);

  // Save bio to backend
  const handleSaveBio = async () => {
    setLoading(true);
    await fetch(`/api/admin/${userId}/profile_bio/`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_bio: bioInput }),
    });
    setProfileBio(bioInput);
    setIsBioModalOpen(false);
    setLoading(false);
  };

  return (
    <div style={{ background: '#f5f7fa', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <AlumniTopBar
        showProfile={showProfile}
        setShowProfile={setShowProfile}
        handleLogout={handleLogout}
        isAdmin={true}
        onTrackerClick={() => navigate('/tracker')}
      />
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', gap: 24, padding: '24px' }}>
        {/* Left Sidebar */}
        <div style={{ flex: 1, maxWidth: 280 }}>
          {/* Introduction */}
          <div
            style={{
              background: 'white',
              borderRadius: 12,
              padding: 20,
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              border: '1px solid #e0e0e0',
              marginBottom: 16,
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: 16, fontSize: 16 }}>Introduction</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => setIsBioModalOpen(true)}
                style={{
                  background: 'white',
                  border: '1px solid #e0e0e0',
                  borderRadius: 8,
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Add Bio
              </button>

              <button
                style={{
                  background: 'white',
                  border: '1px solid #e0e0e0',
                  borderRadius: 8,
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Add Resume
              </button>
            </div>
          </div>

          {/* Followers */}
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
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: 16 }}>Followers</div>
              <div style={{ color: '#174f84', fontSize: 12, cursor: 'pointer' }}>See all</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* First Row */}
              <div style={{ display: 'flex', gap: 8 }}>
                {[1, 2, 3].map((f) => (
                  <div key={f} style={{ textAlign: 'center', flex: 1 }}>
                    <img
                      src={`https://randomuser.me/api/portraits/men/${f * 5}.jpg`}
                      alt="Follower"
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        marginBottom: 4,
                      }}
                    />
                    <div style={{ fontSize: 12, color: '#666' }}>lorem</div>
                  </div>
                ))}
              </div>
              {/* Second Row */}
              <div style={{ display: 'flex', gap: 8 }}>
                {[4, 5, 6].map((f) => (
                  <div key={f} style={{ textAlign: 'center', flex: 1 }}>
                    <img
                      src={`https://randomuser.me/api/portraits/women/${f * 4}.jpg`}
                      alt="Follower"
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        marginBottom: 4,
                      }}
                    />
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
          <div
            style={{
              background: '#ff6b35',
              height: 160,
              width: '100%',
              borderRadius: 12,
              position: 'relative',
              marginBottom: 60,
            }}
          >
            {/* Edit Profile Button */}
            <div
              style={{
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
                borderRadius: 6,
              }}
            >
              <span>Edit Profile</span>
              <span>✏️</span>
            </div>
          </div>

          {/* Profile Info Section */}
          <div
            style={{
              position: 'relative',
              marginTop: -80,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                background: 'white',
                borderRadius: 12,
                padding: '60px 20px 20px 20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                border: '1px solid #e0e0e0',
                textAlign: 'center',
              }}
            >
              <img
                src={admin.profile_pic}
                alt="Profile"
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  border: '3px solid white',
                  marginBottom: 12,
                  marginTop: -60,
                }}
              />
              <div
                style={{
                  fontWeight: 'bold',
                  fontSize: 18,
                  color: '#333',
                  marginBottom: 4,
                  textTransform: 'uppercase',
                }}
              >
                {admin.name}
              </div>
              <div style={{ fontSize: 14, color: '#666' }}>{admin.university}</div>
            </div>
          </div>

          {/* Start a Post */}
          <div
            style={{
              background: 'white',
              borderRadius: 12,
              padding: 20,
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              border: '1px solid #e0e0e0',
              marginBottom: 16,
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

          {/* Social Media Post */}
          <div
            style={{
              background: 'white',
              borderRadius: 12,
              padding: 20,
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              border: '1px solid #e0e0e0',
            }}
          >
            {/* Post Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <img
                src={admin.profile_pic}
                alt="Profile"
                style={{ width: 40, height: 40, borderRadius: '50%' }}
              />
              <div>
                <div
                  style={{
                    fontWeight: 'bold',
                    fontSize: 14,
                    color: '#333',
                    textTransform: 'uppercase',
                  }}
                >
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

            {/* Post Content */}
            <div style={{ fontSize: 14, color: '#333', marginBottom: 16, lineHeight: 1.5 }}>
              Lorem ipsum dolor sit amet. Quo asperiores enim ut veniam repudiandae eum quisquam
              voluptatem non dolore veritatis eos quia suscipit sed facere alias nam voluptate quia.
              Ut neque ipsam sed explicabo nemo ut sapiente consectetur qui omnis ducimus qui
              voluptatem iusto? Id enim quia quo quam consequatur sit nulla delectus aut accusamus
              velit est animi sint eos consequatur nemo sit facilis ipsam. Est dolores tenetur in
              dignissimos velit At rerum minus qui velit autern qui officia sint!
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
      {isBioModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'white',
              padding: 24,
              borderRadius: 12,
              width: 400,
              maxWidth: '90%',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              position: 'relative',
            }}
          >
            <h3 style={{ marginBottom: 12 }}>{profileBio ? 'Edit Bio' : 'Add Bio'}</h3>
            <textarea
              value={bioInput}
              onChange={(e) => setBioInput(e.target.value)}
              rows={4}
              style={{
                width: '100%',
                padding: 12,
                fontSize: 14,
                borderRadius: 8,
                border: '1px solid #ccc',
                marginBottom: 16,
              }}
              placeholder="Enter your bio..."
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                onClick={() => setIsBioModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  background: '#ccc',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBio}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  background: '#174f84',
                  color: 'white',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProfilePage;
