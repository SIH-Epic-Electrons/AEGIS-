"""
GNN Model for Mule Account Detection
Graph Neural Network to identify mule accounts in transaction networks
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import GATConv, GCNConv, global_mean_pool, global_max_pool
from torch_geometric.data import Data, Batch
from typing import Optional, Dict, List, Tuple
import numpy as np
from datetime import datetime


class MuleDetectorGNN(nn.Module):
    """
    Graph Attention Network for mule account detection.
    
    Architecture:
    - Node features: Account characteristics (age, balance, transaction patterns, etc.)
    - Edge features: Transaction details (amount, time, type)
    - Output: Mule probability (0-1) for each account
    """
    
    def __init__(
        self,
        input_dim: int = 32,  # Number of account features
        hidden_dim: int = 64,
        num_layers: int = 3,
        num_heads: int = 4,
        dropout: float = 0.3,
        edge_dim: int = 5,  # Transaction features (amount, time, type, etc.)
    ):
        super().__init__()
        
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.num_layers = num_layers
        self.num_heads = num_heads
        self.dropout = dropout
        
        # Input projection
        self.input_proj = nn.Linear(input_dim, hidden_dim)
        
        # Graph Attention Layers
        self.gat_layers = nn.ModuleList()
        for i in range(num_layers):
            if i == 0:
                # First layer: input_dim -> hidden_dim
                self.gat_layers.append(
                    GATConv(
                        hidden_dim,
                        hidden_dim // num_heads,
                        heads=num_heads,
                        dropout=dropout,
                        edge_dim=edge_dim,
                        concat=True
                    )
                )
            else:
                # Subsequent layers: hidden_dim -> hidden_dim
                self.gat_layers.append(
                    GATConv(
                        hidden_dim,
                        hidden_dim // num_heads,
                        heads=num_heads,
                        dropout=dropout,
                        edge_dim=edge_dim,
                        concat=True
                    )
                )
        
        # Output head for mule classification
        self.classifier = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim // 2, hidden_dim // 4),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim // 4, 1),  # Binary classification
            nn.Sigmoid()
        )
        
        # Risk score head (0-100)
        self.risk_head = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim // 2, 1),
            nn.Sigmoid()
        )
    
    def forward(
        self,
        x: torch.Tensor,
        edge_index: torch.Tensor,
        edge_attr: Optional[torch.Tensor] = None,
        batch: Optional[torch.Tensor] = None
    ) -> Dict[str, torch.Tensor]:
        """
        Forward pass.
        
        Args:
            x: Node features [num_nodes, input_dim]
            edge_index: Edge connectivity [2, num_edges]
            edge_attr: Edge features [num_edges, edge_dim]
            batch: Batch vector for graph-level pooling [num_nodes]
        
        Returns:
            Dictionary with:
                - mule_prob: Mule probability per node [num_nodes, 1]
                - risk_score: Risk score per node [num_nodes, 1]
        """
        # Input projection
        x = self.input_proj(x)
        
        # Graph attention layers
        for i, gat_layer in enumerate(self.gat_layers):
            x = gat_layer(x, edge_index, edge_attr)
            if i < len(self.gat_layers) - 1:
                x = F.elu(x)
                x = F.dropout(x, p=self.dropout, training=self.training)
        
        # Final node embeddings
        node_embeddings = x
        
        # Classification outputs
        mule_prob = self.classifier(node_embeddings)
        risk_score = self.risk_head(node_embeddings) * 100  # Scale to 0-100
        
        return {
            "mule_prob": mule_prob,
            "risk_score": risk_score,
            "node_embeddings": node_embeddings
        }
    
    def predict_accounts(
        self,
        x: torch.Tensor,
        edge_index: torch.Tensor,
        edge_attr: Optional[torch.Tensor] = None,
        threshold: float = 0.5
    ) -> Dict[str, np.ndarray]:
        """
        Predict mule accounts from graph.
        
        Args:
            x: Node features
            edge_index: Edge connectivity
            edge_attr: Edge features
            threshold: Classification threshold
        
        Returns:
            Dictionary with predictions
        """
        self.eval()
        with torch.no_grad():
            outputs = self.forward(x, edge_index, edge_attr)
            
            mule_probs = outputs["mule_prob"].cpu().numpy().flatten()
            risk_scores = outputs["risk_score"].cpu().numpy().flatten()
            predictions = (mule_probs >= threshold).astype(int)
        
        return {
            "mule_probabilities": mule_probs,
            "risk_scores": risk_scores,
            "predictions": predictions,
            "mule_accounts": np.where(predictions == 1)[0].tolist()
        }


def create_graph_from_transactions(
    accounts: List[Dict],
    transactions: List[Dict],
    account_features: List[str]
) -> Data:
    """
    Create PyTorch Geometric graph from accounts and transactions.
    
    Args:
        accounts: List of account dictionaries
        transactions: List of transaction dictionaries
        account_features: List of feature names to use
    
    Returns:
        PyTorch Geometric Data object
    """
    # Create account ID to index mapping
    account_ids = [acc["account_id"] for acc in accounts]
    account_to_idx = {acc_id: idx for idx, acc_id in enumerate(account_ids)}
    
    # Node features: [num_nodes, num_features]
    node_features = []
    for acc in accounts:
        features = [acc.get(feat, 0.0) for feat in account_features]
        node_features.append(features)
    
    x = torch.tensor(node_features, dtype=torch.float32)
    
    # Edge connectivity: [2, num_edges]
    edge_index = []
    edge_attrs = []
    
    for txn in transactions:
        from_idx = account_to_idx.get(txn["from_account"])
        to_idx = account_to_idx.get(txn["to_account"])
        
        if from_idx is not None and to_idx is not None:
            edge_index.append([from_idx, to_idx])
            
            # Edge features: [amount, time_hour, time_day, transaction_type_encoded, hop_number]
            amount = txn.get("amount", 0.0) / 100000.0  # Normalize
            
            # Parse timestamp (handle both string and datetime objects)
            txn_timestamp = txn.get("transaction_timestamp", datetime.now())
            if isinstance(txn_timestamp, str):
                try:
                    # Try parsing with pandas (most reliable)
                    import pandas as pd
                    txn_timestamp = pd.to_datetime(txn_timestamp).to_pydatetime()
                except:
                    try:
                        # Try parsing ISO format
                        if 'T' in txn_timestamp:
                            txn_timestamp = datetime.fromisoformat(txn_timestamp.replace('Z', '+00:00').split('+')[0])
                        else:
                            # Try common formats
                            for fmt in ["%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"]:
                                try:
                                    txn_timestamp = datetime.strptime(txn_timestamp, fmt)
                                    break
                                except:
                                    continue
                    except:
                        # Fallback to current time
                        txn_timestamp = datetime.now()
            
            time_hour = txn_timestamp.hour / 24.0
            time_day = txn_timestamp.weekday() / 7.0
            txn_type = hash(txn.get("transaction_type", "OTHER")) % 10 / 10.0
            hop = txn.get("hop_number", 1) / 10.0
            
            edge_attrs.append([amount, time_hour, time_day, txn_type, hop])
    
    if len(edge_index) == 0:
        # Empty graph - create self-loops
        edge_index = [[i, i] for i in range(len(accounts))]
        edge_attrs = [[0.0, 0.0, 0.0, 0.0, 0.0] for _ in range(len(accounts))]
    
    edge_index = torch.tensor(edge_index, dtype=torch.long).t().contiguous()
    edge_attr = torch.tensor(edge_attrs, dtype=torch.float32)
    
    # Create graph data
    graph_data = Data(
        x=x,
        edge_index=edge_index,
        edge_attr=edge_attr,
        num_nodes=len(accounts)
    )
    
    return graph_data


# Feature list for account classification
ACCOUNT_FEATURES = [
    "account_age_days",
    "transaction_velocity",
    "unique_counterparties",
    "avg_balance_30d",
    "max_single_transaction",
    "night_transaction_ratio",
    "weekend_transaction_ratio",
    "incoming_outgoing_ratio",
    "geographic_spread",
    "account_balance_volatility",
    "kyc_verification_score",
    "linked_cases_count",
    "rapid_transfer_count",
    "suspicious_pattern_score",
    # Add normalized versions
    "account_age_days_norm",  # Normalized to 0-1
    "transaction_velocity_norm",
    "unique_counterparties_norm",
    "avg_balance_30d_norm",
    "max_single_transaction_norm",
    # Add derived features
    "balance_to_transaction_ratio",
    "age_to_transaction_ratio",
    "counterparty_diversity",
    "temporal_anomaly_score",
    "network_centrality",
    "transaction_frequency_score",
    "amount_volatility",
    "time_between_transactions",
    "weekend_night_ratio",
    "rapid_transfer_ratio",
    "kyc_risk_score",
    "case_linkage_score",
]

