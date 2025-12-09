"""
Policy Gradient Implementation

Implements policy gradient methods for updating model weights
based on feedback rewards.
"""

import logging
import torch
import torch.nn as nn
import torch.optim as optim
import torch.nn.functional as F
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import numpy as np

from app.reinforcement_learning.config import rl_config, UpdateStrategy
from app.reinforcement_learning.training.experience_buffer import Experience

logger = logging.getLogger(__name__)


@dataclass
class PolicyUpdateResult:
    """Result of a policy update step"""
    loss: float
    gradient_norm: float
    steps: int
    entropy: float = 0.0
    kl_divergence: float = 0.0


class PolicyGradient:
    """
    Basic REINFORCE policy gradient implementation.
    
    Updates policy to increase probability of actions
    that led to high rewards.
    """
    
    def __init__(
        self,
        model: nn.Module,
        learning_rate: float = None,
        discount_factor: float = None,
    ):
        self.model = model
        self.lr = learning_rate or rl_config.learning_rate
        self.gamma = discount_factor or rl_config.discount_factor
        
        self.optimizer = optim.Adam(model.parameters(), lr=self.lr)
        
        logger.info(f"PolicyGradient initialized: lr={self.lr}, gamma={self.gamma}")
    
    def compute_returns(
        self, 
        rewards: List[float],
        normalize: bool = True
    ) -> torch.Tensor:
        """
        Compute discounted returns for a sequence of rewards.
        
        Args:
            rewards: List of rewards
            normalize: Whether to normalize returns
            
        Returns:
            Tensor of discounted returns
        """
        returns = []
        R = 0
        
        # Compute returns in reverse
        for r in reversed(rewards):
            R = r + self.gamma * R
            returns.insert(0, R)
        
        returns = torch.tensor(returns, dtype=torch.float32)
        
        if normalize and len(returns) > 1:
            returns = (returns - returns.mean()) / (returns.std() + 1e-8)
        
        return returns
    
    def update(
        self,
        experiences: List[Experience],
        log_probs: Optional[torch.Tensor] = None
    ) -> PolicyUpdateResult:
        """
        Perform policy gradient update.
        
        Args:
            experiences: List of experiences from one or more episodes
            log_probs: Pre-computed log probabilities (optional)
            
        Returns:
            PolicyUpdateResult with loss and gradient info
        """
        self.model.train()
        
        # Extract rewards
        rewards = [exp.reward for exp in experiences]
        returns = self.compute_returns(rewards)
        
        # If log_probs not provided, we need to recompute
        # This assumes model outputs can be used to get log probs
        if log_probs is None:
            # Simple case: use model forward pass
            log_probs = self._compute_log_probs(experiences)
        
        # Policy gradient loss: -log_prob * return
        policy_loss = -(log_probs * returns).mean()
        
        # Backward pass
        self.optimizer.zero_grad()
        policy_loss.backward()
        
        # Gradient clipping
        grad_norm = torch.nn.utils.clip_grad_norm_(
            self.model.parameters(),
            rl_config.max_gradient_norm
        )
        
        self.optimizer.step()
        
        return PolicyUpdateResult(
            loss=policy_loss.item(),
            gradient_norm=grad_norm.item() if isinstance(grad_norm, torch.Tensor) else grad_norm,
            steps=len(experiences),
        )
    
    def _compute_log_probs(self, experiences: List[Experience]) -> torch.Tensor:
        """
        Compute log probabilities for actions in experiences.
        
        This is a simplified version - actual implementation depends
        on model architecture.
        """
        log_probs = []
        
        for exp in experiences:
            # Get model output for state
            state_tensor = torch.tensor(
                Experience._flatten_dict(exp.state),
                dtype=torch.float32
            ).unsqueeze(0)
            
            with torch.no_grad():
                output = self.model(state_tensor)
            
            # Assuming output is logits, compute log softmax
            log_prob = F.log_softmax(output, dim=-1)
            
            # Get log prob of actual action
            action_idx = exp.action.get("predicted_idx", 0)
            log_probs.append(log_prob[0, action_idx])
        
        return torch.stack(log_probs)


