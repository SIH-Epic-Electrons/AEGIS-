"""
Client-Side Training for Federated Learning
"""
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
from typing import Dict, Any, Optional, Callable
import logging
import time

from app.federated_learning.config import fl_config
from app.federated_learning.utils.serialization import (
    model_weights_to_dict,
    dict_to_model_weights,
    weights_to_json_safe,
)

logger = logging.getLogger(__name__)


class ClientTrainer:
    """
    Handles local training on client (bank) side.
    
    Features:
    - Local model training on private data
    - Support for different model types (CST, GNN)
    - Training metrics collection
    - FedProx proximal term support
    """
    
    def __init__(
        self,
        model: nn.Module,
        device: str = None,
        model_type: str = "cst_transformer",
        local_epochs: int = None,
        learning_rate: float = None
    ):
        """
        Initialize client trainer.
        
        Args:
            model: PyTorch model to train
            device: Device to train on ('cuda' or 'cpu')
            model_type: Type of model for loss selection
            local_epochs: Training epochs per round (None = use config)
            learning_rate: Learning rate (None = use config)
        """
        from app.federated_learning.config import fl_config
        
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = model.to(self.device)
        self.model_type = model_type
        self.initial_weights = None
        self.local_epochs = local_epochs or fl_config.local_epochs
        self.learning_rate = learning_rate or fl_config.learning_rate
        
        logger.info(f"ClientTrainer initialized on {self.device}")
    
    def set_global_weights(self, weights: Dict[str, Any]):
        """
        Load global model weights before training.
        
        Args:
            weights: Weight dictionary from global model
        """
        dict_to_model_weights(self.model, weights)
        self.initial_weights = model_weights_to_dict(self.model)
        logger.info("Global weights loaded")
    
    def train_local(
        self,
        train_loader: DataLoader,
        epochs: int = None,
        learning_rate: float = None,
        fedprox_mu: float = 0.0,
        validation_loader: DataLoader = None
    ) -> Dict[str, Any]:
        """
        Train model locally on client data.
        
        Args:
            train_loader: DataLoader for training data
            epochs: Number of epochs (defaults to instance setting)
            learning_rate: Learning rate (defaults to instance setting)
            fedprox_mu: FedProx regularization (0 = disabled)
            validation_loader: Optional validation data
            
        Returns:
            Training results (weights, metrics, num_samples)
        """
        epochs = epochs or self.local_epochs
        learning_rate = learning_rate or self.learning_rate
        
        logger.info(f"Starting local training: {epochs} epochs, lr={learning_rate}")
        
        # Setup optimizer
        optimizer = optim.Adam(self.model.parameters(), lr=learning_rate)
        
        # Select loss function based on model type
        if self.model_type == "mule_detector_gnn":
            criterion = nn.BCELoss()
        else:
            criterion = nn.CrossEntropyLoss()
        
        # Store initial weights for FedProx
        if fedprox_mu > 0 and self.initial_weights is None:
            self.initial_weights = model_weights_to_dict(self.model)
        
        # Training loop
        self.model.train()
        total_loss = 0.0
        num_batches = 0
        num_samples = 0
        correct = 0
        start_time = time.time()
        
        for epoch in range(epochs):
            epoch_loss = 0.0
            epoch_correct = 0
            epoch_samples = 0
            
            for batch in train_loader:
                # Handle different batch formats
                if isinstance(batch, (list, tuple)):
                    if len(batch) == 2:
                        data, target = batch
                    else:
                        data = batch[0]
                        target = batch[-1]
                elif hasattr(batch, 'x'):  # PyG Data object
                    data = batch
                    target = batch.y if hasattr(batch, 'y') else None
                else:
                    data = batch
                    target = None
                
                # Move to device
                if isinstance(data, torch.Tensor):
                    data = data.to(self.device)
                elif hasattr(data, 'to'):
                    data = data.to(self.device)
                    
                if target is not None:
                    target = target.to(self.device)
                
                batch_size = data.size(0) if isinstance(data, torch.Tensor) else len(data)
                num_samples += batch_size
                epoch_samples += batch_size
                
                optimizer.zero_grad()
                
                # Forward pass
                output = self._forward(data)
                
                # Compute loss
                if target is not None:
                    loss = self._compute_loss(output, target, criterion)
                else:
                    loss = output.get('loss', torch.tensor(0.0))
                
                # Add FedProx proximal term
                if fedprox_mu > 0 and self.initial_weights is not None:
                    proximal_term = self._compute_proximal_term()
                    loss = loss + (fedprox_mu / 2) * proximal_term
                
                # Backward pass
                loss.backward()
                optimizer.step()
                
                epoch_loss += loss.item()
                num_batches += 1
                
                # Track accuracy if applicable
                if target is not None:
                    pred = self._get_predictions(output)
                    if pred is not None:
                        epoch_correct += (pred == target).sum().item()
            
            total_loss += epoch_loss
            correct += epoch_correct
            
            avg_loss = epoch_loss / max(len(train_loader), 1)
            accuracy = epoch_correct / max(epoch_samples, 1)
            logger.info(f"Epoch {epoch+1}/{epochs} - Loss: {avg_loss:.4f}, Acc: {accuracy:.4f}")
        
        training_time = time.time() - start_time
        
        # Get updated weights
        updated_weights = model_weights_to_dict(self.model)
        
        # Calculate final metrics
        final_metrics = {
            'loss': total_loss / max(num_batches, 1),
            'accuracy': correct / max(num_samples, 1),
            'training_time_seconds': training_time,
            'epochs_completed': epochs,
            'samples_trained': num_samples,
        }
        
        # Validation if provided
        if validation_loader is not None:
            val_metrics = self._validate(validation_loader, criterion)
            final_metrics['val_loss'] = val_metrics['loss']
            final_metrics['val_accuracy'] = val_metrics['accuracy']
        
        logger.info(f"Training complete. Loss: {final_metrics['loss']:.4f}, "
                   f"Acc: {final_metrics['accuracy']:.4f}")
        
        return {
            'weights': updated_weights,
            'num_samples': num_samples,
            'num_epochs': epochs,
            'metrics': final_metrics
        }
    
    def _forward(self, data) -> Dict[str, torch.Tensor]:
        """Forward pass with model-specific handling."""
        if self.model_type == "cst_transformer":
            # CST expects specific inputs
            if isinstance(data, dict):
                return self.model(**data)
            elif isinstance(data, torch.Tensor):
                # Assume batch format: [coords, hour, day, month, fraud_type, state]
                if data.shape[-1] >= 8:
                    return self.model(
                        coords=data[:, :2],
                        hour=data[:, 2].long(),
                        day=data[:, 3].long(),
                        month=data[:, 4].long(),
                        fraud_type=data[:, 5].long(),
                        state=data[:, 6].long(),
                    )
        elif self.model_type == "mule_detector_gnn":
            # GNN expects graph data
            if hasattr(data, 'x'):
                return self.model(
                    x=data.x,
                    edge_index=data.edge_index,
                    edge_attr=data.edge_attr if hasattr(data, 'edge_attr') else None
                )
        
        # Default: direct forward
        return self.model(data)
    
    def _compute_loss(self, output, target, criterion) -> torch.Tensor:
        """Compute loss with model-specific handling."""
        if isinstance(output, dict):
            if 'atm_logits' in output and target.dim() == 1:
                return criterion(output['atm_logits'], target)
            elif 'mule_prob' in output:
                return nn.BCELoss()(output['mule_prob'].squeeze(), target.float())
            elif 'logits' in output:
                return criterion(output['logits'], target)
        return criterion(output, target)
    
    def _get_predictions(self, output) -> Optional[torch.Tensor]:
        """Get predictions from output."""
        if isinstance(output, dict):
            if 'atm_logits' in output:
                return output['atm_logits'].argmax(dim=-1)
            elif 'mule_prob' in output:
                return (output['mule_prob'].squeeze() > 0.5).long()
        elif isinstance(output, torch.Tensor):
            if output.dim() > 1 and output.shape[-1] > 1:
                return output.argmax(dim=-1)
            else:
                return (output > 0.5).long()
        return None
    
    def _compute_proximal_term(self) -> torch.Tensor:
        """Compute FedProx proximal term."""
        proximal = torch.tensor(0.0, device=self.device)
        for name, param in self.model.named_parameters():
            if name in self.initial_weights:
                initial = torch.from_numpy(self.initial_weights[name]).to(self.device)
                proximal += (param - initial).pow(2).sum()
        return proximal
    
    def _validate(
        self,
        val_loader: DataLoader,
        criterion: nn.Module
    ) -> Dict[str, float]:
        """Validate model on validation set."""
        self.model.eval()
        total_loss = 0.0
        correct = 0
        total = 0
        
        with torch.no_grad():
            for batch in val_loader:
                if isinstance(batch, (list, tuple)):
                    data, target = batch[0], batch[-1]
                else:
                    data = batch
                    target = batch.y if hasattr(batch, 'y') else None
                
                if isinstance(data, torch.Tensor):
                    data = data.to(self.device)
                if target is not None:
                    target = target.to(self.device)
                
                output = self._forward(data)
                
                if target is not None:
                    loss = self._compute_loss(output, target, criterion)
                    total_loss += loss.item()
                    
                    pred = self._get_predictions(output)
                    if pred is not None:
                        correct += (pred == target).sum().item()
                        total += target.size(0)
        
        self.model.train()
        
        return {
            'loss': total_loss / max(len(val_loader), 1),
            'accuracy': correct / max(total, 1)
        }
    
    def get_weights_json_safe(self) -> Dict[str, Any]:
        """Get current model weights in JSON-safe format."""
        weights = model_weights_to_dict(self.model)
        return weights_to_json_safe(weights)

