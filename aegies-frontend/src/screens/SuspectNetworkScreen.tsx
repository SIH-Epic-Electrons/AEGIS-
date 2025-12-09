import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/theme';

export default function SuspectNetworkScreen() {
  const { theme } = useTheme();
  const route = useRoute();
  const navigation = useNavigation();
  const { caseId } = route.params as any || {};

  const formatCurrency = (amount: number | undefined | null) => {
    if (!amount || isNaN(amount)) {
      return '₹0';
    }
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    }
    return `₹${amount.toLocaleString()}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: '#0f172a' }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Mule Network</Text>
            <Text style={styles.headerSubtitle}>Case {caseId || '#MH-2025-84721'}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.filterButton} activeOpacity={0.7}>
          <Ionicons name="options" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Network Visualization Placeholder */}
        <View style={styles.networkContainer}>
          <View style={styles.networkCard}>
            <Text style={styles.networkTitle}>Network Visualization</Text>
            <Text style={styles.networkSubtitle}>
              Interactive network graph showing connections between victim, mule accounts, and suspects
            </Text>
            
            {/* Simplified Network Nodes */}
            <View style={styles.networkGraph}>
              {/* Victim Node */}
              <View style={[styles.node, styles.victimNode]}>
                <Text style={styles.nodeLabel}>VICTIM</Text>
                <Text style={styles.nodeName}>Rajesh G.</Text>
              </View>

              {/* Connection Lines */}
              <View style={styles.connectionLine} />
              
              {/* Mule Nodes */}
              <View style={styles.muleRow}>
                <View style={[styles.node, styles.muleNode]}>
                  <Text style={styles.nodeLabel}>M1</Text>
                  <Text style={styles.nodeName}>Suresh K.</Text>
                  <Text style={styles.nodeAmount}>{formatCurrency(210000)}</Text>
                </View>
                <View style={[styles.node, styles.muleNode]}>
                  <Text style={styles.nodeLabel}>M2</Text>
                  <Text style={styles.nodeName}>Ram***n P.</Text>
                  <Text style={styles.nodeAmount}>{formatCurrency(100000)}</Text>
                </View>
              </View>

              <View style={styles.connectionLine} />

              {/* Suspect Nodes */}
              <View style={styles.suspectRow}>
                <View style={[styles.node, styles.suspectNode]}>
                  <Text style={styles.nodeLabel}>S1</Text>
                  <Text style={styles.nodeName}>Unknown</Text>
                </View>
                <View style={[styles.node, styles.suspectNode]}>
                  <Text style={styles.nodeLabel}>S2</Text>
                  <Text style={styles.nodeName}>Unknown</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Network Details */}
        <View style={[styles.detailsCard, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
          <Text style={styles.detailsTitle}>Network Analysis</Text>
          
          <View style={styles.detailItem}>
            <Ionicons name="people" size={20} color="#f97316" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Total Nodes</Text>
              <Text style={styles.detailValue}>5 entities</Text>
            </View>
          </View>

          <View style={styles.detailItem}>
            <Ionicons name="link" size={20} color="#3b82f6" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Connections</Text>
              <Text style={styles.detailValue}>4 direct links</Text>
            </View>
          </View>

          <View style={styles.detailItem}>
            <Ionicons name="warning" size={20} color="#ef4444" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Risk Level</Text>
              <Text style={[styles.detailValue, { color: '#ef4444' }]}>High - Known Fraud Ring</Text>
            </View>
          </View>
        </View>

        {/* Entity List */}
        <View style={[styles.entityCard, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
          <Text style={styles.entityTitle}>Network Entities</Text>
          
          <View style={[styles.entityItem, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
            <View style={[styles.entityIcon, { backgroundColor: '#22c55e' }]}>
              <Ionicons name="person" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.entityInfo}>
              <Text style={styles.entityName}>Rajesh Gupta (Victim)</Text>
              <Text style={styles.entityDetails}>ICICI Bank • XXXX-XXXX-4521</Text>
              <Text style={[styles.entityAmount, { color: '#f97316' }]}>Lost: {formatCurrency(350000)}</Text>
            </View>
          </View>

          <View style={[styles.entityItem, { backgroundColor: 'rgba(249, 115, 22, 0.1)' }]}>
            <View style={[styles.entityIcon, { backgroundColor: '#f97316' }]}>
              <Ionicons name="card" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.entityInfo}>
              <Text style={styles.entityName}>Mule Account 1</Text>
              <Text style={styles.entityDetails}>SBI • Suresh K***r • 23 days old</Text>
              <Text style={[styles.entityAmount, { color: '#22c55e' }]}>Received: {formatCurrency(210000)}</Text>
            </View>
          </View>

          <View style={[styles.entityItem, { backgroundColor: 'rgba(249, 115, 22, 0.1)' }]}>
            <View style={[styles.entityIcon, { backgroundColor: '#f97316' }]}>
              <Ionicons name="card" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.entityInfo}>
              <Text style={styles.entityName}>Mule Account 2</Text>
              <Text style={styles.entityDetails}>HDFC • Ram***n P. • 45 days old</Text>
              <Text style={[styles.entityAmount, { color: '#22c55e' }]}>Received: {formatCurrency(100000)}</Text>
            </View>
          </View>
        </View>
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
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  networkContainer: {
    marginBottom: 20,
  },
  networkCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
  },
  networkTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  networkSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 24,
  },
  networkGraph: {
    alignItems: 'center',
    minHeight: 300,
  },
  node: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  victimNode: {
    backgroundColor: '#22c55e',
  },
  muleNode: {
    backgroundColor: '#f97316',
  },
  suspectNode: {
    backgroundColor: '#ef4444',
  },
  nodeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  nodeName: {
    fontSize: 10,
    color: '#FFFFFF',
  },
  nodeAmount: {
    fontSize: 9,
    color: '#FFFFFF',
    marginTop: 2,
  },
  muleRow: {
    flexDirection: 'row',
    gap: 40,
  },
  suspectRow: {
    flexDirection: 'row',
    gap: 40,
  },
  connectionLine: {
    width: 2,
    height: 40,
    backgroundColor: '#475569',
    marginVertical: 8,
  },
  detailsCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: '#cbd5e1',
  },
  entityCard: {
    borderRadius: 16,
    padding: 20,
  },
  entityTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  entityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  entityIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entityInfo: {
    flex: 1,
  },
  entityName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  entityDetails: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  entityAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
});

