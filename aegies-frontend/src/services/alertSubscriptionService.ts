// Alert Subscription Service for Real-Time Alerts
import { apiService } from './api';
import { websocketService } from './websocketService';
import { notificationService } from './notificationService';
import { Alert } from '../types';

export interface AlertFilters {
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'new' | 'active' | 'resolved';
  proximity?: number; // km radius
  fraudType?: string[];
  amountMin?: number;
  amountMax?: number;
}

export interface SubscriptionHandle {
  unsubscribe: () => void;
}

// Subscribe to real-time alerts
export async function subscribeToAlerts(
  officerId: string,
  filters: AlertFilters = {}
): Promise<SubscriptionHandle> {
  try {
    // 1. Subscribe to WebSocket channel
    const channel = `alerts_${officerId}`;

    const unsubscribe = websocketService.subscribe(channel, (alert: Alert) => {
      // 2. Apply filters
      if (shouldShowAlert(alert, filters)) {
        // 3. Show notification
        handleNewAlert(alert);

        // 4. Play sound if high priority
        if (alert.risk && alert.risk >= 0.85) {
          // Sound service would be called here
          console.log('High priority alert sound');
        }
      }
    });

    // 5. Request initial alerts
    const initialAlerts = await getAlerts(filters);
    
    return { unsubscribe };
  } catch (error) {
    console.error('Error subscribing to alerts:', error);
    // Return a no-op unsubscribe function
    return { unsubscribe: () => {} };
  }
}

// Check if alert should be shown based on filters
function shouldShowAlert(alert: Alert, filters: AlertFilters): boolean {
  // Risk level filter
  if (filters.riskLevel) {
    const riskMap = {
      critical: [0.9, 1.0],
      high: [0.85, 0.9],
      medium: [0.7, 0.85],
      low: [0.0, 0.7],
    };
    const [min, max] = riskMap[filters.riskLevel];
    if (!alert.risk || alert.risk < min || alert.risk >= max) {
      return false;
    }
  }

  // Status filter
  if (filters.status) {
    const statusMap: Record<string, string> = {
      new: 'pending',
      active: 'active',
      resolved: 'resolved',
    };
    if (alert.status !== statusMap[filters.status]) {
      return false;
    }
  }

  // Fraud type filter
  if (filters.fraudType && filters.fraudType.length > 0) {
    // This would need to check alert.fraudType if available
    // For now, skip this check
  }

  // Amount range filter
  if (filters.amountMin && alert.amount < filters.amountMin) {
    return false;
  }
  if (filters.amountMax && alert.amount > filters.amountMax) {
    return false;
  }

  return true;
}

// Handle new alert notification
async function handleNewAlert(alert: Alert): Promise<void> {
  try {
    // Determine notification priority
    const priority = alert.risk && alert.risk >= 0.9 ? 'high' : 'normal';

    // Show system notification
    await notificationService.notifyAlert({
      ...alert,
      id: alert.id,
      title: `🚨 ${alert.risk && alert.risk >= 0.9 ? 'CRITICAL' : 'High-Risk'} Alert`,
      risk: alert.risk || 0.8,
      amount: alert.amount || 0,
      fraudType: alert.type || 'Unknown',
      timestamp: new Date().toISOString(),
      complaintId: alert.complaintId,
    });
  } catch (error) {
    console.error('Error showing alert notification:', error);
  }
}

// Get alerts with filters
async function getAlerts(filters: AlertFilters = {}): Promise<Alert[]> {
  try {
    const params: any = { role: 'lea' };
    
    if (filters.riskLevel) {
      params.riskLevel = filters.riskLevel;
    }
    if (filters.status) {
      params.status = filters.status;
    }

    const alerts = await apiService.getAlerts(params);
    return Array.isArray(alerts) ? alerts : [];
  } catch (error: any) {
    // Suppress network errors in dev mode
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
      if (__DEV__) {
        // Silently return empty array in dev mode for network errors
        return [];
      }
    } else {
      console.error('Error fetching alerts:', error);
    }
    return [];
  }
}

// Helper function to format amount
function formatAmount(amount: number): string {
  if (amount >= 100000) {
    return `${(amount / 100000).toFixed(1)}L`;
  }
  return amount.toLocaleString();
}

