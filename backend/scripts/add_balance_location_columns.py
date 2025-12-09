"""
Script to add balance and location columns to transactions table
Run this script to update the database schema for balance tracking and location data
"""

import asyncio
import asyncpg
import os
import sys
from pathlib import Path

# Add backend to path to import settings
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

try:
    from app.core.config import settings
    
    # Use settings from backend configuration
    DATABASE_URL = settings.database_url_sync  # Use sync URL for asyncpg
    print(f"Using database: {settings.postgres_host}:{settings.postgres_port}/{settings.postgres_db}")
except ImportError:
    # Fallback to environment variable or default
    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "postgresql://aegis_user:aegis_password@localhost:5432/aegis_db"
    )
    print("⚠ Using default/ENV DATABASE_URL (backend config not available)")


async def add_balance_location_columns():
    """Add balance and location tracking columns to transactions table"""
    try:
        # Show connection attempt (without password)
        safe_url = DATABASE_URL.split("@")[-1] if "@" in DATABASE_URL else DATABASE_URL
        print(f"Attempting to connect to: postgresql://***@{safe_url}")
        
        # Parse connection string
        conn = await asyncpg.connect(DATABASE_URL)
        print("✓ Connected to database successfully")
        
        print("Adding balance and location columns to transactions table...")
        
        # Add balance columns
        await conn.execute("""
            ALTER TABLE transactions 
            ADD COLUMN IF NOT EXISTS from_balance_before DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS from_balance_after DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS to_balance_before DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS to_balance_after DOUBLE PRECISION;
        """)
        
        print("✓ Added balance columns (from_balance_before, from_balance_after, to_balance_before, to_balance_after)")
        
        # Add location columns (JSONB for location data)
        await conn.execute("""
            ALTER TABLE transactions 
            ADD COLUMN IF NOT EXISTS from_location JSONB,
            ADD COLUMN IF NOT EXISTS to_location JSONB;
        """)
        
        print("✓ Added location columns (from_location, to_location)")
        
        # Verify columns exist
        columns = await conn.fetch("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'transactions' 
            AND column_name IN (
                'from_balance_before', 'from_balance_after', 
                'to_balance_before', 'to_balance_after',
                'from_location', 'to_location'
            )
            ORDER BY column_name;
        """)
        
        if len(columns) == 6:
            print("\n✓ Migration successful! All columns added:")
            for col in columns:
                print(f"  - {col['column_name']}: {col['data_type']}")
        else:
            print(f"\n⚠ Warning: Expected 6 columns, found {len(columns)}")
            for col in columns:
                print(f"  - {col['column_name']}: {col['data_type']}")
        
        await conn.close()
        print("\n✓ Database migration completed successfully!")
        
    except asyncpg.exceptions.UndefinedTableError as e:
        print(f"✗ Error: Table not found: {e}")
        print("   Please ensure the database schema is initialized first.")
        print("   Run: python -m app.db.postgresql (or similar initialization)")
    except asyncpg.exceptions.InvalidPasswordError:
        print("✗ Error: Invalid database credentials.")
        print(f"   Connection string: postgresql://***@{DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else 'unknown'}")
        print("   Please check:")
        print("   1. Database username and password in .env file or environment variables")
        print("   2. Or set DATABASE_URL environment variable directly")
        print("   3. Default config uses: aegis_user / aegis_password")
    except asyncpg.exceptions.ConnectionDoesNotExistError:
        print("✗ Error: Could not connect to database.")
        print("   Please check:")
        print("   1. PostgreSQL is running")
        print("   2. Database host and port are correct")
        print("   3. Database 'aegis_db' exists")
    except Exception as e:
        print(f"✗ Error: {e}")
        print(f"   Connection string used: postgresql://***@{DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else 'unknown'}")
        raise


if __name__ == "__main__":
    print("=" * 60)
    print("AEGIS Database Migration: Add Balance & Location Columns to Transactions")
    print("=" * 60)
    print()
    
    # Show connection info
    try:
        # Parse connection string to show (without password)
        parts = DATABASE_URL.replace("postgresql://", "").split("@")
        if len(parts) == 2:
            user_pass = parts[0].split(":")
            user = user_pass[0]
            host_db = parts[1]
            print(f"Connecting as user: {user}")
            print(f"Connecting to: {host_db}")
            print()
            print("If connection fails, you can:")
            print("  1. Create backend/.env file with POSTGRES_USER and POSTGRES_PASSWORD")
            print("  2. Or set DATABASE_URL environment variable:")
            print("     $env:DATABASE_URL='postgresql://user:password@host:port/database'")
            print()
    except:
        pass
    
    asyncio.run(add_balance_location_columns())

