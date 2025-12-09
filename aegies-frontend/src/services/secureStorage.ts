import * as SecureStore from 'expo-secure-store';
import { User } from '../types';

const KEYS = {
  TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER: 'user_data',
  BIOMETRIC_ENABLED: 'biometric_enabled',
  SESSION_ID: 'session_id',
  BADGE_ID: 'badge_id',
  DEPARTMENT: 'department',
};

export const secureStorage = {
  async setToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.TOKEN, token);
  },

  async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(KEYS.TOKEN);
    } catch {
      return null;
    }
  },

  async removeToken(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEYS.TOKEN);
    } catch {
      // Ignore errors
    }
  },

  async setUser(user: User): Promise<void> {
    await SecureStore.setItemAsync(KEYS.USER, JSON.stringify(user));
  },

  async getUser(): Promise<User | null> {
    try {
      const data = await SecureStore.getItemAsync(KEYS.USER);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async setBiometricEnabled(enabled: boolean): Promise<void> {
    await SecureStore.setItemAsync(KEYS.BIOMETRIC_ENABLED, enabled.toString());
  },

  async getBiometricEnabled(): Promise<boolean> {
    try {
      const value = await SecureStore.getItemAsync(KEYS.BIOMETRIC_ENABLED);
      return value === 'true';
    } catch {
      return false;
    }
  },

  async setRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, token);
  },

  async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
    } catch {
      return null;
    }
  },

  async setSessionId(sessionId: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.SESSION_ID, sessionId);
  },

  async getSessionId(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(KEYS.SESSION_ID);
    } catch {
      return null;
    }
  },

  async setBadgeId(badgeId: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.BADGE_ID, badgeId);
  },

  async getBadgeId(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(KEYS.BADGE_ID);
    } catch {
      return null;
    }
  },

  async setDepartment(department: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.DEPARTMENT, department);
  },

  async getDepartment(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(KEYS.DEPARTMENT);
    } catch {
      return null;
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
  },

  async clear(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.TOKEN),
      SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN),
      SecureStore.deleteItemAsync(KEYS.USER),
      SecureStore.deleteItemAsync(KEYS.BIOMETRIC_ENABLED),
      SecureStore.deleteItemAsync(KEYS.SESSION_ID),
      SecureStore.deleteItemAsync(KEYS.BADGE_ID),
      SecureStore.deleteItemAsync(KEYS.DEPARTMENT),
    ]);
  },
};

