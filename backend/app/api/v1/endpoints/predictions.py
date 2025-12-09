"""
AI Prediction Endpoints
"""

import logging
from typing import Annotated, Dict, List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.postgresql import get_db
from app.models.officer import Officer
from app.models.case import Case
from app.models.ai_prediction import AIPrediction
from app.api.v1.endpoints.auth import get_current_officer
from app.services import get_cst_predictor, map_fraud_type
from app.services.city_state_mapper import get_state_from_city

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/case/{case_id}",
    summary="Get AI Predictions for Case",
    description="""
    Get AI prediction details for a case.
    
    **Returns:**
    - Location predictions (CST Transformer)
    - Time window predictions
    - Confidence scores
    - Alternative locations
    
    **Models Used:**
    - CST-Transformer: Predicts ATM withdrawal location
    - Mode: ATM (with victim location) or Area (without location)
    
    **Storage:**
    - Predictions stored in `ai_predictions` table
    - Can be retrieved for feedback and model improvement
    """
)
async def get_case_prediction(
    case_id: UUID,
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    db: AsyncSession = Depends(get_db)
):
    """
    Get AI prediction details for a case.
    
    Returns detailed analysis including:
    - Location prediction with confidence
    - Time window prediction
    - Mule network analysis
    - Risk assessment
    - Explainability factors
    """
    # Get case
    result = await db.execute(
        select(Case).where(Case.id == case_id)
    )
    case = result.scalar_one_or_none()
    
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found"
        )
    
    # Get AI predictions for this case (from background task)
    result = await db.execute(
        select(AIPrediction)
        .where(AIPrediction.case_id == case_id)
        .order_by(AIPrediction.created_at.desc())
    )
    predictions = result.scalars().all()
    
    # If no prediction record exists yet (background task still running),
    # we'll generate prediction in real-time and return it
    # The prediction_id will be null until background task completes
    
    # Get CST model prediction
    cst_predictor = get_cst_predictor()
    
    if not cst_predictor.loaded:
        logger.error(f"CST model not loaded for case {case_id}. Model must be loaded for predictions.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CST prediction model is not available. Please ensure the model is loaded at startup."
        )
    
    # Determine if we have victim location
    has_location = case.victim_lat is not None and case.victim_lon is not None
    
    try:
        # Map fraud type (Case enum -> CST model type)
        cst_fraud_type = map_fraud_type(case.fraud_type)
        
        # Get state from city if not set
        victim_state = case.victim_state or get_state_from_city(case.victim_city)
        
        if has_location:
            # ATM Mode: Predict specific ATMs using victim location
            logger.info(f"Using CST model for case {case_id}: ATM mode with location ({case.victim_lat}, {case.victim_lon})")
            
            # Get top 3 most probable ATMs
            cst_result = cst_predictor.predict_atm_withdrawal(
                victim_lat=case.victim_lat,
                victim_lon=case.victim_lon,
                victim_state=victim_state,
                fraud_type=cst_fraud_type,
                top_k=3  # Get top 3 most probable
            )
            
            logger.info(f"CST model returned {len(cst_result.get('predictions', []))} predictions for case {case_id}")
            
            # Sort by confidence (highest first) and get top 3
            sorted_predictions = sorted(
                cst_result["predictions"],
                key=lambda x: x.get("confidence", 0),
                reverse=True
            )[:3]
            
            # Format primary prediction (highest probability)
            primary = sorted_predictions[0] if sorted_predictions else None
            alternatives = sorted_predictions[1:3] if len(sorted_predictions) > 1 else []
            
            if primary:
                logger.info(f"Primary CST prediction for case {case_id}: {primary.get('name')} (confidence: {primary.get('confidence')}%)")
            
            location_prediction = {
                "primary": {
                    "atm_id": primary.get("atm_id") if primary else None,
                    "name": primary.get("name") if primary else None,
                    "address": primary.get("address") if primary else None,
                    "lat": primary.get("lat") if primary else None,
                    "lon": primary.get("lon") if primary else None,
                    "confidence": primary.get("confidence", 0) / 100.0 if primary else 0,
                    "distance_km": primary.get("distance_km") if primary else None,
                    "bank": primary.get("bank") if primary else None,
                    "city": primary.get("city") if primary else None,
                },
                "alternatives": [
                    {
                        "name": alt.get("name"),
                        "bank": alt.get("bank"),
                        "city": alt.get("city"),
                        "address": alt.get("address", ""),
                        "lat": alt.get("lat"),
                        "lon": alt.get("lon"),
                        "confidence": alt.get("confidence", 0) / 100.0,
                        "distance_km": alt.get("distance_km")
                    }
                    for alt in alternatives
                ]
            }
        else:
            # Area Mode: Predict general area (no location available)
            logger.info(f"Using CST model for case {case_id}: AREA mode (no victim location)")
            
            cst_result = cst_predictor.predict_area_withdrawal(
                victim_state=victim_state,
                fraud_type=cst_fraud_type
            )
            
            pred = cst_result["prediction"]
            logger.info(f"CST area prediction for case {case_id}: ({pred['lat']}, {pred['lon']}) confidence: {pred['confidence']}%")
            
            location_prediction = {
                "primary": {
                    "lat": pred["lat"],
                    "lon": pred["lon"],
                    "confidence": pred["confidence"] / 100.0,
                    "mode": "AREA"
                },
                "alternatives": []
            }
        
        # Construct response
        return {
            "success": True,
            "data": {
                "case_id": str(case_id),
                "prediction_id": str(predictions[0].id) if predictions else None,
                
                "location_prediction": location_prediction,
                
                "time_prediction": {
                    "window_start": case.predicted_time_start.isoformat() if case.predicted_time_start else None,
                    "window_end": case.predicted_time_end.isoformat() if case.predicted_time_end else None,
                    "confidence": location_prediction["primary"].get("confidence", 0)
                },
                
                "model_info": {
                    "model_name": cst_result.get("model_info", {}).get("name", "CST-Transformer"),
                    "version": cst_result.get("model_info", {}).get("version", "v1.0"),
                    "mode": cst_result.get("mode", "ATM"),
                    "cst_model_used": True  # Flag to indicate CST model was used
                }
            }
        }
        
        # Store prediction on blockchain (async, non-blocking)
        try:
            from app.services.blockchain_service import get_blockchain_service
            from app.core.config import settings
            
            if settings.blockchain_enabled:
                blockchain_service = get_blockchain_service()
                
                # Format top 3 ATM locations
                top3_locations = []
                if has_location and sorted_predictions:
                    for idx, pred in enumerate(sorted_predictions[:3], 1):
                        top3_locations.append({
                            "rank": idx,
                            "atm_id": pred.get("atm_id", ""),
                            "name": pred.get("name", ""),
                            "address": pred.get("address", ""),
                            "lat": pred.get("lat"),
                            "lon": pred.get("lon"),
                            "bank": pred.get("bank", ""),
                            "city": pred.get("city", ""),
                            "distance_km": pred.get("distance_km"),
                            "confidence": pred.get("confidence", 0)
                        })
                
                # Format confidence scores
                primary_confidence = location_prediction["primary"].get("confidence", 0)
                alternative_confidences = [
                    alt.get("confidence", 0) 
                    for alt in location_prediction.get("alternatives", [])
                ]
                
                confidence_scores = {
                    "primary": primary_confidence,
                    "alternatives": alternative_confidences,
                    "overall": primary_confidence
                }
                
                # Store on blockchain (async, non-blocking but with monitoring)
                import asyncio
                from datetime import datetime
                
                logger.info(f"🚀 [BLOCKCHAIN] Initiating blockchain storage for case {case_id}")
                logger.info(f"📋 [BLOCKCHAIN] Prediction data prepared: {len(top3_locations)} locations")
                
                # Create task with error handling
                async def store_with_monitoring():
                    try:
                        result = await blockchain_service.store_prediction(
                            case_id=case_id,
                            top3_atm_locations=top3_locations,
                            confidence_scores=confidence_scores,
                            time_window={
                                "window_start": case.predicted_time_start.isoformat() if case.predicted_time_start else None,
                                "window_end": case.predicted_time_end.isoformat() if case.predicted_time_end else None,
                                "confidence": primary_confidence
                            },
                            model_info={
                                "model_name": cst_result.get("model_info", {}).get("name", "CST-Transformer"),
                                "version": cst_result.get("model_info", {}).get("version", "v1.0"),
                                "mode": cst_result.get("mode", "ATM")
                            }
                        )
                        if result:
                            logger.info(f"✅ [BLOCKCHAIN] Storage completed successfully for case {case_id}")
                        else:
                            logger.warning(f"⚠️  [BLOCKCHAIN] Storage returned False for case {case_id}")
                    except Exception as store_error:
                        logger.error(f"❌ [BLOCKCHAIN] Storage failed for case {case_id}: {store_error}", exc_info=True)
                
                asyncio.create_task(store_with_monitoring())
                logger.info(f"⏳ [BLOCKCHAIN] Blockchain storage task queued for case {case_id}")
        except Exception as e:
            # Non-critical error - don't fail the request
            logger.warning(f"Failed to queue blockchain storage (non-critical): {e}")
    
    except Exception as e:
        logger.error(f"Error in CST prediction for case {case_id}: {e}", exc_info=True)
        # Don't fallback to hardcoded values - raise error instead
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"CST prediction failed: {str(e)}"
        )


