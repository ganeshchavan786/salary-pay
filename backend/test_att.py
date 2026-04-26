import asyncio
from app.database import AsyncSessionLocal
from app.services.attendance_service import get_employee_attendance_summary
from datetime import date

async def test():
    async with AsyncSessionLocal() as db:
        # Pass emp id of Ramesh or Ganesh
        res = await get_employee_attendance_summary(db, "EMP001", date(2026, 4, 1), date(2026, 4, 30))
        print("RESULT:", res)

if __name__ == "__main__":
    asyncio.run(test())
