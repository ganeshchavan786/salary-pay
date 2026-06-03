from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, extract, func
from typing import Any, Dict, List

from app.database import get_db
from app.models.salary_calculation import SalaryCalculation, SalaryCalculationStatus
from app.models.payroll_period import PayrollPeriod
from app.models.employee import Employee
from app.models.user import User
from app.models.attendance_daily import AttendanceDaily, AttendanceStatus
from app.utils.deps import get_current_user, require_admin
from app.utils.payslip_generator import payslip_generator


async def _fetch_attendance_records(emp_id: str, month: int, year: int, db: AsyncSession) -> list:
    """Fetch daily attendance records for an employee for a given month/year."""
    try:
        att_result = await db.execute(
            select(AttendanceDaily)
            .where(
                AttendanceDaily.emp_id == emp_id,
                extract('month', AttendanceDaily.date) == month,
                extract('year',  AttendanceDaily.date) == year,
            )
            .order_by(AttendanceDaily.date)
        )
        records = att_result.scalars().all()
        return [
            {
                "date":       str(r.date),
                "check_in":   r.check_in.strftime("%I:%M %p")  if r.check_in  else "-",
                "check_out":  r.check_out.strftime("%I:%M %p") if r.check_out else "-",
                "status":     r.status.value if r.status else "-",
                "is_late":    bool(r.is_late_mark),
                "work_hours": round(float(r.total_working_hours or 0), 2),
                "ot_hours":   round(float(r.ot_hours or 0), 2),
            }
            for r in records
        ]
    except Exception:
        return []


async def _get_employee_attendance_metrics(emp_id: str, start_date: Any, end_date: Any, db: AsyncSession) -> Dict[str, Any]:
    try:
        # Fetch late count
        late_result = await db.execute(
            select(func.count(AttendanceDaily.id))
            .where(
                and_(
                    AttendanceDaily.emp_id == emp_id,
                    AttendanceDaily.date >= start_date,
                    AttendanceDaily.date <= end_date,
                    or_(
                        AttendanceDaily.is_late_mark == True,
                        AttendanceDaily.is_half_late_mark == True
                    )
                )
            )
        )
        late_count = int(late_result.scalar() or 0)

        # Fetch halfday count
        halfday_result = await db.execute(
            select(func.count(AttendanceDaily.id))
            .where(
                and_(
                    AttendanceDaily.emp_id == emp_id,
                    AttendanceDaily.date >= start_date,
                    AttendanceDaily.date <= end_date,
                    AttendanceDaily.status == AttendanceStatus.HALFDAY
                )
            )
        )
        halfday_count = int(halfday_result.scalar() or 0)

        return {
            "late_count": late_count,
            "halfday_count": halfday_count
        }
    except Exception:
        return {"late_count": 0, "halfday_count": 0}


async def _get_bulk_attendance_metrics(start_date: Any, end_date: Any, db: AsyncSession) -> Dict[str, Dict[str, int]]:
    try:
        # We can fetch count of late marks grouped by emp_id
        late_result = await db.execute(
            select(AttendanceDaily.emp_id, func.count(AttendanceDaily.id))
            .where(
                and_(
                    AttendanceDaily.date >= start_date,
                    AttendanceDaily.date <= end_date,
                    or_(
                        AttendanceDaily.is_late_mark == True,
                        AttendanceDaily.is_half_late_mark == True
                    )
                )
            )
            .group_by(AttendanceDaily.emp_id)
        )
        late_counts = {row[0]: int(row[1]) for row in late_result.all()}

        # We can fetch count of halfday status grouped by emp_id
        halfday_result = await db.execute(
            select(AttendanceDaily.emp_id, func.count(AttendanceDaily.id))
            .where(
                and_(
                    AttendanceDaily.date >= start_date,
                    AttendanceDaily.date <= end_date,
                    AttendanceDaily.status == AttendanceStatus.HALFDAY
                )
            )
            .group_by(AttendanceDaily.emp_id)
        )
        halfday_counts = {row[0]: int(row[1]) for row in halfday_result.all()}

        # Merge them
        metrics = {}
        all_emp_ids = set(late_counts.keys()).union(halfday_counts.keys())
        for emp_id in all_emp_ids:
            metrics[emp_id] = {
                "late_count": late_counts.get(emp_id, 0),
                "halfday_count": halfday_counts.get(emp_id, 0)
            }
        return metrics
    except Exception:
        return {}


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
        "total_days": int(calc.total_days or 0),
        "working_days": int(calc.working_days or 0),
        "present_days": int(calc.present_days or 0),
        "absent_days": int(calc.absent_days or 0),
        "leave_days": int(calc.leave_days or 0),
        "calculation_details": calc.calculation_details or {},
    }


