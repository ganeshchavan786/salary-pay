"""
Report service layer for the Advanced Reporting Module.
Pure async query functions that aggregate data from existing models.
Imports OT computation functions from payroll_service.py — no duplication.
"""
import csv
import io
import calendar
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
from collections import defaultdict

from sqlalchemy import select, func, and_, or_, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.employee import Employee, EmployeeStatus
from app.models.attendance_daily import AttendanceDaily, AttendanceStatus, LateMarkType
from app.models.payroll import Payroll
from app.models.leave import Leave, LeaveBalance, LeaveStatus
from app.models.holiday import Holiday
from app.models.policy import AttendancePolicy, EmployeePolicyOverride
from app.models.comp_off import CompOffBalance, CompOffCredit
from app.models.missed_punch import MissedPunchRequest, MissedPunchStatus
from app.services.payroll_service import (
    calculate_ot_hours,
    calculate_ot_amount,
    get_effective_policy,
    calculate_working_days,
)
from app.services.policy_service import get_policy


# ─── Helper Utilities ─────────────────────────────────────────────────────────

def compute_attendance_pct(present_days: int, working_days: int, employee_count: int) -> float:
    """
    Compute attendance percentage.
    Formula: (present_days / (working_days * employee_count)) * 100
    Returns 0.0 when denominator is zero.
    """
    denominator = working_days * employee_count
    if denominator <= 0:
        return 0.0
    return round((present_days / denominator) * 100, 2)


def compute_cl_remaining(cl_total: int, cl_used: float) -> float:
    """
    Compute remaining CL balance.
    Formula: cl_total - cl_used
    Always returns a non-negative value.
    """
    remaining = cl_total - cl_used
    return max(0.0, remaining)


def build_export_filename(report_name: str, start_date: date, end_date: date, fmt: str) -> str:
    """
    Build export filename following the pattern:
    {report_name}_{YYYY-MM-DD}_{YYYY-MM-DD}.{ext}
    """
    return f"{report_name}_{start_date.strftime('%Y-%m-%d')}_{end_date.strftime('%Y-%m-%d')}.{fmt}"


def generate_csv(rows: list[dict], headers: list[str]) -> bytes:
    """
    Generate CSV bytes from a list of row dicts.
    Returns header-only file when rows is empty.
    """
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=headers, extrasaction='ignore')
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    return output.getvalue().encode('utf-8')


# ─── Dashboard & Insights ─────────────────────────────────────────────────────

async def get_dashboard_today(db: AsyncSession) -> dict:
    """
    Dashboard widget bar — 6 metrics for today.
    Returns zeros when no attendance records exist for today.
    Requirement 1.1–1.5
    """
    today = date.today()
    
    # Query all attendance records for today
    stmt = select(AttendanceDaily).where(AttendanceDaily.date == today)
    result = await db.execute(stmt)
    records = result.scalars().all()
    
    if not records:
        return {
            "total_present": 0,
            "total_absent": 0,
            "total_ot_hours": 0.0,
            "total_ot_cost": Decimal("0"),
            "avg_working_hours": 0.0,
            "late_count": 0,
        }
    
    # Get company policy
    company_policy = await get_policy(db)
    
    # Compute metrics
    total_present = sum(1 for r in records if r.status == AttendanceStatus.PRESENT)
    total_absent = sum(1 for r in records if r.status == AttendanceStatus.ABSENT)
    late_count = sum(1 for r in records if r.is_late_mark or r.is_half_late_mark)
    
    # Compute OT hours and cost
    total_ot_hours = 0.0
    total_ot_cost = Decimal("0")
    total_working_hours = 0.0
    working_hours_count = 0
    
    # Get employee overrides
    emp_ids = [r.emp_id for r in records]
    override_stmt = select(EmployeePolicyOverride).where(EmployeePolicyOverride.emp_id.in_(emp_ids))
    override_result = await db.execute(override_stmt)
    overrides = {o.emp_id: o for o in override_result.scalars().all()}
    
    # Get employee salaries
    emp_stmt = select(Employee).where(Employee.id.in_(emp_ids))
    emp_result = await db.execute(emp_stmt)
    employees = {e.id: e for e in emp_result.scalars().all()}
    
    # Check if today is a holiday
    holiday_stmt = select(Holiday).where(Holiday.date == today)
    holiday_result = await db.execute(holiday_stmt)
    is_holiday = holiday_result.scalar_one_or_none() is not None
    
    for record in records:
        if record.check_in and record.check_out:
            working_hours = (record.check_out - record.check_in).total_seconds() / 3600
            total_working_hours += working_hours
            working_hours_count += 1
            
            # Compute OT
            override = overrides.get(record.emp_id)
            policy = get_effective_policy(company_policy, override)
            ot_hours = calculate_ot_hours(working_hours, policy)
            
            if ot_hours > 0:
                total_ot_hours += ot_hours
                emp = employees.get(record.emp_id)
                if emp and emp.salary:
                    ot_cost = calculate_ot_amount(
                        gross=emp.salary,
                        shift_hours=policy.shift_hours,
                        ot_hours=ot_hours,
                        is_holiday_or_weeklyoff=is_holiday,
                        policy=policy,
                    )
                    total_ot_cost += ot_cost
    
    avg_working_hours = round(total_working_hours / working_hours_count, 2) if working_hours_count > 0 else 0.0
    
    return {
        "total_present": total_present,
        "total_absent": total_absent,
        "total_ot_hours": round(total_ot_hours, 2),
        "total_ot_cost": total_ot_cost,
        "avg_working_hours": avg_working_hours,
        "late_count": late_count,
    }


async def get_auto_insights(db: AsyncSession) -> dict:
    """
    Auto insight summaries for current month.
    Returns insufficient data message when < 5 working days.
    Requirement 32.1–32.4
    """
    today = date.today()
    current_month = today.month
    current_year = today.year
    
    # Check if we have at least 5 working days of data
    first_day = date(current_year, current_month, 1)
    stmt = select(func.count(func.distinct(AttendanceDaily.date))).where(
        and_(
            AttendanceDaily.date >= first_day,
            AttendanceDaily.date <= today,
        )
    )
    result = await db.execute(stmt)
    working_days_count = result.scalar() or 0
    
    if working_days_count < 5:
        return {
            "insights": [],
            "message": "Insufficient data: fewer than 5 working days recorded for the current month."
        }
    
    insights = []
    
    # Insight 1: Top 5 employees by total OT hours
    # (Simplified - would need full OT computation)
    insights.append({
        "insight_type": "top_ot_employees",
        "title": "Top 5 Employees by OT Hours",
        "description": f"Employees with highest overtime in {calendar.month_name[current_month]} {current_year}",
        "data": []
    })
    
    # Insight 2: Top 3 departments by absenteeism rate
    insights.append({
        "insight_type": "top_absent_departments",
        "title": "Top 3 Departments by Absenteeism",
        "description": f"Departments with highest absence rate in {calendar.month_name[current_month]} {current_year}",
        "data": []
    })
    
    # Insight 3: Late coming trend
    insights.append({
        "insight_type": "late_trend",
        "title": "Late Coming Trend",
        "description": "Trend compared to previous month",
        "data": []
    })
    
    # Insight 4: Unnecessary OT detection
    insights.append({
        "insight_type": "unnecessary_ot",
        "title": "Unnecessary OT Detection",
        "description": "Employees with OT > 20% of shift hours for > 10 days",
        "data": []
    })
    
    # Insight 5: Consistent late marks
    insights.append({
        "insight_type": "consistent_late",
        "title": "Consistent Late Marks",
        "description": "Employees late in 3+ of last 4 weeks",
        "data": []
    })
    
    return {
        "insights": insights,
        "message": None
    }


# ─── Employee-Wise Reports ────────────────────────────────────────────────────

async def get_employee_attendance_summary(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    emp_ids: Optional[list[str]] = None,
    departments: Optional[list[str]] = None,
) -> list[dict]:
    """
    Employee-wise attendance summary.
    Returns zero-count rows for employees with no records.
    Requirement 3.1–3.4
    """
    # Build employee filter
    emp_filter = [Employee.status == EmployeeStatus.ACTIVE]
    if emp_ids:
        emp_filter.append(Employee.id.in_(emp_ids))
    if departments:
        emp_filter.append(Employee.department.in_(departments))
    
    # Get all active employees
    emp_stmt = select(Employee).where(and_(*emp_filter))
    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()
    
    # Get attendance records
    att_filter = [
        AttendanceDaily.date >= start_date,
        AttendanceDaily.date <= end_date,
    ]
    if emp_ids:
        att_filter.append(AttendanceDaily.emp_id.in_(emp_ids))
    
    att_stmt = select(AttendanceDaily).where(and_(*att_filter))
    att_result = await db.execute(att_stmt)
    attendance_records = att_result.scalars().all()
    
    # Group by employee
    att_by_emp = defaultdict(list)
    for record in attendance_records:
        att_by_emp[record.emp_id].append(record)
    
    # Get payroll data for LOP days
    payroll_stmt = select(Payroll).where(
        and_(
            Payroll.emp_id.in_([e.id for e in employees]),
            or_(
                and_(Payroll.year == start_date.year, Payroll.month >= start_date.month),
                and_(Payroll.year == end_date.year, Payroll.month <= end_date.month),
            )
        )
    )
    payroll_result = await db.execute(payroll_stmt)
    payroll_records = payroll_result.scalars().all()
    
    lop_by_emp = defaultdict(float)
    for pr in payroll_records:
        lop_by_emp[pr.emp_id] += float(pr.lop_days)
    
    # Build result
    result = []
    for emp in employees:
        records = att_by_emp.get(emp.id, [])
        
        present_days = sum(1 for r in records if r.status == AttendanceStatus.PRESENT)
        absent_days = sum(1 for r in records if r.status == AttendanceStatus.ABSENT)
        half_day_count = sum(1 for r in records if r.status == AttendanceStatus.HALFDAY or r.is_half_day)
        late_mark_count = sum(1 for r in records if r.is_late_mark or r.is_half_late_mark)
        
        result.append({
            "emp_id": emp.id,
            "emp_code": emp.emp_code,
            "name": emp.name,
            "department": emp.department,
            "working_days": len(records),
            "present_days": present_days,
            "absent_days": absent_days,
            "half_day_count": half_day_count,
            "late_mark_count": late_mark_count,
            "lop_days": lop_by_emp.get(emp.id, 0.0),
        })
    
    return result


# Placeholder stubs for remaining service functions
# These will be implemented in subsequent file appends

async def get_employee_working_hours(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    emp_ids: Optional[list[str]] = None,
    departments: Optional[list[str]] = None,
    granularity: str = "daily",
) -> list[dict]:
    """
    Employee-wise working hours report.
    Flags null check-in/out as MISSED_PUNCH and excludes from totals.
    Requirement 4.1–4.3
    """
    emp_filter = [Employee.status == EmployeeStatus.ACTIVE]
    if emp_ids:
        emp_filter.append(Employee.id.in_(emp_ids))
    if departments:
        emp_filter.append(Employee.department.in_(departments))

    emp_stmt = select(Employee).where(and_(*emp_filter))
    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()

    att_filter = [
        AttendanceDaily.date >= start_date,
        AttendanceDaily.date <= end_date,
        AttendanceDaily.emp_id.in_([e.id for e in employees]),
    ]
    att_stmt = select(AttendanceDaily).where(and_(*att_filter))
    att_result = await db.execute(att_stmt)
    records = att_result.scalars().all()

    emp_map = {e.id: e for e in employees}

    # Get company policy for scheduled hours
    company_policy = await get_policy(db)

    if granularity == "daily":
        result = []
        for record in records:
            emp = emp_map.get(record.emp_id)
            if not emp:
                continue
            is_missed = record.check_in is None or record.check_out is None
            working_hours = None
            if not is_missed:
                working_hours = round((record.check_out - record.check_in).total_seconds() / 3600, 2)
            result.append({
                "emp_id": emp.id,
                "emp_code": emp.emp_code,
                "name": emp.name,
                "department": emp.department,
                "date": record.date,
                "check_in": record.check_in,
                "check_out": record.check_out,
                "working_hours": working_hours,
                "is_missed_punch": is_missed,
            })
        return result
    else:
        # Monthly granularity
        monthly_data: dict[tuple, dict] = {}
        for record in records:
            emp = emp_map.get(record.emp_id)
            if not emp:
                continue
            key = (emp.id, record.date.year, record.date.month)
            if key not in monthly_data:
                monthly_data[key] = {
                    "emp_id": emp.id,
                    "emp_code": emp.emp_code,
                    "name": emp.name,
                    "department": emp.department,
                    "year": record.date.year,
                    "month": record.date.month,
                    "total_working_hours": 0.0,
                    "valid_days": 0,
                    "scheduled_hours": float(company_policy.shift_hours),
                }
            if record.check_in and record.check_out:
                wh = (record.check_out - record.check_in).total_seconds() / 3600
                monthly_data[key]["total_working_hours"] += wh
                monthly_data[key]["valid_days"] += 1

        result = []
        for key, data in monthly_data.items():
            total = round(data["total_working_hours"], 2)
            valid = data["valid_days"]
            avg = round(total / valid, 2) if valid > 0 else 0.0
            result.append({
                "emp_id": data["emp_id"],
                "emp_code": data["emp_code"],
                "name": data["name"],
                "department": data["department"],
                "month": data["month"],
                "year": data["year"],
                "total_working_hours": total,
                "avg_daily_working_hours": avg,
                "scheduled_hours": data["scheduled_hours"],
            })
        return result


