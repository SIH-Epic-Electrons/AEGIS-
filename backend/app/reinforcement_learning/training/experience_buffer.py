"""
Experience Replay Buffer

Stores experiences (state, action, reward) for batch training.
Supports both uniform and prioritized sampling.
"""

import logging
import random
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from collections import deque
from datetime import datetime
import torch

from app.reinforcement_learning.config import rl_config

logger = logging.getLogger(__name__)


@dataclass
class Experience:
    """
    Single experience tuple for RL training.
    
    Contains all information needed to update the policy:
    - state: Input features when prediction was made
    - action: The prediction/decision made
    - reward: Feedback-derived reward signal
    - next_state: State after action (optional, for TD learning)
    - done: Whether episode ended
    """
    state: Dict[str, Any]           # Input features
    action: Dict[str, Any]          # Model's prediction
    reward: float                    # Calculated reward
    next_state: Optional[Dict[str, Any]] = None
    done: bool = False
    
    # Metadata
    timestamp: datetime = field(default_factory=datetime.utcnow)
    model_name: str = "unknown"
    prediction_confidence: float = 0.0
    
    # Priority for prioritized replay
    priority: float = 1.0
    td_error: float = 0.0
    
    def to_tensors(self, device: str = "cpu") -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Convert experience to tensors for training.
        
        Returns:
            Tuple of (state_tensor, action_tensor, reward_tensor)
        """
        # Convert state dict to tensor
        state_values = self._flatten_dict(self.state)
        state_tensor = torch.tensor(state_values, dtype=torch.float32, device=device)
        
        # Convert action to tensor (assuming action contains prediction indices)
        action_values = self._flatten_dict(self.action)
        action_tensor = torch.tensor(action_values, dtype=torch.float32, device=device)
        
        reward_tensor = torch.tensor([self.reward], dtype=torch.float32, device=device)
        
        return state_tensor, action_tensor, reward_tensor
    
    @staticmethod
    def _flatten_dict(d: Dict[str, Any], prefix: str = "") -> List[float]:
        """Flatten nested dict to list of floats"""
        values = []
        for k, v in d.items():
            if isinstance(v, dict):
                values.extend(Experience._flatten_dict(v, f"{prefix}{k}_"))
            elif isinstance(v, (int, float)):
                values.append(float(v))
            elif isinstance(v, list):
                values.extend([float(x) for x in v if isinstance(x, (int, float))])
        return values


class ExperienceBuffer:
    """
    Uniform experience replay buffer.
    
    Simple FIFO buffer with uniform random sampling.
    """
    
    def __init__(self, max_size: int = None):
        self.max_size = max_size or rl_config.feedback_buffer_size
        self._buffer: deque[Experience] = deque(maxlen=self.max_size)
        
        logger.info(f"ExperienceBuffer initialized: max_size={self.max_size}")
    
    def add(self, experience: Experience):
        """Add experience to buffer"""
        self._buffer.append(experience)
    
    def add_batch(self, experiences: List[Experience]):
        """Add multiple experiences"""
        for exp in experiences:
            self._buffer.append(exp)
    
    def sample(self, batch_size: int) -> List[Experience]:
        """
        Sample random batch of experiences.
        
        Args:
            batch_size: Number of experiences to sample
            
        Returns:
            List of sampled experiences
        """
        if len(self._buffer) < batch_size:
            return list(self._buffer)
        
        return random.sample(list(self._buffer), batch_size)
    
    def sample_tensors(
        self, 
        batch_size: int,
        device: str = "cpu"
    ) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Sample batch and return as tensors.
        
        Returns:
            Tuple of (states, actions, rewards) tensors
        """
        experiences = self.sample(batch_size)
        
        states = []
        actions = []
        rewards = []
        
        for exp in experiences:
            s, a, r = exp.to_tensors(device)
            states.append(s)
            actions.append(a)
            rewards.append(r)
        
        return (
            torch.stack(states),
            torch.stack(actions),
            torch.cat(rewards),
        )
    
    def get_recent(self, n: int) -> List[Experience]:
        """Get n most recent experiences"""
        return list(self._buffer)[-n:]
    
    def clear(self):
        """Clear buffer"""
        self._buffer.clear()
    
    def __len__(self) -> int:
        return len(self._buffer)
    
    @property
    def is_ready(self) -> bool:
        """Check if buffer has enough samples for training"""
        return len(self._buffer) >= rl_config.min_samples_for_update


