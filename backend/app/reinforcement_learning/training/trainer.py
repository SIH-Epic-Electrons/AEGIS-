"""
RL Trainer Module

Main trainer that orchestrates:
1. Collecting feedback and converting to experiences
2. Storing in experience buffer
3. Triggering model updates
4. Managing checkpoints
"""

import logging
import os
import torch
import torch.nn as nn
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
import asyncio
import json

from app.reinforcement_learning.config import rl_config, UpdateStrategy
from app.reinforcement_learning.feedback.storage import (
    FeedbackStorage,
    get_feedback_storage,
)
from app.reinforcement_learning.feedback.schemas import FeedbackRecord
from app.reinforcement_learning.training.experience_buffer import (
    Experience,
    ExperienceBuffer,
    PrioritizedExperienceBuffer,
    get_experience_buffer,
)
from app.reinforcement_learning.training.policy_gradient import (
    PolicyGradient,
    PPO,
    PolicyUpdateResult,
    get_policy_updater,
)

logger = logging.getLogger(__name__)


@dataclass
class TrainingResult:
    """Result of a training session"""
    success: bool
    num_samples: int
    total_loss: float
    average_reward: float
    updates_performed: int
    duration_seconds: float
    model_version: str
    checkpoint_path: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass 
class TrainingHistory:
    """Training history for tracking progress"""
    losses: List[float] = field(default_factory=list)
    rewards: List[float] = field(default_factory=list)
    timestamps: List[datetime] = field(default_factory=list)
    update_counts: List[int] = field(default_factory=list)


