/**
 * Case Management Service
 * Implements /cases/* endpoints according to API documentation
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
      console.error('Case API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export interface CreateCaseRequest {
  ncrp_complaint_id: string;
  fraud_type: 'UPI_FRAUD' | 'OTP_FRAUD' | 'PHISHING' | 'LOAN_FRAUD' | 'INVESTMENT_FRAUD' | 'KYC_FRAUD';
  fraud_amount: number;
  fraud_description?: string;
  fraud_timestamp?: string;
  destination_account: {
    account_number: string;
    bank_name: string;
    ifsc_code: string;
    upi_id?: string;
  };
  victim: {
    name: string;
    phone: string;
    email?: string;
    city: string;
    location?: {
      lat: number;
      lon: number;
    };
  };
}

export interface CreateCaseResponse {
  case_id: string;
  case_number: string;
  status: string;
  priority: string;
  message: string;
  estimated_analysis_time_seconds: number;
  helpline?: string;
  tracking_note?: string;
}

// Create a separate axios instance for public endpoints (no auth required)
const publicApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

// Response interceptor for public API
publicApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
      console.error('Public API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export interface CaseListItem {
  case_id: string;
  case_number: string;
  status: string;
  priority: string;
  fraud_type: string;
  fraud_amount: number;
  victim_name: string;
  victim_city: string;
  destination_account: {
    account_number: string;
    bank: string;
    upi_id?: string;
  };
  location_confidence: number;
  created_at: string;
}

export interface CasesListResponse {
  cases: CaseListItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export interface CaseDetails {
  case_id: string;
  case_number: string;
  status: string;
  priority: string;
  complaint: {
    ncrp_id: string;
    fraud_type: string;
    fraud_amount: number;
    description: string;
    reported_at: string;
  };
  destination_account: {
    account_number: string;
    bank: string;
    ifsc: string;
    upi_id?: string;
  };
  victim: {
    name: string;
    phone: string;
    city: string;
  };
  prediction?: {
    predicted_atm: {
      id: string;
      name: string;
      bank: string;
      address: string;
    };
    time_window: {
      start: string;
      end: string;
    };
    confidence: number;
    alternative_locations: any[];
  };
  mule_accounts_summary: {
    total: number;
    active: number;
    frozen: number;
    total_amount: number;
  };
  created_at: string;
  updated_at: string;
}

export interface MuleAccount {
  id: string;
  account_number: string;
  bank: string;
  holder_name: string;
  amount_received: number;
  current_balance: number;
  status: 'ACTIVE' | 'FROZEN' | 'WITHDRAWN';
  mule_confidence: number;
  hop_number: number;
  risk_indicators: string[];
}

export interface Transaction {
  id: string;
  from_account: string;
  from_bank: string;
  from_holder_name?: string;
  to_account: string;
  to_bank: string;
  to_holder_name?: string;
  amount: number;
  transaction_type: 'IMPS' | 'UPI' | 'NEFT' | 'RTGS';
  transaction_id: string;
  timestamp: string;
  hop_number: number;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  // Split information
  split_group_id?: string | null;
  split_index?: number | null;
  split_total?: number | null;
  is_split?: boolean;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const caseService = {
  /**
   * Submit NCRP Complaint - POST /public/ncrp/complaints
   * Public endpoint - No authentication required
   * For citizens to report cyber fraud
   */
  async submitNCRPComplaint(caseData: CreateCaseRequest): Promise<ServiceResponse<CreateCaseResponse>> {
    try {
      console.log('Submitting NCRP complaint to public endpoint:', JSON.stringify(caseData, null, 2));
      const response = await publicApi.post<{ success: boolean; data: CreateCaseResponse }>(
        '/public/ncrp/complaints', 
        caseData
      );
      console.log('NCRP response:', JSON.stringify(response.data, null, 2));
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      console.error('NCRP submission error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to submit complaint',
      };
    }
  },

  /**
   * 3.1 Create Case - POST /cases (Requires Auth)
   * For authenticated LEA officers to create cases
   */
  async createCase(caseData: CreateCaseRequest): Promise<ServiceResponse<CreateCaseResponse>> {
    try {
      const response = await api.post<{ success: boolean; data: CreateCaseResponse }>('/cases', caseData);
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to create case',
      };
    }
  },

  /**
   * 3.2 List Cases - GET /cases
   * Query params: status, priority, assigned_to, limit, offset
   */
  async listCases(params?: {
    status?: string;
    priority?: string;
    assigned_to?: string; // 'me' for current officer
    limit?: number;
    offset?: number;
  }): Promise<ServiceResponse<CasesListResponse>> {
    try {
      const response = await api.get<{ success: boolean; data: CasesListResponse }>('/cases', { params });
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to list cases',
      };
    }
  },

  /**
   * 3.3 Get Case Details - GET /cases/{case_id}
   */
  async getCaseDetails(caseId: string): Promise<ServiceResponse<CaseDetails>> {
    try {
      const response = await api.get<{ success: boolean; data: CaseDetails }>(`/cases/${caseId}`);
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to get case details',
      };
    }
  },

  /**
   * 3.4 Get Case Mule Accounts - GET /cases/{case_id}/mule-accounts
   */
  async getCaseMuleAccounts(caseId: string): Promise<ServiceResponse<{ case_id: string; mule_accounts: MuleAccount[] }>> {
    try {
      const response = await api.get<{ success: boolean; data: { case_id: string; mule_accounts: MuleAccount[] } }>(
        `/cases/${caseId}/mule-accounts`
      );
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to get mule accounts',
      };
    }
  },

  /**
   * 3.5 Get Case Transactions - GET /cases/{case_id}/transactions
   */
  async getCaseTransactions(caseId: string): Promise<ServiceResponse<{ case_id: string; transactions: Transaction[]; splits?: Record<string, any[]> }>> {
    try {
      const response = await api.get<{ success: boolean; data: { case_id: string; transactions: Transaction[]; splits?: Record<string, any[]> } }>(
        `/cases/${caseId}/transactions`
      );
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to get transactions',
      };
    }
  },

  /**
   * Freeze accounts for a case - POST /freeze/cases/{case_id}/freeze
   */
  async freezeAccounts(caseId: string, accountIds?: string[], freezeType: string = 'TEMPORARY'): Promise<ServiceResponse<FreezeResponse>> {
    try {
      const response = await api.post<{ success: boolean; data: FreezeResponse }>(
        `/freeze/cases/${caseId}/freeze`,
        {
          account_ids: accountIds,
          freeze_type: freezeType,
          duration_hours: 72,
          reason: 'Suspected involvement in cyber fraud',
        }
      );
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to freeze accounts',
      };
    }
  },

  /**
   * Get freeze status for a case - GET /freeze/cases/{case_id}/freeze-status
   */
  async getFreezeStatus(caseId: string): Promise<ServiceResponse<FreezeStatusResponse>> {
    try {
      const response = await api.get<{ success: boolean; data: FreezeStatusResponse }>(
        `/freeze/cases/${caseId}/freeze-status`
      );
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to get freeze status',
      };
    }
  },

  /**
   * Get case report - GET /reports/cases/{case_id}/report
   */
  async getCaseReport(caseId: string): Promise<ServiceResponse<CaseReport>> {
    try {
      const response = await api.get<{ success: boolean; data: CaseReport }>(
        `/reports/cases/${caseId}/report`
      );
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to get case report',
      };
    }
  },

  /**
   * Record case outcome for RL training - POST /reports/cases/{case_id}/outcome
   */
  async recordOutcome(caseId: string, outcome: OutcomeData): Promise<ServiceResponse<{ message: string }>> {
    try {
      const response = await api.post<{ success: boolean; data: { message: string } }>(
        `/reports/cases/${caseId}/outcome`,
        outcome
      );
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to record outcome',
      };
    }
  },

  /**
   * Get mule accounts for a case - GET /cases/{case_id}/mule-accounts
   */
  async getMuleAccounts(caseId: string): Promise<ServiceResponse<{
    case_id: string;
    mule_accounts: Array<{
      id: string;
      account_number: string;
      bank: string;
      holder_name: string;
      amount_received: number;
      current_balance: number;
      status: string;
      mule_confidence: number;
      hop_number: number;
      risk_indicators: string[];
    }>;
  }>> {
    try {
      const response = await api.get<{ success: boolean; data: any }>(`/cases/${caseId}/mule-accounts`);
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to get mule accounts',
      };
    }
  },

  /**
   * Download case report as PDF - GET /reports/cases/{case_id}/report/pdf
   */
  async downloadReportPDF(caseId: string): Promise<ServiceResponse<Blob>> {
    try {
      const response = await api.get(`/reports/cases/${caseId}/report/pdf`, {
        responseType: 'blob',
      });
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to download report',
      };
    }
  },

  /**
   * Get case timeline - GET /reports/cases/{case_id}/timeline
   */
  async getCaseTimeline(caseId: string): Promise<ServiceResponse<CaseTimeline>> {
    try {
      const response = await api.get<{ success: boolean; data: CaseTimeline }>(
        `/reports/cases/${caseId}/timeline`
      );
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to get timeline',
      };
    }
  },
};

