import { create } from 'zustand';
import { Alert, Action, Evidence } from '../types';
import { alertService } from '../api/alertService';
import { actionService } from '../api/actionService';
import { offlineManager } from '../utils/offlineManager';
import { notificationService } from '../services/notificationService';

interface AlertStore {
  alerts: Alert[];
  selectedAlert: Alert | null;
  actions: Action[];
  evidence: Evidence[];
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchAlerts: () => Promise<void>;
  selectAlert: (alert: Alert | null) => void;
  queueAction: (action: Omit<Action, 'id' | 'timestamp' | 'status'>) => Promise<void>;
  addEvidence: (evidence: Omit<Evidence, 'id' | 'timestamp' | 'synced'>) => Promise<void>;
  syncPendingItems: () => Promise<void>;
  clearError: () => void;
}

export const useAlertStore = create<AlertStore>((set, get) => ({
  alerts: [],
  selectedAlert: null,
  actions: [],
  evidence: [],
  loading: false,
  error: null,

  fetchAlerts: async () => {
    set({ loading: true, error: null });
    try {
      const result = await alertService.getAlerts();
      
      if (result.success && result.data) {
        set({ alerts: result.data, loading: false });
        
        // Cache alerts for offline access
        await offlineManager.cacheAlerts(result.data);
        
        // Send notifications for high-risk alerts
        const highRiskAlerts = result.data.filter(
          (a) => a.type === 'high_priority' && a.status === 'active'
        );
        for (const alert of highRiskAlerts) {
          await notificationService.notifyHighRiskAlert(alert);
        }
        
        // Show indicator if data is from cache
        if (result.fromCache && __DEV__) {
          console.log('[AlertStore] Loaded alerts from cache');
        }
      } else {
        // Try to load from offline cache
        const cachedAlerts = await offlineManager.getCachedAlerts();
        if (cachedAlerts.length > 0) {
          set({ alerts: cachedAlerts, loading: false });
        } else {
          set({
            error: result.error?.message || 'Failed to fetch alerts',
            loading: false,
          });
        }
      }
    } catch (error: any) {
      set({ error: error.message || 'An unexpected error occurred', loading: false });
      // Try to load from offline cache
      const cachedAlerts = await offlineManager.getCachedAlerts();
      if (cachedAlerts.length > 0) {
        set({ alerts: cachedAlerts });
      }
    }
  },

  selectAlert: (alert) => {
    set({ selectedAlert: alert });
  },

  queueAction: async (actionData) => {
    const action: Action = {
      ...actionData,
      id: `action_${Date.now()}`,
      timestamp: new Date().toISOString(),
      status: 'pending',
    };

    set((state) => ({
      actions: [...state.actions, action],
    }));

    // Try to sync immediately, queue if offline
    try {
      const result = await actionService.submitAction(action);
      if (result.success) {
        set((state) => ({
          actions: state.actions.map((a) =>
            a.id === action.id ? { ...a, status: 'synced' } : a
          ),
        }));
      } else {
        // Queue for offline sync
        await offlineManager.queueAction(action);
        set({ error: result.error?.message || 'Failed to submit action' });
      }
    } catch (error: any) {
      // Queue for offline sync
      await offlineManager.queueAction(action);
      set({ error: error.message || 'Failed to submit action' });
    }
  },

  addEvidence: async (evidenceData) => {
    const evidence: Evidence = {
      ...evidenceData,
      id: `evidence_${Date.now()}`,
      timestamp: new Date().toISOString(),
      synced: false,
    };

    set((state) => ({
      evidence: [...state.evidence, evidence],
    }));

    // Try to sync immediately, queue if offline
    try {
      const result = await actionService.uploadEvidence(evidence);
      if (result.success) {
        set((state) => ({
          evidence: state.evidence.map((e) =>
            e.id === evidence.id ? { ...e, synced: true } : e
          ),
        }));
      } else {
        // Queue for offline sync
        await offlineManager.queueEvidence(evidence);
        set({ error: result.error?.message || 'Failed to upload evidence' });
      }
    } catch (error: any) {
      // Queue for offline sync
      await offlineManager.queueEvidence(evidence);
      set({ error: error.message || 'Failed to upload evidence' });
    }
  },

  syncPendingItems: async () => {
    const { actions, evidence } = get();
    const pendingActions = actions.filter((a) => a.status === 'pending');
    const pendingEvidence = evidence.filter((e) => !e.synced);

    for (const action of pendingActions) {
      try {
        const result = await actionService.submitAction(action);
        if (result.success) {
          set((state) => ({
            actions: state.actions.map((a) =>
              a.id === action.id ? { ...a, status: 'synced' } : a
            ),
          }));
        } else {
          console.error('Failed to sync action:', result.error?.message);
        }
      } catch (error: any) {
        console.error('Failed to sync action:', error);
      }
    }

    for (const ev of pendingEvidence) {
      try {
        const result = await actionService.uploadEvidence(ev);
        if (result.success) {
          set((state) => ({
            evidence: state.evidence.map((e) =>
              e.id === ev.id ? { ...e, synced: true } : e
            ),
          }));
        } else {
          console.error('Failed to sync evidence:', result.error?.message);
        }
      } catch (error: any) {
        console.error('Failed to sync evidence:', error);
      }
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));