@router.post(
    "/feedback/{prediction_id}",
    summary="Submit Prediction Feedback (Simple)",
    description="""
    Submit simple feedback on AI prediction accuracy.
    
    **Note:** For detailed feedback with intervention results and recovery info,
    use the enhanced endpoint at `POST /api/v1/rl/feedback/{prediction_id}`.
    
    **Purpose:**
    - Track prediction accuracy
    - Improve models through feedback
    - Store actual outcomes for training
    
    **Feedback Types:**
    - `was_correct`: Whether prediction was accurate
    - `actual_outcome`: Actual result (for model improvement)
    
    **Used For:**
    - Model performance tracking
    - Continuous learning
    - Accuracy metrics
    """
)
async def submit_prediction_feedback(
    prediction_id: UUID,
    feedback: dict,
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    db: AsyncSession = Depends(get_db)
):
    """
    Submit simple feedback for an AI prediction.
    
    For detailed feedback (accuracy type, intervention result, recovery amount),
    use POST /api/v1/rl/feedback/{prediction_id} instead.
    
    Request body:
    - was_correct: bool - Was the prediction accurate?
    - actual_location: Optional ATM ID where withdrawal actually happened
    - notes: Optional feedback notes
    """
    result = await db.execute(
        select(AIPrediction).where(AIPrediction.id == prediction_id)
    )
    prediction = result.scalar_one_or_none()
    
    if not prediction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prediction not found"
        )
    
    # Update prediction with feedback
    prediction.was_correct = feedback.get("was_correct")
    prediction.actual_outcome = {
        "actual_location": feedback.get("actual_location"),
        "notes": feedback.get("notes")
    }
    
    from datetime import datetime
    prediction.feedback_timestamp = datetime.utcnow()
    
    await db.commit()
    
    return {
        "success": True,
        "data": {
            "message": "Feedback recorded. Thank you for helping improve AEGIS!",
            "prediction_id": str(prediction_id),
            "tip": "For detailed feedback with rewards calculation, use POST /api/v1/rl/feedback/{prediction_id}",
            "rl_feedback_endpoint": f"/api/v1/rl/feedback/{prediction_id}",
            "rl_stats_endpoint": "/api/v1/rl/stats"
        }
    }


