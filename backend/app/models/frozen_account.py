"""
Frozen Account Model - Tracks frozen accounts to block transactions
"""

import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.case import Case
    from app.models.freeze_request import FreezeRequest


class FrozenAccount(BaseModel):
    """Frozen Account entity - tracks frozen account numbers to block transactions"""
    
    __tablename__ = "frozen_accounts"
    
    # Account identifier (account number)
    account_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    bank_name: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    
    # Case Reference
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Freeze Request Reference
    freeze_request_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("freeze_requests.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    
    # Freeze Details
    frozen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    frozen_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("officers.id", ondelete="SET NULL"),
        nullable=True
    )
    
    # Case creation timestamp (to calculate duration)
    case_created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    # Status
    is_active: Mapped[bool] = mapped_column(default=True, index=True)  # False if unfrozen
    
    # Relationships
    case: Mapped["Case"] = relationship(back_populates="frozen_accounts")
    freeze_request: Mapped[Optional["FreezeRequest"]] = relationship(back_populates="frozen_accounts")
    
    # Unique constraint: same account can only be frozen once per case (active)
    __table_args__ = (
        UniqueConstraint('account_number', 'case_id', 'is_active', 
                        name='uq_frozen_account_case_active'),
        Index('idx_frozen_account_number_active', 'account_number', 'is_active'),
    )
    
    def __repr__(self) -> str:
        return f"<FrozenAccount {self.account_number} (Case: {self.case_id})>"
    
    @property
    def time_to_freeze_seconds(self) -> Optional[float]:
        """Calculate time from case creation to freeze action in seconds"""
        if self.case_created_at and self.frozen_at:
            # Handle timezone-aware/naive datetime mismatch
            frozen_at = self.frozen_at
            case_created_at = self.case_created_at
            
            # Convert both to timezone-aware if needed
            if frozen_at.tzinfo is None and case_created_at.tzinfo is not None:
                from datetime import timezone
                frozen_at = frozen_at.replace(tzinfo=timezone.utc)
            elif case_created_at.tzinfo is None and frozen_at.tzinfo is not None:
                from datetime import timezone
                case_created_at = case_created_at.replace(tzinfo=timezone.utc)
            
            return (frozen_at - case_created_at).total_seconds()
        return None

