import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface NewComplaintAlertProps {
  visible: boolean;
  onClose: () => void;
  complaint?: {
    id: string;
    caseNumber: string;
    fraudType: string;
    amount: number;
    timeSinceFraud: string;
    victimLocation: string;
    muleAccounts: number;
    predictedLocation: {
      name: string;
      address: string;
      distance: string;
      timeWindow: string;
    };
    confidence: number;
  };
}

export default function NewComplaintAlertScreen({
  visible,
  onClose,
  complaint,
}: NewComplaintAlertProps) {
  const navigation = useNavigation();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();

      // Pulse animation for alert icon
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      slideAnim.setValue(SCREEN_HEIGHT);
    }
  }, [visible]);

  const defaultComplaint = {
    id: '1',
    caseNumber: 'NCRP #MH-2025-84721',
    fraudType: 'OTP/Vishing Fraud',
    amount: 350000,
    timeSinceFraud: '23 minutes ago',
    victimLocation: 'Andheri West, Mumbai',
    muleAccounts: 3,
    predictedLocation: {
      name: 'HDFC ATM, Lokhandwala Complex',
      address: '2.3 km from fraud location • Est. time: 35-50 mins',
      distance: '2.3 km',
      timeWindow: '35-50 mins',
    },
    confidence: 94,
  };

  const data = complaint || defaultComplaint;

  const handleTakeAction = () => {
    onClose();
    // Navigate to CaseDetail with full complaint data matching MVP workflow
    // Format the alert data to match CaseDetails structure
    const caseData = {
      id: data.id,
      caseNumber: data.caseNumber,
      status: 'active' as const,
      priority: 'critical' as const,
      fraudType: data.fraudType,
      amount: data.amount,
      victim: {
        name: 'Rajesh Gupta', // Default from MVP
        location: data.victimLocation,
      },
      prediction: {
        location: {
          name: data.predictedLocation.name,
          address: data.predictedLocation.address,
          coordinates: {
            latitude: 19.1364, // Default coordinates for Lokhandwala
            longitude: 72.8297,
          },
        },
        confidence: data.confidence,
        timeWindow: {
          start: new Date().toISOString(),
          end: new Date(Date.now() + 35 * 60 * 1000).toISOString(), // 35 mins from now
          remaining: 35,
        },
        hotspots: [
          {
            location: {
              name: data.predictedLocation.name,
              address: data.predictedLocation.address,
              coordinates: {
                latitude: 19.1364,
                longitude: 72.8297,
              },
            },
            risk: 'high' as const,
            confidence: data.confidence,
          },
        ],
      },
      muleAccounts: data.muleAccounts,
      timestamp: new Date().toISOString(),
      timeSinceFraud: data.timeSinceFraud,
    };
    
    // Navigate using parent Stack Navigator
    const parent = navigation.getParent();
    // @ts-ignore - React Navigation type inference limitation
    const nav = parent || navigation;
    // @ts-ignore - React Navigation type inference limitation
    nav.navigate('CaseDetail' as never, {
      alertId: data.id,
      caseId: data.id,
      alert: caseData,
    } as never);
  };

  const formatCurrency = (amount: number | undefined | null) => {
    if (!amount || isNaN(amount)) {
      return '₹0';
    }
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    }
    return `₹${amount.toLocaleString()}`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.handle} />
          
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Alert Header */}
            <View style={styles.header}>
              <Animated.View
                style={[
                  styles.alertIconContainer,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              >
                <Ionicons name="alert-circle" size={32} color="#ef4444" />
              </Animated.View>
              <View style={styles.headerText}>
                <View style={styles.badgeRow}>
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>NEW COMPLAINT</Text>
                  </View>
                  <Text style={styles.timeText}>Just now</Text>
                </View>
                <Text style={styles.caseNumber}>{data.caseNumber}</Text>
              </View>
            </View>

            {/* AI Processing Status */}
            <View style={styles.aiStatus}>
              <View style={styles.aiStatusHeader}>
                <Ionicons name="sync" size={18} color="#2563eb" />
                <Text style={styles.aiStatusText}>AI Analysis Complete</Text>
              </View>
              <View style={styles.confidenceRow}>
                <Text style={styles.confidenceLabel}>Prediction confidence:</Text>
                <Text style={styles.confidenceValue}>{data.confidence || 0}%</Text>
              </View>
            </View>

            {/* Complaint Summary */}
            <View style={styles.summary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Fraud Type</Text>
                <Text style={styles.summaryValue}>{data.fraudType}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Amount Lost</Text>
                <Text style={styles.amountValue}>
                  {formatCurrency(data.amount)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Time Since Fraud</Text>
                <Text style={styles.timeValue}>{data.timeSinceFraud}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Victim Location</Text>
                <Text style={styles.summaryValue}>{data.victimLocation}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Mule Accounts Found</Text>
                <View style={styles.muleBadge}>
                  <Text style={styles.muleBadgeText}>
                    {data.muleAccounts || 0} accounts
                  </Text>
                </View>
              </View>
            </View>

            {/* Predicted Withdrawal */}
            <View style={styles.predictedLocation}>
              <View style={styles.predictedHeader}>
                <Ionicons name="location" size={20} color="#ef4444" />
                <Text style={styles.predictedTitle}>
                  Predicted Withdrawal Location
                </Text>
              </View>
              <Text style={styles.predictedName}>
                {data.predictedLocation.name}
              </Text>
              <Text style={styles.predictedAddress}>
                {data.predictedLocation.address}
              </Text>
            </View>

            {/* Recommended Action Flow */}
            <View style={styles.actionFlow}>
              <Text style={styles.actionFlowLabel}>Recommended Action Flow:</Text>
              <View style={styles.actionFlowSteps}>
                <View style={[styles.actionStep, styles.step1]}>
                  <Text style={styles.actionStepText}>1. FREEZE</Text>
                </View>
                <Text style={styles.actionArrow}>→</Text>
                <View style={[styles.actionStep, styles.step2]}>
                  <Text style={styles.actionStepText}>2. ALERT TEAMS</Text>
                </View>
                <Text style={styles.actionArrow}>→</Text>
                <View style={[styles.actionStep, styles.step3]}>
                  <Text style={styles.actionStepText}>3. INTERCEPT</Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.takeActionButton}
              onPress={handleTakeAction}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#ef4444', '#dc2626']}
                style={styles.takeActionGradient}
              >
                <Ionicons name="flash" size={20} color="#FFFFFF" />
                <Text style={styles.takeActionText}>Take Immediate Action</Text>
              </LinearGradient>
            </TouchableOpacity>
            <View style={styles.secondaryActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleTakeAction}
                activeOpacity={0.7}
              >
                <Ionicons name="eye" size={18} color="#374151" />
                <Text style={styles.secondaryButtonText}>View Details</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Ionicons name="time" size={18} color="#374151" />
                <Text style={styles.secondaryButtonText}>Snooze 5m</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  backdrop: {
    flex: 1,
  },
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 16,
  },
  handle: {
    width: 48,
    height: 6,
    backgroundColor: '#d1d5db',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  content: {
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  alertIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  newBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  newBadgeText: {
    color: '#dc2626',
    fontSize: 10,
    fontWeight: '700',
  },
  timeText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  caseNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  aiStatus: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  aiStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  aiStatusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
  },
  confidenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confidenceLabel: {
    fontSize: 14,
    color: '#4b5563',
  },
  confidenceValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e40af',
  },
  summary: {
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  amountValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ef4444',
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ea580c',
  },
  muleBadge: {
    backgroundColor: '#fed7aa',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  muleBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#c2410c',
  },
  predictedLocation: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  predictedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  predictedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#991b1b',
  },
  predictedName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 4,
  },
  predictedAddress: {
    fontSize: 14,
    color: '#4b5563',
  },
  actionFlow: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  actionFlowLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
  },
  actionFlowSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionStep: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  step1: {
    backgroundColor: '#ef4444',
  },
  step2: {
    backgroundColor: '#3b82f6',
  },
  step3: {
    backgroundColor: '#22c55e',
  },
  actionStepText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionArrow: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  actions: {
    padding: 24,
    paddingTop: 16,
    gap: 12,
  },
  takeActionButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  takeActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  takeActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
});

