import re
from decimal import Decimal
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator, ConfigDict
from app.models.policy import LateAction, WeeklyOffDay, ShiftType

HH_MM_PATTERN = re.compile(r"^\d{2}:\d{2}$")

class PolicyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    shift_hours: int
    weekly_limit_hours: int
    break_time_minutes: int
    grace_period_minutes: int
    allowed_late_marks_per_month: int
    late_action: LateAction
    min_working_hours_for_halfday: Decimal
    early_leaving_action: LateAction
    consecutive_absent_threshold: int
    ot_enabled: bool
    ot_normal_multiplier: Decimal
    ot_holiday_multiplier: Decimal
    weekly_off_day: WeeklyOffDay
    second_fourth_saturday_off: bool
    comp_off_enabled: bool
    comp_off_expiry_days: int
    missed_punch_requests_per_month: int
    shift_type: ShiftType
    shift_start_time: str
    shift_end_time: str
    night_shift_allowance: Decimal
    updated_at: Optional[datetime] = None

class PolicyUpdate(BaseModel):
    shift_hours: Optional[int] = Field(None, ge=1, le=24)
    weekly_limit_hours: Optional[int] = Field(None, ge=1, le=168)
    break_time_minutes: Optional[int] = Field(None, ge=0, le=120)
    grace_period_minutes: Optional[int] = Field(None, ge=0, le=60)
    allowed_late_marks_per_month: Optional[int] = Field(None, ge=0, le=31)
    late_action: Optional[LateAction] = None
    min_working_hours_for_halfday: Optional[Decimal] = Field(None, ge=Decimal("0.5"), le=Decimal("12"))
    early_leaving_action: Optional[LateAction] = None
    consecutive_absent_threshold: Optional[int] = Field(None, ge=1, le=30)
    ot_enabled: Optional[bool] = None
    ot_normal_multiplier: Optional[Decimal] = Field(None, ge=Decimal("1.0"))
    ot_holiday_multiplier: Optional[Decimal] = Field(None, ge=Decimal("1.0"))
    weekly_off_day: Optional[WeeklyOffDay] = None
    second_fourth_saturday_off: Optional[bool] = None
    comp_off_enabled: Optional[bool] = None
    comp_off_expiry_days: Optional[int] = Field(None, ge=1, le=365)
    missed_punch_requests_per_month: Optional[int] = Field(None, ge=0, le=10)
    shift_type: Optional[ShiftType] = None
    shift_start_time: Optional[str] = None
    shift_end_time: Optional[str] = None
    night_shift_allowance: Optional[Decimal] = Field(None, ge=Decimal("0"))

    @field_validator("shift_start_time", "shift_end_time", mode="before")
    @classmethod
    def validate_time_format(cls, v):
        if v is not None and not HH_MM_PATTERN.match(str(v)):
            raise ValueError("Time must be in HH:MM format")
        return v


# ─── Per-Employee Policy Override Schemas ───────────────────────────────────

class EmployeePolicyOverrideRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    shift_type: Optional[ShiftType] = None
    shift_start_time: Optional[str] = None
    shift_end_time: Optional[str] = None
    shift_hours: Optional[int] = None
    grace_period_minutes: Optional[int] = None
    ot_enabled: Optional[bool] = None
    min_working_hours_for_halfday: Optional[Decimal] = None
    weekly_off_day: Optional[WeeklyOffDay] = None
    second_fourth_saturday_off: Optional[bool] = None
    comp_off_enabled: Optional[bool] = None
    night_shift_allowance: Optional[Decimal] = None
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None


class EmployeePolicyOverrideUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    shift_type: Optional[ShiftType] = None
    shift_start_time: Optional[str] = None
    shift_end_time: Optional[str] = None
    shift_hours: Optional[int] = Field(None, ge=1, le=24)
    grace_period_minutes: Optional[int] = Field(None, ge=0, le=60)
    ot_enabled: Optional[bool] = None
    min_working_hours_for_halfday: Optional[Decimal] = Field(None, ge=Decimal("0.5"), le=Decimal("12"))
    weekly_off_day: Optional[WeeklyOffDay] = None
    second_fourth_saturday_off: Optional[bool] = None
    comp_off_enabled: Optional[bool] = None
    night_shift_allowance: Optional[Decimal] = Field(None, ge=Decimal("0"))

    @field_validator("shift_start_time", "shift_end_time", mode="before")
    @classmethod
    def validate_time_format(cls, v):
        if v is not None and not HH_MM_PATTERN.match(str(v)):
            raise ValueError("Time must be in HH:MM format")
        return v


class EmployeePolicyResponse(BaseModel):
    effective_policy: PolicyRead
    override: Optional[EmployeePolicyOverrideRead] = None
    company_policy: PolicyRead
