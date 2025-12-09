"""
Hyperledger Fabric Blockchain Service

Stores sensitive prediction data on blockchain for privacy and immutability
"""

import json
import logging
from typing import Dict, Optional, List
from datetime import datetime
from uuid import UUID

logger = logging.getLogger(__name__)

# Try to import Hyperledger Fabric SDK
try:
    from hfc.fabric import Client as FabricClient
    from hfc.fabric.user import create_user
    BLOCKCHAIN_AVAILABLE = True
except ImportError:
    BLOCKCHAIN_AVAILABLE = False
    logger.warning("Hyperledger Fabric SDK not available. Blockchain features disabled.")


class BlockchainService:
    """
    Service to interact with Hyperledger Fabric blockchain
    Stores: Top 3 ATM locations, confidence scores, time windows, caseId
    """
    
    def __init__(
        self,
        network_config_path: Optional[str] = None,
        user_name: Optional[str] = None,
        org_name: Optional[str] = None,
        enabled: bool = True
    ):
        """
        Initialize blockchain client
        
        Args:
            network_config_path: Path to network configuration YAML
            user_name: User name for blockchain access
            org_name: Organization name
            enabled: Whether blockchain is enabled
        """
        self.enabled = enabled and BLOCKCHAIN_AVAILABLE
        
        if not self.enabled:
            logger.info("Blockchain service disabled or SDK not available")
            self.client = None
            return
            
        if not network_config_path or not user_name or not org_name:
            logger.warning("Blockchain configuration incomplete. Disabling blockchain service.")
            self.enabled = False
            return
            
        try:
            self.client = FabricClient(network_path=network_config_path)
            self.user_name = user_name
            self.org_name = org_name
            self.channel_name = "aegis-channel"  # Your channel name
            self.chaincode_name = "aegis-predictions"  # Your chaincode name
            logger.info(f"Blockchain service initialized for org: {org_name}")
        except Exception as e:
            logger.error(f"Failed to initialize blockchain client: {e}")
            self.enabled = False
            self.client = None
    
    async def store_prediction(
        self,
        case_id: UUID,
        top3_atm_locations: List[Dict],
        confidence_scores: Dict,
        time_window: Dict,
        model_info: Dict
    ) -> bool:
        """
        Store prediction data on blockchain
        
        Args:
            case_id: Case UUID
            top3_atm_locations: List of top 3 ATM location predictions
            confidence_scores: Confidence score data
            time_window: Time window prediction
            model_info: Model information
            
        Returns:
            True if successful, False otherwise
        """
        if not self.enabled:
            logger.debug("Blockchain disabled, skipping storage")
            return False
            
        try:
            # Format data for blockchain
            prediction_data = {
                "caseId": str(case_id),
                "top3AtmLocations": top3_atm_locations,
                "confidenceScores": confidence_scores,
                "timeWindow": time_window,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "model_info": model_info
            }
            
            # Convert to JSON
            prediction_json = json.dumps(prediction_data)
            
            # Get user context
            org = self.client.get_org(self.org_name)
            user = await create_user(user_name=self.user_name, org=org)
            
            # Log before storing
            logger.info(f"🔗 [BLOCKCHAIN] Storing prediction for case {case_id} on blockchain...")
            logger.info(f"📊 [BLOCKCHAIN] Data: {len(top3_atm_locations)} ATM locations, confidence: {confidence_scores.get('primary', 0):.2%}")
            
            # Invoke chaincode
            start_time = datetime.utcnow()
            response = await self.client.chaincode_invoke(
                requestor=user,
                channel_name=self.channel_name,
                peers=org.get_peers(),
                args=[prediction_json],
                cc_name=self.chaincode_name,
                fcn='StorePrediction',
                wait_for_event=True
            )
            
            elapsed = (datetime.utcnow() - start_time).total_seconds()
            logger.info(f"✅ [BLOCKCHAIN] Successfully stored prediction for case {case_id} on blockchain (took {elapsed:.2f}s)")
            logger.info(f"📝 [BLOCKCHAIN] Transaction details: Channel={self.channel_name}, Chaincode={self.chaincode_name}")
            
            # Log to monitoring system
            try:
                # Import here to avoid circular dependency
                import sys
                if 'app.api.v1.endpoints.blockchain_monitor' in sys.modules:
                    from app.api.v1.endpoints.blockchain_monitor import log_blockchain_operation
                    log_blockchain_operation(
                        operation_type="store_prediction",
                        case_id=str(case_id),
                        status="success",
                        details={
                            "locations_count": len(top3_atm_locations),
                            "confidence": confidence_scores.get('primary', 0),
                            "elapsed_seconds": elapsed,
                            "channel": self.channel_name,
                            "chaincode": self.chaincode_name
                        }
                    )
            except Exception as e:
                logger.debug(f"Could not log to monitoring system: {e}")  # Don't fail if monitoring not available
            
            # Print to console for real-time visibility
            print(f"\n{'='*80}")
            print(f"🔗 BLOCKCHAIN STORAGE - {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"{'='*80}")
            print(f"✅ Case ID: {case_id}")
            print(f"📊 Locations: {len(top3_atm_locations)} ATM predictions")
            print(f"🎯 Confidence: {confidence_scores.get('primary', 0):.2%}")
            print(f"⏱️  Time: {elapsed:.2f}s")
            print(f"🔗 Channel: {self.channel_name}")
            print(f"📦 Chaincode: {self.chaincode_name}")
            print(f"{'='*80}\n")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ [BLOCKCHAIN] Error storing prediction on blockchain for case {case_id}: {e}", exc_info=True)
            
            # Log failure to monitoring
            try:
                import sys
                if 'app.api.v1.endpoints.blockchain_monitor' in sys.modules:
                    from app.api.v1.endpoints.blockchain_monitor import log_blockchain_operation
                    log_blockchain_operation(
                        operation_type="store_prediction",
                        case_id=str(case_id),
                        status="failed",
                        details={"error": str(e)}
                    )
            except Exception:
                pass
            
            # Print error to console
            print(f"\n{'='*80}")
            print(f"❌ BLOCKCHAIN STORAGE FAILED - {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"{'='*80}")
            print(f"Case ID: {case_id}")
            print(f"Error: {str(e)}")
            print(f"{'='*80}\n")
            
            return False
    
    async def update_prediction(
        self,
        case_id: UUID,
        top3_atm_locations: List[Dict],
        confidence_scores: Dict,
        time_window: Dict,
        model_info: Dict
    ) -> bool:
        """
        Update existing prediction data on blockchain
        
        Args:
            case_id: Case UUID
            top3_atm_locations: Updated list of top 3 ATM location predictions
            confidence_scores: Updated confidence score data
            time_window: Updated time window prediction
            model_info: Updated model information
            
        Returns:
            True if successful, False otherwise
        """
        if not self.enabled:
            logger.debug("Blockchain disabled, skipping update")
            return False
            
        try:
            # Format data for blockchain
            prediction_data = {
                "caseId": str(case_id),
                "top3AtmLocations": top3_atm_locations,
                "confidenceScores": confidence_scores,
                "timeWindow": time_window,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "model_info": model_info
            }
            
            # Convert to JSON
            prediction_json = json.dumps(prediction_data)
            
            # Get user context
            org = self.client.get_org(self.org_name)
            user = await create_user(user_name=self.user_name, org=org)
            
            # Invoke chaincode
            response = await self.client.chaincode_invoke(
                requestor=user,
                channel_name=self.channel_name,
                peers=org.get_peers(),
                args=[prediction_json],
                cc_name=self.chaincode_name,
                fcn='UpdatePrediction',
                wait_for_event=True
            )
            
            logger.info(f"Successfully updated prediction for case {case_id} on blockchain")
            return True
            
        except Exception as e:
            logger.error(f"Error updating prediction on blockchain for case {case_id}: {e}", exc_info=True)
            return False
    
    async def get_prediction(self, case_id: UUID) -> Optional[Dict]:
        """
        Retrieve prediction data from blockchain
        
        Args:
            case_id: Case UUID
            
        Returns:
            Prediction data dict or None if not found
        """
        if not self.enabled:
            logger.debug("Blockchain disabled, cannot retrieve")
            return None
            
        try:
            org = self.client.get_org(self.org_name)
            user = await create_user(user_name=self.user_name, org=org)
            
            # Query chaincode
            response = await self.client.chaincode_query(
                requestor=user,
                channel_name=self.channel_name,
                peers=[org.get_peers()[0]],
                args=[str(case_id)],
                cc_name=self.chaincode_name,
                fcn='GetPrediction'
            )
            
            if response:
                return json.loads(response)
            return None
            
        except Exception as e:
            logger.error(f"Error retrieving prediction from blockchain for case {case_id}: {e}", exc_info=True)
            return None
    
    async def query_by_date_range(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict]:
        """
        Query predictions within a date range
        
        Args:
            start_date: Start date
            end_date: End date
            
        Returns:
            List of prediction data
        """
        if not self.enabled:
            logger.debug("Blockchain disabled, cannot query")
            return []
            
        try:
            org = self.client.get_org(self.org_name)
            user = await create_user(user_name=self.user_name, org=org)
            
            start_iso = start_date.isoformat() + "Z"
            end_iso = end_date.isoformat() + "Z"
            
            response = await self.client.chaincode_query(
                requestor=user,
                channel_name=self.channel_name,
                peers=[org.get_peers()[0]],
                args=[start_iso, end_iso],
                cc_name=self.chaincode_name,
                fcn='QueryPredictionsByDateRange'
            )
            
            if response:
                return json.loads(response)
            return []
            
        except Exception as e:
            logger.error(f"Error querying predictions by date range: {e}", exc_info=True)
            return []
    
    async def get_prediction_history(self, case_id: UUID) -> List[Dict]:
        """
        Get complete history of a prediction (all versions)
        
        Args:
            case_id: Case UUID
            
        Returns:
            List of prediction data versions
        """
        if not self.enabled:
            logger.debug("Blockchain disabled, cannot retrieve history")
            return []
            
        try:
            org = self.client.get_org(self.org_name)
            user = await create_user(user_name=self.user_name, org=org)
            
            response = await self.client.chaincode_query(
                requestor=user,
                channel_name=self.channel_name,
                peers=[org.get_peers()[0]],
                args=[str(case_id)],
                cc_name=self.chaincode_name,
                fcn='GetPredictionHistory'
            )
            
            if response:
                return json.loads(response)
            return []
            
        except Exception as e:
            logger.error(f"Error retrieving prediction history for case {case_id}: {e}", exc_info=True)
            return []


# Singleton instance
_blockchain_service: Optional[BlockchainService] = None


def get_blockchain_service() -> BlockchainService:
    """Get or create blockchain service instance"""
    global _blockchain_service
    
    if _blockchain_service is None:
        from app.core.config import settings
        
        _blockchain_service = BlockchainService(
            network_config_path=getattr(settings, 'blockchain_network_config', None),
            user_name=getattr(settings, 'blockchain_user_name', None),
            org_name=getattr(settings, 'blockchain_org_name', None),
            enabled=getattr(settings, 'blockchain_enabled', False)
        )
    
    return _blockchain_service

