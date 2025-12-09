/**
 * Compliance Dashboard Screen
 * Displays comprehensive compliance status and metrics
 */

import React, { useState, useEffect } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { securityService, ComplianceStatus } from '../api/securityService';
import { useTheme } from '../theme/theme';

export default function ComplianceDashboardScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [complianceStatus, setComplianceStatus] = useState<ComplianceStatus | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const status = await securityService.getComplianceStatus();
      setComplianceStatus(status);
    } catch (error) {
      console.error('Error loading compliance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!complianceStatus) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: theme.colors.background }]}>
        <Ionicons name="alert-circle-outline" size={64} color={theme.colors.textSecondary} />
        <Text style={[styles.errorText, { color: theme.colors.textSecondary }]}>
          Unable to load compliance data
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
          onPress={loadData}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primaryDark || theme.colors.primary]}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Compliance Dashboard</Text>
      </LinearGradient>

      {/* Overall Status Card */}
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.cardHeader}>
          <Ionicons
            name={complianceStatus.overall_compliant ? 'shield-checkmark' : 'shield-outline'}
            size={32}
            color={complianceStatus.overall_compliant ? '#4CAF50' : '#ff9800'}
          />
          <View style={styles.statusContent}>
            <Text style={[styles.statusTitle, { color: theme.colors.text }]}>
              Overall Compliance Status
            </Text>
            <Text
              style={[
                styles.statusValue,
                {
                  color: complianceStatus.overall_compliant ? '#4CAF50' : '#ff9800',
                },
              ]}
            >
              {complianceStatus.overall_compliant ? 'COMPLIANT' : 'NON-COMPLIANT'}
            </Text>
          </View>
        </View>
      </View>

      {/* DPDP Act Compliance */}
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="document-text" size={24} color={theme.colors.primary} />
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
            DPDP Act 2023 Compliance
          </Text>
        </View>
        <View style={styles.complianceBadge}>
          <Text
            style={[
              styles.complianceText,
              {
                color: complianceStatus.dpdp.compliant ? '#4CAF50' : '#e94560',
              },
            ]}
          >
            {complianceStatus.dpdp.compliant ? '✓ COMPLIANT' : '✗ NON-COMPLIANT'}
          </Text>
        </View>
        <View style={styles.checkList}>
          {Object.entries(complianceStatus.dpdp.checks || {}).map(([key, value]) => (
            <View key={key} style={styles.checkItem}>
              <Ionicons
                name={value ? 'checkmark-circle' : 'close-circle'}
                size={20}
                color={value ? '#4CAF50' : '#e94560'}
              />
              <Text style={[styles.checkText, { color: theme.colors.text }]}>
                {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* GDPR Compliance */}
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="globe" size={24} color={theme.colors.primary} />
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
            GDPR Compliance
          </Text>
        </View>
        <View style={styles.complianceBadge}>
          <Text
            style={[
              styles.complianceText,
              {
                color: complianceStatus.gdpr.compliant ? '#4CAF50' : '#e94560',
              },
            ]}
          >
            {complianceStatus.gdpr.compliant ? '✓ COMPLIANT' : '✗ NON-COMPLIANT'}
          </Text>
        </View>
        <View style={styles.checkList}>
          {Object.entries(complianceStatus.gdpr.checks || {}).map(([key, value]) => (
            <View key={key} style={styles.checkItem}>
              <Ionicons
                name={value ? 'checkmark-circle' : 'close-circle'}
                size={20}
                color={value ? '#4CAF50' : '#e94560'}
              />
              <Text style={[styles.checkText, { color: theme.colors.text }]}>
                {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Security Compliance */}
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="shield" size={24} color={theme.colors.primary} />
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
            Security Compliance
          </Text>
        </View>
        <View style={styles.complianceBadge}>
          <Text
            style={[
              styles.complianceText,
              {
                color: complianceStatus.security.compliant ? '#4CAF50' : '#e94560',
              },
            ]}
          >
            {complianceStatus.security.compliant ? '✓ COMPLIANT' : '✗ NON-COMPLIANT'}
          </Text>
        </View>
        <View style={styles.checkList}>
          {Object.entries(complianceStatus.security.checks || {}).map(([key, value]) => (
            <View key={key} style={styles.checkItem}>
              <Ionicons
                name={value ? 'checkmark-circle' : 'close-circle'}
                size={20}
                color={value ? '#4CAF50' : '#e94560'}
              />
              <Text style={[styles.checkText, { color: theme.colors.text }]}>
                {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Compliance Metrics */}
      {complianceStatus.metrics && (
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="stats-chart" size={24} color={theme.colors.primary} />
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              Compliance Metrics
            </Text>
          </View>
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Ionicons name="lock-closed" size={24} color={theme.colors.primary} />
              <Text style={[styles.metricValue, { color: theme.colors.text }]}>
                {complianceStatus.metrics.privacy_budget_usage.toFixed(1)}%
              </Text>
              <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
                Privacy Budget Usage
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Ionicons name="time" size={24} color={theme.colors.primary} />
              <Text style={[styles.metricValue, { color: theme.colors.text }]}>
                {complianceStatus.metrics.data_retention_compliance.toFixed(1)}%
              </Text>
              <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
                Data Retention Compliance
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Ionicons name="warning" size={24} color="#ff9800" />
              <Text style={[styles.metricValue, { color: theme.colors.text }]}>
                {complianceStatus.metrics.access_control_violations}
              </Text>
              <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
                Access Violations
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Ionicons name="trash" size={24} color={theme.colors.primary} />
              <Text style={[styles.metricValue, { color: theme.colors.text }]}>
                {complianceStatus.metrics.data_deletion_requests}
              </Text>
              <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
                Deletion Requests
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Ionicons name="download" size={24} color={theme.colors.primary} />
              <Text style={[styles.metricValue, { color: theme.colors.text }]}>
                {complianceStatus.metrics.data_export_requests}
              </Text>
              <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
                Export Requests
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Ionicons name="alert-circle" size={24} color="#e94560" />
              <Text style={[styles.metricValue, { color: theme.colors.text }]}>
                {complianceStatus.metrics.security_incidents}
              </Text>
              <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
                Security Incidents
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={() => (navigation as any).navigate('AuditLogViewer')}
        >
          <Ionicons name="document-text" size={20} color="#fff" />
          <Text style={styles.buttonText}>View Audit Logs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: (theme.colors as any).secondary || theme.colors.primary }]}
          onPress={async () => {
            try {
              const report = await securityService.getComplianceReport('monthly');
              // In a real app, this would open or download the report
              console.log('Compliance report:', report);
            } catch (error) {
              console.error('Error fetching report:', error);
            }
          }}
        >
          <Ionicons name="download" size={20} color="#fff" />
          <Text style={styles.buttonText}>Download Report</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  card: {
    margin: 15,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusContent: {
    flex: 1,
    marginLeft: 10,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  complianceBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginBottom: 15,
  },
  complianceText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkList: {
    marginTop: 10,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  checkText: {
    fontSize: 14,
    flex: 1,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  metricCard: {
    width: '48%',
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    margin: 15,
    marginBottom: 30,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

