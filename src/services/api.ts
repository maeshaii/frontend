import axios from 'axios';

function ensureApiSuffix(url: string | undefined): string {
  const base = (url || 'http://127.0.0.1:8000').replace(/\/$/, '');
  // Avoid double /api/ suffix
  if (base.endsWith('/api')) {
    return base + '/';
  }
  return `${base}/api/`;
}

const API_BASE = ensureApiSuffix(process.env.REACT_APP_API_URL);

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // Enable for session-based WebSocket auth
});

// Public API instance for endpoints that don't require authentication
const publicApi = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
});

// Attach Authorization automatically with dev logging
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers = config.headers || {};
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    // Don't warn about missing token - user might be using session auth
    if (process.env.NODE_ENV === 'development') {
      console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`, {
        headers: config.headers,
        hasToken: !!token
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
  (response) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`API Response: ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        status: response.status,
        data: response.data
      });
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config || {};
    if (error.response?.status === 401 && !(originalRequest as any)._retry) {
      (originalRequest as any)._retry = true;
      if (!refreshing) {
        refreshing = (async () => {
          try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (!refreshToken) {
              // No refresh token available - redirect to login immediately
              console.log('No refresh token available, redirecting to login');
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              localStorage.removeItem('user');
              if (window.location.pathname !== '/login') {
                window.location.href = '/login';
              }
              throw new Error('No refresh token available');
            }
            
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

// Helper: check if user is authenticated
export const isAuthenticated = () => {
  try {
    const token = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    return !!(token && refreshToken);
  } catch {
    return false;
  }
};

// Helper: safe API call that checks authentication first
export const safeApiCall = async (apiCall: () => Promise<any>) => {
  if (!isAuthenticated()) {
    console.log('User not authenticated, skipping API call');
    return null;
  }
  try {
    return await apiCall();
  } catch (error) {
    console.error('API call failed:', error);
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
  // Trim credentials to prevent whitespace issues
  const trimmedUsername = acc_username.trim();
  const trimmedPassword = acc_password.trim();
  
  console.log('Sending login request:', { acc_username: trimmedUsername, acc_password: trimmedPassword });
  try {
    const response = await api.post('token/', { acc_username: trimmedUsername, acc_password: trimmedPassword });
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

export const changePassword = async (old_password: string, new_password: string) => {
  try {
    const response = await api.post('change-password/', { old_password, new_password });
    return response.data;
  } catch (error: any) {
    const message = error.response?.data?.message || 'Password change failed';
    return { success: false, message };
  }
};

// --- Import alumni: expects Password column, generates if missing, and backend will export passwords after import. ---
export const importAlumni = async (file: File, batchYear: string, program: string) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('batch_year', batchYear);
    formData.append('program', program);

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
  return await safeApiCall(async () => {
    const response = await api.get('alumni/statistics/');
    return response.data;
  });
};

// Fetch graduation years for dropdowns
export const fetchGraduationYears = async () => {
  const response = await api.get('alumni/graduation-years/');
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
export const fetchAlumniEmploymentStats = async (year = 'ALL', program = 'ALL') => {
  const response = await api.get(`statistics/alumni/?year=${year}&program=${program}`);
  return response.data;
};

// Generate specific type of statistics (QPRO, CHED, SUC, AACUP)
export const generateSpecificStats = async (year = 'ALL', program = 'ALL', statsType = 'ALL') => {
  try {
    const response = await api.get(
      `statistics/generate/?year=${year}&program=${program}&type=${statsType}`
    );
    return response.data;
  } catch (error: any) {
    // Fallback to regular employment stats if specific endpoint doesn't exist
    console.warn('Specific stats endpoint not available, falling back to employment stats');
    return await fetchAlumniEmploymentStats(year, program);
  }
};

// Export detailed alumni data for specific statistics types
export const exportDetailedAlumniData = async (year = 'ALL', program = 'ALL', statsType = 'ALL') => {
  try {
    const response = await api.get(
      `statistics/export-detailed/?year=${year}&program=${program}&type=${statsType}`
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
  coordinatorUsername: string,
  section: string
) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('batch_year', batchYear);
    formData.append('program', course);
    formData.append('coordinator_username', coordinatorUsername);
    formData.append('section', section);

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

// Fetch sections previously imported by coordinator
export const fetchCoordinatorSections = async (coordinatorUsername: string) => {
  try {
    const response = await api.get(`ojt/coordinator-sections/?coordinator=${coordinatorUsername}`);
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

// Clear OJT data by batch year (and optional coordinator/program)
export const clearOJT = async (batchYear: string, program?: string, coordinatorUsername?: string) => {
  const body: any = { batch_year: batchYear };
  if (program) body.program = program;
  if (coordinatorUsername) body.coordinator = coordinatorUsername;
  const response = await api.post('ojt/clear/', body);
  return response.data;
};

// Update OJT status for a specific user
export const updateOJTStatus = async (userId: number, status: string) => {
  const response = await api.post('ojt/status/', { user_id: userId, status });
  return response.data;
};

// Send completed OJT list to admin (returns count)
export const sendCompletedOJTToAdmin = async (year?: number | string, userIds?: number[]) => {
  const response = await api.post('ojt/send-to-admin/', { year, user_ids: userIds || [] });
  return response.data;
};

// Approve coordinator request for a batch year (converts OJT users to alumni)
export const approveCoordinatorRequest = async (year: number | string) => {
  const response = await api.post('ojt/approve-to-alumni/', { year });
  return response.data as { 
    success: boolean; 
    approved: number; 
    year: number; 
    passwords?: Array<{
      user_id: number;
      username: string;
      password: string;
      name: string;
    }>;
    errors?: Array<{
      user_id: number;
      username: string;
      error: string;
    }>;
  };
};

// Get coordinator requests count for admin dashboard
export const fetchCoordinatorRequestsCount = async (year?: number | string) => {
  const path = year ? `ojt/coordinator-requests/?year=${year}` : 'ojt/coordinator-requests/';
  const response = await api.get(path);
  return response.data;
};

// List requested batches with counts for admin cards
export const fetchCoordinatorRequestsList = async () => {
  const response = await api.get('ojt/coordinator-requests/list/');
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

// Fetch notification count for a user
export const fetchNotificationCount = async (userId: number) => {
  return await safeApiCall(async () => {
    const response = await api.get(`notifications/count/?user_id=${userId}`);
    return response.data;
  });
};

// Mark notification as read
export const markNotificationAsRead = async (notificationId: number) => {
  const response = await api.post(`notifications/mark-read/`, { notification_id: notificationId });
  return response.data;
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (userId: number) => {
  const response = await api.post(`notifications/mark-all-read/`, { user_id: userId });
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

export const getPosts = async () => {
  console.log('Fetching posts from API...');
  const response = await api.get('posts/');
  console.log('Posts API response:', response.data);
  return response.data?.posts || [];
};

export const createPost = async (postData: {
  post_content: string;
  post_image?: string; // Backward compatibility
  post_images?: string[]; // Multiple images
  type?: string;
}) => {
  console.log('Sending post creation request:', postData);
  const response = await api.post('posts/', postData);
  console.log('Post creation response:', response.data);
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

export const repostPost = async (postId: number, caption?: string) => {
  const url = `posts/${postId}/repost/`;
  console.log('Repost API URL:', url);
  console.log('Post ID:', postId, 'Type:', typeof postId);
  const response = await api.post(url, { caption: caption || '' });
  return response.data;
};

export const editRepost = async (repostId: number, repostData: { caption?: string }) => {
  const response = await api.put(`reposts/${repostId}/`, repostData);
  return response.data;
};

export const deleteRepost = async (repostId: number) => {
  const response = await api.delete(`reposts/${repostId}/`);
  return response.data;
};

// Repost like functions
export const likeRepost = async (repostId: number) => {
  const response = await api.post(`reposts/${repostId}/like/`);
  return response.data;
};

export const unlikeRepost = async (repostId: number) => {
  const response = await api.delete(`reposts/${repostId}/like/`);
  return response.data;
};

// Repost comment functions
export const commentOnRepost = async (repostId: number, commentContent: string) => {
  const response = await api.post(`reposts/${repostId}/comments/`, { comment_content: commentContent });
  return response.data;
};

export const deleteRepostComment = async (repostId: number, commentId: number) => {
  const response = await api.delete(`reposts/${repostId}/comments/${commentId}/`);
  return response.data;
};

export const editRepostComment = async (repostId: number, commentId: number, commentData: { comment_content: string }) => {
  const response = await api.put(`reposts/${repostId}/comments/${commentId}/`, commentData);
  return response.data;
};

export const deletePost = async (postId: number) => {
  // Prefer dedicated delete endpoint to avoid method routing collisions
  let response;
  try {
    response = await api.delete(`posts/delete/${postId}/`);
  } catch (e) {
    // Fallback to legacy DELETE on edit endpoint if needed
    response = await api.delete(`posts/${postId}/`);
  }
  return response.data;
};

export const editPost = async (postId: number, postData: { post_content: string }) => {
  const response = await api.put(`posts/${postId}/`, postData);
  return response.data;
};

export const deleteComment = async (postId: number, commentId: number) => {
  const response = await api.delete(`posts/${postId}/comments/${commentId}/`);
  return response.data;
};

export const editComment = async (postId: number, commentId: number, commentData: { comment_content: string }) => {
  const response = await api.put(`posts/${postId}/comments/${commentId}/`, commentData);
  return response.data;
};

// Forum-specific API functions
export const getForums = async () => {
  const response = await api.get('forum/');
  return response.data?.forums || [];
};

export const createForumPost = async (forumData: {
  content: string;
  image?: string;
}) => {
  const response = await api.post('forum/', forumData);
  return response.data;
};

export const likeForumPost = async (forumId: number) => {
  const response = await api.post(`forum/${forumId}/like/`);
  return response.data;
};

export const unlikeForumPost = async (forumId: number) => {
  const response = await api.delete(`forum/${forumId}/like/`);
  return response.data;
};

export const commentOnForumPost = async (forumId: number, commentContent: string) => {
  const response = await api.post(`forum/${forumId}/comments/`, { comment_content: commentContent });
  return response.data;
};

export const getForumComments = async (forumId: number) => {
  const response = await api.get(`forum/${forumId}/comments/`);
  return response.data;
};

export const repostForumPost = async (forumId: number, caption?: string) => {
  const response = await api.post(`forum/${forumId}/repost/`, { caption });
  return response.data;
};

export const unrepostForumPost = async (repostId: number) => {
  const response = await api.delete(`reposts/${repostId}/`);
  return response.data;
};

export const deleteForumPost = async (forumId: number) => {
  const response = await api.delete(`forum/${forumId}/`);
  return response.data;
};

export const editForumPost = async (forumId: number, forumData: { content: string }) => {
  const response = await api.put(`forum/${forumId}/`, forumData);
  return response.data;
};

export const deleteForumComment = async (forumId: number, commentId: number) => {
  const response = await api.delete(`forum/${forumId}/comments/${commentId}/`);
  return response.data;
};

export const editForumComment = async (forumId: number, commentId: number, commentData: { comment_content: string }) => {
  const response = await api.put(`forum/${forumId}/comments/${commentId}/`, commentData);
  return response.data;
};

// -------- Messaging API (web) --------
export type ConversationSummary = {
  conversation_id: number;
  updated_at: string;
  unread_count: number;
  last_message?: {
    content: string;
    created_at: string;
    sender_id: number;
    message_type: 'text' | 'image' | 'file' | 'system';
  } | null;
  other_participant?: {
    user_id: number;
    name: string;
    avatar_url?: string | null;
  } | null;
};

export type MessageItem = {
  message_id: number;
  content: string;
  message_type: 'text' | 'image' | 'file' | 'system';
  sender: { user_id: number; name: string; avatar_url?: string | null };
  is_read: boolean;
  created_at: string;
};

export const listConversations = async (): Promise<ConversationSummary[]> => {
  const { data } = await api.get('messaging/conversations/');
  return data as ConversationSummary[];
};

export const createConversation = async (participant_id: number): Promise<ConversationSummary> => {
  // Backend accepts either participant_id or participant_ids
  const { data } = await api.post('messaging/conversations/', { participant_id, participant_ids: [participant_id] });
  return data as ConversationSummary;
};

export const listMessages = async (
  conversationId: number,
  params?: { cursor?: string; limit?: number }
): Promise<{ results: MessageItem[]; next_cursor?: string | null }> => {
  const qs: string[] = [];
  if (params?.cursor) qs.push(`cursor=${encodeURIComponent(params.cursor)}`);
  if (params?.limit) qs.push(`limit=${params.limit}`);
  const url = `messaging/conversations/${conversationId}/messages/${qs.length ? `?${qs.join('&')}` : ''}`;
  const { data } = await api.get(url);
  return data as { results: MessageItem[]; next_cursor?: string | null };
};

export const sendMessage = async (
  conversationId: number,
  payload: { content?: string; message_type?: 'text' | 'image' | 'file' | 'system'; attachment_id?: number }
): Promise<MessageItem> => {
  const body: any = {
    content: payload.content ?? '',
    message_type: payload.message_type ?? 'text',
    attachment_id: payload.attachment_id,
  };
  const { data } = await api.post(`messaging/conversations/${conversationId}/messages/`, body);
  return data as MessageItem;
};

export const markConversationRead = async (conversationId: number) => {
  const { data } = await api.post(`messaging/conversations/${conversationId}/read/`, {});
  return data as { status: string; messages_marked_read: number; timestamp: string };
};

export const deleteMessageApi = async (conversationId: number, messageId: number) => {
  const { data } = await api.delete(`messaging/conversations/${conversationId}/messages/${messageId}/`);
  return data as { status: string };
};

export const searchUsersForMessaging = async (q: string) => {
  const { data } = await api.get(`messaging/users/search/?q=${encodeURIComponent(q)}`);
  return data as { users: Array<{ user_id: number; f_name: string; l_name: string }>; count: number; query: string };
};

export const uploadAttachment = async (file: File): Promise<{
  attachment_id: number;
  file_name: string;
  file_type: string;
  file_category: string;
  file_size: number;
  file_url: string;
  uploaded_at: string;
}> => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('messaging/attachments/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

// WebSocket helpers
export const getWebSocketBase = (): string => {
  const http = API_BASE.replace('/api/', '');
  if (http.startsWith('https://')) return `wss://${http.slice('https://'.length)}`;
  if (http.startsWith('http://')) return `ws://${http.slice('http://'.length)}`;
  return `ws://${http}`;
};

export const getConversationWsUrl = (conversationId: number, token?: string): string => {
  const base = getWebSocketBase();
  // Use token in URL as fallback for WebSocket authentication
  // WebSocket connections cannot send cookies/headers in browsers
  if (token) {
    return `${base}/ws/chat/${conversationId}/?token=${token}`;
  }
  return `${base}/ws/chat/${conversationId}/`;
};

// User Management API functions
export const fetchAllUsers = async (): Promise<any[]> => {
  const { data } = await api.get('admin/users/');
  return data.users || data;
};

export const updateUserPassword = async (userId: number, newPassword: string): Promise<{ success: boolean; message: string }> => {
  const { data } = await api.put(`admin/users/${userId}/password/`, {
    new_password: newPassword
  });
  return data;
};

// Get admin and PESO user IDs dynamically
export const getAdminPesoUsers = async () => {
  return await safeApiCall(async () => {
    const response = await api.get('admin-peso-users/');
    return response.data;
  });
};

// Donation API functions
export const getDonationRequests = async () => {
  console.log('API: Fetching donation requests from donations/ endpoint');
  try {
    const response = await api.get('donations/');
    console.log('API: Donation requests response:', response);
    console.log('API: Response data:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('API: Error fetching donation requests:', error);
    console.error('API: Error response:', error.response);
    throw error;
  }
};

export const createDonationRequest = async (donationData: {
  description: string;
  images?: string[];
}) => {
  console.log('Creating donation request with data:', donationData);
  console.log('API base URL:', API_BASE);
  try {
    const response = await api.post('donations/', donationData);
    console.log('Donation request response:', response);
    console.log('Response data:', response.data);
    console.log('Response status:', response.status);
    return response.data;
  } catch (error: any) {
    console.error('Donation request API error:', error);
    console.error('Error response:', error.response);
    console.error('Error response data:', error.response?.data);
    throw error;
  }
};

export const getDonationRequest = async (donationId: number) => {
  const response = await api.get(`donations/${donationId}/`);
  return response.data;
};

export const updateDonationRequest = async (donationId: number, updateData: {
  description?: string;
  status?: string;
}) => {
  const response = await api.put(`donations/${donationId}/`, updateData);
  return response.data;
};

export const deleteDonationRequest = async (donationId: number) => {
  const response = await api.delete(`donations/${donationId}/`);
  return response.data;
};

// Donation interaction API functions
export const likeDonation = async (donationId: number) => {
  const response = await api.post(`donations/${donationId}/like/`);
  return response.data;
};

export const unlikeDonation = async (donationId: number) => {
  const response = await api.delete(`donations/${donationId}/like/`);
  return response.data;
};

export const getDonationComments = async (donationId: number) => {
  const response = await api.get(`donations/${donationId}/comments/`);
  return response.data;
};

export const commentOnDonation = async (donationId: number, commentContent: string) => {
  const response = await api.post(`donations/${donationId}/comments/`, {
    comment_content: commentContent
  });
  return response.data;
};

export const deleteDonationComment = async (donationId: number, commentId: number) => {
  const response = await api.delete(`donations/${donationId}/comments/${commentId}/`);
  return response.data;
};

export const editDonationComment = async (donationId: number, commentId: number, commentData: { comment_content: string }) => {
  const response = await api.put(`donations/${donationId}/comments/${commentId}/`, commentData);
  return response.data;
};

export const repostDonation = async (donationId: number, repostCaption: string) => {
  const response = await api.post(`donations/${donationId}/repost/`, {
    caption: repostCaption
  });
  return response.data;
};

export default api;
export { publicApi };