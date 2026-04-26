from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from decimal import Decimal

from app.database import get_db
from app.models.deduction import Deduction, DeductionType, DeductionStatus, RecoveryMode
from app.models.employee import Employee
from app.models.installment_record import InstallmentRecord
from app.models.payroll_period import PayrollPeriod
from app.models.user import User
from app.schemas.installment_record import InstallmentRecordResponse
from app.utils.deps import get_current_user

router = APIRouter(tags=["Deductions"])


# ── Schemas (inline) ─────────────────────────────────────────────────────────

class DeductionCreate(BaseModel):
    employee_id: str
    deduction_type: DeductionType
    total_amount: Decimal = Field(..., gt=0)
    emi_amount: Optional[Decimal] = None
    recovery_mode: RecoveryMode = RecoveryMode.INSTALLMENTS
    installments: Optional[str] = None
    start_period: Optional[datetime] = None
    end_period: Optional[datetime] = None
    description: Optional[str] = None


class DeductionResponse(BaseModel):
    id: str
    employee_id: str
    deduction_type: DeductionType
    total_amount: Decimal
    emi_amount: Optional[Decimal] = None
    recovered: Decimal
    remaining: Decimal
    recovery_mode: RecoveryMode
    installments: Optional[str] = None
    start_period: Optional[datetime] = None
    end_period: Optional[datetime] = None
    status: DeductionStatus
    description: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_employee_or_404(employee_id: str, db: AsyncSession) -> Employee:
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found.")
    return employee


async def _get_deduction_or_404(deduction_id: str, db: AsyncSession) -> Deduction:
    result = await db.execute(select(Deduction).where(Deduction.id == deduction_id))
    deduction = result.scalar_one_or_none()
    if not deduction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deduction not found.")
    return deduction


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/", response_model=DeductionResponse, status_code=status.HTTP_201_CREATED)
async def create_deduction(
    payload: DeductionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a deduction (loan / advance / fine / custom) for an employee."""
    await _get_employee_or_404(payload.employee_id, db)

    deduction = Deduction(
        employee_id=payload.employee_id,
        deduction_type=payload.deduction_type,
        total_amount=payload.total_amount,
        emi_amount=payload.emi_amount,
        recovered=Decimal("0"),
        remaining=payload.total_amount,
        recovery_mode=payload.recovery_mode,
        installments=payload.installments,
        start_period=payload.start_period,
        end_period=payload.end_period,
        status=DeductionStatus.ACTIVE,
        description=payload.description,
        created_by=current_user.id,
    )
    db.add(deduction)
    await db.commit()
    await db.refresh(deduction)
    return DeductionResponse.model_validate(deduction)


@router.get("/employee/{employee_id}", response_model=List[DeductionResponse])
async def get_employee_deductions(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all active deductions for an employee."""
    await _get_employee_or_404(employee_id, db)

    result = await db.execute(
        select(Deduction).where(
            Deduction.employee_id == employee_id,
            Deduction.status == DeductionStatus.ACTIVE,
        ).order_by(Deduction.created_at.desc())
    )
    deductions = result.scalars().all()
    return [DeductionResponse.model_validate(d) for d in deductions]


@router.patch("/{deduction_id}/pause", response_model=DeductionResponse)
async def pause_deduction(
    deduction_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pause an active deduction."""
    deduction = await _get_deduction_or_404(deduction_id, db)

    if deduction.status != DeductionStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only ACTIVE deductions can be paused. Current status: {deduction.status.value}",
        )

    deduction.status = DeductionStatus.PAUSED
    deduction.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(deduction)
    return DeductionResponse.model_validate(deduction)


@router.patch("/{deduction_id}/resume", response_model=DeductionResponse)
async def resume_deduction(
    deduction_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resume a paused deduction."""
    deduction = await _get_deduction_or_404(deduction_id, db)

    if deduction.status != DeductionStatus.PAUSED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only PAUSED deductions can be resumed. Current status: {deduction.status.value}",
        )

    deduction.status = DeductionStatus.ACTIVE
    deduction.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(deduction)
    return DeductionResponse.model_validate(deduction)


@router.get("/employee/{employee_id}/installments", response_model=List[InstallmentRecordResponse])
async def get_employee_installments(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return all InstallmentRecord rows for all deductions of the given employee,
    with period_name populated from the PayrollPeriod table.
    """
    await _get_employee_or_404(employee_id, db)

    # Fetch all deduction IDs for this employee
    ded_result = await db.execute(
        select(Deduction.id).where(Deduction.employee_id == employee_id)
    )
    deduction_ids = [row[0] for row in ded_result.fetchall()]

    if not deduction_ids:
        return []

    # Fetch all installment records for those deductions
    inst_result = await db.execute(
        select(InstallmentRecord).where(
            InstallmentRecord.deduction_id.in_(deduction_ids)
        ).order_by(InstallmentRecord.applied_at.desc())
    )
    records = inst_result.scalars().all()

    if not records:
        return []

    # Fetch period names in one query
    period_ids = list({r.period_id for r in records})
    period_result = await db.execute(
        select(PayrollPeriod).where(PayrollPeriod.id.in_(period_ids))
    )
    period_map = {p.id: p.period_name for p in period_result.scalars().all()}

    responses = []
    for r in records:
        responses.append(
            InstallmentRecordResponse(
                id=r.id,
                deduction_id=r.deduction_id,
                period_id=r.period_id,
                period_name=period_map.get(r.period_id),
                amount_deducted=r.amount_deducted,
                remaining_after=r.remaining_after,
                applied_at=r.applied_at,
            )
        )
    return responses
