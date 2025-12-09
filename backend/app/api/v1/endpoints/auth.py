"""
Authentication Endpoints
"""

from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.postgresql import get_db
from app.models.officer import Officer
from app.core.security import (
    verify_password,
    create_access_token,
)
from app.core.config import settings
from app.core.auth import get_current_officer  # Re-export for backward compatibility
from app.schemas.auth import Token, TokenData, LoginRequest, LoginResponse
from app.schemas.officer import OfficerResponse

router = APIRouter()

# Re-export get_current_officer for backward compatibility
__all__ = ['router', 'get_current_officer']


@router.post("/login")
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticate officer and return JWT token.
    
    - **username**: Badge ID or email
    - **password**: Officer password
    """
    # Find officer by badge_id or email
    result = await db.execute(
        select(Officer).where(
            (Officer.badge_id == form_data.username) |
            (Officer.email == form_data.username)
        )
    )
    officer = result.scalar_one_or_none()
    
    if not officer:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not verify_password(form_data.password, officer.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not officer.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Officer account is deactivated"
        )
    
    # Create access token
    access_token = create_access_token(
        subject=str(officer.id),
        expires_delta=timedelta(minutes=settings.jwt_access_token_expire_minutes),
        additional_claims={"badge_id": officer.badge_id}
    )
    
    # Return OAuth2-compatible response (Swagger expects this format)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.jwt_access_token_expire_minutes * 60,
        "officer": OfficerResponse.model_validate(officer).model_dump()
    }


@router.post("/logout")
async def logout(
    current_officer: Annotated[Officer, Depends(get_current_officer)]
):
    """
    Logout current officer.
    In a stateless JWT setup, this is mainly for client-side token removal.
    """
    # In production, you might want to blacklist the token
    return {
        "success": True,
        "message": "Logged out successfully"
    }


@router.get("/me", response_model=OfficerResponse)
async def get_current_officer_info(
    current_officer: Annotated[Officer, Depends(get_current_officer)]
):
    """Get current authenticated officer information"""
    return OfficerResponse.model_validate(current_officer)

