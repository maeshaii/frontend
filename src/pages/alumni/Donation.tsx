import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, Typography, Avatar, TextField } from '@mui/material';
import AlumniTopBar from './AlumniTopBar';
import PostCreate from './PostCreate';
import PostCard from '../../components/PostCard';
import RepostCard, { PostItemLite } from '../../components/RepostCard';
import ctulogo from '../../images/ctulogo.png';
import { getProfilePicUrl, handleProfilePicError } from '../../utils/profilePicUtils';
import { getDonationRequests, followUser, unfollowUser, checkFollowStatus } from '../../services/api';
import './profile.css'; 

// Define getCurrentUserId locally since auth utility doesn't exist
function getCurrentUserId(user: any): number | null {
  if (!user) return null;
  if (typeof user.user_id === 'number') return user.user_id;
  if (typeof user.id === 'number') return user.id;
  return null;
}

interface DonationItem {
  donation_id: number;
  description: string;
  status: string;
  created_at?: string | null;
  user?: {
    user_id?: number;
    f_name?: string;
    m_name?: string;
    l_name?: string;
    profile_pic?: string;
    name?: string;
  };
  images?: Array<{
    image_id: number;
    image_url: string;
    order: number;
  }>;
  comments?: Array<{
    comment_id: number;
    comment_content: string;
    date_created: string;
    user: {
      user_id: number;
      f_name: string;
      m_name?: string;
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
    original_post?: DonationItem;
  }>;
    likes?: Array<{
        user_id: number;
        f_name: string;
        l_name: string;
        profile_pic?: string;
    initials?: string;
  }>;
  liked_by_user?: boolean;
  likes_count?: number;
  comments_count?: number;
  reposts_count?: number;
  type?: string;
}

const DonationPage: React.FC = () => {
  const navigate = useNavigate();
  const [donations, setDonations] = useState<DonationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedDonations, setLikedDonations] = useState<{ [key: number]: boolean }>({});
  const [repostedDonations, setRepostedDonations] = useState<{ [key: number]: boolean }>({});
  const [showAllComments, setShowAllComments] = useState<{ [key: number]: boolean }>({});
  const [editingDonation, setEditingDonation] = useState<{ [key: number]: boolean }>({});
  const [editDonationContent, setEditDonationContent] = useState<{ [key: number]: string }>({});
  const [editingComment, setEditingComment] = useState<{ [key: number]: boolean }>({});
  const [editCommentContent, setEditCommentContent] = useState<{ [key: number]: string }>({});
  const [showPostCreate, setShowPostCreate] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showOptions, setShowOptions] = useState<{ [key: number]: boolean }>({});
  const [showCommentInput, setShowCommentInput] = useState<{ [key: number]: boolean }>({});
  const [commentInput, setCommentInput] = useState<{ [key: number]: string }>({});
  // Removed member-related state since we're using About card instead
  const [showOriginalDonationModal, setShowOriginalDonationModal] = useState(false);
  const [originalDonationModalData, setOriginalDonationModalData] = useState<any | null>(null);
  const [donationLoading, setDonationLoading] = useState(false);

  // Get current user info
  const userObj = JSON.parse(localStorage.getItem('user') || '{}');
  const currentUserId = getCurrentUserId(userObj);


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
    fetchDonationPosts();
  }, [currentUserId]);

  // Removed member-related functions since we're using About card instead

  // Fetch donation requests
  const fetchDonationPosts = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const response = await getDonationRequests();
      if (response.success) {
        // Transform donation data to match PostItem interface
        const transformedDonations: DonationItem[] = response.donations.map((donation: any) => ({
          donation_id: donation.donation_id,
          description: donation.description,
          status: donation.status,
          created_at: donation.created_at,
          user: donation.user,
          images: donation.images || [],
          likes_count: donation.likes_count || 0,
          comments_count: donation.comments_count || 0,
          reposts_count: donation.reposts_count || 0,
          is_liked: donation.is_liked,
          likes: donation.likes || [],
          comments: donation.comments || [],
          reposts: donation.reposts || []
        }));
        
        // Build a mixed feed of donations and donation reposts, sorted by date (newest first)
        const mixedFeed: any[] = [];
        
        // Original donations
        transformedDonations.forEach(donation => {
          mixedFeed.push({
            ...donation,
            post_id: donation.donation_id,
            post_content: donation.description,
            post_image: donation.images && donation.images.length > 0 ? donation.images[0].image_url : null,
            post_images: donation.images,
            item_type: 'post',
            sort_date: donation.created_at
          });
          
          // Donation reposts
          if (donation.reposts && donation.reposts.length > 0) {
            donation.reposts.forEach((repost: any) => {
              mixedFeed.push({
                donation_id: donation.donation_id,
                post_id: repost.repost_id,
                post_content: donation.description,
                post_image: donation.images && donation.images.length > 0 ? donation.images[0].image_url : null,
                post_images: donation.images,
                created_at: repost.repost_date,
                type: 'donation',
                item_type: 'repost',
                sort_date: repost.repost_date,
                feed_type: 'donation_repost',
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
                    donation_id: donation.donation_id,
                    description: donation.description,
                    post_content: donation.description, // Add post_content for compatibility with PostCard
                    images: donation.images,
                    post_images: donation.images, // Add post_images for compatibility with getImagesFromPost
                    post_image: donation.images && donation.images.length > 0 ? donation.images[0].image_url : null, // Add post_image for single image compatibility
                    created_at: donation.created_at,
                    user: donation.user,
                    likes: donation.likes || [],
                    likes_count: donation.likes_count || 0,
                    comments: donation.comments || [],
                    comments_count: donation.comments_count || 0
                  }
                }
              });
            });
          }
        });
        
        const sortedFeed = mixedFeed.sort((a: any, b: any) => {
          const dateA = a.sort_date || a.created_at || '';
          const dateB = b.sort_date || b.created_at || '';
          
          const dateAObj = new Date(dateA);
          const dateBObj = new Date(dateB);
          
          return dateBObj.getTime() - dateAObj.getTime();
        });
        
        setDonations(sortedFeed);
        
        // Update liked and reposted states
        const liked: { [key: number]: boolean } = {};
        const reposted: { [key: number]: boolean } = {};
        
        sortedFeed.forEach((item: any) => {
          if (item.item_type === 'repost') {
            // For donation reposts, likes have nested user structure
            liked[item.repostData?.repost_id] = item.repostData?.likes?.some((like: any) => 
              (like.user?.user_id === currentUserId) || (like.user_id === currentUserId)
            ) || false;
            reposted[item.repostData?.repost_id] = false;
          } else {
            const donation = response.donations.find((d: any) => d.donation_id === item.donation_id);
            if (donation) {
              liked[item.donation_id] = donation.likes?.some((like: any) => like.user.user_id === currentUserId) || false;
              reposted[item.donation_id] = donation.reposts?.some((r: any) => r.user.user_id === currentUserId) || false;
            }
          }
        });
        
        setLikedDonations(liked);
        setRepostedDonations(reposted);
        console.log('Initialized donation states:', { liked, reposted });
      } else {
        console.error('Failed to fetch donation requests:', response.message);
        setDonations([]);
      }
    } catch (error) {
      console.error('Error fetching donation requests:', error);
      setDonations([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Handle view original donation
  const handleViewOriginalDonation = async (originalPost: any) => {
    console.log('handleViewOriginalPost called with original post:', originalPost);
    setDonationLoading(true);
    try {
      // Check if this is a donation post
      const donationId = originalPost.donation_id || originalPost.post_id;
      
      if (!donationId) {
        console.error('No valid donation ID found:', originalPost);
        alert('Cannot load donation: Invalid donation ID');
        setDonationLoading(false);
        return;
      }

      // For donation posts, fetch full data including comments and likes
      const { api } = await import('../../services/api');
      const response = await api.get(`donations/${donationId}/`);
      console.log('Original donation API response:', response.data);
      if (response.data) {
        const donationData = response.data;
        // Build a transformed structure compatible with the donation modal
        const donationModalData = {
          donation_id: donationData.donation_id,
          post_id: donationData.donation_id,
          description: donationData.description,
          post_content: donationData.description,
          images: donationData.images || [],
          post_images: donationData.images || [],
          created_at: donationData.created_at,
          user: donationData.user,
          likes: donationData.likes || [],
          comments: donationData.comments || [],
          likes_count: donationData.likes_count || 0,
          comments_count: donationData.comments_count || 0,
          reposts_count: donationData.reposts_count || 0,
        };
        console.log('Setting donation modal data:', donationModalData);
        setOriginalDonationModalData(donationModalData);
        setShowOriginalDonationModal(true);
      }
    } catch (error) {
      console.error('Error fetching original donation:', error);
      alert('Failed to load original donation.');
    } finally {
      setDonationLoading(false);
    }
  };

  // Handle viewing a donation repost by repost ID (for notifications)
  const handleViewRepostById = async (repostId: string) => {
    console.log('🔍 Donation handleViewRepostById called with repostId:', repostId);
    setDonationLoading(true);
    try {
      const { api } = await import('../../services/api');
      console.log('🔍 Fetching repost with ID:', repostId);
      const response = await api.get(`reposts/${repostId}/detail/`);
      console.log('🔍 Repost API response:', response.data);
      if (response.data) {
        const repostData = response.data;
        const original = repostData.original;
        
        // Build a transformed structure compatible with the donation modal
        const transformedData = {
          donation_id: original.donation_id || original.post_id,
          post_id: original.donation_id || original.post_id,
          description: original.description || original.post_content,
          post_content: original.description || original.post_content,
          images: original.images || original.post_images || [],
          post_images: original.images || original.post_images || [],
          user: original.user,
          created_at: repostData.repost_date,
          likes: repostData.likes || [],
          comments: repostData.comments || [],
          likes_count: repostData.likes_count || 0,
          comments_count: repostData.comments_count || 0,
          reposts: [],
          repostData: {
            repost_id: repostData.repost_id,
            repost_date: repostData.repost_date,
            repost_caption: repostData.caption,
            user: repostData.user,
            original_post: original
          }
        } as any;
        
        setOriginalDonationModalData(transformedData);
        setShowOriginalDonationModal(true);
        console.log('✅ Donation repost modal opened for notification');
      }
    } catch (error: any) {
      console.error('❌ Error fetching donation repost by ID:', error);
      alert('Unable to load the repost. It may have been deleted.');
    } finally {
      setDonationLoading(false);
    }
  };

  // Handle viewing a donation post by ID (for notifications)
  const handleViewDonationPostById = async (donationId: string) => {
    console.log('🔍 handleViewDonationPostById called with donationId:', donationId);
    setDonationLoading(true);
    try {
      const { api } = await import('../../services/api');
      console.log('🔍 Fetching donation post with ID:', donationId);
      const response = await api.get(`donations/${donationId}/`);
      console.log('🔍 Donation post API response:', response.data);
      if (response.data) {
        // Transform the response to match the expected format
        const transformedData = {
          ...response.data,
          donation_id: response.data.donation_id,
          description: response.data.description || response.data.post_content,
          post_content: response.data.description || response.data.post_content,
          status: response.data.status,
          created_at: response.data.created_at,
          images: response.data.images || response.data.post_images || [],
          post_images: response.data.images || response.data.post_images || [],
          user: {
            ...response.data.user,
            profile_pic: response.data.user?.profile_pic ? 
              (String(response.data.user.profile_pic).startsWith('http') ? 
                response.data.user.profile_pic : 
                `http://127.0.0.1:8000${response.data.user.profile_pic}`) : 
              null
          },
          likes: response.data.likes || [],
          comments: response.data.comments || [],
          reposts: response.data.reposts || [],
          likes_count: response.data.likes_count || 0,
          comments_count: response.data.comments_count || 0,
          reposts_count: response.data.reposts_count || 0,
          liked_by_user: response.data.liked_by_user || false
        };
        
        setOriginalDonationModalData(transformedData);
        console.log('🔍 Set original donation modal data:', transformedData);
        
        // Update the liked state for the modal donation
        setLikedDonations(prev => ({
          ...prev,
          [transformedData.donation_id]: transformedData.liked_by_user || false
        }));
        
        setShowOriginalDonationModal(true);
        console.log('✅ Donation post modal opened for notification, showOriginalDonationModal:', true);
      } else {
        console.error('❌ No data in API response');
      }
    } catch (error: any) {
      console.error('❌ Error fetching donation post by ID:', error);
      console.error('❌ Error details:', error.response?.data || error.message);
      alert('Unable to load the donation post. It may have been deleted.');
    } finally {
      setDonationLoading(false);
    }
  };

  // Check for pending donation post/repost view from notification
  useEffect(() => {
    console.log('🔍 useEffect for pendingDonationPostView running...');
    // Prefer repost view first if present
    const pendingRepostId = localStorage.getItem('pendingRepostId');
    if (pendingRepostId) {
      console.log('🔍 Found pending donation repost ID:', pendingRepostId);
      localStorage.removeItem('pendingRepostId');
      setTimeout(() => {
        handleViewRepostById(pendingRepostId);
      }, 500);
      return;
    }
    const pendingDonationPostId = localStorage.getItem('pendingDonationPostView');
    console.log('🔍 Raw localStorage value:', pendingDonationPostId);
    if (pendingDonationPostId) {
      console.log('🔍 Found pending donation post view:', pendingDonationPostId);
      console.log('🔍 handleViewDonationPostById function exists?', typeof handleViewDonationPostById === 'function');
      localStorage.removeItem('pendingDonationPostView');
      // Wait a bit for the component to fully mount
      setTimeout(() => {
        console.log('🔍 Calling handleViewDonationPostById with ID:', pendingDonationPostId);
        if (typeof handleViewDonationPostById === 'function') {
          handleViewDonationPostById(pendingDonationPostId);
        } else {
          console.error('❌ handleViewDonationPostById is not a function!');
        }
      }, 500);
    } else {
      console.log('🔍 No pending donation post view found');
    }
  }, []); // Run only once on mount

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading donations...</div>
      </div>
    );
  }

  return (
    <Box sx={{ bgcolor: '#f5f5f5', minHeight: '100vh' }}>
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
              DONATIONS
              </Typography>
            </Box>
          </Card>
        </Box>  

        {/* Three Column Layout */}
      <Box sx={{ display: 'flex', gap: 3, px: 3, pb: 3 }}>
        {/* Left Sidebar - About */}
          <Box sx={{ flex: '0 0 300px' }}>
          <Card sx={{ borderRadius: 2, boxShadow: 3, p: 3, bgcolor: 'white' }}>
            <Typography variant="h6" component="div" fontWeight="bold" sx={{ mb: 2 }}>
              About Donations
            </Typography>
            <Typography variant="body2" sx={{ color: '#6c757d', mb: 2, lineHeight: 1.6 }}>
              Help fellow alumni by supporting their donation requests. Share your needs and connect with your batchmates for mutual support.
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ color: '#6c757d', mb: 1 }}>
                <strong>How it works:</strong>
              </Typography>
              <Typography variant="body2" sx={{ color: '#6c757d', mb: 1, fontSize: '0.875rem' }}>
                • Create donation requests for items you need
              </Typography>
              <Typography variant="body2" sx={{ color: '#6c757d', mb: 1, fontSize: '0.875rem' }}>
                • Browse requests from your batchmates
                </Typography>
              <Typography variant="body2" sx={{ color: '#6c757d', mb: 1, fontSize: '0.875rem' }}>
                • Like and comment to show support
                </Typography>
              <Typography variant="body2" sx={{ color: '#6c757d', fontSize: '0.875rem' }}>
                • Repost to help spread the word
                </Typography>
              </Box>
            <Box sx={{ mt: 3, p: 2, bgcolor: '#f8f9fa', borderRadius: 1 }}>
              <Typography variant="body2" sx={{ color: '#495057', fontStyle: 'italic' }}>
                "Together we can make a difference in each other's lives."
                </Typography>
              </Box>
            </Card>
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
                placeholder="Start a donation request"
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

          {/* Donations Feed */}
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
                  <Typography>Loading donation requests...</Typography>
                </Box>
            ) : donations.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="h6" sx={{ color: '#6c757d' }}>
                    No donation requests yet
                  </Typography>
                  <Typography sx={{ color: '#6c757d', mt: 1 }}>
                  Be the first to create a donation request!
                  </Typography>
                </Box>
              ) : (
              donations.map((item: any) => {
                // Handle both donations and reposts to match post/forum design
                const isOwn = Number(item.user?.user_id) === Number(currentUserId);
                const displayName = item.user?.name || `${item.user?.f_name || ''} ${item.user?.m_name || ''} ${item.user?.l_name || ''}`.trim() || 'Unknown User';
                const displayAvatar = getProfilePicUrl(item.user?.profile_pic);
                
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
                          donation_id: item.repostData.original_post.donation_id,
                          post_content: item.repostData.original_post.post_content,
                          post_images: item.repostData.original_post.post_images,
                          created_at: item.repostData.original_post.created_at,
                          user: item.repostData.original_post.user,
                          likes: item.repostData.original_post.likes || [],
                          likes_count: item.repostData.original_post.likes_count || 0,
                          comments: item.repostData.original_post.comments || [],
                          comments_count: item.repostData.original_post.comments_count || 0
                        } as PostItemLite : undefined
                      }}
                      currentUserId={currentUserId}
                      formatTime={formatTime}
                      context="donation"
                      onViewOriginalPost={handleViewOriginalDonation}
                      onRefresh={() => {
                        fetchDonationPosts(false);
                      }}
                    />
                  );
                }
                
                // Render as regular donation
                return (
                  <PostCard
                    key={item.donation_id}
                    post={item}
                    currentUserId={currentUserId}
                    isOwn={isOwn}
                    displayName={displayName}
                    displayAvatar={displayAvatar}
                    formatTime={formatTime}
                    onPostUpdate={() => {
                      // Immediate update without page refresh
                      fetchDonationPosts(false); // No loading indicator for updates
                    }}
                    likedPosts={likedDonations}
                    setLikedPosts={setLikedDonations}
                    repostedPosts={repostedDonations}
                    setRepostedPosts={setRepostedDonations}
                    showAllComments={showAllComments}
                    setShowAllComments={setShowAllComments}
                    showCommentInput={showCommentInput}
                    setShowCommentInput={setShowCommentInput}
                    commentInput={commentInput}
                    setCommentInput={setCommentInput}
                    editingComment={editingComment}
                    setEditingComment={setEditingComment}
                    editCommentContent={editCommentContent}
                    setEditCommentContent={setEditCommentContent}
                    showOptions={showOptions}
                    setShowOptions={setShowOptions}
                    editingPost={editingDonation}
                    setEditingPost={setEditingDonation}
                    editPostContent={editDonationContent}
                    setEditPostContent={setEditDonationContent}
                    isForum={false} // This is donation, not forum
                    isDonation={true} // This is a donation post
                    onViewOriginalPost={handleViewOriginalDonation}
                  />
                );
              })
              )}
            </Box>
          </Box>

        {/* Right Sidebar - Empty for now */}
          <Box sx={{ flex: '0 0 300px' }}>
          {/* Empty right sidebar to match forum layout */}
        </Box>
        </Box>
      </Box>

      {/* Post Create Modal */}
      {showPostCreate && (
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
          onClick={() => setShowPostCreate(false)}
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
              onClick={() => setShowPostCreate(false)}
                            style={{
                              position: 'absolute',
                top: 10,
                right: 10,
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
            <PostCreate 
              onPosted={() => {
                setShowPostCreate(false);
                fetchDonationPosts(false); // No loading indicator for new posts
              }}
              onCancel={() => setShowPostCreate(false)}
              postType="donation"
              user={{
                name: `${userObj.f_name || ''} ${userObj.m_name || ''} ${userObj.l_name || ''}`.trim(),
                profile_pic: userObj.profile_pic
              }}
            />
          </div>
        </div>
      )}

      {/* Original Donation Modal */}
      {showOriginalDonationModal && originalDonationModalData && (
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
          onClick={() => setShowOriginalDonationModal(false)}
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
              onClick={() => setShowOriginalDonationModal(false)}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
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
                post={{
                  ...originalDonationModalData,
                  post_id: originalDonationModalData.donation_id,
                  post_content: originalDonationModalData.description,
                  post_image: originalDonationModalData.images && originalDonationModalData.images.length > 0 ? originalDonationModalData.images[0].image_url : null,
                  post_images: originalDonationModalData.images,
                  created_at: originalDonationModalData.created_at,
                  likes: originalDonationModalData.likes || [],
                  comments: originalDonationModalData.comments || [],
                  likes_count: originalDonationModalData.likes_count || 0,
                  comments_count: originalDonationModalData.comments_count || 0,
                  reposts_count: originalDonationModalData.reposts_count || 0,
                  user: originalDonationModalData.user
                }}
                currentUserId={currentUserId}
                isOwn={currentUserId === originalDonationModalData.user?.user_id}
                displayName={originalDonationModalData.user?.name || `${originalDonationModalData.user?.f_name || ''} ${originalDonationModalData.user?.m_name || ''} ${originalDonationModalData.user?.l_name || ''}`.trim() || 'Unknown User'}
                displayAvatar={getProfilePicUrl(originalDonationModalData.user?.profile_pic)}
                formatTime={formatTime}
                onViewOriginalPost={handleViewOriginalDonation}
                onPostUpdate={async () => {
                  // Refresh the original donation data in modal
                  const donationId = originalDonationModalData.donation_id;
                  try {
                    const response = await getDonationRequests();
                    if (response.success) {
                      const updatedDonation = response.donations?.find((d: any) => d.donation_id === donationId);
                      if (updatedDonation) {
                        setOriginalDonationModalData(updatedDonation);
                      }
                    }
                  } catch (error) {
                    console.error('Error refreshing donation data:', error);
                  }
                  
                  // Also refresh the main donations list to keep everything in sync
                  fetchDonationPosts(false); // No loading indicator for modal updates
                }}
                isForum={false}
                isDonation={true} // This is a donation post in modal
                showOptions={showOptions}
                setShowOptions={setShowOptions}
                editingPost={editingDonation}
                setEditingPost={setEditingDonation}
                editPostContent={editDonationContent}
                setEditPostContent={setEditDonationContent}
                likedPosts={likedDonations}
                setLikedPosts={setLikedDonations}
                repostedPosts={repostedDonations}
                setRepostedPosts={setRepostedDonations}
                showAllComments={showAllComments}
                setShowAllComments={setShowAllComments}
                showCommentInput={showCommentInput}
                setShowCommentInput={setShowCommentInput}
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

export default DonationPage;