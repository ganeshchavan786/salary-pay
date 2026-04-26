from pydantic import BaseModel
from typing import Optional, Literal
from datetime import date, datetime, time
from app.models.attendance_daily import AttendanceStatus, LateMarkType
from app.utils.conflict_handler import ConflictMode


class ManualAttendanceRequest(BaseModel):
    emp_id: str
    date: date
    check_in: Optional[time] = None
    check_out: Optional[time] = None
    status: AttendanceStatus = AttendanceStatus.PRESENT
    override_note: Optional[str] = None
    conflict_mode: ConflictMode = ConflictMode.BLOCK


class AttendanceDailyResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    emp_id: str
    date: date
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    status: AttendanceStatus
    late_mark_type: LateMarkType
    is_late_mark: bool
    is_half_late_mark: bool
    is_half_day: bool
    is_overridden: bool
    override_note: Optional[str] = None
    emp_name: Optional[str] = None
    emp_code: Optional[str] = None


class AttendanceOverrideRequest(BaseModel):
    status: AttendanceStatus
    note: Optional[str] = None


class ConflictResponse(BaseModel):
    conflict: bool = True
    message: str
    existing_record: AttendanceDailyResponse


class ManualEntryResponse(BaseModel):
    message: str
    action: Literal["created", "updated"]
    record: AttendanceDailyResponse
