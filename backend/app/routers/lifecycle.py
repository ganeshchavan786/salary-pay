from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime
from decimal import Decimal

from app.database import get_db
from app.models.employee import Employee
from app.models.salary_config import SalaryConfig
from app.models.deduction import Deduction, DeductionStatus
from app.models.user import User
from app.utils.deps import get_current_user
from app.utils.lifecycle_handler import lifecycle_handler

router = APIRouter(tags=["Employee Lifecycle"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class ExitRequest(BaseModel):
    exit_date: date
    last_working_day: date
    notice_period_days: int = Field(default=30, ge=0)
    days_served: int = Field(default=0, ge=0)
    pending_leave_days: int = Field(default=0, ge=0)
    bonus: Decimal = Field(default=Decimal("0"), ge=0)
    other_dues: Decimal = Field(default=Decimal("0"), ge=0)
    pending_salary_days: int = Field(default=0, ge=0)


class FNFResponse(BaseModel):
    employee_id: str
    exit_date: date
    years_of_service: Decimal
    pending_salary: Decimal
    leave_encashment: Decimal
    gratuity: Decimal
    bonus: Decimal
    total_earnings: Decimal
    pending_loan_recovery: Decimal
    notice_shortfall_deduction: Decimal
    other_dues: Decimal
    total_deductions: Decimal
    net_payable: Decimal


class GratuityResponse(BaseModel):
    employee_id: str
    joining_date: date
    exit_date: date
    years_of_service: Decimal
    last_basic_salary: Decimal
    gratuity_amount: Decimal
    eligible: bool


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_employee_or_404(employee_id: str, db: AsyncSession) -> Employee:
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found.")
    return employee


async def _get_active_salary_config(employee_id: str, db: AsyncSession) -> Optional[SalaryConfig]:
    result = await db.execute(
        select(SalaryConfig).where(
            and_(SalaryConfig.employee_id == employee_id, SalaryConfig.status == "active")
        ).order_by(SalaryConfig.effective_date.desc())
    )
    return result.scalar_one_or_none()


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/employees/{employee_id}/exit", response_model=FNFResponse)
async def process_employee_exit(
    employee_id: str,
    payload: ExitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Process employee exit and calculate Full & Final (FNF) settlement."""
    employee = await _get_employee_or_404(employee_id, db)

    config = await _get_active_salary_config(employee_id, db)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active salary config found for this employee.",
        )

    basic = Decimal(str(config.basic_salary))

    # Joining date from employee record (fallback to 1 year ago if not set)
    joining_date = getattr(employee, "joining_date", None)
    if joining_date is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee joining date is not set.",
        )
    if isinstance(joining_date, datetime):
        joining_date = joining_date.date()

    years_of_service = lifecycle_handler.calculate_years_of_service(joining_date, payload.exit_date)

    # Pending salary (pro-rata for days worked in last month)
    total_days_in_month = 30
    pending_salary = lifecycle_handler.calculate_pro_rata(
        monthly_salary=basic,
        working_days=payload.pending_salary_days,
        total_days=total_days_in_month,
    )

    # Leave encashment (EL/PL only)
    leave_encashment = lifecycle_handler.calculate_leave_encashment(
        basic_salary=basic,
        leave_days=payload.pending_leave_days,
    )

    # Gratuity
    gratuity = lifecycle_handler.calculate_gratuity(
        last_basic_salary=basic,
        years_of_service=years_of_service,
    )

    # Notice period shortfall
    days_short = max(0, payload.notice_period_days - payload.days_served)
    daily_salary = (basic / Decimal("26")).quantize(Decimal("0.01"))
    notice_shortfall = lifecycle_handler.calculate_notice_period_shortfall(
        daily_salary=daily_salary,
        days_short=days_short,
    )

    # Pending loan recovery
    deductions_result = await db.execute(
        select(Deduction).where(
            and_(
                Deduction.employee_id == employee_id,
                Deduction.status == DeductionStatus.ACTIVE,
            )
        )
    )
    active_deductions = deductions_result.scalars().all()
    pending_loan_recovery = sum(
        Decimal(str(d.remaining)) for d in active_deductions
    )

    fnf = lifecycle_handler.calculate_fnf(
        pending_salary=pending_salary,
        leave_encashment=leave_encashment,
        gratuity=gratuity,
        bonus=payload.bonus,
        pending_loan_recovery=pending_loan_recovery,
        notice_shortfall=notice_shortfall,
        other_dues=payload.other_dues,
    )

    return FNFResponse(
        employee_id=employee_id,
        exit_date=payload.exit_date,
        years_of_service=years_of_service,
        **fnf,
    )


@router.get("/employees/{employee_id}/fnf", response_model=FNFResponse)
async def get_fnf_summary(
    employee_id: str,
    exit_date: date,
    pending_leave_days: int = 0,
    pending_salary_days: int = 0,
    notice_period_days: int = 30,
    days_served: int = 30,
    bonus: Decimal = Decimal("0"),
    other_dues: Decimal = Decimal("0"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get FNF summary for an employee (read-only calculation)."""
    employee = await _get_employee_or_404(employee_id, db)

    config = await _get_active_salary_config(employee_id, db)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active salary config found for this employee.",
        )

    basic = Decimal(str(config.basic_salary))

    joining_date = getattr(employee, "joining_date", None)
    if joining_date is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee joining date is not set.",
        )
    if isinstance(joining_date, datetime):
        joining_date = joining_date.date()

    years_of_service = lifecycle_handler.calculate_years_of_service(joining_date, exit_date)

    pending_salary = lifecycle_handler.calculate_pro_rata(
        monthly_salary=basic,
        working_days=pending_salary_days,
        total_days=30,
    )

    leave_encashment = lifecycle_handler.calculate_leave_encashment(
        basic_salary=basic,
        leave_days=pending_leave_days,
    )

    gratuity = lifecycle_handler.calculate_gratuity(
        last_basic_salary=basic,
        years_of_service=years_of_service,
    )

    days_short = max(0, notice_period_days - days_served)
    daily_salary = (basic / Decimal("26")).quantize(Decimal("0.01"))
    notice_shortfall = lifecycle_handler.calculate_notice_period_shortfall(
        daily_salary=daily_salary,
        days_short=days_short,
    )

    deductions_result = await db.execute(
        select(Deduction).where(
            and_(
                Deduction.employee_id == employee_id,
                Deduction.status == DeductionStatus.ACTIVE,
            )
        )
    )
    active_deductions = deductions_result.scalars().all()
    pending_loan_recovery = sum(Decimal(str(d.remaining)) for d in active_deductions)

    fnf = lifecycle_handler.calculate_fnf(
        pending_salary=pending_salary,
        leave_encashment=leave_encashment,
        gratuity=gratuity,
        bonus=bonus,
        pending_loan_recovery=pending_loan_recovery,
        notice_shortfall=notice_shortfall,
        other_dues=other_dues,
    )

    return FNFResponse(
        employee_id=employee_id,
        exit_date=exit_date,
        years_of_service=years_of_service,
        **fnf,
    )


@router.get("/employees/{employee_id}/gratuity", response_model=GratuityResponse)
async def get_gratuity_calculation(
    employee_id: str,
    exit_date: date,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get gratuity calculation for an employee."""
    employee = await _get_employee_or_404(employee_id, db)

    config = await _get_active_salary_config(employee_id, db)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active salary config found for this employee.",
        )

    basic = Decimal(str(config.basic_salary))

    joining_date = getattr(employee, "joining_date", None)
    if joining_date is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee joining date is not set.",
        )
    if isinstance(joining_date, datetime):
        joining_date = joining_date.date()

    years_of_service = lifecycle_handler.calculate_years_of_service(joining_date, exit_date)
    gratuity_amount = lifecycle_handler.calculate_gratuity(
        last_basic_salary=basic,
        years_of_service=years_of_service,
    )

    return GratuityResponse(
        employee_id=employee_id,
        joining_date=joining_date,
        exit_date=exit_date,
        years_of_service=years_of_service,
        last_basic_salary=basic,
        gratuity_amount=gratuity_amount,
        eligible=int(years_of_service) >= lifecycle_handler.GRATUITY_MIN_YEARS,
    )
