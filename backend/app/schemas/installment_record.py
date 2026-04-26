from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal


class InstallmentRecordResponse(BaseModel):
    id: str
    deduction_id: str
    period_id: str
    period_name: Optional[str] = None
    amount_deducted: Decimal
    remaining_after: Decimal
    applied_at: datetime

    class Config:
        from_attributes = True
