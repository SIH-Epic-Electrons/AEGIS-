import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { apiService } from '../services/api';
import { useTheme } from '../theme/theme';
import MapView, { Marker } from 'react-native-maps';
import { getCaseDetails, CaseDetails } from '../services/caseService';
import { websocketService } from '../services/websocketService';
import WebSocketStatusIndicator from '../components/WebSocketStatusIndicator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { caseService } from '../api';
import { predictionService } from '../api';
import { extractMuleAccountsFromTransactions, transformApiMuleAccount } from '../utils/muleAccountUtils';

interface MuleAccount {
  id: string;
  bank: string;
  bankName?: string;
  accountNumber: string;
  amount: number;
  amountReceived?: number;
  currentBalance?: number;
  accountHolder?: string;
  ifscCode?: string;
  accountAge?: string;
  location?: string;
  status: 'active' | 'withdrawn' | 'frozen';
  hopNumber?: number; // For tracking latest transaction hop
}

interface FreezeStatus {
  caseId: string;
  frozenAccounts: string[];
  totalFrozen: number;
  status: 'pending' | 'completed' | 'failed';
}

interface CaseUpdate {
  type: 'status_changed' | 'freeze_completed' | 'team_deployed' | 'countdown_update';
  data: any;
}

// Format reported_at timestamp
const formatReportedAt = (timestamp: string | null | undefined) => {
  if (!timestamp) return 'Not available';
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    
    // Format as date and time
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return timestamp;
  }
};

