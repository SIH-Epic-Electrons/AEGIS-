import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/theme';

interface InteractiveExplanationViewProps {
  topFactors?: any[];
  baseValue?: number;
  prediction?: number;
  waterfallData?: any;
  trustScore?: any;
  explanation?: any;
  simulation?: any;
  crossBank?: any;
}

export default function InteractiveExplanationView({
  topFactors = [],
  baseValue = 0,
  prediction = 0,
  waterfallData,
  trustScore,
  explanation,
  simulation,
  crossBank,
}: InteractiveExplanationViewProps) {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'explanation' | 'simulation' | 'crossbank'>('explanation');

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.header}>
        <Ionicons name="bulb" size={24} color={theme.colors.primary} />
        <Text style={[styles.title, { color: theme.colors.text }]}>Interactive Explanation</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'explanation' && { backgroundColor: theme.colors.primary },
          ]}
          onPress={() => setActiveTab('explanation')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'explanation' && { color: '#FFFFFF' },
              activeTab !== 'explanation' && { color: theme.colors.textSecondary },
            ]}
          >
            Explanation
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'simulation' && { backgroundColor: theme.colors.primary },
          ]}
          onPress={() => setActiveTab('simulation')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'simulation' && { color: '#FFFFFF' },
              activeTab !== 'simulation' && { color: theme.colors.textSecondary },
            ]}
          >
            Simulation
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'crossbank' && { backgroundColor: theme.colors.primary },
          ]}
          onPress={() => setActiveTab('crossbank')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'crossbank' && { color: '#FFFFFF' },
              activeTab !== 'crossbank' && { color: theme.colors.textSecondary },
            ]}
          >
            Cross-Bank
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'explanation' && (
          <View style={styles.tabContent}>
            {explanation ? (
              <View style={[styles.card, { backgroundColor: theme.colors.surfaceElevated }]}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Prediction Explanation</Text>
                <Text style={[styles.cardText, { color: theme.colors.textSecondary }]}>
                  {typeof explanation === 'string' ? explanation : JSON.stringify(explanation, null, 2)}
                </Text>
              </View>
            ) : (
              <View style={styles.placeholder}>
                <Ionicons name="document-text-outline" size={48} color={theme.colors.textTertiary} />
                <Text style={[styles.placeholderText, { color: theme.colors.textSecondary }]}>
                  Explanation data will appear here
                </Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'simulation' && (
          <View style={styles.tabContent}>
            {simulation ? (
              <View style={[styles.card, { backgroundColor: theme.colors.surfaceElevated }]}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Simulation Results</Text>
                <Text style={[styles.cardText, { color: theme.colors.textSecondary }]}>
                  {typeof simulation === 'string' ? simulation : JSON.stringify(simulation, null, 2)}
                </Text>
              </View>
            ) : (
              <View style={styles.placeholder}>
                <Ionicons name="play-circle-outline" size={48} color={theme.colors.textTertiary} />
                <Text style={[styles.placeholderText, { color: theme.colors.textSecondary }]}>
                  Simulation data will appear here
                </Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'crossbank' && (
          <View style={styles.tabContent}>
            {crossBank ? (
              <View style={[styles.card, { backgroundColor: theme.colors.surfaceElevated }]}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Cross-Bank Intelligence</Text>
                <Text style={[styles.cardText, { color: theme.colors.textSecondary }]}>
                  {typeof crossBank === 'string' ? crossBank : JSON.stringify(crossBank, null, 2)}
                </Text>
              </View>
            ) : (
              <View style={styles.placeholder}>
                <Ionicons name="git-network-outline" size={48} color={theme.colors.textTertiary} />
                <Text style={[styles.placeholderText, { color: theme.colors.textSecondary }]}>
                  Cross-bank data will appear here
                </Text>
              </View>
            )}
          </View>
        )}

        {trustScore && (
          <View style={[styles.trustCard, { backgroundColor: (theme.colors as any).infoLight || '#dbeafe' }]}>
            <Ionicons name="shield-checkmark" size={24} color={theme.colors.info} />
            <View style={styles.trustContent}>
              <Text style={[styles.trustTitle, { color: (theme.colors as any).infoDark || '#1e40af' }]}>Trust Score</Text>
              <Text style={[styles.trustValue, { color: theme.colors.info }]}>
                {typeof trustScore === 'number' ? `${(trustScore * 100).toFixed(1)}%` : String(trustScore)}
              </Text>
            </View>
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
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    gap: 12,
  },
  card: {
    padding: 16,
    borderRadius: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    lineHeight: 20,
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
  trustCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  trustContent: {
    flex: 1,
  },
  trustTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  trustValue: {
    fontSize: 20,
    fontWeight: '700',
  },
});

