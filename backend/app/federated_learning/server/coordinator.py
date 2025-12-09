"""
Federated Learning Coordinator
Manages federated learning rounds and client coordination
"""
import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from collections import defaultdict
import numpy as np

from app.federated_learning.config import fl_config, AggregationStrategy
from app.federated_learning.server.aggregator import get_aggregator, validate_client_weights
from app.federated_learning.server.model_manager import ModelManager
from app.federated_learning.utils.serialization import (
    model_weights_to_dict,
    dict_to_model_weights,
    weights_to_json_safe,
    json_safe_to_weights,
)

logger = logging.getLogger(__name__)


class FederatedCoordinator:
    """
    Coordinates federated learning across multiple bank clients.
    
    Responsibilities:
    - Manage federated learning rounds
    - Track client participation
    - Aggregate client updates
    - Update and distribute global model
    """
    
    def __init__(self):
        self.model_manager = ModelManager()
        self.current_rounds: Dict[str, int] = {}  # model_type -> current_round
        self.round_updates: Dict[str, Dict[int, list]] = defaultdict(lambda: defaultdict(list))
        self.round_status: Dict[str, Dict[int, Dict]] = defaultdict(dict)
        self.registered_clients: Dict[str, Dict] = {}  # client_id -> client_info
        
        logger.info("Federated Coordinator initialized")
    
    def register_client(self, client_id: str, client_info: Dict = None) -> Dict:
        """
        Register a new client (bank) for federated learning.
        
        Args:
            client_id: Unique client identifier (e.g., 'sbi', 'hdfc')
            client_info: Additional client information
            
        Returns:
            Registration confirmation
        """
        self.registered_clients[client_id] = {
            'id': client_id,
            'info': client_info or {},
            'registered_at': datetime.utcnow().isoformat(),
            'last_active': datetime.utcnow().isoformat(),
            'rounds_participated': 0
        }
        logger.info(f"Client registered: {client_id}")
        return self.registered_clients[client_id]
    
    def get_registered_clients(self) -> List[str]:
        """Get list of registered client IDs."""
        return list(self.registered_clients.keys())
    
    async def start_round(
        self,
        model_type: str,
        client_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Start a new federated learning round.
        
        Args:
            model_type: Type of model ('cst_transformer' or 'mule_detector_gnn')
            client_ids: List of client IDs to participate (None = all registered)
            
        Returns:
            Round information
        """
        # Increment round number
        if model_type not in self.current_rounds:
            self.current_rounds[model_type] = 0
        self.current_rounds[model_type] += 1
        round_number = self.current_rounds[model_type]
        
        # Get participating clients
        if client_ids is None:
            client_ids = self.get_registered_clients()[:fl_config.clients_per_round]
        
        if not client_ids:
            client_ids = fl_config.bank_clients[:fl_config.clients_per_round]
        
        logger.info(f"Starting round {round_number} for {model_type} with clients: {client_ids}")
        
        # Get global model weights
        global_weights = await self.model_manager.get_model_weights(model_type)
        current_version = await self.model_manager.get_current_version(model_type)
        
        # Initialize round status
        self.round_status[model_type][round_number] = {
            'round_number': round_number,
            'model_type': model_type,
            'status': 'in_progress',
            'started_at': datetime.utcnow().isoformat(),
            'client_ids': client_ids,
            'updates_received': 0,
            'updates_required': len(client_ids),
            'global_model_version': current_version,
        }
        
        return {
            'round_number': round_number,
            'model_type': model_type,
            'client_ids': client_ids,
            'global_model_version': current_version,
            'global_weights': weights_to_json_safe(global_weights),
            'config': {
                'local_epochs': fl_config.local_epochs,
                'batch_size': fl_config.batch_size,
                'learning_rate': fl_config.learning_rate,
            }
        }
    
    async def submit_client_update(
        self,
        model_type: str,
        round_number: int,
        client_id: str,
        weights: Dict[str, Any],
        num_samples: int,
        metrics: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Receive and store a client's weight update.
        
        Args:
            model_type: Type of model
            round_number: Round number
            client_id: Client identifier
            weights: Updated model weights (JSON-safe format)
            num_samples: Number of training samples used
            metrics: Training metrics
            
        Returns:
            Submission confirmation
        """
        # Convert JSON-safe weights to numpy
        if weights and isinstance(list(weights.values())[0], dict):
            weights = json_safe_to_weights(weights)
        
        # Store update
        update = {
            'client_id': client_id,
            'weights': weights,
            'num_samples': num_samples,
            'metrics': metrics or {},
            'submitted_at': datetime.utcnow().isoformat()
        }
        
        self.round_updates[model_type][round_number].append(update)
        
        # Update round status
        if round_number in self.round_status[model_type]:
            self.round_status[model_type][round_number]['updates_received'] += 1
        
        # Update client info
        if client_id in self.registered_clients:
            self.registered_clients[client_id]['last_active'] = datetime.utcnow().isoformat()
            self.registered_clients[client_id]['rounds_participated'] += 1
        
        logger.info(f"Received update from {client_id} for round {round_number} "
                   f"({num_samples} samples)")
        
        # Check if all updates received
        updates = self.round_updates[model_type][round_number]
        status = self.round_status[model_type].get(round_number, {})
        
        result = {
            'status': 'received',
            'round_number': round_number,
            'updates_received': len(updates),
            'updates_required': status.get('updates_required', len(status.get('client_ids', [])))
        }
        
        # Auto-aggregate if all updates received
        if result['updates_received'] >= result['updates_required']:
            logger.info(f"All updates received for round {round_number}, auto-aggregating...")
            aggregation_result = await self.aggregate_round(model_type, round_number)
            result['aggregation'] = aggregation_result
        
        return result
    
    async def aggregate_round(
        self,
        model_type: str,
        round_number: int
    ) -> Dict[str, Any]:
        """
        Aggregate client updates for a round.
        
        Args:
            model_type: Type of model
            round_number: Round number to aggregate
            
        Returns:
            Aggregation result
        """
        updates = self.round_updates[model_type].get(round_number, [])
        
        if not updates:
            raise ValueError(f"No updates found for round {round_number}")
        
        logger.info(f"Aggregating {len(updates)} updates for round {round_number}")
        
        # Extract weights and sample counts
        client_weights = [u['weights'] for u in updates]
        client_samples = [u['num_samples'] for u in updates]
        client_ids = [u['client_id'] for u in updates]
        
        # Validate weights
        if not validate_client_weights(client_weights):
            raise ValueError("Client weights validation failed")
        
        # Get current global weights for FedProx
        current_global_weights = await self.model_manager.get_model_weights(model_type)
        
        # Get aggregator and aggregate
        aggregator = get_aggregator(fl_config.aggregation_strategy)
        
        if fl_config.aggregation_strategy == AggregationStrategy.FEDPROX:
            aggregated_weights = aggregator.aggregate(
                client_weights, client_samples, current_global_weights
            )
        else:
            aggregated_weights = aggregator.aggregate(
                client_weights, client_samples
            )
        
        # Update global model
        model = await self.model_manager.update_model_weights(model_type, aggregated_weights)
        
        # Calculate aggregate metrics
        total_samples = sum(client_samples)
        avg_metrics = {}
        for key in updates[0].get('metrics', {}).keys():
            values = [u['metrics'].get(key, 0) * u['num_samples'] for u in updates]
            avg_metrics[key] = sum(values) / total_samples if total_samples > 0 else 0
        
        # Save new version
        version = await self.model_manager.save_model_version(
            model_type=model_type,
            model=model,
            round_number=round_number,
            metrics=avg_metrics,
            client_ids=client_ids
        )
        
        # Update round status
        if round_number in self.round_status[model_type]:
            self.round_status[model_type][round_number]['status'] = 'completed'
            self.round_status[model_type][round_number]['completed_at'] = datetime.utcnow().isoformat()
            self.round_status[model_type][round_number]['new_version'] = version
            self.round_status[model_type][round_number]['metrics'] = avg_metrics
        
        logger.info(f"Round {round_number} completed. New model version: {version}")
        
        return {
            'round_number': round_number,
            'model_type': model_type,
            'new_version': version,
            'clients_aggregated': client_ids,
            'total_samples': total_samples,
            'metrics': avg_metrics,
            'status': 'completed'
        }
    
    async def get_round_status(
        self,
        model_type: str,
        round_number: int
    ) -> Dict[str, Any]:
        """Get status of a specific round."""
        return self.round_status[model_type].get(round_number, {
            'status': 'not_found',
            'round_number': round_number,
            'model_type': model_type
        })
    
    async def get_global_model(
        self,
        model_type: str
    ) -> Dict[str, Any]:
        """Get current global model weights for download."""
        weights = await self.model_manager.get_model_weights(model_type)
        version = await self.model_manager.get_current_version(model_type)
        
        return {
            'model_type': model_type,
            'version': version,
            'weights': weights_to_json_safe(weights)
        }
    
    def get_training_progress(self, model_type: str) -> Dict[str, Any]:
        """Get training progress summary."""
        history = self.model_manager.get_training_history(model_type)
        current_round = self.current_rounds.get(model_type, 0)
        
        return {
            'model_type': model_type,
            'current_round': current_round,
            'target_rounds': fl_config.num_rounds,
            'progress_percent': (current_round / fl_config.num_rounds * 100) if fl_config.num_rounds > 0 else 0,
            'rounds_completed': len(history),
            'history': history[-10:]  # Last 10 rounds
        }


# Global coordinator instance
coordinator = FederatedCoordinator()

