import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { caseService, CaseListItem } from '../api';
import { useTheme } from '../theme/theme';

interface Alert {
  id: string;
  caseId: string;
  caseNumber: string;
  title: string;
  subtitle: string;
  amount: number;
  confidence: number;
  timeRemaining: string;
  priority: 'critical' | 'urgent' | 'pending';
  status: string;
  fraudType: string;
}

// Fraud type display names
const FRAUD_TYPES: Record<string, string> = {
  'UPI_FRAUD': 'UPI Fraud',
  'OTP_FRAUD': 'OTP Fraud',
  'PHISHING': 'Phishing Scam',
  'INVESTMENT_FRAUD': 'Investment Fraud',
  'LOAN_FRAUD': 'Loan App Fraud',
  'KYC_FRAUD': 'Job/KYC Fraud',
};

export default function AlertsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'critical' | 'urgent' | 'pending' | 'resolved'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0,
    hasMore: false,
  });

  // Reload data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadAlerts();
    }, [activeFilter])
  );

  useEffect(() => {
    loadAlerts();
  }, [activeFilter]);

  const mapPriorityToFilter = (priority: string): 'critical' | 'urgent' | 'pending' => {
    switch (priority) {
      case 'CRITICAL':
        return 'critical';
      case 'HIGH':
        return 'urgent';
      case 'MEDIUM':
      case 'LOW':
      default:
        return 'pending';
    }
  };

  const mapFilterToPriority = (filter: string): string | undefined => {
    switch (filter) {
      case 'critical':
        return 'CRITICAL';
      case 'urgent':
        return 'HIGH';
      case 'pending':
        return 'MEDIUM';
      default:
        return undefined;
    }
  };

  const calculateTimeRemaining = (createdAt: string): string => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    // Assume golden hour (60 mins) - show remaining time
    const remainingMins = Math.max(60 - diffMins, 0);
    const hours = Math.floor(remainingMins / 60);
    const mins = remainingMins % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  const loadAlerts = async () => {
    try {
      setLoading(true);
      
      // Build query params based on filter
      const params: any = {
        limit: 50, // Increased to show more cases
        offset: 0,
      };
      
      // Map filter to API status/priority
      if (activeFilter === 'resolved') {
        params.status = 'RESOLVED';
      } else if (activeFilter === 'all') {
        // Show all active cases (exclude resolved/closed)
        // Backend will sort by priority score automatically
        // No status filter = all active statuses
      } else {
        // For specific priority filters, filter by priority
        const priorityFilter = mapFilterToPriority(activeFilter);
        if (priorityFilter) {
          params.priority = priorityFilter;
        }
        // Don't filter by status - show all active cases with that priority
        // Backend will sort by priority score automatically
      }
      
      const result = await caseService.listCases(params);
      
      if (result.success && result.data) {
        const mappedAlerts: Alert[] = result.data.cases.map((c: CaseListItem) => ({
          id: c.case_id,
          caseId: c.case_id,
          caseNumber: `Case #${c.case_number}`,
          title: `${FRAUD_TYPES[c.fraud_type] || c.fraud_type} - ${c.victim_city || 'Unknown'}`,
          subtitle: `Case #${c.case_number} • Victim: ${c.victim_name || 'Unknown'}`,
          amount: c.fraud_amount || 0,
          confidence: Math.round((c.location_confidence || 0) * 100),
          timeRemaining: calculateTimeRemaining(c.created_at),
          priority: mapPriorityToFilter(c.priority),
          status: c.status,
          fraudType: c.fraud_type,
        }));
        
        setAlerts(mappedAlerts);
        setPagination({
          total: result.data.pagination.total,
          limit: result.data.pagination.limit,
          offset: result.data.pagination.offset,
          hasMore: result.data.pagination.has_more,
        });
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAlerts();
    setRefreshing(false);
  };

  const handleAlertPress = (alert: Alert) => {
    // Navigate using parent Stack Navigator
    const parent = navigation.getParent();
    // @ts-ignore - React Navigation type inference limitation
    const nav = parent || navigation;
    // @ts-ignore - React Navigation type inference limitation
    nav.navigate('CaseDetail' as never, { 
      caseId: alert.caseId,
      alertId: alert.id, 
      alert 
    } as never);
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

  const getFilteredAlerts = () => {
    // Since we filter on the API, just return all alerts
    return alerts;
  };

  const getFilterCount = (filter: string) => {
    // Return count based on current filter or pagination total
    if (filter === activeFilter) {
      return pagination.total;
    }
    // For other filters, just show dash or fetch count
    return '-';
  };

  const renderAlert = ({ item }: { item: Alert }) => {
    const isCritical = item.priority === 'critical';
    const borderColor = isCritical ? '#ef4444' : '#f59e0b';
    
    return (
      <TouchableOpacity
        style={[styles.alertCard, { borderLeftColor: borderColor }]}
        onPress={() => handleAlertPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.alertHeader}>
          <View style={[styles.priorityBadge, { backgroundColor: isCritical ? '#fee2e2' : '#fef3c7' }]}>
            <Text style={[styles.priorityBadgeText, { color: isCritical ? '#dc2626' : '#d97706' }]}>
              {item.priority.toUpperCase()}
            </Text>
          </View>
          <View style={styles.timerContainer}>
            <Ionicons name="time-outline" size={16} color={isCritical ? '#ef4444' : '#f59e0b'} />
            <Text style={[styles.timerText, { color: isCritical ? '#ef4444' : '#f59e0b' }]}>
              {item.timeRemaining || 'N/A'}
            </Text>
          </View>
        </View>
        <Text style={styles.alertTitle}>{item.title}</Text>
        <Text style={styles.alertSubtitle}>{item.subtitle}</Text>
        <View style={styles.alertFooter}>
          <View style={styles.alertInfo}>
            <Text style={styles.alertAmount}>{formatCurrency(item.amount)}</Text>
            <Text style={styles.alertDivider}>•</Text>
            <Text style={styles.alertConfidence}>{item.confidence || 0}% confidence</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: '#f8fafc' }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#FFFFFF' }]}>
        <Text style={styles.headerTitle}>Active Alerts</Text>
        
        {/* Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          <TouchableOpacity
            style={[
              styles.filterTab,
              activeFilter === 'all' && styles.filterTabActive,
              { backgroundColor: activeFilter === 'all' ? '#dbeafe' : '#f3f4f6' },
            ]}
            onPress={() => setActiveFilter('all')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="list"
              size={16}
              color={activeFilter === 'all' ? '#2563eb' : '#6b7280'}
            />
            <Text
              style={[
                styles.filterText,
                { color: activeFilter === 'all' ? '#2563eb' : '#4b5563' },
                activeFilter === 'all' && styles.filterTextActive,
              ]}
            >
              All ({getFilterCount('all')})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterTab,
              activeFilter === 'critical' && styles.filterTabActive,
              { backgroundColor: activeFilter === 'critical' ? '#fee2e2' : '#f3f4f6' },
            ]}
            onPress={() => setActiveFilter('critical')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="alert-circle"
              size={16}
              color={activeFilter === 'critical' ? '#dc2626' : '#6b7280'}
            />
            <Text
              style={[
                styles.filterText,
                { color: activeFilter === 'critical' ? '#dc2626' : '#4b5563' },
                activeFilter === 'critical' && styles.filterTextActive,
              ]}
            >
              Critical ({getFilterCount('critical')})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterTab,
              activeFilter === 'urgent' && styles.filterTabActive,
              { backgroundColor: activeFilter === 'urgent' ? '#fef3c7' : '#f3f4f6' },
            ]}
            onPress={() => setActiveFilter('urgent')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="warning"
              size={16}
              color={activeFilter === 'urgent' ? '#d97706' : '#6b7280'}
            />
            <Text
              style={[
                styles.filterText,
                { color: activeFilter === 'urgent' ? '#d97706' : '#4b5563' },
                activeFilter === 'urgent' && styles.filterTextActive,
              ]}
            >
              Urgent ({getFilterCount('urgent')})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterTab,
              activeFilter === 'pending' && styles.filterTabActive,
              { backgroundColor: activeFilter === 'pending' ? '#f3f4f6' : '#f3f4f6' },
            ]}
            onPress={() => setActiveFilter('pending')}
            activeOpacity={0.7}
          >
            <Ionicons name="time-outline" size={16} color="#6b7280" />
            <Text style={styles.filterText}>Pending ({getFilterCount('pending')})</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterTab,
              activeFilter === 'resolved' && styles.filterTabActive,
              { backgroundColor: activeFilter === 'resolved' ? '#f3f4f6' : '#f3f4f6' },
            ]}
            onPress={() => setActiveFilter('resolved')}
            activeOpacity={0.7}
          >
            <Ionicons name="checkmark-circle-outline" size={16} color="#6b7280" />
            <Text style={styles.filterText}>Resolved</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Alert List */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading cases...</Text>
        </View>
      ) : (
        <FlatList
          data={getFilteredAlerts()}
          renderItem={renderAlert}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#3b82f6"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="shield-outline" size={64} color="#9ca3af" />
              <Text style={styles.emptyStateText}>No {activeFilter} alerts</Text>
              <Text style={styles.emptyStateSubtext}>
                Alerts will appear here when threats are detected
              </Text>
            </View>
          }
        />
      )}

      {/* Floating Map Button */}
      <TouchableOpacity
        style={styles.mapButton}
        onPress={() => navigation.navigate('Map' as never)}
        activeOpacity={0.8}
      >
        <Ionicons name="map" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterTabActive: {
    borderWidth: 1,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4b5563',
  },
  filterTextActive: {
    fontWeight: '700',
  },
  list: {
    padding: 20,
    paddingBottom: 100,
  },
  alertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '700',
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  alertSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  alertDivider: {
    fontSize: 14,
    color: '#9ca3af',
  },
  alertConfidence: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3b82f6',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    marginTop: 100,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6b7280',
  },
  mapButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
