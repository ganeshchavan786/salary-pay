from sqlalchemy import Column, String, Date, Time, Float, Text, DateTime, Enum as SQLEnum, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.database import Base


class SyncStatus(str, enum.Enum):
    PENDING = "PENDING"
    SYNCED = "SYNCED"
    FAILED = "FAILED"


class AttendanceType(str, enum.Enum):
    CHECK_IN = "CHECK_IN"
    CHECK_OUT = "CHECK_OUT"


class Attendance(Base):
    __tablename__ = "attendance"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    local_id = Column(String(36), nullable=True)  # Client-side ID for sync
    emp_id = Column(String(36), ForeignKey("employees.id"), nullable=False, index=True)
    attendance_type = Column(SQLEnum(AttendanceType), default=AttendanceType.CHECK_IN)
    date = Column(Date, nullable=False, index=True)
    time = Column(Time, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    device_id = Column(String(100), nullable=True)
    photo = Column(Text, nullable=True)  # Base64 compressed image
    sync_status = Column(SQLEnum(SyncStatus), default=SyncStatus.SYNCED)
    created_at = Column(DateTime, default=datetime.utcnow)
    synced_at = Column(DateTime, default=datetime.utcnow)
    
    employee = relationship("Employee", back_populates="attendances")
