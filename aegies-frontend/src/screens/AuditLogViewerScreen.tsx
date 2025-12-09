/**
 * Audit Log Viewer Screen
 * Displays and searches audit logs
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { securityService, AuditLog } from '../api/securityService';
import { useTheme } from '../theme/theme';
import { format } from 'date-fns';

export default function AuditLogViewerScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string | null>(null);

  useEffect(() => {
    loadLogs();
  }, [eventTypeFilter]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const response = await securityService.getAuditLogs({
        event_type: eventTypeFilter || undefined,
        limit: 100,
      });
      setLogs(response.logs);
    } catch (error) {
      console.error('Error loading audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLogs();
    setRefreshing(false);
  };

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.event_type?.toLowerCase().includes(query) ||
      log.source_service?.toLowerCase().includes(query) ||
      JSON.stringify(log.data).toLowerCase().includes(query)
    );
  });

  const eventTypes = Array.from(new Set(logs.map((log) => log.event_type)));

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primaryDark || theme.colors.primary]}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Audit Logs</Text>
      </LinearGradient>

      {/* Search and Filters */}
      <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface }]}>
        <View style={[styles.searchBox, { backgroundColor: theme.colors.background }]}>
          <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search logs..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Event Type Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              {
                backgroundColor: eventTypeFilter === null ? theme.colors.primary : theme.colors.background,
              },
            ]}
            onPress={() => setEventTypeFilter(null)}
          >
            <Text
              style={[
                styles.filterText,
                {
                  color: eventTypeFilter === null ? '#fff' : theme.colors.text,
                },
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          {eventTypes.map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.filterChip,
                {
                  backgroundColor: eventTypeFilter === type ? theme.colors.primary : theme.colors.background,
                },
              ]}
              onPress={() => setEventTypeFilter(type)}
            >
              <Text
                style={[
                  styles.filterText,
                  {
                    color: eventTypeFilter === type ? '#fff' : theme.colors.text,
                  },
                ]}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Logs List */}
      <ScrollView
        style={styles.logsContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredLogs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              No audit logs found
            </Text>
          </View>
        ) : (
          filteredLogs.map((log, index) => (
            <View
              key={log.event_id || index}
              style={[styles.logCard, { backgroundColor: theme.colors.surface }]}
            >
              <View style={styles.logHeader}>
                <View style={styles.logTypeBadge}>
                  <Text style={styles.logTypeText}>{log.event_type}</Text>
                </View>
                <Text style={[styles.logTime, { color: theme.colors.textSecondary }]}>
                  {log.timestamp
                    ? format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm:ss')
                    : 'Unknown'}
                </Text>
              </View>
              <Text style={[styles.logService, { color: theme.colors.textSecondary }]}>
                Service: {log.source_service || 'Unknown'}
              </Text>
              {log.data && (
                <View style={styles.logDataContainer}>
                  <Text style={[styles.logDataLabel, { color: theme.colors.textSecondary }]}>
                    Data:
                  </Text>
                  <Text style={[styles.logData, { color: theme.colors.text }]} numberOfLines={3}>
                    {JSON.stringify(log.data, null, 2)}
                  </Text>
                </View>
              )}
            </View>
          ))
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
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  searchContainer: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },
  filterContainer: {
    marginTop: 10,
  },
  filterChip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  logsContainer: {
    flex: 1,
  },
  logCard: {
    margin: 15,
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  logTypeBadge: {
    backgroundColor: '#007BFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  logTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  logTime: {
    fontSize: 12,
  },
  logService: {
    fontSize: 14,
    marginBottom: 10,
  },
  logDataContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  logDataLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 5,
  },
  logData: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 20,
  },
});

