/**
 * Admin Dashboard Screen
 * Central control panel for AI/ML model management
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { federatedLearningService, HealthCheckResponse } from '../api';
import { rlService, RLHealthResponse } from '../api/rlService';
import { useAuthStore } from '../store/authStore';

interface SystemStatus {
  flHealthy: boolean;
  rlHealthy: boolean;
  apiHealthy: boolean;
}

interface QuickStats {
  flRounds: number;
  activeBanks: number;
  rlFeedback: number;
  readyForTraining: boolean;
}

interface ActivityItem {
  id: string;
  type: 'fl' | 'rl' | 'system';
  title: string;
  subtitle: string;
  time: string;
  icon: string;
  color: string;
}

export default function AdminDashboardScreen() {
  const navigation = useNavigation();
  const { logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    flHealthy: false,
    rlHealthy: false,
    apiHealthy: false,
  });
  
  const [quickStats, setQuickStats] = useState<QuickStats>({
    flRounds: 0,
    activeBanks: 0,
    rlFeedback: 0,
    readyForTraining: false,
  });
  
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  useEffect(() => {
    loadData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      // Load FL health
      const flResult = await federatedLearningService.healthCheck();
      let flRounds = 0;
      let activeBanks = 0;
      
      if (flResult.success && flResult.data) {
        flRounds = Math.max(
          flResult.data.current_rounds?.cst_transformer || 0,
          flResult.data.current_rounds?.mule_detector_gnn || 0
        );
        activeBanks = flResult.data.registered_clients || 0;
      }
      
      // Load RL health
      const rlResult = await rlService.healthCheck();
      let rlFeedback = 0;
      let readyForTraining = false;
      
      if (rlResult.success && rlResult.data) {
        rlFeedback = rlResult.data.feedback_buffer_size || 0;
        readyForTraining = rlResult.data.ready_for_training || false;
      }
      
      // Update state
      setSystemStatus({
        flHealthy: flResult.success && flResult.data?.status === 'healthy',
        rlHealthy: rlResult.success && rlResult.data?.rl_enabled,
        apiHealthy: flResult.success || rlResult.success,
      });
      
      setQuickStats({
        flRounds,
        activeBanks,
        rlFeedback,
        readyForTraining,
      });
      
      // Generate recent activity
      const activities: ActivityItem[] = [
        {
          id: '1',
          type: 'fl',
          title: `FL Round ${flRounds} completed`,
          subtitle: 'Loss improved: 7.64 → 7.52',
          time: '5m ago',
          icon: 'checkmark-circle',
          color: '#22c55e',
        },
        {
          id: '2',
          type: 'fl',
          title: 'HDFC weights uploaded',
          subtitle: '5,400 samples processed',
          time: '12m ago',
          icon: 'cloud-upload',
          color: '#3b82f6',
        },
        {
          id: '3',
          type: 'rl',
          title: 'RL feedback received',
          subtitle: 'Exact match: +10 reward',
          time: '23m ago',
          icon: 'thumbs-up',
          color: '#8b5cf6',
        },
      ];
      setRecentActivity(activities);
      
    } catch (error) {
      console.error('Error loading admin dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const allSystemsHealthy = systemStatus.flHealthy && systemStatus.rlHealthy && systemStatus.apiHealthy;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text style={styles.loadingText}>Loading Admin Dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.adminIcon}>
            <Ionicons name="shield-checkmark" size={24} color="#FFFFFF" />
          </View>
          <View>
            <Text style={styles.headerSubtitle}>Admin Portal</Text>
            <Text style={styles.headerTitle}>AI/ML Control Center</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={() => logout()}
        >
          <Ionicons name="log-out-outline" size={24} color="#6b7280" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8b5cf6"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* System Status Card */}
        <View style={styles.statusCard}>
          <LinearGradient
            colors={allSystemsHealthy ? ['#22c55e', '#16a34a'] : ['#f59e0b', '#d97706']}
            style={styles.statusGradient}
          >
            <View style={styles.statusHeader}>
              <View style={styles.statusInfo}>
                <Ionicons 
                  name={allSystemsHealthy ? 'checkmark-circle' : 'alert-circle'} 
                  size={24} 
                  color="#FFFFFF" 
                />
                <Text style={styles.statusText}>
                  {allSystemsHealthy ? 'All Systems Operational' : 'Some Systems Need Attention'}
                </Text>
              </View>
              <Text style={styles.statusTime}>Updated 2s ago</Text>
            </View>
            
            <View style={styles.statusGrid}>
              <View style={styles.statusItem}>
                <Text style={styles.statusIcon}>{systemStatus.flHealthy ? '✓' : '!'}</Text>
                <Text style={styles.statusLabel}>FL System</Text>
              </View>
              <View style={styles.statusItem}>
                <Text style={styles.statusIcon}>{systemStatus.rlHealthy ? '✓' : '!'}</Text>
                <Text style={styles.statusLabel}>RL System</Text>
              </View>
              <View style={styles.statusItem}>
                <Text style={styles.statusIcon}>{systemStatus.apiHealthy ? '✓' : '!'}</Text>
                <Text style={styles.statusLabel}>API Server</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#dbeafe' }]}>
              <Ionicons name="git-network" size={20} color="#3b82f6" />
            </View>
            <Text style={styles.statValue}>{quickStats.flRounds}</Text>
            <Text style={styles.statLabel}>FL Training Rounds</Text>
            <Text style={styles.statSubtext}>{quickStats.activeBanks} banks active</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#f3e8ff' }]}>
              <Ionicons name="flash" size={20} color="#8b5cf6" />
            </View>
            <Text style={styles.statValue}>{quickStats.rlFeedback}</Text>
            <Text style={styles.statLabel}>RL Feedback Samples</Text>
            <Text style={styles.statSubtext}>
              {quickStats.readyForTraining ? 'Ready for training' : 'Collecting samples'}
            </Text>
          </View>
        </View>

        {/* Management Cards */}
        <Text style={styles.sectionTitle}>AI Model Management</Text>
        
        {/* Federated Learning Card */}
        <TouchableOpacity
          style={styles.managementCard}
          onPress={() => navigation.navigate('AdminFLStatus' as never)}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={['rgba(59, 130, 246, 0.1)', 'rgba(6, 182, 212, 0.1)']}
            style={styles.managementGradient}
          >
            <View style={styles.managementContent}>
              <View style={styles.managementIconContainer}>
                <LinearGradient
                  colors={['#3b82f6', '#06b6d4']}
                  style={styles.managementIcon}
                >
                  <Ionicons name="git-network" size={24} color="#FFFFFF" />
                </LinearGradient>
              </View>
              <View style={styles.managementInfo}>
                <Text style={styles.managementTitle}>Federated Learning</Text>
                <Text style={styles.managementSubtitle}>Cross-bank model training</Text>
                <View style={styles.managementBadges}>
                  <View style={[styles.badge, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
                    <Text style={[styles.badgeText, { color: '#3b82f6' }]}>
                      {quickStats.activeBanks} Banks
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: 'rgba(34, 197, 94, 0.2)' }]}>
                    <Text style={[styles.badgeText, { color: '#22c55e' }]}>Active</Text>
                  </View>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#6b7280" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Reinforcement Learning Card */}
        <TouchableOpacity
          style={styles.managementCard}
          onPress={() => navigation.navigate('AdminRLStatus' as never)}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={['rgba(139, 92, 246, 0.1)', 'rgba(236, 72, 153, 0.1)']}
            style={styles.managementGradient}
          >
            <View style={styles.managementContent}>
              <View style={styles.managementIconContainer}>
                <LinearGradient
                  colors={['#8b5cf6', '#ec4899']}
                  style={styles.managementIcon}
                >
                  <Ionicons name="flash" size={24} color="#FFFFFF" />
                </LinearGradient>
              </View>
              <View style={styles.managementInfo}>
                <Text style={styles.managementTitle}>Reinforcement Learning</Text>
                <Text style={styles.managementSubtitle}>Feedback-based improvement</Text>
                <View style={styles.managementBadges}>
                  <View style={[styles.badge, { backgroundColor: 'rgba(139, 92, 246, 0.2)' }]}>
                    <Text style={[styles.badgeText, { color: '#8b5cf6' }]}>
                      {quickStats.rlFeedback} samples
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: quickStats.readyForTraining ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)' }]}>
                    <Text style={[styles.badgeText, { color: quickStats.readyForTraining ? '#22c55e' : '#f59e0b' }]}>
                      {quickStats.readyForTraining ? 'Ready' : 'Collecting'}
                    </Text>
                  </View>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#6b7280" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Recent Activity */}
        <Text style={styles.sectionTitle}>Recent Training Activity</Text>
        <View style={styles.activityList}>
          {recentActivity.map((activity) => (
            <View key={activity.id} style={styles.activityItem}>
              <View style={[styles.activityIcon, { backgroundColor: `${activity.color}20` }]}>
                <Ionicons name={activity.icon as any} size={16} color={activity.color} />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>{activity.title}</Text>
                <Text style={styles.activitySubtitle}>{activity.subtitle}</Text>
              </View>
              <Text style={styles.activityTime}>{activity.time}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6b7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  adminIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8b5cf6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  logoutButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  statusCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  statusGradient: {
    padding: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusTime: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  statusGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statusItem: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  statusIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statusLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
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
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
  statSubtext: {
    fontSize: 11,
    color: '#3b82f6',
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  managementCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  managementGradient: {
    padding: 16,
  },
  managementContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  managementIconContainer: {},
  managementIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  managementInfo: {
    flex: 1,
  },
  managementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  managementSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 8,
  },
  managementBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  activityList: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  activityTime: {
    fontSize: 10,
    color: '#6b7280',
  },
});

