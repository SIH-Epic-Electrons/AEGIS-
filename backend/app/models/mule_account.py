"""
Mule Account Model - Suspected fraud accounts
"""

import uuid
from datetime import datetime
from typing import Optional, Dict, Any, TYPE_CHECKING
from sqlalchemy import String, Float, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.case import Case


class MuleAccountStatus(str, enum.Enum):
    """Mule account status"""
    ACTIVE = "ACTIVE"
    FROZEN = "FROZEN"
    WITHDRAWN = "WITHDRAWN"
    BLOCKED = "BLOCKED"


class MuleAccount(BaseModel):
    """Mule Account entity - suspected fraud recipient accounts"""
    
    __tablename__ = "mule_accounts"
    
    # Case Reference
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Account Details
    account_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    bank_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    ifsc_code: Mapped[Optional[str]] = mapped_column(String(20))
    holder_name: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Amount Tracking
    amount_received: Mapped[Optional[float]] = mapped_column(Float)
    current_balance: Mapped[Optional[float]] = mapped_column(Float)
    
    # Status
    status: Mapped[str] = mapped_column(String(20), default=MuleAccountStatus.ACTIVE.value, index=True)
    
    # Freeze Details
    freeze_timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    npci_reference: Mapped[Optional[str]] = mapped_column(String(100))
    
    # AI Classification
    mule_confidence: Mapped[Optional[float]] = mapped_column(Float)
    risk_indicators: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    
    # Location Info (from KYC)
    registered_city: Mapped[Optional[str]] = mapped_column(String(100))
    registered_state: Mapped[Optional[str]] = mapped_column(String(100))
    registered_lat: Mapped[Optional[float]] = mapped_column(Float)
    registered_lon: Mapped[Optional[float]] = mapped_column(Float)
    
    # Account Metadata
    account_age_days: Mapped[Optional[int]] = mapped_column(Integer)
    
    # Chain Position
    hop_number: Mapped[Optional[int]] = mapped_column(Integer)
    
    # Relationships
    case: Mapped["Case"] = relationship(back_populates="mule_accounts")
    
    def __repr__(self) -> str:
        return f"<MuleAccount {self.bank_name} - XXXX{self.account_number[-4:]} ({self.status})>"
    
    @property
    def is_freezable(self) -> bool:
        """Check if account can be frozen"""
        return self.status == MuleAccountStatus.ACTIVE.value and (self.current_balance or 0) > 0
