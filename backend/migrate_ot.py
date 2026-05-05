import asyncio
from sqlalchemy import text
from app.database import engine

async def migrate():
    print("Starting database migration (Adding ot_hours column)...")
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE attendance_daily ADD COLUMN ot_hours FLOAT DEFAULT 0.0"))
            print("Added column: ot_hours")
        except Exception as e:
            if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                print("Column ot_hours already exists.")
            else:
                print(f"Error adding ot_hours: {e}")
    
    print("Migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(migrate())
