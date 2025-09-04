import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api/';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

// Attach Authorization automatically with dev logging
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers = config.headers || {};
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    if (process.env.NODE_ENV === 'development') {
      console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`, {
        headers: config.headers,
        data: config.data,
      });
    }
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Refresh token on 401 once
let refreshing: Promise<any> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};
    if (error.response?.status === 401 && !(originalRequest as any)._retry) {
      (originalRequest as any)._retry = true;
      if (!refreshing) {
        refreshing = (async () => {
          try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (!refreshToken) throw new Error('No refresh token available');
            const response = await axios.post(`${API_BASE}token/refresh/`, { refresh: refreshToken });
            const newAccess = response.data?.access;
            if (!newAccess) throw new Error('No access token in refresh response');
            localStorage.setItem('accessToken', newAccess);
            (originalRequest.headers as any) = (originalRequest.headers as any) || {};
            (originalRequest.headers as any).Authorization = `Bearer ${newAccess}`;
            return api(originalRequest);
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            if (window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
            throw refreshError;
          } finally {
            refreshing = null;
          }
        })();
      }
      return refreshing;
    }
    return Promise.reject(error);
  }
);

// Helper: get user info from localStorage
export const getUserInfo = () => {
  try {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};
// Fetch followers for a user
export const fetchFollowers = async (userId: number) => {
  const response = await api.get(`alumni/${userId}/followers/`);
  return response.data;
};

// Follow a user
export const followUser = async (userId: number) => {
  const token = localStorage.getItem('accessToken');
  console.log('Follow API - Token:', token ? 'Present' : 'Missing');
  console.log('Follow API - User ID:', userId);

  try {
    const response = await api.post(
      `follow/${userId}/`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    console.log('Follow API - Response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Follow API - Error:', error.response?.data || error.message);
    throw error;
  }
};

// Unfollow a user
export const unfollowUser = async (userId: number) => {
  const token = localStorage.getItem('accessToken');
  console.log('Unfollow API - Token:', token ? 'Present' : 'Missing');
  console.log('Unfollow API - User ID:', userId);

  try {
    const response = await api.delete(`follow/${userId}/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log('Unfollow API - Response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Unfollow API - Error:', error.response?.data || error.message);
    throw error;
  }
};

