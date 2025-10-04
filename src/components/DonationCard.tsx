import React, { useState, useEffect, useRef } from 'react';
import ctulogo from '../images/ctulogo.png';
import { api, likeDonation, unlikeDonation, commentOnDonation, repostDonation, deleteDonationRequest, updateDonationRequest } from '../services/api';
import RepostModal from './RepostModal';

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
  likes?: Array<{
    user_id: number;
    f_name: string;
    m_name?: string;
    l_name: string;
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
    likes?: Array<{
      user_id: number;
      f_name: string;
      l_name: string;
      profile_pic?: string;
      initials?: string;
    }>;
    comments?: Array<{
      comment_id: number;
      comment_content: string;
      date_created: string;
      user: {
        user_id: number;
        f_name: string;
        l_name: string;
        profile_pic?: string;
      };
    }>;
    likes_count?: number;
    comments_count?: number;
    user: {
      user_id: number;
      f_name: string;
      m_name?: string;
      l_name: string;
      profile_pic?: string;
    };
  }>;
  reposts_count?: number;
  liked_by_user?: boolean;
}

interface DonationCardProps {
  donation: DonationRequest;
  currentUserId: number | null;
  onDonationUpdate?: () => void;
  onDonationEdit?: (donationId: number, newDescription: string) => void;
  likedDonations?: { [key: number]: boolean };
  setLikedDonations?: (fn: (prev: { [key: number]: boolean }) => { [key: number]: boolean }) => void;
  commentInput?: { [key: number]: string };
  setCommentInput?: (fn: (prev: { [key: number]: string }) => { [key: number]: string }) => void;
  showCommentInput?: { [key: number]: boolean };
  setShowCommentInput?: (fn: (prev: { [key: number]: boolean }) => { [key: number]: boolean }) => void;
  showAllComments?: { [key: number]: boolean };
  setShowAllComments?: (fn: (prev: { [key: number]: boolean }) => { [key: number]: boolean }) => void;
  showOptions?: { [key: number]: boolean };
  setShowOptions?: (fn: (prev: { [key: number]: boolean }) => { [key: number]: boolean }) => void;
  isRepost?: boolean;
  repostData?: any;
}

