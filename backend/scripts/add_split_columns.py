"""
Script to add split tracking columns to transactions table
Run this script to update the database schema for money splitting support
"""

import asyncio
import asyncpg
import os
from pathlib import Path

# Database connection string - update this to match your database
# You can also set it via environment variable DATABASE_URL
DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "postgresql://aegis_user:aegis_password@localhost:5432/aegis_db"
    )


async def add_split_columns():
    """Add split tracking columns to transactions table"""
    try:
        # Parse connection string
        # Format: postgresql://user:password@host:port/database
        conn = await asyncpg.connect(DATABASE_URL)
        
        print("Adding split tracking columns to transactions table...")
        
        # Add columns
        await conn.execute("""
            ALTER TABLE transactions 
            ADD COLUMN IF NOT EXISTS split_group_id VARCHAR(50),
            ADD COLUMN IF NOT EXISTS split_index INTEGER,
            ADD COLUMN IF NOT EXISTS split_total INTEGER;
        """)
        
        print("✓ Added split_group_id, split_index, and split_total columns")
        
        # Create index
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_transactions_split_group 
            ON transactions(split_group_id);
        """)
        
        print("✓ Created index on split_group_id")
        
        # Verify columns exist
        columns = await conn.fetch("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'transactions' 
            AND column_name IN ('split_group_id', 'split_index', 'split_total')
            ORDER BY column_name;
        """)
        
        if len(columns) == 3:
            print("\n✓ Migration successful! All columns added:")
            for col in columns:
                print(f"  - {col['column_name']}: {col['data_type']}")
        else:
            print(f"\n⚠ Warning: Expected 3 columns, found {len(columns)}")
            for col in columns:
                print(f"  - {col['column_name']}: {col['data_type']}")
        
        await conn.close()
        print("\n✓ Database migration completed successfully!")
        
    except asyncpg.exceptions.UndefinedTableError:
        print("✗ Error: 'transactions' table does not exist. Please create the table first.")
    except asyncpg.exceptions.InvalidPasswordError:
        print("✗ Error: Invalid database credentials. Please check DATABASE_URL.")
    except asyncpg.exceptions.ConnectionDoesNotExistError:
        print("✗ Error: Could not connect to database. Please check DATABASE_URL and ensure database is running.")
    except Exception as e:
        print(f"✗ Error: {e}")
        raise


if __name__ == "__main__":
    print("=" * 60)
    print("AEGIS Database Migration: Add Split Columns to Transactions")
    print("=" * 60)
    print()
    
    # Check if DATABASE_URL is set
    if not DATABASE_URL or DATABASE_URL == "postgresql://postgres:postgres@localhost:5432/aegis_db":
        print("⚠ Warning: Using default DATABASE_URL.")
        print("   Set DATABASE_URL environment variable to use a different database.")
        print()
    
    asyncio.run(add_split_columns())

