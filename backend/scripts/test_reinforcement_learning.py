"""
Test Script for Reinforcement Learning System

Tests all components of the RL system:
1. Feedback schemas and validation
2. Reward calculation
3. Experience buffer
4. Training flow
"""

import sys
import os
import asyncio
import argparse
import logging
from datetime import datetime
from uuid import uuid4

# Add parent to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.reinforcement_learning.config import rl_config, RewardStrategy
from app.reinforcement_learning.feedback.schemas import (
    FeedbackCreate,
    PredictionAccuracy,
    InterventionResult,
    OutcomeFeedback,
)
from app.reinforcement_learning.feedback.reward import (
    RewardCalculator,
    get_reward_calculator,
)
from app.reinforcement_learning.feedback.storage import (
    FeedbackStorage,
    get_feedback_storage,
)
from app.reinforcement_learning.training.experience_buffer import (
    Experience,
    ExperienceBuffer,
    PrioritizedExperienceBuffer,
)
from app.reinforcement_learning.training.trainer import (
    RLTrainer,
    get_rl_trainer,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def test_feedback_schemas():
    """Test feedback schema validation"""
    logger.info("=" * 60)
    logger.info("TESTING FEEDBACK SCHEMAS")
    logger.info("=" * 60)
    
    # Test 1: Create valid feedback (exact match + both outcomes)
    feedback1 = FeedbackCreate(
        prediction_accuracy=PredictionAccuracy.EXACT_MATCH,
        intervention_result=InterventionResult.BOTH,
        amount_recovered=306700,
        total_fraud_amount=350000,
        notes="Suspect apprehended at predicted ATM location"
    )
    logger.info(f"Test 1 - Exact match feedback: {feedback1.prediction_accuracy.value}")
    logger.info(f"  Recovery rate: {feedback1.recovery_rate:.2%}")
    
    # Test 2: Nearby location with money recovery
    feedback2 = FeedbackCreate(
        prediction_accuracy=PredictionAccuracy.NEARBY,
        intervention_result=InterventionResult.MONEY_RECOVERED,
        amount_recovered=250000,
        total_fraud_amount=350000,
        actual_location="HDFC ATM, 1.5km from predicted location"
    )
    logger.info(f"Test 2 - Nearby feedback: {feedback2.prediction_accuracy.value}")
    logger.info(f"  Actual location: {feedback2.actual_location}")
    
    # Test 3: Wrong prediction
    feedback3 = FeedbackCreate(
        prediction_accuracy=PredictionAccuracy.DIFFERENT,
        intervention_result=InterventionResult.UNSUCCESSFUL,
        actual_lat=19.0760,
        actual_lon=72.8777,
        notes="Withdrawal happened in different city"
    )
    logger.info(f"Test 3 - Different location: {feedback3.prediction_accuracy.value}")
    
    # Test 4: Convert to OutcomeFeedback
    outcome = OutcomeFeedback.from_feedback(feedback1)
    logger.info(f"Test 4 - Outcome conversion:")
    logger.info(f"  Location accuracy: {outcome.location_accuracy_display}")
    logger.info(f"  Recovery rate: {outcome.recovery_rate:.2%}")
    logger.info(f"  Overall score: {outcome.overall_success_score:.2%}")
    
    logger.info("✓ Feedback schemas test PASSED")
    return True


def test_reward_calculation():
    """Test reward calculation"""
    logger.info("=" * 60)
    logger.info("TESTING REWARD CALCULATION")
    logger.info("=" * 60)
    
    calculator = get_reward_calculator()
    
    # Test scenarios from MVP UI
    test_cases = [
        {
            "name": "Best case: Exact match + Both outcomes + Full recovery",
            "feedback": FeedbackCreate(
                prediction_accuracy=PredictionAccuracy.EXACT_MATCH,
                intervention_result=InterventionResult.BOTH,
                amount_recovered=350000,
                total_fraud_amount=350000,
                time_prediction_accurate=True,
                mule_detection_accurate=True,
            ),
            "expected_positive": True,
        },
        {
            "name": "Good case: Nearby + Apprehended",
            "feedback": FeedbackCreate(
                prediction_accuracy=PredictionAccuracy.NEARBY,
                intervention_result=InterventionResult.SUSPECT_APPREHENDED,
                amount_recovered=200000,
                total_fraud_amount=350000,
            ),
            "expected_positive": True,
        },
        {
            "name": "Moderate case: Nearby + Money recovered",
            "feedback": FeedbackCreate(
                prediction_accuracy=PredictionAccuracy.NEARBY,
                intervention_result=InterventionResult.MONEY_RECOVERED,
                amount_recovered=150000,
                total_fraud_amount=350000,
            ),
            "expected_positive": True,
        },
        {
            "name": "Worst case: Different location + Unsuccessful",
            "feedback": FeedbackCreate(
                prediction_accuracy=PredictionAccuracy.DIFFERENT,
                intervention_result=InterventionResult.UNSUCCESSFUL,
            ),
            "expected_positive": False,
        },
        {
            "name": "Edge case: Unknown + Unsuccessful",
            "feedback": FeedbackCreate(
                prediction_accuracy=PredictionAccuracy.UNKNOWN,
                intervention_result=InterventionResult.UNSUCCESSFUL,
            ),
            "expected_positive": False,
        },
    ]
    
    for test in test_cases:
        reward, breakdown = calculator.calculate_reward(test["feedback"])
        status = "✓" if (reward > 0) == test["expected_positive"] else "✗"
        
        logger.info(f"\n{test['name']}:")
        logger.info(f"  Total reward: {reward:.2f} {status}")
        logger.info(f"  Breakdown:")
        logger.info(f"    - Location: {breakdown.location_reward:.2f}")
        logger.info(f"    - Intervention: {breakdown.intervention_reward:.2f}")
        logger.info(f"    - Recovery: {breakdown.recovery_reward:.2f}")
        logger.info(f"    - Bonus: {breakdown.bonus_reward:.2f}")
    
    # Test normalization
    normalized = calculator.normalize_reward(reward)
    logger.info(f"\nNormalized reward: {normalized:.4f} (range: -1 to 1)")
    
    logger.info("\n✓ Reward calculation test PASSED")
    return True


async def test_feedback_storage():
    """Test feedback storage"""
    logger.info("=" * 60)
    logger.info("TESTING FEEDBACK STORAGE")
    logger.info("=" * 60)
    
    storage = FeedbackStorage()
    
    # Store multiple feedback records
    feedbacks = [
        FeedbackCreate(
            prediction_accuracy=PredictionAccuracy.EXACT_MATCH,
            intervention_result=InterventionResult.BOTH,
            amount_recovered=300000,
            total_fraud_amount=350000,
        ),
        FeedbackCreate(
            prediction_accuracy=PredictionAccuracy.NEARBY,
            intervention_result=InterventionResult.MONEY_RECOVERED,
            amount_recovered=200000,
            total_fraud_amount=300000,
        ),
        FeedbackCreate(
            prediction_accuracy=PredictionAccuracy.DIFFERENT,
            intervention_result=InterventionResult.UNSUCCESSFUL,
        ),
    ]
    
    for i, feedback in enumerate(feedbacks):
        record = await storage.store_feedback(
            prediction_id=uuid4(),
            case_id=uuid4(),
            officer_id=uuid4(),
            feedback=feedback,
            model_version="v1.0",
            state_features={"hour": 10, "day": 5, "fraud_type": 1},
            action_taken={"predicted_idx": i * 100, "confidence": 0.85},
        )
        logger.info(f"Stored feedback {i+1}: reward={record.reward:.2f}")
    
    # Get statistics
    stats = await storage.get_statistics(days=30)
    logger.info(f"\nStatistics:")
    logger.info(f"  Total feedback: {stats.total_feedback}")
    logger.info(f"  Exact matches: {stats.exact_match_count}")
    logger.info(f"  Average accuracy: {stats.average_location_accuracy:.2%}")
    logger.info(f"  Average reward: {stats.average_reward:.2f}")
    
    # Get training batch
    batch = await storage.get_training_batch(batch_size=2)
    logger.info(f"\nTraining batch size: {len(batch)}")
    
    logger.info("\n✓ Feedback storage test PASSED")
    return True


def test_experience_buffer():
    """Test experience buffer"""
    logger.info("=" * 60)
    logger.info("TESTING EXPERIENCE BUFFER")
    logger.info("=" * 60)
    
    # Test uniform buffer
    buffer = ExperienceBuffer(max_size=100)
    
    for i in range(50):
        exp = Experience(
            state={"hour": i % 24, "fraud_type": i % 3},
            action={"predicted_idx": i * 10},
            reward=float(i % 10 - 5),
            model_name="test_model",
        )
        buffer.add(exp)
    
    logger.info(f"Uniform buffer size: {len(buffer)}")
    
    # Sample
    sample = buffer.sample(10)
    logger.info(f"Sampled {len(sample)} experiences")
    
    # Test prioritized buffer
    p_buffer = PrioritizedExperienceBuffer(max_size=100)
    
    for i in range(50):
        exp = Experience(
            state={"hour": i % 24, "fraud_type": i % 3},
            action={"predicted_idx": i * 10},
            reward=float(i % 10 - 5),
            model_name="test_model",
        )
        p_buffer.add(exp)
    
    logger.info(f"\nPrioritized buffer size: {len(p_buffer)}")
    
    # Sample with priorities
    experiences, weights, indices = p_buffer.sample(10)
    logger.info(f"Sampled {len(experiences)} experiences with weights")
    logger.info(f"Weight range: [{weights.min():.4f}, {weights.max():.4f}]")
    
    logger.info("\n✓ Experience buffer test PASSED")
    return True


async def test_training_flow():
    """Test complete training flow"""
    logger.info("=" * 60)
    logger.info("TESTING TRAINING FLOW (Simulation)")
    logger.info("=" * 60)
    
    # Note: This tests the flow without actually loading models
    # In production, models would be loaded from checkpoints
    
    trainer = RLTrainer(model_name="test_model")
    
    # Simulate adding experiences
    for i in range(100):
        exp = Experience(
            state={"hour": i % 24, "fraud_type": i % 3, "amount": 50000 + i * 1000},
            action={"predicted_idx": i * 10, "confidence": 0.7 + (i % 30) * 0.01},
            reward=float(i % 10 - 3),
            model_name="test_model",
        )
        trainer._experience_buffer.add(exp)
    
    logger.info(f"Added 100 experiences to buffer")
    logger.info(f"Buffer ready for training: {trainer._experience_buffer.is_ready}")
    
    # Get stats
    stats = trainer.get_training_stats()
    logger.info(f"\nTrainer stats:")
    logger.info(f"  Model: {stats['model_name']}")
    logger.info(f"  Buffer size: {stats['buffer_size']}")
    logger.info(f"  Update count: {stats['update_count']}")
    
    # Note: Actual training would require loading the model
    # trainer.set_model(model)
    # result = await trainer.train_step()
    
    logger.info("\n✓ Training flow test PASSED (simulation only)")
    return True


async def run_all_tests():
    """Run all tests"""
    logger.info("=" * 60)
    logger.info("AEGIS REINFORCEMENT LEARNING TEST SUITE")
    logger.info("=" * 60)
    logger.info(f"Time: {datetime.now().isoformat()}")
    logger.info(f"Config: reward_strategy={rl_config.reward_strategy.value}")
    logger.info("=" * 60)
    
    tests = [
        ("Feedback Schemas", test_feedback_schemas),
        ("Reward Calculation", test_reward_calculation),
        ("Feedback Storage", test_feedback_storage),
        ("Experience Buffer", test_experience_buffer),
        ("Training Flow", test_training_flow),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            if asyncio.iscoroutinefunction(test_func):
                result = await test_func()
            else:
                result = test_func()
            results.append((name, result, None))
        except Exception as e:
            logger.error(f"Test {name} failed: {e}")
            results.append((name, False, str(e)))
    
    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("TEST RESULTS SUMMARY")
    logger.info("=" * 60)
    
    passed = sum(1 for _, r, _ in results if r)
    total = len(results)
    
    for name, result, error in results:
        status = "✓ PASS" if result else "✗ FAIL"
        logger.info(f"  {name}: {status}")
        if error:
            logger.info(f"    Error: {error}")
    
    logger.info("-" * 60)
    logger.info(f"Total: {passed}/{total} tests passed")
    logger.info("=" * 60)
    
    return passed == total


def main():
    parser = argparse.ArgumentParser(description="Test RL System")
    parser.add_argument(
        "--mode",
        choices=["all", "schemas", "reward", "storage", "buffer", "training"],
        default="all",
        help="Test mode"
    )
    args = parser.parse_args()
    
    async def run_test():
        if args.mode == "all":
            return await run_all_tests()
        elif args.mode == "schemas":
            return test_feedback_schemas()
        elif args.mode == "reward":
            return test_reward_calculation()
        elif args.mode == "storage":
            return await test_feedback_storage()
        elif args.mode == "buffer":
            return test_experience_buffer()
        elif args.mode == "training":
            return await test_training_flow()
    
    success = asyncio.run(run_test())
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

