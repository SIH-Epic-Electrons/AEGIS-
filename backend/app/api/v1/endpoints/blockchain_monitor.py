"""
Blockchain Monitoring Endpoints

Real-time monitoring of blockchain storage operations
"""

import logging
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgresql import get_db
from app.models.officer import Officer
from app.api.v1.endpoints.auth import get_current_officer
from app.services.blockchain_service import get_blockchain_service
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


# In-memory storage for recent blockchain operations (for monitoring)
# In production, use Redis or database
_recent_operations: List[Dict] = []
MAX_OPERATIONS = 100


def log_blockchain_operation(operation_type: str, case_id: str, status: str, details: Optional[Dict] = None):
    """Log blockchain operation for monitoring - can be called from anywhere"""
    try:
        operation = {
            "timestamp": datetime.utcnow().isoformat(),
            "operation_type": operation_type,
            "case_id": str(case_id),
            "status": status,
            "details": details or {}
        }
        _recent_operations.insert(0, operation)
        # Keep only recent operations
        if len(_recent_operations) > MAX_OPERATIONS:
            _recent_operations.pop()
    except Exception as e:
        logger.warning(f"Failed to log blockchain operation: {e}")


# Export function for use in other modules
__all__ = ['log_blockchain_operation', '_recent_operations']


@router.get(
    "/blockchain/monitor/recent",
    summary="Get Recent Blockchain Operations",
    description="""
    Get recent blockchain storage operations for monitoring.
    
    Shows the last N operations with timestamps and status.
    """
)
async def get_recent_operations(
    limit: int = Query(20, ge=1, le=100, description="Number of recent operations to return"),
    current_officer: Officer = Depends(get_current_officer),
):
    """Get recent blockchain operations"""
    if not settings.blockchain_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Blockchain is not enabled"
        )
    
    return {
        "total": len(_recent_operations),
        "limit": limit,
        "operations": _recent_operations[:limit]
    }


@router.get(
    "/blockchain/monitor/stats",
    summary="Get Blockchain Statistics",
    description="""
    Get statistics about blockchain operations.
    
    Returns counts of successful/failed operations, recent activity, etc.
    """
)
async def get_blockchain_stats(
    hours: int = Query(24, ge=1, le=168, description="Hours to look back"),
    current_officer: Officer = Depends(get_current_officer),
):
    """Get blockchain statistics"""
    if not settings.blockchain_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Blockchain is not enabled"
        )
    
    cutoff_time = datetime.utcnow() - timedelta(hours=hours)
    
    recent_ops = [
        op for op in _recent_operations
        if datetime.fromisoformat(op["timestamp"]) >= cutoff_time
    ]
    
    successful = sum(1 for op in recent_ops if op["status"] == "success")
    failed = sum(1 for op in recent_ops if op["status"] == "failed")
    
    return {
        "period_hours": hours,
        "total_operations": len(recent_ops),
        "successful": successful,
        "failed": failed,
        "success_rate": (successful / len(recent_ops) * 100) if recent_ops else 0,
        "recent_operations": recent_ops[:10]
    }


@router.get(
    "/blockchain/monitor/live",
    summary="Get Live Blockchain Status",
    description="""
    Get current status of blockchain connection and recent activity.
    """
)
async def get_live_status(
    current_officer: Officer = Depends(get_current_officer),
):
    """Get live blockchain status"""
    blockchain_service = get_blockchain_service()
    
    return {
        "blockchain_enabled": settings.blockchain_enabled,
        "service_enabled": blockchain_service.enabled if blockchain_service else False,
        "recent_operations_count": len(_recent_operations),
        "last_operation": _recent_operations[0] if _recent_operations else None,
        "timestamp": datetime.utcnow().isoformat()
    }

