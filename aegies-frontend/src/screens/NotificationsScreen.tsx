/**
 * Notifications Screen
 * Matches MVP Design: 17-notifications.html
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/theme';

interface Notification {
  id: string;
  type: 'alert' | 'success' | 'freeze' | 'deployment' | 'system' | 'ai';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  caseId?: string;
  alertId?: string;
}

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [notifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'alert',
      title: 'High-Risk Alert Detected',
      message: 'AI predicts fraudulent withdrawal at HDFC ATM Lokhandwala. Case #MH-2025-84721',
      timestamp: '2m ago',
      read: false,
      caseId: 'MH-2025-84721',
    },
    {
      id: '2',
      type: 'success',
      title: 'Case Resolved Successfully',
      message: 'Case #MH-2025-84719 closed. ₹5.2L recovered, suspect apprehended.',
      timestamp: '1h ago',
      read: false,
      caseId: 'MH-2025-84719',
    },
    {
      id: '3',
      type: 'freeze',
      title: 'NPCI Freeze Confirmed',
      message: '2 mule accounts frozen successfully. Ref: NPCI-FRZ-2025-847210',
      timestamp: '2h ago',
      read: true,
    },
    {
      id: '4',
      type: 'deployment',
      title: 'Team Alpha Deployed',
      message: 'Dispatched to Borivali sector for high-value case interception.',
      timestamp: 'Yesterday',
      read: true,
    },
    {
      id: '5',
      type: 'system',
      title: 'System Update',
      message: 'AEGIS v1.2.0 deployed. Improved prediction accuracy by 3.5%.',
      timestamp: 'Yesterday',
      read: true,
    },
    {
      id: '6',
      type: 'ai',
      title: 'AI Trend Alert',
      message: 'Surge in job fraud complaints detected in Thane region. Enhanced monitoring enabled.',
      timestamp: '2 days ago',
      read: true,
    },
  ]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'alert':
        return { name: 'warning', color: '#ef4444', bgColor: '#fee2e2' };
      case 'success':
        return { name: 'checkmark-circle', color: '#22c55e', bgColor: '#dcfce7' };
      case 'freeze':
        return { name: 'shield-checkmark', color: '#3b82f6', bgColor: '#dbeafe' };
      case 'deployment':
        return { name: 'people', color: '#a855f7', bgColor: '#f3e8ff' };
      case 'system':
        return { name: 'refresh', color: '#6b7280', bgColor: '#f3f4f6' };
      case 'ai':
        return { name: 'bulb', color: '#06b6d4', bgColor: '#cffafe' };
      default:
        return { name: 'notifications', color: '#6b7280', bgColor: '#f3f4f6' };
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    // Navigate using parent Stack Navigator if available
    const parent = navigation.getParent();
    const nav = parent || navigation;
    
    if (notification.type === 'alert' && notification.caseId) {
      // Navigate to Case Detail
      nav.navigate('CaseDetail' as never, {
        caseId: notification.caseId,
        alertId: notification.alertId,
      } as never);
    } else if (notification.type === 'success' && notification.caseId) {
      // Navigate to Case Success
      nav.navigate('CaseSuccess' as never, {
        caseId: notification.caseId,
      } as never);
    } else if (notification.type === 'freeze') {
      // Navigate to Freeze Confirmation
      if (notification.caseId) {
        nav.navigate('FreezeConfirmation' as never, {
          caseId: notification.caseId,
        } as never);
      }
    } else if (notification.type === 'deployment') {
      // Navigate to Team Status
      if (notification.caseId) {
        nav.navigate('TeamStatus' as never, {
          caseId: notification.caseId,
        } as never);
      }
    }
  };

  const markAllAsRead = () => {
    // Mark all as read functionality
  };

  // Group notifications by date
  const todayNotifications = notifications.filter(
    (n) => n.timestamp.includes('m ago') || n.timestamp.includes('h ago')
  );
  const yesterdayNotifications = notifications.filter((n) =>
    n.timestamp.includes('Yesterday')
  );
  const olderNotifications = notifications.filter(
    (n) => !todayNotifications.includes(n) && !yesterdayNotifications.includes(n)
  );

  return (
    <View style={[styles.container, { backgroundColor: '#f8fafc' }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#FFFFFF' }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>
        <TouchableOpacity onPress={markAllAsRead} activeOpacity={0.7}>
          <Text style={styles.markAllText}>Mark All Read</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Today Section */}
        {todayNotifications.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Today</Text>
            {todayNotifications.map((notification) => {
              const icon = getNotificationIcon(notification.type);
              return (
                <TouchableOpacity
                  key={notification.id}
                  style={[
                    styles.notificationCard,
                    notification.type === 'alert' && styles.alertCard,
                  ]}
                  onPress={() => handleNotificationPress(notification)}
                  activeOpacity={0.7}
                >
                  <View style={styles.notificationContent}>
                    <View style={[styles.iconContainer, { backgroundColor: icon.bgColor }]}>
                      <Ionicons name={icon.name as any} size={20} color={icon.color} />
                    </View>
                    <View style={styles.notificationText}>
                      <View style={styles.notificationHeader}>
                        <Text style={styles.notificationTitle}>{notification.title}</Text>
                        <Text style={styles.notificationTime}>{notification.timestamp}</Text>
                      </View>
                      <Text style={styles.notificationMessage}>{notification.message}</Text>
                      {(notification.type === 'alert' || notification.type === 'success') && (
                        <TouchableOpacity
                          onPress={() => handleNotificationPress(notification)}
                          activeOpacity={0.7}
                          style={styles.viewLinkContainer}
                        >
                          <Text style={styles.viewLink}>
                            {notification.type === 'alert' ? 'View Alert →' : 'View Details →'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {!notification.read && (
                      <View style={styles.unreadDot} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* Yesterday Section */}
        {yesterdayNotifications.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Yesterday</Text>
            {yesterdayNotifications.map((notification) => {
              const icon = getNotificationIcon(notification.type);
              return (
                <TouchableOpacity
                  key={notification.id}
                  style={styles.notificationCard}
                  onPress={() => handleNotificationPress(notification)}
                  activeOpacity={0.7}
                >
                  <View style={styles.notificationContent}>
                    <View style={[styles.iconContainer, { backgroundColor: icon.bgColor }]}>
                      <Ionicons name={icon.name as any} size={20} color={icon.color} />
                    </View>
                    <View style={styles.notificationText}>
                      <View style={styles.notificationHeader}>
                        <Text style={styles.notificationTitle}>{notification.title}</Text>
                        <Text style={styles.notificationTime}>{notification.timestamp}</Text>
                      </View>
                      <Text style={styles.notificationMessage}>{notification.message}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* Older Section */}
        {olderNotifications.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Older</Text>
            {olderNotifications.map((notification) => {
              const icon = getNotificationIcon(notification.type);
              return (
                <TouchableOpacity
                  key={notification.id}
                  style={styles.notificationCard}
                  onPress={() => handleNotificationPress(notification)}
                  activeOpacity={0.7}
                >
                  <View style={styles.notificationContent}>
                    <View style={[styles.iconContainer, { backgroundColor: icon.bgColor }]}>
                      <Ionicons name={icon.name as any} size={20} color={icon.color} />
                    </View>
                    <View style={styles.notificationText}>
                      <View style={styles.notificationHeader}>
                        <Text style={styles.notificationTitle}>{notification.title}</Text>
                        <Text style={styles.notificationTime}>{notification.timestamp}</Text>
                      </View>
                      <Text style={styles.notificationMessage}>{notification.message}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#6b7280',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  alertCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notificationText: {
    flex: 1,
    minWidth: 0,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  notificationTime: {
    fontSize: 12,
    color: '#9ca3af',
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginTop: 4,
  },
  viewLinkContainer: {
    marginTop: 8,
  },
  viewLink: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
    marginTop: 4,
    flexShrink: 0,
  },
});
