import asyncio
from app.database import AsyncSessionLocal
from app.services.attendance_service import get_employee_attendance_summary
from datetime import date

async def run_test():
    async with AsyncSessionLocal() as db:
        res = await get_employee_attendance_summary(db, "EMP001", date(2026, 4, 1), date(2026, 4, 30))
        print(res)

if __name__ == "__main__":
    asyncio.run(run_test())
