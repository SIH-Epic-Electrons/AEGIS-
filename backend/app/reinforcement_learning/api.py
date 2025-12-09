"""
Reinforcement Learning API Endpoints

Provides endpoints for:
- Submitting enhanced feedback (matching 11-outcome-feedback.html)
- Viewing training status
- Triggering manual training
- Viewing feedback statistics
"""

import logging
from typing import Annotated, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.postgresql import get_db
from app.models.officer import Officer
from app.models.ai_prediction import AIPrediction
from app.core.auth import get_current_officer

from app.reinforcement_learning.config import rl_config
from app.reinforcement_learning.feedback.schemas import (
    FeedbackCreate,
    OutcomeFeedback,
    FeedbackStats,
    PredictionAccuracy,
    InterventionResult,
)
from app.reinforcement_learning.feedback.storage import get_feedback_storage
from app.reinforcement_learning.feedback.reward import get_reward_calculator
from app.reinforcement_learning.training.trainer import (
    get_rl_trainer,
    TrainingResult,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rl", tags=["Reinforcement Learning"])


# ============================================================
# FEEDBACK ENDPOINTS
# ============================================================

@router.post(
    "/feedback/{prediction_id}",
    summary="Submit Enhanced Feedback",
    description="""
    Submit detailed feedback for an AI prediction.
    
    **This is the primary endpoint for the 11-outcome-feedback.html screen.**
    
    **Feedback Components:**
    - Prediction accuracy (Exact Match, Nearby, Different, Unknown)
    - Intervention result (Apprehended, Recovered, Both, Unsuccessful)
    - Amount recovered
    - Actual location (if different)
    - Time accuracy
    - Mule detection accuracy
    - Additional notes
    
    **How Feedback Improves AI:**
    - Feedback is converted to rewards using shaped reward function
    - Experiences are stored in replay buffer
    - Model weights are updated periodically using policy gradient
    - This enables continuous learning from real-world outcomes
    """,
    response_model=dict,
)
async def submit_enhanced_feedback(
    prediction_id: UUID,
    feedback: FeedbackCreate,
    background_tasks: BackgroundTasks,
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    db: AsyncSession = Depends(get_db),
):
    """
    Submit enhanced feedback for an AI prediction.
    
    This feedback is used to:
    1. Calculate rewards for reinforcement learning
    2. Store experiences for training
    3. Update model performance metrics
    4. Improve future predictions
    """
    # Get prediction
    result = await db.execute(
        select(AIPrediction).where(AIPrediction.id == prediction_id)
    )
    prediction = result.scalar_one_or_none()
    
    if not prediction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prediction not found"
        )
    
    # Calculate reward
    reward_calculator = get_reward_calculator()
    reward, breakdown = reward_calculator.calculate_reward(
        feedback,
        prediction_confidence=prediction.confidence_score
    )
    
    # Store feedback
    feedback_storage = get_feedback_storage()
    record = await feedback_storage.store_feedback(
        prediction_id=prediction_id,
        case_id=prediction.case_id,
        officer_id=current_officer.id,
        feedback=feedback,
        model_version=prediction.model_version or "v1.0",
        state_features=prediction.input_features,
        action_taken=prediction.prediction_output,
        prediction_confidence=prediction.confidence_score,
    )
    
    # Update prediction record with feedback
    prediction.was_correct = feedback.prediction_accuracy in [
        PredictionAccuracy.EXACT_MATCH,
        PredictionAccuracy.NEARBY
    ]
    prediction.actual_outcome = {
        "accuracy": feedback.prediction_accuracy.value,
        "result": feedback.intervention_result.value,
        "amount_recovered": feedback.amount_recovered,
        "actual_location": feedback.actual_location,
        "notes": feedback.notes,
        "reward": reward,
    }
    prediction.feedback_timestamp = datetime.utcnow()
    
    await db.commit()
    
    # Process outcome for display
    outcome = OutcomeFeedback.from_feedback(feedback)
    
    # Schedule training check in background
    background_tasks.add_task(_check_and_train, prediction.model_name)
    
    logger.info(
        f"Enhanced feedback submitted: prediction={prediction_id}, "
        f"accuracy={feedback.prediction_accuracy.value}, reward={reward:.2f}"
    )
    
    return {
        "success": True,
        "data": {
            "message": "Thank you! Your feedback helps AEGIS learn and improve.",
            "prediction_id": str(prediction_id),
            "feedback_id": str(record.id),
            "reward_calculated": round(reward, 2),
            "reward_breakdown": breakdown.to_dict(),
            "outcome_summary": {
                "location_accuracy": outcome.location_accuracy_display,
                "recovery_rate": f"{outcome.recovery_rate * 100:.1f}%" if outcome.recovery_rate else "N/A",
                "overall_score": f"{outcome.overall_success_score * 100:.1f}%",
            },
            "ai_improvement_note": (
                "This feedback will be used to train the AI model. "
                f"Current buffer has {feedback_storage.buffer_size} samples."
            )
        }
    }


async def _check_and_train(model_name: str):
    """Background task to check if training should occur"""
    try:
        trainer = get_rl_trainer(model_name)
        result = await trainer.maybe_update()
        if result and result.success:
            logger.info(f"Background training completed: {result.updates_performed} updates")
    except Exception as e:
        logger.error(f"Background training failed: {e}")


# ============================================================
# TRAINING ENDPOINTS
# ============================================================

