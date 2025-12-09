/**
 * AI Predictions Service
 * Implements /predictions/* endpoints according to API documentation
 */

import axios from 'axios';
import { API_BASE_URL } from '../constants/config';
import { secureStorage } from '../services/secureStorage';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
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
      console.error('Prediction API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export interface LocationPrediction {
  primary: {
    atm_id: string;
    name: string;
    address: string;
    lat: number;
    lon: number;
    confidence: number;
    distance_km: number;
    bank: string;
    city: string;
    state?: string;
  };
  alternatives: Array<{
    name: string;
    bank: string;
    city: string;
    confidence: number;
    distance_km: number;
  }>;
}

export interface TimePrediction {
  window_start: string;
  window_end: string;
  confidence: number;
}

export interface ModelInfo {
  model_name: string;
  version: string;
  mode: 'ATM' | 'BANK' | 'AREA';
  cst_model_used?: boolean;  // Flag to indicate CST model was actually used
}

export interface CasePrediction {
  case_id: string;
  prediction_id: string;
  location_prediction: LocationPrediction;
  time_prediction: TimePrediction;
  model_info: ModelInfo;
}

export interface PredictionFeedback {
  was_correct: boolean;
  actual_location?: string; // UUID of actual ATM
  notes?: string;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const predictionService = {
  /**
   * 4.1 Get Case Prediction - GET /predictions/case/{case_id}
   */
  async getCasePrediction(caseId: string): Promise<ServiceResponse<CasePrediction>> {
    try {
      const response = await api.get<{ success: boolean; data: CasePrediction }>(`/predictions/case/${caseId}`);
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to get prediction',
      };
    }
  },

  /**
   * 4.2 Submit Prediction Feedback - POST /predictions/feedback/{prediction_id}
   */
  async submitPredictionFeedback(
    predictionId: string,
    feedback: PredictionFeedback
  ): Promise<ServiceResponse<{ message: string; prediction_id: string }>> {
    try {
      const response = await api.post<{ success: boolean; data: { message: string; prediction_id: string } }>(
        `/predictions/feedback/${predictionId}`,
        feedback
      );
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to submit feedback',
      };
    }
  },
};
