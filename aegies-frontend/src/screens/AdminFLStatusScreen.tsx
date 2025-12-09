/**
 * Admin Federated Learning Status Screen
 * Monitors FL training progress, clients, and model versions
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
import { 
  federatedLearningService, 
  HealthCheckResponse, 
  FLConfig, 
  Client, 
  TrainingProgress 
} from '../api';

export default function AdminFLStatusScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // State for FL data
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [config, setConfig] = useState<FLConfig | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [cstProgress, setCstProgress] = useState<TrainingProgress | null>(null);
  const [gnnProgress, setGnnProgress] = useState<TrainingProgress | null>(null);
  
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
      const [healthResult, configResult, clientsResult, cstResult, gnnResult] = await Promise.all([
        federatedLearningService.healthCheck(),
        federatedLearningService.getConfig(),
        federatedLearningService.listClients(),
        federatedLearningService.getTrainingProgress('cst_transformer'),
        federatedLearningService.getTrainingProgress('mule_detector_gnn'),
      ]);

      if (healthResult.success) setHealth(healthResult.data || null);
      if (configResult.success) setConfig(configResult.data || null);
      if (clientsResult.success) setClients(clientsResult.data?.clients || []);
      if (cstResult.success) setCstProgress(cstResult.data || null);
      if (gnnResult.success) setGnnProgress(gnnResult.data || null);
    } catch (error) {
      console.error('Error loading FL data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const startTrainingRound = async (modelType: 'cst_transformer' | 'mule_detector_gnn') => {
    try {
      const result = await federatedLearningService.startTrainingRound({
        model_type: modelType,
      });
      if (result.success) {
        alert(`Training round ${result.data?.round_number} started for ${modelType}`);
        loadData();
      }
    } catch (error) {
      console.error('Error starting training round:', error);
      alert('Failed to start training round');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text style={styles.loadingText}>Loading FL Status...</Text>
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
        <Text style={styles.headerTitle}>Federated Learning</Text>
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
            tintColor="#8b5cf6"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Health Status Card */}
        <View style={styles.healthCard}>
          <LinearGradient
            colors={health?.status === 'healthy' ? ['#22c55e', '#16a34a'] : ['#ef4444', '#dc2626']}
            style={styles.healthGradient}
          >
            <View style={styles.healthContent}>
              <Ionicons 
                name={health?.status === 'healthy' ? 'checkmark-circle' : 'alert-circle'} 
                size={48} 
                color="#FFFFFF" 
              />
              <View style={styles.healthInfo}>
                <Text style={styles.healthStatus}>
                  {health?.status === 'healthy' ? 'System Healthy' : 'System Error'}
                </Text>
                <Text style={styles.healthClients}>
                  {health?.registered_clients || 0} Banks Connected
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Model Progress Cards */}
        <Text style={styles.sectionTitle}>Model Training Progress</Text>
        
        {/* CST Transformer */}
        <View style={styles.modelCard}>
          <View style={styles.modelHeader}>
            <View style={styles.modelIcon}>
              <Ionicons name="location" size={20} color="#3b82f6" />
            </View>
            <View style={styles.modelInfo}>
              <Text style={styles.modelName}>CST Transformer</Text>
              <Text style={styles.modelDescription}>Location Prediction Model</Text>
            </View>
            <View style={styles.modelVersion}>
              <Text style={styles.versionLabel}>Round</Text>
              <Text style={styles.versionValue}>{cstProgress?.current_round || 0}</Text>
            </View>
          </View>
          
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${cstProgress?.progress_percent || 0}%`,
                    backgroundColor: '#3b82f6' 
                  }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {cstProgress?.progress_percent?.toFixed(1) || 0}%
            </Text>
          </View>

          <View style={styles.modelStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{cstProgress?.target_rounds || 50}</Text>
              <Text style={styles.statLabel}>Target Rounds</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {cstProgress?.history?.[cstProgress.history.length - 1]?.avg_loss?.toFixed(2) || 'N/A'}
              </Text>
              <Text style={styles.statLabel}>Latest Loss</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{health?.current_rounds?.cst_transformer || 0}</Text>
              <Text style={styles.statLabel}>Total Rounds</Text>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.trainButton, { backgroundColor: '#3b82f6' }]}
            onPress={() => startTrainingRound('cst_transformer')}
          >
            <Ionicons name="play" size={16} color="#FFFFFF" />
            <Text style={styles.trainButtonText}>Start New Round</Text>
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
              <Text style={styles.modelDescription}>Mule Account Detection</Text>
            </View>
            <View style={styles.modelVersion}>
              <Text style={styles.versionLabel}>Round</Text>
              <Text style={styles.versionValue}>{gnnProgress?.current_round || 0}</Text>
            </View>
          </View>
          
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${gnnProgress?.progress_percent || 0}%`,
                    backgroundColor: '#f59e0b' 
                  }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {gnnProgress?.progress_percent?.toFixed(1) || 0}%
            </Text>
          </View>

          <View style={styles.modelStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{gnnProgress?.target_rounds || 50}</Text>
              <Text style={styles.statLabel}>Target Rounds</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {gnnProgress?.history?.[gnnProgress.history.length - 1]?.avg_loss?.toFixed(2) || 'N/A'}
              </Text>
              <Text style={styles.statLabel}>Latest Loss</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{health?.current_rounds?.mule_detector_gnn || 0}</Text>
              <Text style={styles.statLabel}>Total Rounds</Text>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.trainButton, { backgroundColor: '#f59e0b' }]}
            onPress={() => startTrainingRound('mule_detector_gnn')}
          >
            <Ionicons name="play" size={16} color="#FFFFFF" />
            <Text style={styles.trainButtonText}>Start New Round</Text>
          </TouchableOpacity>
        </View>

        {/* Connected Banks */}
        <Text style={styles.sectionTitle}>Connected Bank Clients</Text>
        <View style={styles.clientsCard}>
          {clients.length > 0 ? (
            clients.map((client, index) => (
              <View 
                key={client.client_id} 
                style={[
                  styles.clientItem,
                  index < clients.length - 1 && styles.clientItemBorder
                ]}
              >
                <View style={styles.clientIcon}>
                  <Ionicons name="business" size={20} color="#8b5cf6" />
                </View>
                <View style={styles.clientInfo}>
                  <Text style={styles.clientName}>{client.client_id.toUpperCase()}</Text>
                  <Text style={styles.clientDate}>
                    Connected: {new Date(client.registered_at).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.clientStatus}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Active</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyClients}>
              <Ionicons name="business-outline" size={32} color="#9ca3af" />
              <Text style={styles.emptyText}>No clients registered</Text>
            </View>
          )}
        </View>

        {/* Configuration */}
        <Text style={styles.sectionTitle}>Configuration</Text>
        <View style={styles.configCard}>
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>Aggregation Strategy</Text>
            <Text style={styles.configValue}>{config?.aggregation_strategy || 'fedavg'}</Text>
          </View>
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>Clients Per Round</Text>
            <Text style={styles.configValue}>{config?.clients_per_round || 3}</Text>
          </View>
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>Local Epochs</Text>
            <Text style={styles.configValue}>{config?.local_epochs || 3}</Text>
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
  modelVersion: {
    alignItems: 'flex-end',
  },
  versionLabel: {
    fontSize: 10,
    color: '#9ca3af',
  },
  versionValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    width: 48,
    textAlign: 'right',
  },
  modelStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
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
  clientsCard: {
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
  clientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  clientItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  clientIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientInfo: {
    flex: 1,
    marginLeft: 12,
  },
  clientName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  clientDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  clientStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  statusText: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '500',
  },
  emptyClients: {
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
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
});

