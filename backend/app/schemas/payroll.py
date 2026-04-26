from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from app.models.payroll import PayrollStatus


class PayrollRunRequest(BaseModel):
    month: int
    year: int

    @field_validator('month')
    @classmethod
    def validate_month(cls, v):
        if not 1 <= v <= 12:
            raise ValueError("month must be between 1 and 12")
        return v

    @field_validator('year')
    @classmethod
    def validate_year(cls, v):
        if v < 2020:
            raise ValueError("year must be >= 2020")
        return v


class PayrollRunResultItem(BaseModel):
    emp_code: str
    status: str
    net_pay: Optional[Decimal] = None
    error: Optional[str] = None


class PayrollRunResponse(BaseModel):
    processed: int
    errors: int
    results: List[PayrollRunResultItem]


class PayrollResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    emp_id: str
    month: int
    year: int
    working_days: Optional[int] = None
    present_days: Optional[int] = None
    lop_days: Decimal
    half_days: int
    gross_salary: Optional[Decimal] = None
    basic_salary: Optional[Decimal] = None
    hra: Decimal
    travel_allowance: Decimal
    special_allowance: Decimal
    pt_deduction: Decimal
    pf_deduction: Decimal
    lop_deduction: Decimal
    late_mark_deduction: Decimal
    total_deductions: Decimal
    net_pay: Optional[Decimal] = None
    status: PayrollStatus
    paid_at: Optional[datetime] = None
    emp_name: Optional[str] = None
    emp_code: Optional[str] = None
    designation: Optional[str] = None
