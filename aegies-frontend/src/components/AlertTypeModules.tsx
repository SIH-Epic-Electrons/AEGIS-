/**
 * Alert Type Modules
 * Different modules for different alert types (ATM, Complaint, Team, etc.)
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PrioritizedAlert } from '../services/alertLocationService';

interface AlertModuleProps {
  alert: PrioritizedAlert;
  onNavigate?: () => void;
  onDeployTeam?: () => void;
  onViewDetails?: () => void;
}

/**
 * ATM Alert Module
 */
export function ATMAlertModule({ alert, onNavigate, onDeployTeam }: AlertModuleProps) {
  const riskPercentage = Math.round((alert.risk || 0) * 100);
  const timeWindow = alert.timeToWindow ? `${alert.timeToWindow} min` : 'N/A';

  return (
    <View style={styles.moduleContainer}>
      <View style={styles.moduleHeader}>
        <View style={[styles.iconContainer, { backgroundColor: '#fee2e2' }]}>
          <Ionicons name="card" size={24} color="#dc2626" />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.moduleTitle}>ATM Alert</Text>
          <View style={styles.riskBadge}>
            <View style={[styles.riskDot, { backgroundColor: '#dc2626' }]} />
            <Text style={styles.riskText}>{riskPercentage}% risk</Text>
          </View>
        </View>
      </View>

      <View style={styles.moduleBody}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Location:</Text>
          <Text style={styles.infoValue}>{alert.location?.address || 'Unknown'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Time Window:</Text>
          <Text style={styles.infoValue}>{timeWindow}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Priority:</Text>
          <View style={[styles.priorityBadge, getPriorityStyle(alert.priorityLevel)]}>
            <Text style={styles.priorityText}>{alert.priorityLevel.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.recommendedAction}>{alert.recommendedAction}</Text>
      </View>

      <View style={styles.moduleActions}>
        <TouchableOpacity style={styles.navigateButton} onPress={onNavigate}>
          <Ionicons name="navigate" size={18} color="#FFFFFF" />
          <Text style={styles.buttonText}>Navigate</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deployButton} onPress={onDeployTeam}>
          <Ionicons name="people" size={18} color="#374151" />
          <Text style={[styles.buttonText, { color: '#374151' }]}>Deploy Team</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * Complaint Alert Module
 */
export function ComplaintAlertModule({ alert, onViewDetails, onDeployTeam }: AlertModuleProps) {
  const amount = alert.amount ? `₹${(alert.amount / 1000).toFixed(0)}K` : 'N/A';

  return (
    <View style={styles.moduleContainer}>
      <View style={styles.moduleHeader}>
        <View style={[styles.iconContainer, { backgroundColor: '#dbeafe' }]}>
          <Ionicons name="person" size={24} color="#2563eb" />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.moduleTitle}>Complaint Alert</Text>
          <Text style={styles.amountText}>{amount}</Text>
        </View>
      </View>

      <View style={styles.moduleBody}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Location:</Text>
          <Text style={styles.infoValue}>{alert.location?.address || 'Unknown'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Priority:</Text>
          <View style={[styles.priorityBadge, getPriorityStyle(alert.priorityLevel)]}>
            <Text style={styles.priorityText}>{alert.priorityLevel.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.recommendedAction}>{alert.recommendedAction}</Text>
      </View>

      <View style={styles.moduleActions}>
        <TouchableOpacity style={styles.viewButton} onPress={onViewDetails}>
          <Ionicons name="eye" size={18} color="#FFFFFF" />
          <Text style={styles.buttonText}>View Details</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deployButton} onPress={onDeployTeam}>
          <Ionicons name="people" size={18} color="#374151" />
          <Text style={[styles.buttonText, { color: '#374151' }]}>Deploy Team</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * Team Alert Module
 */
export function TeamAlertModule({ alert, onViewDetails }: AlertModuleProps) {
  return (
    <View style={styles.moduleContainer}>
      <View style={styles.moduleHeader}>
        <View style={[styles.iconContainer, { backgroundColor: '#dcfce7' }]}>
          <Ionicons name="shield" size={24} color="#22c55e" />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.moduleTitle}>Team Status</Text>
          <Text style={styles.statusText}>Active</Text>
        </View>
      </View>

      <View style={styles.moduleBody}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Location:</Text>
          <Text style={styles.infoValue}>{alert.location?.address || 'Unknown'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Distance:</Text>
          <Text style={styles.infoValue}>
            {alert.distance ? `${alert.distance.toFixed(1)} km` : 'N/A'}
          </Text>
        </View>
      </View>

      <View style={styles.moduleActions}>
        <TouchableOpacity style={styles.viewButton} onPress={onViewDetails}>
          <Ionicons name="eye" size={18} color="#FFFFFF" />
          <Text style={styles.buttonText}>View Team</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * Get priority style based on level
 */
function getPriorityStyle(level: string) {
  switch (level) {
    case 'critical':
      return { backgroundColor: '#fee2e2', borderColor: '#dc2626' };
    case 'high':
      return { backgroundColor: '#fef3c7', borderColor: '#d97706' };
    case 'medium':
      return { backgroundColor: '#dbeafe', borderColor: '#2563eb' };
    default:
      return { backgroundColor: '#f3f4f6', borderColor: '#6b7280' };
  }
}

const styles = StyleSheet.create({
  moduleContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
  },
  moduleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  riskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  riskText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
  },
  amountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#22c55e',
  },
  moduleBody: {
    marginBottom: 12,
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
    textAlign: 'right',
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
    color: '#111827',
  },
  recommendedAction: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
    marginTop: 8,
    padding: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
  },
  moduleActions: {
    flexDirection: 'row',
    gap: 8,
  },
  navigateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  deployButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  viewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

