from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Any, Dict, List

from app.database import get_db
from app.models.salary_calculation import SalaryCalculation, SalaryCalculationStatus
from app.models.payroll_period import PayrollPeriod
from app.models.employee import Employee
from app.models.user import User
from app.utils.deps import get_current_user
from app.utils.payslip_generator import payslip_generator

router = APIRouter(tags=["Payslips"])


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


def _build_salary_calc_dict(calc: SalaryCalculation, period: PayrollPeriod) -> Dict:
    """Convert ORM SalaryCalculation to a plain dict for the payslip generator."""
    return {
        "basic_salary": float(calc.basic_salary or 0),
        "hra": float(calc.hra or 0),
        "special_allowance": float(calc.special_allowance or 0),
        "travel_allowance": float(calc.travel_allowance or 0),
        "medical_allowance": float(calc.medical_allowance or 0),
        "overtime_amount": float(calc.overtime_amount or 0),
        "arrears_amount": float(calc.arrears_amount or 0),
        "gross_salary": float(calc.gross_salary or 0),
        "pf_employee": float(calc.pf_employee or 0),
        "esi_employee": float(calc.esi_employee or 0),
        "professional_tax": float(calc.professional_tax or 0),
        "income_tax": float(calc.income_tax or 0),
        "lop_deduction": float(calc.lop_deduction or 0),
        "loan_deductions": float(calc.loan_deductions or 0),
        "advance_deductions": float(calc.advance_deductions or 0),
        "total_deductions": float(calc.total_deductions or 0),
        "net_salary": float(calc.net_salary or 0),
        "period_name": period.period_name,
        "calculation_details": calc.calculation_details or {},
    }


