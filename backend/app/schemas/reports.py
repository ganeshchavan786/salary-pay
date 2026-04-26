"""
Pydantic v2 response schemas for the Advanced Reporting Module.
All monetary fields use Decimal. Date/time fields use stdlib types.
"""
from __future__ import annotations

from datetime import date, datetime, time
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


# ─── Dashboard ───────────────────────────────────────────────────────────────

class DashboardTodayResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_present: int = 0
    total_absent: int = 0
    total_ot_hours: float = 0.0
    total_ot_cost: Decimal = Decimal("0")
    avg_working_hours: float = 0.0
    late_count: int = 0


# ─── Employee-Wise Reports ────────────────────────────────────────────────────

class EmployeeAttendanceSummaryRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    emp_id: str
    emp_code: str
    name: str
    department: Optional[str] = None
    working_days: int = 0
    present_days: int = 0
    absent_days: int = 0
    half_day_count: int = 0
    late_mark_count: int = 0
    lop_days: float = 0.0


class EmployeeWorkingHoursRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    emp_id: str
    emp_code: str
    name: str
    department: Optional[str] = None
    # daily granularity
    date: Optional[date] = None
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    working_hours: Optional[float] = None
    is_missed_punch: bool = False
    # monthly granularity
    month: Optional[int] = None
    year: Optional[int] = None
    total_working_hours: Optional[float] = None
    avg_daily_working_hours: Optional[float] = None
    scheduled_hours: Optional[float] = None


class EmployeeInOutRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    emp_id: str
    emp_code: str
    name: str
    department: Optional[str] = None
    date: date
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    late_mark_status: str = "none"
    shift_start_time: str = "09:30"
    is_missed_punch: bool = False


class LateMarkDetailItem(BaseModel):
    date: date
    check_in: Optional[datetime] = None
    minutes_late: int = 0
    late_mark_type: str = "none"


class EmployeeLateMarksRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    emp_id: str
    emp_code: str
    name: str
    department: Optional[str] = None
    total_late_marks: int = 0
    total_half_late_marks: int = 0
    total_half_days_from_late: int = 0
    details: list[LateMarkDetailItem] = []


class EmployeeOTRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    emp_id: str
    emp_code: str
    name: str
    department: Optional[str] = None
    total_ot_hours: float = 0.0
    total_ot_cost: Decimal = Decimal("0")
    ot_days_count: int = 0


class EmployeeHalfdayAbsentRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    emp_id: str
    emp_code: str
    name: str
    department: Optional[str] = None
    absent_days: int = 0
    half_day_count: int = 0
    lop_days: float = 0.0


# ─── Attendance Analysis ──────────────────────────────────────────────────────

class DailyAttendanceSummaryRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    date: date
    total_employees: int = 0
    present_count: int = 0
    absent_count: int = 0
    half_day_count: int = 0
    on_leave_count: int = 0
    weekly_off_count: int = 0
    holiday_count: int = 0


class MonthlyAttendanceTrendRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    year: int
    month: int
    avg_attendance_pct: float = 0.0
    total_present_days: int = 0
    total_absent_days: int = 0
    total_late_marks: int = 0


class LateComingAnalysisRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    emp_id: Optional[str] = None
    emp_code: Optional[str] = None
    name: Optional[str] = None
    department: Optional[str] = None
    year: int
    month: int
    late_mark_count: int = 0
    half_late_mark_count: int = 0
    avg_minutes_late: float = 0.0
    is_org_summary: bool = False


class EarlyLeavingRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    emp_id: str
    emp_code: str
    name: str
    department: Optional[str] = None
    date: date
    check_out: Optional[datetime] = None
    scheduled_end_time: str = "18:30"
    minutes_left_early: int = 0


class ShiftWiseAttendanceRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    shift_type: str
    year: int
    month: int
    total_employees: int = 0
    avg_attendance_pct: float = 0.0
    total_ot_hours: float = 0.0
    total_late_marks: int = 0
    below_org_avg_flag: bool = False


