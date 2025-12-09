"""
Client Communication with Federated Learning Server
"""
import httpx
import logging
from typing import Dict, Any, Optional
import asyncio

from app.federated_learning.config import fl_config
from app.federated_learning.utils.serialization import (
    weights_to_json_safe,
    json_safe_to_weights,
)

logger = logging.getLogger(__name__)


class FLClientCommunicator:
    """
    Handles communication between client and federated learning server.
    
    Supports:
    - Client registration
    - Downloading global model
    - Submitting weight updates
    - Checking round status
    """
    
    def __init__(
        self,
        client_id: str,
        server_url: str = None,
        timeout: float = None
    ):
        """
        Initialize client communicator.
        
        Args:
            client_id: Unique client identifier (e.g., 'sbi', 'hdfc')
            server_url: FL server URL
            timeout: Request timeout in seconds
        """
        self.client_id = client_id
        self.server_url = server_url or fl_config.server_url
        self.timeout = timeout or fl_config.timeout_seconds
        self._client = None
        
        logger.info(f"FL Client Communicator initialized: {client_id} -> {self.server_url}")
    
    @property
    def client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=self.timeout,
                headers={'X-Client-ID': self.client_id}
            )
        return self._client
    
    async def register(self, client_info: Dict = None) -> Dict[str, Any]:
        """
        Register this client with the FL server.
        
        Args:
            client_info: Additional client information
            
        Returns:
            Registration confirmation
        """
        try:
            response = await self.client.post(
                f"{self.server_url}/api/v1/fl/clients/register",
                json={
                    'client_id': self.client_id,
                    'info': client_info or {}
                }
            )
            response.raise_for_status()
            result = response.json()
            logger.info(f"Client {self.client_id} registered successfully")
            return result
        except Exception as e:
            logger.error(f"Registration failed: {e}")
            raise
    
    async def get_global_model(self, model_type: str) -> Dict[str, Any]:
        """
        Download latest global model from server.
        
        Args:
            model_type: Type of model to download
            
        Returns:
            Model weights and metadata
        """
        try:
            response = await self.client.get(
                f"{self.server_url}/api/v1/fl/models/{model_type}/global"
            )
            response.raise_for_status()
            data = response.json()
            
            # Convert weights from JSON-safe format
            if 'weights' in data:
                data['weights'] = json_safe_to_weights(data['weights'])
            
            logger.info(f"Downloaded global {model_type} model v{data.get('version', '?')}")
            return data
        except Exception as e:
            logger.error(f"Error downloading global model: {e}")
            raise
    
    async def start_round(
        self,
        model_type: str,
        client_ids: list = None
    ) -> Dict[str, Any]:
        """
        Start a new federated learning round.
        
        Args:
            model_type: Type of model
            client_ids: Participating clients (None = all)
            
        Returns:
            Round information
        """
        try:
            response = await self.client.post(
                f"{self.server_url}/api/v1/fl/rounds/start",
                json={
                    'model_type': model_type,
                    'client_ids': client_ids
                }
            )
            response.raise_for_status()
            data = response.json()
            
            # Convert weights from JSON-safe format
            if 'global_weights' in data:
                data['global_weights'] = json_safe_to_weights(data['global_weights'])
            
            logger.info(f"Started round {data.get('round_number', '?')} for {model_type}")
            return data
        except Exception as e:
            logger.error(f"Error starting round: {e}")
            raise
    
    async def submit_update(
        self,
        model_type: str,
        round_number: int,
        weights: Dict[str, Any],
        num_samples: int,
        metrics: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Submit local model update to server.
        
        Args:
            model_type: Type of model
            round_number: Current round number
            weights: Model weights (numpy arrays)
            num_samples: Number of training samples
            metrics: Training metrics
            
        Returns:
            Submission result
        """
        try:
            # Convert weights to JSON-safe format
            json_weights = weights_to_json_safe(weights)
            
            payload = {
                'client_id': self.client_id,
                'model_type': model_type,
                'round_number': round_number,
                'weights': json_weights,
                'num_samples': num_samples,
                'metrics': metrics or {}
            }
            
            response = await self.client.post(
                f"{self.server_url}/api/v1/fl/rounds/{round_number}/update",
                json=payload
            )
            response.raise_for_status()
            result = response.json()
            
            logger.info(f"Submitted update for round {round_number}")
            return result
        except Exception as e:
            logger.error(f"Error submitting update: {e}")
            raise
    
    async def get_round_status(
        self,
        model_type: str,
        round_number: int
    ) -> Dict[str, Any]:
        """Get status of a federated learning round."""
        try:
            response = await self.client.get(
                f"{self.server_url}/api/v1/fl/rounds/{round_number}/status",
                params={'model_type': model_type}
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error getting round status: {e}")
            raise
    
    async def get_training_progress(self, model_type: str) -> Dict[str, Any]:
        """Get overall training progress."""
        try:
            response = await self.client.get(
                f"{self.server_url}/api/v1/fl/progress/{model_type}"
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error getting progress: {e}")
            raise
    
    async def close(self):
        """Close HTTP client."""
        if self._client is not None:
            await self._client.aclose()
            self._client = None
        logger.info(f"Client {self.client_id} connection closed")
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

