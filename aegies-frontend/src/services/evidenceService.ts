// Evidence Service for Evidence Collection
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { apiService } from './api';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export interface Evidence {
  id: string;
  caseId: string;
  type: 'photo' | 'video' | 'document' | 'audio';
  timestamp: string;
  location?: { lat: number; lon: number };
  officerId: string;
  metadata: {
    description?: string;
    tags?: string[];
    deviceInfo?: any;
    appVersion?: string;
  };
  file: {
    uri: string;
    type: string;
    size: number;
  };
  hash: string;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Capture photo evidence
export async function capturePhotoEvidence(
  caseId: string,
  metadata: {
    description?: string;
    location?: { lat: number; lon: number };
    tags?: string[];
  } = {}
): Promise<ServiceResponse<Evidence>> {
  try {
    // 1. Request camera permission
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      return { success: false, error: 'Camera permission denied' };
    }

    // 2. Capture photo
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      exif: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { success: false, error: 'Photo capture cancelled' };
    }

    const photo = result.assets[0];

    // 3. Get location if not provided
    let location = metadata.location;
    if (!location) {
      try {
        const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
        if (locStatus === 'granted') {
          const currentLocation = await Location.getCurrentPositionAsync({});
          location = {
            lat: currentLocation.coords.latitude,
            lon: currentLocation.coords.longitude,
          };
        }
      } catch (error) {
        console.warn('Could not get location:', error);
      }
    }

    // 4. Generate evidence ID
    const evidenceId = `evidence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 5. Get device info
    const deviceInfo = {
      model: Platform.OS === 'ios' ? 'iPhone' : 'Android Device',
      os: Platform.OS,
      osVersion: Platform.Version?.toString() || 'unknown',
      platform: Platform.OS,
    };

    // 6. Create evidence object
    const evidence: Evidence = {
      id: evidenceId,
      caseId,
      type: 'photo',
      timestamp: new Date().toISOString(),
      location,
      officerId: '', // Would be set from auth store
      metadata: {
        ...metadata,
        deviceInfo,
        appVersion: Constants.expoConfig?.version || '1.0.0',
      },
      file: {
        uri: photo.uri,
        type: 'image/jpeg',
        size: photo.fileSize || 0,
      },
      hash: '', // Would be calculated
    };

    // 7. Upload to backend
    try {
      const formData = new FormData();
      formData.append('evidence', {
        uri: photo.uri,
        type: 'image/jpeg',
        name: `evidence_${evidence.id}.jpg`,
      } as any);
      formData.append('metadata', JSON.stringify(evidence));

      // This would call the API
      // await api.post(`/lea/cases/${caseId}/evidence`, formData, {
      //   headers: { 'Content-Type': 'multipart/form-data' },
      // });
    } catch (uploadError) {
      console.warn('Evidence upload failed, storing locally:', uploadError);
      // Evidence would be stored locally for later sync
    }

    return { success: true, data: evidence };
  } catch (error: any) {
    console.error('Error capturing photo evidence:', error);
    return { success: false, error: error.message || 'Failed to capture photo evidence' };
  }
}

// Calculate file hash (simplified)
async function calculateFileHash(uri: string): Promise<string> {
  // In a real implementation, this would calculate SHA-256 hash
  // For now, return a placeholder
  return `hash_${Date.now()}`;
}

// Get device info
async function getDeviceInfo(): Promise<any> {
  return {
    model: Platform.OS === 'ios' ? 'iPhone' : 'Android Device',
    os: Platform.OS,
    osVersion: Platform.Version?.toString() || 'unknown',
  };
}

// Get app version
function getAppVersion(): string {
  return Constants.expoConfig?.version || '1.0.0';
}

