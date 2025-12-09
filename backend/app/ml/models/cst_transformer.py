"""
CST Transformer - Unified Crime Spatio-Temporal Transformer.

Dual-mode model for fraud location prediction:
1. WITH victim location → Predict specific ATMs (Top 3)
2. WITHOUT victim location → Predict general area coordinates

Single model handles both anonymous and identified complaints.
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Dict, Tuple, Optional, List


class PositionalEncoding(nn.Module):
    """
    Sinusoidal positional encoding for sequence position awareness.
    Adds position information to embeddings without learnable parameters.
    """
    
    def __init__(self, d_model: int, max_len: int = 100, dropout: float = 0.1):
        super().__init__()
        self.dropout = nn.Dropout(p=dropout)
        
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
        
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        self.register_buffer('pe', pe)
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Add positional encoding to input tensor."""
        return self.dropout(x + self.pe[:x.size(1)])


class CSTTransformer(nn.Module):
    """
    Unified CST Transformer for fraud location prediction.
    
    Two modes of operation:
    1. ATM Mode (victim location provided): Predicts Top-K specific ATMs
    2. Area Mode (no victim location): Predicts general coordinates
    
    Architecture:
    - Spatial encoder (victim coordinates - optional)
    - Temporal encoder (hour, day, month)
    - Fraud type encoder
    - State encoder
    - Transformer layers
    - Dual output heads (ATM classification + coordinate regression)
    """
    
    def __init__(
        self,
        d_model: int = 256,
        n_heads: int = 8,
        n_layers: int = 4,
        num_fraud_types: int = 9,
        num_states: int = 16,
        num_atms: int = 7112,
        dropout: float = 0.2,
    ):
        """
        Initialize unified CST model.
        
        Args:
            d_model: Transformer dimension
            n_heads: Number of attention heads
            n_layers: Number of transformer layers
            num_fraud_types: Number of fraud categories
            num_states: Number of Indian states
            num_atms: Total ATMs for classification (0 = area mode only)
            dropout: Dropout rate
        """
        super().__init__()
        
        self.d_model = d_model
        self.num_atms = num_atms
        
        # Victim coordinate encoder (used when location is provided)
        self.coord_encoder = nn.Sequential(
            nn.Linear(2, d_model),
            nn.LayerNorm(d_model),
            nn.GELU(),
            nn.Dropout(dropout),
        )
        
        # Fraud type embedding
        self.fraud_embed = nn.Embedding(num_fraud_types, d_model)
        
        # State embedding
        self.state_embed = nn.Embedding(num_states, d_model)
        
        # Temporal embeddings
        self.hour_embed = nn.Embedding(24, d_model)
        self.day_embed = nn.Embedding(7, d_model)
        self.month_embed = nn.Embedding(12, d_model)
        
        # Positional encoding for sequence
        self.pos_encoder = PositionalEncoding(d_model, max_len=10, dropout=dropout)
        
        # Transformer encoder
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=n_heads,
            dim_feedforward=d_model * 4,
            dropout=dropout,
            activation='gelu',
            batch_first=True,
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=n_layers)
        
        # Output Head 1: Coordinate regression (for area prediction)
        # Used when victim location is NOT provided
        self.coord_head = nn.Sequential(
            nn.Linear(d_model, d_model),
            nn.LayerNorm(d_model),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_model, 2),  # lat, lon
        )
        
        # Output Head 2: ATM classification (for specific ATM prediction)
        # Used when victim location IS provided
        if num_atms > 0:
            self.atm_head = nn.Sequential(
                nn.Linear(d_model, d_model * 2),
                nn.LayerNorm(d_model * 2),
                nn.GELU(),
                nn.Dropout(dropout),
                nn.Linear(d_model * 2, d_model),
                nn.LayerNorm(d_model),
                nn.GELU(),
                nn.Dropout(dropout),
                nn.Linear(d_model, num_atms),  # Logits for each ATM
            )
        else:
            self.atm_head = None
        
        # Confidence head
        self.confidence_head = nn.Sequential(
            nn.Linear(d_model, d_model // 4),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_model // 4, 1),
        )
        
        # Mode indicator embedding (0 = area mode, 1 = ATM mode)
        self.mode_embed = nn.Embedding(2, d_model)
        
        # Initialize weights
        self._init_weights()
    
    def _init_weights(self):
        """Initialize model weights."""
        for p in self.parameters():
            if p.dim() > 1:
                nn.init.xavier_uniform_(p)
    
    def forward(
        self,
        coords: torch.Tensor,
        hour: torch.Tensor,
        day: torch.Tensor,
        month: torch.Tensor,
        fraud_type: torch.Tensor,
        state: torch.Tensor,
        mode: str = "auto",
    ) -> Dict[str, torch.Tensor]:
        """
        Forward pass with automatic mode detection.
        
        Args:
            coords: Victim coordinates (batch, 2) - zeros if not provided
            hour: Hour of day (batch,)
            day: Day of week (batch,)
            month: Month (batch,)
            fraud_type: Fraud type index (batch,)
            state: State index (batch,)
            mode: "atm", "area", or "auto" (detect from coords)
        
        Returns:
            Dict with:
            - pred_coords: Predicted coordinates (batch, 2)
            - atm_logits: ATM classification logits (batch, num_atms) [if ATM mode]
            - atm_probs: ATM probabilities (batch, num_atms) [if ATM mode]
            - confidence: Prediction confidence (batch, 1)
            - mode: Which mode was used
        """
        batch_size = coords.size(0)
        
        # Detect mode: if coords are non-zero, use ATM mode
        if mode == "auto":
            coords_nonzero = (coords.abs().sum(dim=-1) > 0.01).any().item()
            mode = "atm" if coords_nonzero and self.atm_head is not None else "area"
        
        # Create mode tensor
        mode_idx = torch.ones(batch_size, dtype=torch.long, device=coords.device) if mode == "atm" else \
                   torch.zeros(batch_size, dtype=torch.long, device=coords.device)
        
        # Encode features
        coord_feat = self.coord_encoder(coords)         # (batch, d_model)
        fraud_feat = self.fraud_embed(fraud_type)       # (batch, d_model)
        state_feat = self.state_embed(state)            # (batch, d_model)
        hour_feat = self.hour_embed(hour)               # (batch, d_model)
        day_feat = self.day_embed(day)                  # (batch, d_model)
        month_feat = self.month_embed(month)            # (batch, d_model)
        mode_feat = self.mode_embed(mode_idx)           # (batch, d_model)
        
        # Stack as sequence: [mode, coord, fraud, state, hour, day, month]
        seq = torch.stack([
            mode_feat, coord_feat, fraud_feat, state_feat,
            hour_feat, day_feat, month_feat
        ], dim=1)  # (batch, 7, d_model)
        
        # Add positional encoding
        seq = self.pos_encoder(seq)
        
        # Pass through transformer
        transformed = self.transformer(seq)  # (batch, 7, d_model)
        
        # Pool: use mean of all positions
        pooled = transformed.mean(dim=1)  # (batch, d_model)
        
        # Generate outputs
        pred_coords = self.coord_head(pooled)  # (batch, 2)
        confidence_logits = self.confidence_head(pooled)  # (batch, 1)
        confidence = torch.sigmoid(confidence_logits)
        
        output = {
            "pred_coords": pred_coords,
            "confidence": confidence,
            "confidence_logits": confidence_logits,
            "mode": mode,
        }
        
        # ATM classification (only in ATM mode)
        if mode == "atm" and self.atm_head is not None:
            atm_logits = self.atm_head(pooled)  # (batch, num_atms)
            atm_probs = F.softmax(atm_logits, dim=-1)
            output["atm_logits"] = atm_logits
            output["atm_probs"] = atm_probs
        
        return output
    
    def predict_atms(
        self,
        coords: torch.Tensor,
        hour: torch.Tensor,
        day: torch.Tensor,
        month: torch.Tensor,
        fraud_type: torch.Tensor,
        state: torch.Tensor,
        top_k: int = 3,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Predict top-K ATMs for withdrawal.
        
        Use when victim location is provided.
        
        Returns:
            top_indices: (batch, k) - ATM indices
            top_probs: (batch, k) - Probabilities
        """
        output = self.forward(coords, hour, day, month, fraud_type, state, mode="atm")
        
        if "atm_probs" in output:
            top_probs, top_indices = torch.topk(output["atm_probs"], k=top_k, dim=-1)
            return top_indices, top_probs
        else:
            # Fallback: return dummy values if ATM head not available
            batch_size = coords.size(0)
            return (
                torch.zeros(batch_size, top_k, dtype=torch.long, device=coords.device),
                torch.zeros(batch_size, top_k, device=coords.device),
            )
    
    def predict_area(
        self,
        hour: torch.Tensor,
        day: torch.Tensor,
        month: torch.Tensor,
        fraud_type: torch.Tensor,
        state: torch.Tensor,
    ) -> Dict[str, torch.Tensor]:
        """
        Predict general area when victim location is NOT provided.
        
        Use for anonymous complaints.
        
        Returns:
            Dict with pred_coords, confidence
        """
        batch_size = hour.size(0)
        device = hour.device
        
        # Zero coordinates for area mode
        zero_coords = torch.zeros(batch_size, 2, device=device)
        
        output = self.forward(
            zero_coords, hour, day, month, fraud_type, state, mode="area"
        )
        
        return {
            "pred_coords": output["pred_coords"],
            "confidence": output["confidence"],
        }


def compute_cst_loss(
    predictions: Dict[str, torch.Tensor],
    target_atm: Optional[torch.Tensor],
    target_coords: torch.Tensor,
    mode: str,
    atm_weight: float = 1.0,
    coord_weight: float = 0.3,
) -> Tuple[torch.Tensor, Dict[str, float]]:
    """
    Compute loss for CST model based on mode.
    
    Args:
        predictions: Model output
        target_atm: Target ATM index (only for ATM mode)
        target_coords: Target coordinates
        mode: "atm" or "area"
        atm_weight: Weight for ATM classification loss
        coord_weight: Weight for coordinate loss
    
    Returns:
        total_loss, loss_dict
    """
    losses = {}
    
    # Coordinate loss (always computed)
    coord_loss = F.mse_loss(predictions["pred_coords"], target_coords)
    losses["coord"] = coord_loss.item()
    
    if mode == "atm" and "atm_logits" in predictions and target_atm is not None:
        # ATM classification loss
        atm_loss = F.cross_entropy(predictions["atm_logits"], target_atm)
        losses["atm"] = atm_loss.item()
        
        # Combined loss
        total_loss = atm_weight * atm_loss + coord_weight * coord_loss
        
        # Compute accuracy metrics
        pred_atm = predictions["atm_logits"].argmax(dim=-1)
        accuracy = (pred_atm == target_atm).float().mean().item()
        losses["accuracy"] = accuracy
        
        # Top-5 accuracy
        top5 = torch.topk(predictions["atm_logits"], k=5, dim=-1).indices
        top5_correct = (top5 == target_atm.unsqueeze(1)).any(dim=-1).float().mean().item()
        losses["top5_accuracy"] = top5_correct
    else:
        # Area mode: only coordinate loss
        total_loss = coord_loss
        losses["accuracy"] = 0.0
        losses["top5_accuracy"] = 0.0
    
    losses["total"] = total_loss.item()
    
    return total_loss, losses


def create_model(
    num_fraud_types: int = 9,
    num_states: int = 16,
    num_atms: int = 7112,
    d_model: int = 256,
    **kwargs
) -> CSTTransformer:
    """
    Factory function to create CST model.
    
    Args:
        num_fraud_types: Number of fraud categories
        num_states: Number of states
        num_atms: Total ATMs (0 for area-only mode)
        d_model: Model dimension
    
    Returns:
        CSTTransformer model
    """
    return CSTTransformer(
        d_model=d_model,
        num_fraud_types=num_fraud_types,
        num_states=num_states,
        num_atms=num_atms,
        **kwargs
    )
