"""
Federated Learning Configuration
"""
try:
    from pydantic_settings import BaseSettings
except ImportError:
    from pydantic import BaseSettings

from typing import List, Optional
from enum import Enum
import os
from pathlib import Path


# Compute BACKEND_ROOT directory (where checkpoints folder is located)
# This file is at: backend/app/federated_learning/config.py
# Backend root is: backend/
BACKEND_ROOT = Path(__file__).parent.parent.parent.resolve()


class AggregationStrategy(str, Enum):
    """Model aggregation strategies"""
    FEDAVG = "fedavg"
    FEDPROX = "fedprox"


class FLConfig(BaseSettings):
    """Federated Learning Configuration"""
    
    class Config:
        env_file = ".env"
        env_prefix = "FL_"
        protected_namespaces = ('settings_',)
    
    # Server Configuration
    server_host: str = "0.0.0.0"
    server_port: int = 8080
    server_url: str = "http://localhost:8000"  # Use main API server
    
    # Training Configuration
    num_rounds: int = 50                      # Total federated rounds
    num_clients: int = 5                      # Number of bank clients
    clients_per_round: int = 3                # Clients participating per round
    local_epochs: int = 3                     # Epochs per client per round
    batch_size: int = 32
    learning_rate: float = 0.001
    
    # Aggregation Configuration
    aggregation_strategy: AggregationStrategy = AggregationStrategy.FEDAVG
    fedprox_mu: float = 0.01                  # FedProx regularization parameter
    
    # Model Configuration
    model_types: List[str] = ["cst_transformer", "mule_detector_gnn"]
    
    # Communication Configuration
    timeout_seconds: int = 300                 # Timeout for client responses
    max_retries: int = 3
    
    # Security Configuration
    enable_encryption: bool = False           # Encrypt model weights
    
    # Synthetic Data Configuration
    synthetic_samples_per_bank: int = 5000
    fraud_ratio: float = 0.05                 # 5% fraud cases
    
    # Bank clients for simulation
    bank_clients: List[str] = ["sbi", "hdfc", "icici", "axis", "kotak"]
    
    @property
    def checkpoints_dir(self) -> Path:
        """Absolute path to federated learning checkpoints directory."""
        return BACKEND_ROOT / "checkpoints" / "federated"
    
    @property
    def pretrained_cst_path(self) -> Path:
        """Absolute path to pre-trained CST model checkpoint."""
        return BACKEND_ROOT / "checkpoints" / "cst_unified" / "best_model.pt"
    
    @property
    def pretrained_gnn_path(self) -> Path:
        """Absolute path to pre-trained GNN (mule detector) model checkpoint."""
        return BACKEND_ROOT / "checkpoints" / "mule_detector" / "best_model.pt"


# Global config instance
fl_config = FLConfig()


# Ensure checkpoint directory exists
os.makedirs(fl_config.checkpoints_dir, exist_ok=True)

