import asyncio
from sqlalchemy import text
from app.database import engine

async def fix():
    async with engine.begin() as conn:
        # Add source column to attendance table
        try:
            await conn.execute(text("ALTER TABLE attendance ADD COLUMN source VARCHAR(20) DEFAULT 'APP'"))
            print("SUCCESS: source column added to attendance!")
        except Exception as e:
            print(f"INFO: source - {e}")

        # Update old face-recognition records (no GPS = FACE kiosk)
        try:
            await conn.execute(text("""
                UPDATE attendance 
                SET source = 'FACE' 
                WHERE (latitude IS NULL OR latitude = 0) 
                AND (longitude IS NULL OR longitude = 0)
                AND source = 'APP'
            """))
            print("SUCCESS: Old face records updated to source=FACE")
        except Exception as e:
            print(f"INFO: update face records - {e}")

    print("\nDone! Now restart your backend server.")

asyncio.run(fix())
