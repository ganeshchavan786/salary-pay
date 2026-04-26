import uuid
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.database import get_db
from app.models.statutory_rate_config import StatutoryRateConfig
from app.models.salary_audit_log import SalaryAuditLog
from app.models.user import User
from app.schemas.statutory_rate_config import StatutoryRateConfigCreate, StatutoryRateConfigResponse
from app.utils.deps import get_current_user

router = APIRouter(tags=["Statutory Rates"])


@router.get("/", response_model=List[StatutoryRateConfigResponse])
async def get_active_statutory_rates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all currently active statutory rate configs."""
    result = await db.execute(
        select(StatutoryRateConfig).where(StatutoryRateConfig.is_active == True)
    )
    return result.scalars().all()


@router.post("/", response_model=StatutoryRateConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_statutory_rate(
    payload: StatutoryRateConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new statutory rate config.
    Deactivates any existing active record for the same deduction_type.
    Writes an audit log entry.
    """
    # Fetch existing active record for this type (for audit)
    existing_result = await db.execute(
        select(StatutoryRateConfig).where(
            StatutoryRateConfig.deduction_type == payload.deduction_type,
            StatutoryRateConfig.is_active == True,
        )
    )
    existing = existing_result.scalar_one_or_none()
    old_values = None

    if existing:
        old_values = {
            "id": existing.id,
            "deduction_type": existing.deduction_type.value,
            "rate_type": existing.rate_type.value,
            "rate_value": str(existing.rate_value) if existing.rate_value is not None else None,
            "slab_definition": existing.slab_definition,
            "effective_from": str(existing.effective_from),
        }
        # Deactivate old record
        await db.execute(
            update(StatutoryRateConfig)
            .where(
                StatutoryRateConfig.deduction_type == payload.deduction_type,
                StatutoryRateConfig.is_active == True,
            )
            .values(is_active=False)
        )

    # Create new record
    new_record = StatutoryRateConfig(
        id=str(uuid.uuid4()),
        deduction_type=payload.deduction_type,
        rate_type=payload.rate_type,
        rate_value=payload.rate_value,
        slab_definition=payload.slab_definition,
        effective_from=payload.effective_from,
        is_active=True,
        created_by=current_user.id,
        created_at=datetime.utcnow(),
    )
    db.add(new_record)

    new_values = {
        "deduction_type": payload.deduction_type.value,
        "rate_type": payload.rate_type.value,
        "rate_value": str(payload.rate_value) if payload.rate_value is not None else None,
        "slab_definition": payload.slab_definition,
        "effective_from": str(payload.effective_from),
    }

    # Write audit log
    audit = SalaryAuditLog(
        id=str(uuid.uuid4()),
        entity_type="STATUTORY_RATE",
        entity_id=new_record.id,
        operation="update" if old_values else "create",
        old_values=old_values,
        new_values=new_values,
        changed_fields=list(new_values.keys()),
        user_id=current_user.id,
        timestamp=datetime.utcnow(),
    )
    db.add(audit)

    await db.commit()
    await db.refresh(new_record)
    return new_record
