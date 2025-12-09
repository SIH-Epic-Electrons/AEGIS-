"""
PostgreSQL Database Connection
Async SQLAlchemy setup for AEGIS
"""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker
)
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.models.base import Base


# Create async engine
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,  # Log SQL queries in debug mode
    poolclass=NullPool,   # Disable connection pooling for async
    future=True
)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency that provides database session.
    Use with FastAPI Depends().
    
    Usage:
        @app.get("/items")
        async def get_items(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Initialize database - create all tables"""
    async with engine.begin() as conn:
        # Import all models to ensure they're registered
        from app.models import (
            PoliceStation, Officer, Team, ATM, Case,
            Transaction, MuleAccount, Notification,
            CaseAction, FreezeRequest, AIPrediction
        )
        await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    """Close database connections"""
    await engine.dispose()
