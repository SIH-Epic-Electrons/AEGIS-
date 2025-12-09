"""
Bank Client Simulator for Federated Learning

Simulates bank clients for testing federated learning without real bank integration.
"""
import asyncio
import torch
from torch.utils.data import DataLoader
from typing import Dict, Any, List, Optional
import logging
import time

from app.federated_learning.config import fl_config
from app.federated_learning.client.trainer import ClientTrainer
from app.federated_learning.client.communicator import FLClientCommunicator
from app.federated_learning.utils.serialization import (
    dict_to_model_weights,
    model_weights_to_dict,
    weights_to_json_safe,
    json_safe_to_weights,
)
from app.federated_learning.data.cst_synthetic import CSTFLDataset
from app.federated_learning.data.gnn_synthetic import GNNFLDataset

logger = logging.getLogger(__name__)


class BankClientSimulator:
    """
    Simulates a bank client for federated learning testing.
    
    Features:
    - Generates synthetic bank-specific data
    - Trains local model
    - Communicates with FL server
    - Supports both CST and GNN models
    """
    
    def __init__(
        self,
        client_id: str,
        model_type: str = 'cst_transformer',
        server_url: str = None,
        num_samples: int = None,
        device: str = None,
        local_epochs: int = None,
        learning_rate: float = None
    ):
        """
        Initialize bank client simulator.
        
        Args:
            client_id: Bank identifier (e.g., 'sbi', 'hdfc')
            model_type: 'cst_transformer' or 'mule_detector_gnn'
            server_url: FL server URL
            num_samples: Training samples (None = use config)
            device: Device for training
            local_epochs: Training epochs per round (None = use config)
            learning_rate: Learning rate (None = use config)
        """
        self.client_id = client_id
        self.model_type = model_type
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        self.num_samples = num_samples or fl_config.synthetic_samples_per_bank
        self.local_epochs = local_epochs or fl_config.local_epochs
        self.learning_rate = learning_rate or fl_config.learning_rate
        
        self.communicator = FLClientCommunicator(
            client_id=client_id,
            server_url=server_url
        )
        
        self.model = None
        self.trainer = None
        self.train_loader = None
        self.val_loader = None
        
        logger.info(f"BankClientSimulator initialized: {client_id} ({model_type})")
    
    async def initialize(self):
        """
        Initialize the client: register, load model, create data.
        """
        logger.info(f"[{self.client_id}] Initializing...")
        
        # Register with server
        try:
            await self.communicator.register({
                'bank_name': self.client_id.upper(),
                'model_type': self.model_type
            })
        except Exception as e:
            logger.warning(f"[{self.client_id}] Registration failed (server may not be running): {e}")
        
        # Create local dataset
        await self._create_dataset()
        
        # Create model
        self._create_model()
        
        logger.info(f"[{self.client_id}] Initialization complete")
    
    async def _create_dataset(self):
        """Create synthetic dataset for this bank."""
        logger.info(f"[{self.client_id}] Generating synthetic data ({self.num_samples} samples)...")
        
        if self.model_type == 'cst_transformer':
            dataset = CSTFLDataset(
                bank_id=self.client_id,
                num_samples=self.num_samples,
                seed=hash(self.client_id) % 10000
            )
        else:
            dataset = GNNFLDataset(
                bank_id=self.client_id,
                num_samples=self.num_samples,
                seed=hash(self.client_id) % 10000
            )
        
        # Split train/val
        val_size = int(len(dataset) * 0.1)
        train_size = len(dataset) - val_size
        
        train_dataset, val_dataset = torch.utils.data.random_split(
            dataset, [train_size, val_size],
            generator=torch.Generator().manual_seed(42)
        )
        
        self.train_loader = DataLoader(
            train_dataset,
            batch_size=fl_config.batch_size,
            shuffle=True
        )
        self.val_loader = DataLoader(
            val_dataset,
            batch_size=fl_config.batch_size,
            shuffle=False
        )
        
        logger.info(f"[{self.client_id}] Data created: {len(train_dataset)} train, {len(val_dataset)} val")
    
    def _create_model(self):
        """Create model instance."""
        if self.model_type == 'cst_transformer':
            from app.ml.models.cst_transformer import CSTTransformer
            self.model = CSTTransformer(
                d_model=256,
                n_heads=8,
                n_layers=4,
                num_fraud_types=9,
                num_states=16,
                num_atms=7112,
                dropout=0.2,
            )
        else:
            from app.ml.models.mule_detector_gnn import MuleDetectorGNN
            self.model = MuleDetectorGNN(
                input_dim=32,
                hidden_dim=64,
                num_layers=3,
                num_heads=4,
                dropout=0.3,
                edge_dim=5,
            )
        
        self.trainer = ClientTrainer(
            model=self.model,
            device=self.device,
            model_type=self.model_type,
            local_epochs=self.local_epochs,
            learning_rate=self.learning_rate
        )
        
        logger.info(f"[{self.client_id}] Model created on {self.device}")
    
    async def participate_in_round(
        self,
        round_number: int,
        global_weights: Dict[str, Any] = None,
        epochs: int = None,
        use_server: bool = True
    ) -> Dict[str, Any]:
        """
        Participate in a federated learning round.
        
        Args:
            round_number: Round number
            global_weights: Global model weights (None = fetch from server)
            epochs: Local epochs (None = use config)
            use_server: Whether to communicate with server
            
        Returns:
            Training results
        """
        logger.info(f"[{self.client_id}] Starting round {round_number}...")
        start_time = time.time()
        
        # Load global weights
        if global_weights is not None:
            self.trainer.set_global_weights(global_weights)
        elif use_server:
            try:
                model_data = await self.communicator.get_global_model(self.model_type)
                self.trainer.set_global_weights(model_data['weights'])
            except Exception as e:
                logger.warning(f"[{self.client_id}] Could not fetch global model: {e}")
        
        # Train locally
        results = self.trainer.train_local(
            train_loader=self.train_loader,
            epochs=epochs or fl_config.local_epochs,
            validation_loader=self.val_loader
        )
        
        training_time = time.time() - start_time
        results['metrics']['total_time'] = training_time
        
        logger.info(f"[{self.client_id}] Round {round_number} complete. "
                   f"Loss: {results['metrics']['loss']:.4f}, "
                   f"Time: {training_time:.1f}s")
        
        # Submit to server
        if use_server:
            try:
                await self.communicator.submit_update(
                    model_type=self.model_type,
                    round_number=round_number,
                    weights=results['weights'],
                    num_samples=results['num_samples'],
                    metrics=results['metrics']
                )
            except Exception as e:
                logger.warning(f"[{self.client_id}] Could not submit update: {e}")
        
        return results
    
    async def close(self):
        """Close connections."""
        await self.communicator.close()
        logger.info(f"[{self.client_id}] Closed")


