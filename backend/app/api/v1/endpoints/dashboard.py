"""
Dashboard Endpoints
"""

from typing import Annotated
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.db.postgresql import get_db
from app.models.officer import Officer
from app.models.case import Case, CaseStatus, CasePriority, FraudType
from app.models.team import Team, TeamStatus
from app.models.mule_account import MuleAccount
from app.models.freeze_request import FreezeRequest
from app.api.v1.endpoints.auth import get_current_officer

router = APIRouter()


@router.get("")
async def get_dashboard(
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    db: AsyncSession = Depends(get_db)
):
    """
    Get dashboard data for current officer.
    
    Returns:
    - Officer statistics
    - Priority alerts
    - Live activity summary
    - AI insights
    """
    today = datetime.utcnow().date()
    today_start = datetime.combine(today, datetime.min.time())
    
    # Get officer's cases today
    result = await db.execute(
        select(func.count(Case.id)).where(
            Case.assigned_officer_id == current_officer.id,
            Case.created_at >= today_start
        )
    )
    cases_today = result.scalar() or 0
    
    # Get resolved cases today
    result = await db.execute(
        select(func.count(Case.id)).where(
            Case.assigned_officer_id == current_officer.id,
            Case.status == CaseStatus.RESOLVED.value,
            Case.closed_at >= today_start
        )
    )
    resolved_today = result.scalar() or 0
    
    # Get priority alerts (critical/high priority active cases)
    # Get top 3 cases by fraud amount for EST risk calculation
    result = await db.execute(
        select(Case).where(
            Case.status.in_([CaseStatus.NEW.value, CaseStatus.IN_PROGRESS.value, CaseStatus.TEAM_DEPLOYED.value]),
            Case.priority.in_([CasePriority.CRITICAL.value, CasePriority.HIGH.value])
        ).order_by(Case.fraud_amount.desc()).limit(3)
    )
    top_3_cases = result.scalars().all()
    
    # Calculate EST risk as sum of losses from top 3 cases
    est_risk_amount = sum(c.fraud_amount for c in top_3_cases) if top_3_cases else 0
    
    # Get priority alerts for display (limit 5, ordered by creation date)
    result = await db.execute(
        select(Case).where(
            Case.status.in_([CaseStatus.NEW.value, CaseStatus.IN_PROGRESS.value, CaseStatus.TEAM_DEPLOYED.value]),
            Case.priority.in_([CasePriority.CRITICAL.value, CasePriority.HIGH.value])
        ).order_by(Case.created_at.desc()).limit(5)
    )
    priority_cases = result.scalars().all()
    
    # Get total active cases
    result = await db.execute(
        select(func.count(Case.id)).where(
            Case.status.in_([CaseStatus.NEW.value, CaseStatus.IN_PROGRESS.value, CaseStatus.TEAM_DEPLOYED.value])
        )
    )
    active_cases = result.scalar() or 0
    
    # Get recovered amount today
    result = await db.execute(
        select(func.sum(Case.money_recovered)).where(
            Case.closed_at >= today_start
        )
    )
    recovered_today = result.scalar() or 0
    
    return {
        "success": True,
        "data": {
            "officer_stats": {
                "cases_today": cases_today,
                "cases_resolved": resolved_today,
                "recovery_rate": 78.5,  # Calculate from actual data
                "avg_response_time_seconds": 312
            },
            "priority_alerts": [
                {
                    "case_id": str(c.id),
                    "case_number": c.case_number,
                    "fraud_amount": c.fraud_amount,
                    "fraud_type": c.fraud_type if c.fraud_type else "UNKNOWN",
                    "priority": c.priority,
                    "predicted_location": "Predicted ATM",  # From prediction
                    "confidence": c.location_confidence or 0.0,
                    "created_at": c.created_at.isoformat()
                }
                for c in priority_cases
            ],
            "live_activity": {
                "active_cases": active_cases,
                "teams_deployed": 4,  # Calculate from teams
                "accounts_frozen_today": 23,  # Calculate from freeze requests
                "amount_secured_today": recovered_today,
                "est_risk_amount": est_risk_amount  # Sum of losses from top 3 cases
            },
            "ai_insight": {
                "message": "Predicted surge in OTP fraud activities in South Mumbai between 2-5 PM today. Consider increased monitoring.",
                "type": "WARNING",
                "action_url": "/ai/insights/surge-001"
            }
        }
    }


