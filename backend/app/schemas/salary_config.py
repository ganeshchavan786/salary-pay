from pydantic import BaseModel, Field, model_validator
from typing import Optional, List, Any, Dict
from datetime import datetime
from decimal import Decimal


class CostCenterAllocation(BaseModel):
    cost_center: str
    percentage: float = Field(..., gt=0, le=100)


class CustomPayhead(BaseModel):
    name: str = Field(..., min_length=1)
    amount: Decimal = Field(..., ge=0)
    is_percentage_of_basic: bool = False


class SalaryConfigCreate(BaseModel):
    employee_id: str
    effective_date: datetime
    basic_salary: Decimal = Field(..., gt=0)
    hra_percentage: Decimal = Field(default=Decimal("50.00"), ge=0, le=100)
    special_allowance: Decimal = Field(default=Decimal("0"))
    travel_allowance: Decimal = Field(default=Decimal("0"))
    medical_allowance: Decimal = Field(default=Decimal("0"))
    pf_applicable: bool = True
    esi_applicable: bool = True
    pt_applicable: bool = True
    tax_regime: str = Field(default="new", pattern="^(old|new)$")
    cost_center_allocations: List[Dict[str, Any]] = Field(default_factory=list)
    custom_payheads: List[CustomPayhead] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_cost_center_sum(self) -> "SalaryConfigCreate":
        allocations = self.cost_center_allocations
        if allocations:
            total = sum(float(a.get("percentage", 0)) for a in allocations)
            if abs(total - 100.0) > 0.01:
                raise ValueError(
                    f"Cost center allocations must sum to 100%, got {total:.2f}%"
                )
        return self

    @model_validator(mode="after")
    def validate_custom_payheads_limit(self) -> "SalaryConfigCreate":
        if len(self.custom_payheads) > 10:
            raise ValueError("Maximum 10 custom payheads allowed per salary config")
        return self


class SalaryConfigResponse(BaseModel):
    id: str
    employee_id: str
    effective_date: datetime
    basic_salary: Decimal
    hra_percentage: Decimal
    special_allowance: Decimal
    travel_allowance: Decimal
    medical_allowance: Decimal
    pf_applicable: bool
    esi_applicable: bool
    pt_applicable: bool
    tax_regime: str
    cost_center_allocations: List[Dict[str, Any]] = Field(default_factory=list)
    custom_payheads: List[CustomPayhead] = Field(default_factory=list)
    status: str
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
