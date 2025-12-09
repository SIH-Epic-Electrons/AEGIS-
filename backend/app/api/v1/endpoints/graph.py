"""
Graph Visualization API Endpoints
For Neo4j money flow visualization
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import Field
from typing import Annotated
from uuid import UUID

from app.db.postgresql import get_db
from app.models.officer import Officer
from app.models.case import Case
from app.api.v1.endpoints.auth import get_current_officer
from app.services.neo4j_graph_service import Neo4jGraphService
from app.services.cfcfrms_simulator import CFCFRMSSimulator
from app.services.mule_detector_service import MuleDetectorService
from app.schemas.graph import (
    CaseGraphResponse, 
    TraceMoneyFlowResponse, 
    MuleNetworkResponse,
    VisualizationGraphResponse,
    VisualizationGraph,
    VisualizationNode,
    VisualizationEdge
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

router = APIRouter()


@router.get(
    "/case/{case_id}",
    response_model=CaseGraphResponse,
    summary="Get Case Money Flow Graph",
    description="""
    Retrieve the money flow graph for a specific case.
    
    **Returns:**
    - Graph data with nodes (accounts) and edges (transactions)
    - Mule accounts are highlighted with `is_mule=1`
    - Nodes include mule probability and risk scores
    
    **Visualization:**
    - Green nodes: Victim accounts
    - Red/Orange nodes: Mule accounts (is_mule=1)
    - Blue nodes: Regular accounts
    - Edges: Transactions with amounts
    """
)
async def get_case_graph(
    case_id: UUID,
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    db: AsyncSession = Depends(get_db)
):
    """
    Get money flow graph for a case.
    
    Returns:
        Graph data with nodes (accounts) and edges (transactions)
        Mule accounts are highlighted
    """
    # Get case
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found"
        )
    
    # Get graph from Neo4j
    graph_data = Neo4jGraphService.get_case_graph(case_id)
    
    return {
        "success": True,
        "data": {
            "case_id": str(case_id),
            "case_number": case.case_number,
            "graph": graph_data
        }
    }


@router.post(
    "/case/{case_id}/trace",
    response_model=TraceMoneyFlowResponse,
    summary="Trace Money Flow for Case",
    description="""
    Trace money flow for a case using CFCFRMS simulator.
    
    **Process:**
    1. Simulates CFCFRMS money flow tracing
    2. Runs GNN mule detection on transaction chain
    3. Creates graph in Neo4j database
    4. Returns graph data for visualization
    
    **What it does:**
    - Traces transaction chain: Victim → Account A → Account B → Account C
    - Detects which accounts are mules using AI
    - Stores graph in Neo4j for visualization
    - Returns complete graph with mule predictions
    
    **Use this endpoint:**
    - When you want to trace money flow for a new case
    - Before visualizing the graph
    - To trigger mule detection
    """
)
async def trace_money_flow(
    case_id: UUID,
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    db: AsyncSession = Depends(get_db)
):
    """
    Trace money flow for a case using CFCFRMS simulator.
    Creates graph in Neo4j and runs mule detection.
    """
    # Get case
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found"
        )
    
    # Simulate CFCFRMS trace
    transactions = CFCFRMSSimulator.trace_money_flow(
        case_id=case.id,
        victim_account=case.destination_account or "VICTIM_ACCOUNT",
        victim_bank=case.destination_bank or "ICICI",
        fraud_amount=case.fraud_amount or 100000,
        complaint_timestamp=case.complaint_timestamp or case.created_at,
        num_hops=3
    )
    
    # Run mule detection
    # IMPORTANT: Victim account should NEVER be marked as mule
    victim_account = transactions[0].get("from_account") if transactions else None
    mule_service = MuleDetectorService()
    mule_predictions = await mule_service.detect_mules_from_transactions(
        case_id=case.id,
        transactions=transactions,
        victim_account=victim_account
    )
    
    # Create graph in Neo4j
    Neo4jGraphService.create_case_graph(
        case_id=case.id,
        transactions=transactions,
        mule_predictions=mule_predictions
    )
    
    # Get graph data
    graph_data = Neo4jGraphService.get_case_graph(case.id)
    
    return {
        "success": True,
        "data": {
            "case_id": str(case_id),
            "transactions_traced": len(transactions),
            "mule_accounts_detected": len([p for p in mule_predictions.values() if p.get("is_mule", False)]),
            "graph": graph_data
        }
    }


@router.get(
    "/mule/{account_id}/network",
    response_model=MuleNetworkResponse,
    summary="Get Mule Account Network",
    description=""" 
    Get network of accounts connected to a mule account.
    
    **Returns:**
    - All accounts connected to the specified mule account
    - Transaction history
    - Network relationships
    
    **Use this to:**
    - Find fraud networks
    - Identify connected mule accounts
    - Analyze fraud rings
    """
)
async def get_mule_network(
    account_id: str,
    current_officer: Annotated[Officer, Depends(get_current_officer)]
):
    """
    Get network of accounts connected to a mule account.
    """
    network = Neo4jGraphService.get_mule_network(account_id)
    
    return {
        "success": True,
        "data": {
            "account_id": account_id,
            "network": network
        }
    }


@router.get(
    "/case/{case_id}/visualization",
    response_model=VisualizationGraphResponse,
    summary="Get Case Graph for Visualization",
    description="""
    Get money flow graph optimized for visualization libraries (D3.js, vis.js, cytoscape.js, etc.).
    
    **Format:**
    - Nodes use `account_id` as ID (consistent string IDs)
    - Edges use `account_id` for source/target (matching node IDs)
    - Includes visualization properties (color, size, labels)
    
    **Node Types:**
    - **Victim**: Green nodes (`#22c55e`)
    - **Mule Account**: Red/Orange nodes (`#f97316`)
    - **Regular Account**: Blue nodes (`#3b82f6`)
    
    **Edge Properties:**
    - Width based on transaction amount
    - Label shows amount and transaction type
    - Color indicates transaction type
    
    **Use this endpoint for:**
    - Frontend graph visualization
    - Interactive network diagrams
    - Real-time graph rendering
    """
)
async def get_case_graph_visualization(
    case_id: UUID,
    current_officer: Annotated[Officer, Depends(get_current_officer)],
    db: AsyncSession = Depends(get_db)
):
    """
    Get money flow graph in visualization-optimized format.
    
    Returns graph data formatted for D3.js, vis.js, cytoscape.js, etc.
    """
    # Get case
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found"
        )
    
    # Get graph from Neo4j
    graph_data = Neo4jGraphService.get_case_graph(case_id)
    
    # Transform to visualization format
    nodes = []
    edges = []
    
    # Create a mapping from Neo4j node IDs to account_ids
    node_id_to_account = {}
    
    # Process nodes
    for node in graph_data.get("nodes", []):
        account_id = node.get("account_id", "")
        if not account_id:
            continue
            
        node_id_to_account[node.get("id")] = account_id
        
        # Determine node type and color
        label = node.get("label", "Account")
        is_mule = node.get("is_mule", 0) == 1
        mule_prob = node.get("mule_probability", 0.0)
        
        # IMPORTANT: Victim accounts are NEVER mules (mule_probability should be 0.0)
        if label == "Victim" or mule_prob == 0.0 and node.get("holder_name") == "Victim":
            node_type = "victim"
            color = "#22c55e"  # Green
            size = 40
            # Force victim to have 0% mule probability
            is_mule = False
            mule_prob = 0.0
        elif is_mule and mule_prob > 0.0:
            node_type = "mule"
            color = "#f97316"  # Orange/Red
            size = 35
        else:
            node_type = "account"
            color = "#3b82f6"  # Blue
            size = 30
        
        # Create label
        display_label = node.get("holder_name") or node.get("account_number", account_id)
        if len(display_label) > 20:
            display_label = display_label[:17] + "..."
        
        nodes.append({
            "id": account_id,
            "label": display_label,
            "account_id": account_id,
            "account_number": node.get("account_number", ""),
            "bank": node.get("bank", ""),
            "holder_name": node.get("holder_name"),
            "is_mule": 0 if node_type == "victim" else (1 if is_mule else 0),
            "mule_probability": 0.0 if node_type == "victim" else node.get("mule_probability", 0.0),
            "risk_score": node.get("risk_score", 0.0),
            "node_type": node_type,
            "color": color,
            "size": size
        })
    
    # Process edges
    for idx, edge in enumerate(graph_data.get("edges", [])):
        source_id = edge.get("source")
        target_id = edge.get("target")
        
        # Convert Neo4j node IDs to account_ids
        source_account = node_id_to_account.get(source_id)
        target_account = node_id_to_account.get(target_id)
        
        if not source_account or not target_account:
            continue
        
        amount = edge.get("amount", 0)
        txn_type = edge.get("transaction_type", "IMPS")
        hop_number = edge.get("hop_number", 0)
        
        # Create edge label
        amount_str = f"₹{amount:,.0f}" if amount >= 1000 else f"₹{amount:.2f}"
        edge_label = f"{amount_str} ({txn_type})"
        
        # Edge width based on amount (normalized)
        max_amount = max([e.get("amount", 0) for e in graph_data.get("edges", [])] + [1])
        width = max(2, min(8, int(2 + (amount / max_amount) * 6)))
        
        # Edge color based on transaction type
        color_map = {
            "IMPS": "#94a3b8",  # Gray
            "NEFT": "#60a5fa",  # Light blue
            "RTGS": "#f59e0b",  # Amber
            "UPI": "#8b5cf6"    # Purple
        }
        edge_color = color_map.get(txn_type, "#94a3b8")
        
        edges.append({
            "id": f"edge_{case_id}_{idx}",
            "source": source_account,
            "target": target_account,
            "label": edge_label,
            "amount": amount,
            "transaction_type": txn_type,
            "hop_number": hop_number,
            "timestamp": edge.get("timestamp"),
            "width": width,
            "color": edge_color
        })
    
    # Create visualization graph
    viz_graph = VisualizationGraph(
        nodes=[VisualizationNode(**node) for node in nodes],
        edges=[VisualizationEdge(**edge) for edge in edges],
        case_id=str(case_id),
        case_number=case.case_number
    )
    
    return VisualizationGraphResponse(
        success=True,
        data=viz_graph
    )

