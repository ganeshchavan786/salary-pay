from sqlalchemy import Column, String, DateTime, Numeric, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.database import Base

class DeductionType(str, enum.Enum):
    LOAN = "LOAN"
    ADVANCE = "ADVANCE"
    FINE = "FINE"
    CUSTOM = "CUSTOM"

class DeductionStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    PAUSED = "PAUSED"

class RecoveryMode(str, enum.Enum):
    LUMP_SUM = "lump_sum"
    INSTALLMENTS = "installments"
    PERCENTAGE = "percentage"

class Deduction(Base):
    __tablename__ = "deductions"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id = Column(String(36), ForeignKey("employees.id"), nullable=False)
    deduction_type = Column(SQLEnum(DeductionType), nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)
    emi_amount = Column(Numeric(12, 2), nullable=True)
    recovered = Column(Numeric(12, 2), default=0)
    remaining = Column(Numeric(12, 2), nullable=False)
    recovery_mode = Column(SQLEnum(RecoveryMode), default=RecoveryMode.INSTALLMENTS)
    installments = Column(String(10), nullable=True)
    start_period = Column(DateTime, nullable=True)
    end_period = Column(DateTime, nullable=True)
    status = Column(SQLEnum(DeductionStatus), default=DeductionStatus.ACTIVE)
    description = Column(Text, nullable=True)
    approved_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    employee = relationship("Employee", foreign_keys=[employee_id])
