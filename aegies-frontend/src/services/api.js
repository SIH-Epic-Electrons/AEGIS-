/**
 * Legacy API Service
 * 
 * NOTE: This file is maintained for backward compatibility.
 * New code should use the typed services in /src/api/* instead:
 * - authService.ts for authentication
 * - caseService.ts for case management  
 * - dashboardService.ts for dashboard data
 * - teamService.ts for team management
 * - predictionService.ts for AI predictions
 * - graphService.ts for graph visualization
 */

import axios from 'axios';
import { API_BASE_URL } from '../constants/config';
import { secureStorage } from './secureStorage';

// Use the correct base URL from config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Suppress network errors in console
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only log non-network errors
    if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
      console.error('API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// Request interceptor for adding auth token
api.interceptors.request.use(
  async (config) => {
    const token = await secureStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// API functions - Using correct backend endpoints
export const apiService = {
  // Authentication - Use authService.ts instead
  login: async (credentials) => {
    try {
      // Use form-urlencoded as per API documentation
      const params = new URLSearchParams();
      params.append('username', credentials.badge_id || credentials.username);
      params.append('password', credentials.password);

      const response = await api.post('/auth/login', params, {
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
        data: {
          token: response.data.access_token,
          refreshToken: response.data.refresh_token,
          user: response.data.officer,
          expiresIn: response.data.expires_in,
        }
      };
    } catch (error) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        return { success: false, error: 'Unable to connect to server. Please check your connection.' };
      }
      console.error('Error logging in:', error);
      return { success: false, error: error.response?.data?.detail || 'Login failed' };
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
      await secureStorage.removeToken();
      return { success: true };
    } catch (error) {
      // Even if server call fails, clear local token
      await secureStorage.removeToken();
      return { success: true };
    }
  },

  getCurrentUser: async () => {
    try {
      const response = await api.get('/auth/me');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Failed to get user' };
    }
  },

  // Dashboard - Use dashboardService.ts instead
  getDashboard: async () => {
    try {
      const response = await api.get('/dashboard');
      return response.data?.data || response.data;
    } catch (error) {
      if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
        console.error('Error fetching dashboard:', error);
      }
      return null;
    }
  },

  getDashboardStats: async (period = 'all') => {
    try {
      const response = await api.get('/dashboard/stats', { params: { period } });
      return response.data?.data || response.data;
    } catch (error) {
      if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
        console.error('Error fetching dashboard stats:', error);
      }
      return null;
    }
  },

  // Cases - Use caseService.ts instead  
  getCases: async (filters = {}) => {
    try {
      const response = await api.get('/cases', { params: filters });
      return response.data?.data?.cases || response.data?.cases || [];
    } catch (error) {
      if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
        console.error('Error fetching cases:', error);
      }
      return [];
    }
  },

  getCaseById: async (caseId) => {
    try {
      const response = await api.get(`/cases/${caseId}`);
      return response.data?.data || response.data;
    } catch (error) {
      if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
        console.error('Error fetching case:', error);
      }
      return null;
    }
  },

  getCaseTransactions: async (caseId) => {
    try {
      const response = await api.get(`/cases/${caseId}/transactions`);
      return response.data?.data || response.data;
    } catch (error) {
      if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
        console.error('Error fetching transactions:', error);
      }
      return { transactions: [], splits: {} };
    }
  },

  getCaseMuleAccounts: async (caseId) => {
    try {
      const response = await api.get(`/cases/${caseId}/mule-accounts`);
      return response.data?.data || response.data;
    } catch (error) {
      if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
        console.error('Error fetching mule accounts:', error);
      }
      return { mule_accounts: [] };
    }
  },

  // Predictions - Use predictionService.ts instead
  getPredictions: async () => {
    try {
      const response = await api.get('/predictions');
      return response.data?.data || response.data || [];
    } catch (error) {
      if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
        console.error('Error fetching predictions:', error);
      }
      return [];
    }
  },

  getCasePrediction: async (caseId) => {
    try {
      const response = await api.get(`/predictions/case/${caseId}`);
      return response.data?.data || response.data;
    } catch (error) {
      if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
        console.error('Error fetching case prediction:', error);
      }
      return null;
    }
  },

  // Freeze Operations - Use freezeService.ts instead
  // POST /freeze/cases/{case_id}/freeze
  freezeAccounts: async (caseId, accountIds = [], freezeType = 'TEMPORARY') => {
    try {
      const response = await api.post(`/freeze/cases/${caseId}/freeze`, {
        account_ids: accountIds.length > 0 ? accountIds : null,
        freeze_type: freezeType,
        duration_hours: 72,
        reason: 'Suspected involvement in cyber fraud',
      });
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        return { success: false, error: 'Unable to connect to freeze service' };
      }
      console.error('Error freezing accounts:', error);
      return { success: false, error: error.response?.data?.detail || 'Failed to freeze accounts' };
    }
  },

  // GET /freeze/cases/{case_id}/freeze-status
  getFreezeStatus: async (caseId) => {
    try {
      const response = await api.get(`/freeze/cases/${caseId}/freeze-status`);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
        console.error('Error getting freeze status:', error);
      }
      return { success: false, error: error.response?.data?.detail || 'Failed to get freeze status' };
    }
  },

  // Legacy freeze method - maps to new endpoint
  freezeAccount: async (caseId, _complaintId) => {
    return apiService.freezeAccounts(caseId, [], 'TEMPORARY');
  },

  // Teams - Use teamService.ts instead
  getTeams: async (status) => {
    try {
      const response = await api.get('/teams', { params: status ? { status } : {} });
      return response.data?.data?.teams || response.data?.teams || [];
    } catch (error) {
      if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
        console.error('Error fetching teams:', error);
      }
      return [];
    }
  },

  deployTeam: async (teamId, deployData) => {
    try {
      const response = await api.post(`/teams/${teamId}/deploy`, {
        case_id: deployData.case_id,
        target_lat: deployData.target_location?.lat,
        target_lon: deployData.target_location?.lon,
        priority: deployData.priority || 'HIGH',
        instructions: deployData.instructions,
      });
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      console.error('Error deploying team:', error);
      return { success: false, error: error.response?.data?.detail || 'Failed to deploy team' };
    }
  },

  // ATMs
  getATMs: async (filters = {}) => {
    try {
      const response = await api.get('/atms', { params: filters });
      return response.data?.data?.atms || response.data?.atms || [];
    } catch (error) {
      if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
        console.error('Error fetching ATMs:', error);
      }
      return [];
    }
  },

  // Graph Visualization
  getCaseGraph: async (caseId) => {
    try {
      const response = await api.get(`/graph/case/${caseId}/visualization`);
      return response.data?.data || response.data;
    } catch (error) {
      if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
        console.error('Error fetching case graph:', error);
      }
      return null;
    }
  },

  // Reports
  getCaseReport: async (caseId) => {
    try {
      const response = await api.get(`/reports/cases/${caseId}/report`);
      return response.data?.data || response.data;
    } catch (error) {
      if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
        console.error('Error fetching case report:', error);
      }
      return null;
    }
  },

  recordOutcome: async (caseId, outcome) => {
    try {
      const response = await api.post(`/reports/cases/${caseId}/outcome`, outcome);
      return { success: true, data: response.data?.data || response.data };
    } catch (error) {
      console.error('Error recording outcome:', error);
      return { success: false, error: error.response?.data?.detail || 'Failed to record outcome' };
    }
  },

  // Legacy methods - kept for backward compatibility
  getAlerts: async (filters) => {
    // Maps to cases with status filter
    return apiService.getCases({ 
      status: 'NEW', 
      priority: 'HIGH',
      ...filters 
    });
  },

  getAlertById: async (id) => {
    return apiService.getCaseById(id);
  },

  updateAlertStatus: async (alertId, status) => {
    try {
      const response = await api.patch(`/cases/${alertId}`, { status });
      return response.data;
    } catch (error) {
      console.error('Error updating case status:', error);
      return { success: false, error: error.message };
    }
  },

  activateDigitalCordon: async (caseId, _hotspotId) => {
    // Digital cordon now uses freeze all accounts
    return apiService.freezeAccounts(caseId, [], 'TEMPORARY');
  },

  getMuleAccounts: async (caseId) => {
    const result = await apiService.getCaseMuleAccounts(caseId);
    return result?.mule_accounts || [];
  },

  submitOutcome: async (caseId, outcome) => {
    return apiService.recordOutcome(caseId, outcome);
  },

  getStatistics: async () => {
    const stats = await apiService.getDashboardStats('all');
    if (!stats) {
      return {
        totalComplaints: 0,
        activePredictions: 0,
        fundsRecovered: 0,
        successRate: 0,
        avgResponseTime: 0,
      };
    }
    return {
      totalComplaints: stats.cases?.total || 0,
      activePredictions: stats.cases?.in_progress || 0,
      fundsRecovered: stats.recovery?.total_recovered || 0,
      successRate: stats.cases?.success_rate || 0,
      avgResponseTime: stats.performance?.avg_response_time_seconds || 0,
    };
  },

  markFalsePositive: async (alertId) => {
    try {
      const response = await api.post(`/predictions/feedback/${alertId}`, { was_correct: false });
      return response.data;
    } catch (error) {
      console.error('Error marking false positive:', error);
      return { success: false, error: error.message };
    }
  },

  logOutcome: async (alertId, outcome) => {
    return apiService.recordOutcome(alertId, outcome);
  },

  submitReport: async (reportData) => {
    try {
      const response = await api.post('/reports', reportData);
      return response.data;
    } catch (error) {
      console.error('Error submitting report:', error);
      return { success: false, error: error.message };
    }
  },
};

export default api;