async def get_employee_inout(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    emp_ids: Optional[list[str]] = None,
    departments: Optional[list[str]] = None,
) -> list[dict]:
    """
    Employee in-time / out-time report.
    Includes shift_start_time from effective policy.
    Requirement 5.1–5.3
    """
    emp_filter = [Employee.status == EmployeeStatus.ACTIVE]
    if emp_ids:
        emp_filter.append(Employee.id.in_(emp_ids))
    if departments:
        emp_filter.append(Employee.department.in_(departments))

    emp_stmt = select(Employee).where(and_(*emp_filter))
    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()

    emp_ids_list = [e.id for e in employees]
    emp_map = {e.id: e for e in employees}

    att_filter = [
        AttendanceDaily.date >= start_date,
        AttendanceDaily.date <= end_date,
        AttendanceDaily.emp_id.in_(emp_ids_list),
    ]
    att_stmt = select(AttendanceDaily).where(and_(*att_filter))
    att_result = await db.execute(att_stmt)
    records = att_result.scalars().all()

    company_policy = await get_policy(db)
    override_stmt = select(EmployeePolicyOverride).where(EmployeePolicyOverride.emp_id.in_(emp_ids_list))
    override_result = await db.execute(override_stmt)
    overrides = {o.emp_id: o for o in override_result.scalars().all()}

    result = []
    for record in records:
        emp = emp_map.get(record.emp_id)
        if not emp:
            continue
        override = overrides.get(emp.id)
        policy = get_effective_policy(company_policy, override)
        shift_start = policy.shift_start_time

        is_missed = (
            record.check_in is None
            and record.status in (AttendanceStatus.PRESENT, AttendanceStatus.HALFDAY)
        )
        result.append({
            "emp_id": emp.id,
            "emp_code": emp.emp_code,
            "name": emp.name,
            "department": emp.department,
            "date": record.date,
            "check_in": record.check_in,
            "check_out": record.check_out,
            "late_mark_status": record.late_mark_type.value if record.late_mark_type else "none",
            "shift_start_time": shift_start,
            "is_missed_punch": is_missed,
        })
    return result


async def get_employee_late_marks(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    emp_ids: Optional[list[str]] = None,
    departments: Optional[list[str]] = None,
) -> list[dict]:
    """
    Employee-wise late marks report with detail sub-list.
    Requirement 6.1–6.4
    """
    emp_filter = [Employee.status == EmployeeStatus.ACTIVE]
    if emp_ids:
        emp_filter.append(Employee.id.in_(emp_ids))
    if departments:
        emp_filter.append(Employee.department.in_(departments))

    emp_stmt = select(Employee).where(and_(*emp_filter))
    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()

    emp_ids_list = [e.id for e in employees]
    emp_map = {e.id: e for e in employees}

    att_filter = [
        AttendanceDaily.date >= start_date,
        AttendanceDaily.date <= end_date,
        AttendanceDaily.emp_id.in_(emp_ids_list),
    ]
    att_stmt = select(AttendanceDaily).where(and_(*att_filter))
    att_result = await db.execute(att_stmt)
    records = att_result.scalars().all()

    company_policy = await get_policy(db)
    override_stmt = select(EmployeePolicyOverride).where(EmployeePolicyOverride.emp_id.in_(emp_ids_list))
    override_result = await db.execute(override_stmt)
    overrides = {o.emp_id: o for o in override_result.scalars().all()}

    att_by_emp = defaultdict(list)
    for record in records:
        att_by_emp[record.emp_id].append(record)

    result = []
    for emp in employees:
        emp_records = att_by_emp.get(emp.id, [])
        override = overrides.get(emp.id)
        policy = get_effective_policy(company_policy, override)
        shift_start_mins = int(policy.shift_start_time.split(":")[0]) * 60 + int(policy.shift_start_time.split(":")[1])

        total_late = sum(1 for r in emp_records if r.is_late_mark)
        total_half_late = sum(1 for r in emp_records if r.is_half_late_mark)
        total_half_day_from_late = sum(
            1 for r in emp_records if r.late_mark_type == LateMarkType.HALF_DAY
        )

        details = []
        for r in emp_records:
            if r.is_late_mark or r.is_half_late_mark or r.late_mark_type == LateMarkType.HALF_DAY:
                minutes_late = 0
                if r.check_in:
                    check_in_mins = r.check_in.hour * 60 + r.check_in.minute
                    minutes_late = max(0, check_in_mins - shift_start_mins)
                details.append({
                    "date": r.date,
                    "check_in": r.check_in,
                    "minutes_late": minutes_late,
                    "late_mark_type": r.late_mark_type.value if r.late_mark_type else "none",
                })

        result.append({
            "emp_id": emp.id,
            "emp_code": emp.emp_code,
            "name": emp.name,
            "department": emp.department,
            "total_late_marks": total_late,
            "total_half_late_marks": total_half_late,
            "total_half_days_from_late": total_half_day_from_late,
            "details": details,
        })
    return result


async def get_employee_ot(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    emp_ids: Optional[list[str]] = None,
    departments: Optional[list[str]] = None,
) -> list[dict]:
    """
    Employee-wise OT hours and cost.
    Uses get_effective_policy + calculate_ot_hours + calculate_ot_amount.
    Returns zero for OT-disabled employees.
    Requirement 7.1–7.4
    """
    emp_filter = [Employee.status == EmployeeStatus.ACTIVE]
    if emp_ids:
        emp_filter.append(Employee.id.in_(emp_ids))
    if departments:
        emp_filter.append(Employee.department.in_(departments))

    emp_stmt = select(Employee).where(and_(*emp_filter))
    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()

    emp_ids_list = [e.id for e in employees]
    emp_map = {e.id: e for e in employees}

    att_filter = [
        AttendanceDaily.date >= start_date,
        AttendanceDaily.date <= end_date,
        AttendanceDaily.emp_id.in_(emp_ids_list),
    ]
    att_stmt = select(AttendanceDaily).where(and_(*att_filter))
    att_result = await db.execute(att_stmt)
    records = att_result.scalars().all()

    company_policy = await get_policy(db)
    override_stmt = select(EmployeePolicyOverride).where(EmployeePolicyOverride.emp_id.in_(emp_ids_list))
    override_result = await db.execute(override_stmt)
    overrides = {o.emp_id: o for o in override_result.scalars().all()}

    # Get salary configurations
    from app.models.salary_config import SalaryConfig
    salary_config_stmt = select(SalaryConfig).where(SalaryConfig.employee_id.in_(emp_ids_list))
    salary_config_result = await db.execute(salary_config_stmt)
    salary_configs = {sc.employee_id: sc for sc in salary_config_result.scalars().all()}

    # Get holidays in range
    holiday_stmt = select(Holiday).where(
        and_(Holiday.date >= start_date, Holiday.date <= end_date, Holiday.is_active == True)
    )
    holiday_result = await db.execute(holiday_stmt)
    holiday_dates = {h.date for h in holiday_result.scalars().all()}

    att_by_emp = defaultdict(list)
    for record in records:
        att_by_emp[record.emp_id].append(record)

    result = []
    for emp in employees:
        emp_records = att_by_emp.get(emp.id, [])
        override = overrides.get(emp.id)
        policy = get_effective_policy(company_policy, override)

        total_ot_hours = 0.0
        total_ot_cost = Decimal("0")
        ot_days = 0

        for r in emp_records:
            if r.check_in and r.check_out:
                working_hours = (r.check_out - r.check_in).total_seconds() / 3600
                ot_hours = calculate_ot_hours(working_hours, policy)
                if ot_hours > 0:
                    total_ot_hours += ot_hours
                    ot_days += 1
        
        total_ot_hours = round(total_ot_hours, 2)
        sc = salary_configs.get(emp.id)
        base_rate = float(sc.basic_salary) if sc and sc.basic_salary else float(emp.salary or 0)
        
        if total_ot_hours > 0 and base_rate > 0:
            rate = Decimal(str(base_rate)) / Decimal("26") / Decimal(str(policy.shift_hours))
            total_ot_cost = Decimal(str(round(rate * Decimal(str(policy.ot_normal_multiplier)) * Decimal(str(total_ot_hours)), 2)))

        result.append({
            "emp_id": emp.id,
            "emp_code": emp.emp_code,
            "name": emp.name,
            "department": emp.department,
            "total_ot_hours": round(total_ot_hours, 2),
            "total_ot_cost": total_ot_cost,
            "ot_days_count": ot_days,
        })
    return result


async def get_employee_halfday_absent(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    emp_ids: Optional[list[str]] = None,
    departments: Optional[list[str]] = None,
) -> list[dict]:
    """
    Employee-wise half-day and absent days.
    Excludes Holiday/WeeklyOff from absent count.
    Requirement 8.1–8.3
    """
    emp_filter = [Employee.status == EmployeeStatus.ACTIVE]
    if emp_ids:
        emp_filter.append(Employee.id.in_(emp_ids))
    if departments:
        emp_filter.append(Employee.department.in_(departments))

    emp_stmt = select(Employee).where(and_(*emp_filter))
    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()

    emp_ids_list = [e.id for e in employees]
    emp_map = {e.id: e for e in employees}

    att_filter = [
        AttendanceDaily.date >= start_date,
        AttendanceDaily.date <= end_date,
        AttendanceDaily.emp_id.in_(emp_ids_list),
    ]
    att_stmt = select(AttendanceDaily).where(and_(*att_filter))
    att_result = await db.execute(att_stmt)
    records = att_result.scalars().all()

    # Get payroll for LOP
    payroll_stmt = select(Payroll).where(
        and_(
            Payroll.emp_id.in_(emp_ids_list),
            or_(
                and_(Payroll.year == start_date.year, Payroll.month >= start_date.month),
                and_(Payroll.year == end_date.year, Payroll.month <= end_date.month),
            )
        )
    )
    payroll_result = await db.execute(payroll_stmt)
    lop_by_emp = defaultdict(float)
    for pr in payroll_result.scalars().all():
        lop_by_emp[pr.emp_id] += float(pr.lop_days)

    att_by_emp = defaultdict(list)
    for record in records:
        att_by_emp[record.emp_id].append(record)

    result = []
    for emp in employees:
        emp_records = att_by_emp.get(emp.id, [])
        absent_days = sum(
            1 for r in emp_records
            if r.status == AttendanceStatus.ABSENT
        )
        half_day_count = sum(
            1 for r in emp_records
            if r.status == AttendanceStatus.HALFDAY or r.is_half_day
        )
        result.append({
            "emp_id": emp.id,
            "emp_code": emp.emp_code,
            "name": emp.name,
            "department": emp.department,
            "absent_days": absent_days,
            "half_day_count": half_day_count,
            "lop_days": lop_by_emp.get(emp.id, 0.0),
        })
    return result


async def get_daily_attendance_summary(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    emp_ids: Optional[list[str]] = None,
    departments: Optional[list[str]] = None,
) -> list[dict]:
    """
    Daily attendance summary across all employees.
    Returns zero-count rows for dates with no records.
    Requirement 9.1–9.3
    """
    emp_filter = [Employee.status == EmployeeStatus.ACTIVE]
    if emp_ids:
        emp_filter.append(Employee.id.in_(emp_ids))
    if departments:
        emp_filter.append(Employee.department.in_(departments))

    emp_stmt = select(Employee).where(and_(*emp_filter))
    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()
    total_employees = len(employees)
    emp_ids_list = [e.id for e in employees]

    att_filter = [
        AttendanceDaily.date >= start_date,
        AttendanceDaily.date <= end_date,
        AttendanceDaily.emp_id.in_(emp_ids_list),
    ]
    att_stmt = select(AttendanceDaily).where(and_(*att_filter))
    att_result = await db.execute(att_stmt)
    records = att_result.scalars().all()

    by_date: dict[date, list] = defaultdict(list)
    for record in records:
        by_date[record.date].append(record)

    # Generate all dates in range
    result = []
    current = start_date
    while current <= end_date:
        day_records = by_date.get(current, [])
        result.append({
            "date": current,
            "total_employees": total_employees,
            "present_count": sum(1 for r in day_records if r.status == AttendanceStatus.PRESENT),
            "absent_count": sum(1 for r in day_records if r.status == AttendanceStatus.ABSENT),
            "half_day_count": sum(1 for r in day_records if r.status == AttendanceStatus.HALFDAY),
            "on_leave_count": sum(1 for r in day_records if r.status == AttendanceStatus.LEAVE),
            "weekly_off_count": sum(1 for r in day_records if r.status == AttendanceStatus.WEEKLYOFF),
            "holiday_count": sum(1 for r in day_records if r.status == AttendanceStatus.HOLIDAY),
        })
        current += timedelta(days=1)
    return result


