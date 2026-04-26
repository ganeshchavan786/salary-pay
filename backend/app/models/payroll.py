from sqlalchemy import Column, String, Boolean, DateTime, Integer, Numeric, ForeignKey, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.database import Base

class PayrollStatus(str, enum.Enum):
    DRAFT = "draft"
    PROCESSED = "processed"
    PAID = "paid"

class Payroll(Base):
    __tablename__ = "payrolls"
    __table_args__ = (UniqueConstraint("emp_id", "month", "year", name="uq_payroll_emp_month_year"),)
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    emp_id = Column(String(36), ForeignKey("employees.id"), nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    working_days = Column(Integer, nullable=True)
    present_days = Column(Integer, nullable=True)
    lop_days = Column(Numeric(4, 1), default=0)
    half_days = Column(Integer, default=0)
    ot_hours = Column(Numeric(6, 2), default=0)
    gross_salary = Column(Numeric(10, 2), nullable=True)
    basic_salary = Column(Numeric(10, 2), nullable=True)
    hra = Column(Numeric(10, 2), default=0)
    travel_allowance = Column(Numeric(10, 2), default=0)
    special_allowance = Column(Numeric(10, 2), default=0)
    pt_deduction = Column(Numeric(10, 2), default=200)
    pf_deduction = Column(Numeric(10, 2), default=0)
    lop_deduction = Column(Numeric(10, 2), default=0)
    late_mark_deduction = Column(Numeric(10, 2), default=0)
    total_deductions = Column(Numeric(10, 2), default=0)
    net_pay = Column(Numeric(10, 2), nullable=True)
    status = Column(SQLEnum(PayrollStatus), default=PayrollStatus.DRAFT)
    paid_at = Column(DateTime, nullable=True)
    processed_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    employee = relationship("Employee", foreign_keys=[emp_id])
    processor = relationship("User", foreign_keys=[processed_by])
