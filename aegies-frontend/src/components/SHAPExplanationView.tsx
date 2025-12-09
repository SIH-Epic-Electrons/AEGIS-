import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/theme';

interface SHAPExplanationViewProps {
  topFactors?: any[];
  baseValue?: number;
  prediction?: number;
  data?: any;
  waterfallData?: any;
}

export default function SHAPExplanationView({
  topFactors = [],
  baseValue = 0,
  prediction = 0,
  data,
  waterfallData,
}: SHAPExplanationViewProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.header}>
        <Ionicons name="analytics" size={24} color={theme.colors.primary} />
        <Text style={[styles.title, { color: theme.colors.text }]}>SHAP Explanation</Text>
      </View>
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.infoCard, { backgroundColor: theme.colors.surfaceElevated }]}>
          <Ionicons name="information-circle" size={20} color={theme.colors.info} />
          <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
            SHAP (SHapley Additive exPlanations) values show how each feature contributes to the prediction.
          </Text>
        </View>

        {(topFactors && topFactors.length > 0) || data ? (
          <View style={styles.featuresList}>
            {(topFactors || Object.entries(data || {})).slice(0, 5).map((item: any, index: number) => {
              const key = item.feature || item.name || Object.keys(item)[0] || `Factor ${index + 1}`;
              const value = item.value || item.contribution || Object.values(item)[0] || 0;
              return (
                <View key={index} style={[styles.featureItem, { backgroundColor: theme.colors.surfaceElevated }]}>
                  <Text style={[styles.featureName, { color: theme.colors.text }]}>{key}</Text>
                  <Text style={[styles.featureValue, { color: value > 0 ? theme.colors.success : theme.colors.error }]}>
                    {typeof value === 'number' ? value.toFixed(3) : String(value)}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="bar-chart-outline" size={48} color={theme.colors.textTertiary} />
            <Text style={[styles.placeholderText, { color: theme.colors.textSecondary }]}>
              SHAP data will appear here
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  featuresList: {
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  featureName: {
    fontSize: 14,
    fontWeight: '500',
  },
  featureValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  placeholderText: {
    fontSize: 14,
    marginTop: 12,
  },
});