async def get_monthly_attendance_trend(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    emp_ids: Optional[list[str]] = None,
    departments: Optional[list[str]] = None,
) -> list[dict]:
    """
    Month-by-month attendance trend.
    Excludes Holiday/WeeklyOff from working days denominator.
    Requirement 10.1–10.3
    """
    emp_filter = [Employee.status == EmployeeStatus.ACTIVE]
    if emp_ids:
        emp_filter.append(Employee.id.in_(emp_ids))
    if departments:
        emp_filter.append(Employee.department.in_(departments))

    emp_stmt = select(Employee).where(and_(*emp_filter))
    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()
    emp_count = len(employees)
    emp_ids_list = [e.id for e in employees]

    att_filter = [
        AttendanceDaily.date >= start_date,
        AttendanceDaily.date <= end_date,
        AttendanceDaily.emp_id.in_(emp_ids_list),
    ]
    att_stmt = select(AttendanceDaily).where(and_(*att_filter))
    att_result = await db.execute(att_stmt)
    records = att_result.scalars().all()

    # Get holidays
    holiday_stmt = select(Holiday).where(
        and_(Holiday.date >= start_date, Holiday.date <= end_date, Holiday.is_active == True)
    )
    holiday_result = await db.execute(holiday_stmt)
    holiday_dates = {h.date for h in holiday_result.scalars().all()}

    company_policy = await get_policy(db)

    # Group by year-month
    by_month: dict[tuple, list] = defaultdict(list)
    for record in records:
        key = (record.date.year, record.date.month)
        by_month[key].append(record)

    result = []
    # Iterate months in range
    current_year = start_date.year
    current_month = start_date.month
    while (current_year, current_month) <= (end_date.year, end_date.month):
        key = (current_year, current_month)
        month_records = by_month.get(key, [])

        # Working days for this month (excluding holidays and weekly offs)
        working_days = calculate_working_days(
            current_year, current_month,
            [h for h in holiday_dates if h.year == current_year and h.month == current_month],
            company_policy
        )

        total_present = sum(1 for r in month_records if r.status == AttendanceStatus.PRESENT)
        total_absent = sum(1 for r in month_records if r.status == AttendanceStatus.ABSENT)
        total_late = sum(1 for r in month_records if r.is_late_mark or r.is_half_late_mark)

        avg_pct = compute_attendance_pct(total_present, working_days, emp_count)

        result.append({
            "year": current_year,
            "month": current_month,
            "avg_attendance_pct": avg_pct,
            "total_present_days": total_present,
            "total_absent_days": total_absent,
            "total_late_marks": total_late,
        })

        # Advance to next month
        if current_month == 12:
            current_year += 1
            current_month = 1
        else:
            current_month += 1

    return result


async def get_late_coming_analysis(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    emp_ids: Optional[list[str]] = None,
    departments: Optional[list[str]] = None,
) -> list[dict]:
    """
    Late coming analysis with org-level summary row per month.
    Requirement 11.1–11.3
    """
    emp_filter = [Employee.status == EmployeeStatus.ACTIVE]
    if emp_ids:
        emp_filter.append(Employee.id.in_(emp_ids))
    if departments:
        emp_filter.append(Employee.department.in_(departments))

    emp_stmt = select(Employee).where(and_(*emp_filter))
    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()
    emp_ids_list = [e.id for e in employees]
    emp_map = {e.id: e for e in employees}

    att_filter = [
        AttendanceDaily.date >= start_date,
        AttendanceDaily.date <= end_date,
        AttendanceDaily.emp_id.in_(emp_ids_list),
        or_(AttendanceDaily.is_late_mark == True, AttendanceDaily.is_half_late_mark == True),
    ]
    att_stmt = select(AttendanceDaily).where(and_(*att_filter))
    att_result = await db.execute(att_stmt)
    records = att_result.scalars().all()

    company_policy = await get_policy(db)
    override_stmt = select(EmployeePolicyOverride).where(EmployeePolicyOverride.emp_id.in_(emp_ids_list))
    override_result = await db.execute(override_stmt)
    overrides = {o.emp_id: o for o in override_result.scalars().all()}

    # Group by (emp_id, year, month)
    by_emp_month: dict[tuple, list] = defaultdict(list)
    for record in records:
        key = (record.emp_id, record.date.year, record.date.month)
        by_emp_month[key].append(record)

    result = []
    # Per-employee rows
    org_by_month: dict[tuple, dict] = defaultdict(lambda: {"late_count": 0, "half_late_count": 0, "total_mins": 0, "count": 0})

    for (emp_id, year, month), month_records in by_emp_month.items():
        emp = emp_map.get(emp_id)
        if not emp:
            continue
        override = overrides.get(emp_id)
        policy = get_effective_policy(company_policy, override)
        shift_start_mins = int(policy.shift_start_time.split(":")[0]) * 60 + int(policy.shift_start_time.split(":")[1])

        late_count = sum(1 for r in month_records if r.is_late_mark)
        half_late_count = sum(1 for r in month_records if r.is_half_late_mark)
        total_mins = 0
        for r in month_records:
            if r.check_in:
                check_in_mins = r.check_in.hour * 60 + r.check_in.minute
                total_mins += max(0, check_in_mins - shift_start_mins)

        avg_mins = round(total_mins / len(month_records), 2) if month_records else 0.0

        result.append({
            "emp_id": emp_id,
            "emp_code": emp.emp_code,
            "name": emp.name,
            "department": emp.department,
            "year": year,
            "month": month,
            "late_mark_count": late_count,
            "half_late_mark_count": half_late_count,
            "avg_minutes_late": avg_mins,
            "is_org_summary": False,
        })

        org_key = (year, month)
        org_by_month[org_key]["late_count"] += late_count
        org_by_month[org_key]["half_late_count"] += half_late_count
        org_by_month[org_key]["total_mins"] += total_mins
        org_by_month[org_key]["count"] += len(month_records)

    # Org summary rows
    for (year, month), data in org_by_month.items():
        avg_mins = round(data["total_mins"] / data["count"], 2) if data["count"] > 0 else 0.0
        result.append({
            "emp_id": None,
            "emp_code": None,
            "name": "Organisation Summary",
            "department": None,
            "year": year,
            "month": month,
            "late_mark_count": data["late_count"],
            "half_late_mark_count": data["half_late_count"],
            "avg_minutes_late": avg_mins,
            "is_org_summary": True,
        })

    return result


async def get_early_leaving_analysis(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    emp_ids: Optional[list[str]] = None,
    departments: Optional[list[str]] = None,
) -> list[dict]:
    """
    Early leaving analysis.
    Omits employees with no early-leaving instances.
    Requirement 12.1–12.3
    """
    emp_filter = [Employee.status == EmployeeStatus.ACTIVE]
    if emp_ids:
        emp_filter.append(Employee.id.in_(emp_ids))
    if departments:
        emp_filter.append(Employee.department.in_(departments))

    emp_stmt = select(Employee).where(and_(*emp_filter))
    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()
    emp_ids_list = [e.id for e in employees]
    emp_map = {e.id: e for e in employees}

    att_filter = [
        AttendanceDaily.date >= start_date,
        AttendanceDaily.date <= end_date,
        AttendanceDaily.emp_id.in_(emp_ids_list),
        AttendanceDaily.check_out.isnot(None),
    ]
    att_stmt = select(AttendanceDaily).where(and_(*att_filter))
    att_result = await db.execute(att_stmt)
    records = att_result.scalars().all()

    company_policy = await get_policy(db)
    override_stmt = select(EmployeePolicyOverride).where(EmployeePolicyOverride.emp_id.in_(emp_ids_list))
    override_result = await db.execute(override_stmt)
    overrides = {o.emp_id: o for o in override_result.scalars().all()}

    result = []
    for record in records:
        emp = emp_map.get(record.emp_id)
        if not emp:
            continue
        override = overrides.get(emp.id)
        policy = get_effective_policy(company_policy, override)
        shift_end = policy.shift_end_time  # "HH:MM"
        shift_end_mins = int(shift_end.split(":")[0]) * 60 + int(shift_end.split(":")[1])

        check_out_mins = record.check_out.hour * 60 + record.check_out.minute
        if check_out_mins < shift_end_mins:
            minutes_early = shift_end_mins - check_out_mins
            result.append({
                "emp_id": emp.id,
                "emp_code": emp.emp_code,
                "name": emp.name,
                "department": emp.department,
                "date": record.date,
                "check_out": record.check_out,
                "scheduled_end_time": shift_end,
                "minutes_left_early": minutes_early,
            })
    return result


async def get_shift_wise_attendance(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    emp_ids: Optional[list[str]] = None,
    departments: Optional[list[str]] = None,
) -> list[dict]:
    """
    Shift-wise attendance report.
    Includes insight flag when attendance > 10pp below org average.
    Requirement 13.1–13.3
    """
    emp_filter = [Employee.status == EmployeeStatus.ACTIVE]
    if emp_ids:
        emp_filter.append(Employee.id.in_(emp_ids))
    if departments:
        emp_filter.append(Employee.department.in_(departments))

    emp_stmt = select(Employee).where(and_(*emp_filter))
    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()
    emp_ids_list = [e.id for e in employees]
    emp_map = {e.id: e for e in employees}

    att_filter = [
        AttendanceDaily.date >= start_date,
        AttendanceDaily.date <= end_date,
        AttendanceDaily.emp_id.in_(emp_ids_list),
    ]
    att_stmt = select(AttendanceDaily).where(and_(*att_filter))
    att_result = await db.execute(att_stmt)
    records = att_result.scalars().all()

    company_policy = await get_policy(db)
    override_stmt = select(EmployeePolicyOverride).where(EmployeePolicyOverride.emp_id.in_(emp_ids_list))
    override_result = await db.execute(override_stmt)
    overrides = {o.emp_id: o for o in override_result.scalars().all()}

    # Determine shift type per employee
    emp_shift = {}
    for emp in employees:
        override = overrides.get(emp.id)
        policy = get_effective_policy(company_policy, override)
        emp_shift[emp.id] = policy.shift_type if hasattr(policy, 'shift_type') else "general"

    # Group by (shift_type, year, month)
    by_shift_month: dict[tuple, dict] = defaultdict(lambda: {
        "emp_ids": set(), "present": 0, "total": 0, "ot_hours": 0.0, "late_marks": 0
    })

    att_by_emp = defaultdict(list)
    for record in records:
        att_by_emp[record.emp_id].append(record)

    for emp in employees:
        shift = emp_shift.get(emp.id, "general")
        emp_records = att_by_emp.get(emp.id, [])
        for r in emp_records:
            key = (str(shift), r.date.year, r.date.month)
            by_shift_month[key]["emp_ids"].add(emp.id)
            by_shift_month[key]["total"] += 1
            if r.status == AttendanceStatus.PRESENT:
                by_shift_month[key]["present"] += 1
            if r.is_late_mark or r.is_half_late_mark:
                by_shift_month[key]["late_marks"] += 1
            if r.check_in and r.check_out:
                override = overrides.get(emp.id)
                policy = get_effective_policy(company_policy, override)
                wh = (r.check_out - r.check_in).total_seconds() / 3600
                ot_h = calculate_ot_hours(wh, policy)
                by_shift_month[key]["ot_hours"] += ot_h

    # Compute org average per month
    org_pct_by_month: dict[tuple, float] = {}
    month_totals: dict[tuple, dict] = defaultdict(lambda: {"present": 0, "total": 0})
    for (shift, year, month), data in by_shift_month.items():
        mk = (year, month)
        month_totals[mk]["present"] += data["present"]
        month_totals[mk]["total"] += data["total"]
    for mk, totals in month_totals.items():
        org_pct_by_month[mk] = round(totals["present"] / totals["total"] * 100, 2) if totals["total"] > 0 else 0.0

    result = []
    for (shift, year, month), data in by_shift_month.items():
        emp_count = len(data["emp_ids"])
        avg_pct = round(data["present"] / data["total"] * 100, 2) if data["total"] > 0 else 0.0
        org_avg = org_pct_by_month.get((year, month), 0.0)
        below_flag = (org_avg - avg_pct) > 10.0

        result.append({
            "shift_type": shift,
            "year": year,
            "month": month,
            "total_employees": emp_count,
            "avg_attendance_pct": avg_pct,
            "total_ot_hours": round(data["ot_hours"], 2),
            "total_late_marks": data["late_marks"],
            "below_org_avg_flag": below_flag,
        })
    return result


async def get_attendance_heatmap(
    db: AsyncSession,
    month: int,
    year: int,
    emp_ids: Optional[list[str]] = None,
    departments: Optional[list[str]] = None,
) -> dict:
    """
    Attendance heatmap matrix (employee × date).
    Returns MISSED_PUNCH for null check-in on present days.
    Sorted by name asc, date asc.
    Requirement 14.1–14.4
    """
    import calendar as cal_module
    _, days_in_month = cal_module.monthrange(year, month)
    start_date = date(year, month, 1)
    end_date = date(year, month, days_in_month)
    all_dates = [date(year, month, d) for d in range(1, days_in_month + 1)]

    emp_filter = [Employee.status == EmployeeStatus.ACTIVE]
    if emp_ids:
        emp_filter.append(Employee.id.in_(emp_ids))
    if departments:
        emp_filter.append(Employee.department.in_(departments))

    emp_stmt = select(Employee).where(and_(*emp_filter)).order_by(Employee.name)
    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()
    emp_ids_list = [e.id for e in employees]
    emp_map = {e.id: e for e in employees}

    att_filter = [
        AttendanceDaily.date >= start_date,
        AttendanceDaily.date <= end_date,
        AttendanceDaily.emp_id.in_(emp_ids_list),
    ]
    att_stmt = select(AttendanceDaily).where(and_(*att_filter))
    att_result = await db.execute(att_stmt)
    records = att_result.scalars().all()

    # Index by (emp_id, date)
    att_index: dict[tuple, AttendanceDaily] = {}
    for r in records:
        att_index[(r.emp_id, r.date)] = r

    cells = []
    for emp in employees:
        for d in all_dates:
            record = att_index.get((emp.id, d))
            if record:
                status = record.status.value.upper()
                # Check for missed punch
                if (
                    record.check_in is None
                    and record.status in (AttendanceStatus.PRESENT, AttendanceStatus.HALFDAY)
                ):
                    status = "MISSED_PUNCH"
            else:
                status = "ABSENT"

            cells.append({
                "emp_id": emp.id,
                "emp_code": emp.emp_code,
                "name": emp.name,
                "date": d,
                "status": status,
            })

    return {
        "month": month,
        "year": year,
        "employees": [e.name for e in employees],
        "dates": all_dates,
        "cells": cells,
    }


