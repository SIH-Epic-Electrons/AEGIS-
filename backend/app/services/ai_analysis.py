"""
AI Analysis Service - Handles async AI predictions for cases.

This service:
1. Runs CST Transformer predictions
2. Saves predictions to database
3. Updates case with predicted locations
"""

import logging
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.case import Case, CaseStatus, FraudType
from app.models.ai_prediction import AIPrediction
from app.models.atm import ATM
from app.services.cst_predictor import get_cst_predictor
from app.services.city_state_mapper import get_state_from_city
from app.db.postgresql import get_db

logger = logging.getLogger(__name__)


# Fraud type mapping: Case.FraudType -> CST Model fraud types
FRAUD_TYPE_MAPPING = {
    FraudType.OTP_FRAUD: "OTP_PHISHING",
    FraudType.VISHING: "OTP_PHISHING",  # Similar to OTP fraud
    FraudType.PHISHING: "OTP_PHISHING",  # Similar to OTP fraud
    FraudType.INVESTMENT_FRAUD: "INVESTMENT_SCAM",
    FraudType.LOAN_FRAUD: "LOAN_APP_FRAUD",
    FraudType.KYC_FRAUD: "KYC_UPDATE_FRAUD",
    FraudType.CARD_FRAUD: "OTP_PHISHING",  # Default to OTP
    FraudType.UPI_FRAUD: "OTP_PHISHING",  # Default to OTP
    FraudType.OTHER: "OTP_PHISHING",  # Default fallback
}


def map_fraud_type(case_fraud_type: Optional[str]) -> str:
    """Map Case fraud type to CST model fraud type."""
    if not case_fraud_type:
        return "OTP_PHISHING"
    
    try:
        fraud_enum = FraudType(case_fraud_type)
        return FRAUD_TYPE_MAPPING.get(fraud_enum, "OTP_PHISHING")
    except ValueError:
        # If not a valid enum, try direct mapping
        return case_fraud_type.upper().replace("_FRAUD", "_SCAM").replace("_", "_")


