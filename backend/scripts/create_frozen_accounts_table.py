"""
Script to create frozen_accounts table
Run this script to add support for transaction blocking
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


async def create_frozen_accounts_table():
    """Create frozen_accounts table for transaction blocking"""
    try:
        # Show connection attempt (without password)
        safe_url = DATABASE_URL.split("@")[-1] if "@" in DATABASE_URL else DATABASE_URL
        print(f"Attempting to connect to: postgresql://***@{safe_url}")
        
        # Parse connection string
        conn = await asyncpg.connect(DATABASE_URL)
        print("✓ Connected to database successfully")
        
        print("Creating frozen_accounts table...")
        
        # Create frozen_accounts table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS frozen_accounts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                account_number VARCHAR(50) NOT NULL,
                bank_name VARCHAR(100),
                case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
                freeze_request_id UUID REFERENCES freeze_requests(id) ON DELETE SET NULL,
                frozen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                frozen_by UUID REFERENCES officers(id),
                case_created_at TIMESTAMP WITH TIME ZONE,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                
                -- Indexes
                CONSTRAINT uq_frozen_account_case_active UNIQUE (account_number, case_id, is_active)
            );
        """)
        
        # Create indexes
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_frozen_accounts_account_number 
            ON frozen_accounts(account_number) WHERE is_active = TRUE;
        """)
        
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_frozen_accounts_case_id 
            ON frozen_accounts(case_id);
        """)
        
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_frozen_accounts_freeze_request_id 
            ON frozen_accounts(freeze_request_id);
        """)
        
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_frozen_accounts_bank_name 
            ON frozen_accounts(bank_name) WHERE is_active = TRUE;
        """)
        
        print("✓ Created frozen_accounts table with indexes")
        
        # Verify table exists
        table_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'frozen_accounts'
            );
        """)
        
        if table_exists:
            print("\n✓ Migration successful! frozen_accounts table created")
        else:
            print("\n⚠ Warning: Table creation may have failed")
        
        await conn.close()
        print("\n✓ Database migration completed successfully!")
        
    except asyncpg.exceptions.UndefinedTableError as e:
        print(f"✗ Error: Table not found: {e}")
        print("   Please ensure the database schema is initialized first.")
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
    print("AEGIS Database Migration: Create Frozen Accounts Table")
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
    
    asyncio.run(create_frozen_accounts_table())

