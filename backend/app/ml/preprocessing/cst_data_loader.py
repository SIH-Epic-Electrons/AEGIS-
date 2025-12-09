"""
Unified CST Data Loader.

Loads data for dual-mode CST Transformer:
1. ATM Mode: With victim location → predict ATM
2. Area Mode: Without victim location → predict area
"""

import pandas as pd
import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split
from pathlib import Path
import pickle
import logging
from typing import Dict, Tuple, Optional

logger = logging.getLogger(__name__)


class CSTDataset(Dataset):
    """
    PyTorch Dataset for unified CST model.
    
    Handles both ATM and Area mode records.
    """
    
    def __init__(self, df: pd.DataFrame,
                 fraud_encoder: LabelEncoder,
                 state_encoder: LabelEncoder,
                 coord_scaler: StandardScaler):
        """Initialize with preprocessed data."""
        
        # Victim coordinates (scaled)
        victim_coords = df[["victim_lat", "victim_lon"]].values
        self.victim_coords = torch.tensor(
            coord_scaler.transform(victim_coords), dtype=torch.float32
        )
        
        # Target coordinates (scaled)
        target_coords = df[["target_lat", "target_lon"]].values
        self.target_coords = torch.tensor(
            coord_scaler.transform(target_coords), dtype=torch.float32
        )
        
        # Categorical features
        self.fraud_type = torch.tensor(
            fraud_encoder.transform(df["fraud_type"]), dtype=torch.long
        )
        self.state = torch.tensor(
            state_encoder.transform(df["victim_state"]), dtype=torch.long
        )
        
        # Time features
        self.hour = torch.tensor(df["hour"].values, dtype=torch.long)
        self.day = torch.tensor(df["day_of_week"].values, dtype=torch.long)
        self.month = torch.tensor(df["month"].values - 1, dtype=torch.long)  # 0-indexed
        
        # Target ATM index (for ATM mode, -1 for area mode)
        self.target_atm = torch.tensor(df["target_atm_idx"].values, dtype=torch.long)
        
        # Mode indicator
        self.is_atm_mode = torch.tensor(
            (df["mode"] == "atm").values, dtype=torch.bool
        )
        
        logger.info(f"Created CST dataset with {len(self)} samples")
    
    def __len__(self) -> int:
        return len(self.victim_coords)
    
    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        return {
            "victim_coords": self.victim_coords[idx],
            "target_coords": self.target_coords[idx],
            "fraud_type": self.fraud_type[idx],
            "state": self.state[idx],
            "hour": self.hour[idx],
            "day": self.day[idx],
            "month": self.month[idx],
            "target_atm": self.target_atm[idx],
            "is_atm_mode": self.is_atm_mode[idx],
        }


class CSTDataLoader:
    """
    Manages data loading for unified CST model.
    """
    
    def __init__(self, data_dir: str = "data/processed"):
        """Initialize with data directory."""
        self.data_dir = Path(data_dir)
        
        self.fraud_encoder = LabelEncoder()
        self.state_encoder = LabelEncoder()
        self.coord_scaler = StandardScaler()
        
        self.atm_df = None
        self.num_atms = 0
    
    def load_data(self, max_samples: Optional[int] = None) -> pd.DataFrame:
        """Load unified CST dataset."""
        data_path = self.data_dir / "cst_unified_dataset.parquet"
        logger.info(f"Loading data from {data_path}")
        
        df = pd.read_parquet(data_path)
        logger.info(f"Loaded {len(df):,} records")
        
        # Load ATM reference
        atm_path = self.data_dir / "atm_reference.parquet"
        if atm_path.exists():
            self.atm_df = pd.read_parquet(atm_path)
            self.num_atms = len(self.atm_df)
            logger.info(f"Loaded {self.num_atms:,} ATM references")
        
        if max_samples and max_samples < len(df):
            df = df.sample(n=max_samples, random_state=42)
            logger.info(f"Sampled to {len(df):,} records")
        
        return df
    
    def prepare_datasets(self, df: pd.DataFrame,
                        train_ratio: float = 0.7,
                        val_ratio: float = 0.15) -> Tuple[Dataset, Dataset, Dataset]:
        """Split and prepare datasets."""
        
        # Fit encoders on full data
        self.fraud_encoder.fit(df["fraud_type"])
        self.state_encoder.fit(df["victim_state"])
        
        # Fit scaler on all coordinates
        all_coords = np.vstack([
            df[["victim_lat", "victim_lon"]].values,
            df[["target_lat", "target_lon"]].values
        ])
        # Filter out zeros from area mode
        nonzero_mask = np.abs(all_coords).sum(axis=1) > 0.01
        self.coord_scaler.fit(all_coords[nonzero_mask])
        
        # Split data
        train_df, temp_df = train_test_split(df, train_size=train_ratio, random_state=42)
        val_ratio_adj = val_ratio / (1 - train_ratio)
        val_df, test_df = train_test_split(temp_df, train_size=val_ratio_adj, random_state=42)
        
        logger.info(f"Split: train={len(train_df):,}, val={len(val_df):,}, test={len(test_df):,}")
        
        # Create datasets
        train_ds = CSTDataset(train_df, self.fraud_encoder, self.state_encoder, self.coord_scaler)
        val_ds = CSTDataset(val_df, self.fraud_encoder, self.state_encoder, self.coord_scaler)
        test_ds = CSTDataset(test_df, self.fraud_encoder, self.state_encoder, self.coord_scaler)
        
        return train_ds, val_ds, test_ds
    
    def get_data_loaders(self, train_ds: Dataset, val_ds: Dataset,
                        batch_size: int = 256) -> Tuple[DataLoader, DataLoader]:
        """Create DataLoaders."""
        train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
        val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)
        return train_loader, val_loader
    
    def save_encoders(self, path: str):
        """Save encoders for inference."""
        encoders = {
            "fraud_encoder": self.fraud_encoder,
            "state_encoder": self.state_encoder,
            "coord_scaler": self.coord_scaler,
            "num_atms": self.num_atms,
        }
        with open(path, "wb") as f:
            pickle.dump(encoders, f)
        logger.info(f"Saved encoders to {path}")
    
    def get_atm_info(self, atm_idx: int) -> Dict:
        """Get ATM details by index."""
        if self.atm_df is None or atm_idx < 0:
            return {"name": "Unknown", "bank": "Unknown", "city": "Unknown"}
        
        atm = self.atm_df.iloc[atm_idx]
        return {
            "name": atm.get("name", "ATM"),
            "bank": atm.get("bank_name", "Unknown"),
            "city": atm.get("city", "Unknown"),
            "lat": atm["latitude"],
            "lon": atm["longitude"],
        }
