"""
AI Prediction Endpoints
"""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
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
    case_id: str,
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
    # Try to parse as UUID first, if fails, try case_number
    try:
        case_uuid = UUID(case_id)
        case_query = select(Case).where(Case.id == case_uuid)
    except ValueError:
        # Not a valid UUID, try case_number
        case_query = select(Case).where(Case.case_number == case_id)
    
    result = await db.execute(case_query)
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
            
            # If address is missing, try reverse geocoding
            if primary and not primary.get("address") and primary.get("lat") and primary.get("lon"):
                from app.services.geocoding_service import get_geocoding_service
                geocoder = get_geocoding_service()
                geocode_result = await geocoder.reverse_geocode(
                    primary.get("lat"),
                    primary.get("lon")
                )
                if geocode_result:
                    primary["address"] = geocode_result.get("address") or geocode_result.get("formatted_address")
                    primary["city"] = geocode_result.get("city", primary.get("city"))
                    primary["state"] = geocode_result.get("state", primary.get("state"))
            
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

