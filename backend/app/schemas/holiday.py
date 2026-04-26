from pydantic import BaseModel
from typing import Optional, List
from datetime import date
from app.models.holiday import HolidayType


class HolidayCreate(BaseModel):
    name: str
    name_marathi: Optional[str] = None
    date: date
    holiday_type: HolidayType = HolidayType.FESTIVAL
    year: int


class HolidayResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    name: str
    name_marathi: Optional[str] = None
    date: date
    holiday_type: HolidayType
    year: int
    is_active: bool


# ── New schemas for holiday management upgrade ────────────────────────────────

class HolidayUpdate(BaseModel):
    name: str
    name_marathi: Optional[str] = None
    date: date
    holiday_type: HolidayType


class BulkDeleteRequest(BaseModel):
    ids: List[str]


class HolidayStatsResponse(BaseModel):
    year: int
    total: int
    national: int
    state: int
    festival: int
    optional: int


class UpcomingHolidayResponse(BaseModel):
    id: str
    name: str
    name_marathi: Optional[str] = None
    date: date
    holiday_type: HolidayType
    days_remaining: int


class CopyToNextYearResponse(BaseModel):
    copied: int
    skipped: int


class ImportSummaryResponse(BaseModel):
    total_rows: int
    imported: int
    skipped: int
    errors: int
    error_details: List[str]
