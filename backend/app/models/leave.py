from sqlalchemy import Column, String, Text, Boolean, DateTime, Date, Numeric, Integer, ForeignKey, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.database import Base

class LeaveType(str, enum.Enum):
    CL = "CL"
    SL = "SL"
    EL = "EL"
    LWP = "LWP"

class LeaveStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"

class Leave(Base):
    __tablename__ = "leaves"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    emp_id = Column(String(36), ForeignKey("employees.id"), nullable=False)
    leave_type = Column(SQLEnum(LeaveType), nullable=False)
    from_date = Column(Date, nullable=False)
    to_date = Column(Date, nullable=False)
    total_days = Column(Numeric(4, 1), nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(SQLEnum(LeaveStatus), default=LeaveStatus.PENDING)
    applied_at = Column(DateTime, default=datetime.utcnow)
    approved_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    approver_comment = Column(Text, nullable=True)
    action_at = Column(DateTime, nullable=True)
    
    employee = relationship("Employee", foreign_keys=[emp_id])
    approver = relationship("User", foreign_keys=[approved_by])

class LeaveBalance(Base):
    __tablename__ = "leave_balances"
    __table_args__ = (UniqueConstraint("emp_id", "year", name="uq_leave_balance_emp_year"),)
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    emp_id = Column(String(36), ForeignKey("employees.id"), nullable=False)
    year = Column(Integer, nullable=False)
    cl_total = Column(Integer, default=0)
    cl_used = Column(Numeric(4, 1), default=0)
    sl_used = Column(Numeric(4, 1), default=0)
    el_used = Column(Numeric(4, 1), default=0)
    lwp_days = Column(Numeric(4, 1), default=0)
    late_mark_count = Column(Integer, default=0)
    half_late_mark_count = Column(Integer, default=0)
    half_day_from_late = Column(Numeric(4, 1), default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    employee = relationship("Employee", foreign_keys=[emp_id])
