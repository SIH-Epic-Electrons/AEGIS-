"""
Account Freeze Endpoints
Handles account freezing via NPCI/CFCFRMS simulation
"""

import uuid
import json
from typing import Annotated, Optional, List
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel

from app.db.postgresql import get_db
from app.models.officer import Officer
from app.models.case import Case
from app.models.mule_account import MuleAccount, MuleAccountStatus
from app.models.freeze_request import FreezeRequest, FreezeStatus, FreezeType
from app.models.frozen_account import FrozenAccount
from app.api.v1.endpoints.auth import get_current_officer

router = APIRouter()


def format_duration(seconds: Optional[float]) -> Optional[str]:
    """Format duration in seconds to human-readable string"""
    if seconds is None:
        return None
    
    if seconds < 60:
        return f"{int(seconds)} seconds"
    elif seconds < 3600:
        minutes = int(seconds / 60)
        secs = int(seconds % 60)
        return f"{minutes}m {secs}s" if secs > 0 else f"{minutes} minutes"
    else:
        hours = int(seconds / 3600)
        minutes = int((seconds % 3600) / 60)
        return f"{hours}h {minutes}m" if minutes > 0 else f"{hours} hours"


def format_duration(seconds: Optional[float]) -> Optional[str]:
    """Format duration in seconds to human-readable string"""
    if seconds is None:
        return None
    
    if seconds < 60:
        return f"{int(seconds)} seconds"
    elif seconds < 3600:
        minutes = int(seconds / 60)
        secs = int(seconds % 60)
        return f"{minutes}m {secs}s" if secs > 0 else f"{minutes} minutes"
    else:
        hours = int(seconds / 3600)
        minutes = int((seconds % 3600) / 60)
        return f"{hours}h {minutes}m" if minutes > 0 else f"{hours} hours"


# Request/Response schemas
class FreezeAccountRequest(BaseModel):
    """Request to freeze accounts"""
    account_ids: Optional[List[str]] = None  # If empty, freeze all mule accounts
    freeze_type: str = "TEMPORARY"  # TEMPORARY or PERMANENT
    duration_hours: int = 72  # Default 72 hours for temporary
    reason: str = "Suspected involvement in cyber fraud"


class FreezeResponse(BaseModel):
    """Freeze operation response"""
    success: bool
    data: dict


