/**
 * I4C (Indian Cybercrime Coordination Centre) National Coordination Service
 * 
 * This service ensures fraudsters cannot escape by moving states by:
 * 1. Tracking cross-state fraud patterns
 * 2. Coordinating alerts across all states
 * 3. Sharing intelligence in real-time
 * 4. Enabling national-level interdiction
 */

import axios from 'axios';
import { API_BASE_URL } from '../constants/config';
import { secureStorage } from './secureStorage';
import { Alert } from '../types';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000, // Shorter timeout
});

// Request interceptor
api.interceptors.request.use(async (config) => {
  const token = await secureStorage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - suppress network errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only log if it's not a network error
    if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
      console.error('API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export interface StateCoordination {
  stateCode: string;
  stateName: string;
  activeAlerts: number;
  teamsDeployed: number;
  lastUpdate: string;
  coordinationLevel: 'local' | 'regional' | 'national';
}

export interface CrossStatePattern {
  patternId: string;
  suspectIdentifiers: string[]; // Anonymized
  affectedStates: string[];
  totalComplaints: number;
  totalAmount: number;
  firstSeen: string;
  lastSeen: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  moSimilarity: number;
  predictedNextState?: string;
  confidence: number;
}

export interface NationalAlert {
  alertId: string;
  complaintId: string;
  primaryState: string;
  affectedStates: string[];
  riskScore: number;
  amount: number;
  suspectFingerprint: string; // Anonymized hash
  crossStateMatch: boolean;
  coordinationRequired: boolean;
  i4cPriority: 'standard' | 'high' | 'critical';
  timestamp: string;
}

export interface StateIntelligence {
  stateCode: string;
  fraudTrends: {
    type: string;
    count: number;
    trend: 'increasing' | 'stable' | 'decreasing';
  }[];
  topHotspots: Array<{
    location: string;
    latitude: number;
    longitude: number;
    riskScore: number;
    complaintCount: number;
  }>;
  crossStateConnections: number;
  lastUpdated: string;
}

export const i4cCoordinationService = {
  /**
   * Get national coordination status across all states
   */
  async getNationalStatus(): Promise<{
    totalStates: number;
    activeStates: number;
    totalAlerts: number;
    crossStateAlerts: number;
    coordinationLevel: 'local' | 'regional' | 'national';
    states: StateCoordination[];
  }> {
    try {
      const response = await api.get('/i4c/national-status');
      return response.data;
    } catch (error: any) {
      // Suppress network errors, only log other errors
      if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
        console.error('Error fetching national status:', error);
      }
      // Fallback: Return structure indicating no coordination yet
      return {
        totalStates: 28,
        activeStates: 0,
        totalAlerts: 0,
        crossStateAlerts: 0,
        coordinationLevel: 'local',
        states: [],
      };
    }
  },

  /**
   * Get cross-state fraud patterns
   * Identifies fraudsters moving between states
   */
  async getCrossStatePatterns(
    stateCode?: string,
    timeWindow?: number
  ): Promise<CrossStatePattern[]> {
    try {
      const params: any = {};
      if (stateCode) params.stateCode = stateCode;
      if (timeWindow) params.timeWindow = timeWindow;

      const response = await api.get('/i4c/cross-state-patterns', { params });
      return response.data.patterns || [];
    } catch (error: any) {
      // Suppress network errors
      if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
        console.error('Error fetching cross-state patterns:', error);
      }
      return [];
    }
  },

  /**
   * Check if an alert requires cross-state coordination
   */
  async checkCrossStateCoordination(alertId: string): Promise<{
    requiresCoordination: boolean;
    matchingStates: string[];
    patternId?: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }> {
    try {
      const response = await api.get(`/i4c/alerts/${alertId}/coordination-check`);
      return response.data;
    } catch (error: any) {
      // Suppress network errors
      if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
        console.error('Error checking coordination:', error);
      }
      return {
        requiresCoordination: false,
        matchingStates: [],
        riskLevel: 'low',
      };
    }
  },

  /**
   * Submit alert for national coordination
   * This ensures all states are notified if fraudster moves
   */
  async submitForCoordination(
    alertId: string,
    priority: 'standard' | 'high' | 'critical' = 'standard'
  ): Promise<{
    success: boolean;
    coordinationId?: string;
    notifiedStates?: string[];
    error?: string;
  }> {
    try {
      const response = await api.post(`/i4c/alerts/${alertId}/coordinate`, {
        priority,
      });
      return response.data;
    } catch (error: any) {
      console.error('Error submitting for coordination:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  },

  /**
   * Get state-level intelligence
   */
  async getStateIntelligence(
    stateCode: string
  ): Promise<StateIntelligence | null> {
    try {
      const response = await api.get(`/i4c/states/${stateCode}/intelligence`);
      return response.data;
    } catch (error: any) {
      // Suppress network errors
      if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
        console.error('Error fetching state intelligence:', error);
      }
      return null;
    }
  },

  /**
   * Get national alerts requiring coordination
   */
  async getNationalAlerts(
    filters?: {
      stateCode?: string;
      riskLevel?: 'low' | 'medium' | 'high' | 'critical';
      crossStateOnly?: boolean;
    }
  ): Promise<NationalAlert[]> {
    try {
      const response = await api.get('/i4c/national-alerts', {
        params: filters,
      });
      return response.data.alerts || [];
    } catch (error: any) {
      // Suppress network errors
      if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
        console.error('Error fetching national alerts:', error);
      }
      return [];
    }
  },

  /**
   * Report interdiction outcome to I4C
   * This updates national database and helps track fraudster movement
   */
  async reportInterdiction(
    alertId: string,
    outcome: {
      success: boolean;
      suspectApprehended: boolean;
      amountRecovered: number;
      newState?: string; // If fraudster moved to another state
      notes?: string;
    }
  ): Promise<{
    success: boolean;
    patternUpdated?: boolean;
    statesNotified?: string[];
    error?: string;
  }> {
    try {
      const response = await api.post(`/i4c/alerts/${alertId}/interdiction`, outcome);
      return response.data;
    } catch (error: any) {
      console.error('Error reporting interdiction:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  },

  /**
   * Get fraudster movement prediction
   * Predicts which state fraudster might move to next
   */
  async predictFraudsterMovement(
    suspectFingerprint: string
  ): Promise<{
    predictedStates: Array<{
      stateCode: string;
      stateName: string;
      probability: number;
      reason: string;
    }>;
    confidence: number;
    lastKnownState: string;
  } | null> {
    try {
      const response = await api.get(
        `/i4c/predict-movement/${suspectFingerprint}`
      );
      return response.data;
    } catch (error: any) {
      console.error('Error predicting movement:', error);
      return null;
    }
  },

  /**
   * Get real-time national dashboard data
   */
  async getNationalDashboard(): Promise<{
    totalAlerts: number;
    activeCordons: number;
    crossStateAlerts: number;
    fundsProtected: number;
    interdictionRate: number;
    avgResponseTime: number;
    stateBreakdown: Array<{
      stateCode: string;
      stateName: string;
      alerts: number;
      successRate: number;
    }>;
    topThreats: Array<{
      type: string;
      count: number;
      affectedStates: number;
    }>;
  }> {
    try {
      const response = await api.get('/i4c/dashboard');
      return response.data;
    } catch (error: any) {
      // Suppress network errors
      if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
        console.error('Error fetching national dashboard:', error);
      }
      // Return empty structure
      return {
        totalAlerts: 0,
        activeCordons: 0,
        crossStateAlerts: 0,
        fundsProtected: 0,
        interdictionRate: 0,
        avgResponseTime: 0,
        stateBreakdown: [],
        topThreats: [],
      };
    }
  },
};

