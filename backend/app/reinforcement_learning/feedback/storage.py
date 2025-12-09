"""
Feedback Storage Module

Handles storage and retrieval of feedback for RL training.
Supports both in-memory buffer and database persistence.
"""

import logging
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from uuid import UUID, uuid4
from collections import deque
import asyncio

from app.reinforcement_learning.config import rl_config
from app.reinforcement_learning.feedback.schemas import (
    FeedbackCreate,
    FeedbackRecord,
    FeedbackStats,
    PredictionAccuracy,
    InterventionResult,
)
from app.reinforcement_learning.feedback.reward import (
    RewardCalculator,
    RewardBreakdown,
    get_reward_calculator,
)

logger = logging.getLogger(__name__)


class FeedbackStorage:
    """
    Manages feedback storage for reinforcement learning.
    
    Features:
    - In-memory buffer for fast access
    - Database persistence for durability
    - Automatic cleanup of stale feedback
    - Statistics calculation
    """
    
    def __init__(self, config=None):
        self.config = config or rl_config
        self._buffer: deque[FeedbackRecord] = deque(maxlen=self.config.feedback_buffer_size)
        self._reward_calculator = get_reward_calculator()
        self._lock = asyncio.Lock()
        
        # Statistics tracking
        self._total_feedback = 0
        self._accuracy_counts = {acc: 0 for acc in PredictionAccuracy}
        self._outcome_counts = {out: 0 for out in InterventionResult}
        self._total_reward = 0.0
        self._total_recovery_rate = 0.0
        self._recovery_count = 0
        
        logger.info(
            f"FeedbackStorage initialized: buffer_size={self.config.feedback_buffer_size}"
        )
    
    async def store_feedback(
        self,
        prediction_id: UUID,
        case_id: UUID,
        officer_id: UUID,
        feedback: FeedbackCreate,
        model_version: str = "v1.0",
        state_features: Optional[Dict[str, Any]] = None,
        action_taken: Optional[Dict[str, Any]] = None,
        prediction_confidence: Optional[float] = None,
    ) -> FeedbackRecord:
        """
        Store new feedback and calculate reward.
        
        Args:
            prediction_id: ID of the prediction being evaluated
            case_id: ID of the case
            officer_id: ID of the officer providing feedback
            feedback: Feedback data from officer
            model_version: Version of model that made prediction
            state_features: Input features for training
            action_taken: Model's prediction/action
            prediction_confidence: Model's confidence score
            
        Returns:
            FeedbackRecord with calculated reward
        """
        async with self._lock:
            # Calculate reward
            reward, breakdown = self._reward_calculator.calculate_reward(
                feedback, prediction_confidence
            )
            
            # Create record
            record = FeedbackRecord(
                id=uuid4(),
                prediction_id=prediction_id,
                case_id=case_id,
                officer_id=officer_id,
                feedback=feedback,
                reward=reward,
                reward_components=breakdown.to_dict(),
                created_at=datetime.utcnow(),
                ml_model_version=model_version,
                state_features=state_features,
                action_taken=action_taken,
            )
            
            # Add to buffer
            self._buffer.append(record)
            
            # Update statistics
            self._update_stats(feedback, reward)
            
            logger.info(
                f"Stored feedback: prediction={prediction_id}, "
                f"accuracy={feedback.prediction_accuracy.value}, "
                f"reward={reward:.2f}"
            )
            
            return record
    
    def _update_stats(self, feedback: FeedbackCreate, reward: float):
        """Update running statistics"""
        self._total_feedback += 1
        self._accuracy_counts[feedback.prediction_accuracy] += 1
        self._outcome_counts[feedback.intervention_result] += 1
        self._total_reward += reward
        
        if feedback.recovery_rate is not None:
            self._total_recovery_rate += feedback.recovery_rate
            self._recovery_count += 1
    
    async def get_recent_feedback(
        self,
        limit: int = 100,
        model_version: Optional[str] = None,
    ) -> List[FeedbackRecord]:
        """
        Get recent feedback records.
        
        Args:
            limit: Maximum records to return
            model_version: Filter by model version
            
        Returns:
            List of recent feedback records
        """
        async with self._lock:
            records = list(self._buffer)[-limit:]
            
            if model_version:
                records = [r for r in records if r.ml_model_version == model_version]
            
            return records
    
    async def get_training_batch(
        self,
        batch_size: Optional[int] = None,
        min_reward: Optional[float] = None,
    ) -> List[FeedbackRecord]:
        """
        Get batch of feedback for training.
        
        Args:
            batch_size: Number of records (default from config)
            min_reward: Minimum reward threshold
            
        Returns:
            Batch of feedback records with state/action data
        """
        batch_size = batch_size or self.config.batch_size
        
        async with self._lock:
            # Filter records that have training data
            eligible = [
                r for r in self._buffer
                if r.state_features is not None and r.action_taken is not None
            ]
            
            if min_reward is not None:
                eligible = [r for r in eligible if r.reward >= min_reward]
            
            # Return most recent batch
            return list(eligible)[-batch_size:]
    
    async def get_feedback_by_accuracy(
        self,
        accuracy: PredictionAccuracy,
        limit: int = 50,
    ) -> List[FeedbackRecord]:
        """Get feedback filtered by accuracy type"""
        async with self._lock:
            records = [
                r for r in self._buffer
                if r.feedback.prediction_accuracy == accuracy
            ]
            return records[-limit:]
    
    async def get_statistics(
        self,
        days: int = 30,
    ) -> FeedbackStats:
        """
        Calculate feedback statistics.
        
        Args:
            days: Look back period in days
            
        Returns:
            Aggregated statistics
        """
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        async with self._lock:
            recent = [r for r in self._buffer if r.created_at >= cutoff]
            
            if not recent:
                return FeedbackStats(
                    total_feedback=0,
                    exact_match_count=0,
                    nearby_count=0,
                    different_count=0,
                    unknown_count=0,
                    apprehended_count=0,
                    recovered_count=0,
                    both_count=0,
                    unsuccessful_count=0,
                    average_location_accuracy=0.0,
                    average_recovery_rate=0.0,
                    average_reward=0.0,
                    from_date=cutoff,
                    to_date=datetime.utcnow(),
                )
            
            # Count by accuracy
            accuracy_counts = {acc: 0 for acc in PredictionAccuracy}
            outcome_counts = {out: 0 for out in InterventionResult}
            total_reward = 0.0
            total_recovery = 0.0
            recovery_count = 0
            
            for r in recent:
                accuracy_counts[r.feedback.prediction_accuracy] += 1
                outcome_counts[r.feedback.intervention_result] += 1
                total_reward += r.reward
                if r.feedback.recovery_rate is not None:
                    total_recovery += r.feedback.recovery_rate
                    recovery_count += 1
            
            # Calculate location accuracy score
            accuracy_weights = {
                PredictionAccuracy.EXACT_MATCH: 1.0,
                PredictionAccuracy.NEARBY: 0.7,
                PredictionAccuracy.DIFFERENT: 0.2,
                PredictionAccuracy.UNKNOWN: 0.5,
            }
            weighted_accuracy = sum(
                accuracy_counts[acc] * accuracy_weights[acc]
                for acc in PredictionAccuracy
            )
            avg_accuracy = weighted_accuracy / len(recent) if recent else 0.0
            
            return FeedbackStats(
                total_feedback=len(recent),
                exact_match_count=accuracy_counts[PredictionAccuracy.EXACT_MATCH],
                nearby_count=accuracy_counts[PredictionAccuracy.NEARBY],
                different_count=accuracy_counts[PredictionAccuracy.DIFFERENT],
                unknown_count=accuracy_counts[PredictionAccuracy.UNKNOWN],
                apprehended_count=outcome_counts[InterventionResult.SUSPECT_APPREHENDED],
                recovered_count=outcome_counts[InterventionResult.MONEY_RECOVERED],
                both_count=outcome_counts[InterventionResult.BOTH],
                unsuccessful_count=outcome_counts[InterventionResult.UNSUCCESSFUL],
                average_location_accuracy=avg_accuracy,
                average_recovery_rate=total_recovery / recovery_count if recovery_count > 0 else 0.0,
                average_reward=total_reward / len(recent),
                from_date=min(r.created_at for r in recent),
                to_date=max(r.created_at for r in recent),
            )
    
    async def cleanup_stale_feedback(self) -> int:
        """
        Remove feedback older than staleness threshold.
        
        Returns:
            Number of records removed
        """
        cutoff = datetime.utcnow() - timedelta(days=self.config.feedback_staleness_days)
        
        async with self._lock:
            original_len = len(self._buffer)
            self._buffer = deque(
                (r for r in self._buffer if r.created_at >= cutoff),
                maxlen=self.config.feedback_buffer_size
            )
            removed = original_len - len(self._buffer)
            
            if removed > 0:
                logger.info(f"Cleaned up {removed} stale feedback records")
            
            return removed
    
    def should_update_model(self) -> bool:
        """Check if we have enough feedback to trigger model update"""
        return len(self._buffer) >= self.config.min_feedback_for_update
    
    @property
    def buffer_size(self) -> int:
        """Current buffer size"""
        return len(self._buffer)
    
    async def export_for_training(self) -> List[Dict[str, Any]]:
        """
        Export feedback as training data format.
        
        Returns:
            List of training samples
        """
        async with self._lock:
            samples = []
            for record in self._buffer:
                if record.state_features and record.action_taken:
                    samples.append({
                        "state": record.state_features,
                        "action": record.action_taken,
                        "reward": record.reward,
                        "timestamp": record.created_at.isoformat(),
                        "model_version": record.model_version,
                    })
            return samples


# Singleton instance
_feedback_storage = None


def get_feedback_storage() -> FeedbackStorage:
    """Get singleton feedback storage instance"""
    global _feedback_storage
    if _feedback_storage is None:
        _feedback_storage = FeedbackStorage()
    return _feedback_storage

