import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';

interface ModelMetricsCardProps {
  metrics?: any;
  modelInfo?: any;
  version?: string;
  accuracy?: number;
  auc?: number;
  precision?: number;
  recall?: number;
  falsePositiveRate?: number;
  lastRetrained?: string;
}

export default function ModelMetricsCard({ 
  metrics, 
  modelInfo,
  version,
  accuracy,
  auc,
  precision,
  recall,
  falsePositiveRate,
  lastRetrained,
}: ModelMetricsCardProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Model Metrics</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        Model performance metrics will appear here
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

