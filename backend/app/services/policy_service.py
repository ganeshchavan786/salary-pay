from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.policy import AttendancePolicy


async def get_policy(db: AsyncSession) -> AttendancePolicy:
    """
    Fetch the single policy record. If absent, seed defaults first.
    """
    result = await db.execute(select(AttendancePolicy))
    policy = result.scalar_one_or_none()
    if policy is None:
        await seed_default_policy(db)
        result = await db.execute(select(AttendancePolicy))
        policy = result.scalar_one()
    return policy


async def seed_default_policy(db: AsyncSession) -> None:
    """
    Create the default policy record if the table is empty.
    Uses all documented defaults from Requirement 1.2.
    """
    result = await db.execute(select(AttendancePolicy))
    existing = result.scalar_one_or_none()
    if existing is not None:
        return  # Already seeded

    default_policy = AttendancePolicy()  # All defaults come from Column(default=...)
    db.add(default_policy)
    await db.commit()
    print("Default attendance policy seeded")


async def update_policy(db: AsyncSession, updates: dict) -> AttendancePolicy:
    """
    Apply partial updates to the policy record.
    `updates` dict should already be exclude_none'd.
    """
    policy = await get_policy(db)
    for key, value in updates.items():
        if hasattr(policy, key):
            setattr(policy, key, value)
    policy.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(policy)
    return policy