class PPO:
    """
    Proximal Policy Optimization implementation.
    
    More stable than vanilla policy gradient with clipped objective.
    """
    
    def __init__(
        self,
        model: nn.Module,
        learning_rate: float = None,
        clip_ratio: float = None,
        epochs: int = None,
    ):
        self.model = model
        self.lr = learning_rate or rl_config.learning_rate
        self.clip_ratio = clip_ratio or rl_config.ppo_clip_ratio
        self.epochs = epochs or rl_config.ppo_epochs
        
        self.optimizer = optim.Adam(model.parameters(), lr=self.lr)
        
        logger.info(
            f"PPO initialized: lr={self.lr}, clip={self.clip_ratio}, epochs={self.epochs}"
        )
    
    def update(
        self,
        experiences: List[Experience],
        old_log_probs: torch.Tensor,
        advantages: torch.Tensor,
    ) -> PolicyUpdateResult:
        """
        Perform PPO update with clipped objective.
        
        Args:
            experiences: Batch of experiences
            old_log_probs: Log probs from behavior policy
            advantages: Computed advantages
            
        Returns:
            PolicyUpdateResult
        """
        self.model.train()
        
        total_loss = 0.0
        total_entropy = 0.0
        total_kl = 0.0
        
        for epoch in range(self.epochs):
            # Compute new log probs
            new_log_probs = self._compute_log_probs(experiences)
            
            # Ratio for importance sampling
            ratio = torch.exp(new_log_probs - old_log_probs)
            
            # Clipped objective
            clipped_ratio = torch.clamp(
                ratio,
                1 - self.clip_ratio,
                1 + self.clip_ratio
            )
            
            # PPO loss
            policy_loss = -torch.min(
                ratio * advantages,
                clipped_ratio * advantages
            ).mean()
            
            # Entropy bonus for exploration
            entropy = -(new_log_probs * torch.exp(new_log_probs)).mean()
            entropy_bonus = 0.01 * entropy
            
            # Total loss
            loss = policy_loss - entropy_bonus
            
            # KL divergence for monitoring
            kl = (old_log_probs - new_log_probs).mean()
            
            # Update
            self.optimizer.zero_grad()
            loss.backward()
            
            grad_norm = torch.nn.utils.clip_grad_norm_(
                self.model.parameters(),
                rl_config.max_gradient_norm
            )
            
            self.optimizer.step()
            
            total_loss += loss.item()
            total_entropy += entropy.item()
            total_kl += kl.item()
            
            # Early stopping if KL divergence too large
            if kl.item() > 0.02:
                logger.warning(f"Early stopping at epoch {epoch} due to large KL: {kl.item():.4f}")
                break
        
        return PolicyUpdateResult(
            loss=total_loss / self.epochs,
            gradient_norm=grad_norm.item() if isinstance(grad_norm, torch.Tensor) else grad_norm,
            steps=len(experiences),
            entropy=total_entropy / self.epochs,
            kl_divergence=total_kl / self.epochs,
        )
    
    def _compute_log_probs(self, experiences: List[Experience]) -> torch.Tensor:
        """Compute log probabilities"""
        log_probs = []
        
        for exp in experiences:
            state_tensor = torch.tensor(
                Experience._flatten_dict(exp.state),
                dtype=torch.float32
            ).unsqueeze(0)
            
            output = self.model(state_tensor)
            log_prob = F.log_softmax(output, dim=-1)
            
            action_idx = exp.action.get("predicted_idx", 0)
            log_probs.append(log_prob[0, action_idx])
        
        return torch.stack(log_probs)


