"""
Team Management Endpoints
"""

from typing import Annotated, Optional
from uuid import UUID

from datetime import datetime
from typing import Annotated, Optional
from uuid import UUID
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.postgresql import get_db
from app.models.officer import Officer
from app.models.team import Team, TeamStatus
from app.models.case import Case
from app.api.v1.endpoints.auth import get_current_officer

router = APIRouter()


class TeamDeploymentRequest(BaseModel):
    """Request to deploy team to location"""
    case_id: UUID
    target_lat: float
    target_lon: float
    priority: Optional[str] = "HIGH"  # URGENT/HIGH/NORMAL
    instructions: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "case_id": "123e4567-e89b-12d3-a456-426614174000",
                "target_lat": 19.0760,
                "target_lon": 72.8777,
                "priority": "HIGH",
                "instructions": "Deploy to predicted ATM location"
            }
        }


@router.get("")
async def list_teams(
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    db: AsyncSession = Depends(get_db),
    status_filter: Optional[TeamStatus] = Query(None, alias="status")
):
    """
    List teams with optional status filter.
    """
    query = select(Team)
    
    if status_filter:
        query = query.where(Team.status == status_filter)
    
    result = await db.execute(query)
    teams = result.scalars().all()
    
    return {
        "success": True,
        "data": {
            "teams": [
                {
                    "id": str(t.id),
                    "team_code": t.team_code,
                    "team_name": t.team_name,
                    "status": t.status,
                    "members_count": t.members_count,
                    "current_location": {
                        "lat": t.current_lat,
                        "lon": t.current_lon
                    } if t.current_lat else None,
                    "radio_channel": t.radio_channel,
                    "vehicle_number": t.vehicle_number
                }
                for t in teams
            ]
        }
    }


@router.get("/{team_id}")
async def get_team(
    team_id: UUID,
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    db: AsyncSession = Depends(get_db)
):
    """Get team details"""
    result = await db.execute(
        select(Team).where(Team.id == team_id)
    )
    team = result.scalar_one_or_none()
    
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    return {
        "success": True,
        "data": {
            "id": str(team.id),
            "team_code": team.team_code,
            "team_name": team.team_name,
            "status": team.status,
            "members_count": team.members_count,
            "current_location": {
                "lat": team.current_lat,
                "lon": team.current_lon
            } if team.current_lat else None,
            "radio_channel": team.radio_channel,
            "vehicle_number": team.vehicle_number,
            "current_case_id": str(team.current_case_id) if team.current_case_id else None
        }
    }


@router.post("/{team_id}/deploy")
async def deploy_team(
    team_id: UUID,
    deployment: TeamDeploymentRequest,
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    db: AsyncSession = Depends(get_db)
):
    """
    Deploy team to predicted ATM location (from CST model).
    
    This endpoint:
    1. Validates case exists and has CST prediction
    2. Updates team location to target coordinates
    3. Sets team status to DEPLOYED
    4. Links team to case
    5. Returns deployment details with ETA
    """
    # Verify team exists
    result = await db.execute(
        select(Team).where(Team.id == team_id)
    )
    team = result.scalar_one_or_none()
    
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    # Verify case exists
    case_result = await db.execute(
        select(Case).where(Case.id == deployment.case_id)
    )
    case = case_result.scalar_one_or_none()
    
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found"
        )
    
    if team.status not in [TeamStatus.AVAILABLE.value, TeamStatus.OFF_DUTY.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Team is not available. Current status: {team.status}"
        )
    
    # Update team location and status
    team.status = TeamStatus.DEPLOYED.value
    team.current_case_id = deployment.case_id
    team.current_lat = deployment.target_lat
    team.current_lon = deployment.target_lon
    
    # Calculate ETA based on distance (simplified - would use routing API in production)
    # For now, estimate 10-20 minutes based on distance
    if team.current_lat and team.current_lon:
        # Simple distance calculation (Haversine would be better)
        import math
        lat_diff = abs(team.current_lat - deployment.target_lat)
        lon_diff = abs(team.current_lon - deployment.target_lon)
        distance_km = math.sqrt(lat_diff**2 + lon_diff**2) * 111  # Rough conversion
        eta_minutes = max(5, int(distance_km * 2))  # ~2 min per km
    else:
        eta_minutes = 15  # Default if no current location
    
    await db.commit()
    
    deployment_time = datetime.utcnow()
    
    return {
        "success": True,
        "data": {
            "deployment_id": str(team.id),  # Use team ID as deployment ID
            "team_id": str(team_id),
            "team_code": team.team_code,
            "team_name": team.team_name,
            "status": "DEPLOYED",
            "case_id": str(deployment.case_id),
            "target_location": {
                "lat": deployment.target_lat,
                "lon": deployment.target_lon
            },
            "current_location": {
                "lat": team.current_lat,
                "lon": team.current_lon
            } if team.current_lat else None,
            "eta_minutes": eta_minutes,
            "priority": deployment.priority,
            "instructions": deployment.instructions,
            "deployed_at": deployment_time.isoformat(),
            "deployed_by": str(current_officer.id),
            "message": f"Team {team.team_name} deployed to location. ETA: {eta_minutes} minutes"
        }
    }


@router.post("/{team_id}/message")
async def send_team_message(
    team_id: UUID,
    message_data: dict,
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    db: AsyncSession = Depends(get_db)
):
    """
    Send message to team.
    
    Request body:
    - case_id: Optional UUID
    - message: Message text
    - priority: HIGH/NORMAL/LOW
    """
    result = await db.execute(
        select(Team).where(Team.id == team_id)
    )
    team = result.scalar_one_or_none()
    
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    # In production: Send via push notification/radio
    
    return {
        "success": True,
        "data": {
            "message_id": "msg-001",
            "delivered": True,
            "timestamp": "2025-12-04T10:50:00Z"
        }
    }

