import asyncio
import logging
from datetime import datetime, date, timedelta
from sqlalchemy import select, and_
from app.database import AsyncSessionLocal
from app.models.attendance_daily import AttendanceDaily, AttendanceStatus
from app.models.attendance import Attendance, AttendanceType

logger = logging.getLogger(__name__)

async def auto_cleanup_missing_punches():
    """
    Finds all incomplete attendance records for yesterday and marks them as incomplete.
    Runs at midnight.
    """
    yesterday = date.today() - timedelta(days=1)
    logger.info(f"Running auto-cleanup for {yesterday}")
    
    async with AsyncSessionLocal() as db:
        try:
            # Find daily records for yesterday that have check_in but no check_out
            query = select(AttendanceDaily).where(
                and_(
                    AttendanceDaily.date == yesterday,
                    AttendanceDaily.check_in.isnot(None),
                    AttendanceDaily.check_out.is_none()
                )
            )
            result = await db.execute(query)
            incomplete_records = result.scalars().all()
            
            updated_count = 0
            for record in incomplete_records:
                record.is_incomplete = True
                record.updated_at = datetime.utcnow()
                updated_count += 1
            
            await db.commit()
            logger.info(f"Auto-cleanup completed: Marked {updated_count} records as incomplete.")
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Error during auto-cleanup: {e}")

if __name__ == "__main__":
    # For manual testing
    asyncio.run(auto_cleanup_missing_punches())