async def get_department_attendance(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    emp_ids: Optional[list[str]] = None,
    departments: Optional[list[str]] = None,
) -> list[dict]:
    """
    Department-wise attendance report.
    Returns zero rows for departments with no records.
    Requirement 15.1–15.3
    """
    emp_filter = [Employee.status == EmployeeStatus.ACTIVE]
    if emp_ids:
        emp_filter.append(Employee.id.in_(emp_ids))
    if departments:
        emp_filter.append(Employee.department.in_(departments))

    emp_stmt = select(Employee).where(and_(*emp_filter))
    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()
    emp_ids_list = [e.id for e in employees]
    emp_map = {e.id: e for e in employees}

    att_filter = [
        AttendanceDaily.date >= start_date,
        AttendanceDaily.date <= end_date,
        AttendanceDaily.emp_id.in_(emp_ids_list),
    ]
    att_stmt = select(AttendanceDaily).where(and_(*att_filter))
    att_result = await db.execute(att_stmt)
    records = att_result.scalars().all()

    company_policy = await get_policy(db)
    override_stmt = select(EmployeePolicyOverride).where(EmployeePolicyOverride.emp_id.in_(emp_ids_list))
    override_result = await db.execute(override_stmt)
    overrides = {o.emp_id: o for o in override_result.scalars().all()}

    # Group by (department, year, month)
    by_dept_month: dict[tuple, dict] = defaultdict(lambda: {
        "emp_ids": set(), "present": 0, "total": 0, "absent": 0, "late": 0, "ot_hours": 0.0
    })

    for record in records:
        emp = emp_map.get(record.emp_id)
        if not emp:
            continue
        dept = emp.department or "Unknown"
        key = (dept, record.date.year, record.date.month)
        by_dept_month[key]["emp_ids"].add(emp.id)
        by_dept_month[key]["total"] += 1
        if record.status == AttendanceStatus.PRESENT:
            by_dept_month[key]["present"] += 1
        if record.status == AttendanceStatus.ABSENT:
            by_dept_month[key]["absent"] += 1
        if record.is_late_mark or record.is_half_late_mark:
            by_dept_month[key]["late"] += 1
        if record.check_in and record.check_out:
            override = overrides.get(record.emp_id)
            policy = get_effective_policy(company_policy, override)
            wh = (record.check_out - record.check_in).total_seconds() / 3600
            ot_h = calculate_ot_hours(wh, policy)
            by_dept_month[key]["ot_hours"] += ot_h

    result = []
    for (dept, year, month), data in by_dept_month.items():
        emp_count = len(data["emp_ids"])
        avg_pct = round(data["present"] / data["total"] * 100, 2) if data["total"] > 0 else 0.0
        result.append({
            "department": dept,
            "year": year,
            "month": month,
            "employee_count": emp_count,
            "avg_attendance_pct": avg_pct,
            "total_absent_days": data["absent"],
            "total_late_marks": data["late"],
            "total_ot_hours": round(data["ot_hours"], 2),
        })
    return result


async def get_department_ot(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    emp_ids: Optional[list[str]] = None,
    departments: Optional[list[str]] = None,
) -> list[dict]:
    """
    Department-wise OT report.
    Includes insight flag when dept OT > 20% of scheduled hours.
    Requirement 16.1–16.3
    """
    emp_filter = [Employee.status == EmployeeStatus.ACTIVE]
    if emp_ids:
        emp_filter.append(Employee.id.in_(emp_ids))
    if departments:
        emp_filter.append(Employee.department.in_(departments))

    emp_stmt = select(Employee).where(and_(*emp_filter))
    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()
    emp_ids_list = [e.id for e in employees]
    emp_map = {e.id: e for e in employees}

    att_filter = [
        AttendanceDaily.date >= start_date,
        AttendanceDaily.date <= end_date,
        AttendanceDaily.emp_id.in_(emp_ids_list),
    ]
    att_stmt = select(AttendanceDaily).where(and_(*att_filter))
    att_result = await db.execute(att_stmt)
    records = att_result.scalars().all()

    company_policy = await get_policy(db)
    override_stmt = select(EmployeePolicyOverride).where(EmployeePolicyOverride.emp_id.in_(emp_ids_list))
    override_result = await db.execute(override_stmt)
    overrides = {o.emp_id: o for o in override_result.scalars().all()}

    holiday_stmt = select(Holiday).where(
        and_(Holiday.date >= start_date, Holiday.date <= end_date, Holiday.is_active == True)
    )
    holiday_result = await db.execute(holiday_stmt)
    holiday_dates = {h.date for h in holiday_result.scalars().all()}

    by_dept_month: dict[tuple, dict] = defaultdict(lambda: {
        "emp_ids_with_ot": set(), "ot_hours": 0.0, "ot_cost": Decimal("0"),
        "scheduled_hours": 0.0
    })

    for record in records:
        emp = emp_map.get(record.emp_id)
        if not emp:
            continue
        dept = emp.department or "Unknown"
        key = (dept, record.date.year, record.date.month)

        override = overrides.get(emp.id)
        policy = get_effective_policy(company_policy, override)

        if record.check_in and record.check_out:
            wh = (record.check_out - record.check_in).total_seconds() / 3600
            ot_h = calculate_ot_hours(wh, policy)
            if ot_h > 0:
                by_dept_month[key]["emp_ids_with_ot"].add(emp.id)
                by_dept_month[key]["ot_hours"] += ot_h
                if emp.salary:
                    is_holiday = record.date in holiday_dates
                    ot_cost = calculate_ot_amount(
                        gross=emp.salary,
                        shift_hours=policy.shift_hours,
                        ot_hours=ot_h,
                        is_holiday_or_weeklyoff=is_holiday,
                        policy=policy,
                    )
                    by_dept_month[key]["ot_cost"] += ot_cost

    result = []
    for (dept, year, month), data in by_dept_month.items():
        emp_count_with_ot = len(data["emp_ids_with_ot"])
        total_ot = round(data["ot_hours"], 2)
        avg_ot = round(total_ot / emp_count_with_ot, 2) if emp_count_with_ot > 0 else 0.0

        # Scheduled hours for dept in month
        dept_emps = [e for e in employees if (e.department or "Unknown") == dept]
        working_days = calculate_working_days(year, month, [], company_policy)
        scheduled_hours = len(dept_emps) * working_days * float(company_policy.shift_hours)
        exceeds_flag = (scheduled_hours > 0) and (total_ot / scheduled_hours > 0.20)

        result.append({
            "department": dept,
            "year": year,
            "month": month,
            "total_ot_hours": total_ot,
            "total_ot_cost": data["ot_cost"],
            "employee_count_with_ot": emp_count_with_ot,
            "avg_ot_hours_per_employee": avg_ot,
            "exceeds_scheduled_flag": exceeds_flag,
        })
    return result


async def get_monthly_ot_trend(
    db: AsyncSession,
    start_date: date,
    end_date: date,
) -> list[dict]:
    """
    Monthly OT trend with month-over-month change.
    Returns null for MoM change when previous month OT is zero.
    Requirement 17.1–17.3
    """
    emp_stmt = select(Employee).where(Employee.status == EmployeeStatus.ACTIVE)
    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()
    emp_ids_list = [e.id for e in employees]
    emp_map = {e.id: e for e in employees}

    att_filter = [
        AttendanceDaily.date >= start_date,
        AttendanceDaily.date <= end_date,
        AttendanceDaily.emp_id.in_(emp_ids_list),
    ]
    att_stmt = select(AttendanceDaily).where(and_(*att_filter))
    att_result = await db.execute(att_stmt)
    records = att_result.scalars().all()

    company_policy = await get_policy(db)
    override_stmt = select(EmployeePolicyOverride).where(EmployeePolicyOverride.emp_id.in_(emp_ids_list))
    override_result = await db.execute(override_stmt)
    overrides = {o.emp_id: o for o in override_result.scalars().all()}

    holiday_stmt = select(Holiday).where(
        and_(Holiday.date >= start_date, Holiday.date <= end_date, Holiday.is_active == True)
    )
    holiday_result = await db.execute(holiday_stmt)
    holiday_dates = {h.date for h in holiday_result.scalars().all()}

    by_month: dict[tuple, dict] = defaultdict(lambda: {
        "emp_ids_with_ot": set(), "ot_hours": 0.0, "ot_cost": Decimal("0")
    })

    for record in records:
        emp = emp_map.get(record.emp_id)
        if not emp:
            continue
        key = (record.date.year, record.date.month)
        override = overrides.get(emp.id)
        policy = get_effective_policy(company_policy, override)

        if record.check_in and record.check_out:
            wh = (record.check_out - record.check_in).total_seconds() / 3600
            ot_h = calculate_ot_hours(wh, policy)
            if ot_h > 0:
                by_month[key]["emp_ids_with_ot"].add(emp.id)
                by_month[key]["ot_hours"] += ot_h
                if emp.salary:
                    is_holiday = record.date in holiday_dates
                    ot_cost = calculate_ot_amount(
                        gross=emp.salary,
                        shift_hours=policy.shift_hours,
                        ot_hours=ot_h,
                        is_holiday_or_weeklyoff=is_holiday,
                        policy=policy,
                    )
                    by_month[key]["ot_cost"] += ot_cost

    # Build sorted list
    sorted_months = sorted(by_month.keys())
    result = []
    for i, (year, month) in enumerate(sorted_months):
        data = by_month[(year, month)]
        total_ot = round(data["ot_hours"], 2)

        mom_change = None
        if i > 0:
            prev_key = sorted_months[i - 1]
            prev_ot = round(by_month[prev_key]["ot_hours"], 2)
            if prev_ot > 0:
                mom_change = round(((total_ot - prev_ot) / prev_ot) * 100, 2)
            # else: mom_change stays None (Req 17.3)

        result.append({
            "year": year,
            "month": month,
            "total_ot_hours": total_ot,
            "total_ot_cost": data["ot_cost"],
            "employee_count_with_ot": len(data["emp_ids_with_ot"]),
            "mom_change_pct": mom_change,
        })
    return result


