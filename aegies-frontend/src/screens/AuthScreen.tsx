import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme/theme';
import * as authService from '../services/authService';
import { User } from '../types';

const DEPARTMENTS = [
  'Maharashtra Cyber Cell',
  'Delhi Cyber Cell',
  'Karnataka Cyber Cell',
  'Gujarat Cyber Cell',
  'Tamil Nadu Cyber Cell',
  'West Bengal Cyber Cell',
];

export default function AuthScreen() {
  const { theme } = useTheme();
  const [badgeId, setBadgeId] = useState('MH-CYB-78451');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const { login } = useAuthStore();

  const handleLogin = async () => {
    if (!badgeId || !password || !department) {
      Alert.alert('Missing Information', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const result = await login(badgeId, password, department);
      setLoading(false);

      if (!result.success) {
        Alert.alert('Login Failed', result.error || 'Invalid Badge ID or Password');
      }
      // Success - navigation handled by App.tsx based on isAuthenticated
    } catch (error: any) {
      setLoading(false);
      Alert.alert('Login Error', error.message || 'An unexpected error occurred');
    }
  };

  const handleBiometricLogin = async () => {
    setLoading(true);
    try {
      const result = await authService.handleBiometricLogin();
      setLoading(false);

      if (result.success && result.data) {
        const user: User = {
          id: result.data.user.id,
          email: result.data.user.email,
          name: result.data.user.name,
          type: 'lea',
          organization: result.data.user.department,
          badgeNumber: result.data.user.badgeId,
          rank: result.data.user.rank,
        };
        // Update auth store
        useAuthStore.setState({ user, isAuthenticated: true });
      } else {
        Alert.alert('Biometric Login Failed', result.error || 'Biometric authentication failed');
      }
    } catch (error: any) {
      setLoading(false);
      Alert.alert('Biometric Error', error.message || 'An unexpected error occurred');
    }
  };

  return (
    <LinearGradient colors={['#f8fafc', '#f1f5f9']} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={['#06b6d4', '#3b82f6']}
                style={styles.logoCircle}
              >
                <Ionicons name="shield" size={32} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.logoText}>
                <Text style={styles.title}>AEGIS</Text>
                <Text style={styles.subtitle}>LEA Officer Portal</Text>
              </View>
            </View>

            <Text style={styles.welcomeTitle}>Welcome Back</Text>
            <Text style={styles.welcomeSubtitle}>
              Sign in to continue protecting citizens
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Badge ID */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Badge ID</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="id-card-outline"
                  size={20}
                  color="#9ca3af"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your Badge ID"
                  placeholderTextColor="#9ca3af"
                  value={badgeId}
                  onChangeText={setBadgeId}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#9ca3af"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#9ca3af"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#9ca3af"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Department */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Department</Text>
              <TouchableOpacity
                style={styles.inputContainer}
                onPress={() => setShowDepartmentModal(true)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="business-outline"
                  size={20}
                  color="#9ca3af"
                  style={styles.inputIcon}
                />
                <Text style={[styles.input, { flex: 1 }]}>{department}</Text>
                <Ionicons
                  name="chevron-down-outline"
                  size={20}
                  color="#9ca3af"
                  style={styles.chevronIcon}
                />
              </TouchableOpacity>
            </View>

            {/* Remember & Forgot */}
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setRememberMe(!rememberMe)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.checkbox,
                    rememberMe && styles.checkboxChecked,
                  ]}
                >
                  {rememberMe && (
                    <Ionicons name="checkmark" size={16} color="#3b82f6" />
                  )}
                </View>
                <Text style={styles.checkboxLabel}>Remember me</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={styles.loginButton}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>Sign In</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Biometric Login */}
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={handleBiometricLogin}
              activeOpacity={0.8}
            >
              <Ionicons name="finger-print-outline" size={24} color="#FFFFFF" />
              <Text style={styles.biometricButtonText}>Login with Biometric</Text>
            </TouchableOpacity>
          </View>

          {/* Secure Connection Indicator */}
          <View style={styles.secureIndicator}>
            <Ionicons name="shield-checkmark" size={18} color="#16a34a" />
            <Text style={styles.secureText}>Secure Government Network</Text>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              © 2025 I4C, Ministry of Home Affairs, Govt. of India
            </Text>
          </View>
        </ScrollView>

        {/* Department Selection Modal */}
        <Modal
          visible={showDepartmentModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDepartmentModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Department</Text>
                <TouchableOpacity
                  onPress={() => setShowDepartmentModal(false)}
                  style={styles.modalCloseButton}
                >
                  <Ionicons name="close" size={24} color="#111827" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={DEPARTMENTS}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.modalItem,
                      department === item && styles.modalItemSelected,
                    ]}
                    onPress={() => {
                      setDepartment(item);
                      setShowDepartmentModal(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalItemText,
                        department === item && styles.modalItemTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                    {department === item && (
                      <Ionicons name="checkmark" size={20} color="#3b82f6" />
                    )}
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
  },
  header: {
    marginBottom: 32,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
  },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logoText: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  form: {
    marginBottom: 24,
  },
  inputWrapper: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
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
  eyeIcon: {
    padding: 4,
  },
  pickerContainer: {
    flex: 1,
  },
  picker: {
    color: '#111827',
  },
  chevronIcon: {
    marginLeft: 8,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#4b5563',
  },
  forgotText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  biometricButton: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  biometricButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  secureIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
  },
  secureText: {
    fontSize: 14,
    color: '#166534',
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 24,
  },
  footerText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalItemSelected: {
    backgroundColor: '#eff6ff',
  },
  modalItemText: {
    fontSize: 16,
    color: '#111827',
  },
  modalItemTextSelected: {
    color: '#3b82f6',
    fontWeight: '600',
  },
});
