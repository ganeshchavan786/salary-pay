import asyncio
import sys
import os
from datetime import datetime

# Add backend to path
sys.path.append(os.getcwd())

from app.database import AsyncSessionLocal
from app.models.attendance_daily import AttendanceDaily
from sqlalchemy import select

async def calculate_old_hours():
    print("Calculating hours for old records...")
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(AttendanceDaily))
        records = result.scalars().all()
        
        updated_count = 0
        for r in records:
            if r.check_in and r.check_out:
                # Calculate duration in seconds
                diff = (r.check_out - r.check_in).total_seconds()
                if diff > 0:
                    r.total_working_hours = round(diff / 3600, 2)
                    updated_count += 1
        
        await db.commit()
        print(f"Successfully updated {updated_count} old records with working hours!")

if __name__ == "__main__":
    asyncio.run(calculate_old_hours())
