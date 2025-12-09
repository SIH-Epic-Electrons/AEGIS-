// Dashboard Service for LEA Officers
import { apiService } from './api';
import { cacheService } from './cacheService';
import { websocketService } from './websocketService';

export interface DashboardStats {
  // Today's metrics
  casesToday: number;
  casesResolved: number;
  casesActive: number;
  casesPending: number;

  // Financial metrics
  fundsRecovered: number;
  fundsAtRisk: number;
  recoveryRate: number;

  // Alert metrics
  highRiskAlerts: number;
  mediumRiskAlerts: number;
  lowRiskAlerts: number;
  alertsHandled: number;

  // Performance metrics
  avgResponseTime: number; // minutes
  interdictionRate: number; // percentage
  freezeSuccessRate: number;
  teamDeploymentRate: number;

  // Time-based trends
  casesLast24h: number;
  casesLast7d: number;
  casesLast30d: number;

  // Officer-specific
  myActiveCases: number;
  myCasesToday: number;
  mySuccessRate: number;

  // Department-wide
  departmentCases: number;
  departmentRecovery: number;

  // AI insights
  predictedSurge: {
    type: string;
    location: string;
    timeWindow: string;
    confidence: number;
  }[];
}

export interface ActivityItem {
  id: string;
  type: 'alert' | 'freeze' | 'deployment' | 'interception' | 'resolution';
  title: string;
  subtitle: string;
  timestamp: string;
  caseId?: string;
  alertId?: string;
  icon: string;
  color: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  actionRequired?: boolean;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  fromCache?: boolean;
}

const CACHE_TTL = {
  DASHBOARD: 5 * 60 * 1000, // 5 minutes
  ACTIVITY: 2 * 60 * 1000, // 2 minutes
};

// Get default date range (today)
function getDefaultDateRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

// Get dashboard statistics
export async function getDashboardStats(
  officerId: string,
  dateRange: { start: string; end: string } = getDefaultDateRange()
): Promise<ServiceResponse<DashboardStats>> {
  try {
    const cacheKey = `dashboard_stats_${officerId}_${dateRange.start}`;

    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return { success: true, data: cached as any, fromCache: true };
    }

    // Call API
    const response = await apiService.getStatistics();
    
    if (!response || !response.data) {
      // Return default stats if API fails
      return {
        success: true,
        data: {
          casesToday: 0,
          casesResolved: 0,
          casesActive: 0,
          casesPending: 0,
          fundsRecovered: 0,
          fundsAtRisk: 0,
          recoveryRate: 0,
          highRiskAlerts: 0,
          mediumRiskAlerts: 0,
          lowRiskAlerts: 0,
          alertsHandled: 0,
          avgResponseTime: 0,
          interdictionRate: 0,
          freezeSuccessRate: 0,
          teamDeploymentRate: 0,
          casesLast24h: 0,
          casesLast7d: 0,
          casesLast30d: 0,
          myActiveCases: 0,
          myCasesToday: 0,
          mySuccessRate: 0,
          departmentCases: 0,
          departmentRecovery: 0,
          predictedSurge: [],
        },
      };
    }

    // Transform API response to DashboardStats format
    const stats: DashboardStats = {
      casesToday: response.data.totalComplaints || 0,
      casesResolved: response.data.resolvedCases || 0,
      casesActive: response.data.activeCases || 0,
      casesPending: response.data.pendingCases || 0,
      fundsRecovered: response.data.fundsRecovered || 0,
      fundsAtRisk: response.data.fundsAtRisk || 0,
      recoveryRate: response.data.recoveryRate || 0,
      highRiskAlerts: response.data.highRiskAlerts || 0,
      mediumRiskAlerts: response.data.mediumRiskAlerts || 0,
      lowRiskAlerts: response.data.lowRiskAlerts || 0,
      alertsHandled: response.data.alertsHandled || 0,
      avgResponseTime: response.data.avgResponseTime || 0,
      interdictionRate: response.data.interdictionRate || 0,
      freezeSuccessRate: response.data.freezeSuccessRate || 0,
      teamDeploymentRate: response.data.teamDeploymentRate || 0,
      casesLast24h: response.data.casesLast24h || 0,
      casesLast7d: response.data.casesLast7d || 0,
      casesLast30d: response.data.casesLast30d || 0,
      myActiveCases: response.data.myActiveCases || 0,
      myCasesToday: response.data.myCasesToday || 0,
      mySuccessRate: response.data.mySuccessRate || 0,
      departmentCases: response.data.departmentCases || 0,
      departmentRecovery: response.data.departmentRecovery || 0,
      predictedSurge: response.data.predictedSurge || [],
    };

    // Cache the result
    await cacheService.set(cacheKey, stats, CACHE_TTL.DASHBOARD);

    return { success: true, data: stats };
  } catch (error: any) {
    // Suppress network errors in dev mode
    if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
      console.error('Error loading dashboard stats:', error);
    }
    
    // Try cache as fallback
    const cacheKey = `dashboard_stats_${officerId}_${dateRange.start}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return { success: true, data: cached as any, fromCache: true };
    }

    return { success: false, error: error.message || 'Failed to load dashboard statistics' };
  }
}

// Get live activity feed
export async function getLiveActivity(
  officerId: string,
  limit: number = 20
): Promise<ServiceResponse<ActivityItem[]>> {
  try {
    const cacheKey = `live_activity_${officerId}`;

    // Subscribe to real-time activity feed
    const unsubscribe = websocketService.subscribe(
      `activity_${officerId}`,
      (activity: ActivityItem) => {
        // This would update local state/store
        // For now, just log it
        console.log('Activity update received:', activity);
      }
    );

    // Get recent activities from API
    try {
      const response = await apiService.getAlerts({ role: 'lea', limit });
      
      // Transform alerts to activity items
      const activities: ActivityItem[] = (response || []).slice(0, limit).map((alert: any) => ({
        id: alert.id,
        type: 'alert' as const,
        title: alert.title || 'New Alert',
        subtitle: `${alert.fraudType || 'Fraud'} • ₹${formatAmount(alert.amount || 0)}`,
        timestamp: alert.timestamp || new Date().toISOString(),
        caseId: alert.caseId,
        alertId: alert.id,
        icon: 'warning',
        color: (alert.risk || 0) >= 0.9 ? '#ef4444' : (alert.risk || 0) >= 0.7 ? '#f59e0b' : '#3b82f6',
        priority: alert.risk >= 0.9 ? 'critical' : alert.risk >= 0.7 ? 'high' : 'medium',
        actionRequired: true,
      }));

      // Cache the result
      await cacheService.set(cacheKey, activities, CACHE_TTL.ACTIVITY);

      return { success: true, data: activities };
    } catch (apiError) {
      // Try cache as fallback
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return { success: true, data: (Array.isArray(cached) ? cached : []) as any, fromCache: true };
      }

      // Return empty array if both API and cache fail
      return { success: true, data: [] };
    }
  } catch (error: any) {
    // Suppress network errors in dev mode
    if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
      console.error('Error loading live activity:', error);
    }
    return { success: false, error: error.message || 'Failed to load activity feed' };
  }
}

// Helper function to format amount
function formatAmount(amount: number): string {
  if (amount >= 100000) {
    return `${(amount / 100000).toFixed(1)}L`;
  }
  return amount.toLocaleString();
}

