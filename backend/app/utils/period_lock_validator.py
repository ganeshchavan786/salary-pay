"""
Period Lock Validator Utility

Shared utility functions for checking if a date falls within a LOCKED payroll period
and raising appropriate HTTP exceptions.

This module implements the validation layer to prevent attendance modifications
for dates within LOCKED payroll periods, ensuring salary calculation integrity.
"""

from datetime import date, datetime
from typing import Optional
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.models.payroll_period import PayrollPeriod, PayrollPeriodState


async def check_date_in_locked_period(
    db: AsyncSession, target_date: date
) -> Optional[PayrollPeriod]:
    """
    Check if a date falls within a LOCKED payroll period.

    Args:
        db: Async database session
        target_date: The date to check

    Returns:
        PayrollPeriod if the date falls within a LOCKED period, None otherwise

    Query Logic:
        SELECT * FROM payroll_periods
        WHERE DATE(start_date) <= target_date
          AND DATE(end_date) >= target_date
          AND state = 'LOCKED'
    
    Note: PayrollPeriod.start_date and end_date are DateTime columns,
    so we extract the date part for comparison.
    """
    result = await db.execute(
        select(PayrollPeriod).where(
            and_(
                func.date(PayrollPeriod.start_date) <= target_date,
                func.date(PayrollPeriod.end_date) >= target_date,
                PayrollPeriod.state == PayrollPeriodState.LOCKED,
            )
        )
    )
    locked_period = result.scalar_one_or_none()
    return locked_period


def raise_locked_period_error(period: PayrollPeriod) -> None:
    """
    Raise HTTP 403 exception with period name in error message.

    Args:
        period: The LOCKED PayrollPeriod that prevents the modification

    Raises:
        HTTPException: HTTP 403 with error message containing period name

    Error Message Format:
        "Cannot modify attendance for a LOCKED payroll period ({period_name})"
    """
    raise HTTPException(
        status_code=403,
        detail=f"Cannot modify attendance for a LOCKED payroll period ({period.period_name})",
    )
