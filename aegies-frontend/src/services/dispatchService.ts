// Dispatch Service for Team Coordination
import { apiService } from './api';
import { websocketService } from './websocketService';
import { notificationService } from './notificationService';
import { getCaseDetails } from './caseService';
import { teamService, DeployTeamRequest } from '../api/teamService';

export interface TeamRequirements {
  minOfficers?: number;
  capabilities?: string[]; // ['cyber', 'forensics', 'interception']
  maxDistance?: number; // km
  urgency?: 'normal' | 'urgent' | 'critical';
}

export interface Team {
  id: string;
  name: string;
  stationId: string;
  stationName: string;
  stationAddress: string;
  currentLocation: { lat: number; lon: number };
  status: 'available' | 'busy' | 'off-duty' | 'deployed';
  capabilities: string[];
  distance: number; // km from hotspot
  eta: number; // minutes
  officerCount: number;
  officers: Officer[];
  contact: {
    phone: string;
    radioChannel?: string;
  };
  pastPerformance: {
    successRate: number;
    avgResponseTime: number;
    casesHandled: number;
  };
}

export interface Officer {
  id: string;
  name: string;
  rank: string;
  badgeId: string;
}

export interface DispatchResponse {
  success: boolean;
  team: Team;
  eta: number;
  deploymentId: string;
  message: string;
}

export interface TeamLocationUpdate {
  location: { lat: number; lon: number };
  heading: number;
  speed: number;
  eta: number;
  status: string;
  progress: number;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Find nearest teams to hotspot
export async function findNearestTeams(
  caseId: string,
  requirements: TeamRequirements = {}
): Promise<ServiceResponse<Team[]>> {
  try {
    // 1. Get case details to find hotspot
    const caseDetails = await getCaseDetails(caseId);
    if (!caseDetails.success || !caseDetails.data) {
      return { success: false, error: 'Case not found' };
    }

    const hotspot = caseDetails.data.prediction.hotspots[0];
    if (!hotspot || !hotspot.location) {
      return { success: false, error: 'No hotspot found' };
    }

    // 2. Call backend to find teams
    try {
      // This would call a dedicated endpoint
      // For now, return mock teams for dev
      if (__DEV__) {
        const mockTeams: Team[] = [
          {
            id: 'team-1',
            name: 'Alpha Team',
            stationId: 'station-1',
            stationName: 'Andheri Police Station',
            stationAddress: 'Andheri West, Mumbai',
            currentLocation: {
              lat: hotspot.location.latitude + 0.01,
              lon: hotspot.location.longitude + 0.01,
            },
            status: 'available',
            capabilities: ['cyber', 'interception'],
            distance: 2.3,
            eta: 12,
            officerCount: 3,
            officers: [
              { id: 'officer-1', name: 'Inspector Sharma', rank: 'Inspector', badgeId: 'MH-CYB-001' },
            ],
            contact: {
              phone: '+91-9876543210',
              radioChannel: 'CH-5',
            },
            pastPerformance: {
              successRate: 85,
              avgResponseTime: 15,
              casesHandled: 45,
            },
          },
        ];

        return { success: true, data: mockTeams };
      }

      // In production, this would make an API call
      return { success: true, data: [] };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to find teams' };
    }
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to find teams' };
  }
}

// Dispatch team to case
export async function dispatchTeam(
  teamId: string,
  caseId: string,
  instructions?: string
): Promise<ServiceResponse<DispatchResponse>> {
  try {
    // 1. Get case details
    const caseDetails = await getCaseDetails(caseId);
    const hotspot = caseDetails.data?.prediction?.hotspots?.[0];

    // 2. Call backend team deployment endpoint
    const deployData: DeployTeamRequest = {
      case_id: caseId,
      target_location: hotspot?.location ? {
        lat: hotspot.location.latitude,
        lon: hotspot.location.longitude,
      } : { lat: 19.1364, lon: 72.8297 },
      priority: 'URGENT',
      instructions: instructions || 'Proceed to predicted ATM location for interception. Urgency: critical.',
    };

    const deployResult = await teamService.deployTeam(teamId, deployData);

    if (deployResult.success && deployResult.data) {
      const mockResponse: DispatchResponse = {
        success: true,
        team: {
          id: teamId,
          name: deployResult.data.team_name || 'Alpha Team',
          stationId: 'station-1',
          stationName: 'Andheri Police Station',
          stationAddress: 'Andheri West, Mumbai',
          currentLocation: { 
            lat: deployData.target_location.lat, 
            lon: deployData.target_location.lon 
          },
          status: 'deployed',
          capabilities: ['cyber', 'interception'],
          distance: 2.3,
          eta: deployResult.data.eta_minutes,
          officerCount: 3,
          officers: [],
          contact: { phone: '+91-9876543210' },
          pastPerformance: { successRate: 85, avgResponseTime: 15, casesHandled: 45 },
        },
        eta: deployResult.data.eta_minutes,
        deploymentId: deployResult.data.deployment_id,
        message: 'Team dispatched successfully',
      };

      // 3. Subscribe to team location updates
      websocketService.subscribe(`team_${teamId}`, (update: TeamLocationUpdate) => {
        console.log('Team location update:', update);
      });

      // 4. Show notification
      await notificationService.notifyAlert({
        id: `dispatch_${Date.now()}`,
        title: '✅ Team Dispatched',
        body: `Team ${mockResponse.team.name} is en route. ETA: ${mockResponse.eta} min`,
        risk: 0.7,
        amount: 0,
        fraudType: 'Team Dispatch',
        timestamp: new Date().toISOString(),
      } as any);

      return { success: true, data: mockResponse };
    }

    return { success: false, error: deployResult.error || 'Failed to dispatch team' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to dispatch team' };
  }
}

// Track team location
export function trackTeamLocation(teamId: string): () => void {
  return websocketService.subscribe(`team_${teamId}`, (update: TeamLocationUpdate) => {
    // This would update map with team location
    console.log('Team location update:', update);
  });
}

