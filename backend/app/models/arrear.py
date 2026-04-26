from sqlalchemy import Column, String, DateTime, Numeric, Integer, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.database import Base

class Arrear(Base):
    __tablename__ = "arrears"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id = Column(String(36), ForeignKey("employees.id"), nullable=False)
    period_id = Column(String(36), ForeignKey("payroll_periods.id"), nullable=False)
    effective_from = Column(DateTime, nullable=False)
    old_basic = Column(Numeric(12, 2), nullable=False)
    new_basic = Column(Numeric(12, 2), nullable=False)
    arrear_months = Column(Integer, default=1)
    arrear_amount = Column(Numeric(12, 2), nullable=False)
    tax_impact = Column(Numeric(12, 2), default=0)
    description = Column(Text, nullable=True)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("Employee", foreign_keys=[employee_id])