class HeatmapCell(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    emp_id: str
    emp_code: str
    name: str
    date: date
    status: str  # PRESENT | ABSENT | HALFDAY | HOLIDAY | LEAVE | WEEKLYOFF | MISSED_PUNCH


class HeatmapResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    month: int
    year: int
    employees: list[str] = []   # sorted employee names
    dates: list[date] = []
    cells: list[HeatmapCell] = []


class DepartmentAttendanceRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    department: str
    year: int
    month: int
    employee_count: int = 0
    avg_attendance_pct: float = 0.0
    total_absent_days: int = 0
    total_late_marks: int = 0
    total_ot_hours: float = 0.0


# ─── OT Reports ──────────────────────────────────────────────────────────────

class DepartmentOTRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    department: str
    year: int
    month: int
    total_ot_hours: float = 0.0
    total_ot_cost: Decimal = Decimal("0")
    employee_count_with_ot: int = 0
    avg_ot_hours_per_employee: float = 0.0
    exceeds_scheduled_flag: bool = False


class MonthlyOTTrendRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    year: int
    month: int
    total_ot_hours: float = 0.0
    total_ot_cost: Decimal = Decimal("0")
    employee_count_with_ot: int = 0
    mom_change_pct: Optional[float] = None


class OTCostRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    emp_id: Optional[str] = None
    emp_code: Optional[str] = None
    name: Optional[str] = None
    department: Optional[str] = None
    year: int
    month: int
    gross_salary: Decimal = Decimal("0")
    ot_hours: float = 0.0
    cost_per_hour: Decimal = Decimal("0")
    ot_cost: Decimal = Decimal("0")
    ot_cost_pct_of_gross: float = 0.0
    is_subtotal: bool = False
    is_grand_total: bool = False


class HolidayOTRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    emp_id: str
    emp_code: str
    name: str
    department: Optional[str] = None
    holiday_name: str
    date: date
    working_hours: float = 0.0
    ot_hours: float = 0.0
    ot_cost: Decimal = Decimal("0")


class ExcessOTAlertRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    emp_id: str
    emp_code: str
    name: str
    department: Optional[str] = None
    year: int
    month: int
    total_ot_hours: float = 0.0
    monthly_ot_limit: float = 0.0
    excess_hours: float = 0.0
    excess_ot_cost: Decimal = Decimal("0")


# ─── Cost Analysis ────────────────────────────────────────────────────────────

class CostPerEmployeeRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    emp_id: Optional[str] = None
    emp_code: Optional[str] = None
    name: Optional[str] = None
    department: Optional[str] = None
    year: int
    month: int
    gross_salary: Decimal = Decimal("0")
    total_deductions: Decimal = Decimal("0")
    net_pay: Decimal = Decimal("0")
    ot_cost: Decimal = Decimal("0")
    total_cost: Decimal = Decimal("0")
    cost_per_hour: Decimal = Decimal("0")
    is_highest_cost: bool = False
    is_subtotal: bool = False
    is_grand_total: bool = False


class HighAbsenteeismRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    emp_id: Optional[str] = None
    emp_code: Optional[str] = None
    name: Optional[str] = None
    department: Optional[str] = None
    year: int
    month: int
    absent_days: int = 0
    lop_days: float = 0.0
    lop_deduction: Decimal = Decimal("0")
    is_org_summary: bool = False


class FrequentLateComingRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    emp_id: str
    emp_code: str
    name: str
    department: Optional[str] = None
    year: int
    month: int
    late_mark_count: int = 0
    allowed_limit: int = 0
    excess_late_marks: int = 0
    late_mark_deduction: Decimal = Decimal("0")


class MissedPunchRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    emp_id: str
    emp_code: str
    name: str
    department: Optional[str] = None
    date: date
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    missing_punch: str  # "check_in" | "check_out" | "both"
    source: str = "attendance"  # "attendance" | "missed_punch_request"
    request_status: Optional[str] = None


class HalfDayFrequentRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    emp_id: str
    emp_code: str
    name: str
    department: Optional[str] = None
    year: int
    month: int
    half_day_count: int = 0
    late_mark_triggered_count: int = 0
    manual_entry_count: int = 0


class AbsentCostImpactRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    emp_id: Optional[str] = None
    emp_code: Optional[str] = None
    name: Optional[str] = None
    department: Optional[str] = None
    year: int
    month: int
    absent_days: int = 0
    lop_days: float = 0.0
    gross_salary: Decimal = Decimal("0")
    per_day_rate: Decimal = Decimal("0")
    lop_deduction: Decimal = Decimal("0")
    is_subtotal: bool = False
    is_grand_total: bool = False


class SalaryVsOTRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    department: Optional[str] = None
    year: int
    month: int
    total_gross_salary: Decimal = Decimal("0")
    total_ot_cost: Decimal = Decimal("0")
    ot_cost_pct_of_gross: float = 0.0
    exceeds_15pct_flag: bool = False
    is_org_summary: bool = False


# ─── Leave Reports ────────────────────────────────────────────────────────────

class LeaveBalanceRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    emp_id: str
    emp_code: str
    name: str
    department: Optional[str] = None
    year: int
    cl_total: int = 0
    cl_used: float = 0.0
    cl_remaining: float = 0.0
    sl_used: float = 0.0
    el_used: float = 0.0
    lwp_days: float = 0.0
    compoff_balance: int = 0


class LeaveUsageTrendRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    year: int
    month: int
    leave_type: Optional[str] = None  # None = total row
    total_days: float = 0.0
    employee_count: int = 0
    is_total_row: bool = False


class CompoffBalanceRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    emp_id: str
    emp_code: str
    name: str
    department: Optional[str] = None
    total_credits_earned: int = 0
    total_used: int = 0
    remaining_balance: int = 0
    expiring_within_30_days: int = 0


class ExpiringCompoffRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    emp_id: str
    emp_code: str
    name: str
    department: Optional[str] = None
    credit_date: date
    expiry_date: date
    days_remaining: int = 0
    credit_hours: int = 1  # 1 comp-off credit = 1 day


# ─── Insights ─────────────────────────────────────────────────────────────────

class InsightItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    insight_type: str  # top_ot_employees | top_absent_departments | late_trend | unnecessary_ot | consistent_late
    title: str
    description: str
    data: list[dict[str, Any]] = []


class AutoInsightsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    insights: list[InsightItem] = []
    message: Optional[str] = None


# ─── Export ───────────────────────────────────────────────────────────────────

class ExportFilenameResult(BaseModel):
    filename: str  # {report_name}_{start_date}_{end_date}.{ext}


# ─── Comp-Off Disabled Response ───────────────────────────────────────────────

class CompoffDisabledResponse(BaseModel):
    data: list = []
    message: str = "Comp-off is disabled in the current attendance policy."
