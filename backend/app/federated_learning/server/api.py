"""
REST API for Federated Learning Server
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import logging

from app.federated_learning.server.coordinator import coordinator
from app.federated_learning.config import fl_config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/fl", tags=["federated-learning"])


# ============ Request/Response Models ============

class ClientRegistration(BaseModel):
    """Client registration request"""
    client_id: str = Field(..., description="Unique client identifier (e.g., 'sbi')")
    info: Optional[Dict[str, Any]] = Field(default={}, description="Additional client info")


class StartRoundRequest(BaseModel):
    """Start round request"""
    model_config = ConfigDict(protected_namespaces=())
    model_type: str = Field(..., description="Model type: 'cst_transformer' or 'mule_detector_gnn'")
    client_ids: Optional[List[str]] = Field(None, description="Participating clients (None = all)")


class ClientUpdateRequest(BaseModel):
    """Client weight update submission"""
    model_config = ConfigDict(protected_namespaces=())
    client_id: str = Field(..., description="Client identifier")
    model_type: str = Field(..., description="Model type")
    round_number: int = Field(..., description="Round number")
    weights: Dict[str, Any] = Field(..., description="Model weights in JSON-safe format")
    num_samples: int = Field(..., description="Number of training samples")
    metrics: Optional[Dict[str, Any]] = Field(default={}, description="Training metrics")


class AggregateRequest(BaseModel):
    """Manual aggregation request"""
    model_config = ConfigDict(protected_namespaces=())
    model_type: str
    round_number: int


# ============ Client Management ============

@router.post("/clients/register")
async def register_client(request: ClientRegistration):
    """
    Register a new client (bank) for federated learning.
    
    Returns registration confirmation with client details.
    """
    try:
        result = coordinator.register_client(
            client_id=request.client_id,
            client_info=request.info
        )
        return {
            "status": "registered",
            "client": result
        }
    except Exception as e:
        logger.error(f"Client registration failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/clients")
async def list_clients():
    """Get list of registered clients."""
    clients = coordinator.registered_clients
    return {
        "count": len(clients),
        "clients": list(clients.values())
    }


# ============ Round Management ============

@router.post("/rounds/start")
async def start_round(request: StartRoundRequest):
    """
    Start a new federated learning round.
    
    Returns round info including global model weights for clients to download.
    """
    try:
        round_info = await coordinator.start_round(
            model_type=request.model_type,
            client_ids=request.client_ids
        )
        return round_info
    except Exception as e:
        logger.error(f"Error starting round: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rounds/{round_number}/update")
async def submit_client_update(round_number: int, request: ClientUpdateRequest):
    """
    Submit a client's weight update for a round.
    
    If all expected updates are received, aggregation is triggered automatically.
    """
    try:
        result = await coordinator.submit_client_update(
            model_type=request.model_type,
            round_number=round_number,
            client_id=request.client_id,
            weights=request.weights,
            num_samples=request.num_samples,
            metrics=request.metrics
        )
        return result
    except Exception as e:
        logger.error(f"Error receiving update: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rounds/{round_number}/aggregate")
async def aggregate_round(round_number: int, request: AggregateRequest):
    """
    Manually trigger aggregation for a round.
    
    Use when auto-aggregation is disabled or needs to be forced.
    """
    try:
        result = await coordinator.aggregate_round(
            model_type=request.model_type,
            round_number=round_number
        )
        return result
    except Exception as e:
        logger.error(f"Error aggregating round: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rounds/{round_number}/status")
async def get_round_status(
    round_number: int,
    model_type: str = Query(..., description="Model type")
):
    """Get status of a federated learning round."""
    try:
        status = await coordinator.get_round_status(model_type, round_number)
        return status
    except Exception as e:
        logger.error(f"Error getting round status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ Model Management ============

@router.get("/models/{model_type}/global")
async def get_global_model(model_type: str):
    """
    Get latest global model weights for clients to download.
    
    Returns model weights in JSON-safe format.
    """
    try:
        model_data = await coordinator.get_global_model(model_type)
        return model_data
    except Exception as e:
        logger.error(f"Error getting model: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models/{model_type}/version")
async def get_model_version(model_type: str):
    """Get current model version number."""
    try:
        version = await coordinator.model_manager.get_current_version(model_type)
        return {
            "model_type": model_type,
            "version": version
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ Progress & Status ============

@router.get("/progress/{model_type}")
async def get_training_progress(model_type: str):
    """
    Get overall training progress for a model.
    
    Shows current round, target rounds, and recent history.
    """
    try:
        progress = coordinator.get_training_progress(model_type)
        return progress
    except Exception as e:
        logger.error(f"Error getting progress: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/config")
async def get_fl_config():
    """Get federated learning configuration."""
    return {
        "num_rounds": fl_config.num_rounds,
        "num_clients": fl_config.num_clients,
        "clients_per_round": fl_config.clients_per_round,
        "local_epochs": fl_config.local_epochs,
        "batch_size": fl_config.batch_size,
        "learning_rate": fl_config.learning_rate,
        "aggregation_strategy": fl_config.aggregation_strategy.value,
        "model_types": fl_config.model_types,
        "bank_clients": fl_config.bank_clients
    }


@router.get("/health")
async def fl_health():
    """Health check for FL service."""
    return {
        "status": "healthy",
        "registered_clients": len(coordinator.registered_clients),
        "current_rounds": coordinator.current_rounds
    }