@router.post(
    "/train/{model_name}",
    summary="Trigger Training",
    description="""
    Manually trigger a training step for a model.
    
    **Admin only endpoint.**
    
    **Models:**
    - `cst_transformer`: Location prediction model
    - `mule_detector_gnn`: Mule account detection model
    """,
    response_model=dict,
)
async def trigger_training(
    model_name: str,
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    num_steps: int = 1,
):
    """
    Manually trigger training for a model.
    
    Requires admin privileges.
    """
    if model_name not in ["cst_transformer", "mule_detector_gnn"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown model: {model_name}"
        )
    
    trainer = get_rl_trainer(model_name)
    
    if trainer.model is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Model {model_name} not loaded. Initialize models first."
        )
    
    try:
        if num_steps == 1:
            result = await trainer.train_step()
        else:
            result = await trainer.train_epoch(num_steps)
        
        return {
            "success": result.success,
            "data": {
                "model_name": model_name,
                "samples_used": result.num_samples,
                "loss": round(result.total_loss, 4),
                "average_reward": round(result.average_reward, 2),
                "updates": result.updates_performed,
                "duration_seconds": round(result.duration_seconds, 2),
                "checkpoint": result.checkpoint_path,
            }
        }
    except Exception as e:
        logger.error(f"Training failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Training failed: {str(e)}"
        )


@router.get(
    "/status/{model_name}",
    summary="Get Training Status",
    description="Get current training status and statistics for a model.",
    response_model=dict,
)
async def get_training_status(
    model_name: str,
    current_officer: Annotated[Officer, Depends(get_current_officer)],
):
    """Get training status for a model."""
    trainer = get_rl_trainer(model_name)
    stats = trainer.get_training_stats()
    
    return {
        "success": True,
        "data": {
            "model_name": stats["model_name"],
            "model_version": stats["model_version"],
            "is_ready": trainer.model is not None,
            "is_training": stats["is_training"],
            "total_updates": stats["update_count"],
            "buffer_size": stats["buffer_size"],
            "min_samples_needed": rl_config.min_samples_for_update,
            "ready_for_update": stats["buffer_size"] >= rl_config.min_samples_for_update,
            "metrics": {
                "average_loss": round(stats["average_loss"], 4),
                "average_reward": round(stats["average_reward"], 2),
                "recent_losses": [round(l, 4) for l in stats["recent_losses"]],
                "recent_rewards": [round(r, 2) for r in stats["recent_rewards"]],
            }
        }
    }


# ============================================================
# STATISTICS ENDPOINTS
# ============================================================

@router.get(
    "/stats",
    summary="Get Feedback Statistics",
    description="""
    Get aggregated feedback statistics.
    
    **Useful for:**
    - Monitoring model accuracy over time
    - Identifying areas for improvement
    - Dashboard analytics
    """,
    response_model=dict,
)
async def get_feedback_stats(
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    days: int = 30,
):
    """Get feedback statistics for the last N days."""
    storage = get_feedback_storage()
    stats = await storage.get_statistics(days=days)
    
    return {
        "success": True,
        "data": {
            "period_days": days,
            "total_feedback": stats.total_feedback,
            
            "accuracy_distribution": {
                "exact_match": stats.exact_match_count,
                "nearby": stats.nearby_count,
                "different": stats.different_count,
                "unknown": stats.unknown_count,
            },
            
            "outcome_distribution": {
                "apprehended": stats.apprehended_count,
                "recovered": stats.recovered_count,
                "both": stats.both_count,
                "unsuccessful": stats.unsuccessful_count,
            },
            
            "metrics": {
                "average_location_accuracy": f"{stats.average_location_accuracy * 100:.1f}%",
                "average_recovery_rate": f"{stats.average_recovery_rate * 100:.1f}%",
                "average_reward": round(stats.average_reward, 2),
            },
            
            "time_range": {
                "from": stats.from_date.isoformat() if stats.from_date else None,
                "to": stats.to_date.isoformat() if stats.to_date else None,
            }
        }
    }


@router.get(
    "/config",
    summary="Get RL Configuration",
    description="Get current RL system configuration.",
    response_model=dict,
)
async def get_rl_config_endpoint(
    current_officer: Annotated[Officer, Depends(get_current_officer)],
):
    """Get RL configuration."""
    return {
        "success": True,
        "data": {
            "enabled": rl_config.enabled,
            "reward_strategy": rl_config.reward_strategy.value,
            "update_strategy": rl_config.update_strategy.value,
            "update_frequency": rl_config.update_frequency,
            "min_samples_for_update": rl_config.min_samples_for_update,
            "batch_size": rl_config.batch_size,
            "learning_rate": rl_config.learning_rate,
            "reward_weights": {
                "exact_match": rl_config.location_exact_match_reward,
                "nearby": rl_config.location_nearby_reward,
                "different": rl_config.location_different_penalty,
                "apprehension": rl_config.apprehension_reward,
                "recovery": rl_config.recovery_reward,
            }
        }
    }


# ============================================================
# HEALTH ENDPOINT
# ============================================================

@router.get(
    "/health",
    summary="RL System Health",
    description="Check health of RL system.",
    response_model=dict,
)
async def rl_health():
    """Check RL system health."""
    cst_trainer = get_rl_trainer("cst_transformer")
    gnn_trainer = get_rl_trainer("mule_detector_gnn")
    storage = get_feedback_storage()
    
    return {
        "success": True,
        "data": {
            "rl_enabled": rl_config.enabled,
            "models": {
                "cst_transformer": {
                    "loaded": cst_trainer.model is not None,
                    "update_count": cst_trainer._update_count,
                },
                "mule_detector_gnn": {
                    "loaded": gnn_trainer.model is not None,
                    "update_count": gnn_trainer._update_count,
                }
            },
            "feedback_buffer_size": storage.buffer_size,
            "ready_for_training": storage.should_update_model(),
        }
    }

