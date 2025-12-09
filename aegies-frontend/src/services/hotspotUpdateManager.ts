/**
 * Hotspot Update Manager
 * Manages hotspot state, updates, and lifecycle
 */

import { Hotspot } from '../types';

export interface HotspotUpdate {
  id: string;
  hotspot: Hotspot;
  timestamp: number;
  status: 'new' | 'updated' | 'expired';
  previousScore?: number;
}

export class HotspotUpdateManager {
  private hotspots: Map<string, Hotspot> = new Map();
  private updateHistory: Map<string, HotspotUpdate[]> = new Map();
  private pendingUpdates: Map<string, any> = new Map();
  private listeners: Set<(hotspots: Hotspot[]) => void> = new Set();

  /**
   * Add a new hotspot
   */
  addHotspot(hotspot: Hotspot): void {
    const existing = this.hotspots.get(hotspot.id);
    
    if (existing) {
      // Update existing hotspot
      this.updateHotspot(hotspot.id, hotspot);
    } else {
      // Add new hotspot
      this.hotspots.set(hotspot.id, hotspot);
      this.recordUpdate(hotspot.id, hotspot, 'new');
      this.notifyListeners();
    }
  }

  /**
   * Update an existing hotspot
   */
  updateHotspot(hotspotId: string, updates: Partial<Hotspot>): void {
    const existing = this.hotspots.get(hotspotId);
    if (!existing) {
      return;
    }

    const previousScore = existing.probability;
    const updated: Hotspot = {
      ...existing,
      ...updates,
      id: hotspotId,
    };

    this.hotspots.set(hotspotId, updated);
    this.recordUpdate(hotspotId, updated, 'updated', previousScore);
    this.notifyListeners();
  }

  /**
   * Remove an expired hotspot
   */
  removeHotspot(hotspotId: string): void {
    const existing = this.hotspots.get(hotspotId);
    if (!existing) {
      return;
    }

    this.recordUpdate(hotspotId, existing, 'expired');
    this.hotspots.delete(hotspotId);
    this.notifyListeners();
  }

  /**
   * Get all hotspots with optional filters
   */
  getHotspots(filters?: {
    minProbability?: number;
    maxProbability?: number;
    scamType?: string;
    activeOnly?: boolean;
  }): Hotspot[] {
    let hotspots = Array.from(this.hotspots.values());

    if (filters) {
      if (filters.minProbability !== undefined) {
        hotspots = hotspots.filter(h => h.probability >= filters.minProbability!);
      }
      if (filters.maxProbability !== undefined) {
        hotspots = hotspots.filter(h => h.probability <= filters.maxProbability!);
      }
      if (filters.scamType) {
        hotspots = hotspots.filter(h => h.scamType === filters.scamType);
      }
      if (filters.activeOnly) {
        const now = Date.now();
        hotspots = hotspots.filter(h => {
          try {
            if (!h.timestamp || !h.timeWindow) return true;
            const timestamp = new Date(h.timestamp).getTime();
            if (isNaN(timestamp)) return true; // Include if invalid date
            const expiryTime = timestamp + (h.timeWindow * 60 * 1000);
            return expiryTime > now;
          } catch (error) {
            console.warn('Error parsing timestamp in filter:', error);
            return true; // Include on error
          }
        });
      }
    }

    return hotspots;
  }

  /**
   * Get a specific hotspot by ID
   */
  getHotspotById(id: string): Hotspot | undefined {
    return this.hotspots.get(id);
  }

