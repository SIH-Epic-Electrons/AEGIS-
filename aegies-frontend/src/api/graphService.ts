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

// Generate mock graph data for demo
const generateMockGraph = (caseId: string): VisualizationGraph => {
  const mockNodes: VisualizationNode[] = [
    {
      id: 'ACC_VICTIM',
      label: 'Rajesh Gupta',
      account_id: 'ACC_VICTIM',
      account_number: 'XXXX4521',
      bank: 'ICICI',
      holder_name: 'Rajesh Gupta',
      is_mule: 0,
      mule_probability: 0.0,
      risk_score: 0.0,
      node_type: 'victim',
      color: '#22c55e',
      size: 40,
    },
    {
      id: 'ACC_MULE_1',
      label: 'SBI Account',
      account_id: 'ACC_MULE_1',
      account_number: 'XXXX7832',
      bank: 'SBI',
      holder_name: 'Unknown',
      is_mule: 1,
      mule_probability: 0.92,
      risk_score: 0.85,
      node_type: 'mule',
      color: '#f97316',
      size: 35,
    },
    {
      id: 'ACC_MULE_2',
      label: 'HDFC Account',
      account_id: 'ACC_MULE_2',
      account_number: 'XXXX2190',
      bank: 'HDFC',
      holder_name: 'Unknown',
      is_mule: 1,
      mule_probability: 0.87,
      risk_score: 0.78,
      node_type: 'mule',
      color: '#f97316',
      size: 35,
    },
    {
      id: 'ACC_MULE_3',
      label: 'Axis Account',
      account_id: 'ACC_MULE_3',
      account_number: 'XXXX9876',
      bank: 'Axis',
      holder_name: 'Unknown',
      is_mule: 1,
      mule_probability: 0.79,
      risk_score: 0.72,
      node_type: 'mule',
      color: '#f97316',
      size: 35,
    },
    {
      id: 'ACC_REGULAR',
      label: 'Kotak Account',
      account_id: 'ACC_REGULAR',
      account_number: 'XXXX5432',
      bank: 'Kotak',
      holder_name: 'Unknown',
      is_mule: 0,
      mule_probability: 0.15,
      risk_score: 0.2,
      node_type: 'account',
      color: '#3b82f6',
      size: 30,
    },
  ];

  const mockEdges: VisualizationEdge[] = [
    {
      id: `edge_${caseId}_1`,
      source: 'ACC_VICTIM',
      target: 'ACC_MULE_1',
      label: '₹2,10,000 (IMPS)',
      amount: 210000,
      transaction_type: 'IMPS',
      hop_number: 1,
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      width: 6,
      color: '#94a3b8',
    },
    {
      id: `edge_${caseId}_2`,
      source: 'ACC_MULE_1',
      target: 'ACC_MULE_2',
      label: '₹1,00,000 (IMPS)',
      amount: 100000,
      transaction_type: 'IMPS',
      hop_number: 2,
      timestamp: new Date(Date.now() - 3000000).toISOString(),
      width: 5,
      color: '#94a3b8',
    },
    {
      id: `edge_${caseId}_3`,
      source: 'ACC_MULE_1',
      target: 'ACC_MULE_3',
      label: '₹60,000 (NEFT)',
      amount: 60000,
      transaction_type: 'NEFT',
      hop_number: 2,
      timestamp: new Date(Date.now() - 2400000).toISOString(),
      width: 4,
      color: '#60a5fa',
    },
    {
      id: `edge_${caseId}_4`,
      source: 'ACC_MULE_2',
      target: 'ACC_REGULAR',
      label: '₹40,000 (UPI)',
      amount: 40000,
      transaction_type: 'UPI',
      hop_number: 3,
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      width: 3,
      color: '#8b5cf6',
    },
    {
      id: `edge_${caseId}_5`,
      source: 'ACC_MULE_3',
      target: 'ACC_REGULAR',
      label: '₹30,000 (UPI)',
      amount: 30000,
      transaction_type: 'UPI',
      hop_number: 3,
      timestamp: new Date(Date.now() - 1200000).toISOString(),
      width: 3,
      color: '#8b5cf6',
    },
  ];

  return {
    case_id: caseId,
    case_number: `MH-2025-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`,
    nodes: mockNodes,
    edges: mockEdges,
  };
};

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
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Mock response for demo
        return { success: true, data: generateMockGraph(caseId) };
      }

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
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Mock response for demo
        return { success: true, data: generateMockGraph(caseId) };
      }

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
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Mock response for demo
        const mockGraph = generateMockGraph(caseId);
        return {
          success: true,
          data: {
            case_id: caseId,
            transactions_traced: 5,
            mule_accounts_detected: 3,
            graph: {
              nodes: mockGraph.nodes,
              edges: mockGraph.edges,
            },
          },
        };
      }

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
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Mock response for demo
        return {
          success: true,
          data: {
            account_id: accountId,
            connected_accounts: [
              {
                account_id: 'ACC_MULE_2',
                bank: 'HDFC',
                is_mule: true,
                relationship: 'RECEIVED_FROM',
                transaction_count: 3,
                total_amount: 150000,
              },
              {
                account_id: 'ACC_REGULAR',
                bank: 'Kotak',
                is_mule: false,
                relationship: 'SENT_TO',
                transaction_count: 2,
                total_amount: 80000,
              },
            ],
            total_transactions: 5,
            total_amount: 230000,
          },
        };
      }

      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to get mule network',
      };
    }
  },
};

export default graphService;
