import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, Typography, Avatar, Button, TextField } from '@mui/material';
import AlumniTopBar from './AlumniTopBar';
import ctulogo from '../../images/ctulogo.png';
import { getDonationRequests, createDonationRequest } from '../../services/api';
import DonationCard from '../../components/DonationCard';
import './profile.css';
import './postcreate.css';

// Define getCurrentUserId locally since auth utility doesn't exist
function getCurrentUserId(user: any): number | null {
  if (!user) return null;
  if (typeof user.user_id === 'number') return user.user_id;
  if (typeof user.id === 'number') return user.id;
  return null;
}

interface DonationRequest {
  donation_id: number;
  user: {
    user_id: number;
    f_name: string;
    m_name: string;
    l_name: string;
    profile_pic?: string;
    name: string;
  };
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
  images: Array<{
    image_id: number;
    image_url: string;
    order: number;
  }>;
  likes_count?: number;
  comments_count?: number;
  reposts_count?: number;
  likes?: Array<{
    like_id: number;
    user: {
      user_id: number;
      f_name: string;
      m_name?: string;
      l_name: string;
      profile_pic?: string;
    };
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
    };
  }>;
  reposts?: Array<{
    repost_id: number;
    repost_date: string;
    repost_caption?: string;
    user: {
      user_id: number;
      f_name: string;
      m_name?: string;
      l_name: string;
      profile_pic?: string;
    };
    likes_count?: number;
    comments_count?: number;
    likes?: Array<{
      like_id: number;
      user: {
        user_id: number;
        f_name: string;
        m_name?: string;
        l_name: string;
        profile_pic?: string;
      };
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
      };
    }>;
  }>;
}

