from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel, ValidationError
from typing import Any, Dict, List, Optional
from datetime import datetime

from app.database import get_db
from app.models.salary_calculation import SalaryCalculation, SalaryCalculationStatus
from app.models.payroll_period import PayrollPeriod
from app.models.employee import Employee
from app.models.salary_config import SalaryConfig
from app.models.user import User
from app.schemas.salary_config import SalaryConfigCreate
from app.utils.deps import get_current_user

router = APIRouter(tags=["Bulk Operations"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class BulkImportResult(BaseModel):
    total: int
    success: int
    failed: int
    errors: List[Dict[str, Any]]


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_period_or_404(period_id: str, db: AsyncSession) -> PayrollPeriod:
    result = await db.execute(select(PayrollPeriod).where(PayrollPeriod.id == period_id))
    period = result.scalar_one_or_none()
    if not period:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payroll period not found.")
    return period


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/salary-configs/import", response_model=BulkImportResult, status_code=status.HTTP_200_OK)
async def bulk_import_salary_configs(
    records: List[Dict[str, Any]],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BulkImportResult:
    """
    Bulk import salary configurations from a JSON body.

    Body: list of salary config objects (same schema as POST /api/v1/salary-configs/).
    Each record is validated individually. Valid records are saved; invalid ones are
    reported in the errors list. The operation never rolls back valid rows due to
    invalid ones — partial import is intentional.

    Returns: { total, success, failed, errors }
    """
    if not records:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request body must be a non-empty list of salary config objects.",
        )

    success_count = 0
    failed_count = 0
    errors: List[Dict[str, Any]] = []

    for idx, raw in enumerate(records):
        row_label = f"row[{idx}]"

        # 1. Validate schema
        try:
            payload = SalaryConfigCreate.model_validate(raw)
        except ValidationError as exc:
            failed_count += 1
            errors.append({
                "row": idx,
                "employee_id": raw.get("employee_id", ""),
                "error": exc.errors(),
            })
            continue

        # 2. Verify employee exists
        emp_result = await db.execute(
            select(Employee).where(Employee.id == payload.employee_id)
        )
        employee = emp_result.scalar_one_or_none()
        if not employee:
            failed_count += 1
            errors.append({
                "row": idx,
                "employee_id": payload.employee_id,
                "error": f"Employee '{payload.employee_id}' not found.",
            })
            continue

        # 3. Deactivate existing active configs for this employee
        existing_result = await db.execute(
            select(SalaryConfig).where(
                and_(
                    SalaryConfig.employee_id == payload.employee_id,
                    SalaryConfig.status == "active",
                )
            )
        )
        for cfg in existing_result.scalars().all():
            cfg.status = "inactive"
            cfg.updated_at = datetime.utcnow()

        # 4. Create new config
        config = SalaryConfig(
            employee_id=payload.employee_id,
            effective_date=payload.effective_date,
            basic_salary=payload.basic_salary,
            hra_percentage=payload.hra_percentage,
            special_allowance=payload.special_allowance,
            travel_allowance=payload.travel_allowance,
            medical_allowance=payload.medical_allowance,
            pf_applicable=payload.pf_applicable,
            esi_applicable=payload.esi_applicable,
            pt_applicable=payload.pt_applicable,
            tax_regime=payload.tax_regime,
            cost_center_allocations=payload.cost_center_allocations,
            status="active",
            created_by=current_user.id,
        )
        db.add(config)
        success_count += 1

    # Commit all valid records in one transaction
    if success_count > 0:
        await db.commit()

    return BulkImportResult(
        total=len(records),
        success=success_count,
        failed=failed_count,
        errors=errors,
    )


@router.get("/salary-calculations/export/{period_id}")
async def export_salary_calculations(
    period_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Export all salary calculations for a period as JSON.
    Includes full earnings and deductions breakdown per employee.
    """
    period = await _get_period_or_404(period_id, db)

    result = await db.execute(
        select(SalaryCalculation, Employee)
        .join(Employee, SalaryCalculation.employee_id == Employee.id)
        .where(
            and_(
                SalaryCalculation.period_id == period_id,
                SalaryCalculation.status != SalaryCalculationStatus.CANCELLED,
            )
        )
        .order_by(Employee.emp_code)
    )
    rows = result.all()

    records = []
    for calc, emp in rows:
        records.append({
            "employee_id": emp.id,
            "emp_code": emp.emp_code,
            "employee_name": emp.name,
            "department": emp.department or "",
            "designation": emp.designation or "",
            # Attendance
            "total_days": calc.total_days,
            "working_days": calc.working_days,
            "present_days": calc.present_days,
            "absent_days": calc.absent_days,
            "leave_days": calc.leave_days,
            "overtime_hours": float(calc.overtime_hours or 0),
            # Earnings
            "basic_salary": float(calc.basic_salary or 0),
            "hra": float(calc.hra or 0),
            "special_allowance": float(calc.special_allowance or 0),
            "travel_allowance": float(calc.travel_allowance or 0),
            "medical_allowance": float(calc.medical_allowance or 0),
            "overtime_amount": float(calc.overtime_amount or 0),
            "arrears_amount": float(calc.arrears_amount or 0),
            "gross_salary": float(calc.gross_salary or 0),
            # Deductions
            "pf_employee": float(calc.pf_employee or 0),
            "pf_employer": float(calc.pf_employer or 0),
            "esi_employee": float(calc.esi_employee or 0),
            "esi_employer": float(calc.esi_employer or 0),
            "professional_tax": float(calc.professional_tax or 0),
            "income_tax": float(calc.income_tax or 0),
            "loan_deductions": float(calc.loan_deductions or 0),
            "advance_deductions": float(calc.advance_deductions or 0),
            "fine_deductions": float(calc.fine_deductions or 0),
            "lop_deduction": float(calc.lop_deduction or 0),
            "total_deductions": float(calc.total_deductions or 0),
            "net_salary": float(calc.net_salary or 0),
            "status": calc.status.value,
            "calculated_at": calc.calculated_at.isoformat() if calc.calculated_at else None,
        })

    return {
        "period_id": period_id,
        "period_name": period.period_name,
        "start_date": period.start_date.isoformat(),
        "end_date": period.end_date.isoformat(),
        "total_records": len(records),
        "records": records,
    }
