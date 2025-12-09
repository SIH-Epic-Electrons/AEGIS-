"""
Federated Learning Server Components
"""

from .coordinator import FederatedCoordinator, coordinator
from .aggregator import FederatedAveraging, FederatedProximal, get_aggregator
from .model_manager import ModelManager

__all__ = [
    "FederatedCoordinator",
    "coordinator",
    "FederatedAveraging",
    "FederatedProximal",
    "get_aggregator",
    "ModelManager",
]

