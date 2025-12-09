import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { notificationService } from '../services/notificationService';

interface SnoozeTimerProps {
  caseId: string;
  minutes?: number;
  onComplete?: () => void;
  onCancel?: () => void;
}

export default function SnoozeTimer({ 
  caseId, 
  minutes = 5, 
  onComplete,
  onCancel 
}: SnoozeTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(minutes * 60);
  const [isActive, setIsActive] = useState(true);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isActive || timeRemaining <= 0) return;

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.5,
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

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setIsActive(false);
          // Schedule notification
          notificationService.scheduleSnoozeNotification(caseId, 0);
          if (onComplete) {
            onComplete();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, timeRemaining, caseId, onComplete]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isActive && timeRemaining === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.completedContainer}>
          <Ionicons name="notifications" size={24} color="#22c55e" />
          <Text style={styles.completedText}>Snooze complete! Notification sent.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.timerContainer,
          { opacity: pulseAnim },
        ]}
      >
        <Ionicons name="time-outline" size={20} color="#6b7280" />
        <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
        {onCancel && (
          <TouchableOpacity
            onPress={() => {
              setIsActive(false);
              if (onCancel) onCancel();
            }}
            style={styles.cancelButton}
          >
            <Ionicons name="close" size={16} color="#6b7280" />
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    fontVariant: ['tabular-nums'],
  },
  cancelButton: {
    padding: 4,
  },
  completedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  completedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
  },
});

