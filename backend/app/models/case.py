"""
Case Model - Core entity for fraud cases
"""

import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any, TYPE_CHECKING
from sqlalchemy import String, Float, Integer, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.atm import ATM
    from app.models.officer import Officer
    from app.models.team import Team
    from app.models.transaction import Transaction
    from app.models.mule_account import MuleAccount
    from app.models.notification import Notification
    from app.models.case_action import CaseAction
    from app.models.freeze_request import FreezeRequest
    from app.models.ai_prediction import AIPrediction


class CaseStatus(str, enum.Enum):
    """Case status enumeration"""
    NEW = "NEW"
    AI_ANALYZING = "AI_ANALYZING"
    IN_PROGRESS = "IN_PROGRESS"
    TEAM_DEPLOYED = "TEAM_DEPLOYED"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"
    CANCELLED = "CANCELLED"


class CasePriority(str, enum.Enum):
    """Case priority enumeration"""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class FraudType(str, enum.Enum):
    """Fraud type enumeration"""
    OTP_FRAUD = "OTP_FRAUD"
    VISHING = "VISHING"
    PHISHING = "PHISHING"
    LOAN_FRAUD = "LOAN_FRAUD"
    INVESTMENT_FRAUD = "INVESTMENT_FRAUD"
    KYC_FRAUD = "KYC_FRAUD"
    CARD_FRAUD = "CARD_FRAUD"
    UPI_FRAUD = "UPI_FRAUD"
    OTHER = "OTHER"


class CaseOutcome(str, enum.Enum):
    """Case outcome enumeration"""
    SUCCESS = "SUCCESS"
    PARTIAL_SUCCESS = "PARTIAL_SUCCESS"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    NO_WITHDRAWAL = "NO_WITHDRAWAL"


class Case(BaseModel):
    """Fraud Case entity - main tracking unit"""
    
    __tablename__ = "cases"
    
    # Case Identity
    case_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    
    # Status
    status: Mapped[str] = mapped_column(String(20), default=CaseStatus.NEW.value, index=True)
    priority: Mapped[str] = mapped_column(String(20), default=CasePriority.MEDIUM.value, index=True)
    
    # ===== Complaint Details (from NCRP) =====
    ncrp_complaint_id: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    fraud_type: Mapped[Optional[str]] = mapped_column(String(30), index=True)
    fraud_amount: Mapped[float] = mapped_column(Float, nullable=False)
    fraud_description: Mapped[Optional[str]] = mapped_column(Text)
    complaint_timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    # ===== Destination Account (where victim's money first went) =====
    # This is CRITICAL - needed to start CFCFRMS money trail trace
    destination_account: Mapped[Optional[str]] = mapped_column(String(30), index=True)
    destination_bank: Mapped[Optional[str]] = mapped_column(String(100))
    destination_ifsc: Mapped[Optional[str]] = mapped_column(String(20))
    destination_upi: Mapped[Optional[str]] = mapped_column(String(100))  # If UPI fraud
    
    # ===== Victim Information =====
    victim_name: Mapped[Optional[str]] = mapped_column(String(255))
    victim_phone: Mapped[Optional[str]] = mapped_column(String(20))
    victim_email: Mapped[Optional[str]] = mapped_column(String(255))
    victim_city: Mapped[Optional[str]] = mapped_column(String(100))
    victim_state: Mapped[Optional[str]] = mapped_column(String(100))
    victim_lat: Mapped[Optional[float]] = mapped_column(Float)
    victim_lon: Mapped[Optional[float]] = mapped_column(Float)
    
    # ===== AI Predictions =====
    predicted_atm_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("atms.id"),
        nullable=True
    )
    predicted_time_start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    predicted_time_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    location_confidence: Mapped[Optional[float]] = mapped_column(Float)
    
    # Alternative predictions (JSON array)
    alternative_predictions: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    
    # ===== Assignment =====
    assigned_officer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("officers.id"),
        nullable=True
    )
    assigned_team_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teams.id"),
        nullable=True
    )
    
    # ===== Outcome =====
    outcome: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    money_recovered: Mapped[float] = mapped_column(Float, default=0.0)
    suspects_caught: Mapped[int] = mapped_column(Integer, default=0)
    location_prediction_correct: Mapped[Optional[int]] = mapped_column(Integer)
    outcome_notes: Mapped[Optional[str]] = mapped_column(Text)
    actual_location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Actual ATM/location where withdrawal happened
    
    # ===== Timestamps =====
    ai_analysis_completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    first_action_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    # ===== Relationships =====
    predicted_atm: Mapped[Optional["ATM"]] = relationship(back_populates="predicted_cases")
    assigned_officer: Mapped[Optional["Officer"]] = relationship(back_populates="assigned_cases")
    assigned_team: Mapped[Optional["Team"]] = relationship(
        back_populates="assigned_cases",
        foreign_keys=[assigned_team_id]
    )
    
    transactions: Mapped[List["Transaction"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    mule_accounts: Mapped[List["MuleAccount"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    notifications: Mapped[List["Notification"]] = relationship(back_populates="case")
    actions: Mapped[List["CaseAction"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    freeze_requests: Mapped[List["FreezeRequest"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    frozen_accounts: Mapped[List["FrozenAccount"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    ai_predictions: Mapped[List["AIPrediction"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<Case {self.case_number} ({self.status})>"
    
    @property
    def recovery_rate(self) -> float:
        """Calculate recovery rate percentage"""
        if self.fraud_amount and self.fraud_amount > 0:
            return (self.money_recovered / self.fraud_amount) * 100
        return 0.0
    
    @property
    def is_active(self) -> bool:
        """Check if case is still active"""
        return self.status in [
            CaseStatus.NEW.value,
            CaseStatus.AI_ANALYZING.value,
            CaseStatus.IN_PROGRESS.value,
            CaseStatus.TEAM_DEPLOYED.value
        ]
