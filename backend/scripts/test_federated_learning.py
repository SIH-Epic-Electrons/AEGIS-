#!/usr/bin/env python3
"""
Federated Learning Test Script

This script tests the federated learning implementation:
1. Offline simulation (no server required)
2. Full server-client simulation

Usage:
    # Offline test (quick test)
    python scripts/test_federated_learning.py --mode offline --rounds 5

    # Server test (requires running server)
    python scripts/test_federated_learning.py --mode server --rounds 10
"""

import asyncio
import argparse
import logging
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.federated_learning.config import fl_config
from app.federated_learning.client.simulator import (
    BankClientSimulator,
    run_offline_simulation,
    simulate_federated_round
)
from app.federated_learning.server.coordinator import coordinator
from app.federated_learning.server.aggregator import FederatedAveraging
from app.federated_learning.utils.serialization import model_weights_to_dict

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def test_offline_simulation(
    num_rounds: int = 5,
    num_banks: int = 3,
    samples_per_bank: int = 2000,
    model_type: str = 'cst_transformer'
):
    """
    Test federated learning in offline mode (no server required).
    
    This simulates the entire FL process locally.
    """
    logger.info("=" * 60)
    logger.info("FEDERATED LEARNING - OFFLINE SIMULATION TEST")
    logger.info("=" * 60)
    logger.info(f"Configuration:")
    logger.info(f"  - Rounds: {num_rounds}")
    logger.info(f"  - Banks: {num_banks}")
    logger.info(f"  - Samples per bank: {samples_per_bank}")
    logger.info(f"  - Model: {model_type}")
    logger.info("=" * 60)
    
    # Run simulation
    results = await run_offline_simulation(
        bank_ids=fl_config.bank_clients[:num_banks],
        model_type=model_type,
        num_rounds=num_rounds,
        samples_per_bank=samples_per_bank
    )
    
    # Print results
    logger.info("\n" + "=" * 60)
    logger.info("SIMULATION RESULTS")
    logger.info("=" * 60)
    
    for entry in results['history']:
        logger.info(f"Round {entry['round']:3d} | "
                   f"Loss: {entry['avg_loss']:.4f} | "
                   f"Samples: {entry['total_samples']}")
    
    logger.info("-" * 60)
    logger.info(f"Final Loss: {results['history'][-1]['avg_loss']:.4f}")
    logger.info(f"Loss Improvement: {results['history'][0]['avg_loss'] - results['history'][-1]['avg_loss']:.4f}")
    logger.info("=" * 60)
    
    return results


async def test_server_simulation(
    num_rounds: int = 5,
    num_banks: int = 3,
    samples_per_bank: int = 2000,
    model_type: str = 'cst_transformer',
    server_url: str = None
):
    """
    Test federated learning with server communication.
    
    Requires the AEGIS server to be running.
    """
    server_url = server_url or fl_config.server_url
    
    logger.info("=" * 60)
    logger.info("FEDERATED LEARNING - SERVER SIMULATION TEST")
    logger.info("=" * 60)
    logger.info(f"Server URL: {server_url}")
    logger.info(f"Configuration:")
    logger.info(f"  - Rounds: {num_rounds}")
    logger.info(f"  - Banks: {num_banks}")
    logger.info(f"  - Samples per bank: {samples_per_bank}")
    logger.info(f"  - Model: {model_type}")
    logger.info("=" * 60)
    
    bank_ids = fl_config.bank_clients[:num_banks]
    
    # Create and initialize clients
    clients = []
    for bank_id in bank_ids:
        client = BankClientSimulator(
            client_id=bank_id,
            model_type=model_type,
            server_url=server_url,
            num_samples=samples_per_bank
        )
        await client.initialize()
        clients.append(client)
    
    try:
        # Run federated learning rounds
        for round_num in range(1, num_rounds + 1):
            logger.info(f"\n--- Round {round_num} ---")
            
            # Each client participates
            for client in clients:
                try:
                    results = await client.participate_in_round(
                        round_number=round_num,
                        use_server=True
                    )
                    logger.info(f"{client.client_id}: Loss={results['metrics']['loss']:.4f}")
                except Exception as e:
                    logger.error(f"{client.client_id}: Error - {e}")
            
            # Small delay between rounds
            await asyncio.sleep(1)
        
        logger.info("\n" + "=" * 60)
        logger.info("SERVER SIMULATION COMPLETE")
        logger.info("=" * 60)
        
    finally:
        # Cleanup
        for client in clients:
            await client.close()


