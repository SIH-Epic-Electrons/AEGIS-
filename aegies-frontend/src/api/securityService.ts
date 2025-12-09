/**
 * Security and Compliance Service
 * Handles all Phase 4 security and compliance API calls
 */

import axios from 'axios';
import { API_BASE_URL } from '../constants/config';

const securityApi = axios.create({
  baseURL: `${API_BASE_URL}/security`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
securityApi.interceptors.request.use((config) => {
  // In production, would get token from secure storage
  const token = 'mock-token'; // Would get from auth store
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface PrivacyBudget {
  global_remaining: number;
  global_used: number;
  global_total: number;
  user_remaining?: number;
  user_used?: number;
  user_total?: number;
}

export interface SecurityStatus {
  rate_limiting: {
    user_remaining?: number;
    ip_remaining?: number;
  };
  ddos_protection: {
    reputation_score: number;
    is_blacklisted: boolean;
  };
  privacy_budget: PrivacyBudget;
  compliance_status: {
    overall_compliant: boolean;
    dpdp: any;
    gdpr: any;
    security: any;
  };
  recent_security_events: any[];
}

export interface ComplianceStatus {
  overall_compliant: boolean;
  dpdp: {
    compliant: boolean;
    checks: Record<string, boolean>;
    privacy_budget: any;
  };
  gdpr: {
    compliant: boolean;
    checks: Record<string, boolean>;
  };
  security: {
    compliant: boolean;
    checks: Record<string, boolean>;
  };
  metrics: {
    privacy_budget_usage: number;
    data_retention_compliance: number;
    access_control_violations: number;
    data_deletion_requests: number;
    data_export_requests: number;
    security_incidents: number;
  };
}

export interface AuditLog {
  event_id: string;
  timestamp: string;
  event_type: string;
  source_service: string;
  data: any;
}

export const securityService = {
  /**
   * Get privacy budget status
   */
  async getPrivacyBudget(): Promise<PrivacyBudget> {
    const response = await securityApi.get('/privacy-budget');
    return response.data;
  },

  /**
   * Get comprehensive security status
   */
  async getSecurityStatus(): Promise<SecurityStatus> {
    const response = await securityApi.get('/status');
    return response.data;
  },

  /**
   * Get compliance status
   */
  async getComplianceStatus(): Promise<ComplianceStatus> {
    const response = await securityApi.get('/compliance');
    return response.data;
  },

  /**
   * Get audit logs
   */
  async getAuditLogs(params?: {
    event_type?: string;
    start_time?: string;
    end_time?: string;
    limit?: number;
  }): Promise<{ logs: AuditLog[]; total: number; limit: number }> {
    const response = await securityApi.get('/audit-logs', { params });
    return response.data;
  },

  /**
   * Get compliance report
   */
  async getComplianceReport(
    reportType: 'daily' | 'weekly' | 'monthly' | 'annual'
  ): Promise<any> {
    const response = await securityApi.get(`/compliance-reports/${reportType}`);
    return response.data;
  },

  /**
   * Request data deletion (DPDP Act)
   */
  async requestDataDeletion(userIdentifier: string): Promise<{
    success: boolean;
    request_id: string;
    status: string;
    message: string;
  }> {
    const response = await securityApi.post('/data-deletion/request', {
      user_identifier: userIdentifier,
    });
    return response.data;
  },

  /**
   * Request data export (DPDP Act)
   */
  async requestDataExport(
    userIdentifier: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<{
    success: boolean;
    request_id: string;
    status: string;
    message: string;
  }> {
    const response = await securityApi.post('/data-export/request', {
      user_identifier: userIdentifier,
      format,
    });
    return response.data;
  },

  /**
   * Get recent security events
   */
  async getSecurityEvents(limit: number = 50): Promise<{
    events: any[];
    total: number;
  }> {
    const response = await securityApi.get('/security-events', {
      params: { limit },
    });
    return response.data;
  },
};

