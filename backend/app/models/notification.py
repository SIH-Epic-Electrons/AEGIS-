"""
Notification Model
"""

import uuid
from datetime import datetime
from typing import Optional, Dict, Any, TYPE_CHECKING
from sqlalchemy import String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.officer import Officer
    from app.models.case import Case


class NotificationType(str, enum.Enum):
    """Notification type"""
    ALERT = "ALERT"
    INFO = "INFO"
    SUCCESS = "SUCCESS"
    WARNING = "WARNING"
    ERROR = "ERROR"


class NotificationPriority(str, enum.Enum):
    """Notification priority"""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    NORMAL = "NORMAL"
    LOW = "LOW"


class Notification(BaseModel):
    """Notification entity"""
    
    __tablename__ = "notifications"
    
    # Recipient
    officer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("officers.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Related Case (optional)
    case_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cases.id", ondelete="SET NULL"),
        nullable=True
    )
    
    # Content
    type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(String(20), default=NotificationPriority.NORMAL.value)
    
    # Additional data for deep linking
    data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    
    # Read Status
    read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    # Relationships
    officer: Mapped["Officer"] = relationship(back_populates="notifications")
    case: Mapped[Optional["Case"]] = relationship(back_populates="notifications")
    
    def __repr__(self) -> str:
        return f"<Notification {self.type}: {self.title[:30]}>"
