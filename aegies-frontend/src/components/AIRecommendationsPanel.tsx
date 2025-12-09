import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';

interface AIRecommendationsPanelProps {
  recommendations?: any;
  onAction?: (id: any, action: any) => void;
}

export default function AIRecommendationsPanel({ recommendations, onAction }: AIRecommendationsPanelProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>AI Recommendations</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        AI recommendations will appear here
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

