"""
CST Transformer Prediction Service.

This service loads the trained CST model and provides prediction functionality
for the AEGIS API endpoints.
"""

import pickle
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import logging

import torch
import pandas as pd
import numpy as np

from app.ml.models.cst_transformer import CSTTransformer

logger = logging.getLogger(__name__)


class CSTPredictorService:
    """Service for CST Transformer predictions."""
    
    def __init__(self):
        self.model = None
        self.fraud_encoder = None
        self.state_encoder = None
        self.coord_scaler = None
        self.atm_df = None
        self.loaded = False
        self._checkpoint_dir = Path("checkpoints/cst_unified")
        self._atm_path = Path("data/processed/atm_reference.parquet")
    
    def load_model(self) -> bool:
        """Load the trained CST model and encoders."""
        try:
            checkpoint_path = self._checkpoint_dir / "best_model.pt"
            encoders_path = self._checkpoint_dir / "encoders.pkl"
            
            if not checkpoint_path.exists() or not encoders_path.exists():
                logger.error(f"Model files not found at {self._checkpoint_dir}")
                return False
            
            # Load encoders
            with open(encoders_path, "rb") as f:
                encoders = pickle.load(f)
            
            self.fraud_encoder = encoders["fraud_encoder"]
            self.state_encoder = encoders["state_encoder"]
            self.coord_scaler = encoders["coord_scaler"]
            num_atms = encoders["num_atms"]
            
            # Load ATM data
            if self._atm_path.exists():
                self.atm_df = pd.read_parquet(self._atm_path)
                logger.info(f"Loaded {len(self.atm_df)} ATMs")
            else:
                logger.warning(f"ATM data not found at {self._atm_path}")
                self.atm_df = None
            
            # Load model
            checkpoint = torch.load(checkpoint_path, map_location="cpu")
            model_config = checkpoint.get("model_config", {})
            
            self.model = CSTTransformer(
                d_model=model_config.get("d_model", 256),
                num_fraud_types=len(self.fraud_encoder.classes_),
                num_states=len(self.state_encoder.classes_),
                num_atms=num_atms,
            )
            self.model.load_state_dict(checkpoint["model_state_dict"])
            self.model.eval()
            
            self.loaded = True
            logger.info("CST Transformer model loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load CST model: {e}", exc_info=True)
            return False
    
    def predict_atm_withdrawal(
        self,
        victim_lat: float,
        victim_lon: float,
        victim_state: str,
        fraud_type: str,
        hour: Optional[int] = None,
        day: Optional[int] = None,
        month: Optional[int] = None,
        top_k: int = 5
    ) -> Dict:
        """
        Predict top-K ATMs for withdrawal when victim location is known.
        
        Args:
            victim_lat: Victim latitude
            victim_lon: Victim longitude
            victim_state: State name
            fraud_type: Fraud type (e.g., "OTP_PHISHING")
            hour: Hour of day (0-23), defaults to current hour
            day: Day of week (0=Mon, 6=Sun), defaults to current day
            month: Month (1-12), defaults to current month
            top_k: Number of top ATMs to return
        
        Returns:
            Dict with predictions and metadata
        """
        if not self.loaded:
            raise RuntimeError("Model not loaded. Call load_model() first.")
        
        # Use current time if not provided
        now = datetime.now()
        hour = hour if hour is not None else now.hour
        day = day if day is not None else now.weekday()
        month = month if month is not None else now.month
        
        # Encode inputs
        try:
            fraud_idx = self.fraud_encoder.transform([fraud_type])[0]
        except:
            logger.warning(f"Unknown fraud type '{fraud_type}', using default")
            fraud_idx = 0
        
        try:
            state_idx = self.state_encoder.transform([victim_state])[0]
        except:
            logger.warning(f"Unknown state '{victim_state}', using default")
            state_idx = 0
        
        # Scale coordinates
        coords_scaled = self.coord_scaler.transform([[victim_lat, victim_lon]])
        coords_t = torch.tensor(coords_scaled, dtype=torch.float32)
        fraud_t = torch.tensor([fraud_idx], dtype=torch.long)
        state_t = torch.tensor([state_idx], dtype=torch.long)
        hour_t = torch.tensor([hour], dtype=torch.long)
        day_t = torch.tensor([day], dtype=torch.long)
        month_t = torch.tensor([month - 1], dtype=torch.long)
        
        # Get prediction
        with torch.no_grad():
            top_indices, top_probs = self.model.predict_atms(
                coords_t, hour_t, day_t, month_t, fraud_t, state_t, top_k=top_k
            )
        
        # Format results
        predictions = []
        for i in range(top_k):
            atm_idx = top_indices[0, i].item()
            prob = top_probs[0, i].item()
            
            if self.atm_df is not None and 0 <= atm_idx < len(self.atm_df):
                atm = self.atm_df.iloc[atm_idx]
                dist = self._distance_km(victim_lat, victim_lon, 
                                        atm["latitude"], atm["longitude"])
                
                predictions.append({
                    "rank": i + 1,
                    "atm_id": str(atm_idx),
                    "name": atm.get("name", f"ATM #{atm_idx}"),
                    "bank": atm.get("bank_name", "Unknown"),
                    "city": atm.get("city", "Unknown"),
                    "state": atm.get("state", "Unknown"),
                    "address": atm.get("address", ""),
                    "lat": float(atm["latitude"]),
                    "lon": float(atm["longitude"]),
                    "distance_km": round(dist, 1),
                    "confidence": round(prob * 100, 1),
                })
            else:
                predictions.append({
                    "rank": i + 1,
                    "atm_id": str(atm_idx),
                    "name": f"ATM #{atm_idx}",
                    "bank": "Unknown",
                    "city": "Unknown",
                    "state": "Unknown",
                    "address": "",
                    "lat": None,
                    "lon": None,
                    "distance_km": 0,
                    "confidence": round(prob * 100, 1),
                })
        
        return {
            "mode": "ATM",
            "predictions": predictions,
            "input": {
                "victim_location": {"lat": victim_lat, "lon": victim_lon},
                "state": victim_state,
                "fraud_type": fraud_type,
                "time": {
                    "hour": hour,
                    "day": day,
                    "month": month
                }
            },
            "model_info": {
                "name": "CST-Transformer",
                "version": "v1.0"
            }
        }
    
    def predict_area_withdrawal(
        self,
        victim_state: str,
        fraud_type: str,
        hour: Optional[int] = None,
        day: Optional[int] = None,
        month: Optional[int] = None
    ) -> Dict:
        """
        Predict general area for withdrawal when victim location is unknown.
        
        Use for anonymous complaints.
        
        Args:
            victim_state: State name
            fraud_type: Fraud type
            hour: Hour of day (0-23), defaults to current hour
            day: Day of week (0=Mon, 6=Sun), defaults to current day
            month: Month (1-12), defaults to current month
        
        Returns:
            Dict with predicted area coordinates
        """
        if not self.loaded:
            raise RuntimeError("Model not loaded. Call load_model() first.")
        
        # Use current time if not provided
        now = datetime.now()
        hour = hour if hour is not None else now.hour
        day = day if day is not None else now.weekday()
        month = month if month is not None else now.month
        
        # Encode inputs
        try:
            fraud_idx = self.fraud_encoder.transform([fraud_type])[0]
        except:
            logger.warning(f"Unknown fraud type '{fraud_type}', using default")
            fraud_idx = 0
        
        try:
            state_idx = self.state_encoder.transform([victim_state])[0]
        except:
            logger.warning(f"Unknown state '{victim_state}', using default")
            state_idx = 0
        
        # Create tensors (zero coordinates for area mode)
        coords_t = torch.zeros(1, 2, dtype=torch.float32)
        fraud_t = torch.tensor([fraud_idx], dtype=torch.long)
        state_t = torch.tensor([state_idx], dtype=torch.long)
        hour_t = torch.tensor([hour], dtype=torch.long)
        day_t = torch.tensor([day], dtype=torch.long)
        month_t = torch.tensor([month - 1], dtype=torch.long)
        
        # Get prediction
        with torch.no_grad():
            output = self.model.predict_area(hour_t, day_t, month_t, fraud_t, state_t)
        
        # Denormalize coordinates
        pred_coords_scaled = output["pred_coords"].numpy()
        pred_coords = self.coord_scaler.inverse_transform(pred_coords_scaled)[0]
        confidence = output["confidence"].item()
        
        return {
            "mode": "AREA",
            "prediction": {
                "lat": round(float(pred_coords[0]), 4),
                "lon": round(float(pred_coords[1]), 4),
                "confidence": round(confidence * 100, 1),
            },
            "input": {
                "state": victim_state,
                "fraud_type": fraud_type,
                "time": {
                    "hour": hour,
                    "day": day,
                    "month": month
                }
            },
            "model_info": {
                "name": "CST-Transformer",
                "version": "v1.0"
            }
        }
    
    def _distance_km(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate approximate distance in km."""
        return np.sqrt((lat1 - lat2)**2 + (lon1 - lon2)**2) * 111


# Global service instance
_cst_service: Optional[CSTPredictorService] = None


def get_cst_predictor() -> CSTPredictorService:
    """Get or initialize the global CST predictor service."""
    global _cst_service
    
    if _cst_service is None:
        _cst_service = CSTPredictorService()
        if not _cst_service.load_model():
            logger.error("Failed to load CST model. Predictions will not work.")
    
    return _cst_service


def initialize_cst_service() -> bool:
    """Initialize the CST service (called at startup)."""
    service = get_cst_predictor()
    return service.loaded

