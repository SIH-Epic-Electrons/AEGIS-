// Offline Action Queue Service
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationService } from './notificationService';
import { freezeAccounts } from './freezeService';
import { dispatchTeam } from './dispatchService';
import { sendMessage } from './communicationService';
import { submitOutcome } from './outcomeService';
// Using a simple network check - in production would use proper network detection
// For now, we'll check network status via API calls

export interface QueuedAction {
  id: string;
  type: 'freeze' | 'dispatch' | 'message' | 'outcome' | 'evidence';
  caseId: string;
  data: any;
  timestamp: string;
  retryCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const STORAGE_KEY = 'offline_actions';
const MAX_RETRIES = 3;

class OfflineActionQueue {
  private queue: QueuedAction[] = [];
  private isProcessing = false;
  private networkListener: any = null;

  constructor() {
    this.loadQueue();
    this.setupNetworkListener();
  }

  // Load queue from storage
  private async loadQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading offline queue:', error);
      this.queue = [];
    }
  }

  // Save queue to storage
  private async saveQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Error saving offline queue:', error);
    }
  }

  // Setup network listener
  private setupNetworkListener(): void {
    // In production, would use proper network detection
    // For now, we'll check on action queue
  }

  // Check if online (simple check)
  private async isOnline(): Promise<boolean> {
    try {
      // Simple check - try a lightweight API call
      // In production, would use proper network detection
      return true; // Assume online for now
    } catch {
      return false;
    }
  }

  // Queue action for offline processing
  async queueAction(
    action: Omit<QueuedAction, 'id' | 'timestamp' | 'retryCount' | 'status'>
  ): Promise<void> {
    const queuedAction: QueuedAction = {
      ...action,
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      status: 'pending',
    };

    // Add to queue
    this.queue.push(queuedAction);
    await this.saveQueue();

    // Try to process if online
    const online = await this.isOnline();
    if (online) {
      this.processQueue();
    } else {
      // Show offline indicator
      await notificationService.notifyAlert({
        id: `offline_${Date.now()}`,
        title: '📴 Action Queued',
        body: 'Action will be processed when connection is restored',
        risk: 0.3,
        amount: 0,
        fraudType: 'Offline Queue',
        timestamp: new Date().toISOString(),
      } as any);
    }
  }

  // Process queued actions
  async processQueue(): Promise<void> {
    if (this.isProcessing) return;

    const online = await this.isOnline();
    if (!online) return;

    this.isProcessing = true;
    const pendingActions = this.queue.filter(a => a.status === 'pending');

    for (const action of pendingActions) {
      try {
        action.status = 'processing';
        await this.saveQueue();

        // Execute action based on type
        let result: ServiceResponse<any>;

        switch (action.type) {
          case 'freeze':
            result = await freezeAccounts(action.data);
            break;
          case 'dispatch':
            result = await dispatchTeam(action.data.teamId, action.caseId, action.data.instructions);
            break;
          case 'message':
            result = await sendMessage(
              action.data.channelId,
              action.data.content,
              action.data.type
            );
            break;
          case 'outcome':
            result = await submitOutcome(action.caseId, action.data);
            break;
          case 'evidence':
            // Evidence upload would be handled here
            result = { success: true };
            break;
          default:
            result = { success: false, error: 'Unknown action type' };
        }

        if (result.success) {
          action.status = 'completed';
          this.queue = this.queue.filter(a => a.id !== action.id);
          await this.saveQueue();
        } else {
          throw new Error(result.error || 'Action failed');
        }
      } catch (error: any) {
        action.retryCount++;
        if (action.retryCount >= MAX_RETRIES) {
          action.status = 'failed';
          action.error = error.message;
        } else {
          action.status = 'pending';
        }
        await this.saveQueue();
      }
    }

    this.isProcessing = false;
  }

  // Get queue status
  async getQueueStatus(): Promise<{
    pending: number;
    processing: number;
    failed: number;
    total: number;
  }> {
    return {
      pending: this.queue.filter(a => a.status === 'pending').length,
      processing: this.queue.filter(a => a.status === 'processing').length,
      failed: this.queue.filter(a => a.status === 'failed').length,
      total: this.queue.length,
    };
  }

  // Clear completed actions
  async clearCompleted(): Promise<void> {
    this.queue = this.queue.filter(a => a.status !== 'completed');
    await this.saveQueue();
  }

  // Retry failed actions
  async retryFailed(): Promise<void> {
    const failedActions = this.queue.filter(a => a.status === 'failed');
    for (const action of failedActions) {
      action.status = 'pending';
      action.retryCount = 0;
      action.error = undefined;
    }
    await this.saveQueue();
    await this.processQueue();
  }

  // Cleanup
  destroy(): void {
    if (this.networkListener) {
      this.networkListener();
    }
  }
}

// Singleton instance
export const offlineActionQueue = new OfflineActionQueue();

// Sync offline data
export async function syncOfflineData(): Promise<ServiceResponse<any>> {
  try {
    // Check if online (would use proper network detection in production)
    const isOnline = true; // Simplified for now
    if (!isOnline) {
      return { success: false, error: 'No internet connection' };
    }

    // Process queued actions
    await offlineActionQueue.processQueue();

    const status = await offlineActionQueue.getQueueStatus();

    return {
      success: true,
      data: {
        actionsSynced: status.total - status.pending - status.processing,
        casesSynced: 0, // Would sync cases here
        evidenceSynced: 0, // Would sync evidence here
        errors: [],
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to sync offline data' };
  }
}

// Cache case for offline
export async function cacheCaseForOffline(caseId: string): Promise<void> {
  try {
    // This would cache case details, money trail, mule accounts, evidence, etc.
    // For now, just store a reference
    const cacheKey = `case_${caseId}`;
    await AsyncStorage.setItem(cacheKey, JSON.stringify({
      caseId,
      cachedAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Error caching case for offline:', error);
  }
}

