/**
 * Location Alert Card Component
 * Clean, compact card showing alert details for a specific location
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { PrioritizedAlert } from '../services/alertLocationService';

const { width } = Dimensions.get('window');

interface LocationAlertCardProps {
  alert: PrioritizedAlert;
  index: number;
  total: number;
  onNavigate: () => void;
  onDeployTeam: () => void;
  onViewDetails: () => void;
  onClose: () => void;
}

export default function LocationAlertCard({
  alert,
  index,
  total,
  onNavigate,
  onDeployTeam,
  onViewDetails,
  onClose,
}: LocationAlertCardProps) {
  const getPriorityColor = () => {
    switch (alert.priorityLevel) {
      case 'critical':
        return ['#ef4444', '#dc2626'];
      case 'high':
        return ['#f97316', '#ea580c'];
      case 'medium':
        return ['#3b82f6', '#2563eb'];
      default:
        return ['#6b7280', '#4b5563'];
    }
  };

  const getAlertIcon = () => {
    if (alert.title?.toLowerCase().includes('atm')) return 'card';
    if (alert.title?.toLowerCase().includes('complaint')) return 'document-text';
    if (alert.title?.toLowerCase().includes('team')) return 'people';
    return 'alert-circle';
  };

  const formatTimeWindow = () => {
    if (alert.timeWindow) {
      const start = new Date(alert.timeWindow.start);
      const end = new Date(alert.timeWindow.end);
      return `${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} - ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    }
    return 'N/A';
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconContainer, { backgroundColor: getPriorityColor()[0] + '20' }]}>
            <Ionicons name={getAlertIcon() as any} size={20} color={getPriorityColor()[0]} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>
              {alert.title || 'Alert'}
            </Text>
            <Text style={styles.location} numberOfLines={1}>
              {alert.location?.address || 'Location not available'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={20} color="#6b7280" />
        </TouchableOpacity>
      </View>

      {/* Priority Badge */}
      <View style={styles.prioritySection}>
        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor()[0] + '15' }]}>
          <View style={[styles.priorityDot, { backgroundColor: getPriorityColor()[0] }]} />
          <Text style={[styles.priorityText, { color: getPriorityColor()[0] }]}>
            {alert.priorityLevel.toUpperCase()} • Score: {alert.priorityScore}
          </Text>
        </View>
        {alert.distance !== undefined && (
          <Text style={styles.distance}>{alert.distance.toFixed(1)} km away</Text>
        )}
      </View>

      {/* Alert Details */}
      {alert.amount && (
        <View style={styles.detailRow}>
          <Ionicons name="cash" size={16} color="#6b7280" />
          <Text style={styles.detailText}>₹{alert.amount.toLocaleString()}</Text>
        </View>
      )}

      {alert.timeWindow && (
        <View style={styles.detailRow}>
          <Ionicons name="time" size={16} color="#6b7280" />
          <Text style={styles.detailText}>Window: {formatTimeWindow()}</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton]}
          onPress={onNavigate}
          activeOpacity={0.8}
        >
          <LinearGradient colors={['#3b82f6', '#2563eb']} style={styles.actionGradient}>
            <Ionicons name="navigate" size={18} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Navigate</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={onDeployTeam}
          activeOpacity={0.8}
        >
          <Ionicons name="people" size={18} color="#3b82f6" />
          <Text style={[styles.actionButtonText, { color: '#3b82f6' }]}>Deploy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.tertiaryButton]}
          onPress={onViewDetails}
          activeOpacity={0.8}
        >
          <Ionicons name="information-circle" size={18} color="#6b7280" />
        </TouchableOpacity>
      </View>

      {/* Navigation Indicator */}
      {total > 1 && (
        <View style={styles.navIndicator}>
          <Text style={styles.navText}>
            {index + 1} of {total}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    flex: 1,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  location: {
    fontSize: 13,
    color: '#6b7280',
  },
  closeButton: {
    padding: 4,
  },
  prioritySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  distance: {
    fontSize: 12,
    color: '#6b7280',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#374151',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  primaryButton: {
    flex: 2,
  },
  secondaryButton: {
    flex: 1.5,
    borderWidth: 1.5,
    borderColor: '#3b82f6',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 10,
  },
  tertiaryButton: {
    flex: 0.8,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  navIndicator: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    alignItems: 'center',
  },
  navText: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
  },
});

