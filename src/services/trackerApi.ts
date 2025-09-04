// Tracker API service functions
import { api } from './api';

export interface TrackerForm {
  tracker_form_id: number;
}

export interface AcceptingStatus {
  accepting_responses: boolean;
}

export interface SubmissionStatus {
  has_submitted: boolean;
}

export interface ApiError {
  message: string;
  status?: number;
}

// Generic API request function with error handling
async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    const method = (options?.method || 'GET').toUpperCase();
    const headers = options?.headers as Record<string, string> | undefined;
    const data = options?.body as any;
    const config = { headers } as any;
    if (method === 'GET') {
      const { data: resp } = await api.get(endpoint.replace(/^\//, ''), config);
      return resp as T;
    }
    if (method === 'POST') {
      const { data: resp } = await api.post(endpoint.replace(/^\//, ''), data, config);
      return resp as T;
    }
    if (method === 'PUT') {
      const { data: resp } = await api.put(endpoint.replace(/^\//, ''), data, config);
      return resp as T;
    }
    if (method === 'DELETE') {
      const { data: resp } = await api.delete(endpoint.replace(/^\//, ''), config);
      return resp as T;
    }
    throw new Error(`Unsupported method ${method}`);
  } catch (error: any) {
    const message =
      error?.response?.data?.message ||
      (error instanceof Error ? error.message : 'Network error occurred');
    throw new Error(message);
  }
}

// Tracker API functions
export const trackerApi = {
  /**
   * Get the active tracker form
   */
  async getActiveForm(): Promise<TrackerForm> {
    return apiRequest<TrackerForm>('tracker/active-form/');
  },

  /**
   * Get the accepting status for a tracker form
   */
  async getAcceptingStatus(trackerFormId: number): Promise<AcceptingStatus> {
    return apiRequest<AcceptingStatus>(`tracker/accepting/${trackerFormId}/`);
  },

  /**
   * Check if a user has already submitted the tracker form
   */
  async checkSubmissionStatus(userId: string): Promise<SubmissionStatus> {
    return apiRequest<SubmissionStatus>(`tracker/check-status/?user_id=${userId}`);
  },

  /**
   * Get tracker questions
   */
  async getQuestions(): Promise<any> {
    return apiRequest('tracker/questions/');
  },

  /**
   * Submit tracker response
   */
  async submitResponse(data: FormData): Promise<any> {
    return apiRequest('tracker/responses/', {
      method: 'POST',
      body: data,
      headers: {
        // Don't set Content-Type for FormData, let browser set it with boundary
      },
    });
  },

  /**
   * Get tracker responses for a specific user
   */
  async getUserResponses(userId: number): Promise<any> {
    return apiRequest(`tracker/user-responses/${userId}/`);
  },

  /**
   * Get file upload statistics
   */
  async getFileStats(): Promise<any> {
    return apiRequest('tracker/file-stats/');
  },

  /**
   * Update tracker form accepting responses status
   */
  async updateAcceptingStatus(trackerFormId: number, accepting: boolean): Promise<any> {
    return apiRequest(`tracker/update-accepting/${trackerFormId}/`, {
      method: 'PUT',
      body: JSON.stringify({ accepting_responses: accepting }),
    });
  },

  /**
   * Add a new category
   */
  async addCategory(categoryData: any): Promise<any> {
    return apiRequest('tracker/add-category/', {
      method: 'POST',
      body: JSON.stringify(categoryData),
    });
  },

  /**
   * Update a category
   */
  async updateCategory(categoryId: number, categoryData: any): Promise<any> {
    return apiRequest(`tracker/update-category/${categoryId}/`, {
      method: 'PUT',
      body: JSON.stringify(categoryData),
    });
  },

  /**
   * Delete a category
   */
  async deleteCategory(categoryId: number): Promise<any> {
    return apiRequest(`tracker/delete-category/${categoryId}/`, {
      method: 'DELETE',
    });
  },

  /**
   * Add a new question
   */
  async addQuestion(questionData: any): Promise<any> {
    return apiRequest('tracker/add-question/', {
      method: 'POST',
      body: JSON.stringify(questionData),
    });
  },

  /**
   * Update a question
   */
  async updateQuestion(questionId: number, questionData: any): Promise<any> {
    return apiRequest(`tracker/update-question/${questionId}/`, {
      method: 'PUT',
      body: JSON.stringify(questionData),
    });
  },

  /**
   * Delete a question
   */
  async deleteQuestion(questionId: number): Promise<any> {
    return apiRequest(`tracker/delete-question/${questionId}/`, {
      method: 'DELETE',
    });
  },

  /**
   * Get tracker responses list
   */
  async getResponsesList(): Promise<any> {
    return apiRequest('tracker/list-responses/');
  },
};

// Utility functions for tracker logic
export const trackerUtils = {
  /**
   * Calculate the target batch year (current year - 2)
   */
  getTargetBatchYear(): number {
    return new Date().getFullYear() - 2;
  },

  /**
   * Validate if a user's batch year matches the target year
   */
  validateBatchYear(userYear: number): boolean {
    const targetYear = this.getTargetBatchYear();
    return userYear === targetYear;
  },

  /**
   * Get user-friendly error messages
   */
  getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'An unexpected error occurred';
  },

  /**
   * Format batch year validation message
   */
  getBatchYearMessage(userYear: number): string {
    const targetYear = this.getTargetBatchYear();
    return `This tracker form is only available for batch ${targetYear} alumni. You are from batch ${userYear}.`;
  },
};

export default trackerApi;
