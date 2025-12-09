import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';

interface CountdownTimerProps {
  seconds?: number;
  minutes?: number;
  timeWindow?: number; // Accept timeWindow in minutes
  onComplete?: () => void;
  theme?: any; // Accept but ignore
}

export default function CountdownTimer({ seconds = 0, minutes, timeWindow, onComplete, theme }: CountdownTimerProps) {
  const { theme: useThemeHook } = useTheme();
  const totalSeconds = timeWindow ? timeWindow * 60 : (minutes ? minutes * 60 : seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  return (
    <View style={styles.container}>
      <Text style={[styles.timer, { color: useThemeHook.colors.text }]}>
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timer: {
    fontSize: 24,
    fontWeight: '700',
  },
});

