"""
Hyperledger Fabric Service for AEGIS
Integrates with Fabric network to store immutable audit events and predictions
"""

import json
import uuid
from datetime import datetime
from typing import Optional, Dict, List, Any
from pathlib import Path

# Note: For production, use official Fabric Python SDK or gRPC directly
# For now, we'll use a simplified approach that can work with REST API or gRPC
FABRIC_AVAILABLE = False  # Set to True when Fabric network is running
try:
    import grpc
    import requests
    FABRIC_AVAILABLE = True
except ImportError:
    pass

import logging

logger = logging.getLogger(__name__)


class FabricService:
    """Service for interacting with Hyperledger Fabric network"""
    
    def __init__(self, network_config_path: Optional[str] = None):
        """
        Initialize Fabric service
        
        Args:
            network_config_path: Path to network configuration file
        """
        if not FABRIC_AVAILABLE:
            logger.warning("Fabric SDK not available. Audit events will be logged locally only.")
            self.client = None
            self.initialized = False
            return
            
        self.network_config_path = network_config_path or self._get_default_config_path()
        self.client = None
        self.initialized = False
        self.channel_name = "audit-channel"
        self.audit_chaincode_name = "audit-trail"
        self.predictions_chaincode_name = "predictions"
        
    def _get_default_config_path(self) -> str:
        """Get default network configuration path"""
        backend_root = Path(__file__).parent.parent.parent
        return str(backend_root / "fabric-network" / "network-config")
    
    async def initialize(self) -> bool:
        """
        Initialize Fabric client connection
        
        Returns:
            True if initialization successful, False otherwise
        """
        # For now, we'll use local storage as fallback
        # In production, connect to Fabric network via gRPC or REST
        try:
            # Check if Fabric network is running
            # This is a simplified check - in production, verify peer connectivity
            self.initialized = False  # Set to True when Fabric network is properly configured
            logger.info("Fabric service initialized (using local storage fallback)")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize Fabric service: {e}")
            self.initialized = False
            return False
    
    async def create_audit_event(
        self,
        event_type: str,
        officer_id: str,
        timestamp: Optional[str] = None,
        alert_id: Optional[str] = None,
        complaint_id: Optional[str] = None,
        action_type: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create an audit event on the blockchain
        
        Args:
            event_type: Type of event (ComplaintFiled, AlertTriggered, etc.)
            officer_id: ID of the officer
            timestamp: ISO timestamp (defaults to now)
            alert_id: Optional alert ID
            complaint_id: Optional complaint ID
            action_type: Optional action type
            metadata: Optional metadata dictionary
            
        Returns:
            Dictionary with event_id and transaction_id
        """
        if not self.initialized or not self.client:
            logger.warning("Fabric not initialized, storing event locally")
            return await self._store_locally(
                event_type, officer_id, timestamp, alert_id, complaint_id, action_type, metadata
            )
        
        try:
            # Generate unique event ID
            event_id = str(uuid.uuid4())
            timestamp = timestamp or datetime.utcnow().isoformat()
            metadata_json = json.dumps(metadata or {})
            
            # TODO: In production, invoke Fabric chaincode via gRPC or REST API
            # For now, use local storage as fallback
            # When Fabric network is running, implement actual chaincode invocation:
            # 
            # from hfc.fabric import Client
            # client = Client(net_profile=self.network_config_path)
            # response = await client.chaincode_invoke(...)
            
            logger.info(f"Audit event created (local storage): {event_id}")
            # Fallback to local storage for now
            return await self._store_locally(
                event_type, officer_id, timestamp, alert_id, complaint_id, action_type, metadata
            )
            
        except Exception as e:
            logger.error(f"Failed to create audit event: {e}")
            # Fallback to local storage
            return await self._store_locally(
                event_type, officer_id, timestamp, alert_id, complaint_id, action_type, metadata
            )
    
    async def query_audit_event(self, event_id: str) -> Optional[Dict[str, Any]]:
        """
        Query a specific audit event by ID
        
        Args:
            event_id: Event ID to query
            
        Returns:
            Event data or None if not found
        """
        if not self.initialized or not self.client:
            logger.warning("Fabric not initialized")
            return None
            
        try:
            response = await self.client.chaincode_query(
                requestor=self.client.get_user('org1', 'Admin'),
                channel_name=self.channel_name,
                peers=['peer0.org1.aegis.com'],
                fcn='QueryAuditEvent',
                args=[event_id],
                cc_name=self.chaincode_name
            )
            
            return json.loads(response)
            
        except Exception as e:
            logger.error(f"Failed to query audit event: {e}")
            return None
    
    async def query_events_by_officer(self, officer_id: str) -> List[Dict[str, Any]]:
        """Query all events for a specific officer"""
        if not self.initialized or not self.client:
            return []
            
        try:
            response = await self.client.chaincode_query(
                requestor=self.client.get_user('org1', 'Admin'),
                channel_name=self.channel_name,
                peers=['peer0.org1.aegis.com'],
                fcn='QueryAuditEventsByOfficer',
                args=[officer_id],
                cc_name=self.chaincode_name
            )
            
            return json.loads(response)
            
        except Exception as e:
            logger.error(f"Failed to query events by officer: {e}")
            return []
    
    async def query_events_by_type(self, event_type: str) -> List[Dict[str, Any]]:
        """Query all events of a specific type"""
        if not self.initialized or not self.client:
            return []
            
        try:
            response = await self.client.chaincode_query(
                requestor=self.client.get_user('org1', 'Admin'),
                channel_name=self.channel_name,
                peers=['peer0.org1.aegis.com'],
                fcn='QueryAuditEventsByType',
                args=[event_type],
                cc_name=self.chaincode_name
            )
            
            return json.loads(response)
            
        except Exception as e:
            logger.error(f"Failed to query events by type: {e}")
            return []
    
    async def query_events_by_date_range(
        self, 
        start_date: str, 
        end_date: str
    ) -> List[Dict[str, Any]]:
        """Query events in a date range"""
        if not self.initialized or not self.client:
            return []
            
        try:
            response = await self.client.chaincode_query(
                requestor=self.client.get_user('org1', 'Admin'),
                channel_name=self.channel_name,
                peers=['peer0.org1.aegis.com'],
                fcn='QueryAuditEventsByDateRange',
                args=[start_date, end_date],
                cc_name=self.chaincode_name
            )
            
            return json.loads(response)
            
        except Exception as e:
            logger.error(f"Failed to query events by date range: {e}")
            return []
    
    async def _store_locally(
        self,
        event_type: str,
        officer_id: str,
        timestamp: Optional[str],
        alert_id: Optional[str],
        complaint_id: Optional[str],
        action_type: Optional[str],
        metadata: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Fallback: Store event locally when Fabric is unavailable"""
        event_id = str(uuid.uuid4())
        timestamp = timestamp or datetime.utcnow().isoformat()
        
        event_data = {
            "event_id": event_id,
            "event_type": event_type,
            "officer_id": officer_id,
            "timestamp": timestamp,
            "alert_id": alert_id,
            "complaint_id": complaint_id,
            "action_type": action_type,
            "metadata": metadata or {},
            "stored_locally": True
        }
        
        # Store in local file (for development)
        log_file = Path(__file__).parent.parent.parent / "fabric-network" / "local-audit-log.jsonl"
        log_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(log_file, "a") as f:
            f.write(json.dumps(event_data) + "\n")
        
        logger.info(f"Event stored locally: {event_id}")
        return {
            "event_id": event_id,
            "tx_id": None,
            "status": "stored_locally"
        }
    
    async def store_prediction(
        self,
        case_id: str,
        top3_atm_locations: List[Dict[str, Any]],
        confidence_scores: Dict[str, Any],
        time_window: Dict[str, Any],
        model_info: Dict[str, Any],
        timestamp: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Store prediction data on the blockchain
        
        Args:
            case_id: Case UUID as string
            top3_atm_locations: List of top 3 ATM location predictions
            confidence_scores: Confidence score data
            time_window: Time window prediction
            model_info: Model information
            timestamp: ISO timestamp (defaults to now)
            
        Returns:
            Dictionary with case_id and transaction_id
        """
        if not self.initialized or not self.client:
            logger.warning("Fabric not initialized, storing prediction locally")
            return await self._store_prediction_locally(
                case_id, top3_atm_locations, confidence_scores, time_window, model_info, timestamp
            )
        
        try:
            timestamp = timestamp or datetime.utcnow().isoformat() + "Z"
            
            # Format prediction data
            prediction_data = {
                "caseId": case_id,
                "top3AtmLocations": top3_atm_locations,
                "confidenceScores": confidence_scores,
                "timeWindow": time_window,
                "timestamp": timestamp,
                "model_info": model_info
            }
            
            prediction_json = json.dumps(prediction_data)
            
            # TODO: In production, invoke Fabric chaincode via gRPC or REST API
            # For now, use local storage as fallback
            logger.info(f"Prediction stored (local storage): {case_id}")
            return await self._store_prediction_locally(
                case_id, top3_atm_locations, confidence_scores, time_window, model_info, timestamp
            )
            
        except Exception as e:
            logger.error(f"Failed to store prediction: {e}")
            return await self._store_prediction_locally(
                case_id, top3_atm_locations, confidence_scores, time_window, model_info, timestamp
            )
    
    async def get_prediction(self, case_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve prediction data from blockchain
        
        Args:
            case_id: Case UUID as string
            
        Returns:
            Prediction data dict or None if not found
        """
        if not self.initialized or not self.client:
            logger.warning("Fabric not initialized")
            return None
            
        try:
            # TODO: Query chaincode when Fabric is properly configured
            # response = await self.client.chaincode_query(...)
            return None
            
        except Exception as e:
            logger.error(f"Failed to query prediction: {e}")
            return None
    
    async def query_predictions_by_date_range(
        self,
        start_date: str,
        end_date: str
    ) -> List[Dict[str, Any]]:
        """Query predictions within a date range"""
        if not self.initialized or not self.client:
            return []
            
        try:
            # TODO: Query chaincode when Fabric is properly configured
            return []
            
        except Exception as e:
            logger.error(f"Failed to query predictions by date range: {e}")
            return []
    
    async def _store_prediction_locally(
        self,
        case_id: str,
        top3_atm_locations: List[Dict[str, Any]],
        confidence_scores: Dict[str, Any],
        time_window: Dict[str, Any],
        model_info: Dict[str, Any],
        timestamp: Optional[str]
    ) -> Dict[str, Any]:
        """Fallback: Store prediction locally when Fabric is unavailable"""
        timestamp = timestamp or datetime.utcnow().isoformat() + "Z"
        
        prediction_data = {
            "caseId": case_id,
            "top3AtmLocations": top3_atm_locations,
            "confidenceScores": confidence_scores,
            "timeWindow": time_window,
            "timestamp": timestamp,
            "model_info": model_info,
            "stored_locally": True
        }
        
        # Store in local file (for development)
        log_file = Path(__file__).parent.parent.parent / "fabric-network" / "local-predictions-log.jsonl"
        log_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(log_file, "a") as f:
            f.write(json.dumps(prediction_data) + "\n")
        
        logger.info(f"Prediction stored locally: {case_id}")
        return {
            "case_id": case_id,
            "tx_id": None,
            "status": "stored_locally"
        }


# Global instance
_fabric_service: Optional[FabricService] = None


async def get_fabric_service() -> FabricService:
    """Get or create Fabric service instance"""
    global _fabric_service
    
    if _fabric_service is None:
        _fabric_service = FabricService()
        await _fabric_service.initialize()
    
    return _fabric_service

