from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from decimal import Decimal
import logging

from app.database import get_db
from app.models.salary_calculation import SalaryCalculation, SalaryCalculationStatus
from app.models.payroll_period import PayrollPeriod, PayrollPeriodState
from app.models.employee import Employee
from app.models.user import User
from app.utils.deps import get_current_user
from app.utils.salary_calculator import salary_calculator

router = APIRouter(tags=["Salary Calculation"])
logger = logging.getLogger(__name__)


# ── Schemas ──────────────────────────────────────────────────────────────────

class AttendanceData(BaseModel):
    total_days: int = 30
    working_days: int = 26
    present_days: int = 26
    absent_days: int = 0
    leave_days: int = 0
    overtime_hours: float = 0


class CalculateRequest(BaseModel):
    employee_ids: Optional[List[str]] = None  # If None, calculate for all employees
    attendance_data: Optional[dict] = None  # employee_id -> AttendanceData (deprecated, use attendance_overrides)
    attendance_overrides: Optional[dict] = None  # employee_id -> attendance data dict for manual overrides


class SalaryCalculationResponse(BaseModel):
    id: str
    employee_id: str
    period_id: str
    calculation_version: int
    total_days: int
    working_days: int
    present_days: int
    absent_days: int
    leave_days: int
    overtime_hours: Decimal
    basic_salary: Decimal
    hra: Decimal
    special_allowance: Decimal
    travel_allowance: Decimal
    medical_allowance: Decimal
    overtime_amount: Decimal
    arrears_amount: Decimal
    gross_salary: Decimal
    pf_employee: Decimal
    pf_employer: Decimal
    esi_employee: Decimal
    esi_employer: Decimal
    professional_tax: Decimal
    income_tax: Decimal
    loan_deductions: Decimal
    advance_deductions: Decimal
    fine_deductions: Decimal
    lop_deduction: Decimal
    total_deductions: Decimal
    net_salary: Decimal
    status: SalaryCalculationStatus
    calculated_at: datetime
    calculated_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    calculation_details: Optional[dict] = None
    # Employee details (added for UI display)
    emp_name: Optional[str] = None
    emp_code: Optional[str] = None

    class Config:
        from_attributes = True


class ApproveRequest(BaseModel):
    comment: Optional[str] = None


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_period_or_404(period_id: str, db: AsyncSession) -> PayrollPeriod:
    result = await db.execute(select(PayrollPeriod).where(PayrollPeriod.id == period_id))
    period = result.scalar_one_or_none()
    if not period:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payroll period not found.")
    return period