def _build_employee_dict(employee: Employee) -> Dict:
    return {
        "name": employee.name,
        "emp_code": employee.emp_code,
        "department": employee.department or "",
        "designation": employee.designation or "",
    }


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/{employee_id}/{period_id}")
async def get_payslip(
    employee_id: str,
    period_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get payslip data for an employee in a specific period."""
    employee = await _get_employee_or_404(employee_id, db)
    period = await _get_period_or_404(period_id, db)

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
            detail="No salary calculation found for this employee and period.",
        )

    salary_calc_dict = _build_salary_calc_dict(calc, period)
    employee_dict = _build_employee_dict(employee)

    return payslip_generator.generate_payslip_data(
        employee=employee_dict,
        salary_calc=salary_calc_dict,
    )


@router.get("/my")
async def get_my_payslips(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get own payslip history (for PWA)."""
    import logging
    logger = logging.getLogger(__name__)
    
    if not current_user.emp_id:
        logger.info(f"[PayslipsMy] No emp_id for user {current_user.username}")
        return {"payrolls": []}
    
    logger.info(f"[PayslipsMy] emp_id={current_user.emp_id}, username={current_user.username}")
    
    # First, get ALL salary calculations for this employee (no filter)
    all_calc_result = await db.execute(
        select(SalaryCalculation).where(
            SalaryCalculation.employee_id == current_user.emp_id
        )
    )
    all_calcs = all_calc_result.scalars().all()
    logger.info(f"[PayslipsMy] Found {len(all_calcs)} total calculations for emp_id={current_user.emp_id}")
    for c in all_calcs:
        logger.info(f"  calc id={c.id}, status={c.status}, period_id={c.period_id}")
    
    # Get all SalaryCalculations for this employee, joined with PayrollPeriod
    result = await db.execute(
        select(SalaryCalculation, PayrollPeriod)
        .join(PayrollPeriod, SalaryCalculation.period_id == PayrollPeriod.id)
        .where(
            SalaryCalculation.employee_id == current_user.emp_id,
        )
        .order_by(PayrollPeriod.start_date.desc())
    )
    rows = result.all()
    logger.info(f"[PayslipsMy] After JOIN with PayrollPeriod: {len(rows)} rows")
    
    payrolls = []
    for calc, period in rows:
        status_val = calc.status.value if hasattr(calc.status, 'value') else str(calc.status)
        if status_val == "cancelled":
            continue  # Skip cancelled
        
        # Extract month/year from start_date
        p_month = period.start_date.month if period.start_date else 1
        p_year = period.start_date.year if period.start_date else 2026
        
        payrolls.append({
            "id": calc.id,
            "month": p_month,
            "year": p_year,
            "period_name": period.period_name or f"Month-{p_month} {p_year}",
            "status": status_val,
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
            "esi_employee": float(calc.esi_employee or 0),
            "professional_tax": float(calc.professional_tax or 0),
            "income_tax": float(calc.income_tax or 0),
            "loan_deductions": float(calc.loan_deductions or 0),
            "lop_deduction": float(calc.lop_deduction or 0),
            "other_deductions": float(calc.other_deductions or 0),
            "total_deductions": float(calc.total_deductions or 0),
            # Net
            "net_pay": float(calc.net_salary or 0),
            # Attendance
            "working_days": calc.working_days or 0,
            "present_days": calc.present_days or 0,
            "absent_days": calc.absent_days or 0,
            "leave_days": calc.leave_days or 0,
        })
    
    logger.info(f"[PayslipsMy] Returning {len(payrolls)} payrolls")
    return {"payrolls": payrolls}

@router.get("/{payroll_id}/slip-download")
async def download_my_slip(
    payroll_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download slip (For PWA) using calculation id."""
    result = await db.execute(
        select(SalaryCalculation, PayrollPeriod, Employee)
        .join(PayrollPeriod, SalaryCalculation.period_id == PayrollPeriod.id)
        .join(Employee, SalaryCalculation.employee_id == Employee.id)
        .where(
            and_(
                SalaryCalculation.id == payroll_id,
                SalaryCalculation.employee_id == current_user.emp_id
            )
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Payslip not found.")
        
    calc, period, employee = row
    salary_calc_dict = _build_salary_calc_dict(calc, period)
    employee_dict = _build_employee_dict(employee)
    
    import calendar
    from app.services import pdf_service
    # We need to map the new dict to what pdf_service expects, or use the new payslip_generator
    # Actually payslip_generator creates dicts, we need to generate PDF.
    # If PWA expects PDF blob, let's use the new payslip generator to get HTML/PDF.
    # Wait, the old download_salary_slip used pdf_service.generate_salary_slip(payroll_dict, employee_dict)
    
    payroll_dict = {
        "month": period.month,
        "year": period.year,
        "working_days": 30, # dummy
        "present_days": 30, # dummy
        "lop_days": 0,
        "half_days": 0,
        "ot_hours": 0,
        "gross_salary": salary_calc_dict["gross_salary"],
        "basic_salary": salary_calc_dict["basic_salary"],
        "hra": salary_calc_dict["hra"],
        "travel_allowance": salary_calc_dict["travel_allowance"],
        "special_allowance": salary_calc_dict["special_allowance"],
        "pt_deduction": salary_calc_dict["professional_tax"],
        "pf_deduction": salary_calc_dict["pf_employee"],
        "lop_deduction": salary_calc_dict["lop_deduction"],
        "late_mark_deduction": 0,
        "total_deductions": salary_calc_dict["total_deductions"],
        "net_pay": salary_calc_dict["net_salary"],
    }
    
    from fastapi import Response
    pdf_bytes = pdf_service.generate_salary_slip(payroll_dict, employee_dict)
    month_name = calendar.month_abbr[period.month]
    filename = f"salary-slip-{employee.emp_code}-{month_name}-{period.year}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

@router.post("/bulk-generate/{period_id}")
async def bulk_generate_payslips(
    period_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Generate payslips for all employees in a period."""
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

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No salary calculations found for this period.",
        )

    payslips: List[Dict] = []
    for calc, employee in rows:
        salary_calc_dict = _build_salary_calc_dict(calc, period)
        employee_dict = _build_employee_dict(employee)
        payslip_data = payslip_generator.generate_payslip_data(
            employee=employee_dict,
            salary_calc=salary_calc_dict,
        )
        payslips.append(payslip_data)

    return {
        "period_id": period_id,
        "period_name": period.period_name,
        "total_payslips": len(payslips),
        "payslips": payslips,
    }
