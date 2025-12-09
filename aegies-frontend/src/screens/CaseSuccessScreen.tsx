import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/theme';

const { width, height } = Dimensions.get('window');

interface Confetti {
  id: number;
  x: number;
  y: Animated.Value;
  rotation: Animated.Value;
  color: string;
  delay: number;
}

export default function CaseSuccessScreen() {
  const { theme } = useTheme();
  const route = useRoute();
  const navigation = useNavigation();
  const { caseId, outcome } = route.params as any;

  const confettiRefs = useRef<Confetti[]>([]);

  useEffect(() => {
    // Create confetti particles
    const colors = ['#fbbf24', '#3b82f6', '#ec4899', '#8b5cf6', '#f97316'];
    confettiRefs.current = Array.from({ length: 10 }, (_, i) => ({
      id: i,
      x: Math.random() * width,
      y: new Animated.Value(-100),
      rotation: new Animated.Value(0),
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: i * 200,
    }));

    // Animate confetti
    confettiRefs.current.forEach((confetti) => {
      Animated.parallel([
        Animated.timing(confetti.y, {
          toValue: height + 100,
          duration: 3000,
          delay: confetti.delay,
          useNativeDriver: true,
        }),
        Animated.timing(confetti.rotation, {
          toValue: 1,
          duration: 3000,
          delay: confetti.delay,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, []);

  const formatCurrency = (amount: number | undefined | null) => {
    if (!amount || isNaN(amount)) {
      return '₹0';
    }
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)}L`;
    }
    return `₹${amount.toLocaleString()}`;
  };

  const handleViewReport = () => {
    // @ts-ignore - React Navigation type inference limitation
    navigation.navigate('CaseReport' as never, { caseId } as never);
  };

  const handleBackToDashboard = () => {
    // @ts-ignore - React Navigation type inference limitation
    navigation.navigate('MainTabs' as never);
  };

  const recovered = outcome?.amountRecovered || 306700;
  const totalAmount = 350000;
  const recoveryRate = ((recovered / totalAmount) * 100).toFixed(1);

  return (
    <LinearGradient
      colors={['#22c55e', '#16a34a']}
      style={styles.container}
    >
      {/* Confetti */}
      <View style={styles.confettiContainer} pointerEvents="none">
        {confettiRefs.current.map((confetti) => {
          const rotation = confetti.rotation.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '720deg'],
          });

          return (
            <Animated.View
              key={confetti.id}
              style={[
                styles.confetti,
                {
                  left: confetti.x,
                  transform: [
                    { translateY: confetti.y },
                    { rotate: rotation },
                  ],
                  backgroundColor: confetti.color,
                },
              ]}
            />
          );
        })}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Trophy Icon */}
        <View style={styles.trophyContainer}>
          <View style={styles.trophyCircle}>
            <View style={styles.trophyInner}>
              <Text style={styles.trophyEmoji}>🏆</Text>
            </View>
          </View>
        </View>

        <Text style={styles.title}>Case Resolved!</Text>
        <Text style={styles.subtitle}>Outstanding work, SI Priya Sharma</Text>

        {/* Stats Card */}
        <View style={styles.statsCard}>
          <Text style={styles.caseNumber}>Case {caseId || '#MH-2025-84721'}</Text>

          <View style={styles.statsGrid}>
            <View style={[styles.statBox, { backgroundColor: '#f0fdf4' }]}>
              <Text style={[styles.statValue, { color: '#22c55e' }]}>
                {formatCurrency(recovered)}
              </Text>
              <Text style={styles.statLabel}>Recovered</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: '#eff6ff' }]}>
              <Text style={[styles.statValue, { color: '#2563eb' }]}>47s</Text>
              <Text style={styles.statLabel}>Freeze Time</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: '#faf5ff' }]}>
              <Text style={[styles.statValue, { color: '#9333ea' }]}>1</Text>
              <Text style={styles.statLabel}>Arrested</Text>
            </View>
          </View>

          <View style={styles.statsDivider} />

          <View style={styles.statsDetails}>
            <View style={styles.statsRow}>
              <Text style={styles.statsDetailLabel}>Prediction Accuracy</Text>
              <Text style={styles.statsDetailValue}>Exact Match ✓</Text>
            </View>
            <View style={styles.statsRow}>
              <Text style={styles.statsDetailLabel}>Recovery Rate</Text>
              <Text style={styles.statsDetailValue}>{recoveryRate}%</Text>
            </View>
            <View style={styles.statsRow}>
              <Text style={styles.statsDetailLabel}>Total Response Time</Text>
              <Text style={styles.statsDetailValue}>23 minutes</Text>
            </View>
          </View>
        </View>

        {/* Impact Message */}
        <View style={styles.impactCard}>
          <Text style={styles.impactEmoji}>💰</Text>
          <View style={styles.impactContent}>
            <Text style={styles.impactTitle}>Victim Impact</Text>
            <Text style={styles.impactText}>
              Mr. Rajesh Gupta will receive {formatCurrency(recovered)} back in his account within 7 working days
            </Text>
          </View>
        </View>

        {/* Achievement Badge */}
        <View style={styles.achievementBadge}>
          <Ionicons name="trophy" size={20} color="#92400e" />
          <Text style={styles.achievementText}>
            +15 Points • Quick Resolver Badge
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.reportButton}
          onPress={handleViewReport}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#FFFFFF', '#f9fafb']}
            style={styles.reportGradient}
          >
            <Ionicons name="sparkles" size={20} color="#22c55e" />
            <Text style={styles.reportButtonText}>View AI Report</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dashboardButton}
          onPress={handleBackToDashboard}
          activeOpacity={0.8}
        >
          <Text style={styles.dashboardButtonText}>Return to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  confetti: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 200,
    alignItems: 'center',
  },
  trophyContainer: {
    marginTop: 40,
    marginBottom: 24,
  },
  trophyCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyInner: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  trophyEmoji: {
    fontSize: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 32,
  },
  statsCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  caseNumber: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#4b5563',
  },
  statsDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginBottom: 16,
  },
  statsDetails: {
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsDetailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  statsDetailValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#22c55e',
  },
  impactCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  impactEmoji: {
    fontSize: 24,
  },
  impactContent: {
    flex: 1,
  },
  impactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  impactText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
  },
  achievementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fbbf24',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  achievementText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#78350f',
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  reportButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  reportGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  reportButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#22c55e',
  },
  dashboardButton: {
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
  },
  dashboardButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
