/**
 * ATMs Service
 * Implements /atms/* endpoints according to API documentation
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
    // Only log non-validation errors (422) and non-network errors
    if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED' && error.response?.status !== 422) {
      console.error('ATM API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export interface ATM {
  id: string;
  atm_id: string;
  name: string;
  bank: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  type: 'CASH_DISPENSER' | 'CASH_RECYCLER' | 'FULL_SERVICE';
  is_active: boolean;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const atmService = {
  /**
   * 7.1 List ATMs - GET /atms
   * Query params: lat, lon, radius_km, bank, city, limit
   */
  async listATMs(params?: {
    lat?: number;
    lon?: number;
    radius_km?: number;
    bank?: string;
    city?: string;
    limit?: number;
  }): Promise<ServiceResponse<{ atms: ATM[] }>> {
    try {
      const response = await api.get<{ success: boolean; data: { atms: ATM[] } }>('/atms', { params });
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to list ATMs',
      };
    }
  },

  /**
   * 7.2 Get ATM Details - GET /atms/{atm_id}
   */
  async getATMDetails(atmId: string): Promise<ServiceResponse<ATM>> {
    try {
      const response = await api.get<{ success: boolean; data: ATM }>(`/atms/${atmId}`);
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to get ATM details',
      };
    }
  },

  /**
   * Get ATM Hotspot Predictions from CST-Transformer model
   * These are predicted high-risk ATM locations for fraud cash-out
   */
  async getATMHotspots(params?: {
    city?: string;
    state?: string;
    limit?: number;
  }): Promise<ServiceResponse<ATMHotspot[]>> {
    try {
      const response = await api.get<{ success: boolean; data: ATMHotspot[] }>('/atms/hotspots', { params });
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to get ATM hotspots',
      };
    }
  },
};

export interface ATMHotspot {
  id: string;
  name: string;
  bank: string;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  risk_score: number;
  prediction_confidence: number;
  predicted_time_window: {
    start: string;
    end: string;
  };
  fraud_type: string;
  model: string;
}

