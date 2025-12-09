"""
Model Manager for Federated Learning
Handles model storage, versioning, and retrieval
"""
import os
import torch
import logging
from typing import Optional, Dict, Any
from pathlib import Path
from datetime import datetime
import json

from app.federated_learning.config import fl_config
from app.federated_learning.utils.serialization import (
    model_weights_to_dict,
    dict_to_model_weights
)

logger = logging.getLogger(__name__)


class ModelManager:
    """
    Manages global models for federated learning.
    
    Responsibilities:
    - Model creation and initialization
    - Model versioning and storage
    - Model retrieval and caching
    - Training round tracking
    """
    
    def __init__(self):
        self.model_cache: Dict[str, torch.nn.Module] = {}
        self.model_versions: Dict[str, int] = {}
        self.round_history: Dict[str, list] = {}
        self.models_dir = Path(fl_config.checkpoints_dir)
        self.models_dir.mkdir(parents=True, exist_ok=True)
        
        # Load existing version info
        self._load_version_info()
    
    def _load_version_info(self):
        """Load version info from disk if exists."""
        version_file = self.models_dir / "version_info.json"
        if version_file.exists():
            try:
                with open(version_file, 'r') as f:
                    data = json.load(f)
                    self.model_versions = data.get('versions', {})
                    logger.info(f"Loaded version info: {self.model_versions}")
            except Exception as e:
                logger.warning(f"Could not load version info: {e}")
    
    def _save_version_info(self):
        """Save version info to disk."""
        version_file = self.models_dir / "version_info.json"
        try:
            with open(version_file, 'w') as f:
                json.dump({'versions': self.model_versions}, f)
        except Exception as e:
            logger.error(f"Could not save version info: {e}")
    
    async def get_global_model(self, model_type: str) -> torch.nn.Module:
        """
        Get current global model.
        
        Priority:
        1. Return cached model if exists
        2. Load from FL checkpoint if exists  
        3. Load from PRE-TRAINED checkpoint (cst_unified, mule_detector)
        4. Create new model (last resort)
        
        Args:
            model_type: 'cst_transformer' or 'mule_detector_gnn'
            
        Returns:
            PyTorch model
        """
        if model_type in self.model_cache:
            return self.model_cache[model_type]
        
        # 1. Check for existing FL global model
        fl_checkpoint_path = self.models_dir / f"{model_type}_global.pt"
        
        if fl_checkpoint_path.exists():
            logger.info(f"Loading FL global {model_type} model from checkpoint")
            model = self._load_model(model_type, fl_checkpoint_path)
            self.model_cache[model_type] = model
            return model
        
        # 2. Check for PRE-TRAINED models (use these as starting point!)
        pretrained_path = self._get_pretrained_path(model_type)
        
        if pretrained_path and pretrained_path.exists():
            logger.info(f"🎯 Loading PRE-TRAINED {model_type} model from {pretrained_path}")
            model = self._load_pretrained_model(model_type, pretrained_path)
            # Save as initial FL global model
            await self.save_model_version(
                model_type=model_type,
                model=model,
                round_number=0,
                metrics={'source': 'pretrained', 'path': str(pretrained_path)}
            )
            self.model_cache[model_type] = model
            return model
        
        # 3. Last resort: create new model (not recommended)
        logger.warning(f"⚠️ No pretrained model found for {model_type}, creating from scratch")
        model = self._create_model(model_type)
        await self.save_model_version(
            model_type=model_type,
            model=model,
            round_number=0,
            metrics={'initial': True, 'from_scratch': True}
        )
        
        self.model_cache[model_type] = model
        return model
    
    def _get_pretrained_path(self, model_type: str) -> Optional[Path]:
        """Get path to pre-trained model checkpoint."""
        if model_type == "cst_transformer":
            path = fl_config.pretrained_cst_path
        elif model_type == "mule_detector_gnn":
            path = fl_config.pretrained_gnn_path
        else:
            return None
        
        logger.info(f"Looking for pretrained model at: {path}")
        return path
    
    def _load_pretrained_model(self, model_type: str, checkpoint_path: Path) -> torch.nn.Module:
        """Load pre-trained model from existing checkpoint."""
        try:
            checkpoint = torch.load(checkpoint_path, map_location='cpu', weights_only=False)
            
            # Get config from checkpoint if available
            config = checkpoint.get('model_config', {})
            
            # Create model with config from checkpoint
            model = self._create_model(model_type, config=config)
            
            # Handle different checkpoint formats
            if 'model_state_dict' in checkpoint:
                model.load_state_dict(checkpoint['model_state_dict'])
            elif 'state_dict' in checkpoint:
                model.load_state_dict(checkpoint['state_dict'])
            else:
                # Try loading directly
                model.load_state_dict(checkpoint)
            
            # Log loaded model info
            info = []
            if 'epoch' in checkpoint:
                info.append(f"epoch={checkpoint['epoch']}")
            if 'val_loss' in checkpoint:
                info.append(f"val_loss={checkpoint['val_loss']:.4f}")
            if 'val_atm_accuracy' in checkpoint:
                info.append(f"atm_acc={checkpoint['val_atm_accuracy']:.4f}")
            if 'loss' in checkpoint:
                info.append(f"loss={checkpoint['loss']:.4f}")
            
            logger.info(f"✅ Loaded pretrained {model_type}: {', '.join(info) if info else 'success'}")
            
        except Exception as e:
            logger.error(f"Error loading pretrained checkpoint: {e}")
            raise
        return model
    
    def _create_model(self, model_type: str, config: dict = None) -> torch.nn.Module:
        """
        Create new model instance with parameters matching pre-trained models.
        
        Args:
            model_type: Type of model to create
            config: Optional config dict (from checkpoint) to override defaults
        
        Note: Default parameters match the pre-trained checkpoints in:
        - checkpoints/cst_unified/best_model.pt
        - checkpoints/mule_detector/best_model.pt
        """
        if model_type == "cst_transformer":
            from app.ml.models.cst_transformer import CSTTransformer
            # Matches checkpoints/cst_unified/best_model.pt (verified from checkpoint)
            model = CSTTransformer(
                d_model=config.get('d_model', 256) if config else 256,
                n_heads=8,
                n_layers=4,
                num_fraud_types=9,      # From checkpoint: fraud_embed.weight [9, 256]
                num_states=15,          # From checkpoint: state_embed.weight [15, 256]
                num_atms=config.get('num_atms', 7112) if config else 7112,
                dropout=0.2,
            )
        elif model_type == "mule_detector_gnn":
            from app.ml.models.mule_detector_gnn import MuleDetectorGNN
            # Matches checkpoints/mule_detector/best_model.pt (verified from checkpoint)
            model = MuleDetectorGNN(
                input_dim=31,          # From checkpoint: input_proj.weight [64, 31]
                hidden_dim=64,         # From checkpoint: input_proj.weight [64, 31]
                num_layers=3,
                num_heads=4,
                dropout=0.3,
                edge_dim=5,
            )
        else:
            raise ValueError(f"Unknown model type: {model_type}")
        
        logger.info(f"Created {model_type} model architecture")
        return model
    
    def _load_model(self, model_type: str, checkpoint_path: Path) -> torch.nn.Module:
        """Load model from checkpoint."""
        model = self._create_model(model_type)
        try:
            checkpoint = torch.load(checkpoint_path, map_location='cpu')
            model.load_state_dict(checkpoint['model_state_dict'])
            if 'version' in checkpoint:
                self.model_versions[model_type] = checkpoint['version']
            logger.info(f"Loaded {model_type} model version {self.model_versions.get(model_type, 0)}")
        except Exception as e:
            logger.error(f"Error loading checkpoint: {e}")
            raise
        return model
    
    async def save_model_version(
        self,
        model_type: str,
        model: torch.nn.Module,
        round_number: int,
        metrics: Dict[str, Any],
        client_ids: list = None
    ) -> int:
        """
        Save new model version.
        
        Args:
            model_type: Type of model
            model: Model to save
            round_number: Round number
            metrics: Model metrics
            client_ids: List of client IDs that contributed
            
        Returns:
            New version number
        """
        # Get next version number
        if model_type not in self.model_versions:
            self.model_versions[model_type] = 0
        
        self.model_versions[model_type] += 1
        version = self.model_versions[model_type]
        
        # Prepare checkpoint data
        checkpoint_data = {
            'model_state_dict': model.state_dict(),
            'version': version,
            'round_number': round_number,
            'metrics': metrics,
            'timestamp': datetime.utcnow().isoformat(),
            'client_ids': client_ids or []
        }
        
        # Save versioned checkpoint
        checkpoint_path = self.models_dir / f"{model_type}_v{version}.pt"
        torch.save(checkpoint_data, checkpoint_path)
        
        # Update global checkpoint
        global_path = self.models_dir / f"{model_type}_global.pt"
        torch.save(checkpoint_data, global_path)
        
        # Update cache
        self.model_cache[model_type] = model
        
        # Save version info
        self._save_version_info()
        
        # Track round history
        if model_type not in self.round_history:
            self.round_history[model_type] = []
        self.round_history[model_type].append({
            'round': round_number,
            'version': version,
            'metrics': metrics,
            'timestamp': checkpoint_data['timestamp']
        })
        
        logger.info(f"Saved {model_type} model version {version} (round {round_number})")
        return version
    
    async def get_current_version(self, model_type: str) -> int:
        """Get current model version number."""
        return self.model_versions.get(model_type, 0)
    
    async def get_model_weights(self, model_type: str) -> Dict[str, Any]:
        """Get current global model weights as dictionary."""
        model = await self.get_global_model(model_type)
        return model_weights_to_dict(model)
    
    async def update_model_weights(
        self,
        model_type: str,
        weights: Dict[str, Any]
    ) -> torch.nn.Module:
        """
        Update model with new weights.
        
        Args:
            model_type: Type of model
            weights: New weights dictionary
            
        Returns:
            Updated model
        """
        model = await self.get_global_model(model_type)
        dict_to_model_weights(model, weights)
        self.model_cache[model_type] = model
        return model
    
    def get_training_history(self, model_type: str) -> list:
        """Get training history for a model type."""
        return self.round_history.get(model_type, [])
    
    async def delete_old_versions(self, model_type: str, keep_last: int = 5):
        """Delete old model versions, keeping only the most recent ones."""
        current_version = self.model_versions.get(model_type, 0)
        for v in range(1, current_version - keep_last + 1):
            path = self.models_dir / f"{model_type}_v{v}.pt"
            if path.exists():
                os.remove(path)
                logger.info(f"Deleted old version: {path}")

