"""
Quick migration script to add missing columns to the cases table
"""
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Database URL from config
DATABASE_URL = "postgresql+asyncpg://aegis_user:aegis_password@localhost:5432/aegis_db"

async def add_missing_columns():
    engine = create_async_engine(DATABASE_URL, echo=True)
    
    async with engine.begin() as conn:
        # Add actual_location column
        try:
            await conn.execute(text(
                "ALTER TABLE cases ADD COLUMN IF NOT EXISTS actual_location VARCHAR(255)"
            ))
            print("✓ Added actual_location column")
        except Exception as e:
            print(f"actual_location: {e}")
        
        # Add location_prediction_correct column
        try:
            await conn.execute(text(
                "ALTER TABLE cases ADD COLUMN IF NOT EXISTS location_prediction_correct INTEGER"
            ))
            print("✓ Added location_prediction_correct column")
        except Exception as e:
            print(f"location_prediction_correct: {e}")
    
    await engine.dispose()
    print("\n✅ Database migration complete!")

if __name__ == "__main__":
    asyncio.run(add_missing_columns())

