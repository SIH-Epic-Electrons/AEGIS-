import { Action } from '../types';
import { useAuthStore } from '../store/authStore';
import { apiService } from './api';

/**
 * Audit Service - Logs all critical actions to backend
 * for Hyperledger Fabric audit trail
 */

export interface AuditEvent {
  eventType: 'ComplaintFiled' | 'AlertTriggered' | 'CordonActivated' | 'OutcomeLogged' | 'EvidenceCaptured' | 'ActionTaken';
  officerId: string;
  timestamp: string;
  alertId?: string;
  complaintId?: string;
  actionType?: string;
  metadata?: Record<string, any>;
}

class AuditService {
  private queue: AuditEvent[] = [];
  private isOnline = true;

  /**
   * Log an audit event
   */
  async logEvent(event: Omit<AuditEvent, 'officerId' | 'timestamp'>): Promise<void> {
    const { user } = useAuthStore.getState();
    
    if (!user) {
      console.warn('Cannot log audit event: User not authenticated');
      return;
    }

    const auditEvent: AuditEvent = {
      ...event,
      officerId: user.id,
      timestamp: new Date().toISOString(),
    };

    // Try to send immediately
    if (this.isOnline) {
      try {
        await this.sendToBackend(auditEvent);
        return;
      } catch (error) {
        console.error('Failed to send audit event:', error);
        this.isOnline = false;
      }
    }

    // Queue for later if offline
    this.queue.push(auditEvent);
    await this.persistQueue();
  }

  /**
   * Send audit event to backend (Hyperledger Fabric)
   */
  private async sendToBackend(event: AuditEvent): Promise<void> {
    try {
      const axios = require('axios');
      const { API_BASE_URL } = require('../constants/config');
      const { secureStorage } = require('./secureStorage');
      
      const token = await secureStorage.getToken();
      
      await axios.post(
        `${API_BASE_URL}/audit/events`,
        event,
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : undefined,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );
    } catch (error) {
      // Log error but don't throw - queue will retry
      console.error('Failed to send audit event to backend:', error);
      throw error;
    }
  }

  /**
   * Persist audit queue to local storage
   */
  private async persistQueue(): Promise<void> {
    // Store in AsyncStorage for offline persistence
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem('audit_queue', JSON.stringify(this.queue));
  }

  /**
   * Load and sync queued events
   */
  async syncQueue(): Promise<void> {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const queueData = await AsyncStorage.getItem('audit_queue');
    
    if (queueData) {
      this.queue = JSON.parse(queueData);
    }

    // Try to send all queued events
    while (this.queue.length > 0) {
      const event = this.queue.shift();
      if (event) {
        try {
          await this.sendToBackend(event);
          this.isOnline = true;
        } catch (error) {
          // Put back in queue if still failing
          this.queue.unshift(event);
          break;
        }
      }
    }

    await this.persistQueue();
  }

  /**
   * Log complaint filed
   */
  async logComplaintFiled(complaintId: string, metadata?: Record<string, any>): Promise<void> {
    await this.logEvent({
      eventType: 'ComplaintFiled',
      complaintId,
      metadata,
    });
  }

  /**
   * Log alert triggered
   */
  async logAlertTriggered(alertId: string, complaintId: string, metadata?: Record<string, any>): Promise<void> {
    await this.logEvent({
      eventType: 'AlertTriggered',
      alertId,
      complaintId,
      metadata,
    });
  }

  /**
   * Log cordon activated
   */
  async logCordonActivated(alertId: string, hotspotId: string, metadata?: Record<string, any>): Promise<void> {
    await this.logEvent({
      eventType: 'CordonActivated',
      alertId,
      metadata: {
        hotspotId,
        ...metadata,
      },
    });
  }

  /**
   * Log outcome
   */
  async logOutcome(alertId: string, outcome: { success: boolean; amountRecovered?: number }, metadata?: Record<string, any>): Promise<void> {
    await this.logEvent({
      eventType: 'OutcomeLogged',
      alertId,
      metadata: {
        ...outcome,
        ...metadata,
      },
    });
  }

  /**
   * Log evidence captured
   */
  async logEvidenceCaptured(alertId: string, evidenceId: string, metadata?: Record<string, any>): Promise<void> {
    await this.logEvent({
      eventType: 'EvidenceCaptured',
      alertId,
      metadata: {
        evidenceId,
        ...metadata,
      },
    });
  }

  /**
   * Log action taken
   */
  async logAction(action: Action, metadata?: Record<string, any>): Promise<void> {
    await this.logEvent({
      eventType: 'ActionTaken',
      alertId: action.alertId,
      actionType: action.type,
      metadata: {
        actionId: action.id,
        ...metadata,
      },
    });
  }
}

export const auditService = new AuditService();

