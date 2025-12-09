"""
AI Prediction Model - Tracks all AI model predictions for analysis
"""

import uuid
from datetime import datetime
from typing import Optional, Dict, Any, TYPE_CHECKING
from sqlalchemy import String, Float, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.case import Case


class AIPrediction(BaseModel):
    """AI Prediction log entity - for model performance tracking"""
    
    __tablename__ = "ai_predictions"
    
    # Case Reference
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Model Information
    model_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    model_version: Mapped[Optional[str]] = mapped_column(String(50))
    
    # Input Features (anonymized)
    input_features: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    
    # Prediction Output
    prediction_output: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    confidence_score: Mapped[Optional[float]] = mapped_column(Float)
    
    # Performance
    inference_time_ms: Mapped[Optional[int]] = mapped_column(Integer)
    
    # Feedback for model improvement (filled after case resolution)
    was_correct: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    actual_outcome: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    feedback_timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    # Relationships
    case: Mapped["Case"] = relationship(back_populates="ai_predictions")
    
    def __repr__(self) -> str:
        conf = self.confidence_score or 0
        return f"<AIPrediction {self.model_name}: {conf:.2%}>"
