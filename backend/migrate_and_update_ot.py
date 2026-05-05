import asyncio
from sqlalchemy import text, select
from app.database import AsyncSessionLocal, engine
from app.models.attendance_daily import AttendanceDaily

async def run_update():
    print("1. Adding 'ot_status' column to database...")
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE attendance_daily ADD COLUMN ot_status VARCHAR(20) DEFAULT 'NONE'"))
            print("   -> Added column: ot_status")
        except Exception as e:
            if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                print("   -> Column ot_status already exists.")
            else:
                print(f"   -> Error adding ot_status: {e}")

    print("\n2. Calculating OT Hours for old records (Assuming 9 Hours Shift)...")
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(AttendanceDaily))
        records = result.scalars().all()
        
        updated_count = 0
        for r in records:
            # Calculate OT if working hours > 9
            if r.total_working_hours and r.total_working_hours > 9.0:
                ot = round(r.total_working_hours - 9.0, 2)
                r.ot_hours = ot
                r.ot_status = "PENDING"  # Set to pending so Admin can review
                updated_count += 1
            else:
                r.ot_hours = 0.0
                r.ot_status = "NONE"
                
        await db.commit()
        print(f"   -> Successfully updated OT for {updated_count} old records.")
        
    print("\nMigration & Update Completed Successfully!")

if __name__ == "__main__":
    asyncio.run(run_update())