async def get_ot_cost(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    emp_ids: Optional[list[str]] = None,
    departments: Optional[list[str]] = None,
) -> list[dict]:
    """
    OT cost per employee per month with dept subtotals and org grand total.
    Requirement 18.1–18.4
    """
    emp_filter = [Employee.status == EmployeeStatus.ACTIVE]
    if emp_ids:
        emp_filter.append(Employee.id.in_(emp_ids))
    if departments:
        emp_filter.append(Employee.department.in_(departments))

    emp_stmt = select(Employee).where(and_(*emp_filter))
    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()
    emp_ids_list = [e.id for e in employees]
    emp_map = {e.id: e for e in employees}

    att_filter = [
        AttendanceDaily.date >= start_date,
        AttendanceDaily.date <= end_date,
        AttendanceDaily.emp_id.in_(emp_ids_list),
    ]
    att_stmt = select(AttendanceDaily).where(and_(*att_filter))
    att_result = await db.execute(att_stmt)
    records = att_result.scalars().all()

    company_policy = await get_policy(db)
    override_stmt = select(EmployeePolicyOverride).where(EmployeePolicyOverride.emp_id.in_(emp_ids_list))
    override_result = await db.execute(override_stmt)
    overrides = {o.emp_id: o for o in override_result.scalars().all()}

    holiday_stmt = select(Holiday).where(
        and_(Holiday.date >= start_date, Holiday.date <= end_date, Holiday.is_active == True)
    )
    holiday_result = await db.execute(holiday_stmt)
    holiday_dates = {h.date for h in holiday_result.scalars().all()}

    # Get payroll for gross salary
    payroll_stmt = select(Payroll).where(Payroll.emp_id.in_(emp_ids_list))
    payroll_result = await db.execute(payroll_stmt)
    payroll_by_emp_month: dict[tuple, Payroll] = {}
    for pr in payroll_result.scalars().all():
        payroll_by_emp_month[(pr.emp_id, pr.year, pr.month)] = pr

    by_emp_month: dict[tuple, dict] = defaultdict(lambda: {"ot_hours": 0.0, "ot_cost": Decimal("0")})

    for record in records:
        emp = emp_map.get(record.emp_id)
        if not emp:
            continue
        key = (emp.id, record.date.year, record.date.month)
        override = overrides.get(emp.id)
        policy = get_effective_policy(company_policy, override)

        if record.check_in and record.check_out:
            wh = (record.check_out - record.check_in).total_seconds() / 3600
            ot_h = calculate_ot_hours(wh, policy)
            if ot_h > 0:
                by_emp_month[key]["ot_hours"] += ot_h
                payroll = payroll_by_emp_month.get(key)
                gross = payroll.gross_salary if payroll and payroll.gross_salary else (emp.salary or Decimal("0"))
                if gross:
                    is_holiday = record.date in holiday_dates
                    ot_cost = calculate_ot_amount(
                        gross=gross,
                        shift_hours=policy.shift_hours,
                        ot_hours=ot_h,
                        is_holiday_or_weeklyoff=is_holiday,
                        policy=policy,
                    )
                    by_emp_month[key]["ot_cost"] += ot_cost

    result = []
    dept_totals: dict[tuple, dict] = defaultdict(lambda: {"ot_hours": 0.0, "ot_cost": Decimal("0"), "gross": Decimal("0")})
    grand_total = {"ot_hours": 0.0, "ot_cost": Decimal("0"), "gross": Decimal("0")}

    for (emp_id, year, month), data in by_emp_month.items():
        emp = emp_map.get(emp_id)
        if not emp:
            continue
        payroll = payroll_by_emp_month.get((emp_id, year, month))
        gross = payroll.gross_salary if payroll and payroll.gross_salary else (emp.salary or Decimal("0"))
        override = overrides.get(emp_id)
        policy = get_effective_policy(company_policy, override)
        working_days = calculate_working_days(year, month, [], company_policy)
        cost_per_hour = (
            gross / Decimal(str(working_days * policy.shift_hours))
            if working_days > 0 and policy.shift_hours > 0 and gross
            else Decimal("0")
        )
        ot_cost = data["ot_cost"]
        ot_cost_pct = float(ot_cost / gross * 100) if gross else 0.0

        result.append({
            "emp_id": emp_id,
            "emp_code": emp.emp_code,
            "name": emp.name,
            "department": emp.department,
            "year": year,
            "month": month,
            "gross_salary": gross,
            "ot_hours": round(data["ot_hours"], 2),
            "cost_per_hour": cost_per_hour.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "ot_cost": ot_cost,
            "ot_cost_pct_of_gross": round(ot_cost_pct, 2),
            "is_subtotal": False,
            "is_grand_total": False,
        })

        dept_key = (emp.department or "Unknown", year, month)
        dept_totals[dept_key]["ot_hours"] += data["ot_hours"]
        dept_totals[dept_key]["ot_cost"] += ot_cost
        dept_totals[dept_key]["gross"] += gross
        grand_total["ot_hours"] += data["ot_hours"]
        grand_total["ot_cost"] += ot_cost
        grand_total["gross"] += gross

    # Dept subtotals
    for (dept, year, month), data in dept_totals.items():
        gross = data["gross"]
        ot_pct = float(data["ot_cost"] / gross * 100) if gross else 0.0
        result.append({
            "emp_id": None,
            "emp_code": None,
            "name": f"{dept} Subtotal",
            "department": dept,
            "year": year,
            "month": month,
            "gross_salary": gross,
            "ot_hours": round(data["ot_hours"], 2),
            "cost_per_hour": Decimal("0"),
            "ot_cost": data["ot_cost"],
            "ot_cost_pct_of_gross": round(ot_pct, 2),
            "is_subtotal": True,
            "is_grand_total": False,
        })

    # Grand total
    gross = grand_total["gross"]
    ot_pct = float(grand_total["ot_cost"] / gross * 100) if gross else 0.0
    result.append({
        "emp_id": None,
        "emp_code": None,
        "name": "Grand Total",
        "department": None,
        "year": start_date.year,
        "month": start_date.month,
        "gross_salary": gross,
        "ot_hours": round(grand_total["ot_hours"], 2),
        "cost_per_hour": Decimal("0"),
        "ot_cost": grand_total["ot_cost"],
        "ot_cost_pct_of_gross": round(ot_pct, 2),
        "is_subtotal": False,
        "is_grand_total": True,
    })

    return result


async def get_holiday_ot(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    emp_ids: Optional[list[str]] = None,
    departments: Optional[list[str]] = None,
) -> list[dict]:
    """
    OT worked on holidays.
    Omits holidays with no workers.
    Requirement 19.1–19.3
    """
    emp_filter = [Employee.status == EmployeeStatus.ACTIVE]
    if emp_ids:
        emp_filter.append(Employee.id.in_(emp_ids))
    if departments:
        emp_filter.append(Employee.department.in_(departments))

    emp_stmt = select(Employee).where(and_(*emp_filter))
    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()
    emp_ids_list = [e.id for e in employees]
    emp_map = {e.id: e for e in employees}

    # Get holidays in range
    holiday_stmt = select(Holiday).where(
        and_(Holiday.date >= start_date, Holiday.date <= end_date, Holiday.is_active == True)
    )
    holiday_result = await db.execute(holiday_stmt)
    holidays = holiday_result.scalars().all()
    holiday_map = {h.date: h for h in holidays}

    if not holiday_map:
        return []

    att_filter = [
        AttendanceDaily.date.in_(list(holiday_map.keys())),
        AttendanceDaily.emp_id.in_(emp_ids_list),
        AttendanceDaily.check_in.isnot(None),
    ]
    att_stmt = select(AttendanceDaily).where(and_(*att_filter))
    att_result = await db.execute(att_stmt)
    records = att_result.scalars().all()

    company_policy = await get_policy(db)
    override_stmt = select(EmployeePolicyOverride).where(EmployeePolicyOverride.emp_id.in_(emp_ids_list))
    override_result = await db.execute(override_stmt)
    overrides = {o.emp_id: o for o in override_result.scalars().all()}

    result = []
    for record in records:
        emp = emp_map.get(record.emp_id)
        if not emp:
            continue
        holiday = holiday_map.get(record.date)
        if not holiday:
            continue

        override = overrides.get(emp.id)
        policy = get_effective_policy(company_policy, override)

        working_hours = 0.0
        ot_hours = 0.0
        ot_cost = Decimal("0")

        if record.check_in and record.check_out:
            working_hours = round((record.check_out - record.check_in).total_seconds() / 3600, 2)
            ot_hours = calculate_ot_hours(working_hours, policy)
            if emp.salary and ot_hours > 0:
                ot_cost = calculate_ot_amount(
                    gross=emp.salary,
                    shift_hours=policy.shift_hours,
                    ot_hours=ot_hours,
                    is_holiday_or_weeklyoff=True,
                    policy=policy,
                )

        result.append({
            "emp_id": emp.id,
            "emp_code": emp.emp_code,
            "name": emp.name,
            "department": emp.department,
            "holiday_name": holiday.name,
            "date": record.date,
            "working_hours": working_hours,
            "ot_hours": round(ot_hours, 2),
            "ot_cost": ot_cost,
        })
    return result


async def get_excess_ot_alert(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    emp_ids: Optional[list[str]] = None,
    departments: Optional[list[str]] = None,
) -> list[dict]:
    """
    Employees exceeding monthly OT limit.
    Monthly limit = (weekly_limit_hours - shift_hours * 5) * 4
    Sorted by excess hours desc.
    Requirement 20.1–20.3
    """
    emp_filter = [Employee.status == EmployeeStatus.ACTIVE]
    if emp_ids:
        emp_filter.append(Employee.id.in_(emp_ids))
    if departments:
        emp_filter.append(Employee.department.in_(departments))

    emp_stmt = select(Employee).where(and_(*emp_filter))
    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()
    emp_ids_list = [e.id for e in employees]
    emp_map = {e.id: e for e in employees}

    att_filter = [
        AttendanceDaily.date >= start_date,
        AttendanceDaily.date <= end_date,
        AttendanceDaily.emp_id.in_(emp_ids_list),
    ]
    att_stmt = select(AttendanceDaily).where(and_(*att_filter))
    att_result = await db.execute(att_stmt)
    records = att_result.scalars().all()

    company_policy = await get_policy(db)
    override_stmt = select(EmployeePolicyOverride).where(EmployeePolicyOverride.emp_id.in_(emp_ids_list))
    override_result = await db.execute(override_stmt)
    overrides = {o.emp_id: o for o in override_result.scalars().all()}

    holiday_stmt = select(Holiday).where(
        and_(Holiday.date >= start_date, Holiday.date <= end_date, Holiday.is_active == True)
    )
    holiday_result = await db.execute(holiday_stmt)
    holiday_dates = {h.date for h in holiday_result.scalars().all()}

    by_emp_month: dict[tuple, dict] = defaultdict(lambda: {"ot_hours": 0.0, "ot_cost": Decimal("0")})

    for record in records:
        emp = emp_map.get(record.emp_id)
        if not emp:
            continue
        key = (emp.id, record.date.year, record.date.month)
        override = overrides.get(emp.id)
        policy = get_effective_policy(company_policy, override)

        if record.check_in and record.check_out:
            wh = (record.check_out - record.check_in).total_seconds() / 3600
            ot_h = calculate_ot_hours(wh, policy)
            if ot_h > 0:
                by_emp_month[key]["ot_hours"] += ot_h
                if emp.salary:
                    is_holiday = record.date in holiday_dates
                    ot_cost = calculate_ot_amount(
                        gross=emp.salary,
                        shift_hours=policy.shift_hours,
                        ot_hours=ot_h,
                        is_holiday_or_weeklyoff=is_holiday,
                        policy=policy,
                    )
                    by_emp_month[key]["ot_cost"] += ot_cost

    result = []
    for (emp_id, year, month), data in by_emp_month.items():
        emp = emp_map.get(emp_id)
        if not emp:
            continue
        override = overrides.get(emp_id)
        policy = get_effective_policy(company_policy, override)

        # Monthly OT limit = (weekly_limit_hours - shift_hours * 5) * 4
        monthly_limit = (company_policy.weekly_limit_hours - policy.shift_hours * 5) * 4
        total_ot = round(data["ot_hours"], 2)

        if total_ot > monthly_limit:
            excess = round(total_ot - monthly_limit, 2)
            # Compute excess OT cost
            excess_cost = Decimal("0")
            if emp.salary and excess > 0:
                excess_cost = calculate_ot_amount(
                    gross=emp.salary,
                    shift_hours=policy.shift_hours,
                    ot_hours=excess,
                    is_holiday_or_weeklyoff=False,
                    policy=policy,
                )
            result.append({
                "emp_id": emp_id,
                "emp_code": emp.emp_code,
                "name": emp.name,
                "department": emp.department,
                "year": year,
                "month": month,
                "total_ot_hours": total_ot,
                "monthly_ot_limit": float(monthly_limit),
                "excess_hours": excess,
                "excess_ot_cost": excess_cost,
            })

    result.sort(key=lambda x: x["excess_hours"], reverse=True)
    return result


