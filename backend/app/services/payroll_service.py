"""
Payroll calculation service — pure functions, no DB access.
All functions are synchronous and testable in isolation.
"""
import calendar
import types
from datetime import date, time, datetime
from decimal import Decimal, ROUND_HALF_UP
from math import floor
from typing import List

from app.models.attendance_daily import LateMarkType, AttendanceStatus


OFFICE_START_HOUR = 9
OFFICE_START_MIN = 30
OFFICE_START_MINS = OFFICE_START_HOUR * 60 + OFFICE_START_MIN  # 570
GRACE_PERIOD_MINS = 575  # 09:35 AM — effective threshold with grace period
PT_DEDUCTION = Decimal("200")


def _parse_time_to_mins(t: str) -> int:
    """Convert 'HH:MM' string to minutes since midnight."""
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def is_second_or_fourth_saturday(d: date) -> bool:
    """Return True if d is the 2nd or 4th Saturday of its month."""
    if d.weekday() != 5:  # 5 = Saturday
        return False
    saturday_count = sum(
        1 for day in range(1, d.day + 1)
        if date(d.year, d.month, day).weekday() == 5
    )
    return saturday_count in (2, 4)


def calculate_working_days(year: int, month: int, holidays: List[date], policy=None) -> int:
    """
    Count working days in a month.
    Uses policy.weekly_off_day and policy.second_fourth_saturday_off if provided.
    Falls back to Sunday + 2nd/4th Saturday when policy is None.
    """
    holiday_set = set(holidays)
    weekly_off = policy.weekly_off_day if policy else "sunday"
    second_fourth_sat_off = policy.second_fourth_saturday_off if policy is not None else True
    count = 0
    _, days_in_month = calendar.monthrange(year, month)
    for day in range(1, days_in_month + 1):
        d = date(year, month, day)
        # Check weekly off
        is_weekly_off = False
        if weekly_off == "sunday" and d.weekday() == 6:
            is_weekly_off = True
        elif weekly_off == "saturday" and d.weekday() == 5:
            is_weekly_off = True
        elif weekly_off == "sunday" and second_fourth_sat_off and is_second_or_fourth_saturday(d):
            is_weekly_off = True
        if not is_weekly_off and d not in holiday_set:
            count += 1
    return count


def calculate_late_mark_type(check_in_time: time, policy=None) -> LateMarkType:
    """
    Classify check-in time relative to shift start + grace period.
    Uses policy.shift_start_time and policy.grace_period_minutes if provided.
    Falls back to hardcoded defaults (09:30 + 5 min grace) when policy is None.
    """
    shift_start = _parse_time_to_mins(policy.shift_start_time if policy else "09:30")
    grace = policy.grace_period_minutes if policy else 5
    threshold = shift_start + grace  # on-time threshold
    total_mins = check_in_time.hour * 60 + check_in_time.minute
    if total_mins <= threshold:
        return LateMarkType.NONE
    elif total_mins <= threshold + 40:   # LATE window: +40 min
        return LateMarkType.LATE
    elif total_mins <= threshold + 55:   # HALF_LATE window: +15 min
        return LateMarkType.HALF_LATE
    else:
        return LateMarkType.HALF_DAY


def calculate_minimum_hours_status(check_in: datetime, check_out: datetime, policy=None) -> AttendanceStatus:
    """
    Determine attendance status based on total hours worked.
    Uses policy.shift_hours and policy.min_working_hours_for_halfday if provided.
    Falls back to 8h / 4.5h when policy is None.
    """
    full_hours = float(policy.shift_hours) if policy else 8.0
    half_hours = float(policy.min_working_hours_for_halfday) if policy else 4.5
    hours = (check_out - check_in).total_seconds() / 3600
    if hours >= full_hours:
        return AttendanceStatus.PRESENT
    elif hours >= half_hours:
        return AttendanceStatus.HALFDAY
    else:
        return AttendanceStatus.ABSENT


