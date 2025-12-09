"""
Train GNN Model for Mule Account Detection
"""

import sys
from pathlib import Path
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset
from torch_geometric.data import Data, Batch
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import pickle
from tqdm import tqdm

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.ml.models.mule_detector_gnn import MuleDetectorGNN, create_graph_from_transactions, ACCOUNT_FEATURES

# Set device
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using device: {device}")

# Paths
DATA_DIR = Path(__file__).parent.parent / "data" / "processed"
CHECKPOINT_DIR = Path(__file__).parent.parent / "checkpoints" / "mule_detector"
CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)


class MuleDataset(Dataset):
    """Dataset for mule detection graphs"""
    
    def __init__(self, graphs, labels):
        self.graphs = graphs
        self.labels = labels
    
    def __len__(self):
        return len(self.graphs)
    
    def __getitem__(self, idx):
        graph = self.graphs[idx]
        label = self.labels[idx]
        graph.y = torch.tensor([label], dtype=torch.float32)
        return graph


def prepare_features(accounts_df: pd.DataFrame) -> pd.DataFrame:
    """Prepare and normalize features"""
    df = accounts_df.copy()
    
    # Normalize features
    numeric_cols = [
        "account_age_days",
        "transaction_velocity",
        "unique_counterparties",
        "avg_balance_30d",
        "max_single_transaction",
    ]
    
    for col in numeric_cols:
        if col in df.columns:
            df[f"{col}_norm"] = (df[col] - df[col].min()) / (df[col].max() - df[col].min() + 1e-8)
    
    # Derived features
    df["balance_to_transaction_ratio"] = df["avg_balance_30d"] / (df["transaction_velocity"] + 1)
    df["age_to_transaction_ratio"] = df["account_age_days"] / (df["transaction_velocity"] + 1)
    df["counterparty_diversity"] = df["unique_counterparties"] / (df["total_transactions_30d"] + 1)
    df["temporal_anomaly_score"] = (df["night_transaction_ratio"] + df["weekend_transaction_ratio"]) / 2
    df["network_centrality"] = df["linked_cases_count"] / (df["unique_counterparties"] + 1)
    df["transaction_frequency_score"] = df["transaction_velocity"] / 30.0
    df["amount_volatility"] = df["account_balance_volatility"]
    df["time_between_transactions"] = 1.0 / (df["transaction_velocity"] + 1)
    df["weekend_night_ratio"] = df["weekend_transaction_ratio"] * df["night_transaction_ratio"]
    df["rapid_transfer_ratio"] = df["rapid_transfer_count"] / (df["total_transactions_30d"] + 1)
    df["kyc_risk_score"] = 1.0 - df["kyc_verification_score"]
    df["case_linkage_score"] = df["linked_cases_count"] / 10.0
    
    return df


