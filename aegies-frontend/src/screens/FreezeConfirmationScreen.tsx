import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/theme';

interface FrozenAccount {
  id: string;
  bank: string;
  accountNumber: string;
  amount: number;
}

export default function FreezeConfirmationScreen() {
  const { theme } = useTheme();
  const route = useRoute();
  const navigation = useNavigation();
  const { caseId, frozenAccounts, responseTime } = route.params as any;

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const checkmarkAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Success animation
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }),
      Animated.sequence([
        Animated.delay(200),
        Animated.timing(checkmarkAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const accounts = frozenAccounts || [
    {
      id: '1',
      bank: 'SBI',
      accountNumber: 'XXXX XXXX 4521',
      amount: 208500,
    },
    {
      id: '2',
      bank: 'HDFC',
      accountNumber: 'XXXX XXXX 7832',
      amount: 98200,
    },
  ];

  const totalAmount = accounts.reduce((sum: number, acc: FrozenAccount) => sum + acc.amount, 0);

  const formatCurrency = (amount: number | undefined | null) => {
    if (!amount || isNaN(amount)) {
      return '₹0';
    }
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)}L`;
    }
    return `₹${amount.toLocaleString()}`;
  };

  const handleAlertTeams = () => {
    // Navigate using parent Stack Navigator
    const parent = navigation.getParent();
    // @ts-ignore - React Navigation type inference limitation
    const nav = parent || navigation;
    // @ts-ignore - React Navigation type inference limitation
    nav.navigate('TeamStatus' as never, { caseId } as never);
  };

  const handleRecordOutcome = () => {
    // Navigate using parent Stack Navigator
    const parent = navigation.getParent();
    // @ts-ignore - React Navigation type inference limitation
    const nav = parent || navigation;
    // @ts-ignore - React Navigation type inference limitation
    nav.navigate('OutcomeFeedback' as never, { caseId } as never);
  };

  const handleViewDetails = () => {
    // Navigate using parent Stack Navigator
    const parent = navigation.getParent();
    // @ts-ignore - React Navigation type inference limitation
    const nav = parent || navigation;
    // @ts-ignore - React Navigation type inference limitation
    nav.navigate('CaseDetail' as never, { caseId } as never);
  };

  const handleSnooze = () => {
    // Schedule notification for 5 minutes
    const { notificationService } = require('../services/notificationService');
    notificationService.scheduleSnoozeNotification(caseId || 'default', 5);
    // Navigate back to main tabs
    const parent = navigation.getParent();
    // @ts-ignore - React Navigation type inference limitation
    const nav = parent || navigation;
    // @ts-ignore - React Navigation type inference limitation
    nav.navigate('MainTabs' as never);
  };

  const checkmarkRotation = checkmarkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-45deg', '0deg'],
  });

  return (
    <View style={[styles.container, { backgroundColor: '#f8fafc' }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Icon */}
        <View style={styles.successContainer}>
          <Animated.View
            style={[
              styles.successIcon,
              {
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <LinearGradient
              colors={['#22c55e', '#16a34a']}
              style={styles.successGradient}
            >
              <Animated.View
                style={{
                  transform: [{ rotate: checkmarkRotation }],
                }}
              >
                <Ionicons name="checkmark" size={64} color="#FFFFFF" />
              </Animated.View>
            </LinearGradient>
          </Animated.View>
          <Text style={styles.successTitle}>Accounts Frozen!</Text>
          <Text style={styles.successSubtitle}>
            Successfully blocked via NPCI in {responseTime || 47} seconds
          </Text>
        </View>

        {/* Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statsGrid}>
            <View style={[styles.statBox, { backgroundColor: '#f0fdf4' }]}>
              <Text style={styles.statValue}>{accounts.length}</Text>
              <Text style={styles.statLabel}>Accounts Frozen</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: '#eff6ff' }]}>
              <Text style={[styles.statValue, { color: '#2563eb' }]}>
                {formatCurrency(totalAmount)}
              </Text>
              <Text style={styles.statLabel}>Amount Secured</Text>
            </View>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.statsFooter}>
            <View style={styles.statsRow}>
              <Text style={styles.statsLabel}>Response Time</Text>
              <Text style={styles.statsValue}>{responseTime || 47} seconds</Text>
            </View>
            <View style={styles.statsRow}>
              <Text style={styles.statsLabel}>Case Status</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>In Progress</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Frozen Accounts Summary */}
        <View style={styles.accountsList}>
          {accounts.map((account: FrozenAccount) => (
            <View key={account.id} style={styles.accountItem}>
              <View
                style={[
                  styles.bankIcon,
                  {
                    backgroundColor:
                      account.bank === 'SBI'
                        ? '#2563eb'
                        : account.bank === 'HDFC'
                        ? '#dc2626'
                        : '#9333ea',
                  },
                ]}
              >
                <Text style={styles.bankIconText}>{account.bank}</Text>
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.accountNumber}>{account.accountNumber}</Text>
                <Text style={styles.accountAmount}>
                  {formatCurrency(account.amount)} secured
                </Text>
              </View>
              <Ionicons name="checkmark-circle" size={32} color="#22c55e" />
            </View>
          ))}
        </View>

        {/* NPCI Confirmation */}
        <View style={styles.npciCard}>
          <LinearGradient
            colors={['#1e293b', '#0f172a']}
            style={styles.npciGradient}
          >
            <View style={styles.npciContent}>
              <View style={styles.npciIcon}>
                <Text style={styles.npciEmoji}>🏛️</Text>
              </View>
              <View style={styles.npciInfo}>
                <Text style={styles.npciTitle}>NPCI Confirmation</Text>
                <Text style={styles.npciRef}>
                  Ref: NPCI-FRZ-2025-{caseId || '847210'}
                </Text>
              </View>
              <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
            </View>
          </LinearGradient>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        {/* Step Progress */}
        <View style={styles.stepProgress}>
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, { backgroundColor: '#22c55e' }]}>
              <Text style={styles.stepCheck}>✓</Text>
            </View>
            <Text style={styles.stepLabelActive}>FROZEN</Text>
          </View>
          <View style={[styles.stepLine, { backgroundColor: '#22c55e' }]} />
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, { backgroundColor: '#3b82f6' }]}>
              <Text style={styles.stepNumber}>2</Text>
            </View>
            <Text style={styles.stepLabelNext}>ALERT TEAMS</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, { backgroundColor: '#d1d5db' }]}>
              <Text style={styles.stepNumberInactive}>3</Text>
            </View>
            <Text style={styles.stepLabelInactive}>Intercept</Text>
          </View>
        </View>

        {/* Next Step Highlight */}
        <View style={styles.nextStepCard}>
          <Ionicons name="information-circle" size={20} color="#2563eb" />
          <View style={styles.nextStepContent}>
            <Text style={styles.nextStepTitle}>Next: Alert Nearby Teams</Text>
            <Text style={styles.nextStepSubtitle}>
              Money is safe! Now catch the criminal at predicted ATM.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.alertTeamsButton}
          onPress={handleAlertTeams}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#3b82f6', '#2563eb']}
            style={styles.alertTeamsGradient}
          >
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>STEP 2</Text>
            </View>
            <Ionicons name="people" size={20} color="#FFFFFF" />
            <Text style={styles.alertTeamsText}>Alert Nearby Teams</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.additionalActions}>
          <TouchableOpacity
            style={styles.viewDetailsButton}
            onPress={handleViewDetails}
            activeOpacity={0.7}
          >
            <Ionicons name="eye" size={18} color="#6b7280" />
            <Text style={styles.viewDetailsText}>View Details</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.snoozeButton}
            onPress={handleSnooze}
            activeOpacity={0.7}
          >
            <Ionicons name="time-outline" size={18} color="#6b7280" />
            <Text style={styles.snoozeText}>Snooze 5m</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleRecordOutcome}
          activeOpacity={0.7}
        >
          <Text style={styles.skipButtonText}>Skip to Record Outcome</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 300,
    alignItems: 'center',
  },
  successContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 24,
  },
  successIcon: {
    width: 112,
    height: 112,
    borderRadius: 56,
    marginBottom: 24,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  successGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  statsCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#22c55e',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#4b5563',
  },
  statsDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginBottom: 16,
  },
  statsFooter: {
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  statsValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#22c55e',
  },
  statusBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#d97706',
  },
  accountsList: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bankIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankIconText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  accountInfo: {
    flex: 1,
  },
  accountNumber: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  accountAmount: {
    fontSize: 12,
    color: '#6b7280',
  },
  npciCard: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
  },
  npciGradient: {
    padding: 16,
  },
  npciContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  npciIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  npciEmoji: {
    fontSize: 20,
  },
  npciInfo: {
    flex: 1,
  },
  npciTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  npciRef: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    padding: 16,
    paddingBottom: 32,
  },
  stepProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCheck: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepNumberInactive: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
  },
  stepLabelActive: {
    fontSize: 12,
    fontWeight: '700',
    color: '#22c55e',
  },
  stepLabelNext: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
  stepLabelInactive: {
    fontSize: 12,
    color: '#9ca3af',
  },
  stepLine: {
    width: 32,
    height: 2,
    backgroundColor: '#d1d5db',
  },
  nextStepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  nextStepContent: {
    flex: 1,
  },
  nextStepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 4,
  },
  nextStepSubtitle: {
    fontSize: 12,
    color: '#2563eb',
  },
  alertTeamsButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  alertTeamsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    position: 'relative',
  },
  stepBadge: {
    position: 'absolute',
    top: -8,
    left: 16,
    backgroundColor: '#22c55e',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stepBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  alertTeamsText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  additionalActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  viewDetailsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  snoozeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  snoozeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
});

