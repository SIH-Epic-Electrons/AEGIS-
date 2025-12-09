import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';

interface FieldFriendlyExplanationProps {
  explanation?: any;
  riskScore?: number;
  topFactors?: { feature: string; contribution: number; value: number }[];
  baseValue?: number;
  onViewMap?: () => any;
  onViewSimilarCases?: () => void;
}

export default function FieldFriendlyExplanation({ 
  explanation,
  riskScore,
  topFactors,
  baseValue,
  onViewMap,
  onViewSimilarCases,
}: FieldFriendlyExplanationProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Field-Friendly Explanation</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        Field-friendly explanation will appear here
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