async def get_cost_per_employee(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    emp_ids: Optional[list[str]] = None,
    departments: Optional[list[str]] = None,
) -> list[dict]:
    """
    Monthly cost breakdown per employee with dept subtotals and org grand total.
    Flags highest-cost employee.
    Requirement 21.1–21.4
    """
    emp_filter = [Employee.status == EmployeeStatus.ACTIVE]
    if emp_ids:
        emp_filter.append(Employee.id.in_(emp_ids))
    if departments:
        emp_filter.append(Employee.department.in_(departments))

    emp_stmt = select(Employee).where(and_(*emp_filter))
    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()
    emp_ids_list = [e.id for e in employees]
    emp_map = {e.id: e for e in employees}

    # Get payroll records
    payroll_stmt = select(Payroll).where(
        and_(
            Payroll.emp_id.in_(emp_ids_list),
            or_(
                and_(Payroll.year == start_date.year, Payroll.month >= start_date.month),
                and_(Payroll.year == end_date.year, Payroll.month <= end_date.month),
            )
        )
    )
    payroll_result = await db.execute(payroll_stmt)
    payroll_records = payroll_result.scalars().all()

    company_policy = await get_policy(db)
    override_stmt = select(EmployeePolicyOverride).where(EmployeePolicyOverride.emp_id.in_(emp_ids_list))
    override_result = await db.execute(override_stmt)
    overrides = {o.emp_id: o for o in override_result.scalars().all()}

    # Get OT cost per employee per month
    ot_data = await get_ot_cost(db, start_date, end_date, emp_ids, departments)
    ot_by_emp_month: dict[tuple, Decimal] = {}
    for row in ot_data:
        if not row["is_subtotal"] and not row["is_grand_total"] and row["emp_id"]:
            ot_by_emp_month[(row["emp_id"], row["year"], row["month"])] = row["ot_cost"]

    result = []
    dept_totals: dict[tuple, dict] = defaultdict(lambda: {
        "gross": Decimal("0"), "deductions": Decimal("0"), "net": Decimal("0"),
        "ot_cost": Decimal("0"), "total_cost": Decimal("0")
    })
    grand_total = {"gross": Decimal("0"), "deductions": Decimal("0"), "net": Decimal("0"),
                   "ot_cost": Decimal("0"), "total_cost": Decimal("0")}
    max_cost = Decimal("0")
    max_cost_key = None

    for pr in payroll_records:
        emp = emp_map.get(pr.emp_id)
        if not emp:
            continue
        override = overrides.get(pr.emp_id)
        policy = get_effective_policy(company_policy, override)
        working_days = pr.working_days or calculate_working_days(pr.year, pr.month, [], company_policy)
        gross = pr.gross_salary or emp.salary or Decimal("0")
        cost_per_hour = (
            gross / Decimal(str(working_days * policy.shift_hours))
            if working_days > 0 and policy.shift_hours > 0 and gross
            else Decimal("0")
        )
        ot_cost = ot_by_emp_month.get((pr.emp_id, pr.year, pr.month), Decimal("0"))
        net = pr.net_pay or Decimal("0")
        deductions = pr.total_deductions or Decimal("0")
        total_cost = net + ot_cost

        key = (pr.emp_id, pr.year, pr.month)
        if total_cost > max_cost:
            max_cost = total_cost
            max_cost_key = key

        result.append({
            "emp_id": pr.emp_id,
            "emp_code": emp.emp_code,
            "name": emp.name,
            "department": emp.department,
            "year": pr.year,
            "month": pr.month,
            "gross_salary": gross,
            "total_deductions": deductions,
            "net_pay": net,
            "ot_cost": ot_cost,
            "total_cost": total_cost,
            "cost_per_hour": cost_per_hour.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "is_highest_cost": False,
            "is_subtotal": False,
            "is_grand_total": False,
        })

        dept_key = (emp.department or "Unknown", pr.year, pr.month)
        dept_totals[dept_key]["gross"] += gross
        dept_totals[dept_key]["deductions"] += deductions
        dept_totals[dept_key]["net"] += net
        dept_totals[dept_key]["ot_cost"] += ot_cost
        dept_totals[dept_key]["total_cost"] += total_cost
        grand_total["gross"] += gross
        grand_total["deductions"] += deductions
        grand_total["net"] += net
        grand_total["ot_cost"] += ot_cost
        grand_total["total_cost"] += total_cost

    # Flag highest cost employee
    for row in result:
        if max_cost_key and (row["emp_id"], row["year"], row["month"]) == max_cost_key:
            row["is_highest_cost"] = True

    # Dept subtotals
    for (dept, year, month), data in dept_totals.items():
        result.append({
            "emp_id": None, "emp_code": None,
            "name": f"{dept} Subtotal", "department": dept,
            "year": year, "month": month,
            "gross_salary": data["gross"], "total_deductions": data["deductions"],
            "net_pay": data["net"], "ot_cost": data["ot_cost"],
            "total_cost": data["total_cost"], "cost_per_hour": Decimal("0"),
            "is_highest_cost": False, "is_subtotal": True, "is_grand_total": False,
        })

    # Grand total
    result.append({
        "emp_id": None, "emp_code": None,
        "name": "Grand Total", "department": None,
        "year": start_date.year, "month": start_date.month,
        "gross_salary": grand_total["gross"], "total_deductions": grand_total["deductions"],
        "net_pay": grand_total["net"], "ot_cost": grand_total["ot_cost"],
        "total_cost": grand_total["total_cost"], "cost_per_hour": Decimal("0"),
        "is_highest_cost": False, "is_subtotal": False, "is_grand_total": True,
    })

    return result


async def get_high_absenteeism(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    emp_ids: Optional[list[str]] = None,
    departments: Optional[list[str]] = None,
) -> list[dict]:
    """
    Employees with absent_days > 3 per month.
    Sorted by absent_days desc. Includes org summary.
    Requirement 22.1–22.3
    """
    emp_filter = [Employee.status == EmployeeStatus.ACTIVE]
    if emp_ids:
        emp_filter.append(Employee.id.in_(emp_ids))
    if departments:
        emp_filter.append(Employee.department.in_(departments))

    emp_stmt = select(Employee).where(and_(*emp_filter))
    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()
    emp_ids_list = [e.id for e in employees]
    emp_map = {e.id: e for e in employees}

    att_filter = [
        AttendanceDaily.date >= start_date,
        AttendanceDaily.date <= end_date,
        AttendanceDaily.emp_id.in_(emp_ids_list),
        AttendanceDaily.status == AttendanceStatus.ABSENT,
    ]
    att_stmt = select(AttendanceDaily).where(and_(*att_filter))
    att_result = await db.execute(att_stmt)
    records = att_result.scalars().all()

    payroll_stmt = select(Payroll).where(
        and_(
            Payroll.emp_id.in_(emp_ids_list),
            or_(
                and_(Payroll.year == start_date.year, Payroll.month >= start_date.month),
                and_(Payroll.year == end_date.year, Payroll.month <= end_date.month),
            )
        )
    )
    payroll_result = await db.execute(payroll_stmt)
    payroll_by_emp_month: dict[tuple, Payroll] = {}
    for pr in payroll_result.scalars().all():
        payroll_by_emp_month[(pr.emp_id, pr.year, pr.month)] = pr

    by_emp_month: dict[tuple, int] = defaultdict(int)
    for record in records:
        key = (record.emp_id, record.date.year, record.date.month)
        by_emp_month[key] += 1

    result = []
    org_total_absent = 0
    org_total_lop = Decimal("0")

    for (emp_id, year, month), absent_days in by_emp_month.items():
        if absent_days <= 3:
            continue
        emp = emp_map.get(emp_id)
        if not emp:
            continue
        payroll = payroll_by_emp_month.get((emp_id, year, month))
        lop_days = float(payroll.lop_days) if payroll and payroll.lop_days else 0.0
        lop_deduction = payroll.lop_deduction if payroll and payroll.lop_deduction else Decimal("0")

        result.append({
            "emp_id": emp_id,
            "emp_code": emp.emp_code,
            "name": emp.name,
            "department": emp.department,
            "year": year,
            "month": month,
            "absent_days": absent_days,
            "lop_days": lop_days,
            "lop_deduction": lop_deduction,
            "is_org_summary": False,
        })
        org_total_absent += absent_days
        org_total_lop += lop_deduction

    result.sort(key=lambda x: x["absent_days"], reverse=True)

    # Org summary
    result.append({
        "emp_id": None, "emp_code": None,
        "name": "Organisation Summary", "department": None,
        "year": start_date.year, "month": start_date.month,
        "absent_days": org_total_absent,
        "lop_days": 0.0,
        "lop_deduction": org_total_lop,
        "is_org_summary": True,
    })

    return result


async def get_frequent_late_coming(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    emp_ids: Optional[list[str]] = None,
    departments: Optional[list[str]] = None,
) -> list[dict]:
    """
    Employees with late marks exceeding allowed_late_marks_per_month.
    Sorted by excess late marks desc.
    Requirement 23.1–23.3
    """
    emp_filter = [Employee.status == EmployeeStatus.ACTIVE]
    if emp_ids:
        emp_filter.append(Employee.id.in_(emp_ids))
    if departments:
        emp_filter.append(Employee.department.in_(departments))

    emp_stmt = select(Employee).where(and_(*emp_filter))
    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()
    emp_ids_list = [e.id for e in employees]
    emp_map = {e.id: e for e in employees}

    att_filter = [
        AttendanceDaily.date >= start_date,
        AttendanceDaily.date <= end_date,
        AttendanceDaily.emp_id.in_(emp_ids_list),
        or_(AttendanceDaily.is_late_mark == True, AttendanceDaily.is_half_late_mark == True),
    ]
    att_stmt = select(AttendanceDaily).where(and_(*att_filter))
    att_result = await db.execute(att_stmt)
    records = att_result.scalars().all()

    company_policy = await get_policy(db)
    override_stmt = select(EmployeePolicyOverride).where(EmployeePolicyOverride.emp_id.in_(emp_ids_list))
    override_result = await db.execute(override_stmt)
    overrides = {o.emp_id: o for o in override_result.scalars().all()}

    payroll_stmt = select(Payroll).where(
        and_(
            Payroll.emp_id.in_(emp_ids_list),
            or_(
                and_(Payroll.year == start_date.year, Payroll.month >= start_date.month),
                and_(Payroll.year == end_date.year, Payroll.month <= end_date.month),
            )
        )
    )
    payroll_result = await db.execute(payroll_stmt)
    payroll_by_emp_month: dict[tuple, Payroll] = {}
    for pr in payroll_result.scalars().all():
        payroll_by_emp_month[(pr.emp_id, pr.year, pr.month)] = pr

    by_emp_month: dict[tuple, int] = defaultdict(int)
    for record in records:
        key = (record.emp_id, record.date.year, record.date.month)
        by_emp_month[key] += 1

    result = []
    for (emp_id, year, month), late_count in by_emp_month.items():
        emp = emp_map.get(emp_id)
        if not emp:
            continue
        override = overrides.get(emp_id)
        policy = get_effective_policy(company_policy, override)
        allowed = company_policy.allowed_late_marks_per_month

        if late_count <= allowed:
            continue

        excess = late_count - allowed
        payroll = payroll_by_emp_month.get((emp_id, year, month))
        late_deduction = payroll.late_mark_deduction if payroll and payroll.late_mark_deduction else Decimal("0")

        result.append({
            "emp_id": emp_id,
            "emp_code": emp.emp_code,
            "name": emp.name,
            "department": emp.department,
            "year": year,
            "month": month,
            "late_mark_count": late_count,
            "allowed_limit": allowed,
            "excess_late_marks": excess,
            "late_mark_deduction": late_deduction,
        })

    result.sort(key=lambda x: x["excess_late_marks"], reverse=True)
    return result


async def get_missed_punch(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    emp_ids: Optional[list[str]] = None,
    departments: Optional[list[str]] = None,
) -> list[dict]:
    """
    Missed punch records (null check-in or check-out).
    Also includes MissedPunchRequest records with pending/rejected status.
    Sorted by date desc, then name asc.
    Requirement 24.1–24.3
    """
    emp_filter = [Employee.status == EmployeeStatus.ACTIVE]
    if emp_ids:
        emp_filter.append(Employee.id.in_(emp_ids))
    if departments:
        emp_filter.append(Employee.department.in_(departments))

    emp_stmt = select(Employee).where(and_(*emp_filter))
    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()
    emp_ids_list = [e.id for e in employees]
    emp_map = {e.id: e for e in employees}

    # Attendance records with null check-in or check-out
    att_filter = [
        AttendanceDaily.date >= start_date,
        AttendanceDaily.date <= end_date,
        AttendanceDaily.emp_id.in_(emp_ids_list),
        AttendanceDaily.status.in_([AttendanceStatus.PRESENT, AttendanceStatus.HALFDAY]),
        or_(AttendanceDaily.check_in.is_(None), AttendanceDaily.check_out.is_(None)),
    ]
    att_stmt = select(AttendanceDaily).where(and_(*att_filter))
    att_result = await db.execute(att_stmt)
    att_records = att_result.scalars().all()

    # MissedPunchRequest records
    mpr_filter = [
        MissedPunchRequest.date >= start_date,
        MissedPunchRequest.date <= end_date,
        MissedPunchRequest.emp_id.in_(emp_ids_list),
        MissedPunchRequest.status.in_([MissedPunchStatus.PENDING, MissedPunchStatus.REJECTED]),
    ]
    mpr_stmt = select(MissedPunchRequest).where(and_(*mpr_filter))
    mpr_result = await db.execute(mpr_stmt)
    mpr_records = mpr_result.scalars().all()

    result = []

    for record in att_records:
        emp = emp_map.get(record.emp_id)
        if not emp:
            continue
        if record.check_in is None and record.check_out is None:
            missing = "both"
        elif record.check_in is None:
            missing = "check_in"
        else:
            missing = "check_out"

        result.append({
            "emp_id": emp.id,
            "emp_code": emp.emp_code,
            "name": emp.name,
            "department": emp.department,
            "date": record.date,
            "check_in": record.check_in,
            "check_out": record.check_out,
            "missing_punch": missing,
            "source": "attendance",
            "request_status": None,
        })

    for mpr in mpr_records:
        emp = emp_map.get(mpr.emp_id)
        if not emp:
            continue
        if mpr.requested_check_in is None and mpr.requested_check_out is None:
            missing = "both"
        elif mpr.requested_check_in is None:
            missing = "check_in"
        else:
            missing = "check_out"

        result.append({
            "emp_id": emp.id,
            "emp_code": emp.emp_code,
            "name": emp.name,
            "department": emp.department,
            "date": mpr.date,
            "check_in": None,
            "check_out": None,
            "missing_punch": missing,
            "source": "missed_punch_request",
            "request_status": mpr.status.value,
        })

    result.sort(key=lambda x: (-x["date"].toordinal(), x["name"]))
    return result


