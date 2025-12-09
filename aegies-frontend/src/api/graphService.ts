/**
 * Graph Visualization Service
 * Handles API calls for money flow graph and mule network visualization
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
      console.error('Graph API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export interface VisualizationNode {
  id: string;
  label: string;
  account_id: string;
  account_number?: string;
  bank?: string;
  holder_name?: string;
  is_mule: number;
  mule_probability: number;
  risk_score?: number;
  node_type: 'victim' | 'mule' | 'account';
  color: string;
  size: number;
}

export interface VisualizationEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  amount: number;
  transaction_type: string;
  hop_number?: number;
  timestamp?: string;
  width: number;
  color: string;
}

export interface VisualizationGraph {
  nodes: VisualizationNode[];
  edges: VisualizationEdge[];
  case_id: string;
  case_number?: string;
}

export interface MuleNetwork {
  account_id: string;
  connected_accounts: Array<{
    id: string;
    account_number: string;
    bank: string;
    holder_name?: string;
    mule_probability: number;
    relationship: string;
  }>;
  total_connections: number;
  network_risk_score: number;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const graphService = {
  /**
   * Get visualization-optimized graph data for a case
   */
  async getCaseVisualization(caseId: string): Promise<ServiceResponse<VisualizationGraph>> {
    try {
      const response = await api.get<{ success: boolean; data: VisualizationGraph }>(
        `/graph/case/${caseId}/visualization`
      );
      return { success: true, data: response.data?.data || response.data };
    } catch (error: any) {
      console.error('Graph visualization error:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Failed to fetch graph visualization' 
      };
    }
  },

  /**
   * Get money flow graph for a case
   */
  async getCaseGraph(caseId: string): Promise<ServiceResponse<any>> {
    try {
      const response = await api.get<{ success: boolean; data: any }>(
        `/graph/case/${caseId}`
      );
      return { success: true, data: response.data?.data || response.data };
    } catch (error: any) {
      console.error('Graph API error:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Failed to fetch case graph' 
      };
    }
  },

  /**
   * Trace money flow for a case (triggers CFCFRMS simulation)
   */
  async traceMoneyFlow(caseId: string): Promise<ServiceResponse<any>> {
    try {
      const response = await api.post<{ success: boolean; data: any }>(
        `/graph/case/${caseId}/trace`
      );
      return { success: true, data: response.data?.data || response.data };
    } catch (error: any) {
      console.error('Graph trace error:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Failed to trace money flow' 
      };
    }
  },

  /**
   * Get mule account network
   */
  async getMuleNetwork(accountId: string): Promise<ServiceResponse<MuleNetwork>> {
    try {
      const response = await api.get<{ success: boolean; data: any }>(
        `/graph/mule/${accountId}/network`
      );
      return { success: true, data: response.data?.data || response.data };
    } catch (error: any) {
      console.error('Mule network error:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Failed to fetch mule network' 
      };
    }
  },
};

export default graphService;
