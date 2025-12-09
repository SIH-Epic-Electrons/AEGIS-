"""
Reinforcement Learning Demo Script

Simulates the full RL training loop:
1. Generate simulated feedback (as if officers submitted it)
2. Calculate rewards
3. Store experiences
4. Train model with policy gradient
5. Show improvement over time

This demonstrates how the model improves from officer feedback.
"""

import sys
import os
import asyncio
import argparse
import logging
import random
from datetime import datetime, timedelta
from uuid import uuid4
from typing import List, Dict, Any

import torch
import torch.nn as nn

# Add parent to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.reinforcement_learning.config import rl_config
from app.reinforcement_learning.feedback.schemas import (
    FeedbackCreate,
    PredictionAccuracy,
    InterventionResult,
)
from app.reinforcement_learning.feedback.reward import get_reward_calculator
from app.reinforcement_learning.feedback.storage import FeedbackStorage
from app.reinforcement_learning.training.experience_buffer import Experience
from app.reinforcement_learning.training.trainer import RLTrainer

# Try to import actual models
try:
    from app.ml.models.cst_transformer import CSTTransformer
    HAS_CST_MODEL = True
except ImportError:
    HAS_CST_MODEL = False

try:
    from app.ml.models.mule_detector_gnn import MuleDetectorGNN
    HAS_GNN_MODEL = True
except ImportError:
    HAS_GNN_MODEL = False

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SimpleRLModel(nn.Module):
    """
    Simple model for RL demo when actual models aren't available.
    Mimics the output structure of CST Transformer.
    """
    def __init__(self, input_dim: int = 8, num_classes: int = 100):
        super().__init__()
        self.network = nn.Sequential(
            nn.Linear(input_dim, 256),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, num_classes)
        )
    
    def forward(self, x):
        return self.network(x)


def generate_random_feedback(
    accuracy_weights: Dict[PredictionAccuracy, float] = None,
    outcome_weights: Dict[InterventionResult, float] = None,
) -> FeedbackCreate:
    """
    Generate random feedback simulating officer submissions.
    
    Args:
        accuracy_weights: Probability weights for each accuracy type
        outcome_weights: Probability weights for each outcome type
    """
    # Default weights (more realistic distribution)
    if accuracy_weights is None:
        accuracy_weights = {
            PredictionAccuracy.EXACT_MATCH: 0.35,  # 35% exact
            PredictionAccuracy.NEARBY: 0.30,       # 30% nearby
            PredictionAccuracy.DIFFERENT: 0.25,    # 25% wrong
            PredictionAccuracy.UNKNOWN: 0.10,      # 10% unknown
        }
    
    if outcome_weights is None:
        outcome_weights = {
            InterventionResult.BOTH: 0.20,
            InterventionResult.SUSPECT_APPREHENDED: 0.25,
            InterventionResult.MONEY_RECOVERED: 0.30,
            InterventionResult.UNSUCCESSFUL: 0.25,
        }
    
    # Random selection based on weights
    accuracy = random.choices(
        list(accuracy_weights.keys()),
        weights=list(accuracy_weights.values())
    )[0]
    
    outcome = random.choices(
        list(outcome_weights.keys()),
        weights=list(outcome_weights.values())
    )[0]
    
    # Generate realistic amounts
    total_amount = random.randint(50000, 500000)
    
    # Recovery rate depends on outcome
    if outcome == InterventionResult.BOTH:
        recovery_rate = random.uniform(0.7, 1.0)
    elif outcome == InterventionResult.MONEY_RECOVERED:
        recovery_rate = random.uniform(0.5, 0.9)
    elif outcome == InterventionResult.SUSPECT_APPREHENDED:
        recovery_rate = random.uniform(0.2, 0.5)
    else:
        recovery_rate = random.uniform(0, 0.2)
    
    recovered = int(total_amount * recovery_rate)
    
    # Time accuracy correlates with location accuracy
    time_accurate = None
    if accuracy in [PredictionAccuracy.EXACT_MATCH, PredictionAccuracy.NEARBY]:
        time_accurate = random.random() < 0.8  # 80% accurate if location was good
    elif accuracy == PredictionAccuracy.DIFFERENT:
        time_accurate = random.random() < 0.3  # Only 30% if location was wrong
    
    # Mule detection accuracy
    mule_accurate = None
    if random.random() < 0.7:  # 70% of the time we have this info
        mule_accurate = random.random() < 0.75  # 75% accurate
    
    return FeedbackCreate(
        prediction_accuracy=accuracy,
        intervention_result=outcome,
        amount_recovered=recovered if recovered > 0 else None,
        total_fraud_amount=total_amount,
        time_prediction_accurate=time_accurate,
        mule_detection_accurate=mule_accurate,
        notes=f"Simulated feedback for demo - {accuracy.value}"
    )


