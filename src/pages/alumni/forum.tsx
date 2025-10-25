import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, Typography, Avatar, TextField } from '@mui/material';
import AlumniTopBar from './AlumniTopBar';
import PostCreate from './PostCreate';
import PostCard from '../../components/PostCard';
import RepostCard from '../../components/RepostCard';
import ctulogo from '../../images/ctulogo.png';
import { getProfilePicUrl, handleProfilePicError } from '../../utils/profilePicUtils';
import { getForums, followUser, unfollowUser, checkFollowStatus } from '../../services/api';
import './profile.css';

// Define getCurrentUserId locally since auth utility doesn't exist
function getCurrentUserId(user: any): number | null {
  if (!user) return null;
  if (typeof user.user_id === 'number') return user.user_id;
  if (typeof user.id === 'number') return user.id;
  return null;
}

interface PostItem {
  post_id: number;
  post_title?: string;
  post_content: string;
  post_image?: string | null;
  post_images?: Array<{
    image_id: number;
    image_url: string;
    order: number;
  }>;
  created_at?: string | null;
  user?: {
    user_id?: number;
    f_name?: string;
    l_name?: string;
    profile_pic?: string;
    name?: string;
  };
  comments?: Array<{
    comment_id: number;
    comment_content: string;
    date_created: string;
    user: {
      user_id: number;
      f_name: string;
      l_name: string;
      profile_pic?: string;
      initials?: string;
    };
  }>;
  reposts?: Array<{
    repost_id: number;
    repost_date: string;
    repost_caption?: string;
    user: {
      m_name: any;
      user_id: number;
      f_name: string;
      l_name: string;
      profile_pic?: string;
    };
    original_post?: PostItem;
  }>;
  likes?: Array<{
    user_id: number;
    f_name: string;
    l_name: string;
    profile_pic?: string;
    initials?: string;
  }>;
  liked_by_user?: boolean;
  type?: string;
}

