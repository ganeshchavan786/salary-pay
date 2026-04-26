from sqlalchemy import Column, String, DateTime, Numeric, ForeignKey, Index
from datetime import datetime
import uuid
from app.database import Base


class InstallmentRecord(Base):
    __tablename__ = "installment_records"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    deduction_id = Column(String(36), ForeignKey("deductions.id"), nullable=False)
    period_id = Column(String(36), ForeignKey("payroll_periods.id"), nullable=False)
    amount_deducted = Column(Numeric(12, 2), nullable=False)
    remaining_after = Column(Numeric(12, 2), nullable=False)
    applied_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_installment_deduction", "deduction_id"),
        Index("idx_installment_period", "period_id"),
    )
