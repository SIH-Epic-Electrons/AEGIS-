/**
 * Next-Generation LEA Dashboard
 * Proactive AI-powered field command center with real-time predictions,
 * one-click actions, and seamless workflow integration
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { leaService } from '../api/leaService';
import { websocketService } from '../services/websocketService';
import { predictiveAnalyticsService } from '../api/predictiveAnalyticsService';
import { securityService, SecurityStatus, ComplianceStatus } from '../api/securityService';
import CountdownTimer from '../components/CountdownTimer';
import StatCard from '../components/StatCard';
import PriorityAlertQueue from '../components/PriorityAlertQueue';
import SmartAlertFilter from '../components/SmartAlertFilter';
import FloatingActionMenu from '../components/FloatingActionMenu';
import { oneTapActions } from '../services/oneTapActions';
import { Alert as AlertType } from '../types';

const { width } = Dimensions.get('window');

interface LEAAction {
  id: string;
  type: 'freeze' | 'cordon' | 'ar_view' | 'deploy';
  status: 'pending' | 'executing' | 'completed' | 'failed';
  timestamp: string;
  result?: any;
}

interface Officer {
  id: string;
  name: string;
  badgeNumber: string;
  rank: string;
  status: 'available' | 'deployed' | 'responding' | 'off_duty';
  currentAssignment?: string;
  location?: {
    lat: number;
    lon: number;
    address?: string;
  };
  responseTime?: number; // minutes
  casesAssigned: number;
  successRate: number;
  lastUpdate: string;
}

interface ActivityLog {
  id: string;
  type: 'alert' | 'action' | 'deployment' | 'outcome' | 'system';
  title: string;
  description: string;
  timestamp: string;
  officerId?: string;
  officerName?: string;
  alertId?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface PredictionAlert {
  id: string;
  complaintId: string;
  riskScore: number;
  timeWindow: string;
  hotspot: {
    address: string;
    lat: number;
    lon: number;
    probability: number;
    confidenceInterval: [number, number];
  };
  victim: {
    ageRange: string;
    gender: string;
    anonymized: boolean;
  };
  suspect: {
    upiId?: string;
    moMatch: number;
    linkedAccounts: string[];
    crossBankPattern: boolean;
  };
  amount: number;
  scamType: string;
  shapExplanation?: {
    topFactors: Array<{ factor: string; contribution: number }>;
  };
  timestamp: string;
  timeRemaining: number; // minutes
}

export default function NextGenLEADashboard() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isSmallScreen = screenWidth < 375;
  const isMediumScreen = screenWidth >= 375 && screenWidth < 414;
  
  // State
  const [alerts, setAlerts] = useState<PredictionAlert[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<AlertType[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<PredictionAlert | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'alerts' | 'officers' | 'activity' | 'stats'>('alerts');
  const [actions, setActions] = useState<LEAAction[]>([]);
  const [showDossier, setShowDossier] = useState(false);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus | null>(null);
  const [complianceStatus, setComplianceStatus] = useState<ComplianceStatus | null>(null);
  const [securityAlerts, setSecurityAlerts] = useState<any[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [stats, setStats] = useState({
    totalAlerts: 0,
    highRisk: 0,
    avgResponseTime: 0,
    interdictionRate: 0,
    fundsRecovered: 0,
    activeOfficers: 0,
    deployedOfficers: 0,
    totalCases: 0,
    resolvedToday: 0,
  });

  const loadDashboardData = useCallback(async () => {
    try {
      setRefreshing(true);
      
      const [alertsData, statsData, security, compliance, securityEvents] = await Promise.all([
        leaService.getPredictionAlerts(),
        leaService.getDashboardStats(),
        securityService.getSecurityStatus().catch(() => null),
        securityService.getComplianceStatus().catch(() => null),
        securityService.getSecurityEvents(5).catch(() => ({ events: [] })),
      ]);
      
      // Use mock data if API fails or returns empty
      if (Array.isArray(alertsData) && alertsData.length > 0) {
        setAlerts(alertsData);
      } else {
        // Keep sample alerts for demo
        setAlerts(getSampleAlerts());
      }
      
      setStats({
        totalAlerts: statsData?.totalAlerts || 12,
        highRisk: statsData?.highRisk || 5,
        avgResponseTime: statsData?.avgResponseTime || 18,
        interdictionRate: statsData?.interdictionRate || 58,
        fundsRecovered: statsData?.fundsRecovered || 4200000,
        activeOfficers: statsData?.activeOfficers || 8,
        deployedOfficers: statsData?.deployedOfficers || 3,
        totalCases: statsData?.totalCases || 45,
        resolvedToday: statsData?.resolvedToday || 12,
      });
      
      // Load security and compliance status
      if (security) setSecurityStatus(security);
      if (compliance) setComplianceStatus(compliance);
      if (securityEvents?.events) {
        const criticalAlerts = securityEvents.events.filter(
          (e: any) => e.severity === 'critical' || e.severity === 'high'
        );
        setSecurityAlerts(criticalAlerts);
      }
      
      // Load officer data
      setOfficers(getSampleOfficers());
      setActivityLog(getSampleActivityLog());
    } catch (error) {
      console.error('Error loading dashboard:', error);
      // Use sample data for demo
      setAlerts(getSampleAlerts());
      setStats({
        totalAlerts: 12,
        highRisk: 5,
        avgResponseTime: 18,
        interdictionRate: 58,
        fundsRecovered: 4200000,
        activeOfficers: 8,
        deployedOfficers: 3,
        totalCases: 45,
        resolvedToday: 12,
      });
      setOfficers(getSampleOfficers());
      setActivityLog(getSampleActivityLog());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Convert PredictionAlert to Alert type
  const convertToAlert = (predictionAlert: PredictionAlert): AlertType => {
    return {
      id: predictionAlert.id,
      type: predictionAlert.riskScore >= 0.9 ? 'high_priority' : predictionAlert.riskScore >= 0.7 ? 'medium_priority' : 'low_priority',
      title: `${predictionAlert.scamType} - ${predictionAlert.complaintId}`,
      message: `Risk: ${(predictionAlert.riskScore * 100).toFixed(0)}% | Amount: ₹${predictionAlert.amount.toLocaleString()}`,
      timestamp: predictionAlert.timestamp,
      location: {
        latitude: predictionAlert.hotspot.lat,
        longitude: predictionAlert.hotspot.lon,
        address: predictionAlert.hotspot.address,
      },
      complaintId: predictionAlert.complaintId,
      amount: predictionAlert.amount,
      status: 'pending',
      risk: predictionAlert.riskScore,
      timeWindow: predictionAlert.timeRemaining,
      dossier: {
        victim: {
          anonymizedId: predictionAlert.victim.ageRange,
          age: 0,
          location: predictionAlert.hotspot.address,
          fraudType: predictionAlert.scamType,
        },
        suspect: {
          accountNumbers: predictionAlert.suspect.linkedAccounts,
          phoneNumbers: [],
          modusOperandi: `MO Match: ${(predictionAlert.suspect.moMatch * 100).toFixed(0)}%`,
          similarityScore: predictionAlert.suspect.moMatch,
          linkedAccounts: predictionAlert.suspect.linkedAccounts,
        },
        hotspots: [{
          id: predictionAlert.id,
          location: {
            latitude: predictionAlert.hotspot.lat,
            longitude: predictionAlert.hotspot.lon,
          },
          address: predictionAlert.hotspot.address,
          probability: predictionAlert.hotspot.probability,
          confidenceInterval: predictionAlert.hotspot.confidenceInterval,
        }],
      },
      i4cCoordination: predictionAlert.suspect.crossBankPattern ? {
        required: true,
        matchingStates: [],
        riskLevel: predictionAlert.riskScore >= 0.9 ? 'critical' : 'high',
      } : undefined,
    };
  };

  // Get user location
  useEffect(() => {
    (async () => {
      try {
        const Location = await import('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          if (location?.coords) {
            setUserLocation({
              lat: location.coords.latitude,
              lon: location.coords.longitude,
            });
          }
        }
      } catch (error) {
        console.error('Error getting location:', error);
      }
    })();
  }, []);

  // Convert alerts when they change
  useEffect(() => {
    const converted = alerts.map(convertToAlert);
    setFilteredAlerts(converted);
  }, [alerts]);

  useEffect(() => {
    loadDashboardData();
    const unsubscribeAlert = setupWebSocket();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    
    return () => {
      clearInterval(interval);
      unsubscribeAlert?.();
    };
  }, [loadDashboardData]);

  const setupWebSocket = () => {
    // Subscribe to new prediction alerts
    const unsubscribeAlert = websocketService.subscribe('new_prediction_alert', (data: PredictionAlert) => {
      setAlerts((prev) => [data, ...prev]);
      // Show notification for high-risk alerts
      if (data.riskScore >= 0.85) {
        Alert.alert(
          '🔴 High-Risk Alert',
          `${data.riskScore * 100}% chance at ${data.hotspot.address} in ${data.timeRemaining} minutes`,
          [
            { text: 'View', onPress: () => handleAlertPress(data) },
            { text: 'Dismiss', style: 'cancel' },
          ]
        );
      }
    });

    // Subscribe to action updates
    const unsubscribeAction = websocketService.subscribe('action_update', (data: LEAAction) => {
      setActions((prev) => {
        const index = prev.findIndex((a) => a.id === data.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = data;
          return updated;
        }
        return [...prev, data];
      });
    });

    // Return cleanup function
    return () => {
      unsubscribeAlert?.();
      unsubscribeAction?.();
    };
  };

  const handleAlertPress = (alert: PredictionAlert) => {
    setSelectedAlert(alert);
    setShowDossier(true);
  };

  const handleFreezeAccount = async () => {
    if (!selectedAlert) return;

    Alert.alert(
      'Freeze Account',
      `Freeze account via CFCFRMS?\n\nVPA: ${selectedAlert.suspect.upiId || 'N/A'}\nAmount: ₹${selectedAlert.amount.toLocaleString()}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Freeze',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await leaService.freezeAccount(selectedAlert.complaintId);
              if (result.success) {
                Alert.alert('✅ Success', `Account frozen in ${result.executionTime}s`);
                // Update alert
                setAlerts((prev) =>
                  prev.map((a) =>
                    a.id === selectedAlert.id ? { ...a, accountFrozen: true } : a
                  )
                );
              } else {
                Alert.alert('❌ Error', result.error || 'Failed to freeze account');
              }
            } catch (error) {
              Alert.alert('❌ Error', 'Failed to freeze account');
            }
          },
        },
      ]
    );
  };

  const handleActivateCordon = async () => {
    if (!selectedAlert) return;

    Alert.alert(
      'Activate Digital Cordon',
      `Freeze all transactions in 2km radius around ${selectedAlert.hotspot.address}?\n\nThis will block all UPI/ATM transactions via NPCI.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await leaService.activateDigitalCordon(
                selectedAlert.complaintId,
                selectedAlert.hotspot.lat,
                selectedAlert.hotspot.lon
              );
              if (result.success) {
                Alert.alert('✅ Success', `Digital Cordon activated in ${result.executionTime}s`);
                setAlerts((prev) =>
                  prev.map((a) =>
                    a.id === selectedAlert.id ? { ...a, cordonActive: true } : a
                  )
                );
              } else {
                Alert.alert('❌ Error', result.error || 'Failed to activate cordon');
              }
            } catch (error) {
              Alert.alert('❌ Error', 'Failed to activate digital cordon');
            }
          },
        },
      ]
    );
  };

  const handleARView = () => {
    if (!selectedAlert) return;
    (navigation as any).navigate('AR', {
      hotspot: selectedAlert.hotspot,
      alertId: selectedAlert.id,
    });
  };

  const handleLogOutcome = () => {
    if (!selectedAlert) return;

    Alert.alert(
      'Log Outcome',
      'Select the outcome:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '✅ Suspect Arrested',
          onPress: () => submitOutcome('arrested'),
        },
        {
          text: '✅ Funds Recovered',
          onPress: () => submitOutcome('recovered'),
        },
        {
          text: '⚠️ False Positive',
          onPress: () => submitOutcome('false_positive'),
        },
        {
          text: '❌ No Action Taken',
          onPress: () => submitOutcome('no_action'),
        },
      ]
    );
  };

  const submitOutcome = async (outcome: string) => {
    if (!selectedAlert) return;

    try {
      await leaService.logOutcome(selectedAlert.complaintId, outcome);
      Alert.alert('✅ Success', 'Outcome logged. This will improve future predictions.');
      // Remove alert from list
      setAlerts((prev) => prev.filter((a) => a.id !== selectedAlert.id));
      setShowDossier(false);
      setSelectedAlert(null);
    } catch (error) {
      Alert.alert('❌ Error', 'Failed to log outcome');
    }
  };

  const getRiskColor = (risk: number): string => {
    if (risk >= 0.85) return '#E94560'; // High - Red
    if (risk >= 0.70) return '#FF9800'; // Medium - Orange
    return '#4CAF50'; // Low - Green
  };

  const getRiskLabel = (risk: number): string => {
    if (risk >= 0.85) return 'High Risk';
    if (risk >= 0.70) return 'Medium Risk';
    return 'Low Risk';
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
          Loading LEA Dashboard...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primary + 'CC']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={[styles.headerLeft, isSmallScreen && styles.headerLeftSmall]}>
            <View style={styles.headerTitleContainer}>
              <Text style={[styles.headerTitle, isSmallScreen && styles.headerTitleSmall]}>
                {isSmallScreen ? 'AEGIS' : 'AEGIS Command Center'}
              </Text>
              <Text style={[styles.headerSubtitle, isSmallScreen && styles.headerSubtitleSmall]}>
                {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} • {stats.totalAlerts} Active
              </Text>
            </View>
            {!isSmallScreen && (
              <View style={styles.headerStats}>
                <TouchableOpacity
                  style={styles.statBadge}
                  onPress={() => setActiveTab('stats')}
                >
                  <Ionicons name="cash" size={16} color="#FFF" />
                  <Text style={styles.statBadgeText}>₹{(stats.fundsRecovered / 100000).toFixed(1)}L</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.headerButton, isSmallScreen && styles.headerButtonSmall]}
              onPress={() => (navigation as any).navigate('SecurityDashboard')}
            >
              <Ionicons name="shield-checkmark" size={isSmallScreen ? 18 : 20} color="#FFF" />
              {securityAlerts.length > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>{securityAlerts.length}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerButton, isSmallScreen && styles.headerButtonSmall]}
              onPress={loadDashboardData}
              disabled={refreshing}
            >
              <Ionicons
                name="refresh"
                size={isSmallScreen ? 18 : 20}
                color="#FFF"
                style={refreshing && styles.refreshing}
              />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Funds badge for small screens */}
        {isSmallScreen && (
          <View style={styles.headerFundsRow}>
            <TouchableOpacity
              style={styles.statBadgeFull}
              onPress={() => setActiveTab('stats')}
            >
              <Ionicons name="cash" size={14} color="#FFF" />
              <Text style={styles.statBadgeText}>₹{(stats.fundsRecovered / 100000).toFixed(1)}L Recovered</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Stats Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsRowContainer}
          style={styles.statsRowScroll}
        >
          <StatCard
            label="Active Alerts"
            value={stats.totalAlerts.toString()}
            icon="notifications"
            color={theme.colors.primary}
            theme={theme}
            width={screenWidth * 0.42}
          />
          <StatCard
            label="High Risk"
            value={stats.highRisk.toString()}
            icon="alert-circle"
            color="#E94560"
            theme={theme}
            width={screenWidth * 0.42}
          />
          <StatCard
            label="Response Time"
            value={`${stats.avgResponseTime}m`}
            icon="time"
            color="#FF9800"
            theme={theme}
            width={screenWidth * 0.42}
          />
          <StatCard
            label="Interdiction"
            value={`${stats.interdictionRate}%`}
            icon="shield-checkmark"
            color="#4CAF50"
            theme={theme}
            width={screenWidth * 0.42}
          />
        </ScrollView>
        
        {/* Security Alert Banner */}
        {securityAlerts.length > 0 && (
          <TouchableOpacity
            style={[styles.securityAlertBanner, { backgroundColor: '#e94560' }]}
            onPress={() => (navigation as any).navigate('SecurityDashboard')}
            activeOpacity={0.8}
          >
            <Ionicons name="warning" size={20} color="#fff" />
            <Text style={styles.securityAlertText}>
              {securityAlerts.length} Critical Security Alert{securityAlerts.length > 1 ? 's' : ''} - Tap to view
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Security Status Indicator */}
        {complianceStatus && (
          <TouchableOpacity
            style={[styles.securityStatusCard, { backgroundColor: complianceStatus.overall_compliant ? '#4CAF50' + '20' : '#ff9800' + '20' }]}
            onPress={() => (navigation as any).navigate('SecurityDashboard')}
            activeOpacity={0.7}
          >
            <View style={styles.securityStatusContent}>
              <Ionicons
                name={complianceStatus.overall_compliant ? 'shield-checkmark' : 'shield-outline'}
                size={20}
                color={complianceStatus.overall_compliant ? '#4CAF50' : '#ff9800'}
              />
              <Text style={[styles.securityStatusText, { color: theme.colors.text }]}>
                {complianceStatus.overall_compliant ? 'Security: Compliant' : 'Security: Review Required'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
            </View>
            {securityStatus?.privacy_budget && (
              <Text style={[styles.securityStatusSubtext, { color: theme.colors.textSecondary }]}>
                Privacy Budget: {securityStatus.privacy_budget.global_remaining.toFixed(1)}/{securityStatus.privacy_budget.global_total.toFixed(1)} ε
              </Text>
            )}
          </TouchableOpacity>
        )}
      </LinearGradient>

      {/* Tabs */}
      <View style={[styles.tabs, { backgroundColor: theme.colors.surfaceElevated }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'alerts' && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 },
          ]}
          onPress={() => setActiveTab('alerts')}
        >
          <Ionicons
            name="notifications"
            size={20}
            color={activeTab === 'alerts' ? theme.colors.primary : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'alerts' ? theme.colors.primary : theme.colors.textSecondary,
              },
            ]}
          >
            Alerts ({alerts.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'officers' && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 },
          ]}
          onPress={() => setActiveTab('officers')}
        >
          <Ionicons
            name="people"
            size={20}
            color={activeTab === 'officers' ? theme.colors.primary : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'officers' ? theme.colors.primary : theme.colors.textSecondary,
              },
            ]}
          >
            Officers ({officers.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'activity' && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 },
          ]}
          onPress={() => setActiveTab('activity')}
        >
          <Ionicons
            name="time"
            size={20}
            color={activeTab === 'activity' ? theme.colors.primary : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'activity' ? theme.colors.primary : theme.colors.textSecondary,
              },
            ]}
          >
            Activity
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'stats' && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 },
          ]}
          onPress={() => setActiveTab('stats')}
        >
          <Ionicons
            name="stats-chart"
            size={20}
            color={activeTab === 'stats' ? theme.colors.primary : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'stats' ? theme.colors.primary : theme.colors.textSecondary,
              },
            ]}
          >
            Analytics
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'alerts' && (
        <View style={styles.content}>
          {/* Smart Filter */}
          <SmartAlertFilter
            alerts={filteredAlerts}
            onFilterChange={(filter: string) => {
              // Filter alerts based on filter string
              console.log('Filter changed:', filter);
            }}
            setFilter={(filter: string) => {
              // Filter logic would go here
              setFilteredAlerts(filteredAlerts);
            }}
            userLocation={userLocation || undefined}
            currentOfficerId={undefined}
          />

          {/* Priority Alert Queue */}
          <ScrollView
            style={styles.alertsScrollView}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadDashboardData} />}
            showsVerticalScrollIndicator={false}
          >
            <PriorityAlertQueue
              alerts={filteredAlerts}
              onAlertPress={(alert) => {
                const originalAlert = alerts.find(a => a.id === alert.id);
                if (originalAlert) handleAlertPress(originalAlert);
              }}
              onDeployTeam={async (alert) => {
                const result = await oneTapActions.deployNearestOfficer(alert.id);
                if (result.success) {
                  Alert.alert('✅ Success', result.message);
                } else {
                  Alert.alert('❌ Error', result.error || result.message);
                }
              }}
              onActivateCordon={async (alert) => {
                const result = await oneTapActions.activateCordonForAlert(alert.id);
                if (result.success) {
                  Alert.alert('✅ Success', result.message);
                } else {
                  Alert.alert('❌ Error', result.error || result.message);
                }
              }}
              onViewMap={(alert) => {
                oneTapActions.openMapForAlert(alert, navigation);
              }}
              onViewDossier={(alert) => {
                const originalAlert = alerts.find(a => a.id === alert.id);
                if (originalAlert) handleAlertPress(originalAlert);
              }}
            />
          </ScrollView>

          {/* Floating Action Menu */}
          <FloatingActionMenu
            alerts={filteredAlerts}
            selectedAlert={selectedAlert ? convertToAlert(selectedAlert) : null}
            onDeployTeam={async () => {
              if (selectedAlert) {
                const alert = convertToAlert(selectedAlert);
                const result = await oneTapActions.deployNearestOfficer(alert.id);
                if (result.success) {
                  Alert.alert('✅ Success', result.message);
                } else {
                  Alert.alert('❌ Error', result.error || result.message);
                }
              }
            }}
            onActivateCordon={handleActivateCordon}
            onViewMap={() => {
              if (selectedAlert) {
                const alert = convertToAlert(selectedAlert);
                oneTapActions.openMapForAlert(alert, navigation);
              } else {
                navigation.navigate('Map' as never);
              }
            }}
            onQuickReport={() => navigation.navigate('AdvancedReport' as never)}
            onVoiceNote={() => {
              Alert.alert('Voice Note', 'Voice note feature coming soon');
            }}
            onCamera={() => {
              Alert.alert('Camera', 'Quick camera feature coming soon');
            }}
          />
        </View>
      )}

      {activeTab === 'officers' && (
        <ScrollView
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadDashboardData} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.officersView}>
            <View style={[styles.sectionHeader, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Active Officers ({officers.filter(o => o.status !== 'off_duty').length})
              </Text>
              <View style={styles.statusLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
                  <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Available</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.statusDot, { backgroundColor: '#FF9800' }]} />
                  <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Deployed</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.statusDot, { backgroundColor: '#E94560' }]} />
                  <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>Responding</Text>
                </View>
              </View>
            </View>
            {officers.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={64} color={theme.colors.textTertiary} />
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                  No officers available
                </Text>
              </View>
            ) : (
              officers.map((officer) => (
                <OfficerCard key={officer.id} officer={officer} theme={theme} />
              ))
            )}
          </View>
        </ScrollView>
      )}

      {activeTab === 'activity' && (
        <ScrollView
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadDashboardData} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.activityView}>
            <View style={[styles.sectionHeader, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Recent Activity
              </Text>
              <TouchableOpacity>
                <Ionicons name="filter" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {activityLog.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="time-outline" size={64} color={theme.colors.textTertiary} />
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                  No recent activity
                </Text>
              </View>
            ) : (
              activityLog.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} theme={theme} />
              ))
            )}
          </View>
        </ScrollView>
      )}

      {activeTab === 'stats' && (
        <ScrollView style={styles.content}>
          <View style={[styles.statsCard, { backgroundColor: theme.colors.surfaceElevated }]}>
            <Text style={[styles.statsTitle, { color: theme.colors.text }]}>Performance Metrics</Text>
            <View style={styles.metricRow}>
              <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
                Funds Recovered (Today)
              </Text>
              <Text style={[styles.metricValue, { color: theme.colors.primary }]}>
                ₹{stats.fundsRecovered.toLocaleString()}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
                Interdiction Rate
              </Text>
              <Text style={[styles.metricValue, { color: '#4CAF50' }]}>
                {stats.interdictionRate}%
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
                Avg Response Time
              </Text>
              <Text style={[styles.metricValue, { color: '#FF9800' }]}>
                {stats.avgResponseTime} minutes
              </Text>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Dossier Modal */}
      <Modal
        visible={showDossier}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowDossier(false)}
      >
        {selectedAlert && (
          <DossierView
            alert={selectedAlert}
            onClose={() => setShowDossier(false)}
            onFreeze={handleFreezeAccount}
            onCordon={handleActivateCordon}
            onARView={handleARView}
            onLogOutcome={handleLogOutcome}
            theme={theme}
            getRiskColor={getRiskColor}
            getRiskLabel={getRiskLabel}
          />
        )}
      </Modal>
    </View>
  );
}

