import axios from 'axios';
import { Alert, Dossier } from '../types';
import { API_BASE_URL } from '../constants/config';
import { secureStorage } from '../services/secureStorage';
import { i4cCoordinationService } from '../services/i4cCoordinationService';
import { retry, retryConfigs } from '../services/retryService';
import { circuitBreakers } from '../services/circuitBreakerService';
import { handleError, logError, StructuredError } from '../services/errorHandlerService';
import { cacheService, CACHE_TTL, cacheKeys } from '../services/cacheService';
import { validateAlertFilters } from '../utils/validators';

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: StructuredError;
  fromCache?: boolean;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
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
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
        params: config.params,
      });
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor with error handling
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
      requestId: error.config?.headers?.['X-Request-ID'],
    });
    return Promise.reject(structuredError);
  }
);

export const alertService = {
  /**
   * Get all alerts for LEA with I4C coordination data
   */
  async getAlerts(filters?: {
    stateCode?: string;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    crossStateOnly?: boolean;
  }): Promise<ServiceResponse<Alert[]>> {
    // Validate filters if provided
    if (filters) {
      const validation = validateAlertFilters(filters);
      if (!validation.valid) {
        return {
          success: false,
          error: handleError(
            new Error(validation.error || 'Invalid filter parameters'),
            'getAlerts'
          ),
        };
      }
    }

    const cacheKey = cacheKeys.alerts(filters);
    
    // Check cache first
    const cached = await cacheService.getWithMetadata<Alert[]>(cacheKey);
    if (cached) {
      return {
        success: true,
        data: cached.data,
        fromCache: true,
      };
    }

    // Check circuit breaker
    if (circuitBreakers.alerts.isOpen()) {
      const fallbackCache = await cacheService.get<Alert[]>(cacheKey);
      if (fallbackCache) {
        return {
          success: true,
          data: fallbackCache,
          fromCache: true,
        };
      }
      return {
        success: false,
        error: handleError(new Error('Service temporarily unavailable'), 'getAlerts'),
      };
    }

    try {
      const params: any = { role: 'lea' };
      if (filters?.stateCode) params.stateCode = filters.stateCode;
      if (filters?.riskLevel) params.riskLevel = filters.riskLevel;
      if (filters?.crossStateOnly) params.crossStateOnly = true;

      const result = await retry(
        () => circuitBreakers.alerts.execute(() => api.get('/alerts', { params })),
        retryConfigs.critical
      );

      if (result.success && result.data) {
        const alerts: Alert[] = result.data.data.alerts || result.data.data || [];

        // Enrich with I4C coordination data for cross-state alerts
        const enrichedAlerts = await Promise.all(
          alerts.map(async (alert) => {
            try {
              const coordination = await i4cCoordinationService.checkCrossStateCoordination(
                alert.id
              );
              
              if (coordination.requiresCoordination) {
                return {
                  ...alert,
                  i4cCoordination: {
                    required: true,
                    matchingStates: coordination.matchingStates,
                    patternId: coordination.patternId,
                    riskLevel: coordination.riskLevel,
                  },
                };
              }
              return alert;
            } catch (error) {
              // If I4C coordination fails, return alert without enrichment
              console.warn('I4C coordination failed for alert:', alert.id);
              return alert;
            }
          })
        );

        // Cache the result
        await cacheService.set(cacheKey, enrichedAlerts, CACHE_TTL.ALERTS);
        
        return {
          success: true,
          data: enrichedAlerts,
          fromCache: false,
        };
      }

      // Try cache as fallback
      const fallbackCache = await cacheService.get<Alert[]>(cacheKey);
      if (fallbackCache) {
        return {
          success: true,
          data: fallbackCache,
          fromCache: true,
        };
      }

      return {
        success: false,
        error: result.error || handleError(new Error('Unknown error'), 'getAlerts'),
      };
    } catch (error: any) {
      const structuredError = handleError(error, 'getAlerts');
      const fallbackCache = await cacheService.get<Alert[]>(cacheKey);
      if (fallbackCache) {
        return {
          success: true,
          data: fallbackCache,
          fromCache: true,
        };
      }
      return {
        success: false,
        error: structuredError,
      };
    }
  },

  /**
   * Get alert by ID with full dossier and I4C coordination
   */
  async getAlertById(id: string): Promise<ServiceResponse<Alert>> {
    const cacheKey = cacheKeys.alert(id);
    
    // Check cache first
    const cached = await cacheService.getWithMetadata<Alert>(cacheKey);
    if (cached) {
      return {
        success: true,
        data: cached.data,
        fromCache: true,
      };
    }

    if (circuitBreakers.alerts.isOpen()) {
      const fallbackCache = await cacheService.get<Alert>(cacheKey);
      if (fallbackCache) {
        return {
          success: true,
          data: fallbackCache,
          fromCache: true,
        };
      }
      return {
        success: false,
        error: handleError(new Error('Service temporarily unavailable'), 'getAlertById'),
      };
    }

    try {
      const result = await retry(
        () => circuitBreakers.alerts.execute(() => api.get(`/alerts/${id}`)),
        retryConfigs.critical
      );

      if (result.success && result.data) {
        const alert: Alert = result.data.data;

        // Check I4C coordination
        try {
          const coordination = await i4cCoordinationService.checkCrossStateCoordination(id);
          
          const enrichedAlert = {
            ...alert,
            i4cCoordination: coordination.requiresCoordination
              ? {
                  required: true,
                  matchingStates: coordination.matchingStates,
                  patternId: coordination.patternId,
                  riskLevel: coordination.riskLevel,
                }
              : undefined,
          };

          // Cache the result
          await cacheService.set(cacheKey, enrichedAlert, CACHE_TTL.ALERTS);
          
          return {
            success: true,
            data: enrichedAlert,
            fromCache: false,
          };
        } catch (coordinationError) {
          // If coordination fails, return alert without enrichment
          console.warn('I4C coordination failed for alert:', id);
          await cacheService.set(cacheKey, alert, CACHE_TTL.ALERTS);
          return {
            success: true,
            data: alert,
            fromCache: false,
          };
        }
      }

      // Try cache as fallback
      const fallbackCache = await cacheService.get<Alert>(cacheKey);
      if (fallbackCache) {
        return {
          success: true,
          data: fallbackCache,
          fromCache: true,
        };
      }

      return {
        success: false,
        error: result.error || handleError(new Error('Unknown error'), 'getAlertById'),
      };
    } catch (error: any) {
      const structuredError = handleError(error, 'getAlertById');
      const fallbackCache = await cacheService.get<Alert>(cacheKey);
      if (fallbackCache) {
        return {
          success: true,
          data: fallbackCache,
          fromCache: true,
        };
      }
      return {
        success: false,
        error: structuredError,
      };
    }
  },

  /**
   * Get dossier for an alert with cross-state intelligence
   */
  async getDossier(alertId: string): Promise<ServiceResponse<Dossier>> {
    const cacheKey = cacheKeys.dossier(alertId);
    
    // Check cache first
    const cached = await cacheService.getWithMetadata<Dossier>(cacheKey);
    if (cached) {
      return {
        success: true,
        data: cached.data,
        fromCache: true,
      };
    }

    if (circuitBreakers.alerts.isOpen()) {
      const fallbackCache = await cacheService.get<Dossier>(cacheKey);
      if (fallbackCache) {
        return {
          success: true,
          data: fallbackCache,
          fromCache: true,
        };
      }
      return {
        success: false,
        error: handleError(new Error('Service temporarily unavailable'), 'getDossier'),
      };
    }

    try {
      const result = await retry(
        () => circuitBreakers.alerts.execute(() => api.get(`/alerts/${alertId}/dossier`)),
        retryConfigs.critical
      );

      if (result.success && result.data) {
        const dossier: Dossier = result.data.data;

        // Get cross-state patterns if available
        try {
          const coordination = await i4cCoordinationService.checkCrossStateCoordination(alertId);
          if (coordination.patternId) {
            const patterns = await i4cCoordinationService.getCrossStatePatterns();
            const pattern = patterns.find((p) => p.patternId === coordination.patternId);
            
            if (pattern) {
              const enrichedDossier = {
                ...dossier,
                crossStateIntelligence: {
                  patternId: pattern.patternId,
                  affectedStates: pattern.affectedStates,
                  totalComplaints: pattern.totalComplaints,
                  totalAmount: pattern.totalAmount,
                  predictedNextState: pattern.predictedNextState,
                  confidence: pattern.confidence,
                },
              };
              
              await cacheService.set(cacheKey, enrichedDossier, CACHE_TTL.ALERTS);
              return {
                success: true,
                data: enrichedDossier,
                fromCache: false,
              };
            }
          }
        } catch (coordinationError) {
          console.warn('I4C coordination failed for dossier:', alertId);
        }

        // Cache the result
        await cacheService.set(cacheKey, dossier, CACHE_TTL.ALERTS);
        return {
          success: true,
          data: dossier,
          fromCache: false,
        };
      }

      // Try cache as fallback
      const fallbackCache = await cacheService.get<Dossier>(cacheKey);
      if (fallbackCache) {
        return {
          success: true,
          data: fallbackCache,
          fromCache: true,
        };
      }

      return {
        success: false,
        error: result.error || handleError(new Error('Unknown error'), 'getDossier'),
      };
    } catch (error: any) {
      const structuredError = handleError(error, 'getDossier');
      const fallbackCache = await cacheService.get<Dossier>(cacheKey);
      if (fallbackCache) {
        return {
          success: true,
          data: fallbackCache,
          fromCache: true,
        };
      }
      return {
        success: false,
        error: structuredError,
      };
    }
  },

  /**
   * Submit alert for I4C national coordination
   */
  async submitForI4CCoordination(
    alertId: string,
    priority: 'standard' | 'high' | 'critical' = 'standard'
  ): Promise<ServiceResponse<{ coordinationId: string }>> {
    try {
      const result = await i4cCoordinationService.submitForCoordination(alertId, priority);
      if (result.success && result.coordinationId) {
        return {
          success: true,
          data: { coordinationId: result.coordinationId },
          fromCache: false,
        };
      }
      return {
        success: false,
        error: handleError(new Error(result.error || 'I4C coordination failed'), 'submitForI4CCoordination'),
      };
    } catch (error: any) {
      return {
        success: false,
        error: handleError(error, 'submitForI4CCoordination'),
      };
    }
  },
};

