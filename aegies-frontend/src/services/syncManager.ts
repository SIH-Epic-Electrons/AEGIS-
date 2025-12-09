import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import Constants from 'expo-constants';
import { offlineManager } from '../utils/offlineManager';
import { actionService } from '../api/actionService';
import { useAlertStore } from '../store/alertStore';
import { CONFIG } from '../constants/config';

// Check if running in Expo Go
const isExpoGo = Constants.executionEnvironment === 'storeClient';

const SYNC_TASK = 'aegis-sync-task';

/**
 * Background sync task
 */
TaskManager.defineTask(SYNC_TASK, async () => {
  try {
    console.log('Background sync started');

    // Get pending items
    const pendingActions = await offlineManager.getPendingActions();
    const unsyncedEvidence = await offlineManager.getUnsyncedEvidence();

    // Sync actions
    for (const action of pendingActions) {
      try {
        await actionService.submitAction(action);
        await offlineManager.markActionSynced(action.id);
      } catch (error) {
        console.error('Failed to sync action:', error);
      }
    }

    // Sync evidence
    for (const evidence of unsyncedEvidence) {
      try {
        await actionService.uploadEvidence(evidence);
        await offlineManager.markEvidenceSynced(evidence.id);
      } catch (error) {
        console.error('Failed to sync evidence:', error);
      }
    }

    // Update store
    const store = useAlertStore.getState();
    await store.syncPendingItems();

    console.log('Background sync completed');
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Background sync error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export const syncManager = {
  /**
   * Register background sync
   */
  async register(): Promise<void> {
    if (isExpoGo) {
      console.log('Background sync: Skipping registration in Expo Go (use development build)');
      return;
    }

    try {
      // Check if BackgroundFetch is available
      const status = await BackgroundFetch.getStatusAsync();
      if (status === BackgroundFetch.BackgroundFetchStatus.Restricted) {
        console.warn('Background sync: Restricted by system');
        return;
      }

      await BackgroundFetch.registerTaskAsync(SYNC_TASK, {
        minimumInterval: CONFIG.SYNC_INTERVAL / 1000, // Convert to seconds
        stopOnTerminate: false,
        startOnBoot: true,
      });
      console.log('Background sync registered');
    } catch (error: any) {
      // Handle deprecation warning gracefully
      if (error?.message?.includes('deprecated')) {
        console.warn('Background sync: expo-background-fetch is deprecated. Use expo-background-task in production build.');
      } else {
        console.warn('Background sync: Registration failed (will use manual sync):', error?.message || error);
      }
    }
  },

  /**
   * Unregister background sync
   */
  async unregister(): Promise<void> {
    try {
      try {
        await BackgroundFetch.unregisterTaskAsync(SYNC_TASK);
        console.log('Background sync unregistered');
      } catch (error: any) {
        // Task might not exist, which is fine
        if (error?.message?.includes('not found') || error?.code === 'TaskNotFoundException') {
          console.log('Background sync: Task not found (already unregistered or never registered)');
        } else {
          console.warn('Background sync: Error unregistering task:', error?.message || error);
        }
      }
    } catch (error) {
      console.error('Failed to unregister background sync:', error);
    }
  },

  /**
   * Manual sync trigger
   */
  async syncNow(): Promise<void> {
    const store = useAlertStore.getState();
    await store.syncPendingItems();
  },
};

