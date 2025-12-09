import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';

interface StatCardProps {
  title?: string;
  label?: string; // Alias for title
  value: string | number;
  subtitle?: string;
  icon?: string;
  color?: string;
  theme?: any; // Accept but ignore
  width?: number; // Accept but ignore
}

export default function StatCard({ title, label, value, subtitle, icon, color, theme: themeProp, width }: StatCardProps) {
  const { theme } = useTheme();
  const cardColor = color || theme.colors.primary;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface, borderLeftColor: cardColor }]}>
      <Text style={[styles.title, { color: theme.colors.textSecondary }]}>{title}</Text>
      <Text style={[styles.value, { color: cardColor }]}>{value}</Text>
      {subtitle && <Text style={[styles.subtitle, { color: theme.colors.textTertiary }]}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    marginBottom: 12,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
  },
});

