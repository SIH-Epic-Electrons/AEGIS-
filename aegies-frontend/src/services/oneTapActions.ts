/**
 * One-Tap Actions Service
 * Execute common actions in one tap with smart defaults
 */

import { Alert } from '../types';
import { actionService } from '../api/actionService';
import { alertService } from '../api/alertService';
import { predictionService } from '../api/predictionService';
import { Alert as RNAlert } from 'react-native';
import { useAlertStore } from '../store/alertStore';

export interface OneTapActionResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

class OneTapActionsService {
  /**
   * Deploy nearest available officer to alert
   */
  async deployNearestOfficer(alertId: string): Promise<OneTapActionResult> {
    try {
      // Get alert details
      const alertResponse = await alertService.getAlertById(alertId);
      if (!alertResponse.success || !alertResponse.data) {
        return {
          success: false,
          message: 'Failed to get alert details',
          error: alertResponse.error?.message,
        };
      }

      const alert = alertResponse.data;

      // Find nearest officer (simplified - in real app, would query officer service)
      // For now, just deploy with default officer
      const result = await actionService.submitAction({
        alertId,
        type: 'navigate',
        data: {
          action: 'deploy',
          officerId: 'auto-assigned',
          hotspot: alert.dossier?.hotspots?.[0],
        },
      } as any);

      if (result.success) {
        return {
          success: true,
          message: 'Team deployed successfully',
          data: result.data,
        };
      }

      return {
        success: false,
        message: 'Failed to deploy team',
        error: result.error?.message,
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Error deploying team',
        error: error.message,
      };
    }
  }

  /**
   * Activate digital cordon for alert
   */
  async activateCordonForAlert(alertId: string): Promise<OneTapActionResult> {
    try {
      // @ts-ignore - activateDigitalCordon is in leaService
      const alertResponse = await alertService.getAlertById(alertId);
      if (!alertResponse.success || !alertResponse.data) {
        return { success: false, message: 'Alert not found', error: 'Alert not found' };
      }
      const alert = alertResponse.data;
      const { leaService } = await import('../api/leaService');
      const hotspot = alert.dossier?.hotspots?.[0];
      const result = hotspot 
        ? await leaService.activateDigitalCordon(alert.complaintId, hotspot.location.latitude, hotspot.location.longitude)
        : { success: false, error: 'No hotspot available' };

      if (result.success) {
        return {
          success: true,
          message: 'Digital cordon activated',
          data: (result as any).data,
        };
      }

      return {
        success: false,
        message: 'Failed to activate cordon',
        error: typeof result.error === 'string' ? result.error : (result.error as any)?.message || 'Unknown error',
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Error activating cordon',
        error: error.message,
      };
    }
  }

  /**
   * Open map centered on alert hotspot
   */
  openMapForAlert(alert: Alert, navigation: any): OneTapActionResult {
    try {
      if (!alert.dossier?.hotspots || alert.dossier.hotspots.length === 0) {
        return {
          success: false,
          message: 'No hotspots available for this alert',
        };
      }

      const hotspot = alert.dossier.hotspots[0];
      navigation.navigate('Map', {
        alertId: alert.id,
        hotspot: {
          latitude: hotspot.location.latitude,
          longitude: hotspot.location.longitude,
        },
      });

      return {
        success: true,
        message: 'Map opened',
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Error opening map',
        error: error.message,
      };
    }
  }

  /**
   * Call officer directly
   */
  callOfficer(officerId: string, phoneNumber?: string): OneTapActionResult {
    try {
      if (!phoneNumber) {
        return {
          success: false,
          message: 'Phone number not available',
        };
      }

      // Use Linking to make phone call
      const { Linking } = require('react-native');
      Linking.openURL(`tel:${phoneNumber}`);

      return {
        success: true,
        message: 'Calling officer...',
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Error making call',
        error: error.message,
      };
    }
  }

  /**
   * Send quick message (pre-filled)
   */
  async sendQuickMessage(
    alertId: string,
    message: string,
    recipientId?: string
  ): Promise<OneTapActionResult> {
    try {
      // In real implementation, would send via messaging service
      // For now, just log the action
      await actionService.submitAction({
        alertId,
        type: 'navigate',
        data: {
          action: 'message',
          message,
          recipientId,
        },
      } as any);

      return {
        success: true,
        message: 'Message sent',
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Error sending message',
        error: error.message,
      };
    }
  }

  /**
   * Quick freeze account
   */
  async quickFreezeAccount(alertId: string): Promise<OneTapActionResult> {
    try {
      const result = await actionService.submitAction({
        alertId,
        type: 'freeze',
        data: {
          action: 'freeze_account',
        },
      } as any);

      if (result.success) {
        return {
          success: true,
          message: 'Account freeze requested',
          data: result.data,
        };
      }

      return {
        success: false,
        message: 'Failed to freeze account',
        error: result.error?.message,
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Error freezing account',
        error: error.message,
      };
    }
  }
}

export const oneTapActions = new OneTapActionsService();

