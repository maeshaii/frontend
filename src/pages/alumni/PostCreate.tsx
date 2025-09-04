import React, { useState, useEffect } from 'react';
import { createPost, getPostCategories } from '../../services/api';
import ctulogo from '../../images/ctulogo.png';
import './postcreate.css';

export interface PostCreateProps {
  onPosted: () => void | Promise<void>;
  onCancel?: () => void;
  user?: {
    name: string;
    profile_pic?: string;
  };
}

interface PostCategory {
  post_cat_id: number;
  events: boolean;
  announcements: boolean;
  donation: boolean;
  personal: boolean;
}

const PostCreate: React.FC<PostCreateProps> = ({ onPosted, onCancel, user }) => {
  const [postContent, setPostContent] = useState('');
  const [postTitle, setPostTitle] = useState('');
  const [postImage, setPostImage] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<number>(1);
  const [categories, setCategories] = useState<PostCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await getPostCategories();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Error loading categories:', error);
      // Default categories if API fails
      setCategories([
        { post_cat_id: 1, events: false, announcements: false, donation: false, personal: true },
        { post_cat_id: 2, events: true, announcements: false, donation: false, personal: false },
        { post_cat_id: 3, events: false, announcements: true, donation: false, personal: false },
        { post_cat_id: 4, events: false, announcements: false, donation: true, personal: false },
      ]);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPostImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
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
      await createPost({
        post_title: postTitle,
        post_content: postContent,
        post_image: postImage,
        post_cat_id: selectedCategory,
        type: 'personal'
      });

      onPosted();
      onCancel?.();
    } catch (error: any) {
      setError(error.message || 'Failed to create post');
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryName = (category: PostCategory) => {
    if (category.personal) return 'Personal';
    if (category.events) return 'Events';
    if (category.announcements) return 'Announcements';
    if (category.donation) return 'Donation';
    return 'General';
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
          <h2>Create Post</h2>
          <button className="close-button" onClick={onCancel!}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="post-create-user">
            <img 
              src={user?.profile_pic ? (String(user.profile_pic).startsWith('http') ? user.profile_pic : `http://127.0.0.1:8000${user.profile_pic}`) : ctulogo} 
              alt="Profile" 
              className="user-avatar"
            />
            <span className="user-name">{user?.name || 'User'}</span>
          </div>

          <div className="post-create-content">
            
            
            <textarea
              placeholder="What's on your mind?"
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              className="post-content-textarea"
              rows={4}
              required
            />

            <div className="post-category">
              <label>Category:</label>
              <select 
                value={selectedCategory} 
                onChange={(e) => setSelectedCategory(Number(e.target.value))}
                className="category-select"
              >
                {categories.map((category) => (
                  <option key={category.post_cat_id} value={category.post_cat_id}>
                    {getCategoryName(category)}
                  </option>
                ))}
              </select>
            </div>

            {postImage && (
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

            <div className="post-actions">
              <label className="upload-button">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
                📷 Add Photo
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
                {isLoading ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PostCreate;
