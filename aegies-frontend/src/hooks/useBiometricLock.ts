import { useEffect, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuthStore } from '../store/authStore';
import { secureStorage } from '../services/secureStorage';

export const useBiometricLock = () => {
  const [isLocked, setIsLocked] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    checkBiometricAvailability();
    checkBiometricEnabled();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      import('react-native').then((RN) => {
        const subscription = RN.AppState.addEventListener('change', handleAppStateChange);
        return () => subscription?.remove();
      });
    }
  }, [isAuthenticated]);

  const checkBiometricAvailability = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setBiometricAvailable(compatible && enrolled);
  };

  const checkBiometricEnabled = async () => {
    const enabled = await secureStorage.getBiometricEnabled();
    if (enabled && isAuthenticated) {
      setIsLocked(true);
      authenticate();
    }
  };

  const handleAppStateChange = async (nextAppState: string) => {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      const enabled = await secureStorage.getBiometricEnabled();
      if (enabled) {
        setIsLocked(true);
      }
    }
  };

  const authenticate = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock AEGIS',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsLocked(false);
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
    }
  };

  return {
    isLocked,
    biometricAvailable,
    authenticate,
    setIsLocked,
  };
};