def resolve_day_status(
    d: date,
    holiday_dates: set,
    leave_dates: set,
    check_in,
    check_out,
    is_overridden: bool,
    policy=None,
) -> AttendanceStatus:
    """
    Resolve the attendance status for a given day using priority rules.
    Priority: weekly_off > holiday > leave > face-recognition derived > absent
    Uses policy for weekly_off_day and second_fourth_saturday_off if provided.
    """
    weekly_off = policy.weekly_off_day if policy else "sunday"
    second_fourth_sat_off = policy.second_fourth_saturday_off if policy is not None else True
    # Weekly off check
    is_weekly_off = False
    if weekly_off == "sunday" and d.weekday() == 6:
        is_weekly_off = True
    elif weekly_off == "saturday" and d.weekday() == 5:
        is_weekly_off = True
    elif weekly_off == "sunday" and second_fourth_sat_off and is_second_or_fourth_saturday(d):
        is_weekly_off = True
    if is_weekly_off:
        return AttendanceStatus.WEEKLYOFF
    if d in holiday_dates:
        return AttendanceStatus.HOLIDAY
    if d in leave_dates:
        return AttendanceStatus.LEAVE
    if check_in and check_out:
        min_hours_status = calculate_minimum_hours_status(check_in, check_out, policy)
        late_mark = calculate_late_mark_type(check_in.time() if hasattr(check_in, 'time') else check_in, policy)
        if late_mark == LateMarkType.HALF_DAY or min_hours_status == AttendanceStatus.HALFDAY:
            return AttendanceStatus.HALFDAY
        if min_hours_status == AttendanceStatus.ABSENT:
            return AttendanceStatus.ABSENT
        return AttendanceStatus.PRESENT
    elif check_in:
        late_mark = calculate_late_mark_type(check_in.time() if hasattr(check_in, 'time') else check_in, policy)
        if late_mark == LateMarkType.HALF_DAY:
            return AttendanceStatus.HALFDAY
        return AttendanceStatus.PRESENT
    return AttendanceStatus.ABSENT


def calculate_ot_hours(working_hours: float, policy) -> float:
    """
    Calculate overtime hours for a day.
    Returns 0.0 when OT is disabled or working hours don't exceed shift hours.
    """
    if not policy or not policy.ot_enabled:
        return 0.0
    return max(0.0, working_hours - float(policy.shift_hours))


def calculate_ot_amount(
    gross: Decimal,
    shift_hours: int,
    ot_hours: float,
    is_holiday_or_weeklyoff: bool,
    policy,
) -> Decimal:
    """
    Calculate overtime pay amount.
    Formula: (gross / 26 / shift_hours) × ot_hours × multiplier
    """
    if not policy or not policy.ot_enabled or ot_hours <= 0:
        return Decimal("0")
    multiplier = Decimal(str(policy.ot_holiday_multiplier)) if is_holiday_or_weeklyoff else Decimal(str(policy.ot_normal_multiplier))
    rate = gross / Decimal("26") / Decimal(str(shift_hours))
    return (rate * Decimal(str(ot_hours)) * multiplier).quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def calculate_salary_breakdown(gross: Decimal) -> dict:
    """
    Split gross salary into components.
    basic   = round(gross × 0.70)
    hra     = round(gross × 0.20)
    travel  = round(gross × 0.05)
    special = gross − basic − hra − travel  (ensures sum == gross)
    """
    basic = (gross * Decimal("0.70")).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    hra = (gross * Decimal("0.20")).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    travel = (gross * Decimal("0.05")).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    special = gross - basic - hra - travel
    return {
        "basic_salary": basic,
        "hra": hra,
        "travel_allowance": travel,
        "special_allowance": special,
    }


def calculate_lop_deduction(gross: Decimal, working_days: int, lop_days: Decimal) -> Decimal:
    """
    Loss-of-pay deduction.
    per_day = gross / working_days
    deduction = round(per_day × lop_days)
    """
    if working_days <= 0 or lop_days <= 0:
        return Decimal("0")
    per_day = gross / Decimal(str(working_days))
    return (per_day * lop_days).quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def calculate_late_deduction(gross: Decimal, working_days: int, half_day_from_late: Decimal) -> Decimal:
    """
    Late mark salary deduction.
    Every 2 half_day_from_late units = 1 deduction day.
    deduction_days = floor(half_day_from_late / 2)
    """
    if working_days <= 0 or half_day_from_late < 2:
        return Decimal("0")
    deduction_days = floor(float(half_day_from_late) / 2)
    if deduction_days <= 0:
        return Decimal("0")
    per_day = gross / Decimal(str(working_days))
    return (per_day * Decimal(str(deduction_days))).quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def calculate_net_pay(
    gross: Decimal,
    working_days: int,
    lop_days: Decimal,
    half_day_from_late: Decimal,
) -> Decimal:
    """
    Full net pay calculation.
    net = max(0, gross - PT(200) - lop_deduction - late_deduction)
    """
    lop_deduct = calculate_lop_deduction(gross, working_days, lop_days)
    late_deduct = calculate_late_deduction(gross, working_days, half_day_from_late)
    total_deductions = PT_DEDUCTION + lop_deduct + late_deduct
    net = gross - total_deductions
    return max(Decimal("0"), net)


# ─── Per-Employee Effective Policy ──────────────────────────────────────────

