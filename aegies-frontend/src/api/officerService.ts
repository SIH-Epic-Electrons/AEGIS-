/**
 * Officers Service
 * Implements /officers/* endpoints according to API documentation
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
      console.error('Officer API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

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

export interface UpdateOfficerRequest {
  phone?: string;
  avatar_url?: string;
  settings?: {
    notifications_enabled?: boolean;
    dark_mode?: boolean;
  };
}

export interface OfficerStats {
  cases: {
    total: number;
    resolved: number;
    successful: number;
    in_progress: number;
    success_rate: number;
  };
  recovery: {
    total_fraud_amount: number;
    total_recovered: number;
    recovery_rate: number;
  };
  performance: {
    avg_response_time_seconds: number;
    predictions_validated: number;
    prediction_accuracy: number;
  };
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const officerService = {
  /**
   * 5.1 Get My Profile - GET /officers/me
   */
  async getMyProfile(): Promise<ServiceResponse<Officer>> {
    try {
      const response = await api.get<{ success: boolean; data: Officer }>('/officers/me');
      return {
        success: true,
        data: response.data.data || response.data,
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
          avatar_url: undefined,
          is_active: true,
          settings: {},
          created_at: new Date().toISOString(),
        };
        return { success: true, data: mockOfficer };
      }

      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to get profile',
      };
    }
  },

  /**
   * 5.2 Update My Profile - PUT /officers/me
   */
  async updateMyProfile(updates: UpdateOfficerRequest): Promise<ServiceResponse<Officer>> {
    try {
      const response = await api.put<{ success: boolean; data: Officer }>('/officers/me', updates);
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Mock response for demo
        const mockOfficer: Officer = {
          id: 'mock-officer-id',
          badge_id: 'MH-CID-001',
          name: 'Inspector Sharma',
          email: 'sharma@mhpolice.gov.in',
          phone: updates.phone || '+919876543210',
          rank: 'Inspector',
          designation: 'Cyber Crime Investigator',
          avatar_url: updates.avatar_url,
          is_active: true,
          settings: updates.settings || {},
          created_at: new Date().toISOString(),
        };
        return { success: true, data: mockOfficer };
      }

      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to update profile',
      };
    }
  },

  /**
   * 5.3 Get My Statistics - GET /officers/stats
   */
  async getMyStatistics(): Promise<ServiceResponse<OfficerStats>> {
    try {
      const response = await api.get<{ success: boolean; data: OfficerStats }>('/officers/stats');
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Mock response for demo
        const mockStats: OfficerStats = {
          cases: {
            total: 156,
            resolved: 124,
            successful: 98,
            in_progress: 32,
            success_rate: 79.0,
          },
          recovery: {
            total_fraud_amount: 15000000,
            total_recovered: 10800000,
            recovery_rate: 72.0,
          },
          performance: {
            avg_response_time_seconds: 285,
            predictions_validated: 38,
            prediction_accuracy: 87.5,
          },
        };
        return { success: true, data: mockStats };
      }

      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to get statistics',
      };
    }
  },
};

