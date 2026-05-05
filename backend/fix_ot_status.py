import asyncio
from sqlalchemy import text
from app.database import engine

async def fix():
    async with engine.begin() as conn:
        # Add ot_status column
        try:
            await conn.execute(text("ALTER TABLE attendance_daily ADD COLUMN ot_status VARCHAR(20) DEFAULT 'NONE'"))
            print("SUCCESS: ot_status column added!")
        except Exception as e:
            print(f"INFO: ot_status - {e}")

        # Also fix ot_hours just in case
        try:
            await conn.execute(text("ALTER TABLE attendance_daily ADD COLUMN ot_hours FLOAT DEFAULT 0.0"))
            print("SUCCESS: ot_hours column added!")
        except Exception as e:
            print(f"INFO: ot_hours - {e}")

    print("\nDone! Now restart your backend server.")

asyncio.run(fix())
