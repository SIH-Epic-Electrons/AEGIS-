// Freeze Service for Account Freeze Operations
// Uses the correct backend API endpoints for freeze operations
import { caseService } from '../api/caseService';
import { notificationService } from './notificationService';

export interface FreezeRequest {
  caseId: string;
  accountIds: string[];
  reason: string;
  urgency: 'normal' | 'urgent' | 'critical';
  notifyBanks?: boolean;
}

export interface FreezeResponse {
  success: boolean;
  frozenAccounts: {
    accountId: string;
    status: 'frozen' | 'failed' | 'pending';
    bank: string;
    frozenAt: string;
    executionTime: number; // seconds
    npciReference?: string;
    amountSecured?: number;
  }[];
  totalExecutionTime: number;
  failedAccounts: string[];
  message: string;
  npciReference?: string;
  totalAmountSecured?: number;
}

export interface FreezeStatus {
  status: 'pending' | 'in_progress' | 'completed' | 'partial' | 'failed';
  accounts: {
    accountId: string;
    status: string;
    bank: string;
    currentBalance?: number;
    frozenAt?: string;
    npciReference?: string;
  }[];
  executedAt?: string;
  summary?: {
    total_accounts: number;
    frozen: number;
    active: number;
    total_amount_secured: number;
  };
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Freeze accounts via NPCI/CFCFRMS
 * Uses the backend endpoint: POST /freeze/cases/{case_id}/freeze
 */
export async function freezeAccounts(
  request: FreezeRequest
): Promise<ServiceResponse<FreezeResponse>> {
  try {
    // 1. Validate request
    if (!request.caseId || !request.accountIds || request.accountIds.length === 0) {
      return { success: false, error: 'Invalid freeze request' };
    }

    // 2. Call backend API via caseService (uses correct endpoint)
    const startTime = Date.now();
    
    try {
      // Determine freeze type based on urgency
      const freezeType = request.urgency === 'critical' ? 'PERMANENT' : 'TEMPORARY';
      
      const response = await caseService.freezeAccounts(
        request.caseId,
        request.accountIds,
        freezeType
      );
      
      const executionTime = (Date.now() - startTime) / 1000;

      if (!response.success) {
        return {
          success: false,
          error: response.error || 'Failed to freeze accounts',
        };
      }

      // 3. Transform response from backend to our FreezeResponse format
      const responseData = response.data;
      
      const freezeResponse: FreezeResponse = {
        success: true,
        frozenAccounts: responseData?.frozen_accounts?.map((acc: any) => ({
          accountId: acc.id || acc.account_id,
          status: 'frozen' as const,
          bank: acc.bank || acc.bank_name || 'Unknown',
          frozenAt: acc.frozen_at || new Date().toISOString(),
          executionTime: executionTime / (responseData?.frozen_accounts?.length || 1),
          npciReference: acc.npci_reference,
          amountSecured: acc.amount_secured || acc.current_balance || 0,
        })) || request.accountIds.map((accountId) => ({
          accountId,
          status: 'frozen' as const,
          bank: 'Unknown',
          frozenAt: new Date().toISOString(),
          executionTime: executionTime / request.accountIds.length,
        })),
        totalExecutionTime: responseData?.freeze_time_ms 
          ? responseData.freeze_time_ms / 1000 
          : executionTime,
        failedAccounts: [],
        message: responseData?.message || 
          `Frozen ${responseData?.accounts_frozen || request.accountIds.length} accounts in ${executionTime.toFixed(1)}s`,
        npciReference: responseData?.npci_reference,
        totalAmountSecured: responseData?.total_amount_secured || 0,
      };

      // 4. Show success notification
      await notificationService.notifyHighRiskAlert({
        id: `freeze_${Date.now()}`,
        title: '✅ Accounts Frozen',
        body: freezeResponse.message,
        risk: 0.9,
        amount: freezeResponse.totalAmountSecured || 0,
        fraudType: 'Account Freeze',
        timestamp: new Date().toISOString(),
      } as any);

      return { success: true, data: freezeResponse };
    } catch (apiError: any) {
      // If API fails due to network error in dev mode, return error (no mock)
      if (apiError.code === 'ERR_NETWORK' || apiError.code === 'ECONNREFUSED') {
        console.warn('Network error during freeze - backend may be unavailable');
        return { 
          success: false, 
          error: 'Unable to connect to freeze service. Please check backend connection.' 
        };
      }

      // Log non-network errors
      console.error('Error freezing accounts:', apiError);
      return { 
        success: false, 
        error: apiError.response?.data?.detail || apiError.message || 'Failed to freeze accounts' 
      };
    }
  } catch (error: any) {
    console.error('Error in freezeAccounts:', error);
    return { success: false, error: error.message || 'Failed to freeze accounts' };
  }
}

/**
 * Freeze a single account
 * Uses the backend endpoint: POST /freeze/accounts/{account_id}/freeze
 */
export async function freezeSingleAccount(
  caseId: string,
  accountId: string,
  reason: string = 'Suspected involvement in cyber fraud'
): Promise<ServiceResponse<FreezeResponse>> {
  return freezeAccounts({
    caseId,
    accountIds: [accountId],
    reason,
    urgency: 'critical',
    notifyBanks: true,
  });
}

/**
 * Get freeze status for a case
 * Uses the backend endpoint: GET /freeze/cases/{case_id}/freeze-status
 */
export async function getFreezeStatus(caseId: string): Promise<ServiceResponse<FreezeStatus>> {
  try {
    const response = await caseService.getFreezeStatus(caseId);
    
    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to get freeze status',
      };
    }

