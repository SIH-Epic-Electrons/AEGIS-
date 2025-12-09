/**
 * Federated Learning Service
 * Implements /fl/* endpoints according to API documentation
 * Note: These endpoints do NOT require authentication
 */

import axios from 'axios';
import { API_BASE_URL } from '../constants/config';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // Longer timeout for training operations
});

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
      console.error('FL API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export interface HealthCheckResponse {
  status: string;
  registered_clients: number;
  current_rounds: {
    cst_transformer: number;
    mule_detector_gnn: number;
  };
}

export interface FLConfig {
  num_rounds: number;
  num_clients: number;
  clients_per_round: number;
  local_epochs: number;
  batch_size: number;
  learning_rate: number;
  aggregation_strategy: string;
  model_types: string[];
  bank_clients: string[];
}

export interface ClientInfo {
  bank_name: string;
  region: string;
}

export interface RegisterClientRequest {
  client_id: string;
  info: ClientInfo;
}

export interface RegisterClientResponse {
  status: string;
  client: {
    client_id: string;
    registered_at: string;
    info: ClientInfo;
  };
}

export interface Client {
  client_id: string;
  registered_at: string;
}

export interface StartTrainingRoundRequest {
  model_type: 'cst_transformer' | 'mule_detector_gnn';
  client_ids?: string[];
}

export interface StartTrainingRoundResponse {
  round_number: number;
  model_type: string;
  status: string;
  participating_clients: string[];
  global_weights: any;
}

export interface SubmitWeightUpdateRequest {
  client_id: string;
  model_type: 'cst_transformer' | 'mule_detector_gnn';
  round_number: number;
  weights: Record<string, any>;
  num_samples: number;
  metrics: {
    loss: number;
    accuracy: number;
  };
}

export interface SubmitWeightUpdateResponse {
  status: string;
  round_number: number;
  client_id: string;
  updates_received: number;
  updates_expected: number;
  aggregation_triggered: boolean;
}

export interface RoundStatus {
  round_number: number;
  model_type: string;
  status: string;
  updates_received: string[];
  updates_pending: string[];
  started_at: string;
}

export interface AggregateRoundRequest {
  model_type: 'cst_transformer' | 'mule_detector_gnn';
  round_number: number;
}

export interface GlobalModel {
  model_type: string;
  version: number;
  weights: Record<string, any>;
}

export interface ModelVersion {
  model_type: string;
  version: number;
}

