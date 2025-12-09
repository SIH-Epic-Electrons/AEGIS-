"""
Case Management Endpoints
"""

import logging
from typing import Annotated, Optional
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case as sql_case, desc
from sqlalchemy.orm import selectinload

from app.db.postgresql import get_db
from app.models.officer import Officer
from app.models.case import Case, CaseStatus, CasePriority, FraudType
from app.models.mule_account import MuleAccount
from app.models.transaction import Transaction
from app.api.v1.endpoints.auth import get_current_officer
from app.schemas.case import CaseCreate, CaseResponse, CaseListResponse
from app.services.ai_analysis import trigger_ai_analysis
from app.services.money_trace_service import trace_money_flow_and_detect_mules

logger = logging.getLogger(__name__)
router = APIRouter()


def calculate_priority_score(case: Case, now: datetime) -> float:
    """
    Calculate priority score for case sorting.
    Higher score = higher priority (should appear first).
    
    Factors considered:
    1. Priority level (CRITICAL=1000, HIGH=500, MEDIUM=200, LOW=50)
    2. Fraud amount (normalized: 0-500 points, max at 10L+)
    3. Time urgency (cases with predictions ending soon get bonus)
    4. Confidence score (higher confidence = more actionable)
    5. Status (NEW cases get bonus, RESOLVED/CLOSED get penalty)
    6. Recency (newer cases get small bonus)
    """
    score = 0.0
    
    # 1. Priority level base score
    priority_scores = {
        CasePriority.CRITICAL.value: 1000.0,
        CasePriority.HIGH.value: 500.0,
        CasePriority.MEDIUM.value: 200.0,
        CasePriority.LOW.value: 50.0,
    }
    score += priority_scores.get(case.priority, 200.0)
    
    # 2. Fraud amount (normalized to 0-500 points)
    # Max score at 10L+, linear scaling below
    if case.fraud_amount:
        amount_score = min(case.fraud_amount / 20000.0, 500.0)  # 10L = 500 points
        score += amount_score
    
    # 3. Time urgency (if prediction exists with time window)
    if case.predicted_time_end:
        # Ensure both datetimes are timezone-aware for comparison
        pred_end = case.predicted_time_end
        if pred_end.tzinfo is None:
            pred_end = pred_end.replace(tzinfo=timezone.utc)
        now_tz = now
        if now_tz.tzinfo is None:
            now_tz = now_tz.replace(tzinfo=timezone.utc)
        time_remaining = (pred_end - now_tz).total_seconds()
        if time_remaining > 0:
            # More urgent if less time remaining
            # Max 300 points for cases ending in < 30 minutes
            if time_remaining < 1800:  # 30 minutes
                urgency_score = 300.0 * (1.0 - time_remaining / 1800.0)
                score += urgency_score
            elif time_remaining < 3600:  # 1 hour
                urgency_score = 200.0 * (1.0 - (time_remaining - 1800) / 1800.0)
                score += urgency_score
    
    # 4. Confidence score (0-200 points)
    if case.location_confidence:
        score += case.location_confidence * 200.0
    
    # 5. Status bonus/penalty
    status_scores = {
        CaseStatus.NEW.value: 100.0,  # New cases need attention
        CaseStatus.AI_ANALYZING.value: 50.0,
        CaseStatus.IN_PROGRESS.value: 0.0,
        CaseStatus.TEAM_DEPLOYED.value: -50.0,  # Already handled
        CaseStatus.RESOLVED.value: -500.0,  # Should be at bottom
        CaseStatus.CLOSED.value: -1000.0,  # Should be at very bottom
        CaseStatus.CANCELLED.value: -1000.0,
    }
    score += status_scores.get(case.status, 0.0)
    
    # 6. Recency bonus (newer cases get small bonus, max 50 points)
    if case.created_at:
        # Ensure both datetimes are timezone-aware for comparison
        created_at = case.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)
        age_hours = (now - created_at).total_seconds() / 3600.0
        if age_hours < 24:  # Within 24 hours
            recency_score = 50.0 * (1.0 - min(age_hours / 24.0, 1.0))
            score += recency_score
    
    return score


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_case(
    case_data: CaseCreate,
    background_tasks: BackgroundTasks,
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new fraud case from NCRP complaint.
    
    This endpoint:
    1. Creates the case record
    2. Triggers AI analysis
    3. Returns case ID for tracking
    """
    # Generate case number
    today = datetime.utcnow()
    result = await db.execute(
        select(func.count(Case.id)).where(
            func.date(Case.created_at) == today.date()
        )
    )
    count_today = result.scalar() or 0
    case_number = f"MH-{today.year}-{(count_today + 1):05d}"
    
    # Create case
    case = Case(
        case_number=case_number,
        status=CaseStatus.NEW,
        priority=CasePriority.HIGH if case_data.fraud_amount > 100000 else CasePriority.MEDIUM,
        
        # Complaint details
        ncrp_complaint_id=case_data.ncrp_complaint_id,
        fraud_type=case_data.fraud_type,
        fraud_amount=case_data.fraud_amount,
        fraud_description=case_data.fraud_description,
        complaint_timestamp=case_data.fraud_timestamp,
        
        # Destination account (CRITICAL - where victim's money went)
        destination_account=case_data.destination_account.account_number,
        destination_bank=case_data.destination_account.bank_name,
        destination_ifsc=case_data.destination_account.ifsc_code,
        destination_upi=case_data.destination_account.upi_id,
        
        # Victim info
        victim_name=case_data.victim.name,
        victim_phone=case_data.victim.phone,
        victim_email=case_data.victim.email,
        victim_city=case_data.victim.city,
        victim_lat=case_data.victim.location.get("lat") if (case_data.victim.location and isinstance(case_data.victim.location, dict)) else None,
        victim_lon=case_data.victim.location.get("lon") if (case_data.victim.location and isinstance(case_data.victim.location, dict)) else None,
        victim_state=None,  # Will be mapped from city in AI analysis
        
        # Auto-assign to current officer
        assigned_officer_id=current_officer.id
    )
    
    db.add(case)
    await db.commit()
    await db.refresh(case)
    
    # Trace money flow and detect mule accounts immediately (synchronous for better UX)
    # This will store transactions and mule accounts in database
    trace_result = await trace_money_flow_and_detect_mules(db, case, victim_account=case_data.destination_account.account_number)
    logger.info(f"Money trace result for case {case.id}: {trace_result}")
    
    # Trigger AI analysis asynchronously (for location prediction)
    background_tasks.add_task(trigger_ai_analysis, case.id)
    
    return {
        "success": True,
        "data": {
            "case_id": str(case.id),
            "case_number": case.case_number,
            "status": case.status,
            "priority": case.priority,
            "message": "Case created. AI analysis in progress.",
            "estimated_analysis_time_seconds": 30
        }
    }


@router.get("", response_model=CaseListResponse)
async def list_cases(
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    db: AsyncSession = Depends(get_db),
    status_filter: Optional[CaseStatus] = Query(None, alias="status"),
    priority: Optional[CasePriority] = None,
    assigned_to: Optional[str] = Query(None, description="'me' for current officer"),
    limit: int = Query(20, le=100),
    offset: int = 0
):
    """
    List cases with filters.
    
    - **status**: Filter by case status
    - **priority**: Filter by priority
    - **assigned_to**: 'me' for current officer's cases
    - **limit**: Max results (default 20, max 100)
    - **offset**: Pagination offset
    """
    query = select(Case)
    
    # Apply filters
    if status_filter:
        query = query.where(Case.status == status_filter)
    
    if priority:
        query = query.where(Case.priority == priority)
    
    if assigned_to == "me":
        query = query.where(Case.assigned_officer_id == current_officer.id)
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_query)
    total = result.scalar() or 0
    
    # Calculate priority scores and sort
    # We'll fetch all matching cases, calculate scores, sort, then paginate
    all_cases_query = query
    result = await db.execute(all_cases_query)
    all_cases = result.scalars().all()
    
    # Calculate priority score for each case
    # Use timezone-aware datetime to match database timestamps
    now = datetime.now(timezone.utc)
    cases_with_scores = [(case, calculate_priority_score(case, now)) for case in all_cases]
    
    # Sort by priority score (descending) and then by created_at (descending) as tiebreaker
    cases_with_scores.sort(key=lambda x: (-x[1], x[0].created_at), reverse=True)
    
    # Apply pagination
    paginated_cases = cases_with_scores[offset:offset + limit]
    cases = [case for case, _ in paginated_cases]
    
    return CaseListResponse(
        success=True,
        data={
            "cases": [
                {
                    "case_id": str(c.id),
                    "case_number": c.case_number,
                    "status": c.status,
                    "priority": c.priority,
                    "fraud_type": c.fraud_type,
                    "fraud_amount": c.fraud_amount,
                    "victim_name": c.victim_name,
                    "victim_city": c.victim_city,
                    "destination_account": {
                        "account_number": c.destination_account,
                        "bank": c.destination_bank,
                        "upi_id": c.destination_upi
                    } if c.destination_account else None,
                    "location_confidence": c.location_confidence,
                    "created_at": c.created_at.isoformat()
                }
                for c in cases
            ],
            "pagination": {
                "total": total,
                "limit": limit,
                "offset": offset,
                "has_more": offset + limit < total
            }
        }
    )


@router.get("/{case_id}")
async def get_case(
    case_id: UUID,
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    db: AsyncSession = Depends(get_db)
):
    """Get detailed case information"""
    try:
        result = await db.execute(
            select(Case)
            .options(
                selectinload(Case.transactions),
                selectinload(Case.mule_accounts),
                selectinload(Case.predicted_atm)
            )
            .where(Case.id == case_id)
        )
        case = result.scalar_one_or_none()
        
        if not case:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Case not found"
            )
        
        return {
        "success": True,
        "data": {
            "case_id": str(case.id),
            "case_number": case.case_number,
            "status": case.status,
            "priority": case.priority,
            
            "complaint": {
                "ncrp_id": case.ncrp_complaint_id,
                "fraud_type": case.fraud_type,
                "fraud_amount": case.fraud_amount,
                "description": case.fraud_description,
                "reported_at": case.complaint_timestamp.isoformat() if case.complaint_timestamp else None
            },
            
            "destination_account": {
                "account_number": case.destination_account,
                "bank": case.destination_bank,
                "ifsc": case.destination_ifsc,
                "upi_id": case.destination_upi
            } if case.destination_account else None,
            
            "victim": {
                "name": case.victim_name,
                "phone": case.victim_phone,
                "city": case.victim_city
            },
            
            "prediction": {
                "predicted_atm": {
                    "id": str(case.predicted_atm.id) if case.predicted_atm else None,
                    "name": case.predicted_atm.name if case.predicted_atm else None,
                    "bank": case.predicted_atm.bank_name if case.predicted_atm else None,
                    "address": case.predicted_atm.address if case.predicted_atm else None
                } if case.predicted_atm else None,
                "time_window": {
                    "start": case.predicted_time_start.isoformat() if case.predicted_time_start else None,
                    "end": case.predicted_time_end.isoformat() if case.predicted_time_end else None
                },
                "confidence": case.location_confidence,
                "alternative_locations": case.alternative_predictions or []
            },
            
            "mule_accounts_summary": {
                "total": len(case.mule_accounts),
                "active": sum(1 for m in case.mule_accounts if m.status == "ACTIVE"),
                "frozen": sum(1 for m in case.mule_accounts if m.status == "FROZEN"),
                "total_amount": sum(m.amount_received or 0 for m in case.mule_accounts)
            },
            
            "created_at": case.created_at.isoformat(),
            "updated_at": case.updated_at.isoformat(),
            # Transactions count (if transactions weren't loaded due to missing columns)
            "transactions_count": len(case.transactions) if hasattr(case, 'transactions') and case.transactions else 0
        }
    }
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        # Check if it's a database column error
        missing_columns = []
        if "split_group_id" in error_msg or "split_index" in error_msg or "split_total" in error_msg:
            missing_columns.append("split columns")
        if "from_balance_before" in error_msg or "to_balance_after" in error_msg or "from_location" in error_msg or "to_location" in error_msg:
            missing_columns.append("balance/location columns")
        
        if missing_columns:
            migration_scripts = []
            if "split columns" in missing_columns:
                migration_scripts.append("python backend/scripts/add_split_columns.py")
            if "balance/location columns" in missing_columns:
                migration_scripts.append("python backend/scripts/add_balance_location_columns.py")
            
            logger.error(
                f"Database migration required: Missing columns in transactions table. "
                f"Please run: {' and '.join(migration_scripts)}. "
                f"Error: {error_msg}"
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=(
                    "Database schema needs update. Please run migration:\n"
                    + "\n".join([f"  {script}" for script in migration_scripts])
                )
            )
        logger.error(f"Error fetching case {case_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch case: {str(e)}"
        )


@router.get("/{case_id}/mule-accounts")
async def get_case_mule_accounts(
    case_id: UUID,
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    db: AsyncSession = Depends(get_db)
):
    """Get mule accounts for a case"""
    result = await db.execute(
        select(MuleAccount).where(MuleAccount.case_id == case_id)
    )
    mule_accounts = result.scalars().all()
    
    return {
        "success": True,
        "data": {
            "case_id": str(case_id),
            "mule_accounts": [
                {
                    "id": str(m.id),
                    "account_number": m.account_number,
                    "bank": m.bank_name,
                    "holder_name": m.holder_name,
                    "amount_received": m.amount_received,
                    "current_balance": m.current_balance,
                    "status": m.status,
                    "mule_confidence": m.mule_confidence,
                    "hop_number": m.hop_number,
                    "risk_indicators": m.risk_indicators or []
                }
                for m in mule_accounts
            ]
        }
    }


@router.get("/{case_id}/transactions")
async def get_case_transactions(
    case_id: UUID,
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    db: AsyncSession = Depends(get_db)
):
    """Get transaction trail for a case"""
    try:
        result = await db.execute(
            select(Transaction)
            .where(Transaction.case_id == case_id)
            .order_by(Transaction.hop_number)
        )
        transactions = result.scalars().all()
        
        # Group transactions by split_group_id to identify splits
        transactions_by_split = {}
        regular_transactions = []
        
        for t in transactions:
            # Handle None/null split_group_id gracefully (for existing transactions without split fields)
            split_group_id = getattr(t, 'split_group_id', None) if hasattr(t, 'split_group_id') else None
            if split_group_id:
                if split_group_id not in transactions_by_split:
                    transactions_by_split[split_group_id] = []
                transactions_by_split[split_group_id].append(t)
            else:
                regular_transactions.append(t)
        
        # Sort split groups and regular transactions
        for split_group in transactions_by_split.values():
            split_group.sort(key=lambda x: (getattr(x, 'split_index', None) or 0, x.transaction_timestamp))
        regular_transactions.sort(key=lambda x: (x.hop_number, x.transaction_timestamp))
        
        return {
            "success": True,
            "data": {
                "case_id": str(case_id),
                "transactions": [
                    {
                        "id": str(t.id),
                        "from_account": t.from_account,
                        "from_bank": t.from_bank,
                        "from_holder_name": getattr(t, 'from_holder_name', None),
                        "from_balance_before": getattr(t, 'from_balance_before', None),
                        "from_balance_after": getattr(t, 'from_balance_after', None),
                        "from_location": getattr(t, 'from_location', None),
                        "to_account": t.to_account,
                        "to_bank": t.to_bank,
                        "to_holder_name": getattr(t, 'to_holder_name', None),
                        "to_balance_before": getattr(t, 'to_balance_before', None),
                        "to_balance_after": getattr(t, 'to_balance_after', None),
                        "to_location": getattr(t, 'to_location', None),
                        "amount": t.amount,
                        "transaction_type": t.transaction_type,
                        "transaction_id": t.transaction_id,
                        "timestamp": t.transaction_timestamp.isoformat(),
                        "hop_number": t.hop_number,
                        "status": t.status,
                        # Split information (handle missing attributes gracefully)
                        "split_group_id": getattr(t, 'split_group_id', None),
                        "split_index": getattr(t, 'split_index', None),
                        "split_total": getattr(t, 'split_total', None),
                        "is_split": bool(getattr(t, 'split_group_id', None))
                    }
                    for t in regular_transactions + [t for group in transactions_by_split.values() for t in group]
                ],
                "splits": {
                    split_id: [
                        {
                            "id": str(t.id),
                            "to_account": t.to_account,
                            "to_bank": t.to_bank,
                            "to_holder_name": getattr(t, 'to_holder_name', None),
                            "amount": t.amount,
                            "split_index": getattr(t, 'split_index', None),
                            "timestamp": t.transaction_timestamp.isoformat(),
                        }
                        for t in sorted(group, key=lambda x: getattr(x, 'split_index', None) or 0)
                    ]
                    for split_id, group in transactions_by_split.items()
                }
            }
        }
    except Exception as e:
        logger.error(f"Error fetching transactions for case {case_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch transactions: {str(e)}"
        )

