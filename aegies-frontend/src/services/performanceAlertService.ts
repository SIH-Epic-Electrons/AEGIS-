/**
 * Performance Alerting Service
 * Alerts when model performance degrades
 */

import { modelMonitoringService } from './modelMonitoringService';
import { notificationService } from './notificationService';

interface PerformanceAlert {
  id: string;
  type: 'accuracy_drop' | 'precision_drop' | 'recall_drop' | 'fpr_high' | 'critical';
  message: string;
  severity: 'warning' | 'critical';
  timestamp: string;
  metrics: {
    current: number;
    baseline: number;
    change: number;
  };
}

const BASELINE_METRICS = {
  accuracy: 0.90,
  precision: 0.85,
  recall: 0.80,
  falsePositiveRate: 0.05,
};

const ALERT_THRESHOLDS = {
  accuracyDrop: 0.05, // 5% drop
  precisionDrop: 0.05,
  recallDrop: 0.05,
  falsePositiveRateIncrease: 0.05, // 5% increase
};

/**
 * Performance Alerting Service
 */
export const performanceAlertService = {
  /**
   * Check for performance issues and generate alerts
   */
  async checkPerformance(): Promise<PerformanceAlert[]> {
    const metrics = await modelMonitoringService.getMetrics();
    const alerts: PerformanceAlert[] = [];

    if (!metrics || metrics.totalPredictions < 10) {
      return alerts; // Not enough data
    }

    // Check accuracy drop
    const accuracyChange = metrics.accuracy - BASELINE_METRICS.accuracy;
    if (accuracyChange < -ALERT_THRESHOLDS.accuracyDrop) {
      alerts.push({
        id: `accuracy_${Date.now()}`,
        type: 'accuracy_drop',
        message: `Model accuracy dropped by ${(Math.abs(accuracyChange) * 100).toFixed(1)}%`,
        severity: accuracyChange < -0.10 ? 'critical' : 'warning',
        timestamp: new Date().toISOString(),
        metrics: {
          current: metrics.accuracy,
          baseline: BASELINE_METRICS.accuracy,
          change: accuracyChange,
        },
      });
    }

    // Check precision drop
    const precisionChange = metrics.precision - BASELINE_METRICS.precision;
    if (precisionChange < -ALERT_THRESHOLDS.precisionDrop) {
      alerts.push({
        id: `precision_${Date.now()}`,
        type: 'precision_drop',
        message: `Model precision dropped by ${(Math.abs(precisionChange) * 100).toFixed(1)}%`,
        severity: precisionChange < -0.10 ? 'critical' : 'warning',
        timestamp: new Date().toISOString(),
        metrics: {
          current: metrics.precision,
          baseline: BASELINE_METRICS.precision,
          change: precisionChange,
        },
      });
    }

    // Check recall drop
    const recallChange = metrics.recall - BASELINE_METRICS.recall;
    if (recallChange < -ALERT_THRESHOLDS.recallDrop) {
      alerts.push({
        id: `recall_${Date.now()}`,
        type: 'recall_drop',
        message: `Model recall dropped by ${(Math.abs(recallChange) * 100).toFixed(1)}%`,
        severity: recallChange < -0.10 ? 'critical' : 'warning',
        timestamp: new Date().toISOString(),
        metrics: {
          current: metrics.recall,
          baseline: BASELINE_METRICS.recall,
          change: recallChange,
        },
      });
    }

    // Check false positive rate
    const fprChange = metrics.falsePositiveRate - BASELINE_METRICS.falsePositiveRate;
    if (fprChange > ALERT_THRESHOLDS.falsePositiveRateIncrease) {
      alerts.push({
        id: `fpr_${Date.now()}`,
        type: 'fpr_high',
        message: `False positive rate increased by ${(fprChange * 100).toFixed(1)}%`,
        severity: fprChange > 0.10 ? 'critical' : 'warning',
        timestamp: new Date().toISOString(),
        metrics: {
          current: metrics.falsePositiveRate,
          baseline: BASELINE_METRICS.falsePositiveRate,
          change: fprChange,
        },
      });
    }

    // Check for critical overall degradation
    if (
      metrics.accuracy < 0.75 ||
      metrics.precision < 0.70 ||
      metrics.recall < 0.70
    ) {
      alerts.push({
        id: `critical_${Date.now()}`,
        type: 'critical',
        message: 'Model performance is critically degraded. Immediate action required.',
        severity: 'critical',
        timestamp: new Date().toISOString(),
        metrics: {
          current: metrics.accuracy,
          baseline: BASELINE_METRICS.accuracy,
          change: metrics.accuracy - BASELINE_METRICS.accuracy,
        },
      });
    }

    return alerts;
  },

  /**
   * Send performance alerts
   */
  async sendAlerts(): Promise<void> {
    const alerts = await this.checkPerformance();

    for (const alert of alerts) {
      // Send in-app notification
      await notificationService.notifyAlert({
        id: `perf_${Date.now()}`,
        title: 'Model Performance Alert',
        risk: 0.5,
        amount: 0,
        fraudType: 'Performance Alert',
        timestamp: new Date().toISOString(),
      } as any);

      // Log to console in development
      if (__DEV__) {
        console.warn('[PerformanceAlert]', alert);
      }

      // In production, also send to error tracking service
      // TODO: Integrate with error tracking (Sentry, etc.)
    }
  },

  /**
   * Check if model retraining is needed
   */
  async shouldRetrain(): Promise<boolean> {
    const alerts = await this.checkPerformance();
    return alerts.some((alert) => alert.severity === 'critical');
  },
};

