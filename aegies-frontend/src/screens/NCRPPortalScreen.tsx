/**
 * NCRP Portal Screen - National Cyber Crime Reporting Portal
 * Allows citizens to register fraud complaints that feed into AEGIS
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { caseService, CreateCaseRequest, CreateCaseResponse } from '../api/caseService';
import { validateIFSC, formatIFSC, normalizeIFSC } from '../utils/validators';
import { locationService } from '../services/locationService';
import * as Location from 'expo-location';

// Custom Dropdown Component
interface DropdownOption {
  label: string;
  value: string;
}

interface DropdownProps {
  options: DropdownOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  placeholder?: string;
}

const Dropdown: React.FC<DropdownProps> = ({ options, selectedValue, onSelect, placeholder = 'Select...' }) => {
  const [visible, setVisible] = useState(false);
  const selectedOption = options.find(opt => opt.value === selectedValue);

  return (
    <>
      <TouchableOpacity
        style={dropdownStyles.selector}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={[
          dropdownStyles.selectorText,
          !selectedValue && dropdownStyles.placeholderText
        ]}>
          {selectedOption?.label || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#6b7280" />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableOpacity
          style={dropdownStyles.overlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <View style={dropdownStyles.modal}>
            <View style={dropdownStyles.modalHeader}>
              <Text style={dropdownStyles.modalTitle}>Select Option</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    dropdownStyles.option,
                    item.value === selectedValue && dropdownStyles.optionSelected
                  ]}
                  onPress={() => {
                    onSelect(item.value);
                    setVisible(false);
                  }}
                >
                  <Text style={[
                    dropdownStyles.optionText,
                    item.value === selectedValue && dropdownStyles.optionTextSelected
                  ]}>
                    {item.label}
                  </Text>
                  {item.value === selectedValue && (
                    <Ionicons name="checkmark" size={20} color="#3b82f6" />
                  )}
                </TouchableOpacity>
              )}
              style={dropdownStyles.list}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const dropdownStyles = StyleSheet.create({
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectorText: {
    fontSize: 16,
    color: '#111827',
  },
  placeholderText: {
    color: '#9ca3af',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxHeight: '70%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  list: {
    maxHeight: 400,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  optionSelected: {
    backgroundColor: '#eff6ff',
  },
  optionText: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  optionTextSelected: {
    color: '#3b82f6',
    fontWeight: '600',
  },
});

const FRAUD_TYPES = [
  { label: 'UPI/OTP Fraud (Vishing)', value: 'UPI_FRAUD' },
  { label: 'Phishing/Email Scam', value: 'PHISHING' },
  { label: 'Investment/Trading Fraud', value: 'INVESTMENT_FRAUD' },
  { label: 'Loan App Fraud', value: 'LOAN_FRAUD' },
  { label: 'KYC/SIM Fraud', value: 'KYC_FRAUD' },
  { label: 'OTP/Card Fraud', value: 'OTP_FRAUD' },
];

const BANKS = [
  { label: 'State Bank of India', value: 'State Bank of India' },
  { label: 'HDFC Bank', value: 'HDFC Bank' },
  { label: 'ICICI Bank', value: 'ICICI Bank' },
  { label: 'Axis Bank', value: 'Axis Bank' },
  { label: 'Kotak Mahindra Bank', value: 'Kotak Mahindra Bank' },
  { label: 'Bank of Baroda', value: 'Bank of Baroda' },
  { label: 'Punjab National Bank', value: 'Punjab National Bank' },
  { label: 'Canara Bank', value: 'Canara Bank' },
  { label: 'Union Bank', value: 'Union Bank' },
  { label: 'IndusInd Bank', value: 'IndusInd Bank' },
  { label: 'Yes Bank', value: 'Yes Bank' },
  { label: 'IDFC First Bank', value: 'IDFC First Bank' },
  { label: 'Other', value: 'Other' },
];

// Indian States - matching synthetic data generator
const INDIAN_STATES = [
  { label: 'Maharashtra', value: 'Maharashtra' },
  { label: 'Delhi', value: 'Delhi' },
  { label: 'Karnataka', value: 'Karnataka' },
  { label: 'Tamil Nadu', value: 'Tamil Nadu' },
  { label: 'Gujarat', value: 'Gujarat' },
  { label: 'West Bengal', value: 'West Bengal' },
  { label: 'Rajasthan', value: 'Rajasthan' },
  { label: 'Uttar Pradesh', value: 'Uttar Pradesh' },
  { label: 'Telangana', value: 'Telangana' },
  { label: 'Andhra Pradesh', value: 'Andhra Pradesh' },
  { label: 'Kerala', value: 'Kerala' },
  { label: 'Madhya Pradesh', value: 'Madhya Pradesh' },
  { label: 'Punjab', value: 'Punjab' },
  { label: 'Haryana', value: 'Haryana' },
  { label: 'Bihar', value: 'Bihar' },
];

// Cities/Districts by State - matching synthetic ATM data patterns
const CITIES_BY_STATE: Record<string, Array<{ label: string; value: string }>> = {
  'Maharashtra': [
    { label: 'Mumbai', value: 'Mumbai' },
    { label: 'Pune', value: 'Pune' },
    { label: 'Thane', value: 'Thane' },
    { label: 'Navi Mumbai', value: 'Navi Mumbai' },
    { label: 'Nagpur', value: 'Nagpur' },
    { label: 'Aurangabad', value: 'Aurangabad' },
    { label: 'Nashik', value: 'Nashik' },
    { label: 'Solapur', value: 'Solapur' },
    { label: 'Kalyan', value: 'Kalyan' },
    { label: 'Vasai', value: 'Vasai' },
    { label: 'Andheri', value: 'Andheri' },
    { label: 'Bandra', value: 'Bandra' },
    { label: 'Kurla', value: 'Kurla' },
    { label: 'Borivali', value: 'Borivali' },
    { label: 'Dadar', value: 'Dadar' },
  ],
  'Delhi': [
    { label: 'New Delhi', value: 'New Delhi' },
    { label: 'Dwarka', value: 'Dwarka' },
    { label: 'Rohini', value: 'Rohini' },
    { label: 'Pitampura', value: 'Pitampura' },
    { label: 'Connaught Place', value: 'Connaught Place' },
    { label: 'Nehru Place', value: 'Nehru Place' },
    { label: 'Saket', value: 'Saket' },
    { label: 'Gurgaon', value: 'Gurgaon' },
    { label: 'Noida', value: 'Noida' },
    { label: 'Faridabad', value: 'Faridabad' },
  ],
  'Karnataka': [
    { label: 'Bangalore', value: 'Bangalore' },
    { label: 'Mysore', value: 'Mysore' },
    { label: 'Hubli', value: 'Hubli' },
    { label: 'Mangalore', value: 'Mangalore' },
    { label: 'Belgaum', value: 'Belgaum' },
    { label: 'Laggere', value: 'Laggere' },
    { label: 'Koramangala', value: 'Koramangala' },
    { label: 'Whitefield', value: 'Whitefield' },
    { label: 'Indiranagar', value: 'Indiranagar' },
  ],
  'Tamil Nadu': [
    { label: 'Chennai', value: 'Chennai' },
    { label: 'Coimbatore', value: 'Coimbatore' },
    { label: 'Madurai', value: 'Madurai' },
    { label: 'Tiruchirappalli', value: 'Tiruchirappalli' },
    { label: 'Salem', value: 'Salem' },
    { label: 'T.Nagar', value: 'T.Nagar' },
    { label: 'Anna Nagar', value: 'Anna Nagar' },
  ],
  'Gujarat': [
    { label: 'Ahmedabad', value: 'Ahmedabad' },
    { label: 'Surat', value: 'Surat' },
    { label: 'Vadodara', value: 'Vadodara' },
    { label: 'Rajkot', value: 'Rajkot' },
    { label: 'Gandhinagar', value: 'Gandhinagar' },
    { label: 'CG Road', value: 'CG Road' },
  ],
  'West Bengal': [
    { label: 'Kolkata', value: 'Kolkata' },
    { label: 'Howrah', value: 'Howrah' },
    { label: 'Durgapur', value: 'Durgapur' },
    { label: 'Asansol', value: 'Asansol' },
    { label: 'Park Street', value: 'Park Street' },
  ],
  'Rajasthan': [
    { label: 'Jaipur', value: 'Jaipur' },
    { label: 'Jodhpur', value: 'Jodhpur' },
    { label: 'Kota', value: 'Kota' },
    { label: 'Bikaner', value: 'Bikaner' },
    { label: 'Ajmer', value: 'Ajmer' },
  ],
  'Uttar Pradesh': [
    { label: 'Lucknow', value: 'Lucknow' },
    { label: 'Kanpur', value: 'Kanpur' },
    { label: 'Agra', value: 'Agra' },
    { label: 'Varanasi', value: 'Varanasi' },
    { label: 'Allahabad', value: 'Allahabad' },
    { label: 'Noida', value: 'Noida' },
    { label: 'Ghaziabad', value: 'Ghaziabad' },
  ],
  'Telangana': [
    { label: 'Hyderabad', value: 'Hyderabad' },
    { label: 'Warangal', value: 'Warangal' },
    { label: 'Nizamabad', value: 'Nizamabad' },
    { label: 'Hitech City', value: 'Hitech City' },
    { label: 'Secunderabad', value: 'Secunderabad' },
  ],
  'Andhra Pradesh': [
    { label: 'Visakhapatnam', value: 'Visakhapatnam' },
    { label: 'Vijayawada', value: 'Vijayawada' },
    { label: 'Guntur', value: 'Guntur' },
    { label: 'Nellore', value: 'Nellore' },
  ],
  'Kerala': [
    { label: 'Kochi', value: 'Kochi' },
    { label: 'Thiruvananthapuram', value: 'Thiruvananthapuram' },
    { label: 'Kozhikode', value: 'Kozhikode' },
    { label: 'Thrissur', value: 'Thrissur' },
  ],
  'Madhya Pradesh': [
    { label: 'Bhopal', value: 'Bhopal' },
    { label: 'Indore', value: 'Indore' },
    { label: 'Gwalior', value: 'Gwalior' },
    { label: 'Jabalpur', value: 'Jabalpur' },
  ],
  'Punjab': [
    { label: 'Chandigarh', value: 'Chandigarh' },
    { label: 'Ludhiana', value: 'Ludhiana' },
    { label: 'Amritsar', value: 'Amritsar' },
    { label: 'Jalandhar', value: 'Jalandhar' },
  ],
  'Haryana': [
    { label: 'Gurgaon', value: 'Gurgaon' },
    { label: 'Faridabad', value: 'Faridabad' },
    { label: 'Panipat', value: 'Panipat' },
    { label: 'Ambala', value: 'Ambala' },
  ],
  'Bihar': [
    { label: 'Patna', value: 'Patna' },
    { label: 'Gaya', value: 'Gaya' },
    { label: 'Bhagalpur', value: 'Bhagalpur' },
    { label: 'Muzaffarpur', value: 'Muzaffarpur' },
  ],
};

export default function NCRPPortalScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  
  // Form data
  const [formData, setFormData] = useState({
    // Victim Details
    victimName: '',
    victimPhone: '',
    victimEmail: '',
    victimState: 'Maharashtra',
    victimCity: '',
    victimLocation: null as { latitude: number; longitude: number } | null,
    
    // Fraud Details
    fraudType: 'UPI_FRAUD' as const,
    fraudAmount: '',
    fraudDate: new Date().toISOString().split('T')[0],
    fraudTime: new Date().toTimeString().slice(0, 5),
    fraudDescription: '',
    
    // Bank Details
    victimBank: '',
    beneficiaryAccount: '',
    beneficiaryBank: '',
    beneficiaryIfsc: '',
    transactionId: '',
    upiId: '',
  });

  const [locationLoading, setLocationLoading] = useState(false);

  const updateForm = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const captureLocation = async () => {
    try {
      setLocationLoading(true);
      
      // Request permissions first
      const hasPermission = await locationService.requestPermissions();
      if (!hasPermission) {
        Alert.alert(
          'Location Permission Required',
          'Location access is needed to help authorities respond to your complaint more effectively. Please enable location in app settings.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Get current location
      const result = await locationService.getCurrentLocation({
        accuracy: Location.Accuracy.Balanced,
      });

      if (result.success && result.location) {
        setFormData(prev => ({
          ...prev,
          victimLocation: {
            latitude: result.location!.latitude,
            longitude: result.location!.longitude,
          },
        }));
        Alert.alert('Success', 'Location captured successfully');
      } else {
        Alert.alert(
          'Location Error',
          result.error || 'Unable to get your location. Please try again or enter manually.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('Error capturing location:', error);
      Alert.alert(
        'Error',
        'Failed to capture location. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLocationLoading(false);
    }
  };

  const validateStep1 = () => {
    if (!formData.victimName.trim()) {
      Alert.alert('Required', 'Please enter complainant name');
      return false;
    }
    if (!formData.victimPhone.trim() || formData.victimPhone.length < 10) {
      Alert.alert('Required', 'Please enter a valid mobile number');
      return false;
    }
    if (!formData.victimCity.trim()) {
      Alert.alert('Required', 'Please enter your city/district');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.fraudAmount.trim() || parseFloat(formData.fraudAmount) <= 0) {
      Alert.alert('Required', 'Please enter the fraud amount');
      return false;
    }
    if (!formData.fraudDescription.trim()) {
      Alert.alert('Required', 'Please describe how the fraud happened');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!formData.beneficiaryAccount.trim()) {
      Alert.alert('Required', 'Please enter the beneficiary account number');
      return false;
    }
    if (!formData.beneficiaryBank.trim()) {
      Alert.alert('Required', 'Please select the beneficiary bank');
      return false;
    }
    // Validate IFSC if provided
    if (formData.beneficiaryIfsc.trim()) {
      const ifscValidation = validateIFSC(formData.beneficiaryIfsc);
      if (!ifscValidation.valid) {
        Alert.alert(
          'Invalid IFSC Code',
          ifscValidation.error || 'IFSC code must be 11 characters: 4 letters, then 0, then 6 alphanumeric (e.g., SBIN0001234). Leave blank if unknown.'
        );
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleSubmit = async () => {
    if (!validateStep3()) return;

    setLoading(true);

    try {
      const caseData: CreateCaseRequest = {
        ncrp_complaint_id: `NCRP-${new Date().getFullYear()}-MH-${Date.now().toString().slice(-6)}`,
        fraud_type: formData.fraudType as any,
        fraud_amount: parseFloat(formData.fraudAmount),
        fraud_description: formData.fraudDescription,
        fraud_timestamp: `${formData.fraudDate}T${formData.fraudTime}:00Z`,
        destination_account: {
          account_number: formData.beneficiaryAccount,
          bank_name: formData.beneficiaryBank,
          ifsc_code: normalizeIFSC(formData.beneficiaryIfsc),
          upi_id: formData.upiId,
        },
        victim: {
          name: formData.victimName,
          phone: formData.victimPhone,
          email: formData.victimEmail || undefined,
          city: formData.victimCity,
          location: formData.victimLocation ? {
            lat: formData.victimLocation.latitude,
            lon: formData.victimLocation.longitude,
          } : undefined,
        },
      };

      console.log('Submitting NCRP complaint:', JSON.stringify(caseData, null, 2));
      // Use public endpoint (no auth required) for citizen complaints
      const result = await caseService.submitNCRPComplaint(caseData);
      console.log('NCRP submission result:', JSON.stringify(result, null, 2));

      if (result.success && result.data) {
        Alert.alert(
          'Complaint Registered! ✅',
          `Your complaint has been registered successfully.\n\n` +
          `📋 Case Number: ${result.data.case_number}\n` +
          `🆔 Case ID: ${result.data.case_id}\n\n` +
          `🤖 AI analysis is in progress.\n` +
          `👮 LEA officers will be notified shortly.\n\n` +
          `Please save your case number for future reference.`,
          [
            {
              text: 'Register Another',
              onPress: () => {
                // Reset form and stay on screen
                setFormData({
                  victimName: '',
                  victimPhone: '',
                  victimEmail: '',
                  victimState: 'Maharashtra',
                  victimCity: '',
                  victimLocation: null,
                  fraudType: 'UPI_FRAUD',
                  fraudAmount: '',
                  fraudDate: new Date().toISOString().split('T')[0],
                  fraudTime: new Date().toTimeString().slice(0, 5),
                  fraudDescription: '',
                  victimBank: '',
                  beneficiaryAccount: '',
                  beneficiaryBank: '',
                  beneficiaryIfsc: '',
                  transactionId: '',
                  upiId: '',
                });
                setStep(1);
              },
              style: 'cancel',
            },
            {
              text: 'Exit',
              onPress: () => {
                // Navigate back to Welcome screen
                navigation.goBack();
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to register complaint');
      }
    } catch (error: any) {
      console.error('Submit error:', error);
      Alert.alert('Error', error.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` }]} />
      </View>
      <View style={styles.stepsIndicator}>
        <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]}>
          <Text style={[styles.stepDotText, step >= 1 && styles.stepDotTextActive]}>1</Text>
        </View>
        <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
        <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]}>
          <Text style={[styles.stepDotText, step >= 2 && styles.stepDotTextActive]}>2</Text>
        </View>
        <View style={[styles.stepLine, step >= 3 && styles.stepLineActive]} />
        <View style={[styles.stepDot, step >= 3 && styles.stepDotActive]}>
          <Text style={[styles.stepDotText, step >= 3 && styles.stepDotTextActive]}>3</Text>
        </View>
      </View>
      <View style={styles.stepLabels}>
        <Text style={[styles.stepLabel, step === 1 && styles.stepLabelActive]}>Personal</Text>
        <Text style={[styles.stepLabel, step === 2 && styles.stepLabelActive]}>Fraud</Text>
        <Text style={[styles.stepLabel, step === 3 && styles.stepLabelActive]}>Account</Text>
      </View>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>Personal Details</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Complainant Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your full name"
          value={formData.victimName}
          onChangeText={(v) => updateForm('victimName', v)}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Mobile Number *</Text>
        <TextInput
          style={styles.input}
          placeholder="+91 98765 43210"
          keyboardType="phone-pad"
          value={formData.victimPhone}
          onChangeText={(v) => updateForm('victimPhone', v)}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="your@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={formData.victimEmail}
          onChangeText={(v) => updateForm('victimEmail', v)}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>State *</Text>
        <Dropdown
          options={INDIAN_STATES}
          selectedValue={formData.victimState}
          onSelect={(v) => {
            updateForm('victimState', v);
            // Reset city when state changes
            updateForm('victimCity', '');
          }}
          placeholder="Select State"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>District/City *</Text>
        <Dropdown
          options={CITIES_BY_STATE[formData.victimState] || []}
          selectedValue={formData.victimCity}
          onSelect={(v) => updateForm('victimCity', v)}
          placeholder={formData.victimState ? "Select City/District" : "Select State first"}
        />
        {!formData.victimState && (
          <Text style={styles.inputHint}>
            Please select a state first to see available cities
          </Text>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Report Location (Optional)</Text>
        <Text style={styles.inputHint}>
          Capture your current location to help authorities respond faster
        </Text>
        <TouchableOpacity
          style={[
            styles.locationButton,
            formData.victimLocation && styles.locationButtonCaptured,
          ]}
          onPress={captureLocation}
          disabled={locationLoading}
          activeOpacity={0.7}
        >
          {locationLoading ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : (
            <Ionicons
              name={formData.victimLocation ? 'checkmark-circle' : 'location'}
              size={20}
              color={formData.victimLocation ? '#22c55e' : '#3b82f6'}
            />
          )}
          <Text
            style={[
              styles.locationButtonText,
              formData.victimLocation && styles.locationButtonTextCaptured,
            ]}
          >
            {formData.victimLocation
              ? `Location Captured (${formData.victimLocation.latitude.toFixed(4)}, ${formData.victimLocation.longitude.toFixed(4)})`
              : 'Capture Current Location'}
          </Text>
        </TouchableOpacity>
        {formData.victimLocation && (
          <TouchableOpacity
            style={styles.clearLocationButton}
            onPress={() => setFormData(prev => ({ ...prev, victimLocation: null }))}
          >
            <Text style={styles.clearLocationText}>Clear Location</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>Fraud Details</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Type of Fraud *</Text>
        <Dropdown
          options={FRAUD_TYPES}
          selectedValue={formData.fraudType}
          onSelect={(v) => updateForm('fraudType', v)}
          placeholder="Select fraud type"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Amount Lost (₹) *</Text>
        <TextInput
          style={[styles.input, styles.inputAmount]}
          placeholder="0.00"
          keyboardType="numeric"
          value={formData.fraudAmount}
          onChangeText={(v) => updateForm('fraudAmount', v)}
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.label}>Date of Fraud *</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            value={formData.fraudDate}
            onChangeText={(v) => updateForm('fraudDate', v)}
          />
        </View>
        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.label}>Time *</Text>
          <TextInput
            style={styles.input}
            placeholder="HH:MM"
            value={formData.fraudTime}
            onChangeText={(v) => updateForm('fraudTime', v)}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          placeholder="Describe how the fraud happened..."
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          value={formData.fraudDescription}
          onChangeText={(v) => updateForm('fraudDescription', v)}
        />
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>Transaction Details</Text>
      
      <View style={styles.warningBox}>
        <Ionicons name="information-circle" size={24} color="#f59e0b" />
        <Text style={styles.warningText}>
          The account details below are where your money was sent (fraudster's account)
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Your Bank Name</Text>
        <Dropdown
          options={BANKS}
          selectedValue={formData.victimBank}
          onSelect={(v) => updateForm('victimBank', v)}
          placeholder="Select Your Bank"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Beneficiary Account Number *</Text>
        <TextInput
          style={[styles.input, styles.inputHighlight]}
          placeholder="Account where money was sent"
          keyboardType="numeric"
          value={formData.beneficiaryAccount}
          onChangeText={(v) => updateForm('beneficiaryAccount', v)}
        />
        <Text style={styles.inputHint}>
          ← This is the mule account that received your money
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Beneficiary Bank *</Text>
        <Dropdown
          options={BANKS}
          selectedValue={formData.beneficiaryBank}
          onSelect={(v) => updateForm('beneficiaryBank', v)}
          placeholder="Select Bank"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>IFSC Code (if known)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., SBIN0001234"
          autoCapitalize="characters"
          maxLength={11}
          value={formData.beneficiaryIfsc}
          onChangeText={(v) => {
            // Format IFSC as user types (uppercase, remove spaces)
            const formatted = formatIFSC(v);
            updateForm('beneficiaryIfsc', formatted);
          }}
        />
        {formData.beneficiaryIfsc && (
          <Text style={styles.inputHint}>
            {validateIFSC(formData.beneficiaryIfsc).valid 
              ? '✓ Valid IFSC format' 
              : 'Format: 4 letters + 0 + 6 alphanumeric (e.g., SBIN0001234). Leave blank if unknown.'}
          </Text>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Transaction ID / UTR</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., UTR123456789012"
          value={formData.transactionId}
          onChangeText={(v) => updateForm('transactionId', v)}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>UPI ID (if applicable)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., fraudster@upi"
          autoCapitalize="none"
          value={formData.upiId}
          onChangeText={(v) => updateForm('upiId', v)}
        />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Government Header */}
      <LinearGradient
        colors={['#1e3a8a', '#1e40af']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>National Cyber Crime Reporting Portal</Text>
            <Text style={styles.headerSubtitle}>Ministry of Home Affairs, Government of India</Text>
          </View>
          <View style={styles.emblem}>
            <Text style={styles.emblemText}>🇮🇳</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Orange Sub-header */}
      <View style={styles.subHeader}>
        <Text style={styles.subHeaderText}>Report Financial Fraud | साइबर अपराध की शिकायत दर्ज करें</Text>
        <Text style={styles.helpline}>Helpline: 1930</Text>
      </View>

      {/* Golden Hour Warning */}
      <View style={styles.goldenHourWarning}>
        <Ionicons name="time" size={20} color="#854d0e" />
        <View style={styles.goldenHourText}>
          <Text style={styles.goldenHourTitle}>Report within Golden Hour!</Text>
          <Text style={styles.goldenHourSubtitle}>
            Complaints within 1-2 hours have highest chance of recovery
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {renderProgressBar()}

          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}

          <View style={styles.buttonContainer}>
            {step < 3 ? (
              <TouchableOpacity
                style={styles.nextButton}
                onPress={handleNext}
                activeOpacity={0.8}
              >
                <Text style={styles.nextButtonText}>Continue</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.submitButton, loading && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.submitButtonText}>Submit Complaint</Text>
                    <Ionicons name="send" size={20} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Flow Indicator */}
          <View style={styles.flowIndicator}>
            <LinearGradient
              colors={['#0ea5e9', '#06b6d4']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.flowGradient}
            >
              <View style={styles.flowStep}>
                <Text style={styles.flowIcon}>📝</Text>
                <Text style={styles.flowText}>You Report</Text>
              </View>
              <Text style={styles.flowArrow}>→</Text>
              <View style={styles.flowStep}>
                <Text style={styles.flowIcon}>🤖</Text>
                <Text style={styles.flowText}>AEGIS AI</Text>
              </View>
              <Text style={styles.flowArrow}>→</Text>
              <View style={styles.flowStep}>
                <Text style={styles.flowIcon}>📍</Text>
                <Text style={styles.flowText}>Predict</Text>
              </View>
              <Text style={styles.flowArrow}>→</Text>
              <View style={styles.flowStep}>
                <Text style={styles.flowIcon}>🚨</Text>
                <Text style={styles.flowText}>Alert LEA</Text>
              </View>
            </LinearGradient>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  emblem: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemText: {
    fontSize: 28,
  },
  subHeader: {
    backgroundColor: '#f97316',
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subHeaderText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  helpline: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  goldenHourWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    margin: 16,
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  goldenHourText: {
    flex: 1,
  },
  goldenHourTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#854d0e',
  },
  goldenHourSubtitle: {
    fontSize: 12,
    color: '#a16207',
    marginTop: 2,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 2,
  },
  stepsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: '#3b82f6',
  },
  stepDotText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9ca3af',
  },
  stepDotTextActive: {
    color: '#FFFFFF',
  },
  stepLine: {
    width: 60,
    height: 2,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 4,
  },
  stepLineActive: {
    backgroundColor: '#3b82f6',
  },
  stepLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  stepLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
  stepLabelActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  formSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
  },
  inputMultiline: {
    height: 100,
    paddingTop: 14,
  },
  inputAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  inputHighlight: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  inputHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 8,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 8,
  },
  locationButtonCaptured: {
    backgroundColor: '#dcfce7',
    borderColor: '#22c55e',
  },
  locationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3b82f6',
  },
  locationButtonTextCaptured: {
    color: '#22c55e',
  },
  clearLocationButton: {
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  clearLocationText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#854d0e',
  },
  buttonContainer: {
    marginTop: 8,
    marginBottom: 24,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  flowIndicator: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
  },
  flowGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  flowStep: {
    alignItems: 'center',
  },
  flowIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  flowText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  flowArrow: {
    fontSize: 16,
    color: '#FFFFFF',
    marginHorizontal: 8,
  },
});

