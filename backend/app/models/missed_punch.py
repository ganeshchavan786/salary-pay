from sqlalchemy import Column, String, Boolean, DateTime, Date, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.database import Base


class MissedPunchStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class MissedPunchRequest(Base):
    __tablename__ = "missed_punch_requests"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    emp_id = Column(String(36), ForeignKey("employees.id"), nullable=False)
    date = Column(Date, nullable=False)
    requested_check_in = Column(String(5), nullable=True)   # "HH:MM"
    requested_check_out = Column(String(5), nullable=True)  # "HH:MM"
    reason = Column(Text, nullable=False)
    status = Column(SQLEnum(MissedPunchStatus), default=MissedPunchStatus.PENDING, nullable=False)
    approved_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    employee = relationship("Employee", foreign_keys=[emp_id])
    approver = relationship("User", foreign_keys=[approved_by])
