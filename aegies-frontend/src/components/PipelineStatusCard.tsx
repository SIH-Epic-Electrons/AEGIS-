import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';

interface PipelineStatusCardProps {
  status?: any;
  kafkaConnected?: boolean;
  kafkaLag?: number;
  postgresConnected?: boolean;
  lastIngestion?: string;
  totalComplaintsToday?: number;
  totalTransactionsToday?: number;
}

export default function PipelineStatusCard({ 
  status,
  kafkaConnected,
  kafkaLag,
  postgresConnected,
  lastIngestion,
  totalComplaintsToday,
  totalTransactionsToday,
}: PipelineStatusCardProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Pipeline Status</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        Data pipeline status will appear here
      </Text>
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
  },
});

