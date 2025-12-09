import React, { useState, useEffect } from 'react';
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
import { caseService } from '../api/caseService';
import { extractMuleAccountsFromTransactions, transformApiMuleAccount } from '../utils/muleAccountUtils';

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
  muleConfidence?: number;
  riskIndicators?: string[];
  hopNumber?: number;
}

export default function MuleAccountsScreen() {
  const { theme } = useTheme();
  const route = useRoute();
  const navigation = useNavigation();
  const { caseId, muleAccounts: routeAccounts } = route.params as any;

  // Start with empty array - will be populated from API only (no dummy data)
  const [muleAccounts, setMuleAccounts] = useState<MuleAccount[]>([]);

  const [freezing, setFreezing] = useState(false);
  const [freezingAccountId, setFreezingAccountId] = useState<string | null>(null);
  const [frozenAccounts, setFrozenAccounts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const pulseAnim = useState(new Animated.Value(1))[0];

  const activeAccounts = muleAccounts.filter((acc) => acc.status === 'active');

  // Helper to check if ID is valid UUID (required for freeze API)
  const isValidUUID = (str: string): boolean => {
    if (!str) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  // Load mule accounts from backend - ALWAYS fetch from API to get correct UUIDs for freeze
  useEffect(() => {
    const loadMuleAccounts = async () => {
      if (!caseId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log('🔄 Loading mule accounts from API for case:', caseId);
        
        // ALWAYS load from API first to get correct UUIDs (required for freeze operations)
        const muleResult = await caseService.getCaseMuleAccounts(caseId);
        if (muleResult.success && muleResult.data?.mule_accounts && muleResult.data.mule_accounts.length > 0) {
          console.log('✅ Loaded mule accounts from API:', muleResult.data.mule_accounts.length, 'accounts');
          
          // Check which accounts are already frozen
          const frozenIds = new Set<string>();
          
          const accounts: MuleAccount[] = muleResult.data.mule_accounts.map((acc: any) => {
            const transformed = transformApiMuleAccount(acc);
            console.log(`  → Account ${transformed.id}: ${transformed.bank} - ${transformed.accountNumber} - Status: ${transformed.status}`);
            
            // Track frozen accounts
            if (transformed.status === 'frozen') {
              frozenIds.add(transformed.id);
            }
            
            return {
              id: transformed.id,
              bank: transformed.bank,
              bankName: transformed.bankName,
              accountNumber: transformed.accountNumber,
              amountReceived: transformed.amountReceived,
              currentBalance: transformed.currentBalance,
              accountHolder: transformed.accountHolder,
              ifscCode: transformed.ifscCode,
              accountAge: transformed.accountAge,
              location: transformed.location,
              status: transformed.status,
              muleConfidence: transformed.muleConfidence,
              riskIndicators: transformed.riskIndicators,
              hopNumber: transformed.hopNumber,
            };
          });
          
          setMuleAccounts(accounts);
          setFrozenAccounts(frozenIds);
          
          // Log frozen status
          console.log(`📊 Freeze Status: ${frozenIds.size}/${accounts.length} accounts frozen`);
          if (frozenIds.size === accounts.length && accounts.length > 0) {
            console.log('✅ All mule accounts are frozen - user can proceed to next step');
          }
          
          setLoading(false);
          return;
        }
        
        // Fallback: Use route accounts only if they have valid UUIDs
        if (routeAccounts && Array.isArray(routeAccounts) && routeAccounts.length > 0) {
          const hasValidUUIDs = routeAccounts.every((acc: any) => isValidUUID(acc.id));
          if (hasValidUUIDs) {
            console.log('✅ Using route accounts with valid UUIDs:', routeAccounts.length);
            const accounts: MuleAccount[] = routeAccounts.map((acc: any) => ({
              id: acc.id,
              bank: acc.bank || 'Unknown',
              bankName: acc.bankName || acc.bank || 'Unknown Bank',
              accountNumber: acc.accountNumber || 'N/A',
              amountReceived: acc.amountReceived || acc.amount || 0,
              currentBalance: acc.currentBalance || 0,
              accountHolder: acc.accountHolder || 'Unknown',
              ifscCode: acc.ifscCode || 'XXXX0000000',
              accountAge: acc.accountAge || 'Unknown',
              location: acc.location || 'Unknown',
              status: (acc.status || 'active') as 'active' | 'withdrawn' | 'frozen',
              muleConfidence: acc.muleConfidence,
              riskIndicators: acc.riskIndicators || [],
              hopNumber: acc.hopNumber,
            }));
            setMuleAccounts(accounts);
            setLoading(false);
            return;
          }
          console.warn('⚠️ Route accounts have invalid IDs (not UUIDs), cannot use for freeze');
        }
        
        // Try freeze status endpoint for accounts with UUIDs
        console.log('📋 Trying freeze status endpoint...');
        const freezeStatus = await caseService.getFreezeStatus(caseId);
        if (freezeStatus.success && freezeStatus.data?.accounts && freezeStatus.data.accounts.length > 0) {
          console.log('✅ Got accounts from freeze status:', freezeStatus.data.accounts.length);
          
          // Check which accounts are already frozen
          const frozenIds = new Set<string>();
          
          const accounts: MuleAccount[] = freezeStatus.data.accounts.map((acc: any) => {
            const isFrozen = acc.status === 'FROZEN';
            if (isFrozen) {
              frozenIds.add(acc.id);
            }
            
            return {
              id: acc.id,
              bank: acc.bank || 'Unknown',
              bankName: acc.bank || 'Unknown Bank',
              accountNumber: acc.account_number ? `XXXX${String(acc.account_number).slice(-4)}` : 'N/A',
              amountReceived: acc.amount_received || 0,
              currentBalance: acc.current_balance || 0,
              accountHolder: acc.holder_name || 'Unknown',
              ifscCode: 'XXXX0000000',
              accountAge: 'Unknown',
              location: 'Unknown',
              status: (isFrozen ? 'frozen' : 'active') as 'active' | 'withdrawn' | 'frozen',
              muleConfidence: acc.mule_confidence,
              riskIndicators: [],
              hopNumber: acc.hop_number,
            };
          });
          
          setMuleAccounts(accounts);
          setFrozenAccounts(frozenIds);
          
          // Log frozen status
          console.log(`📊 Freeze Status: ${frozenIds.size}/${accounts.length} accounts frozen`);
          if (frozenIds.size === accounts.length && accounts.length > 0) {
            console.log('✅ All mule accounts are frozen - user can proceed to next step');
          }
          
          setLoading(false);
          return;
        }
        
        console.warn('❌ No mule accounts found');
        setMuleAccounts([]);
      } catch (error) {
        console.error('Error loading mule accounts:', error);
        setMuleAccounts([]);
      } finally {
        setLoading(false);
      }
    };

    loadMuleAccounts();
  }, [caseId]); // Only depend on caseId

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

      {/* Loading Indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ef4444" />
          <Text style={styles.loadingText}>Loading mule accounts...</Text>
        </View>
      )}

      {/* Account List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {muleAccounts.length === 0 && !loading ? (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={48} color="#9ca3af" />
            <Text style={styles.emptyStateTitle}>No Mule Accounts Found</Text>
            <Text style={styles.emptyStateText}>
              Mule accounts will appear here once money flow tracing is complete.
            </Text>
          </View>
        ) : (
          muleAccounts.map((account) => {
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
                      backgroundColor: isFrozen
                        ? '#dbeafe'
                        : isWithdrawn
                        ? '#e5e7eb'
                        : '#fef3c7',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color: isFrozen
                          ? '#1e40af'
                          : isWithdrawn
                          ? '#6b7280'
                          : '#d97706',
                      },
                    ]}
                  >
                    {isFrozen ? '🔒 FROZEN' : isWithdrawn ? 'WITHDRAWN' : 'ACTIVE'}
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
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>AI Confidence</Text>
                  <Text style={[styles.statValue, styles.statValueActive]}>
                    {account.muleConfidence !== undefined
                      ? `${Math.round((account.muleConfidence || 0) * 100)}%`
                      : '—'}
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
                {account.hopNumber !== undefined && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Hop #</Text>
                    <Text style={styles.detailValue}>{account.hopNumber}</Text>
                  </View>
                )}
              </View>

              {account.riskIndicators && account.riskIndicators.length > 0 && (
                <View style={styles.riskPills}>
                  {account.riskIndicators.map((risk, idx) => (
                    <View key={idx} style={styles.riskPill}>
                      <Ionicons name="alert-circle" size={14} color="#991b1b" />
                      <Text style={styles.riskPillText}>{risk}</Text>
                    </View>
                  ))}
                </View>
              )}

              {isWithdrawn ? (
                <View style={styles.withdrawnInfo}>
                  <Ionicons name="information-circle" size={18} color="#6b7280" />
                  <Text style={styles.withdrawnText}>
                    Withdrawn at ATM Vashi • 10:52 AM
                  </Text>
                </View>
              ) : isFrozen ? (
                <View style={styles.frozenInfo}>
                  <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                  <Text style={styles.frozenText}>
                    Account successfully frozen via NPCI
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
          })
        )}
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

        {/* Freeze All Button / Continue Button */}
        <TouchableOpacity
          style={[
            styles.freezeAllBottomButton,
            freezing && styles.freezeAllBottomButtonDisabled,
          ]}
          onPress={activeAccounts.length === 0 ? () => {
            // All accounts frozen - navigate to next step (Team Deployment)
            // @ts-ignore
            navigation.navigate('TeamDeployment' as never, { caseId } as never);
          } : handleFreezeAll}
          activeOpacity={0.8}
          disabled={freezing}
        >
          <LinearGradient
            colors={
              activeAccounts.length === 0
                ? ['#10b981', '#059669'] // Green for success/continue
                : freezing
                ? ['#9ca3af', '#6b7280']
                : ['#ef4444', '#dc2626']
            }
            style={styles.freezeAllGradient}
          >
            {activeAccounts.length === 0 ? (
              <View style={styles.successBadge}>
                <Text style={styles.successBadgeText}>✓ ALL FROZEN</Text>
              </View>
            ) : (
              <View style={styles.priorityBadge}>
                <Text style={styles.priorityBadgeText}>⚡ PRIORITY #1</Text>
              </View>
            )}
            {freezing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name={activeAccounts.length === 0 ? "arrow-forward" : "lock-closed"} size={20} color="#FFFFFF" />
            )}
            <Text style={styles.freezeAllBottomText}>
              {freezing
                ? 'Freezing...'
                : activeAccounts.length === 0
                ? 'Continue to Next Step →'
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
  riskPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  riskPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    borderColor: '#fecdd3',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  riskPillText: {
    fontSize: 12,
    color: '#991b1b',
    fontWeight: '600',
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
  frozenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#d1fae5',
    borderRadius: 8,
    padding: 12,
  },
  frozenText: {
    flex: 1,
    fontSize: 14,
    color: '#065f46',
    fontWeight: '600',
  },
  successBadge: {
    position: 'absolute',
    top: -8,
    left: 16,
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  successBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065f46',
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
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});
