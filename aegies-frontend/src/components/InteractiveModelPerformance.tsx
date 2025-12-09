import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';

interface InteractiveModelPerformanceProps {
  performance?: any;
  modelInfo?: any;
  onTimeRangeChange?: (range: any) => void;
  onModelVersionChange?: (version: any) => void;
}

export default function InteractiveModelPerformance({ 
  performance,
  modelInfo,
  onTimeRangeChange,
  onModelVersionChange,
}: InteractiveModelPerformanceProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Model Performance</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        Interactive model performance metrics will appear here
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