export default function CaseDetailScreen() {
  const { theme } = useTheme();
  const route = useRoute();
  const navigation = useNavigation();
  const { alertId, alert, caseId } = route.params as any;
  const effectiveCaseId = caseId || alertId || alert?.id;
  
  // Type guard for caseData
  const getCaseData = (): CaseDetails | null => {
    if (!caseData) return null;
    return caseData as CaseDetails;
  };

  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [caseData, setCaseData] = useState<CaseDetails | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [muleAccounts, setMuleAccounts] = useState<MuleAccount[]>([]);
  const [freezeStatus, setFreezeStatus] = useState<FreezeStatus | null>(null);
  const unsubscribeRef = useRef<(() => void)[]>([]);

  // Load case data on mount
  useEffect(() => {
    if (effectiveCaseId) {
      // If alert data is provided, use it immediately for smooth transition
      if (alert) {
        setCaseData(alert as any);
        // Calculate countdown from alert data for immediate display
        if (alert.prediction?.timeWindow) {
          if (alert.prediction.timeWindow.end) {
            const endTime = new Date(alert.prediction.timeWindow.end).getTime();
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
            setTimeRemaining(remaining);
          } else if (alert.prediction.timeWindow.remaining) {
            setTimeRemaining(alert.prediction.timeWindow.remaining * 60);
          }
        }
        setLoading(false);
        // Still try to load fresh data in background
        loadCaseData();
      } else {
        loadCaseData();
      }
    } else {
      // Use alert data if available
      if (alert) {
        setCaseData(alert as any);
        // Calculate countdown from alert data
        if (alert.prediction?.timeWindow) {
          if (alert.prediction.timeWindow.end) {
            const endTime = new Date(alert.prediction.timeWindow.end).getTime();
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
            setTimeRemaining(remaining);
          } else if (alert.prediction.timeWindow.remaining) {
            setTimeRemaining(alert.prediction.timeWindow.remaining * 60);
          }
        }
        setLoading(false);
      } else {
        setError('No case ID provided');
        setLoading(false);
      }
    }

    return () => {
      // Cleanup all subscriptions
      unsubscribeRef.current.forEach((unsub) => unsub());
      unsubscribeRef.current = [];
    };
  }, [effectiveCaseId, alert]);

  const loadCaseData = async () => {
    if (!effectiveCaseId) {
      setError('No case ID provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 1. Get case details from API
      const result = await getCaseDetails(effectiveCaseId);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to load case details');
      }

      setCaseData(result.data);

      // 2. Calculate countdown from backend time window
      // Default to 30 minutes (1800 seconds) if no time window is provided
      const prediction = result.data.prediction as any;
      if (prediction?.time_window || prediction?.timeWindow) {
        const timeWindow = prediction.time_window || prediction.timeWindow;
        if (timeWindow?.end) {
          const endTime = new Date(timeWindow.end).getTime();
          const now = Date.now();
          const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
          setTimeRemaining(remaining);
        } else {
          // Default to 30 minutes if no end time
          setTimeRemaining(30 * 60); // 30 minutes in seconds
        }
      } else {
        // Default to 30 minutes countdown if no prediction time window
        setTimeRemaining(30 * 60); // 30 minutes in seconds
      }

      // 3. Load mule accounts from API
      // First try to get from mule accounts endpoint (use getCaseMuleAccounts for consistency)
      try {
        const muleResult = await caseService.getCaseMuleAccounts(effectiveCaseId);
        if (muleResult.success && muleResult.data?.mule_accounts && muleResult.data.mule_accounts.length > 0) {
          // Transform API response to consistent format
          const accounts: MuleAccount[] = muleResult.data.mule_accounts.map((acc: any) => {
            const transformed = transformApiMuleAccount(acc);
            return {
              id: transformed.id,
              bank: transformed.bank,
              bankName: transformed.bankName,
              accountNumber: transformed.accountNumber,
              amount: transformed.amountReceived,
              amountReceived: transformed.amountReceived,
              currentBalance: transformed.currentBalance,
              accountHolder: transformed.accountHolder,
              ifscCode: transformed.ifscCode,
              accountAge: transformed.accountAge,
              location: transformed.location,
              status: transformed.status,
              hopNumber: transformed.hopNumber,
            };
          });
          console.log('✅ Loaded mule accounts from API endpoint:', accounts.length, 'accounts');
          console.log('📊 Mule accounts data:', JSON.stringify(accounts, null, 2));
          accounts.forEach(acc => {
            console.log(`  → Account ${acc.id}: ${acc.bank} - ${acc.accountNumber} - Status: ${acc.status}`);
          });
          setMuleAccounts(accounts);
        } else {
          // Fallback: Extract mule accounts from transactions (from CFCFRMS flow)
          console.log('Mule accounts endpoint returned no data, extracting from transactions...');
          try {
            const transactionsResult = await caseService.getCaseTransactions(effectiveCaseId);
            if (transactionsResult.success && transactionsResult.data?.transactions && transactionsResult.data.transactions.length > 0) {
              // Use shared utility to extract mule accounts consistently
              const extractedAccounts = extractMuleAccountsFromTransactions(
                transactionsResult.data.transactions,
                true // Skip victim account
              );
              
              // Transform to MuleAccount format
              const accounts: MuleAccount[] = extractedAccounts.map(acc => ({
                id: acc.id,
                bank: acc.bank,
                bankName: acc.bankName,
                accountNumber: acc.accountNumber,
                amount: acc.amountReceived,
                amountReceived: acc.amountReceived,
                currentBalance: acc.currentBalance,
                accountHolder: acc.accountHolder,
                ifscCode: acc.ifscCode,
                accountAge: acc.accountAge,
                location: acc.location,
                status: acc.status,
                hopNumber: acc.hopNumber,
              }));
              
              if (accounts.length > 0) {
                console.log('✅ Extracted mule accounts from transactions:', accounts.length, 'accounts');
                console.log('📊 Extracted accounts data:', JSON.stringify(accounts, null, 2));
                accounts.forEach(acc => {
                  console.log(`  → Account ${acc.id}: ${acc.bank} - ${acc.accountNumber} - Status: ${acc.status}`);
                });
                setMuleAccounts(accounts);
              } else {
                console.log('No mule accounts found in transactions');
                setMuleAccounts([]);
              }
            } else {
              console.log('No transactions found for case');
              setMuleAccounts([]);
            }
          } catch (txnError) {
            console.warn('Failed to load mule accounts from transactions:', txnError);
            setMuleAccounts([]);
          }
        }
      } catch (muleError) {
        console.warn('Failed to load mule accounts:', muleError);
        setMuleAccounts([]);
      }

      // 3b. Load prediction data from CST model
      try {
        const predResult = await predictionService.getCasePrediction(effectiveCaseId);
        if (predResult.success && predResult.data) {
          const pred = predResult.data;
          
          // Check if CST model was actually used
          const modelInfo = pred.model_info as any; // Type assertion for optional property
          const cstModelUsed = modelInfo?.cst_model_used || 
                              pred.model_info?.model_name === 'CST-Transformer';
          
          if (!cstModelUsed) {
            console.warn('CST model was not used for this prediction. Using fallback data.');
          } else {
            console.log('CST model prediction loaded:', {
              model: pred.model_info?.model_name,
              mode: pred.model_info?.mode,
              confidence: pred.location_prediction?.primary?.confidence
            });
          }
          
          // Update case data with prediction
          if (pred.location_prediction?.primary) {
            const primary = pred.location_prediction.primary;
            
            // Validate coordinates are present
            if (primary.lat && primary.lon) {
              // If address is missing, try reverse geocoding
              if (!primary.address || primary.address === '' || primary.name === 'Unknown ATM') {
                try {
                  const { reverseGeocodingService } = await import('../services/reverseGeocodingService');
                  const geocodeResult = await reverseGeocodingService.reverseGeocode(primary.lat, primary.lon);
                  if (geocodeResult.success && geocodeResult.data) {
                    primary.address = geocodeResult.data.address || geocodeResult.data.formatted_address;
                    primary.city = geocodeResult.data.city || primary.city;
                    if (geocodeResult.data.state) {
                      primary.state = geocodeResult.data.state;
                    }
                    // Update name if it's "Unknown ATM"
                    if (primary.name === 'Unknown ATM' && geocodeResult.data.city) {
                      primary.name = `ATM near ${geocodeResult.data.city}`;
                    }
                    console.log('Reverse geocoded address:', geocodeResult.data.address);
                  }
                } catch (geocodeError) {
                  console.warn('Reverse geocoding failed:', geocodeError);
                }
              }
              
              console.log('CST prediction coordinates:', {
                lat: primary.lat,
                lon: primary.lon,
                name: primary.name,
                address: primary.address
              });
              
              setCaseData((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  prediction: {
                    ...prev.prediction,
                    predictedAtm: {
                      id: primary.atm_id || '',
                      name: primary.name || '',
                      bank: primary.bank || '',
                      address: primary.address || '',
                      latitude: primary.lat,
                      longitude: primary.lon,
                    },
                    confidence: primary.confidence || prev.prediction?.confidence || 0,
                    cstModelUsed: cstModelUsed,  // Flag to indicate CST model was used
                  },
                  predictedLocation: {
                    name: primary.name || '',
                    address: primary.address || '',
                    latitude: primary.lat,
                    longitude: primary.lon,
                  },
                  confidence: primary.confidence || prev.confidence || 0,
                  modelInfo: pred.model_info,  // Store model info
                };
              });
            } else {
              console.warn('CST prediction missing coordinates:', primary);
            }
          }
          
          // Update time window if available
          if (pred.time_prediction) {
            if (pred.time_prediction.window_end) {
              const endTime = new Date(pred.time_prediction.window_end).getTime();
              const now = Date.now();
              const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
              setTimeRemaining(remaining);
            } else {
              // Default to 30 minutes if no end time
              setTimeRemaining(30 * 60);
            }
          }
        } else {
          console.warn('Failed to get CST prediction:', predResult.error);
        }
      } catch (predError) {
        console.error('Failed to load CST prediction:', predError);
      }

      // 4. Get freeze status
      try {
        if (result.data.freezeStatus) {
          setFreezeStatus(result.data.freezeStatus);
        }
      } catch (freezeError) {
        console.warn('Failed to load freeze status:', freezeError);
      }

      // 5. Subscribe to real-time updates
      const unsub1 = websocketService.subscribe(`case_${effectiveCaseId}`, (update: CaseUpdate) => {
        handleCaseUpdate(update);
      });
      unsubscribeRef.current.push(unsub1);

      // 6. Subscribe to countdown updates
      const unsub2 = websocketService.subscribe(`countdown_${effectiveCaseId}`, (data: { timeRemaining: number }) => {
        setTimeRemaining(data.timeRemaining);
      });
      unsubscribeRef.current.push(unsub2);

      // 7. Subscribe to freeze status updates
      const unsub3 = websocketService.subscribe(`freeze_${effectiveCaseId}`, (data: FreezeStatus) => {
        setFreezeStatus(data);
      });
      unsubscribeRef.current.push(unsub3);

      // Cache case data for offline access
      await AsyncStorage.setItem(`case_${effectiveCaseId}`, JSON.stringify(result.data));
    } catch (err: any) {
      console.error('Error loading case data:', err);
      setError(err.message || 'Failed to load case details');

      // Try to load from cache
      try {
        const cached = await AsyncStorage.getItem(`case_${effectiveCaseId}`);
        if (cached) {
          const cachedData = JSON.parse(cached);
          setCaseData(cachedData);
          setError('Using cached data. Some features may be limited.');
        }
      } catch (cacheError) {
        console.error('Failed to load from cache:', cacheError);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCaseUpdate = (update: CaseUpdate) => {
    switch (update.type) {
      case 'status_changed':
        setCaseData((prev) => (prev ? { ...prev, status: update.data.status } : null));
        break;
      case 'freeze_completed':
        setFreezeStatus(update.data);
        // Update mule accounts status
        if (update.data.frozenAccounts) {
          setMuleAccounts((prev) =>
            prev.map((acc) => ({
              ...acc,
              status: update.data.frozenAccounts.includes(acc.id) ? 'frozen' : acc.status,
            }))
          );
        }
        break;
      case 'team_deployed':
        // Update team status if needed
        break;
      case 'countdown_update':
        setTimeRemaining(update.data.timeRemaining);
        break;
    }
  };

  // Update countdown timer - runs continuously
  useEffect(() => {
    // Initialize to 30 minutes if not set
    if (timeRemaining === null) {
      setTimeRemaining(30 * 60); // 30 minutes in seconds
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null) return 30 * 60; // Reset to 30 minutes if null
        if (prev <= 0) {
          // When timer reaches 0, reset to 30 minutes and continue
          return 30 * 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return '30:00'; // Default to 30:00
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatCurrency = (amount: number | undefined | null) => {
    if (!amount || isNaN(amount)) {
      return '₹0';
    }
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    }
    return `₹${amount.toLocaleString()}`;
  };

  const handleFreezeAccounts = () => {
    const currentCaseId = effectiveCaseId || (caseData as any)?.case_id || caseData?.id;
    
    if (!currentCaseId) {
      Alert.alert('Error', 'No case ID available. Please go back and try again.');
      return;
    }
    
    console.log('🚀 Navigating to MuleAccountsScreen with', muleAccounts.length, 'accounts');
    console.log('📊 Current mule accounts state:', JSON.stringify(muleAccounts, null, 2));
    
    // Prepare mule accounts data - only use real API data, no defaults
    if (muleAccounts.length === 0) {
      console.warn('⚠️ No mule accounts available to pass to MuleAccountsScreen');
      Alert.alert(
        'No Mule Accounts',
        'Mule accounts have not been identified yet. Money flow tracing may still be in progress.',
        [{ text: 'OK' }]
      );
      return; // Don't navigate if no data
    }
    
    // Map existing mule accounts to full format
    const accountsToPass: any[] = muleAccounts.map(acc => {
      const mapped = {
        id: acc.id,
        bank: acc.bank,
        bankName: acc.bankName || (acc.bank === 'SBI' ? 'State Bank of India' : acc.bank === 'HDFC' ? 'HDFC Bank' : acc.bank === 'AXIS' ? 'Axis Bank' : 'Bank'),
        accountNumber: acc.accountNumber,
        amountReceived: acc.amountReceived || acc.amount || 0,
        currentBalance: acc.currentBalance || 0,
        accountHolder: acc.accountHolder || 'Unknown',
        ifscCode: acc.ifscCode || 'XXXX0000000',
        accountAge: acc.accountAge || 'Unknown',
        location: acc.location || 'Unknown',
        status: acc.status, // CRITICAL: Preserve exact status
      };
      console.log(`  → Passing account ${mapped.id}: ${mapped.bank} - ${mapped.accountNumber} - Status: ${mapped.status}`);
      return mapped;
    });
    
    console.log('📤 Final accounts to pass:', JSON.stringify(accountsToPass, null, 2));
    
    // @ts-ignore - React Navigation type inference limitation
    navigation.navigate('MuleAccounts' as never, {
      caseId: currentCaseId,
      muleAccounts: accountsToPass, // Pass the exact same data with status
    } as never);
  };

  const handleAlertTeams = () => {
    const currentCaseId = effectiveCaseId || (caseData as any)?.case_id || caseData?.id;
    if (!currentCaseId) {
      Alert.alert('Error', 'No case ID available. Please go back and try again.');
      return;
    }
    // Navigate using parent Stack Navigator
    const parent = navigation.getParent();
    // @ts-ignore - React Navigation type inference limitation
    const nav = parent || navigation;
    // @ts-ignore - React Navigation type inference limitation
    nav.navigate('TeamStatus' as never, { caseId: currentCaseId } as never);
  };

  const handleViewMap = () => {
    const currentCaseId = effectiveCaseId || (caseData as any)?.case_id || caseData?.id;
    if (!currentCaseId) {
      Alert.alert('Error', 'No case ID available. Please go back and try again.');
      return;
    }
    const location = caseData?.prediction?.hotspots?.[0] || displayData?.predictedLocation || {
      latitude: 19.1364,
      longitude: 72.8297,
    };
    // @ts-ignore - React Navigation type inference limitation
    navigation.navigate('Map' as never, {
      caseId: currentCaseId,
      location: location,
    } as never);
  };

  const handleViewMoneyTrail = async () => {
    const currentCaseId = effectiveCaseId || (caseData as any)?.case_id || caseData?.id;
    if (!currentCaseId) {
      Alert.alert('Error', 'No case ID available. Please go back and try again.');
      return;
    }
    try {
      // Load transactions from API
      const transactionsResult = await caseService.getCaseTransactions(currentCaseId);
      if (transactionsResult.success && transactionsResult.data?.transactions) {
        // Pass mule accounts data to ensure status consistency
        // @ts-expect-error - React Navigation type inference limitation
        navigation.navigate('MoneyTrail' as never, { 
          caseId: currentCaseId,
          transactions: transactionsResult.data.transactions,
          muleAccounts: muleAccounts, // Pass current mule accounts with their status
        } as never);
      } else {
        // Navigate with empty transactions if API fails, but still pass mule accounts
        // @ts-expect-error - React Navigation type inference limitation
        navigation.navigate('MoneyTrail' as never, { 
          caseId: currentCaseId,
          transactions: [],
          muleAccounts: muleAccounts, // Pass current mule accounts with their status
        } as never);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
      // Navigate anyway with empty transactions, but pass mule accounts
      // @ts-expect-error - React Navigation type inference limitation
      navigation.navigate('MoneyTrail' as never, { 
        caseId: currentCaseId,
        transactions: [],
        muleAccounts: muleAccounts, // Pass current mule accounts with their status
      } as never);
    }
  };

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <WebSocketStatusIndicator />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading case details...
          </Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error && !caseData) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <WebSocketStatusIndicator />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={theme.colors.error} />
          <Text style={[styles.errorTitle, { color: theme.colors.text }]}>Error Loading Case</Text>
          <Text style={[styles.errorMessage, { color: theme.colors.textSecondary }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
            onPress={loadCaseData}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Use fallback data if caseData is null - safely access properties
  const alertAny = alert as any;
  const caseDataAny = caseData as any;
  
  const displayData: any = caseData || alert || {
    id: effectiveCaseId || 'unknown',
    caseNumber: alertAny?.caseNumber || caseDataAny?.case_number || `#CASE-${effectiveCaseId || 'unknown'}`,
    fraudType: alertAny?.fraudType || caseDataAny?.complaint?.fraud_type || caseDataAny?.fraud_type || 'OTP/Vishing Fraud',
    amount: alertAny?.amount || caseDataAny?.complaint?.fraud_amount || caseDataAny?.fraud_amount || 350000,
    reportedAt: formatReportedAt(
      alertAny?.reportedAt || 
      caseDataAny?.complaint?.reported_at || 
      caseDataAny?.reported_at || 
      caseDataAny?.created_at
    ),
    victim: alertAny?.victim || caseDataAny?.victim || { name: 'Victim' },
    location: alertAny?.location || caseDataAny?.victim?.city || caseDataAny?.location || 'Location',
    predictedLocation: alertAny?.predictedLocation || caseDataAny?.prediction?.predicted_atm || caseDataAny?.prediction?.hotspots?.[0]?.location || {
      name: 'HDFC ATM, Lokhandwala Complex',
      address: 'Andheri West, Mumbai - 400053',
      latitude: 19.1364,
      longitude: 72.8297,
    },
    confidence: alertAny?.confidence || caseDataAny?.prediction?.confidence || caseDataAny?.location_confidence || 94,
  };

  return (
    <View style={[styles.container, { backgroundColor: '#f8fafc' }]}>
      <WebSocketStatusIndicator />
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#FFFFFF' }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerLabel}>Case</Text>
            <Text style={styles.headerTitle}>{displayData.caseNumber}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} activeOpacity={0.7}>
            <Ionicons name="share-outline" size={20} color="#374151" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} activeOpacity={0.7}>
            <Ionicons name="ellipsis-vertical" size={20} color="#374151" />
          </TouchableOpacity>
        </View>
      </View>

      {error && caseData && (
        <View style={styles.errorBanner}>
          <Ionicons name="information-circle" size={16} color="#f59e0b" />
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Countdown Timer */}
        <View style={styles.timerCard}>
          <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.timerGradient}>
            <View style={styles.timerContent}>
              <View>
                <Text style={styles.timerLabel}>Predicted Withdrawal In</Text>
                <Text style={styles.timerValue}>{formatTime(timeRemaining)}</Text>
                <Text style={styles.timerSubtext}>minutes remaining</Text>
              </View>
              <View style={styles.timerIconContainer}>
                <Ionicons name="time-outline" size={48} color="#FFFFFF" />
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Predicted Location */}
        {displayData.predictedLocation && (
          <View style={styles.locationCard}>
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                initialRegion={{
                  latitude: displayData.predictedLocation.latitude || 19.1364,
                  longitude: displayData.predictedLocation.longitude || 72.8297,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
              >
                <Marker
                  coordinate={{
                    latitude: displayData.predictedLocation.latitude || 19.1364,
                    longitude: displayData.predictedLocation.longitude || 72.8297,
                  }}
                  pinColor="#ef4444"
                />
              </MapView>
            </View>
            <View style={styles.locationContent}>
              <View style={styles.locationHeader}>
                <Text style={styles.locationTitle}>Predicted Location</Text>
                <View style={styles.confidenceBadge}>
                  <Text style={styles.confidenceText}>
                    {displayData.confidence || caseData?.prediction?.confidence || 94}% confidence
                  </Text>
                </View>
              </View>
              <Text style={styles.locationName}>
                {displayData.predictedLocation.name || 'Location not available'}
              </Text>
              <Text style={styles.locationAddress}>
                {displayData.predictedLocation.address || ''}
              </Text>
              <TouchableOpacity
                style={styles.mapButton}
                onPress={handleViewMap}
                activeOpacity={0.7}
              >
                <Ionicons name="navigate" size={18} color="#3b82f6" />
                <Text style={styles.mapButtonText}>Open in Maps</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Complaint Details */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Complaint Details</Text>
          <View style={styles.detailsList}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Fraud Type</Text>
              <Text style={styles.detailValue}>{displayData.fraudType}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Amount Lost</Text>
              <Text style={styles.amountValue}>{formatCurrency(displayData.amount)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Reported At</Text>
              <Text style={styles.detailValue}>
                {formatReportedAt(
                  (caseData as any)?.complaint?.reported_at || 
                  displayData.reportedAt
                )}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Victim Name</Text>
              <Text style={styles.detailValue}>
                {caseData?.victim?.name || 
                 (typeof displayData.victim === 'string' ? displayData.victim : displayData.victim?.name) || 
                 'N/A'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Location</Text>
              <Text style={styles.detailValue}>
                {caseData?.victim?.city || displayData.location || 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        {/* AI Insights */}
        <View style={styles.aiCard}>
          <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.aiGradient}>
            <View style={styles.aiHeader}>
              <Ionicons name="bulb" size={20} color="#06b6d4" />
              <Text style={styles.aiTitle}>AI Intelligence</Text>
            </View>
            <View style={styles.aiInsights}>
              <View style={styles.aiInsightItem}>
                <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                <Text style={styles.aiInsightText}>
                  <Text style={styles.aiInsightBold}>Pattern Match:</Text> Similar to 12 past cases
                  with 89% success rate
                </Text>
              </View>
              <View style={styles.aiInsightItem}>
                <Ionicons name="link" size={18} color="#eab308" />
                <Text style={styles.aiInsightText}>
                  <Text style={styles.aiInsightBold}>Network:</Text> {muleAccounts.length} mule
                  accounts identified, linked to known fraud ring
                </Text>
              </View>
              <View style={styles.aiInsightItem}>
                <Ionicons name="map" size={18} color="#3b82f6" />
                <Text style={styles.aiInsightText}>
                  <Text style={styles.aiInsightBold}>Behavior:</Text> Withdrawal predicted near
                  victim's area (common pattern)
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.aiLink}
              onPress={() => {
                // Navigate to AI Analysis screen using parent Stack Navigator
                const parent = navigation.getParent();
                // @ts-ignore - React Navigation type inference limitation
                const nav = parent || navigation;
                // @ts-ignore - React Navigation type inference limitation
                nav.navigate('AIAnalysis' as never, { 
                  caseId: effectiveCaseId,
                  complaintId: effectiveCaseId 
                } as never);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.aiLinkText}>View Full Analysis</Text>
              <Ionicons name="arrow-forward" size={16} color="#06b6d4" />
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* Mule Accounts Preview */}
        <View style={styles.muleCard}>
          <View style={styles.muleHeader}>
            <Text style={styles.muleTitle}>Identified Mule Accounts</Text>
            <View style={styles.muleBadge}>
              <Text style={styles.muleBadgeText}>{muleAccounts.length || 0} found</Text>
            </View>
          </View>
          {muleAccounts.length > 0 ? (
            <>
              {muleAccounts.map((account) => (
                <View key={account.id} style={styles.muleAccountItem}>
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
                  <View style={styles.muleAccountInfo}>
                    <Text style={styles.muleAccountNumber}>{account.accountNumber}</Text>
                    <Text style={styles.muleAccountAmount}>
                      {formatCurrency(account.amount)} received
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.activeBadge,
                      {
                        backgroundColor:
                          account.status === 'frozen'
                            ? '#dbeafe'
                            : account.status === 'withdrawn'
                            ? '#fee2e2'
                            : '#dcfce7',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.activeBadgeText,
                        {
                          color:
                            account.status === 'frozen'
                              ? '#1e40af'
                              : account.status === 'withdrawn'
                              ? '#dc2626'
                              : '#166534',
                        },
                      ]}
                    >
                      {account.status === 'frozen'
                        ? 'Frozen'
                        : account.status === 'withdrawn'
                        ? 'Withdrawn'
                        : 'Active'}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          ) : (
            <Text style={styles.emptyMuleText}>No mule accounts identified yet</Text>
          )}
          <TouchableOpacity
            style={styles.moneyTrailButton}
            onPress={handleViewMoneyTrail}
            activeOpacity={0.7}
          >
            <Text style={styles.moneyTrailButtonText}>View Money Trail</Text>
            <Ionicons name="git-branch" size={18} color="#374151" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <View style={styles.stepIndicator}>
          <View style={styles.stepItem}>
            <View style={[styles.stepNumber, { backgroundColor: '#ef4444' }]}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={styles.stepLabel}>Freeze First</Text>
          </View>
          <Text style={styles.stepArrow}>→</Text>
          <View style={styles.stepItem}>
            <View style={[styles.stepNumber, { backgroundColor: '#3b82f6' }]}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <Text style={styles.stepLabel}>Alert Teams</Text>
          </View>
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.freezeButton}
            onPress={handleFreezeAccounts}
            activeOpacity={0.8}
          >
            <LinearGradient colors={['#ef4444', '#dc2626']} style={styles.freezeGradient}>
              <View style={styles.priorityBadge}>
                <Text style={styles.priorityBadgeText}>⚡ PRIORITY</Text>
              </View>
              <Ionicons name="lock-closed" size={20} color="#FFFFFF" />
              <Text style={styles.freezeButtonText}>Freeze Accounts</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.teamButton}
            onPress={handleAlertTeams}
            activeOpacity={0.8}
          >
            <View style={styles.teamBadge}>
              <Text style={styles.teamBadgeText}>2</Text>
            </View>
            <Ionicons name="people" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <Text style={styles.hintText}>
          💡 Freeze first! Money moves in seconds, criminals travel in minutes.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  errorBannerText: {
    fontSize: 14,
    color: '#92400e',
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  headerLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 200,
  },
  timerCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  timerGradient: {
    padding: 16,
  },
  timerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timerLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  timerValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  timerSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  timerIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  mapContainer: {
    height: 128,
    backgroundColor: '#e5e7eb',
  },
  map: {
    flex: 1,
  },
  locationContent: {
    padding: 16,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  confidenceBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e40af',
  },
  locationName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dbeafe',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  mapButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
  },
  detailsCard: {
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
  detailsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  detailsList: {
    gap: 0,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
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
  amountValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ef4444',
  },
  aiCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  aiGradient: {
    padding: 16,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  aiTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  aiInsights: {
    gap: 12,
    marginBottom: 12,
  },
  aiInsightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  aiInsightText: {
    flex: 1,
    fontSize: 14,
    color: '#d1d5db',
    lineHeight: 20,
  },
  aiInsightBold: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  aiLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  aiLinkText: {
    fontSize: 14,
    color: '#06b6d4',
    fontWeight: '500',
  },
  muleCard: {
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
  muleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  muleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  muleBadge: {
    backgroundColor: '#fed7aa',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  muleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#c2410c',
  },
  muleAccountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 8,
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
  muleAccountInfo: {
    flex: 1,
  },
  muleAccountNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  muleAccountAmount: {
    fontSize: 12,
    color: '#6b7280',
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyMuleText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 16,
  },
  moneyTrailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    marginTop: 12,
  },
  moneyTrailButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
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
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  stepArrow: {
    fontSize: 12,
    color: '#d1d5db',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  freezeButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  freezeGradient: {
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
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#78350f',
  },
  freezeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  teamButton: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  teamBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1e40af',
  },
  hintText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
  },
});
