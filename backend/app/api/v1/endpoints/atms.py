"""
ATM Endpoints
"""

from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.postgresql import get_db
from app.models.officer import Officer
from app.models.atm import ATM
from app.api.v1.endpoints.auth import get_current_officer

router = APIRouter()


@router.get("")
async def list_atms(
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    db: AsyncSession = Depends(get_db),
    lat: Optional[float] = Query(None, description="Center latitude"),
    lon: Optional[float] = Query(None, description="Center longitude"),
    radius_km: float = Query(5, description="Search radius in km"),
    bank: Optional[str] = Query(None, description="Filter by bank name"),
    city: Optional[str] = Query(None),
    limit: int = Query(50, le=200)
):
    """
    List ATMs with optional filters.
    
    - **lat/lon**: Center point for geographic search
    - **radius_km**: Search radius (default 5km)
    - **bank**: Filter by bank name
    - **city**: Filter by city
    """
    query = select(ATM).where(ATM.is_active == True)
    
    if bank:
        query = query.where(ATM.bank_name.ilike(f"%{bank}%"))
    
    if city:
        query = query.where(ATM.city.ilike(f"%{city}%"))
    
    # Note: For proper geographic queries, use PostGIS ST_DWithin
    # This is a simplified version
    
    query = query.limit(limit)
    
    result = await db.execute(query)
    atms = result.scalars().all()
    
    return {
        "success": True,
        "data": {
            "atms": [
                {
                    "id": str(a.id),
                    "atm_id": a.atm_id,
                    "name": a.name,
                    "bank": a.bank_name,
                    "address": a.address,
                    "city": a.city,
                    "latitude": a.latitude,
                    "longitude": a.longitude,
                    "type": a.atm_type,
                    "is_active": a.is_active
                }
                for a in atms
            ]
        }
    }


@router.get("/{atm_id}")
async def get_atm(
    atm_id: UUID,
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    db: AsyncSession = Depends(get_db)
):
    """Get ATM details"""
    result = await db.execute(
        select(ATM).where(ATM.id == atm_id)
    )
    atm = result.scalar_one_or_none()
    
    if not atm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ATM not found"
        )
    
    return {
        "success": True,
        "data": {
            "id": str(atm.id),
            "atm_id": atm.atm_id,
            "name": atm.name,
            "bank": atm.bank_name,
            "address": atm.address,
            "city": atm.city,
            "state": atm.state,
            "pincode": atm.pincode,
            "latitude": atm.latitude,
            "longitude": atm.longitude,
            "type": atm.atm_type,
            "is_active": atm.is_active
        }
    }

