"""
Reward Calculation Module

Converts officer feedback into numerical rewards for reinforcement learning.
Uses shaped rewards to provide meaningful learning signals.
"""

import logging
from typing import Dict, Tuple, Optional
from dataclasses import dataclass

from app.reinforcement_learning.config import rl_config, RewardStrategy
from app.reinforcement_learning.feedback.schemas import (
    FeedbackCreate,
    PredictionAccuracy,
    InterventionResult,
)

logger = logging.getLogger(__name__)


@dataclass
class RewardBreakdown:
    """Detailed breakdown of reward components"""
    location_reward: float = 0.0
    intervention_reward: float = 0.0
    recovery_reward: float = 0.0
    time_accuracy_reward: float = 0.0
    mule_detection_reward: float = 0.0
    bonus_reward: float = 0.0
    penalty: float = 0.0
    total: float = 0.0
    
    def to_dict(self) -> Dict[str, float]:
        return {
            "location": self.location_reward,
            "intervention": self.intervention_reward,
            "recovery": self.recovery_reward,
            "time_accuracy": self.time_accuracy_reward,
            "mule_detection": self.mule_detection_reward,
            "bonus": self.bonus_reward,
            "penalty": self.penalty,
            "total": self.total,
        }


class RewardCalculator:
    """
    Calculates rewards from officer feedback.
    
    Reward shaping strategy:
    - Location accuracy: Primary reward signal
    - Intervention outcome: Secondary reward
    - Recovery rate: Bonus reward based on money recovered
    - Time accuracy: Auxiliary signal
    - Mule detection: Auxiliary signal for GNN model
    """
    
    def __init__(self, config=None):
        self.config = config or rl_config
        
    def calculate_reward(
        self, 
        feedback: FeedbackCreate,
        prediction_confidence: Optional[float] = None
    ) -> Tuple[float, RewardBreakdown]:
        """
        Calculate total reward from feedback.
        
        Args:
            feedback: Officer feedback data
            prediction_confidence: Model's confidence in prediction (0-1)
            
        Returns:
            Tuple of (total_reward, reward_breakdown)
        """
        if self.config.reward_strategy == RewardStrategy.SPARSE:
            return self._sparse_reward(feedback)
        elif self.config.reward_strategy == RewardStrategy.SHAPED:
            return self._shaped_reward(feedback, prediction_confidence)
        else:  # HIERARCHICAL
            return self._hierarchical_reward(feedback, prediction_confidence)
    
    def _sparse_reward(
        self, 
        feedback: FeedbackCreate
    ) -> Tuple[float, RewardBreakdown]:
        """
        Simple binary reward.
        +1 for success, -1 for failure.
        """
        breakdown = RewardBreakdown()
        
        # Success = exact match OR nearby + some recovery
        success = (
            feedback.prediction_accuracy == PredictionAccuracy.EXACT_MATCH or
            (feedback.prediction_accuracy == PredictionAccuracy.NEARBY and
             feedback.intervention_result in [InterventionResult.BOTH, 
                                               InterventionResult.MONEY_RECOVERED,
                                               InterventionResult.SUSPECT_APPREHENDED])
        )
        
        breakdown.total = 1.0 if success else -1.0
        return breakdown.total, breakdown
    
    def _shaped_reward(
        self, 
        feedback: FeedbackCreate,
        prediction_confidence: Optional[float] = None
    ) -> Tuple[float, RewardBreakdown]:
        """
        Detailed reward shaping with multiple components.
        Provides richer learning signal for faster convergence.
        """
        breakdown = RewardBreakdown()
        
        # 1. Location Accuracy Reward (Primary)
        location_rewards = {
            PredictionAccuracy.EXACT_MATCH: self.config.location_exact_match_reward,
            PredictionAccuracy.NEARBY: self.config.location_nearby_reward,
            PredictionAccuracy.DIFFERENT: self.config.location_different_penalty,
            PredictionAccuracy.UNKNOWN: self.config.location_unknown_reward,
        }
        breakdown.location_reward = location_rewards[feedback.prediction_accuracy]
        
        # 2. Intervention Outcome Reward
        intervention_rewards = {
            InterventionResult.SUSPECT_APPREHENDED: self.config.apprehension_reward,
            InterventionResult.MONEY_RECOVERED: self.config.recovery_reward,
            InterventionResult.BOTH: self.config.apprehension_reward + self.config.recovery_reward,
            InterventionResult.UNSUCCESSFUL: self.config.unsuccessful_penalty,
        }
        breakdown.intervention_reward = intervention_rewards[feedback.intervention_result]
        
        # 3. Recovery Rate Bonus
        if feedback.recovery_rate is not None:
            breakdown.recovery_reward = (
                feedback.recovery_rate * self.config.recovery_rate_multiplier
            )
        
        # 4. Bonus for "Both" outcome
        if feedback.intervention_result == InterventionResult.BOTH:
            breakdown.bonus_reward = self.config.both_outcome_bonus
        
        # 5. Time Accuracy (if provided)
        if feedback.time_prediction_accurate is not None:
            breakdown.time_accuracy_reward = 2.0 if feedback.time_prediction_accurate else -1.0
        
        # 6. Mule Detection Accuracy (for GNN model)
        if feedback.mule_detection_accurate is not None:
            breakdown.mule_detection_reward = 3.0 if feedback.mule_detection_accurate else -2.0
        
        # 7. Confidence calibration penalty
        # Penalize high confidence on wrong predictions
        if prediction_confidence is not None:
            if feedback.prediction_accuracy == PredictionAccuracy.DIFFERENT:
                # High confidence + wrong = bad
                if prediction_confidence > 0.8:
                    breakdown.penalty = -3.0 * prediction_confidence
            elif feedback.prediction_accuracy == PredictionAccuracy.EXACT_MATCH:
                # Correct + high confidence = good
                if prediction_confidence > 0.8:
                    breakdown.bonus_reward += 1.0
        
        # Calculate total
        breakdown.total = (
            breakdown.location_reward +
            breakdown.intervention_reward +
            breakdown.recovery_reward +
            breakdown.time_accuracy_reward +
            breakdown.mule_detection_reward +
            breakdown.bonus_reward +
            breakdown.penalty
        )
        
        logger.debug(f"Shaped reward calculated: {breakdown.total:.2f}")
        return breakdown.total, breakdown
    
    def _hierarchical_reward(
        self, 
        feedback: FeedbackCreate,
        prediction_confidence: Optional[float] = None
    ) -> Tuple[float, RewardBreakdown]:
        """
        Hierarchical reward structure.
        Different reward scales for different importance levels.
        """
        breakdown = RewardBreakdown()
        
        # Level 1: Primary objective - Location accuracy (weight: 0.5)
        location_scores = {
            PredictionAccuracy.EXACT_MATCH: 1.0,
            PredictionAccuracy.NEARBY: 0.6,
            PredictionAccuracy.DIFFERENT: -0.4,
            PredictionAccuracy.UNKNOWN: 0.0,
        }
        breakdown.location_reward = location_scores[feedback.prediction_accuracy] * 10.0
        
        # Level 2: Secondary objective - Intervention success (weight: 0.3)
        intervention_scores = {
            InterventionResult.BOTH: 1.0,
            InterventionResult.SUSPECT_APPREHENDED: 0.8,
            InterventionResult.MONEY_RECOVERED: 0.7,
            InterventionResult.UNSUCCESSFUL: -0.5,
        }
        breakdown.intervention_reward = intervention_scores[feedback.intervention_result] * 6.0
        
        # Level 3: Tertiary - Recovery amount (weight: 0.2)
        if feedback.recovery_rate is not None:
            breakdown.recovery_reward = feedback.recovery_rate * 4.0
        
        # Hierarchical combination with diminishing returns
        breakdown.total = (
            0.5 * breakdown.location_reward +
            0.3 * breakdown.intervention_reward +
            0.2 * breakdown.recovery_reward
        )
        
        return breakdown.total, breakdown
    
    def normalize_reward(self, reward: float) -> float:
        """
        Normalize reward to [-1, 1] range for stable training.
        """
        # Approximate reward range based on config
        max_reward = (
            self.config.location_exact_match_reward +
            self.config.apprehension_reward +
            self.config.recovery_reward +
            self.config.both_outcome_bonus +
            self.config.recovery_rate_multiplier +
            5.0  # Buffer for bonuses
        )
        min_reward = (
            self.config.location_different_penalty +
            self.config.unsuccessful_penalty - 5.0
        )
        
        # Normalize to [-1, 1]
        range_size = max_reward - min_reward
        if range_size == 0:
            return 0.0
        normalized = 2 * (reward - min_reward) / range_size - 1
        return max(-1.0, min(1.0, normalized))


# Singleton instance
_reward_calculator = None


def get_reward_calculator() -> RewardCalculator:
    """Get singleton reward calculator instance"""
    global _reward_calculator
    if _reward_calculator is None:
        _reward_calculator = RewardCalculator()
    return _reward_calculator

