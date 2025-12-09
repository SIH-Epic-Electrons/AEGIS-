/**
 * Location Service
 * Centralized location handling with proper error handling and permissions
 */

import * as Location from 'expo-location';
import { Alert, Platform } from 'react-native';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
}

export interface LocationResult {
  success: boolean;
  location?: LocationCoordinates;
  error?: string;
  permissionDenied?: boolean;
}

class LocationService {
  private permissionStatus: Location.PermissionStatus | null = null;
  private lastLocation: LocationCoordinates | null = null;
  private locationWatchSubscription: Location.LocationSubscription | null = null;

  /**
   * Check if location permissions are granted
   */
  async checkPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      this.permissionStatus = status as Location.PermissionStatus;
      return status === 'granted';
    } catch (error) {
      console.error('Error checking location permissions:', error);
      return false;
    }
  }

  /**
   * Request location permissions with user-friendly error handling
   */
  async requestPermissions(): Promise<boolean> {
    try {
      // Check if already granted
      const currentStatus = await Location.getForegroundPermissionsAsync();
      if (currentStatus.status === 'granted') {
        this.permissionStatus = currentStatus.status;
        return true;
      }

      // Request permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      this.permissionStatus = status as Location.PermissionStatus;

      if (status !== 'granted') {
        // Show helpful message to user
        if (Platform.OS === 'ios') {
          Alert.alert(
            'Location Permission Required',
            'AEGIS needs location access to help you respond to alerts and track team deployments. Please enable location services in Settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Location.requestForegroundPermissionsAsync() },
            ]
          );
        } else {
          Alert.alert(
            'Location Permission Required',
            'AEGIS needs location access to help you respond to alerts. Please enable location in app settings.',
            [{ text: 'OK' }]
          );
        }
        return false;
      }

      return true;
    } catch (error: any) {
      console.error('Error requesting location permissions:', error);
      Alert.alert(
        'Location Error',
        'Unable to request location permissions. Please check your device settings.',
        [{ text: 'OK' }]
      );
      return false;
    }
  }

  /**
   * Get current location with proper error handling
   */
  async getCurrentLocation(options?: Location.LocationOptions): Promise<LocationResult> {
    try {
      // Check/request permissions first
      const hasPermission = await this.checkPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) {
          return {
            success: false,
            error: 'Location permission denied',
            permissionDenied: true,
          };
        }
      }

      // Get location
      const locationOptions: Location.LocationOptions = {
        accuracy: Location.Accuracy.Balanced,
        ...options,
      };

      const location = await Location.getCurrentPositionAsync(locationOptions);

      const coordinates: LocationCoordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        altitude: location.coords.altitude || null,
        heading: location.coords.heading || null,
        speed: location.coords.speed || null,
      };

      this.lastLocation = coordinates;

      return {
        success: true,
        location: coordinates,
      };
    } catch (error: any) {
      console.error('Error getting location:', error);

      // Provide user-friendly error messages
      let errorMessage = 'Unable to get your location';
      let permissionDenied = false;

      if (error.message?.includes('permission') || error.message?.includes('denied')) {
        errorMessage = 'Location permission denied. Please enable location access in settings.';
        permissionDenied = true;
      } else if (error.message?.includes('timeout') || error.code === 'TIMEOUT') {
        errorMessage = 'Location request timed out. Please try again.';
      } else if (error.message?.includes('unavailable') || error.code === 'UNAVAILABLE') {
        errorMessage = 'Location services are unavailable. Please check your device settings.';
      } else if (error.message?.includes('unsatisfied')) {
        errorMessage = 'Location settings are not properly configured. Please check your device settings.';
        permissionDenied = true;
      }

      return {
        success: false,
        error: errorMessage,
        permissionDenied,
      };
    }
  }

  /**
   * Get last known location (cached)
   */
  getLastLocation(): LocationCoordinates | null {
    return this.lastLocation;
  }

  /**
   * Watch location changes
   */
  async watchPosition(
    callback: (location: LocationCoordinates) => void,
    options?: Location.LocationOptions
  ): Promise<boolean> {
    try {
      const hasPermission = await this.checkPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) {
          return false;
        }
      }

      // Stop existing watch if any
      if (this.locationWatchSubscription) {
        this.stopWatching();
      }

      const watchOptions: Location.LocationOptions = {
        accuracy: Location.Accuracy.Balanced,
        ...options,
      };

      this.locationWatchSubscription = await Location.watchPositionAsync(
        watchOptions,
        (location) => {
          const coordinates: LocationCoordinates = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || undefined,
            altitude: location.coords.altitude || null,
            heading: location.coords.heading || null,
            speed: location.coords.speed || null,
          };

          this.lastLocation = coordinates;
          callback(coordinates);
        }
      );

      return true;
    } catch (error: any) {
      console.error('Error watching location:', error);
      return false;
    }
  }

  /**
   * Stop watching location
   */
  stopWatching(): void {
    if (this.locationWatchSubscription) {
      this.locationWatchSubscription.remove();
      this.locationWatchSubscription = null;
    }
  }

  /**
   * Calculate distance between two coordinates (in meters)
   */
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth's radius in meters
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

  /**
   * Format distance for display
   */
  formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  }
}

// Export singleton instance
export const locationService = new LocationService();

