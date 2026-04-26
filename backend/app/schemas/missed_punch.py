from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, field_validator, ConfigDict
from app.models.missed_punch import MissedPunchStatus

class MissedPunchCreate(BaseModel):
    date: date
    requested_check_in: Optional[str] = None   # "HH:MM"
    requested_check_out: Optional[str] = None  # "HH:MM"
    reason: str

    @field_validator("date")
    @classmethod
    def date_not_in_future(cls, v):
        from datetime import date as date_type
        if v > date_type.today():
            raise ValueError("Cannot submit missed punch for a future date")
        return v

class MissedPunchRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    emp_id: str
    date: date
    requested_check_in: Optional[str] = None
    requested_check_out: Optional[str] = None
    reason: str
    status: MissedPunchStatus
    approved_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class MissedPunchReject(BaseModel):
    reason: str
