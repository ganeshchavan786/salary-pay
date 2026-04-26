from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, date
from decimal import Decimal

from app.database import get_db
from app.models.arrear import Arrear
from app.models.employee import Employee
from app.models.payroll_period import PayrollPeriod
from app.models.user import User
from app.utils.deps import get_current_user

router = APIRouter(tags=["Arrears"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class ArrearCreate(BaseModel):
    employee_id: str
    period_id: str
    effective_from: datetime = Field(..., description="Date from which the new salary is effective")
    old_basic: Decimal = Field(..., gt=0)
    new_basic: Decimal = Field(..., gt=0)
    description: Optional[str] = None


class ArrearResponse(BaseModel):
    id: str
    employee_id: str
    period_id: str
    effective_from: datetime
    old_basic: Decimal
    new_basic: Decimal
    arrear_months: int
    arrear_amount: Decimal
    tax_impact: Decimal
    description: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_employee_or_404(employee_id: str, db: AsyncSession) -> Employee:
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found.")
    return employee


async def _get_period_or_404(period_id: str, db: AsyncSession) -> PayrollPeriod:
    result = await db.execute(select(PayrollPeriod).where(PayrollPeriod.id == period_id))
    period = result.scalar_one_or_none()
    if not period:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payroll period not found.")
    return period


def _calculate_arrear_months(effective_from: datetime, period_start_date: datetime) -> int:
    """Calculate number of months between effective_from and period start_date."""
    from dateutil.relativedelta import relativedelta

    eff = effective_from.date() if isinstance(effective_from, datetime) else effective_from
    psd = period_start_date.date() if isinstance(period_start_date, datetime) else period_start_date

    if psd <= eff:
        return 0

    delta = relativedelta(psd, eff)
    months = delta.years * 12 + delta.months
    return max(0, months)


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/", response_model=ArrearResponse, status_code=status.HTTP_201_CREATED)
async def create_arrear(
    payload: ArrearCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create an arrear record.
    Calculates arrear_months = months between effective_from and period start_date.
    Calculates arrear_amount = (new_basic - old_basic) × arrear_months.
    Calculates tax_impact = arrear_amount × 0.30 (30% estimate).
    """
    await _get_employee_or_404(payload.employee_id, db)
    period = await _get_period_or_404(payload.period_id, db)

    if payload.new_basic <= payload.old_basic:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="new_basic must be greater than old_basic for an arrear.",
        )

    arrear_months = _calculate_arrear_months(payload.effective_from, period.start_date)
    if arrear_months <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="effective_from must be before the period start_date to generate arrears.",
        )

    salary_diff = payload.new_basic - payload.old_basic
    arrear_amount = (salary_diff * Decimal(str(arrear_months))).quantize(Decimal("0.01"))
    tax_impact = (arrear_amount * Decimal("0.30")).quantize(Decimal("0.01"))

    arrear = Arrear(
        employee_id=payload.employee_id,
        period_id=payload.period_id,
        effective_from=payload.effective_from,
        old_basic=payload.old_basic,
        new_basic=payload.new_basic,
        arrear_months=arrear_months,
        arrear_amount=arrear_amount,
        tax_impact=tax_impact,
        description=payload.description,
        created_by=current_user.id,
    )
    db.add(arrear)
    await db.commit()
    await db.refresh(arrear)

    return ArrearResponse.model_validate(arrear)


@router.get("/employee/{employee_id}", response_model=List[ArrearResponse])
async def get_employee_arrears(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all arrears for an employee."""
    await _get_employee_or_404(employee_id, db)

    result = await db.execute(
        select(Arrear)
        .where(Arrear.employee_id == employee_id)
        .order_by(Arrear.created_at.desc())
    )
    arrears = result.scalars().all()

    return [ArrearResponse.model_validate(a) for a in arrears]
