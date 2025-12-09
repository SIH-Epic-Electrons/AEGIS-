/**
 * Model Version Tracking Service
 * Tracks model versions and their performance
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { modelMonitoringService } from './modelMonitoringService';

interface ModelVersion {
  version: string;
  deployedAt: string;
  performance: {
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
  };
  isActive: boolean;
}

const STORAGE_KEY = '@aegis_model_versions';
const CURRENT_VERSION_KEY = '@aegis_current_model_version';

/**
 * Model Version Service
 */
export const modelVersionService = {
  /**
   * Get current model version
   */
  async getCurrentVersion(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(CURRENT_VERSION_KEY);
    } catch (error) {
      console.error('Error getting current version:', error);
      return null;
    }
  },

  /**
   * Set current model version
   */
  async setCurrentVersion(version: string): Promise<void> {
    try {
      await AsyncStorage.setItem(CURRENT_VERSION_KEY, version);
    } catch (error) {
      console.error('Error setting current version:', error);
    }
  },

  /**
   * Record model version with performance
   */
  async recordVersion(version: string): Promise<void> {
    try {
      const versions = await this.getVersions();
      const metrics = await modelMonitoringService.getMetrics();

      const versionData: ModelVersion = {
        version,
        deployedAt: new Date().toISOString(),
        performance: {
          accuracy: metrics?.accuracy || 0,
          precision: metrics?.precision || 0,
          recall: metrics?.recall || 0,
          f1: metrics?.f1 || 0,
        },
        isActive: true,
      };

      // Mark all other versions as inactive
      versions.forEach((v) => {
        v.isActive = false;
      });

      versions.push(versionData);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(versions));
      await this.setCurrentVersion(version);
    } catch (error) {
      console.error('Error recording version:', error);
    }
  },

  /**
   * Get all model versions
   */
  async getVersions(): Promise<ModelVersion[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting versions:', error);
      return [];
    }
  },

  /**
   * Get active model version
   */
  async getActiveVersion(): Promise<ModelVersion | null> {
    const versions = await this.getVersions();
    return versions.find((v) => v.isActive) || null;
  },

  /**
   * Compare versions
   */
  async compareVersions(version1: string, version2: string): Promise<{
    version1: ModelVersion | null;
    version2: ModelVersion | null;
    improvements: {
      accuracy: number;
      precision: number;
      recall: number;
      f1: number;
    };
  }> {
    const versions = await this.getVersions();
    const v1 = versions.find((v) => v.version === version1);
    const v2 = versions.find((v) => v.version === version2);

    if (!v1 || !v2) {
      return {
        version1: v1 || null,
        version2: v2 || null,
        improvements: {
          accuracy: 0,
          precision: 0,
          recall: 0,
          f1: 0,
        },
      };
    }

    return {
      version1: v1,
      version2: v2,
      improvements: {
        accuracy: v2.performance.accuracy - v1.performance.accuracy,
        precision: v2.performance.precision - v1.performance.precision,
        recall: v2.performance.recall - v1.performance.recall,
        f1: v2.performance.f1 - v1.performance.f1,
      },
    };
  },

  /**
   * Update version performance
   */
  async updateVersionPerformance(version: string): Promise<void> {
    const versions = await this.getVersions();
    const versionIndex = versions.findIndex((v) => v.version === version);

    if (versionIndex === -1) return;

    const metrics = await modelMonitoringService.getMetrics();
    if (metrics) {
      versions[versionIndex].performance = {
        accuracy: metrics.accuracy,
        precision: metrics.precision,
        recall: metrics.recall,
        f1: metrics.f1,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(versions));
    }
  },
};

