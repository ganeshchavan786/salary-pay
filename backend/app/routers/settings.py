from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.policy import PolicyRead, PolicyUpdate
from app.services import policy_service
from app.utils.deps import require_supervisor, require_admin

router = APIRouter(tags=["Settings"])


@router.get("/policy", response_model=PolicyRead)
async def get_policy(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Get the current attendance policy."""
    policy = await policy_service.get_policy(db)
    return policy


@router.put("/policy", response_model=PolicyRead)
async def update_policy(
    body: PolicyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Update the attendance policy (admin only)."""
    updates = body.model_dump(exclude_none=True)
    policy = await policy_service.update_policy(db, updates)
    return policy
