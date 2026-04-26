from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models.payroll_period import PayrollPeriod, PayrollPeriodState
from app.models.user import User
from app.schemas.payroll_period import (
    PayrollPeriodCreate,
    PayrollPeriodResponse,
    StateTransitionRequest,
)
from app.utils.deps import get_current_user

router = APIRouter(tags=["Payroll Periods"])

# Allowed state transitions
ALLOWED_TRANSITIONS = {
    PayrollPeriodState.DRAFT: {PayrollPeriodState.OPEN},
    PayrollPeriodState.OPEN: {PayrollPeriodState.PROCESSING},
    PayrollPeriodState.PROCESSING: {PayrollPeriodState.PROCESSED},
    PayrollPeriodState.PROCESSED: {PayrollPeriodState.LOCKED},
    PayrollPeriodState.LOCKED: set(),  # No transitions allowed from LOCKED
}


def _validate_transition(current: PayrollPeriodState, new: PayrollPeriodState) -> None:
    """Raise 400 if the transition is not allowed."""
    if current == PayrollPeriodState.LOCKED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="LOCKED period cannot be modified.",
        )
    allowed = ALLOWED_TRANSITIONS.get(current, set())
    if new not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Transition from {current.value} to {new.value} is not allowed. "
                f"Allowed: {[s.value for s in allowed]}"
            ),
        )


@router.post("/", response_model=PayrollPeriodResponse, status_code=status.HTTP_201_CREATED)
async def create_payroll_period(
    payload: PayrollPeriodCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new payroll period. Validates no overlap with existing periods."""
    if payload.end_date <= payload.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date must be after start_date.",
        )

    # Overlap check: existing period overlaps if its start < new end AND its end > new start
    overlap_query = select(PayrollPeriod).where(
        and_(
            PayrollPeriod.start_date < payload.end_date,
            PayrollPeriod.end_date > payload.start_date,
        )
    )
    result = await db.execute(overlap_query)
    overlapping = result.scalar_one_or_none()
    if overlapping:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Period overlaps with existing period '{overlapping.period_name}' "
                f"({overlapping.start_date.date()} – {overlapping.end_date.date()})."
            ),
        )

    period = PayrollPeriod(
        period_name=payload.period_name,
        period_type=payload.period_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        state=PayrollPeriodState.DRAFT,
        created_by=current_user.id,
    )
    db.add(period)
    await db.commit()
    await db.refresh(period)
    return PayrollPeriodResponse.model_validate(period)


@router.get("/", response_model=List[PayrollPeriodResponse])
async def list_payroll_periods(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all payroll periods with pagination."""
    result = await db.execute(
        select(PayrollPeriod)
        .order_by(PayrollPeriod.start_date.desc())
        .offset(skip)
        .limit(limit)
    )
    periods = result.scalars().all()
    return [PayrollPeriodResponse.model_validate(p) for p in periods]


@router.get("/{period_id}", response_model=PayrollPeriodResponse)
async def get_payroll_period(
    period_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single payroll period by ID."""
    result = await db.execute(
        select(PayrollPeriod).where(PayrollPeriod.id == period_id)
    )
    period = result.scalar_one_or_none()
    if not period:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payroll period not found.")
    return PayrollPeriodResponse.model_validate(period)


@router.patch("/{period_id}/state", response_model=PayrollPeriodResponse)
async def transition_state(
    period_id: str,
    payload: StateTransitionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Transition a payroll period to a new state."""
    result = await db.execute(
        select(PayrollPeriod).where(PayrollPeriod.id == period_id)
    )
    period = result.scalar_one_or_none()
    if not period:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payroll period not found.")

    _validate_transition(period.state, payload.new_state)

    period.state = payload.new_state
    period.updated_at = datetime.utcnow()

    # Set timestamps for specific transitions
    if payload.new_state == PayrollPeriodState.PROCESSING:
        period.processing_started_at = datetime.utcnow()
    elif payload.new_state == PayrollPeriodState.PROCESSED:
        period.processing_completed_at = datetime.utcnow()
    elif payload.new_state == PayrollPeriodState.LOCKED:
        period.locked_at = datetime.utcnow()
        period.locked_by = current_user.id

    await db.commit()
    await db.refresh(period)
    return PayrollPeriodResponse.model_validate(period)


@router.patch("/{period_id}/lock", response_model=PayrollPeriodResponse)
async def lock_period(
    period_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lock a payroll period. Only PROCESSED → LOCKED is allowed."""
    result = await db.execute(
        select(PayrollPeriod).where(PayrollPeriod.id == period_id)
    )
    period = result.scalar_one_or_none()
    if not period:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payroll period not found.")

    if period.state != PayrollPeriodState.PROCESSED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only PROCESSED periods can be locked. Current state: {period.state.value}",
        )

    period.state = PayrollPeriodState.LOCKED
    period.locked_at = datetime.utcnow()
    period.locked_by = current_user.id
    period.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(period)
    return PayrollPeriodResponse.model_validate(period)
