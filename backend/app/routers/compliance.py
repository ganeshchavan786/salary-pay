from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Any, Dict
from datetime import datetime

from app.database import get_db
from app.models.salary_calculation import SalaryCalculation, SalaryCalculationStatus
from app.models.payroll_period import PayrollPeriod
from app.models.employee import Employee
from app.models.compliance_report import ComplianceReport
from app.models.user import User
from app.utils.deps import get_current_user
from app.utils.compliance_reports import compliance_report_generator

router = APIRouter(tags=["Compliance Reports"])


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


async def _fetch_salary_data_for_period(period_id: str, db: AsyncSession) -> list[Dict]:
    """Fetch salary calculations for a period and build salary_data list."""
    result = await db.execute(
        select(SalaryCalculation, Employee)
        .join(Employee, SalaryCalculation.employee_id == Employee.id)
        .where(
            and_(
                SalaryCalculation.period_id == period_id,
                SalaryCalculation.status != SalaryCalculationStatus.CANCELLED,
            )
        )
        .order_by(SalaryCalculation.employee_id)
    )
    rows = result.all()

    salary_data = []
    for calc, emp in rows:
        salary_data.append({
            "employee_id": emp.id,
            "employee_name": emp.name,
            "emp_code": emp.emp_code,
            "uan": "",  # UAN not stored in current Employee model
            "esi_number": "",  # ESI number not stored in current Employee model
            "pan": "",
            "designation": emp.designation or "",
            "basic_salary": float(calc.basic_salary or 0),
            "gross_salary": float(calc.gross_salary or 0),
            "income_tax": float(calc.income_tax or 0),
            "pf_employee": float(calc.pf_employee or 0),
            "esi_employee": float(calc.esi_employee or 0),
            "professional_tax": float(calc.professional_tax or 0),
            "absent_days": calc.absent_days or 0,
            "period_name": "",
        })

    return salary_data


async def _save_compliance_report(
    report_type: str,
    period_id: str,
    report_data: Dict,
    generated_by: str,
    db: AsyncSession,
) -> ComplianceReport:
    """Persist a compliance report to the database."""
    report = ComplianceReport(
        report_type=report_type,
        period_id=period_id,
        report_data=report_data,
        status="generated",
        generated_by=generated_by,
        generated_at=datetime.utcnow(),
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/pf-ecr/{period_id}")
async def generate_pf_ecr(
    period_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Generate PF ECR (Electronic Challan cum Return) report for a payroll period."""
    await _get_period_or_404(period_id, db)
    salary_data = await _fetch_salary_data_for_period(period_id, db)

    if not salary_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No salary calculations found for this period.",
        )

    report_data = compliance_report_generator.generate_pf_ecr(salary_data)
    await _save_compliance_report("pf_ecr", period_id, report_data, current_user.id, db)

    return report_data


@router.get("/esi/{period_id}")
async def generate_esi_report(
    period_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Generate ESI contribution report for a payroll period."""
    await _get_period_or_404(period_id, db)
    salary_data = await _fetch_salary_data_for_period(period_id, db)

    if not salary_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No salary calculations found for this period.",
        )

    report_data = compliance_report_generator.generate_esi_report(salary_data)
    await _save_compliance_report("esi_report", period_id, report_data, current_user.id, db)

    return report_data


@router.get("/professional-tax/{period_id}")
async def generate_professional_tax_report(
    period_id: str,
    state: str = "MH",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Generate Professional Tax report for a payroll period."""
    await _get_period_or_404(period_id, db)
    salary_data = await _fetch_salary_data_for_period(period_id, db)

    if not salary_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No salary calculations found for this period.",
        )

    report_data = compliance_report_generator.generate_professional_tax_report(salary_data, state=state)
    await _save_compliance_report("professional_tax", period_id, report_data, current_user.id, db)

    return report_data


@router.get("/form16/{employee_id}/{financial_year}")
async def get_form16_data(
    employee_id: str,
    financial_year: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get Form 16 data for an employee for a given financial year.
    financial_year format: e.g. "2024-25"
    """
    employee = await _get_employee_or_404(employee_id, db)

    # Parse financial year to determine date range
    # e.g. "2024-25" → April 2024 to March 2025
    try:
        start_year = int(financial_year.split("-")[0])
    except (ValueError, IndexError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid financial_year format. Expected e.g. '2024-25'.",
        )

    fy_start = datetime(start_year, 4, 1)
    fy_end = datetime(start_year + 1, 3, 31, 23, 59, 59)

    # Fetch all salary calculations for this employee in the financial year
    result = await db.execute(
        select(SalaryCalculation, PayrollPeriod)
        .join(PayrollPeriod, SalaryCalculation.period_id == PayrollPeriod.id)
        .where(
            and_(
                SalaryCalculation.employee_id == employee_id,
                SalaryCalculation.status != SalaryCalculationStatus.CANCELLED,
                PayrollPeriod.start_date >= fy_start,
                PayrollPeriod.end_date <= fy_end,
            )
        )
        .order_by(PayrollPeriod.start_date)
    )
    rows = result.all()

    salary_data = [
        {
            "period_name": period.period_name,
            "gross_salary": float(calc.gross_salary or 0),
            "income_tax": float(calc.income_tax or 0),
            "pf_employee": float(calc.pf_employee or 0),
        }
        for calc, period in rows
    ]

    employee_dict = {
        "name": employee.name,
        "emp_code": employee.emp_code,
        "pan": "",
        "designation": employee.designation or "",
    }

    report_data = compliance_report_generator.generate_form16_data(
        employee=employee_dict,
        salary_data=salary_data,
        financial_year=financial_year,
    )

    # Save report (no period_id for annual Form 16)
    report = ComplianceReport(
        report_type="form16",
        financial_year=financial_year,
        report_data=report_data,
        status="generated",
        generated_by=current_user.id,
        generated_at=datetime.utcnow(),
    )
    db.add(report)
    await db.commit()

    return report_data
