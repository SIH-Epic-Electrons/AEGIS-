import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/theme';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const { theme } = useTheme();
  const pulseAnim = React.useRef(new Animated.Value(0.8)).current;
  const spinAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.8,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Spin animation
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <LinearGradient
      colors={['#0f172a', '#1e3a8a', '#0f172a']}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Pulse Rings */}
        <View style={styles.pulseContainer}>
          <Animated.View
            style={[
              styles.pulseRing,
              {
                transform: [{ scale: pulseAnim }],
                opacity: pulseAnim.interpolate({
                  inputRange: [0.8, 1.2],
                  outputRange: [0.3, 0],
                }),
              },
            ]}
          />
          <Animated.View
            style={[
              styles.pulseRing,
              {
                transform: [{ scale: pulseAnim }],
                opacity: pulseAnim.interpolate({
                  inputRange: [0.8, 1.2],
                  outputRange: [0.2, 0],
                }),
              },
            ]}
          />
        </View>

        {/* Shield Icon */}
        <View style={styles.logoContainer}>
          <LinearGradient
            colors={['#06b6d4', '#3b82f6']}
            style={styles.logoCircle}
          >
            <Ionicons name="shield" size={64} color="#FFFFFF" />
          </LinearGradient>
        </View>

        {/* App Name */}
        <Text style={styles.title}>AEGIS</Text>
        <Text style={styles.subtitle}>
          Anticipatory Engine for Geolocated{'\n'}Intervention against Scams
        </Text>

        {/* Government Branding */}
        <View style={styles.brandingContainer}>
          <View style={styles.flagContainer}>
            <Text style={styles.flagEmoji}>🇮🇳</Text>
          </View>
          <View style={styles.brandingText}>
            <Text style={styles.brandingSubtext}>Ministry of Home Affairs</Text>
            <Text style={styles.brandingMain}>
              Indian Cyber Crime Coordination Centre
            </Text>
          </View>
        </View>

        {/* Loading Indicator */}
        <View style={styles.loadingContainer}>
          <Animated.View
            style={[
              styles.loadingSpinner,
              { transform: [{ rotate: spin }] },
            ]}
          />
          <Text style={styles.loadingText}>
            Establishing secure connection...
          </Text>
        </View>
      </View>

      {/* Bottom Branding */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Powered by I4C • NCRP • NPCI
        </Text>
        <Text style={styles.versionText}>v1.0.0</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  pulseContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: '#06b6d4',
  },
  logoContainer: {
    marginTop: -80,
    marginBottom: 32,
  },
  logoCircle: {
    width: 128,
    height: 128,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#7dd3fc',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  brandingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 32,
    marginBottom: 48,
  },
  flagContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagEmoji: {
    fontSize: 20,
  },
  brandingText: {
    alignItems: 'flex-start',
  },
  brandingSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  brandingMain: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 48,
  },
  loadingSpinner: {
    width: 32,
    height: 32,
    borderWidth: 2,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    borderTopColor: '#06b6d4',
    borderRadius: 16,
    marginBottom: 12,
  },
  loadingText: {
    fontSize: 12,
    color: 'rgba(125, 211, 252, 0.6)',
  },
  footer: {
    paddingBottom: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
    marginBottom: 4,
  },
  versionText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.3)',
  },
});

