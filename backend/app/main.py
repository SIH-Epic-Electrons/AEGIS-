"""
AEGIS Backend - Main Application
FastAPI entry point
"""

from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.postgresql import init_db, close_db
from app.db.neo4j import Neo4jConnection, init_neo4j
from app.db.redis import RedisConnection
from app.api.v1 import api_router
from app.services import initialize_cst_service

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Handles startup and shutdown events.
    """
    # Startup
    logger.info("Starting AEGIS Backend...")
    
    try:
        # Initialize PostgreSQL
        logger.info("Initializing PostgreSQL...")
        await init_db()
        logger.info("PostgreSQL initialized")
        
        # Initialize Neo4j (optional - don't fail if not available)
        try:
            logger.info("Initializing Neo4j...")
            await init_neo4j()
            logger.info("Neo4j initialized")
        except Exception as e:
            logger.warning(f"Neo4j not available: {e}. Continuing without graph database.")
        
        # Initialize Redis (optional)
        try:
            logger.info("Initializing Redis...")
            await RedisConnection.get_client()
            logger.info("Redis initialized")
        except Exception as e:
            logger.warning(f"Redis not available: {e}. Continuing without cache.")
        
        # Initialize CST Transformer model
        try:
            logger.info("Initializing CST Transformer model...")
            if initialize_cst_service():
                logger.info("CST Transformer model initialized")
            else:
                logger.warning("CST Transformer model not available. Predictions will not work.")
        except Exception as e:
            logger.warning(f"CST model initialization failed: {e}. Continuing without ML predictions.")
        
        logger.info("AEGIS Backend started successfully!")
        
    except Exception as e:
        logger.error(f"Startup failed: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down AEGIS Backend...")
    
    await close_db()
    Neo4jConnection.close()
    await RedisConnection.close()
    
    logger.info("AEGIS Backend shutdown complete")


# Create FastAPI application
app = FastAPI(
    title="AEGIS API",
    description="""
    **Anticipatory Engine for Geolocated Intervention against Scams**
    
    AEGIS is an AI-powered predictive analytics framework for cybercrime complaints
    that forecasts likely cash withdrawal locations, enabling proactive intervention.
    
    ## Features
    
    * **Real-time Fraud Detection** - Instant analysis of NCRP complaints
    * **Location Prediction** - AI-powered ATM withdrawal prediction
    * **Mule Network Detection** - Graph-based fraud network analysis
    * **Automated Actions** - NPCI-integrated account freezing
    * **Team Coordination** - Real-time LEA team deployment
    
    ## Technical Stack
    
    * FastAPI (Python 3.10+)
    * PostgreSQL with PostGIS
    * Neo4j Graph Database
    * PyTorch + River ML
    
    ---
    
    **Team Epic Electrons | Smart India Hackathon 2025**
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.debug else ["https://aegis-shield.in"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix=settings.api_v1_prefix)


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "app": settings.app_name,
        "version": "1.0.0",
        "environment": settings.app_env
    }


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with API information"""
    return {
        "app": "AEGIS API",
        "description": "Anticipatory Engine for Geolocated Intervention against Scams",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }

