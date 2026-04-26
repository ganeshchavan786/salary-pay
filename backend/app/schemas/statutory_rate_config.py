from pydantic import BaseModel, Field, model_validator
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal

from app.models.statutory_rate_config import DeductionRateType, RateType


class StatutoryRateConfigCreate(BaseModel):
    deduction_type: DeductionRateType
    rate_type: RateType
    rate_value: Optional[Decimal] = Field(default=None, ge=0, le=100)
    slab_definition: Optional[List[dict]] = None
    effective_from: date

    @model_validator(mode="after")
    def validate_rate_value(self) -> "StatutoryRateConfigCreate":
        if self.rate_type == RateType.PERCENTAGE and self.rate_value is None:
            raise ValueError("rate_value is required when rate_type is PERCENTAGE")
        if self.rate_type == RateType.SLAB and not self.slab_definition:
            raise ValueError("slab_definition is required when rate_type is SLAB")
        return self


class StatutoryRateConfigResponse(BaseModel):
    id: str
    deduction_type: DeductionRateType
    rate_type: RateType
    rate_value: Optional[Decimal] = None
    slab_definition: Optional[List[dict]] = None
    effective_from: date
    is_active: bool
    created_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
