import React, { useEffect, useRef, useState } from 'react';
import { createPost, createForumPost, createDonationRequest, getUserPoints } from '../../services/api';
import ctulogo from '../../images/ctulogo.png';
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
  // Removed emoji picker state and logic
  const [showEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Close emoji picker on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // no-op: emoji picker removed
    };
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);



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
      el.style.height = Math.min(el.scrollHeight, 100) + 'px';
    });
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
        
        console.log('Creating post with data:', {
          post_content: postData.post_content,
          post_images_count: postImages.length,
          post_image_present: !!postImage,
          type: postData.type
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
          borderRadius: 10,
          boxShadow: '0 2px 16px rgba(0,0,0,0.15)',
          maxWidth: 400,
          width: '100%',
          padding: 24,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="post-create-header">
          <h2>✏️ Create Post</h2>
          <button className="close-button" onClick={onCancel!}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="post-create-user">
            <img 
              src={user?.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : ctulogo} 
              alt="Profile" 
              className="user-avatar"
            />
            <div>
              <div className="user-name">{user?.name || 'User'}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>is creating a post</div>
            </div>
          </div>

          <div className="post-create-content">
            <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              <textarea
                placeholder="What's on your mind?"
                value={postContent}
                onChange={(e) => {
                  setPostContent(e.target.value);
                  // Auto-resize textarea
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                }}
                className="post-content-textarea"
                required
                ref={textareaRef}
              />


            </div>


            {/* Multiple Images Preview */}
            {postImages.length > 0 && (
              <div className="images-preview" style={{ marginBottom: 16 }}>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', 
                  gap: 8,
                  marginBottom: 8
                }}>
                  {postImages.map((image, index) => (
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
                  {postImages.length} of 30 images selected
                </div>
              </div>
            )}

            {/* Single Image Preview (backward compatibility) */}
            {postImage && !postImages.length && (
              <div className="image-preview">
                <img src={postImage} alt="Preview" className="preview-image" />
                <button
                  type="button"
                  className="remove-image"
                  onClick={() => setPostImage('')}
                >
                  Remove
                </button>
              </div>
            )}

            <div className="post-actions" style={{ gap: 10 }}>
              <label className="upload-button">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                  disabled={postImages.length >= 30}
                />
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M23 19C23 19.5304 22.7893 20.0391 22.4142 20.4142C22.0391 20.7893 21.5304 21 21 21H3C2.46957 21 1.96086 20.7893 1.58579 20.4142C1.21071 20.0391 1 19.5304 1 19V8C1 7.46957 1.21071 6.96086 1.58579 6.58579C1.96086 6.21071 2.46957 6 3 6H7L9 4H15L17 6H21C21.5304 6 22.0391 6.21071 22.4142 6.58579C22.7893 6.96086 23 7.46957 23 8V19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="2"/>
                </svg>
                {postImages.length >= 30 ? 'Max Photos (30)' : 'Add Photos'}
              </label>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="post-buttons">
              <button 
                type="button" 
                className="cancel-button"
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="post-button"
                disabled={isLoading || !postContent.trim()}
              >
                {isLoading ? 'Posting...' : '✏️ Post'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PostCreate;
