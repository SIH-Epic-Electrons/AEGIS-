"""
Reinforcement Learning Configuration

Centralized configuration for the RLHF (Reinforcement Learning from Human Feedback) system.
"""

import os
from pathlib import Path
from enum import Enum
from typing import Optional, List
from pydantic_settings import BaseSettings, SettingsConfigDict


class RewardStrategy(str, Enum):
    """Reward calculation strategies"""
    SPARSE = "sparse"           # Simple binary reward
    SHAPED = "shaped"           # Detailed reward shaping
    HIERARCHICAL = "hierarchical"  # Multi-level rewards


class UpdateStrategy(str, Enum):
    """Policy update strategies"""
    REINFORCE = "reinforce"     # Basic policy gradient
    PPO = "ppo"                 # Proximal Policy Optimization
    ACTOR_CRITIC = "actor_critic"  # Actor-Critic method


class RLSettings(BaseSettings):
    """Reinforcement Learning configuration settings"""
    
    model_config = SettingsConfigDict(
        env_prefix="AEGIS_RL_",
        case_sensitive=False,
        protected_namespaces=('settings_',)
    )
    
    # === General Settings ===
    enabled: bool = True
    debug_mode: bool = False
    
    # === Feedback Settings ===
    min_feedback_for_update: int = 50  # Min feedback samples before update
    feedback_buffer_size: int = 10000  # Max feedback in buffer
    feedback_staleness_days: int = 90  # Discard feedback older than this
    
    # === Reward Settings ===
    reward_strategy: RewardStrategy = RewardStrategy.SHAPED
    
    # Reward weights for shaped rewards
    location_exact_match_reward: float = 10.0
    location_nearby_reward: float = 5.0
    location_different_penalty: float = -3.0
    location_unknown_reward: float = 0.0
    
    apprehension_reward: float = 8.0
    recovery_reward: float = 6.0
    both_outcome_bonus: float = 5.0
    unsuccessful_penalty: float = -5.0
    
    # Recovery amount reward scaling
    recovery_rate_multiplier: float = 5.0  # reward = rate * multiplier
    
    # === Training Settings ===
    update_strategy: UpdateStrategy = UpdateStrategy.REINFORCE
    learning_rate: float = 1e-4
    discount_factor: float = 0.99  # Gamma for future rewards
    batch_size: int = 32
    
    # PPO specific
    ppo_clip_ratio: float = 0.2
    ppo_epochs: int = 4
    
    # === Experience Buffer Settings ===
    buffer_type: str = "prioritized"  # "uniform" or "prioritized"
    priority_alpha: float = 0.6  # Prioritization exponent
    priority_beta: float = 0.4   # Importance sampling start
    priority_beta_increment: float = 0.001
    
    # === Model Update Settings ===
    update_frequency: str = "daily"  # "immediate", "hourly", "daily", "weekly"
    min_samples_for_update: int = 100
    max_gradient_norm: float = 0.5  # Gradient clipping
    
    # === Checkpoint Settings ===
    checkpoint_dir: str = "checkpoints/rl"
    save_frequency: int = 100  # Save every N updates
    keep_checkpoints: int = 5  # Number of checkpoints to keep
    
    # === Model Paths (relative to workspace root) ===
    cst_model_path: str = "checkpoints/cst_transformer_best.pth"
    gnn_model_path: str = "checkpoints/gnn_mule_detector_best.pth"
    
    # === Logging ===
    log_rewards: bool = True
    log_updates: bool = True
    tensorboard_enabled: bool = False
    tensorboard_dir: str = "logs/rl"
    
    @property
    def checkpoint_path(self) -> Path:
        """Get absolute checkpoint path"""
        return Path(os.getcwd()) / self.checkpoint_dir
    
    @property
    def absolute_cst_path(self) -> Path:
        """Get absolute CST model path"""
        return Path(os.getcwd()) / self.cst_model_path
    
    @property
    def absolute_gnn_path(self) -> Path:
        """Get absolute GNN model path"""
        return Path(os.getcwd()) / self.gnn_model_path


# Global configuration instance
rl_config = RLSettings()


def get_rl_config() -> RLSettings:
    """Get RL configuration"""
    return rl_config

