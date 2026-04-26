from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models.payroll_period import PayrollPeriodType, PayrollPeriodState


class PayrollPeriodCreate(BaseModel):
    period_name: str = Field(..., min_length=1, max_length=100)
    period_type: PayrollPeriodType = PayrollPeriodType.MONTHLY
    start_date: datetime
    end_date: datetime


class PayrollPeriodResponse(BaseModel):
    id: str
    period_name: str
    period_type: PayrollPeriodType
    start_date: datetime
    end_date: datetime
    state: PayrollPeriodState
    total_employees: int
    processed_employees: int
    total_gross_amount: Optional[float] = None
    total_net_amount: Optional[float] = None
    total_deductions: Optional[float] = None
    processing_started_at: Optional[datetime] = None
    processing_completed_at: Optional[datetime] = None
    locked_at: Optional[datetime] = None
    locked_by: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class StateTransitionRequest(BaseModel):
    new_state: PayrollPeriodState
    reason: Optional[str] = None