class ActorCritic:
    """
    Actor-Critic implementation with value function baseline.
    
    Reduces variance in policy gradient updates.
    """
    
    def __init__(
        self,
        actor: nn.Module,
        critic: nn.Module,
        actor_lr: float = None,
        critic_lr: float = None,
    ):
        self.actor = actor
        self.critic = critic
        
        actor_lr = actor_lr or rl_config.learning_rate
        critic_lr = critic_lr or rl_config.learning_rate * 2
        
        self.actor_optimizer = optim.Adam(actor.parameters(), lr=actor_lr)
        self.critic_optimizer = optim.Adam(critic.parameters(), lr=critic_lr)
        
        logger.info(f"ActorCritic initialized: actor_lr={actor_lr}, critic_lr={critic_lr}")
    
    def compute_advantages(
        self,
        experiences: List[Experience],
        gamma: float = None
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Compute advantages using value function.
        
        Returns:
            Tuple of (advantages, returns)
        """
        gamma = gamma or rl_config.discount_factor
        
        values = []
        for exp in experiences:
            state_tensor = torch.tensor(
                Experience._flatten_dict(exp.state),
                dtype=torch.float32
            ).unsqueeze(0)
            
            with torch.no_grad():
                value = self.critic(state_tensor)
            values.append(value.item())
        
        # Compute returns and advantages
        returns = []
        advantages = []
        R = 0
        
        for i in reversed(range(len(experiences))):
            R = experiences[i].reward + gamma * R
            returns.insert(0, R)
            advantages.insert(0, R - values[i])
        
        returns = torch.tensor(returns, dtype=torch.float32)
        advantages = torch.tensor(advantages, dtype=torch.float32)
        
        # Normalize advantages
        advantages = (advantages - advantages.mean()) / (advantages.std() + 1e-8)
        
        return advantages, returns
    
    def update(self, experiences: List[Experience]) -> PolicyUpdateResult:
        """
        Perform actor-critic update.
        """
        self.actor.train()
        self.critic.train()
        
        advantages, returns = self.compute_advantages(experiences)
        
        # Update critic
        critic_loss = 0
        for i, exp in enumerate(experiences):
            state_tensor = torch.tensor(
                Experience._flatten_dict(exp.state),
                dtype=torch.float32
            ).unsqueeze(0)
            
            value = self.critic(state_tensor)
            critic_loss += F.mse_loss(value.squeeze(), returns[i:i+1])
        
        critic_loss = critic_loss / len(experiences)
        
        self.critic_optimizer.zero_grad()
        critic_loss.backward()
        self.critic_optimizer.step()
        
        # Update actor
        log_probs = []
        for exp in experiences:
            state_tensor = torch.tensor(
                Experience._flatten_dict(exp.state),
                dtype=torch.float32
            ).unsqueeze(0)
            
            output = self.actor(state_tensor)
            log_prob = F.log_softmax(output, dim=-1)
            action_idx = exp.action.get("predicted_idx", 0)
            log_probs.append(log_prob[0, action_idx])
        
        log_probs = torch.stack(log_probs)
        actor_loss = -(log_probs * advantages).mean()
        
        self.actor_optimizer.zero_grad()
        actor_loss.backward()
        
        grad_norm = torch.nn.utils.clip_grad_norm_(
            self.actor.parameters(),
            rl_config.max_gradient_norm
        )
        
        self.actor_optimizer.step()
        
        return PolicyUpdateResult(
            loss=actor_loss.item(),
            gradient_norm=grad_norm.item() if isinstance(grad_norm, torch.Tensor) else grad_norm,
            steps=len(experiences),
        )


def get_policy_updater(
    model: nn.Module,
    strategy: UpdateStrategy = None,
    **kwargs
):
    """
    Factory function to get appropriate policy updater.
    
    Args:
        model: The policy model to update
        strategy: Update strategy (from config if not specified)
        **kwargs: Additional arguments for specific updater
        
    Returns:
        Policy updater instance
    """
    strategy = strategy or rl_config.update_strategy
    
    if strategy == UpdateStrategy.REINFORCE:
        return PolicyGradient(model, **kwargs)
    elif strategy == UpdateStrategy.PPO:
        return PPO(model, **kwargs)
    elif strategy == UpdateStrategy.ACTOR_CRITIC:
        raise ValueError("ActorCritic requires both actor and critic models")
    else:
        raise ValueError(f"Unknown update strategy: {strategy}")