def load_data():
    """Load and prepare data"""
    print("Loading data...")
    
    accounts_df = pd.read_csv(DATA_DIR / "mule_accounts_dataset.csv")
    transactions_df = pd.read_csv(DATA_DIR / "mule_transactions_dataset.csv")
    cases_df = pd.read_csv(DATA_DIR / "mule_cases_dataset.csv")
    
    print(f"Loaded {len(accounts_df)} accounts, {len(transactions_df)} transactions, {len(cases_df)} cases")
    
    # Prepare features
    accounts_df = prepare_features(accounts_df)
    
    # Get available features
    available_features = [f for f in ACCOUNT_FEATURES if f in accounts_df.columns]
    print(f"Using {len(available_features)} features: {available_features[:5]}...")
    
    # Group transactions by case
    case_transactions = transactions_df.groupby("case_id")
    
    graphs = []
    labels = []
    
    print("Creating graphs...")
    error_count = 0
    skipped_count = 0
    
    for case_id, case_txns in tqdm(case_transactions):
        # Get accounts involved in this case
        involved_accounts = set()
        for _, txn in case_txns.iterrows():
            involved_accounts.add(txn["from_account"])
            involved_accounts.add(txn["to_account"])
        
        # Filter accounts that exist in dataset
        case_accounts = accounts_df[accounts_df["account_id"].isin(involved_accounts)].to_dict("records")
        
        # Check if we have enough accounts
        if len(case_accounts) < 2:
            skipped_count += 1
            continue
        
        # Check if we have all accounts (if not, create dummy accounts for missing ones)
        account_lookup = {acc["account_id"]: acc for acc in case_accounts}
        missing_accounts = involved_accounts - set(account_lookup.keys())
        
        if missing_accounts:
            # Create dummy accounts for missing ones (from transaction data)
            for acc_id in missing_accounts:
                # Find transaction to get account details
                txn_rows = case_txns[(case_txns["from_account"] == acc_id) | (case_txns["to_account"] == acc_id)]
                if len(txn_rows) > 0:
                    txn_row = txn_rows.iloc[0]
                    # Determine if mule based on hop number
                    is_mule = txn_row.get("hop_number", 1) <= 2
                    
                    # Create dummy account with default features
                    dummy_account = {
                        "account_id": acc_id,
                        "account_number": str(txn_row.get("from_account_number") or txn_row.get("to_account_number", "")),
                        "bank": str(txn_row.get("from_bank") or txn_row.get("to_bank", "Unknown")),
                        "account_holder_name": str(txn_row.get("from_holder_name") or txn_row.get("to_holder_name", "Unknown")),
                        "is_mule": 1 if is_mule else 0,
                        # Default features (mule-like if early hop)
                        "account_age_days": 30 if is_mule else 365,
                        "transaction_velocity": 8.0 if is_mule else 3.0,
                        "unique_counterparties": 15 if is_mule else 8,
                        "avg_balance_30d": 30000.0 if is_mule else 100000.0,
                        "max_single_transaction": 200000.0,
                        "night_transaction_ratio": 0.4 if is_mule else 0.1,
                        "weekend_transaction_ratio": 0.5 if is_mule else 0.2,
                        "incoming_outgoing_ratio": 1.2 if is_mule else 1.0,
                        "geographic_spread": 0.3 if is_mule else 0.6,
                        "account_balance_volatility": 0.7 if is_mule else 0.2,
                        "kyc_verification_score": 0.5 if is_mule else 0.9,
                        "linked_cases_count": 1 if is_mule else 0,
                        "rapid_transfer_count": 5 if is_mule else 1,
                        "total_transactions_30d": 240 if is_mule else 90,
                        "suspicious_pattern_score": 0.8 if is_mule else 0.1,
                    }
                    # Add normalized and derived features (same as prepare_features)
                    dummy_account["account_age_days_norm"] = min(dummy_account["account_age_days"] / 365.0, 1.0)
                    dummy_account["transaction_velocity_norm"] = min(dummy_account["transaction_velocity"] / 50.0, 1.0)
                    dummy_account["unique_counterparties_norm"] = min(dummy_account["unique_counterparties"] / 100.0, 1.0)
                    dummy_account["avg_balance_30d_norm"] = min(dummy_account["avg_balance_30d"] / 1000000.0, 1.0)
                    dummy_account["max_single_transaction_norm"] = min(dummy_account["max_single_transaction"] / 1000000.0, 1.0)
                    dummy_account["balance_to_transaction_ratio"] = dummy_account["avg_balance_30d"] / (dummy_account["transaction_velocity"] + 1)
                    dummy_account["age_to_transaction_ratio"] = dummy_account["account_age_days"] / (dummy_account["transaction_velocity"] + 1)
                    dummy_account["counterparty_diversity"] = dummy_account["unique_counterparties"] / (dummy_account["total_transactions_30d"] + 1)
                    dummy_account["temporal_anomaly_score"] = (dummy_account["night_transaction_ratio"] + dummy_account["weekend_transaction_ratio"]) / 2
                    dummy_account["network_centrality"] = dummy_account["linked_cases_count"] / (dummy_account["unique_counterparties"] + 1)
                    dummy_account["transaction_frequency_score"] = dummy_account["transaction_velocity"] / 30.0
                    dummy_account["amount_volatility"] = dummy_account["account_balance_volatility"]
                    dummy_account["time_between_transactions"] = 1.0 / (dummy_account["transaction_velocity"] + 1)
                    dummy_account["weekend_night_ratio"] = dummy_account["weekend_transaction_ratio"] * dummy_account["night_transaction_ratio"]
                    dummy_account["rapid_transfer_ratio"] = dummy_account["rapid_transfer_count"] / (dummy_account["total_transactions_30d"] + 1)
                    dummy_account["kyc_risk_score"] = 1.0 - dummy_account["kyc_verification_score"]
                    dummy_account["case_linkage_score"] = dummy_account["linked_cases_count"] / 10.0
                    
                    # Add any remaining missing features
                    for feat in available_features:
                        if feat not in dummy_account:
                            dummy_account[feat] = 0.0
                    
                    case_accounts.append(dummy_account)
        
        if len(case_accounts) < 2:
            skipped_count += 1
            continue
        
        # Get transactions for this case
        # Convert timestamp strings to datetime objects (suppress warnings)
        case_txns_copy = case_txns.copy()
        if 'transaction_timestamp' in case_txns_copy.columns:
            import warnings
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                case_txns_copy['transaction_timestamp'] = pd.to_datetime(
                    case_txns_copy['transaction_timestamp'],
                    format='mixed',
                    errors='coerce'
                )
        case_txn_list = case_txns_copy.to_dict("records")
        
        # Create graph
        try:
            graph = create_graph_from_transactions(
                case_accounts,
                case_txn_list,
                available_features
            )
            
            # Get labels (mule or not) for each account
            account_labels = [acc.get("is_mule", 0) for acc in case_accounts]
            
            graphs.append(graph)
            labels.append(account_labels)
        except Exception as e:
            error_count += 1
            if error_count <= 5:  # Print first 5 errors
                print(f"\nError creating graph for case {case_id}: {e}")
            continue
    
    print(f"\nCreated {len(graphs)} graphs")
    if skipped_count > 0:
        print(f"Skipped {skipped_count} cases (insufficient accounts)")
    if error_count > 0:
        print(f"Errors: {error_count} cases")
    
    return graphs, labels, available_features


