import React, { useState } from 'react';
import { Box, Typography, Avatar, Paper } from '@mui/material';
import ctulogo from '../../images/ctulogo.png';
import AlumniTopBar from './AlumniTopBar';
import PostCreate from './PostCreate';
import PostCard from '../../components/PostCard';

// Demo/mock post data
const mockPosts = [
  {
    post_id: 1,
    post_title: 'Welcome to the Forum!',
    post_content: 'This is a sample forum post. Feel free to share your thoughts!',
    created_at: new Date().toISOString(),
    user: {
      user_id: 999,
      name: 'Forum Admin',
      profile_pic: '',
      f_name: 'Forum',
      l_name: 'Admin',
    },
    comments: [],
    reposts: [],
    likes: [],
    liked_by_user: false,
  },
];

function getCurrentAlumniUser() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return { name: 'User', profile_pic: ctulogo };
    const user = JSON.parse(raw);
    return {
      name: user.name || 'User',
      profile_pic: user.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : ctulogo,
    };
  } catch {
    return { name: 'User', profile_pic: ctulogo };
  }
}

const ForumPage: React.FC = () => {
  const [showProfile, setShowProfile] = useState(false);
  const [posts, setPosts] = useState(mockPosts);
  const [showComposer, setShowComposer] = useState(false);

  const alumniUser = getCurrentAlumniUser();

  const handlePostCreated = () => {
    setShowComposer(false);
    alert('New post created! (Demo)');
  };

  return (
    <Box sx={{ bgcolor: '#f5f5f5', minHeight: '100vh', p: 0 }}>
      <AlumniTopBar showProfile={showProfile} setShowProfile={setShowProfile} handleLogout={() => {}} />
      {/* Orange Banner */}
      <Box sx={{ bgcolor: '#e25a2c', height: 120, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxWidth: 900, mx: 'auto', mt: 2 }} />
      {/* Centered Profile Card */}
      <Box sx={{ maxWidth: 900, mx: 'auto', mt: -8, mb: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Paper elevation={3} sx={{ bgcolor: 'white', borderRadius: 3, p: 4, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Avatar src={ctulogo} sx={{ width: 100, height: 100, mb: 2, border: '4px solid #fff', boxShadow: 2 }} />
          <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>forum</Typography>
        </Paper>
      </Box>
      {/* Post Create Area */}
      <Box sx={{ maxWidth: 900, mx: 'auto', mb: 2 }}>
        <Box onClick={() => setShowComposer(true)} sx={{ bgcolor: 'white', borderRadius: 2, boxShadow: 1, p: 2, display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
          <Avatar src={alumniUser.profile_pic} sx={{ width: 40, height: 40 }} />
          <Box sx={{ flex: 1, color: '#888' }}>Start a post</Box>
        </Box>
        {showComposer && (
          <PostCreate onPosted={handlePostCreated} onCancel={() => setShowComposer(false)} user={alumniUser} />
        )}
      </Box>
      {/* Post Feed */}
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        {posts.map((post) => (
          <Box key={post.post_id} sx={{ mb: 2 }}>
            <PostCard
              post={post}
              currentUserId={null}
              isOwn={false}
              displayName={post.user?.name || 'forum'}
              displayAvatar={ctulogo}
              formatTime={(iso) => iso ? new Date(iso).toLocaleString() : ''}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default ForumPage;