@router.get("/stats")
async def get_dashboard_stats(
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    db: AsyncSession = Depends(get_db),
    period: str = Query("all", description="Filter: 'today', 'week', 'month', 'all'")
):
    """
    Get comprehensive statistics for AEGIS dashboard.
    
    Returns:
    - Case statistics by status and type
    - Freeze action metrics
    - Team deployment status
    - Recovery metrics
    - Performance indicators
    - Today's activity summary
    """
    today = datetime.utcnow().date()
    today_start = datetime.combine(today, datetime.min.time())
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)
    
    # Determine date filter based on period
    date_filter = None
    if period == "today":
        date_filter = today_start
    elif period == "week":
        date_filter = week_start
    elif period == "month":
        date_filter = month_start
    
    # ===== CASE STATISTICS =====
    # Total cases
    query = select(func.count(Case.id))
    if date_filter:
        query = query.where(Case.created_at >= date_filter)
    result = await db.execute(query)
    total_cases = result.scalar() or 0
    
    # Cases by status
    cases_by_status = {}
    for status in [CaseStatus.NEW, CaseStatus.IN_PROGRESS, CaseStatus.TEAM_DEPLOYED, 
                   CaseStatus.RESOLVED, CaseStatus.CLOSED]:
        query = select(func.count(Case.id)).where(Case.status == status.value)
        if date_filter:
            query = query.where(Case.created_at >= date_filter)
        result = await db.execute(query)
        cases_by_status[status.value] = result.scalar() or 0
    
    # Cases by priority
    cases_by_priority = {}
    for priority in [CasePriority.CRITICAL, CasePriority.HIGH, CasePriority.MEDIUM, CasePriority.LOW]:
        query = select(func.count(Case.id)).where(Case.priority == priority.value)
        if date_filter:
            query = query.where(Case.created_at >= date_filter)
        result = await db.execute(query)
        cases_by_priority[priority.value] = result.scalar() or 0
    
    # Cases by fraud type
    cases_by_fraud_type = {}
    for fraud_type in [FraudType.OTP_FRAUD, FraudType.UPI_FRAUD, FraudType.PHISHING, 
                       FraudType.LOAN_FRAUD, FraudType.INVESTMENT_FRAUD, FraudType.KYC_FRAUD]:
        query = select(func.count(Case.id)).where(Case.fraud_type == fraud_type.value)
        if date_filter:
            query = query.where(Case.created_at >= date_filter)
        result = await db.execute(query)
        count = result.scalar() or 0
        if count > 0:
            cases_by_fraud_type[fraud_type.value] = count
    
    # Resolved/successful cases
    query = select(func.count(Case.id)).where(Case.status == CaseStatus.RESOLVED.value)
    if date_filter:
        query = query.where(Case.created_at >= date_filter)
    result = await db.execute(query)
    resolved_cases = result.scalar() or 0
    
    # ===== FREEZE ACTIONS =====
    # Frozen accounts today
    result = await db.execute(
        select(func.count(MuleAccount.id)).where(
            MuleAccount.status == "FROZEN",
            MuleAccount.updated_at >= today_start
        )
    )
    frozen_today = result.scalar() or 0
    
    # Total frozen accounts
    result = await db.execute(
        select(func.count(MuleAccount.id)).where(MuleAccount.status == "FROZEN")
    )
    frozen_total = result.scalar() or 0
    
    # Amount secured (in frozen accounts)
    result = await db.execute(
        select(func.sum(MuleAccount.current_balance)).where(MuleAccount.status == "FROZEN")
    )
    amount_secured = result.scalar() or 0
    
    # ===== TEAM STATUS =====
    # Total teams
    result = await db.execute(select(func.count(Team.id)))
    total_teams = result.scalar() or 0
    
    # Deployed teams
    result = await db.execute(
        select(func.count(Team.id)).where(Team.status == TeamStatus.DEPLOYED.value)
    )
    deployed_teams = result.scalar() or 0
    
    # Available teams
    result = await db.execute(
        select(func.count(Team.id)).where(Team.status == TeamStatus.AVAILABLE.value)
    )
    available_teams = result.scalar() or 0
    
    # ===== RECOVERY METRICS =====
    # Total fraud amount
    query = select(func.sum(Case.fraud_amount))
    if date_filter:
        query = query.where(Case.created_at >= date_filter)
    result = await db.execute(query)
    total_fraud_amount = result.scalar() or 0
    
    # Total recovered
    query = select(func.sum(Case.money_recovered))
    if date_filter:
        query = query.where(Case.created_at >= date_filter)
    result = await db.execute(query)
    total_recovered = result.scalar() or 0
    
    recovery_rate = (total_recovered / total_fraud_amount * 100) if total_fraud_amount > 0 else 0
    
    # ===== PERFORMANCE METRICS =====
    # Average response time (mock for now - would calculate from first_action_at - created_at)
    avg_response_time = 285  # seconds
    
    # Prediction accuracy (mock - would calculate from location_prediction_correct)
    prediction_accuracy = 87.5
    
    # ===== TODAY'S SUMMARY =====
    # New cases today
    result = await db.execute(
        select(func.count(Case.id)).where(Case.created_at >= today_start)
    )
    new_cases_today = result.scalar() or 0
    
    # Resolved today
    result = await db.execute(
        select(func.count(Case.id)).where(
            Case.status == CaseStatus.RESOLVED.value,
            Case.closed_at >= today_start
        )
    )
    resolved_today = result.scalar() or 0
    
    # Amount recovered today
    result = await db.execute(
        select(func.sum(Case.money_recovered)).where(Case.closed_at >= today_start)
    )
    recovered_today = result.scalar() or 0
    
    # ===== EST RISK AMOUNT (Sum of losses from top 3 active cases) =====
    # Get top 3 active cases by fraud amount
    result = await db.execute(
        select(Case).where(
            Case.status.in_([CaseStatus.NEW.value, CaseStatus.IN_PROGRESS.value, CaseStatus.TEAM_DEPLOYED.value])
        ).order_by(Case.fraud_amount.desc()).limit(3)
    )
    top_3_active_cases = result.scalars().all()
    est_risk_amount = sum(c.fraud_amount for c in top_3_active_cases) if top_3_active_cases else 0
    
    # ===== TOP CITIES =====
    result = await db.execute(
        select(Case.victim_city, func.count(Case.id).label('count'))
        .where(Case.victim_city.isnot(None))
        .group_by(Case.victim_city)
        .order_by(func.count(Case.id).desc())
        .limit(5)
    )
    top_cities = [{"city": row[0], "cases": row[1]} for row in result.all()]
    
    return {
        "success": True,
        "data": {
            "period": period,
            "cases": {
                "total": total_cases,
                "resolved": resolved_cases,
                "in_progress": cases_by_status.get("IN_PROGRESS", 0),
                "success_rate": round((resolved_cases / total_cases * 100) if total_cases > 0 else 0, 1),
                "by_status": cases_by_status,
                "by_priority": cases_by_priority,
                "by_fraud_type": cases_by_fraud_type
            },
            "freeze_actions": {
                "accounts_frozen_today": frozen_today,
                "accounts_frozen_total": frozen_total,
                "amount_secured": amount_secured
            },
            "teams": {
                "total": total_teams,
                "deployed_now": deployed_teams,
                "available": available_teams
            },
            "recovery": {
                "total_fraud_amount": total_fraud_amount,
                "total_recovered": total_recovered,
                "recovery_rate": round(recovery_rate, 1),
                "est_risk_amount": est_risk_amount  # Sum of losses from top 3 active cases
            },
            "performance": {
                "avg_response_time_seconds": avg_response_time,
                "prediction_accuracy": prediction_accuracy
            },
            "today": {
                "new_cases": new_cases_today,
                "resolved": resolved_today,
                "frozen_accounts": frozen_today,
                "amount_recovered": recovered_today or 0
            },
            "top_cities": top_cities
        }
    }

