import React from 'react';
import ctulogo from '../images/ctulogo.png';

interface RepostUser {
  user_id?: number;
  f_name?: string;
  m_name?: string;
  l_name?: string;
  profile_pic?: string;
}

interface RepostEntry {
  repost_id: number;
  user?: RepostUser;
  created_at?: string;
}

interface RepostsModalProps {
  isOpen: boolean;
  onClose: () => void;
  reposts: RepostEntry[];
  title?: string;
  isLoading?: boolean;
}

const buildFullName = (user?: RepostUser) => {
  if (!user) return 'Unknown User';
  return `${user.f_name || ''} ${user.m_name || ''} ${user.l_name || ''}`.trim() || 'Unknown User';
};

const resolveProfilePic = (user?: RepostUser) => {
  if (!user?.profile_pic) return ctulogo;
  return String(user.profile_pic).startsWith('http')
    ? user.profile_pic
    : `http://127.0.0.1:8000${user.profile_pic}`;
};

const RepostsModal: React.FC<RepostsModalProps> = ({
  isOpen,
  onClose,
  reposts,
  title = 'People who reposted this',
  isLoading = false,
}) => {
  // Deduplicate reposts by user_id - keep only the most recent repost per user
  const uniqueReposts = React.useMemo(() => {
    const userMap = new Map<number, RepostEntry>();
    reposts.forEach((entry) => {
      const userId = entry.user?.user_id;
      if (userId) {
        const existing = userMap.get(userId);
        if (!existing || (entry.created_at && existing.created_at && entry.created_at > existing.created_at)) {
          userMap.set(userId, entry);
        }
      }
    });
    return Array.from(userMap.values());
  }, [reposts]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          maxWidth: '400px',
          width: '100%',
          maxHeight: '80vh',
          overflowY: 'auto',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          padding: '20px 20px 0 20px',
          borderBottom: '1px solid #e9ecef',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 24,
              cursor: 'pointer',
              color: '#666',
              padding: 0,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f8f9fa';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="Close"
          >
            ×
          </button>
        </div>

        <div style={{ padding: '0 20px 20px 20px' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6c757d' }}>
              Loading reposters...
            </div>
          ) : uniqueReposts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6c757d' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔁</div>
              <div style={{ fontSize: '16px', fontWeight: '500' }}>No reposts yet</div>
              <div style={{ fontSize: '14px', marginTop: '4px' }}>Be the first to repost this.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {uniqueReposts.map((entry) => {
                const user = entry.user;
                const fullName = buildFullName(user);

                return (
                  <div
                    key={entry.repost_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px',
                      borderRadius: '8px',
                      transition: 'background-color 0.2s ease',
                    }}
                  >
                    <img
                      src={resolveProfilePic(user)}
                      alt="Profile"
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid #e9ecef'
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = ctulogo;
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#1f2937',
                        marginBottom: '2px'
                      }}>
                        {fullName}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6c757d' }}>
                        Reposted this post
                      </div>
                    </div>
                    <div style={{ fontSize: '16px', color: '#2563eb' }}>
                      🔁
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RepostsModal;