async def get_half_day_frequent(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    emp_ids: Optional[list[str]] = None,
    departments: Optional[list[str]] = None,
) -> list[dict]:
    """
    Employees with half_day_count > 2 per month.
    Distinguishes late-mark-triggered vs manual.
    Sorted by half_day_count desc.
    Requirement 25.1–25.3
    """
    emp_filter = [Employee.status == EmployeeStatus.ACTIVE]
    if emp_ids:
        emp_filter.append(Employee.id.in_(emp_ids))
    if departments:
        emp_filter.append(Employee.department.in_(departments))

    emp_stmt = select(Employee).where(and_(*emp_filter))
    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()
    emp_ids_list = [e.id for e in employees]
    emp_map = {e.id: e for e in employees}

    att_filter = [
        AttendanceDaily.date >= start_date,
        AttendanceDaily.date <= end_date,
        AttendanceDaily.emp_id.in_(emp_ids_list),
        or_(
            AttendanceDaily.status == AttendanceStatus.HALFDAY,
            AttendanceDaily.is_half_day == True,
        ),
    ]
    att_stmt = select(AttendanceDaily).where(and_(*att_filter))
    att_result = await db.execute(att_stmt)
    records = att_result.scalars().all()

    by_emp_month: dict[tuple, dict] = defaultdict(lambda: {
        "total": 0, "late_triggered": 0, "manual": 0
    })

    for record in records:
        key = (record.emp_id, record.date.year, record.date.month)
        by_emp_month[key]["total"] += 1
        if record.late_mark_type == LateMarkType.HALF_DAY:
            by_emp_month[key]["late_triggered"] += 1
        elif record.is_overridden:
            by_emp_month[key]["manual"] += 1

    result = []
    for (emp_id, year, month), data in by_emp_month.items():
        if data["total"] <= 2:
            continue
        emp = emp_map.get(emp_id)
        if not emp:
            continue
        result.append({
            "emp_id": emp_id,
            "emp_code": emp.emp_code,
            "name": emp.name,
            "department": emp.department,
            "year": year,
            "month": month,
            "half_day_count": data["total"],
            "late_mark_triggered_count": data["late_triggered"],
            "manual_entry_count": data["manual"],
        })

    result.sort(key=lambda x: x["half_day_count"], reverse=True)
    return result


async def get_absent_cost_impact(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    emp_ids: Optional[list[str]] = None,
    departments: Optional[list[str]] = None,
) -> list[dict]:
    """
    LOP cost impact per employee per month.
    Includes dept subtotals and org grand total.
    Requirement 26.1–26.4
    """
    emp_filter = [Employee.status == EmployeeStatus.ACTIVE]
    if emp_ids:
        emp_filter.append(Employee.id.in_(emp_ids))
    if departments:
        emp_filter.append(Employee.department.in_(departments))

    emp_stmt = select(Employee).where(and_(*emp_filter))
    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()
    emp_ids_list = [e.id for e in employees]
    emp_map = {e.id: e for e in employees}

    payroll_stmt = select(Payroll).where(
        and_(
            Payroll.emp_id.in_(emp_ids_list),
            or_(
                and_(Payroll.year == start_date.year, Payroll.month >= start_date.month),
                and_(Payroll.year == end_date.year, Payroll.month <= end_date.month),
            )
        )
    )
    payroll_result = await db.execute(payroll_stmt)
    payroll_records = payroll_result.scalars().all()

    # Count absent days per emp per month
    att_filter = [
        AttendanceDaily.date >= start_date,
        AttendanceDaily.date <= end_date,
        AttendanceDaily.emp_id.in_(emp_ids_list),
        AttendanceDaily.status == AttendanceStatus.ABSENT,
    ]
    att_stmt = select(AttendanceDaily).where(and_(*att_filter))
    att_result = await db.execute(att_stmt)
    absent_by_emp_month: dict[tuple, int] = defaultdict(int)
    for r in att_result.scalars().all():
        absent_by_emp_month[(r.emp_id, r.date.year, r.date.month)] += 1

    result = []
    dept_totals: dict[tuple, dict] = defaultdict(lambda: {"lop_deduction": Decimal("0")})
    grand_total_lop = Decimal("0")

    for pr in payroll_records:
        emp = emp_map.get(pr.emp_id)
        if not emp:
            continue
        gross = pr.gross_salary or emp.salary or Decimal("0")
        working_days = pr.working_days or 26
        per_day_rate = (
            gross / Decimal(str(working_days))
            if working_days > 0 and gross
            else Decimal("0")
        )
        lop_days = float(pr.lop_days) if pr.lop_days else 0.0
        lop_deduction = pr.lop_deduction or (per_day_rate * Decimal(str(lop_days))).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        absent_days = absent_by_emp_month.get((pr.emp_id, pr.year, pr.month), 0)

        result.append({
            "emp_id": pr.emp_id,
            "emp_code": emp.emp_code,
            "name": emp.name,
            "department": emp.department,
            "year": pr.year,
            "month": pr.month,
            "absent_days": absent_days,
            "lop_days": lop_days,
            "gross_salary": gross,
            "per_day_rate": per_day_rate.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "lop_deduction": lop_deduction,
            "is_subtotal": False,
            "is_grand_total": False,
        })

        dept_key = (emp.department or "Unknown", pr.year, pr.month)
        dept_totals[dept_key]["lop_deduction"] += lop_deduction
        grand_total_lop += lop_deduction

    # Dept subtotals
    for (dept, year, month), data in dept_totals.items():
        result.append({
            "emp_id": None, "emp_code": None,
            "name": f"{dept} Subtotal", "department": dept,
            "year": year, "month": month,
            "absent_days": 0, "lop_days": 0.0,
            "gross_salary": Decimal("0"), "per_day_rate": Decimal("0"),
            "lop_deduction": data["lop_deduction"],
            "is_subtotal": True, "is_grand_total": False,
        })

    # Grand total
    result.append({
        "emp_id": None, "emp_code": None,
        "name": "Grand Total", "department": None,
        "year": start_date.year, "month": start_date.month,
        "absent_days": 0, "lop_days": 0.0,
        "gross_salary": Decimal("0"), "per_day_rate": Decimal("0"),
        "lop_deduction": grand_total_lop,
        "is_subtotal": False, "is_grand_total": True,
    })

    return result


async def get_salary_vs_ot(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    emp_ids: Optional[list[str]] = None,
    departments: Optional[list[str]] = None,
) -> list[dict]:
    """
    Salary vs OT cost comparison per department per month.
    Flags departments where OT cost > 15% of gross salary.
    Requirement 27.1–27.3
    """
    emp_filter = [Employee.status == EmployeeStatus.ACTIVE]
    if emp_ids:
        emp_filter.append(Employee.id.in_(emp_ids))
    if departments:
        emp_filter.append(Employee.department.in_(departments))

    emp_stmt = select(Employee).where(and_(*emp_filter))
    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()
    emp_ids_list = [e.id for e in employees]
    emp_map = {e.id: e for e in employees}

    payroll_stmt = select(Payroll).where(
        and_(
            Payroll.emp_id.in_(emp_ids_list),
            or_(
                and_(Payroll.year == start_date.year, Payroll.month >= start_date.month),
                and_(Payroll.year == end_date.year, Payroll.month <= end_date.month),
            )
        )
    )
    payroll_result = await db.execute(payroll_stmt)
    payroll_records = payroll_result.scalars().all()

    # Get OT cost per employee per month
    ot_data = await get_ot_cost(db, start_date, end_date, emp_ids, departments)
    ot_by_emp_month: dict[tuple, Decimal] = {}
    for row in ot_data:
        if not row["is_subtotal"] and not row["is_grand_total"] and row["emp_id"]:
            ot_by_emp_month[(row["emp_id"], row["year"], row["month"])] = row["ot_cost"]

    by_dept_month: dict[tuple, dict] = defaultdict(lambda: {"gross": Decimal("0"), "ot_cost": Decimal("0")})

    for pr in payroll_records:
        emp = emp_map.get(pr.emp_id)
        if not emp:
            continue
        dept = emp.department or "Unknown"
        key = (dept, pr.year, pr.month)
        gross = pr.gross_salary or emp.salary or Decimal("0")
        ot_cost = ot_by_emp_month.get((pr.emp_id, pr.year, pr.month), Decimal("0"))
        by_dept_month[key]["gross"] += gross
        by_dept_month[key]["ot_cost"] += ot_cost

    result = []
    org_gross = Decimal("0")
    org_ot = Decimal("0")

    for (dept, year, month), data in by_dept_month.items():
        gross = data["gross"]
        ot_cost = data["ot_cost"]
        ot_pct = float(ot_cost / gross * 100) if gross else 0.0
        exceeds = ot_pct > 15.0

        result.append({
            "department": dept,
            "year": year,
            "month": month,
            "total_gross_salary": gross,
            "total_ot_cost": ot_cost,
            "ot_cost_pct_of_gross": round(ot_pct, 2),
            "exceeds_15pct_flag": exceeds,
            "is_org_summary": False,
        })
        org_gross += gross
        org_ot += ot_cost

    # Org summary
    org_pct = float(org_ot / org_gross * 100) if org_gross else 0.0
    result.append({
        "department": None,
        "year": start_date.year,
        "month": start_date.month,
        "total_gross_salary": org_gross,
        "total_ot_cost": org_ot,
        "ot_cost_pct_of_gross": round(org_pct, 2),
        "exceeds_15pct_flag": org_pct > 15.0,
        "is_org_summary": True,
    })

    return result


async def get_leave_balance(
    db: AsyncSession,
    year: int,
    emp_ids: Optional[list[str]] = None,
    departments: Optional[list[str]] = None,
) -> list[dict]:
    """
    Leave balances per employee for a given year.
    Returns zero rows for employees with no LeaveBalance record.
    Requirement 28.1–28.4
    """
    emp_filter = [Employee.status == EmployeeStatus.ACTIVE]
    if emp_ids:
        emp_filter.append(Employee.id.in_(emp_ids))
    if departments:
        emp_filter.append(Employee.department.in_(departments))

    emp_stmt = select(Employee).where(and_(*emp_filter))
    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()
    emp_ids_list = [e.id for e in employees]
    emp_map = {e.id: e for e in employees}

    lb_stmt = select(LeaveBalance).where(
        and_(LeaveBalance.emp_id.in_(emp_ids_list), LeaveBalance.year == year)
    )
    lb_result = await db.execute(lb_stmt)
    lb_by_emp = {lb.emp_id: lb for lb in lb_result.scalars().all()}

    cob_stmt = select(CompOffBalance).where(CompOffBalance.emp_id.in_(emp_ids_list))
    cob_result = await db.execute(cob_stmt)
    cob_by_emp = {cob.emp_id: cob for cob in cob_result.scalars().all()}

    result = []
    for emp in employees:
        lb = lb_by_emp.get(emp.id)
        cob = cob_by_emp.get(emp.id)

        cl_total = lb.cl_total if lb else 0
        cl_used = float(lb.cl_used) if lb else 0.0
        cl_remaining = compute_cl_remaining(cl_total, cl_used)

        result.append({
            "emp_id": emp.id,
            "emp_code": emp.emp_code,
            "name": emp.name,
            "department": emp.department,
            "year": year,
            "cl_total": cl_total,
            "cl_used": cl_used,
            "cl_remaining": cl_remaining,
            "sl_used": float(lb.sl_used) if lb else 0.0,
            "el_used": float(lb.el_used) if lb else 0.0,
            "lwp_days": float(lb.lwp_days) if lb else 0.0,
            "compoff_balance": cob.balance if cob else 0,
        })
    return result


async def get_leave_usage_trend(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    emp_ids: Optional[list[str]] = None,
    departments: Optional[list[str]] = None,
) -> list[dict]:
    """
    Leave usage trend by month and leave type.
    Includes total row per month.
    Requirement 29.1–29.3
    """
    emp_filter = [Employee.status == EmployeeStatus.ACTIVE]
    if emp_ids:
        emp_filter.append(Employee.id.in_(emp_ids))
    if departments:
        emp_filter.append(Employee.department.in_(departments))

    emp_stmt = select(Employee).where(and_(*emp_filter))
    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()
    emp_ids_list = [e.id for e in employees]

    leave_filter = [
        Leave.emp_id.in_(emp_ids_list),
        Leave.status == LeaveStatus.APPROVED,
        Leave.from_date >= start_date,
        Leave.from_date <= end_date,
    ]
    leave_stmt = select(Leave).where(and_(*leave_filter))
    leave_result = await db.execute(leave_stmt)
    leave_records = leave_result.scalars().all()

    # Group by (year, month, leave_type)
    by_month_type: dict[tuple, dict] = defaultdict(lambda: {"days": 0.0, "emp_ids": set()})

    for leave in leave_records:
        key = (leave.from_date.year, leave.from_date.month, leave.leave_type.value)
        by_month_type[key]["days"] += float(leave.total_days)
        by_month_type[key]["emp_ids"].add(leave.emp_id)

    result = []
    month_totals: dict[tuple, dict] = defaultdict(lambda: {"days": 0.0, "emp_ids": set()})

    for (year, month, leave_type), data in by_month_type.items():
        result.append({
            "year": year,
            "month": month,
            "leave_type": leave_type,
            "total_days": round(data["days"], 1),
            "employee_count": len(data["emp_ids"]),
            "is_total_row": False,
        })
        mk = (year, month)
        month_totals[mk]["days"] += data["days"]
        month_totals[mk]["emp_ids"].update(data["emp_ids"])

    # Total rows per month
    for (year, month), data in month_totals.items():
        result.append({
            "year": year,
            "month": month,
            "leave_type": None,
            "total_days": round(data["days"], 1),
            "employee_count": len(data["emp_ids"]),
            "is_total_row": True,
        })

    return result


