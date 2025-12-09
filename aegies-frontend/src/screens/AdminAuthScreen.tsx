/**
 * Admin Authentication Screen
 * Login portal for AEGIS administrators to manage AI/ML systems
 */

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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { authService } from '../api/authService';

export default function AdminAuthScreen() {
  const navigation = useNavigation();
  const [adminId, setAdminId] = useState('ADMIN-001');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setUser, setIsAuthenticated, setUserRole } = useAuthStore();

  const handleLogin = async () => {
    if (!adminId || !password) {
      Alert.alert('Missing Information', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      // Call admin login API
      const result = await authService.login(adminId, password);
      
      if (result.success && result.data) {
        // Set user role as admin
        setUser({
          id: result.data.officer?.id || adminId,
          email: `${adminId.toLowerCase().replace(/-/g, '')}@aegis.gov.in`,
          name: result.data.officer?.name || 'System Administrator',
          type: 'admin',
          organization: 'AEGIS Admin',
          badgeNumber: adminId,
          rank: 'Administrator',
        });
        setUserRole('admin');
        setIsAuthenticated(true);
        
        // Navigate to Admin Dashboard
        navigation.reset({
          index: 0,
          routes: [{ name: 'AdminMain' as never }],
        });
      } else {
        Alert.alert('Login Failed', result.error || 'Invalid credentials');
      }
    } catch (error: any) {
      Alert.alert('Login Error', error.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <LinearGradient colors={['#1e1b4b', '#312e81', '#4c1d95']} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Back Button */}
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={['#8b5cf6', '#a855f7']}
                style={styles.logoCircle}
              >
                <Ionicons name="settings" size={36} color="#FFFFFF" />
              </LinearGradient>
            </View>

            <Text style={styles.title}>Admin Console</Text>
            <Text style={styles.subtitle}>AEGIS System Administration</Text>
            
            <View style={styles.accessLevelBadge}>
              <Ionicons name="key" size={14} color="#fbbf24" />
              <Text style={styles.accessLevelText}>Level 5 Access Required</Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Admin ID */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Admin ID</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="person-circle-outline"
                  size={20}
                  color="rgba(255,255,255,0.6)"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter Admin ID"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={adminId}
                  onChangeText={setAdminId}
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
                  color="rgba(255,255,255,0.6)"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter password"
                  placeholderTextColor="rgba(255,255,255,0.4)"
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
                    color="rgba(255,255,255,0.6)"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* MFA Notice */}
            <View style={styles.mfaNotice}>
              <Ionicons name="shield-checkmark" size={20} color="#fbbf24" />
              <View style={styles.mfaTextContainer}>
                <Text style={styles.mfaTitle}>Multi-Factor Authentication</Text>
                <Text style={styles.mfaSubtitle}>
                  You'll receive an OTP on your registered device
                </Text>
              </View>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={styles.loginButton}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#a855f7', '#7c3aed']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loginButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.loginButtonText}>Access Console</Text>
                    <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Admin Features */}
            <View style={styles.featuresContainer}>
              <Text style={styles.featuresTitle}>Admin Capabilities</Text>
              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <Ionicons name="analytics" size={18} color="#a855f7" />
                  <Text style={styles.featureText}>FL/RL Model Management</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="people" size={18} color="#a855f7" />
                  <Text style={styles.featureText}>User & Team Administration</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="stats-chart" size={18} color="#a855f7" />
                  <Text style={styles.featureText}>System Analytics & Logs</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="cog" size={18} color="#a855f7" />
                  <Text style={styles.featureText}>Configuration Settings</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.secureIndicator}>
              <Ionicons name="lock-closed" size={14} color="#10b981" />
              <Text style={styles.secureText}>Secure Admin Channel</Text>
            </View>
            <Text style={styles.footerText}>
              Unauthorized access is prohibited and monitored
            </Text>
          </View>
        </ScrollView>
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
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 16,
  },
  accessLevelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  accessLevelText: {
    fontSize: 12,
    color: '#fbbf24',
    fontWeight: '600',
  },
  form: {
    marginBottom: 24,
  },
  inputWrapper: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    height: 54,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
  },
  eyeIcon: {
    padding: 4,
  },
  mfaNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.2)',
    gap: 12,
  },
  mfaTextContainer: {
    flex: 1,
  },
  mfaTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fbbf24',
    marginBottom: 2,
  },
  mfaSubtitle: {
    fontSize: 12,
    color: 'rgba(251, 191, 36, 0.8)',
  },
  loginButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  loginButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  featuresContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  featuresTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 24,
  },
  secureIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  secureText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
  },
  footerText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
  },
});

