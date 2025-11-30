import { useState, useEffect, useCallback } from 'react';
import { getPosts } from '../services/api';

interface UsePostsOptions {
  autoRefresh?: boolean;
}

interface LikeItem {
  user_id: number;
  f_name: string;
  l_name: string;
  profile_pic?: string;
  initials?: string;
}

interface PostItem {
  post_id: number;
  post_title?: string;
  post_content: string;
  post_image?: string | null; // Backward compatibility
  post_images?: Array<{ // Multiple images
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
    account_type?: { admin?: boolean; peso?: boolean; ojt?: boolean; user?: boolean; coordinator?: boolean };
  };
  comments?: any[];
  reposts?: any[];
  likes?: LikeItem[];
  liked_by_user?: boolean;
  // Event fields
  is_event?: boolean;
  event_date?: string | null;
  event_time?: string | null;
}

export const usePosts = ({ autoRefresh = false }: UsePostsOptions = {}) => {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedPosts = await getPosts();
      setPosts(fetchedPosts || []);
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError('Failed to fetch posts');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshPosts = useCallback(() => {
    return fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchPosts();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, fetchPosts]);

  return {
    posts,
    loading,
    error,
    refreshPosts,
    fetchPosts
  };
};
