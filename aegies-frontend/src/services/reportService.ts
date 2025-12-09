// Report Service for Analytics & Reporting
import { getCaseDetails } from './caseService';
import { getMoneyTrail } from './caseService';
import { getCurrentOfficerId } from './authService';
import { apiService } from './api';

export interface CaseReport {
  // Header
  reportId: string;
  caseNumber: string;
  generatedAt: string;
  generatedBy: string;

  // Case Summary
  summary: {
    fraudType: string;
    amount: number;
    status: string;
    duration: string; // Time from report to resolution
    outcome: string;
  };

  // Timeline
  timeline: TimelineEvent[];

  // Actions Taken
  actions: {
    freeze: any[];
    dispatch: any[];
    evidence: any[];
    communication: any[];
  };

  // Financial Details
  financial: {
    amountLost: number;
    amountRecovered: number;
    recoveryRate: number;
    accountsFrozen: number;
  };

  // Intelligence
  intelligence: {
    suspect: any;
    muleAccounts: any[];
    moneyTrail: Transaction[];
    networkAnalysis: any;
  };

  // Performance Metrics
  performance: {
    responseTime: number; // minutes
    freezeTime: number; // seconds
    teamDeploymentTime: number; // minutes
    totalTime: number; // minutes
  };

  // AI Feedback
  aiFeedback: {
    predictionAccuracy: string;
    modelImprovements: string[];
  };

  // Recommendations
  recommendations: string[];
}

export interface TimelineEvent {
  id: string;
  type: string;
  timestamp: string;
  description: string;
  actor?: string;
}

export interface Transaction {
  id: string;
  fromAccount: string;
  toAccount: string;
  amount: number;
  timestamp: string;
  transactionType: 'upi' | 'neft' | 'imps' | 'rtgs';
  status: 'completed' | 'pending' | 'failed';
  bank: string;
}

export interface PerformanceAnalytics {
  // Overall Stats
  totalCases: number;
  casesResolved: number;
  successRate: number;
  avgResponseTime: number;

  // Time-based Breakdown
  dailyStats: {
    date: string;
    cases: number;
    resolved: number;
    avgResponseTime: number;
  }[];

  // By Fraud Type
  byFraudType: {
    fraudType: string;
    cases: number;
    successRate: number;
    avgAmount: number;
  }[];

  // Performance Trends
  trends: {
    responseTime: any;
    successRate: any;
    casesHandled: any;
  };

  // Comparison
  comparison: {
    vsDepartment: {
      responseTime: number; // percentage difference
      successRate: number;
      casesHandled: number;
    };
    vsAverage: {
      responseTime: number;
      successRate: number;
    };
  };

  // Strengths & Weaknesses
  strengths: string[];
  areasForImprovement: string[];
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Generate case report
export async function generateCaseReport(caseId: string): Promise<ServiceResponse<CaseReport>> {
  try {
    // 1. Get all case data
    const caseDetails = await getCaseDetails(caseId);
    if (!caseDetails.success || !caseDetails.data) {
      return { success: false, error: 'Case not found' };
    }

    const moneyTrail = await getMoneyTrail(caseId);
    const officerId = await getCurrentOfficerId();

    // 2. Build timeline
    const timeline: TimelineEvent[] = [
      {
        id: '1',
        type: 'case_created',
        timestamp: caseDetails.data.createdAt,
        description: 'Case created',
      },
      ...(caseDetails.data.timeline || []),
    ];

    // 3. Calculate metrics
    const performance = {
      responseTime: 0, // Would calculate from actions
      freezeTime: 0,
      teamDeploymentTime: 0,
      totalTime: 0,
    };

    // 4. Generate recommendations
    const recommendations: string[] = [];
    if (caseDetails.data.freezeStatus?.status !== 'completed') {
      recommendations.push('Ensure all accounts are frozen before deployment');
    }
    if (caseDetails.data.teamStatus?.status === 'not_deployed') {
      recommendations.push('Deploy teams to predicted location');
    }

    // 5. Build report
    const report: CaseReport = {
      reportId: `report_${Date.now()}`,
      caseNumber: caseDetails.data.caseNumber,
      generatedAt: new Date().toISOString(),
      generatedBy: officerId || 'Unknown',
      summary: {
        fraudType: caseDetails.data.fraudType,
        amount: caseDetails.data.amount,
        status: caseDetails.data.status,
        duration: calculateDuration(caseDetails.data.createdAt),
        outcome: 'unknown',
      },
      timeline,
      actions: {
        freeze: [],
        dispatch: [],
        evidence: [],
        communication: [],
      },
      financial: {
        amountLost: caseDetails.data.amount,
        amountRecovered: 0,
        recoveryRate: 0,
        accountsFrozen: caseDetails.data.muleAccounts?.length || 0,
      },
      intelligence: {
        suspect: caseDetails.data.suspect,
        muleAccounts: caseDetails.data.muleAccounts || [],
        moneyTrail: moneyTrail.data || [],
        networkAnalysis: {},
      },
      performance,
      aiFeedback: {
        predictionAccuracy: 'unknown',
        modelImprovements: [],
      },
      recommendations,
    };

    // 6. In production, would generate PDF and upload
    if (!__DEV__) {
      try {
        await apiService.submitReport({
          caseId,
          report,
        });
      } catch (error) {
        console.warn('Failed to upload report:', error);
      }
    }

    return { success: true, data: report };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to generate report' };
  }
}

// Get performance analytics
export async function getPerformanceAnalytics(
  officerId: string,
  dateRange: { start: string; end: string }
): Promise<ServiceResponse<PerformanceAnalytics>> {
  try {
    // In production, this would call the API
    if (__DEV__) {
      return {
        success: true,
        data: {
          totalCases: 0,
          casesResolved: 0,
          successRate: 0,
          avgResponseTime: 0,
          dailyStats: [],
          byFraudType: [],
          trends: {
            responseTime: {},
            successRate: {},
            casesHandled: {},
          },
          comparison: {
            vsDepartment: {
              responseTime: 0,
              successRate: 0,
              casesHandled: 0,
            },
            vsAverage: {
              responseTime: 0,
              successRate: 0,
            },
          },
          strengths: [],
          areasForImprovement: [],
        },
      };
    }

    // Would call API here
    return { success: false, error: 'Analytics not available' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to get analytics' };
  }
}

// Helper function to calculate duration
function calculateDuration(startTime: string): string {
  const start = new Date(startTime);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  } else {
    return `${diffMins} minute${diffMins > 1 ? 's' : ''}`;
  }
}

