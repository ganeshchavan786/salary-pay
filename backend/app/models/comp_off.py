from sqlalchemy import Column, String, Boolean, DateTime, Date, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.database import Base


class CompOffBalance(Base):
    __tablename__ = "comp_off_balance"
    __table_args__ = (UniqueConstraint("emp_id", name="uq_comp_off_balance_emp"),)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    emp_id = Column(String(36), ForeignKey("employees.id"), nullable=False)
    balance = Column(Integer, default=0, nullable=False)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    employee = relationship("Employee", foreign_keys=[emp_id])


class CompOffCredit(Base):
    __tablename__ = "comp_off_credits"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    emp_id = Column(String(36), ForeignKey("employees.id"), nullable=False)
    earned_date = Column(Date, nullable=False)
    expiry_date = Column(Date, nullable=False)
    is_lapsed = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("Employee", foreign_keys=[emp_id])
