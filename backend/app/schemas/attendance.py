from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import date, time, datetime
from enum import Enum


class AttendanceTypeEnum(str, Enum):
    CHECK_IN = "CHECK_IN"
    CHECK_OUT = "CHECK_OUT"


class AttendanceRecord(BaseModel):
    local_id: str
    emp_id: str
    attendance_type: AttendanceTypeEnum = AttendanceTypeEnum.CHECK_IN
    date: date
    time: time
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    photo: Optional[str] = None


class AttendanceSyncRequest(BaseModel):
    device_id: str
    records: List[AttendanceRecord]


class SyncResult(BaseModel):
    local_id: str
    server_id: Optional[str] = None
    status: str  # "synced", "failed", "duplicate"
    error: Optional[str] = None


class AttendanceSyncResponse(BaseModel):
    status: str  # "success", "partial", "failed"
    synced: int
    failed: int
    duplicates: int
    results: List[SyncResult]


class AttendanceResponse(BaseModel):
    id: str
    emp_id: str
    emp_code: Optional[str] = None
    emp_name: Optional[str] = None
    attendance_type: AttendanceTypeEnum = AttendanceTypeEnum.CHECK_IN
    date: date
    time: time
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    device_id: Optional[str] = None
    photo: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# ─── Advanced Attendance Schemas ────────────────────────────────────────────

from app.models.attendance_daily import AttendanceStatus, LateMarkType
from app.utils.conflict_handler import ConflictMode


class BulkSaveRecord(BaseModel):
    date: date
    status: AttendanceStatus
    check_in: Optional[str] = None   # "HH:MM" format
    check_out: Optional[str] = None  # "HH:MM" format


class BulkSaveRequest(BaseModel):
    emp_id: str
    month: int
    year: int
    records: List[BulkSaveRecord]
    conflict_mode: ConflictMode = ConflictMode.OVERWRITE


class BulkRecordOutcome(BaseModel):
    date: date
    outcome: Literal["created", "updated", "skipped", "failed"]
    detail: Optional[str] = None


class BulkSaveSummary(BaseModel):
    created: int
    updated: int
    skipped: int
    failed: int


class BulkSaveResponse(BaseModel):
    emp_id: str
    month: int
    year: int
    conflict_mode: str
    summary: BulkSaveSummary
    records: List[BulkRecordOutcome]
    # Legacy fields preserved for backward compatibility
    created: int
    updated: int
    total: int


class ExcludedDate(BaseModel):
    date: date
    reason: str   # "Sunday", "2nd/4th Saturday", "Holiday"
    name: Optional[str] = None


class WorkingDaysResponse(BaseModel):
    working_days: int
    total_calendar_days: int
    excluded: List[ExcludedDate]


class DailyRecord(BaseModel):
    date: date
    status: AttendanceStatus
    late_mark_type: LateMarkType
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    is_overridden: bool = False


class EmployeeMonthlySummary(BaseModel):
    present: int
    absent: int
    halfday: int
    leave: int
    holiday: int
    weeklyoff: int
    late_mark: int
    half_late_mark: int


class EmployeeMonthlyData(BaseModel):
    emp_id: str
    name: str
    emp_code: str
    department: Optional[str] = None
    days: List[DailyRecord]
    summary: EmployeeMonthlySummary


class MonthlyAllResponse(BaseModel):
    month: int
    year: int
    working_days: int
    employees: List[EmployeeMonthlyData]


class SummaryCards(BaseModel):
    working_days: int
    present_pct: float
    total_late_marks: int
    total_lop_days: float


class DailyTrendPoint(BaseModel):
    day: int
    present_count: int
    date: date


class DepartmentStat(BaseModel):
    department: str
    present: int
    absent: int
    late_mark: int
    present_pct: float


class StatsResponse(BaseModel):
    summary_cards: SummaryCards
    daily_trend: List[DailyTrendPoint]
    department_stats: List[DepartmentStat]
