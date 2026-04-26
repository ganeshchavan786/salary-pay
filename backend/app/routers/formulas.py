from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime

from app.database import get_db
from app.models.salary_formula import SalaryFormula
from app.models.user import User
from app.utils.deps import get_current_user
from app.utils.formula_engine import formula_engine

router = APIRouter(tags=["Salary Formulas"])


# ── Schemas (inline, formula-specific) ──────────────────────────────────────

class FormulaCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    formula_expression: str
    input_variables: List[str] = Field(default_factory=list)
    output_variable: str = Field(..., min_length=1, max_length=100)
    dependencies: List[str] = Field(default_factory=list)
    formula_type: str = Field(..., description="earning / deduction / tax / custom")
    effective_date: datetime
    expiry_date: Optional[datetime] = None


class FormulaResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    formula_expression: str
    input_variables: List[str]
    output_variable: str
    dependencies: List[str]
    formula_type: str
    effective_date: datetime
    expiry_date: Optional[datetime] = None
    is_active: bool
    created_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class FormulaTestRequest(BaseModel):
    formula_expression: str
    context: Dict[str, Any] = Field(default_factory=dict)


class FormulaTestResponse(BaseModel):
    result: float
    expression: str
    context: Dict[str, Any]


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/", response_model=FormulaResponse, status_code=status.HTTP_201_CREATED)
async def create_formula(
    payload: FormulaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new salary formula."""
    formula = SalaryFormula(
        name=payload.name,
        description=payload.description,
        formula_expression=payload.formula_expression,
        input_variables=payload.input_variables,
        output_variable=payload.output_variable,
        dependencies=payload.dependencies,
        formula_type=payload.formula_type,
        effective_date=payload.effective_date,
        expiry_date=payload.expiry_date,
        is_active=True,
        created_by=current_user.id,
    )
    db.add(formula)
    await db.commit()
    await db.refresh(formula)
    return FormulaResponse.model_validate(formula)


@router.get("/", response_model=List[FormulaResponse])
async def list_formulas(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all active salary formulas."""
    result = await db.execute(
        select(SalaryFormula)
        .where(SalaryFormula.is_active == True)  # noqa: E712
        .order_by(SalaryFormula.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    formulas = result.scalars().all()
    return [FormulaResponse.model_validate(f) for f in formulas]


@router.post("/test", response_model=FormulaTestResponse)
async def test_formula(
    payload: FormulaTestRequest,
    current_user: User = Depends(get_current_user),
):
    """Dry-run: evaluate a formula expression with sample context data."""
    try:
        result = formula_engine.evaluate_expression(payload.formula_expression, payload.context)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    return FormulaTestResponse(
        result=float(result),
        expression=payload.formula_expression,
        context=payload.context,
    )


@router.delete("/{formula_id}", status_code=status.HTTP_200_OK)
async def deactivate_formula(
    formula_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deactivate (soft-delete) a salary formula."""
    result = await db.execute(
        select(SalaryFormula).where(SalaryFormula.id == formula_id)
    )
    formula = result.scalar_one_or_none()
    if not formula:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Formula not found.")

    formula.is_active = False
    formula.updated_at = datetime.utcnow()
    await db.commit()
    return {"message": "Formula deactivated successfully.", "id": formula_id}
