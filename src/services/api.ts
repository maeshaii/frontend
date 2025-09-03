import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/api/',
  withCredentials: true,
});


// Login API function (JWT, for all account types)
export const loginUser = async (acc_username: string, acc_password: string) => {
  console.log('Sending:', { acc_username, acc_password });
  try {
    const response = await api.post(
      'token/',
      { acc_username, acc_password }
    );
    // Save tokens and user info to localStorage
    localStorage.setItem('accessToken', response.data.access);
    localStorage.setItem('refreshToken', response.data.refresh);
    localStorage.setItem('user', JSON.stringify(response.data.user));
    return { success: true, ...response.data };
  } catch (error: any) {
    return { success: false, message: 'Invalid credentials' };
  }
};

// Import alumni accounts from Excel
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

// Fetch alumni statistics (counts per year)
export const fetchAlumniStatistics = async () => {
  const response = await axios.get('http://127.0.0.1:8000/api/statistics/alumni/');
  return response.data;
};

// Fetch alumni user list
export const fetchAlumniList = async () => {
  const response = await axios.get('http://127.0.0.1:8000/api/users/alumni/');
  return response.data;
};

// Fetch alumni by year
export const fetchAlumniByYear = async (year: string) => {
  const response = await axios.get(`http://127.0.0.1:8000/api/users/alumni/?year=${year}`);
  return response.data;
};

// Fetch alumni employment statistics by year and course
export const fetchAlumniEmploymentStats = async (year = 'ALL', course = 'ALL') => {
  const response = await axios.get(`http://127.0.0.1:8000/api/statistics/alumni/?year=${year}&course=${course}`);
  return response.data;
};

// Generate specific type of statistics (QPRO, CHED, SUC, AACUP)
export const generateSpecificStats = async (year = 'ALL', course = 'ALL', statsType = 'ALL') => {
  try {
    const response = await axios.get(`http://127.0.0.1:8000/api/statistics/generate/?year=${year}&course=${course}&type=${statsType}`);
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
    const response = await axios.get(`http://127.0.0.1:8000/api/statistics/export-detailed/?year=${year}&course=${course}&type=${statsType}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching detailed alumni data:', error);
    throw error;
  }
};

// OJT-specific API functions for coordinators
export const importOJT = async (file: File, batchYear: string, course: string, coordinatorUsername: string) => {
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
  const url = coordinatorUsername 
    ? `http://127.0.0.1:8000/api/ojt/statistics/?coordinator=${coordinatorUsername}`
    : 'http://127.0.0.1:8000/api/ojt/statistics/';
  const response = await axios.get(url);
  return response.data;
};

// Fetch OJT data by year for coordinators
export const fetchOJTByYear = async (year: string, coordinatorUsername?: string) => {
  const url = coordinatorUsername 
    ? `http://127.0.0.1:8000/api/ojt/by-year/?year=${year}&coordinator=${coordinatorUsername}`
    : `http://127.0.0.1:8000/api/ojt/by-year/?year=${year}`;
  const response = await axios.get(url);
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
  const response = await axios.get(`http://127.0.0.1:8000/api/tracker/user-responses/${userId}/`);
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

export default api;
