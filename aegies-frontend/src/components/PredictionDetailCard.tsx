import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';

interface PredictionDetailCardProps {
  prediction?: any;
  key?: string;
  complaintId?: string;
  riskScore?: number;
  hotspots?: any[];
  timeWindow?: string;
  explanation?: string;
  timestamp?: string;
  onViewMap?: () => any;
  onViewExplanation?: () => void;
}

export default function PredictionDetailCard({ 
  prediction,
  key,
  complaintId,
  riskScore,
  hotspots,
  timeWindow,
  explanation,
  timestamp,
  onViewMap,
  onViewExplanation,
}: PredictionDetailCardProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Prediction Details</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        Prediction details will appear here
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

