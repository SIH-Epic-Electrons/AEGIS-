"""
Model Weight Serialization Utilities for Federated Learning
"""
import torch
import numpy as np
from typing import Dict, Any, List
import json
import base64
import io


def model_weights_to_dict(model: torch.nn.Module) -> Dict[str, np.ndarray]:
    """
    Convert PyTorch model to dictionary of numpy arrays.
    
    Args:
        model: PyTorch model
        
    Returns:
        Dictionary mapping parameter names to numpy arrays
    """
    weights = {}
    for name, param in model.named_parameters():
        weights[name] = param.data.cpu().detach().numpy()
    return weights


def dict_to_model_weights(model: torch.nn.Module, weights_dict: Dict[str, np.ndarray]) -> None:
    """
    Load weights from dictionary into PyTorch model.
    
    Args:
        model: PyTorch model to load weights into
        weights_dict: Dictionary of weights
    """
    with torch.no_grad():
        for name, param in model.named_parameters():
            if name in weights_dict:
                weight_array = weights_dict[name]
                if isinstance(weight_array, np.ndarray):
                    param.data = torch.from_numpy(weight_array).to(param.device)
                elif isinstance(weight_array, torch.Tensor):
                    param.data = weight_array.to(param.device)


def weights_to_json_safe(weights_dict: Dict[str, np.ndarray]) -> Dict[str, Dict[str, Any]]:
    """
    Convert weights dictionary to JSON-safe format.
    
    Args:
        weights_dict: Dictionary of numpy arrays
        
    Returns:
        JSON-serializable dictionary
    """
    json_safe = {}
    for name, arr in weights_dict.items():
        if isinstance(arr, torch.Tensor):
            arr = arr.cpu().numpy()
        json_safe[name] = {
            'data': arr.tolist(),
            'shape': list(arr.shape),
            'dtype': str(arr.dtype)
        }
    return json_safe


def json_safe_to_weights(json_dict: Dict[str, Dict[str, Any]]) -> Dict[str, np.ndarray]:
    """
    Convert JSON-safe dictionary back to weights dictionary.
    
    Args:
        json_dict: JSON-safe dictionary
        
    Returns:
        Dictionary of numpy arrays
    """
    weights = {}
    for name, info in json_dict.items():
        arr = np.array(info['data'], dtype=info['dtype'])
        arr = arr.reshape(tuple(info['shape']))
        weights[name] = arr
    return weights


def serialize_weights(weights_dict: Dict[str, np.ndarray]) -> bytes:
    """
    Serialize weights dictionary to bytes using PyTorch.
    
    Args:
        weights_dict: Dictionary of weights
        
    Returns:
        Serialized bytes
    """
    buffer = io.BytesIO()
    # Convert numpy arrays to tensors for serialization
    tensor_dict = {k: torch.from_numpy(v) if isinstance(v, np.ndarray) else v 
                   for k, v in weights_dict.items()}
    torch.save(tensor_dict, buffer)
    return buffer.getvalue()


def deserialize_weights(serialized: bytes) -> Dict[str, np.ndarray]:
    """
    Deserialize bytes to weights dictionary.
    
    Args:
        serialized: Serialized bytes
        
    Returns:
        Dictionary of weights
    """
    buffer = io.BytesIO(serialized)
    tensor_dict = torch.load(buffer, map_location='cpu')
    return {k: v.numpy() if isinstance(v, torch.Tensor) else v 
            for k, v in tensor_dict.items()}


def calculate_weight_update_size(weights_dict: Dict[str, np.ndarray]) -> int:
    """Calculate size of weights in bytes."""
    total = 0
    for arr in weights_dict.values():
        if isinstance(arr, np.ndarray):
            total += arr.nbytes
        elif isinstance(arr, torch.Tensor):
            total += arr.nelement() * arr.element_size()
    return total


def compute_weight_delta(
    initial_weights: Dict[str, np.ndarray],
    final_weights: Dict[str, np.ndarray]
) -> Dict[str, np.ndarray]:
    """
    Compute difference between initial and final weights.
    
    Args:
        initial_weights: Weights before training
        final_weights: Weights after training
        
    Returns:
        Weight deltas
    """
    delta = {}
    for name in initial_weights:
        if name in final_weights:
            delta[name] = final_weights[name] - initial_weights[name]
    return delta


def apply_weight_delta(
    weights: Dict[str, np.ndarray],
    delta: Dict[str, np.ndarray],
    learning_rate: float = 1.0
) -> Dict[str, np.ndarray]:
    """
    Apply weight delta to weights.
    
    Args:
        weights: Current weights
        delta: Weight deltas to apply
        learning_rate: Scale factor for deltas
        
    Returns:
        Updated weights
    """
    updated = {}
    for name in weights:
        if name in delta:
            updated[name] = weights[name] + learning_rate * delta[name]
        else:
            updated[name] = weights[name]
    return updated

