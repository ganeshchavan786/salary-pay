from sqlalchemy import Column, String, Boolean, DateTime, Date, Text, ForeignKey, Enum as SQLEnum, UniqueConstraint, Float
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.database import Base

class AttendanceStatus(str, enum.Enum):
    PRESENT = "present"
    ABSENT = "absent"
    HALFDAY = "halfday"
    HOLIDAY = "holiday"
    LEAVE = "leave"
    WEEKLYOFF = "weeklyoff"

class LateMarkType(str, enum.Enum):
    NONE = "none"
    LATE = "late"
    HALF_LATE = "halfLate"
    HALF_DAY = "halfDay"

class AttendanceDaily(Base):
    __tablename__ = "attendance_daily"
    __table_args__ = (UniqueConstraint("emp_id", "date", name="uq_attendance_daily_emp_date"),)
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    emp_id = Column(String(36), ForeignKey("employees.id"), nullable=False)
    date = Column(Date, nullable=False)
    check_in = Column(DateTime, nullable=True)
    check_out = Column(DateTime, nullable=True)
    status = Column(SQLEnum(AttendanceStatus), default=AttendanceStatus.ABSENT)
    late_mark_type = Column(SQLEnum(LateMarkType), default=LateMarkType.NONE)
    is_late_mark = Column(Boolean, default=False)
    is_half_late_mark = Column(Boolean, default=False)
    is_half_day = Column(Boolean, default=False)
    total_working_hours = Column(Float, default=0.0)
    is_incomplete = Column(Boolean, default=False)
    is_overridden = Column(Boolean, default=False)
    override_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    override_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    employee = relationship("Employee", foreign_keys=[emp_id])
    overrider = relationship("User", foreign_keys=[override_by])
