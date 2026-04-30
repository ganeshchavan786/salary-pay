import asyncio
import sys
import os
from sqlalchemy import text

# Add backend to path
sys.path.append(os.getcwd())

from app.database import AsyncSessionLocal

async def migrate():
    print("Starting database migration (Adding new columns)...")
    async with AsyncSessionLocal() as db:
        try:
            # Add total_working_hours
            await db.execute(text("ALTER TABLE attendance_daily ADD COLUMN total_working_hours FLOAT DEFAULT 0.0"))
            print("Added column: total_working_hours")
        except Exception as e:
            print(f"Column total_working_hours might already exist: {e}")
            
        try:
            # Add is_incomplete
            await db.execute(text("ALTER TABLE attendance_daily ADD COLUMN is_incomplete BOOLEAN DEFAULT FALSE"))
            print("Added column: is_incomplete")
        except Exception as e:
            print(f"Column is_incomplete might already exist: {e}")
            
        await db.commit()
    print("Migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(migrate())
