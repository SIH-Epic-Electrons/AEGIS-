// Communication Service for Officer-to-Officer Communication
import { apiService } from './api';
import { websocketService } from './websocketService';
import { notificationService } from './notificationService';
import { getCaseDetails } from './caseService';
import { getCurrentOfficerId } from './authService';
import * as Location from 'expo-location';
import { Linking } from 'react-native';

export interface Channel {
  id: string;
  caseId: string;
  name: string;
  type: 'case' | 'department' | 'broadcast';
  participants: Officer[];
  messages: Message[];
  createdAt: string;
}

export interface Message {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: 'text' | 'image' | 'location' | 'action' | 'system';
  timestamp: string;
  readBy: string[];
  attachments?: Attachment[];
  metadata?: any;
}

export interface Attachment {
  id: string;
  type: 'image' | 'file' | 'location';
  url: string;
  name?: string;
  size?: number;
}

export interface Officer {
  id: string;
  name: string;
  rank: string;
  badgeId: string;
  phone?: string;
}

export interface QuickMessageTemplate {
  id: string;
  title: string;
  message: string;
  variables?: string[];
}

export interface BroadcastResponse {
  success: boolean;
  recipients: number;
  message: string;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Quick message templates
export const QUICK_MESSAGE_TEMPLATES: QuickMessageTemplate[] = [
  {
    id: 'team_deployed',
    title: 'Team Deployed',
    message: 'Team {teamName} deployed to {location}. ETA: {eta} minutes.',
    variables: ['teamName', 'location', 'eta'],
  },
  {
    id: 'freeze_completed',
    title: 'Freeze Completed',
    message: 'Accounts frozen successfully. {count} accounts frozen in {time}s.',
    variables: ['count', 'time'],
  },
  {
    id: 'suspect_spotted',
    title: 'Suspect Spotted',
    message: 'Suspect spotted at {location}. Requesting backup.',
    variables: ['location'],
  },
  {
    id: 'interception_successful',
    title: 'Interception Successful',
    message: 'Suspect apprehended at {location}. Funds recovered: ₹{amount}.',
    variables: ['location', 'amount'],
  },
];

// Create case channel
export async function createCaseChannel(caseId: string): Promise<ServiceResponse<Channel>> {
  try {
    // 1. Get case details
    const caseDetails = await getCaseDetails(caseId);
    if (!caseDetails.success || !caseDetails.data) {
      return { success: false, error: 'Case not found' };
    }

    // 2. Get all officers involved in case (mock for now)
    const participants: Officer[] = [
      {
        id: await getCurrentOfficerId() || 'officer-1',
        name: 'Current Officer',
        rank: 'Inspector',
        badgeId: 'MH-CYB-001',
      },
    ];

    // 3. Create channel (mock for dev)
    if (__DEV__) {
      const channel: Channel = {
        id: `channel_${caseId}`,
        caseId,
        name: `Case ${caseDetails.data.caseNumber}`,
        type: 'case',
        participants,
        messages: [],
        createdAt: new Date().toISOString(),
      };

      // 4. Subscribe to channel messages
      websocketService.subscribe(`channel_${channel.id}`, (message: Message) => {
        console.log('Message received:', message);
        // This would update local state/store
      });

      return { success: true, data: channel };
    }

    // In production, this would call the API
    return { success: false, error: 'Channel creation not available' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create channel' };
  }
}

// Get or create case channel
export async function getOrCreateCaseChannel(caseId: string): Promise<Channel> {
  // Check if channel exists in local state
  // If not, create it
  const result = await createCaseChannel(caseId);
  if (result.success && result.data) {
    return result.data;
  }
  throw new Error('Failed to get or create channel');
}

// Send message
export async function sendMessage(
  channelId: string,
  content: string,
  type: Message['type'] = 'text',
  attachments?: Attachment[]
): Promise<ServiceResponse<Message>> {
  try {
    const officerId = await getCurrentOfficerId();
    if (!officerId) {
      return { success: false, error: 'Officer not authenticated' };
    }

    const message: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      channelId,
      senderId: officerId,
      senderName: 'Current Officer', // Would get from auth store
      content,
      type,
      timestamp: new Date().toISOString(),
      readBy: [],
      attachments,
    };

    // In production, this would call the API
    if (__DEV__) {
      // Mock success
      return { success: true, data: message };
    }

    return { success: false, error: 'Message sending not available' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to send message' };
  }
}

// Send quick message
export async function sendQuickMessage(
  caseId: string,
  templateId: string,
  variables: Record<string, string>
): Promise<ServiceResponse<Message>> {
  try {
    const template = QUICK_MESSAGE_TEMPLATES.find(t => t.id === templateId);
    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    // Replace variables in message
    let message = template.message;
    template.variables?.forEach(variable => {
      const value = variables[variable] || `{${variable}}`;
      message = message.replace(`{${variable}}`, value);
    });

    // Get or create channel
    const channel = await getOrCreateCaseChannel(caseId);

    // Send message
    return await sendMessage(channel.id, message, 'text');
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to send quick message' };
  }
}

// Broadcast alert
export async function broadcastAlert(
  alert: any,
  radius: number = 10 // km
): Promise<ServiceResponse<BroadcastResponse>> {
  try {
    const officerLocation = await Location.getCurrentPositionAsync();
    if (!officerLocation) {
      return { success: false, error: 'Location not available' };
    }

    const message = `🚨 ${alert.risk >= 0.9 ? 'CRITICAL' : 'High-Risk'} Alert: ${alert.fraudType || 'Fraud'} • ₹${formatAmount(alert.amount || 0)} • ${alert.timeWindow || 'N/A'} min remaining`;

    // In production, this would call the API
    if (__DEV__) {
      await notificationService.notifyAlert({
        id: `broadcast_${Date.now()}`,
        title: '📢 Alert Broadcasted',
        body: `Sent to all officers within ${radius}km`,
        priority: 'high' as any,
        risk: 0.9,
        amount: alert.amount || 0,
        fraudType: alert.fraudType || 'Unknown',
        timestamp: new Date().toISOString(),
      } as any);

      return {
        success: true,
        data: {
          success: true,
          recipients: 5, // Mock
          message: 'Alert broadcasted successfully',
        },
      };
    }

    return { success: false, error: 'Broadcast not available' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to broadcast alert' };
  }
}

// Initiate call
export async function initiateCall(officerId: string): Promise<ServiceResponse<void>> {
  try {
    // Get officer details (mock for now)
    const officer: Officer = {
      id: officerId,
      name: 'Officer',
      rank: 'Inspector',
      badgeId: 'MH-CYB-001',
      phone: '+91-9876543210',
    };

    if (!officer.phone) {
      return { success: false, error: 'Officer phone number not available' };
    }

    // Open phone dialer
    const phoneUrl = `tel:${officer.phone}`;
    const canOpen = await Linking.canOpenURL(phoneUrl);
    
    if (canOpen) {
      await Linking.openURL(phoneUrl);
      return { success: true };
    }

    return { success: false, error: 'Cannot open phone dialer' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to initiate call' };
  }
}

// Helper function to format amount
function formatAmount(amount: number): string {
  if (amount >= 100000) {
    return `${(amount / 100000).toFixed(1)}L`;
  }
  return amount.toLocaleString();
}