// Prediction Alert Card Component
function PredictionAlertCard({
  alert,
  onPress,
  theme,
  getRiskColor,
  getRiskLabel,
}: {
  alert: PredictionAlert;
  onPress: () => void;
  theme: any;
  getRiskColor: (risk: number) => string;
  getRiskLabel: (risk: number) => string;
}) {
  const riskColor = getRiskColor(alert.riskScore);

  return (
    <TouchableOpacity
      style={[styles.alertCard, { backgroundColor: theme.colors.surfaceElevated, borderLeftColor: riskColor }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.alertHeader}>
        <View style={[styles.riskBadge, { backgroundColor: riskColor + '20' }]}>
          <Text style={[styles.riskText, { color: riskColor }]}>
            {Math.round(alert.riskScore * 100)}%
          </Text>
        </View>
        <View style={styles.alertInfo}>
          <Text style={[styles.alertTitle, { color: theme.colors.text }]}>
            {getRiskLabel(alert.riskScore)} - {alert.scamType}
          </Text>
          <Text style={[styles.alertComplaintId, { color: theme.colors.textSecondary }]}>
            {alert.complaintId || 'N/A'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
      </View>

      <View style={styles.alertBody}>
        <View style={styles.alertRow}>
          <Ionicons name="location" size={16} color={theme.colors.textSecondary} />
          <Text style={[styles.alertText, { color: theme.colors.text }]} numberOfLines={2}>
            {alert.hotspot?.address || 'Location not available'}
          </Text>
        </View>
        <View style={styles.alertRow}>
          <Ionicons name="time" size={16} color={theme.colors.textSecondary} />
          <Text style={[styles.alertText, { color: theme.colors.text }]}>
            {alert.timeWindow || 'N/A'} ({alert.timeRemaining || 0} min remaining)
          </Text>
        </View>
        <View style={styles.alertRow}>
          <Ionicons name="cash" size={16} color={theme.colors.textSecondary} />
          <Text style={[styles.alertText, { color: theme.colors.text }]}>
            ₹{alert.amount?.toLocaleString() || '0'}
          </Text>
        </View>
        {alert.suspect?.crossBankPattern && (
          <View style={[styles.crossBankBadge, { backgroundColor: theme.colors.info + '20' }]}>
            <Ionicons name="link" size={14} color={theme.colors.info} />
            <Text style={[styles.crossBankText, { color: theme.colors.info }]}>
              Cross-Bank Pattern Detected
            </Text>
          </View>
        )}
      </View>

      <View style={styles.alertFooter}>
        <CountdownTimer
          timeWindow={alert.timeRemaining || 0}
          theme={theme}
        />
      </View>
    </TouchableOpacity>
  );
}

// Officer Card Component
function OfficerCard({ officer, theme }: { officer: Officer; theme: any }) {
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'available':
        return '#4CAF50';
      case 'deployed':
        return '#FF9800';
      case 'responding':
        return '#E94560';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'available':
        return 'Available';
      case 'deployed':
        return 'Deployed';
      case 'responding':
        return 'Responding';
      default:
        return 'Off Duty';
    }
  };

  const statusColor = getStatusColor(officer.status);
  const statusLabel = getStatusLabel(officer.status);

  return (
    <View
      style={[
        styles.officerCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.officerHeader}>
        <View style={[styles.officerAvatar, { backgroundColor: statusColor + '20' }]}>
          <Ionicons name="person" size={24} color={statusColor} />
        </View>
        <View style={styles.officerInfo}>
          <Text style={[styles.officerName, { color: theme.colors.text }]}>{officer.name}</Text>
          <Text style={[styles.officerBadge, { color: theme.colors.textSecondary }]}>
            {officer.badgeNumber} • {officer.rank}
          </Text>
        </View>
        <View style={[styles.officerStatus, { backgroundColor: statusColor + '20' }]}>
          <Text style={[styles.officerStatusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {officer.currentAssignment && (
        <View style={[styles.officerDetails, { marginTop: 8 }]}>
          <View style={styles.officerDetailItem}>
            <Ionicons name="document-text" size={16} color={theme.colors.primary} />
            <Text style={[styles.officerDetailText, { color: theme.colors.text }]}>
              {officer.currentAssignment}
            </Text>
          </View>
        </View>
      )}

      {officer.location && (
        <View style={styles.officerDetails}>
          <View style={styles.officerDetailItem}>
            <Ionicons name="location" size={16} color={theme.colors.textSecondary} />
            <Text style={[styles.officerDetailText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
              {officer.location.address || 'Location tracking active'}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.officerDetails}>
        <View style={styles.officerDetailItem}>
          <Ionicons name="time" size={16} color={theme.colors.textSecondary} />
          <Text style={[styles.officerDetailText, { color: theme.colors.textSecondary }]}>
            Response: {officer.responseTime || 'N/A'}m
          </Text>
        </View>
        <View style={styles.officerDetailItem}>
          <Ionicons name="briefcase" size={16} color={theme.colors.textSecondary} />
          <Text style={[styles.officerDetailText, { color: theme.colors.textSecondary }]}>
            Cases: {officer.casesAssigned}
          </Text>
        </View>
        <View style={styles.officerDetailItem}>
          <Ionicons name="trending-up" size={16} color={theme.colors.textSecondary} />
          <Text style={[styles.officerDetailText, { color: theme.colors.textSecondary }]}>
            Success: {officer.successRate}%
          </Text>
        </View>
        <View style={styles.officerDetailItem}>
          <Ionicons name="refresh" size={16} color={theme.colors.textSecondary} />
          <Text style={[styles.officerDetailText, { color: theme.colors.textSecondary }]}>
            Updated: {formatTimeAgo(officer.lastUpdate)}
          </Text>
        </View>
      </View>
    </View>
  );
}

// Activity Card Component
function ActivityCard({ activity, theme }: { activity: ActivityLog; theme: any }) {
  const getActivityIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'alert':
        return 'notifications';
      case 'action':
        return 'flash';
      case 'deployment':
        return 'people';
      case 'outcome':
        return 'checkmark-circle';
      default:
        return 'information-circle';
    }
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'critical':
        return '#E94560';
      case 'high':
        return '#FF9800';
      case 'medium':
        return '#2196F3';
      default:
        return '#9E9E9E';
    }
  };

  const iconName = getActivityIcon(activity.type);
  const priorityColor = getPriorityColor(activity.priority);

  return (
    <View
      style={[
        styles.activityCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderLeftColor: priorityColor,
        },
      ]}
    >
      <View style={styles.activityHeader}>
        <View style={[styles.activityIcon, { backgroundColor: priorityColor + '20' }]}>
          <Ionicons name={iconName} size={18} color={priorityColor} />
        </View>
        <View style={styles.activityInfo}>
          <Text style={[styles.activityTitle, { color: theme.colors.text }]}>{activity.title}</Text>
          <Text style={[styles.activityTime, { color: theme.colors.textTertiary }]}>
            {formatTimeAgo(activity.timestamp)}
          </Text>
        </View>
      </View>
      <Text style={[styles.activityDescription, { color: theme.colors.textSecondary }]}>
        {activity.description}
      </Text>
      {activity.officerName && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 }}>
          <Ionicons name="person" size={12} color={theme.colors.textTertiary} />
          <Text style={[styles.activityDescription, { color: theme.colors.textTertiary, fontSize: 12 }]}>
            {activity.officerName}
          </Text>
        </View>
      )}
    </View>
  );
}

