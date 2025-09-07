import React, { useState, Fragment } from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  TextField,
  Typography,
} from '@mui/material';
import { Favorite, FavoriteBorder, Comment, Repeat } from '@mui/icons-material';
import ctulogo from '../../images/ctulogo.png';

const ForumPage: React.FC = () => {
  const [postContent, setPostContent] = useState('');
  const [liked, setLiked] = useState(false);

  const handlePostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPostContent(e.target.value);
  };

  const handlePostSubmit = () => {
    alert('Post submitted: ' + postContent);
    setPostContent('');
  };

  const toggleLike = () => {
    setLiked(!liked);
  };

  return (
    <Fragment>
      {/* Alumni Topbar */}
      <Box
        sx={{
          bgcolor: '#e25a2c',
          color: 'white',
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: 900,
          mx: 'auto',
          borderRadius: 2,
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar src={ctulogo} sx={{ width: 48, height: 48 }} />
          <Typography variant="h6" fontWeight="bold">
            Alumni Forum
          </Typography>
        </Box>
        <Box>
          <Button variant="outlined" sx={{ color: 'white', borderColor: 'white' }}>
            Home
          </Button>
          <Button variant="outlined" sx={{ color: 'white', borderColor: 'white', ml: 1 }}>
            Profile
          </Button>
          <Button variant="outlined" sx={{ color: 'white', borderColor: 'white', ml: 1 }}>
            Settings
          </Button>
        </Box>
      </Box>

      {/* Existing content */}
      <Box sx={{ bgcolor: '#f5f5f5', minHeight: '100vh', p: 2 }}>
        {/* Header with profile card */}
        <Box
          sx={{
            bgcolor: '#e25a2c',
            borderRadius: 2,
            p: 2,
            mb: 3,
            display: 'flex',
            alignItems: 'center',
            maxWidth: 900,
            mx: 'auto',
          }}
        >
          <Card
            sx={{
              display: 'flex',
              alignItems: 'center',
              p: 1,
              borderRadius: 2,
              width: 320,
              boxShadow: 3,
            }}
          >
            <Avatar src={ctulogo} sx={{ width: 56, height: 56, mr: 2 }} />
            <Box>
              <Typography variant="h6" component="div" fontWeight="bold">
                BSIT III-1 Evening
              </Typography>
              <Typography variant="body2" color="text.secondary">
                BATCH 2022 - 2025
              </Typography>
            </Box>
          </Card>
        </Box>

        {/* Main content grid */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center', maxWidth: 900, mx: 'auto' }}>
          {/* Left sidebar - Members */}
          <Box sx={{ flex: '1 1 300px', minWidth: 300 }}>
            <Box component="section">
              <Card sx={{ p: 2, borderRadius: 2, boxShadow: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" fontWeight="bold">
                    Members
                  </Typography>
                  <Button size="small" color="primary">
                    See all
                  </Button>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Avatar src={ctulogo} sx={{ width: 48, height: 48 }} />
                  <Avatar src={ctulogo} sx={{ width: 48, height: 48 }} />
                  <Avatar src={ctulogo} sx={{ width: 48, height: 48 }} />
                </Box>
              </Card>
            </Box>
          </Box>

          {/* Center content */}
          <Box sx={{ flex: '2 1 600px', minWidth: 600 }}>
            <Box component="main">
              {/* Start a post */}
              <Card sx={{ mb: 3, borderRadius: 2, boxShadow: 3, p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar src={ctulogo} sx={{ width: 40, height: 40 }} />
                <TextField
                  fullWidth
                  placeholder="Start a post"
                  variant="outlined"
                  size="small"
                  value={postContent}
                  onChange={handlePostChange}
                  sx={{ borderRadius: 50, bgcolor: '#f0f0f0' }}
                />
                <Button variant="contained" color="error" onClick={handlePostSubmit} sx={{ borderRadius: 50 }}>
                  Post
                </Button>
              </Card>

              {/* Post card */}
              <Card sx={{ borderRadius: 2, boxShadow: 3 }}>
                <CardHeader
                  avatar={<Avatar src={ctulogo} />}
                  title={<Typography fontWeight="bold">Lorem ipsum dolor</Typography>}
                  subheader="3,000,000 Followers · 2 d · 🌐"
                  action={
                    <Button variant="text" color="primary" sx={{ textTransform: 'none' }}>
                      + Follow
                    </Button>
                  }
                />
                <CardContent>
                  <Typography variant="body2" color="text.primary" paragraph>
                    Lorem ipsum dolor sit amet. Quo asperiores enim ut veniam repudiandae eum quisquam voluptatem non dolore veritatis eos quia suscipit sed facere alias nam voluptate quia. Ut neque ipsam sed explicabo nemo ut sapiente consectetur qui omnis ducimus qui voluptatem iusto? Id enim quia quo quam consequatur sit nulla delectus aut accusamus velit est animi sint eos consequatur nemo sit facilis ipsam. Est dolores tenetur in dignissimos velit At rerum minus qui velit autem qui officia sint!
                  </Typography>
                </CardContent>
                <CardActions disableSpacing sx={{ justifyContent: 'space-between', px: 2 }}>
                  <Button
                    startIcon={liked ? <Favorite color="error" /> : <FavoriteBorder />}
                    onClick={toggleLike}
                    sx={{ textTransform: 'none', color: liked ? 'error.main' : 'text.secondary' }}
                  >
                    Like
                  </Button>
                  <Button startIcon={<Comment />} sx={{ textTransform: 'none', color: 'text.secondary' }}>
                    Comment
                  </Button>
                  <Button startIcon={<Repeat />} sx={{ textTransform: 'none', color: 'text.secondary' }}>
                    Repost
                  </Button>
                </CardActions>
                <Box sx={{ display: 'flex', alignItems: 'center', p: 2, pt: 0, gap: 2 }}>
                  <Avatar src={ctulogo} sx={{ width: 36, height: 36 }} />
                  <TextField
                    fullWidth
                    placeholder="Add a comment.."
                    variant="outlined"
                    size="small"
                    sx={{ borderRadius: 50 }}
                  />
                </Box>
              </Card>
            </Box>
          </Box>

          {/* Right sidebar - About */}
          <Box sx={{ flex: '1 1 300px', minWidth: 300 }}>
            <Box component="aside">
              <Card sx={{ p: 2, borderRadius: 2, boxShadow: 3 }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  About
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Lorem ipsum dolor sit amet. Quo asperiores enim ut veniam repudiandae eum quisquam voluptatem
                </Typography>
              </Card>
            </Box>
          </Box>
        </Box>
      </Box>
    </Fragment>
  );
};

export default ForumPage;
