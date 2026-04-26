from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.database import Base

class SalaryFormula(Base):
    __tablename__ = "salary_formulas"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    formula_expression = Column(Text, nullable=False)
    input_variables = Column(JSON, default=list)
    output_variable = Column(String(100), nullable=False)
    dependencies = Column(JSON, default=list)
    formula_type = Column(String(50), nullable=False)  # earning / deduction / tax / custom
    effective_date = Column(DateTime, nullable=False)
    expiry_date = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