def train_model(graphs, labels, available_features, epochs=50, batch_size=32):
    """Train the GNN model"""
    print(f"\nTraining model with {len(available_features)} features...")
    
    # Split data
    train_graphs, test_graphs, train_labels, test_labels = train_test_split(
        graphs, labels, test_size=0.2, random_state=42
    )
    
    # Create datasets
    train_dataset = MuleDataset(train_graphs, train_labels)
    test_dataset = MuleDataset(test_graphs, test_labels)
    
    # Create model
    model = MuleDetectorGNN(
        input_dim=len(available_features),
        hidden_dim=64,
        num_layers=3,
        num_heads=4,
        dropout=0.3
    ).to(device)
    
    # Optimizer and loss
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001, weight_decay=1e-5)
    criterion = nn.BCELoss()
    
    # Training loop
    best_loss = float('inf')
    
    for epoch in range(epochs):
        model.train()
        total_loss = 0
        
        # Batch graphs
        for i in range(0, len(train_dataset), batch_size):
            batch_graphs = train_dataset.graphs[i:i+batch_size]
            batch_labels = train_dataset.labels[i:i+batch_size]
            
            # Create batch
            batch = Batch.from_data_list(batch_graphs).to(device)
            
            # Forward pass
            outputs = model(batch.x, batch.edge_index, batch.edge_attr, batch.batch)
            
            # Get labels for all nodes
            node_labels = torch.cat([torch.tensor(l, dtype=torch.float32) for l in batch_labels]).to(device)
            
            # Loss
            loss = criterion(outputs["mule_prob"].squeeze(), node_labels)
            
            # Backward pass
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
        
        avg_loss = total_loss / (len(train_dataset) // batch_size + 1)
        
        # Validation
        if (epoch + 1) % 5 == 0:
            model.eval()
            with torch.no_grad():
                val_loss = 0
                correct = 0
                total = 0
                
                for i in range(0, len(test_dataset), batch_size):
                    batch_graphs = test_dataset.graphs[i:i+batch_size]
                    batch_labels = test_dataset.labels[i:i+batch_size]
                    
                    batch = Batch.from_data_list(batch_graphs).to(device)
                    outputs = model(batch.x, batch.edge_index, batch.edge_attr, batch.batch)
                    
                    node_labels = torch.cat([torch.tensor(l, dtype=torch.float32) for l in batch_labels]).to(device)
                    loss = criterion(outputs["mule_prob"].squeeze(), node_labels)
                    val_loss += loss.item()
                    
                    predictions = (outputs["mule_prob"].squeeze() > 0.5).float()
                    correct += (predictions == node_labels).sum().item()
                    total += len(node_labels)
                
                val_loss /= (len(test_dataset) // batch_size + 1)
                accuracy = correct / total if total > 0 else 0
                
                print(f"Epoch {epoch+1}/{epochs} - Loss: {avg_loss:.4f}, Val Loss: {val_loss:.4f}, Accuracy: {accuracy:.4f}")
                
                if val_loss < best_loss:
                    best_loss = val_loss
                    torch.save({
                        'epoch': epoch,
                        'model_state_dict': model.state_dict(),
                        'optimizer_state_dict': optimizer.state_dict(),
                        'loss': val_loss,
                        'features': available_features,
                    }, CHECKPOINT_DIR / "best_model.pt")
                    print(f"  ✓ Saved best model (val_loss: {val_loss:.4f})")
    
    print(f"\n✅ Training complete! Best validation loss: {best_loss:.4f}")
    return model, available_features


if __name__ == "__main__":
    # Load data
    graphs, labels, available_features = load_data()
    
    if graphs is None:
        print("\n❌ Cannot proceed without graphs. Please regenerate dataset.")
        exit(1)
    
    # Train model
    model, features = train_model(graphs, labels, available_features, epochs=50)
    
    # Save feature list
    with open(CHECKPOINT_DIR / "features.pkl", "wb") as f:
        pickle.dump(features, f)
    
    print(f"\n✅ Model saved to {CHECKPOINT_DIR}")
    print(f"✅ Features saved: {len(features)} features")

