from sqlalchemy import Column, String, DateTime, Numeric, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.database import Base

class SalaryConfig(Base):
    __tablename__ = "salary_configs"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id = Column(String(36), ForeignKey("employees.id"), nullable=False)
    effective_date = Column(DateTime, nullable=False)
    basic_salary = Column(Numeric(12, 2), nullable=False)
    # Default changed to 0.00 to allow dynamic HRA allocation
    hra_percentage = Column(Numeric(5, 2), default=0.00)
    special_allowance = Column(Numeric(12, 2), default=0)
    travel_allowance = Column(Numeric(12, 2), default=0)
    medical_allowance = Column(Numeric(12, 2), default=0)
    other_allowances = Column(JSON, default=dict)
    custom_payheads = Column(JSON, default=list)  # [{"name": str, "amount": float, "is_percentage_of_basic": bool}]
    custom_payheads = Column(JSON, default=list)
    pf_applicable = Column(Boolean, default=True)
    esi_applicable = Column(Boolean, default=True)
    pt_applicable = Column(Boolean, default=True)
    tax_regime = Column(String(10), default="new")  # old / new
    cost_center_allocations = Column(JSON, default=list)  # [{"cost_center": "IT", "percentage": 100}]
    status = Column(String(20), default="active")
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    employee = relationship("Employee", foreign_keys=[employee_id])
