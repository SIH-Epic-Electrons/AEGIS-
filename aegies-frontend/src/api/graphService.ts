/**
 * Graph Service
 * Implements /graph/* endpoints for money trail visualization
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
  is_mule: number; // 0 or 1
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
  case_id: string;
  case_number: string;
  nodes: VisualizationNode[];
  edges: VisualizationEdge[];
}

export interface MuleNetwork {
  account_id: string;
  connected_accounts: Array<{
    account_id: string;
    bank: string;
    is_mule: boolean;
    relationship: string;
    transaction_count: number;
    total_amount: number;
  }>;
  total_transactions: number;
  total_amount: number;
}

export interface TraceResult {
  case_id: string;
  transactions_traced: number;
  mule_accounts_detected: number;
  graph: {
    nodes: any[];
    edges: any[];
  };
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}


export const graphService = {
  /**
   * Get Case Money Flow Graph - GET /graph/case/{case_id}
   */
  async getCaseGraph(caseId: string): Promise<ServiceResponse<VisualizationGraph>> {
    try {
      const response = await api.get<{ success: boolean; data: any }>(`/graph/case/${caseId}`);
      
      // Transform to visualization format if needed
      const data = response.data.data || response.data;
      
      return {
        success: true,
        data: {
          case_id: data.case_id,
          case_number: data.case_number,
          nodes: data.graph?.nodes || data.nodes || [],
          edges: data.graph?.edges || data.edges || [],
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to get case graph',
      };
    }
  },

  /**
   * Get Case Graph for Visualization - GET /graph/case/{case_id}/visualization
   */
  async getCaseGraphVisualization(caseId: string): Promise<ServiceResponse<VisualizationGraph>> {
    try {
      const response = await api.get<{ success: boolean; data: VisualizationGraph }>(
        `/graph/case/${caseId}/visualization`
      );
      
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to get graph visualization',
      };
    }
  },

  /**
   * Trace Money Flow for Case - POST /graph/case/{case_id}/trace
   */
  async traceMoneyFlow(caseId: string): Promise<ServiceResponse<TraceResult>> {
    try {
      const response = await api.post<{ success: boolean; data: TraceResult }>(
        `/graph/case/${caseId}/trace`
      );
      
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to trace money flow',
      };
    }
  },

  /**
   * Get Mule Account Network - GET /graph/mule/{account_id}/network
   */
  async getMuleNetwork(accountId: string): Promise<ServiceResponse<MuleNetwork>> {
    try {
      const response = await api.get<{ success: boolean; data: MuleNetwork }>(
        `/graph/mule/${accountId}/network`
      );
      
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to get mule network',
      };
    }
  },
};

export default graphService;
