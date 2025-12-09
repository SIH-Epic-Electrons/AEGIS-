"""
Quick script to create an admin user in the database.
Run this if you need admin access without re-seeding the entire database.
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.postgresql import AsyncSessionLocal, init_db
from app.models.officer import Officer
from app.models.station import PoliceStation
from app.core.security import get_password_hash


async def create_admin_user():
    """Create admin user if it doesn't exist"""
    
    async with AsyncSessionLocal() as db:
        # Check if admin already exists
        result = await db.execute(
            select(Officer).where(Officer.badge_id == "admin")
        )
        existing_admin = result.scalar_one_or_none()
        
        if existing_admin:
            print("⚠️  Admin user already exists!")
            print(f"   Badge ID: {existing_admin.badge_id}")
            print(f"   Email: {existing_admin.email}")
            print("\n   To reset password, update it manually in the database.")
            return
        
        # Get first station (needed for foreign key)
        result = await db.execute(select(PoliceStation).limit(1))
        station = result.scalar_one_or_none()
        
        if not station:
            print("❌ No police stations found. Please run seed_data.py first to create stations.")
            return
        
        # Create admin user
        admin = Officer(
            badge_id="admin",
            name="System Administrator",
            email="admin@aegis.gov.in",
            password_hash=get_password_hash("admin123"),
            phone="+91 99999 99999",
            rank="System Admin",
            designation="Administrator",
            station_id=station.id,
            is_active=True,
            is_verified=True,
            settings={"notifications_enabled": True, "dark_mode": False}
        )
        
        db.add(admin)
        await db.commit()
        await db.refresh(admin)
        
        print("✅ Admin user created successfully!")
        print("\n📋 Login credentials:")
        print("   Username: admin")
        print("   Password: admin123")
        print("\n   You can now login at: /api/v1/auth/login")
        print("   Use 'admin' as the username (badge_id) field")


if __name__ == "__main__":
    print("=" * 60)
    print("AEGIS Admin User Creator")
    print("=" * 60)
    
    asyncio.run(create_admin_user())

