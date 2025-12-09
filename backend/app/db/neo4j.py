"""
Neo4j Database Connection
For graph-based mule network analysis
"""

from typing import Optional, Any, Dict, List
from contextlib import contextmanager
import logging

from neo4j import GraphDatabase, Driver, Session
from neo4j.exceptions import ServiceUnavailable, AuthError

from app.core.config import settings

logger = logging.getLogger(__name__)


class Neo4jConnection:
    """
    Neo4j database connection manager.
    Handles connection pooling and session management.
    """
    
    _driver: Optional[Driver] = None
    
    @classmethod
    def get_driver(cls) -> Driver:
        """Get or create Neo4j driver instance"""
        if cls._driver is None:
            try:
                cls._driver = GraphDatabase.driver(
                    settings.neo4j_uri,
                    auth=(settings.neo4j_user, settings.neo4j_password),
                    max_connection_lifetime=3600,
                    max_connection_pool_size=50,
                    connection_acquisition_timeout=60
                )
                # Verify connectivity
                cls._driver.verify_connectivity()
                logger.info("Neo4j connection established successfully")
            except AuthError as e:
                logger.error(f"Neo4j authentication failed: {e}")
                raise
            except ServiceUnavailable as e:
                logger.error(f"Neo4j service unavailable: {e}")
                raise
        return cls._driver
    
    @classmethod
    def close(cls) -> None:
        """Close the driver connection"""
        if cls._driver is not None:
            cls._driver.close()
            cls._driver = None
            logger.info("Neo4j connection closed")
    
    @classmethod
    @contextmanager
    def get_session(cls, database: str = "neo4j"):
        """
        Context manager for Neo4j session.
        
        Usage:
            with Neo4jConnection.get_session() as session:
                result = session.run("MATCH (n) RETURN n")
        """
        driver = cls.get_driver()
        session = driver.session(database=database)
        try:
            yield session
        finally:
            session.close()
    
    @classmethod
    def execute_query(
        cls,
        query: str,
        parameters: Optional[Dict[str, Any]] = None,
        database: str = "neo4j"
    ) -> List[Dict[str, Any]]:
        """
        Execute a Cypher query and return results.
        
        Args:
            query: Cypher query string
            parameters: Query parameters
            database: Database name
        
        Returns:
            List of result records as dictionaries
        """
        with cls.get_session(database) as session:
            result = session.run(query, parameters or {})
            return [record.data() for record in result]
    
    @classmethod
    def execute_write(
        cls,
        query: str,
        parameters: Optional[Dict[str, Any]] = None,
        database: str = "neo4j"
    ) -> None:
        """Execute a write query (CREATE, MERGE, DELETE)"""
        with cls.get_session(database) as session:
            session.execute_write(
                lambda tx: tx.run(query, parameters or {})
            )


def get_neo4j_driver() -> Driver:
    """Dependency to get Neo4j driver"""
    return Neo4jConnection.get_driver()


# Neo4j initialization queries
INIT_CONSTRAINTS = [
    # Unique constraints
    "CREATE CONSTRAINT account_unique IF NOT EXISTS FOR (a:Account) REQUIRE a.account_id IS UNIQUE",
    "CREATE CONSTRAINT case_unique IF NOT EXISTS FOR (c:Case) REQUIRE c.case_id IS UNIQUE",
    "CREATE CONSTRAINT atm_unique IF NOT EXISTS FOR (atm:ATM) REQUIRE atm.atm_id IS UNIQUE",
    
    # Indexes for performance
    "CREATE INDEX account_number_idx IF NOT EXISTS FOR (a:Account) ON (a.account_number)",
    "CREATE INDEX case_number_idx IF NOT EXISTS FOR (c:Case) ON (c.case_number)",
    "CREATE INDEX atm_bank_idx IF NOT EXISTS FOR (atm:ATM) ON (atm.bank)",
]


async def init_neo4j() -> None:
    """Initialize Neo4j database with constraints and indexes"""
    try:
        for query in INIT_CONSTRAINTS:
            Neo4jConnection.execute_write(query)
        logger.info("Neo4j constraints and indexes created successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Neo4j: {e}")
        raise

