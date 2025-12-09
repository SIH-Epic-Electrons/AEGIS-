"""
Shared Authentication Dependencies

This module contains authentication dependencies that can be used across
the application without causing circular imports.
"""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.postgresql import get_db
from app.models.officer import Officer
from app.core.security import verify_token
from app.core.config import settings

# OAuth2 scheme - tokenUrl should match the login endpoint
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_v1_prefix}/auth/login")


async def get_current_officer(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: AsyncSession = Depends(get_db)
) -> Officer:
    """
    Dependency to get current authenticated officer.
    
    This is a shared dependency that can be used across all API endpoints
    without causing circular imports.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # verify_token returns the officer ID string (from JWT 'sub' field)
    officer_id = verify_token(token)
    if officer_id is None:
        raise credentials_exception
    
    result = await db.execute(
        select(Officer).where(Officer.id == officer_id)
    )
    officer = result.scalar_one_or_none()
    
    if officer is None:
        raise credentials_exception
    
    if not officer.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Officer account is deactivated"
        )
    
    return officer


async def get_current_officer_optional(
    token: Annotated[str | None, Depends(OAuth2PasswordBearer(tokenUrl=f"{settings.api_v1_prefix}/auth/login", auto_error=False))] = None,
    db: AsyncSession = Depends(get_db)
) -> Officer | None:
    """
    Optional authentication dependency.
    Returns None if no valid token provided instead of raising an exception.
    """
    if token is None:
        return None
    
    try:
        officer_id = verify_token(token)
        if officer_id is None:
            return None
        
        result = await db.execute(
            select(Officer).where(Officer.id == officer_id)
        )
        officer = result.scalar_one_or_none()
        
        if officer is None or not officer.is_active:
            return None
        
        return officer
    except Exception:
        return None

