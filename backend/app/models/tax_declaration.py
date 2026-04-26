from sqlalchemy import Column, String, DateTime, Numeric, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.database import Base

class TaxDeclaration(Base):
    __tablename__ = "tax_declarations"
    __table_args__ = (
        UniqueConstraint("employee_id", "financial_year", name="uq_tax_decl_emp_fy"),
    )
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id = Column(String(36), ForeignKey("employees.id"), nullable=False)
    financial_year = Column(String(10), nullable=False)  # e.g. "2026-27"
    tax_regime = Column(String(10), default="new")  # old / new
    section_80c = Column(Numeric(12, 2), default=0)
    section_80d = Column(Numeric(12, 2), default=0)
    hra_exemption = Column(Numeric(12, 2), default=0)
    other_exemptions = Column(JSON, default=dict)
    total_exemptions = Column(Numeric(12, 2), default=0)
    declaration_date = Column(DateTime, default=datetime.utcnow)
    status = Column(String(20), default="submitted")
    approved_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    employee = relationship("Employee", foreign_keys=[employee_id])
