/**
 * Dashboard Service
 * Implements /dashboard/* endpoints according to API documentation
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
      console.error('Dashboard API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export interface PriorityAlert {
  case_id: string;
  case_number: string;
  fraud_amount: number;
  fraud_type: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  predicted_location: string;
  confidence: number;
  created_at: string;
}

export interface OfficerStats {
  cases_today: number;
  cases_resolved: number;
  recovery_rate: number;
  avg_response_time_seconds: number;
}

export interface LiveActivity {
  active_cases: number;
  teams_deployed: number;
  accounts_frozen_today: number;
  amount_secured_today: number;
}

export interface AIInsight {
  message: string;
  type: 'WARNING' | 'INFO' | 'ALERT';
  action_url: string;
}

export interface DashboardData {
  officer_stats: OfficerStats;
  priority_alerts: PriorityAlert[];
  live_activity: LiveActivity;
  ai_insight: AIInsight;
}

export interface DashboardStats {
  period: string;
  cases: {
    total: number;
    resolved: number;
    in_progress: number;
    success_rate: number;
    by_status: Record<string, number>;
    by_priority: Record<string, number>;
    by_fraud_type: Record<string, number>;
  };
  freeze_actions: {
    accounts_frozen_today: number;
    accounts_frozen_total: number;
    amount_secured: number;
  };
  teams: {
    total: number;
    deployed_now: number;
    available: number;
  };
  recovery: {
    total_fraud_amount: number;
    total_recovered: number;
    recovery_rate: number;
    est_risk_amount?: number;  // Sum of losses from top 3 active cases
  };
  live_activity?: {
    est_risk_amount?: number;  // Sum of losses from top 3 cases
  };
  performance: {
    avg_response_time_seconds: number;
    prediction_accuracy: number;
  };
  today: {
    new_cases: number;
    resolved: number;
    frozen_accounts: number;
    amount_recovered: number;
  };
  top_cities: Array<{ city: string; cases: number }>;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const dashboardService = {
  /**
   * 2.1 Get Dashboard - GET /dashboard
   */
  async getDashboard(): Promise<ServiceResponse<DashboardData>> {
    try {
      const response = await api.get<{ success: boolean; data: DashboardData }>('/dashboard');
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to get dashboard',
      };
    }
  },

  /**
   * 2.2 Get Dashboard Statistics - GET /dashboard/stats
   * Query params: period (today, week, month, all)
   */
  async getDashboardStats(period: 'today' | 'week' | 'month' | 'all' = 'all'): Promise<ServiceResponse<DashboardStats>> {
    try {
      const response = await api.get<{ success: boolean; data: DashboardStats }>('/dashboard/stats', {
        params: { period },
      });
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to get dashboard stats',
      };
    }
  },
};