def _build_employee_dict(employee: Employee) -> Dict:
    return {
        "name": employee.name,
        "emp_code": employee.emp_code,
        "department": employee.department or "",
        "designation": employee.designation or "",
        "aadhaar_no": employee.aadhaar_no or "-",
        "pan_no": employee.pan_no or "-",
        "bank_name": employee.bank_name or "-",
        "account_no": employee.account_no or "-",
        "ifsc_code": employee.ifsc_code or "-",
        "joining_date": employee.joining_date or "-",
        # Compliance fields (new)
        "uan_no": getattr(employee, "uan_no", None) or "-",
        "pf_no": getattr(employee, "pf_no", None) or "-",
        "esi_no": getattr(employee, "esi_no", None) or "-",
        "location": getattr(employee, "location", None) or "-",
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
    
    # Fetch and enrich with attendance metrics for late_count and halfday_count
    metrics = await _get_employee_attendance_metrics(employee_id, period.start_date, period.end_date, db)
    salary_calc_dict["late_count"] = metrics["late_count"]
    salary_calc_dict["halfday_count"] = metrics["halfday_count"]

    employee_dict = _build_employee_dict(employee)

    payslip_data = payslip_generator.generate_payslip_data(
        employee=employee_dict,
        salary_calc=salary_calc_dict,
    )
    payslip_data["id"] = calc.id
    return payslip_data


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
    
    payslip_data = payslip_generator.generate_payslip_data(
        employee=employee_dict,
        salary_calc=salary_calc_dict,
    )
    
    payroll_dict = {
        "month": period.start_date.month,
        "year": period.start_date.year,
        "gross_salary": float(salary_calc_dict.get("gross_salary") or 0),
        "basic_salary": float(salary_calc_dict.get("basic_salary") or 0),
        "hra": float(salary_calc_dict.get("hra") or 0),
        "special_allowance": float(salary_calc_dict.get("special_allowance") or 0),
        "travel_allowance": float(salary_calc_dict.get("travel_allowance") or 0),
        "medical_allowance": float(salary_calc_dict.get("medical_allowance") or 0),
        "overtime_amount": float(salary_calc_dict.get("overtime_amount") or 0),
        "arrears_amount": float(salary_calc_dict.get("arrears_amount") or 0),
        "income_tax": float(salary_calc_dict.get("income_tax") or 0),
        "pf_deduction": float(salary_calc_dict.get("pf_employee") or 0),
        "pt_deduction": float(salary_calc_dict.get("professional_tax") or 0),
        "esi_employee": float(salary_calc_dict.get("esi_employee") or 0),
        "loan_deductions": float(salary_calc_dict.get("loan_deductions") or 0),
        "advance_deductions": float(salary_calc_dict.get("advance_deductions") or 0),
        "lop_deduction": float(salary_calc_dict.get("lop_deduction") or 0),
        "total_deductions": float(salary_calc_dict.get("total_deductions") or 0),
        "net_pay": float(salary_calc_dict.get("net_salary") or 0),
        "total_days": salary_calc_dict.get("total_days", 30),
        "working_days": salary_calc_dict.get("working_days", 30),
        "present_days": salary_calc_dict.get("present_days", 30),
        "absent_days": salary_calc_dict.get("absent_days", 0),
        "leave_days": salary_calc_dict.get("leave_days", 0),
        # LOP fix: use calculation_details first, fallback to absent_days
        "lop_days": float(
            salary_calc_dict.get("calculation_details", {}).get("lop_days")
            or salary_calc_dict.get("absent_days")
            or 0.0
        ),
        "earnings": payslip_data.get("earnings", []),
        "deductions": payslip_data.get("deductions", []),
        "attendance_records": await _fetch_attendance_records(
            employee.id,
            period.start_date.month,
            period.start_date.year,
            db,
        ),
    }
    
    from fastapi import Response
    pdf_bytes = pdf_service.generate_salary_slip(payroll_dict, employee_dict)
    month_idx = int(period.start_date.month or 1)
    month_name = calendar.month_abbr[month_idx]
    filename = f"salary-slip-{employee.emp_code}-{month_name}-{period.start_date.year}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

@router.get("/admin/{payroll_id}/slip-download")
async def admin_download_slip(
    payroll_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Admin endpoint to download any slip by its calculation ID."""
    result = await db.execute(
        select(SalaryCalculation, PayrollPeriod, Employee)
        .join(PayrollPeriod, SalaryCalculation.period_id == PayrollPeriod.id)
        .join(Employee, SalaryCalculation.employee_id == Employee.id)
        .where(SalaryCalculation.id == payroll_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Payslip not found.")
        
    calc, period, employee = row
    salary_calc_dict = _build_salary_calc_dict(calc, period)
    employee_dict = _build_employee_dict(employee)
    
    import calendar
    from app.services import pdf_service
    
    try:
        payslip_data = payslip_generator.generate_payslip_data(
            employee=employee_dict,
            salary_calc=salary_calc_dict,
        )
        
        payroll_dict = {
            "month": period.start_date.month,
            "year": period.start_date.year,
            "gross_salary": float(salary_calc_dict.get("gross_salary") or 0),
            "basic_salary": float(salary_calc_dict.get("basic_salary") or 0),
            "hra": float(salary_calc_dict.get("hra") or 0),
            "special_allowance": float(salary_calc_dict.get("special_allowance") or 0),
            "travel_allowance": float(salary_calc_dict.get("travel_allowance") or 0),
            "medical_allowance": float(salary_calc_dict.get("medical_allowance") or 0),
            "overtime_amount": float(salary_calc_dict.get("overtime_amount") or 0),
            "arrears_amount": float(salary_calc_dict.get("arrears_amount") or 0),
            "income_tax": float(salary_calc_dict.get("income_tax") or 0),
            "pf_deduction": float(salary_calc_dict.get("pf_employee") or 0),
            "pt_deduction": float(salary_calc_dict.get("professional_tax") or 0),
            "esi_employee": float(salary_calc_dict.get("esi_employee") or 0),
            "loan_deductions": float(salary_calc_dict.get("loan_deductions") or 0),
            "advance_deductions": float(salary_calc_dict.get("advance_deductions") or 0),
            "lop_deduction": float(salary_calc_dict.get("lop_deduction") or 0),
            "total_deductions": float(salary_calc_dict.get("total_deductions") or 0),
            "net_pay": float(salary_calc_dict.get("net_salary") or 0),
            "total_days": salary_calc_dict.get("total_days", 30),
            "working_days": salary_calc_dict.get("working_days", 30),
            "present_days": salary_calc_dict.get("present_days", 30),
            "absent_days": salary_calc_dict.get("absent_days", 0),
            "leave_days": salary_calc_dict.get("leave_days", 0),
            # LOP fix: use calculation_details first, fallback to absent_days
            "lop_days": float(
                salary_calc_dict.get("calculation_details", {}).get("lop_days")
                or salary_calc_dict.get("absent_days")
                or 0.0
            ),
            "earnings": payslip_data.get("earnings", []),
            "deductions": payslip_data.get("deductions", []),
            "attendance_records": await _fetch_attendance_records(
                employee.id,
                period.start_date.month,
                period.start_date.year,
                db,
            ),
        }
        
        from fastapi import Response
        pdf_bytes = pdf_service.generate_salary_slip(payroll_dict, employee_dict)
        month_idx = int(period.start_date.month or 1)
        month_name = calendar.month_abbr[month_idx]
        filename = f"salary-slip-{employee.emp_code}-{month_name}-{period.start_date.year}.pdf"

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        with open("router_error.log", "w") as f:
            import traceback
            f.write(str(e) + "\n" + traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
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

    # Bulk fetch metrics for all employees in the period
    bulk_metrics = await _get_bulk_attendance_metrics(period.start_date, period.end_date, db)

    payslips: List[Dict] = []
    for calc, employee in rows:
        salary_calc_dict = _build_salary_calc_dict(calc, period)
        
        # Enrich with bulk metrics
        metrics = bulk_metrics.get(employee.id, {"late_count": 0, "halfday_count": 0})
        salary_calc_dict["late_count"] = metrics["late_count"]
        salary_calc_dict["halfday_count"] = metrics["halfday_count"]

        employee_dict = _build_employee_dict(employee)
        payslip_data = payslip_generator.generate_payslip_data(
            employee=employee_dict,
            salary_calc=salary_calc_dict,
        )
        payslip_data["id"] = calc.id # Add ID for frontend download
        payslips.append(payslip_data)

    return {
        "period_id": period_id,
        "period_name": period.period_name,
        "total_payslips": len(payslips),
        "payslips": payslips,
    }
