// Case Queue Manager for Multi-Case Management
import { CaseDetails } from './caseService';
import { notificationService } from './notificationService';
import { subscribeToCaseUpdates } from './caseService';

export class CaseQueueManager {
  private queue: CaseDetails[] = [];
  private activeCases: Map<string, CaseDetails> = new Map();
  private maxActiveCases = 5; // Officer can handle max 5 cases simultaneously
  private updateCallbacks: Map<string, (update: any) => void> = new Map();

  async addCase(case_: CaseDetails): Promise<void> {
    // Check if already in queue
    if (this.queue.find(c => c.id === case_.id)) return;
    if (this.activeCases.has(case_.id)) return;

    // If under capacity, add to active
    if (this.activeCases.size < this.maxActiveCases) {
      this.activeCases.set(case_.id, case_);
      await this.activateCase(case_.id);
    } else {
      // Add to queue
      this.queue.push(case_);
      // Re-sort queue by priority
      this.queue = this.sortByPriority(this.queue);
    }
  }

  async completeCase(caseId: string): Promise<void> {
    // Unsubscribe from updates
    const callback = this.updateCallbacks.get(caseId);
    if (callback) {
      // Would need unsubscribe function from websocketService
      this.updateCallbacks.delete(caseId);
    }

    this.activeCases.delete(caseId);

    // Activate next case from queue
    if (this.queue.length > 0) {
      const nextCase = this.queue.shift()!;
      this.activeCases.set(nextCase.id, nextCase);
      await this.activateCase(nextCase.id);
    }
  }

  private async activateCase(caseId: string): Promise<void> {
    const case_ = this.activeCases.get(caseId);
    if (!case_) return;

    // Show notification
    await notificationService.notifyAlert({
      id: `case_${caseId}`,
      title: '📋 Case Activated',
      body: `Case ${case_.caseNumber} is now active`,
      risk: 0.5,
      amount: 0,
      fraudType: 'Case Activation',
      timestamp: new Date().toISOString(),
    } as any);

    // Subscribe to updates
    const unsubscribe = subscribeToCaseUpdates(caseId, (update) => {
      this.handleCaseUpdate(caseId, update);
    });

    // Store unsubscribe callback
    this.updateCallbacks.set(caseId, unsubscribe as any);
  }

  private handleCaseUpdate(caseId: string, update: any): void {
    const case_ = this.activeCases.get(caseId);
    if (!case_) return;

    // Update case based on update type
    switch (update.type) {
      case 'freeze':
        // Update freeze status
        break;
      case 'team':
        // Update team status
        break;
      case 'countdown':
        // Update countdown
        if (update.data.timeRemaining !== undefined) {
          case_.countdown = {
            ...case_.countdown,
            timeRemaining: update.data.timeRemaining,
          };
        }
        break;
      case 'status':
        // Update case status
        if (update.data.status) {
          case_.status = update.data.status;
        }
        break;
    }

    // Notify listeners
    this.notifyCaseUpdate(caseId, case_);
  }

  private notifyCaseUpdate(caseId: string, case_: CaseDetails): void {
    // This would notify any listeners (React components, stores, etc.)
    console.log(`Case ${caseId} updated:`, case_);
  }

  private sortByPriority(cases: CaseDetails[]): CaseDetails[] {
    // Simple priority sort - would use prioritizeCases from casePriorityService
    return cases.sort((a, b) => {
      const aPriority = (a.prediction?.riskScore || 0) * 100;
      const bPriority = (b.prediction?.riskScore || 0) * 100;
      return bPriority - aPriority;
    });
  }

  getQueueStatus(): {
    active: CaseDetails[];
    queued: CaseDetails[];
    total: number;
  } {
    return {
      active: Array.from(this.activeCases.values()),
      queued: this.queue,
      total: this.activeCases.size + this.queue.length,
    };
  }

  getActiveCase(caseId: string): CaseDetails | undefined {
    return this.activeCases.get(caseId);
  }

  isCaseActive(caseId: string): boolean {
    return this.activeCases.has(caseId);
  }

  isCaseQueued(caseId: string): boolean {
    return this.queue.some(c => c.id === caseId);
  }
}

// Singleton instance
export const caseQueueManager = new CaseQueueManager();

