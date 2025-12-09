"""
Case Schemas
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field

from app.models.case import FraudType, CaseStatus, CasePriority


class VictimInfo(BaseModel):
    """Victim information"""
    name: str
    phone: str
    email: Optional[str] = None
    city: str
    location: Optional[Dict[str, float]] = None  # {lat, lon}


class DestinationAccount(BaseModel):
    """
    Destination account info - where victim's money first went.
    CRITICAL for CFCFRMS money trail tracing.
    """
    account_number: str = Field(..., description="Account number where money was sent")
    bank_name: str = Field(..., description="Bank name (e.g., 'HDFC Bank')")
    ifsc_code: Optional[str] = Field(None, description="IFSC code if available")
    upi_id: Optional[str] = Field(None, description="UPI ID if UPI fraud (e.g., 'fraud@upi')")


class CaseCreate(BaseModel):
    """Schema for creating a case"""
    ncrp_complaint_id: Optional[str] = None
    fraud_type: FraudType
    fraud_amount: float = Field(..., gt=0)
    fraud_description: Optional[str] = None
    fraud_timestamp: Optional[datetime] = None
    victim: VictimInfo
    destination_account: DestinationAccount  # REQUIRED - where money went
    transaction_ids: Optional[List[str]] = None


class CaseSummary(BaseModel):
    """Brief case summary for lists"""
    case_id: str
    case_number: str
    status: str
    priority: str
    fraud_type: Optional[str] = None
    fraud_amount: float
    victim_name: Optional[str] = None
    victim_city: Optional[str] = None
    location_confidence: Optional[float] = None
    created_at: str


class PaginationInfo(BaseModel):
    """Pagination metadata"""
    total: int
    limit: int
    offset: int
    has_more: bool


class CaseListData(BaseModel):
    """Data for case list response"""
    cases: List[CaseSummary]
    pagination: PaginationInfo


class CaseListResponse(BaseModel):
    """Case list response"""
    success: bool
    data: Dict[str, Any]


class CaseResponse(BaseModel):
    """Full case response"""
    success: bool
    data: Dict[str, Any]

