"""
Graph Visualization Schemas
For API documentation and validation
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from uuid import UUID


class GraphNode(BaseModel):
    """Node in money flow graph"""
    id: str = Field(..., description="Node ID (account_id)")
    account_id: str = Field(..., description="Account identifier")
    account_number: str = Field(..., description="Account number")
    bank: str = Field(..., description="Bank name")
    holder_name: Optional[str] = Field(None, description="Account holder name")
    is_mule: int = Field(..., description="Is mule account (0 or 1)")
    mule_probability: float = Field(..., description="Mule probability (0-1)")
    risk_score: float = Field(..., description="Risk score (0-100)")
    label: str = Field(..., description="Node label (Victim/Mule Account/Account)")


class GraphEdge(BaseModel):
    """Edge in money flow graph (transaction)"""
    source: str = Field(..., description="Source account ID")
    target: str = Field(..., description="Target account ID")
    amount: float = Field(..., description="Transaction amount")
    transaction_type: str = Field(..., description="Transaction type (IMPS/NEFT/UPI)")
    hop_number: int = Field(..., description="Hop number in chain")
    timestamp: Optional[str] = Field(None, description="Transaction timestamp")


class GraphData(BaseModel):
    """Graph data structure"""
    nodes: List[GraphNode] = Field(..., description="List of account nodes")
    edges: List[GraphEdge] = Field(..., description="List of transaction edges")
    case_id: str = Field(..., description="Case identifier")


class CaseGraphResponse(BaseModel):
    """Response for case graph endpoint"""
    success: bool = Field(..., description="Request success status")
    data: Dict[str, Any] = Field(..., description="Graph data and metadata")


class TraceMoneyFlowResponse(BaseModel):
    """Response for trace money flow endpoint"""
    success: bool = Field(..., description="Request success status")
    data: Dict[str, Any] = Field(..., description="Trace results and graph data")


class MuleNetworkResponse(BaseModel):
    """Response for mule network endpoint"""
    success: bool = Field(..., description="Request success status")
    data: Dict[str, Any] = Field(..., description="Mule network data")


class VisualizationNode(BaseModel):
    """Node optimized for graph visualization libraries"""
    id: str = Field(..., description="Node ID (account_id)")
    label: str = Field(..., description="Display label (holder name or account number)")
    account_id: str = Field(..., description="Account identifier")
    account_number: str = Field(..., description="Account number")
    bank: str = Field(..., description="Bank name")
    holder_name: Optional[str] = Field(None, description="Account holder name")
    is_mule: int = Field(..., description="Is mule account (0 or 1)")
    mule_probability: float = Field(..., description="Mule probability (0-1)")
    risk_score: float = Field(..., description="Risk score (0-100)")
    node_type: str = Field(..., description="Node type: 'victim', 'mule', or 'account'")
    color: str = Field(..., description="Node color for visualization")
    size: int = Field(30, description="Node size for visualization")


class VisualizationEdge(BaseModel):
    """Edge optimized for graph visualization libraries"""
    id: Optional[str] = Field(None, description="Edge ID (auto-generated)")
    source: str = Field(..., description="Source node ID (account_id)")
    target: str = Field(..., description="Target node ID (account_id)")
    label: str = Field(..., description="Edge label (amount + type)")
    amount: float = Field(..., description="Transaction amount")
    transaction_type: str = Field(..., description="Transaction type (IMPS/NEFT/RTGS)")
    hop_number: int = Field(..., description="Hop number in chain")
    timestamp: Optional[str] = Field(None, description="Transaction timestamp")
    width: int = Field(2, description="Edge width for visualization")
    color: str = Field("#94a3b8", description="Edge color for visualization")


class VisualizationGraph(BaseModel):
    """Graph data optimized for visualization libraries"""
    nodes: List[VisualizationNode] = Field(..., description="List of nodes")
    edges: List[VisualizationEdge] = Field(..., description="List of edges")
    case_id: str = Field(..., description="Case identifier")
    case_number: Optional[str] = Field(None, description="Case number")


class VisualizationGraphResponse(BaseModel):
    """Response for visualization graph endpoint"""
    success: bool = Field(..., description="Request success status")
    data: VisualizationGraph = Field(..., description="Graph data for visualization")

