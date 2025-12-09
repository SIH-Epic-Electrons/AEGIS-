"""
Case Action Model - Audit log for all case actions
"""

import uuid
from typing import Optional, Dict, Any, TYPE_CHECKING
from sqlalchemy import String, Boolean, Integer, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.case import Case
    from app.models.officer import Officer


class ActionType(str, enum.Enum):
    """Type of action taken on a case"""
    CASE_CREATED = "CASE_CREATED"
    AI_ANALYSIS_STARTED = "AI_ANALYSIS_STARTED"
    AI_ANALYSIS_COMPLETED = "AI_ANALYSIS_COMPLETED"
    OFFICER_ASSIGNED = "OFFICER_ASSIGNED"
    TEAM_DEPLOYED = "TEAM_DEPLOYED"
    FREEZE_INITIATED = "FREEZE_INITIATED"
    FREEZE_COMPLETED = "FREEZE_COMPLETED"
    ALERT_SENT = "ALERT_SENT"
    MESSAGE_SENT = "MESSAGE_SENT"
    CALL_MADE = "CALL_MADE"
    LOCATION_UPDATED = "LOCATION_UPDATED"
    STATUS_CHANGED = "STATUS_CHANGED"
    OUTCOME_RECORDED = "OUTCOME_RECORDED"
    CASE_CLOSED = "CASE_CLOSED"
    NOTE_ADDED = "NOTE_ADDED"


class CaseAction(BaseModel):
    """Case Action audit log entity"""
    
    __tablename__ = "case_actions"
    
    # Case Reference
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Action Details
    action_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    action_details: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    
    # Who performed the action
    performed_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("officers.id"),
        nullable=True
    )
    
    # System/automated action flag
    is_automated: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Result
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    
    # Performance
    response_time_ms: Mapped[Optional[int]] = mapped_column(Integer)
    
    # Relationships
    case: Mapped["Case"] = relationship(back_populates="actions")
    performed_by_officer: Mapped[Optional["Officer"]] = relationship(back_populates="case_actions")
    
    def __repr__(self) -> str:
        return f"<CaseAction {self.action_type} on {self.case_id}>"
