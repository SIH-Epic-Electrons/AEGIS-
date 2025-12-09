/**
 * Advanced Report Booking Screen
 * Modern multi-step form with smart validation, location capture,
 * photo upload, and seamless workflow integration
 */

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
  Modal,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/theme';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { reportService } from '../api/reportService';
import { predictiveAnalyticsService } from '../api/predictiveAnalyticsService';

const STEPS = [
  { id: 1, title: 'Incident Type', icon: 'shield-outline' },
  { id: 2, title: 'Details', icon: 'document-text-outline' },
  { id: 3, title: 'Transaction', icon: 'cash-outline' },
  { id: 4, title: 'Location', icon: 'location-outline' },
  { id: 5, title: 'Evidence', icon: 'camera-outline' },
  { id: 6, title: 'Review', icon: 'checkmark-circle-outline' },
];

const SCAM_TYPES = [
  { id: 'upi_fraud', label: 'UPI Fraud', icon: 'phone-portrait', description: 'Unauthorized UPI transactions' },
  { id: 'loan_app', label: 'Fake Loan App', icon: 'cash', description: 'Fake loan application scams' },
  { id: 'job_scam', label: 'Job Scam', icon: 'briefcase', description: 'Fake job offers' },
  { id: 'investment', label: 'Investment Fraud', icon: 'trending-up', description: 'Ponzi schemes, fake investments' },
  { id: 'impersonation', label: 'Impersonation', icon: 'person', description: 'Bank/CBI/Govt official impersonation' },
  { id: 'romance', label: 'Romance Scam', icon: 'heart', description: 'Dating/relationship scams' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal', description: 'Other cyber fraud' },
];

interface ReportFormData {
  // Step 1: Incident Type
  scamType: string;
  
  // Step 2: Details
  amount: string;
  description: string;
  incidentDate: string;
  incidentTime: string;
  
  // Step 3: Transaction
  transactionId: string;
  bankName: string;
  accountNumber: string;
  upiId: string;
  beneficiaryName: string;
  
  // Step 4: Location
  location: {
    latitude: number;
    longitude: number;
    address: string;
  } | null;
  
  // Step 5: Evidence
  photos: string[];
  documents: string[];
  
  // Step 6: Contact
  phoneNumber: string;
  email: string;
  aadhaarNumber: string;
}

export default function AdvancedReportScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<ReportFormData>({
    scamType: '',
    amount: '',
    description: '',
    incidentDate: new Date().toISOString().split('T')[0],
    incidentTime: new Date().toTimeString().slice(0, 5),
    transactionId: '',
    bankName: '',
    accountNumber: '',
    upiId: '',
    beneficiaryName: '',
    location: null,
    photos: [],
    documents: [],
    phoneNumber: '',
    email: '',
    aadhaarNumber: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);

  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    await Location.requestForegroundPermissionsAsync();
    await ImagePicker.requestMediaLibraryPermissionsAsync();
    await ImagePicker.requestCameraPermissionsAsync();
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1:
        if (!formData.scamType) {
          newErrors.scamType = 'Please select a scam type';
        }
        break;
      case 2:
        if (!formData.amount || parseFloat(formData.amount) <= 0) {
          newErrors.amount = 'Please enter a valid amount';
        }
        if (!formData.description || formData.description.length < 20) {
          newErrors.description = 'Description must be at least 20 characters';
        }
        break;
      case 3:
        // Optional fields, no validation needed
        break;
      case 4:
        if (!formData.location) {
          newErrors.location = 'Please capture your location';
        }
        break;
      case 5:
        // Optional, but recommended
        break;
      case 6:
        if (!formData.phoneNumber || formData.phoneNumber.length < 10) {
          newErrors.phoneNumber = 'Please enter a valid phone number';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < STEPS.length) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCaptureLocation = async () => {
    try {
      setLoadingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (!location || !location.coords || 
          location.coords.latitude === undefined || 
          location.coords.longitude === undefined) {
        Alert.alert('Error', 'Unable to get location coordinates');
        return;
      }

      // Reverse geocode to get address
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      const addressString = [
        address?.street,
        address?.city,
        address?.region,
        address?.postalCode,
      ]
        .filter(Boolean)
        .join(', ');

      setFormData({
        ...formData,
        location: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          address: addressString || 'Location captured',
        },
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to capture location');
    } finally {
      setLoadingLocation(false);
    }
  };

  const handlePickImage = async () => {
    try {
      // Request permissions if not already granted
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant photo library access to select screenshots');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All, // Allow all media types
        allowsEditing: false, // No editing restriction
        quality: 1.0, // Full quality, no compression
        allowsMultipleSelection: true, // Allow multiple images
        selectionLimit: 0, // No limit on number of images
        exif: false, // Don't include EXIF data
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newPhotos = result.assets.map(asset => asset.uri);
        setFormData({
          ...formData,
          photos: [...formData.photos, ...newPhotos],
        });
        Alert.alert('Success', `${newPhotos.length} image(s) added successfully`);
      }
    } catch (error: any) {
      console.error('Image picker error:', error);
      Alert.alert('Error', error.message || 'Failed to pick image. Please try again.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      // Request camera permissions if not already granted
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera access to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false, // No editing restriction
        quality: 1.0, // Full quality, no compression
        exif: false, // Don't include EXIF data
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setFormData({
          ...formData,
          photos: [...formData.photos, result.assets[0].uri],
        });
        Alert.alert('Success', 'Photo captured and added successfully');
      }
    } catch (error: any) {
      console.error('Camera error:', error);
      Alert.alert('Error', error.message || 'Failed to take photo. Please try again.');
    }
  };

  // New function to handle screenshot selection specifically
  const handleSelectScreenshots = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant photo library access to select screenshots');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1.0,
        allowsMultipleSelection: true,
        selectionLimit: 0,
        exif: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newPhotos = result.assets.map(asset => asset.uri);
        setFormData({
          ...formData,
          photos: [...formData.photos, ...newPhotos],
        });
        Alert.alert('Success', `${newPhotos.length} screenshot(s) added successfully`);
      }
    } catch (error: any) {
      console.error('Screenshot selection error:', error);
      Alert.alert('Error', error.message || 'Failed to select screenshots. Please try again.');
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(6)) {
      return;
    }

    setSubmitting(true);
    try {
      // Submit report
      const reportData: any = {
        ...formData,
        amount: parseFloat(formData.amount),
        timestamp: new Date().toISOString(),
      };
      // Ensure location is not null
      if (!reportData.location) {
        reportData.location = {
          latitude: 0,
          longitude: 0,
          address: 'Unknown',
        };
      }
      const reportResult = await reportService.submitReport(reportData);

      if (reportResult.success && reportResult.reportId) {
        setReportId(reportResult.reportId);
        
        // Trigger prediction if high-value report
        if (parseFloat(formData.amount) >= 50000) {
          try {
            await predictiveAnalyticsService.getPrediction({
              complaint_id: reportResult.reportId,
              scam_type: formData.scamType,
              amount_bin: getAmountBin(parseFloat(formData.amount)),
              victim_region: {
                lat: formData.location?.latitude || 0,
                lon: formData.location?.longitude || 0,
              },
              fraud_time: new Date().toISOString(),
              state_code: 'UNKNOWN',
            });
          } catch (error) {
            // Prediction trigger failed, but report is submitted
            console.error('Failed to trigger prediction:', error);
          }
        }

        setShowSuccessModal(true);
      } else {
        Alert.alert('Error', reportResult.error || 'Failed to submit report');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getAmountBin = (amount: number): string => {
    if (amount < 50000) return '0-50K';
    if (amount < 100000) return '50K-1L';
    if (amount < 200000) return '1L-2L';
    if (amount < 500000) return '2L-5L';
    if (amount < 1000000) return '5L-10L';
    return '10L+';
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {STEPS.map((step, index) => (
        <React.Fragment key={step.id}>
          <TouchableOpacity
            style={styles.stepItem}
            onPress={() => {
              if (step.id <= currentStep) {
                setCurrentStep(step.id);
              }
            }}
            disabled={step.id > currentStep}
          >
            <View
              style={[
                styles.stepCircle,
                {
                  backgroundColor:
                    step.id === currentStep
                      ? theme.colors.primary
                      : step.id < currentStep
                      ? '#4CAF50'
                      : theme.colors.surfaceElevated,
                },
              ]}
            >
              {step.id < currentStep ? (
                <Ionicons name="checkmark" size={20} color="#FFF" />
              ) : (
                <Ionicons name={step.icon as any} size={20} color={step.id === currentStep ? '#FFF' : theme.colors.textSecondary} />
              )}
            </View>
            <Text
              style={[
                styles.stepLabel,
                {
                  color:
                    step.id === currentStep
                      ? theme.colors.primary
                      : step.id < currentStep
                      ? '#4CAF50'
                      : theme.colors.textSecondary,
                },
              ]}
            >
              {step.title}
            </Text>
          </TouchableOpacity>
          {index < STEPS.length - 1 && (
            <View
              style={[
                styles.stepLine,
                {
                  backgroundColor:
                    step.id < currentStep ? '#4CAF50' : theme.colors.border,
                },
              ]}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
        What type of fraud occurred?
      </Text>
      <Text style={[styles.stepSubtitle, { color: theme.colors.textSecondary }]}>
        Select the category that best describes your incident
      </Text>

      <View style={styles.scamTypeGrid}>
        {SCAM_TYPES.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={[
              styles.scamTypeCard,
              {
                backgroundColor:
                  formData.scamType === type.id
                    ? theme.colors.primary + '20'
                    : theme.colors.surfaceElevated,
                borderColor:
                  formData.scamType === type.id
                    ? theme.colors.primary
                    : theme.colors.border,
              },
            ]}
            onPress={() => setFormData({ ...formData, scamType: type.id })}
            activeOpacity={0.7}
          >
            <Ionicons
              name={type.icon as any}
              size={32}
              color={formData.scamType === type.id ? theme.colors.primary : theme.colors.textSecondary}
            />
            <Text
              style={[
                styles.scamTypeLabel,
                {
                  color:
                    formData.scamType === type.id
                      ? theme.colors.primary
                      : theme.colors.text,
                },
              ]}
            >
              {type.label}
            </Text>
            <Text
              style={[
                styles.scamTypeDescription,
                { color: theme.colors.textSecondary },
              ]}
            >
              {type.description}
            </Text>
            {formData.scamType === type.id && (
              <View style={[styles.checkmark, { backgroundColor: theme.colors.primary }]}>
                <Ionicons name="checkmark" size={16} color="#FFF" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
      {errors.scamType && (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {errors.scamType}
        </Text>
      )}
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
        Incident Details
      </Text>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>
          Amount Stolen (₹) <Text style={[styles.required, { color: theme.colors.error }]}>*</Text>
        </Text>
        <View style={[styles.inputContainer, { backgroundColor: theme.colors.surfaceElevated, borderColor: errors.amount ? theme.colors.error : theme.colors.border }]}>
          <Text style={[styles.currencySymbol, { color: theme.colors.textSecondary }]}>₹</Text>
          <TextInput
            style={[styles.input, { color: theme.colors.text }]}
            placeholder="0.00"
            placeholderTextColor={theme.colors.textTertiary}
            value={formData.amount}
            onChangeText={(text) => {
              setFormData({ ...formData, amount: text.replace(/[^0-9.]/g, '') });
              if (errors.amount) setErrors({ ...errors, amount: '' });
            }}
            keyboardType="numeric"
          />
        </View>
        {errors.amount && (
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {errors.amount}
          </Text>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>
          Incident Date <Text style={[styles.required, { color: theme.colors.error }]}>*</Text>
        </Text>
        <View style={styles.dateTimeRow}>
          <View style={[styles.inputContainer, { backgroundColor: theme.colors.surfaceElevated, flex: 1 }]}>
            <Ionicons name="calendar-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.colors.textTertiary}
              value={formData.incidentDate}
              onChangeText={(text) => setFormData({ ...formData, incidentDate: text })}
            />
          </View>
          <View style={[styles.inputContainer, { backgroundColor: theme.colors.surfaceElevated, flex: 1, marginLeft: 12 }]}>
            <Ionicons name="time-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="HH:MM"
              placeholderTextColor={theme.colors.textTertiary}
              value={formData.incidentTime}
              onChangeText={(text) => setFormData({ ...formData, incidentTime: text })}
            />
          </View>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>
          Description <Text style={[styles.required, { color: theme.colors.error }]}>*</Text>
        </Text>
        <TextInput
          style={[
            styles.textArea,
            {
              backgroundColor: theme.colors.surfaceElevated,
              color: theme.colors.text,
              borderColor: errors.description ? theme.colors.error : theme.colors.border,
            },
          ]}
          placeholder="Describe what happened in detail (minimum 20 characters)..."
          placeholderTextColor={theme.colors.textTertiary}
          value={formData.description}
          onChangeText={(text) => {
            setFormData({ ...formData, description: text });
            if (errors.description) setErrors({ ...errors, description: '' });
          }}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />
        <Text style={[styles.charCount, { color: theme.colors.textSecondary }]}>
          {formData.description.length}/500 characters
        </Text>
        {errors.description && (
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {errors.description}
          </Text>
        )}
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
        Transaction Information
      </Text>
      <Text style={[styles.stepSubtitle, { color: theme.colors.textSecondary }]}>
        Provide transaction details if available (all fields optional)
      </Text>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>Transaction ID / UTR</Text>
        <View style={[styles.inputContainer, { backgroundColor: theme.colors.surfaceElevated }]}>
          <Ionicons name="receipt-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: theme.colors.text }]}
            placeholder="Enter transaction ID"
            placeholderTextColor={theme.colors.textTertiary}
            value={formData.transactionId}
            onChangeText={(text) => setFormData({ ...formData, transactionId: text })}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>UPI ID / VPA</Text>
        <View style={[styles.inputContainer, { backgroundColor: theme.colors.surfaceElevated }]}>
          <Ionicons name="phone-portrait-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: theme.colors.text }]}
            placeholder="example@paytm"
            placeholderTextColor={theme.colors.textTertiary}
            value={formData.upiId}
            onChangeText={(text) => setFormData({ ...formData, upiId: text })}
            autoCapitalize="none"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>Beneficiary Name</Text>
        <View style={[styles.inputContainer, { backgroundColor: theme.colors.surfaceElevated }]}>
          <Ionicons name="person-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: theme.colors.text }]}
            placeholder="Name of the fraudster (if known)"
            placeholderTextColor={theme.colors.textTertiary}
            value={formData.beneficiaryName}
            onChangeText={(text) => setFormData({ ...formData, beneficiaryName: text })}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>Your Bank Name</Text>
        <View style={[styles.inputContainer, { backgroundColor: theme.colors.surfaceElevated }]}>
          <Ionicons name="business-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: theme.colors.text }]}
            placeholder="e.g., SBI, HDFC, ICICI"
            placeholderTextColor={theme.colors.textTertiary}
            value={formData.bankName}
            onChangeText={(text) => setFormData({ ...formData, bankName: text })}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>Your Account Number</Text>
        <View style={[styles.inputContainer, { backgroundColor: theme.colors.surfaceElevated }]}>
          <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: theme.colors.text }]}
            placeholder="Enter account number"
            placeholderTextColor={theme.colors.textTertiary}
            value={formData.accountNumber}
            onChangeText={(text) => setFormData({ ...formData, accountNumber: text })}
            keyboardType="numeric"
            secureTextEntry
          />
        </View>
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
        Incident Location
      </Text>
      <Text style={[styles.stepSubtitle, { color: theme.colors.textSecondary }]}>
        Capture your current location or where the incident occurred
      </Text>

      {formData.location ? (
        <View style={[styles.locationCard, { backgroundColor: theme.colors.surfaceElevated }]}>
          <View style={styles.locationHeader}>
            <Ionicons name="location" size={24} color={theme.colors.primary} />
            <Text style={[styles.locationTitle, { color: theme.colors.text }]}>
              Location Captured
            </Text>
          </View>
          <Text style={[styles.locationAddress, { color: theme.colors.textSecondary }]}>
            {formData.location?.address || 'No address'}
          </Text>
          {formData.location?.latitude !== undefined && formData.location?.longitude !== undefined && (
            <Text style={[styles.locationCoords, { color: theme.colors.textTertiary }]}>
              {formData.location.latitude.toFixed(6)}, {formData.location.longitude.toFixed(6)}
            </Text>
          )}
          <TouchableOpacity
            style={[styles.changeLocationButton, { borderColor: theme.colors.border }]}
            onPress={handleCaptureLocation}
          >
            <Ionicons name="refresh" size={18} color={theme.colors.text} />
            <Text style={[styles.changeLocationText, { color: theme.colors.text }]}>
              Change Location
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.captureLocationButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleCaptureLocation}
          disabled={loadingLocation}
        >
          {loadingLocation ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="location" size={24} color="#FFF" />
              <Text style={styles.captureLocationText}>Capture Location</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {errors.location && (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {errors.location}
        </Text>
      )}

      <View style={[styles.infoBox, { backgroundColor: theme.colors.info + '15' }]}>
        <Ionicons name="information-circle-outline" size={18} color={theme.colors.info} />
        <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
          Your location helps AEGIS predict nearby withdrawal hotspots more accurately
        </Text>
      </View>
    </View>
  );

  const renderStep5 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
        Evidence (Optional)
      </Text>
      <Text style={[styles.stepSubtitle, { color: theme.colors.textSecondary }]}>
        Add photos or screenshots of transactions, messages, etc. No restrictions - add as many as needed.
      </Text>

      <View style={styles.photoActions}>
        <TouchableOpacity
          style={[styles.photoButton, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}
          onPress={handleTakePhoto}
        >
          <Ionicons name="camera" size={24} color={theme.colors.primary} />
          <Text style={[styles.photoButtonText, { color: theme.colors.text }]}>
            Take Photo
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.photoButton, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}
          onPress={handleSelectScreenshots}
        >
          <Ionicons name="image" size={24} color={theme.colors.primary} />
          <Text style={[styles.photoButtonText, { color: theme.colors.text }]}>
            Add Screenshots
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.photoButton, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}
          onPress={handlePickImage}
        >
          <Ionicons name="images" size={24} color={theme.colors.primary} />
          <Text style={[styles.photoButtonText, { color: theme.colors.text }]}>
            Choose Photos
          </Text>
        </TouchableOpacity>
      </View>

      {formData.photos.length > 0 && (
        <View style={styles.photosGrid}>
          {formData.photos.map((uri, index) => (
            <View key={index} style={styles.photoItem}>
              <Image source={{ uri }} style={styles.photoPreview} />
              <TouchableOpacity
                style={styles.removePhotoButton}
                onPress={() => {
                  setFormData({
                    ...formData,
                    photos: formData.photos.filter((_, i) => i !== index),
                  });
                }}
              >
                <Ionicons name="close-circle" size={24} color={theme.colors.error} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderStep6 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
        Contact Information
      </Text>
      <Text style={[styles.stepSubtitle, { color: theme.colors.textSecondary }]}>
        We'll use this to contact you about your report
      </Text>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>
          Phone Number <Text style={[styles.required, { color: theme.colors.error }]}>*</Text>
        </Text>
        <View style={[styles.inputContainer, { backgroundColor: theme.colors.surfaceElevated, borderColor: errors.phoneNumber ? theme.colors.error : theme.colors.border }]}>
          <Ionicons name="call-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: theme.colors.text }]}
            placeholder="10-digit mobile number"
            placeholderTextColor={theme.colors.textTertiary}
            value={formData.phoneNumber}
            onChangeText={(text) => {
              setFormData({ ...formData, phoneNumber: text.replace(/[^0-9]/g, '').slice(0, 10) });
              if (errors.phoneNumber) setErrors({ ...errors, phoneNumber: '' });
            }}
            keyboardType="phone-pad"
            maxLength={10}
          />
        </View>
        {errors.phoneNumber && (
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {errors.phoneNumber}
          </Text>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>Email (Optional)</Text>
        <View style={[styles.inputContainer, { backgroundColor: theme.colors.surfaceElevated }]}>
          <Ionicons name="mail-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: theme.colors.text }]}
            placeholder="your.email@example.com"
            placeholderTextColor={theme.colors.textTertiary}
            value={formData.email}
            onChangeText={(text) => setFormData({ ...formData, email: text })}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.colors.text }]}>Aadhaar Number (Optional)</Text>
        <View style={[styles.inputContainer, { backgroundColor: theme.colors.surfaceElevated }]}>
          <Ionicons name="id-card-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: theme.colors.text }]}
            placeholder="12-digit Aadhaar"
            placeholderTextColor={theme.colors.textTertiary}
            value={formData.aadhaarNumber}
            onChangeText={(text) => setFormData({ ...formData, aadhaarNumber: text.replace(/[^0-9]/g, '').slice(0, 12) })}
            keyboardType="numeric"
            maxLength={12}
            secureTextEntry
          />
        </View>
      </View>

      {/* Review Summary */}
      <View style={[styles.reviewCard, { backgroundColor: theme.colors.surfaceElevated }]}>
        <Text style={[styles.reviewTitle, { color: theme.colors.text }]}>Report Summary</Text>
        <ReviewRow label="Scam Type" value={SCAM_TYPES.find((s) => s.id === formData.scamType)?.label || 'Not selected'} theme={theme} />
        <ReviewRow label="Amount" value={`₹${parseFloat(formData.amount || '0').toLocaleString()}`} theme={theme} />
        <ReviewRow label="Location" value={formData.location?.address || 'Not captured'} theme={theme} />
        <ReviewRow label="Photos" value={`${formData.photos.length} attached`} theme={theme} />
        
        {/* Photo Preview in Review */}
        {formData.photos.length > 0 && (
          <View style={styles.reviewPhotosSection}>
            <Text style={[styles.reviewPhotosTitle, { color: theme.colors.text }]}>
              Attached Screenshots/Photos:
            </Text>
            <View style={styles.reviewPhotosGrid}>
              {formData.photos.map((uri, index) => (
                <View key={index} style={styles.reviewPhotoItem}>
                  <Image source={{ uri }} style={styles.reviewPhotoPreview} />
                  <View style={[styles.reviewPhotoBadge, { backgroundColor: theme.colors.primary + '20' }]}>
                    <Text style={[styles.reviewPhotoBadgeText, { color: theme.colors.primary }]}>
                      {index + 1}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.editPhotosButton, { borderColor: theme.colors.border }]}
              onPress={() => setCurrentStep(5)}
            >
              <Ionicons name="pencil" size={16} color={theme.colors.primary} />
              <Text style={[styles.editPhotosText, { color: theme.colors.primary }]}>
                Edit Photos
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderStep5();
      case 6:
        return renderStep6();
      default:
        return null;
    }
  };

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
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Report Cyber Fraud
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            Step {currentStep} of {STEPS.length}
          </Text>
        </View>
      </LinearGradient>

      {/* Step Indicator */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stepIndicatorContainer}>
        {renderStepIndicator()}
      </ScrollView>

      {/* Step Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {renderCurrentStep()}
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={[styles.navigation, { backgroundColor: theme.colors.surfaceElevated, borderTopColor: theme.colors.border }]}>
        {currentStep > 1 && (
          <TouchableOpacity
            style={[styles.navButton, styles.backNavButton, { borderColor: theme.colors.border }]}
            onPress={handleBack}
          >
            <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
            <Text style={[styles.navButtonText, { color: theme.colors.text }]}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.navButton,
            styles.nextNavButton,
            { backgroundColor: theme.colors.primary },
            currentStep === STEPS.length && { flex: 1 },
          ]}
          onPress={currentStep === STEPS.length ? handleSubmit : handleNext}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Text style={styles.navButtonText}>
                {currentStep === STEPS.length ? 'Submit Report' : 'Next'}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowSuccessModal(false);
          navigation.goBack();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surfaceElevated }]}>
            <View style={[styles.successIcon, { backgroundColor: '#4CAF5020' }]}>
              <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
            </View>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Report Submitted Successfully!
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
              Your complaint has been registered
            </Text>
            {reportId && (
              <View style={[styles.reportIdBox, { backgroundColor: theme.colors.background }]}>
                <Text style={[styles.reportIdLabel, { color: theme.colors.textSecondary }]}>
                  Report ID
                </Text>
                <Text style={[styles.reportId, { color: theme.colors.primary }]}>
                  {reportId}
                </Text>
              </View>
            )}
            <Text style={[styles.modalMessage, { color: theme.colors.textSecondary }]}>
              AEGIS AI is analyzing your report and will predict withdrawal locations. Law enforcement will be automatically notified.
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => {
                setShowSuccessModal(false);
                navigation.goBack();
              }}
            >
              <Text style={styles.modalButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ReviewRow({ label, value, theme }: { label: string; value: string; theme: any }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={[styles.reviewLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.reviewValue, { color: theme.colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  stepIndicatorContainer: {
    maxHeight: 100,
    paddingVertical: 16,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  stepItem: {
    alignItems: 'center',
    minWidth: 70,
  },
  stepCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  stepLine: {
    width: 40,
    height: 2,
    marginHorizontal: 8,
    marginBottom: 24,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  stepContent: {
    gap: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 24,
    lineHeight: 20,
  },
  scamTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  scamTypeCard: {
    width: '47%',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    position: 'relative',
  },
  scamTypeLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  scamTypeDescription: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  required: {
    fontWeight: '700',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  inputIcon: {
    marginRight: 12,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
  },
  textArea: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 16,
    minHeight: 120,
    fontSize: 16,
  },
  charCount: {
    fontSize: 12,
    marginTop: 6,
    textAlign: 'right',
  },
  dateTimeRow: {
    flexDirection: 'row',
  },
  locationCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  locationAddress: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  locationCoords: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  changeLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  changeLocationText: {
    fontSize: 14,
    fontWeight: '600',
  },
  captureLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 12,
    marginBottom: 16,
  },
  captureLocationText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  photoActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 8,
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoItem: {
    width: 100,
    height: 100,
    borderRadius: 12,
    position: 'relative',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  reviewCard: {
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
  },
  reviewPhotosSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  reviewPhotosTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  reviewPhotosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  reviewPhotoItem: {
    width: 80,
    height: 80,
    borderRadius: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  reviewPhotoPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  reviewPhotoBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewPhotoBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  editPhotosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  editPhotosText: {
    fontSize: 13,
    fontWeight: '600',
  },
  reviewTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  reviewLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  reviewValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    marginTop: 6,
  },
  infoBox: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginTop: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  navigation: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  backNavButton: {
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  nextNavButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  navButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  reportIdBox: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    width: '100%',
    alignItems: 'center',
  },
  reportIdLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  reportId: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  modalMessage: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

