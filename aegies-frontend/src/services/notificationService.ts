import Constants from 'expo-constants';
import { Alert } from '../types';

// Check if running in Expo Go
const isExpoGo = Constants.executionEnvironment === 'storeClient';

// Conditionally import expo-notifications (not available in Expo Go SDK 53+)
let Notifications: any = null;
try {
  if (!isExpoGo) {
    // Dynamic import to avoid errors in Expo Go
    Notifications = require('expo-notifications');
    
    // Configure notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }
} catch (error) {
  console.warn('expo-notifications not available (Expo Go limitation):', error);
  Notifications = null;
}

export const notificationService = {
  /**
   * Check notification permission status (without requesting)
   */
  async checkPermissions(): Promise<'granted' | 'denied' | 'undetermined'> {
    if (isExpoGo || !Notifications) {
      return 'undetermined';
    }

    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
    } catch (error) {
      console.warn('Notifications: Permission check failed:', error);
      return 'undetermined';
    }
  },

  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<boolean> {
    if (isExpoGo || !Notifications) {
      console.warn('Notifications: Limited support in Expo Go. Use development build for full features.');
      return false;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      return finalStatus === 'granted';
    } catch (error) {
      console.warn('Notifications: Permission request failed:', error);
      return false;
    }
  },

  /**
   * Schedule a local notification for an alert
   */
  async notifyAlert(alert: Alert): Promise<string> {
    if (isExpoGo || !Notifications) {
      // In Expo Go, just log the alert
      console.log('Alert (Expo Go - no notifications):', alert.title);
      return '';
    }

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      console.warn('Notification permission not granted');
      return '';
    }

    try {
      const priorityLabel = 
        alert.type === 'high_priority' ? '🔴 HIGH PRIORITY' :
        alert.type === 'medium_priority' ? '🟠 MEDIUM' : '🟡 LOW';

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `${priorityLabel} - ${alert.title}`,
          body: `${alert.message}\nAmount: ₹${alert.amount.toLocaleString()}\nLocation: ${alert.complaintId}`,
          data: { alertId: alert.id, type: 'alert' },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Show immediately
      });

      return notificationId;
    } catch (error) {
      console.warn('Failed to schedule notification:', error);
      return '';
    }
  },

  /**
   * Schedule a snooze notification after specified minutes
   */
  async scheduleSnoozeNotification(caseId: string, minutes: number): Promise<string> {
    if (isExpoGo || !Notifications) {
      console.log(`Snooze scheduled for case ${caseId} in ${minutes} minutes (Expo Go - no notifications)`);
      return '';
    }

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      console.warn('Notification permission not granted');
      return '';
    }

    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ Snooze Reminder',
          body: `Case ${caseId} - Time to take action`,
          data: { caseId, type: 'snooze' },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
          seconds: minutes * 60,
        },
      });

      return notificationId;
    } catch (error) {
      console.warn('Failed to schedule snooze notification:', error);
      return '';
    }
  },

  /**
   * Show notification for high-risk alert
   */
  async notifyHighRiskAlert(alert: Alert): Promise<void> {
    await this.notifyAlert(alert);
    
    // Also show a badge count (if available)
    if (!isExpoGo && Notifications) {
      try {
        await Notifications.setBadgeCountAsync(1);
      } catch (error) {
        console.warn('Failed to set badge count:', error);
      }
    }
  },

  /**
   * Clear all notifications
   */
  async clearAll(): Promise<void> {
    if (isExpoGo || !Notifications) {
      return;
    }
    
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await Notifications.setBadgeCountAsync(0);
    } catch (error) {
      console.warn('Failed to clear notifications:', error);
    }
  },

  /**
   * Setup notification listeners
   */
  setupListeners(
    onNotificationReceived: (notification: any) => void,
    onNotificationTapped: (response: any) => void
  ): { remove: () => void } {
    if (isExpoGo || !Notifications) {
      // Return no-op listeners for Expo Go
      return {
        remove: () => {},
      };
    }

    try {
      // Listener for notifications received while app is foregrounded
      const receivedListener = Notifications.addNotificationReceivedListener(
        onNotificationReceived
      );

      // Listener for when user taps on notification
      const responseListener = Notifications.addNotificationResponseReceivedListener(
        onNotificationTapped
      );

      return {
        remove: () => {
          receivedListener.remove();
          responseListener.remove();
        },
      };
    } catch (error) {
      console.warn('Failed to setup notification listeners:', error);
      return {
        remove: () => {},
      };
    }
  },

  /**
   * Get notification badge count
   */
  async getBadgeCount(): Promise<number> {
    if (isExpoGo || !Notifications) {
      return 0;
    }
    
    try {
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      console.warn('Failed to get badge count:', error);
      return 0;
    }
  },
};

