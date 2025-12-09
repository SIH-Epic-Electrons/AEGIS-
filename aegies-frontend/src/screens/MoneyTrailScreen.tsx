import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  SafeAreaView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/theme';
import { graphService, VisualizationNode, VisualizationEdge } from '../api/graphService';
import {
  extractMuleAccountsFromTransactions,
  MuleAccountFromTransaction,
} from '../utils/muleAccountUtils';

interface TransactionNode {
  id: string;
  type: 'victim' | 'mule' | 'predicted' | 'account';
  name: string;
  bank?: string;
  accountNumber: string;
  amount: number;
  status: 'active' | 'frozen' | 'withdrawn';
  timestamp: string;
  location?: string;
  muleNumber?: string;
  withdrawalInfo?: string;
  mule_probability?: number;
  // Balance information
  balanceBefore?: number;
  balanceAfter?: number;
  incomingAmount?: number;
  outgoingAmount?: number;
  locationData?: {
    city?: string;
    state?: string;
    latitude?: number;
    longitude?: number;
  };
  splitInfo?: {
    isSplit: boolean;
    splitCount: number;
    splitAmounts: Array<{ account: string; amount: number; index: number }>;
  };
  isFraudster?: boolean; // Flag to highlight fraudster account
}

export default function MoneyTrailScreen() {
  const { theme } = useTheme();
  const route = useRoute();
  const navigation = useNavigation();
  const { caseId, muleAccounts: routeMuleAccounts } = route.params as any;

  const [loading, setLoading] = useState(true);
  // totalAmount: The TOTAL amount lost by the victim (fraud_amount from case)
  // This should always equal the original fraud_amount, not the sum of transactions
  const [totalAmount, setTotalAmount] = useState(350000);
  // atRiskAmount: Amount currently at risk (in active mule accounts)
  const [atRiskAmount, setAtRiskAmount] = useState(210000);
  const [transactions, setTransactions] = useState<TransactionNode[]>([]);
  const [muleAccountsForFreeze, setMuleAccountsForFreeze] = useState<
    MuleAccountFromTransaction[]
  >([]);
  const [cstPrediction, setCstPrediction] = useState<any>(null); // CST prediction data
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadMoneyTrail();
    loadCSTPrediction();
    
    // Pulse animation for predicted node
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
  }, [caseId]);
  
  const loadCSTPrediction = async () => {
    try {
      const { predictionService } = await import('../api/predictionService');
      const result = await predictionService.getCasePrediction(caseId);
      if (result.success && result.data?.location_prediction?.primary) {
        setCstPrediction(result.data.location_prediction.primary);
      }
    } catch (error) {
      console.warn('Failed to load CST prediction:', error);
    }
  };

  const loadMoneyTrail = async () => {
    try {
      setLoading(true);
      
      // Use the transactions API endpoint
      const { caseService } = await import('../api/caseService');
      
      // First, get case details to get the original fraud amount (TOTAL amount lost by victim)
      const caseResponse = await caseService.getCaseDetails(caseId);
      const originalFraudAmount = caseResponse.success && caseResponse.data?.complaint?.fraud_amount 
        ? caseResponse.data.complaint.fraud_amount 
        : null;
      
      const response = await caseService.getCaseTransactions(caseId);
      
      if (response.success && response.data?.transactions) {
        const txns = response.data.transactions;
        const splits = response.data.splits || {};
        
        // Create a map of mule account statuses from route params (if provided)
        const muleStatusMap = new Map<string, 'active' | 'frozen' | 'withdrawn'>();
        if (routeMuleAccounts && Array.isArray(routeMuleAccounts)) {
          routeMuleAccounts.forEach((acc: any) => {
            // Match by account ID (most reliable)
            if (acc.id) {
              muleStatusMap.set(acc.id, acc.status || 'active');
            }
            // Match by last 4 digits of account number (for masked format XXXX1234)
            if (acc.accountNumber) {
              const last4Digits = acc.accountNumber.replace(/[^0-9]/g, '').slice(-4);
              if (last4Digits) {
                muleStatusMap.set(last4Digits, acc.status || 'active');
              }
              // Also store the full masked account number for matching
              muleStatusMap.set(acc.accountNumber, acc.status || 'active');
            }
          });
        }
        
        // Transform transactions to transaction nodes, passing original fraud amount and status map
        const transactionNodes = transformTransactionsToNodes(txns, splits, originalFraudAmount, muleStatusMap);
        setTransactions(transactionNodes);
        // Build mule account list to pass to MuleAccounts screen so data matches
        const extractedAccounts = extractMuleAccountsFromTransactions(txns, true).map((acc) => {
          const last4 = String(acc.id || '').slice(-4);
          const overrideStatus =
            muleStatusMap.get(acc.id) ||
            muleStatusMap.get(last4) ||
            muleStatusMap.get(acc.accountNumber) ||
            acc.status;
          return {
            ...acc,
            status: overrideStatus || acc.status,
          };
        });
        setMuleAccountsForFreeze(extractedAccounts);
        
        // CRITICAL: Always use original fraud_amount as the total (amount lost by victim)
        // This is the correct total, not the sum of transactions (which may have commissions deducted)
        if (originalFraudAmount && originalFraudAmount > 0) {
          setTotalAmount(originalFraudAmount);
        } else {
          // Fallback: sum transactions if fraud_amount not available
          const calculatedTotal = txns.reduce((sum, t) => sum + (t.amount || 0), 0);
          setTotalAmount(calculatedTotal > 0 ? calculatedTotal : 350000);
        }
        
        // Calculate at-risk amount (sum of CURRENT BALANCES in active mule accounts)
        // This should be the remaining balance, not the amount transferred
        const muleSummary = caseResponse.success && caseResponse.data?.mule_accounts_summary
          ? caseResponse.data.mule_accounts_summary
          : null;
        
        // Calculate from transactions: sum of to_balance_after for ACTIVE (non-frozen) accounts
        // This represents the actual current balance in active mule accounts (frozen accounts are not at risk)
        let calculatedAtRisk = 0;
        if (txns && txns.length > 0) {
          // Get unique accounts and their latest balance, excluding frozen accounts
          const accountBalances = new Map<string, { balance: number; status: string; hop: number }>();
          txns.forEach((txn: any) => {
            if (txn.to_account && txn.to_balance_after !== undefined && txn.to_balance_after !== null) {
              // Use the latest balance (highest hop number for each account)
              const existing = accountBalances.get(txn.to_account);
              if (!existing || (txn.hop_number > existing.hop)) {
                accountBalances.set(txn.to_account, {
                  balance: txn.to_balance_after,
                  status: txn.status || 'active',
                  hop: txn.hop_number || 0
                });
              }
            }
          });
          // Sum balances only for active (non-frozen, non-withdrawn) accounts
          calculatedAtRisk = Array.from(accountBalances.values())
            .filter(acc => acc.status === 'COMPLETED' || acc.status === 'active' || !acc.status)
            .reduce((sum, acc) => sum + acc.balance, 0);
        }
        
        if (calculatedAtRisk > 0) {
          // Use calculated balance from transactions
          setAtRiskAmount(calculatedAtRisk);
        } else if (muleSummary && muleSummary.total_amount > 0) {
          // Fallback: use mule summary (but this might be amount_received, not balance)
          // Try to estimate: assume 80% still in accounts
          setAtRiskAmount(muleSummary.total_amount * 0.8);
        } else {
          // Last fallback: estimate 70% of fraud amount still at risk
          const totalToUse = originalFraudAmount || totalAmount;
          setAtRiskAmount(totalToUse * 0.7);
        }
      } else {
        // No transactions found - show empty state
        console.log('No transactions found for case:', caseId);
        setTransactions([]);
        setTotalAmount(0);
        setAtRiskAmount(0);
      }
    } catch (error) {
      console.error('Error loading money trail:', error);
      // Show empty state on error, don't use dummy data
      setTransactions([]);
      setTotalAmount(0);
      setAtRiskAmount(0);
    } finally {
      setLoading(false);
    }
  };
  
  // Transform API transactions to display nodes
  const transformTransactionsToNodes = (
    transactions: any[], 
    splits: any, 
    originalFraudAmount: number | null = null,
    muleAccountsStatusMap: Map<string, 'active' | 'frozen' | 'withdrawn'> = new Map()
  ): TransactionNode[] => {
    const nodes: TransactionNode[] = [];
    const processedAccounts = new Set<string>();
    const splitGroups = new Map<string, any[]>();
    
    // Group transactions by split_group_id
    transactions.forEach(txn => {
      if (txn.split_group_id) {
        if (!splitGroups.has(txn.split_group_id)) {
          splitGroups.set(txn.split_group_id, []);
        }
        splitGroups.get(txn.split_group_id)!.push(txn);
      }
    });
    
    // Sort transactions by hop_number and timestamp
    const sortedTxns = [...transactions].sort((a, b) => {
      if (a.hop_number !== b.hop_number) return a.hop_number - b.hop_number;
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
    
    // Find the first transaction to identify victim account
    const firstTxn = sortedTxns.length > 0 ? sortedTxns[0] : null;
    const victimAccount = firstTxn?.from_account || '';
    
    let muleIndex = 1;
    let victimNodeAdded = false;
    
    // Add victim node first with original fraud amount (TOTAL amount lost)
    // This is the correct amount to display, representing the total loss
    if (originalFraudAmount && firstTxn) {
      nodes.push({
        id: 'victim',
        type: 'victim',
        name: 'Victim Account',
        bank: firstTxn.from_bank || 'Unknown Bank',
        accountNumber: victimAccount ? `XXXX${victimAccount.slice(-4)}` : 'XXXX',
        amount: originalFraudAmount, // TOTAL amount lost by victim (not just first transaction)
        status: 'active',
        timestamp: formatTimeFromISO(firstTxn.timestamp),
      });
      victimNodeAdded = true;
      processedAccounts.add(victimAccount);
    } else if (firstTxn) {
      // Fallback: use first transaction amount if fraud_amount not available
      nodes.push({
        id: 'victim',
        type: 'victim',
        name: 'Victim Account',
        bank: firstTxn.from_bank || 'Unknown Bank',
        accountNumber: victimAccount ? `XXXX${victimAccount.slice(-4)}` : 'XXXX',
        amount: firstTxn.amount || 0,
        status: 'active',
        timestamp: formatTimeFromISO(firstTxn.timestamp),
      });
      victimNodeAdded = true;
      processedAccounts.add(victimAccount);
    }
    
    sortedTxns.forEach((txn, idx) => {
      // Check if this is part of a split
      if (txn.split_group_id && splitGroups.has(txn.split_group_id)) {
        const splitGroup = splitGroups.get(txn.split_group_id)!;
        const isFirstInSplit = txn.split_index === 0 || txn.split_index === Math.min(...splitGroup.map(s => s.split_index || 0));
        
        // Only add the first transaction in a split group as the main node
        if (isFirstInSplit) {
          const splitTotal = txn.split_total || splitGroup.length;
          const splitAmount = splitGroup.reduce((sum, s) => sum + (s.amount || 0), 0);
          
          // Get balance information from first transaction in split
          const firstSplitTxn = splitGroup[0];
          // Check if this is fraudster account (hop 1, first receiving account)
          const isFraudster = txn.hop_number === 1;
          const accountName = isFraudster 
            ? 'Fraudster Account' 
            : `${txn.to_holder_name || txn.to_bank} Account`;
          
          // Use status from muleAccountsStatusMap if available, otherwise from transaction
          // Try matching by: 1) full account number, 2) account ID, 3) last 4 digits
          const accountStatus = muleAccountsStatusMap.get(txn.to_account) || 
                                muleAccountsStatusMap.get(txn.id) ||
                                muleAccountsStatusMap.get(txn.to_account.slice(-4)) ||
                                (txn.status === 'FROZEN' ? 'frozen' : txn.status === 'WITHDRAWN' ? 'withdrawn' : 'active');
          
          nodes.push({
            id: txn.id,
            type: 'mule',
            name: accountName,
            bank: txn.to_bank,
            accountNumber: txn.to_account ? `XXXX${txn.to_account.slice(-4)}` : 'XXXX',
            amount: splitAmount,
            status: accountStatus,
            timestamp: formatTimeFromISO(txn.timestamp),
            muleNumber: isFraudster ? 'FRAUDSTER' : `M${muleIndex++}`,
            balanceBefore: firstSplitTxn.to_balance_before,
            balanceAfter: firstSplitTxn.to_balance_after,
            incomingAmount: splitAmount,
            locationData: firstSplitTxn.to_location,
            location: firstSplitTxn.to_location ? `${firstSplitTxn.to_location.city || ''}, ${firstSplitTxn.to_location.state || ''}`.trim() : undefined,
            isFraudster: isFraudster, // Flag to highlight fraudster
            // Store split information
            splitInfo: {
              isSplit: true,
              splitCount: splitTotal,
              splitAmounts: splitGroup.map(s => ({ account: s.to_account, amount: s.amount, index: s.split_index })),
            },
          });
          processedAccounts.add(txn.to_account);
        }
      } else if (!processedAccounts.has(txn.to_account)) {
        // Regular transaction (not part of a split we've already processed)
        // Always add mule accounts (skip check for victim account since we already added it)
        
        // Check if this is fraudster account (hop 1, first receiving account)
        const isFraudster = txn.hop_number === 1;
        const accountName = isFraudster 
          ? 'Fraudster Account' 
          : `${txn.to_holder_name || txn.to_bank} Account`;
        
        // Use status from muleAccountsStatusMap if available, otherwise from transaction
        // Try matching by: 1) full account number, 2) account ID, 3) last 4 digits
        const accountStatus = muleAccountsStatusMap.get(txn.to_account) || 
                              muleAccountsStatusMap.get(txn.id) ||
                              muleAccountsStatusMap.get(txn.to_account.slice(-4)) ||
                              (txn.status === 'FROZEN' ? 'frozen' : txn.status === 'WITHDRAWN' ? 'withdrawn' : 'active');
        
        nodes.push({
          id: txn.id,
          type: 'mule',
          name: accountName,
          bank: txn.to_bank,
          accountNumber: txn.to_account ? `XXXX${txn.to_account.slice(-4)}` : 'XXXX',
          amount: txn.amount,
          status: accountStatus,
          timestamp: formatTimeFromISO(txn.timestamp),
          muleNumber: isFraudster ? 'FRAUDSTER' : `M${muleIndex++}`,
          balanceBefore: txn.to_balance_before,
          balanceAfter: txn.to_balance_after,
          incomingAmount: txn.amount,
          locationData: txn.to_location,
          location: txn.to_location ? `${txn.to_location.city || ''}, ${txn.to_location.state || ''}`.trim() : undefined,
          isFraudster: isFraudster, // Flag to highlight fraudster
        });
        processedAccounts.add(txn.to_account);
      }
    });
    
    // Add predicted location at the end (from CST model)
    if (nodes.length > 0) {
      const lastMule = nodes.filter(n => n.type === 'mule').pop();
      if (lastMule && cstPrediction) {
        // Use actual CST prediction data
        nodes.push({
          id: 'predicted',
          type: 'predicted',
          name: cstPrediction.name || 'Likely Cash-Out Location',
          accountNumber: '',
          amount: lastMule.amount,
          status: 'active',
          timestamp: 'In ~25 mins',
          location: cstPrediction.address || cstPrediction.name || 'Predicted ATM Location',
          locationData: {
            city: cstPrediction.city,
            state: cstPrediction.state,
            latitude: cstPrediction.lat,
            longitude: cstPrediction.lon,
          },
        });
      } else if (lastMule) {
        // Fallback if CST prediction not available
        nodes.push({
          id: 'predicted',
          type: 'predicted',
          name: 'Likely Cash-Out Location',
          accountNumber: '',
          amount: lastMule.amount,
          status: 'active',
          timestamp: 'In ~25 mins',
          location: 'Location prediction pending...',
        });
      }
    }
    
    return nodes; // Return empty array if no nodes, don't use default data
  };

  // Transform graph visualization data to transaction nodes for linear display
  const transformGraphToTransactions = (
    nodes: VisualizationNode[],
    edges: VisualizationEdge[]
  ): TransactionNode[] => {
    // Sort edges by hop number to maintain order
    const sortedEdges = [...edges].sort((a, b) => (a.hop_number || 0) - (b.hop_number || 0));
    
    // Create a map of nodes
    const nodeMap = new Map<string, VisualizationNode>();
    nodes.forEach(n => nodeMap.set(n.id, n));
    
    // Build transaction list from edges
    const transactionNodes: TransactionNode[] = [];
    const processedNodes = new Set<string>();
    
    // Find victim node (start of chain)
    const victimNode = nodes.find(n => n.node_type === 'victim');
    if (victimNode) {
      transactionNodes.push({
        id: victimNode.id,
        type: 'victim',
        name: victimNode.holder_name || victimNode.label || 'Victim',
        bank: victimNode.bank,
        accountNumber: victimNode.account_number || victimNode.id,
        amount: sortedEdges.length > 0 ? sortedEdges[0].amount : 0,
        status: 'active',
        timestamp: sortedEdges.length > 0 && sortedEdges[0].timestamp 
          ? formatTimeFromISO(sortedEdges[0].timestamp)
          : new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      });
      processedNodes.add(victimNode.id);
    }
    
    // Process edges to add mule accounts
    let muleIndex = 1;
    sortedEdges.forEach((edge, idx) => {
      const targetNode = nodeMap.get(edge.target);
      if (targetNode && !processedNodes.has(targetNode.id)) {
        const nodeType = targetNode.is_mule === 1 ? 'mule' : 'account';
        
        transactionNodes.push({
          id: targetNode.id,
          type: nodeType as any,
          name: targetNode.holder_name || targetNode.label || `${targetNode.bank} Account`,
          bank: targetNode.bank,
          accountNumber: targetNode.account_number || targetNode.id,
          amount: edge.amount,
          status: 'active', // Would come from actual data
          timestamp: edge.timestamp 
            ? formatTimeFromISO(edge.timestamp)
            : new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          muleNumber: nodeType === 'mule' ? `M${muleIndex++}` : undefined,
          mule_probability: targetNode.mule_probability,
        });
        processedNodes.add(targetNode.id);
      }
    });
    
    // Add predicted cash-out location at the end (from CST model)
    if (transactionNodes.length > 0) {
      const lastMule = transactionNodes.filter(t => t.type === 'mule').pop();
      if (lastMule && cstPrediction) {
        // Use actual CST prediction data
        transactionNodes.push({
          id: 'predicted',
          type: 'predicted',
          name: cstPrediction.name || 'Likely Cash-Out Location',
          accountNumber: '',
          amount: lastMule.amount,
          status: 'active',
          timestamp: 'In ~25 mins',
          location: cstPrediction.address || cstPrediction.name || 'Predicted ATM Location',
          locationData: {
            city: cstPrediction.city,
            state: cstPrediction.state,
            latitude: cstPrediction.lat,
            longitude: cstPrediction.lon,
          },
        });
      } else if (lastMule) {
        // Fallback if CST prediction not available
        transactionNodes.push({
          id: 'predicted',
          type: 'predicted',
          name: 'Likely Cash-Out Location',
          accountNumber: '',
          amount: lastMule.amount,
          status: 'active',
          timestamp: 'In ~25 mins',
          location: 'Location prediction pending...',
        });
      }
    }
    
    return transactionNodes; // Return empty array if no nodes, don't use default data
  };

  const formatTimeFromISO = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return isoString;
    }
  };

  // Removed getDefaultTransactions - always use API data

  const formatAmount = (amount: number) => {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)}L`;
    }
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const formatTime = (timestamp: string) => {
    // If already formatted, return as is
    if (timestamp.includes('AM') || timestamp.includes('PM') || timestamp.includes('In')) {
      return timestamp;
    }
    // Otherwise format from ISO string
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return timestamp;
    }
  };

  const getNodeColor = (type: string, status: string, isFraudster?: boolean) => {
    if (type === 'victim') return '#10B981'; // green-500
    if (type === 'predicted') return '#EF4444'; // red-500
    if (status === 'withdrawn') return '#9CA3AF'; // gray-400
    if (status === 'frozen') return '#EF4444'; // red-500
    if (isFraudster) return '#EAB308'; // yellow-500 (highlight fraudster)
    return '#F97316'; // orange-500
  };

  const getStatusBadge = (type: string, status: string, mule_probability?: number, isFraudster?: boolean) => {
    if (type === 'victim') {
      return { label: 'VICTIM', bg: '#D1FAE5', text: '#065F46' };
    }
    if (type === 'predicted') {
      return { label: 'PREDICTED', bg: '#FEE2E2', text: '#991B1B' };
    }
    if (type === 'account') {
      return { label: 'ACCOUNT', bg: '#DBEAFE', text: '#1E40AF' };
    }
    if (isFraudster) {
      // Highlight fraudster account
      if (status === 'frozen') {
        return { label: 'FRAUDSTER • FROZEN', bg: '#FEE2E2', text: '#991B1B' };
      }
      return { label: 'FRAUDSTER • ACTIVE', bg: '#FEF3C7', text: '#92400E' }; // Yellow highlight
    }
    if (status === 'withdrawn') {
      return { label: 'MULE • WITHDRAWN', bg: '#F3F4F6', text: '#4B5563' };
    }
    if (status === 'frozen') {
      return { label: 'MULE • FROZEN', bg: '#FEE2E2', text: '#991B1B' };
    }
    const probLabel = mule_probability ? ` ${Math.round(mule_probability * 100)}%` : '';
    return { label: `MULE${probLabel} • ACTIVE`, bg: '#FED7AA', text: '#9A3412' };
  };

  const activeAccountsCount = transactions.filter(
    (t) => t.type === 'mule' && t.status === 'active'
  ).length;

  const handleFreezeActive = () => {
    // @ts-ignore - React Navigation type inference limitation
    navigation.navigate('MuleAccounts' as never, {
      caseId,
      muleAccounts: muleAccountsForFreeze,
    } as never);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.colors.surface }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Money Trail</Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            Case #{caseId || 'MH-2025-84721'}
          </Text>
        </View>
      </View>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <LinearGradient
          colors={['#1e293b', '#0f172a']}
          style={styles.summaryGradient}
        >
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.summaryLabel}>Total Amount</Text>
              <Text style={styles.summaryAmount}>{formatAmount(totalAmount)}</Text>
            </View>
            <View style={styles.summaryRight}>
              <Text style={styles.summaryLabel}>Current Status</Text>
              <Text style={styles.atRiskAmount}>₹{(atRiskAmount / 100000).toFixed(2)}L at risk</Text>
            </View>
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.legendText}>Victim</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F97316' }]} />
              <Text style={styles.legendText}>Active Mule</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.legendText}>Frozen</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#9CA3AF' }]} />
              <Text style={styles.legendText}>Withdrawn</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Money Flow Visualization */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={48} color="#9ca3af" />
            <Text style={styles.emptyStateTitle}>No Money Trail Data</Text>
            <Text style={styles.emptyStateText}>
              Money flow tracing is in progress. Transactions will appear here once CFCFRMS completes the trace.
            </Text>
          </View>
        ) : (
          <View style={styles.flowContainer}>
            {/* Vertical Line */}
            <View style={styles.verticalLine} />

            {transactions.map((node, index) => {
            const nodeColor = getNodeColor(node.type, node.status, node.isFraudster);
            const statusBadge = getStatusBadge(node.type, node.status, node.mule_probability, node.isFraudster);
            const isPredicted = node.type === 'predicted';
            const isWithdrawn = node.status === 'withdrawn';

            return (
              <React.Fragment key={node.id}>
                {/* Transaction Node */}
                <View style={styles.nodeContainer}>
                  <Animated.View
                    style={[
                      styles.nodeIcon,
                      {
                        backgroundColor: nodeColor,
                        transform: isPredicted ? [{ scale: pulseAnim }] : [],
                      },
                      isPredicted && styles.nodeIconPulse,
                    ]}
                  >
                    {node.type === 'victim' ? (
                      <Ionicons name="person" size={20} color="#FFFFFF" />
                    ) : node.type === 'predicted' ? (
                      <Ionicons name="location" size={20} color="#FFFFFF" />
                    ) : (
                      <Text style={styles.muleNumber}>{node.muleNumber || `M${index}`}</Text>
                    )}
                  </Animated.View>

                  <View
                    style={[
                      styles.nodeCard,
                      { backgroundColor: theme.colors.surface },
                      isPredicted && styles.predictedCard,
                      !isPredicted && node.type === 'mule' && {
                        borderLeftWidth: 4,
                        borderLeftColor: nodeColor,
                      },
                      isWithdrawn && styles.withdrawnCard,
                    ]}
                  >
                    <View style={styles.nodeHeader}>
                      <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}>
                        <Text style={[styles.statusText, { color: statusBadge.text }]}>
                          {statusBadge.label}
                        </Text>
                      </View>
                      <Text style={[styles.nodeTime, { color: theme.colors.textSecondary }]}>
                        {formatTime(node.timestamp)}
                      </Text>
                    </View>

                    <Text style={[styles.nodeName, { color: theme.colors.text }]}>
                      {node.name}
                    </Text>

                    {node.type !== 'predicted' && (
                      <Text style={[styles.nodeDetails, { color: theme.colors.textSecondary }]}>
                        {node.bank || ''} {node.bank ? '•' : ''} {node.accountNumber}
                        {node.location ? ` • ${node.location}` : ''}
                      </Text>
                    )}

                    {node.type === 'predicted' && (
                      <Text style={[styles.nodeDetails, { color: theme.colors.textSecondary }]}>
                        {node.location}
                      </Text>
                    )}

                    <Text
                      style={[
                        styles.nodeAmount,
                        {
                          color:
                            node.type === 'victim'
                              ? '#DC2626'
                              : node.type === 'predicted'
                              ? '#DC2626'
                              : isWithdrawn
                              ? theme.colors.textSecondary
                              : '#EA580C',
                        },
                      ]}
                    >
                      {node.type === 'victim' ? '-' : ''}
                      {formatAmount(node.amount)}
                      {node.type === 'predicted' && ' at risk'}
                    </Text>

                    {node.type === 'mule' && node.status === 'active' && (
                      <View>
                        {node.balanceAfter !== undefined && (
                          <Text style={[styles.nodeSubtext, { color: theme.colors.textSecondary }]}>
                            Balance: {formatAmount(node.balanceAfter)}
                          </Text>
                        )}
                        {node.incomingAmount !== undefined && node.balanceBefore !== undefined && (
                          <Text style={[styles.nodeSubtext, { color: theme.colors.textSecondary, fontSize: 11 }]}>
                            Received {formatAmount(node.incomingAmount)} • Previous: {formatAmount(node.balanceBefore)}
                          </Text>
                        )}
                      </View>
                    )}

                    {node.withdrawalInfo && (
                      <View style={styles.withdrawalInfo}>
                        <Ionicons name="cash-outline" size={14} color={theme.colors.textSecondary} />
                        <Text style={[styles.withdrawalText, { color: theme.colors.textSecondary }]}>
                          {node.withdrawalInfo}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Arrow/Connector */}
                {index < transactions.length - 1 && (
                  <View style={styles.connector}>
                    {node.splitInfo?.isSplit ? (
                      <>
                        <Ionicons name="git-branch" size={18} color={theme.colors.textSecondary} />
                        <Text style={[styles.connectorText, { color: theme.colors.textSecondary }]}>
                          Split into {node.splitInfo.splitCount} accounts
                        </Text>
                        {/* Show split breakdown */}
                        <View style={styles.splitBreakdown}>
                          {node.splitInfo.splitAmounts.map((split, splitIdx) => (
                            <View key={splitIdx} style={styles.splitItem}>
                              <Text style={[styles.splitText, { color: theme.colors.textSecondary }]}>
                                Account {split.index + 1}: {formatAmount(split.amount)}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </>
                    ) : (
                      <>
                        <Ionicons name="arrow-down" size={18} color={theme.colors.textSecondary} />
                        <Text style={[styles.connectorText, { color: theme.colors.textSecondary }]}>
                          {index === 0 ? 'Transferred to' : 'Moved to'}
                        </Text>
                      </>
                    )}
                  </View>
                )}
              </React.Fragment>
            );
            })}
          </View>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={[styles.bottomActions, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
        <TouchableOpacity
          style={[styles.freezeButton, { backgroundColor: '#EF4444' }]}
          onPress={handleFreezeActive}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#EF4444', '#DC2626']}
            style={styles.freezeButtonGradient}
          >
            <Ionicons name="ban" size={20} color="#FFFFFF" />
            <Text style={styles.freezeButtonText}>
              Freeze Active Accounts ({activeAccountsCount})
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  summaryCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  summaryGradient: {
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  summaryRight: {
    alignItems: 'flex-end',
  },
  summaryLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 4,
  },
  summaryAmount: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  atRiskAmount: {
    color: '#FB923C',
    fontSize: 14,
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  flowContainer: {
    position: 'relative',
  },
  verticalLine: {
    position: 'absolute',
    left: 24,
    top: 32,
    bottom: 32,
    width: 2,
    backgroundColor: '#E5E7EB',
  },
  nodeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 24,
  },
  nodeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  nodeIconPulse: {
    shadowColor: '#EF4444',
    shadowOpacity: 0.5,
  },
  muleNumber: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  nodeCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  predictedCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  withdrawnCard: {
    opacity: 0.75,
  },
  nodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  nodeTime: {
    fontSize: 12,
  },
  nodeName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  nodeDetails: {
    fontSize: 14,
    marginBottom: 8,
  },
  nodeAmount: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  nodeSubtext: {
    fontSize: 12,
    marginTop: 4,
  },
  withdrawalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  withdrawalText: {
    fontSize: 12,
  },
  connector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 16,
    marginBottom: 8,
  },
  connectorText: {
    fontSize: 12,
  },
  bottomActions: {
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
  freezeButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  freezeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  freezeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  splitBreakdown: {
    marginTop: 8,
    marginLeft: 26,
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    gap: 4,
  },
  splitItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  splitText: {
    fontSize: 11,
    fontStyle: 'italic',
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
