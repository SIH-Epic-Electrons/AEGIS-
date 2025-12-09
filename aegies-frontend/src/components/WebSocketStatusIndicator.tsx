import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { websocketService, ConnectionStatus } from '../services/websocketService';
import { useTheme } from '../theme/theme';

export default function WebSocketStatusIndicator() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const { theme } = useTheme();
  const spinValue = useState(new Animated.Value(0))[0];

  useEffect(() => {
    const unsubscribe = websocketService.subscribeToStatus((newStatus) => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (status === 'reconnecting') {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinValue.setValue(0);
      spinValue.stopAnimation();
    }
  }, [status]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (status === 'connected') return null;

  return (
    <View style={[styles.statusBar, { backgroundColor: status === 'reconnecting' ? theme.colors.warning : theme.colors.error }]}>
      <Animated.View style={status === 'reconnecting' ? { transform: [{ rotate: spin }] } : {}}>
        <Ionicons
          name={status === 'reconnecting' ? 'sync' : 'cloud-offline'}
          size={16}
          color="#FFFFFF"
        />
      </Animated.View>
      <Text style={styles.statusText}>
        {status === 'reconnecting' ? 'Reconnecting...' : 'Offline Mode'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 8,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

