import axios from 'axios';
import { Action, Evidence } from '../types';
import { API_BASE_URL } from '../constants/config';
import { secureStorage } from '../services/secureStorage';
import * as FileSystem from 'expo-file-system';
import { retry, retryConfigs } from '../services/retryService';
import { circuitBreakers } from '../services/circuitBreakerService';
import { handleError, logError, StructuredError } from '../services/errorHandlerService';
import { validateAction, validateOutcome, validateEvidence, sanitizeString } from '../utils/validators';
import { modelMonitoringService } from '../services/modelMonitoringService';

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: StructuredError;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // Longer timeout for file uploads
});

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    const token = await secureStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    config.headers['X-Request-ID'] = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (__DEV__) {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        status: response.status,
      });
    }
    return response;
  },
  (error) => {
    const structuredError = handleError(error, `API ${error.config?.method?.toUpperCase()} ${error.config?.url}`);
    logError(structuredError, {
      url: error.config?.url,
      method: error.config?.method,
    });
    return Promise.reject(structuredError);
  }
);

export const actionService = {
  /**
   * Submit an action (freeze, navigate, outcome, etc.)
   */
  async submitAction(action: Action): Promise<ServiceResponse<void>> {
    // Validate input
    const validation = validateAction(action);
    if (!validation.valid) {
      return {
        success: false,
        error: handleError(
          new Error(validation.error || 'Invalid action data'),
          'submitAction'
        ),
      };
    }

    // Sanitize string fields
    if (action.data && typeof action.data === 'object') {
      Object.keys(action.data).forEach((key) => {
        if (typeof action.data[key] === 'string') {
          action.data[key] = sanitizeString(action.data[key]);
        }
      });
    }

    if (circuitBreakers.actions.isOpen()) {
      return {
        success: false,
        error: handleError(new Error('Service temporarily unavailable'), 'submitAction'),
      };
    }

    try {
      const result = await retry(
        () => circuitBreakers.actions.execute(() => api.post('/actions', action)),
        retryConfigs.critical
      );

      if (result.success) {
        return { success: true };
      }

      return {
        success: false,
        error: result.error || handleError(new Error('Unknown error'), 'submitAction'),
      };
    } catch (error: any) {
      return {
        success: false,
        error: handleError(error, 'submitAction'),
      };
    }
  },

  /**
   * Activate digital cordon via NPCI
   */
  async activateCordon(
    alertId: string,
    hotspotId: string
  ): Promise<ServiceResponse<{ message: string }>> {
    if (circuitBreakers.actions.isOpen()) {
      return {
        success: false,
        error: handleError(new Error('Service temporarily unavailable'), 'activateCordon'),
      };
    }

    try {
      const result = await retry(
        () => circuitBreakers.actions.execute(() => api.post(`/alerts/${alertId}/cordon`, { hotspotId })),
        retryConfigs.critical
      );

      if (result.success && result.data) {
        return {
          success: true,
          data: result.data.data,
        };
      }

      return {
        success: false,
        error: result.error || handleError(new Error('Unknown error'), 'activateCordon'),
      };
    } catch (error: any) {
      return {
        success: false,
        error: handleError(error, 'activateCordon'),
      };
    }
  },

  /**
   * Deactivate digital cordon
   */
  async deactivateCordon(alertId: string): Promise<ServiceResponse<void>> {
    if (circuitBreakers.actions.isOpen()) {
      return {
        success: false,
        error: handleError(new Error('Service temporarily unavailable'), 'deactivateCordon'),
      };
    }

    try {
      const result = await retry(
        () => circuitBreakers.actions.execute(() => api.delete(`/alerts/${alertId}/cordon`)),
        retryConfigs.critical
      );

      if (result.success) {
        return { success: true };
      }

      return {
        success: false,
        error: result.error || handleError(new Error('Unknown error'), 'deactivateCordon'),
      };
    } catch (error: any) {
      return {
        success: false,
        error: handleError(error, 'deactivateCordon'),
      };
    }
  },

  /**
   * Upload evidence with DPDP-compliant redaction
   */
  async uploadEvidence(evidence: Evidence): Promise<ServiceResponse<void>> {
    // Validate input
    const validation = validateEvidence(evidence);
    if (!validation.valid) {
      return {
        success: false,
        error: handleError(
          new Error(validation.error || 'Invalid evidence data'),
          'uploadEvidence'
        ),
      };
    }

    if (circuitBreakers.actions.isOpen()) {
      return {
        success: false,
        error: handleError(new Error('Service temporarily unavailable'), 'uploadEvidence'),
      };
    }

    try {
      const formData = new FormData();
      formData.append('file', {
        uri: evidence.uri,
        type: evidence.type === 'photo' ? 'image/jpeg' : 'video/mp4',
        name: `evidence_${evidence.id}.${evidence.type === 'photo' ? 'jpg' : 'mp4'}`,
      } as any);
      formData.append('alertId', evidence.alertId);
      formData.append('type', evidence.type);
      formData.append('annotations', JSON.stringify(evidence.annotations || []));
      formData.append('redacted', evidence.redacted.toString());

      const result = await retry(
        () =>
          circuitBreakers.actions.execute(() =>
            api.post('/evidence', formData, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
              timeout: 60000,
            })
          ),
        retryConfigs.fileUpload
      );

      if (result.success) {
        return { success: true };
      }

      return {
        success: false,
        error: result.error || handleError(new Error('Unknown error'), 'uploadEvidence'),
      };
    } catch (error: any) {
      return {
        success: false,
        error: handleError(error, 'uploadEvidence'),
      };
    }
  },

  /**
   * Submit interdiction outcome and report to I4C
   */
  async submitOutcome(
    alertId: string,
    outcome: {
      success: boolean;
      amountRecovered?: number;
      suspectApprehended?: boolean;
      notes?: string;
      newState?: string; // If fraudster moved to another state
    }
  ): Promise<ServiceResponse<void>> {
    // Validate input
    const validation = validateOutcome(outcome);
    if (!validation.valid) {
      return {
        success: false,
        error: handleError(
          new Error(validation.error || 'Invalid outcome data'),
          'submitOutcome'
        ),
      };
    }

    // Sanitize notes if provided
    if (outcome.notes) {
      outcome.notes = sanitizeString(outcome.notes);
    }

    if (circuitBreakers.actions.isOpen()) {
      return {
        success: false,
        error: handleError(new Error('Service temporarily unavailable'), 'submitOutcome'),
      };
    }

    try {
      const result = await retry(
        () => circuitBreakers.actions.execute(() => api.post(`/alerts/${alertId}/outcome`, outcome)),
        retryConfigs.critical
      );

      if (result.success) {
        // Record outcome for model monitoring (non-blocking)
        // Note: This requires predictionId which should be passed in outcome
        if (outcome.success && 'predictionId' in outcome) {
          modelMonitoringService.recordOutcome({
            predictionId: (outcome as any).predictionId,
            timestamp: new Date().toISOString(),
            riskScore: 0.5, // This should come from the original prediction
            actualOutcome: outcome.success,
            amountRecovered: outcome.amountRecovered,
          }).catch((err) => console.warn('Failed to record outcome:', err));
        }

        // Also report to I4C for national coordination (non-blocking)
        try {
          await import('../services/i4cCoordinationService').then(({ i4cCoordinationService }) =>
            i4cCoordinationService.reportInterdiction(alertId, {
              success: outcome.success,
              suspectApprehended: outcome.suspectApprehended || false,
              amountRecovered: outcome.amountRecovered || 0,
              newState: outcome.newState,
              notes: outcome.notes,
            })
          );
        } catch (i4cError) {
          // Log but don't fail the main outcome submission
          console.warn('I4C coordination report failed:', i4cError);
        }

        return { success: true };
      }

      return {
        success: false,
        error: result.error || handleError(new Error('Unknown error'), 'submitOutcome'),
      };
    } catch (error: any) {
      return {
        success: false,
        error: handleError(error, 'submitOutcome'),
      };
    }
  },

  /**
   * Freeze account via CFCFRMS
   */
  async freezeAccount(
    alertId: string,
    complaintId: string
  ): Promise<ServiceResponse<{ message: string }>> {
    if (circuitBreakers.actions.isOpen()) {
      return {
        success: false,
        error: handleError(new Error('Service temporarily unavailable'), 'freezeAccount'),
      };
    }

    try {
      const result = await retry(
        () => circuitBreakers.actions.execute(() => api.post(`/alerts/${alertId}/freeze`, { complaintId })),
        retryConfigs.critical
      );

      if (result.success && result.data) {
        return {
          success: true,
          data: result.data.data,
        };
      }

      return {
        success: false,
        error: result.error || handleError(new Error('Unknown error'), 'freezeAccount'),
      };
    } catch (error: any) {
      return {
        success: false,
        error: handleError(error, 'freezeAccount'),
      };
    }
  },
};