export interface TrainingProgress {
  model_type: string;
  current_round: number;
  target_rounds: number;
  progress_percent: number;
  history: Array<{
    round: number;
    avg_loss: number;
  }>;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const federatedLearningService = {
  /**
   * 9.1 Health Check - GET /fl/health
   * Auth Required: ❌ No
   */
  async healthCheck(): Promise<ServiceResponse<HealthCheckResponse>> {
    try {
      const response = await api.get<HealthCheckResponse>('/fl/health');
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Mock response for demo
        const mockResponse: HealthCheckResponse = {
          status: 'healthy',
          registered_clients: 5,
          current_rounds: {
            cst_transformer: 42,
            mule_detector_gnn: 35,
          },
        };
        return { success: true, data: mockResponse };
      }

      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to check health',
      };
    }
  },

  /**
   * 9.2 Get Configuration - GET /fl/config
   * Auth Required: ❌ No
   */
  async getConfig(): Promise<ServiceResponse<FLConfig>> {
    try {
      const response = await api.get<FLConfig>('/fl/config');
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Mock response for demo
        const mockConfig: FLConfig = {
          num_rounds: 50,
          num_clients: 5,
          clients_per_round: 3,
          local_epochs: 3,
          batch_size: 32,
          learning_rate: 0.001,
          aggregation_strategy: 'fedavg',
          model_types: ['cst_transformer', 'mule_detector_gnn'],
          bank_clients: ['sbi', 'hdfc', 'icici', 'axis', 'kotak'],
        };
        return { success: true, data: mockConfig };
      }

      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to get config',
      };
    }
  },

  /**
   * 9.3 Register Client - POST /fl/clients/register
   * Auth Required: ❌ No
   */
  async registerClient(
    request: RegisterClientRequest
  ): Promise<ServiceResponse<RegisterClientResponse>> {
    try {
      const response = await api.post<RegisterClientResponse>('/fl/clients/register', request);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Mock response for demo
        const mockResponse: RegisterClientResponse = {
          status: 'registered',
          client: {
            client_id: request.client_id,
            registered_at: new Date().toISOString(),
            info: request.info,
          },
        };
        return { success: true, data: mockResponse };
      }

      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to register client',
      };
    }
  },

  /**
   * 9.4 List Clients - GET /fl/clients
   * Auth Required: ❌ No
   */
  async listClients(): Promise<ServiceResponse<{ count: number; clients: Client[] }>> {
    try {
      const response = await api.get<{ count: number; clients: Client[] }>('/fl/clients');
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Mock response for demo
        const mockResponse = {
          count: 5,
          clients: [
            {
              client_id: 'sbi',
              registered_at: new Date().toISOString(),
            },
            {
              client_id: 'hdfc',
              registered_at: new Date().toISOString(),
            },
          ],
        };
        return { success: true, data: mockResponse };
      }

      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to list clients',
      };
    }
  },

  /**
   * 9.5 Start Training Round - POST /fl/rounds/start
   * Auth Required: ❌ No
   */
  async startTrainingRound(
    request: StartTrainingRoundRequest
  ): Promise<ServiceResponse<StartTrainingRoundResponse>> {
    try {
      const response = await api.post<StartTrainingRoundResponse>('/fl/rounds/start', request);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Mock response for demo
        const mockResponse: StartTrainingRoundResponse = {
          round_number: 43,
          model_type: request.model_type,
          status: 'started',
          participating_clients: request.client_ids || ['sbi', 'hdfc', 'icici'],
          global_weights: {},
        };
        return { success: true, data: mockResponse };
      }

      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to start training round',
      };
    }
  },

  /**
   * 9.6 Submit Weight Update - POST /fl/rounds/{round_number}/update
   * Auth Required: ❌ No
   */
  async submitWeightUpdate(
    roundNumber: number,
    request: SubmitWeightUpdateRequest
  ): Promise<ServiceResponse<SubmitWeightUpdateResponse>> {
    try {
      const response = await api.post<SubmitWeightUpdateResponse>(
        `/fl/rounds/${roundNumber}/update`,
        request
      );
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Mock response for demo
        const mockResponse: SubmitWeightUpdateResponse = {
          status: 'received',
          round_number: roundNumber,
          client_id: request.client_id,
          updates_received: 2,
          updates_expected: 3,
          aggregation_triggered: false,
        };
        return { success: true, data: mockResponse };
      }

      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to submit weight update',
      };
    }
  },

  /**
   * 9.7 Get Round Status - GET /fl/rounds/{round_number}/status
   * Auth Required: ❌ No
   * Query params: model_type (required)
   */
  async getRoundStatus(
    roundNumber: number,
    modelType: 'cst_transformer' | 'mule_detector_gnn'
  ): Promise<ServiceResponse<RoundStatus>> {
    try {
      const response = await api.get<RoundStatus>(`/fl/rounds/${roundNumber}/status`, {
        params: { model_type: modelType },
      });
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Mock response for demo
        const mockResponse: RoundStatus = {
          round_number: roundNumber,
          model_type: modelType,
          status: 'in_progress',
          updates_received: ['sbi', 'hdfc'],
          updates_pending: ['icici'],
          started_at: new Date().toISOString(),
        };
        return { success: true, data: mockResponse };
      }

      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to get round status',
      };
    }
  },

  /**
   * 9.8 Aggregate Round - POST /fl/rounds/{round_number}/aggregate
   * Auth Required: ❌ No
   */
  async aggregateRound(
    roundNumber: number,
    request: AggregateRoundRequest
  ): Promise<ServiceResponse<{ success: boolean }>> {
    try {
      const response = await api.post<{ success: boolean }>(
        `/fl/rounds/${roundNumber}/aggregate`,
        request
      );
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        return { success: true, data: { success: true } };
      }

      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to aggregate round',
      };
    }
  },

  /**
   * 9.9 Get Global Model - GET /fl/models/{model_type}/global
   * Auth Required: ❌ No
   */
  async getGlobalModel(
    modelType: 'cst_transformer' | 'mule_detector_gnn'
  ): Promise<ServiceResponse<GlobalModel>> {
    try {
      const response = await api.get<GlobalModel>(`/fl/models/${modelType}/global`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Mock response for demo
        const mockResponse: GlobalModel = {
          model_type: modelType,
          version: 43,
          weights: {},
        };
        return { success: true, data: mockResponse };
      }

      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to get global model',
      };
    }
  },

  /**
   * 9.10 Get Model Version - GET /fl/models/{model_type}/version
   * Auth Required: ❌ No
   */
  async getModelVersion(
    modelType: 'cst_transformer' | 'mule_detector_gnn'
  ): Promise<ServiceResponse<ModelVersion>> {
    try {
      const response = await api.get<ModelVersion>(`/fl/models/${modelType}/version`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Mock response for demo
        const mockResponse: ModelVersion = {
          model_type: modelType,
          version: 43,
        };
        return { success: true, data: mockResponse };
      }

      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to get model version',
      };
    }
  },

  /**
   * 9.11 Get Training Progress - GET /fl/progress/{model_type}
   * Auth Required: ❌ No
   */
  async getTrainingProgress(
    modelType: 'cst_transformer' | 'mule_detector_gnn'
  ): Promise<ServiceResponse<TrainingProgress>> {
    try {
      const response = await api.get<TrainingProgress>(`/fl/progress/${modelType}`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Mock response for demo
        const mockResponse: TrainingProgress = {
          model_type: modelType,
          current_round: 43,
          target_rounds: 50,
          progress_percent: 86.0,
          history: [
            { round: 41, avg_loss: 7.45 },
            { round: 42, avg_loss: 7.38 },
            { round: 43, avg_loss: 7.32 },
          ],
        };
        return { success: true, data: mockResponse };
      }

      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to get training progress',
      };
    }
  },
};