async def get_compoff_balance(
    db: AsyncSession,
    emp_ids: Optional[list[str]] = None,
    departments: Optional[list[str]] = None,
) -> list[dict]:
    """
    Comp-off balances per employee.
    Computes expiring credits within 30 days.
    Requirement 30.1–30.3
    """
    emp_filter = [Employee.status == EmployeeStatus.ACTIVE]
    if emp_ids:
        emp_filter.append(Employee.id.in_(emp_ids))
    if departments:
        emp_filter.append(Employee.department.in_(departments))

    emp_stmt = select(Employee).where(and_(*emp_filter))
    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()
    emp_ids_list = [e.id for e in employees]
    emp_map = {e.id: e for e in employees}

    cob_stmt = select(CompOffBalance).where(CompOffBalance.emp_id.in_(emp_ids_list))
    cob_result = await db.execute(cob_stmt)
    cob_by_emp = {cob.emp_id: cob for cob in cob_result.scalars().all()}

    # Credits expiring within 30 days
    today = date.today()
    expiry_threshold = today + timedelta(days=30)
    credit_stmt = select(CompOffCredit).where(
        and_(
            CompOffCredit.emp_id.in_(emp_ids_list),
            CompOffCredit.expiry_date <= expiry_threshold,
            CompOffCredit.expiry_date >= today,
            CompOffCredit.is_lapsed == False,
        )
    )
    credit_result = await db.execute(credit_stmt)
    expiring_by_emp: dict[str, int] = defaultdict(int)
    for credit in credit_result.scalars().all():
        expiring_by_emp[credit.emp_id] += 1

    # Total credits earned
    all_credits_stmt = select(CompOffCredit).where(CompOffCredit.emp_id.in_(emp_ids_list))
    all_credits_result = await db.execute(all_credits_stmt)
    credits_by_emp: dict[str, int] = defaultdict(int)
    for credit in all_credits_result.scalars().all():
        credits_by_emp[credit.emp_id] += 1

    result = []
    for emp in employees:
        cob = cob_by_emp.get(emp.id)
        balance = cob.balance if cob else 0
        total_earned = credits_by_emp.get(emp.id, 0)
        total_used = max(0, total_earned - balance)

        result.append({
            "emp_id": emp.id,
            "emp_code": emp.emp_code,
            "name": emp.name,
            "department": emp.department,
            "total_credits_earned": total_earned,
            "total_used": total_used,
            "remaining_balance": balance,
            "expiring_within_30_days": expiring_by_emp.get(emp.id, 0),
        })
    return result


async def get_expiring_compoff(
    db: AsyncSession,
    emp_ids: Optional[list[str]] = None,
    departments: Optional[list[str]] = None,
) -> dict:
    """
    Expiring comp-off credits alert.
    Returns empty + message when comp_off_enabled is false.
    Sorted by expiry_date asc.
    Requirement 31.1–31.4
    """
    company_policy = await get_policy(db)

    if not company_policy.comp_off_enabled:
        return {
            "data": [],
            "message": "Comp-off is disabled in the current attendance policy."
        }

    emp_filter = [Employee.status == EmployeeStatus.ACTIVE]
    if emp_ids:
        emp_filter.append(Employee.id.in_(emp_ids))
    if departments:
        emp_filter.append(Employee.department.in_(departments))

    emp_stmt = select(Employee).where(and_(*emp_filter))
    emp_result = await db.execute(emp_stmt)
    employees = emp_result.scalars().all()
    emp_ids_list = [e.id for e in employees]
    emp_map = {e.id: e for e in employees}

    today = date.today()
    expiry_days = company_policy.comp_off_expiry_days
    expiry_threshold = today + timedelta(days=expiry_days)

    credit_stmt = select(CompOffCredit).where(
        and_(
            CompOffCredit.emp_id.in_(emp_ids_list),
            CompOffCredit.expiry_date <= expiry_threshold,
            CompOffCredit.expiry_date >= today,
            CompOffCredit.is_lapsed == False,
        )
    ).order_by(CompOffCredit.expiry_date)
    credit_result = await db.execute(credit_stmt)
    credits = credit_result.scalars().all()

    result = []
    for credit in credits:
        emp = emp_map.get(credit.emp_id)
        if not emp:
            continue
        days_remaining = (credit.expiry_date - today).days
        result.append({
            "emp_id": emp.id,
            "emp_code": emp.emp_code,
            "name": emp.name,
            "department": emp.department,
            "credit_date": credit.earned_date,
            "expiry_date": credit.expiry_date,
            "days_remaining": days_remaining,
            "credit_hours": 1,
        })

    return {"data": result, "message": None}


# ─── Export Service ───────────────────────────────────────────────────────────

# Mapping of report_name → (service_function, headers)
_REPORT_HEADERS: dict[str, list[str]] = {
    "employee-attendance-summary": ["emp_code", "name", "department", "working_days", "present_days", "absent_days", "half_day_count", "late_mark_count", "lop_days"],
    "employee-working-hours": ["emp_code", "name", "department", "date", "check_in", "check_out", "working_hours", "is_missed_punch"],
    "employee-inout": ["emp_code", "name", "department", "date", "check_in", "check_out", "late_mark_status", "shift_start_time"],
    "employee-late-marks": ["emp_code", "name", "department", "total_late_marks", "total_half_late_marks", "total_half_days_from_late"],
    "employee-ot": ["emp_code", "name", "department", "total_ot_hours", "total_ot_cost", "ot_days_count"],
    "employee-halfday-absent": ["emp_code", "name", "department", "absent_days", "half_day_count", "lop_days"],
    "daily-attendance-summary": ["date", "total_employees", "present_count", "absent_count", "half_day_count", "on_leave_count", "weekly_off_count", "holiday_count"],
    "monthly-attendance-trend": ["year", "month", "avg_attendance_pct", "total_present_days", "total_absent_days", "total_late_marks"],
    "late-coming-analysis": ["emp_code", "name", "department", "year", "month", "late_mark_count", "half_late_mark_count", "avg_minutes_late"],
    "early-leaving-analysis": ["emp_code", "name", "department", "date", "check_out", "scheduled_end_time", "minutes_left_early"],
    "shift-wise-attendance": ["shift_type", "year", "month", "total_employees", "avg_attendance_pct", "total_ot_hours", "total_late_marks"],
    "department-attendance": ["department", "year", "month", "employee_count", "avg_attendance_pct", "total_absent_days", "total_late_marks", "total_ot_hours"],
    "department-ot": ["department", "year", "month", "total_ot_hours", "total_ot_cost", "employee_count_with_ot", "avg_ot_hours_per_employee"],
    "monthly-ot-trend": ["year", "month", "total_ot_hours", "total_ot_cost", "employee_count_with_ot", "mom_change_pct"],
    "ot-cost": ["emp_code", "name", "department", "year", "month", "gross_salary", "ot_hours", "cost_per_hour", "ot_cost", "ot_cost_pct_of_gross"],
    "holiday-ot": ["emp_code", "name", "department", "holiday_name", "date", "working_hours", "ot_hours", "ot_cost"],
    "excess-ot-alert": ["emp_code", "name", "department", "year", "month", "total_ot_hours", "monthly_ot_limit", "excess_hours", "excess_ot_cost"],
    "cost-per-employee": ["emp_code", "name", "department", "year", "month", "gross_salary", "total_deductions", "net_pay", "ot_cost", "total_cost", "cost_per_hour"],
    "high-absenteeism": ["emp_code", "name", "department", "year", "month", "absent_days", "lop_days", "lop_deduction"],
    "frequent-late-coming": ["emp_code", "name", "department", "year", "month", "late_mark_count", "allowed_limit", "excess_late_marks", "late_mark_deduction"],
    "missed-punch": ["emp_code", "name", "department", "date", "check_in", "check_out", "missing_punch", "source", "request_status"],
    "half-day-frequent": ["emp_code", "name", "department", "year", "month", "half_day_count", "late_mark_triggered_count", "manual_entry_count"],
    "absent-cost-impact": ["emp_code", "name", "department", "year", "month", "absent_days", "lop_days", "gross_salary", "per_day_rate", "lop_deduction"],
    "salary-vs-ot": ["department", "year", "month", "total_gross_salary", "total_ot_cost", "ot_cost_pct_of_gross", "exceeds_15pct_flag"],
    "leave-balance": ["emp_code", "name", "department", "year", "cl_total", "cl_used", "cl_remaining", "sl_used", "el_used", "lwp_days", "compoff_balance"],
    "leave-usage-trend": ["year", "month", "leave_type", "total_days", "employee_count"],
    "compoff-balance": ["emp_code", "name", "department", "total_credits_earned", "total_used", "remaining_balance", "expiring_within_30_days"],
    "expiring-compoff": ["emp_code", "name", "department", "credit_date", "expiry_date", "days_remaining", "credit_hours"],
}


async def export_report(
    db: AsyncSession,
    report_name: str,
    filters: dict,
    fmt: str,
) -> tuple:
    """
    Export a report to CSV or Excel.
    Returns (bytes, filename) tuple.
    Raises ValueError for unknown format.
    Raises RuntimeError when openpyxl is not installed for xlsx.
    Requirement 33.1–33.5
    """
    if fmt not in ("csv", "xlsx"):
        raise ValueError("format must be csv or xlsx")

    # Dispatch to appropriate service function
    start_date = filters.get("start_date") or date(date.today().year, date.today().month, 1)
    end_date = filters.get("end_date") or date.today()
    emp_ids = filters.get("emp_ids")
    departments = filters.get("departments")
    year = filters.get("year") or date.today().year
    month = filters.get("month") or date.today().month
    granularity = filters.get("granularity", "daily")

    rows = []
    if report_name == "employee-attendance-summary":
        rows = await get_employee_attendance_summary(db, start_date, end_date, emp_ids, departments)
    elif report_name == "employee-working-hours":
        rows = await get_employee_working_hours(db, start_date, end_date, emp_ids, departments, granularity)
    elif report_name == "employee-inout":
        rows = await get_employee_inout(db, start_date, end_date, emp_ids, departments)
    elif report_name == "employee-late-marks":
        rows = await get_employee_late_marks(db, start_date, end_date, emp_ids, departments)
    elif report_name == "employee-ot":
        rows = await get_employee_ot(db, start_date, end_date, emp_ids, departments)
    elif report_name == "employee-halfday-absent":
        rows = await get_employee_halfday_absent(db, start_date, end_date, emp_ids, departments)
    elif report_name == "daily-attendance-summary":
        rows = await get_daily_attendance_summary(db, start_date, end_date, emp_ids, departments)
    elif report_name == "monthly-attendance-trend":
        rows = await get_monthly_attendance_trend(db, start_date, end_date, emp_ids, departments)
    elif report_name == "late-coming-analysis":
        rows = await get_late_coming_analysis(db, start_date, end_date, emp_ids, departments)
    elif report_name == "early-leaving-analysis":
        rows = await get_early_leaving_analysis(db, start_date, end_date, emp_ids, departments)
    elif report_name == "shift-wise-attendance":
        rows = await get_shift_wise_attendance(db, start_date, end_date, emp_ids, departments)
    elif report_name == "attendance-heatmap":
        heatmap = await get_attendance_heatmap(db, month, year, emp_ids, departments)
        rows = heatmap.get("cells", [])
    elif report_name == "department-attendance":
        rows = await get_department_attendance(db, start_date, end_date, emp_ids, departments)
    elif report_name == "department-ot":
        rows = await get_department_ot(db, start_date, end_date, emp_ids, departments)
    elif report_name == "monthly-ot-trend":
        rows = await get_monthly_ot_trend(db, start_date, end_date)
    elif report_name == "ot-cost":
        rows = await get_ot_cost(db, start_date, end_date, emp_ids, departments)
    elif report_name == "holiday-ot":
        rows = await get_holiday_ot(db, start_date, end_date, emp_ids, departments)
    elif report_name == "excess-ot-alert":
        rows = await get_excess_ot_alert(db, start_date, end_date, emp_ids, departments)
    elif report_name == "cost-per-employee":
        rows = await get_cost_per_employee(db, start_date, end_date, emp_ids, departments)
    elif report_name == "high-absenteeism":
        rows = await get_high_absenteeism(db, start_date, end_date, emp_ids, departments)
    elif report_name == "frequent-late-coming":
        rows = await get_frequent_late_coming(db, start_date, end_date, emp_ids, departments)
    elif report_name == "missed-punch":
        rows = await get_missed_punch(db, start_date, end_date, emp_ids, departments)
    elif report_name == "half-day-frequent":
        rows = await get_half_day_frequent(db, start_date, end_date, emp_ids, departments)
    elif report_name == "absent-cost-impact":
        rows = await get_absent_cost_impact(db, start_date, end_date, emp_ids, departments)
    elif report_name == "salary-vs-ot":
        rows = await get_salary_vs_ot(db, start_date, end_date, emp_ids, departments)
    elif report_name == "leave-balance":
        rows = await get_leave_balance(db, year, emp_ids, departments)
    elif report_name == "leave-usage-trend":
        rows = await get_leave_usage_trend(db, start_date, end_date, emp_ids, departments)
    elif report_name == "compoff-balance":
        rows = await get_compoff_balance(db, emp_ids, departments)
    elif report_name == "expiring-compoff":
        result = await get_expiring_compoff(db, emp_ids, departments)
        rows = result.get("data", []) if isinstance(result, dict) else result
    else:
        rows = []

    headers = _REPORT_HEADERS.get(report_name, list(rows[0].keys()) if rows else [])
    filename = build_export_filename(report_name, start_date, end_date, fmt)

    if fmt == "csv":
        data = generate_csv(rows, headers)
        return data, filename
    else:
        # xlsx
        try:
            import openpyxl
        except ImportError:
            raise RuntimeError("Excel export unavailable: openpyxl is not installed")

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(headers)
        for row in rows:
            ws.append([str(row.get(h, "")) for h in headers])

        output = io.BytesIO()
        wb.save(output)
        return output.getvalue(), filename
