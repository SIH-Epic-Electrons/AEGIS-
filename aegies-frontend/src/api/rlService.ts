/**
 * Reinforcement Learning Service
 * Implements /rl/* endpoints according to backend API
 */

import axios from 'axios';
import { API_BASE_URL } from '../constants/config';
import { secureStorage } from '../services/secureStorage';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
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
      console.error('RL API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export interface RLHealthResponse {
  rl_enabled: boolean;
  models: {
    cst_transformer: {
      loaded: boolean;
      update_count: number;
    };
    mule_detector_gnn: {
      loaded: boolean;
      update_count: number;
    };
  };
  feedback_buffer_size: number;
  ready_for_training: boolean;
}

export interface RLTrainingStatus {
  model_name: string;
  model_version: string;
  is_ready: boolean;
  is_training: boolean;
  total_updates: number;
  buffer_size: number;
  min_samples_needed: number;
  ready_for_update: boolean;
  metrics: {
    average_loss: number;
    average_reward: number;
    recent_losses: number[];
    recent_rewards: number[];
  };
}

export interface RLConfig {
  enabled: boolean;
  reward_strategy: string;
  update_strategy: string;
  update_frequency: number;
  min_samples_for_update: number;
  batch_size: number;
  learning_rate: number;
  reward_weights: {
    exact_match: number;
    nearby: number;
    different: number;
    apprehension: number;
    recovery: number;
  };
}

export interface RLFeedbackStats {
  period_days: number;
  total_feedback: number;
  accuracy_distribution: {
    exact_match: number;
    nearby: number;
    different: number;
    unknown: number;
  };
  outcome_distribution: {
    apprehended: number;
    recovered: number;
    both: number;
    unsuccessful: number;
  };
  metrics: {
    average_location_accuracy: string;
    average_recovery_rate: string;
    average_reward: number;
  };
  time_range: {
    from: string | null;
    to: string | null;
  };
}

export interface TrainingResult {
  model_name: string;
  samples_used: number;
  loss: number;
  average_reward: number;
  updates: number;
  duration_seconds: number;
  checkpoint: string | null;
}

