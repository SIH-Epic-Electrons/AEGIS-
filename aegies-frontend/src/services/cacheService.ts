/**
 * Cache Service
 * Provides caching for API responses with TTL support
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const CACHE_PREFIX = '@aegis_cache:';

/**
 * Check if cache entry is expired
 */
const isExpired = <T>(entry: CacheEntry<T> | null): boolean => {
  if (!entry) return true;
  return Date.now() - entry.timestamp > entry.ttl;
};

/**
 * Generate cache key
 */
const getCacheKey = (key: string): string => {
  return `${CACHE_PREFIX}${key}`;
};

/**
 * Cache service
 */
export const cacheService = {
  /**
   * Set cache entry with TTL
   */
  async set<T>(key: string, data: T, ttl: number): Promise<void> {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
      };
      await AsyncStorage.setItem(getCacheKey(key), JSON.stringify(entry));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  },

  /**
   * Get cache entry if not expired
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(getCacheKey(key));
      if (!cached) return null;

      const entry: CacheEntry<T> = JSON.parse(cached);
      if (isExpired(entry)) {
        // Remove expired entry
        await this.invalidate(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  },

  /**
   * Invalidate cache entry
   */
  async invalidate(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(getCacheKey(key));
    } catch (error) {
      console.error('Cache invalidate error:', error);
    }
  },

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((key) => key.startsWith(CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  },

  /**
   * Get cache entry with metadata
   */
  async getWithMetadata<T>(key: string): Promise<{ data: T; fromCache: boolean; age: number } | null> {
    try {
      const cached = await AsyncStorage.getItem(getCacheKey(key));
      if (!cached) return null;

      const entry: CacheEntry<T> = JSON.parse(cached);
      if (isExpired(entry)) {
        await this.invalidate(key);
        return null;
      }

      return {
        data: entry.data,
        fromCache: true,
        age: Date.now() - entry.timestamp,
      };
    } catch (error) {
      console.error('Cache getWithMetadata error:', error);
      return null;
    }
  },
};

/**
 * Cache TTL constants (in milliseconds)
 */
export const CACHE_TTL = {
  PREDICTIONS: 5 * 60 * 1000, // 5 minutes
  ALERTS: 2 * 60 * 1000, // 2 minutes
  MODEL_INFO: 30 * 60 * 1000, // 30 minutes
  ACTIONS: 1 * 60 * 1000, // 1 minute
  REPORTS: 10 * 60 * 1000, // 10 minutes
};

/**
 * Cache key generators
 */
export const cacheKeys = {
  prediction: (complaintId: string) => `predictions:${complaintId}`,
  alerts: (filters?: Record<string, any>) => {
    const filterStr = filters ? JSON.stringify(filters) : 'all';
    return `alerts:${filterStr}`;
  },
  modelInfo: () => 'model:info',
  alert: (alertId: string) => `alert:${alertId}`,
  dossier: (alertId: string) => `dossier:${alertId}`,
};

