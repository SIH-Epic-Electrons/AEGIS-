// Core Types for AEGIS LEA App

export interface User {
  id: string;
  email: string;
  name: string;
  type: 'lea' | 'bank' | 'admin' | 'citizen';
  organization: string;
  badgeNumber?: string;
  rank?: string;
}

export interface I4CCoordination {
  required: boolean;
  matchingStates: string[];
  patternId?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  coordinationId?: string;
}

export interface CrossStateIntelligence {
  patternId: string;
  affectedStates: string[];
  totalComplaints: number;
  totalAmount: number;
  predictedNextState?: string;
  confidence: number;
}

export interface Alert {
  id: string;
  type: 'high_priority' | 'medium_priority' | 'low_priority';
  title: string;
  message: string;
  timestamp: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  complaintId: string;
  amount: number;
  status: 'pending' | 'active' | 'resolved' | 'cancelled';
  risk?: number; // 0-1 probability
  timeWindow?: number; // minutes until withdrawal window closes
  dossier?: Dossier;
  i4cCoordination?: I4CCoordination; // I4C national coordination data
  fraudType?: string; // Added for notification service compatibility
}

export interface Dossier {
  victim: {
    anonymizedId: string;
    age: number;
    location: string;
    fraudType: string;
  };
  suspect: {
    accountNumbers?: string[];
    phoneNumbers?: string[];
    modusOperandi?: string;
    similarityScore: number;
    linkedAccounts?: string[];
  };
  hotspots?: Hotspot[];
  linkedAccounts?: LinkedAccount[];
  crossStateIntelligence?: CrossStateIntelligence; // Cross-state fraud pattern data
}

export interface Hotspot {
  id: string;
  location: {
    latitude: number;
    longitude: number;
  };
  address: string;
  probability: number;
  radius?: number;
  confidenceInterval?: [number, number]; // [lower, upper]
  atmDetails?: {
    bankName: string;
    atmId: string;
  };
  scamType?: string; // Added for filtering
  timestamp?: string; // Added for time-based filtering
  timeWindow?: number; // Added for time window calculations (minutes)
  digitalCordon?: boolean; // Added for digital cordon status
}

export interface LinkedAccount {
  accountNumber: string;
  bankName: string;
  lastTransaction: string;
  riskScore: number;
}

export interface Prediction {
  id: string;
  complaintId: string;
  amount: number;
  timestamp: string;
  hotspots: Hotspot[];
  status: 'active' | 'resolved' | 'expired';
  digitalCordon: boolean;
}

export interface Action {
  id: string;
  alertId: string;
  type: 'freeze' | 'navigate' | 'evidence' | 'outcome';
  timestamp: string;
  status: 'pending' | 'synced' | 'failed';
  data?: any;
}

export interface Evidence {
  id: string;
  alertId: string;
  type: 'photo' | 'video' | 'document';
  uri: string;
  timestamp: string;
  annotations?: Annotation[];
  redacted: boolean;
  synced: boolean;
}

export interface Annotation {
  type: 'blur' | 'circle' | 'text';
  coordinates: { x: number; y: number; width: number; height: number };
  label?: string;
}

export interface Statistics {
  totalComplaints: number;
  activePredictions: number;
  fundsRecovered: number;
  successRate: number;
  avgResponseTime: number;
  interdictionsToday: number;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  error?: string;
}

export interface SyncQueue {
  actions: Action[];
  evidence: Evidence[];
  lastSyncTime: string | null;
}

