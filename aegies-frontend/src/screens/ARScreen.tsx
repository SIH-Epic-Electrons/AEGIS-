import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Hotspot } from '../types';
import { calculateDistance, formatDistance, calculateBearing } from '../utils/geodesy';
import { useTheme } from '../theme/theme';

const { width, height } = Dimensions.get('window');

export default function ARScreen() {
  const { theme } = useTheme();
  const route = useRoute();
  const navigation = useNavigation();
  const { hotspot, alertId } = route.params as { hotspot: Hotspot; alertId: string };
  
  const [permission, requestPermission] = useCameraPermissions();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [bearing, setBearing] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  useEffect(() => {
    // Request location permissions
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for AR view');
        return;
      }

      // Start location updates
      const locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (newLocation) => {
          if (!newLocation || !newLocation.coords || 
              newLocation.coords.latitude === undefined || 
              newLocation.coords.longitude === undefined) {
            return;
          }

          if (!hotspot || !hotspot.location || 
              hotspot.location.latitude === undefined || 
              hotspot.location.longitude === undefined) {
            return;
          }

          setLocation(newLocation);
          
          // Calculate distance and bearing
          const dist = calculateDistance(
            {
              latitude: newLocation.coords.latitude,
              longitude: newLocation.coords.longitude,
            },
            hotspot.location
          );
          setDistance(dist);

          const bear = calculateBearing(
            {
              latitude: newLocation.coords.latitude,
              longitude: newLocation.coords.longitude,
            },
            hotspot.location
          );
          setBearing(bear);

          // Calculate countdown (assuming walking speed of 1.4 m/s)
          const walkingSpeed = 1.4; // meters per second
          const timeToArrival = dist / walkingSpeed;
          setCountdown(Math.round(timeToArrival));
        }
      );

      return () => {
        locationSubscription.remove();
      };
    })();
  }, []);

  const handleInterdictionConfirmed = () => {
    Alert.alert(
      'Interdiction Confirmed',
      'Record this interdiction outcome?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Record',
          onPress: () => {
            // @ts-expect-error - React Navigation type inference limitation
            navigation.navigate('Evidence' as never, { alertId, hotspot } as never);
          },
        },
      ]
    );
  };

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.message, { color: theme.colors.text }]}>
          Requesting camera permission...
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.message, { color: theme.colors.text }]}>
          Camera permission is required
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={requestPermission}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back" />
      
      {/* AR Overlay - positioned absolutely outside CameraView */}
      <View style={styles.overlay} pointerEvents="box-none">
        {/* Center crosshair */}
        <View style={styles.crosshair}>
          <View style={styles.crosshairLine} />
          <View style={[styles.crosshairLine, styles.crosshairLineVertical]} />
        </View>

        {/* Hotspot indicator circle */}
        {distance !== null && distance < 100 && (
          <View style={styles.hotspotIndicator}>
            <View style={styles.hotspotCircle} />
            <Text style={styles.hotspotLabel}>HOTSPOT</Text>
          </View>
        )}

        {/* Info panel */}
        <View style={[styles.infoPanel, { backgroundColor: theme.colors.overlay }]}>
          <View style={styles.infoRow}>
            <Ionicons name="location" size={20} color={theme.colors.error} />
            <Text style={[styles.infoText, { color: '#fff' }]}>
              {distance !== null ? formatDistance(distance) : 'Calculating...'}
            </Text>
          </View>
          {bearing !== null && (
            <View style={styles.infoRow}>
              <Ionicons name="compass" size={20} color={theme.colors.info} />
              <Text style={[styles.infoText, { color: '#fff' }]}>
                Bearing: {Math.round(bearing)}°
              </Text>
            </View>
          )}
          {countdown !== null && countdown > 0 && (
            <View style={styles.infoRow}>
              <Ionicons name="time" size={20} color={theme.colors.warning} />
              <Text style={[styles.infoText, { color: '#fff' }]}>
                ETA: {Math.floor(countdown / 60)}m {countdown % 60}s
              </Text>
            </View>
          )}
          <Text style={[styles.addressText, { color: '#fff' }]} numberOfLines={2}>
            {hotspot.address}
          </Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          {distance !== null && distance < 50 && (
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleInterdictionConfirmed}
            >
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.confirmButtonText}>Interdiction Confirmed</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  crosshair: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -25 }, { translateY: -25 }],
    width: 50,
    height: 50,
  },
  crosshairLine: {
    position: 'absolute',
    width: 30,
    height: 2,
    backgroundColor: '#FF3B30',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -15 }, { translateY: -1 }],
  },
  crosshairLineVertical: {
    width: 2,
    height: 30,
    transform: [{ translateX: -1 }, { translateY: -15 }],
  },
  hotspotIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -100 }, { translateY: -100 }],
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hotspotCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 3,
    borderColor: '#FF3B30',
    borderStyle: 'dashed',
  },
  hotspotLabel: {
    position: 'absolute',
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '700',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 8,
  },
  infoPanel: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    borderRadius: 16,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  infoText: {
    fontSize: 16,
    fontWeight: '600',
  },
  addressText: {
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  actionBar: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C759',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  button: {
    padding: 16,
    borderRadius: 16,
    marginTop: 20,
    minHeight: 52,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
  },
});

