from sqlalchemy import Column, String, Boolean, DateTime, Integer, Numeric, Enum as SQLEnum, UniqueConstraint, ForeignKey
from datetime import datetime
import uuid
import enum
from app.database import Base


class LateAction(str, enum.Enum):
    HALF_DAY = "half_day"
    SALARY_DEDUCTION = "salary_deduction"


class WeeklyOffDay(str, enum.Enum):
    SUNDAY = "sunday"
    SATURDAY = "saturday"
    ROTATIONAL = "rotational"


class ShiftType(str, enum.Enum):
    GENERAL = "general"
    MORNING = "morning"
    EVENING = "evening"
    NIGHT = "night"


class AttendancePolicy(Base):
    __tablename__ = "attendance_policy"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    shift_hours = Column(Integer, default=8, nullable=False)
    weekly_limit_hours = Column(Integer, default=48, nullable=False)
    break_time_minutes = Column(Integer, default=30, nullable=False)
    grace_period_minutes = Column(Integer, default=5, nullable=False)
    allowed_late_marks_per_month = Column(Integer, default=3, nullable=False)
    late_action = Column(SQLEnum(LateAction), default=LateAction.HALF_DAY, nullable=False)
    min_working_hours_for_halfday = Column(Numeric(4, 1), default=4.5, nullable=False)
    early_leaving_action = Column(SQLEnum(LateAction), default=LateAction.HALF_DAY, nullable=False)
    consecutive_absent_threshold = Column(Integer, default=3, nullable=False)
    ot_enabled = Column(Boolean, default=False, nullable=False)
    ot_normal_multiplier = Column(Numeric(4, 2), default=2.0, nullable=False)
    ot_holiday_multiplier = Column(Numeric(4, 2), default=3.0, nullable=False)
    weekly_off_day = Column(SQLEnum(WeeklyOffDay), default=WeeklyOffDay.SUNDAY, nullable=False)
    second_fourth_saturday_off = Column(Boolean, default=True, nullable=False)
    comp_off_enabled = Column(Boolean, default=True, nullable=False)
    comp_off_expiry_days = Column(Integer, default=30, nullable=False)
    missed_punch_requests_per_month = Column(Integer, default=2, nullable=False)
    shift_type = Column(SQLEnum(ShiftType), default=ShiftType.GENERAL, nullable=False)
    shift_start_time = Column(String(5), default="09:30", nullable=False)
    shift_end_time = Column(String(5), default="18:30", nullable=False)
    night_shift_allowance = Column(Numeric(10, 2), default=0.00, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EmployeePolicyOverride(Base):
    """Per-employee attendance policy overrides. Null = use company default."""
    __tablename__ = "employee_policy_override"
    __table_args__ = (
        UniqueConstraint("emp_id", name="uq_emp_policy_override"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    emp_id = Column(String(36), ForeignKey("employees.id"), nullable=False, unique=True)

    # Overridable fields — all nullable (null = use company default)
    shift_type                    = Column(SQLEnum(ShiftType), nullable=True)
    shift_start_time              = Column(String(5), nullable=True)
    shift_end_time                = Column(String(5), nullable=True)
    shift_hours                   = Column(Integer, nullable=True)
    grace_period_minutes          = Column(Integer, nullable=True)
    ot_enabled                    = Column(Boolean, nullable=True)
    min_working_hours_for_halfday = Column(Numeric(4, 1), nullable=True)
    weekly_off_day                = Column(SQLEnum(WeeklyOffDay), nullable=True)
    second_fourth_saturday_off    = Column(Boolean, nullable=True)
    comp_off_enabled              = Column(Boolean, nullable=True)
    night_shift_allowance         = Column(Numeric(10, 2), nullable=True)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)
