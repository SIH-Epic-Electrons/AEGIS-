// Case Priority Service for Multi-Case Management
import { CaseDetails } from './caseService';
import { notificationService } from './notificationService';
import { subscribeToCaseUpdates } from './caseService';

export interface CasePriority {
  caseId: string;
  priorityScore: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  factors: {
    riskScore: number;
    timeRemaining: number;
    amount: number;
    proximity: number;
    freezeStatus: 'not_started' | 'in_progress' | 'completed';
    teamStatus: 'not_deployed' | 'deployed' | 'on_site';
  };
  recommendedAction: string;
  estimatedTimeToComplete: number; // minutes
}

export interface Officer {
  id: string;
  name: string;
  currentWorkload: number; // active cases
  maxCapacity: number;
  specialization: string[];
  location: { lat: number; lon: number };
  successRate: number;
  avgResponseTime: number;
}

// Prioritize cases based on multiple factors
export function prioritizeCases(cases: CaseDetails[]): CasePriority[] {
  return cases.map((case_) => {
    const factors = {
      riskScore: case_.prediction?.riskScore || 0,
      timeRemaining: case_.countdown?.timeRemaining 
        ? Math.floor(case_.countdown.timeRemaining / 60) 
        : Infinity,
      amount: case_.amount || 0,
      proximity: 0, // Would be calculated from officer location
      freezeStatus: (case_.freezeStatus?.status === 'completed' 
        ? 'completed' 
        : case_.freezeStatus?.status === 'in_progress' 
        ? 'in_progress' 
        : 'not_started') as 'not_started' | 'in_progress' | 'completed',
      teamStatus: (case_.teamStatus?.status === 'on_site'
        ? 'on_site'
        : case_.teamStatus?.status === 'deployed'
        ? 'deployed'
        : 'not_deployed') as 'not_deployed' | 'deployed' | 'on_site',
    };

    // Calculate priority score (0-100)
    let priorityScore = 0;

    // Risk score weight: 30%
    priorityScore += factors.riskScore * 30;

    // Time urgency weight: 25%
    const timeUrgency = factors.timeRemaining < 30 ? 1.0 :
                        factors.timeRemaining < 60 ? 0.7 :
                        factors.timeRemaining < 120 ? 0.4 : 0.1;
    priorityScore += timeUrgency * 25;

    // Amount weight: 20%
    const amountFactor = Math.min(factors.amount / 1000000, 1); // Normalize to 0-1
    priorityScore += amountFactor * 20;

    // Proximity weight: 10%
    const proximityFactor = factors.proximity < 5 ? 1.0 :
                            factors.proximity < 10 ? 0.6 :
                            factors.proximity < 20 ? 0.3 : 0.1;
    priorityScore += proximityFactor * 10;

    // Action status weight: 15%
    let actionFactor = 0;
    if (factors.freezeStatus === 'not_started') actionFactor += 0.5; // Urgent to freeze
    if (factors.teamStatus === 'not_deployed') actionFactor += 0.3; // Need to deploy
    if (factors.freezeStatus === 'completed' && factors.teamStatus === 'on_site') actionFactor = 0.1; // Almost done
    priorityScore += actionFactor * 15;

    // Determine urgency level
    let urgency: CasePriority['urgency'];
    if (priorityScore >= 80) urgency = 'critical';
    else if (priorityScore >= 60) urgency = 'high';
    else if (priorityScore >= 40) urgency = 'medium';
    else urgency = 'low';

    // Determine recommended action
    let recommendedAction = '';
    if (factors.freezeStatus === 'not_started') {
      recommendedAction = 'FREEZE ACCOUNTS IMMEDIATELY';
    } else if (factors.freezeStatus === 'in_progress') {
      recommendedAction = 'Wait for freeze completion, then deploy teams';
    } else if (factors.teamStatus === 'not_deployed') {
      recommendedAction = 'DEPLOY NEAREST TEAM';
    } else if (factors.teamStatus === 'deployed') {
      recommendedAction = 'Monitor team progress';
    } else {
      recommendedAction = 'Record outcome';
    }

    // Estimate time to complete
    let estimatedTime = 0;
    if (factors.freezeStatus === 'not_started') estimatedTime += 2; // Freeze takes ~2 min
    if (factors.teamStatus === 'not_deployed') estimatedTime += factors.proximity * 0.5; // Travel time
    estimatedTime += 5; // Interception time
    estimatedTime += 3; // Outcome recording

    return {
      caseId: case_.id,
      priorityScore: Math.round(priorityScore),
      urgency,
      factors,
      recommendedAction,
      estimatedTimeToComplete: Math.round(estimatedTime),
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore);
}

// Auto-assign cases to officers
export function autoAssignCases(
  cases: CaseDetails[],
  officers: Officer[]
): Map<string, string> { // caseId -> officerId
  const assignments = new Map<string, string>();
  const officerWorkload = new Map<string, number>();

  // Initialize workload
  officers.forEach(officer => {
    officerWorkload.set(officer.id, officer.currentWorkload);
  });

  // Sort cases by priority
  const prioritizedCases = prioritizeCases(cases);

  prioritizedCases.forEach((casePriority) => {
    const case_ = cases.find(c => c.id === casePriority.caseId)!;
    if (!case_) return;

    // Find best officer
    const bestOfficer = officers
      .filter(officer => {
        // Check capacity
        const currentLoad = officerWorkload.get(officer.id) || 0;
        if (currentLoad >= officer.maxCapacity) return false;

        // Check specialization match
        if (case_.fraudType && officer.specialization.length > 0) {
          if (!officer.specialization.includes(case_.fraudType)) return false;
        }

        return true;
      })
      .map(officer => {
        // Calculate assignment score
        const workloadFactor = 1 - ((officerWorkload.get(officer.id) || 0) / officer.maxCapacity);
        const distance = calculateDistance(
          officer.location,
          case_.prediction?.hotspots[0]?.location || { latitude: 0, longitude: 0 }
        );
        const distanceFactor = distance < 10 ? 1.0 : distance < 20 ? 0.7 : 0.4;
        const successFactor = officer.successRate;

        const score = (workloadFactor * 0.4) + (distanceFactor * 0.3) + (successFactor * 0.3);

        return { officer, score };
      })
      .sort((a, b) => b.score - a.score)[0];

    if (bestOfficer) {
      assignments.set(case_.id, bestOfficer.officer.id);
      officerWorkload.set(
        bestOfficer.officer.id,
        (officerWorkload.get(bestOfficer.officer.id) || 0) + 1
      );
    }
  });

  return assignments;
}

// Calculate distance between two points (Haversine formula)
function calculateDistance(
  point1: { lat: number; lon: number },
  point2: { latitude: number; longitude: number }
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (point2.latitude - point1.lat) * Math.PI / 180;
  const dLon = (point2.longitude - point1.lon) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(point1.lat * Math.PI / 180) *
      Math.cos(point2.latitude * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

