from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Optional
from datetime import date, datetime
from decimal import Decimal
import uuid
import calendar

from app.database import get_db
from app.models.payroll import Payroll, PayrollStatus
from app.models.employee import Employee, EmployeeStatus
from app.models.attendance_daily import AttendanceDaily, AttendanceStatus
from app.models.leave import LeaveBalance
from app.models.holiday import Holiday
from app.models.user import User
from app.schemas.payroll import PayrollRunRequest
from app.services import payroll_service
from app.services import pdf_service
from app.services import policy_service
from app.utils.deps import get_current_user, require_admin, require_supervisor

router = APIRouter(tags=["Payroll"])


@router.get("/my")
async def get_my_payroll(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get own payroll history."""
    if not current_user.emp_id:
        return {"payrolls": []}
    result = await db.execute(
        select(Payroll).where(Payroll.emp_id == current_user.emp_id)
        .order_by(Payroll.year.desc(), Payroll.month.desc())
    )
    payrolls = result.scalars().all()
    return {"payrolls": [_payroll_to_dict(p) for p in payrolls]}


@router.post("/run")
async def run_payroll(
    data: PayrollRunRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Run monthly payroll for all active employees."""
    m, y = data.month, data.year
    from_date = date(y, m, 1)
    last_day = calendar.monthrange(y, m)[1]
    to_date = date(y, m, last_day)

    # Get company policy
    policy = await policy_service.get_policy(db)

    # Get holidays for this month
    hol_result = await db.execute(
        select(Holiday.date).where(
            and_(Holiday.year == y, Holiday.is_active == True)
        )
    )
    holiday_dates = [row[0] for row in hol_result.all()]
    working_days = payroll_service.calculate_working_days(y, m, holiday_dates)

    # Get all active employees
    emp_result = await db.execute(
        select(Employee).where(Employee.status == EmployeeStatus.ACTIVE)
    )
    employees = emp_result.scalars().all()

    results = []
    errors = []

    for emp in employees:
        try:
            if not emp.salary:
                errors.append({"emp_code": emp.emp_code, "status": "error", "error": f"Employee {emp.emp_code} has no salary configured."})
                continue

            # Check if already paid
            existing_result = await db.execute(
                select(Payroll).where(
                    and_(Payroll.emp_id == emp.id, Payroll.month == m, Payroll.year == y)
                )
            )
            existing = existing_result.scalar_one_or_none()
            if existing and existing.status == PayrollStatus.PAID:
                results.append({"emp_code": emp.emp_code, "status": "skipped"})
                continue

            # Get attendance for month
            att_result = await db.execute(
                select(AttendanceDaily).where(
                    and_(
                        AttendanceDaily.emp_id == emp.id,
                        AttendanceDaily.date >= from_date,
                        AttendanceDaily.date <= to_date,
                    )
                )
            )
            att_records = att_result.scalars().all()
            present_days = sum(1 for r in att_records if r.status == AttendanceStatus.PRESENT)
            half_days = sum(1 for r in att_records if r.status == AttendanceStatus.HALFDAY)

            # Calculate OT hours
            total_ot_hours = 0.0
            for record in att_records:
                if record.status in (AttendanceStatus.PRESENT, AttendanceStatus.HALFDAY):
                    if record.check_in and record.check_out:
                        working_hours = (record.check_out - record.check_in).total_seconds() / 3600
                        ot_hours = payroll_service.calculate_ot_hours(working_hours, policy)
                        total_ot_hours += ot_hours
            ot_hours_decimal = Decimal(str(total_ot_hours)).quantize(Decimal("0.01"))

            # Get leave balance
            bal_result = await db.execute(
                select(LeaveBalance).where(
                    and_(LeaveBalance.emp_id == emp.id, LeaveBalance.year == y)
                )
            )
            bal = bal_result.scalar_one_or_none()
            lwp_days = Decimal(str(bal.lwp_days or 0)) if bal else Decimal("0")
            half_day_from_late = Decimal(str(bal.half_day_from_late or 0)) if bal else Decimal("0")
            lop_days = lwp_days + Decimal(str(half_days)) * Decimal("0.5")

            gross = Decimal(str(emp.salary))
            breakdown = payroll_service.calculate_salary_breakdown(gross)
            lop_deduct = payroll_service.calculate_lop_deduction(gross, working_days, lop_days)
            late_deduct = payroll_service.calculate_late_deduction(gross, working_days, half_day_from_late)
            total_deductions = Decimal("200") + lop_deduct + late_deduct
            net_pay = max(Decimal("0"), gross - total_deductions)

            if existing:
                existing.working_days = working_days
                existing.present_days = present_days
                existing.lop_days = lop_days
                existing.half_days = half_days
                existing.ot_hours = ot_hours_decimal
                existing.gross_salary = gross
                existing.basic_salary = breakdown["basic_salary"]
                existing.hra = breakdown["hra"]
                existing.travel_allowance = breakdown["travel_allowance"]
                existing.special_allowance = breakdown["special_allowance"]
                existing.pt_deduction = Decimal("200")
                existing.pf_deduction = Decimal("0")
                existing.lop_deduction = lop_deduct
                existing.late_mark_deduction = late_deduct
                existing.total_deductions = total_deductions
                existing.net_pay = net_pay
                existing.status = PayrollStatus.PROCESSED
                existing.processed_by = current_user.id
                existing.updated_at = datetime.utcnow()
            else:
                payroll = Payroll(
                    id=str(uuid.uuid4()),
                    emp_id=emp.id,
                    month=m,
                    year=y,
                    working_days=working_days,
                    present_days=present_days,
                    lop_days=lop_days,
                    half_days=half_days,
                    ot_hours=ot_hours_decimal,
                    gross_salary=gross,
                    basic_salary=breakdown["basic_salary"],
                    hra=breakdown["hra"],
                    travel_allowance=breakdown["travel_allowance"],
                    special_allowance=breakdown["special_allowance"],
                    pt_deduction=Decimal("200"),
                    pf_deduction=Decimal("0"),
                    lop_deduction=lop_deduct,
                    late_mark_deduction=late_deduct,
                    total_deductions=total_deductions,
                    net_pay=net_pay,
                    status=PayrollStatus.PROCESSED,
                    processed_by=current_user.id,
                )
                db.add(payroll)

            results.append({"emp_code": emp.emp_code, "status": "processed", "net_pay": float(net_pay)})

        except Exception as e:
            errors.append({"emp_code": emp.emp_code, "status": "error", "error": str(e)})

    await db.commit()
    return {
        "message": f"Payroll processed for {m}/{y}",
        "processed": len(results),
        "errors": len(errors),
        "results": results,
        "error_details": errors,
    }


@router.get("")
async def list_payroll(
    month: Optional[int] = None,
    year: Optional[int] = None,
    emp_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """List payroll records with optional filters."""
    query = select(Payroll, Employee).join(Employee, Payroll.emp_id == Employee.id)
    if month:
        query = query.where(Payroll.month == month)
    if year:
        query = query.where(Payroll.year == year)
    if emp_id:
        query = query.where(Payroll.emp_id == emp_id)
    query = query.order_by(Payroll.year.desc(), Payroll.month.desc())
    result = await db.execute(query)
    rows = result.all()
    payrolls = []
    for p, emp in rows:
        d = _payroll_to_dict(p)
        d["emp_name"] = emp.name
        d["emp_code"] = emp.emp_code
        d["designation"] = emp.designation
        payrolls.append(d)
    return {"payrolls": payrolls}


@router.get("/{emp_id}/history")
async def get_employee_payroll_history(
    emp_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Get payroll history for a specific employee."""
    result = await db.execute(
        select(Payroll).where(Payroll.emp_id == emp_id)
        .order_by(Payroll.year.desc(), Payroll.month.desc())
    )
    payrolls = result.scalars().all()
    return {"payrolls": [_payroll_to_dict(p) for p in payrolls]}


@router.get("/{payroll_id}/slip")
async def download_salary_slip(
    payroll_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Generate and download PDF salary slip."""
    result = await db.execute(
        select(Payroll, Employee).join(Employee, Payroll.emp_id == Employee.id)
        .where(Payroll.id == payroll_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Payroll record not found.")
    payroll, emp = row

    payroll_dict = _payroll_to_dict(payroll)
    employee_dict = {
        "name": emp.name,
        "emp_code": emp.emp_code,
        "designation": emp.designation or "",
        "department": emp.department or "",
    }

    pdf_bytes = pdf_service.generate_salary_slip(payroll_dict, employee_dict)
    month_name = calendar.month_abbr[payroll.month]
    filename = f"salary-slip-{emp.emp_code}-{month_name}-{payroll.year}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.put("/{payroll_id}/mark-paid")
async def mark_as_paid(
    payroll_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Mark a payroll record as paid."""
    result = await db.execute(select(Payroll).where(Payroll.id == payroll_id))
    payroll = result.scalar_one_or_none()
    if not payroll:
        raise HTTPException(status_code=404, detail="Payroll record not found.")
    payroll.status = PayrollStatus.PAID
    payroll.paid_at = datetime.utcnow()
    await db.commit()
    return {"message": "Marked as paid.", "payroll": _payroll_to_dict(payroll)}


def _payroll_to_dict(p: Payroll) -> dict:
    return {
        "id": p.id,
        "emp_id": p.emp_id,
        "month": p.month,
        "year": p.year,
        "working_days": p.working_days,
        "present_days": p.present_days,
        "lop_days": float(p.lop_days or 0),
        "half_days": p.half_days or 0,
        "ot_hours": float(p.ot_hours or 0),
        "gross_salary": float(p.gross_salary or 0),
        "basic_salary": float(p.basic_salary or 0),
        "hra": float(p.hra or 0),
        "travel_allowance": float(p.travel_allowance or 0),
        "special_allowance": float(p.special_allowance or 0),
        "pt_deduction": float(p.pt_deduction or 200),
        "pf_deduction": float(p.pf_deduction or 0),
        "lop_deduction": float(p.lop_deduction or 0),
        "late_mark_deduction": float(p.late_mark_deduction or 0),
        "total_deductions": float(p.total_deductions or 0),
        "net_pay": float(p.net_pay or 0),
        "status": p.status.value if p.status else "draft",
        "paid_at": p.paid_at.isoformat() if p.paid_at else None,
    }
