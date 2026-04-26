from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from typing import Any, Dict, List, Optional
from decimal import Decimal

from app.database import get_db
from app.models.salary_calculation import SalaryCalculation, SalaryCalculationStatus
from app.models.payroll_period import PayrollPeriod
from app.models.employee import Employee
from app.models.user import User
from app.utils.deps import get_current_user

router = APIRouter(tags=["Salary Reports"])


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_period_or_404(period_id: str, db: AsyncSession) -> PayrollPeriod:
    result = await db.execute(select(PayrollPeriod).where(PayrollPeriod.id == period_id))
    period = result.scalar_one_or_none()
    if not period:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payroll period not found.")
    return period


async def _get_employee_or_404(employee_id: str, db: AsyncSession) -> Employee:
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found.")
    return employee


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/summary/{period_id}")
async def monthly_salary_summary(
    period_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Monthly salary summary with department-wise totals.
    Returns aggregate gross, net, deductions, and headcount per department.
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
    )
    rows = result.all()

    # Aggregate by department
    dept_totals: Dict[str, Dict] = {}
    overall_gross = Decimal("0")
    overall_net = Decimal("0")
    overall_deductions = Decimal("0")

    for calc, emp in rows:
        dept = emp.department or "Unassigned"
        if dept not in dept_totals:
            dept_totals[dept] = {
                "department": dept,
                "headcount": 0,
                "total_gross": Decimal("0"),
                "total_net": Decimal("0"),
                "total_deductions": Decimal("0"),
                "total_pf_employee": Decimal("0"),
                "total_pf_employer": Decimal("0"),
                "total_esi_employee": Decimal("0"),
                "total_esi_employer": Decimal("0"),
                "total_income_tax": Decimal("0"),
            }

        d = dept_totals[dept]
        d["headcount"] += 1
        d["total_gross"] += Decimal(str(calc.gross_salary or 0))
        d["total_net"] += Decimal(str(calc.net_salary or 0))
        d["total_deductions"] += Decimal(str(calc.total_deductions or 0))
        d["total_pf_employee"] += Decimal(str(calc.pf_employee or 0))
        d["total_pf_employer"] += Decimal(str(calc.pf_employer or 0))
        d["total_esi_employee"] += Decimal(str(calc.esi_employee or 0))
        d["total_esi_employer"] += Decimal(str(calc.esi_employer or 0))
        d["total_income_tax"] += Decimal(str(calc.income_tax or 0))

        overall_gross += Decimal(str(calc.gross_salary or 0))
        overall_net += Decimal(str(calc.net_salary or 0))
        overall_deductions += Decimal(str(calc.total_deductions or 0))

    # Convert Decimals to float for JSON serialisation
    departments = []
    for d in dept_totals.values():
        departments.append({k: float(v) if isinstance(v, Decimal) else v for k, v in d.items()})

    return {
        "period_id": period_id,
        "period_name": period.period_name,
        "total_employees": len(rows),
        "overall_gross_salary": float(overall_gross),
        "overall_net_salary": float(overall_net),
        "overall_deductions": float(overall_deductions),
        "departments": departments,
    }


@router.get("/employee/{employee_id}")
async def employee_salary_history(
    employee_id: str,
    limit: int = 12,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Employee salary history across all periods.
    Returns the most recent `limit` salary calculations (default 12 months).
    """
    employee = await _get_employee_or_404(employee_id, db)

    result = await db.execute(
        select(SalaryCalculation, PayrollPeriod)
        .join(PayrollPeriod, SalaryCalculation.period_id == PayrollPeriod.id)
        .where(
            and_(
                SalaryCalculation.employee_id == employee_id,
                SalaryCalculation.status != SalaryCalculationStatus.CANCELLED,
            )
        )
        .order_by(PayrollPeriod.start_date.desc())
        .limit(limit)
    )
    rows = result.all()

    history = []
    for calc, period in rows:
        history.append({
            "period_id": period.id,
            "period_name": period.period_name,
            "start_date": period.start_date.isoformat(),
            "end_date": period.end_date.isoformat(),
            "basic_salary": float(calc.basic_salary or 0),
            "gross_salary": float(calc.gross_salary or 0),
            "total_deductions": float(calc.total_deductions or 0),
            "net_salary": float(calc.net_salary or 0),
            "status": calc.status.value,
            "calculated_at": calc.calculated_at.isoformat() if calc.calculated_at else None,
        })

    return {
        "employee_id": employee_id,
        "employee_name": employee.name,
        "emp_code": employee.emp_code,
        "history": history,
    }


@router.get("/cost-center/{period_id}")
async def cost_center_allocation_report(
    period_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Cost center allocation report for a period.
    Uses the cost_center_allocations from each employee's salary config.
    Falls back to department as cost center when no explicit allocation exists.
    """
    from app.models.salary_config import SalaryConfig

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
    )
    rows = result.all()

    cost_center_totals: Dict[str, Dict] = {}

    for calc, emp in rows:
        # Fetch latest salary config for cost center allocations
        config_result = await db.execute(
            select(SalaryConfig)
            .where(SalaryConfig.employee_id == emp.id)
            .order_by(SalaryConfig.effective_date.desc())
            .limit(1)
        )
        config = config_result.scalar_one_or_none()

        net = Decimal(str(calc.net_salary or 0))
        gross = Decimal(str(calc.gross_salary or 0))

        allocations = []
        if config and config.cost_center_allocations:
            allocations = config.cost_center_allocations
        else:
            # Default: 100% to department
            allocations = [{"cost_center": emp.department or "Unassigned", "percentage": 100}]

        for alloc in allocations:
            cc = alloc.get("cost_center", "Unassigned")
            pct = Decimal(str(alloc.get("percentage", 100))) / Decimal("100")

            if cc not in cost_center_totals:
                cost_center_totals[cc] = {
                    "cost_center": cc,
                    "headcount": 0,
                    "allocated_gross": Decimal("0"),
                    "allocated_net": Decimal("0"),
                }

            cost_center_totals[cc]["headcount"] += 1
            cost_center_totals[cc]["allocated_gross"] += (gross * pct).quantize(Decimal("0.01"))
            cost_center_totals[cc]["allocated_net"] += (net * pct).quantize(Decimal("0.01"))

    cost_centers = [
        {k: float(v) if isinstance(v, Decimal) else v for k, v in cc.items()}
        for cc in cost_center_totals.values()
    ]

    return {
        "period_id": period_id,
        "period_name": period.period_name,
        "cost_centers": cost_centers,
    }


@router.get("/export/{period_id}")
async def export_salary_data(
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
        })

    return {
        "period_id": period_id,
        "period_name": period.period_name,
        "start_date": period.start_date.isoformat(),
        "end_date": period.end_date.isoformat(),
        "total_records": len(records),
        "records": records,
    }
