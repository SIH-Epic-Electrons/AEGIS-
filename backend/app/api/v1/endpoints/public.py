"""
Public Endpoints - No Authentication Required
For citizen-facing features like NCRP complaint submission
"""

import logging
from typing import Optional, Dict
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, Field

from app.db.postgresql import get_db
from app.models.case import Case, CaseStatus, CasePriority, FraudType
from app.services.ai_analysis import trigger_ai_analysis
from app.services.city_state_mapper import get_state_from_city
from app.services.money_trace_service import trace_money_flow_and_detect_mules

logger = logging.getLogger(__name__)
router = APIRouter()


class DestinationAccount(BaseModel):
    account_number: str = Field(..., min_length=8, max_length=20)
    bank_name: str = Field(..., min_length=2)
    ifsc_code: str = Field(..., pattern=r"^[A-Z]{4}0[A-Z0-9]{6}$|^UNKNOWN$")
    upi_id: Optional[str] = None


class VictimInfo(BaseModel):
    name: str = Field(..., min_length=2)
    phone: str = Field(..., pattern=r"^\+?[0-9]{10,13}$")
    email: Optional[str] = None
    city: str = Field(..., min_length=2)
    location: Optional[Dict[str, float]] = None  # {lat, lon}


class NCRPComplaintCreate(BaseModel):
    """NCRP Complaint Schema - Public submission"""
    ncrp_complaint_id: str = Field(..., min_length=5)
    fraud_type: FraudType
    fraud_amount: float = Field(..., gt=0)
    fraud_description: Optional[str] = None
    fraud_timestamp: Optional[datetime] = None
    destination_account: DestinationAccount
    victim: VictimInfo