@router.post("/cases/{case_id}/freeze")
async def freeze_case_accounts(
    case_id: str,
    freeze_request: FreezeAccountRequest,
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    db: AsyncSession = Depends(get_db)
):
    """
    Freeze accounts associated with a case.
    
    This endpoint:
    1. Validates the case exists
    2. Creates a freeze request record
    3. Simulates NPCI/CFCFRMS freeze request
    4. Updates mule account statuses
    5. Returns freeze confirmation
    """
    try:
        case_uuid = uuid.UUID(case_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid case ID format"
        )
    
    # Verify case exists
    result = await db.execute(
        select(Case).where(Case.id == case_uuid)
    )
    case = result.scalar_one_or_none()
    
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found"
        )
    
    # Get mule accounts to freeze
    if freeze_request.account_ids:
        # Freeze specific accounts
        account_uuids = []
        for aid in freeze_request.account_ids:
            try:
                account_uuids.append(uuid.UUID(aid))
            except ValueError:
                continue
        
        mule_query = select(MuleAccount).where(
            MuleAccount.case_id == case_uuid,
            MuleAccount.id.in_(account_uuids),
            MuleAccount.status == MuleAccountStatus.ACTIVE.value
        )
    else:
        # Freeze all active mule accounts for this case
        mule_query = select(MuleAccount).where(
            MuleAccount.case_id == case_uuid,
            MuleAccount.status == MuleAccountStatus.ACTIVE.value
        )
    
    result = await db.execute(mule_query)
    mule_accounts = result.scalars().all()
    
    if not mule_accounts:
        return {
            "success": True,
            "data": {
                "message": "No active accounts to freeze",
                "accounts_frozen": 0,
                "amount_secured": 0
            }
        }
    
    # Create freeze request record
    freeze_req = FreezeRequest(
        case_id=case_uuid,
        account_ids=json.dumps([str(m.id) for m in mule_accounts]),
        freeze_type=freeze_request.freeze_type,
        duration_hours=freeze_request.duration_hours,
        reason=freeze_request.reason,
        status=FreezeStatus.PROCESSING.value,
        requested_by=current_officer.id
    )
    db.add(freeze_req)
    
    # Simulate NPCI/CFCFRMS freeze (in production, this would make API calls)
    import time
    start_time = time.time()
    
    # Process each account
    frozen_accounts = []
    total_secured = 0.0
    
    for account in mule_accounts:
        # Check if account is already frozen (prevent duplicate freezes)
        existing_frozen = await db.execute(
            select(FrozenAccount).where(
                FrozenAccount.account_number == account.account_number,
                FrozenAccount.case_id == case_uuid,
                FrozenAccount.is_active == True
            )
        )
        if existing_frozen.scalar_one_or_none():
            # Account already frozen, skip
            continue
        
        # Update account status
        # Use timezone-aware datetime
        from datetime import timezone
        freeze_time = datetime.now(timezone.utc)
        account.status = MuleAccountStatus.FROZEN.value
        account.freeze_timestamp = freeze_time
        account.npci_reference = f"NPCI-{uuid.uuid4().hex[:12].upper()}"
        
        # Create FrozenAccount record for transaction blocking
        frozen_account = FrozenAccount(
            account_number=account.account_number,
            bank_name=account.bank_name,
            case_id=case_uuid,
            freeze_request_id=freeze_req.id,
            frozen_at=freeze_time,
            frozen_by=current_officer.id,
            case_created_at=case.created_at,
            is_active=True
        )
        db.add(frozen_account)
        
        frozen_accounts.append({
            "id": str(account.id),
            "account_number": account.account_number,
            "bank": account.bank_name,
            "amount_secured": account.current_balance or 0,
            "npci_reference": account.npci_reference,
            "frozen_at": account.freeze_timestamp.isoformat(),
            "time_to_freeze_seconds": frozen_account.time_to_freeze_seconds
        })
        
        total_secured += account.current_balance or 0
    
    # Calculate processing time
    freeze_time_ms = int((time.time() - start_time) * 1000)
    
    # Update freeze request
    from datetime import timezone
    now_utc = datetime.now(timezone.utc)
    freeze_req.status = FreezeStatus.COMPLETED.value
    freeze_req.npci_reference = f"FREEZE-{uuid.uuid4().hex[:8].upper()}"
    freeze_req.freeze_time_ms = freeze_time_ms
    freeze_req.total_amount_secured = total_secured
    freeze_req.accounts_frozen_count = len(frozen_accounts)
    freeze_req.completed_at = now_utc
    
    if freeze_request.freeze_type == FreezeType.TEMPORARY.value:
        freeze_req.expires_at = now_utc + timedelta(hours=freeze_request.duration_hours)
    
    await db.commit()
    
    return {
        "success": True,
        "data": {
            "freeze_id": str(freeze_req.id),
            "npci_reference": freeze_req.npci_reference,
            "status": "COMPLETED",
            "accounts_frozen": len(frozen_accounts),
            "total_amount_secured": total_secured,
            "freeze_time_ms": freeze_time_ms,
            "frozen_accounts": frozen_accounts,
            "expires_at": freeze_req.expires_at.isoformat() if freeze_req.expires_at else None,
            "time_to_freeze_details": [
                {
                    "account_number": fa["account_number"],
                    "time_to_freeze_seconds": fa.get("time_to_freeze_seconds"),
                    "frozen_at": fa["frozen_at"],
                    "case_created_at": case.created_at.isoformat() if case else None
                }
                for fa in frozen_accounts
            ],
            "message": f"Successfully frozen {len(frozen_accounts)} account(s). Amount secured: ₹{total_secured:,.2f}"
        }
    }


