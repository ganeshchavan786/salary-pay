from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from datetime import datetime

from app.database import get_db
from app.models.salary_config import SalaryConfig
from app.models.employee import Employee
from app.models.user import User
from app.schemas.salary_config import SalaryConfigCreate, SalaryConfigResponse
from app.utils.deps import get_current_user

router = APIRouter(tags=["Salary Config"])


async def _get_employee_or_404(employee_id: str, db: AsyncSession) -> Employee:
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found.")
    return employee


@router.post("/", response_model=SalaryConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_salary_config(
    payload: SalaryConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a salary config for an employee. Deactivates any previous active config."""
    await _get_employee_or_404(payload.employee_id, db)

    # Deactivate existing active configs for this employee
    existing_result = await db.execute(
        select(SalaryConfig).where(
            SalaryConfig.employee_id == payload.employee_id,
            SalaryConfig.status == "active",
        )
    )
    existing_configs = existing_result.scalars().all()
    for cfg in existing_configs:
        cfg.status = "inactive"
        cfg.updated_at = datetime.utcnow()

    config = SalaryConfig(
        employee_id=payload.employee_id,
        effective_date=payload.effective_date,
        basic_salary=payload.basic_salary,
        hra_percentage=payload.hra_percentage,
        special_allowance=payload.special_allowance,
        travel_allowance=payload.travel_allowance,
        medical_allowance=payload.medical_allowance,
        pf_applicable=payload.pf_applicable,
        esi_applicable=payload.esi_applicable,
        pt_applicable=payload.pt_applicable,
        tax_regime=payload.tax_regime,
        cost_center_allocations=payload.cost_center_allocations,
        custom_payheads=[
            {"name": ph.name, "amount": float(ph.amount), "is_percentage_of_basic": ph.is_percentage_of_basic}
            for ph in payload.custom_payheads
        ],
        status="active",
        created_by=current_user.id,
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return SalaryConfigResponse.model_validate(config)


@router.get("/employee/{employee_id}", response_model=SalaryConfigResponse)
async def get_active_salary_config(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the active salary config for an employee."""
    await _get_employee_or_404(employee_id, db)

    result = await db.execute(
        select(SalaryConfig).where(
            SalaryConfig.employee_id == employee_id,
            SalaryConfig.status == "active",
        ).order_by(SalaryConfig.effective_date.desc())
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active salary config found for this employee.",
        )
    return SalaryConfigResponse.model_validate(config)


@router.get("/employee/{employee_id}/history", response_model=List[SalaryConfigResponse])
async def get_salary_config_history(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all salary configs (version history) for an employee."""
    await _get_employee_or_404(employee_id, db)

    result = await db.execute(
        select(SalaryConfig)
        .where(SalaryConfig.employee_id == employee_id)
        .order_by(SalaryConfig.effective_date.desc())
    )
    configs = result.scalars().all()
    return [SalaryConfigResponse.model_validate(c) for c in configs]


@router.put("/{config_id}", response_model=SalaryConfigResponse)
async def update_salary_config(
    config_id: str,
    payload: SalaryConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update a salary config by creating a new version with a new effective_date.
    The old config is deactivated.
    """
    result = await db.execute(
        select(SalaryConfig).where(SalaryConfig.id == config_id)
    )
    old_config = result.scalar_one_or_none()
    if not old_config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Salary config not found.")

    await _get_employee_or_404(payload.employee_id, db)

    # Deactivate the old config
    old_config.status = "inactive"
    old_config.updated_at = datetime.utcnow()

    # Create new version
    new_config = SalaryConfig(
        employee_id=payload.employee_id,
        effective_date=payload.effective_date,
        basic_salary=payload.basic_salary,
        hra_percentage=payload.hra_percentage,
        special_allowance=payload.special_allowance,
        travel_allowance=payload.travel_allowance,
        medical_allowance=payload.medical_allowance,
        pf_applicable=payload.pf_applicable,
        esi_applicable=payload.esi_applicable,
        pt_applicable=payload.pt_applicable,
        tax_regime=payload.tax_regime,
        cost_center_allocations=payload.cost_center_allocations,
        custom_payheads=[
            {"name": ph.name, "amount": float(ph.amount), "is_percentage_of_basic": ph.is_percentage_of_basic}
            for ph in payload.custom_payheads
        ],
        status="active",
        created_by=current_user.id,
    )
    db.add(new_config)
    await db.commit()
    await db.refresh(new_config)
    return SalaryConfigResponse.model_validate(new_config)
