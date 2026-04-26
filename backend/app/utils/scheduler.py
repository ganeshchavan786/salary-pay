import asyncio
import logging
from datetime import datetime
from typing import Dict, List

logger = logging.getLogger(__name__)


class SalaryScheduler:
    """Basic scheduler for salary-related cron jobs"""

    JOBS = {
        "attendance_sync": {
            "schedule": "every 30 minutes",
            "description": "Sync attendance data from biometric devices",
            "last_run": None,
            "status": "idle",
        },
        "late_alert": {
            "schedule": "daily 10:00 AM",
            "description": "Check yesterday late marks and send alerts",
            "last_run": None,
            "status": "idle",
        },
        "ot_alert": {
            "schedule": "daily 8:00 PM",
            "description": "Check OT > threshold and send alerts",
            "last_run": None,
            "status": "idle",
        },
        "daily_backup": {
            "schedule": "daily 2:00 AM",
            "description": "Database backup",
            "last_run": None,
            "status": "idle",
        },
    }

    async def run_job(self, job_name: str) -> Dict:
        """Manually trigger a job"""
        if job_name not in self.JOBS:
            return {"success": False, "error": f"Job '{job_name}' not found"}

        job = self.JOBS[job_name]
        job["status"] = "running"
        job["last_run"] = datetime.utcnow().isoformat()

        logger.info(f"[SCHEDULER] Running job: {job_name}")

        # Simulate job execution
        await asyncio.sleep(0)  # Non-blocking

        job["status"] = "completed"

        return {
            "job_name": job_name,
            "status": "completed",
            "executed_at": job["last_run"],
            "description": job["description"],
        }

    def get_job_status(self) -> List[Dict]:
        """Get status of all jobs"""
        return [
            {
                "job_name": name,
                "schedule": job["schedule"],
                "description": job["description"],
                "last_run": job["last_run"],
                "status": job["status"],
            }
            for name, job in self.JOBS.items()
        ]


salary_scheduler = SalaryScheduler()
