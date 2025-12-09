/**
 * Explanation Dashboard Screen
 * Dedicated dashboard for AI explanations with tabs for different views
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/theme';
import { predictiveAnalyticsService } from '../api/predictiveAnalyticsService';
import InteractiveExplanationView from '../components/InteractiveExplanationView';
import { shareExplanation } from '../services/explanationExportService';
import { LinearGradient } from 'expo-linear-gradient';

type TabType = 'overview' | 'shap' | 'counterfactuals' | 'features' | 'trends';

export default function ExplanationDashboard() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { complaintId } = (route.params as any) || { complaintId: '' };

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [explanation, setExplanation] = useState<any>(null);
  const [waterfallData, setWaterfallData] = useState<any>(null);
  const [counterfactuals, setCounterfactuals] = useState<any[]>([]);
  const [featureImportance, setFeatureImportance] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [complaintId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [expl, waterfall] = await Promise.all([
        predictiveAnalyticsService.getExplanation(complaintId),
        predictiveAnalyticsService.getWaterfallExplanation(complaintId).catch(() => null),
      ]);

      setExplanation(expl);
      if (waterfall?.steps) {
        setWaterfallData(waterfall.steps);
      }

      // Load feature importance
      try {
        // Would call API endpoint for feature importance
        setFeatureImportance({
          top_features: expl?.topFactors?.slice(0, 10) || [],
        });
      } catch (e) {
        console.warn('Feature importance not available');
      }
    } catch (error) {
      console.error('Error loading explanation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs: Array<{ id: TabType; label: string; icon: string }> = [
    { id: 'overview', label: 'Overview', icon: 'home-outline' },
    { id: 'shap', label: 'SHAP', icon: 'analytics-outline' },
    { id: 'counterfactuals', label: 'What If', icon: 'help-circle-outline' },
    { id: 'features', label: 'Features', icon: 'list-outline' },
    { id: 'trends', label: 'Trends', icon: 'trending-up-outline' },
  ];

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
          Loading explanation...
        </Text>
      </View>
    );
  }

  if (!explanation) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: theme.colors.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color={theme.colors.textSecondary} />
        <Text style={[styles.errorText, { color: theme.colors.text }]}>
          Explanation not available
        </Text>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <LinearGradient
        colors={theme.isDark
          ? [theme.colors.surface, theme.colors.background]
          : [theme.colors.surface, theme.colors.background]
        }
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButtonHeader}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Explanation Dashboard
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            {complaintId}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.shareButton}
          onPress={() => {
            shareExplanation({
              complaintId,
              explanation,
              prediction: { riskScore: explanation.prediction, hotspots: [] },
              timestamp: new Date().toISOString(),
            });
          }}
        >
          <Ionicons name="share-outline" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </LinearGradient>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabsContainer, { backgroundColor: theme.colors.surface }]}
        contentContainerStyle={styles.tabsContent}
      >
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              activeTab === tab.id && { backgroundColor: theme.colors.primary + '20' },
            ]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.id ? theme.colors.primary : theme.colors.textSecondary}
            />
            <Text
              style={[
                styles.tabLabel,
                {
                  color: activeTab === tab.id ? theme.colors.primary : theme.colors.textSecondary,
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'overview' && (
          <View>
            {/* Trust Score */}
            {explanation.trust_score && (
              <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.cardHeader}>
                  <Ionicons name="shield-checkmark" size={20} color={theme.colors.success} />
                  <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Trust Score</Text>
                </View>
                <Text style={[styles.trustScoreValue, { color: theme.colors.success }]}>
                  {(explanation.trust_score.trust_score * 100).toFixed(0)}%
                </Text>
                <Text style={[styles.trustScoreExplanation, { color: theme.colors.textSecondary }]}>
                  {explanation.trust_score.explanation}
                </Text>
              </View>
            )}

            {/* Summary */}
            <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} />
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Summary</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
                  Risk Score
                </Text>
                <Text style={[styles.summaryValue, { color: theme.colors.primary }]}>
                  {(explanation.prediction * 100).toFixed(1)}%
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
                  Top Factors
                </Text>
                <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
                  {explanation.topFactors?.length || 0}
                </Text>
              </View>
            </View>

            {/* Top 3 Factors */}
            <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="star-outline" size={20} color={theme.colors.warning} />
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Top 3 Factors</Text>
              </View>
              {explanation.topFactors?.slice(0, 3).map((factor: any, index: number) => (
                <View key={index} style={styles.factorRow}>
                  <Text style={[styles.factorName, { color: theme.colors.text }]}>
                    {index + 1}. {factor.feature}
                  </Text>
                  <Text style={[styles.factorContribution, { color: theme.colors.primary }]}>
                    {(factor.contribution * 100).toFixed(1)}%
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {activeTab === 'shap' && (
          <InteractiveExplanationView
            topFactors={explanation.topFactors || []}
            baseValue={explanation.baseValue || 0}
            prediction={explanation.prediction || 0}
            waterfallData={waterfallData}
            trustScore={explanation.trust_score}
          />
        )}

        {activeTab === 'counterfactuals' && (
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="help-circle-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Counterfactual Scenarios</Text>
            </View>
            <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
              Counterfactual analysis allows you to explore "what if" scenarios by changing input values
              and seeing how the prediction changes.
            </Text>
            <Text style={[styles.comingSoon, { color: theme.colors.textSecondary }]}>
              Coming soon: Interactive counterfactual scenario builder
            </Text>
          </View>
        )}

        {activeTab === 'features' && (
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="list-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Feature Importance</Text>
            </View>
            {featureImportance?.top_features?.map((feature: any, index: number) => (
              <View key={index} style={styles.featureRow}>
                <Text style={[styles.featureName, { color: theme.colors.text }]}>
                  {feature.feature || feature.name}
                </Text>
                <Text style={[styles.featureImportance, { color: theme.colors.primary }]}>
                  {((feature.importance || feature.contribution || 0) * 100).toFixed(1)}%
                </Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'trends' && (
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="trending-up-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Historical Trends</Text>
            </View>
            <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
              Feature importance trends over time will be displayed here.
            </Text>
            <Text style={[styles.comingSoon, { color: theme.colors.textSecondary }]}>
              Coming soon: Historical trend visualization
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
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonHeader: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  shareButton: {
    padding: 8,
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
    marginRight: 8,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  trustScoreValue: {
    fontSize: 48,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  trustScoreExplanation: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  factorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  factorName: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  factorContribution: {
    fontSize: 14,
    fontWeight: '700',
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  featureName: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  featureImportance: {
    fontSize: 14,
    fontWeight: '700',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  comingSoon: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

