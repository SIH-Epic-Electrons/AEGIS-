import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/theme';
// Using View-based visualization for better compatibility

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRAPH_WIDTH = SCREEN_WIDTH - 40;
const GRAPH_HEIGHT = 400;

interface NetworkNode {
  id: string;
  type: 'victim' | 'mule' | 'frozen' | 'unknown';
  name: string;
  bank: string;
  accountNumber: string;
  accountHolder: string;
  amount: number;
  status: 'active' | 'frozen' | 'withdrawn' | 'unused';
  x: number;
  y: number;
  label: string;
  muleNumber?: string;
  balance?: number;
  tooltip?: {
    title: string;
    details: string[];
  };
}

export default function MuleNetworkScreen() {
  const { theme } = useTheme();
  const route = useRoute();
  const navigation = useNavigation();
  const { caseId } = route.params as any || {};

  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Pulse animation for predicted ATM
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
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
  }, []);

  // Network nodes matching MVP design exactly
  const nodes: NetworkNode[] = [
    {
      id: 'victim',
      type: 'victim',
      name: 'Rajesh G.',
      bank: 'ICICI Bank',
      accountNumber: 'XXXX-XXXX-4521',
      accountHolder: 'Rajesh Gupta',
      amount: 350000,
      status: 'active',
      x: 160,
      y: 50,
      label: 'VICTIM',
      tooltip: {
        title: '● VICTIM',
        details: [
          'Name: Rajesh Gupta',
          'Bank: ICICI Bank',
          'A/C: XXXX-XXXX-4521',
          'Lost: ₹3,50,000',
        ],
      },
    },
    {
      id: 'm1',
      type: 'mule',
      name: 'M1',
      bank: 'SBI',
      accountNumber: 'XXXX-XXXX-7832',
      accountHolder: 'Amit Kumar',
      amount: 350000,
      status: 'active',
      x: 80,
      y: 160,
      label: 'M1',
      muleNumber: 'M1',
      tooltip: {
        title: '● ACTIVE MULE',
        details: [
          'Name: Amit Kumar',
          'Bank: SBI',
          'A/C: XXXX-XXXX-7832',
          'Received: ₹3,50,000',
          '⚠ Flagged for freeze',
        ],
      },
    },
    {
      id: 'm2',
      type: 'unknown',
      name: 'M2',
      bank: 'Unused',
      accountNumber: '',
      accountHolder: '',
      amount: 0,
      status: 'unused',
      x: 240,
      y: 160,
      label: 'M2',
      muleNumber: 'M2',
      tooltip: {
        title: '● UNUSED PATH',
        details: [
          'No transactions detected',
          'Linked to network',
          'Status: Monitoring',
        ],
      },
    },
    {
      id: 'm3',
      type: 'mule',
      name: 'M3',
      bank: 'HDFC',
      accountNumber: 'XXXX-XXXX-9156',
      accountHolder: 'Vikram Singh',
      amount: 210000,
      status: 'active',
      x: 60,
      y: 280,
      label: 'M3',
      muleNumber: 'M3',
      balance: 210000,
      tooltip: {
        title: '● ACTIVE MULE',
        details: [
          'Name: Vikram Singh',
          'Bank: HDFC Bank',
          'A/C: XXXX-XXXX-9156',
          'Balance: ₹2,10,000',
          '⚠ HIGH RISK - Freeze now',
        ],
      },
    },
    {
      id: 'm4',
      type: 'frozen',
      name: 'M4',
      bank: 'Axis Bank',
      accountNumber: 'XXXX-XXXX-3241',
      accountHolder: 'Suresh Patel',
      amount: 100000,
      status: 'frozen',
      x: 140,
      y: 280,
      label: 'M4',
      muleNumber: 'M4',
      tooltip: {
        title: '● FROZEN',
        details: [
          'Name: Suresh Patel',
          'Bank: Axis Bank',
          'A/C: XXXX-XXXX-3241',
          'Frozen Amt: ₹1,00,000',
          '✓ Frozen at 10:42 AM',
        ],
      },
    },
    {
      id: 'm5',
      type: 'unknown',
      name: 'M5',
      bank: 'Unknown',
      accountNumber: '',
      accountHolder: '',
      amount: 0,
      status: 'unused',
      x: 200,
      y: 280,
      label: '-',
      tooltip: {
        title: '● UNKNOWN',
        details: [
          'Potential linked account',
          'Under investigation',
        ],
      },
    },
    {
      id: 'm6',
      type: 'unknown',
      name: 'M6',
      bank: 'Unknown',
      accountNumber: '',
      accountHolder: '',
      amount: 0,
      status: 'unused',
      x: 280,
      y: 280,
      label: '-',
      tooltip: {
        title: '● UNKNOWN',
        details: [
          'Potential linked account',
          'Under investigation',
        ],
      },
    },
    {
      id: 'atm',
      type: 'unknown',
      name: 'ATM',
      bank: 'HDFC ATM',
      accountNumber: 'Lokhandwala',
      accountHolder: '',
      amount: 210000,
      status: 'active',
      x: 60,
      y: 360,
      label: 'ATM',
      tooltip: {
        title: '⚡ PREDICTED WITHDRAWAL',
        details: [
          'HDFC ATM, Lokhandwala',
          'Andheri West, Mumbai',
          'Window: 11:15 - 11:45 AM',
          'Confidence: 94%',
        ],
      },
    },
  ];

  const activeNodes = nodes.filter(
    (n) => n.type === 'mule' && n.status === 'active'
  );
  const totalNodes = nodes.length;
  const activeCount = activeNodes.length;
  const atRiskAmount = activeNodes.reduce((sum, n) => sum + (n.balance || n.amount), 0);

  const formatCurrency = (amount: number) => {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    }
    return `₹${amount.toLocaleString()}`;
  };

  const getNodeColor = (node: NetworkNode) => {
    if (node.type === 'victim') return '#22C55E';
    if (node.type === 'frozen') return '#EF4444';
    if (node.type === 'mule' && node.status === 'active') return '#F97316';
    return '#6B7280';
  };

  const handleNodePress = (node: NetworkNode) => {
    setSelectedNode(node);
    setShowTooltip(true);
  };

  const handleFreezeAll = () => {
    // @ts-ignore - React Navigation type inference limitation
    navigation.navigate('FreezeConfirmation' as never, {
      caseId,
      frozenAccounts: activeNodes.map((n) => ({
        id: n.id,
        bank: n.bank,
        accountNumber: n.accountNumber,
        amount: n.balance || n.amount,
      })),
      responseTime: 47,
    } as never);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#0F172A' }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Mule Network</Text>
          <Text style={styles.headerSubtitle}>Case #{caseId || 'MH-2025-84721'}</Text>
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
        {/* Network Visualization */}
        <View style={styles.graphContainer}>
          <View style={styles.graphCanvas}>
            {/* Simplified Network Visualization */}
            {/* Top Row - Victim */}
            <View style={styles.nodeRow}>
              <View style={styles.spacer} />
              <TouchableOpacity
                style={[styles.nodeCircle, { backgroundColor: '#22C55E' }]}
                onPress={() => handleNodePress(nodes[0])}
                activeOpacity={0.8}
              >
                <Text style={styles.nodeLabel}>VICTIM</Text>
                <Text style={styles.nodeSubLabel}>Rajesh G.</Text>
              </TouchableOpacity>
              <View style={styles.spacer} />
            </View>

            {/* Middle Row - M1 and M2 */}
            <View style={styles.nodeRow}>
              <TouchableOpacity
                style={[styles.nodeCircle, { backgroundColor: '#F97316' }]}
                onPress={() => handleNodePress(nodes[1])}
                activeOpacity={0.8}
              >
                <Text style={styles.nodeLabel}>M1</Text>
                <Text style={styles.nodeSubLabel}>SBI</Text>
              </TouchableOpacity>
              <View style={styles.spacer} />
              <TouchableOpacity
                style={[styles.nodeCircle, { backgroundColor: '#6B7280', opacity: 0.5 }]}
                onPress={() => handleNodePress(nodes[2])}
                activeOpacity={0.8}
              >
                <Text style={styles.nodeLabel}>M2</Text>
                <Text style={styles.nodeSubLabel}>Unused</Text>
              </TouchableOpacity>
            </View>

            {/* Bottom Row - M3, M4, M5, M6 */}
            <View style={styles.nodeRow}>
              <TouchableOpacity
                style={[styles.nodeCircle, { backgroundColor: '#F97316' }]}
                onPress={() => handleNodePress(nodes[3])}
                activeOpacity={0.8}
              >
                <Text style={styles.nodeLabel}>M3</Text>
                <Text style={styles.nodeSubLabel}>HDFC</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nodeCircle, { backgroundColor: '#EF4444' }]}
                onPress={() => handleNodePress(nodes[4])}
                activeOpacity={0.8}
              >
                <Text style={styles.nodeLabel}>M4</Text>
                <Text style={styles.nodeSubLabel}>FROZEN</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nodeCircle, { backgroundColor: '#6B7280', opacity: 0.3 }]}
                onPress={() => handleNodePress(nodes[5])}
                activeOpacity={0.8}
              >
                <Text style={styles.nodeLabel}>-</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nodeCircle, { backgroundColor: '#6B7280', opacity: 0.3 }]}
                onPress={() => handleNodePress(nodes[6])}
                activeOpacity={0.8}
              >
                <Text style={styles.nodeLabel}>-</Text>
              </TouchableOpacity>
            </View>

            {/* ATM Node */}
            <View style={styles.atmRow}>
              <Animated.View
                style={[
                  styles.atmNode,
                  {
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              >
                <TouchableOpacity
                  style={[styles.nodeCircle, { backgroundColor: '#EF4444', width: 40, height: 40, borderRadius: 20 }]}
                  onPress={() => handleNodePress(nodes[7])}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.nodeLabel, { fontSize: 10 }]}>ATM</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>

          {/* Hover Instruction */}
          <View style={styles.hoverHint}>
            <Ionicons name="hand-left" size={12} color="#9CA3AF" />
            <Text style={styles.hoverText}>Tap nodes for details</Text>
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>LEGEND</Text>
          <View style={styles.legendGrid}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} />
              <Text style={styles.legendText}>Victim</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F97316' }]} />
              <Text style={styles.legendText}>Active Mule</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.legendText}>Frozen</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#6B7280', opacity: 0.5 }]} />
              <Text style={styles.legendText}>Unused/Unknown</Text>
            </View>
          </View>
        </View>

        {/* Network Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalNodes}</Text>
            <Text style={styles.statLabel}>Nodes</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{activeCount}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#F97316' }]}>
              {formatCurrency(atRiskAmount)}
            </Text>
            <Text style={styles.statLabel}>At Risk</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.freezeButton}
          onPress={handleFreezeAll}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#EF4444', '#DC2626']}
            style={styles.freezeButtonGradient}
          >
            <Ionicons name="ban" size={20} color="#FFFFFF" />
            <Text style={styles.freezeButtonText}>Freeze All Active Nodes</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Node Details Modal */}
      <Modal
        visible={showTooltip && selectedNode !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowTooltip(false);
          setSelectedNode(null);
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowTooltip(false);
            setSelectedNode(null);
          }}
        >
          {selectedNode && selectedNode.tooltip && (
            <View style={styles.tooltip}>
              <Text style={[styles.tooltipTitle, { color: getNodeColor(selectedNode) }]}>
                {selectedNode.tooltip.title}
              </Text>
              {selectedNode.tooltip.details.map((detail, index) => (
                <Text key={index} style={styles.tooltipDetail}>
                  {detail}
                </Text>
              ))}
            </View>
          )}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
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
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  graphContainer: {
    height: 400,
    marginBottom: 16,
    position: 'relative',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  graphCanvas: {
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
    paddingVertical: 20,
  },
  nodeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  spacer: {
    flex: 1,
  },
  nodeCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  nodeLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  nodeSubLabel: {
    color: '#FFFFFF',
    fontSize: 8,
    marginTop: 2,
  },
  atmRow: {
    alignItems: 'center',
    marginTop: 20,
  },
  atmNode: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hoverHint: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  hoverText: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  legend: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 12,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '48%',
  },
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  legendText: {
    fontSize: 12,
    color: '#D1D5DB',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    padding: 16,
    paddingBottom: 32,
  },
  freezeButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  freezeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  freezeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltip: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 16,
    minWidth: 200,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tooltipTitle: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
  },
  tooltipDetail: {
    fontSize: 10,
    color: '#CBD5E1',
    marginBottom: 4,
  },
});
