from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from datetime import datetime
from decimal import Decimal

from app.database import get_db
from app.models.employee import Employee
from app.models.salary_config import SalaryConfig
from app.models.user import User
from app.utils.deps import get_current_user
from app.utils.lifecycle_handler import lifecycle_handler

router = APIRouter(tags=["Leave Encashment"])

# In-memory store for encashment history (replace with DB model when available)
_encashment_history: List[dict] = []


# ── Schemas ──────────────────────────────────────────────────────────────────

ENCASHABLE_LEAVE_TYPES = {"EL", "PL"}


class LeaveEncashmentRequest(BaseModel):
    employee_id: str
    leave_type: str = Field(..., description="EL (Earned Leave) or PL (Privilege Leave)")
    days: int = Field(..., gt=0, description="Number of leave days to encash")
    period_id: str

    @field_validator("leave_type")
    @classmethod
    def validate_leave_type(cls, v: str) -> str:
        v = v.upper()
        if v not in ENCASHABLE_LEAVE_TYPES:
            raise ValueError(
                f"Leave type '{v}' is not encashable. Only EL and PL can be encashed (not SL)."
            )
        return v


class LeaveEncashmentResponse(BaseModel):
    employee_id: str
    leave_type: str
    days: int
    period_id: str
    encashment_amount: Decimal
    tax_exempt: bool
    new_leave_balance: int
    processed_at: datetime


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_employee_or_404(employee_id: str, db: AsyncSession) -> Employee:
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found.")
    return employee


async def _get_active_salary_config(employee_id: str, db: AsyncSession) -> Optional[SalaryConfig]:
    result = await db.execute(
        select(SalaryConfig).where(
            and_(SalaryConfig.employee_id == employee_id, SalaryConfig.status == "active")
        ).order_by(SalaryConfig.effective_date.desc())
    )
    return result.scalar_one_or_none()


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/", response_model=LeaveEncashmentResponse, status_code=status.HTTP_201_CREATED)
async def process_leave_encashment(
    payload: LeaveEncashmentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Process a leave encashment request.
    Only EL (Earned Leave) and PL (Privilege Leave) can be encashed — not SL (Sick Leave).
    """
    await _get_employee_or_404(payload.employee_id, db)

    config = await _get_active_salary_config(payload.employee_id, db)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active salary config found for this employee.",
        )

    basic = Decimal(str(config.basic_salary))

    encashment_amount = lifecycle_handler.calculate_leave_encashment(
        basic_salary=basic,
        leave_days=payload.days,
    )

    # Leave encashment during service is taxable; during FNF it may be exempt.
    # For regular encashment requests, it is taxable (tax_exempt=False).
    tax_exempt = False

    # Mock current leave balance as days requested (real balance would come from leave system)
    current_balance = payload.days + 10  # mock: assume 10 extra days in balance
    new_leave_balance = current_balance - payload.days

    record = {
        "employee_id": payload.employee_id,
        "leave_type": payload.leave_type,
        "days": payload.days,
        "period_id": payload.period_id,
        "encashment_amount": encashment_amount,
        "tax_exempt": tax_exempt,
        "new_leave_balance": new_leave_balance,
        "processed_at": datetime.utcnow(),
        "processed_by": current_user.id,
    }
    _encashment_history.append(record)

    return LeaveEncashmentResponse(
        employee_id=payload.employee_id,
        leave_type=payload.leave_type,
        days=payload.days,
        period_id=payload.period_id,
        encashment_amount=encashment_amount,
        tax_exempt=tax_exempt,
        new_leave_balance=new_leave_balance,
        processed_at=record["processed_at"],
    )


@router.get("/employee/{employee_id}", response_model=List[LeaveEncashmentResponse])
async def get_encashment_history(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get leave encashment history for an employee."""
    await _get_employee_or_404(employee_id, db)

    history = [
        LeaveEncashmentResponse(**{k: v for k, v in record.items() if k != "processed_by"})
        for record in _encashment_history
        if record["employee_id"] == employee_id
    ]
    return history
