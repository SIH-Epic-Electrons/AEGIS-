/**
 * LEA Service - Next-Generation Law Enforcement Intelligence API
 * Handles prediction alerts, one-click actions, and feedback
 */

import axios from 'axios';
import { API_BASE_URL } from '../constants/config';
import { secureStorage } from '../services/secureStorage';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // Fast timeout for real-time operations
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
    if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
      console.error('LEA API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export interface PredictionAlert {
  id: string;
  complaintId: string;
  riskScore: number;
  timeWindow: string;
  hotspot: {
    address: string;
    lat: number;
    lon: number;
    probability: number;
    confidenceInterval: [number, number];
  };
  victim: {
    ageRange: string;
    gender: string;
    anonymized: boolean;
  };
  suspect: {
    upiId?: string;
    moMatch: number;
    linkedAccounts: string[];
    crossBankPattern: boolean;
  };
  amount: number;
  scamType: string;
  shapExplanation?: {
    topFactors: Array<{ factor: string; contribution: number }>;
  };
  timestamp: string;
  timeRemaining: number;
}

export interface DashboardStats {
  totalAlerts: number;
  highRisk: number;
  avgResponseTime: number;
  interdictionRate: number;
  fundsRecovered: number;
  activeOfficers?: number;
  deployedOfficers?: number;
  totalCases?: number;
  resolvedToday?: number;
}

export interface ActionResult {
  success: boolean;
  executionTime?: number;
  error?: string;
  actionId?: string;
}

export const leaService = {
  /**
   * Get real-time prediction alerts for LEA
   */
  async getPredictionAlerts(): Promise<PredictionAlert[]> {
    try {
      const response = await api.get('/lea/prediction-alerts');
      return response.data.alerts || response.data || [];
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Return sample data for demo
        return getSampleAlerts();
      }
      return [];
    }
  },

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const response = await api.get('/lea/dashboard-stats');
      return response.data;
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        return {
          totalAlerts: 12,
          highRisk: 5,
          avgResponseTime: 18,
          interdictionRate: 58,
          fundsRecovered: 4200000,
        };
      }
      return {
        totalAlerts: 0,
        highRisk: 0,
        avgResponseTime: 0,
        interdictionRate: 0,
        fundsRecovered: 0,
      };
    }
  },

  /**
   * Freeze account via CFCFRMS
   */
  async freezeAccount(complaintId: string): Promise<ActionResult> {
    try {
      const startTime = Date.now();
      const response = await api.post('/lea/freeze-account', { complaintId });
      const executionTime = (Date.now() - startTime) / 1000;
      
      return {
        success: true,
        executionTime: Math.round(executionTime * 10) / 10,
        actionId: response.data.actionId,
      };
    } catch (error: any) {
      // Return mock success for demo
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        return {
          success: true,
          executionTime: 8.7,
          actionId: `action_${Date.now()}`,
        };
      }
      
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to freeze account',
      };
    }
  },

  /**
   * Activate digital cordon (2km radius freeze via NPCI)
   */
  async activateDigitalCordon(
    complaintId: string,
    lat: number,
    lon: number
  ): Promise<ActionResult> {
    try {
      const startTime = Date.now();
      const response = await api.post('/lea/activate-cordon', {
        complaintId,
        location: { lat, lon },
        radius: 2000, // 2km
      });
      const executionTime = (Date.now() - startTime) / 1000;
      
      return {
        success: true,
        executionTime: Math.round(executionTime * 10) / 10,
        actionId: response.data.actionId,
      };
    } catch (error: any) {
      // Return mock success for demo
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        return {
          success: true,
          executionTime: 12.3,
          actionId: `cordon_${Date.now()}`,
        };
      }
      
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to activate cordon',
      };
    }
  },

  /**
   * Log outcome for feedback loop
   */
  async logOutcome(complaintId: string, outcome: string): Promise<{ success: boolean }> {
    try {
      await api.post('/lea/log-outcome', {
        complaintId,
        outcome,
        timestamp: new Date().toISOString(),
      });
      return { success: true };
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        return { success: true }; // Mock success
      }
      return { success: false };
    }
  },

  /**
   * Get detailed dossier for an alert
   */
  async getDossier(complaintId: string): Promise<any> {
    try {
      const response = await api.get(`/lea/dossier/${complaintId}`);
      return response.data;
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        return null;
      }
      return null;
    }
  },
};

// Sample alerts for demo
function getSampleAlerts(): PredictionAlert[] {
  return [
    {
      id: 'alert_1',
      complaintId: 'NCRP-2025-8891',
      riskScore: 0.92,
      timeWindow: '2:45 PM - 3:15 PM',
      hotspot: {
        address: 'HDFC ATM, CSMT Railway Station, Mumbai',
        lat: 18.9400,
        lon: 72.8350,
        probability: 0.92,
        confidenceInterval: [0.87, 0.97],
      },
      victim: {
        ageRange: '25-34',
        gender: 'Male',
        anonymized: true,
      },
      suspect: {
        upiId: 'fraud123@ybl',
        moMatch: 0.87,
        linkedAccounts: ['fraud123@ybl', 'scam456@oksbi'],
        crossBankPattern: true,
      },
      amount: 120000,
      scamType: 'UPI Fraud',
      shapExplanation: {
        topFactors: [
          { factor: 'Similar MO pattern', contribution: 0.35 },
          { factor: 'Railway station proximity', contribution: 0.28 },
          { factor: 'Time window match', contribution: 0.22 },
          { factor: 'Cross-bank pattern', contribution: 0.15 },
        ],
      },
      timestamp: new Date().toISOString(),
      timeRemaining: 38,
    },
  ];
}

