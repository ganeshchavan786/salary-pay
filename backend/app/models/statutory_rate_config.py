from sqlalchemy import Column, String, DateTime, Numeric, Boolean, ForeignKey, JSON, Date, Enum as SQLEnum
from datetime import datetime, date
import uuid
import enum
from app.database import Base


class DeductionRateType(str, enum.Enum):
    PF_EMPLOYEE = "PF_EMPLOYEE"
    PF_EMPLOYER = "PF_EMPLOYER"
    ESI_EMPLOYEE = "ESI_EMPLOYEE"
    ESI_EMPLOYER = "ESI_EMPLOYER"
    PT = "PT"


class RateType(str, enum.Enum):
    PERCENTAGE = "PERCENTAGE"
    SLAB = "SLAB"


class StatutoryRateConfig(Base):
    __tablename__ = "statutory_rate_configs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    deduction_type = Column(SQLEnum(DeductionRateType), nullable=False)
    rate_type = Column(SQLEnum(RateType), nullable=False)
    rate_value = Column(Numeric(6, 4), nullable=True)   # e.g. 12.0000 for 12%
    slab_definition = Column(JSON, nullable=True)        # [{from_amount, to_amount, tax_amount}]
    effective_from = Column(Date, nullable=False, default=date.today)
    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
