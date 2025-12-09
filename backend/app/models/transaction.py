"""
Transaction Model - Money trail tracking
"""

import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Float, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.case import Case


class TransactionType(str, enum.Enum):
    """Transaction type enumeration"""
    IMPS = "IMPS"
    NEFT = "NEFT"
    RTGS = "RTGS"
    UPI = "UPI"
    CARD = "CARD"
    CASH = "CASH"
    OTHER = "OTHER"


class TransactionStatus(str, enum.Enum):
    """Transaction status"""
    COMPLETED = "COMPLETED"
    PENDING = "PENDING"
    FAILED = "FAILED"
    REVERSED = "REVERSED"


class Transaction(BaseModel):
    """Transaction entity - tracks money flow"""
    
    __tablename__ = "transactions"
    
    # Case Reference
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # From Account
    from_account: Mapped[Optional[str]] = mapped_column(String(50))
    from_bank: Mapped[Optional[str]] = mapped_column(String(100))
    from_ifsc: Mapped[Optional[str]] = mapped_column(String(20))
    from_holder_name: Mapped[Optional[str]] = mapped_column(String(255))
    from_balance_before: Mapped[Optional[float]] = mapped_column(Float)  # Balance before transaction
    from_balance_after: Mapped[Optional[float]] = mapped_column(Float)  # Balance after transaction
    from_location: Mapped[Optional[dict]] = mapped_column(JSONB)  # Location data: {city, state, latitude, longitude}
    
    # To Account
    to_account: Mapped[Optional[str]] = mapped_column(String(50))
    to_bank: Mapped[Optional[str]] = mapped_column(String(100))
    to_ifsc: Mapped[Optional[str]] = mapped_column(String(20))
    to_holder_name: Mapped[Optional[str]] = mapped_column(String(255))
    to_balance_before: Mapped[Optional[float]] = mapped_column(Float)  # Balance before transaction
    to_balance_after: Mapped[Optional[float]] = mapped_column(Float)  # Balance after transaction
    to_location: Mapped[Optional[dict]] = mapped_column(JSONB)  # Location data: {city, state, latitude, longitude}
    
    # Amount
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    
    # Transaction Details
    transaction_type: Mapped[Optional[str]] = mapped_column(String(20))
    transaction_id: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    utr_number: Mapped[Optional[str]] = mapped_column(String(50))
    
    # Timestamp
    transaction_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    
    # Chain Position
    hop_number: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # Split Information (for money splitting scenarios)
    split_group_id: Mapped[Optional[str]] = mapped_column(String(50), index=True)  # Groups transactions that split from same source
    split_index: Mapped[Optional[int]] = mapped_column(Integer)  # Index within split group (0, 1, 2...)
    split_total: Mapped[Optional[int]] = mapped_column(Integer)  # Total number of splits in this group
    
    # Status
    status: Mapped[str] = mapped_column(String(20), default=TransactionStatus.COMPLETED.value)
    
    # Relationships
    case: Mapped["Case"] = relationship(back_populates="transactions")
    
    def __repr__(self) -> str:
        return f"<Transaction {self.transaction_id}: ₹{self.amount} (hop {self.hop_number})>"
