/**
 * Hotspot Clustering Utility
 * Clusters nearby hotspots for better visualization
 */

import { Hotspot } from '../types';

export interface Cluster {
  id: string;
  hotspots: Hotspot[];
  center: {
    latitude: number;
    longitude: number;
  };
  averageRisk: number;
  count: number;
}

export class HotspotClustering {
  private clusterRadius: number = 500; // meters
  private maxClusterSize: number = 10;
  private gridSize: number = 100; // meters

  /**
   * Cluster hotspots based on zoom level
   */
  clusterHotspots(hotspots: Hotspot[], zoomLevel: number): Cluster[] {
    if (this.shouldCluster(zoomLevel)) {
      return this.performClustering(hotspots);
    }
    // Return individual hotspots as single-item clusters
    return hotspots.map(hotspot => ({
      id: hotspot.id,
      hotspots: [hotspot],
      center: hotspot.location || { latitude: 0, longitude: 0 },
      averageRisk: hotspot.probability,
      count: 1,
    }));
  }

  /**
   * Determine if clustering is needed based on zoom level
   */
  shouldCluster(zoomLevel: number): boolean {
    // Cluster at zoom levels < 12 (zoomed out)
    return zoomLevel < 12;
  }

  /**
   * Perform grid-based clustering
   */
  private performClustering(hotspots: Hotspot[]): Cluster[] {
    const grid: Map<string, Hotspot[]> = new Map();

    // Group hotspots into grid cells
    for (const hotspot of hotspots) {
      if (!hotspot.location) continue;

      const cellKey = this.getGridCellKey(
        hotspot.location.latitude,
        hotspot.location.longitude
      );

      if (!grid.has(cellKey)) {
        grid.set(cellKey, []);
      }
      grid.get(cellKey)!.push(hotspot);
    }

    // Create clusters from grid cells
    const clusters: Cluster[] = [];
    for (const [cellKey, cellHotspots] of grid.entries()) {
      if (cellHotspots.length === 1) {
        // Single hotspot - no clustering needed
        clusters.push({
          id: cellHotspots[0].id,
          hotspots: cellHotspots,
          center: cellHotspots[0].location!,
          averageRisk: cellHotspots[0].probability,
          count: 1,
        });
      } else {
        // Multiple hotspots - create cluster
        const center = this.getClusterCenter(cellHotspots);
        const averageRisk = this.getAverageRisk(cellHotspots);

        clusters.push({
          id: `cluster_${cellKey}`,
          hotspots: cellHotspots,
          center,
          averageRisk,
          count: cellHotspots.length,
        });
      }
    }

    return clusters;
  }

  /**
   * Get grid cell key for a coordinate
   */
  private getGridCellKey(latitude: number, longitude: number): string {
    const latCell = Math.floor(latitude * 1000 / this.gridSize);
    const lonCell = Math.floor(longitude * 1000 / this.gridSize);
    return `${latCell}_${lonCell}`;
  }

  /**
   * Get cluster center (centroid of all hotspots)
   */
  getClusterCenter(cluster: Hotspot[]): { latitude: number; longitude: number } {
    if (cluster.length === 0) {
      return { latitude: 0, longitude: 0 };
    }

    if (cluster.length === 1) {
      return cluster[0].location || { latitude: 0, longitude: 0 };
    }

    let totalLat = 0;
    let totalLon = 0;
    let count = 0;

    for (const hotspot of cluster) {
      if (hotspot.location) {
        totalLat += hotspot.location.latitude;
        totalLon += hotspot.location.longitude;
        count++;
      }
    }

    return {
      latitude: totalLat / count,
      longitude: totalLon / count,
    };
  }

  /**
   * Get average risk score for a cluster
   */
  getAverageRisk(cluster: Hotspot[]): number {
    if (cluster.length === 0) return 0;
    const sum = cluster.reduce((acc, h) => acc + h.probability, 0);
    return sum / cluster.length;
  }

  /**
   * Get cluster count
   */
  getClusterCount(cluster: Cluster): number {
    return cluster.count;
  }

  /**
   * Set cluster radius
   */
  setClusterRadius(radius: number): void {
    this.clusterRadius = radius;
  }

  /**
   * Set grid size
   */
  setGridSize(size: number): void {
    this.gridSize = size;
  }
}

export const hotspotClustering = new HotspotClustering();

