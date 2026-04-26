from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    table_name = Column(String(50), nullable=False)
    record_id = Column(String(36), nullable=False)
    emp_id = Column(String(36), ForeignKey("employees.id"), nullable=False)
    action = Column(String(10), nullable=False)  # INSERT / UPDATE
    field_name = Column(String(50), nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    changed_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    changed_by_name = Column(String(100), nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    employee = relationship("Employee", foreign_keys=[emp_id])
    changer = relationship("User", foreign_keys=[changed_by])
