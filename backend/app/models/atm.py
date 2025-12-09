"""
ATM Model
"""

import uuid
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Float, Boolean, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.case import Case


class ATMType(str, enum.Enum):
    """ATM location type"""
    BRANCH = "BRANCH"
    MALL = "MALL"
    STANDALONE = "STANDALONE"
    KIOSK = "KIOSK"
    HOSPITAL = "HOSPITAL"
    RAILWAY = "RAILWAY"
    AIRPORT = "AIRPORT"


class ATM(BaseModel):
    """ATM location entity"""
    
    __tablename__ = "atms"
    
    # Identity
    bank_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    atm_id: Mapped[Optional[str]] = mapped_column(String(50), unique=True, index=True)
    
    # Location Name
    name: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Address
    address: Mapped[Optional[str]] = mapped_column(Text)
    city: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    state: Mapped[Optional[str]] = mapped_column(String(100))
    pincode: Mapped[Optional[str]] = mapped_column(String(10))
    
    # Coordinates
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    
    # Type
    atm_type: Mapped[Optional[str]] = mapped_column(String(20), default=ATMType.STANDALONE.value)
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Nearest Station
    nearest_station_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("police_stations.id"),
        nullable=True
    )
    
    # Relationships
    predicted_cases: Mapped[List["Case"]] = relationship(back_populates="predicted_atm")
    
    def __repr__(self) -> str:
        return f"<ATM {self.bank_name} - {self.name or self.atm_id}>"
