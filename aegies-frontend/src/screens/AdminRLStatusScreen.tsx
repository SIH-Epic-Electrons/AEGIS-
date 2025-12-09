/**
 * Admin Reinforcement Learning Status Screen
 * Monitors RL training progress, feedback stats, and model performance
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
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  rlService, 
  RLHealthResponse, 
  RLConfig, 
  RLTrainingStatus,
  RLFeedbackStats 
} from '../api/rlService';

const { width: screenWidth } = Dimensions.get('window');

export default function AdminRLStatusScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // State for RL data
  const [health, setHealth] = useState<RLHealthResponse | null>(null);
  const [config, setConfig] = useState<RLConfig | null>(null);
  const [cstStatus, setCstStatus] = useState<RLTrainingStatus | null>(null);
  const [gnnStatus, setGnnStatus] = useState<RLTrainingStatus | null>(null);
  const [feedbackStats, setFeedbackStats] = useState<RLFeedbackStats | null>(null);
  
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  useEffect(() => {
    loadData();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [healthResult, configResult, cstResult, gnnResult, statsResult] = await Promise.all([
        rlService.healthCheck(),
        rlService.getConfig(),
        rlService.getTrainingStatus('cst_transformer'),
        rlService.getTrainingStatus('mule_detector_gnn'),
        rlService.getStats(30),
      ]);

      if (healthResult.success) setHealth(healthResult.data || null);
      if (configResult.success) setConfig(configResult.data || null);
      if (cstResult.success) setCstStatus(cstResult.data || null);
      if (gnnResult.success) setGnnStatus(gnnResult.data || null);
      if (statsResult.success) setFeedbackStats(statsResult.data || null);
    } catch (error) {
      console.error('Error loading RL data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const triggerTraining = async (modelName: string) => {
    try {
      const result = await rlService.triggerTraining(modelName, 1);
      if (result.success) {
        alert(`Training completed!\nLoss: ${result.data?.loss}\nReward: ${result.data?.average_reward}`);
        loadData();
      } else {
        alert(`Training failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error triggering training:', error);
      alert('Failed to trigger training');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Loading RL Status...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reinforcement Learning</Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={onRefresh}
        >
          <Ionicons name="refresh" size={24} color="#6b7280" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#10b981"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Health Status Card */}
        <View style={styles.healthCard}>
          <LinearGradient
            colors={health?.rl_enabled ? ['#10b981', '#059669'] : ['#6b7280', '#4b5563']}
            style={styles.healthGradient}
          >
            <View style={styles.healthContent}>
              <Ionicons 
                name={health?.rl_enabled ? 'flash' : 'flash-off'} 
                size={48} 
                color="#FFFFFF" 
              />
              <View style={styles.healthInfo}>
                <Text style={styles.healthStatus}>
                  {health?.rl_enabled ? 'RL System Active' : 'RL System Disabled'}
                </Text>
                <Text style={styles.healthClients}>
                  Buffer: {health?.feedback_buffer_size || 0} samples • 
                  {health?.ready_for_training ? ' Ready to train' : ' Collecting data'}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Feedback Statistics */}
        <Text style={styles.sectionTitle}>Feedback Statistics (Last 30 Days)</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{feedbackStats?.total_feedback || 0}</Text>
            <Text style={styles.statLabel}>Total Feedback</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{feedbackStats?.metrics.average_location_accuracy || '0%'}</Text>
            <Text style={styles.statLabel}>Location Accuracy</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{feedbackStats?.metrics.average_recovery_rate || '0%'}</Text>
            <Text style={styles.statLabel}>Recovery Rate</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{feedbackStats?.metrics.average_reward?.toFixed(2) || '0'}</Text>
            <Text style={styles.statLabel}>Avg Reward</Text>
          </View>
        </View>

        {/* Accuracy Distribution */}
        <Text style={styles.sectionTitle}>Prediction Accuracy</Text>
        <View style={styles.distributionCard}>
          <View style={styles.distributionRow}>
            <View style={[styles.distributionBar, { backgroundColor: '#22c55e', flex: feedbackStats?.accuracy_distribution.exact_match || 1 }]} />
            <View style={[styles.distributionBar, { backgroundColor: '#3b82f6', flex: feedbackStats?.accuracy_distribution.nearby || 1 }]} />
            <View style={[styles.distributionBar, { backgroundColor: '#f59e0b', flex: feedbackStats?.accuracy_distribution.different || 1 }]} />
            <View style={[styles.distributionBar, { backgroundColor: '#6b7280', flex: feedbackStats?.accuracy_distribution.unknown || 1 }]} />
          </View>
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
              <Text style={styles.legendText}>Exact ({feedbackStats?.accuracy_distribution.exact_match || 0})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
              <Text style={styles.legendText}>Nearby ({feedbackStats?.accuracy_distribution.nearby || 0})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
              <Text style={styles.legendText}>Different ({feedbackStats?.accuracy_distribution.different || 0})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#6b7280' }]} />
              <Text style={styles.legendText}>Unknown ({feedbackStats?.accuracy_distribution.unknown || 0})</Text>
            </View>
          </View>
        </View>

        {/* Model Status Cards */}
        <Text style={styles.sectionTitle}>Model Training Status</Text>
        
        {/* CST Transformer */}
        <View style={styles.modelCard}>
          <View style={styles.modelHeader}>
            <View style={styles.modelIcon}>
              <Ionicons name="location" size={20} color="#3b82f6" />
            </View>
            <View style={styles.modelInfo}>
              <Text style={styles.modelName}>CST Transformer</Text>
              <Text style={styles.modelDescription}>{cstStatus?.model_version || 'v1.0'}</Text>
            </View>
            <View style={[
              styles.statusBadge, 
              { backgroundColor: cstStatus?.is_ready ? '#dcfce7' : '#fee2e2' }
            ]}>
              <Text style={[
                styles.statusBadgeText,
                { color: cstStatus?.is_ready ? '#16a34a' : '#dc2626' }
              ]}>
                {cstStatus?.is_ready ? 'Ready' : 'Not Loaded'}
              </Text>
            </View>
          </View>
          
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{cstStatus?.total_updates || 0}</Text>
              <Text style={styles.metricLabel}>Updates</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{cstStatus?.metrics.average_loss?.toFixed(4) || '0'}</Text>
              <Text style={styles.metricLabel}>Avg Loss</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{cstStatus?.metrics.average_reward?.toFixed(2) || '0'}</Text>
              <Text style={styles.metricLabel}>Avg Reward</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{cstStatus?.buffer_size || 0}</Text>
              <Text style={styles.metricLabel}>Buffer</Text>
            </View>
          </View>

          {/* Mini chart for recent losses */}
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Recent Loss Trend</Text>
            <View style={styles.miniChart}>
              {cstStatus?.metrics.recent_losses?.map((loss, index) => (
                <View 
                  key={index}
                  style={[
                    styles.chartBar,
                    { 
                      height: Math.max(10, (1 - loss) * 60),
                      backgroundColor: '#3b82f6',
                    }
                  ]} 
                />
              ))}
            </View>
          </View>

          <TouchableOpacity 
            style={[
              styles.trainButton, 
              { backgroundColor: cstStatus?.ready_for_update ? '#3b82f6' : '#9ca3af' }
            ]}
            onPress={() => triggerTraining('cst_transformer')}
            disabled={!cstStatus?.ready_for_update}
          >
            <Ionicons name="play" size={16} color="#FFFFFF" />
            <Text style={styles.trainButtonText}>
              {cstStatus?.ready_for_update ? 'Trigger Training' : `Need ${(cstStatus?.min_samples_needed || 100) - (cstStatus?.buffer_size || 0)} more samples`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* GNN Mule Detector */}
        <View style={styles.modelCard}>
          <View style={styles.modelHeader}>
            <View style={[styles.modelIcon, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="git-network" size={20} color="#f59e0b" />
            </View>
            <View style={styles.modelInfo}>
              <Text style={styles.modelName}>GNN Mule Detector</Text>
              <Text style={styles.modelDescription}>{gnnStatus?.model_version || 'v1.0'}</Text>
            </View>
            <View style={[
              styles.statusBadge, 
              { backgroundColor: gnnStatus?.is_ready ? '#dcfce7' : '#fee2e2' }
            ]}>
              <Text style={[
                styles.statusBadgeText,
                { color: gnnStatus?.is_ready ? '#16a34a' : '#dc2626' }
              ]}>
                {gnnStatus?.is_ready ? 'Ready' : 'Not Loaded'}
              </Text>
            </View>
          </View>
          
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{gnnStatus?.total_updates || 0}</Text>
              <Text style={styles.metricLabel}>Updates</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{gnnStatus?.metrics.average_loss?.toFixed(4) || '0'}</Text>
              <Text style={styles.metricLabel}>Avg Loss</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{gnnStatus?.metrics.average_reward?.toFixed(2) || '0'}</Text>
              <Text style={styles.metricLabel}>Avg Reward</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{gnnStatus?.buffer_size || 0}</Text>
              <Text style={styles.metricLabel}>Buffer</Text>
            </View>
          </View>

          {/* Mini chart for recent rewards */}
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Recent Reward Trend</Text>
            <View style={styles.miniChart}>
              {gnnStatus?.metrics.recent_rewards?.map((reward, index) => (
                <View 
                  key={index}
                  style={[
                    styles.chartBar,
                    { 
                      height: Math.max(10, reward * 60),
                      backgroundColor: '#f59e0b',
                    }
                  ]} 
                />
              ))}
            </View>
          </View>

          <TouchableOpacity 
            style={[
              styles.trainButton, 
              { backgroundColor: gnnStatus?.ready_for_update ? '#f59e0b' : '#9ca3af' }
            ]}
            onPress={() => triggerTraining('mule_detector_gnn')}
            disabled={!gnnStatus?.ready_for_update}
          >
            <Ionicons name="play" size={16} color="#FFFFFF" />
            <Text style={styles.trainButtonText}>
              {gnnStatus?.ready_for_update ? 'Trigger Training' : `Need ${(gnnStatus?.min_samples_needed || 100) - (gnnStatus?.buffer_size || 0)} more samples`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Configuration */}
        <Text style={styles.sectionTitle}>RL Configuration</Text>
        <View style={styles.configCard}>
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>Reward Strategy</Text>
            <Text style={styles.configValue}>{config?.reward_strategy || 'shaped'}</Text>
          </View>
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>Update Strategy</Text>
            <Text style={styles.configValue}>{config?.update_strategy || 'batch'}</Text>
          </View>
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>Update Frequency</Text>
            <Text style={styles.configValue}>{config?.update_frequency || 100}</Text>
          </View>
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>Min Samples</Text>
            <Text style={styles.configValue}>{config?.min_samples_for_update || 100}</Text>
          </View>
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>Batch Size</Text>
            <Text style={styles.configValue}>{config?.batch_size || 32}</Text>
          </View>
          <View style={[styles.configRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.configLabel}>Learning Rate</Text>
            <Text style={styles.configValue}>{config?.learning_rate || 0.001}</Text>
          </View>
        </View>

        {/* Reward Weights */}
        <Text style={styles.sectionTitle}>Reward Weights</Text>
        <View style={styles.rewardCard}>
          <View style={styles.rewardRow}>
            <View style={[styles.rewardDot, { backgroundColor: '#22c55e' }]} />
            <Text style={styles.rewardLabel}>Exact Match</Text>
            <Text style={styles.rewardValue}>+{config?.reward_weights.exact_match || 1.0}</Text>
          </View>
          <View style={styles.rewardRow}>
            <View style={[styles.rewardDot, { backgroundColor: '#3b82f6' }]} />
            <Text style={styles.rewardLabel}>Nearby Location</Text>
            <Text style={styles.rewardValue}>+{config?.reward_weights.nearby || 0.7}</Text>
          </View>
          <View style={styles.rewardRow}>
            <View style={[styles.rewardDot, { backgroundColor: '#ef4444' }]} />
            <Text style={styles.rewardLabel}>Different Location</Text>
            <Text style={styles.rewardValue}>{config?.reward_weights.different || -0.5}</Text>
          </View>
          <View style={styles.rewardRow}>
            <View style={[styles.rewardDot, { backgroundColor: '#8b5cf6' }]} />
            <Text style={styles.rewardLabel}>Apprehension</Text>
            <Text style={styles.rewardValue}>+{config?.reward_weights.apprehension || 0.5}</Text>
          </View>
          <View style={[styles.rewardRow, { borderBottomWidth: 0 }]}>
            <View style={[styles.rewardDot, { backgroundColor: '#f59e0b' }]} />
            <Text style={styles.rewardLabel}>Recovery</Text>
            <Text style={styles.rewardValue}>+{config?.reward_weights.recovery || 0.3}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  refreshButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  healthCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  healthGradient: {
    padding: 20,
  },
  healthContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  healthInfo: {
    flex: 1,
  },
  healthStatus: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  healthClients: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: (screenWidth - 56) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
  },
  distributionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  distributionRow: {
    flexDirection: 'row',
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
  },
  distributionBar: {
    height: '100%',
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: '#6b7280',
  },
  modelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  modelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modelIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelInfo: {
    flex: 1,
    marginLeft: 12,
  },
  modelName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  modelDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  metricLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  chartContainer: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  chartTitle: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  miniChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: 60,
  },
  chartBar: {
    flex: 1,
    borderRadius: 4,
    maxWidth: 40,
  },
  trainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  trainButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  configCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  configLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  configValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  rewardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rewardDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  rewardLabel: {
    flex: 1,
    fontSize: 14,
    color: '#6b7280',
  },
  rewardValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
});

