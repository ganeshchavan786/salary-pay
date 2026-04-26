from pydantic import BaseModel, model_validator
from typing import Optional, Literal, List
from datetime import date, datetime
from decimal import Decimal
from app.models.leave import LeaveType, LeaveStatus


class LeaveCreate(BaseModel):
    emp_id: str
    leave_type: LeaveType
    from_date: date
    to_date: date
    reason: str

    @model_validator(mode='after')
    def validate_dates(self):
        if self.to_date < self.from_date:
            raise ValueError("to_date must be >= from_date")
        return self


class LeaveResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    emp_id: str
    leave_type: LeaveType
    from_date: date
    to_date: date
    total_days: Decimal
    reason: str
    status: LeaveStatus
    applied_at: datetime
    approved_by: Optional[str] = None
    approver_comment: Optional[str] = None
    action_at: Optional[datetime] = None
    emp_name: Optional[str] = None
    emp_code: Optional[str] = None


class LeaveBalanceResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    emp_id: str
    year: int
    cl_total: int
    cl_used: Decimal
    sl_used: Decimal
    el_used: Decimal
    lwp_days: Decimal
    late_mark_count: int
    half_late_mark_count: int
    half_day_from_late: Decimal


class LeaveActionRequest(BaseModel):
    comment: Optional[str] = None


# ── New schemas for leave management upgrade ──────────────────────────────────

class BulkLeaveActionRequest(BaseModel):
    action: Literal["approve", "reject"]
    leave_ids: List[str]
    comment: Optional[str] = None


class BalanceUpdateRequest(BaseModel):
    cl_total: int

    @model_validator(mode='after')
    def validate_non_negative(self):
        if self.cl_total < 0:
            raise ValueError("cl_total must be non-negative")
        return self


class LeaveStatsResponse(BaseModel):
    pending_count: int
    approved_this_month: int
    rejected_this_month: int
    lwp_this_year: float


class EmployeeBalanceResponse(BaseModel):
    emp_id: str
    emp_name: str
    emp_code: str
    department: Optional[str] = None
    year: int
    cl_total: int
    cl_used: float
    cl_available: float
    sl_used: float
    el_used: float
    lwp_days: float
    late_mark_count: int


class EmployeeSummaryRow(BaseModel):
    emp_id: str
    emp_name: str
    emp_code: str
    cl_used: float
    sl_used: float
    el_used: float
    lwp_days: float
    total_days: float
