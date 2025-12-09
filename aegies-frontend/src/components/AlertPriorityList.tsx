/**
 * Alert Priority List Component
 * Displays alerts organized by location with priority indicators
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocationGroupedAlert, PrioritizedAlert } from '../services/alertLocationService';

interface AlertPriorityListProps {
  locationGroups: LocationGroupedAlert[];
  selectedGroup?: LocationGroupedAlert;
  onGroupSelect: (group: LocationGroupedAlert) => void;
  onAlertSelect: (alert: PrioritizedAlert) => void;
}

export default function AlertPriorityList({
  locationGroups,
  selectedGroup,
  onGroupSelect,
  onAlertSelect,
}: AlertPriorityListProps) {
  const getPriorityColor = (level: string) => {
    switch (level) {
      case 'critical':
        return '#dc2626';
      case 'high':
        return '#d97706';
      case 'medium':
        return '#2563eb';
      default:
        return '#6b7280';
    }
  };

  const getPriorityIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return 'alert-circle';
      case 'high':
        return 'warning';
      case 'medium':
        return 'information-circle';
      default:
        return 'ellipse';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Alerts by Location</Text>
        <Text style={styles.headerSubtitle}>{locationGroups.length} locations</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {locationGroups.map((group) => (
          <TouchableOpacity
            key={group.locationId}
            style={[
              styles.groupCard,
              selectedGroup?.locationId === group.locationId && styles.groupCardSelected,
            ]}
            onPress={() => onGroupSelect(group)}
            activeOpacity={0.7}
          >
            <View style={styles.groupHeader}>
              <View style={styles.groupHeaderLeft}>
                <View
                  style={[
                    styles.priorityIndicator,
                    { backgroundColor: getPriorityColor(group.riskLevel) },
                  ]}
                >
                  <Ionicons
                    name={getPriorityIcon(group.riskLevel) as any}
                    size={16}
                    color="#FFFFFF"
                  />
                </View>
                <View style={styles.groupInfo}>
                  <Text style={styles.groupLocation} numberOfLines={1}>
                    {group.location.address}
                  </Text>
                  <Text style={styles.groupStats}>
                    {group.alerts.length} alert{group.alerts.length !== 1 ? 's' : ''} • Priority:{' '}
                    {group.totalPriority}
                  </Text>
                </View>
              </View>
              <View style={[styles.priorityBadge, { borderColor: getPriorityColor(group.riskLevel) }]}>
                <Text style={[styles.priorityText, { color: getPriorityColor(group.riskLevel) }]}>
                  {group.riskLevel.toUpperCase()}
                </Text>
              </View>
            </View>

            {selectedGroup?.locationId === group.locationId && (
              <View style={styles.alertsList}>
                {group.alerts.map((alert) => (
                  <TouchableOpacity
                    key={alert.id}
                    style={styles.alertItem}
                    onPress={() => onAlertSelect(alert)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.alertItemLeft}>
                      <View
                        style={[
                          styles.alertPriorityDot,
                          { backgroundColor: getPriorityColor(alert.priorityLevel) },
                        ]}
                      />
                      <View style={styles.alertInfo}>
                        <Text style={styles.alertTitle}>{alert.title || alert.caseNumber || 'Alert'}</Text>
                        <Text style={styles.alertSubtitle}>
                          {alert.type} • Score: {alert.priorityScore}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.alertScore, { backgroundColor: getPriorityColor(alert.priorityLevel) + '20' }]}>
                      <Text style={[styles.alertScoreText, { color: getPriorityColor(alert.priorityLevel) }]}>
                        {alert.priorityScore}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    maxHeight: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  scrollView: {
    maxHeight: 320,
  },
  groupCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  groupCardSelected: {
    backgroundColor: '#fef3c7',
    borderColor: '#d97706',
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  priorityIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupInfo: {
    flex: 1,
  },
  groupLocation: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  groupStats: {
    fontSize: 12,
    color: '#6b7280',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  alertsList: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 8,
  },
  alertItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
  },
  alertItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  alertPriorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  alertInfo: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  alertSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  alertScore: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertScoreText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