async def analyze_case_ai(case_id: UUID, db: AsyncSession) -> dict:
    """
    Run AI analysis for a case.
    
    This function:
    1. Gets case details
    2. Runs CST Transformer prediction
    3. Saves prediction to database
    4. Updates case with predicted ATM/location
    
    Args:
        case_id: UUID of the case
        db: Database session
    
    Returns:
        dict with analysis results
    """
    try:
        # Get case
        result = await db.execute(
            select(Case).where(Case.id == case_id)
        )
        case = result.scalar_one_or_none()
        
        if not case:
            logger.error(f"Case {case_id} not found")
            return {"success": False, "error": "Case not found"}
        
        # Update status to analyzing
        case.status = CaseStatus.AI_ANALYZING.value
        await db.commit()
        
        # Get CST predictor
        cst_predictor = get_cst_predictor()
        
        if not cst_predictor.loaded:
            logger.error("CST model not loaded")
            case.status = CaseStatus.NEW.value
            await db.commit()
            return {"success": False, "error": "AI model not available"}
        
        # Map fraud type
        cst_fraud_type = map_fraud_type(case.fraud_type)
        
        # Determine mode and get prediction
        has_location = case.victim_lat is not None and case.victim_lon is not None
        
        # Get state from city if not set
        victim_state = case.victim_state or get_state_from_city(case.victim_city)
        
        if has_location:
            # ATM Mode - Predict specific ATMs using victim location
            # Get top 3 most probable ATMs
            prediction_result = cst_predictor.predict_atm_withdrawal(
                victim_lat=case.victim_lat,
                victim_lon=case.victim_lon,
                victim_state=victim_state,
                fraud_type=cst_fraud_type,
                top_k=3  # Get top 3 most probable
            )
            
            # Sort by confidence (highest first) and get top 3
            sorted_predictions = sorted(
                prediction_result["predictions"],
                key=lambda x: x.get("confidence", 0),
                reverse=True
            )[:3]
            
            # Get primary prediction (highest probability)
            primary = sorted_predictions[0] if sorted_predictions else None
            
            if primary:
                # Try to find ATM by coordinates (more reliable than ID)
                lat = primary.get("lat", 0)
                lon = primary.get("lon", 0)
                if lat and lon:
                    atm_result = await db.execute(
                        select(ATM).where(
                            (ATM.latitude.between(lat - 0.001, lat + 0.001)) &
                            (ATM.longitude.between(lon - 0.001, lon + 0.001))
                        )
                    )
                    atm = atm_result.scalar_one_or_none()
                else:
                    atm = None
                
                if not atm:
                    # Create ATM record if doesn't exist
                    atm = ATM(
                        atm_id=f"CST-{primary.get('atm_id', 'UNKNOWN')}",
                        name=primary.get("name", "Unknown ATM"),
                        bank_name=primary.get("bank", "Unknown"),
                        city=primary.get("city", "Unknown"),
                        state=primary.get("state", "Unknown"),
                        address=primary.get("address", ""),
                        latitude=primary.get("lat") or 0.0,
                        longitude=primary.get("lon") or 0.0,
                    )
                    db.add(atm)
                    await db.flush()
                
                # Update case with prediction
                if atm:
                    case.predicted_atm_id = atm.id
                
                # Store confidence (even if zero, we have a prediction)
                confidence_value = primary.get("confidence", 0) / 100.0
                case.location_confidence = confidence_value
                
                # Log confidence for debugging
                logger.info(
                    f"ATM prediction for case {case_id}: {atm.name if atm else 'None'} "
                    f"(Confidence: {confidence_value:.2%})"
                )
                
                # Store alternative predictions as JSON (top 3, sorted by confidence)
                alternatives = sorted_predictions[1:3] if len(sorted_predictions) > 1 else []
                case.alternative_predictions = [
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
                
                # Estimate time window (typically 30-90 minutes after fraud)
                if case.complaint_timestamp:
                    time_since_fraud = (datetime.utcnow() - case.complaint_timestamp).total_seconds() / 60
                    estimated_withdrawal_minutes = 45 + time_since_fraud
                    case.predicted_time_start = datetime.utcnow() + timedelta(minutes=int(estimated_withdrawal_minutes - 15))
                    case.predicted_time_end = datetime.utcnow() + timedelta(minutes=int(estimated_withdrawal_minutes + 45))
        else:
            # Area Mode (no location) - Predict general area
            prediction_result = cst_predictor.predict_area_withdrawal(
                victim_state=victim_state,
                fraud_type=cst_fraud_type
            )
            
            pred = prediction_result["prediction"]
            case.location_confidence = pred.get("confidence", 0) / 100.0
            
            # Store area prediction
            case.alternative_predictions = [{
                "mode": "AREA",
                "lat": pred["lat"],
                "lon": pred["lon"],
                "confidence": pred["confidence"] / 100.0
            }]
        
        # Save AI prediction record
        ai_prediction = AIPrediction(
            case_id=case_id,
            model_name="CST-Transformer",
            model_version="v1.0",
            input_features={
                "victim_lat": case.victim_lat,
                "victim_lon": case.victim_lon,
                "victim_state": case.victim_state,
                "fraud_type": case.fraud_type,
                "fraud_amount": case.fraud_amount,
            },
            prediction_output={
                "mode": prediction_result.get("mode", "ATM"),
                "predictions": prediction_result.get("predictions", []),
            },
            confidence_score=case.location_confidence or 0.0,
        )
        db.add(ai_prediction)
        
        # Update case status
        case.status = CaseStatus.IN_PROGRESS.value
        await db.commit()
        
        logger.info(f"AI analysis completed for case {case_id}")
        
        return {
            "success": True,
            "case_id": str(case_id),
            "prediction_mode": prediction_result.get("mode", "ATM"),
            "confidence": case.location_confidence,
        }
        
    except Exception as e:
        logger.error(f"AI analysis failed for case {case_id}: {e}", exc_info=True)
        
        # Reset case status on error
        try:
            result = await db.execute(select(Case).where(Case.id == case_id))
            case = result.scalar_one_or_none()
            if case:
                case.status = CaseStatus.NEW.value
                await db.commit()
        except:
            pass
        
        return {"success": False, "error": str(e)}


async def trigger_ai_analysis(case_id: UUID):
    """
    Trigger AI analysis asynchronously.
    
    This is a wrapper that gets a new DB session for the background task.
    """
    from app.db.postgresql import AsyncSessionLocal
    
    async with AsyncSessionLocal() as db:
        try:
            result = await analyze_case_ai(case_id, db)
            return result
        except Exception as e:
            logger.error(f"Background AI analysis failed: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

