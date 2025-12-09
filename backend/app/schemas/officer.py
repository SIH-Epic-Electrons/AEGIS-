"""
Officer Schemas
"""

from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, EmailStr


class OfficerBase(BaseModel):
    """Base officer schema"""
    badge_id: str
    name: str
    email: EmailStr
    phone: Optional[str] = None
    rank: Optional[str] = None
    designation: Optional[str] = None


class OfficerCreate(OfficerBase):
    """Schema for creating an officer"""
    password: str
    station_id: Optional[UUID] = None


class OfficerUpdate(BaseModel):
    """Schema for updating officer profile"""
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class OfficerResponse(BaseModel):
    """Officer response schema"""
    id: UUID
    badge_id: str
    name: str
    email: str
    phone: Optional[str] = None
    rank: Optional[str] = None
    designation: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool
    settings: Optional[Dict[str, Any]] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