const ForumPage: React.FC = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState<{ [key: number]: boolean }>({});
  const [repostedPosts, setRepostedPosts] = useState<{ [key: number]: boolean }>({});
  const [showAllComments, setShowAllComments] = useState<{ [key: number]: boolean }>({});
  const [editingPost, setEditingPost] = useState<{ [key: number]: boolean }>({});
  const [editPostContent, setEditPostContent] = useState<{ [key: number]: string }>({});
  const [editingComment, setEditingComment] = useState<{ [key: number]: boolean }>({});
  const [editCommentContent, setEditCommentContent] = useState<{ [key: number]: string }>({});
  const [showPostCreate, setShowPostCreate] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showOptions, setShowOptions] = useState<{ [key: number]: boolean }>({});
  const [showCommentInput, setShowCommentInput] = useState<{ [key: number]: boolean }>({});
  const [commentInput, setCommentInput] = useState<{ [key: number]: string }>({});
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [allMembers, setAllMembers] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [followLoading, setFollowLoading] = useState<{ [key: number]: boolean }>({});
  const [followingStatus, setFollowingStatus] = useState<{ [key: number]: boolean }>({});
  const [showOriginalPostModal, setShowOriginalPostModal] = useState(false);
  const [originalPostModalData, setOriginalPostModalData] = useState<any | null>(null);
  const [postLoading, setPostLoading] = useState(false);

  // Get current user info
  const userObj = JSON.parse(localStorage.getItem('user') || '{}');
  const currentUserId = getCurrentUserId(userObj);

  // Get batch year for display
  const getBatchYear = () => {
    const yearGraduated = userObj.year_graduated || userObj.batch;
    if (yearGraduated) {
      return `BATCH ${yearGraduated}`;
    }
    return 'BATCH';
  };


  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  // Format time function
  const formatTime = (iso?: string | null) => {
    if (!iso) return '';
    const date = new Date(iso);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d`;
    return date.toLocaleDateString();
  };

  useEffect(() => {
    fetchForumPosts();
    if (currentUserId) {
      fetchAllMembers();
    }
  }, [currentUserId]);

  // Retry fetching members if currentUserId becomes available
  useEffect(() => {
    if (currentUserId && allMembers.length === 0 && !membersLoading) {
      console.log('Retrying members fetch due to empty results');
      fetchAllMembers();
    }
  }, [currentUserId, allMembers.length, membersLoading]);

  const fetchAllMembers = async () => {
    try {
      setMembersLoading(true);
      const { api } = await import('../../services/api');
      const response = await api.get('alumni/all/');
      
      if (response.data.success && response.data.alumni) {
        // Filter to only show users from the same batch
        const currentUserBatch = userObj.year_graduated || userObj.batch;
        const batchMembers = response.data.alumni.filter((member: any) => {
          const memberBatch = member.batch;
          return memberBatch === currentUserBatch;
        });
        setAllMembers(batchMembers);
        
        // Check follow status for each member
        const followStatusPromises = batchMembers.map(async (member: any) => {
          if (member.id && Number(member.id) !== Number(currentUserId)) {
            try {
              const followData = await checkFollowStatus(Number(member.id));
              return { memberId: member.id, isFollowing: followData.success ? followData.is_following : false };
            } catch (error) {
              return { memberId: member.id, isFollowing: false };
            }
          }
          return null;
        });
        
        const followStatuses = await Promise.all(followStatusPromises);
        const followStatusMap: { [key: number]: boolean } = {};
        followStatuses.forEach(status => {
          if (status) {
            followStatusMap[status.memberId] = status.isFollowing;
          }
        });
        setFollowingStatus(followStatusMap);
      } else {
        setAllMembers([]);
      }
    } catch (error) {
      console.error('Error fetching all members:', error);
      setAllMembers([]);
    } finally {
      setMembersLoading(false);
    }
  };

  const handleFollow = async (userId: number) => {
    if (!userId || userId === Number(currentUserId)) return;
    
    setFollowLoading(prev => ({ ...prev, [userId]: true }));
    
    try {
      const isCurrentlyFollowing = followingStatus[userId];
      
      if (isCurrentlyFollowing) {
        // Unfollow
        const result = await unfollowUser(userId);
        if (result.success) {
          setFollowingStatus(prev => ({ ...prev, [userId]: false }));
        } else {
          alert(result.message || 'Failed to unfollow user.');
        }
      } else {
        // Follow
        const result = await followUser(userId);
        if (result.success) {
          setFollowingStatus(prev => ({ ...prev, [userId]: true }));
        } else {
          alert(result.message || 'Failed to follow user.');
        }
      }
    } catch (error: any) {
      console.error('Follow/unfollow error:', error);
      alert(error?.response?.data?.error || error?.message || 'Failed to follow/unfollow user.');
    } finally {
      setFollowLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleViewOriginalPost = async (originalPost: any) => {
    console.log('handleViewOriginalPost called with original post:', originalPost);
    setPostLoading(true);
    try {
      // Fetch the full post data from the API
      const { api } = await import('../../services/api');
      const response = await api.get(`forum/${originalPost.post_id}/`);
      console.log('Original post API response:', response.data);
      if (response.data) {
        setOriginalPostModalData(response.data);
        
        // Update the liked state for the modal post
        setLikedPosts(prev => ({
          ...prev,
          [response.data.post_id]: response.data.liked_by_user || false
        }));
        
        setShowOriginalPostModal(true);
        console.log('Original post modal should now be visible');
      }
    } catch (error) {
      console.error('Error fetching original post:', error);
      alert('Failed to load original post.');
    } finally {
      setPostLoading(false);
    }
  };

  // Handle viewing a forum post by ID (for notifications)
  const handleViewForumPostById = async (postId: string) => {
    console.log('handleViewForumPostById called with postId:', postId);
    setPostLoading(true);
    try {
      const { api } = await import('../../services/api');
      console.log('🔍 Fetching forum post with ID:', postId);
      const response = await api.get(`forum/${postId}/`);
      console.log('🔍 Forum post API response:', response.data);
      if (response.data) {
        // Transform the response to match the expected format
        const transformedData = {
          ...response.data,
          post_image: response.data.post_image || null,
          post_images: response.data.post_images || [],
          user: {
            ...response.data.user,
            profile_pic: response.data.user?.profile_pic ? 
              (String(response.data.user.profile_pic).startsWith('http') ? 
                response.data.user.profile_pic : 
                `http://127.0.0.1:8000${response.data.user.profile_pic}`) : 
              null
          }
        };
        
        setOriginalPostModalData(transformedData);
        console.log('🔍 Set original post modal data:', transformedData);
        
        // Update the liked state for the modal post
        setLikedPosts(prev => ({
          ...prev,
          [transformedData.post_id]: transformedData.liked_by_user || false
        }));
        
        setShowOriginalPostModal(true);
        console.log('✅ Forum post modal opened for notification, showOriginalPostModal:', true);
      } else {
        console.error('❌ No data in API response');
      }
    } catch (error: any) {
      console.error('❌ Error fetching forum post by ID:', error);
      console.error('❌ Error details:', error.response?.data || error.message);
      alert('Unable to load the forum post. It may have been deleted.');
    } finally {
      setPostLoading(false);
    }
  };

  // Check for pending forum post view from notification
  useEffect(() => {
    console.log('🔍 useEffect for pendingForumPostView running...');
    const pendingForumPostId = localStorage.getItem('pendingForumPostView');
    console.log('🔍 Raw localStorage value:', pendingForumPostId);
    if (pendingForumPostId) {
      console.log('🔍 Found pending forum post view:', pendingForumPostId);
      console.log('🔍 handleViewForumPostById function exists?', typeof handleViewForumPostById === 'function');
      localStorage.removeItem('pendingForumPostView');
      // Wait a bit for the component to fully mount
      setTimeout(() => {
        console.log('🔍 Calling handleViewForumPostById with ID:', pendingForumPostId);
        if (typeof handleViewForumPostById === 'function') {
          handleViewForumPostById(pendingForumPostId);
        } else {
          console.error('❌ handleViewForumPostById is not a function!');
        }
      }, 500);
    } else {
      console.log('🔍 No pending forum post view found');
    }
  }, []); // Run only once on mount

  const fetchForumPosts = async () => {
    try {
      setLoading(true);
      const forumsData = await getForums();
      
      // Transform forum data to match PostItem interface
      const transformedPosts: PostItem[] = forumsData.map((forum: any) => ({
        post_id: forum.post_id, // forum_id from backend
        post_content: forum.post_content,
        post_image: forum.post_image,
        post_images: forum.post_images,
        created_at: forum.created_at,
        type: 'forum',
        user: {
          user_id: forum.user.user_id,
          f_name: forum.user.f_name,
          l_name: forum.user.l_name,
          profile_pic: forum.user.profile_pic ? 
            (String(forum.user.profile_pic).startsWith('http') ? 
              forum.user.profile_pic : 
              `http://127.0.0.1:8000${forum.user.profile_pic}`) : 
            null,
          name: `${forum.user.f_name} ${forum.user.l_name}`
        },
        likes: forum.likes || [], // Use actual likes data from backend
        comments: forum.comments || [], // Use actual comments data from backend
        reposts: forum.reposts || [] // Use actual reposts data from backend
      }));
      
      
      // Create a mixed feed of posts and reposts, sorted by date
      const mixedFeed: any[] = [];
      
      // Add original posts to the feed
      transformedPosts.forEach(post => {
        mixedFeed.push({
          ...post,
          item_type: 'post',
          sort_date: post.created_at
        });
        
        // Add each repost as a separate feed item
        if (post.reposts && post.reposts.length > 0) {
          post.reposts.forEach((repost: any) => {
            mixedFeed.push({
              post_id: repost.repost_id, // Use repost_id for interactions
              post_content: post.post_content,
              post_image: post.post_image,
              post_images: post.post_images,
              created_at: repost.repost_date, // Use repost date for sorting
              type: 'forum',
              item_type: 'repost',
              sort_date: repost.repost_date,
              user: repost.user,
              likes: repost.likes || [], // Use actual likes data from backend
              comments: repost.comments || [], // Use actual comments data from backend
              likes_count: repost.likes_count || 0,
              comments_count: repost.comments_count || 0,
              reposts: [], // No nested reposts
              repostData: {
                repost_id: repost.repost_id,
                repost_date: repost.repost_date,
                repost_caption: repost.repost_caption,
                user: repost.user,
                likes: repost.likes || [],
                likes_count: repost.likes_count || 0,
                comments: repost.comments || [],
                comments_count: repost.comments_count || 0,
                original_post: {
                  post_id: post.post_id,
                  post_content: post.post_content,
                  post_image: post.post_image,
                  post_images: post.post_images,
                  created_at: post.created_at,
                  user: post.user
                }
              }
            });
          });
        }
      });
      
      // Sort the mixed feed by date (newest first)
      const sortedFeed = mixedFeed.sort((a: any, b: any) => {
        const dateA = a.sort_date || a.created_at || '';
        const dateB = b.sort_date || b.created_at || '';
        
        // Convert to Date objects for comparison
        const dateAObj = new Date(dateA);
        const dateBObj = new Date(dateB);
        
        // Sort newest first (descending)
        return dateBObj.getTime() - dateAObj.getTime();
      });
      
      
      
      setPosts(sortedFeed);
      
      // Initialize liked and reposted posts state
      const liked: { [key: number]: boolean } = {};
      const reposted: { [key: number]: boolean } = {};
      
      sortedFeed.forEach((item: any) => {
        if (item.item_type === 'repost') {
          // Handle repost items
          liked[item.repostData?.repost_id] = item.repostData?.likes?.some((like: any) => like.user_id === currentUserId) || false;
          reposted[item.repostData?.repost_id] = false; // Reposts themselves can't be reposted
        } else {
          // Handle original post items
          const forum = forumsData.find((f: any) => f.post_id === item.post_id);
          if (forum) {
            liked[item.post_id] = forum.is_liked || false;
            
            // Check if current user has reposted this forum post
            if (forum.reposts && Array.isArray(forum.reposts)) {
              reposted[item.post_id] = forum.reposts.some((repost: any) => repost.user.user_id === currentUserId);
            } else {
              reposted[item.post_id] = false;
            }
          }
        }
      });
      
      setLikedPosts(liked);
      setRepostedPosts(reposted);
    } catch (error: any) {
      console.error('Error fetching forum posts:', error);
    } finally {
      setLoading(false);
    }
  };


  return (
    <Box sx={{ bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Alumni TopBar */}
      <AlumniTopBar 
        showProfile={showProfile}
        setShowProfile={setShowProfile}
        handleLogout={handleLogout}
      />


      {/* Main Content */}
      <Box sx={{ maxWidth: '100%', mx: 0, px: 2, py: 2 }}>
        {/* Header Section */}
        <Box sx={{ mb: 3 }}>
          <Card
            sx={{
              display: 'flex',
              alignItems: 'center',
              p: 2,
              borderRadius: 2,
              boxShadow: 3,
              bgcolor: 'white'
            }}
          >
            <Avatar 
              src={ctulogo} 
              sx={{ 
                width: 60, 
                height: 60, 
                mr: 2
              }} 
            />
            <Box>
              <Typography variant="h5" component="div" fontWeight="bold">
                FORUM
              </Typography>
              <Typography variant="body2" sx={{ color: '#6c757d' }}>
                {getBatchYear()}
              </Typography>
            </Box>
          </Card>
        </Box>

        {/* Three Column Layout */}
        <Box sx={{ display: 'flex', gap: 3 }}>
          {/* Left Sidebar - Members */}
          <Box sx={{ flex: '0 0 300px' }}>
            <div className="profile-followers-card">
              <div className="profile-followers-header">
                <div className="profile-followers-title">Members ({allMembers.length})</div>
                <div
                  className="profile-followers-seeall"
                  onClick={() => {
                    setShowMembersModal(true);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  See all
                </div>
              </div>
              <div className="profile-followers-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {membersLoading ? (
                  <div>Loading members...</div>
                ) : allMembers.length === 0 ? (
                  <div>No other members in your batch yet.</div>
                ) : (
                  <>
                    {/* Render members in rows of 3 */}
                    {(() => {
                      const maxToShow = Math.min(allMembers.length, 6);
                      const rows = Math.ceil(maxToShow / 3);
                      console.log('Rendering members:', { totalMembers: allMembers.length, maxToShow, rows });
                      return Array.from({ length: rows }).map((_, rowIndex) => (
                      <div key={`row-${rowIndex}`} className="profile-followers-row">
                        {allMembers.slice(rowIndex * 3, Math.min(rowIndex * 3 + 3, maxToShow)).map((member) => (
                          <div
                            key={member.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              const destId = member.id;
                              
                              if (destId && !isNaN(Number(destId))) {
                                console.log('Members: Navigating to member profile:', destId);
                                navigate(`/profile/${destId}`);
                              } else {
                                console.log('Members: Invalid member ID:', destId);
                              }
                            }}
                            style={{ 
                              cursor: 'pointer',
                              textAlign: 'center',
                              flex: 1,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center'
                            }}
                          >
                            <img
                              src={member.profile_pic ? (String(member.profile_pic).startsWith('http') ? member.profile_pic : `http://127.0.0.1:8000${member.profile_pic}`) : ctulogo}
                              alt={member.name || `${member.f_name || ''} ${member.l_name || ''}`.trim()}
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                marginBottom: '4px',
                                display: 'block'
                              }}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.onerror = null;
                                target.src = ctulogo as unknown as string;
                              }}
                            />
                            <div style={{
                              fontSize: '12px',
                              color: '#666',
                              textAlign: 'center',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '60px',
                              marginTop: '4px',
                              fontWeight: 'normal',
                              lineHeight: '1.2'
                            }}>
                              {member.name || `${member.f_name || ''} ${member.l_name || ''}`.trim() || 'Unknown User'}
                            </div>
                          </div>
                        ))}
                      </div>
                    ));
                    })()}
                  </>
                )}
              </div>
            </div>
          </Box>

          {/* Center Content */}
          <Box sx={{ flex: '1 1 600px' }}>
              {/* Start a post */}
            <Card sx={{ mb: 3, borderRadius: 2, boxShadow: 3, p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar 
                  src={userObj.profile_pic ? 
                    (String(userObj.profile_pic).startsWith('http') ? 
                      userObj.profile_pic : 
                      `http://127.0.0.1:8000${userObj.profile_pic}`) : 
                    ctulogo} 
                  sx={{ width: 40, height: 40 }} 
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.onerror = null;
                    target.src = ctulogo as unknown as string;
                  }}
                />
                <TextField
                  fullWidth
                  placeholder="Start a post"
                  variant="outlined"
                  size="small"
                  onClick={() => setShowPostCreate(true)}
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '25px',
                      bgcolor: '#f0f0f0',
                      '& fieldset': {
                        borderColor: 'transparent',
                      },
                      '&:hover fieldset': {
                        borderColor: 'transparent',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'transparent',
                      },
                    }
                  }}
                />
              </Box>
              </Card>

            {/* Posts Feed */}
            <Box sx={{ 
              maxHeight: 'calc(100vh - 300px)', 
              overflowY: 'auto',
              scrollbarWidth: 'none', /* Firefox */
              msOverflowStyle: 'none', /* IE and Edge */
              '&::-webkit-scrollbar': {
                display: 'none', /* Chrome, Safari and Opera */
              },
            }}>
              {loading ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography>Loading forum posts...</Typography>
                </Box>
              ) : posts.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="h6" sx={{ color: '#6c757d' }}>
                    No posts yet
                  </Typography>
                  <Typography sx={{ color: '#6c757d', mt: 1 }}>
                    Be the first to start a discussion in the forum!
                  </Typography>
                </Box>
              ) : (
                posts.map((item: any) => {
                  // Handle both posts and reposts as separate items
                  const isOwn = Number(item.user?.user_id) === Number(currentUserId);
                  const displayName = item.user?.name || `${item.user?.f_name || ''} ${item.user?.l_name || ''}`.trim() || 'Unknown User';
                  const displayAvatar = getProfilePicUrl(item.user?.profile_pic);
                  
                  // Render as repost if item_type is 'repost'
                  if (item.item_type === 'repost' && item.repostData) {
                    return (
                      <RepostCard
                        key={`repost-${item.repostData.repost_id}`}
                        repost={{
                          repost_id: item.repostData.repost_id,
                          repost_date: item.repostData.repost_date,
                          repost_caption: item.repostData.repost_caption,
                          user: item.repostData.user,
                          likes: item.repostData.likes || [],
                          likes_count: item.repostData.likes_count || 0,
                          comments: item.repostData.comments || [],
                          comments_count: item.repostData.comments_count || 0,
                          original_post: item.repostData.original_post ? {
                            post_id: item.repostData.original_post.post_id,
                            created_at: item.repostData.original_post.created_at,
                            post_content: item.repostData.original_post.post_content,
                            post_images: item.repostData.original_post.post_images || (item.repostData.original_post.post_image ? [{ image_id: 0, image_url: item.repostData.original_post.post_image, order: 0 }] : undefined),
                            user: item.repostData.original_post.user
                          } : undefined
                        }}
                        currentUserId={currentUserId}
                        formatTime={formatTime}
                        context="forum"
                        onRefresh={() => {
                          // Immediate update without page refresh - similar to UnifiedDashboard
                          getForums().then((forumsData) => {
                            // Transform forum data to match PostItem interface
                            const transformedPosts: PostItem[] = forumsData.map((forum: any) => ({
                          post_id: forum.post_id,
                          post_content: forum.post_content,
                          post_image: forum.post_image,
                          post_images: forum.post_images,
                          created_at: forum.created_at,
                          type: forum.type,
                          user: forum.user,
                          likes_count: forum.likes_count,
                          comments_count: forum.comments_count,
                          reposts_count: forum.reposts_count,
                          is_liked: forum.is_liked,
                          likes: forum.likes || [],
                          comments: forum.comments || [],
                          reposts: forum.reposts || []
                            }));
                            
                            // Create a mixed feed of posts and reposts, sorted by date
                            const mixedFeed: any[] = [];
                            
                            // Add original posts to the feed
                            transformedPosts.forEach(post => {
                              mixedFeed.push({
                                ...post,
                                item_type: 'post',
                                sort_date: post.created_at
                              });
                              
                              // Add each repost as a separate feed item
                              if (post.reposts && post.reposts.length > 0) {
                                post.reposts.forEach((repost: any) => {
                                  mixedFeed.push({
                                    post_id: repost.repost_id,
                                    post_content: post.post_content,
                                    post_image: post.post_image,
                                    post_images: post.post_images,
                                    created_at: repost.repost_date,
                                    type: 'forum',
                                    item_type: 'repost',
                                    sort_date: repost.repost_date,
                                    user: repost.user,
                                    likes: repost.likes || [],
                                    comments: repost.comments || [],
                                    likes_count: repost.likes_count || 0,
                                    comments_count: repost.comments_count || 0,
                                    reposts: [],
                                    repostData: {
                                      repost_id: repost.repost_id,
                                      repost_date: repost.repost_date,
                                      repost_caption: repost.repost_caption,
                                      user: repost.user,
                                      likes: repost.likes || [],
                                      likes_count: repost.likes_count || 0,
                                      comments: repost.comments || [],
                                      comments_count: repost.comments_count || 0,
                                      original_post: {
                                        post_id: post.post_id,
                                        post_content: post.post_content,
                                        post_image: post.post_image,
                                        post_images: post.post_images,
                                        created_at: post.created_at,
                                        user: post.user
                                      }
                                    }
                                  });
                                });
                              }
                            });
                            
                            // Sort the mixed feed by date (newest first)
                            const sortedFeed = mixedFeed.sort((a: any, b: any) => {
                              const dateA = a.sort_date || a.created_at || '';
                              const dateB = b.sort_date || b.created_at || '';
                              
                              const dateAObj = new Date(dateA);
                              const dateBObj = new Date(dateB);
                              
                              return dateBObj.getTime() - dateAObj.getTime();
                            });
                            
                            setPosts(sortedFeed);
                            
                            // Update liked and reposted states
                            const liked: { [key: number]: boolean } = {};
                            const reposted: { [key: number]: boolean } = {};
                            
                            sortedFeed.forEach((item: any) => {
                              if (item.item_type === 'repost') {
                                liked[item.post_id] = item.likes?.some((like: any) => like.user_id === currentUserId) || false;
                                reposted[item.post_id] = false;
                              } else {
                                const forum = forumsData.find((f: any) => f.post_id === item.post_id);
                                if (forum) {
                                  liked[item.post_id] = forum.is_liked || false;
                                  if (forum.reposts && Array.isArray(forum.reposts)) {
                                    reposted[item.post_id] = forum.reposts.some((repost: any) => repost.user.user_id === currentUserId);
                                  } else {
                                    reposted[item.post_id] = false;
                                  }
                                }
                              }
                            });
                            
                            setLikedPosts(liked);
                            setRepostedPosts(reposted);
                          });
                        }}
                      />
                    );
                  }
                  
                  // Render as regular post
                  return (
                    <PostCard
                      key={item.post_id}
                      post={item}
                      currentUserId={currentUserId}
                      isOwn={isOwn}
                      displayName={displayName}
                      displayAvatar={displayAvatar}
                      formatTime={formatTime}
                      onPostUpdate={() => {
                        // Immediate update without page refresh - similar to UnifiedDashboard
                        getForums().then((forumsData) => {
                          // Transform forum data to match PostItem interface
                          const transformedPosts: PostItem[] = forumsData.map((forum: any) => ({
                          post_id: forum.post_id,
                          post_content: forum.post_content,
                          post_image: forum.post_image,
                          post_images: forum.post_images,
                          created_at: forum.created_at,
                          type: forum.type,
                          user: forum.user,
                          likes_count: forum.likes_count,
                          comments_count: forum.comments_count,
                          reposts_count: forum.reposts_count,
                          is_liked: forum.is_liked,
                          likes: forum.likes || [],
                          comments: forum.comments || [],
                          reposts: forum.reposts || []
                          }));
                          
                          // Create a mixed feed of posts and reposts, sorted by date
                          const mixedFeed: any[] = [];
                          
                          // Add original posts to the feed
                          transformedPosts.forEach(post => {
                            mixedFeed.push({
                              ...post,
                              item_type: 'post',
                              sort_date: post.created_at
                            });
                            
                            // Add each repost as a separate feed item
                            if (post.reposts && post.reposts.length > 0) {
                              post.reposts.forEach((repost: any) => {
                                mixedFeed.push({
                                  post_id: repost.repost_id,
                                  post_content: post.post_content,
                                  post_image: post.post_image,
                                  post_images: post.post_images,
                                  created_at: repost.repost_date,
                                  type: 'forum',
                                  item_type: 'repost',
                                  sort_date: repost.repost_date,
                                  user: repost.user,
                                  likes: repost.likes || [],
                                  comments: repost.comments || [],
                                  likes_count: repost.likes_count || 0,
                                  comments_count: repost.comments_count || 0,
                                  reposts: [],
                                  repostData: {
                                    repost_id: repost.repost_id,
                                    repost_date: repost.repost_date,
                                    repost_caption: repost.repost_caption,
                                    user: repost.user,
                                    likes: repost.likes || [],
                                    likes_count: repost.likes_count || 0,
                                    comments: repost.comments || [],
                                    comments_count: repost.comments_count || 0,
                                    original_post: {
                                      post_id: post.post_id,
                                      post_content: post.post_content,
                                      post_image: post.post_image,
                                      post_images: post.post_images,
                                      created_at: post.created_at,
                                      user: post.user
                                    }
                                  }
                                });
                              });
                            }
                          });
                          
                          // Sort the mixed feed by date (newest first)
                          const sortedFeed = mixedFeed.sort((a: any, b: any) => {
                            const dateA = a.sort_date || a.created_at || '';
                            const dateB = b.sort_date || b.created_at || '';
                            
                            const dateAObj = new Date(dateA);
                            const dateBObj = new Date(dateB);
                            
                            return dateBObj.getTime() - dateAObj.getTime();
                          });
                          
                          setPosts(sortedFeed);
                          
                          // Update liked and reposted states
                          const liked: { [key: number]: boolean } = {};
                          const reposted: { [key: number]: boolean } = {};
                          
                          sortedFeed.forEach((item: any) => {
                            if (item.item_type === 'repost') {
                              liked[item.post_id] = item.likes?.some((like: any) => like.user_id === currentUserId) || false;
                              reposted[item.post_id] = false;
                            } else {
                              const forum = forumsData.find((f: any) => f.post_id === item.post_id);
                              if (forum) {
                                liked[item.post_id] = forum.is_liked || false;
                                if (forum.reposts && Array.isArray(forum.reposts)) {
                                  reposted[item.post_id] = forum.reposts.some((repost: any) => repost.user.user_id === currentUserId);
                                } else {
                                  reposted[item.post_id] = false;
                                }
                              }
                            }
                          });
                          
                          setLikedPosts(liked);
                          setRepostedPosts(reposted);
                        });
                      }}
                      showOptions={showOptions}
                      setShowOptions={setShowOptions}
                      editingPost={editingPost}
                      setEditingPost={setEditingPost}
                      editPostContent={editPostContent}
                      setEditPostContent={setEditPostContent}
                      likedPosts={likedPosts}
                      setLikedPosts={setLikedPosts}
                      repostedPosts={repostedPosts}
                      setRepostedPosts={setRepostedPosts}
                      showCommentInput={showCommentInput}
                      setShowCommentInput={setShowCommentInput}
                      showAllComments={showAllComments}
                      setShowAllComments={setShowAllComments}
                      commentInput={commentInput}
                      setCommentInput={setCommentInput}
                      editingComment={editingComment}
                      setEditingComment={setEditingComment}
                      editCommentContent={editCommentContent}
                      setEditCommentContent={setEditCommentContent}
                      isForum={true}
                      onViewOriginalPost={handleViewOriginalPost}
                    />
                  );
                })
              )}
            </Box>
          </Box>

          {/* Right Sidebar - About */}
          <Box sx={{ flex: '0 0 300px' }}>
              <Card sx={{ p: 2, borderRadius: 2, boxShadow: 3 }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  About
                </Typography>
              <Typography variant="body2" sx={{ color: '#6c757d' }}>
                Connect with fellow alumni from your batch and share experiences, memories, and updates about your journey after graduation.
                </Typography>
              </Card>
          </Box>
        </Box>
      </Box>

      {/* Post Create Modal */}
      {showPostCreate && (
        <PostCreate 
          postType="forum" 
          onPosted={fetchForumPosts}
          onCancel={() => setShowPostCreate(false)}
          user={userObj}
        />
      )}

      {/* Members Modal */}
      {showMembersModal && (
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
          onClick={() => setShowMembersModal(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
              maxWidth: '800px',
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              position: 'sticky',
              top: 0,
              background: 'white',
              borderBottom: '1px solid #e0e0e0',
              padding: '20px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderRadius: '16px 16px 0 0',
              zIndex: 1,
            }}>
              <h3 style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                color: '#1a1a1a',
              }}>Members ({allMembers.length})</h3>
              <button
                onClick={() => setShowMembersModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 28,
                  cursor: 'pointer',
                  color: '#666',
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f5f5f5';
                  e.currentTarget.style.color = '#333';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#666';
                }}
                title="Close"
              >
                ×
              </button>
            </div>
            <div style={{
              padding: '20px 24px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 16,
            }}>
              {allMembers.length === 0 ? (
                <div style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  color: '#666',
                  fontSize: 16,
                  padding: '40px 20px'
                }}>No members found.</div>
              ) : (
                allMembers.map((member) => (
                  <div
                    key={member.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: 16,
                      borderRadius: 12,
                      border: '1px solid #e0e0e0',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      background: 'white',
                    }}
                    onClick={() => {
                      const destId = member.id;
                      if (destId && Number(destId) !== Number(currentUserId)) {
                        navigate(`/profile/${destId}`);
                        setShowMembersModal(false);
                      }
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                      e.currentTarget.style.borderColor = '#0066cc';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.borderColor = '#e0e0e0';
                    }}
                  >
                    <img
                      src={member.profile_pic ? (String(member.profile_pic).startsWith('http') ? member.profile_pic : `http://127.0.0.1:8000${member.profile_pic}`) : ctulogo}
                      alt={member.name || 'Unknown User'}
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        marginBottom: 12,
                        border: '3px solid #f0f0f0',
                      }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.src = ctulogo as unknown as string;
                      }}
                    />
                    <div style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: '#1a1a1a',
                      textAlign: 'center',
                      marginBottom: 4,
                    }}>
                      {member.name || `${member.f_name || ''} ${member.m_name || ''} ${member.l_name || ''}`.trim() || 'Unknown User'}
                    </div>
                    <div style={{
                      fontSize: 13,
                      color: '#666',
                      marginBottom: 12,
                    }}>
                      {member.batch ? `Batch ${member.batch}` : ''}
                    </div>
                    {Number(member.id) !== Number(currentUserId) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFollow(member.id);
                        }}
                        disabled={followLoading[member.id]}
                        className={`suggested-user-follow-button ${followingStatus[member.id] ? 'following' : ''}`}
                      >
                        {followLoading[member.id] ? '...' : followingStatus[member.id] ? 'Unfollow' : 'Follow'}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Original Post Modal */}
      {showOriginalPostModal && originalPostModalData && (
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
          onClick={() => setShowOriginalPostModal(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowOriginalPostModal(false)}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: 'none',
                border: 'none',
                fontSize: 24,
                cursor: 'pointer',
                color: '#666',
                zIndex: 10,
              }}
              title="Close"
            >
              ×
            </button>
            <div style={{ padding: '20px' }}>
              <PostCard
                post={originalPostModalData}
                currentUserId={currentUserId}
                isOwn={currentUserId === originalPostModalData.user?.user_id}
                displayName={originalPostModalData.user?.name || `${originalPostModalData.user?.f_name || ''} ${originalPostModalData.user?.l_name || ''}`.trim() || 'Unknown User'}
                displayAvatar={getProfilePicUrl(originalPostModalData.user?.profile_pic)}
                formatTime={formatTime}
                onViewOriginalPost={handleViewOriginalPost}
                onPostUpdate={async () => {
                  // Refresh the original post data in modal
                  const postId = originalPostModalData.post_id;
                  if (postId) {
                    console.log('Modal onPostUpdate called, refreshing post:', postId);
                    // Re-fetch the post data from server to get updated like status
                    try {
                      const { api } = await import('../../services/api');
                      const response = await api.get(`forum/${postId}/`);
                      if (response.data) {
                        setOriginalPostModalData(response.data);
                        // Update the liked state for the modal post
                        setLikedPosts(prev => ({
                          ...prev,
                          [response.data.post_id]: response.data.liked_by_user || false
                        }));
                      }
                    } catch (error) {
                      console.error('Error refreshing modal post:', error);
                    }
                  }
                  
                  // Also refresh the main posts list to keep everything in sync
                  fetchForumPosts();
                }}
                isForum={true}
                showOptions={showOptions}
                setShowOptions={setShowOptions}
                editingPost={editingPost}
                setEditingPost={setEditingPost}
                editPostContent={editPostContent}
                setEditPostContent={setEditPostContent}
                likedPosts={likedPosts}
                setLikedPosts={setLikedPosts}
                repostedPosts={repostedPosts}
                setRepostedPosts={setRepostedPosts}
                showCommentInput={showCommentInput}
                setShowCommentInput={setShowCommentInput}
                showAllComments={showAllComments}
                setShowAllComments={setShowAllComments}
                commentInput={commentInput}
                setCommentInput={setCommentInput}
                editingComment={editingComment}
                setEditingComment={setEditingComment}
                editCommentContent={editCommentContent}
                setEditCommentContent={setEditCommentContent}
              />
            </div>
          </div>
        </div>
      )}
    </Box>
  );
};

export default ForumPage;