@router.get(
    "/blockchain/{case_id}",
    summary="Get Prediction from Blockchain",
    description="""
    Retrieve prediction data from Hyperledger Fabric blockchain.
    
    **Returns:**
    - Complete prediction data stored on blockchain
    - Top 3 ATM locations
    - Confidence scores
    - Time window predictions
    - Model information
    - Timestamp
    
    **Note:** Requires blockchain to be enabled in configuration.
    """
)
async def get_prediction_from_blockchain(
    case_id: UUID,
    current_officer: Annotated[Officer, Depends(get_current_officer)],
):
    """Retrieve prediction data from blockchain"""
    from app.services.blockchain_service import get_blockchain_service
    from app.core.config import settings
    
    if not settings.blockchain_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Blockchain is not enabled. Set BLOCKCHAIN_ENABLED=true in environment variables."
        )
    
    try:
        blockchain_service = get_blockchain_service()
        prediction = await blockchain_service.get_prediction(case_id)
        
        if not prediction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Prediction for case {case_id} not found on blockchain"
            )
        
        return prediction
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving prediction from blockchain: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve prediction from blockchain: {str(e)}"
        )


@router.get(
    "/blockchain/query/date-range",
    summary="Query Predictions by Date Range",
    description="""
    Query predictions from blockchain within a date range.
    
    **Parameters:**
    - start_date: Start date (ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ)
    - end_date: End date (ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ)
    
    **Returns:**
    - List of predictions within the date range
    """
)
async def query_predictions_by_date_range(
    start_date: str = Query(..., description="Start date in ISO format (e.g., 2025-01-01T00:00:00Z)"),
    end_date: str = Query(..., description="End date in ISO format (e.g., 2025-12-31T23:59:59Z)"),
    current_officer: Annotated[Officer, Depends(get_current_officer)],
):
    """Query predictions from blockchain by date range"""
    from app.services.blockchain_service import get_blockchain_service
    from app.core.config import settings
    
    if not settings.blockchain_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Blockchain is not enabled. Set BLOCKCHAIN_ENABLED=true in environment variables."
        )
    
    try:
        # Parse dates
        try:
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid date format: {str(e)}. Use ISO format (e.g., 2025-01-01T00:00:00Z)"
            )
        
        blockchain_service = get_blockchain_service()
        predictions = await blockchain_service.query_by_date_range(start_dt, end_dt)
        
        return {
            "count": len(predictions),
            "start_date": start_date,
            "end_date": end_date,
            "predictions": predictions
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying predictions by date range: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to query predictions: {str(e)}"
        )


@router.get(
    "/blockchain/{case_id}/history",
    summary="Get Prediction History from Blockchain",
    description="""
    Get complete history of a prediction (all versions) from blockchain.
    
    **Returns:**
    - List of all versions of the prediction
    - Shows how prediction was updated over time
    - Includes timestamps for each version
    """
)
async def get_prediction_history_from_blockchain(
    case_id: UUID,
    current_officer: Annotated[Officer, Depends(get_current_officer)],
):
    """Get complete history of a prediction from blockchain"""
    from app.services.blockchain_service import get_blockchain_service
    from app.core.config import settings
    
    if not settings.blockchain_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Blockchain is not enabled. Set BLOCKCHAIN_ENABLED=true in environment variables."
        )
    
    try:
        blockchain_service = get_blockchain_service()
        history = await blockchain_service.get_prediction_history(case_id)
        
        if not history:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No history found for case {case_id} on blockchain"
            )
        
        return {
            "case_id": str(case_id),
            "version_count": len(history),
            "history": history
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving prediction history: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve prediction history: {str(e)}"
        )