// Additional types for freeze and report
export interface FreezeResponse {
  freeze_id: string;
  npci_reference: string;
  status: string;
  accounts_frozen: number;
  total_amount_secured: number;
  freeze_time_ms: number;
  frozen_accounts: any[];
  expires_at?: string;
  message: string;
}

export interface FreezeStatusResponse {
  case_id: string;
  summary: {
    total_accounts: number;
    frozen: number;
    active: number;
    total_amount_secured: number;
  };
  accounts: any[];
  freeze_history: any[];
}

export interface CaseReport {
  case_id: string;
  case_number: string;
  status: string;
  outcome_summary: {
    total_fraud_amount: number;
    amount_recovered: number;
    recovery_rate: number;
    response_time_seconds: number;
    response_time_formatted: string;
    mule_accounts_frozen: number;
    suspect_apprehended: boolean;
  };
  ai_prediction_accuracy: {
    location_match: string;
    location_accuracy: number;
    time_accuracy: number;
    mule_detection_accuracy: number;
    overall_confidence: number;
  };
  analysis_steps: Array<{
    step: number;
    title: string;
    description: string;
    time_seconds: number;
    details?: string | string[];
    confidence?: number;
    tags?: string[];
    color: string;
  }>;
  ai_insights: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
  feature_importance: Array<{
    feature: string;
    importance: number;
    color: string;
  }>;
  technical_details: {
    model: string;
    training_data: string;
    federated_banks: number;
    location_accuracy: string;
    inference_time_ms: number;
  };
  victim: {
    name: string;
    city: string;
  };
  prediction: {
    predicted_atm: {
      name: string;
      bank: string;
      address: string;
    } | null;
    confidence: number | null;
    time_window: {
      start: string | null;
      end: string | null;
    };
  };
  mule_accounts: Array<{
    bank: string;
    status: string;
    amount: number;
    confidence: number;
  }>;
  created_at: string;
  resolved_at: string | null;
}

export interface OutcomeData {
  was_successful: boolean;
  suspect_apprehended?: boolean;
  amount_recovered?: number;
  location_accuracy?: 'exact_match' | 'nearby' | 'different' | 'unknown';
  intervention_outcome?: 'apprehended' | 'recovered' | 'both' | 'unsuccessful';
  actual_atm_id?: string;
  actual_atm_name?: string;
  response_time_seconds?: number;
  notes?: string;
}

export interface CaseTimeline {
  case_id: string;
  case_number: string;
  events: Array<{
    timestamp: string;
    type: string;
    title: string;
    description: string;
    icon: string;
    color: string;
  }>;
}

