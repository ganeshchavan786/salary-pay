from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from decimal import Decimal

from app.database import get_db
from app.models.tax_declaration import TaxDeclaration
from app.models.salary_config import SalaryConfig
from app.models.employee import Employee
from app.models.user import User
from app.utils.deps import get_current_user
from app.utils.tax_calculator import tax_calculator

router = APIRouter(tags=["Tax"])


# ── Schemas (inline) ─────────────────────────────────────────────────────────

class TaxDeclarationCreate(BaseModel):
    financial_year: str = Field(..., description="e.g. '2026-27'")
    tax_regime: str = Field(default="new", pattern="^(old|new)$")
    section_80c: Decimal = Field(default=Decimal("0"), ge=0)
    section_80d: Decimal = Field(default=Decimal("0"), ge=0)
    hra_exemption: Decimal = Field(default=Decimal("0"), ge=0)
    other_exemptions: Dict[str, Any] = Field(default_factory=dict)


class TaxDeclarationResponse(BaseModel):
    id: str
    employee_id: str
    financial_year: str
    tax_regime: str
    section_80c: Decimal
    section_80d: Decimal
    hra_exemption: Decimal
    other_exemptions: Dict[str, Any]
    total_exemptions: Decimal
    declaration_date: datetime
    status: str
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TDSProjectionResponse(BaseModel):
    employee_id: str
    financial_year: str
    tax_regime: str
    annual_income: Decimal
    total_exemptions: Decimal
    taxable_income: Decimal
    annual_tax: Decimal
    monthly_tds: Decimal


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_employee_or_404(employee_id: str, db: AsyncSession) -> Employee:
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found.")
    return employee


def _current_financial_year() -> str:
    now = datetime.utcnow()
    if now.month >= 4:
        return f"{now.year}-{str(now.year + 1)[-2:]}"
    return f"{now.year - 1}-{str(now.year)[-2:]}"


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post(
    "/declarations/{employee_id}",
    response_model=TaxDeclarationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_tax_declaration(
    employee_id: str,
    payload: TaxDeclarationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit or update a tax declaration for an employee."""
    await _get_employee_or_404(employee_id, db)

    # Check for existing declaration for this FY
    existing_result = await db.execute(
        select(TaxDeclaration).where(
            TaxDeclaration.employee_id == employee_id,
            TaxDeclaration.financial_year == payload.financial_year,
        )
    )
    existing = existing_result.scalar_one_or_none()

    total_exemptions = (
        payload.section_80c
        + payload.section_80d
        + payload.hra_exemption
        + Decimal(str(sum(float(v) for v in payload.other_exemptions.values() if isinstance(v, (int, float)))))
    )

    if existing:
        # Update existing declaration
        existing.tax_regime = payload.tax_regime
        existing.section_80c = payload.section_80c
        existing.section_80d = payload.section_80d
        existing.hra_exemption = payload.hra_exemption
        existing.other_exemptions = payload.other_exemptions
        existing.total_exemptions = total_exemptions
        existing.declaration_date = datetime.utcnow()
        existing.status = "submitted"
        existing.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(existing)
        return TaxDeclarationResponse.model_validate(existing)

    declaration = TaxDeclaration(
        employee_id=employee_id,
        financial_year=payload.financial_year,
        tax_regime=payload.tax_regime,
        section_80c=payload.section_80c,
        section_80d=payload.section_80d,
        hra_exemption=payload.hra_exemption,
        other_exemptions=payload.other_exemptions,
        total_exemptions=total_exemptions,
        status="submitted",
    )
    db.add(declaration)
    await db.commit()
    await db.refresh(declaration)
    return TaxDeclarationResponse.model_validate(declaration)


@router.get("/declarations/{employee_id}", response_model=TaxDeclarationResponse)
async def get_tax_declaration(
    employee_id: str,
    financial_year: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the current tax declaration for an employee."""
    await _get_employee_or_404(employee_id, db)

    fy = financial_year or _current_financial_year()
    result = await db.execute(
        select(TaxDeclaration).where(
            TaxDeclaration.employee_id == employee_id,
            TaxDeclaration.financial_year == fy,
        )
    )
    declaration = result.scalar_one_or_none()
    if not declaration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No tax declaration found for employee {employee_id} in FY {fy}.",
        )
    return TaxDeclarationResponse.model_validate(declaration)


@router.get("/tds-projection/{employee_id}", response_model=TDSProjectionResponse)
async def get_tds_projection(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get TDS projection for the current financial year."""
    await _get_employee_or_404(employee_id, db)

    # Get active salary config
    config_result = await db.execute(
        select(SalaryConfig).where(
            SalaryConfig.employee_id == employee_id,
            SalaryConfig.status == "active",
        ).order_by(SalaryConfig.effective_date.desc())
    )
    config = config_result.scalar_one_or_none()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active salary config found for this employee.",
        )

    fy = _current_financial_year()

    # Get tax declaration if available
    decl_result = await db.execute(
        select(TaxDeclaration).where(
            TaxDeclaration.employee_id == employee_id,
            TaxDeclaration.financial_year == fy,
        )
    )
    declaration = decl_result.scalar_one_or_none()

    # Estimate annual income from salary config
    basic = Decimal(str(config.basic_salary))
    hra_pct = Decimal(str(config.hra_percentage))
    hra = basic * hra_pct / 100
    gross_monthly = (
        basic
        + hra
        + Decimal(str(config.special_allowance))
        + Decimal(str(config.travel_allowance))
        + Decimal(str(config.medical_allowance))
    )
    annual_income = gross_monthly * 12

    regime = declaration.tax_regime if declaration else config.tax_regime
    exemptions = declaration.total_exemptions if declaration else Decimal("0")

    tax_result = tax_calculator.calculate_income_tax(
        annual_income=annual_income,
        regime=regime,
        exemptions=exemptions,
    )

    return TDSProjectionResponse(
        employee_id=employee_id,
        financial_year=fy,
        tax_regime=regime,
        annual_income=annual_income,
        total_exemptions=exemptions,
        taxable_income=tax_result["taxable_income"],
        annual_tax=tax_result["annual_tax"],
        monthly_tds=tax_result["monthly_tds"],
    )
