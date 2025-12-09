import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { dashboardService, caseService, DashboardData, PriorityAlert } from '../api';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme/theme';
import NewComplaintAlertScreen from './NewComplaintAlertScreen';

interface ActivityItem {
  id: string;
  type: 'alert' | 'freeze' | 'deployment';
  title: string;
  subtitle: string;
  time: string;
  icon: string;
  color: string;
}

export default function DashboardScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const [statistics, setStatistics] = useState({
    casesToday: 0,
    recoveredToday: 0,
    highRiskAlerts: 0,
    atRiskAmount: 0,
    recoveryRate: 0,
    casesChange: 0,
    resolvedToday: 0,
    accountsFrozenToday: 0,
    successRate: 0,
    teamsDeployed: 0,
    accountsFrozenTotal: 0,
    amountSecured: 0,
  });
  const [aiInsight, setAiInsight] = useState({
    message: 'Loading AI insights...',
    type: 'INFO' as 'WARNING' | 'INFO' | 'ALERT',
    action_url: '',
  });
  const [priorityAlerts, setPriorityAlerts] = useState<PriorityAlert[]>([]);
  const [liveActivity, setLiveActivity] = useState<ActivityItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewAlert, setShowNewAlert] = useState(false);
  const [latestCaseId, setLatestCaseId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadData();
    
    // Pulse animation for live indicator
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.5,
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

    // Check for new cases every 30 seconds
    const checkNewCases = async () => {
      try {
        const result = await caseService.listCases({ 
          status: 'NEW',
          priority: 'CRITICAL',
          limit: 5 
        });
        if (result.success && result.data?.cases && result.data.cases.length > 0) {
          const latestCase = result.data.cases[0];
          // Check if this is a new case we haven't seen
          if (latestCase.case_id !== latestCaseId) {
            setLatestCaseId(latestCase.case_id);
            // Show new alert modal for critical cases
            if (latestCase.priority === 'CRITICAL') {
              setShowNewAlert(true);
            }
          }
        }
      } catch (error) {
        console.error('Error checking new cases:', error);
      }
    };

    // Check every 30 seconds
    const alertInterval = setInterval(checkNewCases, 30000);
    checkNewCases(); // Initial check

    return () => clearInterval(alertInterval);
  }, [latestCaseId]);

  const loadData = async () => {
    try {
      // Fetch dashboard stats from API (primary data source)
      const statsResult = await dashboardService.getDashboardStats('today');
      
      if (statsResult.success && statsResult.data) {
        const stats = statsResult.data;
        
        // Calculate high-risk alerts from priority breakdown
        const criticalCount = stats.cases?.by_priority?.CRITICAL || 0;
        const highCount = stats.cases?.by_priority?.HIGH || 0;
        // EST risk should be sum of losses from top 3 cases
        const totalAtRisk = stats.recovery?.est_risk_amount || stats.live_activity?.est_risk_amount || stats.recovery?.total_fraud_amount || 0;
        
        // Update statistics from dashboard stats API
        setStatistics({
          casesToday: stats.today?.new_cases || stats.cases?.total || 0,
          recoveredToday: stats.today?.amount_recovered || stats.recovery?.total_recovered || 0,
          highRiskAlerts: criticalCount + highCount,
          atRiskAmount: totalAtRisk,
          recoveryRate: stats.recovery?.recovery_rate || 0,
          casesChange: stats.cases?.success_rate ? Math.round(stats.cases.success_rate - 70) : 12,
          resolvedToday: stats.today?.resolved || stats.cases?.resolved || 0,
          accountsFrozenToday: stats.today?.frozen_accounts || stats.freeze_actions?.accounts_frozen_today || 0,
          successRate: stats.cases?.success_rate || 0,
          teamsDeployed: stats.teams?.deployed_now || 0,
          accountsFrozenTotal: stats.freeze_actions?.accounts_frozen_total || 0,
          amountSecured: stats.freeze_actions?.amount_secured || 0,
        });
      }
      
      // Also fetch dashboard data for priority alerts and AI insights
      const dashboardResult = await dashboardService.getDashboard();
      
      if (dashboardResult.success && dashboardResult.data) {
        const data = dashboardResult.data;
        
        // Update AI insight
        if (data.ai_insight) {
          setAiInsight(data.ai_insight);
        }
        
        // Update priority alerts
        if (data.priority_alerts) {
          setPriorityAlerts(data.priority_alerts);
          setUnreadCount(data.priority_alerts.filter(a => a.priority === 'CRITICAL').length);
        }
        
        // Generate live activity from priority alerts
        const activities: ActivityItem[] = data.priority_alerts?.slice(0, 3).map((alert) => ({
          id: alert.case_id,
          type: 'alert' as const,
          title: `New ${alert.fraud_type?.replace('_', ' ') || 'fraud'} alert - ${alert.predicted_location || 'Unknown'}`,
          subtitle: `₹${(alert.fraud_amount / 100000).toFixed(1)}L • ${Math.round(alert.confidence * 100)}% confidence`,
          time: getTimeAgo(new Date(alert.created_at)),
          icon: alert.priority === 'CRITICAL' ? 'warning' : 'alert-circle',
          color: alert.priority === 'CRITICAL' ? '#ef4444' : '#f59e0b',
        })) || [];
        
        setLiveActivity(activities.length > 0 ? activities : [
          {
            id: '1',
            type: 'alert',
            title: 'Monitoring for new alerts',
            subtitle: 'System active and monitoring',
            time: 'Now',
            icon: 'shield-checkmark',
            color: '#22c55e',
          },
        ]);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };
  
  const getTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getOfficerInitials = () => {
    if (user?.name) {
      const names = user.name.split(' ');
      return names.map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return 'PS';
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

  return (
    <View style={[styles.container, { backgroundColor: '#f8fafc' }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3b82f6"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.userInfo}>
              <LinearGradient
                colors={['#3b82f6', '#2563eb']}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>{getOfficerInitials()}</Text>
              </LinearGradient>
              <View>
                <Text style={styles.greeting}>Good morning,</Text>
                <Text style={styles.userName}>
                  {user?.name || 'SI Priya Sharma'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => {
                // Navigate using parent Stack Navigator
                const parent = navigation.getParent();
                // @ts-ignore - React Navigation type inference limitation
                const nav = parent || navigation;
                // @ts-ignore - React Navigation type inference limitation
                nav.navigate('Notifications' as never);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications" size={24} color="#374151" />
              {unreadCount > 0 && (
                <View style={[styles.notificationBadge, { backgroundColor: '#ef4444' }]}>
                  <Text style={styles.notificationBadgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Priority Alert Card */}
        <View style={styles.priorityCard}>
          <LinearGradient
            colors={['#ef4444', '#dc2626']}
            style={styles.priorityGradient}
          >
            <View style={styles.priorityContent}>
              <View style={styles.priorityHeader}>
                <View style={styles.priorityBadge}>
                  <Ionicons name="alert-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.priorityBadgeText}>CRITICAL PRIORITY</Text>
                </View>
              </View>
              <Text style={styles.priorityTitle}>
                {statistics.highRiskAlerts || 0} High-Risk Alerts
              </Text>
              <Text style={styles.prioritySubtitle}>
                Immediate attention required
              </Text>
              <View style={styles.priorityFooter}>
                <View>
                  <Text style={styles.priorityLabel}>Est. at risk</Text>
                  <Text style={styles.priorityAmount}>
                    {formatCurrency(statistics.atRiskAmount)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.viewAlertsButton}
                onPress={() => navigation.navigate('Alerts' as never)}
                activeOpacity={0.8}
              >
                <Text style={styles.viewAlertsText}>View Alerts</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#dbeafe' }]}>
              <Ionicons name="checkmark-circle" size={20} color="#2563eb" />
            </View>
            <Text style={styles.statValue}>{statistics.casesToday || 0}</Text>
            <Text style={styles.statLabel}>Cases Today</Text>
            <Text style={styles.statChange}>
              {statistics.resolvedToday > 0 ? `${statistics.resolvedToday} resolved` : 'No cases yet'}
            </Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#dcfce7' }]}>
              <Ionicons name="wallet" size={20} color="#16a34a" />
            </View>
            <Text style={styles.statValue}>
              {formatCurrency(statistics.recoveredToday)}
            </Text>
            <Text style={styles.statLabel}>Recovered Today</Text>
            <Text style={styles.statChange}>
              {statistics.recoveryRate > 0 ? `↑ ${statistics.recoveryRate.toFixed(1)}%` : '0%'} recovery rate
            </Text>
          </View>
        </View>

        {/* Additional Stats Row */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="lock-closed" size={20} color="#d97706" />
            </View>
            <Text style={styles.statValue}>{statistics.accountsFrozenToday || 0}</Text>
            <Text style={styles.statLabel}>Frozen Today</Text>
            <Text style={styles.statChange}>
              {statistics.accountsFrozenTotal > 0 ? `${statistics.accountsFrozenTotal} total` : 'No freezes'}
            </Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#e0e7ff' }]}>
              <Ionicons name="people" size={20} color="#6366f1" />
            </View>
            <Text style={styles.statValue}>{statistics.teamsDeployed || 0}</Text>
            <Text style={styles.statLabel}>Teams Deployed</Text>
            <Text style={styles.statChange}>
              {statistics.successRate > 0 ? `${statistics.successRate.toFixed(1)}%` : '0%'} success rate
            </Text>
          </View>
        </View>

        {/* Live Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Live Activity</Text>
            <View style={styles.liveIndicator}>
              <Animated.View
                style={[
                  styles.liveDot,
                  { opacity: pulseAnim },
                ]}
              />
              <Text style={styles.liveText}>Live</Text>
            </View>
          </View>

          <View style={styles.activityList}>
            {liveActivity.map((activity) => (
              <View key={activity.id} style={styles.activityItem}>
                <View
                  style={[
                    styles.activityIcon,
                    { backgroundColor: `${activity.color}15` },
                  ]}
                >
                  <Ionicons
                    name={activity.icon as any}
                    size={20}
                    color={activity.color}
                  />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>{activity.title}</Text>
                  <Text style={styles.activitySubtitle}>{activity.subtitle}</Text>
                </View>
                <Text style={styles.activityTime}>{activity.time}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* AI Insights */}
        <View style={styles.aiCard}>
          <LinearGradient
            colors={['#1e293b', '#0f172a']}
            style={styles.aiGradient}
          >
            <View style={styles.aiHeader}>
              <Ionicons name="sparkles" size={20} color="#06b6d4" />
              <Text style={styles.aiTitle}>AI Intelligence</Text>
            </View>
            <Text style={styles.aiText}>
              {aiInsight.message || 'Predicted surge in OTP fraud activities in South Mumbai between 2-5 PM today. Consider increased monitoring.'}
            </Text>
            <TouchableOpacity
              style={styles.aiLink}
              onPress={() => {
                // Navigate to AI Analysis screen using parent Stack Navigator
                const parent = navigation.getParent();
                // @ts-ignore - React Navigation type inference limitation
                const nav = parent || navigation;
                // @ts-ignore - React Navigation type inference limitation
                nav.navigate('AIAnalysis' as never, { caseId: null } as never);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.aiLinkText}>View Analysis </Text>
              <Ionicons name="arrow-forward" size={16} color="#06b6d4" />
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </ScrollView>

      {/* New Complaint Alert Modal */}
      <NewComplaintAlertScreen
        visible={showNewAlert}
        onClose={() => setShowNewAlert(false)}
      />

      {/* Simulate Alert Button (for testing) */}
      <TouchableOpacity
        style={styles.simulateButton}
        onPress={() => setShowNewAlert(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.simulateButtonText}>🚨 Simulate Alert</Text>
      </TouchableOpacity>
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
    paddingBottom: 100,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  greeting: {
    fontSize: 14,
    color: '#6b7280',
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  notificationBadgeOld: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  priorityCard: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  priorityGradient: {
    padding: 16,
  },
  priorityContent: {
    gap: 12,
  },
  priorityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  priorityTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  prioritySubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  priorityFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  priorityLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  priorityAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  viewAlertsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  viewAlertsText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  statChange: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '500',
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  liveText: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '500',
  },
  activityList: {
    gap: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  activityTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  aiCard: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
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
  aiText: {
    fontSize: 14,
    color: '#d1d5db',
    lineHeight: 20,
    marginBottom: 12,
  },
  aiHighlight: {
    color: '#06b6d4',
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
  simulateButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  simulateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