  /**
   * Merge duplicate hotspots (same location within 100m)
   */
  mergeHotspots(hotspots: Hotspot[]): Hotspot[] {
    const merged: Hotspot[] = [];
    const processed = new Set<string>();

    for (const hotspot of hotspots) {
      if (processed.has(hotspot.id)) continue;

      // Find nearby hotspots
      const nearby = hotspots.filter(h => {
        if (h.id === hotspot.id || processed.has(h.id)) return false;
        if (!h.location || !hotspot.location) return false;
        
        const distance = this.calculateDistance(
          hotspot.location.latitude,
          hotspot.location.longitude,
          h.location.latitude,
          h.location.longitude
        );
        return distance < 100; // 100 meters
      });

      if (nearby.length > 0) {
        // Merge nearby hotspots
        const all = [hotspot, ...nearby];
        const mergedHotspot: Hotspot = {
          ...hotspot,
          probability: Math.max(...all.map(h => h.probability)),
          // Use the most recent timestamp
          timestamp: all.reduce((latest, h) => {
            try {
              const hTime = h.timestamp ? new Date(h.timestamp).getTime() : 0;
              const latestTime = latest ? new Date(latest).getTime() : 0;
              if (isNaN(hTime)) return latest || h.timestamp || '';
              if (isNaN(latestTime)) return h.timestamp || latest || '';
              return hTime > latestTime ? h.timestamp : latest;
            } catch (error) {
              console.warn('Error comparing timestamps:', error);
              return latest || h.timestamp || '';
            }
          }, hotspot.timestamp),
        };
        merged.push(mergedHotspot);
        all.forEach(h => processed.add(h.id));
      } else {
        merged.push(hotspot);
        processed.add(hotspot.id);
      }
    }

    return merged;
  }

  /**
   * Add optimistic update
   */
  addOptimisticUpdate(hotspotId: string, update: Partial<Hotspot>): void {
    this.pendingUpdates.set(hotspotId, update);
    this.updateHotspot(hotspotId, update);
  }

  /**
   * Confirm optimistic update
   */
  confirmUpdate(hotspotId: string): void {
    this.pendingUpdates.delete(hotspotId);
  }

  /**
   * Rollback optimistic update
   */
  rollbackUpdate(hotspotId: string): void {
    const pending = this.pendingUpdates.get(hotspotId);
    if (!pending) return;

    const existing = this.hotspots.get(hotspotId);
    if (existing) {
      // Revert to previous state (simplified - in production, store previous state)
      this.pendingUpdates.delete(hotspotId);
      this.notifyListeners();
    }
  }

  /**
   * Subscribe to hotspot updates
   */
  subscribe(callback: (hotspots: Hotspot[]) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Get update history for a hotspot
   */
  getUpdateHistory(hotspotId: string): HotspotUpdate[] {
    return this.updateHistory.get(hotspotId) || [];
  }

  /**
   * Clear all hotspots
   */
  clear(): void {
    this.hotspots.clear();
    this.updateHistory.clear();
    this.pendingUpdates.clear();
    this.notifyListeners();
  }

  /**
   * Remove expired hotspots
   */
  removeExpiredHotspots(): number {
    const now = Date.now();
    let removed = 0;

    for (const [id, hotspot] of this.hotspots.entries()) {
      if (hotspot.timestamp && hotspot.timeWindow) {
        try {
          const timestamp = new Date(hotspot.timestamp).getTime();
          if (isNaN(timestamp)) continue; // Skip if invalid date
          const expiryTime = timestamp + (hotspot.timeWindow * 60 * 1000);
          if (expiryTime < now) {
            this.removeHotspot(id);
            removed++;
          }
        } catch (error) {
          console.warn('Error checking expiry for hotspot:', id, error);
          continue; // Skip on error
        }
      }
    }

    return removed;
  }

  private recordUpdate(
    hotspotId: string,
    hotspot: Hotspot,
    status: 'new' | 'updated' | 'expired',
    previousScore?: number
  ): void {
    if (!this.updateHistory.has(hotspotId)) {
      this.updateHistory.set(hotspotId, []);
    }

    const history = this.updateHistory.get(hotspotId)!;
    history.push({
      id: hotspotId,
      hotspot,
      timestamp: Date.now(),
      status,
      previousScore,
    });

    // Keep only last 10 updates per hotspot
    if (history.length > 10) {
      history.shift();
    }
  }

  private notifyListeners(): void {
    const hotspots = Array.from(this.hotspots.values());
    this.listeners.forEach(listener => listener(hotspots));
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}

export const hotspotUpdateManager = new HotspotUpdateManager();