async def test_data_generation():
    """Test synthetic data generation."""
    logger.info("=" * 60)
    logger.info("TESTING SYNTHETIC DATA GENERATION")
    logger.info("=" * 60)
    
    from app.federated_learning.data.synthetic_generator import (
        SyntheticTransactionGenerator,
        generate_bank_dataset
    )
    
    # Test CST data
    logger.info("\n--- CST Data Generation ---")
    cst_data = generate_bank_dataset(
        bank_id='sbi',
        num_samples=100,
        model_type='cst_transformer'
    )
    logger.info(f"Generated {len(cst_data)} CST samples")
    logger.info(f"Sample keys: {list(cst_data[0].keys())}")
    logger.info(f"Sample victim coords: {cst_data[0]['victim_coords']}")
    logger.info(f"Sample target ATM: {cst_data[0]['target_atm_id']}")
    
    # Test GNN data
    logger.info("\n--- GNN Data Generation ---")
    gnn_data = generate_bank_dataset(
        bank_id='hdfc',
        num_samples=10,
        model_type='mule_detector_gnn'
    )
    logger.info(f"Generated {len(gnn_data)} GNN samples (graphs)")
    logger.info(f"Sample keys: {list(gnn_data[0].keys())}")
    logger.info(f"Sample nodes: {len(gnn_data[0]['node_features'])}")
    logger.info(f"Sample edges: {len(gnn_data[0]['edge_index'])}")
    
    # Test PyTorch datasets
    logger.info("\n--- PyTorch Dataset Tests ---")
    from app.federated_learning.data.cst_synthetic import CSTFLDataset
    from app.federated_learning.data.gnn_synthetic import GNNFLDataset
    
    cst_dataset = CSTFLDataset(bank_id='icici', num_samples=500)
    logger.info(f"CST Dataset size: {len(cst_dataset)}")
    sample = cst_dataset[0]
    logger.info(f"CST sample shape: data={sample[0].shape}, target={sample[1]}")
    
    gnn_dataset = GNNFLDataset(bank_id='axis', num_samples=500)
    logger.info(f"GNN Dataset size: {len(gnn_dataset)}")
    
    logger.info("\n" + "=" * 60)
    logger.info("DATA GENERATION TEST COMPLETE")
    logger.info("=" * 60)


async def test_aggregation():
    """Test FedAvg aggregation."""
    import numpy as np
    
    logger.info("=" * 60)
    logger.info("TESTING FEDAVG AGGREGATION")
    logger.info("=" * 60)
    
    from app.federated_learning.server.aggregator import (
        FederatedAveraging,
        FederatedProximal,
        validate_client_weights
    )
    
    # Create mock weights
    client1_weights = {
        'layer.weight': np.array([[1.0, 2.0], [3.0, 4.0]]),
        'layer.bias': np.array([0.5, 1.0])
    }
    client2_weights = {
        'layer.weight': np.array([[2.0, 3.0], [4.0, 5.0]]),
        'layer.bias': np.array([1.0, 1.5])
    }
    client3_weights = {
        'layer.weight': np.array([[3.0, 4.0], [5.0, 6.0]]),
        'layer.bias': np.array([1.5, 2.0])
    }
    
    client_weights = [client1_weights, client2_weights, client3_weights]
    client_samples = [100, 200, 300]  # Different sample counts
    
    # Test validation
    is_valid = validate_client_weights(client_weights)
    logger.info(f"Weights validation: {'PASSED' if is_valid else 'FAILED'}")
    
    # Test FedAvg
    aggregator = FederatedAveraging()
    aggregated = aggregator.aggregate(client_weights, client_samples)
    
    logger.info(f"\nClient 1 (100 samples): {client1_weights['layer.bias']}")
    logger.info(f"Client 2 (200 samples): {client2_weights['layer.bias']}")
    logger.info(f"Client 3 (300 samples): {client3_weights['layer.bias']}")
    logger.info(f"FedAvg result: {aggregated['layer.bias']}")
    
    # Expected: (0.5*100 + 1.0*200 + 1.5*300) / 600 = 700/600 = 1.167
    expected_bias_0 = (0.5*100 + 1.0*200 + 1.5*300) / 600
    logger.info(f"Expected bias[0]: {expected_bias_0:.3f}")
    logger.info(f"Actual bias[0]: {aggregated['layer.bias'][0]:.3f}")
    
    # Test FedProx
    logger.info("\n--- FedProx Test ---")
    fedprox = FederatedProximal(mu=0.1)
    global_weights = client1_weights.copy()
    aggregated_prox = fedprox.aggregate(client_weights, client_samples, global_weights)
    logger.info(f"FedProx result (mu=0.1): {aggregated_prox['layer.bias']}")
    
    logger.info("\n" + "=" * 60)
    logger.info("AGGREGATION TEST COMPLETE")
    logger.info("=" * 60)


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Federated Learning Test Script')
    parser.add_argument('--mode', choices=['offline', 'server', 'data', 'aggregation', 'all'],
                       default='offline', help='Test mode')
    parser.add_argument('--rounds', type=int, default=5, help='Number of FL rounds')
    parser.add_argument('--banks', type=int, default=3, help='Number of banks')
    parser.add_argument('--samples', type=int, default=2000, help='Samples per bank')
    parser.add_argument('--model', choices=['cst_transformer', 'mule_detector_gnn'],
                       default='cst_transformer', help='Model type')
    parser.add_argument('--server-url', type=str, default=None, help='Server URL')
    
    args = parser.parse_args()
    
    if args.mode == 'offline' or args.mode == 'all':
        await test_offline_simulation(
            num_rounds=args.rounds,
            num_banks=args.banks,
            samples_per_bank=args.samples,
            model_type=args.model
        )
    
    if args.mode == 'server':
        await test_server_simulation(
            num_rounds=args.rounds,
            num_banks=args.banks,
            samples_per_bank=args.samples,
            model_type=args.model,
            server_url=args.server_url
        )
    
    if args.mode == 'data' or args.mode == 'all':
        await test_data_generation()
    
    if args.mode == 'aggregation' or args.mode == 'all':
        await test_aggregation()


if __name__ == '__main__':
    asyncio.run(main())