async def _get_calculation_or_404(calc_id: str, db: AsyncSession) -> SalaryCalculation:
    result = await db.execute(select(SalaryCalculation).where(SalaryCalculation.id == calc_id))
    calc = result.scalar_one_or_none()
    if not calc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Salary calculation not found.")
    return calc


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/calculate/{period_id}", status_code=status.HTTP_200_OK)
async def calculate_salary(
    period_id: str,
    payload: CalculateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Calculate salary for all employees or specific ones in a period."""
    period = await _get_period_or_404(period_id, db)

    # Validate period dates (Requirement 9.1, 9.2, 9.3, 9.4)
    if not period.start_date or not period.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payroll period: missing start_date or end_date",
        )
    
    if period.start_date > period.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payroll period: start_date must be before end_date",
        )

    # Validate period state - only OPEN periods can be calculated
    if period.state != PayrollPeriodState.OPEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Salary calculation only allowed for OPEN periods. "
                f"Current state: {period.state.value}. "
                f"Please open the period first before calculating salaries."
            ),
        )

    # Determine which employees to process
    if payload.employee_ids:
        employee_ids = payload.employee_ids
    else:
        # Get all active employees
        result = await db.execute(select(Employee).where(Employee.status == "ACTIVE"))
        employees = result.scalars().all()
        employee_ids = [emp.id for emp in employees]

    # Extract attendance overrides (Requirement 21.1, 21.2)
    attendance_overrides = payload.attendance_overrides or {}
    # Support legacy attendance_data field for backward compatibility
    if payload.attendance_data and not attendance_overrides:
        attendance_overrides = payload.attendance_data

    results = []
    errors = []

    for emp_id in employee_ids:
        try:
            # Validate employee exists
            emp_result = await db.execute(select(Employee).where(Employee.id == emp_id))
            employee = emp_result.scalar_one_or_none()
            if not employee:
                errors.append({"employee_id": emp_id, "error": "Employee not found"})
                continue
            
            # Get attendance data for this employee (manual override or auto-fetch)
            attendance = None
            if emp_id in attendance_overrides:
                attendance = attendance_overrides[emp_id]

            calc = await salary_calculator.calculate_employee_salary(
                employee_id=emp_id,
                period_id=period_id,
                db=db,
                calculated_by=current_user.id,
                attendance_data=attendance,
            )
            results.append({"employee_id": emp_id, "calculation_id": calc.id, "status": "success"})
        except ValueError as ve:
            # Validation errors (no salary config, invalid period, etc.)
            errors.append({"employee_id": emp_id, "error": str(ve)})
        except Exception as e:
            # Unexpected errors
            logger.error(f"Error calculating salary for employee {emp_id}: {str(e)}", exc_info=True)
            errors.append({"employee_id": emp_id, "error": f"Calculation failed: {str(e)}"})

    return {
        "period_id": period_id,
        "total_processed": len(results),
        "total_errors": len(errors),
        "results": results,
        "errors": errors,
    }


@router.get("/employee/{employee_id}/period/{period_id}", response_model=SalaryCalculationResponse)
async def get_employee_salary_calculation(
    employee_id: str,
    period_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get salary calculation for an employee in a specific period."""
    result = await db.execute(
        select(SalaryCalculation).where(
            and_(
                SalaryCalculation.employee_id == employee_id,
                SalaryCalculation.period_id == period_id,
                SalaryCalculation.status != SalaryCalculationStatus.CANCELLED,
            )
        ).order_by(SalaryCalculation.calculation_version.desc())
    )
    calc = result.scalar_one_or_none()

    if not calc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Salary calculation not found for this employee and period.",
        )

    return SalaryCalculationResponse.model_validate(calc)


@router.get("/period/{period_id}", response_model=List[SalaryCalculationResponse])
async def get_period_calculations(
    period_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all salary calculations for a period."""
    await _get_period_or_404(period_id, db)

    result = await db.execute(
        select(SalaryCalculation, Employee.name, Employee.emp_code).join(
            Employee, SalaryCalculation.employee_id == Employee.id
        ).where(
            and_(
                SalaryCalculation.period_id == period_id,
                SalaryCalculation.status != SalaryCalculationStatus.CANCELLED,
            )
        ).order_by(SalaryCalculation.employee_id)
    )
    rows = result.all()

    # Build response with employee details
    response = []
    for calc, emp_name, emp_code in rows:
        calc_dict = SalaryCalculationResponse.model_validate(calc).model_dump()
        calc_dict['emp_name'] = emp_name
        calc_dict['emp_code'] = emp_code
        response.append(calc_dict)

    return response


@router.patch("/calculation/{calc_id}/approve", response_model=SalaryCalculationResponse)
async def approve_calculation(
    calc_id: str,
    payload: ApproveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Approve a salary calculation."""
    calc = await _get_calculation_or_404(calc_id, db)

    if calc.status != SalaryCalculationStatus.CALCULATED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only CALCULATED salary can be approved. Current status: {calc.status.value}",
        )

    calc.status = SalaryCalculationStatus.APPROVED
    calc.approved_by = current_user.id
    calc.approved_at = datetime.utcnow()
    await db.commit()
    await db.refresh(calc)

    return SalaryCalculationResponse.model_validate(calc)
