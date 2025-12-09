import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/theme';
import { freezeAccounts, FreezeRequest } from '../services/freezeService';

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

export default function MuleAccountsScreen() {
  const { theme } = useTheme();
  const route = useRoute();
  const navigation = useNavigation();
  const { caseId, muleAccounts: routeAccounts } = route.params as any;

  // Default accounts matching MVP design exactly
  const defaultAccounts: MuleAccount[] = [
    {
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
      status: 'active',
    },
    {
      id: '2',
      bank: 'HDFC',
      bankName: 'HDFC Bank',
      accountNumber: 'XXXX XXXX 7832',
      amountReceived: 100000,
      currentBalance: 98200,
      accountHolder: 'Ram***n P.',
      ifscCode: 'HDFC0005678',
      accountAge: '45 days (New)',
      location: 'Thane, Maharashtra',
      status: 'active',
    },
    {
      id: '3',
      bank: 'AXIS',
      bankName: 'Axis Bank',
      accountNumber: 'XXXX XXXX 2190',
      amountReceived: 40000,
      currentBalance: 0,
      accountHolder: 'Unknown',
      ifscCode: 'UTIB0001234',
      accountAge: '60 days',
      location: 'Vashi, Navi Mumbai',
      status: 'withdrawn',
    },
  ];

  // Always use default accounts if none provided, matching MVP design
  const [muleAccounts, setMuleAccounts] = useState<MuleAccount[]>(() => {
    if (routeAccounts && Array.isArray(routeAccounts) && routeAccounts.length > 0) {
      // Map route accounts to match our interface
      return routeAccounts.map((acc: any) => ({
        id: acc.id || acc.accountId || `acc-${Math.random()}`,
        bank: acc.bank || 'UNKNOWN',
        bankName: acc.bankName || acc.bank || 'Bank',
        accountNumber: acc.accountNumber || acc.account_number || 'XXXX XXXX XXXX',
        amountReceived: acc.amountReceived || acc.amount_received || acc.amount || 0,
        currentBalance: acc.currentBalance || acc.current_balance || acc.balance || 0,
        accountHolder: acc.accountHolder || acc.account_holder || acc.holder || 'Unknown',
        ifscCode: acc.ifscCode || acc.ifsc_code || acc.ifsc || 'XXXX0000000',
        accountAge: acc.accountAge || acc.account_age || 'Unknown',
        location: acc.location || 'Unknown',
        status: (acc.status || 'active') as 'active' | 'withdrawn' | 'frozen',
      }));
    }
    return defaultAccounts;
  });

  const [freezing, setFreezing] = useState(false);
  const [freezingAccountId, setFreezingAccountId] = useState<string | null>(null);
  const [frozenAccounts, setFrozenAccounts] = useState<Set<string>>(new Set());
  const pulseAnim = useState(new Animated.Value(1))[0];

  const activeAccounts = muleAccounts.filter((acc) => acc.status === 'active');

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const formatCurrency = (amount: number | undefined | null) => {
    if (!amount || isNaN(amount)) {
      return '₹0';
    }
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    }
    return `₹${amount.toLocaleString()}`;
  };

  const getBankColor = (bank: string) => {
    switch (bank) {
      case 'SBI':
        return '#2563eb';
      case 'HDFC':
        return '#dc2626';
      case 'AXIS':
        return '#9333ea';
      default:
        return '#6b7280';
    }
  };

  const handleFreezeAll = async () => {
    if (!caseId) {
      Alert.alert('Error', 'Case ID is missing');
      return;
    }

    if (activeAccounts.length === 0) {
      Alert.alert('Info', 'No active accounts to freeze');
      return;
    }

    try {
      setFreezing(true);

      const accountIds = activeAccounts.map((acc) => acc.id);
      const previousStatuses = new Map(
        muleAccounts.map((acc) => [acc.id, acc.status])
      );
      setFrozenAccounts(new Set(accountIds));
      setMuleAccounts((prev) =>
        prev.map((acc) =>
          accountIds.includes(acc.id) ? { ...acc, status: 'frozen' as const } : acc
        )
      );

      const request: FreezeRequest = {
        caseId,
        accountIds,
        reason: 'AEGIS AI Prediction - High Risk Withdrawal',
        urgency: 'critical',
        notifyBanks: true,
      };

      const result = await freezeAccounts(request);

      if (!result.success) {
        setFrozenAccounts(new Set());
        setMuleAccounts((prev) =>
          prev.map((acc) => ({
            ...acc,
            status: (previousStatuses.get(acc.id) || acc.status) as any,
          }))
        );
        throw new Error(result.error || 'Failed to freeze accounts');
      }

      if (result.data) {
        const successfullyFrozen = new Set(
          result.data.frozenAccounts
            .filter((acc: any) => acc.status === 'frozen')
            .map((acc: any) => acc.accountId)
        );
        setFrozenAccounts(successfullyFrozen);

        setMuleAccounts((prev) =>
          prev.map((acc) => ({
            ...acc,
            status: successfullyFrozen.has(acc.id) ? 'frozen' : acc.status,
          }))
        );

        // Navigate to Freeze Confirmation
                // @ts-ignore - React Navigation type inference limitation
                navigation.navigate('FreezeConfirmation' as never, {
                  caseId,
                  frozenAccounts: activeAccounts.filter((acc) =>
                    successfullyFrozen.has(acc.id)
                  ),
                  responseTime: result.data?.totalExecutionTime || 47,
                } as never);
      }
    } catch (error: any) {
      console.error('Freeze error:', error);
      Alert.alert(
        '❌ Error',
        error.message || 'Failed to freeze accounts. Please try again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: handleFreezeAll },
        ]
      );
    } finally {
      setFreezing(false);
    }
  };

  const handleFreezeSingle = async (accountId: string) => {
    if (!caseId) {
      Alert.alert('Error', 'Case ID is missing');
      return;
    }

    const account = muleAccounts.find((acc) => acc.id === accountId);
    if (!account || account.status !== 'active') {
      return;
    }

    try {
      setFreezingAccountId(accountId);

      const previousStatus = account.status;
      setFrozenAccounts(new Set([accountId]));
      setMuleAccounts((prev) =>
        prev.map((acc) =>
          acc.id === accountId ? { ...acc, status: 'frozen' as const } : acc
        )
      );

      const request: FreezeRequest = {
        caseId,
        accountIds: [accountId],
        reason: 'AEGIS AI Prediction - High Risk Withdrawal',
        urgency: 'critical',
        notifyBanks: true,
      };

      const result = await freezeAccounts(request);

      if (!result.success) {
        setFrozenAccounts(new Set());
        setMuleAccounts((prev) =>
          prev.map((acc) =>
            acc.id === accountId ? { ...acc, status: previousStatus } : acc
          )
        );
        throw new Error(result.error || 'Failed to freeze account');
      }

      if (result.data) {
        const successfullyFrozen = result.data.frozenAccounts.some(
          (acc: any) => acc.accountId === accountId && acc.status === 'frozen'
        );

        if (successfullyFrozen) {
          setFrozenAccounts(new Set([accountId]));
          // Get remaining active accounts
          const remainingActive = muleAccounts.filter(
            (acc) => acc.id !== accountId && acc.status === 'active'
          );
          // Navigate to Single Freeze Screen
          // @ts-ignore - React Navigation type inference limitation
          navigation.navigate('SingleFreeze' as never, {
            caseId,
            account: { ...account, status: 'frozen' as const },
            responseTime: result.data?.totalExecutionTime || 32,
            npciReference: `NPCI-FRZ-2025-${Math.floor(Math.random() * 1000000)}`,
            remainingAccounts: remainingActive,
          } as never);
        } else {
          setFrozenAccounts(new Set());
          setMuleAccounts((prev) =>
            prev.map((acc) =>
              acc.id === accountId ? { ...acc, status: previousStatus } : acc
            )
          );
          throw new Error('Account freeze failed');
        }
      }
    } catch (error: any) {
      console.error('Freeze error:', error);
      Alert.alert(
        '❌ Error',
        error.message || 'Failed to freeze account. Please try again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: () => handleFreezeSingle(accountId) },
        ]
      );
    } finally {
      setFreezingAccountId(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Mule Accounts</Text>
            <Text style={styles.headerSubtitle}>
              {muleAccounts.length} accounts identified
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[
            styles.freezeAllHeaderButton,
            (freezing || activeAccounts.length === 0) && styles.freezeAllHeaderButtonDisabled,
          ]}
          onPress={handleFreezeAll}
          activeOpacity={0.7}
          disabled={freezing || activeAccounts.length === 0}
        >
          <Text
            style={[
              styles.freezeAllHeaderText,
              (freezing || activeAccounts.length === 0) && styles.freezeAllHeaderTextDisabled,
            ]}
          >
            Freeze All
          </Text>
        </TouchableOpacity>
      </View>

      {/* NPCI Connection Status */}
      <View style={styles.npciStatus}>
        <View style={styles.npciIcon}>
          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
        </View>
        <View style={styles.npciContent}>
          <Text style={styles.npciTitle}>Connected to NPCI</Text>
          <Text style={styles.npciSubtitle}>Real-time freeze capability enabled</Text>
        </View>
        <Animated.View
          style={[
            styles.npciIndicator,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
      </View>

      {/* Account List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {muleAccounts.map((account) => {
          const isFreezing = freezingAccountId === account.id;
          const isFrozen = frozenAccounts.has(account.id) || account.status === 'frozen';
          const isWithdrawn = account.status === 'withdrawn';

          return (
            <View
              key={account.id}
              style={[
                styles.accountCard,
                isWithdrawn && styles.accountCardWithdrawn,
              ]}
            >
              <View style={styles.accountHeader}>
                <View style={styles.accountInfo}>
                  <View
                    style={[
                      styles.bankIcon,
                      { backgroundColor: getBankColor(account.bank) },
                    ]}
                  >
                    <Text style={styles.bankIconText}>{account.bank}</Text>
                  </View>
                  <View>
                    <Text style={styles.bankName}>{account.bankName}</Text>
                    <Text style={styles.accountNumber}>{account.accountNumber}</Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: isWithdrawn
                        ? '#e5e7eb'
                        : '#fef3c7',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color: isWithdrawn
                          ? '#6b7280'
                          : '#d97706',
                      },
                    ]}
                  >
                    {isWithdrawn ? 'WITHDRAWN' : 'ACTIVE'}
                  </Text>
                </View>
              </View>

              <View style={styles.accountStats}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Amount Received</Text>
                  <Text style={styles.statValue}>
                    {formatCurrency(account.amountReceived)}
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Current Balance</Text>
                  <Text
                    style={[
                      styles.statValue,
                      isWithdrawn && styles.statValueWithdrawn,
                      !isWithdrawn && styles.statValueActive,
                    ]}
                  >
                    {formatCurrency(account.currentBalance)}
                  </Text>
                </View>
              </View>

              <View style={styles.accountDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Account Holder</Text>
                  <Text style={styles.detailValue}>{account.accountHolder}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>IFSC Code</Text>
                  <Text style={styles.detailValue}>{account.ifscCode}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Account Age</Text>
                  <Text
                    style={[
                      styles.detailValue,
                      account.accountAge.includes('New') && styles.newAccount,
                    ]}
                  >
                    {account.accountAge}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Location</Text>
                  <Text style={styles.detailValue}>{account.location}</Text>
                </View>
              </View>

              {isWithdrawn ? (
                <View style={styles.withdrawnInfo}>
                  <Ionicons name="information-circle" size={18} color="#6b7280" />
                  <Text style={styles.withdrawnText}>
                    Withdrawn at ATM Vashi • 10:52 AM
                  </Text>
                </View>
              ) : (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[
                      styles.freezeButton,
                      isFreezing && styles.freezeButtonDisabled,
                    ]}
                    onPress={() => handleFreezeSingle(account.id)}
                    activeOpacity={0.8}
                    disabled={isFreezing || freezing}
                  >
                    {isFreezing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
                        <Text style={styles.freezeButtonText}>Freeze Account</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cardButton} activeOpacity={0.7}>
                    <Ionicons name="card-outline" size={20} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        {/* Step Indicator */}
        <View style={styles.stepIndicator}>
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, { backgroundColor: '#ef4444' }]}>
              <Text style={styles.stepNumber}>1</Text>
            </View>
            <Text style={styles.stepLabelActive}>FREEZE</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, { backgroundColor: '#d1d5db' }]}>
              <Text style={styles.stepNumberInactive}>2</Text>
            </View>
            <Text style={styles.stepLabelInactive}>Alert Teams</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, { backgroundColor: '#d1d5db' }]}>
              <Text style={styles.stepNumberInactive}>3</Text>
            </View>
            <Text style={styles.stepLabelInactive}>Intercept</Text>
          </View>
        </View>

        {/* Freeze All Button */}
        <TouchableOpacity
          style={[
            styles.freezeAllBottomButton,
            (freezing || activeAccounts.length === 0) && styles.freezeAllBottomButtonDisabled,
          ]}
          onPress={handleFreezeAll}
          activeOpacity={0.8}
          disabled={freezing || activeAccounts.length === 0}
        >
          <LinearGradient
            colors={
              freezing || activeAccounts.length === 0
                ? ['#9ca3af', '#6b7280']
                : ['#ef4444', '#dc2626']
            }
            style={styles.freezeAllGradient}
          >
            <View style={styles.priorityBadge}>
              <Text style={styles.priorityBadgeText}>⚡ PRIORITY #1</Text>
            </View>
            {freezing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="lock-closed" size={20} color="#FFFFFF" />
            )}
            <Text style={styles.freezeAllBottomText}>
              {freezing
                ? 'Freezing...'
                : `Freeze All Active Accounts (${activeAccounts.length})`}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.hintText}>
          After freeze → Alert nearby police teams to intercept
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  freezeAllHeaderButton: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  freezeAllHeaderButtonDisabled: {
    backgroundColor: '#f3f4f6',
    opacity: 0.6,
  },
  freezeAllHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
  },
  freezeAllHeaderTextDisabled: {
    color: '#9ca3af',
  },
  npciStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    marginTop: 4,
    gap: 12,
  },
  npciIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  npciContent: {
    flex: 1,
  },
  npciTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 2,
  },
  npciSubtitle: {
    fontSize: 12,
    color: '#16a34a',
  },
  npciIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 200,
  },
  accountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  accountCardWithdrawn: {
    opacity: 0.6,
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  bankIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankIconText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  bankName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  accountNumber: {
    fontSize: 14,
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  accountStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 10,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  statValueActive: {
    color: '#ea580c',
  },
  statValueWithdrawn: {
    color: '#6b7280',
  },
  accountDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  newAccount: {
    color: '#dc2626',
    fontWeight: '500',
  },
  withdrawnInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
  },
  withdrawnText: {
    flex: 1,
    fontSize: 14,
    color: '#4b5563',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  freezeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  freezeButtonDisabled: {
    opacity: 0.6,
  },
  freezeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cardButton: {
    width: 48,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
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
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
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
    color: '#dc2626',
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
  freezeAllBottomButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 8,
  },
  freezeAllBottomButtonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0.1,
  },
  freezeAllGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    position: 'relative',
  },
  priorityBadge: {
    position: 'absolute',
    top: -8,
    left: 16,
    backgroundColor: '#fbbf24',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#78350f',
  },
  freezeAllBottomText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  hintText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
});
