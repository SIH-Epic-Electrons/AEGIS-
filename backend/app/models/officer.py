"""
Officer Model
"""

import uuid
from typing import Optional, List, Dict, Any, TYPE_CHECKING
from sqlalchemy import String, Boolean, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.station import PoliceStation
    from app.models.team import Team
    from app.models.case import Case
    from app.models.notification import Notification
    from app.models.case_action import CaseAction
    from app.models.freeze_request import FreezeRequest


class Officer(BaseModel):
    """Law Enforcement Officer entity"""
    
    __tablename__ = "officers"
    
    # Authentication
    badge_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Profile
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    rank: Mapped[Optional[str]] = mapped_column(String(100))
    designation: Mapped[Optional[str]] = mapped_column(String(100))
    avatar_url: Mapped[Optional[str]] = mapped_column(Text)
    
    # Station
    station_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("police_stations.id"),
        nullable=True
    )
    
    # Push Notifications
    device_token: Mapped[Optional[str]] = mapped_column(Text)
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Settings (JSON)
    settings: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB,
        default={
            "notifications_enabled": True,
            "sound_alerts": True,
            "dark_mode": False,
            "language": "en"
        }
    )
    
    # Relationships
    station: Mapped[Optional["PoliceStation"]] = relationship(back_populates="officers")
    led_teams: Mapped[List["Team"]] = relationship(back_populates="leader")
    assigned_cases: Mapped[List["Case"]] = relationship(back_populates="assigned_officer")
    notifications: Mapped[List["Notification"]] = relationship(back_populates="officer")
    case_actions: Mapped[List["CaseAction"]] = relationship(back_populates="performed_by_officer")
    freeze_requests: Mapped[List["FreezeRequest"]] = relationship(back_populates="requested_by_officer")
    
    def __repr__(self) -> str:
        return f"<Officer {self.badge_id}: {self.name}>"
