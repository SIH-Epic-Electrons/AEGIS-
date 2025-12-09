"""
Authentication Schemas
"""

from typing import Optional, Any
from pydantic import BaseModel, EmailStr


class Token(BaseModel):
    """JWT Token response"""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Token payload data"""
    officer_id: Optional[str] = None
    badge_id: Optional[str] = None


class LoginRequest(BaseModel):
    """Login request body"""
    badge_id: str
    password: str
    device_token: Optional[str] = None


class LoginResponse(BaseModel):
    """Login response"""
    success: bool
    data: dict

