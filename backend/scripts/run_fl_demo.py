#!/usr/bin/env python3
"""
Federated Learning Demo Script

Demonstrates federated learning in action:
1. Creates bank clients (configurable)
2. Generates synthetic data for each bank
3. Runs N rounds of federated learning
4. Shows how model improves across rounds

Run:
    python scripts/run_fl_demo.py
    python scripts/run_fl_demo.py --rounds 50 --banks sbi hdfc icici axis kotak
    python scripts/run_fl_demo.py --model mule_detector_gnn --rounds 30
"""

import asyncio
import sys
import os
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(description='AEGIS Federated Learning Demo')
    parser.add_argument('--model', type=str, default='cst_transformer',
                        choices=['cst_transformer', 'mule_detector_gnn'],
                        help='Model type to train')
    parser.add_argument('--rounds', type=int, default=10,
                        help='Number of federated learning rounds')
    parser.add_argument('--banks', nargs='+', default=['sbi', 'hdfc', 'icici'],
                        help='Bank IDs to simulate')
    parser.add_argument('--samples', type=int, default=2000,
                        help='Samples per bank')
    parser.add_argument('--epochs', type=int, default=3,
                        help='Local epochs per round')
    parser.add_argument('--lr', type=float, default=0.001,
                        help='Learning rate')
    return parser.parse_args()


async def main():
    args = parse_args()
    
    model_name = "CST Transformer (Location Prediction)" if args.model == 'cst_transformer' else "GNN Mule Detector"
    bank_names = ', '.join([b.upper() for b in args.banks])
    
    print("""
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║     🛡️  AEGIS FEDERATED LEARNING DEMO                            ║
║                                                                   ║
║     Privacy-Preserving Cross-Bank Fraud Detection Training        ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
    """)
    
    from app.federated_learning.client.simulator import run_offline_simulation
    
    print("📋 Configuration:")
    print(f"   - Model: {model_name}")
    print(f"   - Banks: {bank_names}")
    print(f"   - Samples per bank: {args.samples}")
    print(f"   - Rounds: {args.rounds}")
    print(f"   - Local epochs/round: {args.epochs}")
    print(f"   - Learning rate: {args.lr}")
    print()
    
    print("🔄 Starting Federated Learning Simulation...")
    print("-" * 60)
    print()
    
    results = await run_offline_simulation(
        bank_ids=args.banks,
        model_type=args.model,
        num_rounds=args.rounds,
        samples_per_bank=args.samples,
        local_epochs=args.epochs,
        learning_rate=args.lr
    )
    
    print()
    print("=" * 60)
    print("📊 TRAINING HISTORY")
    print("=" * 60)
    print()
    print(f"{'Round':>6} | {'Loss':>10} | {'Δ Loss':>10} | {'Progress':>20}")
    print("-" * 60)
    
    prev_loss = None
    for entry in results['history']:
        delta = f"{entry['avg_loss'] - prev_loss:+.4f}" if prev_loss else "   -   "
        progress_pct = entry['round'] / args.rounds
        progress = "█" * int(progress_pct * 20)
        print(f"{entry['round']:>6} | {entry['avg_loss']:>10.4f} | {delta:>10} | {progress:<20}")
        prev_loss = entry['avg_loss']
    
    print("-" * 60)
    print()
    
    improvement = results['history'][0]['avg_loss'] - results['history'][-1]['avg_loss']
    improvement_pct = (improvement / results['history'][0]['avg_loss']) * 100
    
    print("📈 SUMMARY")
    print(f"   Initial Loss: {results['history'][0]['avg_loss']:.4f}")
    print(f"   Final Loss:   {results['history'][-1]['avg_loss']:.4f}")
    print(f"   Improvement:  {improvement:.4f} ({improvement_pct:.1f}%)")
    print(f"   Total Rounds: {args.rounds}")
    print(f"   Banks Trained: {len(args.banks)}")
    print()
    
    print(f"""
✅ TRAINING COMPLETE!

Key Takeaways:
  • {len(args.banks)} banks trained collaboratively
  • Each bank kept their data PRIVATE
  • Only model weights were shared (not transaction data!)
  • Combined knowledge improved fraud detection for ALL banks
  • Model saved to: checkpoints/federated/{args.model}_global.pt

Next Steps:
  • Train more rounds: --rounds 100
  • Add more banks: --banks sbi hdfc icici axis kotak pnb bob
  • Train GNN model: --model mule_detector_gnn
  • Use in production: Load from checkpoints/federated/
    """)


if __name__ == '__main__':
    asyncio.run(main())
