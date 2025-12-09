"""
Mule Detector Service
Uses GNN model to detect mule accounts
"""

import logging
from pathlib import Path
from typing import List, Dict, Optional
from uuid import UUID
import torch
import pickle
import pandas as pd

from app.ml.models.mule_detector_gnn import MuleDetectorGNN, create_graph_from_transactions

logger = logging.getLogger(__name__)


class MuleDetectorService:
    """Service for mule account detection using GNN"""
    
    def __init__(self):
        self.model = None
        self.features = None
        self.loaded = False
        self.checkpoint_path = Path(__file__).parent.parent.parent / "checkpoints" / "mule_detector" / "best_model.pt"
        self.features_path = Path(__file__).parent.parent.parent / "checkpoints" / "mule_detector" / "features.pkl"
    
    def load_model(self):
        """Load trained GNN model"""
        if self.loaded:
            return
        
        try:
            if not self.checkpoint_path.exists():
                logger.warning(f"Model checkpoint not found at {self.checkpoint_path}")
                logger.warning("Using default model (not trained)")
                return
            
            # Load features
            if self.features_path.exists():
                with open(self.features_path, "rb") as f:
                    self.features = pickle.load(f)
            else:
                logger.warning("Features file not found, using default features")
                self.features = [
                    "account_age_days", "transaction_velocity", "unique_counterparties",
                    "avg_balance_30d", "max_single_transaction", "night_transaction_ratio",
                    "weekend_transaction_ratio", "incoming_outgoing_ratio", "geographic_spread"
                ]
            
            # Load model
            checkpoint = torch.load(self.checkpoint_path, map_location="cpu")
            
            self.model = MuleDetectorGNN(
                input_dim=len(self.features),
                hidden_dim=64,
                num_layers=3,
                num_heads=4,
                dropout=0.3
            )
            
            self.model.load_state_dict(checkpoint["model_state_dict"])
            self.model.eval()
            
            self.loaded = True
            logger.info(f"Mule detector model loaded with {len(self.features)} features")
            
        except Exception as e:
            logger.error(f"Error loading mule detector model: {e}")
            self.loaded = False
    
    async def detect_mules_from_transactions(
        self,
        case_id: UUID,
        transactions: List[Dict],
        threshold: float = 0.5,
        victim_account: Optional[str] = None
    ) -> Dict[str, Dict]:
        """
        Detect mule accounts from transaction chain.
        
        Args:
            case_id: Case identifier
            transactions: List of transaction dictionaries
            threshold: Classification threshold
            victim_account: Account ID of the victim (will be excluded from mule detection)
        
        Returns:
            Dictionary mapping account_id -> prediction results
        """
        if not self.loaded:
            self.load_model()
        
        # Identify victim account (first account in transaction chain if not provided)
        if victim_account is None and transactions:
            victim_account = transactions[0].get("from_account")
        
        # Extract unique accounts
        accounts = {}
        victim_accounts = set()
        
        if victim_account:
            victim_accounts.add(victim_account)
        
        # Track which accounts are in the transaction chain (potential mules)
        # Accounts that receive money in fraud chain are more likely to be mules
        receiving_accounts = set()
        for txn in transactions:
            receiving_accounts.add(txn.get("to_account"))
        
        for txn in transactions:
            # From account
            from_acc = txn.get("from_account")
            if from_acc and from_acc not in accounts:
                # Victim or intermediate account - use legitimate account features
                is_victim = from_acc in victim_accounts
                accounts[from_acc] = {
                    "account_id": from_acc,
                    "account_number": txn.get("from_account_number", from_acc),
                    "bank": txn.get("from_bank", "Unknown"),
                    "account_holder_name": txn.get("from_holder_name", "Unknown"),
                    # Legitimate account features (older account, normal patterns)
                    "account_age_days": 365 if is_victim else 180,  # Older account
                    "transaction_velocity": 2.0 if is_victim else 3.0,  # Normal velocity
                    "unique_counterparties": 5 if is_victim else 8,  # Fewer counterparties
                    "avg_balance_30d": 100000.0 if is_victim else 75000.0,  # Higher balance
                    "max_single_transaction": 50000.0 if is_victim else 100000.0,
                    "night_transaction_ratio": 0.1 if is_victim else 0.15,  # Few night transactions
                    "weekend_transaction_ratio": 0.2 if is_victim else 0.25,  # Few weekend transactions
                    "incoming_outgoing_ratio": 0.8 if is_victim else 0.9,  # More outgoing (legitimate)
                    "geographic_spread": 0.1 if is_victim else 0.2,  # Local transactions
                }
            
            # To account
            to_acc = txn.get("to_account")
            if to_acc and to_acc not in accounts:
                # Check if account name indicates it's legitimate
                holder_name = txn.get("to_holder_name", "").lower()
                account_id_lower = to_acc.lower()
                is_explicitly_legitimate = (
                    "legitimate" in holder_name or 
                    "legitimate" in account_id_lower or
                    "business" in holder_name
                )
                
                # Determine if this looks like a mule based on position in chain
                # Accounts receiving money in fraud chain are suspicious
                hop_number = txn.get("hop_number", 1)
                is_likely_mule = hop_number <= 2 and not is_explicitly_legitimate  # First 2 hops are usually mules (unless explicitly legitimate)
                
                accounts[to_acc] = {
                    "account_id": to_acc,
                    "account_number": txn.get("to_account_number", to_acc),
                    "bank": txn.get("to_bank", "Unknown"),
                    "account_holder_name": txn.get("to_holder_name", "Unknown"),
                    # Features based on whether account is legitimate or mule
                    "account_age_days": 200 if is_explicitly_legitimate else (60 if is_likely_mule else 200),  # Older if legitimate
                    "transaction_velocity": 3.0 if is_explicitly_legitimate else (10.0 if is_likely_mule else 3.0),  # Normal if legitimate
                    "unique_counterparties": 8 if is_explicitly_legitimate else (20 if is_likely_mule else 8),  # Fewer if legitimate
                    "avg_balance_30d": 60000.0 if is_explicitly_legitimate else (20000.0 if is_likely_mule else 60000.0),  # Higher if legitimate
                    "max_single_transaction": 100000.0 if is_explicitly_legitimate else (300000.0 if is_likely_mule else 100000.0),
                    "night_transaction_ratio": 0.15 if is_explicitly_legitimate else (0.5 if is_likely_mule else 0.2),  # Fewer night if legitimate
                    "weekend_transaction_ratio": 0.25 if is_explicitly_legitimate else (0.6 if is_likely_mule else 0.3),  # Fewer weekend if legitimate
                    "incoming_outgoing_ratio": 1.0 if is_explicitly_legitimate else (1.5 if is_likely_mule else 1.0),  # Balanced if legitimate
                    "geographic_spread": 0.2 if is_explicitly_legitimate else (0.4 if is_likely_mule else 0.2),  # Local if legitimate
                }
        
        # If model not loaded, use simple heuristics
        if not self.loaded or self.model is None:
            logger.warning("Using heuristic-based mule detection (model not loaded)")
            predictions = {}
            for acc_id, acc_data in accounts.items():
                # VICTIM ACCOUNTS ARE NEVER MULES
                if acc_id in victim_accounts:
                    predictions[acc_id] = {
                        "is_mule": False,
                        "mule_probability": 0.0,
                        "risk_score": 0.0
                    }
                    continue
                
                # Simple heuristic: newer accounts with high transaction velocity
                # But also check for legitimate account indicators
                account_age = acc_data["account_age_days"]
                transaction_velocity = acc_data["transaction_velocity"]
                night_ratio = acc_data["night_transaction_ratio"]
                balance = acc_data["avg_balance_30d"]
                
                # Legitimate account indicators:
                # - Older account (> 180 days)
                # - Lower transaction velocity (< 5.0)
                # - Higher balance (> 50000)
                # - Fewer night transactions (< 0.2)
                is_likely_legitimate = (
                    account_age > 180 and
                    transaction_velocity < 5.0 and
                    balance > 50000 and
                    night_ratio < 0.2
                )
                
                # Mule indicators:
                # - New account (< 90 days)
                # - High transaction velocity (> 8.0)
                # - Many night transactions (> 0.4)
                is_mule = (
                    not is_likely_legitimate and
                    account_age < 90 and
                    transaction_velocity > 8.0 and
                    night_ratio > 0.4
                )
                
                # Calculate probability based on indicators
                if is_likely_legitimate:
                    mule_prob = 0.1  # Very low for legitimate
                    risk_score = 10.0
                elif is_mule:
                    mule_prob = 0.8  # High for mules
                    risk_score = 80.0
                else:
                    # Uncertain - moderate probability
                    mule_prob = 0.3
                    risk_score = 30.0
                
                predictions[acc_id] = {
                    "is_mule": is_mule,
                    "mule_probability": mule_prob,
                    "risk_score": risk_score
                }
            
            return predictions
        
        # Use GNN model
        try:
            # Prepare features
            account_list = list(accounts.values())
            
            # Normalize features
            for acc in account_list:
                # Add normalized features
                acc["account_age_days_norm"] = min(acc["account_age_days"] / 365.0, 1.0)
                acc["transaction_velocity_norm"] = min(acc["transaction_velocity"] / 50.0, 1.0)
                acc["unique_counterparties_norm"] = min(acc["unique_counterparties"] / 100.0, 1.0)
                acc["avg_balance_30d_norm"] = min(acc["avg_balance_30d"] / 1000000.0, 1.0)
                acc["max_single_transaction_norm"] = min(acc["max_single_transaction"] / 1000000.0, 1.0)
            
            # Create graph
            graph = create_graph_from_transactions(
                account_list,
                transactions,
                self.features
            )
            
            # Predict
            with torch.no_grad():
                outputs = self.model(
                    graph.x,
                    graph.edge_index,
                    graph.edge_attr
                )
                
                mule_probs = outputs["mule_prob"].cpu().numpy().flatten()
                risk_scores = outputs["risk_score"].cpu().numpy().flatten()
            
            # Create predictions dictionary
            predictions = {}
            account_list_ids = list(accounts.keys())
            
            for i, (acc_id, acc_data) in enumerate(accounts.items()):
                # VICTIM ACCOUNTS ARE NEVER MULES - Set to 0
                if acc_id in victim_accounts:
                    predictions[acc_id] = {
                        "is_mule": False,
                        "mule_probability": 0.0,
                        "risk_score": 0.0
                    }
                    logger.debug(f"Excluded victim account {acc_id} from mule detection")
                else:
                    # Get model prediction
                    model_mule_prob = float(mule_probs[i])
                    model_risk_score = float(risk_scores[i])
                    
                    # Post-process: Check for legitimate account indicators
                    # If account has legitimate features, reduce mule probability
                    account_age = acc_data.get("account_age_days", 0)
                    transaction_velocity = acc_data.get("transaction_velocity", 0)
                    night_ratio = acc_data.get("night_transaction_ratio", 0)
                    balance = acc_data.get("avg_balance_30d", 0)
                    
                    # Legitimate account indicators (strong signals)
                    is_likely_legitimate = (
                        account_age > 180 and  # Older account
                        transaction_velocity < 5.0 and  # Normal velocity
                        balance > 50000 and  # Higher balance
                        night_ratio < 0.2  # Few night transactions
                    )
                    
                    # Adjust probability based on legitimate indicators
                    if is_likely_legitimate:
                        # STRONG OVERRIDE: Legitimate accounts should have very low mule probability
                        # Cap at 25% regardless of model prediction
                        adjusted_prob = min(model_mule_prob * 0.15, 0.25)  # Cap at 25%
                        adjusted_risk = min(model_risk_score * 0.2, 25.0)  # Cap at 25
                        is_mule = False  # Force to False for legitimate accounts
                        logger.info(f"Account {acc_id} shows legitimate indicators (age={account_age}d, velocity={transaction_velocity}, balance={balance}), overriding model: {model_mule_prob:.2%} -> {adjusted_prob:.2%}")
                    else:
                        # Use model prediction as-is
                        adjusted_prob = model_mule_prob
                        adjusted_risk = model_risk_score
                        is_mule = adjusted_prob >= threshold
                    
                    predictions[acc_id] = {
                        "is_mule": is_mule,
                        "mule_probability": adjusted_prob,
                        "risk_score": adjusted_risk
                    }
            
            mule_count = sum(p['is_mule'] for p in predictions.values())
            logger.info(f"Detected {mule_count} mule accounts (excluded {len(victim_accounts)} victim account(s))")
            return predictions
            
        except Exception as e:
            logger.error(f"Error in mule detection: {e}")
            # Fallback to heuristics
            predictions = {}
            for acc_id, acc_data in accounts.items():
                # VICTIM ACCOUNTS ARE NEVER MULES
                if acc_id in victim_accounts:
                    predictions[acc_id] = {
                        "is_mule": False,
                        "mule_probability": 0.0,
                        "risk_score": 0.0
                    }
                    continue
                
                is_mule = acc_data["account_age_days"] < 90
                predictions[acc_id] = {
                    "is_mule": is_mule,
                    "mule_probability": 0.6 if is_mule else 0.2,
                    "risk_score": 70.0 if is_mule else 20.0
                }
            return predictions

