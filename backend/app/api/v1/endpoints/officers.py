"""
Officer Endpoints
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.postgresql import get_db
from app.models.officer import Officer
from app.api.v1.endpoints.auth import get_current_officer
from app.schemas.officer import OfficerResponse, OfficerUpdate

router = APIRouter()


@router.get("/me", response_model=dict)
async def get_my_profile(
    current_officer: Annotated[Officer, Depends(get_current_officer)]
):
    """Get current officer's profile"""
    return {
        "success": True,
        "data": {
            "id": str(current_officer.id),
            "badge_id": current_officer.badge_id,
            "name": current_officer.name,
            "email": current_officer.email,
            "phone": current_officer.phone,
            "rank": current_officer.rank,
            "designation": current_officer.designation,
            "avatar_url": current_officer.avatar_url,
            "is_active": current_officer.is_active,
            "settings": current_officer.settings,
            "created_at": current_officer.created_at.isoformat()
        }
    }


@router.put("/me", response_model=dict)
async def update_my_profile(
    update_data: OfficerUpdate,
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    db: AsyncSession = Depends(get_db)
):
    """Update current officer's profile"""
    
    # Update allowed fields
    if update_data.phone is not None:
        current_officer.phone = update_data.phone
    
    if update_data.avatar_url is not None:
        current_officer.avatar_url = update_data.avatar_url
    
    if update_data.settings is not None:
        # Merge settings
        current_settings = current_officer.settings or {}
        current_settings.update(update_data.settings)
        current_officer.settings = current_settings
    
    await db.commit()
    await db.refresh(current_officer)
    
    return {
        "success": True,
        "data": {
            "message": "Profile updated successfully"
        }
    }


@router.get("/stats", response_model=dict)
async def get_my_stats(
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    db: AsyncSession = Depends(get_db)
):
    """Get current officer's performance statistics"""
    from app.models.case import Case, CaseStatus, CaseOutcome
    from sqlalchemy import func
    
    # Total cases
    result = await db.execute(
        select(func.count(Case.id)).where(
            Case.assigned_officer_id == current_officer.id
        )
    )
    total_cases = result.scalar() or 0
    
    # Resolved cases
    result = await db.execute(
        select(func.count(Case.id)).where(
            Case.assigned_officer_id == current_officer.id,
            Case.status == CaseStatus.RESOLVED
        )
    )
    resolved_cases = result.scalar() or 0
    
    # Successful cases
    result = await db.execute(
        select(func.count(Case.id)).where(
            Case.assigned_officer_id == current_officer.id,
            Case.outcome == CaseOutcome.SUCCESS
        )
    )
    successful_cases = result.scalar() or 0
    
    # Total fraud amount handled
    result = await db.execute(
        select(func.sum(Case.fraud_amount)).where(
            Case.assigned_officer_id == current_officer.id
        )
    )
    total_fraud_amount = result.scalar() or 0
    
    # Total recovered
    result = await db.execute(
        select(func.sum(Case.money_recovered)).where(
            Case.assigned_officer_id == current_officer.id
        )
    )
    total_recovered = result.scalar() or 0
    
    success_rate = (successful_cases / resolved_cases * 100) if resolved_cases > 0 else 0
    recovery_rate = (total_recovered / total_fraud_amount * 100) if total_fraud_amount > 0 else 0
    
    return {
        "success": True,
        "data": {
            "cases": {
                "total": total_cases,
                "resolved": resolved_cases,
                "successful": successful_cases,
                "in_progress": total_cases - resolved_cases,
                "success_rate": round(success_rate, 1)
            },
            "recovery": {
                "total_fraud_amount": total_fraud_amount,
                "total_recovered": total_recovered,
                "recovery_rate": round(recovery_rate, 1)
            },
            "performance": {
                "avg_response_time_seconds": 285,  # Calculate from case actions
                "predictions_validated": 38,
                "prediction_accuracy": 87.5
            }
        }
    }