// Check if current user is following a user
export const checkFollowStatus = async (userId: number) => {
  const token = localStorage.getItem('accessToken');
  console.log('Check Follow Status API - Token:', token ? 'Present' : 'Missing');
  console.log('Check Follow Status API - User ID:', userId);

  try {
    const response = await api.get(`follow/${userId}/status/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log('Check Follow Status API - Response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Check Follow Status API - Error:', error.response?.data || error.message);
    throw error;
  }
};

// --- SECURITY NOTE: Login is now strictly username + password. No birthdate login allowed. ---
export const loginUser = async (acc_username: string, acc_password: string) => {
  console.log('Sending login request:', { acc_username, acc_password });
  try {
    const response = await api.post('token/', { acc_username, acc_password });
    console.log('Login response received:', response.data);
    
    // Save tokens and user info to localStorage
    localStorage.setItem('accessToken', response.data.access);
    localStorage.setItem('refreshToken', response.data.refresh);
    localStorage.setItem('user', JSON.stringify(response.data.user));
    
    return { success: true, ...response.data };
  } catch (error: any) {
    console.error('Login error details:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers
      }
    });
    
    // Provide more specific error messages
    if (error.response?.status === 400) {
      return { success: false, message: 'Invalid credentials or request format' };
    } else if (error.response?.status === 500) {
      return { success: false, message: 'Server error - please try again later' };
    } else if (error.code === 'ERR_NETWORK') {
      return { success: false, message: 'Network error - check your connection' };
    } else if (error.response?.status === 0) {
      return { success: false, message: 'CORS error - backend may not be running' };
    }
    
    return { success: false, message: 'Login failed - please try again' };
  }
};

// --- Import alumni: expects Password column, generates if missing, and backend will export passwords after import. ---
export const importAlumni = async (file: File, batchYear: string, course: string) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('batch_year', batchYear);
    formData.append('course', course);

    const response = await api.post('import-alumni/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  } catch (error: any) {
    if (error.response?.data) {
      return error.response.data;
    }
    return { success: false, message: 'Network error occurred' };
  }
};

// Re-export axios instance for other service modules
export { api };

// Fetch alumni statistics (counts per year)
export const fetchAlumniStatistics = async () => {
  const response = await api.get('alumni/statistics/');
  return response.data;
};

// Fetch alumni user list
export const fetchAlumniList = async () => {
  const response = await api.get('alumni/list/');
  return response.data;
};

// Fetch alumni by year
export const fetchAlumniByYear = async (year: string) => {
  const response = await api.get(`users/alumni/?year=${year}`);
  return response.data;
};

// Fetch alumni employment statistics by year and course
export const fetchAlumniEmploymentStats = async (year = 'ALL', course = 'ALL') => {
  const response = await api.get(`statistics/alumni/?year=${year}&course=${course}`);
  return response.data;
};

// Generate specific type of statistics (QPRO, CHED, SUC, AACUP)
export const generateSpecificStats = async (year = 'ALL', course = 'ALL', statsType = 'ALL') => {
  try {
    const response = await api.get(
      `statistics/generate/?year=${year}&course=${course}&type=${statsType}`
    );
    return response.data;
  } catch (error: any) {
    // Fallback to regular employment stats if specific endpoint doesn't exist
    console.warn('Specific stats endpoint not available, falling back to employment stats');
    return await fetchAlumniEmploymentStats(year, course);
  }
};

// Export detailed alumni data for specific statistics types
export const exportDetailedAlumniData = async (year = 'ALL', course = 'ALL', statsType = 'ALL') => {
  try {
    const response = await api.get(
      `statistics/export-detailed/?year=${year}&course=${course}&type=${statsType}`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching detailed alumni data:', error);
    throw error;
  }
};

// --- Import OJT: expects Password column, generates if missing, and backend will export passwords after import. ---
export const importOJT = async (
  file: File,
  batchYear: string,
  course: string,
  coordinatorUsername: string
) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('batch_year', batchYear);
    formData.append('course', course);
    formData.append('coordinator_username', coordinatorUsername);

    const response = await api.post('ojt/import/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  } catch (error: any) {
    if (error.response?.data) {
      return error.response.data;
    }
    return { success: false, message: 'Network error occurred' };
  }
};

// Fetch OJT statistics (counts per year) for coordinators
export const fetchOJTStatistics = async (coordinatorUsername?: string) => {
  const path = coordinatorUsername
    ? `ojt/statistics/?coordinator=${coordinatorUsername}`
    : 'ojt/statistics/';
  const response = await api.get(path);
  return response.data;
};

// Fetch OJT data by year for coordinators
export const fetchOJTByYear = async (year: string, coordinatorUsername?: string) => {
  const path = coordinatorUsername
    ? `ojt/by-year/?year=${year}&coordinator=${coordinatorUsername}`
    : `ojt/by-year/?year=${year}`;
  const response = await api.get(path);
  return response.data;
};

// Fetch tracker responses
export const fetchTrackerResponses = async () => {
  const response = await api.get('tracker/list-responses/');
  return response.data;
};

// Fetch tracker responses by batch year
export const fetchTrackerResponsesByBatchYear = async (batchYear: string) => {
  const response = await api.get(`tracker/list-responses/?batch_year=${batchYear}`);
  return response.data;
};

// Fetch tracker responses for a specific user
export const fetchTrackerResponsesByUser = async (userId: number) => {
  const response = await api.get(`tracker/user-responses/${userId}/`);
  return response.data;
};

// Fetch tracker form by ID (to get title)
export const fetchTrackerForm = async (trackerFormId: number) => {
  const response = await api.get(`tracker/form/${trackerFormId}/`);
  return response.data;
};

// Update tracker form title
export const updateTrackerFormTitle = async (trackerFormId: number, title: string) => {
  const response = await api.put(`tracker/update-form-title/${trackerFormId}/`, { title });
  return response.data;
};

// Send reminders to selected alumni (by user_id)
export const sendReminders = async (user_ids: number[], message: string, subject?: string) => {
  const response = await api.post('send-reminder/', { user_ids, message, subject });
  return response.data;
};

// Fetch notifications for a user
export const fetchNotifications = async (userId: number) => {
  const response = await api.get(`notifications/?user_id=${userId}`);
  return response.data;
};

// Delete notifications by IDs
export const deleteNotifications = async (notificationIds: number[]) => {
  const response = await api.post('notifications/delete/', { notification_ids: notificationIds });
  return response.data;
};

// Fetch single alumni details by user_id
export const fetchAlumniDetails = async (userId: string | number) => {
  const response = await api.get(`alumni/${userId}/`);
  return response.data;
};
// -------- Posts API --------
export const getPostCategories = async () => {
  try {
    const response = await api.get('post-categories/');
    const categories = (response.data && (response.data.categories || response.data)) || [];
    return { categories };
  } catch (e) {
    const response = await axios.get(`${API_BASE}post-categories/`);
    const categories = (response.data && (response.data.categories || response.data)) || [];
    return { categories };
  }
};

export const getPosts = async () => {
  const response = await api.get('posts/');
  return response.data?.posts || [];
};

export const createPost = async (postData: {
  post_title: string;
  post_content: string;
  post_image?: string;
  post_cat_id: number;
  type?: string;
}) => {
  const response = await api.post('posts/', postData);
  return response.data;
};

export const likePost = async (postId: number) => {
  const response = await api.post(`posts/${postId}/like/`);
  return response.data;
};

export const unlikePost = async (postId: number) => {
  const response = await api.delete(`posts/${postId}/like/`);
  return response.data;
};

export const commentOnPost = async (postId: number, commentContent: string) => {
  const response = await api.post(`posts/${postId}/comments/`, { comment_content: commentContent });
  return response.data;
};

export const getPostComments = async (postId: number) => {
  const response = await api.get(`posts/${postId}/comments/`);
  return response.data;
};

export const repostPost = async (postId: number) => {
  const response = await api.post(`posts/${postId}/repost/`);
  return response.data;
};

export const deleteRepost = async (repostId: number) => {
  const response = await api.delete(`reposts/${repostId}/`);
  return response.data;
};
