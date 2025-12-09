// Case Service for Case Details and Investigation
import { caseService as apiCaseService, predictionService } from '../api';
import { websocketService } from './websocketService';
import { Alert } from '../types';

export interface CaseDetails {
  // Basic info
  id: string;
  caseNumber: string;
  complaintId: string;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;

  // Fraud details
  fraudType: string;
  amount: number;
  victim: {
    anonymizedId: string;
    ageRange: string;
    location: string;
    city?: string;
    anonymized: boolean;
    name?: string;
    phone?: string;
  };

  // Prediction
  prediction: {
    riskScore: number;
    confidence: number;
    timeWindow: {
      start: string;
      end: string;
      remaining: number; // minutes
    };
    hotspots: any[];
    shapExplanation: any;
    predictedAtm?: {
      id: string;
      name: string;
      bank: string;
      address: string;
      latitude?: number;
      longitude?: number;
    };
  };

  // Suspect intelligence
  suspect: {
    upiId: string;
    linkedAccounts: string[];
    moMatch: number;
    crossBankPattern: boolean;
    networkSize: number;
  };

  // Mule accounts
  muleAccounts: any[];

  // Actions taken
  actions: any[];

  freezeStatus: any;
  teamStatus: any;

  // Money trail
  moneyTrail: Transaction[];

  // Evidence
  evidence: any[];

  // Timeline
  timeline: TimelineEvent[];

  // Countdown
  countdown: {
    timeRemaining: number; // seconds
    windowEnd: string;
    isUrgent: boolean;
  };
  
  // For display compatibility
  predictedLocation?: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  confidence?: number;
  location?: string;
}

export type CaseStatus = 'active' | 'investigating' | 'freeze_pending' | 'resolved' | 'closed';

export interface Transaction {
  id: string;
  fromAccount: string;
  toAccount: string;
  amount: number;
  timestamp: string;
  transactionType: 'upi' | 'neft' | 'imps' | 'rtgs';
  status: 'completed' | 'pending' | 'failed';
  bank: string;
  location?: { lat: number; lon: number };
  suspicious: boolean;
  flaggedReason?: string;
}

export interface TimelineEvent {
  id: string;
  type: string;
  timestamp: string;
  description: string;
  actor?: string;
}

