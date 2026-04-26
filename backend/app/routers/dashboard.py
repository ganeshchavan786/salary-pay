from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from datetime import date, datetime

from app.database import get_db
from app.models.employee import Employee, EmployeeStatus
from app.models.attendance_daily import AttendanceDaily, AttendanceStatus
from app.models.attendance import Attendance, AttendanceType
from app.models.leave import Leave, LeaveStatus
from app.models.user import User
from app.utils.deps import require_supervisor

router = APIRouter(tags=["Dashboard"])


@router.get("/summary")
async def dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Dashboard summary statistics."""
    today = date.today()
    first_of_month = today.replace(day=1)

    # Total and active employees
    total_result = await db.execute(select(func.count(Employee.id)))
    total_employees = total_result.scalar() or 0

    active_result = await db.execute(
        select(func.count(Employee.id)).where(Employee.status == EmployeeStatus.ACTIVE)
    )
    active_employees = active_result.scalar() or 0

    # Present today — from attendance_daily
    present_result = await db.execute(
        select(func.count(AttendanceDaily.id)).where(
            and_(
                AttendanceDaily.date == today,
                AttendanceDaily.status.in_([AttendanceStatus.PRESENT, AttendanceStatus.HALFDAY]),
            )
        )
    )
    present_from_daily = present_result.scalar() or 0

    # Fallback: count from raw face-recognition attendance table
    raw_present_result = await db.execute(
        select(func.count(func.distinct(Attendance.emp_id))).where(
            and_(
                Attendance.date == today,
                Attendance.attendance_type == AttendanceType.CHECK_IN,
            )
        )
    )
    present_from_raw = raw_present_result.scalar() or 0
    present_today = max(present_from_daily, present_from_raw)

    # On leave today
    on_leave_result = await db.execute(
        select(func.count(AttendanceDaily.id)).where(
            and_(
                AttendanceDaily.date == today,
                AttendanceDaily.status == AttendanceStatus.LEAVE,
            )
        )
    )
    on_leave_today = on_leave_result.scalar() or 0

    absent_today = max(0, active_employees - present_today - on_leave_today)

    # Pending leaves
    pending_result = await db.execute(
        select(func.count(Leave.id)).where(Leave.status == LeaveStatus.PENDING)
    )
    pending_leaves = pending_result.scalar() or 0

    # New joiners this month
    new_joiners_result = await db.execute(
        select(func.count(Employee.id)).where(
            Employee.joining_date >= first_of_month
        )
    )
    new_joiners = new_joiners_result.scalar() or 0

    attendance_rate = round(present_today / active_employees * 100) if active_employees > 0 else 0

    return {
        "total_employees": total_employees,
        "active_employees": active_employees,
        "present_today": present_today,
        "absent_today": absent_today,
        "on_leave_today": on_leave_today,
        "pending_leaves": pending_leaves,
        "new_joiners_this_month": new_joiners,
        "attendance_rate": attendance_rate,
    }


@router.get("/today-attendance")
async def today_attendance(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Today's attendance records with employee info."""
    today = date.today()
    result = await db.execute(
        select(AttendanceDaily, Employee)
        .join(Employee, AttendanceDaily.emp_id == Employee.id)
        .where(AttendanceDaily.date == today)
        .order_by(AttendanceDaily.check_in)
    )
    rows = result.all()
    records = []
    for att, emp in rows:
        records.append({
            "id": att.id,
            "emp_id": att.emp_id,
            "emp_name": emp.name,
            "emp_code": emp.emp_code,
            "department": emp.department,
            "check_in": att.check_in.isoformat() if att.check_in else None,
            "check_out": att.check_out.isoformat() if att.check_out else None,
            "status": att.status.value if att.status else "absent",
            "late_mark_type": att.late_mark_type.value if att.late_mark_type else "none",
            "is_late_mark": att.is_late_mark or False,
        })
    return {"records": records, "date": today.isoformat()}


@router.get("/pending-leaves")
async def pending_leaves(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Pending leave requests (limit 10) with employee info."""
    result = await db.execute(
        select(Leave, Employee)
        .join(Employee, Leave.emp_id == Employee.id)
        .where(Leave.status == LeaveStatus.PENDING)
        .order_by(Leave.applied_at.desc())
        .limit(10)
    )
    rows = result.all()
    leaves = []
    for leave, emp in rows:
        leaves.append({
            "id": leave.id,
            "emp_id": leave.emp_id,
            "emp_name": emp.name,
            "emp_code": emp.emp_code,
            "department": emp.department,
            "leave_type": leave.leave_type.value if leave.leave_type else None,
            "from_date": leave.from_date.isoformat() if leave.from_date else None,
            "to_date": leave.to_date.isoformat() if leave.to_date else None,
            "total_days": float(leave.total_days) if leave.total_days else 0,
            "reason": leave.reason,
            "status": leave.status.value if leave.status else "pending",
            "applied_at": leave.applied_at.isoformat() if leave.applied_at else None,
        })
    return {"leaves": leaves}
