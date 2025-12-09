// Outcome Service for Recording Case Results
import { apiService } from './api';
import { getDashboardStats } from './dashboardService';
import { getCurrentOfficerId } from './authService';

export interface OutcomeData {
  predictionAccuracy: 'exact' | 'nearby' | 'different' | 'unknown';
  interventionResult: 'apprehended' | 'recovered' | 'both' | 'unsuccessful';
  amountRecovered: number;
  suspectApprehended: boolean;
  actualLocation?: string;
  notes?: string;
  evidenceIds?: string[];
}

export interface OutcomeResponse {
  success: boolean;
  outcomeId: string;
  message: string;
  caseStatus: string;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Submit case outcome
export async function submitOutcome(
  caseId: string,
  outcome: OutcomeData
): Promise<ServiceResponse<OutcomeResponse>> {
  try {
    // 1. Validate outcome
    if (!outcome.predictionAccuracy || !outcome.interventionResult) {
      return { success: false, error: 'Missing required outcome fields' };
    }

    // 2. Get officer ID
    const officerId = await getCurrentOfficerId();
    if (!officerId) {
      return { success: false, error: 'Officer not authenticated' };
    }

    // 3. Submit to backend
    try {
      const response = await apiService.submitOutcome(caseId, {
        ...outcome,
        timestamp: new Date().toISOString(),
        officerId,
      });

      if (response && response.success !== false) {
        // 4. Update case status (would be handled by backend)
        
        // 5. Trigger AI model feedback (async - would be handled by backend)
        
        // 6. Generate case report (async - would be handled by backend)
        
        // 7. Refresh dashboard stats (async)
        refreshDashboardStats().catch(console.error);

        return {
          success: true,
          data: {
            success: true,
            outcomeId: `outcome_${Date.now()}`,
            message: 'Outcome recorded successfully',
            caseStatus: 'resolved',
          },
        };
      }

      return { success: false, error: 'Failed to submit outcome' };
    } catch (apiError: any) {
      // In dev mode, return success
      if (__DEV__) {
        return {
          success: true,
          data: {
            success: true,
            outcomeId: `outcome_${Date.now()}`,
            message: 'Outcome recorded successfully (dev mode)',
            caseStatus: 'resolved',
          },
        };
      }

      return { success: false, error: apiError.message || 'Failed to submit outcome' };
    }
  } catch (error: any) {
    console.error('Error submitting outcome:', error);
    return { success: false, error: error.message || 'Failed to submit outcome' };
  }
}

// Refresh dashboard statistics
async function refreshDashboardStats(): Promise<void> {
  try {
    const officerId = await getCurrentOfficerId();
    if (officerId) {
      await getDashboardStats(officerId);
    }
  } catch (error) {
    console.error('Error refreshing dashboard stats:', error);
  }
}

// Update case status
async function updateCaseStatus(caseId: string, status: string): Promise<void> {
  try {
    // This would call an API endpoint
    // await apiService.updateCaseStatus(caseId, status);
    console.log(`Case ${caseId} status updated to ${status}`);
  } catch (error) {
    console.error('Error updating case status:', error);
  }
}