class RLTrainer:
    """
    Reinforcement Learning Trainer for AEGIS models.
    
    Manages the complete RL training pipeline:
    - Feedback collection and processing
    - Experience buffer management
    - Policy updates
    - Checkpoint management
    """
    
    def __init__(
        self,
        model: nn.Module = None,
        model_name: str = "cst_transformer",
        config = None,
    ):
        self.config = config or rl_config
        self.model_name = model_name
        self.model = model
        self.model_version = "v1.0"
        
        # Initialize components
        self._feedback_storage = get_feedback_storage()
        self._experience_buffer = get_experience_buffer()
        self._policy_updater = None
        
        # Training state
        self._is_training = False
        self._update_count = 0
        self._history = TrainingHistory()
        
        # Lock for thread safety
        self._lock = asyncio.Lock()
        
        # Checkpoint directory
        self._checkpoint_dir = Path(self.config.checkpoint_path)
        self._checkpoint_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"RLTrainer initialized for {model_name}")
    
    def set_model(self, model: nn.Module, version: str = "v1.0"):
        """Set or update the model to train"""
        self.model = model
        self.model_version = version
        
        # Initialize policy updater
        if self.config.update_strategy in [UpdateStrategy.REINFORCE, UpdateStrategy.PPO]:
            self._policy_updater = get_policy_updater(model, self.config.update_strategy)
        
        logger.info(f"Model set: {self.model_name} {version}")
    
    async def process_feedback(
        self,
        feedback_record: FeedbackRecord,
    ) -> Experience:
        """
        Process a feedback record into an experience.
        
        Args:
            feedback_record: Processed feedback from storage
            
        Returns:
            Experience ready for training
        """
        experience = Experience(
            state=feedback_record.state_features or {},
            action=feedback_record.action_taken or {},
            reward=feedback_record.reward,
            model_name=self.model_name,
            prediction_confidence=feedback_record.feedback.total_fraud_amount or 0.0,
            timestamp=feedback_record.created_at,
        )
        
        # Add to buffer
        self._experience_buffer.add(experience)
        
        logger.debug(
            f"Processed feedback -> experience: reward={experience.reward:.2f}"
        )
        
        return experience
    
    async def maybe_update(self) -> Optional[TrainingResult]:
        """
        Check if we should update and perform update if ready.
        
        Returns:
            TrainingResult if update performed, None otherwise
        """
        if not self._should_update():
            return None
        
        return await self.train_step()
    
    def _should_update(self) -> bool:
        """Check if conditions are met for model update"""
        if self.model is None:
            return False
        
        if not self._experience_buffer.is_ready:
            return False
        
        if self._is_training:
            return False
        
        # Check update frequency
        if self.config.update_frequency == "immediate":
            return True
        
        # For other frequencies, check last update time
        if not self._history.timestamps:
            return True
        
        last_update = self._history.timestamps[-1]
        now = datetime.utcnow()
        
        if self.config.update_frequency == "hourly":
            return (now - last_update).total_seconds() >= 3600
        elif self.config.update_frequency == "daily":
            return (now - last_update).total_seconds() >= 86400
        elif self.config.update_frequency == "weekly":
            return (now - last_update).total_seconds() >= 604800
        
        return False
    
    async def train_step(
        self,
        batch_size: int = None,
    ) -> TrainingResult:
        """
        Perform one training step.
        
        Args:
            batch_size: Override default batch size
            
        Returns:
            TrainingResult with metrics
        """
        if self.model is None:
            raise ValueError("Model not set. Call set_model() first.")
        
        if self._policy_updater is None:
            raise ValueError("Policy updater not initialized")
        
        async with self._lock:
            self._is_training = True
            start_time = datetime.utcnow()
            
            try:
                batch_size = batch_size or self.config.batch_size
                
                # Sample batch
                if isinstance(self._experience_buffer, PrioritizedExperienceBuffer):
                    experiences, weights, indices = self._experience_buffer.sample(batch_size)
                else:
                    experiences = self._experience_buffer.sample(batch_size)
                    weights = None
                    indices = None
                
                if not experiences:
                    return TrainingResult(
                        success=False,
                        num_samples=0,
                        total_loss=0.0,
                        average_reward=0.0,
                        updates_performed=0,
                        duration_seconds=0.0,
                        model_version=self.model_version,
                        details={"error": "No experiences in buffer"}
                    )
                
                # Perform policy update
                update_result = self._policy_updater.update(experiences)
                
                # Update priorities if using PER
                if indices is not None and isinstance(self._experience_buffer, PrioritizedExperienceBuffer):
                    # Use loss as proxy for TD error
                    td_errors = [update_result.loss] * len(indices)
                    self._experience_buffer.update_priorities(indices, td_errors)
                
                # Record history
                avg_reward = sum(exp.reward for exp in experiences) / len(experiences)
                self._history.losses.append(update_result.loss)
                self._history.rewards.append(avg_reward)
                self._history.timestamps.append(datetime.utcnow())
                self._update_count += 1
                self._history.update_counts.append(self._update_count)
                
                # Save checkpoint if needed
                checkpoint_path = None
                if self._update_count % self.config.save_frequency == 0:
                    checkpoint_path = await self._save_checkpoint()
                
                duration = (datetime.utcnow() - start_time).total_seconds()
                
                logger.info(
                    f"Training step complete: loss={update_result.loss:.4f}, "
                    f"samples={len(experiences)}, reward={avg_reward:.2f}"
                )
                
                return TrainingResult(
                    success=True,
                    num_samples=len(experiences),
                    total_loss=update_result.loss,
                    average_reward=avg_reward,
                    updates_performed=1,
                    duration_seconds=duration,
                    model_version=self.model_version,
                    checkpoint_path=checkpoint_path,
                    details={
                        "gradient_norm": update_result.gradient_norm,
                        "entropy": update_result.entropy,
                        "kl_divergence": update_result.kl_divergence,
                    }
                )
                
            finally:
                self._is_training = False
    
    async def train_epoch(
        self,
        num_steps: int = 10,
    ) -> TrainingResult:
        """
        Perform multiple training steps.
        
        Args:
            num_steps: Number of update steps
            
        Returns:
            Aggregated TrainingResult
        """
        start_time = datetime.utcnow()
        total_loss = 0.0
        total_reward = 0.0
        total_samples = 0
        
        for step in range(num_steps):
            result = await self.train_step()
            
            if result.success:
                total_loss += result.total_loss
                total_reward += result.average_reward * result.num_samples
                total_samples += result.num_samples
        
        duration = (datetime.utcnow() - start_time).total_seconds()
        
        checkpoint_path = await self._save_checkpoint()
        
        return TrainingResult(
            success=True,
            num_samples=total_samples,
            total_loss=total_loss / num_steps if num_steps > 0 else 0,
            average_reward=total_reward / total_samples if total_samples > 0 else 0,
            updates_performed=num_steps,
            duration_seconds=duration,
            model_version=self.model_version,
            checkpoint_path=checkpoint_path,
        )
    
    async def _save_checkpoint(self) -> str:
        """Save model checkpoint"""
        checkpoint_name = f"{self.model_name}_rl_{self._update_count}.pth"
        checkpoint_path = self._checkpoint_dir / checkpoint_name
        
        # Save model state
        torch.save({
            "model_state_dict": self.model.state_dict(),
            "update_count": self._update_count,
            "model_version": self.model_version,
            "timestamp": datetime.utcnow().isoformat(),
            "config": {
                "learning_rate": self.config.learning_rate,
                "update_strategy": self.config.update_strategy.value,
            }
        }, checkpoint_path)
        
        # Cleanup old checkpoints
        await self._cleanup_checkpoints()
        
        logger.info(f"Checkpoint saved: {checkpoint_path}")
        
        return str(checkpoint_path)
    
    async def _cleanup_checkpoints(self):
        """Remove old checkpoints keeping only recent ones"""
        checkpoints = sorted(
            self._checkpoint_dir.glob(f"{self.model_name}_rl_*.pth"),
            key=lambda p: p.stat().st_mtime,
            reverse=True
        )
        
        for old_checkpoint in checkpoints[self.config.keep_checkpoints:]:
            old_checkpoint.unlink()
            logger.debug(f"Removed old checkpoint: {old_checkpoint}")
    
    async def load_checkpoint(self, checkpoint_path: str = None) -> bool:
        """
        Load model from checkpoint.
        
        Args:
            checkpoint_path: Path to checkpoint (uses latest if None)
            
        Returns:
            True if loaded successfully
        """
        if checkpoint_path is None:
            # Find latest checkpoint
            checkpoints = sorted(
                self._checkpoint_dir.glob(f"{self.model_name}_rl_*.pth"),
                key=lambda p: p.stat().st_mtime,
                reverse=True
            )
            if not checkpoints:
                logger.warning("No checkpoints found")
                return False
            checkpoint_path = str(checkpoints[0])
        
        try:
            checkpoint = torch.load(checkpoint_path, map_location="cpu")
            
            if self.model is not None:
                self.model.load_state_dict(checkpoint["model_state_dict"])
            
            self._update_count = checkpoint.get("update_count", 0)
            self.model_version = checkpoint.get("model_version", "v1.0")
            
            logger.info(f"Loaded checkpoint: {checkpoint_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load checkpoint: {e}")
            return False
    
    def get_training_stats(self) -> Dict[str, Any]:
        """Get training statistics"""
        return {
            "model_name": self.model_name,
            "model_version": self.model_version,
            "update_count": self._update_count,
            "buffer_size": len(self._experience_buffer),
            "is_training": self._is_training,
            "recent_losses": self._history.losses[-10:],
            "recent_rewards": self._history.rewards[-10:],
            "average_loss": sum(self._history.losses[-100:]) / len(self._history.losses[-100:]) if self._history.losses else 0,
            "average_reward": sum(self._history.rewards[-100:]) / len(self._history.rewards[-100:]) if self._history.rewards else 0,
        }