OVERRIDABLE_FIELDS = [
    'shift_type', 'shift_start_time', 'shift_end_time', 'shift_hours',
    'grace_period_minutes', 'ot_enabled', 'min_working_hours_for_halfday',
    'weekly_off_day', 'second_fourth_saturday_off', 'comp_off_enabled',
    'night_shift_allowance',
]

NON_OVERRIDABLE_FIELDS = [
    'weekly_limit_hours', 'break_time_minutes', 'allowed_late_marks_per_month',
    'late_action', 'early_leaving_action', 'consecutive_absent_threshold',
    'ot_normal_multiplier', 'ot_holiday_multiplier', 'comp_off_expiry_days',
    'missed_punch_requests_per_month',
]


def get_effective_policy(company_policy, employee_override=None) -> types.SimpleNamespace:
    """
    Merge company_policy with employee_override.
    For each overridable field: use override value if non-null, else company default.
    Non-overridable fields always come from company_policy.
    Returns a SimpleNamespace with all policy fields populated (never null).
    Pure function — no DB access.
    """
    effective = types.SimpleNamespace()

    # Non-overridable: always from company policy
    for field in NON_OVERRIDABLE_FIELDS:
        setattr(effective, field, getattr(company_policy, field))

    # Overridable: use override value if non-null, else company default
    for field in OVERRIDABLE_FIELDS:
        override_val = getattr(employee_override, field, None) if employee_override else None
        company_val = getattr(company_policy, field)
        setattr(effective, field, override_val if override_val is not None else company_val)

    return effective



def recalculate_payroll_for_month(
    emp_id: str,
    month: int,
    year: int,
    attendance_records: List,
    holidays: List[date],
    leave_balance,
    employee_salary: Decimal,
    policy,
) -> dict:
    """
    Pure function to recalculate payroll for a month based on current attendance data.
    
    Args:
        emp_id: Employee ID
        month: Month (1-12)
        year: Year
        attendance_records: List of AttendanceDaily records for the month
        holidays: List of holiday dates
        leave_balance: LeaveBalance object (or None)
        employee_salary: Employee's gross salary
        policy: Effective policy object (SimpleNamespace or AttendancePolicy)
    
    Returns:
        Dictionary with all updated payroll fields
    
    Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
    """
    # Calculate working days
    working_days = calculate_working_days(year, month, holidays, policy)
    
    # Initialize counters
    present_days = 0
    half_days = 0
    total_ot_hours = 0.0
    
    # Iterate through attendance records to calculate present_days, half_days, total_ot_hours
    for record in attendance_records:
        if record.status == AttendanceStatus.PRESENT:
            present_days += 1
            # Calculate OT hours if check_in and check_out exist
            if record.check_in and record.check_out:
                working_hours = (record.check_out - record.check_in).total_seconds() / 3600
                ot_hours = calculate_ot_hours(working_hours, policy)
                total_ot_hours += ot_hours
        elif record.status == AttendanceStatus.HALFDAY:
            half_days += 1
            # Calculate OT hours for halfday if check_in and check_out exist
            if record.check_in and record.check_out:
                working_hours = (record.check_out - record.check_in).total_seconds() / 3600
                ot_hours = calculate_ot_hours(working_hours, policy)
                total_ot_hours += ot_hours
    
    # Calculate lop_days from leave_balance
    lwp_days = Decimal(str(leave_balance.lwp_days or 0)) if leave_balance else Decimal("0")
    half_day_from_late = Decimal(str(leave_balance.half_day_from_late or 0)) if leave_balance else Decimal("0")
    lop_days = lwp_days + Decimal(str(half_days)) * Decimal("0.5")
    
    # Calculate salary breakdown
    gross = Decimal(str(employee_salary))
    breakdown = calculate_salary_breakdown(gross)
    
    # Calculate deductions
    lop_deduction = calculate_lop_deduction(gross, working_days, lop_days)
    late_deduction = calculate_late_deduction(gross, working_days, half_day_from_late)
    total_deductions = PT_DEDUCTION + lop_deduction + late_deduction
    
    # Calculate net_pay
    net_pay = max(Decimal("0"), gross - total_deductions)
    
    # Return dictionary with all updated payroll fields
    return {
        "working_days": working_days,
        "present_days": present_days,
        "half_days": half_days,
        "lop_days": lop_days,
        "ot_hours": Decimal(str(total_ot_hours)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        "gross_salary": gross,
        "basic_salary": breakdown["basic_salary"],
        "hra": breakdown["hra"],
        "travel_allowance": breakdown["travel_allowance"],
        "special_allowance": breakdown["special_allowance"],
        "pt_deduction": PT_DEDUCTION,
        "pf_deduction": Decimal("0"),
        "lop_deduction": lop_deduction,
        "late_mark_deduction": late_deduction,
        "total_deductions": total_deductions,
        "net_pay": net_pay,
    }
