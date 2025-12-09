"""
Feedback Schemas

Pydantic schemas matching the MVP UI feedback form:
- 11-outcome-feedback.html: Officer feedback form
- 21-case-report.html: AI case report
"""

from enum import Enum
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


class PredictionAccuracy(str, Enum):
    """
    Was the prediction accurate?
    Maps to the 4 buttons in 11-outcome-feedback.html
    """
    EXACT_MATCH = "exact_match"     # Correct location - green checkmark
    NEARBY = "nearby"               # Within 2km - near_me icon
    DIFFERENT = "different"         # Wrong area - wrong_location icon
    UNKNOWN = "unknown"             # No withdrawal happened - help icon


class InterventionResult(str, Enum):
    """
    Intervention outcome
    Maps to the radio buttons in 11-outcome-feedback.html
    """
    SUSPECT_APPREHENDED = "suspect_apprehended"  # Criminal caught
    MONEY_RECOVERED = "money_recovered"          # Funds secured via freeze
    BOTH = "both"                                # Apprehended + recovered
    UNSUCCESSFUL = "unsuccessful"                # Neither achieved


class FeedbackCreate(BaseModel):
    """
    Schema for creating feedback - matches 11-outcome-feedback.html form
    """
    # Core feedback
    prediction_accuracy: PredictionAccuracy = Field(
        ...,
        description="How accurate was the location prediction?"
    )
    intervention_result: InterventionResult = Field(
        ...,
        description="What was the outcome of the intervention?"
    )
    
    # Amount details
    amount_recovered: Optional[float] = Field(
        None,
        ge=0,
        description="Amount recovered in INR"
    )
    total_fraud_amount: Optional[float] = Field(
        None,
        ge=0,
        description="Total fraud amount in INR"
    )
    
    # Location correction (if prediction was wrong)
    actual_location: Optional[str] = Field(
        None,
        description="Actual withdrawal location (if different from prediction)"
    )
    actual_atm_id: Optional[str] = Field(
        None,
        description="Actual ATM ID where withdrawal happened"
    )
    actual_lat: Optional[float] = Field(None, ge=-90, le=90)
    actual_lon: Optional[float] = Field(None, ge=-180, le=180)
    
    # Time accuracy
    actual_time: Optional[datetime] = Field(
        None,
        description="Actual time of withdrawal"
    )
    time_prediction_accurate: Optional[bool] = Field(
        None,
        description="Was the time window prediction accurate?"
    )
    
    # Mule detection feedback
    mule_detection_accurate: Optional[bool] = Field(
        None,
        description="Were the identified mule accounts correct?"
    )
    false_positive_accounts: Optional[List[str]] = Field(
        None,
        description="Account IDs incorrectly flagged as mules"
    )
    missed_mule_accounts: Optional[List[str]] = Field(
        None,
        description="Mule accounts that were missed"
    )
    
    # Additional notes
    notes: Optional[str] = Field(
        None,
        max_length=1000,
        description="Any observations or feedback for improving predictions"
    )
    
    # Team performance
    response_time_minutes: Optional[int] = Field(
        None,
        ge=0,
        description="How quickly did the team respond?"
    )
    team_id: Optional[str] = Field(
        None,
        description="Team that handled the case"
    )
    
    @field_validator('amount_recovered')
    @classmethod
    def validate_recovery(cls, v, info):
        """Ensure recovered amount doesn't exceed total"""
        if v is not None and info.data.get('total_fraud_amount'):
            if v > info.data['total_fraud_amount']:
                raise ValueError('Recovered amount cannot exceed total fraud amount')
        return v
    
    @property
    def recovery_rate(self) -> Optional[float]:
        """Calculate recovery rate"""
        if self.amount_recovered and self.total_fraud_amount and self.total_fraud_amount > 0:
            return self.amount_recovered / self.total_fraud_amount
        return None


class OutcomeFeedback(BaseModel):
    """
    Processed feedback with calculated metrics
    Used for reporting and display
    """
    prediction_accuracy: PredictionAccuracy
    intervention_result: InterventionResult
    
    # Calculated metrics
    location_accuracy_score: float = Field(
        ...,
        ge=0, le=1,
        description="0-1 score for location accuracy"
    )
    recovery_rate: Optional[float] = Field(
        None,
        ge=0, le=1,
        description="Fraction of amount recovered"
    )
    overall_success_score: float = Field(
        ...,
        ge=0, le=1,
        description="Overall success metric"
    )
    
    # Display values (for UI)
    location_accuracy_display: str = Field(
        ...,
        description="Human-readable accuracy (e.g., '100%', '87%')"
    )
    
    @classmethod
    def from_feedback(cls, feedback: FeedbackCreate) -> "OutcomeFeedback":
        """Create OutcomeFeedback from raw feedback"""
        # Calculate location accuracy score
        accuracy_scores = {
            PredictionAccuracy.EXACT_MATCH: 1.0,
            PredictionAccuracy.NEARBY: 0.7,
            PredictionAccuracy.DIFFERENT: 0.2,
            PredictionAccuracy.UNKNOWN: 0.5,
        }
        location_score = accuracy_scores[feedback.prediction_accuracy]
        
        # Calculate recovery rate
        recovery_rate = feedback.recovery_rate
        
        # Calculate overall success
        intervention_scores = {
            InterventionResult.BOTH: 1.0,
            InterventionResult.SUSPECT_APPREHENDED: 0.8,
            InterventionResult.MONEY_RECOVERED: 0.7,
            InterventionResult.UNSUCCESSFUL: 0.1,
        }
        intervention_score = intervention_scores[feedback.intervention_result]
        
        # Weighted overall score
        overall = 0.4 * location_score + 0.3 * intervention_score
        if recovery_rate is not None:
            overall += 0.3 * recovery_rate
        else:
            overall += 0.3 * intervention_score
        
        return cls(
            prediction_accuracy=feedback.prediction_accuracy,
            intervention_result=feedback.intervention_result,
            location_accuracy_score=location_score,
            recovery_rate=recovery_rate,
            overall_success_score=overall,
            location_accuracy_display=f"{int(location_score * 100)}%"
        )


class FeedbackRecord(BaseModel):
    """
    Complete feedback record stored in database
    """
    model_config = {"protected_namespaces": (), "from_attributes": True}
    
    id: UUID
    prediction_id: UUID
    case_id: UUID
    officer_id: UUID
    
    # Original feedback
    feedback: FeedbackCreate
    
    # Calculated reward (for RL)
    reward: float
    reward_components: Dict[str, float]
    
    # Metadata
    created_at: datetime
    ml_model_version: str  # Renamed to avoid protected namespace conflict
    
    # Experience data (for training)
    state_features: Optional[Dict[str, Any]] = None
    action_taken: Optional[Dict[str, Any]] = None


class FeedbackStats(BaseModel):
    """
    Aggregated feedback statistics
    """
    total_feedback: int
    
    # Accuracy distribution
    exact_match_count: int
    nearby_count: int
    different_count: int
    unknown_count: int
    
    # Outcome distribution
    apprehended_count: int
    recovered_count: int
    both_count: int
    unsuccessful_count: int
    
    # Metrics
    average_location_accuracy: float
    average_recovery_rate: float
    average_reward: float
    
    # Time range
    from_date: datetime
    to_date: datetime

