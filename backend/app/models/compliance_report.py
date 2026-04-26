from sqlalchemy import Column, String, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.database import Base

class ComplianceReport(Base):
    __tablename__ = "compliance_reports"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    report_type = Column(String(50), nullable=False)  # pf_ecr, esi_report, form16, form24q, professional_tax
    period_id = Column(String(36), ForeignKey("payroll_periods.id"), nullable=True)
    financial_year = Column(String(10), nullable=True)
    quarter = Column(String(5), nullable=True)
    report_data = Column(JSON, default=dict)
    file_path = Column(Text, nullable=True)
    status = Column(String(20), default="generated")
    generated_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    generated_at = Column(DateTime, default=datetime.utcnow)