@router.post("/ncrp/complaints", response_model=dict, status_code=status.HTTP_201_CREATED)
async def submit_ncrp_complaint(
    complaint: NCRPComplaintCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Submit a new fraud complaint from NCRP Portal (Public - No Auth Required).
    
    This endpoint is for citizens to report cyber fraud.
    The complaint is automatically:
    1. Registered as a new case
    2. Queued for AI analysis
    3. Made available to LEA officers
    
    Returns:
    - case_id: UUID for tracking
    - case_number: Human-readable reference number
    - status: Initial status (NEW)
    - message: Confirmation message
    """
    # Generate unique case number using max existing case number
    today = datetime.utcnow()
    year_prefix = f"MH-{today.year}-"
    
    # Get the highest case number for this year
    result = await db.execute(
        select(func.max(Case.case_number)).where(
            Case.case_number.like(f"{year_prefix}%")
        )
    )
    max_case_number = result.scalar()
    
    if max_case_number:
        # Extract the number part and increment
        try:
            last_num = int(max_case_number.split('-')[-1])
            next_num = last_num + 1
        except (ValueError, IndexError):
            next_num = 1
    else:
        next_num = 1
    
    case_number = f"{year_prefix}{next_num:05d}"
    
    # Determine priority based on amount
    if complaint.fraud_amount >= 500000:
        priority = CasePriority.CRITICAL
    elif complaint.fraud_amount >= 100000:
        priority = CasePriority.HIGH
    elif complaint.fraud_amount >= 25000:
        priority = CasePriority.MEDIUM
    else:
        priority = CasePriority.LOW
    
    # Create case
    case = Case(
        case_number=case_number,
        status=CaseStatus.NEW,
        priority=priority,
        
        # Complaint details
        ncrp_complaint_id=complaint.ncrp_complaint_id,
        fraud_type=complaint.fraud_type,
        fraud_amount=complaint.fraud_amount,
        fraud_description=complaint.fraud_description,
        complaint_timestamp=complaint.fraud_timestamp or datetime.utcnow(),
        
        # Destination account (CRITICAL - where victim's money went)
        destination_account=complaint.destination_account.account_number,
        destination_bank=complaint.destination_account.bank_name,
        destination_ifsc=complaint.destination_account.ifsc_code,
        destination_upi=complaint.destination_account.upi_id,
        
        # Victim info
        victim_name=complaint.victim.name,
        victim_phone=complaint.victim.phone,
        victim_email=complaint.victim.email,
        victim_city=complaint.victim.city,
        victim_lat=complaint.victim.location.get("lat") if (complaint.victim.location and isinstance(complaint.victim.location, dict)) else None,
        victim_lon=complaint.victim.location.get("lon") if (complaint.victim.location and isinstance(complaint.victim.location, dict)) else None,
        victim_state=get_state_from_city(complaint.victim.city),  # Map city to state for AI prediction
        
        # No assigned officer yet - will be auto-assigned or picked up
        assigned_officer_id=None
    )
    
    try:
        db.add(case)
        await db.commit()
        await db.refresh(case)
        logger.info(f"Case created successfully: {case.case_number} (ID: {case.id})")
    except Exception as e:
        logger.error(f"Error creating case: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create case: {str(e)}"
        )
    
    # CRITICAL: Trace money flow and detect mule accounts immediately (synchronous)
    # This MUST happen for every case to provide transaction data via CFCFRMS
    # Even if confidence score is zero, we need transactions for investigation
    # Capture case_id as string before try block to avoid SQLAlchemy lazy loading issues
    case_id_str = str(case.id)
    trace_result = None
    
    logger.info(f"🔍 Starting CFCFRMS money trace for case {case_id_str} (Amount: ₹{case.fraud_amount:.2f})")
    
    try:
        # ALWAYS trace money flow - this is critical for every case
        trace_result = await trace_money_flow_and_detect_mules(
            db, 
            case, 
            victim_account=complaint.destination_account.account_number
        )
        
        if trace_result and trace_result.get("success"):
            logger.info(
                f"✅ Money trace completed for case {case_id_str}: "
                f"{trace_result.get('transactions_traced', 0)} transactions, "
                f"{trace_result.get('mule_accounts_detected', 0)} mule accounts detected"
            )
        else:
            logger.warning(f"⚠️ Money trace returned unsuccessfully for case {case_id_str}: {trace_result}")
            
    except Exception as trace_error:
        # Use case_id_str instead of case.id to avoid SQLAlchemy lazy loading issues
        error_msg = str(trace_error)
        logger.error(f"❌ Error tracing money flow for case {case_id_str}: {error_msg}", exc_info=True)
        
        # Check if it's a database column error
        error_msg_lower = error_msg.lower()
        if any(col in error_msg_lower for col in ["from_balance_before", "to_location", "split_group_id", "column", "does not exist", "undefinedcolumn"]):
            logger.error(
                f"⚠️ Database migration required for case {case_id_str}. "
                f"Transactions cannot be created without required columns. "
                f"Please run: python backend/scripts/add_balance_location_columns.py && "
                f"python backend/scripts/add_split_columns.py"
            )
            trace_result = {
                "success": False,
                "error": "Database migration required. Please run migration scripts.",
                "transactions_traced": 0,
                "mule_accounts_detected": 0
            }
            # Don't fail the request - case is still created, just money trace will be done after migration
        else:
            # For other errors, log but don't fail the request
            logger.error(f"Unexpected error in money trace: {trace_error}", exc_info=True)
            trace_result = {
                "success": False,
                "error": str(trace_error),
                "transactions_traced": 0,
                "mule_accounts_detected": 0
            }
    
    # Trigger AI analysis asynchronously (for location prediction)
    try:
        background_tasks.add_task(trigger_ai_analysis, case.id)
        logger.info(f"🤖 AI analysis queued for case {case_id_str}")
    except Exception as ai_error:
        logger.error(f"Error queuing AI analysis for case {case.id}: {ai_error}", exc_info=True)
        # Don't fail the request if AI analysis fails - case is still created
    
    # Prepare response with transaction summary
    transactions_traced = trace_result.get("transactions_traced", 0) if trace_result else 0
    mule_accounts_detected = trace_result.get("mule_accounts_detected", 0) if trace_result else 0
    
    response_message = (
        "Your complaint has been registered successfully. "
        "LEA officers have been notified and AI analysis is in progress."
    )
    
    if transactions_traced > 0:
        response_message += f" CFCFRMS traced {transactions_traced} transaction(s) and identified {mule_accounts_detected} suspicious account(s)."
    
    return {
        "success": True,
        "data": {
            "case_id": str(case.id),
            "case_number": case.case_number,
            "status": case.status.value if hasattr(case.status, 'value') else str(case.status),
            "priority": case.priority.value if hasattr(case.priority, 'value') else str(case.priority),
            "message": response_message,
            "estimated_analysis_time_seconds": 30,
            "helpline": "1930",
            "tracking_note": "Please save your Case Number for future reference.",
            # Include transaction summary in response
            "cfcfrms_trace": {
                "transactions_traced": transactions_traced,
                "mule_accounts_detected": mule_accounts_detected,
                "trace_completed": trace_result.get("success", False) if trace_result else False
            }
        }
    }


@router.get("/ncrp/complaints/{case_number}/status")
async def check_complaint_status(
    case_number: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Check status of a submitted complaint (Public - No Auth Required).
    
    Citizens can use their case number to check status.
    """
    result = await db.execute(
        select(Case).where(Case.case_number == case_number)
    )
    case = result.scalar_one_or_none()
    
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found. Please check your case number."
        )
    
    # Return limited info for public endpoint (privacy)
    status_messages = {
        CaseStatus.NEW: "Your complaint has been received and is pending review.",
        CaseStatus.IN_PROGRESS: "Your case is being actively investigated.",
        CaseStatus.TEAM_DEPLOYED: "A response team has been deployed.",
        CaseStatus.RESOLVED: "Your case has been resolved.",
        CaseStatus.CLOSED: "Your case has been closed."
    }
    
    return {
        "success": True,
        "data": {
            "case_number": case.case_number,
            "status": case.status.value if hasattr(case.status, 'value') else str(case.status),
            "status_message": status_messages.get(case.status, "Status update pending."),
            "fraud_amount": case.fraud_amount,
            "reported_at": case.created_at.isoformat(),
            "last_updated": case.updated_at.isoformat(),
            "recovery_amount": case.money_recovered,
            "helpline": "1930",
            "note": "For more details, please contact the helpline or visit your nearest cyber cell."
        }
    }