# Singleton instances
_trainers: Dict[str, RLTrainer] = {}


def get_rl_trainer(model_name: str = "cst_transformer") -> RLTrainer:
    """Get or create RL trainer for a model"""
    if model_name not in _trainers:
        _trainers[model_name] = RLTrainer(model_name=model_name)
    return _trainers[model_name]


async def initialize_trainers():
    """Initialize trainers with pre-trained models"""
    from app.ml.models.cst_transformer import CSTTransformer
    from app.ml.models.mule_detector_gnn import MuleDetectorGNN
    
    # Initialize CST trainer
    cst_trainer = get_rl_trainer("cst_transformer")
    if rl_config.absolute_cst_path.exists():
        cst_model = CSTTransformer(num_states=15)  # Match pre-trained
        checkpoint = torch.load(rl_config.absolute_cst_path, map_location="cpu")
        cst_model.load_state_dict(checkpoint["model_state_dict"])
        cst_trainer.set_model(cst_model)
        logger.info("CST Transformer trainer initialized")
    
    # Initialize GNN trainer  
    gnn_trainer = get_rl_trainer("mule_detector_gnn")
    if rl_config.absolute_gnn_path.exists():
        gnn_model = MuleDetectorGNN(input_dim=31)  # Match pre-trained
        checkpoint = torch.load(rl_config.absolute_gnn_path, map_location="cpu")
        gnn_model.load_state_dict(checkpoint["model_state_dict"])
        gnn_trainer.set_model(gnn_model)
        logger.info("GNN Mule Detector trainer initialized")

