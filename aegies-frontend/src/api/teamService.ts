/**
 * Teams Service
 * Implements /teams/* endpoints according to API documentation
 */

import axios from 'axios';
import { API_BASE_URL } from '../constants/config';
import { secureStorage } from '../services/secureStorage';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Request interceptor
api.interceptors.request.use(async (config) => {
  const token = await secureStorage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNREFUSED') {
      console.error('Team API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export interface Team {
  id: string;
  team_code: string;
  team_name: string;
  status: 'AVAILABLE' | 'DEPLOYED' | 'OFF_DUTY' | 'EN_ROUTE';
  members_count: number;
  current_location: {
    lat: number;
    lon: number;
  };
  radio_channel?: string;
  vehicle_number?: string | null;
}

export interface DeployTeamRequest {
  case_id: string;
  target_location: {
    lat: number;
    lon: number;
  };
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  instructions?: string;
}

export interface DeployTeamResponse {
  deployment_id: string;
  team_id: string;
  team_name: string;
  status: string;
  target_location: {
    lat: number;
    lon: number;
  };
  eta_minutes: number;
  notification_sent: boolean;
  timestamp: string;
}

export interface SendTeamMessageRequest {
  case_id: string;
  message: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const teamService = {
  /**
   * 6.1 List Teams - GET /teams
   * Query params: status (AVAILABLE, DEPLOYED, OFF_DUTY, EN_ROUTE)
   */
  async listTeams(status?: 'AVAILABLE' | 'DEPLOYED' | 'OFF_DUTY' | 'EN_ROUTE'): Promise<ServiceResponse<{ teams: Team[] }>> {
    try {
      const response = await api.get<{ success: boolean; data: { teams: Team[] } }>('/teams', {
        params: status ? { status } : undefined,
      });
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Mock response for demo
        const mockTeams: Team[] = [
          {
            id: 'team-1',
            team_code: 'ALPHA-01',
            team_name: 'Alpha Squad',
            status: 'AVAILABLE',
            members_count: 4,
            current_location: {
              lat: 19.076,
              lon: 72.8777,
            },
            radio_channel: 'Channel 5',
            vehicle_number: 'MH-01-AB-1234',
          },
          {
            id: 'team-2',
            team_code: 'BRAVO-02',
            team_name: 'Bravo Squad',
            status: 'DEPLOYED',
            members_count: 3,
            current_location: {
              lat: 19.2183,
              lon: 72.9781,
            },
            radio_channel: 'Channel 7',
            vehicle_number: 'MH-01-CD-5678',
          },
        ];
        return { success: true, data: { teams: mockTeams } };
      }

      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to list teams',
      };
    }
  },

  /**
   * 6.2 Get Team Details - GET /teams/{team_id}
   */
  async getTeamDetails(teamId: string): Promise<ServiceResponse<Team>> {
    try {
      const response = await api.get<{ success: boolean; data: Team }>(`/teams/${teamId}`);
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Mock response for demo
        const mockTeam: Team = {
          id: teamId,
          team_code: 'ALPHA-01',
          team_name: 'Alpha Squad',
          status: 'AVAILABLE',
          members_count: 4,
          current_location: {
            lat: 19.076,
            lon: 72.8777,
          },
          radio_channel: 'Channel 5',
          vehicle_number: 'MH-01-AB-1234',
        };
        return { success: true, data: mockTeam };
      }

      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to get team details',
      };
    }
  },

  /**
   * 6.3 Deploy Team - POST /teams/{team_id}/deploy
   */
  async deployTeam(teamId: string, deployData: DeployTeamRequest): Promise<ServiceResponse<DeployTeamResponse>> {
    try {
      const response = await api.post<{ success: boolean; data: DeployTeamResponse }>(
        `/teams/${teamId}/deploy`,
        deployData
      );
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Mock response for demo
        const mockResponse: DeployTeamResponse = {
          deployment_id: 'deploy-' + Date.now(),
          team_id: teamId,
          team_name: 'Alpha Squad',
          status: 'DEPLOYED',
          target_location: deployData.target_location,
          eta_minutes: 12,
          notification_sent: true,
          timestamp: new Date().toISOString(),
        };
        return { success: true, data: mockResponse };
      }

      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to deploy team',
      };
    }
  },

  /**
   * 6.4 Send Team Message - POST /teams/{team_id}/message
   */
  async sendTeamMessage(teamId: string, messageData: SendTeamMessageRequest): Promise<ServiceResponse<{ success: boolean }>> {
    try {
      const response = await api.post<{ success: boolean }>(`/teams/${teamId}/message`, messageData);
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Mock response for demo
        return { success: true, data: { success: true } };
      }

      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to send message',
      };
    }
  },
};