@router.post("/accounts/{account_id}/freeze")
async def freeze_single_account(
    account_id: str,
    freeze_request: FreezeAccountRequest,
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    db: AsyncSession = Depends(get_db)
):
    """
    Freeze a single account by ID.
    """
    try:
        account_uuid = uuid.UUID(account_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid account ID format"
        )
    
    # Get the account
    result = await db.execute(
        select(MuleAccount).where(MuleAccount.id == account_uuid)
    )
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    if account.status == MuleAccountStatus.FROZEN.value:
        return {
            "success": True,
            "data": {
                "message": "Account is already frozen",
                "account_id": str(account.id),
                "status": account.status
            }
        }
    
    # Create freeze request record
    freeze_req = FreezeRequest(
        case_id=account.case_id,
        account_ids=json.dumps([str(account.id)]),
        freeze_type=freeze_request.freeze_type,
        duration_hours=freeze_request.duration_hours,
        reason=freeze_request.reason,
        status=FreezeStatus.PROCESSING.value,
        requested_by=current_officer.id
    )
    db.add(freeze_req)
    
    # Check if account is already frozen
    existing_frozen = await db.execute(
        select(FrozenAccount).where(
            FrozenAccount.account_number == account.account_number,
            FrozenAccount.case_id == account.case_id,
            FrozenAccount.is_active == True
        )
    )
    if existing_frozen.scalar_one_or_none():
        return {
            "success": True,
            "data": {
                "message": "Account is already frozen",
                "account_id": str(account.id),
                "status": "FROZEN"
            }
        }
    
    # Get case for case_created_at
    case_result = await db.execute(
        select(Case).where(Case.id == account.case_id)
    )
    case = case_result.scalar_one_or_none()
    
    # Freeze the account
    import time
    from datetime import timezone
    start_time = time.time()
    freeze_time_utc = datetime.now(timezone.utc)
    
    account.status = MuleAccountStatus.FROZEN.value
    account.freeze_timestamp = freeze_time_utc
    account.npci_reference = f"NPCI-{uuid.uuid4().hex[:12].upper()}"
    
    # Create FrozenAccount record for transaction blocking
    frozen_account = FrozenAccount(
        account_number=account.account_number,
        bank_name=account.bank_name,
        case_id=account.case_id,
        freeze_request_id=freeze_req.id,
        frozen_at=freeze_time_utc,
        frozen_by=current_officer.id,
        case_created_at=case.created_at if case else None,
        is_active=True
    )
    db.add(frozen_account)
    
    amount_secured = account.current_balance or 0
    freeze_time_ms = int((time.time() - start_time) * 1000)
    
    # Update freeze request
    now_utc = datetime.now(timezone.utc)
    freeze_req.status = FreezeStatus.COMPLETED.value
    freeze_req.npci_reference = account.npci_reference
    freeze_req.freeze_time_ms = freeze_time_ms
    freeze_req.total_amount_secured = amount_secured
    freeze_req.accounts_frozen_count = 1
    freeze_req.completed_at = now_utc
    
    if freeze_request.freeze_type == FreezeType.TEMPORARY.value:
        freeze_req.expires_at = now_utc + timedelta(hours=freeze_request.duration_hours)
    
    await db.commit()
    
    return {
        "success": True,
        "data": {
            "freeze_id": str(freeze_req.id),
            "account_id": str(account.id),
            "account_number": account.account_number,
            "bank": account.bank_name,
            "npci_reference": account.npci_reference,
            "amount_secured": amount_secured,
            "freeze_time_ms": freeze_time_ms,
            "frozen_at": account.freeze_timestamp.isoformat(),
            "expires_at": freeze_req.expires_at.isoformat() if freeze_req.expires_at else None,
            "message": f"Account frozen successfully. Amount secured: ₹{amount_secured:,.2f}"
        }
    }


