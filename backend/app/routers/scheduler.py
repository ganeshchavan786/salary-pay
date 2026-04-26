from fastapi import APIRouter, Depends, HTTPException, status
from typing import Any, Dict, List

from app.models.user import User
from app.utils.deps import get_current_user
from app.utils.scheduler import salary_scheduler

router = APIRouter(tags=["Scheduler"])


@router.get("/jobs", response_model=List[Dict[str, Any]])
async def list_jobs(
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """List all scheduled jobs and their current status."""
    return salary_scheduler.get_job_status()


@router.post("/jobs/{job_name}/trigger", response_model=Dict[str, Any])
async def trigger_job(
    job_name: str,
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Manually trigger a scheduled job by name."""
    result = await salary_scheduler.run_job(job_name)
    if not result.get("success", True) and "error" in result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result["error"],
        )
    return result