class PrioritizedExperienceBuffer(ExperienceBuffer):
    """
    Prioritized Experience Replay (PER) buffer.
    
    Samples experiences proportional to their TD error or importance.
    Important experiences (surprising outcomes) are sampled more often.
    """
    
    def __init__(self, max_size: int = None):
        super().__init__(max_size)
        self._priorities: deque[float] = deque(maxlen=self.max_size)
        self._beta = rl_config.priority_beta
        
        logger.info(
            f"PrioritizedExperienceBuffer initialized: "
            f"alpha={rl_config.priority_alpha}, beta={self._beta}"
        )
    
    def add(self, experience: Experience):
        """Add experience with priority"""
        # New experiences get max priority
        max_priority = max(self._priorities) if self._priorities else 1.0
        experience.priority = max_priority
        
        self._buffer.append(experience)
        self._priorities.append(max_priority)
    
    def sample(self, batch_size: int) -> Tuple[List[Experience], np.ndarray, List[int]]:
        """
        Sample batch with prioritized sampling.
        
        Returns:
            Tuple of (experiences, importance_weights, indices)
        """
        if len(self._buffer) < batch_size:
            experiences = list(self._buffer)
            weights = np.ones(len(experiences))
            indices = list(range(len(experiences)))
            return experiences, weights, indices
        
        # Calculate sampling probabilities
        priorities = np.array(list(self._priorities))
        probs = priorities ** rl_config.priority_alpha
        probs = probs / probs.sum()
        
        # Sample indices
        indices = np.random.choice(
            len(self._buffer),
            size=batch_size,
            p=probs,
            replace=False
        )
        
        # Calculate importance sampling weights
        n = len(self._buffer)
        weights = (n * probs[indices]) ** (-self._beta)
        weights = weights / weights.max()  # Normalize
        
        # Increment beta
        self._beta = min(1.0, self._beta + rl_config.priority_beta_increment)
        
        experiences = [self._buffer[i] for i in indices]
        
        return experiences, weights, indices.tolist()
    
    def update_priorities(self, indices: List[int], td_errors: np.ndarray):
        """
        Update priorities based on TD errors.
        
        Args:
            indices: Indices of experiences to update
            td_errors: New TD errors for each experience
        """
        for idx, td_error in zip(indices, td_errors):
            if 0 <= idx < len(self._priorities):
                # Priority = |TD error| + small constant
                priority = abs(td_error) + 1e-6
                
                # Update both priority list and experience
                priorities_list = list(self._priorities)
                priorities_list[idx] = priority
                self._priorities = deque(priorities_list, maxlen=self.max_size)
                
                self._buffer[idx].priority = priority
                self._buffer[idx].td_error = td_error


class EpisodeBuffer:
    """
    Buffer for storing complete episodes.
    
    Useful for Monte Carlo style updates where we need
    complete trajectories.
    """
    
    def __init__(self, max_episodes: int = 1000):
        self.max_episodes = max_episodes
        self._episodes: deque[List[Experience]] = deque(maxlen=max_episodes)
        self._current_episode: List[Experience] = []
    
    def add_step(self, experience: Experience):
        """Add step to current episode"""
        self._current_episode.append(experience)
    
    def end_episode(self):
        """End current episode and store it"""
        if self._current_episode:
            self._episodes.append(self._current_episode.copy())
            self._current_episode = []
    
    def sample_episodes(self, n: int) -> List[List[Experience]]:
        """Sample n complete episodes"""
        if len(self._episodes) < n:
            return list(self._episodes)
        return random.sample(list(self._episodes), n)
    
    def get_all_experiences(self) -> List[Experience]:
        """Get all experiences from all episodes"""
        experiences = []
        for episode in self._episodes:
            experiences.extend(episode)
        return experiences
    
    def __len__(self) -> int:
        return len(self._episodes)


# Factory function
def get_experience_buffer(prioritized: bool = None) -> ExperienceBuffer:
    """
    Get experience buffer based on configuration.
    
    Args:
        prioritized: Override config setting
        
    Returns:
        ExperienceBuffer or PrioritizedExperienceBuffer
    """
    use_prioritized = prioritized
    if use_prioritized is None:
        use_prioritized = rl_config.buffer_type == "prioritized"
    
    if use_prioritized:
        return PrioritizedExperienceBuffer()
    return ExperienceBuffer()