@router.get("/cases/{case_id}/freeze-status")
async def get_freeze_status(
    case_id: str,
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    db: AsyncSession = Depends(get_db)
):
    """
    Get freeze status for all accounts in a case.
    """
    try:
        case_uuid = uuid.UUID(case_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid case ID format"
        )
    
    # Get all mule accounts for the case
    result = await db.execute(
        select(MuleAccount).where(MuleAccount.case_id == case_uuid)
    )
    accounts = result.scalars().all()
    
    # Get freeze requests
    result = await db.execute(
        select(FreezeRequest)
        .where(FreezeRequest.case_id == case_uuid)
        .order_by(FreezeRequest.created_at.desc())
    )
    freeze_requests = result.scalars().all()
    
    # Get frozen accounts for time-to-freeze calculation
    result = await db.execute(
        select(FrozenAccount).where(
            FrozenAccount.case_id == case_uuid,
            FrozenAccount.is_active == True
        )
    )
    frozen_accounts = result.scalars().all()
    
    # Create map of account_number -> time_to_freeze
    frozen_map = {fa.account_number: fa.time_to_freeze_seconds for fa in frozen_accounts}
    
    frozen_count = sum(1 for a in accounts if a.status == MuleAccountStatus.FROZEN.value)
    active_count = sum(1 for a in accounts if a.status == MuleAccountStatus.ACTIVE.value)
    total_secured = sum(a.current_balance or 0 for a in accounts if a.status == MuleAccountStatus.FROZEN.value)
    
    return {
        "success": True,
        "data": {
            "case_id": str(case_uuid),
            "summary": {
                "total_accounts": len(accounts),
                "frozen": frozen_count,
                "active": active_count,
                "total_amount_secured": total_secured
            },
            "accounts": [
                {
                    "id": str(a.id),
                    "account_number": a.account_number,
                    "bank": a.bank_name,
                    "status": a.status,
                    "current_balance": a.current_balance,
                    "mule_confidence": a.mule_confidence,
                    "frozen_at": a.freeze_timestamp.isoformat() if a.freeze_timestamp else None,
                    "npci_reference": a.npci_reference,
                    "time_to_freeze_seconds": frozen_map.get(a.account_number),
                    "time_to_freeze_formatted": format_duration(frozen_map.get(a.account_number)) if frozen_map.get(a.account_number) else None
                }
                for a in accounts
            ],
            "freeze_history": [
                {
                    "id": str(f.id),
                    "status": f.status,
                    "accounts_frozen": f.accounts_frozen_count,
                    "amount_secured": f.total_amount_secured,
                    "freeze_time_ms": f.freeze_time_ms,
                    "created_at": f.created_at.isoformat(),
                    "expires_at": f.expires_at.isoformat() if f.expires_at else None
                }
                for f in freeze_requests
            ]
        }
    }


@router.post("/accounts/{account_id}/unfreeze")
async def unfreeze_account(
    account_id: str,
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    db: AsyncSession = Depends(get_db)
):
    """
    Unfreeze a frozen account (requires proper authorization).
    """
    try:
        account_uuid = uuid.UUID(account_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid account ID format"
        )
    
    # Get the account
    result = await db.execute(
        select(MuleAccount).where(MuleAccount.id == account_uuid)
    )
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    if account.status != MuleAccountStatus.FROZEN.value:
        return {
            "success": True,
            "data": {
                "message": "Account is not frozen",
                "account_id": str(account.id),
                "status": account.status
            }
        }
    
    # Mark FrozenAccount as inactive (unfreeze)
    frozen_result = await db.execute(
        select(FrozenAccount).where(
            FrozenAccount.account_number == account.account_number,
            FrozenAccount.case_id == account.case_id,
            FrozenAccount.is_active == True
        )
    )
    frozen_accounts = frozen_result.scalars().all()
    for fa in frozen_accounts:
        fa.is_active = False
    
    # Unfreeze the account
    account.status = MuleAccountStatus.ACTIVE.value
    
    await db.commit()
    
    return {
        "success": True,
        "data": {
            "account_id": str(account.id),
            "account_number": account.account_number,
            "bank": account.bank_name,
            "status": "ACTIVE",
            "message": "Account unfrozen successfully"
        }
    }

