/**
 * Security Dashboard Screen
 * Displays comprehensive security and compliance status
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
import { securityService, SecurityStatus, ComplianceStatus } from '../api/securityService';
import { useTheme } from '../theme/theme';

export default function SecurityDashboardScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus | null>(null);
  const [complianceStatus, setComplianceStatus] = useState<ComplianceStatus | null>(null);
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [security, compliance, events] = await Promise.all([
        securityService.getSecurityStatus(),
        securityService.getComplianceStatus(),
        securityService.getSecurityEvents(20).catch(() => ({ events: [] })),
      ]);
      setSecurityStatus(security);
      setComplianceStatus(compliance);
      setSecurityEvents(events.events || []);
    } catch (error) {
      console.error('Error loading security data:', error);
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
        <Text style={styles.headerTitle}>Security & Compliance</Text>
      </LinearGradient>

      {/* Compliance Status Card */}
      {complianceStatus && (
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.cardHeader}>
            <Ionicons
              name={complianceStatus.overall_compliant ? 'shield-checkmark' : 'shield-outline'}
              size={24}
              color={complianceStatus.overall_compliant ? '#4CAF50' : '#ff9800'}
            />
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              Compliance Status
            </Text>
          </View>
          <View style={styles.statusBadge}>
            <Text
              style={[
                styles.statusText,
                {
                  color: complianceStatus.overall_compliant ? '#4CAF50' : '#ff9800',
                },
              ]}
            >
              {complianceStatus.overall_compliant ? 'COMPLIANT' : 'NON-COMPLIANT'}
            </Text>
          </View>

          {/* DPDP Compliance */}
          <View style={styles.complianceSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              DPDP Act 2023
            </Text>
            <View style={styles.checkList}>
              {Object.entries(complianceStatus.dpdp.checks || {}).map(([key, value]) => (
                <View key={key} style={styles.checkItem}>
                  <Ionicons
                    name={value ? 'checkmark-circle' : 'close-circle'}
                    size={20}
                    color={value ? '#4CAF50' : '#e94560'}
                  />
                  <Text style={[styles.checkText, { color: theme.colors.text }]}>
                    {key.replace(/_/g, ' ').toUpperCase()}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* GDPR Compliance */}
          <View style={styles.complianceSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              GDPR Compliance
            </Text>
            <View style={styles.checkList}>
              {Object.entries(complianceStatus.gdpr.checks || {}).map(([key, value]) => (
                <View key={key} style={styles.checkItem}>
                  <Ionicons
                    name={value ? 'checkmark-circle' : 'close-circle'}
                    size={20}
                    color={value ? '#4CAF50' : '#e94560'}
                  />
                  <Text style={[styles.checkText, { color: theme.colors.text }]}>
                    {key.replace(/_/g, ' ').toUpperCase()}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Privacy Budget Card */}
      {securityStatus?.privacy_budget && (
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="lock-closed" size={24} color={theme.colors.primary} />
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              Privacy Budget
            </Text>
          </View>
          <View style={styles.budgetContainer}>
            <View style={styles.budgetItem}>
              <Text style={[styles.budgetLabel, { color: theme.colors.textSecondary }]}>
                Global Budget
              </Text>
              <Text style={[styles.budgetValue, { color: theme.colors.text }]}>
                {securityStatus.privacy_budget.global_remaining.toFixed(2)} /{' '}
                {securityStatus.privacy_budget.global_total.toFixed(2)} ε
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${
                        (securityStatus.privacy_budget.global_remaining /
                          securityStatus.privacy_budget.global_total) *
                        100
                      }%`,
                      backgroundColor: theme.colors.primary,
                    },
                  ]}
                />
              </View>
            </View>
            {securityStatus.privacy_budget.user_remaining !== undefined && (
              <View style={styles.budgetItem}>
                <Text style={[styles.budgetLabel, { color: theme.colors.textSecondary }]}>
                  User Budget
                </Text>
                <Text style={[styles.budgetValue, { color: theme.colors.text }]}>
                  {securityStatus.privacy_budget.user_remaining.toFixed(2)} /{' '}
                  {securityStatus.privacy_budget.user_total?.toFixed(2)} ε
                </Text>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${
                          (securityStatus.privacy_budget.user_remaining /
                            (securityStatus.privacy_budget.user_total || 1)) *
                          100
                        }%`,
                        backgroundColor: theme.colors.primary,
                      },
                    ]}
                  />
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Rate Limiting Status */}
      {securityStatus?.rate_limiting && (
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="speedometer" size={24} color={theme.colors.primary} />
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              Rate Limiting
            </Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
              User Remaining:
            </Text>
            <Text style={[styles.metricValue, { color: theme.colors.text }]}>
              {securityStatus.rate_limiting.user_remaining ?? 'N/A'}
            </Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
              IP Remaining:
            </Text>
            <Text style={[styles.metricValue, { color: theme.colors.text }]}>
              {securityStatus.rate_limiting.ip_remaining ?? 'N/A'}
            </Text>
          </View>
        </View>
      )}

      {/* DDoS Protection Status */}
      {securityStatus?.ddos_protection && (
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="shield" size={24} color={theme.colors.primary} />
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              DDoS Protection
            </Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
              Reputation Score:
            </Text>
            <Text style={[styles.metricValue, { color: theme.colors.text }]}>
              {securityStatus.ddos_protection.reputation_score.toFixed(2)}
            </Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
              Status:
            </Text>
            <Text
              style={[
                styles.metricValue,
                {
                  color: securityStatus.ddos_protection.is_blacklisted
                    ? '#e94560'
                    : '#4CAF50',
                },
              ]}
            >
              {securityStatus.ddos_protection.is_blacklisted ? 'BLOCKED' : 'ALLOWED'}
            </Text>
          </View>
        </View>
      )}

      {/* Security Monitoring Alerts */}
      {securityEvents.length > 0 && (
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="warning" size={24} color="#ff9800" />
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              Recent Security Events
            </Text>
          </View>
          {securityEvents.slice(0, 5).map((event, index) => (
            <View
              key={index}
              style={[
                styles.eventItem,
                {
                  borderBottomColor: theme.colors.border,
                  borderBottomWidth: index < securityEvents.slice(0, 5).length - 1 ? 1 : 0,
                },
              ]}
            >
              <View style={styles.eventHeader}>
                <Ionicons
                  name={
                    event.severity === 'critical' || event.severity === 'high'
                      ? 'alert-circle'
                      : event.severity === 'medium'
                      ? 'warning'
                      : 'information-circle'
                  }
                  size={18}
                  color={
                    event.severity === 'critical' || event.severity === 'high'
                      ? '#e94560'
                      : event.severity === 'medium'
                      ? '#ff9800'
                      : theme.colors.primary
                  }
                />
                <View style={styles.eventContent}>
                  <Text style={[styles.eventTitle, { color: theme.colors.text }]}>
                    {event.event_type || 'Security Event'}
                  </Text>
                  <Text style={[styles.eventTime, { color: theme.colors.textSecondary }]}>
                    {event.timestamp
                      ? (() => {
                          try {
                            const date = new Date(event.timestamp);
                            if (isNaN(date.getTime())) return 'Invalid time';
                            return date.toLocaleString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            });
                          } catch (error) {
                            return 'Invalid time';
                          }
                        })()
                      : 'Unknown time'}
                  </Text>
                </View>
                {event.severity && (
                  <View
                    style={[
                      styles.severityBadge,
                      {
                        backgroundColor:
                          event.severity === 'critical' || event.severity === 'high'
                            ? '#e94560' + '20'
                            : event.severity === 'medium'
                            ? '#ff9800' + '20'
                            : theme.colors.primary + '20',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.severityText,
                        {
                          color:
                            event.severity === 'critical' || event.severity === 'high'
                              ? '#e94560'
                              : event.severity === 'medium'
                              ? '#ff9800'
                              : theme.colors.primary,
                        },
                      ]}
                    >
                      {event.severity.toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              {event.description && (
                <Text style={[styles.eventDescription, { color: theme.colors.textSecondary }]}>
                  {event.description}
                </Text>
              )}
            </View>
          ))}
          {securityEvents.length > 5 && (
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => (navigation as any).navigate('AuditLogViewer')}
            >
              <Text style={[styles.viewAllText, { color: theme.colors.primary }]}>
                View All Events ({securityEvents.length})
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Compliance Metrics */}
      {complianceStatus?.metrics && (
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="stats-chart" size={24} color={theme.colors.primary} />
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              Compliance Metrics
            </Text>
          </View>
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={[styles.metricValue, { color: theme.colors.primary }]}>
                {complianceStatus.metrics.data_deletion_requests}
              </Text>
              <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
                Deletion Requests
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={[styles.metricValue, { color: theme.colors.primary }]}>
                {complianceStatus.metrics.data_export_requests}
              </Text>
              <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
                Export Requests
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={[styles.metricValue, { color: theme.colors.primary }]}>
                {complianceStatus.metrics.security_incidents}
              </Text>
              <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
                Security Incidents
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={[styles.metricValue, { color: theme.colors.primary }]}>
                {complianceStatus.metrics.access_control_violations}
              </Text>
              <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
                Access Violations
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Navigation Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={() => navigation.navigate('AuditLogViewer' as never)}
        >
          <Ionicons name="document-text" size={20} color="#fff" />
          <Text style={styles.buttonText}>View Audit Logs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: (theme.colors as any).secondary || theme.colors.primary }]}
          onPress={() => navigation.navigate('ComplianceReports' as never)}
        >
          <Ionicons name="bar-chart" size={20} color="#fff" />
          <Text style={styles.buttonText}>Compliance Reports</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginBottom: 15,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  complianceSection: {
    marginTop: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  checkList: {
    marginTop: 10,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkText: {
    fontSize: 14,
    marginLeft: 10,
  },
  budgetContainer: {
    marginTop: 10,
  },
  budgetItem: {
    marginBottom: 15,
  },
  budgetLabel: {
    fontSize: 14,
    marginBottom: 5,
  },
  budgetValue: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  metricLabel: {
    fontSize: 14,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
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
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  eventItem: {
    paddingVertical: 12,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventTime: {
    fontSize: 12,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  eventDescription: {
    fontSize: 12,
    marginTop: 6,
    marginLeft: 28,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

