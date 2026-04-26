from sqlalchemy import Column, String, DateTime, Integer, Numeric, Enum as SQLEnum, UniqueConstraint, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.database import Base

class PayrollPeriodType(str, enum.Enum):
    MONTHLY = "MONTHLY"
    WEEKLY = "WEEKLY"
    CUSTOM = "CUSTOM"

class PayrollPeriodState(str, enum.Enum):
    DRAFT = "DRAFT"
    OPEN = "OPEN"
    PROCESSING = "PROCESSING"
    PROCESSED = "PROCESSED"
    LOCKED = "LOCKED"

class PayrollPeriod(Base):
    __tablename__ = "payroll_periods"
    __table_args__ = (
        UniqueConstraint("start_date", "end_date", name="uq_payroll_period_dates"),
    )
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    period_name = Column(String(100), nullable=False)
    period_type = Column(SQLEnum(PayrollPeriodType), default=PayrollPeriodType.MONTHLY)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    state = Column(SQLEnum(PayrollPeriodState), default=PayrollPeriodState.DRAFT, nullable=False)
    total_employees = Column(Integer, default=0)
    processed_employees = Column(Integer, default=0)
    total_gross_amount = Column(Numeric(15, 2), default=0)
    total_net_amount = Column(Numeric(15, 2), default=0)
    total_deductions = Column(Numeric(15, 2), default=0)
    processing_started_at = Column(DateTime, nullable=True)
    processing_completed_at = Column(DateTime, nullable=True)
    locked_at = Column(DateTime, nullable=True)
    locked_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
