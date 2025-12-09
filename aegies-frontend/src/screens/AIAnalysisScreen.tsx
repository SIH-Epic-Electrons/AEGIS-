import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/theme';
import { predictiveAnalyticsService } from '../api/predictiveAnalyticsService';

export default function AIAnalysisScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { complaintId, caseId } = (route.params as any) || {};

  const [loading, setLoading] = useState(true);
  const [predictionData, setPredictionData] = useState<any>(null);
  const [explanationData, setExplanationData] = useState<any>(null);
  const [muleNetworkData, setMuleNetworkData] = useState<any>(null);

  useEffect(() => {
    loadAIAnalysis();
  }, [complaintId, caseId]);

  const loadAIAnalysis = async () => {
    const effectiveId = complaintId || caseId;
    if (!effectiveId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [prediction, explanation, muleNetwork] = await Promise.all([
        predictiveAnalyticsService.getPrediction(effectiveId),
        predictiveAnalyticsService.getExplanation(effectiveId),
        predictiveAnalyticsService.getCrossBankIntelligence(effectiveId),
      ]);
      setPredictionData(prediction.success ? prediction.data : null);
      setExplanationData(explanation.success ? explanation.data : null);
      setMuleNetworkData(muleNetwork.success ? muleNetwork.data : null);
    } catch (error) {
      console.error('Error loading AI analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#06b6d4" />
        <Text style={[styles.loadingText, { color: '#94a3b8' }]}>Loading AI analysis...</Text>
      </View>
    );
  }

  // Default data matching MVP exactly
  const confidence = predictionData?.confidence || 94;
  const similarCases = predictionData?.similarCases || 847;
  const locationName = predictionData?.predictedLocation?.name || 'HDFC ATM Lokhandwala';

  const locationFactors = explanationData?.locationFactors || [
    {
      positive: true,
      title: 'Distance Factor',
      description: '2.3 km from fraud location - within typical 5km radius',
    },
    {
      positive: true,
      title: 'Historical Pattern',
      description: '12 past OTP frauds in this area used ATMs within 3km',
    },
    {
      positive: true,
      title: 'ATM Characteristics',
      description: 'Low CCTV visibility, high footfall area (criminals prefer)',
    },
    {
      positive: false,
      title: 'Time Pattern Match',
      description: '78% of similar frauds see withdrawal within 45-90 mins',
    },
  ];

  const networkInfo = muleNetworkData || {
    fraudRingDetected: true,
    linkedAccounts: 2,
    totalAccounts: 3,
    ringName: 'Western Mumbai Ring',
    networkId: 'WMR-2024-0087',
    totalCasesLinked: 23,
    estimatedTotalFraud: 12000000,
    activeSince: 'Aug 2024',
  };

  const similarCasesList = [
    { id: '1', caseNumber: '#MH-2025-82341', type: 'OTP Fraud', location: 'Andheri', amount: 280000, status: 'CAUGHT' },
    { id: '2', caseNumber: '#MH-2025-79823', type: 'OTP Fraud', location: 'Bandra', amount: 450000, status: 'RECOVERED' },
    { id: '3', caseNumber: '#MH-2025-76521', type: 'OTP Fraud', location: 'Goregaon', amount: 190000, status: 'FROZEN' },
  ];

  const alternativeLocations = [
    { name: 'HDFC ATM, Lokhandwala', confidence: 94 },
    { name: 'SBI ATM, Versova', confidence: 72 },
    { name: 'ICICI ATM, DN Nagar', confidence: 58 },
  ];

  return (
    <View style={[styles.container, { backgroundColor: '#0f172a' }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>AI Analysis</Text>
            <Text style={styles.headerSubtitle}>Case {complaintId || caseId || '#MH-2025-84721'}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Prediction Confidence - Matching MVP exactly */}
        <LinearGradient
          colors={['#0891b2', '#2563eb']}
          style={styles.confidenceCard}
        >
          <View style={styles.confidenceHeader}>
            <Ionicons name="bulb" size={20} color="#FFFFFF" />
            <Text style={styles.confidenceTitle}>Prediction Confidence</Text>
          </View>
          <View style={styles.confidenceContent}>
            <Text style={styles.confidenceValue}>{confidence}%</Text>
            <View style={styles.confidenceDetails}>
              <Text style={styles.confidenceSubtitle}>High confidence</Text>
              <Text style={styles.confidenceDescription}>Based on {similarCases} similar cases</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Why This Location - Matching MVP exactly */}
        <View style={[styles.sectionCard, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location" size={20} color="#06b6d4" />
            <Text style={styles.sectionTitle}>Why {locationName}?</Text>
          </View>
          <View style={styles.insightsList}>
            {locationFactors.map((factor: any, index: number) => (
              <View key={index} style={[styles.insightItem, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
                <Ionicons
                  name={factor.positive ? 'checkmark-circle' : 'trending-up'}
                  size={18}
                  color={factor.positive ? '#22c55e' : '#fbbf24'}
                />
                <View style={styles.insightContent}>
                  <Text style={styles.insightTitle}>{factor.title}</Text>
                  <Text style={styles.insightDescription}>{factor.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Mule Network Intelligence - Matching MVP exactly */}
        <View style={[styles.sectionCard, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="git-network" size={20} color="#f97316" />
            <Text style={styles.sectionTitle}>Mule Network Intelligence</Text>
          </View>
          {networkInfo.fraudRingDetected && (
            <View style={[styles.alertBanner, { backgroundColor: 'rgba(249, 115, 22, 0.2)', borderColor: 'rgba(249, 115, 22, 0.3)' }]}>
              <Text style={styles.alertTitle}>⚠️ Known Fraud Ring Detected</Text>
              <Text style={styles.alertDescription}>
                {networkInfo.linkedAccounts} of {networkInfo.totalAccounts} accounts linked to "{networkInfo.ringName}"
              </Text>
            </View>
          )}
          <View style={styles.networkStats}>
            <View style={styles.networkStatItem}>
              <Text style={styles.networkStatLabel}>Network ID</Text>
              <Text style={styles.networkStatValue}>{networkInfo.networkId}</Text>
            </View>
            <View style={styles.networkStatItem}>
              <Text style={styles.networkStatLabel}>Total Cases Linked</Text>
              <Text style={styles.networkStatValue}>{networkInfo.totalCasesLinked} cases</Text>
            </View>
            <View style={styles.networkStatItem}>
              <Text style={styles.networkStatLabel}>Estimated Total Fraud</Text>
              <Text style={[styles.networkStatValue, { color: '#f87171' }]}>₹{(networkInfo.estimatedTotalFraud / 10000000).toFixed(1)} Cr</Text>
            </View>
            <View style={styles.networkStatItem}>
              <Text style={styles.networkStatLabel}>Active Since</Text>
              <Text style={styles.networkStatValue}>{networkInfo.activeSince}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.viewNetworkButton, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}
            onPress={() => {
              // @ts-ignore
              navigation.navigate('MuleNetwork' as never, { caseId: complaintId || caseId } as never);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.viewNetworkText}>View Network Graph</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Similar Past Cases - Matching MVP exactly */}
        <View style={[styles.sectionCard, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time" size={20} color="#3b82f6" />
            <Text style={styles.sectionTitle}>Similar Past Cases</Text>
          </View>
          <View style={styles.similarCasesList}>
            {similarCasesList.map((case_) => (
              <View key={case_.id} style={[styles.similarCaseItem, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
                <View style={styles.similarCaseInfo}>
                  <Text style={styles.similarCaseNumber}>{case_.caseNumber}</Text>
                  <Text style={styles.similarCaseDetails}>
                    {case_.type} • {case_.location} • ₹{(case_.amount / 100000).toFixed(1)}L
                  </Text>
                </View>
                <View
                  style={[
                    styles.similarCaseStatus,
                    {
                      backgroundColor:
                        case_.status === 'CAUGHT'
                          ? 'rgba(34, 197, 94, 0.2)'
                          : case_.status === 'RECOVERED'
                          ? 'rgba(34, 197, 94, 0.2)'
                          : 'rgba(59, 130, 246, 0.2)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.similarCaseStatusText,
                      {
                        color:
                          case_.status === 'CAUGHT'
                            ? '#4ade80'
                            : case_.status === 'RECOVERED'
                            ? '#4ade80'
                            : '#60a5fa',
                      },
                    ]}
                  >
                    {case_.status}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={styles.successRateText}>Success rate in similar cases: 89%</Text>
        </View>

        {/* Alternative Locations - Matching MVP exactly */}
        <View style={[styles.sectionCard, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="map" size={20} color="#a855f7" />
            <Text style={styles.sectionTitle}>Alternative Predictions</Text>
          </View>
          <View style={styles.alternativeLocationsList}>
            {alternativeLocations.map((location, index) => (
              <View key={index} style={styles.alternativeLocationItem}>
                <View style={styles.alternativeLocationInfo}>
                  <Text style={styles.alternativeLocationNumber}>{index + 1}.</Text>
                  <Text style={styles.alternativeLocationName}>{location.name}</Text>
                </View>
                <Text
                  style={[
                    styles.alternativeLocationConfidence,
                    { color: index === 0 ? '#06b6d4' : '#94a3b8' },
                  ]}
                >
                  {location.confidence}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingText: {
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  confidenceCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  confidenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  confidenceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  confidenceContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
  },
  confidenceValue: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  confidenceDetails: {
    paddingBottom: 4,
  },
  confidenceSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#a5f3fc',
  },
  confidenceDescription: {
    fontSize: 12,
    color: '#e0f2fe',
  },
  sectionCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  insightsList: {
    gap: 10,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 10,
    padding: 12,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  insightDescription: {
    fontSize: 12,
    color: '#94a3b8',
  },
  alertBanner: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fb923c',
    marginBottom: 4,
  },
  alertDescription: {
    fontSize: 12,
    color: '#fed7aa',
  },
  networkStats: {
    gap: 10,
    marginBottom: 15,
  },
  networkStatItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  networkStatLabel: {
    fontSize: 14,
    color: '#cbd5e1',
  },
  networkStatValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  viewNetworkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 3,
  },
  viewNetworkText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  similarCasesList: {
    gap: 10,
    marginBottom: 12,
  },
  similarCaseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    padding: 12,
  },
  similarCaseInfo: {
    flex: 1,
  },
  similarCaseNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  similarCaseDetails: {
    fontSize: 12,
    color: '#94a3b8',
  },
  similarCaseStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  similarCaseStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  successRateText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
  },
  alternativeLocationsList: {
    gap: 8,
  },
  alternativeLocationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  alternativeLocationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alternativeLocationNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  alternativeLocationName: {
    fontSize: 14,
    color: '#cbd5e1',
  },
  alternativeLocationConfidence: {
    fontSize: 16,
    fontWeight: '700',
  },
});