export interface FeedbackCreateRequest {
  prediction_accuracy: 'EXACT_MATCH' | 'NEARBY' | 'DIFFERENT' | 'UNKNOWN';
  intervention_result: 'APPREHENDED' | 'RECOVERED' | 'BOTH' | 'UNSUCCESSFUL';
  amount_recovered?: number;
  actual_location?: string;
  time_accuracy?: 'ON_TIME' | 'EARLY' | 'LATE' | 'MISSED';
  mule_detection_accuracy?: number;
  notes?: string;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const rlService = {
  /**
   * Get RL System Health - GET /rl/health
   */
  async healthCheck(): Promise<ServiceResponse<RLHealthResponse>> {
    try {
      const response = await api.get<{ success: boolean; data: RLHealthResponse }>('/rl/health');
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Mock response for demo
        const mockResponse: RLHealthResponse = {
          rl_enabled: true,
          models: {
            cst_transformer: {
              loaded: true,
              update_count: 156,
            },
            mule_detector_gnn: {
              loaded: true,
              update_count: 89,
            },
          },
          feedback_buffer_size: 234,
          ready_for_training: true,
        };
        return { success: true, data: mockResponse };
      }

      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to check RL health',
      };
    }
  },

  /**
   * Get Training Status - GET /rl/status/{model_name}
   */
  async getTrainingStatus(modelName: string): Promise<ServiceResponse<RLTrainingStatus>> {
    try {
      const response = await api.get<{ success: boolean; data: RLTrainingStatus }>(`/rl/status/${modelName}`);
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Mock response for demo
        const mockResponse: RLTrainingStatus = {
          model_name: modelName,
          model_version: 'v1.2.0',
          is_ready: true,
          is_training: false,
          total_updates: modelName === 'cst_transformer' ? 156 : 89,
          buffer_size: 234,
          min_samples_needed: 100,
          ready_for_update: true,
          metrics: {
            average_loss: 0.0234,
            average_reward: 0.78,
            recent_losses: [0.0256, 0.0245, 0.0234, 0.0228, 0.0221],
            recent_rewards: [0.72, 0.75, 0.78, 0.81, 0.79],
          },
        };
        return { success: true, data: mockResponse };
      }

      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to get training status',
      };
    }
  },

  /**
   * Get RL Configuration - GET /rl/config
   */
  async getConfig(): Promise<ServiceResponse<RLConfig>> {
    try {
      const response = await api.get<{ success: boolean; data: RLConfig }>('/rl/config');
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Mock response for demo
        const mockConfig: RLConfig = {
          enabled: true,
          reward_strategy: 'shaped',
          update_strategy: 'batch',
          update_frequency: 100,
          min_samples_for_update: 100,
          batch_size: 32,
          learning_rate: 0.001,
          reward_weights: {
            exact_match: 1.0,
            nearby: 0.7,
            different: -0.5,
            apprehension: 0.5,
            recovery: 0.3,
          },
        };
        return { success: true, data: mockConfig };
      }

      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to get RL config',
      };
    }
  },

  /**
   * Get Feedback Statistics - GET /rl/stats
   */
  async getStats(days: number = 30): Promise<ServiceResponse<RLFeedbackStats>> {
    try {
      const response = await api.get<{ success: boolean; data: RLFeedbackStats }>('/rl/stats', {
        params: { days },
      });
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Mock response for demo
        const mockStats: RLFeedbackStats = {
          period_days: days,
          total_feedback: 456,
          accuracy_distribution: {
            exact_match: 234,
            nearby: 156,
            different: 45,
            unknown: 21,
          },
          outcome_distribution: {
            apprehended: 178,
            recovered: 145,
            both: 89,
            unsuccessful: 44,
          },
          metrics: {
            average_location_accuracy: '85.5%',
            average_recovery_rate: '72.3%',
            average_reward: 0.78,
          },
          time_range: {
            from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
            to: new Date().toISOString(),
          },
        };
        return { success: true, data: mockStats };
      }

      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to get feedback stats',
      };
    }
  },

  /**
   * Trigger Training - POST /rl/train/{model_name}
   */
  async triggerTraining(modelName: string, numSteps: number = 1): Promise<ServiceResponse<TrainingResult>> {
    try {
      const response = await api.post<{ success: boolean; data: TrainingResult }>(
        `/rl/train/${modelName}`,
        null,
        { params: { num_steps: numSteps } }
      );
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Mock response for demo
        const mockResult: TrainingResult = {
          model_name: modelName,
          samples_used: 32,
          loss: 0.0215,
          average_reward: 0.82,
          updates: numSteps,
          duration_seconds: 2.5,
          checkpoint: `/checkpoints/${modelName}_latest.pt`,
        };
        return { success: true, data: mockResult };
      }

      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to trigger training',
      };
    }
  },

  /**
   * Submit Feedback - POST /rl/feedback/{prediction_id}
   */
  async submitFeedback(
    predictionId: string,
    feedback: FeedbackCreateRequest
  ): Promise<ServiceResponse<any>> {
    try {
      const response = await api.post<{ success: boolean; data: any }>(
        `/rl/feedback/${predictionId}`,
        feedback
      );
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Mock response for demo
        const mockResponse = {
          message: 'Thank you! Your feedback helps AEGIS learn and improve.',
          prediction_id: predictionId,
          feedback_id: 'mock-feedback-' + Date.now(),
          reward_calculated: 0.85,
          reward_breakdown: {
            location_reward: 0.7,
            outcome_reward: 0.5,
            time_bonus: 0.1,
          },
          outcome_summary: {
            location_accuracy: 'Nearby',
            recovery_rate: '75.0%',
            overall_score: '82.0%',
          },
          ai_improvement_note: 'This feedback will be used to train the AI model.',
        };
        return { success: true, data: mockResponse };
      }

      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to submit feedback',
      };
    }
  },
};

