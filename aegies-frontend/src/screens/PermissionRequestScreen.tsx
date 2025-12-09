/**
 * Permission Request Screen
 * Shows after login to request essential permissions
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/theme';
import * as Location from 'expo-location';
import { notificationService } from '../services/notificationService';
import { secureStorage } from '../services/secureStorage';
import * as SecureStore from 'expo-secure-store';

interface PermissionStatus {
  location: 'granted' | 'denied' | 'undetermined';
  notifications: 'granted' | 'denied' | 'undetermined';
}

export default function PermissionRequestScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [permissions, setPermissions] = useState<PermissionStatus>({
    location: 'undetermined',
    notifications: 'undetermined',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    // Check location permission
    const locationStatus = await Location.getForegroundPermissionsAsync();
    setPermissions((prev) => ({
      ...prev,
      location: locationStatus.granted ? 'granted' : locationStatus.canAskAgain ? 'undetermined' : 'denied',
    }));

    // Check notification permission
    try {
      const notificationStatus = await notificationService.checkPermissions();
      setPermissions((prev) => ({
        ...prev,
        notifications: notificationStatus,
      }));
    } catch (error) {
      setPermissions((prev) => ({
        ...prev,
        notifications: 'undetermined',
      }));
    }
  };

  const requestLocationPermission = async () => {
    try {
      setLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status === 'granted') {
        setPermissions((prev) => ({ ...prev, location: 'granted' }));
        // Also request background location if needed
        await Location.requestBackgroundPermissionsAsync();
      } else {
        setPermissions((prev) => ({ ...prev, location: 'denied' }));
        Alert.alert(
          'Location Permission Required',
          'Location access is essential for map features and alert tracking. You can enable it later in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
    } finally {
      setLoading(false);
    }
  };

  const requestNotificationPermission = async () => {
    try {
      setLoading(true);
      const granted = await notificationService.requestPermissions();
      
      if (granted) {
        setPermissions((prev) => ({ ...prev, notifications: 'granted' }));
      } else {
        setPermissions((prev) => ({ ...prev, notifications: 'denied' }));
        Alert.alert(
          'Notification Permission',
          'Notifications help you stay updated on critical alerts. You can enable it later in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    // Mark permissions as requested
    try {
      await SecureStore.setItemAsync('permissions_requested', 'true');
    } catch (error) {
      console.warn('Failed to save permissions status:', error);
    }
    
    // Navigate to main app
    // @ts-ignore
    navigation.replace('MainTabs' as never);
  };

  const handleSkip = async () => {
    // Mark as skipped
    try {
      await SecureStore.setItemAsync('permissions_requested', 'true');
    } catch (error) {
      console.warn('Failed to save permissions status:', error);
    }
    
    // Navigate to main app
    // @ts-ignore
    navigation.replace('MainTabs' as never);
  };

  const allGranted = permissions.location === 'granted' && permissions.notifications === 'granted';
  const hasDenied = permissions.location === 'denied' || permissions.notifications === 'denied';

  return (
    <LinearGradient colors={['#f8fafc', '#f1f5f9']} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={['#3b82f6', '#2563eb']}
              style={styles.iconCircle}
            >
              <Ionicons name="shield-checkmark" size={32} color="#FFFFFF" />
            </LinearGradient>
          </View>
          <Text style={styles.title}>Enable Essential Features</Text>
          <Text style={styles.subtitle}>
            Grant permissions to access all AEGIS features and receive critical alerts
          </Text>
        </View>

        {/* Permission Cards */}
        <View style={styles.permissionsContainer}>
          {/* Location Permission */}
          <View style={[styles.permissionCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.permissionHeader}>
              <View style={[styles.permissionIcon, { backgroundColor: '#dbeafe' }]}>
                <Ionicons name="location" size={24} color="#2563eb" />
              </View>
              <View style={styles.permissionInfo}>
                <Text style={[styles.permissionTitle, { color: theme.colors.text }]}>
                  Location Access
                </Text>
                <Text style={[styles.permissionDescription, { color: theme.colors.textSecondary }]}>
                  Required for map features, alert tracking, and real-time location updates
                </Text>
              </View>
            </View>
            <View style={styles.permissionStatus}>
              {permissions.location === 'granted' ? (
                <View style={styles.statusBadge}>
                  <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                  <Text style={styles.statusText}>Granted</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.requestButton, { backgroundColor: '#3b82f6' }]}
                  onPress={requestLocationPermission}
                  disabled={loading || permissions.location === 'denied'}
                  activeOpacity={0.8}
                >
                  <Text style={styles.requestButtonText}>
                    {permissions.location === 'denied' ? 'Open Settings' : 'Grant Permission'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Notification Permission */}
          <View style={[styles.permissionCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.permissionHeader}>
              <View style={[styles.permissionIcon, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="notifications" size={24} color="#d97706" />
              </View>
              <View style={styles.permissionInfo}>
                <Text style={[styles.permissionTitle, { color: theme.colors.text }]}>
                  Notifications
                </Text>
                <Text style={[styles.permissionDescription, { color: theme.colors.textSecondary }]}>
                  Receive real-time alerts, case updates, and critical security notifications
                </Text>
              </View>
            </View>
            <View style={styles.permissionStatus}>
              {permissions.notifications === 'granted' ? (
                <View style={styles.statusBadge}>
                  <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                  <Text style={styles.statusText}>Granted</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.requestButton, { backgroundColor: '#f59e0b' }]}
                  onPress={requestNotificationPermission}
                  disabled={loading || permissions.notifications === 'denied'}
                  activeOpacity={0.8}
                >
                  <Text style={styles.requestButtonText}>
                    {permissions.notifications === 'denied' ? 'Open Settings' : 'Grant Permission'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Info Message */}
        <View style={[styles.infoBox, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
          <Ionicons name="information-circle" size={20} color="#2563eb" />
          <Text style={[styles.infoText, { color: '#1e40af' }]}>
            You can change these permissions anytime in your device Settings
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.continueButton, allGranted && styles.continueButtonActive]}
            onPress={handleContinue}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={allGranted ? ['#16a34a', '#15803d'] : ['#3b82f6', '#2563eb']}
              style={styles.continueGradient}
            >
              <Text style={styles.continueButtonText}>
                {allGranted ? 'Continue' : 'Continue Anyway'}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>

          {!allGranted && (
            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkip}
              activeOpacity={0.7}
            >
              <Text style={[styles.skipButtonText, { color: theme.colors.textSecondary }]}>
                Skip for Now
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    marginBottom: 16,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  permissionCard: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  permissionHeader: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  permissionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionInfo: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  permissionDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  permissionStatus: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f0fdf4',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
  },
  requestButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  requestButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    gap: 12,
  },
  continueButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonActive: {
    shadowColor: '#16a34a',
  },
  continueGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    padding: 16,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

