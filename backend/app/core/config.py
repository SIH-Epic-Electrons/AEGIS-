"""
AEGIS Configuration Management
Centralized configuration using Pydantic Settings
"""

from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        protected_namespaces=('settings_',)  # Allow model_ prefix
    )
    
    # Application
    app_name: str = "AEGIS"
    app_env: str = "development"
    debug: bool = True
    secret_key: str = "change-me-in-production"
    api_v1_prefix: str = "/api/v1"
    
    # PostgreSQL
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "aegis_user"
    postgres_password: str = "aegis_password"
    postgres_db: str = "aegis_db"
    
    # Neo4j
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "password"
    
    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_password: Optional[str] = None
    redis_db: int = 0
    
    # Kafka
    kafka_bootstrap_servers: str = "localhost:9092"
    kafka_consumer_group: str = "aegis-backend"
    
    # JWT
    jwt_secret_key: str = "jwt-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 1440  # 24 hours
    
    # ML
    model_path: str = "./app/ml/models/saved"
    prediction_confidence_threshold: float = 0.7
    
    # Kaggle
    kaggle_username: Optional[str] = None
    kaggle_key: Optional[str] = None
    
    @property
    def database_url(self) -> str:
        """Async PostgreSQL connection string"""
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )
    
    @property
    def database_url_sync(self) -> str:
        """Sync PostgreSQL connection string (for migrations)"""
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )
    
    @property
    def redis_url(self) -> str:
        """Redis connection string"""
        if self.redis_password:
            return f"redis://:{self.redis_password}@{self.redis_host}:{self.redis_port}/{self.redis_db}"
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"
    
    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Global settings instance
settings = get_settings()