    const data = response.data;
    
    return {
      success: true,
      data: {
        status: data?.summary?.frozen > 0 
          ? (data?.summary?.frozen === data?.summary?.total_accounts ? 'completed' : 'partial')
          : 'pending',
        accounts: data?.accounts?.map((acc: any) => ({
          accountId: acc.id,
          status: acc.status,
          bank: acc.bank || acc.bank_name,
          currentBalance: acc.current_balance,
          frozenAt: acc.frozen_at,
          npciReference: acc.npci_reference,
        })) || [],
        summary: data?.summary,
      },
    };
  } catch (error: any) {
    console.error('Error getting freeze status:', error);
    return { success: false, error: error.message || 'Failed to get freeze status' };
  }
}

/**
 * Activate digital cordon (freeze all accounts in radius)
 * This is a convenience function that freezes all mule accounts for a case
 */
export async function activateDigitalCordon(
  caseId: string,
  _location: { lat: number; lon: number },
  _radius: number = 2000 // meters (not used currently, but kept for future geo-based freeze)
): Promise<ServiceResponse<FreezeResponse>> {
  try {
    // Get all mule accounts for the case
    const muleResponse = await caseService.getCaseMuleAccounts(caseId);
    
    if (!muleResponse.success || !muleResponse.data?.mule_accounts) {
      return {
        success: false,
        error: 'Failed to get mule accounts for digital cordon',
      };
    }

    // Get active account IDs
    const activeAccounts = muleResponse.data.mule_accounts
      .filter((acc: any) => acc.status === 'ACTIVE')
      .map((acc: any) => acc.id);

    if (activeAccounts.length === 0) {
      return {
        success: false,
        error: 'No active accounts to freeze in digital cordon',
      };
    }

    // Freeze all active accounts
    const result = await freezeAccounts({
      caseId,
      accountIds: activeAccounts,
      reason: 'AEGIS Digital Cordon - All accounts in area frozen',
      urgency: 'critical',
      notifyBanks: true,
    });

    // Show notification
    if (result.success) {
      await notificationService.notifyHighRiskAlert({
        id: `cordon_${Date.now()}`,
        title: '🛡️ Digital Cordon Activated',
        body: `${result.data?.frozenAccounts.length || 0} accounts frozen in cordon area`,
        risk: 0.95,
        amount: result.data?.totalAmountSecured || 0,
        fraudType: 'Digital Cordon',
        timestamp: new Date().toISOString(),
      } as any);
    }

    return result;
  } catch (error: any) {
    console.error('Error activating digital cordon:', error);
    return { success: false, error: error.message || 'Failed to activate digital cordon' };
  }
}
