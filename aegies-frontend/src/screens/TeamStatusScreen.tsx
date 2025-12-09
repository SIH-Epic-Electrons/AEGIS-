import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Linking,
  Alert,
  Animated,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/theme';
import * as communicationService from '../services/communicationService';
import * as dispatchService from '../services/dispatchService';

interface Team {
  id: string;
  name: string;
  officer: string;
  status: 'on-site' | 'en-route' | 'available';
  location?: string;
  eta?: string;
  progress?: number;
  phone?: string;
  channel?: string;
}

export default function TeamStatusScreen() {
  const { theme } = useTheme();
  const route = useRoute();
  const navigation = useNavigation();
  const { caseId } = route.params as any;

  const [teams, setTeams] = useState<Team[]>([
    {
      id: '1',
      name: 'Task Force Bravo',
      officer: 'Sgt. Rahul Verma',
      status: 'on-site',
      location: 'HDFC ATM, Lokhandwala',
      phone: '+919876543210',
      channel: 'Channel 7',
    },
    {
      id: '2',
      name: 'Unit 7',
      officer: 'SI Amit Patil',
      status: 'en-route',
      location: 'ICICI ATM, Andheri',
      eta: '8 minutes',
      progress: 65,
      phone: '+919876512345',
      channel: 'Channel 5',
    },
  ]);

  const [availableTeams] = useState<Team[]>([
    {
      id: '3',
      name: 'Unit 3',
      officer: 'Const. Deepak M.',
      status: 'available',
      location: '3.2 km away',
      eta: '12 min',
    },
    {
      id: '4',
      name: 'Cyber Unit',
      officer: 'Tech Officer Priya S.',
      status: 'available',
      location: '5.1 km away',
      eta: '18 min',
    },
  ]);

  // Modal states
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [messageModalVisible, setMessageModalVisible] = useState(false);
  const [radioModalVisible, setRadioModalVisible] = useState(false);
  const [deployModalVisible, setDeployModalVisible] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [deployToastVisible, setDeployToastVisible] = useState(false);

  const quickMessages = [
    '🚨 Suspect approaching ATM - stay alert',
    '✅ Accounts frozen - safe to proceed',
    '📍 Update location status',
  ];

  const slideAnim = useRef(new Animated.Value(0)).current;

  const openContactModal = (team: Team) => {
    setSelectedTeam(team);
    setContactModalVisible(true);
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
  };

  const closeContactModal = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setContactModalVisible(false);
      setSelectedTeam(null);
    });
  };

  const openMessageModal = (team: Team) => {
    setSelectedTeam(team);
    setCustomMessage('');
    setMessageModalVisible(true);
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
  };

  const closeMessageModal = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setMessageModalVisible(false);
      setSelectedTeam(null);
    });
  };

  const openRadioModal = (team: Team) => {
    setSelectedTeam(team);
    setRadioModalVisible(true);
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
  };

  const closeRadioModal = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setRadioModalVisible(false);
      setSelectedTeam(null);
    });
  };

  const openDeployModal = (team: Team) => {
    setSelectedTeam(team);
    setDeployModalVisible(true);
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
  };

  const closeDeployModal = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setDeployModalVisible(false);
      setSelectedTeam(null);
    });
  };

  const handleCall = async (phone: string) => {
    try {
      await Linking.openURL(`tel:${phone}`);
      closeContactModal();
    } catch (error) {
      Alert.alert('Error', 'Unable to make call');
    }
  };

  const handleSendMessage = async () => {
    if (!selectedTeam || !caseId) return;

    try {
      const message = customMessage || quickMessages[0];
      await communicationService.sendMessage(
        `case_${caseId}`,
        message,
        'text'
      );
      Alert.alert('Success', 'Message sent successfully!');
      closeMessageModal();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send message');
    }
  };

  const selectQuickMessage = (message: string) => {
    setCustomMessage(message);
  };

  const handleConfirmDeploy = async () => {
    if (!selectedTeam || !caseId) return;

    try {
      await dispatchService.dispatchTeam(
        selectedTeam.id, 
        caseId, 
        'Proceed to predicted ATM location for interception. Urgency: critical.'
      );
      closeDeployModal();
      setDeployToastVisible(true);
      setTimeout(() => setDeployToastVisible(false), 3000);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to deploy team');
    }
  };

  const handleDeploy = (team: Team) => {
    openDeployModal(team);
  };

  const handleRecordOutcome = () => {
    // @ts-expect-error - React Navigation type inference limitation
    navigation.navigate('OutcomeFeedback' as never, { caseId } as never);
  };

  return (
    <View style={[styles.container, { backgroundColor: '#f8fafc' }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#FFFFFF' }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Active Teams</Text>
            <Text style={styles.headerSubtitle}>
              {teams.length} teams near predicted ATM
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.filterButton} activeOpacity={0.7}>
          <Ionicons name="options" size={20} color="#374151" />
        </TouchableOpacity>
      </View>

      {/* Step Progress Banner */}
      <View style={styles.stepBanner}>
        <LinearGradient
          colors={['#3b82f6', '#2563eb']}
          style={styles.stepBannerGradient}
        >
          <View style={styles.stepBannerContent}>
            <View style={styles.stepItem}>
              <View style={styles.stepCircleCompleted}>
                <Text style={styles.stepCheck}>✓</Text>
              </View>
              <Text style={styles.stepTextCompleted}>Freeze</Text>
            </View>
            <Text style={styles.stepArrow}>→</Text>
            <View style={styles.stepItem}>
              <View style={styles.stepCircleActive}>
                <Text style={styles.stepNumber}>2</Text>
              </View>
              <Text style={styles.stepTextActive}>Alert Teams</Text>
            </View>
            <Text style={styles.stepArrow}>→</Text>
            <View style={styles.stepItem}>
              <View style={styles.stepCircleInactive}>
                <Text style={styles.stepNumberInactive}>3</Text>
              </View>
              <Text style={styles.stepTextInactive}>Intercept</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {teams.map((team) => (
          <View
            key={team.id}
            style={[
              styles.teamCard,
              team.status === 'on-site' && styles.teamCardOnSite,
            ]}
          >
            <View style={styles.teamHeader}>
              <View style={styles.teamInfo}>
                <View
                  style={[
                    styles.teamIcon,
                    {
                      backgroundColor:
                        team.status === 'on-site' ? '#2563eb' : '#f59e0b',
                    },
                  ]}
                >
                  <Text style={styles.teamIconText}>
                    {team.name.substring(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={styles.teamName}>{team.name}</Text>
                  <Text style={styles.teamOfficer}>{team.officer}</Text>
                </View>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      team.status === 'on-site' ? '#dcfce7' : '#fef3c7',
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        team.status === 'on-site' ? '#22c55e' : '#f59e0b',
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        team.status === 'on-site' ? '#166534' : '#d97706',
                    },
                  ]}
                >
                  {team.status === 'on-site' ? 'ON SITE' : 'EN ROUTE'}
                </Text>
              </View>
            </View>

            <View style={styles.teamStats}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>
                  {team.status === 'on-site' ? 'Location' : 'Heading to'}
                </Text>
                <Text style={styles.statValue}>{team.location}</Text>
              </View>
              {team.eta && (
                <View style={[styles.statBox, { backgroundColor: '#fef3c7' }]}>
                  <Text style={styles.statLabel}>ETA</Text>
                  <Text style={[styles.statValue, { color: '#d97706' }]}>
                    {team.eta}
                  </Text>
                </View>
              )}
              {team.status === 'on-site' && (
                <View style={[styles.statBox, { backgroundColor: '#dcfce7' }]}>
                  <Text style={styles.statLabel}>Status</Text>
                  <Text style={[styles.statValue, { color: '#166534' }]}>
                    Ready to intercept
                  </Text>
                </View>
              )}
            </View>

            {team.progress && (
              <View style={styles.progressContainer}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>Progress</Text>
                  <Text style={styles.progressValue}>{team.progress}%</Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${team.progress}%` },
                    ]}
                  />
                </View>
              </View>
            )}

            <View style={styles.actionButtons}>
              {team.phone && (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#22c55e' }]}
                  onPress={() => openContactModal(team)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#3b82f6' }]}
                onPress={() => openMessageModal(team)}
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubble" size={18} color="#FFFFFF" />
              </TouchableOpacity>
              {team.channel && (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#f59e0b' }]}
                  onPress={() => openRadioModal(team)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="radio" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        {/* Available Teams */}
        <Text style={styles.sectionTitle}>Available for Deployment</Text>
        {availableTeams.map((team) => (
          <View key={team.id} style={styles.availableTeamCard}>
            <View style={styles.teamInfo}>
              <View style={[styles.teamIcon, { backgroundColor: '#e5e7eb' }]}>
                <Text style={[styles.teamIconText, { color: '#6b7280' }]}>
                  {team.name.substring(0, 2).toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={styles.teamName}>{team.name}</Text>
                <Text style={styles.teamOfficer}>
                  {team.officer} • {team.location}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.deployButton}
              onPress={() => openDeployModal(team)}
              activeOpacity={0.8}
            >
              <Ionicons name="send" size={18} color="#FFFFFF" />
              <Text style={styles.deployButtonText}>Deploy to Predicted ATM</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <View style={styles.nextStepCard}>
          <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
          <View style={styles.nextStepContent}>
            <Text style={styles.nextStepTitle}>
              Teams Alerted! Waiting for Intercept...
            </Text>
            <Text style={styles.nextStepSubtitle}>
              Task Force Bravo is on site at predicted ATM
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.recordOutcomeButton}
          onPress={handleRecordOutcome}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#22c55e', '#16a34a']}
            style={styles.recordOutcomeGradient}
          >
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>STEP 3</Text>
            </View>
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            <Text style={styles.recordOutcomeText}>Proceed to Record Outcome</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Contact Modal (Call) */}
      <Modal
        visible={contactModalVisible}
        transparent
        animationType="none"
        onRequestClose={closeContactModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeContactModal}
        >
          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [500, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View style={[styles.modalIconContainer, { backgroundColor: '#dcfce7' }]}>
                  <View style={styles.pulseRing} />
                  <Ionicons name="call" size={40} color="#22c55e" style={styles.modalIcon} />
                </View>
                <Text style={styles.modalTitle}>{selectedTeam?.officer || 'Officer'}</Text>
                <Text style={styles.modalSubtitle}>{selectedTeam?.name || 'Team'}</Text>
              </View>
              <TouchableOpacity
                style={[styles.modalActionButton, { backgroundColor: '#22c55e' }]}
                onPress={() => selectedTeam?.phone && handleCall(selectedTeam.phone)}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={24} color="#FFFFFF" />
                <Text style={styles.modalActionText}>
                  Call {selectedTeam?.phone || ''}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={closeContactModal}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Message Modal */}
      <Modal
        visible={messageModalVisible}
        transparent
        animationType="none"
        onRequestClose={closeMessageModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeMessageModal}
        >
          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [500, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeaderRow}>
                <View style={[styles.modalIconSmall, { backgroundColor: '#dbeafe' }]}>
                  <Ionicons name="chatbubble" size={24} color="#3b82f6" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>{selectedTeam?.officer || 'Officer'}</Text>
                  <Text style={styles.modalSubtitle}>{selectedTeam?.name || 'Team'}</Text>
                </View>
              </View>
              <Text style={styles.quickMessageLabel}>Quick Messages</Text>
              {quickMessages.map((msg, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.quickMessageButton}
                  onPress={() => selectQuickMessage(msg)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickMessageText}>{msg}</Text>
                </TouchableOpacity>
              ))}
              <TextInput
                style={styles.messageInput}
                placeholder="Or type custom message..."
                placeholderTextColor="#9ca3af"
                multiline
                value={customMessage}
                onChangeText={setCustomMessage}
              />
              <TouchableOpacity
                style={[styles.modalActionButton, { backgroundColor: '#3b82f6' }]}
                onPress={handleSendMessage}
                activeOpacity={0.8}
              >
                <Ionicons name="send" size={20} color="#FFFFFF" />
                <Text style={styles.modalActionText}>Send Message</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={closeMessageModal}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Radio Modal */}
      <Modal
        visible={radioModalVisible}
        transparent
        animationType="none"
        onRequestClose={closeRadioModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeRadioModal}
        >
          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [500, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View style={[styles.modalIconContainer, { backgroundColor: '#fed7aa' }]}>
                  <Ionicons name="radio" size={40} color="#f59e0b" style={styles.modalIcon} />
                </View>
                <Text style={styles.modalTitle}>{selectedTeam?.name || 'Team'}</Text>
                <Text style={[styles.modalSubtitle, { color: '#f59e0b', fontWeight: '600' }]}>
                  {selectedTeam?.channel || 'Channel'}
                </Text>
              </View>
              <View style={styles.radioStatusCard}>
                <View style={styles.radioStatusRow}>
                  <Text style={styles.radioStatusLabel}>Radio Status</Text>
                  <View style={styles.radioStatusBadge}>
                    <Text style={styles.radioStatusBadgeText}>CONNECTED</Text>
                  </View>
                </View>
                <View style={styles.signalRow}>
                  <Ionicons name="cellular" size={20} color="#f59e0b" />
                  <View style={styles.signalBar}>
                    <View style={[styles.signalFill, { width: '85%' }]} />
                  </View>
                  <Text style={styles.signalText}>Strong</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.modalActionButton, { backgroundColor: '#f59e0b' }]}
                activeOpacity={0.8}
              >
                <Ionicons name="mic" size={24} color="#FFFFFF" />
                <Text style={styles.modalActionText}>Push to Talk</Text>
              </TouchableOpacity>
              <View style={styles.radioActions}>
                <TouchableOpacity style={styles.radioActionButton} activeOpacity={0.7}>
                  <Ionicons name="volume-high" size={18} color="#374151" />
                  <Text style={styles.radioActionText}>Listen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.radioActionButton} activeOpacity={0.7}>
                  <Ionicons name="headset" size={18} color="#374151" />
                  <Text style={styles.radioActionText}>Earpiece</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={closeRadioModal}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Close Radio</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Deploy Modal */}
      <Modal
        visible={deployModalVisible}
        transparent
        animationType="none"
        onRequestClose={closeDeployModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeDeployModal}
        >
          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [500, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View style={[styles.modalIconContainer, { backgroundColor: '#dbeafe' }]}>
                  <Ionicons name="car" size={40} color="#3b82f6" style={styles.modalIcon} />
                </View>
                <Text style={styles.modalTitle}>Deploy Team?</Text>
                <Text style={styles.modalSubtitle}>Send team to predicted ATM location</Text>
              </View>
              <View style={styles.deployInfoCard}>
                <View style={styles.deployInfoRow}>
                  <Text style={styles.deployInfoLabel}>Team</Text>
                  <Text style={styles.deployInfoValue}>{selectedTeam?.name || ''}</Text>
                </View>
                <View style={styles.deployInfoRow}>
                  <Text style={styles.deployInfoLabel}>Officer</Text>
                  <Text style={styles.deployInfoValue}>{selectedTeam?.officer || ''}</Text>
                </View>
                <View style={styles.deployInfoRow}>
                  <Text style={styles.deployInfoLabel}>Distance</Text>
                  <Text style={styles.deployInfoValue}>{selectedTeam?.location || ''}</Text>
                </View>
                <View style={styles.deployInfoRow}>
                  <Text style={styles.deployInfoLabel}>ETA</Text>
                  <Text style={[styles.deployInfoValue, { color: '#3b82f6', fontWeight: '700' }]}>
                    {selectedTeam?.eta || ''}
                  </Text>
                </View>
              </View>
              <View style={styles.deployInfoBanner}>
                <Ionicons name="information-circle" size={20} color="#3b82f6" />
                <Text style={styles.deployInfoBannerText}>
                  Team will be alerted with case details, predicted ATM location, and suspect information.
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.modalActionButton, { backgroundColor: '#3b82f6' }]}
                onPress={handleConfirmDeploy}
                activeOpacity={0.8}
              >
                <Ionicons name="send" size={20} color="#FFFFFF" />
                <Text style={styles.modalActionText}>Confirm Deployment</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={closeDeployModal}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Deploy Success Toast */}
      {deployToastVisible && (
        <View style={styles.toastContainer}>
          <View style={styles.toast}>
            <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
            <View>
              <Text style={styles.toastTitle}>Team Deployed!</Text>
              <Text style={styles.toastMessage}>
                {selectedTeam?.name || 'Team'} is en route to the location
              </Text>
            </View>
          </View>
        </View>
      )}
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
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBanner: {
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  stepBannerGradient: {
    padding: 12,
  },
  stepBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepCircleCompleted: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleInactive: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCheck: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepNumber: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563eb',
  },
  stepNumberInactive: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepTextCompleted: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textDecorationLine: 'line-through',
  },
  stepTextActive: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepTextInactive: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  stepArrow: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 200,
  },
  teamCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  teamCardOnSite: {
    borderWidth: 2,
    borderColor: '#86efac',
  },
  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  teamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  teamIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamIconText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  teamName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  teamOfficer: {
    fontSize: 14,
    color: '#6b7280',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  teamStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 10,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  progressValue: {
    fontSize: 12,
    color: '#6b7280',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#f59e0b',
    borderRadius: 3,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 12,
  },
  availableTeamCard: {
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
  deployButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    marginTop: 12,
  },
  deployButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    padding: 16,
    paddingBottom: 32,
  },
  nextStepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  nextStepContent: {
    flex: 1,
  },
  nextStepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 4,
  },
  nextStepSubtitle: {
    fontSize: 12,
    color: '#16a34a',
  },
  recordOutcomeButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  recordOutcomeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    position: 'relative',
  },
  stepBadge: {
    position: 'absolute',
    top: -8,
    left: 16,
    backgroundColor: '#fbbf24',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stepBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#78350f',
  },
  recordOutcomeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 48,
    height: 6,
    backgroundColor: '#d1d5db',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  modalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  modalIconSmall: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalIcon: {
    zIndex: 10,
  },
  pulseRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(34, 197, 94, 0.3)',
    opacity: 0.5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 12,
  },
  modalActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalCancelButton: {
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  quickMessageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  quickMessageButton: {
    padding: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 8,
  },
  quickMessageText: {
    fontSize: 14,
    color: '#374151',
  },
  messageInput: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  radioStatusCard: {
    backgroundColor: '#fed7aa',
    borderWidth: 1,
    borderColor: '#fdba74',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  radioStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  radioStatusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  radioStatusBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  radioStatusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  signalBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  signalFill: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 4,
  },
  signalText: {
    fontSize: 14,
    color: '#374151',
  },
  radioActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  radioActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    gap: 8,
  },
  radioActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  deployInfoCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  deployInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  deployInfoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  deployInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  deployInfoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  deployInfoBannerText: {
    flex: 1,
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  toastContainer: {
    position: 'absolute',
    top: 80,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  toastMessage: {
    fontSize: 14,
    color: '#dcfce7',
  },
});

