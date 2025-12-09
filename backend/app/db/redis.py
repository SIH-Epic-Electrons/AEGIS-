"""
Redis Connection
For caching and real-time data
"""

from typing import Optional, Any
import json
import logging

import redis.asyncio as redis
from redis.asyncio import Redis

from app.core.config import settings

logger = logging.getLogger(__name__)


class RedisConnection:
    """Redis connection manager"""
    
    _client: Optional[Redis] = None
    
    @classmethod
    async def get_client(cls) -> Redis:
        """Get or create Redis client"""
        if cls._client is None:
            cls._client = redis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            # Test connection
            await cls._client.ping()
            logger.info("Redis connection established")
        return cls._client
    
    @classmethod
    async def close(cls) -> None:
        """Close Redis connection"""
        if cls._client is not None:
            await cls._client.close()
            cls._client = None
            logger.info("Redis connection closed")


async def get_redis() -> Redis:
    """Dependency to get Redis client"""
    return await RedisConnection.get_client()


# Cache utilities
class CacheService:
    """High-level caching utilities"""
    
    DEFAULT_TTL = 3600  # 1 hour
    
    @classmethod
    async def get(cls, key: str) -> Optional[Any]:
        """Get value from cache"""
        client = await RedisConnection.get_client()
        value = await client.get(key)
        if value:
            return json.loads(value)
        return None
    
    @classmethod
    async def set(
        cls,
        key: str,
        value: Any,
        ttl: int = DEFAULT_TTL
    ) -> None:
        """Set value in cache"""
        client = await RedisConnection.get_client()
        await client.setex(key, ttl, json.dumps(value))
    
    @classmethod
    async def delete(cls, key: str) -> None:
        """Delete value from cache"""
        client = await RedisConnection.get_client()
        await client.delete(key)
    
    @classmethod
    async def exists(cls, key: str) -> bool:
        """Check if key exists"""
        client = await RedisConnection.get_client()
        return await client.exists(key) > 0
    
    # Pub/Sub for real-time notifications
    @classmethod
    async def publish(cls, channel: str, message: Any) -> None:
        """Publish message to channel"""
        client = await RedisConnection.get_client()
        await client.publish(channel, json.dumps(message))

