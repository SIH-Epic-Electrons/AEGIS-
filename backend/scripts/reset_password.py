"""Reset officer password to a known value"""
import asyncio
from passlib.context import CryptContext
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')

async def update_password():
    engine = create_async_engine('postgresql+asyncpg://aegis_user:aegis_password@localhost:5432/aegis_db')
    new_hash = pwd_context.hash('password123')
    print(f'Setting password to: password123')
    print(f'Hash: {new_hash}')
    async with engine.begin() as conn:
        await conn.execute(
            text("UPDATE officers SET password_hash = :hash WHERE badge_id = :badge"),
            {"hash": new_hash, "badge": "MH-CYB-2024-001"}
        )
        print('Password updated for MH-CYB-2024-001')
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(update_password())

