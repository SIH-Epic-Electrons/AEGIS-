import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';

interface PredictionInsightsPanelProps {
  insights?: any;
  onReviewPredictions?: (type: any) => void;
  onExportReport?: () => void;
  onTriggerInvestigation?: () => void;
}

export default function PredictionInsightsPanel({ 
  insights, 
  onReviewPredictions,
  onExportReport,
  onTriggerInvestigation,
}: PredictionInsightsPanelProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Prediction Insights</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        Prediction insights will appear here
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

