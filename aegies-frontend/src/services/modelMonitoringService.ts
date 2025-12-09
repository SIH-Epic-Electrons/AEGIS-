/**
 * Model Monitoring Service
 * Tracks prediction outcomes and calculates accuracy metrics
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

interface PredictionOutcome {
  predictionId: string;
  timestamp: string;
  riskScore: number;
  actualOutcome: boolean; // true if fraud occurred, false if false positive
  actualLocation?: {
    lat: number;
    lon: number;
  };
  amountRecovered?: number;
}

interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  falsePositiveRate: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  totalPredictions: number;
  averageConfidence: number;
}

interface ModelHealth {
  status: 'healthy' | 'degraded' | 'critical';
  metrics: ModelMetrics;
  version: string;
  lastRetrained: string;
  lastUpdated: string;
}

const STORAGE_KEY = '@aegis_model_metrics';
const WINDOW_SIZE = 100; // Rolling window for metrics

/**
 * Model Monitoring Service
 */
export const modelMonitoringService = {
  /**
   * Store prediction outcome
   */
  async recordOutcome(outcome: PredictionOutcome): Promise<void> {
    try {
      const outcomes = await this.getOutcomes();
      outcomes.push(outcome);
      
      // Keep only last WINDOW_SIZE outcomes
      if (outcomes.length > WINDOW_SIZE) {
        outcomes.shift();
      }
      
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(outcomes));
      
      // Update metrics
      await this.updateMetrics();
    } catch (error) {
      console.error('Error recording outcome:', error);
    }
  },

  /**
   * Get stored outcomes
   */
  async getOutcomes(): Promise<PredictionOutcome[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting outcomes:', error);
      return [];
    }
  },

  /**
   * Calculate metrics from outcomes
   */
  async calculateMetrics(): Promise<ModelMetrics> {
    const outcomes = await this.getOutcomes();
    
    if (outcomes.length === 0) {
      return {
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1: 0,
        falsePositiveRate: 0,
        truePositives: 0,
        falsePositives: 0,
        trueNegatives: 0,
        falseNegatives: 0,
        totalPredictions: 0,
        averageConfidence: 0,
      };
    }

    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;
    let totalConfidence = 0;

    outcomes.forEach((outcome) => {
      const predictedPositive = outcome.riskScore >= 0.5; // Threshold
      const actualPositive = outcome.actualOutcome;

      if (predictedPositive && actualPositive) {
        truePositives++;
      } else if (predictedPositive && !actualPositive) {
        falsePositives++;
      } else if (!predictedPositive && actualPositive) {
        falseNegatives++;
      } else {
        trueNegatives++;
      }

      totalConfidence += outcome.riskScore;
    });

    const total = outcomes.length;
    const accuracy = (truePositives + trueNegatives) / total;
    const precision = truePositives + falsePositives > 0
      ? truePositives / (truePositives + falsePositives)
      : 0;
    const recall = truePositives + falseNegatives > 0
      ? truePositives / (truePositives + falseNegatives)
      : 0;
    const f1 = precision + recall > 0
      ? (2 * precision * recall) / (precision + recall)
      : 0;
    const falsePositiveRate = trueNegatives + falsePositives > 0
      ? falsePositives / (trueNegatives + falsePositives)
      : 0;
    const averageConfidence = totalConfidence / total;

    return {
      accuracy,
      precision,
      recall,
      f1,
      falsePositiveRate,
      truePositives,
      falsePositives,
      trueNegatives,
      falseNegatives,
      totalPredictions: total,
      averageConfidence,
    };
  },

  /**
   * Update metrics cache
   */
  async updateMetrics(): Promise<void> {
    const metrics = await this.calculateMetrics();
    await AsyncStorage.setItem(`${STORAGE_KEY}_metrics`, JSON.stringify({
      ...metrics,
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * Get cached metrics
   */
  async getMetrics(): Promise<ModelMetrics | null> {
    try {
      const data = await AsyncStorage.getItem(`${STORAGE_KEY}_metrics`);
      if (!data) {
        return await this.calculateMetrics();
      }
      const parsed = JSON.parse(data);
      // Remove lastUpdated from metrics
      const { lastUpdated, ...metrics } = parsed;
      return metrics;
    } catch (error) {
      console.error('Error getting metrics:', error);
      return await this.calculateMetrics();
    }
  },

  /**
   * Get model health status
   */
  async getHealth(version: string, lastRetrained: string): Promise<ModelHealth> {
    const metrics = await this.getMetrics();
    
    if (!metrics || metrics.totalPredictions === 0) {
      return {
        status: 'healthy',
        metrics: metrics || await this.calculateMetrics(),
        version,
        lastRetrained,
        lastUpdated: new Date().toISOString(),
      };
    }

    // Determine health status
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    
    if (metrics.accuracy < 0.75 || metrics.precision < 0.70 || metrics.recall < 0.70) {
      status = 'critical';
    } else if (metrics.accuracy < 0.85 || metrics.precision < 0.80 || metrics.recall < 0.75 || metrics.falsePositiveRate > 0.10) {
      status = 'degraded';
    }

    return {
      status,
      metrics,
      version,
      lastRetrained,
      lastUpdated: new Date().toISOString(),
    };
  },

  /**
   * Compare current metrics to baseline
   */
  async compareToBaseline(baseline: ModelMetrics): Promise<{
    accuracyChange: number;
    precisionChange: number;
    recallChange: number;
    f1Change: number;
    degraded: boolean;
  }> {
    const current = await this.getMetrics();
    
    if (!current) {
      return {
        accuracyChange: 0,
        precisionChange: 0,
        recallChange: 0,
        f1Change: 0,
        degraded: false,
      };
    }

    const accuracyChange = current.accuracy - baseline.accuracy;
    const precisionChange = current.precision - baseline.precision;
    const recallChange = current.recall - baseline.recall;
    const f1Change = current.f1 - baseline.f1;

    const degraded =
      accuracyChange < -0.05 ||
      precisionChange < -0.05 ||
      recallChange < -0.05 ||
      current.falsePositiveRate > baseline.falsePositiveRate + 0.05;

    return {
      accuracyChange,
      precisionChange,
      recallChange,
      f1Change,
      degraded,
    };
  },

  /**
   * Clear all stored outcomes
   */
  async clearOutcomes(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem(`${STORAGE_KEY}_metrics`);
  },
};

