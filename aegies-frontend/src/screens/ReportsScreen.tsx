import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { apiService } from '../services/api';
import { reportService } from '../api/reportService';
import { useTheme } from '../theme/theme';
import { LinearGradient } from 'expo-linear-gradient';

export default function ReportsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    phoneNumber: '',
    transactionId: '',
    bankName: '',
    accountNumber: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [reportHistory, setReportHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    // Load mock data immediately for better UX
    setReportHistory(getMockReportHistory());
    // Then try to load real data
    loadReportHistory();
  }, []);

  const getMockReportHistory = () => {
    return [
      {
        reportId: 'NCRP-2025-8891',
        status: 'analyzed',
        scamType: 'UPI Fraud',
        amount: 120000,
        submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        predictionAvailable: true,
        photos: [],
      },
      {
        reportId: 'NCRP-2025-8892',
        status: 'processing',
        scamType: 'Loan App Scam',
        amount: 85000,
        submittedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        predictionAvailable: false,
        photos: [],
      },
      {
        reportId: 'NCRP-2025-8893',
        status: 'action_taken',
        scamType: 'Job Scam',
        amount: 95000,
        submittedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        predictionAvailable: true,
        photos: [],
      },
      {
        reportId: 'NCRP-2025-8894',
        status: 'resolved',
        scamType: 'Investment Fraud',
        amount: 150000,
        submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        predictionAvailable: true,
        photos: [],
      },
    ];
  };

  const loadReportHistory = async () => {
    setLoadingHistory(true);
    try {
      const history = await reportService.getReportHistory();
      if (history && history.length > 0) {
        setReportHistory(history);
      } else {
        // Use mock data for better clarity
        setReportHistory(getMockReportHistory());
      }
    } catch (error) {
      console.error('Error loading report history:', error);
      // Use mock data on error
      setReportHistory(getMockReportHistory());
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.amount || !formData.description || !formData.phoneNumber) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    const result = await apiService.submitReport({
      ...formData,
      amount: parseFloat(formData.amount),
      timestamp: new Date().toISOString(),
    });

    setSubmitting(false);

    if (result.success) {
      Alert.alert(
        'Report Submitted',
        `Your complaint has been registered with ID: ${result.reportId}\n\nAEGIS will analyze and predict withdrawal locations.`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset form
              setFormData({
                amount: '',
                description: '',
                phoneNumber: '',
                transactionId: '',
                bankName: '',
                accountNumber: '',
              });
            },
          },
        ]
      );
    } else {
      Alert.alert('Error', result.error || 'Failed to submit report');
    }
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={
        <RefreshControl refreshing={loadingHistory} onRefresh={loadReportHistory} />
      }
    >
      {/* Header with Quick Actions */}
      <LinearGradient
        colors={[theme.colors.primary + '20', theme.colors.background]}
        style={styles.header}
      >
        <View style={[styles.iconCircle, { backgroundColor: theme.colors.primary + '15' }]}>
          <Ionicons name="document-text" size={48} color={theme.colors.primary} />
        </View>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Report Cyber Fraud
        </Text>
        <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
          Submit a complaint to NCRP via AEGIS
        </Text>
        
        {/* Quick Action Buttons */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.quickActionButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => navigation.navigate('AdvancedReport' as never)}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={20} color="#FFF" />
            <Text style={styles.quickActionText}>New Advanced Report</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickActionButton, styles.historyButton, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}
            onPress={() => setShowHistory(!showHistory)}
            activeOpacity={0.8}
          >
            <Ionicons name="time-outline" size={20} color={theme.colors.text} />
            <Text style={[styles.quickActionText, { color: theme.colors.text }]}>
              {showHistory ? 'Hide' : 'Show'} History
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Report History */}
      {showHistory && (
        <View style={styles.historySection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Report History
          </Text>
          {reportHistory.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.colors.surfaceElevated }]}>
              <Ionicons name="document-outline" size={48} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
                No reports submitted yet
              </Text>
            </View>
          ) : (
            reportHistory.map((report) => (
              <View key={report.reportId} style={[styles.historyCard, { backgroundColor: theme.colors.surfaceElevated }]}>
                <View style={styles.historyHeader}>
                  <Text style={[styles.historyId, { color: theme.colors.primary }]}>
                    {report.reportId}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(report.status) }]}>
                      {report.status}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.historyScamType, { color: theme.colors.text }]}>
                  {report.scamType}
                </Text>
                <Text style={[styles.historyAmount, { color: theme.colors.text }]}>
                  ₹{report.amount.toLocaleString()}
                </Text>
                <Text style={[styles.historyDate, { color: theme.colors.textSecondary }]}>
                  {new Date(report.submittedAt).toLocaleDateString()}
                </Text>
                {report.predictionAvailable && (
                  <View style={[styles.predictionBadge, { backgroundColor: theme.colors.info + '20' }]}>
                    <Ionicons name="analytics" size={14} color={theme.colors.info} />
                    <Text style={[styles.predictionText, { color: theme.colors.info }]}>
                      Prediction Available
                    </Text>
                  </View>
                )}
                {/* Display Photos/Screenshots if available */}
                {report.photos && report.photos.length > 0 && (
                  <View style={styles.photosSection}>
                    <Text style={[styles.photosLabel, { color: theme.colors.textSecondary }]}>
                      Screenshots/Photos ({report.photos.length}):
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
                      {report.photos.map((photoUri: string, photoIndex: number) => (
                        <TouchableOpacity
                          key={photoIndex}
                          style={styles.photoThumbnail}
                          onPress={() => setSelectedPhoto(photoUri)}
                          activeOpacity={0.8}
                        >
                          <Image source={{ uri: photoUri }} style={styles.photoThumbnailImage} />
                          <View style={[styles.photoOverlay, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
                            <Ionicons name="expand" size={16} color="#fff" />
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      )}

      {/* Simple Form Section */}
      <View style={styles.simpleFormSection}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Quick Report (Simple)
        </Text>
        <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
          For a more detailed report with location, photos, and advanced features, use "New Advanced Report" above
        </Text>

        <View style={styles.form}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Incident Details
          </Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Amount Stolen (₹) <Text style={[styles.required, { color: theme.colors.error }]}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.surfaceElevated,
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                },
              ]}
              placeholder="Enter amount"
              placeholderTextColor={theme.colors.textTertiary}
              value={formData.amount}
              onChangeText={(text) => setFormData({ ...formData, amount: text })}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Description <Text style={[styles.required, { color: theme.colors.error }]}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                {
                  backgroundColor: theme.colors.surfaceElevated,
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                },
              ]}
              placeholder="Describe the incident..."
              placeholderTextColor={theme.colors.textTertiary}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Phone Number <Text style={[styles.required, { color: theme.colors.error }]}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.surfaceElevated,
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                },
              ]}
              placeholder="Your phone number"
              placeholderTextColor={theme.colors.textTertiary}
              value={formData.phoneNumber}
              onChangeText={(text) => setFormData({ ...formData, phoneNumber: text })}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Transaction Information
          </Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Transaction ID</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.surfaceElevated,
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                },
              ]}
              placeholder="If available"
              placeholderTextColor={theme.colors.textTertiary}
              value={formData.transactionId}
              onChangeText={(text) => setFormData({ ...formData, transactionId: text })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Bank Name</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.surfaceElevated,
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                },
              ]}
              placeholder="Your bank name"
              placeholderTextColor={theme.colors.textTertiary}
              value={formData.bankName}
              onChangeText={(text) => setFormData({ ...formData, bankName: text })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Account Number</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.surfaceElevated,
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                },
              ]}
              placeholder="Your account number"
              placeholderTextColor={theme.colors.textTertiary}
              value={formData.accountNumber}
              onChangeText={(text) => setFormData({ ...formData, accountNumber: text })}
              keyboardType="numeric"
              secureTextEntry
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Submit Report</Text>
            </>
          )}
        </TouchableOpacity>

        <View
          style={[
            styles.infoBox,
            {
              backgroundColor: theme.colors.info + '15',
              borderColor: theme.colors.info + '30',
            },
          ]}
        >
          <Ionicons name="information-circle-outline" size={20} color={theme.colors.info} />
          <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
            Your report will be processed by AEGIS AI to predict withdrawal locations. Law
            enforcement will be automatically notified.
          </Text>
        </View>
        </View>
      </View>

      {/* Photo View Modal */}
      <Modal
        visible={selectedPhoto !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <View style={styles.photoModal}>
          <TouchableOpacity
            style={styles.photoModalClose}
            onPress={() => setSelectedPhoto(null)}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle" size={32} color="#fff" />
          </TouchableOpacity>
          {selectedPhoto && (
            <Image source={{ uri: selectedPhoto }} style={styles.photoModalImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    padding: 30,
    paddingTop: 60,
    paddingBottom: 24,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 20,
  },
  form: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
  required: {
    fontWeight: '700',
  },
  input: {
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    minHeight: 52,
  },
  textArea: {
    height: 120,
    paddingTop: 16,
  },
  submitButton: {
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 24,
    gap: 10,
    minHeight: 56,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  infoBox: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    width: '100%',
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  historyButton: {
    borderWidth: 1.5,
  },
  quickActionText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  historySection: {
    padding: 20,
  },
  simpleFormSection: {
    padding: 20,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 18,
  },
  emptyState: {
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  historyCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyId: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  historyScamType: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  historyAmount: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 12,
    marginTop: 4,
  },
  predictionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
    gap: 6,
  },
  predictionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  photosSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  photosLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  photosScroll: {
    marginHorizontal: -4,
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  photoThumbnailImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  photoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  photoModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
  },
  photoModalImage: {
    width: '90%',
    height: '80%',
  },
});

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'submitted':
      return '#2196F3';
    case 'processing':
      return '#FF9800';
    case 'analyzed':
      return '#9C27B0';
    case 'action_taken':
      return '#4CAF50';
    case 'resolved':
      return '#4CAF50';
    case 'closed':
      return '#757575';
    default:
      return '#757575';
  }
};

