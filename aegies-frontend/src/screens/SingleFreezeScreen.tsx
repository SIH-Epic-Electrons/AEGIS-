import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/theme';

interface MuleAccount {
  id: string;
  bank: string;
  bankName: string;
  accountNumber: string;
  amountReceived: number;
  currentBalance: number;
  accountHolder: string;
  ifscCode: string;
  accountAge: string;
  location: string;
  status: 'active' | 'withdrawn' | 'frozen';
}

interface SingleFreezeParams {
  caseId?: string;
  account: MuleAccount;
  responseTime?: number;
  npciReference?: string;
  remainingAccounts?: MuleAccount[];
}

export default function SingleFreezeScreen() {
  const { theme } = useTheme();
  const route = useRoute();
  const navigation = useNavigation();
  const { account, responseTime = 32, npciReference, remainingAccounts = [] } = 
    route.params as SingleFreezeParams || {};

  // Default account if none provided (matching MVP)
  const frozenAccount: MuleAccount = account || {
    id: '1',
    bank: 'SBI',
    bankName: 'State Bank of India',
    accountNumber: 'XXXX XXXX 4521',
    amountReceived: 210000,
    currentBalance: 208500,
    accountHolder: 'Suresh K***r',
    ifscCode: 'SBIN0001234',
    accountAge: '23 days (New)',
    location: 'Andheri, Mumbai',
    status: 'frozen',
  };

  const npciRef = npciReference || `NPCI-FRZ-2025-${Math.floor(Math.random() * 1000000)}`;
  const activeRemaining = remainingAccounts.filter((acc) => acc.status === 'active');

  const handleFreezeRemaining = () => {
    // @ts-ignore - React Navigation type inference limitation
    navigation.navigate('MuleAccounts' as never, {
      caseId: route.params?.caseId,
      muleAccounts: activeRemaining,
    } as never);
  };

  const handleBackToCase = () => {
    // Navigate using parent Stack Navigator
    const parent = navigation.getParent();
    // @ts-ignore - React Navigation type inference limitation
    const nav = parent || navigation;
    // @ts-ignore - React Navigation type inference limitation
    nav.navigate('CaseDetail' as never, {
      caseId: route.params?.caseId,
    } as never);
  };

  const getBankColor = (bank: string) => {
    const colors: Record<string, string[]> = {
      SBI: ['#0F4C75', '#3282B8'],
      HDFC: ['#E31837', '#FF6B6B'],
      AXIS: ['#FF6B00', '#FF8C42'],
      ICICI: ['#FF6B00', '#FF8C42'],
      default: ['#475569', '#64748B'],
    };
    return colors[bank] || colors.default;
  };

  const formatAmount = (amount: number) => {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)}L`;
    }
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Icon */}
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={['#ef4444', '#dc2626']}
            style={styles.iconCircle}
          >
            <Ionicons name="ban" size={48} color="#FFFFFF" />
          </LinearGradient>
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Account Frozen!
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Single account blocked via NPCI
        </Text>

        {/* Frozen Account Details Card */}
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          {/* Bank Header */}
          <View style={styles.bankHeader}>
            <LinearGradient
              colors={getBankColor(frozenAccount.bank)}
              style={styles.bankIcon}
            >
              <Text style={styles.bankIconText}>{frozenAccount.bank}</Text>
            </LinearGradient>
            <View style={styles.bankInfo}>
              <Text style={[styles.bankName, { color: theme.colors.text }]}>
                {frozenAccount.bankName}
              </Text>
              <Text style={[styles.accountNumber, { color: theme.colors.textSecondary }]}>
                {frozenAccount.accountNumber}
              </Text>
            </View>
          </View>

          {/* Account Details */}
          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
                Status
              </Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>FROZEN ❄️</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
                Amount Secured
              </Text>
              <Text style={styles.amountText}>
                {formatAmount(frozenAccount.currentBalance)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
                Freeze Time
              </Text>
              <Text style={[styles.timeText, { color: theme.colors.primary }]}>
                {responseTime} seconds
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
                NPCI Reference
              </Text>
              <Text style={[styles.referenceText, { color: theme.colors.text }]}>
                {npciRef}
              </Text>
            </View>
          </View>
        </View>

        {/* Remaining Accounts Alert */}
        {activeRemaining.length > 0 && (
          <View style={[styles.alertCard, { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }]}>
            <View style={styles.alertContent}>
              <Ionicons name="warning" size={24} color="#D97706" />
              <View style={styles.alertTextContainer}>
                <Text style={styles.alertTitle}>
                  {activeRemaining.length} more active account{activeRemaining.length > 1 ? 's' : ''} remaining
                </Text>
                {activeRemaining.length > 0 && (
                  <Text style={styles.alertSubtitle}>
                    {activeRemaining[0].bankName} - {formatAmount(activeRemaining[0].currentBalance)} still at risk
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* NPCI Confirmation */}
        <LinearGradient
          colors={['#1e293b', '#0f172a']}
          style={styles.npciCard}
        >
          <View style={styles.npciContent}>
            <View style={styles.npciIconContainer}>
              <Text style={styles.npciIcon}>🏛️</Text>
            </View>
            <View style={styles.npciTextContainer}>
              <Text style={styles.npciTitle}>NPCI Confirmed</Text>
              <Text style={styles.npciSubtitle}>Debit card & UPI blocked</Text>
            </View>
            <Ionicons name="checkmark-circle" size={24} color="#4ADE80" />
          </View>
        </LinearGradient>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={[styles.bottomActions, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
        {activeRemaining.length > 0 && (
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: '#ef4444' }]}
            onPress={handleFreezeRemaining}
            activeOpacity={0.8}
          >
            <Ionicons name="ban" size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Freeze Remaining Account{activeRemaining.length > 1 ? 's' : ''}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.secondaryButton, { backgroundColor: theme.colors.backgroundSecondary }]}
          onPress={handleBackToCase}
          activeOpacity={0.7}
        >
          <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>
            Back to Case
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 20,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  bankHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  bankIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankIconText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
  },
  bankInfo: {
    flex: 1,
  },
  bankName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  accountNumber: {
    fontSize: 14,
  },
  detailsContainer: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: 20,
  },
  statusText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 12,
  },
  amountText: {
    color: '#059669',
    fontWeight: '700',
    fontSize: 16,
  },
  timeText: {
    fontWeight: '700',
    fontSize: 16,
  },
  referenceText: {
    fontWeight: '600',
    fontSize: 14,
  },
  alertCard: {
    width: '100%',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  alertContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  alertTextContainer: {
    flex: 1,
  },
  alertTitle: {
    color: '#92400E',
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 4,
  },
  alertSubtitle: {
    color: '#B45309',
    fontSize: 12,
  },
  npciCard: {
    width: '100%',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  npciContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  npciIconContainer: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  npciIcon: {
    fontSize: 20,
  },
  npciTextContainer: {
    flex: 1,
  },
  npciTitle: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 2,
  },
  npciSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
  },
  bottomActions: {
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },
});

