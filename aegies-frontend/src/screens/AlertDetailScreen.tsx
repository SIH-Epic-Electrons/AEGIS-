import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Alert as AlertType, Hotspot } from '../types';
import { alertService } from '../api/alertService';
import { actionService } from '../api/actionService';
import { predictionService } from '../api/predictionService';
import { useAlertStore } from '../store/alertStore';
import MapView, { Marker, Circle } from 'react-native-maps';
import { useTheme } from '../theme/theme';

export default function AlertDetailScreen() {
  const { theme } = useTheme();
  const route = useRoute();
  const navigation = useNavigation();
  const { alert, prediction } = route.params as { alert?: AlertType; prediction?: any };
  const [data, setData] = useState<AlertType | null>(alert || null);
  const [mapRegion, setMapRegion] = useState<any>(null);
  const [shapExplanation, setShapExplanation] = useState<any>(null);
  const [digitalTwinInsights, setDigitalTwinInsights] = useState<any>(null);
  const [crossBankData, setCrossBankData] = useState<any>(null);
  const { queueAction } = useAlertStore();

  useEffect(() => {
    const loadData = async () => {
      if (alert?.id) {
        const fullAlertResponse = await alertService.getAlertById(alert.id);
        if (fullAlertResponse && fullAlertResponse.success && fullAlertResponse.data) {
          const fullAlert = fullAlertResponse.data;
          setData(fullAlert);
          
          // Load AI insights if complaint ID available
          const complaintId = (fullAlert as any).complaintId || (fullAlert as any).id;
          if (complaintId) {
            const [explanation, twinInsights, crossBank] = await Promise.all([
              predictionService.getExplanation(complaintId),
              predictionService.getDigitalTwinInsights(complaintId),
              predictionService.getCrossBankIntelligence(complaintId),
            ]);
            
            setShapExplanation(explanation);
            setDigitalTwinInsights(twinInsights);
            setCrossBankData(crossBank);
          }
        }
      }
    };
    loadData();
  }, [alert?.id]);

  useEffect(() => {
    if (data) {
      const location = data.location || (data.dossier?.hotspots?.[0]?.location);
      if (location && 
          location.latitude !== undefined && 
          location.longitude !== undefined &&
          !isNaN(location.latitude) &&
          !isNaN(location.longitude)) {
        setMapRegion({
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    }
  }, [data]);

  const handleActivateCordon = async () => {
    if (!data) return;

    const hotspot = data.dossier?.hotspots?.[0];
    if (!hotspot) return;

    Alert.alert(
      'Activate Digital Cordon',
      `Activate transaction freeze in 2km radius around ${hotspot.address}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate',
          style: 'destructive',
          onPress: async () => {
            const result = await actionService.activateCordon(data.id, hotspot.id);
            if (result.success) {
              const message = (result as any).message || (typeof result.error === 'string' ? result.error : 'Digital Cordon activated');
              Alert.alert('Success', message);
              const updatedResponse = await alertService.getAlertById(data.id);
              if (updatedResponse && updatedResponse.success && updatedResponse.data) {
                setData(updatedResponse.data);
              }
            } else {
              const errorMsg = typeof result.error === 'string' ? result.error : 'Failed to activate cordon';
              Alert.alert('Error', errorMsg);
            }
          },
        },
      ]
    );
  };

  const handleNavigateToAR = (hotspot: Hotspot) => {
    // @ts-ignore - React Navigation type inference limitation
    navigation.navigate('AR' as never, { hotspot, alertId: data?.id } as never);
  };

  const handleNavigateToEvidence = () => {
    // @ts-ignore - React Navigation type inference limitation
    navigation.navigate('Evidence' as never, { alertId: data?.id } as never);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (!data) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.headerContent}>
          <View style={[styles.iconCircle, { backgroundColor: theme.colors.error + '15' }]}>
            <Ionicons name="notifications" size={24} color={theme.colors.error} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{data.title}</Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
              {data.message}
            </Text>
          </View>
        </View>
      </View>

      {/* Details Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Details</Text>

        <View style={styles.detailRow}>
          <Ionicons name="cash-outline" size={20} color={theme.colors.textSecondary} />
          <View style={styles.detailContent}>
            <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Amount</Text>
            <Text style={[styles.detailValue, { color: theme.colors.text }]}>
              {formatCurrency(data.amount)}
            </Text>
          </View>
        </View>

        {data.complaintId && (
          <View style={styles.detailRow}>
            <Ionicons name="document-text-outline" size={20} color={theme.colors.textSecondary} />
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
                Complaint ID
              </Text>
              <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                {data.complaintId}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={20} color={theme.colors.textSecondary} />
          <View style={styles.detailContent}>
            <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
              Timestamp
            </Text>
            <Text style={[styles.detailValue, { color: theme.colors.text }]}>
              {format(new Date(data.timestamp), 'PPpp')}
            </Text>
          </View>
        </View>

        {data.status && (
          <View style={styles.detailRow}>
            <Ionicons name="flag-outline" size={20} color={theme.colors.textSecondary} />
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>
                Status
              </Text>
              <Text style={[styles.detailValue, { color: theme.colors.success }]}>
                {data.status.toUpperCase()}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* AI Insights Section */}
      {(shapExplanation || digitalTwinInsights || crossBankData) && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>AI Insights</Text>
          
          {shapExplanation && (
            <View style={[styles.aiCard, { backgroundColor: theme.colors.surfaceElevated }]}>
              <Text style={[styles.aiCardTitle, { color: theme.colors.text }]}>
                Why this prediction?
              </Text>
              {shapExplanation.topFactors?.slice(0, 5).map((factor: any, index: number) => (
                <View key={index} style={styles.aiFactorRow}>
                  <Text style={[styles.aiFactorName, { color: theme.colors.text }]}>
                    {factor.feature}:
                  </Text>
                  <Text style={[styles.aiFactorValue, { color: theme.colors.accent }]}>
                    {factor.contribution}%
                  </Text>
                </View>
              ))}
            </View>
          )}

          {digitalTwinInsights && (
            <View style={[styles.aiCard, { backgroundColor: theme.colors.surfaceElevated }]}>
              <Text style={[styles.aiCardTitle, { color: theme.colors.text }]}>
                Fraudster Behavior Model
              </Text>
              <Text style={[styles.aiCardText, { color: theme.colors.text }]}>
                {digitalTwinInsights.predictedBehavior}
              </Text>
              {digitalTwinInsights.riskAdjustment !== 0 && (
                <Text style={[styles.aiCardText, { color: theme.colors.text }]}>
                  Risk Adjustment: {digitalTwinInsights.riskAdjustment > 0 ? '+' : ''}
                  {digitalTwinInsights.riskAdjustment}%
                </Text>
              )}
            </View>
          )}

          {crossBankData && (
            <View style={[styles.aiCard, { backgroundColor: theme.colors.surfaceElevated }]}>
              <Text style={[styles.aiCardTitle, { color: theme.colors.text }]}>
                Cross-Bank Intelligence
              </Text>
              <Text style={[styles.aiCardText, { color: theme.colors.text }]}>
                Linked Accounts: {crossBankData.linkedAccountCount}
              </Text>
              <Text style={[styles.aiCardText, { color: theme.colors.text }]}>
                Risk Score: {(crossBankData.riskScore * 100).toFixed(1)}%
              </Text>
              <Text style={[styles.aiCardNote, { color: theme.colors.textTertiary }]}>
                Privacy-safe: No raw data shared
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Dossier Section */}
      {data.dossier && (
        <>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Dossier</Text>
            
            <View style={[styles.dossierCard, { backgroundColor: theme.colors.surfaceElevated }]}>
              <Text style={[styles.dossierLabel, { color: theme.colors.textSecondary }]}>
                Victim (Anonymized)
              </Text>
              <Text style={[styles.dossierValue, { color: theme.colors.text }]}>
                ID: {data.dossier.victim.anonymizedId} | Age: {data.dossier.victim.age} | {data.dossier.victim.fraudType}
              </Text>
            </View>

            <View style={[styles.dossierCard, { backgroundColor: theme.colors.surfaceElevated }]}>
              <Text style={[styles.dossierLabel, { color: theme.colors.textSecondary }]}>
                Suspect Similarity
              </Text>
              <Text style={[styles.dossierValue, { color: theme.colors.text }]}>
                MO Match: {(data.dossier.suspect.similarityScore * 100).toFixed(1)}%
              </Text>
              <Text style={[styles.dossierSubtext, { color: theme.colors.textSecondary }]}>
                {data.dossier.suspect.modusOperandi}
              </Text>
            </View>
          </View>

          {/* Hotspots */}
          {data.dossier.hotspots && data.dossier.hotspots.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Predicted Hotspots
              </Text>
              {data.dossier.hotspots.map((hotspot, index) => (
                <View
                  key={hotspot.id}
                  style={[styles.hotspotCard, { backgroundColor: theme.colors.surfaceElevated }]}
                >
                  <View style={styles.hotspotHeader}>
                    <Text style={[styles.hotspotNumber, { color: theme.colors.primary }]}>
                      #{index + 1}
                    </Text>
                    <Text style={[styles.hotspotProbability, { color: theme.colors.warning }]}>
                      {(hotspot.probability * 100).toFixed(1)}% Probability
                    </Text>
                  </View>
                  <Text style={[styles.hotspotAddress, { color: theme.colors.text }]}>
                    {hotspot.address}
                  </Text>
                  {hotspot.atmDetails && (
                    <Text style={[styles.atmDetails, { color: theme.colors.textSecondary }]}>
                      {hotspot.atmDetails.bankName} - {hotspot.atmDetails.atmId}
                    </Text>
                  )}
                  <TouchableOpacity
                    style={[styles.arButton, { backgroundColor: theme.colors.accent }]}
                    onPress={() => handleNavigateToAR(hotspot)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="camera" size={20} color="#fff" />
                    <Text style={styles.arButtonText}>AR Field View</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {/* Map */}
      {mapRegion && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Location</Text>
          <View style={styles.mapContainer}>
            <MapView style={styles.map} region={mapRegion} scrollEnabled={false}>
              {data.dossier?.hotspots?.map((hotspot) => (
                <React.Fragment key={hotspot.id}>
                  <Marker coordinate={hotspot.location}>
                    <View style={styles.mapMarker}>
                      <Ionicons name="location" size={24} color={theme.colors.primary} />
                    </View>
                  </Marker>
                </React.Fragment>
              ))}
              {data.location && (
                <Marker coordinate={data.location}>
                  <View style={styles.mapMarker}>
                    <Ionicons name="location" size={24} color={theme.colors.primary} />
                  </View>
                </Marker>
              )}
            </MapView>
          </View>
        </View>
      )}

      {/* Action Bar */}
      <View style={[styles.actionBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.colors.surfaceElevated }]}
          onPress={handleNavigateToEvidence}
          activeOpacity={0.7}
        >
          <Ionicons name="camera-outline" size={20} color={theme.colors.text} />
          <Text style={[styles.actionButtonText, { color: theme.colors.text }]}>Evidence</Text>
        </TouchableOpacity>

        {data.dossier?.hotspots?.[0] && (
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton, { backgroundColor: theme.colors.accent }]}
            onPress={() => {
              const hotspot = (data as any).dossier?.hotspots?.[0];
              if (hotspot) {
                handleNavigateToAR(hotspot);
              }
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="navigate" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Navigate</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.cordonButton, { backgroundColor: theme.colors.error }]}
          onPress={handleActivateCordon}
          activeOpacity={0.7}
        >
          <Ionicons name="shield" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Freeze</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 24,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 16,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
  },
  aiCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  aiCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  aiCardText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  aiCardNote: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
  },
  aiFactorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    alignItems: 'center',
  },
  aiFactorName: {
    fontSize: 14,
    flex: 1,
  },
  aiFactorValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  dossierCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  dossierLabel: {
    fontSize: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  dossierValue: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  dossierSubtext: {
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },
  hotspotCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  hotspotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  hotspotNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  hotspotProbability: {
    fontSize: 14,
    fontWeight: '700',
  },
  hotspotAddress: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    lineHeight: 22,
  },
  atmDetails: {
    fontSize: 13,
    marginBottom: 12,
  },
  arButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    gap: 8,
  },
  arButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  mapContainer: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  mapMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBar: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 0.5,
    paddingBottom: 32,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    padding: 14,
    gap: 8,
    minHeight: 52,
  },
  primaryButton: {},
  cordonButton: {},
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
});
