import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme/theme';

interface PriorityAlertQueueProps {
  alerts?: any[];
  selectedAlert?: any;
  onAlertPress?: (alert: any) => void;
  onDeployTeam?: (alert: any) => Promise<void>;
  onActivateCordon?: (alert: any) => Promise<void>;
  onViewMap?: (alert: any) => void;
  onViewDossier?: (alert: any) => void;
}

export default function PriorityAlertQueue({ 
  alerts = [], 
  selectedAlert,
  onAlertPress,
  onDeployTeam,
  onActivateCordon,
  onViewMap,
  onViewDossier,
}: PriorityAlertQueueProps) {
  const { theme } = useTheme();

  if (alerts.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No alerts</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Priority Alerts</Text>
      <FlatList
        data={alerts}
        keyExtractor={(item, index) => item.id || String(index)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.alertItem, { borderLeftColor: theme.colors.error }]}
            onPress={() => onAlertPress?.(item)}
            activeOpacity={0.7}
          >
            <Text style={[styles.alertTitle, { color: theme.colors.text }]}>{item.title || item.caseNumber || 'Alert'}</Text>
            <Text style={[styles.alertSubtitle, { color: theme.colors.textSecondary }]}>
              {item.subtitle || item.description || item.fraudType || ''}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
  },
  alertItem: {
    padding: 12,
    borderLeftWidth: 4,
    marginBottom: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  alertSubtitle: {
    fontSize: 12,
  },
});

