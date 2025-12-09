"""
Federated Learning Aggregation Algorithms

Implements FedAvg and FedProx for model aggregation.
"""
import numpy as np
from typing import List, Dict, Any, Optional
import logging

from app.federated_learning.config import fl_config, AggregationStrategy

logger = logging.getLogger(__name__)


class FederatedAveraging:
    """
    Federated Averaging (FedAvg) Algorithm
    
    Paper: "Communication-Efficient Learning of Deep Networks from Decentralized Data"
    McMahan et al., 2017
    
    Aggregates client model weights using weighted average based on sample counts.
    """
    
    @staticmethod
    def aggregate(
        client_weights: List[Dict[str, np.ndarray]],
        client_samples: List[int],
        current_global_weights: Optional[Dict[str, np.ndarray]] = None
    ) -> Dict[str, np.ndarray]:
        """
        Aggregate client model weights using weighted average.
        
        Args:
            client_weights: List of weight dictionaries from clients
            client_samples: List of number of training samples per client
            current_global_weights: Current global model weights (unused in FedAvg)
            
        Returns:
            Aggregated global model weights
        """
        if not client_weights:
            raise ValueError("No client weights provided for aggregation")
        
        if len(client_weights) != len(client_samples):
            raise ValueError("Number of weight dicts must match number of sample counts")
        
        # Calculate total samples
        total_samples = sum(client_samples)
        if total_samples == 0:
            raise ValueError("Total samples cannot be zero")
        
        logger.info(f"Aggregating weights from {len(client_weights)} clients "
                   f"with total {total_samples} samples")
        
        # Initialize aggregated weights
        aggregated = {}
        param_names = list(client_weights[0].keys())
        
        for param_name in param_names:
            # Weighted average: sum(weight_i * n_i) / sum(n_i)
            weighted_sum = None
            
            for client_idx, weights in enumerate(client_weights):
                if param_name not in weights:
                    logger.warning(f"Parameter {param_name} not found in client {client_idx}")
                    continue
                    
                param_weight = weights[param_name]
                n_samples = client_samples[client_idx]
                weight_contribution = param_weight * n_samples
                
                if weighted_sum is None:
                    weighted_sum = weight_contribution.astype(np.float64)
                else:
                    weighted_sum += weight_contribution
            
            if weighted_sum is not None:
                aggregated[param_name] = (weighted_sum / total_samples).astype(np.float32)
        
        logger.info(f"Aggregated {len(aggregated)} parameters")
        return aggregated


class FederatedProximal:
    """
    Federated Proximal (FedProx) Algorithm
    
    Paper: "Federated Optimization in Heterogeneous Networks"
    Li et al., 2020
    
    Adds proximal term regularization to prevent client drift from global model.
    Useful for heterogeneous data distributions (Non-IID).
    """
    
    def __init__(self, mu: float = 0.01):
        """
        Args:
            mu: Proximal term weight (regularization parameter)
                Higher mu keeps local models closer to global model
        """
        self.mu = mu
        logger.info(f"FedProx initialized with mu={mu}")
    
    def aggregate(
        self,
        client_weights: List[Dict[str, np.ndarray]],
        client_samples: List[int],
        current_global_weights: Dict[str, np.ndarray]
    ) -> Dict[str, np.ndarray]:
        """
        Aggregate with proximal term to keep close to global model.
        
        Args:
            client_weights: List of weight dictionaries from clients
            client_samples: List of number of training samples per client
            current_global_weights: Current global model weights (required for FedProx)
            
        Returns:
            Aggregated global model weights
        """
        if current_global_weights is None:
            logger.warning("No global weights provided, falling back to FedAvg")
            return FederatedAveraging.aggregate(client_weights, client_samples)
        
        # First do standard FedAvg
        fedavg_weights = FederatedAveraging.aggregate(
            client_weights, client_samples, current_global_weights
        )
        
        # Apply proximal regularization
        # w_new = w_fedavg - mu * (w_fedavg - w_global)
        # This pulls the aggregated weights back towards the global weights
        aggregated = {}
        for param_name in fedavg_weights.keys():
            if param_name in current_global_weights:
                diff = fedavg_weights[param_name] - current_global_weights[param_name]
                aggregated[param_name] = fedavg_weights[param_name] - self.mu * diff
            else:
                aggregated[param_name] = fedavg_weights[param_name]
        
        logger.info(f"FedProx aggregation complete with mu={self.mu}")
        return aggregated


def get_aggregator(strategy: AggregationStrategy = None):
    """
    Factory function to get aggregator instance based on strategy.
    
    Args:
        strategy: Aggregation strategy (defaults to config)
        
    Returns:
        Aggregator instance
    """
    if strategy is None:
        strategy = fl_config.aggregation_strategy
    
    if strategy == AggregationStrategy.FEDAVG:
        return FederatedAveraging()
    elif strategy == AggregationStrategy.FEDPROX:
        return FederatedProximal(mu=fl_config.fedprox_mu)
    else:
        raise ValueError(f"Unknown aggregation strategy: {strategy}")


def validate_client_weights(
    client_weights: List[Dict[str, np.ndarray]],
    reference_weights: Optional[Dict[str, np.ndarray]] = None
) -> bool:
    """
    Validate that client weights are compatible for aggregation.
    
    Args:
        client_weights: List of client weight dictionaries
        reference_weights: Reference weights to compare against
        
    Returns:
        True if valid, False otherwise
    """
    if not client_weights:
        return False
    
    # All clients should have same parameters
    reference_keys = set(client_weights[0].keys())
    
    for i, weights in enumerate(client_weights[1:], 1):
        if set(weights.keys()) != reference_keys:
            logger.error(f"Client {i} has different parameters than client 0")
            return False
    
    # Check shapes match
    for param_name in reference_keys:
        shapes = [w[param_name].shape for w in client_weights]
        if len(set(shapes)) > 1:
            logger.error(f"Shape mismatch for {param_name}: {shapes}")
            return False
    
    # Check against reference if provided
    if reference_weights is not None:
        ref_keys = set(reference_weights.keys())
        if reference_keys != ref_keys:
            logger.error("Client weights don't match reference model parameters")
            return False
    
    return True

