import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/theme';
import { rlService, FeedbackCreateRequest } from '../api/rlService';
import { caseService } from '../api/caseService';
import { predictionService } from '../api/predictionService';

// Map UI values to API enum values
const mapPredictionAccuracy = (value: string): FeedbackCreateRequest['prediction_accuracy'] => {
  const mapping: Record<string, FeedbackCreateRequest['prediction_accuracy']> = {
    exact: 'EXACT_MATCH',
    nearby: 'NEARBY',
    different: 'DIFFERENT',
    unknown: 'UNKNOWN',
  };
  return mapping[value] || 'UNKNOWN';
};

const mapInterventionResult = (value: string): FeedbackCreateRequest['intervention_result'] => {
  const mapping: Record<string, FeedbackCreateRequest['intervention_result']> = {
    apprehended: 'APPREHENDED',
    recovered: 'RECOVERED',
    both: 'BOTH',
    unsuccessful: 'UNSUCCESSFUL',
  };
  return mapping[value] || 'UNSUCCESSFUL';
};

export default function OutcomeFeedbackScreen() {
  const { theme } = useTheme();
  const route = useRoute();
  const navigation = useNavigation();
  const { caseId, alertId, predictionId: routePredictionId } = (route.params as any) || {};
  const effectiveCaseId = caseId || alertId || 'default-case';

  const [predictionAccuracy, setPredictionAccuracy] = useState<string | null>(null);
  const [interventionResult, setInterventionResult] = useState<string | null>(null);
  const [amountRecovered, setAmountRecovered] = useState('306700');
  const [actualLocation, setActualLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [totalLoss, setTotalLoss] = useState(350000);
  const [predictionId, setPredictionId] = useState<string>(routePredictionId || '');
  const [caseNumber, setCaseNumber] = useState<string>('');
  const [rewardResult, setRewardResult] = useState<any>(null);

  // Load case details to get prediction ID and total loss
  useEffect(() => {
    const loadCaseData = async () => {
      try {
        // Get case details
        const caseResponse = await caseService.getCaseDetails(effectiveCaseId);
        if (caseResponse.success && caseResponse.data) {
          setTotalLoss(caseResponse.data.fraud_amount || 350000);
          setCaseNumber(caseResponse.data.case_number || effectiveCaseId);
        }

        // Get prediction ID if not provided
        if (!routePredictionId) {
          const predictionResponse = await predictionService.getCasePrediction(effectiveCaseId);
          if (predictionResponse.success && predictionResponse.data) {
            setPredictionId(predictionResponse.data.prediction_id);
          }
        }
      } catch (error) {
        console.error('Error loading case data:', error);
      }
    };

    loadCaseData();
  }, [effectiveCaseId, routePredictionId]);

  const handleSubmit = async () => {
    if (!predictionAccuracy || !interventionResult) {
      Alert.alert('Missing Information', 'Please select both prediction accuracy and intervention result.');
      return;
    }

    setLoading(true);

    try {
      // Prepare feedback data for RL API
      const feedbackData: FeedbackCreateRequest = {
        prediction_accuracy: mapPredictionAccuracy(predictionAccuracy),
        intervention_result: mapInterventionResult(interventionResult),
        amount_recovered: parseInt(amountRecovered.replace(/,/g, '')) || 0,
        actual_location: actualLocation || undefined,
        notes: notes || undefined,
      };

      // Submit feedback to RL service
      const effectivePredictionId = predictionId || `pred-${effectiveCaseId}`;
      const response = await rlService.submitFeedback(effectivePredictionId, feedbackData);

      if (response.success && response.data) {
        setRewardResult(response.data);
        
        // Show success feedback
        Alert.alert(
          'Feedback Submitted ✓',
          `${response.data.message}\n\nReward: ${response.data.reward_calculated?.toFixed(2) || 'N/A'}\nRecovery Rate: ${response.data.outcome_summary?.recovery_rate || 'N/A'}`,
          [
            {
              text: 'View AI Report',
              onPress: () => {
                // @ts-ignore
                navigation.navigate('CaseReport', { caseId: effectiveCaseId });
              },
            },
            {
              text: 'Return to Dashboard',
              onPress: () => {
                // @ts-ignore
                navigation.navigate('MainTabs');
              },
            },
          ]
        );
      } else {
        // Still navigate for demo
        // @ts-ignore
        navigation.navigate('CaseSuccess' as never, { 
          caseId: effectiveCaseId, 
          outcome: {
            predictionAccuracy,
            interventionResult,
            amountRecovered: parseInt(amountRecovered.replace(/,/g, '')),
          } 
        } as never);
      }
    } catch (error) {
      console.error('Error submitting outcome:', error);
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: '#f8fafc' }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#FFFFFF' }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Record Outcome</Text>
            <Text style={styles.headerSubtitle}>Case {caseNumber || caseId || '#MH-2025-84721'}</Text>
          </View>
        </View>
        {loading && (
          <ActivityIndicator size="small" color="#3b82f6" style={{ marginLeft: 'auto', marginRight: 16 }} />
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Prediction Accuracy */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Was the prediction accurate?</Text>
          <View style={styles.optionsGrid}>
            {[
              { key: 'exact', icon: 'checkmark-circle', label: 'Exact Match', sublabel: 'Correct location', color: '#22c55e' },
              { key: 'nearby', icon: 'location', label: 'Nearby', sublabel: 'Within 2km', color: '#6b7280' },
              { key: 'different', icon: 'location-outline', label: 'Different', sublabel: 'Wrong area', color: '#6b7280' },
              { key: 'unknown', icon: 'help-circle', label: 'Unknown', sublabel: 'No withdrawal', color: '#6b7280' },
            ].map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.optionCard,
                  predictionAccuracy === option.key && styles.optionCardSelected,
                  predictionAccuracy === option.key && { borderColor: option.color },
                ]}
                onPress={() => setPredictionAccuracy(option.key)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={option.icon as any}
                  size={32}
                  color={predictionAccuracy === option.key ? option.color : '#9ca3af'}
                />
                <Text
                  style={[
                    styles.optionLabel,
                    predictionAccuracy === option.key && { color: option.color },
                  ]}
                >
                  {option.label}
                </Text>
                <Text style={styles.optionSublabel}>{option.sublabel}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Intervention Result */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Intervention Result</Text>
          <View style={styles.resultOptions}>
            {[
              { key: 'apprehended', icon: 'lock-closed', label: 'Suspect Apprehended', sublabel: 'Criminal caught at location', color: '#22c55e' },
              { key: 'recovered', icon: 'wallet', label: 'Money Recovered', sublabel: 'Funds secured via freeze', color: '#3b82f6' },
              { key: 'both', icon: 'star', label: 'Both', sublabel: 'Apprehended + recovered', color: '#22c55e' },
              { key: 'unsuccessful', icon: 'close-circle', label: 'Unsuccessful', sublabel: 'Neither achieved', color: '#9ca3af' },
            ].map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.resultOption,
                  interventionResult === option.key && styles.resultOptionSelected,
                ]}
                onPress={() => setInterventionResult(option.key)}
                activeOpacity={0.7}
              >
                <View style={styles.radioContainer}>
                  <View
                    style={[
                      styles.radio,
                      interventionResult === option.key && styles.radioSelected,
                    ]}
                  >
                    {interventionResult === option.key && (
                      <View style={styles.radioInner} />
                    )}
                  </View>
                </View>
                <View style={styles.resultOptionContent}>
                  <Text style={styles.resultOptionLabel}>{option.label}</Text>
                  <Text style={styles.resultOptionSublabel}>{option.sublabel}</Text>
                </View>
                <Ionicons
                  name={option.icon as any}
                  size={24}
                  color={interventionResult === option.key ? option.color : '#9ca3af'}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Amount Recovered */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Amount Recovered</Text>
          <View style={styles.amountInput}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              style={styles.amountInputField}
              value={amountRecovered}
              onChangeText={setAmountRecovered}
              keyboardType="numeric"
              placeholder="0"
            />
          </View>
          <Text style={styles.amountHint}>Out of ₹{totalLoss.toLocaleString('en-IN')} total loss</Text>
        </View>

        {/* Actual Location */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            Actual Withdrawal Location (if different)
          </Text>
          <View style={styles.inputContainer}>
            <Ionicons name="location" size={20} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter actual location"
              value={actualLocation}
              onChangeText={setActualLocation}
            />
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Additional Notes</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Any observations or feedback for improving predictions..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* AI Feedback Note */}
        <View style={styles.aiNote}>
          <Ionicons name="sparkles" size={20} color="#3b82f6" />
          <View style={styles.aiNoteContent}>
            <Text style={styles.aiNoteTitle}>Your feedback improves AI</Text>
            <Text style={styles.aiNoteText}>
              This data helps retrain our prediction model for better accuracy
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={[styles.submitButton, (loading || !predictionAccuracy || !interventionResult) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.8}
          disabled={loading || !predictionAccuracy || !interventionResult}
        >
          <LinearGradient
            colors={(loading || !predictionAccuracy || !interventionResult) ? ['#9ca3af', '#6b7280'] : ['#3b82f6', '#2563eb']}
            style={styles.submitGradient}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            )}
            <Text style={styles.submitButtonText}>{loading ? 'Submitting...' : 'Submit Outcome'}</Text>
          </LinearGradient>
        </TouchableOpacity>
        <View style={styles.additionalActions}>
          <TouchableOpacity
            style={styles.viewReportButton}
            onPress={() => {
              // @ts-ignore - React Navigation type inference limitation
              navigation.navigate('CaseReport' as never, { caseId: effectiveCaseId } as never);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="document-text" size={18} color="#3b82f6" />
            <Text style={styles.viewReportText}>View AI Report</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dashboardButton}
            onPress={() => {
              // @ts-ignore - React Navigation type inference limitation
              navigation.navigate('MainTabs' as never);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="home" size={18} color="#6b7280" />
            <Text style={styles.dashboardText}>Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
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
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  optionCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  optionCardSelected: {
    borderWidth: 2,
    backgroundColor: '#f0fdf4',
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  optionSublabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  resultOptions: {
    gap: 8,
  },
  resultOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  resultOptionSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  radioContainer: {
    width: 20,
    height: 20,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: '#3b82f6',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b82f6',
  },
  resultOptionContent: {
    flex: 1,
  },
  resultOptionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  resultOptionSublabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  amountInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '500',
    color: '#6b7280',
    marginRight: 8,
  },
  amountInputField: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  amountHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
    minHeight: 96,
  },
  aiNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginTop: 8,
  },
  aiNoteContent: {
    flex: 1,
  },
  aiNoteTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 4,
  },
  aiNoteText: {
    fontSize: 12,
    color: '#2563eb',
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    padding: 16,
    paddingBottom: 32,
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    shadowColor: '#9ca3af',
    shadowOpacity: 0.2,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  additionalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  viewReportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  viewReportText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  dashboardButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  dashboardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
});

