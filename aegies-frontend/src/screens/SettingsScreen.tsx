import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme/theme';

export default function SettingsScreen() {
  const { theme } = useTheme();
  const { user, logout } = useAuthStore();
  const navigation = useNavigation();
  const [criticalAlertsEnabled, setCriticalAlertsEnabled] = useState(true);

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  // Get officer initials for avatar
  const getOfficerInitials = () => {
    if (!user?.name) return 'PS';
    const names = user.name.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return user.name.substring(0, 2).toUpperCase();
  };

  return (
    <View style={[styles.container, { backgroundColor: '#f8fafc' }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Profile & Settings
        </Text>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <LinearGradient
            colors={['#3b82f6', '#2563eb']}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>{getOfficerInitials()}</Text>
          </LinearGradient>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: theme.colors.text }]}>
              {user?.name || 'SI Priya Sharma'}
            </Text>
            <Text style={[styles.profileBadge, { color: theme.colors.textSecondary }]}>
              Badge ID: {user?.badgeNumber || 'MH-CYB-78451'}
            </Text>
            <Text style={[styles.profileDepartment, { color: theme.colors.primary }]}>
              {user?.organization || 'Maharashtra Cyber Cell'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionHeader, { color: theme.colors.textSecondary }]}>
            Account
          </Text>
          <TouchableOpacity
            style={[styles.sectionItem, { borderBottomColor: theme.colors.divider }]}
            onPress={() => Alert.alert('Personal Information', 'Feature coming soon')}
            activeOpacity={0.7}
          >
            <View style={[styles.itemIcon, { backgroundColor: '#dbeafe' }]}>
              <Ionicons name="person-outline" size={20} color="#2563eb" />
            </View>
            <Text style={[styles.itemTitle, { color: theme.colors.text }]}>
              Personal Information
            </Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sectionItem}
            onPress={() => Alert.alert('Change Password', 'Feature coming soon')}
            activeOpacity={0.7}
          >
            <View style={[styles.itemIcon, { backgroundColor: '#dbeafe' }]}>
              <Ionicons name="lock-closed-outline" size={20} color="#2563eb" />
            </View>
            <Text style={[styles.itemTitle, { color: theme.colors.text }]}>
              Change Password
            </Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Notifications Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionHeader, { color: theme.colors.textSecondary }]}>
            Notifications
          </Text>
          <View style={[styles.sectionItem, { borderBottomColor: theme.colors.divider }]}>
            <View style={[styles.itemIcon, { backgroundColor: '#fee2e2' }]}>
              <Ionicons name="alert-circle-outline" size={20} color="#dc2626" />
            </View>
            <View style={styles.itemContent}>
              <Text style={[styles.itemTitle, { color: theme.colors.text }]}>
                Critical Alerts
              </Text>
              <Text style={[styles.itemSubtitle, { color: theme.colors.textSecondary }]}>
                High priority notifications
              </Text>
            </View>
            <Switch
              value={criticalAlertsEnabled}
              onValueChange={setCriticalAlertsEnabled}
              trackColor={{ false: theme.colors.border, true: '#2563eb' }}
              thumbColor="#FFFFFF"
            />
          </View>
          <TouchableOpacity
            style={styles.sectionItem}
            onPress={() => Alert.alert('Alert Sound', 'Feature coming soon')}
            activeOpacity={0.7}
          >
            <View style={[styles.itemIcon, { backgroundColor: '#fed7aa' }]}>
              <Ionicons name="volume-high-outline" size={20} color="#f97316" />
            </View>
            <View style={styles.itemContent}>
              <Text style={[styles.itemTitle, { color: theme.colors.text }]}>
                Alert Sound
              </Text>
              <Text style={[styles.itemSubtitle, { color: theme.colors.textSecondary }]}>
                Urgent cases only
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* App Settings Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionHeader, { color: theme.colors.textSecondary }]}>
            App Settings
          </Text>
          <TouchableOpacity
            style={[styles.sectionItem, { borderBottomColor: theme.colors.divider }]}
            onPress={() => navigation.navigate('Map' as never)}
            activeOpacity={0.7}
          >
            <View style={[styles.itemIcon, { backgroundColor: '#dcfce7' }]}>
              <Ionicons name="map-outline" size={20} color="#16a34a" />
            </View>
            <Text style={[styles.itemTitle, { color: theme.colors.text }]}>
              Map Preferences
            </Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sectionItem}
            onPress={() => Alert.alert('Data Usage', 'Feature coming soon')}
            activeOpacity={0.7}
          >
            <View style={[styles.itemIcon, { backgroundColor: '#e9d5ff' }]}>
              <Ionicons name="stats-chart-outline" size={20} color="#9333ea" />
            </View>
            <Text style={[styles.itemTitle, { color: theme.colors.text }]}>
              Data Usage
            </Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Admin Section - AI/ML Monitoring */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionHeader, { color: theme.colors.textSecondary }]}>
            Admin - AI/ML
          </Text>
          <TouchableOpacity
            style={[styles.sectionItem, { borderBottomColor: theme.colors.divider }]}
            onPress={() => navigation.navigate('AdminDashboard' as never)}
            activeOpacity={0.7}
          >
            <View style={[styles.itemIcon, { backgroundColor: '#fce7f3' }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#ec4899" />
            </View>
            <View style={styles.itemContent}>
              <Text style={[styles.itemTitle, { color: theme.colors.text }]}>
                AI/ML Control Center
              </Text>
              <Text style={[styles.itemSubtitle, { color: theme.colors.textSecondary }]}>
                Admin dashboard for all AI systems
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sectionItem, { borderBottomColor: theme.colors.divider }]}
            onPress={() => navigation.navigate('AdminFLStatus' as never)}
            activeOpacity={0.7}
          >
            <View style={[styles.itemIcon, { backgroundColor: '#f3e8ff' }]}>
              <Ionicons name="git-network-outline" size={20} color="#8b5cf6" />
            </View>
            <View style={styles.itemContent}>
              <Text style={[styles.itemTitle, { color: theme.colors.text }]}>
                Federated Learning
              </Text>
              <Text style={[styles.itemSubtitle, { color: theme.colors.textSecondary }]}>
                Cross-bank model training status
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sectionItem}
            onPress={() => navigation.navigate('AdminRLStatus' as never)}
            activeOpacity={0.7}
          >
            <View style={[styles.itemIcon, { backgroundColor: '#d1fae5' }]}>
              <Ionicons name="flash-outline" size={20} color="#10b981" />
            </View>
            <View style={styles.itemContent}>
              <Text style={[styles.itemTitle, { color: theme.colors.text }]}>
                Reinforcement Learning
              </Text>
              <Text style={[styles.itemSubtitle, { color: theme.colors.textSecondary }]}>
                Feedback-based model improvement
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Support Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <TouchableOpacity
            style={[styles.sectionItem, { borderBottomColor: theme.colors.divider }]}
            onPress={() => Alert.alert('Help & Support', 'Contact support at support@aegis.gov.in')}
            activeOpacity={0.7}
          >
            <View style={[styles.itemIcon, { backgroundColor: '#cffafe' }]}>
              <Ionicons name="help-circle-outline" size={20} color="#06b6d4" />
            </View>
            <Text style={[styles.itemTitle, { color: theme.colors.text }]}>
              Help & Support
            </Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sectionItem}
            onPress={() =>
              Alert.alert(
                'About AEGIS',
                'Project AEGIS - India\'s Cyber Shield\n\nReal-time AI-powered predictive intervention system for cybercrime prevention.\n\nBuilt for the National Cybercrime Reporting Portal (NCRP).\n\nVersion 1.0.0'
              )
            }
            activeOpacity={0.7}
          >
            <View style={[styles.itemIcon, { backgroundColor: '#f3f4f6' }]}>
              <Ionicons name="information-circle-outline" size={20} color={theme.colors.textSecondary} />
            </View>
            <Text style={[styles.itemTitle, { color: theme.colors.text }]}>
              About AEGIS
            </Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: theme.colors.surface }]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color="#dc2626" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 24,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  profileBadge: {
    fontSize: 14,
    marginBottom: 4,
  },
  profileDepartment: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
    gap: 16,
  },
  section: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f9fafb',
    letterSpacing: 0.5,
  },
  sectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
  },
});
