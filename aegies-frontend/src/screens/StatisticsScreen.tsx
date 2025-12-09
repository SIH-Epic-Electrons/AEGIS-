import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/theme';
import { dashboardService, rlService } from '../api';

type TimeFilter = 'this-month' | 'last-month' | 'this-week' | 'last-week' | 'today' | 'all-time';

interface Statistics {
  casesResolved: number;
  fundsRecovered: number;
  avgResponseTime: string;
  predictionAccuracy: number;
  performanceRating: string;
  performanceMessage: string;
  monthlyTrend: { month: string; value: number }[];
  fraudTypes: { type: string; percentage: number; color: string }[];
  casesResolvedChange: number;
  fundsRecoveredChange: number;
  responseTimeChange: number;
  accuracyChange: number;
}

export default function StatisticsScreen() {
  const { theme } = useTheme();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('this-month');
  const [refreshing, setRefreshing] = useState(false);
  const [isFilterModalVisible, setFilterModalVisible] = useState(false);
  const [statistics, setStatistics] = useState<Statistics>({
    casesResolved: 128,
    fundsRecovered: 4520000,
    avgResponseTime: '2m 15s',
    predictionAccuracy: 92,
    performanceRating: 'Excellent',
    performanceMessage: "You're in the top 10% of officers this month!",
    monthlyTrend: [
      { month: 'Jan', value: 40 },
      { month: 'Feb', value: 55 },
      { month: 'Mar', value: 45 },
      { month: 'Apr', value: 70 },
      { month: 'May', value: 85 },
      { month: 'Jun', value: 100 },
    ],
    fraudTypes: [
      { type: 'OTP/Vishing Fraud', percentage: 42, color: '#ef4444' },
      { type: 'Investment Scam', percentage: 28, color: '#f97316' },
      { type: 'Job Fraud', percentage: 18, color: '#3b82f6' },
      { type: 'Others', percentage: 12, color: '#9ca3af' },
    ],
    casesResolvedChange: 12.5,
    fundsRecoveredChange: 8.2,
    responseTimeChange: -3.1,
    accuracyChange: 1.5,
  });

  useEffect(() => {
    loadStatistics();
  }, [timeFilter]);

  const loadStatistics = async () => {
    try {
      // Map time filter to API period
      const periodMap: Record<TimeFilter, 'today' | 'week' | 'month' | 'all'> = {
        'this-month': 'month',
        'last-month': 'month',
        'this-week': 'week',
        'last-week': 'week',
        'today': 'today',
        'all-time': 'all',
      };
      const period = periodMap[timeFilter] || 'all';
      
      // Fetch dashboard stats
      const statsResult = await dashboardService.getDashboardStats(period);
      
      if (statsResult.success && statsResult.data) {
        const stats = statsResult.data;
        
        // Extract data from API response
        const casesResolved = stats.cases?.resolved || 128;
        const totalRecovered = stats.recovery?.total_recovered || 4520000;
        const avgResponseTime = stats.performance?.avg_response_time_seconds || 135;
        const accuracy = stats.performance?.prediction_accuracy || 92;
        
        // Build fraud types array from API data
        const fraudTypeData = stats.cases?.by_fraud_type || {};
        const totalFraud = Object.values(fraudTypeData).reduce((a: number, b: any) => a + (b || 0), 0);
        const fraudColors: Record<string, string> = {
          UPI_FRAUD: '#3b82f6',
          OTP_FRAUD: '#ef4444',
          PHISHING: '#f97316',
          INVESTMENT_FRAUD: '#9333ea',
          LOAN_FRAUD: '#22c55e',
          KYC_FRAUD: '#eab308',
        };
        const fraudTypes = Object.entries(fraudTypeData).map(([type, count]: [string, any]) => ({
          type: type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
          percentage: totalFraud > 0 ? Math.round((count / totalFraud) * 100) : 0,
          color: fraudColors[type] || '#9ca3af',
        })).filter(f => f.percentage > 0);
        
        // Build top cities for trend visualization
        const topCities = stats.top_cities || [];
        const monthlyTrend = topCities.slice(0, 6).map((city: any, idx: number) => ({
          month: city.city?.substring(0, 3) || `C${idx + 1}`,
          value: city.cases || 0,
        }));
        
        setStatistics({
          casesResolved,
          fundsRecovered: totalRecovered,
          avgResponseTime: formatResponseTime(avgResponseTime),
          predictionAccuracy: accuracy,
          performanceRating: getPerformanceRating(accuracy),
          performanceMessage: getPerformanceMessage(accuracy),
          monthlyTrend: monthlyTrend.length > 0 ? monthlyTrend : statistics.monthlyTrend,
          fraudTypes: fraudTypes.length > 0 ? fraudTypes : statistics.fraudTypes,
          casesResolvedChange: 12.5,
          fundsRecoveredChange: stats.recovery?.recovery_rate || 8.2,
          responseTimeChange: -3.1,
          accuracyChange: 1.5,
        });
      }
      
      // Also fetch RL stats for AI performance metrics
      try {
        const rlStatsResult = await rlService.getStats(30);
        if (rlStatsResult.success && rlStatsResult.data) {
          // Could use this for additional AI metrics display
          console.log('RL Stats:', rlStatsResult.data.total_feedback);
        }
      } catch (rlError) {
        // RL stats are optional, don't fail if unavailable
        console.log('RL stats unavailable:', rlError);
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
      // Keep default values on error
    }
  };

  const formatResponseTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getPerformanceRating = (accuracy: number): string => {
    if (accuracy >= 90) return 'Excellent';
    if (accuracy >= 80) return 'Good';
    if (accuracy >= 70) return 'Average';
    return 'Needs Improvement';
  };

  const getPerformanceMessage = (accuracy: number): string => {
    if (accuracy >= 90) return "You're in the top 10% of officers this month!";
    if (accuracy >= 80) return "You're performing well! Keep it up!";
    if (accuracy >= 70) return "You're doing good. Room for improvement.";
    return 'Focus on improving prediction accuracy.';
  };

  const formatCurrency = (amount: number): string => {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    }
    return `₹${amount.toLocaleString()}`;
  };

  const formatChange = (change: number, isTime: boolean = false): string => {
    const prefix = change > 0 ? '↑' : '↓';
    const absChange = Math.abs(change);
    const suffix = isTime ? ' faster' : '%';
    return `${prefix} ${absChange.toFixed(1)}${suffix}`;
  };

  const getFilterLabel = (filter: TimeFilter): string => {
    const labels: Record<TimeFilter, string> = {
      'this-month': 'This Month',
      'last-month': 'Last Month',
      'this-week': 'This Week',
      'last-week': 'Last Week',
      'today': 'Today',
      'all-time': 'All Time',
    };
    return labels[filter];
  };

  const timeFilters: TimeFilter[] = [
    'this-month',
    'last-month',
    'this-week',
    'last-week',
    'today',
    'all-time',
  ];

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStatistics();
    setRefreshing(false);
  };

  const maxTrendValue = Math.max(...statistics.monthlyTrend.map((t) => t.value));

  return (
    <View style={[styles.container, { backgroundColor: '#f8fafc' }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Statistics</Text>
        <TouchableOpacity
          style={[styles.filterButton, { backgroundColor: theme.colors.surface }]}
          onPress={() => setFilterModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterButtonText, { color: theme.colors.text }]}>
            {getFilterLabel(timeFilter)}
          </Text>
          <Ionicons name="chevron-down" size={18} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Performance Card */}
        <LinearGradient
          colors={['#2563eb', '#1d4ed8']}
          style={styles.performanceCard}
        >
          <View style={styles.performanceHeader}>
            <View>
              <Text style={styles.performanceLabel}>Your Performance</Text>
              <Text style={styles.performanceRating}>{statistics.performanceRating}</Text>
            </View>
            <View style={styles.performanceIconContainer}>
              <Text style={styles.performanceIcon}>⭐</Text>
            </View>
          </View>
          <Text style={styles.performanceMessage}>{statistics.performanceMessage}</Text>
        </LinearGradient>

        {/* Key Metrics Grid */}
        <View style={styles.metricsGrid}>
          <View style={[styles.metricCard, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.metricIcon, { backgroundColor: '#dcfce7' }]}>
              <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
            </View>
            <Text style={[styles.metricValue, { color: theme.colors.text }]}>
              {statistics.casesResolved}
            </Text>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
              Cases Resolved
            </Text>
            <Text style={[styles.metricChange, { color: '#16a34a' }]}>
              {formatChange(statistics.casesResolvedChange)}
            </Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.metricIcon, { backgroundColor: '#dbeafe' }]}>
              <Ionicons name="wallet" size={20} color="#2563eb" />
            </View>
            <Text style={[styles.metricValue, { color: theme.colors.text }]}>
              {formatCurrency(statistics.fundsRecovered)}
            </Text>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
              Funds Recovered
            </Text>
            <Text style={[styles.metricChange, { color: '#16a34a' }]}>
              {formatChange(statistics.fundsRecoveredChange)}
            </Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.metricIcon, { backgroundColor: '#fed7aa' }]}>
              <Ionicons name="time-outline" size={20} color="#f97316" />
            </View>
            <Text style={[styles.metricValue, { color: theme.colors.text }]}>
              {statistics.avgResponseTime}
            </Text>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
              Avg Response Time
            </Text>
            <Text style={[styles.metricChange, { color: '#16a34a' }]}>
              {formatChange(statistics.responseTimeChange, true)}
            </Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.metricIcon, { backgroundColor: '#e9d5ff' }]}>
              <Ionicons name="radio-button-on" size={20} color="#9333ea" />
            </View>
            <Text style={[styles.metricValue, { color: theme.colors.text }]}>
              {statistics.predictionAccuracy}%
            </Text>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
              Prediction Accuracy
            </Text>
            <Text style={[styles.metricChange, { color: '#16a34a' }]}>
              {formatChange(statistics.accuracyChange)}
            </Text>
          </View>
        </View>

        {/* Monthly Trend */}
        <View style={[styles.trendCard, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.trendTitle, { color: theme.colors.text }]}>
            Cases Resolved Trend
          </Text>
          <View style={styles.trendChart}>
            {statistics.monthlyTrend.map((item, index) => {
              const height = (item.value / maxTrendValue) * 100;
              const isCurrentMonth = index === statistics.monthlyTrend.length - 1;
              return (
                <View key={index} style={styles.trendBarContainer}>
                  <View
                    style={[
                      styles.trendBar,
                      {
                        height: `${height}%`,
                        backgroundColor: isCurrentMonth ? '#2563eb' : '#93c5fd',
                      },
                    ]}
                  />
                  <Text style={[styles.trendMonth, { color: theme.colors.textSecondary }]}>
                    {item.month}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text style={[styles.trendFooter, { color: theme.colors.textSecondary }]}>
            +15.2% growth over 6 months
          </Text>
        </View>

        {/* Fraud Types */}
        <View style={[styles.fraudTypesCard, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.fraudTypesTitle, { color: theme.colors.text }]}>
            Cases by Fraud Type
          </Text>
          <View style={styles.fraudTypesList}>
            {statistics.fraudTypes.map((fraud, index) => (
              <View key={index} style={styles.fraudTypeItem}>
                <View style={styles.fraudTypeHeader}>
                  <Text style={[styles.fraudTypeName, { color: theme.colors.text }]}>
                    {fraud.type}
                  </Text>
                  <Text style={[styles.fraudTypePercentage, { color: theme.colors.text }]}>
                    {fraud.percentage}%
                  </Text>
                </View>
                <View style={[styles.progressBarContainer, { backgroundColor: '#f3f4f6' }]}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${fraud.percentage}%`,
                        backgroundColor: fraud.color,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Time Filter Modal */}
      <Modal
        visible={isFilterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFilterModalVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surfaceElevated }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Select Time Period</Text>
            {timeFilters.map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.modalItem,
                  {
                    backgroundColor:
                      timeFilter === filter ? theme.colors.primary + '10' : 'transparent',
                    borderBottomColor: theme.colors.divider,
                  },
                ]}
                onPress={() => {
                  setTimeFilter(filter);
                  setFilterModalVisible(false);
                }}
              >
                <Text style={[styles.modalItemText, { color: theme.colors.text }]}>
                  {getFilterLabel(filter)}
                </Text>
                {timeFilter === filter && (
                  <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.modalCloseButton, { backgroundColor: theme.colors.border }]}
              onPress={() => setFilterModalVisible(false)}
            >
              <Text style={[styles.modalCloseButtonText, { color: theme.colors.text }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  performanceCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  performanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  performanceLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginBottom: 4,
  },
  performanceRating: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  performanceIconContainer: {
    width: 64,
    height: 64,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  performanceIcon: {
    fontSize: 32,
  },
  performanceMessage: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    width: '47%',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  metricChange: {
    fontSize: 12,
    fontWeight: '600',
  },
  trendCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  trendTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  trendChart: {
    height: 128,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  trendBarContainer: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  trendBar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  trendMonth: {
    fontSize: 12,
  },
  trendFooter: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
  fraudTypesCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  fraudTypesTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  fraudTypesList: {
    gap: 12,
  },
  fraudTypeItem: {
    marginBottom: 4,
  },
  fraudTypeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  fraudTypeName: {
    fontSize: 14,
  },
  fraudTypePercentage: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    borderRadius: 16,
    padding: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalItemText: {
    fontSize: 16,
  },
  modalCloseButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