const DonationPage: React.FC = () => {
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [donationMessage, setDonationMessage] = useState('');
  const [donationImages, setDonationImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDonationCreate, setShowDonationCreate] = useState(false);
  const [donationRequests, setDonationRequests] = useState<DonationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedDonations, setLikedDonations] = useState<{ [key: number]: boolean }>({});
  const [commentInput, setCommentInput] = useState<{ [key: number]: string }>({});
  const [showCommentInput, setShowCommentInput] = useState<{ [key: number]: boolean }>({});
  const [showAllComments, setShowAllComments] = useState<{ [key: number]: boolean }>({});
  const [showOptions, setShowOptions] = useState<{ [key: number]: boolean }>({});

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

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const maxImages = 15;
      
      // Limit to 15 images
      const filesToProcess = Array.from(files).slice(0, maxImages - donationImages.length);
      
      // Process all files and collect promises
      const imagePromises = filesToProcess.map((file) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
          reader.readAsDataURL(file);
        });
      });
      
      // Wait for all images to be processed, then update state
      Promise.all(imagePromises).then((newImages) => {
        setDonationImages(prev => [...prev, ...newImages]);
      });
    }
  };

  const removeImage = (index: number) => {
    setDonationImages(prev => prev.filter((_, i) => i !== index));
  };

  // Fetch donation requests
  const fetchDonationRequests = async () => {
    try {
      setLoading(true);
      console.log('Fetching donation requests...');
      const response = await getDonationRequests();
      console.log('Donation requests response:', response);
      
      if (response.success) {
        console.log('Successfully fetched donations:', response.donations);
        setDonationRequests(response.donations || []);
      } else {
        console.error('Failed to fetch donation requests:', response.message);
        setDonationRequests([]);
      }
    } catch (error) {
      console.error('Error fetching donation requests:', error);
      setDonationRequests([]);
    } finally {
      setLoading(false);
    }
  };


  // Handle donation request submission
  const handleDonationSubmit = async () => {
    if (!donationMessage.trim()) {
      alert('Please provide a description of your need');
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('Submitting donation request:', {
        description: donationMessage,
        images: donationImages,
        currentUserId
      });
      
      const response = await createDonationRequest({
        description: donationMessage,
        images: donationImages
      });
      
      console.log('Donation request response:', response);
      
      if (response.success) {
        alert('Your donation request has been posted!');
        setDonationMessage('');
        setDonationImages([]);
        setShowDonationCreate(false);
        // Refresh the donation requests list
        fetchDonationRequests();
      } else {
        alert(response.message || 'Failed to submit donation request. Please try again.');
      }
    } catch (error: any) {
      console.error('Error submitting donation request:', error);
      console.error('Error details:', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status
      });
      alert('Failed to submit donation request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fetch donation requests on component mount
  useEffect(() => {
    fetchDonationRequests();
  }, []);

  // Debug authentication
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    console.log('Current user:', userObj);
    console.log('Access token:', token ? 'Present' : 'Missing');
    console.log('Current user ID:', currentUserId);
  }, []);

  return (
    <Box sx={{ bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Alumni TopBar */}
      <AlumniTopBar 
        showProfile={showProfile}
        setShowProfile={setShowProfile}
        handleLogout={handleLogout}
      />

      {/* Main Content */}
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: 2 }}>
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
                DONATION
              </Typography>
              <Typography variant="body2" sx={{ color: '#6c757d' }}>
                {getBatchYear()}
              </Typography>
            </Box>
          </Card>
        </Box>  

        {/* Three Column Layout */}
        <Box sx={{ display: 'flex', gap: 3 }}>
          {/* Left Sidebar - Donation Info */}
          <Box sx={{ flex: '0 0 300px' }}>
            <Card sx={{ p: 2, borderRadius: 2, boxShadow: 3, mb: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Donation Requests
              </Typography>
              <Typography variant="body2" sx={{ color: '#6c757d', mb: 2 }}>
                Support your fellow alumni by helping with their needs - medical expenses, therapy, emergencies, and other important causes.
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2" fontWeight="bold">
                  Common donation requests:
                </Typography>
                <Typography variant="caption" sx={{ color: '#6c757d' }}>
                  • Medical expenses
                </Typography>
                <Typography variant="caption" sx={{ color: '#6c757d' }}>
                  • Therapy sessions
                </Typography>
                <Typography variant="caption" sx={{ color: '#6c757d' }}>
                  • Emergency funds
                </Typography>
                <Typography variant="caption" sx={{ color: '#6c757d' }}>
                  • Educational support
                </Typography>
              </Box>
            </Card>

            <Card sx={{ p: 2, borderRadius: 2, boxShadow: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Recent Requests
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="caption" sx={{ color: '#6c757d' }}>
                  No recent donation requests to display.
                </Typography>
              </Box>
            </Card>
          </Box>

          {/* Center Content */}
          <Box sx={{ flex: '1 1 600px' }}>
            {/* Start a donation request */}
            <Card sx={{ mb: 3, borderRadius: 2, boxShadow: 3, p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar 
                  src={userObj.profile?.profile_pic ? 
                    (String(userObj.profile?.profile_pic).startsWith('http') ? 
                      userObj.profile?.profile_pic : 
                      `http://127.0.0.1:8000${userObj.profile?.profile_pic}`) : 
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
                  placeholder="Request help from your fellow alumni..."
                  variant="outlined"
                  size="small"
                  onClick={() => setShowDonationCreate(true)}
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

            {/* Donation Requests Feed */}
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
              ) : donationRequests.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="h6" sx={{ color: '#6c757d' }}>
                    No donation requests yet
                  </Typography>
                  <Typography sx={{ color: '#6c757d', mt: 1 }}>
                    Be the first to request help from your fellow alumni!
                  </Typography>
                </Box>
              ) : (
                (() => {
                  // Create a mixed feed of donations and reposts, sorted by date (like forum posts)
                  const mixedFeed: any[] = [];
                  
                  // Add original donations to the feed
                  donationRequests.forEach(donation => {
                    // Add the original donation
                    mixedFeed.push({
                      ...donation,
                      item_type: 'donation',
                      sort_date: donation.created_at
                    });
                    
                    // Add donation reposts as separate feed items (like forum reposts)
                    if (donation.reposts && donation.reposts.length > 0) {
                      donation.reposts.forEach(repost => {
                        mixedFeed.push({
                          ...donation,
                          item_type: 'repost',
                          repostData: repost,
                          sort_date: repost.repost_date
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
                  
                  return sortedFeed.map((item: any) => (
                    <DonationCard 
                      key={item.item_type === 'repost' ? `repost-${item.donation_id}` : item.donation_id} 
                      donation={item}
                      currentUserId={currentUserId}
                      onDonationUpdate={() => {
                        // Refresh donation requests
                        fetchDonationRequests();
                      }}
                      onDonationEdit={(donationId: number, newDescription: string) => {
                        // Update local state immediately without page refresh
                        setDonationRequests(prev => 
                          prev.map(donation => 
                            donation.donation_id === donationId 
                              ? { ...donation, description: newDescription }
                              : donation
                          )
                        );
                      }}
                      likedDonations={likedDonations}
                      setLikedDonations={setLikedDonations}
                      commentInput={commentInput}
                      setCommentInput={setCommentInput}
                      showCommentInput={showCommentInput}
                      setShowCommentInput={setShowCommentInput}
                      showAllComments={showAllComments}
                      setShowAllComments={setShowAllComments}
                      showOptions={showOptions}
                      setShowOptions={setShowOptions}
                      isRepost={item.item_type === 'repost'}
                      repostData={item.repostData}
                    />
                  ));
                })()
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
                Connect with your fellow alumni for mutual support. Share your needs and help others in their time of need - whether it's medical expenses, therapy, emergencies, or other important causes.
              </Typography>
            </Card>
          </Box>
        </Box>
      </Box>

      {/* Donation Create Modal */}
      {showDonationCreate && (
        <div
          className="post-create-overlay"
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.25)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={() => setShowDonationCreate(false)}
        >
          <div
            className="post-create-modal"
            style={{
              background: '#fff',
              borderRadius: 10,
              boxShadow: '0 2px 16px rgba(0,0,0,0.15)',
              maxWidth: 500,
              width: '100%',
              padding: 24,
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="post-create-header">
              <h2>💰 Request Help</h2>
              <button className="close-button" onClick={() => setShowDonationCreate(false)}>×</button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleDonationSubmit(); }}>
              <div className="post-create-user">
                <img 
                  src={userObj.profile?.profile_pic ? 
                    (String(userObj.profile?.profile_pic).startsWith('http') ? 
                      userObj.profile?.profile_pic : 
                      `http://127.0.0.1:8000${userObj.profile?.profile_pic}`) : 
                    ctulogo} 
                  alt="Profile" 
                  className="user-avatar"
                />
                <div>
                  <div className="user-name">{userObj.name || `${userObj.f_name || ''} ${userObj.l_name || ''}`.trim() || 'User'}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>is requesting help</div>
                </div>
              </div>

              <div className="post-create-content">
                {/* Tell us about your need */}
                <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#1f2937', alignSelf: 'flex-start', width: '100%' }}>
                    Tell us about your need:
                  </div>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    placeholder="Describe your situation and how donations would help (e.g., therapy sessions, medical expenses, emergency fund, etc.)..."
                    value={donationMessage}
                    onChange={(e) => {
                      setDonationMessage(e.target.value);
                      // Auto-resize textarea
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                    }}
                    variant="outlined"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '8px',
                        fontSize: 14
                      }
                    }}
                    required
                  />
                </div>

                {/* Images Preview */}
                {donationImages.length > 0 && (
                  <div className="images-preview" style={{ marginBottom: 16 }}>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', 
                      gap: 8,
                      marginBottom: 8
                    }}>
                      {donationImages.map((image, index) => (
                        <div key={index} style={{ position: 'relative' }}>
                          <img 
                            src={image} 
                            alt={`Preview ${index + 1}`} 
                            style={{ 
                              width: '100%', 
                              height: 100, 
                              objectFit: 'cover', 
                              borderRadius: 8,
                              border: '1px solid #e0e0e0'
                            }} 
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            style={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              background: 'rgba(0,0,0,0.7)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '50%',
                              width: 24,
                              height: 24,
                              cursor: 'pointer',
                              fontSize: 12,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Remove image"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      {donationImages.length} of 15 images selected
                    </div>
                  </div>
                )}

                {/* Upload Images */}
                <div className="post-actions">
                  <label className="upload-button">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                      disabled={donationImages.length >= 15}
                    />
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M23 19C23 19.5304 22.7893 20.0391 22.4142 20.4142C22.0391 20.7893 21.5304 21 21 21H3C2.46957 21 1.96086 20.7893 1.58579 20.4142C1.21071 20.0391 1 19.5304 1 19V8C1 7.46957 1.21071 6.96086 1.58579 6.58579C1.96086 6.21071 2.46957 6 3 6H7L9 4H15L17 6H21C21.5304 6 22.0391 6.21071 22.4142 6.58579C22.7893 6.96086 23 7.46957 23 8V19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                    {donationImages.length >= 15 ? 'Max Photos (15)' : 'Add Photos'}
                  </label>
                </div>

                <div className="post-buttons">
                  <button 
                    type="button" 
                    className="cancel-button"
                    onClick={() => setShowDonationCreate(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="post-button"
                    disabled={isSubmitting || !donationMessage.trim()}
                    style={{
                      background: '#e25a2c'
                    }}
                  >
                    {isSubmitting ? 'Posting Request...' : '💰 Request Help'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </Box>
  );
};

export default DonationPage;