def generate_state_features() -> Dict[str, Any]:
    """Generate random state features simulating model input"""
    return {
        "hour": random.randint(0, 23),
        "day": random.randint(0, 6),
        "month": random.randint(1, 12),
        "fraud_type": random.randint(0, 4),
        "amount": random.randint(10000, 500000),
        "state_idx": random.randint(0, 14),
        "victim_lat": 18.5 + random.random() * 10,
        "victim_lon": 72.8 + random.random() * 10,
    }


def generate_action(confidence: float = None) -> Dict[str, Any]:
    """Generate random action (model prediction)"""
    if confidence is None:
        confidence = random.uniform(0.5, 0.95)
    
    return {
        "predicted_idx": random.randint(0, 99),
        "confidence": confidence,
        "predicted_lat": 18.5 + random.random() * 10,
        "predicted_lon": 72.8 + random.random() * 10,
    }


async def run_rl_demo(
    num_episodes: int = 100,
    batch_size: int = 32,
    num_updates: int = 10,
    model_type: str = "simple",
    learning_rate: float = 0.001,
):
    """
    Run RL training demo.
    
    Args:
        num_episodes: Number of feedback samples to generate
        batch_size: Training batch size
        num_updates: Number of model updates
        model_type: "simple", "cst", or "gnn"
        learning_rate: Learning rate for training
    """
    logger.info("=" * 60)
    logger.info("AEGIS REINFORCEMENT LEARNING DEMO")
    logger.info("=" * 60)
    logger.info(f"Configuration:")
    logger.info(f"  - Episodes (feedback samples): {num_episodes}")
    logger.info(f"  - Batch size: {batch_size}")
    logger.info(f"  - Model updates: {num_updates}")
    logger.info(f"  - Model type: {model_type}")
    logger.info(f"  - Learning rate: {learning_rate}")
    logger.info("=" * 60)
    
    # Initialize model
    if model_type == "cst" and HAS_CST_MODEL:
        logger.info("Loading CST Transformer model...")
        model = CSTTransformer(num_states=15)
        
        # Try to load pre-trained weights
        cst_path = rl_config.absolute_cst_path
        if cst_path.exists():
            checkpoint = torch.load(cst_path, map_location="cpu")
            model.load_state_dict(checkpoint["model_state_dict"])
            logger.info(f"Loaded pre-trained weights from {cst_path}")
    elif model_type == "gnn" and HAS_GNN_MODEL:
        logger.info("Loading GNN Mule Detector model...")
        model = MuleDetectorGNN(input_dim=31)
        
        gnn_path = rl_config.absolute_gnn_path
        if gnn_path.exists():
            checkpoint = torch.load(gnn_path, map_location="cpu")
            model.load_state_dict(checkpoint["model_state_dict"])
            logger.info(f"Loaded pre-trained weights from {gnn_path}")
    else:
        logger.info("Using simple demo model...")
        model = SimpleRLModel(input_dim=8, num_classes=100)
    
    # Initialize trainer
    trainer = RLTrainer(model=model, model_name=model_type)
    trainer.set_model(model, version="v1.0-rl-demo")
    
    # Override learning rate
    if trainer._policy_updater:
        trainer._policy_updater.lr = learning_rate
        trainer._policy_updater.optimizer = torch.optim.Adam(
            model.parameters(), lr=learning_rate
        )
    
    reward_calculator = get_reward_calculator()
    
    # Phase 1: Generate feedback and experiences
    logger.info("")
    logger.info("=" * 60)
    logger.info("PHASE 1: Generating Simulated Feedback")
    logger.info("=" * 60)
    
    total_reward = 0
    accuracy_counts = {acc: 0 for acc in PredictionAccuracy}
    outcome_counts = {out: 0 for out in InterventionResult}
    
    for i in range(num_episodes):
        # Generate feedback
        feedback = generate_random_feedback()
        state = generate_state_features()
        action = generate_action()
        
        # Calculate reward
        reward, breakdown = reward_calculator.calculate_reward(
            feedback, prediction_confidence=action["confidence"]
        )
        
        # Create experience
        exp = Experience(
            state=state,
            action=action,
            reward=reward,
            model_name=model_type,
            prediction_confidence=action["confidence"],
        )
        
        # Add to trainer buffer
        trainer._experience_buffer.add(exp)
        
        total_reward += reward
        accuracy_counts[feedback.prediction_accuracy] += 1
        outcome_counts[feedback.intervention_result] += 1
        
        if (i + 1) % 20 == 0:
            logger.info(f"  Generated {i + 1}/{num_episodes} feedback samples")
    
    avg_reward = total_reward / num_episodes
    logger.info(f"\nFeedback Generation Complete:")
    logger.info(f"  - Total samples: {num_episodes}")
    logger.info(f"  - Average reward: {avg_reward:.2f}")
    logger.info(f"  - Buffer size: {len(trainer._experience_buffer)}")
    
    logger.info(f"\nAccuracy Distribution:")
    for acc, count in accuracy_counts.items():
        pct = count / num_episodes * 100
        logger.info(f"  - {acc.value}: {count} ({pct:.1f}%)")
    
    logger.info(f"\nOutcome Distribution:")
    for out, count in outcome_counts.items():
        pct = count / num_episodes * 100
        logger.info(f"  - {out.value}: {count} ({pct:.1f}%)")
    
    # Phase 2: Train model
    logger.info("")
    logger.info("=" * 60)
    logger.info("PHASE 2: Training Model with Policy Gradient")
    logger.info("=" * 60)
    
    training_history = []
    
    for update in range(num_updates):
        # Sample batch
        if hasattr(trainer._experience_buffer, 'sample'):
            if hasattr(trainer._experience_buffer, '_priorities'):
                experiences, weights, indices = trainer._experience_buffer.sample(batch_size)
            else:
                experiences = trainer._experience_buffer.sample(batch_size)
        else:
            experiences = list(trainer._experience_buffer._buffer)[-batch_size:]
        
        # Calculate batch metrics
        batch_rewards = [exp.reward for exp in experiences]
        avg_batch_reward = sum(batch_rewards) / len(batch_rewards)
        
        # Simulate training loss (in real training, this would be from policy gradient)
        # For demo, we'll compute a proxy loss
        model.train()
        
        # Forward pass - handle different model types
        batch_size_actual = len(experiences)
        
        if model_type == "cst" and HAS_CST_MODEL:
            # CST model requires specific inputs: coords, hour, day, month, fraud_type, state
            coords = torch.randn(batch_size_actual, 2) * 5 + torch.tensor([20.0, 75.0])  # India-ish coords
            hour = torch.randint(0, 24, (batch_size_actual,))
            day = torch.randint(0, 7, (batch_size_actual,))
            month = torch.randint(0, 12, (batch_size_actual,))  # 0-11 for embedding
            fraud_type = torch.randint(0, 5, (batch_size_actual,))
            state = torch.randint(0, 15, (batch_size_actual,))
            model_output = model(coords, hour, day, month, fraud_type, state)
            output = model_output["atm_logits"]  # Use ATM logits for training
        elif model_type == "gnn" and HAS_GNN_MODEL:
            # GNN model requires graph data - use simple forward
            dummy_input = torch.randn(batch_size_actual, 31)
            output = model.node_encoder(dummy_input)
        else:
            # Simple model
            dummy_input = torch.randn(batch_size_actual, 8)
            output = model(dummy_input)
        
        # Compute loss (simplified for demo)
        rewards_tensor = torch.tensor(batch_rewards, dtype=torch.float32)
        normalized_rewards = (rewards_tensor - rewards_tensor.mean()) / (rewards_tensor.std() + 1e-8)
        
        # Log softmax for policy gradient
        log_probs = torch.log_softmax(output, dim=-1)
        selected_log_probs = log_probs[range(len(experiences)), 
                                        [exp.action.get("predicted_idx", 0) % output.shape[1] 
                                         for exp in experiences]]
        
        # Policy gradient loss
        loss = -(selected_log_probs * normalized_rewards).mean()
        
        # Backward pass
        if trainer._policy_updater:
            trainer._policy_updater.optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 0.5)
            trainer._policy_updater.optimizer.step()
        
        training_history.append({
            "update": update + 1,
            "loss": loss.item(),
            "avg_reward": avg_batch_reward,
            "batch_size": len(experiences),
        })
        
        logger.info(
            f"  Update {update + 1}/{num_updates}: "
            f"Loss={loss.item():.4f}, Avg Reward={avg_batch_reward:.2f}"
        )
    
    # Phase 3: Results Summary
    logger.info("")
    logger.info("=" * 60)
    logger.info("TRAINING RESULTS SUMMARY")
    logger.info("=" * 60)
    
    if training_history:
        initial_loss = training_history[0]["loss"]
        final_loss = training_history[-1]["loss"]
        loss_improvement = initial_loss - final_loss
        
        logger.info(f"Training Progress:")
        for h in training_history:
            logger.info(
                f"  Update {h['update']:3d} | Loss: {h['loss']:.4f} | "
                f"Reward: {h['avg_reward']:+.2f}"
            )
        
        logger.info(f"\n" + "-" * 60)
        logger.info(f"Initial Loss: {initial_loss:.4f}")
        logger.info(f"Final Loss: {final_loss:.4f}")
        logger.info(f"Loss Improvement: {loss_improvement:.4f}")
        logger.info(f"Total Updates: {num_updates}")
        logger.info(f"Total Samples Used: {num_updates * batch_size}")
    
    # Demonstrate what happens with good vs bad feedback
    logger.info("")
    logger.info("=" * 60)
    logger.info("REWARD EXAMPLES (How Feedback Affects Learning)")
    logger.info("=" * 60)
    
    examples = [
        ("Best Case", FeedbackCreate(
            prediction_accuracy=PredictionAccuracy.EXACT_MATCH,
            intervention_result=InterventionResult.BOTH,
            amount_recovered=350000,
            total_fraud_amount=350000,
        )),
        ("Good Case", FeedbackCreate(
            prediction_accuracy=PredictionAccuracy.NEARBY,
            intervention_result=InterventionResult.SUSPECT_APPREHENDED,
            amount_recovered=200000,
            total_fraud_amount=350000,
        )),
        ("Average Case", FeedbackCreate(
            prediction_accuracy=PredictionAccuracy.NEARBY,
            intervention_result=InterventionResult.MONEY_RECOVERED,
            amount_recovered=150000,
            total_fraud_amount=350000,
        )),
        ("Poor Case", FeedbackCreate(
            prediction_accuracy=PredictionAccuracy.DIFFERENT,
            intervention_result=InterventionResult.UNSUCCESSFUL,
        )),
    ]
    
    for name, fb in examples:
        reward, _ = reward_calculator.calculate_reward(fb)
        logger.info(f"\n{name}:")
        logger.info(f"  Accuracy: {fb.prediction_accuracy.value}")
        logger.info(f"  Outcome: {fb.intervention_result.value}")
        logger.info(f"  Reward: {reward:+.2f} {'✓' if reward > 0 else '✗'}")
    
    logger.info("")
    logger.info("=" * 60)
    logger.info("RL DEMO COMPLETE")
    logger.info("=" * 60)
    logger.info("""
Key Takeaways:
1. Officer feedback is converted to numerical rewards
2. Positive rewards (good predictions) → Model weights adjusted to repeat
3. Negative rewards (bad predictions) → Model learns to avoid
4. Over time, model improves from real-world outcomes

In Production:
- Officers submit feedback via /api/v1/rl/feedback/{prediction_id}
- System automatically calculates rewards
- Training happens in background when buffer is full
- Model continuously improves! 🎯
""")
    
    return training_history


def main():
    parser = argparse.ArgumentParser(description="Run RL Training Demo")
    parser.add_argument(
        "--episodes", type=int, default=100,
        help="Number of feedback episodes to simulate"
    )
    parser.add_argument(
        "--batch-size", type=int, default=32,
        help="Training batch size"
    )
    parser.add_argument(
        "--updates", type=int, default=10,
        help="Number of model updates"
    )
    parser.add_argument(
        "--model", choices=["simple", "cst", "gnn"], default="simple",
        help="Model to train"
    )
    parser.add_argument(
        "--lr", type=float, default=0.001,
        help="Learning rate"
    )
    
    args = parser.parse_args()
    
    asyncio.run(run_rl_demo(
        num_episodes=args.episodes,
        batch_size=args.batch_size,
        num_updates=args.updates,
        model_type=args.model,
        learning_rate=args.lr,
    ))


if __name__ == "__main__":
    main()

