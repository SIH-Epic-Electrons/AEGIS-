"""
Team Model
"""

import uuid
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Float, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.officer import Officer
    from app.models.station import PoliceStation
    from app.models.case import Case


class TeamStatus(str, enum.Enum):
    """Team status enumeration"""
    AVAILABLE = "AVAILABLE"
    DEPLOYED = "DEPLOYED"
    EN_ROUTE = "EN_ROUTE"
    ON_SITE = "ON_SITE"
    ENGAGED = "ENGAGED"
    OFF_DUTY = "OFF_DUTY"


class Team(BaseModel):
    """Field Team entity"""
    
    __tablename__ = "teams"
    
    # Identity
    team_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    team_name: Mapped[str] = mapped_column(String(100), nullable=False)
    
    # Leadership
    leader_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("officers.id"),
        nullable=True
    )
    
    # Station
    station_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("police_stations.id"),
        nullable=True
    )
    
    # Status
    status: Mapped[str] = mapped_column(String(20), default=TeamStatus.AVAILABLE.value, index=True)
    
    # Current Location
    current_lat: Mapped[Optional[float]] = mapped_column(Float)
    current_lon: Mapped[Optional[float]] = mapped_column(Float)
    
    # Communication
    radio_channel: Mapped[Optional[str]] = mapped_column(String(50))
    
    # Capacity
    members_count: Mapped[int] = mapped_column(Integer, default=1)
    
    # Vehicle
    vehicle_number: Mapped[Optional[str]] = mapped_column(String(20))
    
    # Current Assignment
    current_case_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cases.id", use_alter=True),
        nullable=True
    )
    
    # Relationships
    leader: Mapped[Optional["Officer"]] = relationship(back_populates="led_teams")
    station: Mapped[Optional["PoliceStation"]] = relationship(back_populates="teams")
    assigned_cases: Mapped[List["Case"]] = relationship(
        back_populates="assigned_team",
        foreign_keys="Case.assigned_team_id"
    )
    
    def __repr__(self) -> str:
        return f"<Team {self.team_code}: {self.team_name}>"
