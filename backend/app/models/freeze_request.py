"""
Freeze Request Model - Account freeze tracking
"""

import uuid
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Float, Integer, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.case import Case
    from app.models.officer import Officer


class FreezeType(str, enum.Enum):
    """Type of freeze"""
    TEMPORARY = "TEMPORARY"
    PERMANENT = "PERMANENT"


class FreezeStatus(str, enum.Enum):
    """Freeze request status"""
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    EXPIRED = "EXPIRED"
    RELEASED = "RELEASED"


class FreezeRequest(BaseModel):
    """Freeze Request entity - tracks account freeze operations"""
    
    __tablename__ = "freeze_requests"
    
    # Case Reference
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Accounts to freeze (stored as JSON string of UUIDs)
    account_ids: Mapped[Optional[str]] = mapped_column(Text)  # JSON array of UUIDs
    
    # Freeze Details
    freeze_type: Mapped[str] = mapped_column(String(20), default=FreezeType.TEMPORARY.value)
    duration_hours: Mapped[int] = mapped_column(Integer, default=72)
    reason: Mapped[Optional[str]] = mapped_column(Text)
    
    # Status
    status: Mapped[str] = mapped_column(String(20), default=FreezeStatus.PENDING.value, index=True)
    
    # NPCI Response
    npci_reference: Mapped[Optional[str]] = mapped_column(String(100))
    
    # Performance
    freeze_time_ms: Mapped[Optional[int]] = mapped_column(Integer)
    
    # Result
    total_amount_secured: Mapped[float] = mapped_column(Float, default=0.0)
    accounts_frozen_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Requester
    requested_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("officers.id"),
        nullable=True
    )
    
    # Timestamps
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    # Relationships
    case: Mapped["Case"] = relationship(back_populates="freeze_requests")
    requested_by_officer: Mapped[Optional["Officer"]] = relationship(back_populates="freeze_requests")
    frozen_accounts: Mapped[List["FrozenAccount"]] = relationship(back_populates="freeze_request", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<FreezeRequest {self.status}>"
