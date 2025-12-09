"""
AEGIS Reinforcement Learning Module

This module implements Reinforcement Learning from Human Feedback (RLHF)
to continuously improve AI prediction models based on officer feedback.

Key Components:
- Feedback Processing: Collects and processes officer feedback
- Reward Calculation: Converts feedback to numerical rewards
- Experience Buffer: Stores experiences for batch training
- Policy Updates: Updates model weights based on rewards
"""

from app.reinforcement_learning.config import rl_config, RLSettings
from app.reinforcement_learning.feedback.schemas import (
    PredictionAccuracy,
    InterventionResult,
    OutcomeFeedback,
    FeedbackCreate,
)
from app.reinforcement_learning.feedback.reward import RewardCalculator

__all__ = [
    "rl_config",
    "RLSettings",
    "PredictionAccuracy",
    "InterventionResult",
    "OutcomeFeedback",
    "FeedbackCreate",
    "RewardCalculator",
]

