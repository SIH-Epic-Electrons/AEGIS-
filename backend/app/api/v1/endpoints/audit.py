"""
Audit Trail API Endpoints
For Hyperledger Fabric audit logging
"""

import logging
from typing import Annotated, Optional, List
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field

from app.db.postgresql import get_db
from app.models.officer import Officer
from app.api.v1.endpoints.auth import get_current_officer
from app.services.fabric_service import get_fabric_service, FabricService

logger = logging.getLogger(__name__)
router = APIRouter()


class AuditEventCreate(BaseModel):
    """Request model for creating audit event"""
    eventType: str = Field(..., description="Type of event")
    alertId: Optional[str] = None
    complaintId: Optional[str] = None
    actionType: Optional[str] = None
    metadata: Optional[dict] = None


class AuditEventResponse(BaseModel):
    """Response model for audit event"""
    event_id: str
    tx_id: Optional[str] = None
    status: str
    timestamp: str


@router.post(
    "/events",
    response_model=AuditEventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Audit Event",
    description="""
    Create an audit event on Hyperledger Fabric blockchain.
    
    This endpoint stores immutable audit logs for all critical actions in the AEGIS system.
    
    **Event Types:**
    - ComplaintFiled: When a complaint is filed
    - AlertTriggered: When an alert is triggered
    - CordonActivated: When a cordon is activated
    - OutcomeLogged: When an outcome is logged
    - EvidenceCaptured: When evidence is captured
    - ActionTaken: When any action is taken
    
    **Returns:**
    - event_id: Unique identifier for the event
    - tx_id: Blockchain transaction ID (if Fabric is available)
    - status: Success status
    """
)
async def create_audit_event(
    event: AuditEventCreate,
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    fabric_service: FabricService = Depends(get_fabric_service)
):
    """Create a new audit event"""
    try:
        result = await fabric_service.create_audit_event(
            event_type=event.eventType,
            officer_id=str(current_officer.id),
            timestamp=datetime.utcnow().isoformat(),
            alert_id=event.alertId,
            complaint_id=event.complaintId,
            action_type=event.actionType,
            metadata=event.metadata
        )
        
        return AuditEventResponse(
            event_id=result["event_id"],
            tx_id=result.get("tx_id"),
            status=result["status"],
            timestamp=datetime.utcnow().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Failed to create audit event: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create audit event: {str(e)}"
        )


@router.get(
    "/events/{event_id}",
    response_model=dict,
    summary="Get Audit Event",
    description="Retrieve a specific audit event by ID from the blockchain"
)
async def get_audit_event(
    event_id: str,
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    fabric_service: FabricService = Depends(get_fabric_service)
):
    """Get a specific audit event by ID"""
    try:
        event = await fabric_service.query_audit_event(event_id)
        
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Audit event {event_id} not found"
            )
        
        return event
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to query audit event: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to query audit event: {str(e)}"
        )


@router.get(
    "/events",
    response_model=List[dict],
    summary="Query Audit Events",
    description="""
    Query audit events with filters.
    
    **Filters:**
    - officer_id: Filter by officer ID
    - event_type: Filter by event type
    - start_date: Start date (ISO format)
    - end_date: End date (ISO format)
    """
)
async def query_audit_events(
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    officer_id: Optional[str] = Query(None, description="Filter by officer ID"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    fabric_service: FabricService = Depends(get_fabric_service)
):
    """Query audit events with filters"""
    try:
        if officer_id:
            events = await fabric_service.query_events_by_officer(officer_id)
        elif event_type:
            events = await fabric_service.query_events_by_type(event_type)
        elif start_date and end_date:
            events = await fabric_service.query_events_by_date_range(start_date, end_date)
        else:
            # Default: get events for current officer
            events = await fabric_service.query_events_by_officer(str(current_officer.id))
        
        return events
        
    except Exception as e:
        logger.error(f"Failed to query audit events: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to query audit events: {str(e)}"
        )

