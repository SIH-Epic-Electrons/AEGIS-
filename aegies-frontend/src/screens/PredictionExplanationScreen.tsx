/**
 * Prediction Explanation Screen
 * Shows detailed SHAP explanation for a prediction
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/theme';
import { predictiveAnalyticsService } from '../api/predictiveAnalyticsService';
import SHAPExplanationView from '../components/SHAPExplanationView';
import InteractiveExplanationView from '../components/InteractiveExplanationView';
import { LinearGradient } from 'expo-linear-gradient';
import { shareExplanation } from '../services/explanationExportService';

export default function PredictionExplanationScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { complaintId } = (route.params as any) || { complaintId: '' };

  const [loading, setLoading] = useState(true);
  const [explanation, setExplanation] = useState<any>(null);
  const [simulation, setSimulation] = useState<any>(null);
  const [crossBank, setCrossBank] = useState<any>(null);
  const [trustScore, setTrustScore] = useState<any>(null);
  const [waterfallData, setWaterfallData] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'simple' | 'interactive'>('interactive');

  useEffect(() => {
    loadExplanation();
  }, [complaintId]);

  const loadExplanation = async () => {
    try {
      setLoading(true);
      const [expl, sim, bank, waterfall] = await Promise.all([
        predictiveAnalyticsService.getExplanation(complaintId),
        predictiveAnalyticsService.getSimulation(complaintId),
        predictiveAnalyticsService.getCrossBankIntelligence(complaintId),
        predictiveAnalyticsService.getWaterfallExplanation(complaintId).catch(() => null),
      ]);

      setExplanation(expl);
      setSimulation(sim);
      setCrossBank(bank);
      
      // Extract trust score if available
      if (expl?.trust_score) {
        setTrustScore(expl.trust_score);
      }
      
      // Set waterfall data
      if (waterfall?.steps) {
        setWaterfallData(waterfall.steps);
      }
    } catch (error) {
      console.error('Error loading explanation:', error);
    } finally {
      setLoading(false);
    }
  };

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
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
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
            AI Explanation
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            {complaintId}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.viewModeButton}
            onPress={() => setViewMode(viewMode === 'simple' ? 'interactive' : 'simple')}
          >
            <Ionicons
              name={viewMode === 'simple' ? 'grid-outline' : 'list-outline'}
              size={20}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={() => {
              if (explanation) {
                shareExplanation({
                  complaintId,
                  explanation,
                  prediction: { riskScore: explanation.prediction, hotspots: [] },
                  timestamp: new Date().toISOString(),
                });
              }
            }}
          >
            <Ionicons name="share-outline" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Trust Score */}
      {trustScore && (
        <View style={[styles.section, { backgroundColor: theme.colors.surfaceElevated }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#4CAF5015' }]}>
              <Ionicons name="shield-checkmark" size={20} color="#4CAF50" />
            </View>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Trust Score
            </Text>
          </View>
          <View style={styles.trustScoreContent}>
            <Text style={[styles.trustScoreValue, { color: theme.colors.text }]}>
              {(trustScore.trust_score * 100).toFixed(0)}%
            </Text>
            <Text style={[styles.trustScoreExplanation, { color: theme.colors.textSecondary }]}>
              {trustScore.explanation || 'Trust score based on model confidence and data quality'}
            </Text>
          </View>
        </View>
      )}

      {/* Explanation View */}
      {viewMode === 'interactive' ? (
        <InteractiveExplanationView
          topFactors={explanation.topFactors || []}
          baseValue={explanation.baseValue || 0}
          prediction={explanation.prediction || 0}
          waterfallData={waterfallData}
          trustScore={trustScore}
        />
      ) : (
        <SHAPExplanationView
          topFactors={explanation.topFactors || []}
          baseValue={explanation.baseValue || 0}
          prediction={explanation.prediction || 0}
        />
      )}

      {/* Digital Twin Simulation */}
      {simulation && (
        <View style={[styles.section, { backgroundColor: theme.colors.surfaceElevated }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#9C27B015' }]}>
              <Ionicons name="pulse" size={20} color="#9C27B0" />
            </View>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Digital Twin Simulation
            </Text>
          </View>
          <View style={styles.simulationContent}>
            <View style={styles.simulationRow}>
              <Text style={[styles.simulationLabel, { color: theme.colors.textSecondary }]}>
                Predicted Behavior
              </Text>
              <Text style={[styles.simulationValue, { color: theme.colors.text }]}>
                {simulation.predictedBehavior || 'N/A'}
              </Text>
            </View>
            <View style={styles.simulationRow}>
              <Text style={[styles.simulationLabel, { color: theme.colors.textSecondary }]}>
                Risk Adjustment
              </Text>
              <Text style={[styles.simulationValue, { color: theme.colors.text }]}>
                {(simulation.riskAdjustment * 100).toFixed(1)}%
              </Text>
            </View>
            <View style={styles.simulationRow}>
              <Text style={[styles.simulationLabel, { color: theme.colors.textSecondary }]}>
                Confidence
              </Text>
              <Text style={[styles.simulationValue, { color: theme.colors.text }]}>
                {(simulation.confidence * 100).toFixed(0)}%
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Cross-Bank Intelligence */}
      {crossBank && (
        <View style={[styles.section, { backgroundColor: theme.colors.surfaceElevated }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#FF980015' }]}>
              <Ionicons name="business-outline" size={20} color="#FF9800" />
            </View>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Cross-Bank Intelligence
            </Text>
          </View>
          <View style={styles.simulationContent}>
            <View style={styles.simulationRow}>
              <Text style={[styles.simulationLabel, { color: theme.colors.textSecondary }]}>
                Linked Accounts
              </Text>
              <Text style={[styles.simulationValue, { color: theme.colors.text }]}>
                {crossBank.linkedAccountCount || 0}
              </Text>
            </View>
            <View style={styles.simulationRow}>
              <Text style={[styles.simulationLabel, { color: theme.colors.textSecondary }]}>
                Risk Score
              </Text>
              <Text style={[styles.simulationValue, { color: theme.colors.text }]}>
                {(crossBank.riskScore * 100).toFixed(1)}%
              </Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
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
  contentContainer: {
    paddingBottom: 40,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
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
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  viewModeButton: {
    padding: 8,
  },
  shareButton: {
    padding: 8,
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
  section: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  simulationContent: {
    gap: 12,
  },
  simulationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  simulationLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  simulationValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  trustScoreContent: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  trustScoreValue: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  trustScoreExplanation: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

