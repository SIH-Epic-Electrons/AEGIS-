"""
Police Station Model
"""

from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Float, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.officer import Officer
    from app.models.team import Team


class PoliceStation(BaseModel):
    """Police Station entity"""
    
    __tablename__ = "police_stations"
    
    # Basic Info
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[Optional[str]] = mapped_column(String(50), unique=True, index=True)
    
    # Location
    city: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    district: Mapped[Optional[str]] = mapped_column(String(100))
    pincode: Mapped[Optional[str]] = mapped_column(String(10))
    address: Mapped[Optional[str]] = mapped_column(Text)
    
    # Coordinates
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)
    
    # Jurisdiction
    jurisdiction_radius_km: Mapped[Optional[float]] = mapped_column(Float, default=10.0)
    
    # Contact
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Relationships
    officers: Mapped[List["Officer"]] = relationship(back_populates="station")
    teams: Mapped[List["Team"]] = relationship(back_populates="station")
    
    def __repr__(self) -> str:
        return f"<PoliceStation {self.name} ({self.city})>"