// Helper function to format time ago
function formatTimeAgo(timestamp: string): string {
  try {
    const now = Date.now();
    const time = new Date(timestamp).getTime();
    if (isNaN(time)) return 'Unknown time';
    const diff = Math.floor((now - time) / 1000 / 60); // minutes

    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch (error) {
    console.warn('Error formatting time ago:', error);
    return 'Unknown time';
  }
}

// Dossier View Component
function DossierView({
  alert,
  onClose,
  onFreeze,
  onCordon,
  onARView,
  onLogOutcome,
  theme,
  getRiskColor,
  getRiskLabel,
}: {
  alert: PredictionAlert;
  onClose: () => void;
  onFreeze: () => void;
  onCordon: () => void;
  onARView: () => void;
  onLogOutcome: () => void;
  theme: any;
  getRiskColor: (risk: number) => string;
  getRiskLabel: (risk: number) => string;
}) {
  const riskColor = getRiskColor(alert.riskScore);

  return (
    <View style={[styles.dossierContainer, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.dossierContent}>
        {/* Header */}
        <View style={[styles.dossierHeader, { backgroundColor: theme.colors.surfaceElevated }]}>
          <View>
            <Text style={[styles.dossierTitle, { color: theme.colors.text }]}>
              Intelligence Dossier
            </Text>
            <Text style={[styles.dossierSubtitle, { color: theme.colors.textSecondary }]}>
              {alert.complaintId}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {/* Risk Assessment */}
        <View style={[styles.dossierSection, { backgroundColor: theme.colors.surfaceElevated }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Risk Assessment</Text>
          <View style={[styles.riskCard, { backgroundColor: riskColor + '20', borderColor: riskColor }]}>
            <Text style={[styles.riskLabel, { color: riskColor }]}>
              {getRiskLabel(alert.riskScore)}
            </Text>
            <Text style={[styles.riskScore, { color: riskColor }]}>
              {Math.round(alert.riskScore * 100)}%
            </Text>
            <Text style={[styles.confidenceText, { color: theme.colors.textSecondary }]}>
              Confidence: {alert.hotspot?.confidenceInterval ? `${Math.round(alert.hotspot.confidenceInterval[0] * 100)}% - ${Math.round(alert.hotspot.confidenceInterval[1] * 100)}%` : 'N/A'}
            </Text>
          </View>
        </View>

        {/* Predicted Hotspot */}
        <View style={[styles.dossierSection, { backgroundColor: theme.colors.surfaceElevated }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Predicted Withdrawal</Text>
          <View style={styles.hotspotCard}>
            <Ionicons name="location" size={24} color={theme.colors.primary} />
            <View style={styles.hotspotInfo}>
              <Text style={[styles.hotspotAddress, { color: theme.colors.text }]}>
                {alert.hotspot?.address || 'Location not available'}
              </Text>
              <Text style={[styles.hotspotTime, { color: theme.colors.textSecondary }]}>
                {alert.timeWindow || 'N/A'} ({alert.timeRemaining || 0} minutes remaining)
              </Text>
              <Text style={[styles.hotspotProbability, { color: riskColor }]}>
                Probability: {Math.round((alert.hotspot?.probability || 0) * 100)}%
              </Text>
            </View>
          </View>
        </View>

        {/* SHAP Explanation */}
        {alert.shapExplanation && (
          <View style={[styles.dossierSection, { backgroundColor: theme.colors.surfaceElevated }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>AI Explanation</Text>
            <Text style={[styles.explanationText, { color: theme.colors.textSecondary }]}>
              Why this prediction:
            </Text>
            {alert.shapExplanation.topFactors.map((factor, index) => (
              <View key={index} style={styles.factorRow}>
                <View style={[styles.factorBar, { width: `${factor.contribution * 100}%`, backgroundColor: theme.colors.primary }]} />
                <Text style={[styles.factorText, { color: theme.colors.text }]}>
                  {factor.factor}: {Math.round(factor.contribution * 100)}%
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Suspect Intelligence */}
        <View style={[styles.dossierSection, { backgroundColor: theme.colors.surfaceElevated }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Suspect Intelligence</Text>
          {alert.suspect?.upiId && (
            <View style={styles.intelRow}>
              <Ionicons name="phone-portrait" size={16} color={theme.colors.textSecondary} />
              <Text style={[styles.intelText, { color: theme.colors.text }]}>
                VPA: {alert.suspect.upiId}
              </Text>
            </View>
          )}
          <View style={styles.intelRow}>
            <Ionicons name="stats-chart" size={16} color={theme.colors.textSecondary} />
            <Text style={[styles.intelText, { color: theme.colors.text }]}>
              MO Match: {Math.round((alert.suspect?.moMatch || 0) * 100)}%
            </Text>
          </View>
          {alert.suspect?.linkedAccounts && alert.suspect.linkedAccounts.length > 0 && (
            <View style={styles.intelRow}>
              <Ionicons name="link" size={16} color={theme.colors.textSecondary} />
              <Text style={[styles.intelText, { color: theme.colors.text }]}>
                Linked Accounts: {alert.suspect.linkedAccounts.join(', ')}
              </Text>
            </View>
          )}
          {alert.suspect?.crossBankPattern && (
            <View style={[styles.patternBadge, { backgroundColor: theme.colors.info + '20' }]}>
              <Ionicons name="globe" size={16} color={theme.colors.info} />
              <Text style={[styles.patternText, { color: theme.colors.info }]}>
                Cross-Bank Scam Ring Detected
              </Text>
            </View>
          )}
        </View>

        {/* Victim Info (Anonymized) */}
        <View style={[styles.dossierSection, { backgroundColor: theme.colors.surfaceElevated }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Victim (Anonymized)</Text>
          <View style={styles.victimRow}>
            <Text style={[styles.victimText, { color: theme.colors.text }]}>
              Age: {alert.victim.ageRange} | Gender: {alert.victim.gender}
            </Text>
            <Text style={[styles.anonymizedBadge, { color: theme.colors.textTertiary }]}>
              🔒 DPDP Compliant
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={[styles.actionButton, styles.freezeButton, { backgroundColor: '#E94560' }]}
            onPress={onFreeze}
            activeOpacity={0.7}
          >
            <Ionicons name="lock-closed" size={20} color="#FFF" />
            <Text style={styles.actionButtonText}>Freeze Account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.cordonButton, { backgroundColor: '#FF9800' }]}
            onPress={onCordon}
            activeOpacity={0.7}
          >
            <Ionicons name="shield" size={20} color="#FFF" />
            <Text style={styles.actionButtonText}>Activate Cordon</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.arButton, { backgroundColor: theme.colors.primary }]}
            onPress={onARView}
            activeOpacity={0.7}
          >
            <Ionicons name="camera" size={20} color="#FFF" />
            <Text style={styles.actionButtonText}>AR View</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.outcomeButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={onLogOutcome}
            activeOpacity={0.7}
          >
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.text} />
            <Text style={[styles.actionButtonText, { color: theme.colors.text }]}>Log Outcome</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginRight: 8,
  },
  headerLeftSmall: {
    flexDirection: 'column',
    gap: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerButtonSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerStats: {
    flexDirection: 'row',
    gap: 8,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    gap: 4,
  },
  statBadgeFull: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    gap: 6,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
  },
  statBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  headerFundsRow: {
    marginTop: 4,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#E94560',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  notificationBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  alertsScrollView: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  headerTitleSmall: {
    fontSize: 22,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.9,
    marginTop: 4,
  },
  headerSubtitleSmall: {
    fontSize: 12,
  },
  refreshButton: {
    padding: 8,
  },
  securityButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
  },
  refreshing: {
    transform: [{ rotate: '180deg' }],
  },
  securityStatusCard: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  securityStatusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  securityStatusText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  securityStatusSubtext: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 28,
  },
  securityAlertBanner: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  securityAlertText: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statsRowScroll: {
    marginHorizontal: -16,
  },
  statsRowContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    marginTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  alertCard: {
    margin: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  riskBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riskText: {
    fontSize: 14,
    fontWeight: '700',
  },
  alertInfo: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  alertComplaintId: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  alertBody: {
    gap: 8,
    marginBottom: 12,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertText: {
    fontSize: 14,
    flex: 1,
  },
  crossBankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    marginTop: 4,
  },
  crossBankText: {
    fontSize: 12,
    fontWeight: '600',
  },
  alertFooter: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  mapContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  comingSoon: {
    fontSize: 16,
    textAlign: 'center',
  },
  statsView: {
    padding: 16,
  },
  statsCard: {
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  metricLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  dossierContainer: {
    flex: 1,
  },
  dossierContent: {
    flex: 1,
  },
  dossierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  dossierTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  dossierSubtitle: {
    fontSize: 14,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dossierSection: {
    margin: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  riskCard: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
  },
  riskLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  riskScore: {
    fontSize: 32,
    fontWeight: '700',
  },
  confidenceText: {
    fontSize: 12,
    marginTop: 8,
  },
  hotspotCard: {
    flexDirection: 'row',
    gap: 12,
  },
  hotspotInfo: {
    flex: 1,
  },
  hotspotAddress: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  hotspotTime: {
    fontSize: 14,
    marginBottom: 4,
  },
  hotspotProbability: {
    fontSize: 14,
    fontWeight: '700',
  },
  explanationText: {
    fontSize: 14,
    marginBottom: 12,
  },
  factorRow: {
    marginBottom: 8,
  },
  factorBar: {
    height: 4,
    borderRadius: 2,
    marginBottom: 4,
  },
  factorText: {
    fontSize: 13,
  },
  intelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  intelText: {
    fontSize: 14,
    flex: 1,
  },
  patternBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  patternText: {
    fontSize: 13,
    fontWeight: '600',
  },
  victimRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  victimText: {
    fontSize: 14,
  },
  anonymizedBadge: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionBar: {
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  freezeButton: {
    backgroundColor: '#E94560',
  },
  cordonButton: {
    backgroundColor: '#FF9800',
  },
  arButton: {
    backgroundColor: '#2196F3',
  },
  outcomeButton: {
    borderWidth: 1.5,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  officersView: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  statusLegend: {
    flexDirection: 'row',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '500',
  },
  activityView: {
    padding: 16,
  },
  officerCard: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  officerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  officerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  officerInfo: {
    flex: 1,
  },
  officerName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  officerBadge: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  officerStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  officerStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  officerDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  officerDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: '45%',
  },
  officerDetailText: {
    fontSize: 13,
    flex: 1,
  },
  activityCard: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  activityDescription: {
    fontSize: 13,
    marginTop: 4,
  },
});

// Helper functions for sample data
function getSampleAlerts(): PredictionAlert[] {
  return [
    {
      id: 'alert_1',
      complaintId: 'NCRP-2025-8891',
      riskScore: 0.92,
      timeWindow: '2:45 PM - 3:15 PM',
      hotspot: {
        address: 'HDFC ATM, CSMT Railway Station, Mumbai',
        lat: 18.9400,
        lon: 72.8350,
        probability: 0.92,
        confidenceInterval: [0.87, 0.97],
      },
      victim: {
        ageRange: '25-34',
        gender: 'Male',
        anonymized: true,
      },
      suspect: {
        upiId: 'fraud123@ybl',
        moMatch: 0.87,
        linkedAccounts: ['fraud123@ybl', 'scam456@oksbi'],
        crossBankPattern: true,
      },
      amount: 120000,
      scamType: 'UPI Fraud',
      shapExplanation: {
        topFactors: [
          { factor: 'Similar MO pattern', contribution: 0.35 },
          { factor: 'Railway station proximity', contribution: 0.28 },
          { factor: 'Time window match', contribution: 0.22 },
          { factor: 'Cross-bank pattern', contribution: 0.15 },
        ],
      },
      timestamp: new Date().toISOString(),
      timeRemaining: 38,
    },
  ];
}

function getSampleOfficers(): Officer[] {
  return [
    {
      id: 'officer_1',
      name: 'Inspector Rajesh Kumar',
      badgeNumber: 'LEA-2024-001',
      rank: 'Inspector',
      status: 'deployed',
      currentAssignment: 'NCRP-2025-8891',
      location: {
        lat: 18.9400,
        lon: 72.8350,
        address: 'CSMT Railway Station, Mumbai',
      },
      responseTime: 12,
      casesAssigned: 5,
      successRate: 78,
      lastUpdate: new Date(Date.now() - 5 * 60000).toISOString(),
    },
    {
      id: 'officer_2',
      name: 'Sub-Inspector Priya Sharma',
      badgeNumber: 'LEA-2024-002',
      rank: 'Sub-Inspector',
      status: 'responding',
      currentAssignment: 'NCRP-2025-8892',
      location: {
        lat: 19.0760,
        lon: 72.8777,
        address: 'Andheri East, Mumbai',
      },
      responseTime: 8,
      casesAssigned: 3,
      successRate: 85,
      lastUpdate: new Date(Date.now() - 2 * 60000).toISOString(),
    },
    {
      id: 'officer_3',
      name: 'Constable Amit Patel',
      badgeNumber: 'LEA-2024-003',
      rank: 'Constable',
      status: 'available',
      currentAssignment: undefined,
      location: undefined,
      responseTime: 15,
      casesAssigned: 2,
      successRate: 72,
      lastUpdate: new Date(Date.now() - 10 * 60000).toISOString(),
    },
    {
      id: 'officer_4',
      name: 'Inspector Vikram Singh',
      badgeNumber: 'LEA-2024-004',
      rank: 'Inspector',
      status: 'deployed',
      currentAssignment: 'NCRP-2025-8893',
      location: {
        lat: 19.2183,
        lon: 72.9781,
        address: 'Thane, Maharashtra',
      },
      responseTime: 10,
      casesAssigned: 4,
      successRate: 82,
      lastUpdate: new Date(Date.now() - 3 * 60000).toISOString(),
    },
  ];
}

function getSampleActivityLog(): ActivityLog[] {
  return [
    {
      id: 'activity_1',
      type: 'alert',
      title: 'New High-Risk Alert',
      description: 'NCRP-2025-8891 - UPI Fraud detected at CSMT Railway Station',
      timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
      alertId: 'alert_1',
      priority: 'critical',
    },
    {
      id: 'activity_2',
      type: 'deployment',
      title: 'Officer Deployed',
      description: 'Inspector Rajesh Kumar assigned to NCRP-2025-8891',
      timestamp: new Date(Date.now() - 4 * 60000).toISOString(),
      officerId: 'officer_1',
      officerName: 'Inspector Rajesh Kumar',
      alertId: 'alert_1',
      priority: 'high',
    },
    {
      id: 'activity_3',
      type: 'action',
      title: 'Digital Cordon Activated',
      description: '2km radius freeze activated around CSMT Railway Station',
      timestamp: new Date(Date.now() - 3 * 60000).toISOString(),
      alertId: 'alert_1',
      priority: 'high',
    },
    {
      id: 'activity_4',
      type: 'outcome',
      title: 'Case Resolved',
      description: 'NCRP-2025-8890 - Suspect arrested, ₹85,000 recovered',
      timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
      officerId: 'officer_2',
      officerName: 'Sub-Inspector Priya Sharma',
      priority: 'medium',
    },
    {
      id: 'activity_5',
      type: 'system',
      title: 'System Update',
      description: 'Prediction model updated - Improved accuracy by 3.2%',
      timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
      priority: 'low',
    },
  ];
}