const DonationCard: React.FC<DonationCardProps> = ({ 
  donation, 
  currentUserId,
  onDonationUpdate,
  onDonationEdit,
  likedDonations = {},
  isRepost = false,
  repostData = null,
  setLikedDonations,
  commentInput = {},
  setCommentInput,
  showCommentInput = {},
  setShowCommentInput,
  showAllComments = {},
  setShowAllComments,
  showOptions = {},
  setShowOptions
}) => {
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [editingDonation, setEditingDonation] = useState(false);
  const [editDonationContent, setEditDonationContent] = useState(donation.description);
  const optionsMenuRef = useRef<HTMLDivElement>(null);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const isOwn = currentUserId && donation.user.user_id && Number(currentUserId) === Number(donation.user.user_id);
  
  // Determine if this is a repost and get the appropriate data
  const isRepostPost = isRepost && repostData;
  const displayUser = isRepostPost ? repostData.user : donation.user;
  
  // Render name: {f_name} {m_name} {l_name} if m_name exists, else {f_name} {l_name}
  const renderName = (obj: { f_name: string; m_name?: string; l_name: string }) =>
    `${obj.f_name} ${obj.m_name || ''} ${obj.l_name}`.trim();

  const repostDisplayName = isRepostPost
    ? renderName({ f_name: repostData.user.f_name, m_name: repostData.user.m_name, l_name: repostData.user.l_name })
    : donation.user.name;
  const repostDisplayAvatar = isRepostPost 
    ? (repostData.user.profile_pic ? (String(repostData.user.profile_pic).startsWith('http') ? repostData.user.profile_pic : `http://127.0.0.1:8000${repostData.user.profile_pic}`) : ctulogo)
    : (donation.user.profile_pic ? (String(donation.user.profile_pic).startsWith('http') ? donation.user.profile_pic : `http://127.0.0.1:8000${donation.user.profile_pic}`) : ctulogo);

  // Helper function to format time
  const formatTime = (iso?: string | null): string => {
    if (!iso) return 'Unknown time';
    try {
      const date = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m`;
      if (diffHours < 24) return `${diffHours}h`;
      if (diffDays < 7) return `${diffDays}d`;
      
      return date.toLocaleDateString();
    } catch {
      return 'Unknown time';
    }
  };

  // Helper function to get proper singular/plural form
  const getPluralForm = (count: number, singular: string, plural: string) => {
    return count === 1 ? `${count} ${singular}` : `${count} ${plural}`;
  };

  // Handle clicking outside the options menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target as Node)) {
        if (showOptions[donation.donation_id] && setShowOptions) {
          setShowOptions(prev => ({ ...prev, [donation.donation_id]: false }));
        }
      }
    };

    if (showOptions[donation.donation_id]) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showOptions, donation.donation_id, setShowOptions]);

  // Handle like/unlike
  const handleLike = async () => {
    if (!setLikedDonations) return;
    try {
      if (isRepostPost) {
        // Use repost like API
        await api.post(`reposts/${repostData.repost_id}/like/`);
      } else {
        // Use donation like API
        await likeDonation(donation.donation_id);
      }
      const itemId = isRepostPost ? repostData.repost_id : donation.donation_id;
      setLikedDonations(prev => ({ ...prev, [itemId]: true }));
      onDonationUpdate?.();
    } catch (error) {
      console.error('Error liking donation:', error);
    }
  };

  const handleUnlike = async () => {
    if (!setLikedDonations) return;
    try {
      if (isRepostPost) {
        // Use repost unlike API
        await api.delete(`reposts/${repostData.repost_id}/like/`);
      } else {
        // Use donation unlike API
        await unlikeDonation(donation.donation_id);
      }
      const itemId = isRepostPost ? repostData.repost_id : donation.donation_id;
      setLikedDonations(prev => ({ ...prev, [itemId]: false }));
      onDonationUpdate?.();
    } catch (error) {
      console.error('Error unliking donation:', error);
    }
  };

  // Handle comment
  const handleCommentSubmit = async () => {
    const itemId = isRepostPost ? repostData.repost_id : donation.donation_id;
    console.log('Comment submit clicked - itemId:', itemId, 'commentInput:', commentInput[itemId], 'isRepostPost:', isRepostPost);
    
    if (!commentInput[itemId] || !setCommentInput) {
      console.log('Comment submit blocked - no comment input or setCommentInput function');
      return;
    }
    
    try {
      if (isRepostPost) {
        console.log('Submitting repost comment:', repostData.repost_id, commentInput[itemId]);
        // Use repost comment API
        await api.post(`reposts/${repostData.repost_id}/comments/`, {
          comment_content: commentInput[itemId]
        });
      } else {
        console.log('Submitting donation comment:', donation.donation_id, commentInput[itemId]);
        // Use donation comment API
        await commentOnDonation(donation.donation_id, commentInput[itemId]);
      }
      setCommentInput(prev => ({ ...prev, [itemId]: '' }));
      // Close the comment input field
      if (setShowCommentInput) {
        setShowCommentInput(prev => ({ ...prev, [itemId]: false }));
      }
      // Automatically show comments after adding a new comment
      if (setShowAllComments) {
        setShowAllComments(prev => ({ ...prev, [itemId]: true }));
      }
      console.log('Comment submitted successfully, calling onDonationUpdate');
      onDonationUpdate?.();
    } catch (error: any) {
      console.error('Error submitting comment:', error);
      console.error('Error details:', error.response?.data);
    }
  };

  // Handle repost
  const handleRepost = () => {
    console.log('Repost button clicked - donation_id:', donation.donation_id);
    setShowRepostModal(true);
  };

  const handleRepostSubmit = async (caption: string) => {
    console.log('Repost submit - donation_id:', donation.donation_id, 'caption:', caption);
    try {
      await repostDonation(donation.donation_id, caption);
      console.log('Repost successful, calling onDonationUpdate');
      setShowRepostModal(false);
      onDonationUpdate?.();
    } catch (error: any) {
      console.error('Error reposting donation:', error);
      console.error('Error details:', error.response?.data);
    }
  };

  // Handle edit/delete
  const handleEditDonation = () => {
    console.log('Edit clicked - isOwn:', isOwn, 'currentUserId:', currentUserId, 'donation.user.user_id:', donation.user.user_id);
    if (!isOwn) {
      alert('You can only edit your own donation requests');
      return;
    }
    setEditDonationContent(donation.description);
    setEditingDonation(true);
    setShowOptions?.(prev => ({ ...prev, [donation.donation_id]: false }));
  };

  const handleDeleteDonation = async () => {
    if (!isOwn) {
      alert('You can only delete your own donation requests');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this donation request?')) {
      try {
        await deleteDonationRequest(donation.donation_id);
        onDonationUpdate?.();
      } catch (error) {
        console.error('Error deleting donation:', error);
        alert('Failed to delete donation request');
      }
    }
    setShowOptions?.(prev => ({ ...prev, [donation.donation_id]: false }));
  };

  const handleSaveEditDonation = async () => {
    console.log('Save edit clicked - editDonationContent:', editDonationContent, 'isOwn:', isOwn);
    if (!editDonationContent.trim()) return;
    if (!isOwn) {
      alert('You can only edit your own donation requests');
      return;
    }
    
    try {
      console.log('Calling updateDonationRequest with:', donation.donation_id, { description: editDonationContent });
      await updateDonationRequest(donation.donation_id, { description: editDonationContent });
      setEditingDonation(false);
      
      // Update local state immediately instead of refreshing the page
      if (onDonationEdit) {
        console.log('Calling onDonationEdit');
        onDonationEdit(donation.donation_id, editDonationContent);
      } else {
        console.log('Calling onDonationUpdate');
        // Fallback to full refresh if local update callback not provided
        onDonationUpdate?.();
      }
    } catch (error) {
      console.error('Error editing donation:', error);
      alert('Failed to update donation request');
    }
  };

  const handleCancelEditDonation = () => {
    setEditingDonation(false);
    setEditDonationContent(donation.description);
  };

  // Handle image click
  const handleImageClick = (index: number) => {
    setCurrentPhotoIndex(index);
    setShowPhotoGallery(true);
  };

  const handlePreviousPhoto = () => {
    setCurrentPhotoIndex(prev => 
      prev > 0 ? prev - 1 : (donation.images?.length || 1) - 1
    );
  };

  const handleNextPhoto = () => {
    setCurrentPhotoIndex(prev => 
      prev < (donation.images?.length || 1) - 1 ? prev + 1 : 0
    );
  };

  return (
    <>
      {isRepostPost ? (
        // Repost structure - matching forum repost styling exactly
        <>
          {/* Main Repost Card */}
          <div className="profile-repost-card" style={{
            border: '1px solid #e1e5e9',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            marginBottom: '16px',
            backgroundColor: '#fff'
          }}>
            {/* Reposter's header - exactly like forum */}
            <div className="profile-repost-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div className="profile-repost-header-left" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img
                  src={repostDisplayAvatar}
                  alt="Profile"
                  className="profile-repost-profile-image"
                  style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }}
                  onClick={() => {
                    if (displayUser?.user_id) {
                      const currentPath = window.location.pathname;
                      if (currentPath.startsWith('/peso')) {
                        window.location.href = `/peso/profile/${displayUser.user_id}`;
                      } else if (currentPath.startsWith('/ccict')) {
                        window.location.href = `/ccict/profile/${displayUser.user_id}`;
                      } else {
                        window.location.href = `/alumni/profile/${displayUser.user_id}`;
                      }
                    }
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = ctulogo;
                  }}
                />
                <div>
                  <div style={{ fontWeight: '600', fontSize: '16px', color: '#333' }}>
                    {repostDisplayName}
                  </div>
                  <div style={{ fontSize: '14px', color: '#6c757d' }}>
                    {formatTime(isRepostPost ? repostData.repost_date : donation.created_at)}
                  </div>
                </div>
              </div>
              
              {/* Three dots menu for reposter */}
              <button
                onClick={() => setShowOptions?.(prev => ({ ...prev, [repostData.repost_id]: !prev[repostData.repost_id] }))}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px',
                  color: '#666',
                  padding: '4px'
                }}
              >
                ⋯
              </button>
            </div>
            
            {/* Repost caption */}
            {repostData.repost_caption && (
              <div className="profile-repost-caption" style={{ 
                fontSize: '16px', 
                color: '#333', 
                marginBottom: '12px',
                lineHeight: '1.5',
                padding: '12px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #e9ecef'
              }}>
                {repostData.repost_caption}
              </div>
            )}
            
            {/* Original donation content - matching forum repost inner card */}
            <div style={{ 
              border: '1px solid #e0e0e0', 
              borderRadius: '8px', 
              padding: '12px', 
              backgroundColor: '#f8f9fa',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease',
              marginTop: '8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f1f3f4';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f8f9fa';
            }}>
              {/* Original donation user info */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                <img
                  src={donation.user.profile_pic ? (String(donation.user.profile_pic).startsWith('http') ? donation.user.profile_pic : `http://127.0.0.1:8000${donation.user.profile_pic}`) : ctulogo}
                  alt="Profile"
                  style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', marginRight: '8px' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = ctulogo;
                  }}
                />
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: '#333' }}>
                    {donation.user.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6c757d' }}>
                    {formatTime(donation.created_at)}
                  </div>
                </div>
              </div>
              
              {/* Original donation content */}
              <div style={{ fontSize: '14px', color: '#555', lineHeight: '1.5', marginBottom: '8px' }}>
                {donation.description}
              </div>
              
              {/* Original donation images */}
              {donation.images && donation.images.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  {donation.images.length === 1 ? (
                    <img
                      src={donation.images[0].image_url}
                      alt="Donation"
                      style={{ 
                        width: '100%', 
                        maxWidth: '300px', 
                        height: 'auto', 
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        setShowPhotoGallery(true);
                        setCurrentPhotoIndex(0);
                      }}
                    />
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: donation.images.length >= 3 ? '2fr 1fr' : '1fr 1fr', gap: '4px', maxWidth: '300px' }}>
                      <img
                        src={donation.images[0].image_url}
                        alt="Donation"
                        style={{ 
                          width: '100%', 
                          height: donation.images.length >= 3 ? '120px' : '150px', 
                          objectFit: 'cover', 
                          borderRadius: '6px',
                          cursor: 'pointer',
                          gridRow: donation.images.length >= 3 ? '1 / 3' : '1'
                        }}
                        onClick={() => {
                          setShowPhotoGallery(true);
                          setCurrentPhotoIndex(0);
                        }}
                      />
                      {donation.images.slice(1, 3).map((img: any, index: number) => (
                        <img
                          key={img.image_id}
                          src={img.image_url}
                          alt="Donation"
                          style={{ 
                            width: '100%', 
                            height: donation.images.length >= 3 ? '58px' : '150px', 
                            objectFit: 'cover', 
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            setShowPhotoGallery(true);
                            setCurrentPhotoIndex(index + 1);
                          }}
                        />
                      ))}
                      {donation.images.length > 3 && (
                        <div style={{
                          position: 'absolute',
                          bottom: '4px',
                          right: '4px',
                          backgroundColor: 'rgba(0,0,0,0.7)',
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px'
                        }}>
                          +{donation.images.length - 3} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {/* Original donation interaction summary - like forum repost */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginTop: '8px',
                fontSize: '12px',
                color: '#6c757d'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {(repostData.likes_count || 0) > 0 && (
                    <>
                      <span style={{ fontSize: '12px' }}>👍</span>
                      <span>{(repostData.likes_count || 0) === 1 ? '1 like' : `${repostData.likes_count || 0} likes`}</span>
                    </>
                  )}
                </div>
                <div>
                  {(repostData.comments_count || 0) > 0 && (
                    <span
                      onClick={() => setShowAllComments?.(prev => ({ ...prev, [repostData.repost_id]: !prev[repostData.repost_id] }))}
                      style={{ 
                        cursor: 'pointer',
                        padding: '2px 4px',
                        borderRadius: '4px',
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f0f0f0';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {(repostData.comments_count || 0) === 1 ? '1 comment' : `${repostData.comments_count || 0} comments`}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Action buttons for repost - matching forum repost styling */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              borderTop: '1px solid #e9ecef',
              paddingTop: '8px',
              marginTop: '12px'
            }}>
              <button
                onClick={() => {
                  const itemId = isRepostPost ? repostData.repost_id : donation.donation_id;
                  const likesCount = isRepostPost ? (repostData.likes_count || 0) : (donation.likes_count || 0);
                  if (likesCount > 0 && !likedDonations[itemId]) {
                    setShowLikesModal(true);
                  } else {
                    likedDonations[itemId] ? handleUnlike() : handleLike();
                  }
                }}
                style={{
                  color: likedDonations[isRepostPost ? repostData.repost_id : donation.donation_id] ? '#ef4444' : '#6c757d',
                  fontWeight: likedDonations[isRepostPost ? repostData.repost_id : donation.donation_id] ? '600' : '400',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span style={{ 
                  fontSize: '16px', 
                  color: likedDonations[isRepostPost ? repostData.repost_id : donation.donation_id] ? '#ef4444' : '#6c757d'
                }}>
                  👍
                </span>
                {(isRepostPost ? (repostData.likes_count || 0) : (donation.likes_count || 0)) === 1 ? '1 like' : ((isRepostPost ? (repostData.likes_count || 0) : (donation.likes_count || 0)) > 1) ? `${isRepostPost ? (repostData.likes_count || 0) : (donation.likes_count || 0)} likes` : 'Like'}
              </button>
              
              <button
                onClick={() => setShowCommentInput?.(prev => ({ ...prev, [isRepostPost ? repostData.repost_id : donation.donation_id]: !prev[isRepostPost ? repostData.repost_id : donation.donation_id] }))}
                style={{
                  color: '#6c757d',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span style={{ fontSize: '16px' }}>💬</span>
                {(isRepostPost ? (repostData.comments_count || 0) : (donation.comments_count || 0)) === 1 ? '1 comment' : ((isRepostPost ? (repostData.comments_count || 0) : (donation.comments_count || 0)) > 1) ? `${isRepostPost ? (repostData.comments_count || 0) : (donation.comments_count || 0)} comments` : 'Comment'}
              </button>
              
              <button
                onClick={handleRepost}
                style={{
                  color: '#6c757d',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span style={{ fontSize: '16px' }}>🔄</span>
                Repost
              </button>
            </div>
            
            {/* Comment input for repost */}
            {showCommentInput[isRepostPost ? repostData.repost_id : donation.donation_id] && (
              <div style={{ 
                borderTop: '1px solid #f0f0f0', 
                paddingTop: '12px', 
                marginTop: '8px' 
              }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <div style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%', 
                    backgroundColor: '#007bff', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: 'white', 
                    fontSize: '12px', 
                    fontWeight: 'bold' 
                  }}>
                    {currentUserId ? String(currentUserId).slice(-2) : '?'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <textarea
                      value={commentInput[isRepostPost ? repostData.repost_id : donation.donation_id] || ''}
                      onChange={(e) => setCommentInput?.(prev => ({ ...prev, [isRepostPost ? repostData.repost_id : donation.donation_id]: e.target.value }))}
                      placeholder="Write a comment..."
                      style={{
                        width: '100%',
                        minHeight: '60px',
                        padding: '8px 12px',
                        border: '1px solid #e9ecef',
                        borderRadius: '20px',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        resize: 'none',
                        outline: 'none'
                      }}
                    />
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'flex-end', 
                      gap: '8px', 
                      marginTop: '8px' 
                    }}>
                      <button
                        onClick={() => setShowCommentInput?.(prev => ({ ...prev, [isRepostPost ? repostData.repost_id : donation.donation_id]: false }))}
                        style={{
                          background: 'none',
                          border: '1px solid #e9ecef',
                          color: '#6c757d',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCommentSubmit}
                        disabled={!commentInput[isRepostPost ? repostData.repost_id : donation.donation_id]?.trim()}
                        style={{
                          background: commentInput[isRepostPost ? repostData.repost_id : donation.donation_id]?.trim() ? '#007bff' : '#e9ecef',
                          color: commentInput[isRepostPost ? repostData.repost_id : donation.donation_id]?.trim() ? 'white' : '#6c757d',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          cursor: commentInput[isRepostPost ? repostData.repost_id : donation.donation_id]?.trim() ? 'pointer' : 'not-allowed',
                          fontSize: '14px'
                        }}
                      >
                        Submit
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Comments display for repost */}
            {showAllComments[isRepostPost ? repostData.repost_id : donation.donation_id] && ((isRepostPost ? repostData.comments : donation.comments) || []).length > 0 && (
              <div style={{ 
                borderTop: '1px solid #f0f0f0', 
                paddingTop: '12px', 
                marginTop: '8px' 
              }}>
                {(isRepostPost ? repostData.comments : donation.comments || []).map((comment: any) => (
                  <div key={comment.comment_id} style={{ 
                    display: 'flex', 
                    gap: '8px', 
                    marginBottom: '12px',
                    padding: '8px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '8px'
                  }}>
                    <img
                      src={comment.user.profile_pic ? (String(comment.user.profile_pic).startsWith('http') ? comment.user.profile_pic : `http://127.0.0.1:8000${comment.user.profile_pic}`) : ctulogo}
                      alt="Profile"
                      style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = ctulogo;
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '12px', color: '#333' }}>
                        {comment.user.f_name} {comment.user.m_name || ''} {comment.user.l_name}
                      </div>
                      <div style={{ fontSize: '14px', color: '#555', marginTop: '2px' }}>
                        {comment.comment_content}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '4px' }}>
                        {formatTime(comment.date_created)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        // Original donation structure - matching forum UI exactly
        <div style={{
          background: 'white',
          border: '1px solid #e1e8ed',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '16px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          {/* User info - matching forum header */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', position: 'relative' }}>
            <img
              src={repostDisplayAvatar}
              alt="Profile"
              style={{ 
                width: '40px', 
                height: '40px', 
                borderRadius: '50%', 
                objectFit: 'cover', 
                cursor: 'pointer',
                marginRight: '12px'
              }}
              onClick={() => {
                if (donation.user?.user_id) {
                  const currentPath = window.location.pathname;
                  if (currentPath.startsWith('/peso')) {
                    window.location.href = `/peso/profile/${donation.user.user_id}`;
                  } else if (currentPath.startsWith('/ccict')) {
                    window.location.href = `/ccict/profile/${donation.user.user_id}`;
                  } else {
                    window.location.href = `/alumni/profile/${donation.user.user_id}`;
                  }
                }
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = ctulogo;
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ 
                fontWeight: '600', 
                fontSize: '16px', 
                color: '#333',
                cursor: 'pointer'
              }}
              onClick={() => {
                if (donation.user?.user_id) {
                  const currentPath = window.location.pathname;
                  if (currentPath.startsWith('/peso')) {
                    window.location.href = `/peso/profile/${donation.user.user_id}`;
                  } else if (currentPath.startsWith('/ccict')) {
                    window.location.href = `/ccict/profile/${donation.user.user_id}`;
                  } else {
                    window.location.href = `/alumni/profile/${donation.user.user_id}`;
                  }
                }
              }}>
                {repostDisplayName}
              </div>
              <div style={{ fontSize: '14px', color: '#6c757d' }}>
                {formatTime(isRepostPost ? repostData.repost_date : donation.created_at)}
              </div>
            </div>
        {isOwn && (
          <div ref={optionsMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => {
                console.log('Three dots clicked - donation_id:', donation.donation_id);
                setShowOptions?.(prev => ({ ...prev, [donation.donation_id]: !prev[donation.donation_id] }));
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '18px',
                color: '#666'
              }}
            >
              ⋯
            </button>
            {showOptions[donation.donation_id] && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  background: 'white',
                  border: '1px solid #e9ecef',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  zIndex: 1000,
                  minWidth: '120px',
                  padding: '4px 0'
                }}
              >
                <button
                  onClick={handleEditDonation}
                  style={{
                    width: '100%',
                    padding: '8px 16px',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#333'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8f9fa';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={handleDeleteDonation}
                  style={{
                    width: '100%',
                    padding: '8px 16px',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#dc3545'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8f9fa';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
            </div>

            {/* Description - matching forum content style */}
            {editingDonation ? (
              <div style={{ marginBottom: '12px' }}>
                <textarea
                  value={editDonationContent}
                  onChange={(e) => setEditDonationContent(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    padding: '12px',
                    border: '1px solid #e9ecef',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    marginBottom: '8px'
                  }}
                  placeholder="Describe your donation request..."
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleSaveEditDonation}
                    style={{
                      background: '#0066cc',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancelEditDonation}
                    style={{
                      background: '#6c757d',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ 
                fontSize: '16px', 
                color: '#333', 
                lineHeight: '1.5', 
                marginBottom: '12px',
                whiteSpace: 'pre-wrap'
              }}>
                {donation.description}
              </div>
            )}
            {/* Images - matching forum image display */}
            {donation.images && donation.images.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{
                  display: 'grid',
                  gap: '6px',
                  gridTemplateColumns: donation.images.length === 1 ? '1fr' : 
                                   donation.images.length === 2 ? '1fr 1fr' :
                                   donation.images.length === 3 ? '2fr 1fr' :
                                   'repeat(2, 1fr)',
                  gridTemplateRows: donation.images.length <= 2 ? '1fr' :
                                  donation.images.length === 3 ? '1fr 1fr' :
                                  'repeat(2, 1fr)',
                  height: donation.images.length <= 2 ? '200px' : '300px',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}>
                  {donation.images.slice(0, 4).map((image, index) => {
                    let gridArea = '';
                    if (donation.images.length === 3) {
                      gridArea = index === 0 ? '1 / 1 / 3 / 2' : `1 / 2 / 2 / 3`;
                      if (index === 2) gridArea = '2 / 2 / 3 / 3';
                    }
                    return (
                      <div key={index} style={{
                        position: 'relative',
                        gridArea: gridArea,
                        overflow: 'hidden'
                      }}>
                        <img
                          src={image.image_url.startsWith('/media/') 
                            ? `http://127.0.0.1:8000${image.image_url}`
                            : image.image_url
                          }
                          alt={`Donation ${index + 1}`}
                          onClick={() => handleImageClick(index)}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            cursor: 'pointer'
                          }}
                        />
                      </div>
                    );
                  })}
                  {donation.images.length > 4 && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'rgba(0, 0, 0, 0.75)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: 20,
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}>
                      +{donation.images.length - 4}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Interaction Summary - matching forum style */}
            {(donation.likes_count && donation.likes_count > 0) || (donation.comments_count && donation.comments_count > 0) || (donation.reposts_count && donation.reposts_count > 0) ? (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '8px 0',
                borderTop: '1px solid #f0f0f0',
                marginTop: '8px'
              }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {donation.likes_count && donation.likes_count > 0 ? (
                    <span
                      onClick={() => setShowLikesModal(true)}
                      style={{ 
                        cursor: 'pointer', 
                        fontSize: '14px',
                        color: '#6c757d',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8f9fa';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      👍 {donation.likes_count === 1 ? '1 like' : `${donation.likes_count} likes`}
                    </span>
                  ) : null}
                  
                  {donation.comments_count && donation.comments_count > 0 ? (
                    <span
                      onClick={() => setShowAllComments?.(prev => ({ ...prev, [isRepostPost ? repostData.repost_id : donation.donation_id]: !prev[isRepostPost ? repostData.repost_id : donation.donation_id] }))}
                      style={{ 
                        cursor: 'pointer', 
                        fontSize: '14px',
                        color: '#6c757d',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8f9fa';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {getPluralForm(donation.comments_count, 'comment', 'comments')}
                    </span>
                  ) : null}
                  
                  {donation.reposts_count && donation.reposts_count > 0 ? (
                    <span
                      style={{ 
                        fontSize: '14px',
                        color: '#6c757d',
                        padding: '4px 8px',
                        borderRadius: '4px'
                      }}
                    >
                      {getPluralForm(donation.reposts_count, 'repost', 'reposts')}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Action Buttons - matching forum style exactly */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              borderTop: '1px solid #e9ecef',
              paddingTop: '8px',
              marginTop: '8px'
            }}>
              <button
                onClick={() => {
                  const itemId = isRepostPost ? repostData.repost_id : donation.donation_id;
                  if (donation.likes_count && donation.likes_count > 0 && !likedDonations[itemId]) {
                    setShowLikesModal(true);
                  } else {
                    likedDonations[itemId] ? handleUnlike() : handleLike();
                  }
                }}
                style={{
                  color: likedDonations[isRepostPost ? repostData.repost_id : donation.donation_id] ? '#ef4444' : '#6c757d',
                  fontWeight: likedDonations[isRepostPost ? repostData.repost_id : donation.donation_id] ? '600' : '400',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span style={{ 
                  fontSize: '16px', 
                  color: likedDonations[donation.donation_id] ? '#ef4444' : '#6c757d',
                  fontWeight: likedDonations[donation.donation_id] ? '600' : '400'
                }}>
                  👍
                </span>
                {donation.likes_count === 1 ? '1 like' : (donation.likes_count && donation.likes_count > 1) ? `${donation.likes_count} likes` : 'Like'}
              </button>
              
              <button
                onClick={() => setShowCommentInput?.(prev => ({ ...prev, [isRepostPost ? repostData.repost_id : donation.donation_id]: !prev[isRepostPost ? repostData.repost_id : donation.donation_id] }))}
                style={{
                  color: '#6c757d',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span style={{ fontSize: '16px' }}>💬</span>
                Comment
              </button>
              
              <button
                onClick={handleRepost}
                style={{
                  color: '#6c757d',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span style={{ fontSize: '16px' }}>🔄</span>
                Repost
              </button>
            </div>

            {/* Comment Input - matching forum style */}
            {showCommentInput[isRepostPost ? repostData.repost_id : donation.donation_id] && (
              <div style={{ 
                borderTop: '1px solid #f0f0f0', 
                paddingTop: '12px', 
                marginTop: '8px' 
              }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <div style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%', 
                    background: '#e9ecef',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: '#6c757d'
                  }}>
                    {currentUserId ? String(currentUserId).slice(-2) : '?'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <textarea
                      value={commentInput[isRepostPost ? repostData.repost_id : donation.donation_id] || ''}
                      onChange={(e) => setCommentInput?.(prev => ({ ...prev, [isRepostPost ? repostData.repost_id : donation.donation_id]: e.target.value }))}
                      placeholder="Write a comment..."
                      style={{
                        width: '100%',
                        minHeight: '60px',
                        padding: '8px 12px',
                        border: '1px solid #e9ecef',
                        borderRadius: '20px',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        resize: 'none',
                        outline: 'none'
                      }}
                    />
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'flex-end', 
                      gap: '8px', 
                      marginTop: '8px' 
                    }}>
                      <button
                        onClick={() => setShowCommentInput?.(prev => ({ ...prev, [isRepostPost ? repostData.repost_id : donation.donation_id]: false }))}
                        style={{
                          background: 'none',
                          border: '1px solid #e9ecef',
                          color: '#6c757d',
                          padding: '6px 12px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          console.log('Comment button clicked');
                          handleCommentSubmit();
                        }}
                        disabled={!commentInput[isRepostPost ? repostData.repost_id : donation.donation_id]?.trim()}
                        style={{
                          background: commentInput[isRepostPost ? repostData.repost_id : donation.donation_id]?.trim() ? '#0066cc' : '#e9ecef',
                          border: 'none',
                          color: commentInput[isRepostPost ? repostData.repost_id : donation.donation_id]?.trim() ? 'white' : '#6c757d',
                          padding: '6px 12px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          cursor: commentInput[isRepostPost ? repostData.repost_id : donation.donation_id]?.trim() ? 'pointer' : 'not-allowed'
                        }}
                      >
                        Comment
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Comments Display - matching forum style */}
            {donation.comments && donation.comments.length > 0 && (
              <div style={{ 
                borderTop: '1px solid #f0f0f0', 
                paddingTop: '12px', 
                marginTop: '8px' 
              }}>
                {donation.comments.slice(0, showAllComments[isRepostPost ? repostData.repost_id : donation.donation_id] ? donation.comments.length : 2).map((comment) => (
                  <div key={comment.comment_id} style={{ 
                    display: 'flex', 
                    gap: '8px', 
                    marginBottom: '12px' 
                  }}>
                    <img
                      src={comment.user.profile_pic ? 
                        (String(comment.user.profile_pic).startsWith('http') ? 
                          comment.user.profile_pic : 
                          `http://127.0.0.1:8000${comment.user.profile_pic}`) : 
                        ctulogo} 
                      alt="Profile"
                      style={{ 
                        width: '32px', 
                        height: '32px', 
                        borderRadius: '50%', 
                        objectFit: 'cover'
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = ctulogo;
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        background: '#f8f9fa', 
                        padding: '8px 12px', 
                        borderRadius: '16px',
                        marginBottom: '4px'
                      }}>
                        <div style={{ 
                          fontSize: '12px', 
                          fontWeight: 'bold', 
                          marginBottom: '2px' 
                        }}>
                          {`${comment.user.f_name} ${comment.user.m_name || ''} ${comment.user.l_name}`.trim()}
                        </div>
                        <div style={{ fontSize: '14px' }}>
                          {comment.comment_content}
                        </div>
                      </div>
                      <div style={{ 
                        fontSize: '11px', 
                        color: '#6c757d', 
                        marginLeft: '12px' 
                      }}>
                        {formatTime(comment.date_created)}
                      </div>
                    </div>
                  </div>
                ))}
                {donation.comments.length > 2 && !showAllComments[isRepostPost ? repostData.repost_id : donation.donation_id] && (
                  <button
                    onClick={() => setShowAllComments?.(prev => ({ ...prev, [isRepostPost ? repostData.repost_id : donation.donation_id]: true }))}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0066cc',
                      fontSize: '12px',
                      cursor: 'pointer',
                      padding: '4px 0'
                    }}
                  >
                    View {donation.comments.length - 2} more comments
                  </button>
                )}
              </div>
            )}



      {/* Photo Gallery Modal */}
      {showPhotoGallery && donation.images && donation.images.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            cursor: 'pointer'
          }}
          onClick={() => setShowPhotoGallery(false)}
        >
          <button
            onClick={() => setShowPhotoGallery(false)}
            style={{
              position: 'absolute',
              top: 20,
              right: 20,
              background: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: 40,
              height: 40,
              fontSize: 24,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            }}
            title="Close (ESC)"
          >
            ×
          </button>

          {donation.images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreviousPhoto();
                }}
                style={{
                  position: 'absolute',
                  left: 20,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(0, 0, 0, 0.7)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: 50,
                  height: 50,
                  fontSize: 20,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10,
                }}
                title="Previous (←)"
              >
                ‹
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextPhoto();
                }}
                style={{
                  position: 'absolute',
                  right: 20,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(0, 0, 0, 0.7)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: 50,
                  height: 50,
                  fontSize: 20,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10,
                }}
                title="Next (→)"
              >
                ›
              </button>
            </>
          )}

          <div
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={
                donation.images[currentPhotoIndex].image_url.startsWith('/media/')
                  ? `http://127.0.0.1:8000${donation.images[currentPhotoIndex].image_url}`
                  : donation.images[currentPhotoIndex].image_url
              }
              alt={`${currentPhotoIndex + 1} of ${donation.images.length}`}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: 8,
              }}
            />
          </div>

          {donation.images.length > 1 && (
            <div
              style={{
                position: 'absolute',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                padding: '8px 16px',
                borderRadius: 20,
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              {currentPhotoIndex + 1} / {donation.images.length}
            </div>
          )}
        </div>
      )}

      {/* Repost Modal */}
      {showRepostModal && (
        <RepostModal
          isOpen={showRepostModal}
          onClose={() => setShowRepostModal(false)}
          onRepost={handleRepostSubmit}
          originalPost={{
            user: donation.user,
            post_content: donation.description,
            post_image: donation.images.length > 0 ? donation.images[0].image_url : null,
            created_at: donation.created_at
          }}
          currentUser={{
            name: `${donation.user.f_name} ${donation.user.m_name || ''} ${donation.user.l_name}`.trim(),
            profile_pic: donation.user.profile_pic
          }}
          formatTime={(iso) => {
            if (!iso) return 'Unknown time';
            const ms = Date.parse(iso);
            if (Number.isNaN(ms)) return 'Unknown time';
            const diffMs = Date.now() - ms;
            const min = Math.floor(diffMs / 60000);
            const hr = Math.floor(min / 60);
            const day = Math.floor(hr / 24);
            if (day >= 1) {
              return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            }
            if (hr >= 1) return hr === 1 ? '1 hour ago' : `${hr} hours ago`;
            if (min >= 1) return min === 1 ? '1 minute ago' : `${min} minutes ago`;
            return 'Just now';
          }}
        />
      )}
        </div>
      )}
      
      {/* Repost Modal */}
      {showRepostModal && (
        <RepostModal
          isOpen={showRepostModal}
          onClose={() => setShowRepostModal(false)}
          onRepost={handleRepostSubmit}
          originalPost={{
            user: donation.user,
            post_content: donation.description,
            post_image: donation.images.length > 0 ? donation.images[0].image_url : null,
            created_at: donation.created_at
          }}
          currentUser={{
            name: `${donation.user.f_name} ${donation.user.m_name || ''} ${donation.user.l_name}`.trim(),
            profile_pic: donation.user.profile_pic
          }}
          formatTime={(iso) => {
            if (!iso) return 'Unknown time';
            const ms = Date.parse(iso);
            if (Number.isNaN(ms)) return 'Unknown time';
            const diffMs = Date.now() - ms;
            const min = Math.floor(diffMs / 60000);
            const hr = Math.floor(min / 60);
            const day = Math.floor(hr / 24);
            if (day >= 1) {
              return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            }
            if (hr >= 1) return hr === 1 ? '1 hour ago' : `${hr} hours ago`;
            if (min >= 1) return min === 1 ? '1 minute ago' : `${min} minutes ago`;
            return 'Just now';
          }}
        />
      )}
    </>
  );
};

export default DonationCard;
