// Authentication Service for LEA Officers
import { authService as apiAuthService } from '../api/authService';
import { secureStorage } from './secureStorage';
import { websocketService } from './websocketService';
import * as Location from 'expo-location';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LoginRequest {
  badgeId: string;
  password: string;
  department: string;
  deviceId?: string;
  location?: { lat: number; lon: number };
}

export interface LoginResponse {
  success: boolean;
  access_token: string;
  token_type: string;
  expires_in: number;
  officer: {
    id: string;
    badge_id: string;
    name: string;
    rank: string;
    designation: string;
    email?: string;
  };
  // Legacy fields for compatibility
  token?: string;
  refreshToken?: string;
  user?: OfficerProfile;
  permissions?: string[];
  expiresAt?: string;
  sessionId?: string;
}

export interface OfficerProfile {
  id: string;
  badgeId: string;
  name: string;
  email: string;
  department: string;
  departmentId: string;
  rank: string;
  permissions: string[];
  status: 'active' | 'suspended' | 'inactive';
  // User interface compatibility
  type?: 'lea' | 'bank';
  organization?: string;
  badgeNumber?: string;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  fromCache?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Badge ID validation
export function validateBadgeId(badgeId: string): ValidationResult {
  // Format: STATE-DEPT-XXXXX (e.g., MH-CYB-78451)
  const pattern = /^[A-Z]{2}-[A-Z]{3}-\d{5}$/;

  if (!badgeId || badgeId.length === 0) {
    return { valid: false, error: 'Badge ID is required' };
  }

  if (!pattern.test(badgeId)) {
    return { valid: false, error: 'Invalid Badge ID format. Expected: STATE-DEPT-XXXXX' };
  }

  const [state, dept, number] = badgeId.split('-');

  // Validate state code
  const validStates = ['MH', 'DL', 'KA', 'GJ', 'TN', 'WB', 'UP', 'RJ', 'AP', 'TS', 'PB', 'HR'];
  if (!validStates.includes(state)) {
    return { valid: false, error: 'Invalid state code' };
  }

  // Validate department code
  const validDepts = ['CYB', 'ECO', 'FRA', 'INT', 'NCR'];
  if (!validDepts.includes(dept)) {
    return { valid: false, error: 'Invalid department code' };
  }

  return { valid: true };
}

// Authenticate officer with badge ID and password
export async function authenticateOfficer(
  request: LoginRequest
): Promise<ServiceResponse<LoginResponse>> {
  try {
    // 1. Validate input
    if (!request.badgeId || !request.password || !request.department) {
      return { success: false, error: 'Missing required fields' };
    }

    // 2. Validate badge ID format
    const badgeValidation = validateBadgeId(request.badgeId);
    if (!badgeValidation.valid) {
      return { success: false, error: badgeValidation.error };
    }

    // 3. Get device ID if not provided
    if (!request.deviceId) {
      // Get or create device ID
      let deviceId = await AsyncStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = `${Platform.OS}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem('device_id', deviceId);
      }
      request.deviceId = deviceId;
    }

    // 4. Get location if not provided (with permission)
    if (!request.location) {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          request.location = {
            lat: location.coords.latitude,
            lon: location.coords.longitude,
          };
        }
      } catch (error) {
        // Location not critical, continue without it
        console.log('Location permission not granted, continuing without location');
      }
    }

    // 5. Call backend API using the correct endpoint
    // API expects: POST /auth/login with application/x-www-form-urlencoded
    // username = badge_id, password = password
    const response = await apiAuthService.login(request.badgeId, request.password);

    if (!response.success || !response.data) {
      return { success: false, error: response.error || 'Authentication failed' };
    }

    const loginData = response.data;

    // 6. Transform API response to our internal format
    const transformedData: LoginResponse = {
      success: true,
      access_token: loginData.access_token,
      token_type: loginData.token_type,
      expires_in: loginData.expires_in,
      officer: loginData.officer,
      // Legacy compatibility fields
      token: loginData.access_token,
      refreshToken: '', // Not provided by API, will need refresh endpoint
      user: {
        id: loginData.officer.id,
        badgeId: loginData.officer.badge_id,
        name: loginData.officer.name,
        email: `${loginData.officer.badge_id.toLowerCase()}@mhpolice.gov.in`,
        department: request.department,
        departmentId: request.department,
        rank: loginData.officer.rank,
        permissions: [],
        status: 'active' as const,
        // User interface compatibility
        type: 'lea' as const,
        organization: request.department,
        badgeNumber: loginData.officer.badge_id,
      },
      permissions: [],
      expiresAt: new Date(Date.now() + loginData.expires_in * 1000).toISOString(),
      sessionId: loginData.officer.id, // Use officer ID as session ID
    };

    // 7. Store tokens securely
    await secureStorage.setToken(transformedData.access_token);
    
    // Convert OfficerProfile to User type for storage
    const userForStorage = {
      id: transformedData.user!.id,
      email: transformedData.user!.email,
      name: transformedData.user!.name,
      type: 'lea' as const,
      organization: transformedData.user!.organization || transformedData.user!.department,
      badgeNumber: transformedData.user!.badgeNumber || transformedData.user!.badgeId,
      rank: transformedData.user!.rank,
    };
    await secureStorage.setUser(userForStorage);
    await secureStorage.setSessionId(transformedData.sessionId!);
    
    // Store department and badge ID for persistence
    await secureStorage.setDepartment(request.department);
    await secureStorage.setBadgeId(request.badgeId);

    // 8. Initialize WebSocket connection
    try {
      await websocketService.connect(transformedData.access_token);
      
      // Subscribe to officer-specific channels
      websocketService.subscribe(`officer_${transformedData.officer.id}`, (data: any) => {
        console.log('Officer update received:', data);
        // Handle officer-specific updates
      });

      websocketService.subscribe(`department_${request.department}`, (data: any) => {
        console.log('Department update received:', data);
        // Handle department updates
      });
    } catch (wsError) {
      console.warn('WebSocket connection failed, continuing without real-time updates:', wsError);
      // Don't fail login if WebSocket fails
    }

    // 9. Start location tracking (if permission granted)
    if (request.location) {
      // Location tracking would be handled by a separate service
      // This is just a placeholder
    }

    return {
      success: true,
      data: transformedData,
    };
  } catch (error: any) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: error.message || 'Authentication failed. Please try again.',
    };
  }
}

// Handle biometric login
export async function handleBiometricLogin(): Promise<ServiceResponse<LoginResponse>> {
  try {
    // 1. Check if biometric is available
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) {
      return { success: false, error: 'Biometric authentication not available on this device' };
    }

    // 2. Check if biometric is enabled
    const biometricEnabled = await secureStorage.getBiometricEnabled();
    if (!biometricEnabled) {
      return { success: false, error: 'Biometric authentication not enabled' };
    }

    // 3. Get available authentication types
    const authTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const hasFingerprint = authTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    const hasFace = authTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);

    // 4. Request biometric authentication
    const biometricResult = await LocalAuthentication.authenticateAsync({
      promptMessage: 'AEGIS Authentication\nUse your fingerprint or face to login. Authenticate to access LEA portal',
      cancelLabel: 'Use Password',
      disableDeviceFallback: false,
    });

    if (!biometricResult.success) {
      return { success: false, error: biometricResult.error || 'Biometric authentication failed' };
    }

    // 5. Get stored credentials
    const storedUser = await secureStorage.getUser();
    if (!storedUser || !storedUser.badgeNumber) {
      return { success: false, error: 'No stored credentials found. Please login with password first.' };
    }

    // 6. Get stored department (would need to be stored separately)
    // For now, we'll need to get it from the user object or make a call
    const token = await secureStorage.getToken();
    if (!token) {
      return { success: false, error: 'No stored session found. Please login with password first.' };
    }

    // 7. Verify token is still valid
    const isValid = await checkSessionValidity();
    if (!isValid) {
      return { success: false, error: 'Session expired. Please login with password.' };
    }

    // 8. Return success (token is already stored)
    const user = await secureStorage.getUser();
    if (!user) {
      return { success: false, error: 'User data not found' };
    }

    // Get current user from API to ensure we have latest data
    const currentUserResult = await apiAuthService.getCurrentUser();
    const officerData = currentUserResult.success && currentUserResult.data 
      ? currentUserResult.data 
      : null;

    // Build officer object from stored user or API response
    const officerId = officerData?.id || user.id;
    const badgeId = officerData?.badge_id || user.badgeNumber || '';
    const officerName = officerData?.name || user.name;
    const officerRank = officerData?.rank || user.rank || 'Officer';
    const designation = officerData?.designation || 'Officer';

    return {
      success: true,
      data: {
        success: true,
        access_token: token,
        token_type: 'bearer',
        expires_in: 1800,
        officer: {
          id: officerId,
          badge_id: badgeId,
          name: officerName,
          rank: officerRank,
          designation: designation,
        },
        // Legacy fields
        token: token,
        refreshToken: await secureStorage.getRefreshToken() || '',
        user: {
          id: user.id,
          badgeId: user.badgeNumber || '',
          name: user.name,
          email: user.email,
          department: user.organization || '',
          departmentId: user.organization || '',
          rank: user.rank || '',
          permissions: [],
          status: 'active' as const,
          type: 'lea' as const,
          organization: user.organization,
          badgeNumber: user.badgeNumber,
        },
        permissions: [],
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
        sessionId: await secureStorage.getSessionId() || '',
      },
    };
  } catch (error: any) {
    console.error('Biometric login error:', error);
    return { success: false, error: error.message || 'Biometric authentication failed' };
  }
}

// Refresh authentication token
export async function refreshToken(): Promise<ServiceResponse<string>> {
  try {
    // Check if we have a stored refresh token
    const refreshTokenValue = await secureStorage.getRefreshToken();
    if (!refreshTokenValue) {
      // No refresh token available - need to login again
      await secureStorage.clear();
      return { success: false, error: 'Session expired. Please login again.' };
    }

    // Note: The API documentation doesn't specify a refresh token endpoint
    // For now, we'll check token validity and return the existing token if still valid
    const token = await secureStorage.getToken();
    if (token) {
      const isValid = await checkSessionValidity();
      if (isValid) {
        return { success: true, data: token };
      }
    }

    // Token expired - need to login again
    await secureStorage.clear();
    return { success: false, error: 'Session expired. Please login again.' };
  } catch (error: any) {
    await secureStorage.clear();
    return { success: false, error: 'Session expired. Please login again.' };
  }
}

// Check if session is valid
export async function checkSessionValidity(): Promise<boolean> {
  try {
    const token = await secureStorage.getToken();
    if (!token) return false;

    // Decode token to check expiry (simple check, not verifying signature)
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;

      const payload = JSON.parse(atob(parts[1]));
      if (!payload || !payload.exp) return false;

      const expiryTime = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const timeUntilExpiry = expiryTime - now;

      // If expires in less than 5 minutes, try to refresh
      if (timeUntilExpiry < 5 * 60 * 1000) {
        const refreshResult = await refreshToken();
        return refreshResult.success;
      }

      return true;
    } catch (decodeError) {
      // Token format invalid
      return false;
    }
  } catch (error: any) {
    // Suppress network errors in dev mode
    if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
      console.warn('Error checking session validity:', error);
    }
    return false;
  }
}

// Logout officer
export async function logout(): Promise<void> {
  try {
    // 1. Call backend to invalidate session
    try {
      const result = await apiAuthService.logout();
      if (!result.success) {
        console.warn('Logout API call failed, continuing with local logout');
      }
    } catch (error: any) {
      // Suppress network errors in dev mode
      if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
        console.error('Error logging out on server:', error);
      }
      // Continue with local logout even if server call fails
    }

    // 2. Disconnect WebSocket
    try {
      websocketService.disconnect();
    } catch (error: any) {
      // Suppress network errors in dev mode
      if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
        console.error('Error disconnecting WebSocket:', error);
      }
    }

    // 3. Clear local storage
    await secureStorage.clear();

    // 4. Clear cache (if cache service exists)
    // await cacheService.clear();
  } catch (error: any) {
    // Suppress network errors in dev mode
    if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
      console.error('Error during logout:', error);
    }
    // Still clear local storage even if other steps fail
    await secureStorage.clear();
  }
}

// Helper to get current officer ID
export async function getCurrentOfficerId(): Promise<string | null> {
  const user = await secureStorage.getUser();
  return user?.id || null;
}

