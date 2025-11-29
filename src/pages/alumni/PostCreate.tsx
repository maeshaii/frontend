import React, { useEffect, useRef, useState } from 'react';
import { createPost, createForumPost, createDonationRequest, getUserPoints } from '../../services/api';
import ctulogo from '../../images/ctulogo.png';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import './postcreate.css';

export interface PostCreateProps {
  onPosted: () => void | Promise<void>;
  onCancel?: () => void;
  postType?: string; // 'forum' for forum posts
  user?: {
    name: string;
    profile_pic?: string;
  };
}


const PostCreate: React.FC<PostCreateProps> = ({ onPosted, onCancel, postType, user }) => {
  const [postContent, setPostContent] = useState('');
  const [postImage, setPostImage] = useState<string>(''); // Keep for backward compatibility
  const [postImages, setPostImages] = useState<string[]>([]); // Multiple images
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  
  // Event-related state
  const [isEvent, setIsEvent] = useState(false);
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  
  // Check if user is Admin (only admins can create events)
  const raw = localStorage.getItem('user');
  const storedUser = raw ? JSON.parse(raw) : null;
  const isAdminUser = !!(storedUser && storedUser.account_type && storedUser.account_type.admin);

  // Close emoji picker on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showEmojiPicker && emojiPickerRef.current && !emojiPickerRef.current.contains(target)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener('mousedown', onDocClick);
    }
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showEmojiPicker]);



  const insertAtCursor = (text: string) => {
    const el = textareaRef.current;
    if (!el) {
      setPostContent(prev => prev + text);
      return;
    }
    const start = el.selectionStart ?? postContent.length;
    const end = el.selectionEnd ?? postContent.length;
    const newValue = postContent.slice(0, start) + text + postContent.slice(end);
    setPostContent(newValue);
    // Restore cursor after React state update
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + text.length;
      el.setSelectionRange(caret, caret);
      // autoresize
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    });
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    insertAtCursor(emojiData.emoji);
  };



  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const maxImages = 30;
      
      // Limit to 30 images
      const filesToProcess = Array.from(files).slice(0, maxImages - postImages.length);
      
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
        setPostImages(prev => [...prev, ...newImages]);
      });
    }
  };

  const removeImage = (index: number) => {
    setPostImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!postContent.trim()) {
      setError('Post content is required');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      if (postType === 'forum') {
        // Create forum post
        console.log('Creating forum post with data:', {
          content: postContent,
          images: postImages,
          images_count: postImages.length
        });
        
        await createForumPost({
          content: postContent,
          images: postImages
        });
      } else if (postType === 'donation') {
        // Create donation request
        console.log('Creating donation request with data:', {
          description: postContent,
          images: postImages,
          images_count: postImages.length
        });
        
        try {
          const result = await createDonationRequest({
            description: postContent,
            images: postImages
          });
          
          console.log('Donation request creation result:', result);
        } catch (donationError) {
          console.error('Donation creation failed:', donationError);
          throw donationError; // Re-throw to be caught by outer catch
        }
      } else {
        // Determine post type based on logged-in account role
        const raw = localStorage.getItem('user');
        const storedUser = raw ? JSON.parse(raw) : null;
        const isAdmin = !!(storedUser && storedUser.account_type && storedUser.account_type.admin);
        const isPeso = !!(storedUser && storedUser.account_type && storedUser.account_type.peso);
        const determinedPostType = isAdmin ? 'admin' : (isPeso ? 'peso' : 'personal');

        // Prepare post data - only send post_images if we have images, don't send empty post_image
        const postData: any = {
          post_content: postContent,
          type: determinedPostType
        };
        
        // Only add post_images if we have images
        if (postImages.length > 0) {
          postData.post_images = postImages;
        } else if (postImage) {
          // Fallback to single image for backward compatibility
          postData.post_image = postImage;
        }
        
        // Add event fields if this is an event post
        if (isEvent) {
          postData.is_event = true;
          if (eventDate) {
            postData.event_date = eventDate;
          }
          if (eventTime) {
            postData.event_time = eventTime;
          }
        }
        
        console.log('Creating post with data:', {
          post_content: postData.post_content,
          post_images_count: postImages.length,
          post_image_present: !!postImage,
          type: postData.type,
          is_event: postData.is_event,
          event_date: postData.event_date,
          event_time: postData.event_time
        });
        
        const result = await createPost(postData);
        
        console.log('Post creation result:', result);
        
        // Refresh points after posting (for Alumni and OJT users)
        // Add a small delay to ensure backend has processed points update
        if (storedUser && storedUser.account_type && (storedUser.account_type.user || storedUser.account_type.ojt)) {
          const userId = storedUser.user_id || storedUser.id;
          if (userId) {
            // Wait a bit for backend to process points
            setTimeout(async () => {
              try {
                const points = await getUserPoints(userId);
                // Dispatch event to notify Profile component
                window.dispatchEvent(new CustomEvent('pointsUpdated', { 
                  detail: { userId, points } 
                }));
              } catch (error) {
                console.error('Error refreshing points after post:', error);
              }
            }, 500); // 500ms delay to ensure backend has processed
          }
        }
      }

      onPosted();
      onCancel?.();
    } catch (error: any) {
      console.error('Post creation error:', error);
      console.error('Error response:', error.response);
      console.error('Error config:', error.config);
      
      // Provide more specific error messages
      if (error.response?.status === 404) {
        setError(`Post endpoint not found. Please check if the server is running. (URL: ${error.config?.url || 'unknown'})`);
      } else if (error.response?.status === 401) {
        setError('Please log in again to create a post.');
      } else if (error.response?.status === 400) {
        setError(error.response?.data?.message || error.response?.data?.error || 'Invalid post data. Please check your input.');
      } else if (error.response?.status >= 500) {
        setError('Server error. Please try again later.');
      } else if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError(error.response?.data?.message || error.message || 'Failed to create post');
      }
    } finally {
      setIsLoading(false);
    }
  };


  return (
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
    >
      <div
        className="post-create-modal"
        style={{
          background: '#fff',
          borderRadius: '12px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
          maxWidth: showEmojiPicker ? 750 : 500,
          width: '100%',
          maxHeight: '90vh',
          minHeight: showEmojiPicker ? 550 : 'auto',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          transition: 'max-width 0.3s ease, min-height 0.3s ease',
          overflow: 'visible',
        }}
      >
        {/* Top Bar - Matching Mobile */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px 20px',
          position: 'relative',
          height: '56px',
          boxSizing: 'border-box',
        }}>
          <button
            onClick={onCancel}
            style={{
              position: 'absolute',
              left: '20px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '20px',
              color: '#333',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            disabled={isLoading}
          >
            ✕
          </button>
          <h2 style={{
            fontWeight: 'bold',
            fontSize: '16px',
            color: '#222',
            margin: 0,
            textAlign: 'center',
            letterSpacing: '0.3px',
          }}>
            CREATE A POST
          </h2>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              const form = document.getElementById('post-create-form') as HTMLFormElement;
              if (form) {
                form.requestSubmit();
              }
            }}
            style={{
              position: 'absolute',
              right: '20px',
              background: 'transparent',
              border: 'none',
              cursor: isLoading || !postContent.trim() ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              color: isLoading || !postContent.trim() ? '#999' : '#3b82f6',
              padding: '8px 12px',
              transition: 'color 0.2s ease, opacity 0.2s ease',
              opacity: isLoading || !postContent.trim() ? 0.6 : 1,
            }}
            disabled={isLoading || !postContent.trim()}
          >
            {isLoading ? '...' : 'POST'}
          </button>
        </div>

        {/* Separator */}
        <div style={{
          height: '1px',
          backgroundColor: '#E0E0E0',
          width: '100%',
        }} />

        <form id="post-create-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
          {/* User Info */}
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            padding: '16px 20px',
            paddingTop: '12px',
            paddingBottom: '12px',
          }}>
            <img 
              src={user?.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : ctulogo} 
              alt="Profile" 
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '20px',
                marginRight: '12px',
                objectFit: 'cover',
                border: '1px solid #f0f0f0',
              }}
            />
            <div style={{
              fontWeight: 'bold',
              fontSize: '15px',
              color: '#222',
              lineHeight: '1.4',
            }}>
              {user?.name || 'User'}
            </div>
          </div>

          {/* Post Content Area */}
          <div style={{
            padding: '0 20px 16px 20px',
            position: 'relative',
            display: 'flex',
            flexDirection: 'row',
            gap: '16px',
            alignItems: 'flex-start',
            minHeight: '200px',
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}>
            <div style={{ flex: 1, position: 'relative', overflow: 'visible' }}>
              <div style={{ position: 'relative', overflow: 'visible' }}>
                <textarea
                  className="post-content-textarea"
                  placeholder="Start a post..."
                  value={postContent}
                  onChange={(e) => {
                    setPostContent(e.target.value);
                    // Auto-resize textarea with max height
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#eee';
                    e.target.style.boxShadow = 'none';
                  }}
                  style={{
                    width: '100%',
                    minHeight: '120px',
                    maxHeight: '200px',
                    padding: '12px 12px 12px 12px',
                    fontSize: '15px',
                    border: '1px solid #eee',
                    borderRadius: '8px',
                    resize: 'none',
                    fontFamily: 'inherit',
                    color: '#222',
                    backgroundColor: '#fff',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                    outline: 'none',
                    lineHeight: '1.5',
                    boxSizing: 'border-box',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                  }}
                  required
                  ref={textareaRef}
                  maxLength={1000}
                />

                {/* Character Count and Emoji Button Container */}
                <div style={{
                  position: 'absolute',
                  bottom: '8px',
                  right: '1px',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: '10px',
                  zIndex: 10,
                  pointerEvents: 'none',
                  padding: '4px 8px',
                }}>
                  {/* Emoji Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowEmojiPicker(!showEmojiPicker);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      transition: 'background-color 0.2s ease, color 0.2s ease',
                      color: '#666',
                      pointerEvents: 'auto',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                      e.currentTarget.style.color = '#333';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#666';
                    }}
                    title="Add emoji"
                  >
                    <svg 
                      width="18" 
                      height="18" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      xmlns="http://www.w3.org/2000/svg"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <circle cx="8.5" cy="9.5" r="1.5" fill="currentColor" />
                      <circle cx="15.5" cy="9.5" r="1.5" fill="currentColor" />
                      <path d="M8 14c1.5 2.5 4.5 2.5 6 0" />
                    </svg>
                  </button>

                  {/* Character Count */}
                  <div style={{
                    fontSize: '12px',
                    color: '#888',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                  }}>
                    {postContent.length}/1000
                  </div>
                </div>
              </div>

              {/* Multiple Images Preview */}
              {postImages.length > 0 && (
                <div style={{ marginBottom: '16px', marginTop: '16px' }}>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', 
                    gap: '8px',
                    marginBottom: '8px'
                  }}>
                    {postImages.map((image, index) => (
                      <div key={index} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
                        <img 
                          src={image} 
                          alt={`Preview ${index + 1}`} 
                          style={{ 
                            width: '100%', 
                            height: '100px', 
                            objectFit: 'cover', 
                            borderRadius: '8px',
                            border: '1px solid #e0e0e0',
                            display: 'block',
                          }} 
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            background: 'rgba(0,0,0,0.7)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '24px',
                            height: '24px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background-color 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.9)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.7)';
                          }}
                          title="Remove image"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    {postImages.length} of 30 images selected
                  </div>
                </div>
              )}

              {/* Single Image Preview (backward compatibility) */}
              {postImage && !postImages.length && (
                <div style={{ marginBottom: '16px', marginTop: '10px', position: 'relative' }}>
                  <img 
                    src={postImage} 
                    alt="Preview" 
                    style={{
                      width: '100%',
                      height: '150px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setPostImage('')}
                    style={{
                      position: 'absolute',
                      bottom: '5px',
                      right: '5px',
                      background: 'rgba(0,0,0,0.5)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      padding: '3px 8px',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}

              {error && (
                <div style={{
                  color: '#d32f2f',
                  fontSize: '14px',
                  marginTop: '8px',
                  marginBottom: '8px',
                }}>
                  {error}
                </div>
              )}
            </div>

            {/* Emoji Picker - Side by side with content */}
            {showEmojiPicker && (
              <div
                ref={emojiPickerRef}
                style={{
                  flexShrink: 0,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  background: '#fff',
                  border: '1px solid #e0e0e0',
                  alignSelf: 'flex-start',
                  marginTop: '0',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  width={320}
                  height={350}
                  previewConfig={{ showPreview: false }}
                  skinTonesDisabled
                />
              </div>
            )}
          </div>

          {/* Add Image Section - Matching Mobile */}
          <div style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: '16px',
            borderTopRightRadius: '16px',
            borderTop: '1px solid #eee',
            padding: '16px 20px',
            marginTop: 'auto',
            boxShadow: '0 -2px 8px rgba(0,0,0,0.08)',
            flexShrink: 0,
            zIndex: 5,
          }}>
            <label style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              cursor: postImages.length >= 30 ? 'not-allowed' : 'pointer',
              opacity: postImages.length >= 30 ? 0.6 : 1,
              transition: 'opacity 0.2s ease',
            }}>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                style={{ display: 'none' }}
                disabled={postImages.length >= 30}
              />
              <svg 
                width="32" 
                height="32" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                style={{ marginRight: '12px', flexShrink: 0 }}
              >
                <path 
                  d="M21 19V5C21 3.9 20.1 3 19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19Z" 
                  stroke="#4B944D" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
                <path 
                  d="M8.5 13.5L11 16.5L15.5 10.5L19 14.5V19H5V14.5L8.5 13.5Z" 
                  stroke="#4B944D" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
              <span style={{
                color: '#4B944D',
                fontWeight: 'bold',
                fontSize: '16px',
                userSelect: 'none',
              }}>
                {postImages.length > 0 
                  ? `${postImages.length} Image${postImages.length > 1 ? 's' : ''} Selected` 
                  : 'Add Image(s)'}
              </span>
            </label>

            {/* Event Toggle Section - Only for Admins */}
            {isAdminUser && (
              <div style={{
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: '1px solid #eee',
              }}>
                <label style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  cursor: 'pointer',
                  gap: '12px',
                }}>
                  <input
                    type="checkbox"
                    checked={isEvent}
                    onChange={(e) => {
                      setIsEvent(e.target.checked);
                      if (!e.target.checked) {
                        setEventDate('');
                        setEventTime('');
                      }
                    }}
                    style={{
                      width: '20px',
                      height: '20px',
                      cursor: 'pointer',
                      accentColor: '#3b82f6',
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '24px' }}>📅</span>
                    <span style={{
                      color: '#333',
                      fontWeight: '600',
                      fontSize: '15px',
                    }}>
                      This is an Event
                    </span>
                  </div>
                </label>

              {/* Event Date & Time Pickers */}
              {isEvent && (
                <div style={{
                  marginTop: '12px',
                  display: 'flex',
                  gap: '12px',
                  flexWrap: 'wrap',
                  padding: '12px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                }}>
                  <div style={{ flex: '1 1 200px', minWidth: '200px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#475569',
                      marginBottom: '6px',
                    }}>
                      Event Date *
                    </label>
                    <input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      required={isEvent}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '2px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        backgroundColor: 'white',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s ease',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#3b82f6';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#cbd5e1';
                      }}
                    />
                  </div>
                  <div style={{ flex: '1 1 150px', minWidth: '150px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#475569',
                      marginBottom: '6px',
                    }}>
                      Time (Optional)
                    </label>
                    <input
                      type="time"
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '2px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        backgroundColor: 'white',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s ease',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#3b82f6';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#cbd5e1';
                      }}
                    />
                  </div>
                  <div style={{
                    flex: '1 1 100%',
                    fontSize: '12px',
                    color: '#64748b',
                    marginTop: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}>
                    <span>ℹ️</span>
                    <span>This post will appear on the dashboard calendar</span>
                  </div>
                </div>
              )}
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default PostCreate;
