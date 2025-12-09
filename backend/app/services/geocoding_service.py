"""
Geocoding Service
Provides reverse geocoding (coordinates to address) functionality
"""

import logging
from typing import Optional, Dict, Any
import httpx
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError
import asyncio

logger = logging.getLogger(__name__)


class GeocodingService:
    """Service for reverse geocoding (coordinates to address)"""
    
    def __init__(self):
        self.geocoder = Nominatim(user_agent="aegis-fraud-detection")
        self.cache: Dict[str, Dict[str, Any]] = {}
    
    async def reverse_geocode(
        self,
        lat: float,
        lon: float,
        language: str = "en"
    ) -> Optional[Dict[str, Any]]:
        """
        Reverse geocode coordinates to get address.
        
        Args:
            lat: Latitude
            lon: Longitude
            language: Language for address (default: "en")
        
        Returns:
            Dictionary with address components or None if failed
        """
        # Check cache first
        cache_key = f"{lat:.6f},{lon:.6f}"
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        try:
            # Use geopy for reverse geocoding
            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            location = await loop.run_in_executor(
                None,
                lambda: self.geocoder.reverse((lat, lon), language=language, timeout=10)
            )
            
            if not location:
                logger.warning(f"Reverse geocoding failed for ({lat}, {lon})")
                return None
            
            address = location.raw.get("address", {})
            
            # Extract address components
            result = {
                "formatted_address": location.address,
                "city": (
                    address.get("city") or 
                    address.get("town") or 
                    address.get("village") or 
                    address.get("suburb") or
                    address.get("county") or
                    "Unknown"
                ),
                "state": (
                    address.get("state") or 
                    address.get("region") or
                    "Unknown"
                ),
                "country": address.get("country", "India"),
                "postcode": address.get("postcode"),
                "district": address.get("district"),
                "neighborhood": address.get("neighborhood"),
                "road": address.get("road"),
                "house_number": address.get("house_number"),
                "latitude": lat,
                "longitude": lon,
            }
            
            # Build readable address
            address_parts = []
            if result.get("road"):
                if result.get("house_number"):
                    address_parts.append(f"{result['house_number']} {result['road']}")
                else:
                    address_parts.append(result["road"])
            
            if result.get("neighborhood"):
                address_parts.append(result["neighborhood"])
            
            if result.get("city") and result["city"] != "Unknown":
                address_parts.append(result["city"])
            
            if result.get("state") and result["state"] != "Unknown":
                address_parts.append(result["state"])
            
            if result.get("postcode"):
                address_parts.append(result["postcode"])
            
            result["address"] = ", ".join(address_parts) if address_parts else result["formatted_address"]
            
            # Cache result
            self.cache[cache_key] = result
            
            return result
            
        except GeocoderTimedOut:
            logger.error(f"Geocoding timeout for ({lat}, {lon})")
            return None
        except GeocoderServiceError as e:
            logger.error(f"Geocoding service error for ({lat}, {lon}): {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error in reverse geocoding for ({lat}, {lon}): {e}")
            return None
    
    async def get_nearby_places(
        self,
        lat: float,
        lon: float,
        radius_km: float = 5.0,
        place_type: Optional[str] = None
    ) -> list:
        """
        Get nearby places (ATMs, banks, etc.) using Overpass API or similar.
        This is a simplified version - in production, use a proper geospatial database.
        
        Args:
            lat: Center latitude
            lon: Center longitude
            radius_km: Search radius in kilometers
            place_type: Type of place to search (e.g., "atm", "bank")
        
        Returns:
            List of nearby places
        """
        # For now, return empty list
        # In production, integrate with Overpass API or PostGIS
        return []


# Global service instance
_geocoding_service: Optional[GeocodingService] = None


def get_geocoding_service() -> GeocodingService:
    """Get or create geocoding service instance"""
    global _geocoding_service
    if _geocoding_service is None:
        _geocoding_service = GeocodingService()
    return _geocoding_service

