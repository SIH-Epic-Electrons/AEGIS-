/**
 * WebSocket Event Handlers
 * Process and transform WebSocket events
 */

import { Hotspot, Prediction } from '../types';
import { hotspotUpdateManager } from './hotspotUpdateManager';

export interface PredictionUpdateEvent {
  prediction: Prediction;
  hotspots: Hotspot[];
  timestamp: string;
}

export interface HotspotUpdateEvent {
  hotspotId: string;
  hotspot: Hotspot;
  changes: Partial<Hotspot>;
  timestamp: string;
}

export interface HotspotExpiredEvent {
  hotspotId: string;
  predictionId: string;
  timestamp: string;
}

export interface CordonEvent {
  hotspotId: string;
  predictionId: string;
  activated: boolean;
  radius?: number;
  timestamp: string;
}

export interface StatusChangeEvent {
  hotspotId: string;
  oldStatus: string;
  newStatus: string;
  riskScore?: number;
  timestamp: string;
}

/**
 * Handle prediction update event
 */
export function handlePredictionUpdate(data: PredictionUpdateEvent): void {
  try {
    if (!data.prediction || !data.hotspots) {
      console.warn('Invalid prediction update event:', data);
      return;
    }

    // Add all hotspots from the prediction
    data.hotspots.forEach(hotspot => {
      hotspotUpdateManager.addHotspot(hotspot);
    });
  } catch (error) {
    console.error('Error handling prediction update:', error);
  }
}

/**
 * Handle hotspot update event
 */
export function handleHotspotUpdate(data: HotspotUpdateEvent): void {
  try {
    if (!data.hotspotId || !data.hotspot) {
      console.warn('Invalid hotspot update event:', data);
      return;
    }

    hotspotUpdateManager.updateHotspot(data.hotspotId, data.changes);
  } catch (error) {
    console.error('Error handling hotspot update:', error);
  }
}

/**
 * Handle expired hotspot event
 */
export function handleHotspotExpired(data: HotspotExpiredEvent): void {
  try {
    if (!data.hotspotId) {
      console.warn('Invalid hotspot expired event:', data);
      return;
    }

    hotspotUpdateManager.removeHotspot(data.hotspotId);
  } catch (error) {
    console.error('Error handling hotspot expired:', error);
  }
}

/**
 * Handle cordon activation/deactivation
 */
export function handleCordonActivated(data: CordonEvent): void {
  try {
    if (!data.hotspotId) {
      console.warn('Invalid cordon event:', data);
      return;
    }

    const updates: Partial<Hotspot> = {
      digitalCordon: data.activated,
      radius: data.radius || 2000,
    } as any; // digitalCordon is now part of Hotspot interface

    hotspotUpdateManager.updateHotspot(data.hotspotId, updates);
  } catch (error) {
    console.error('Error handling cordon event:', error);
  }
}

/**
 * Handle status change event
 */
export function handleStatusChange(data: StatusChangeEvent): void {
  try {
    if (!data.hotspotId) {
      console.warn('Invalid status change event:', data);
      return;
    }

    const updates: Partial<Hotspot> = {};
    if (data.riskScore !== undefined) {
      updates.probability = data.riskScore;
    }

    hotspotUpdateManager.updateHotspot(data.hotspotId, updates);
  } catch (error) {
    console.error('Error handling status change:', error);
  }
}

/**
 * Setup all WebSocket event handlers
 */
export function setupWebSocketHandlers(websocketService: any): () => void {
  const unsubscribers: (() => void)[] = [];

  // Prediction update
  unsubscribers.push(
    websocketService.subscribe('prediction_update', handlePredictionUpdate)
  );

  // Hotspot update
  unsubscribers.push(
    websocketService.subscribe('hotspot_update', handleHotspotUpdate)
  );

  // Hotspot expired
  unsubscribers.push(
    websocketService.subscribe('hotspot_expired', handleHotspotExpired)
  );

  // Cordon activated
  unsubscribers.push(
    websocketService.subscribe('cordon_activated', handleCordonActivated)
  );

  // Cordon deactivated
  unsubscribers.push(
    websocketService.subscribe('cordon_deactivated', (data: CordonEvent) => {
      handleCordonActivated({ ...data, activated: false });
    })
  );

  // Status change
  unsubscribers.push(
    websocketService.subscribe('hotspot_status_change', handleStatusChange)
  );

  // Return cleanup function
  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
}