export interface CaseUpdate {
  type: 'freeze' | 'team' | 'countdown' | 'status';
  data: any;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Get case details - using proper API endpoints
export async function getCaseDetails(caseId: string): Promise<ServiceResponse<CaseDetails>> {
  try {
    // 1. Get case from API
    const caseResult = await apiCaseService.getCaseDetails(caseId);
    
    if (!caseResult.success || !caseResult.data) {
      return { success: false, error: caseResult.error || 'Case not found' };
    }
    
    const apiCase = caseResult.data;

    // 2. Get prediction details
    let predictionData: any = null;
    try {
      const predResult = await predictionService.getCasePrediction(caseId);
      if (predResult.success && predResult.data) {
        predictionData = predResult.data;
      }
    } catch (e) {
      console.warn('Could not load prediction data:', e);
    }

    // 3. Get mule accounts
    let muleAccounts: any[] = [];
    try {
      const muleResult = await apiCaseService.getCaseMuleAccounts(caseId);
      if (muleResult.success && muleResult.data) {
        muleAccounts = muleResult.data.mule_accounts || [];
      }
    } catch (e) {
      console.warn('Could not load mule accounts:', e);
    }

    // 4. Subscribe to real-time updates
    const unsubscribe = websocketService.subscribe(
      `case_${caseId}`,
      (update: CaseUpdate) => {
        console.log('Case update received:', update);
      }
    );

    // 5. Calculate time window
    const predTimeWindow = apiCase.prediction?.time_window;
    const timeWindowStart = predTimeWindow?.start || new Date().toISOString();
    const timeWindowEnd = predTimeWindow?.end || new Date(Date.now() + 60 * 60 * 1000).toISOString();

    // 6. Transform API response to CaseDetails format
    const caseDetails: CaseDetails = {
      id: apiCase.case_id,
      caseNumber: apiCase.case_number,
      complaintId: apiCase.complaint?.ncrp_id || apiCase.case_id,
      status: mapApiStatusToCaseStatus(apiCase.status),
      createdAt: apiCase.created_at,
      updatedAt: apiCase.updated_at,
      fraudType: apiCase.complaint?.fraud_type || 'Unknown',
      amount: apiCase.complaint?.fraud_amount || 0,
      victim: {
        anonymizedId: 'VICTIM-' + apiCase.case_number?.slice(-6),
        ageRange: '30-40',
        location: apiCase.victim?.city || 'Unknown',
        city: apiCase.victim?.city,
        name: apiCase.victim?.name,
        phone: apiCase.victim?.phone,
        anonymized: true,
      },
      prediction: {
        riskScore: apiCase.prediction?.confidence || 0.5,
        confidence: Math.round((apiCase.prediction?.confidence || 0.5) * 100),
        timeWindow: {
          start: timeWindowStart,
          end: timeWindowEnd,
          remaining: Math.max(0, Math.floor((new Date(timeWindowEnd).getTime() - Date.now()) / 60000)),
        },
        hotspots: predictionData?.alternative_locations || [],
        shapExplanation: predictionData?.explanation || null,
        predictedAtm: apiCase.prediction?.predicted_atm ? {
          id: apiCase.prediction.predicted_atm.id,
          name: apiCase.prediction.predicted_atm.name,
          bank: apiCase.prediction.predicted_atm.bank,
          address: apiCase.prediction.predicted_atm.address,
        } : undefined,
      },
      suspect: {
        upiId: apiCase.destination_account?.upi_id || 'N/A',
        linkedAccounts: [],
        moMatch: 0,
        crossBankPattern: false,
        networkSize: apiCase.mule_accounts_summary?.total || 0,
      },
      muleAccounts: muleAccounts.map(m => ({
        id: m.id,
        bank: m.bank,
        bankName: m.bank,
        accountNumber: m.account_number,
        amount: m.amount_received,
        amountReceived: m.amount_received,
        currentBalance: m.current_balance,
        accountHolder: m.holder_name,
        status: m.status?.toLowerCase() || 'active',
        muleConfidence: m.mule_confidence,
        hopNumber: m.hop_number,
        riskIndicators: m.risk_indicators || [],
      })),
      actions: [],
      freezeStatus: {
        frozenAccounts: muleAccounts.filter(m => m.status === 'FROZEN').map(m => m.id),
        totalFrozen: muleAccounts.filter(m => m.status === 'FROZEN').length,
        status: apiCase.mule_accounts_summary?.frozen > 0 ? 'completed' : 'pending',
      },
      teamStatus: null,
      moneyTrail: [],
      evidence: [],
      timeline: [
        {
          id: '1',
          type: 'case_created',
          timestamp: apiCase.created_at,
          description: 'Case created from NCRP complaint',
        },
      ],
      countdown: calculateCountdown({
        start: timeWindowStart,
        end: timeWindowEnd,
      }),
      // Display-friendly properties
      predictedLocation: apiCase.prediction?.predicted_atm ? {
        name: apiCase.prediction.predicted_atm.name,
        address: apiCase.prediction.predicted_atm.address,
        latitude: 19.0760, // Default to Mumbai - would come from API
        longitude: 72.8777,
      } : undefined,
      confidence: Math.round((apiCase.prediction?.confidence || 0.5) * 100),
      location: apiCase.victim?.city || 'Unknown',
    };

    return { success: true, data: caseDetails };
  } catch (error: any) {
    console.error('Error loading case details:', error);
    return { success: false, error: error.message || 'Failed to load case details' };
  }
}

// Map API status to internal status
function mapApiStatusToCaseStatus(status: string): CaseStatus {
  const statusMap: Record<string, CaseStatus> = {
    'NEW': 'active',
    'IN_PROGRESS': 'investigating',
    'FREEZE_INITIATED': 'freeze_pending',
    'TEAM_DEPLOYED': 'investigating',
    'RESOLVED': 'resolved',
    'CLOSED': 'closed',
  };
  return statusMap[status] || 'active';
}

// Calculate countdown from time window
export function calculateCountdown(timeWindow: {
  start: string;
  end: string;
}): {
  timeRemaining: number;
  windowEnd: string;
  isUrgent: boolean;
} {
  const now = new Date();
  const end = new Date(timeWindow.end);
  const remaining = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));

  return {
    timeRemaining: remaining,
    windowEnd: timeWindow.end,
    isUrgent: remaining < 30 * 60, // Less than 30 minutes
  };
}

// Subscribe to case updates
export function subscribeToCaseUpdates(
  caseId: string,
  callback: (update: CaseUpdate) => void
): () => void {
  return websocketService.subscribe(`case_${caseId}`, (update: any) => {
    switch (update.type) {
      case 'freeze_status_changed':
        callback({ type: 'freeze', data: update.data });
        break;
      case 'team_deployed':
        callback({ type: 'team', data: update.data });
        break;
      case 'countdown_update':
        callback({ type: 'countdown', data: update.data });
        break;
      case 'status_changed':
        callback({ type: 'status', data: update.data });
        break;
      default:
        callback(update);
    }
  });
}

// Get money trail
export async function getMoneyTrail(caseId: string): Promise<ServiceResponse<Transaction[]>> {
  try {
    // This would call a dedicated money trail endpoint
    // For now, return empty array
    return { success: true, data: [] };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to load money trail' };
  }
}

// Build transaction graph
export function buildTransactionGraph(transactions: Transaction[]): any {
  const nodes = new Map<string, any>();
  const edges: any[] = [];

  transactions.forEach((tx) => {
    // Add from account node
    if (!nodes.has(tx.fromAccount)) {
      nodes.set(tx.fromAccount, {
        id: tx.fromAccount,
        bank: tx.bank,
        totalIn: 0,
        totalOut: 0,
        suspicious: tx.suspicious,
      });
    }

    // Add to account node
    if (!nodes.has(tx.toAccount)) {
      nodes.set(tx.toAccount, {
        id: tx.toAccount,
        bank: tx.bank,
        totalIn: 0,
        totalOut: 0,
        suspicious: false,
      });
    }

    // Update totals
    const fromNode = nodes.get(tx.fromAccount)!;
    fromNode.totalOut += tx.amount;

    const toNode = nodes.get(tx.toAccount)!;
    toNode.totalIn += tx.amount;

    // Add edge
    edges.push({
      from: tx.fromAccount,
      to: tx.toAccount,
      amount: tx.amount,
      timestamp: tx.timestamp,
      type: tx.transactionType,
    });
  });

  return { nodes: Array.from(nodes.values()), edges };
}


