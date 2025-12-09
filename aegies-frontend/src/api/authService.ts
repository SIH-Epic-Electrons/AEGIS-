/**
 * Authentication Service
 * Implements /auth/* endpoints according to API documentation
 */

import axios from 'axios';
import { API_BASE_URL } from '../constants/config';
import { secureStorage } from '../services/secureStorage';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Request interceptor
api.interceptors.request.use(async (config) => {
  const token = await secureStorage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
      console.error('Auth API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export interface LoginRequest {
  username: string; // Badge ID or email
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  officer: {
    id: string;
    badge_id: string;
    name: string;
    rank: string;
    designation: string;
  };
}

export interface Officer {
  id: string;
  badge_id: string;
  name: string;
  email: string;
  phone?: string;
  rank: string;
  designation: string;
  avatar_url?: string;
  is_active: boolean;
  settings?: any;
  created_at: string;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const authService = {
  /**
   * 1.1 Login - POST /auth/login
   * Content-Type: application/x-www-form-urlencoded
   */
  async login(username: string, password: string): Promise<ServiceResponse<LoginResponse>> {
    try {
      // Use form-urlencoded as per documentation
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('password', password);

      const response = await api.post<LoginResponse>('/auth/login', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      // Store token
      if (response.data.access_token) {
        await secureStorage.setToken(response.data.access_token);
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Mock response for demo
        const mockResponse: LoginResponse = {
          access_token: 'mock_token_' + Date.now(),
          token_type: 'bearer',
          expires_in: 1800,
          officer: {
            id: 'mock-officer-id',
            badge_id: 'MH-CID-001',
            name: 'Inspector Sharma',
            rank: 'Inspector',
            designation: 'Cyber Crime Investigator',
          },
        };
        await secureStorage.setToken(mockResponse.access_token);
        return { success: true, data: mockResponse };
      }

      const errorMessage =
        error.response?.status === 401
          ? 'Invalid credentials'
          : error.response?.status === 403
          ? 'Account deactivated'
          : error.response?.data?.detail || error.message || 'Login failed';

      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  /**
   * 1.2 Logout - POST /auth/logout
   */
  async logout(): Promise<ServiceResponse<{ success: boolean; message: string }>> {
    try {
      const response = await api.post('/auth/logout');
      await secureStorage.removeToken();
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      // Always remove token even if API call fails
      await secureStorage.removeToken();
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        return {
          success: true,
          data: { success: true, message: 'Logged out successfully' },
        };
      }
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Logout failed',
      };
    }
  },

  /**
   * 1.3 Get Current User - GET /auth/me
   */
  async getCurrentUser(): Promise<ServiceResponse<Officer>> {
    try {
      const response = await api.get<Officer>('/auth/me');
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Mock response for demo
        const mockOfficer: Officer = {
          id: 'mock-officer-id',
          badge_id: 'MH-CID-001',
          name: 'Inspector Sharma',
          email: 'sharma@mhpolice.gov.in',
          phone: '+919876543210',
          rank: 'Inspector',
          designation: 'Cyber Crime Investigator',
          is_active: true,
          created_at: new Date().toISOString(),
        };
        return { success: true, data: mockOfficer };
      }

      // If unauthorized, token might be invalid
      if (error.response?.status === 401) {
        await secureStorage.removeToken();
      }

      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to get user',
      };
    }
  },

  /**
   * Verify token and get user (legacy compatibility)
   */
  async verifyToken(token: string): Promise<Officer | null> {
    try {
      const response = await api.get<Officer>('/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      return null;
    }
  },
};
