/**
 * Model Fallback Service
 * Handles automatic fallback to simpler models when primary model degrades
 */

import { modelMonitoringService } from './modelMonitoringService';
import { predictionService } from '../api/predictionService';

export interface FallbackModel {
  id: string;
  name: string;
  type: 'primary' | 'fallback1' | 'fallback2';
  accuracy: number;
}

export interface PredictionResult {
  complaintId: string;
  hotspots: any[];
  timeWindow: string;
  explanation: string;
  riskScore: number;
  modelUsed: string;
  confidence: number;
}

const ACCURACY_THRESHOLD = 0.85;
const PRECISION_THRESHOLD = 0.80;
const RECALL_THRESHOLD = 0.75;

/**
 * Model Fallback Service
 */
export const modelFallbackService = {
  /**
   * Check if fallback should be used
   */
  async shouldUseFallback(): Promise<boolean> {
    const metrics = await modelMonitoringService.getMetrics();
    
    if (!metrics || metrics.totalPredictions < 10) {
      // Not enough data, use primary
      return false;
    }

    return (
      metrics.accuracy < ACCURACY_THRESHOLD ||
      metrics.precision < PRECISION_THRESHOLD ||
      metrics.recall < RECALL_THRESHOLD
    );
  },

  /**
   * Get prediction with automatic fallback
   */
  async getPredictionWithFallback(complaintId: string): Promise<PredictionResult> {
    const useFallback = await this.shouldUseFallback();
    
    if (useFallback) {
      console.warn('[ModelFallback] Using fallback model due to degraded performance');
      return await this.getFallbackPrediction(complaintId);
    }

    // Use primary model
    const result = await predictionService.getPrediction(complaintId);
    
    if (result.success && result.data) {
      return {
        ...result.data,
        modelUsed: 'primary',
        confidence: result.data.riskScore,
      };
    }

    // If primary fails, try fallback
    return await this.getFallbackPrediction(complaintId);
  },

  /**
   * Get prediction from fallback model (rule-based)
   */
  async getFallbackPrediction(complaintId: string): Promise<PredictionResult> {
    // Rule-based fallback: Use historical patterns
    // This is a simplified version - in production, this would call a simpler ML model
    
    try {
      // Try to get primary model prediction first
      const primaryResult = await predictionService.getPrediction(complaintId);
      if (primaryResult.success && primaryResult.data) {
        // Use primary but with reduced confidence
        return {
          ...primaryResult.data,
          modelUsed: 'fallback1',
          confidence: primaryResult.data.riskScore * 0.8, // Reduce confidence by 20%
        };
      }
    } catch (error) {
      console.warn('Primary model failed, using rule-based fallback');
    }

    // Rule-based prediction (simplified)
    // In production, this would use historical patterns, location-based rules, etc.
    return {
      complaintId,
      hotspots: [],
      timeWindow: 'Unknown',
      explanation: 'Using rule-based fallback model',
      riskScore: 0.5, // Neutral risk
      modelUsed: 'fallback2',
      confidence: 0.5,
    };
  },

  /**
   * Adjust confidence scores based on model health
   */
  async adjustConfidence(riskScore: number): Promise<number> {
    const metrics = await modelMonitoringService.getMetrics();
    
    if (!metrics || metrics.totalPredictions < 10) {
      return riskScore;
    }

    // If accuracy is low, reduce confidence
    if (metrics.accuracy < ACCURACY_THRESHOLD) {
      const adjustment = (ACCURACY_THRESHOLD - metrics.accuracy) * 0.5;
      return Math.max(0, riskScore - adjustment);
    }

    return riskScore;
  },

  /**
   * Get current active model
   */
  async getActiveModel(): Promise<FallbackModel> {
    const useFallback = await this.shouldUseFallback();
    const metrics = await modelMonitoringService.getMetrics();
    
    if (useFallback) {
      return {
        id: 'fallback1',
        name: 'Simplified Model',
        type: 'fallback1',
        accuracy: metrics?.accuracy || 0.75,
      };
    }

    return {
      id: 'primary',
      name: 'CST-Transformer',
      type: 'primary',
      accuracy: metrics?.accuracy || 0.90,
    };
  },
};