async def simulate_federated_round(
    clients: List[BankClientSimulator],
    round_number: int,
    global_weights: Dict[str, Any] = None
) -> List[Dict[str, Any]]:
    """
    Simulate a federated learning round with multiple clients.
    
    Args:
        clients: List of client simulators
        round_number: Round number
        global_weights: Global weights to distribute
        
    Returns:
        List of client results
    """
    logger.info(f"=== Federated Round {round_number} ===")
    
    # Run all clients in parallel
    tasks = [
        client.participate_in_round(
            round_number=round_number,
            global_weights=global_weights,
            use_server=False  # Offline mode
        )
        for client in clients
    ]
    
    results = await asyncio.gather(*tasks)
    
    # Calculate aggregate metrics
    total_samples = sum(r['num_samples'] for r in results)
    avg_loss = sum(r['metrics']['loss'] * r['num_samples'] for r in results) / total_samples
    
    logger.info(f"Round {round_number} complete. "
               f"Clients: {len(clients)}, "
               f"Total samples: {total_samples}, "
               f"Avg loss: {avg_loss:.4f}")
    
    return results


async def run_offline_simulation(
    bank_ids: List[str] = None,
    model_type: str = 'cst_transformer',
    num_rounds: int = 10,
    samples_per_bank: int = 2000,
    local_epochs: int = 3,
    learning_rate: float = 0.001
) -> Dict[str, Any]:
    """
    Run a complete offline federated learning simulation.
    
    Useful for testing without running the server.
    
    Args:
        bank_ids: List of bank IDs (None = use config)
        model_type: Model type
        num_rounds: Number of rounds
        samples_per_bank: Samples per bank
        local_epochs: Training epochs per round per client
        learning_rate: Learning rate for training
        
    Returns:
        Simulation results
    """
    from app.federated_learning.server.aggregator import FederatedAveraging
    
    if bank_ids is None:
        bank_ids = fl_config.bank_clients[:3]  # Use first 3 banks
    
    logger.info(f"Starting offline FL simulation: {num_rounds} rounds, {len(bank_ids)} banks")
    
    # Create clients
    clients = []
    for bank_id in bank_ids:
        client = BankClientSimulator(
            client_id=bank_id,
            model_type=model_type,
            num_samples=samples_per_bank,
            local_epochs=local_epochs,
            learning_rate=learning_rate
        )
        await client.initialize()
        clients.append(client)
    
    # Initialize global weights from first client
    global_weights = model_weights_to_dict(clients[0].model)
    
    # Run rounds
    history = []
    aggregator = FederatedAveraging()
    
    for round_num in range(1, num_rounds + 1):
        # Run round
        results = await simulate_federated_round(
            clients=clients,
            round_number=round_num,
            global_weights=global_weights
        )
        
        # Aggregate
        client_weights = [r['weights'] for r in results]
        client_samples = [r['num_samples'] for r in results]
        
        global_weights = aggregator.aggregate(client_weights, client_samples)
        
        # Distribute new global weights
        for client in clients:
            client.trainer.set_global_weights(global_weights)
        
        # Record history
        history.append({
            'round': round_num,
            'avg_loss': sum(r['metrics']['loss'] * r['num_samples'] for r in results) / sum(client_samples),
            'total_samples': sum(client_samples)
        })
    
    # Cleanup
    for client in clients:
        await client.close()
    
    logger.info(f"Simulation complete. Final avg loss: {history[-1]['avg_loss']:.4f}")
    
    return {
        'num_rounds': num_rounds,
        'num_clients': len(bank_ids),
        'model_type': model_type,
        'history': history,
        'final_weights': global_weights
    }

