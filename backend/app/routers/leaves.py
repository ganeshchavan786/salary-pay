from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal
import uuid

from app.database import get_db
from app.models.leave import Leave, LeaveBalance, LeaveType, LeaveStatus
from app.models.employee import Employee
from app.models.user import User
from app.schemas.leave import (
    LeaveCreate, LeaveResponse, LeaveBalanceResponse, LeaveActionRequest,
    BulkLeaveActionRequest, BalanceUpdateRequest, LeaveStatsResponse,
    EmployeeBalanceResponse, EmployeeSummaryRow,
)
from app.utils.deps import get_current_user, require_supervisor, require_admin

router = APIRouter(tags=["Leaves"])


def _calc_total_days(from_date: date, to_date: date) -> Decimal:
    delta = (to_date - from_date).days + 1
    return Decimal(str(max(delta, 1)))


async def _get_or_create_balance(db: AsyncSession, emp_id: str, year: int) -> LeaveBalance:
    result = await db.execute(
        select(LeaveBalance).where(
            and_(LeaveBalance.emp_id == emp_id, LeaveBalance.year == year)
        )
    )
    bal = result.scalar_one_or_none()
    if not bal:
        emp_result = await db.execute(select(Employee).where(Employee.id == emp_id))
        emp = emp_result.scalar_one_or_none()
        cl_total = 12 if (emp and emp.is_confirmed) else 0
        bal = LeaveBalance(
            id=str(uuid.uuid4()),
            emp_id=emp_id,
            year=year,
            cl_total=cl_total,
        )
        db.add(bal)
        await db.flush()
    return bal


def _leave_to_dict(leave: Leave) -> dict:
    return {
        "id": leave.id,
        "emp_id": leave.emp_id,
        "leave_type": leave.leave_type.value if leave.leave_type else None,
        "from_date": leave.from_date.isoformat() if leave.from_date else None,
        "to_date": leave.to_date.isoformat() if leave.to_date else None,
        "total_days": float(leave.total_days) if leave.total_days else 0,
        "reason": leave.reason,
        "status": leave.status.value if leave.status else None,
        "applied_at": leave.applied_at.isoformat() if leave.applied_at else None,
        "approved_by": leave.approved_by,
        "approver_comment": leave.approver_comment,
        "action_at": leave.action_at.isoformat() if leave.action_at else None,
    }


# ── Static routes (MUST be before /{leave_id}) ────────────────────────────────

@router.get("/stats", response_model=LeaveStatsResponse)
async def get_leave_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Leave statistics summary."""
    now = datetime.utcnow()
    current_year = now.year
    current_month_start = datetime(now.year, now.month, 1)
    next_month = now.month + 1 if now.month < 12 else 1
    next_month_year = now.year if now.month < 12 else now.year + 1
    current_month_end = datetime(next_month_year, next_month, 1)

    pending_count = (await db.execute(
        select(func.count(Leave.id)).where(Leave.status == LeaveStatus.PENDING)
    )).scalar() or 0

    approved_this_month = (await db.execute(
        select(func.count(Leave.id)).where(
            and_(
                Leave.status == LeaveStatus.APPROVED,
                Leave.action_at >= current_month_start,
                Leave.action_at < current_month_end,
            )
        )
    )).scalar() or 0

    rejected_this_month = (await db.execute(
        select(func.count(Leave.id)).where(
            and_(
                Leave.status == LeaveStatus.REJECTED,
                Leave.action_at >= current_month_start,
                Leave.action_at < current_month_end,
            )
        )
    )).scalar() or 0

    lwp_result = await db.execute(
        select(func.sum(Leave.total_days)).where(
            and_(
                Leave.status == LeaveStatus.APPROVED,
                Leave.leave_type == LeaveType.LWP,
                Leave.from_date >= date(current_year, 1, 1),
                Leave.from_date <= date(current_year, 12, 31),
            )
        )
    )
    lwp_this_year = float(lwp_result.scalar() or 0)

    return LeaveStatsResponse(
        pending_count=pending_count,
        approved_this_month=approved_this_month,
        rejected_this_month=rejected_this_month,
        lwp_this_year=lwp_this_year,
    )


@router.get("/balances")
async def get_all_balances(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """All employees' leave balances for current year."""
    current_year = datetime.utcnow().year

    emp_result = await db.execute(select(Employee))
    employees = emp_result.scalars().all()

    balances = []
    for emp in employees:
        bal_result = await db.execute(
            select(LeaveBalance).where(
                and_(LeaveBalance.emp_id == emp.id, LeaveBalance.year == current_year)
            )
        )
        bal = bal_result.scalar_one_or_none()

        cl_total = bal.cl_total if bal else 0
        cl_used = float(bal.cl_used or 0) if bal else 0.0
        cl_available = max(0.0, cl_total - cl_used)

        balances.append(EmployeeBalanceResponse(
            emp_id=emp.id,
            emp_name=emp.name,
            emp_code=emp.emp_code,
            department=emp.department,
            year=current_year,
            cl_total=cl_total,
            cl_used=cl_used,
            cl_available=cl_available,
            sl_used=float(bal.sl_used or 0) if bal else 0.0,
            el_used=float(bal.el_used or 0) if bal else 0.0,
            lwp_days=float(bal.lwp_days or 0) if bal else 0.0,
            late_mark_count=bal.late_mark_count or 0 if bal else 0,
        ))

    return {"balances": [b.model_dump() for b in balances]}


@router.put("/balance/{emp_id}")
async def update_leave_balance(
    emp_id: str,
    body: BalanceUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Manually update employee's CL total allocation."""
    current_year = datetime.utcnow().year
    bal = await _get_or_create_balance(db, emp_id, current_year)

    cl_used = float(bal.cl_used or 0)
    if body.cl_total < cl_used:
        raise HTTPException(
            status_code=400,
            detail=f"cl_total cannot be less than cl_used ({cl_used} days)"
        )

    bal.cl_total = body.cl_total
    await db.commit()
    return {
        "message": "Leave balance updated.",
        "cl_total": bal.cl_total,
        "cl_used": float(bal.cl_used or 0),
        "cl_available": max(0.0, bal.cl_total - float(bal.cl_used or 0)),
    }


@router.post("/bulk-action")
async def bulk_leave_action(
    body: BulkLeaveActionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Bulk approve or reject multiple pending leaves."""
    if not body.leave_ids:
        raise HTTPException(status_code=400, detail="No leave IDs provided.")

    result = await db.execute(
        select(Leave).where(
            and_(Leave.id.in_(body.leave_ids), Leave.status == LeaveStatus.PENDING)
        )
    )
    leaves = result.scalars().all()

    found_ids = {l.id for l in leaves}
    failures = [
        {"leave_id": lid, "reason": "not found or not pending"}
        for lid in body.leave_ids if lid not in found_ids
    ]

    success_count = 0
    for leave in leaves:
        try:
            year = leave.from_date.year
            bal = await _get_or_create_balance(db, leave.emp_id, year)
            td = Decimal(str(leave.total_days))

            if body.action == "approve":
                leave.status = LeaveStatus.APPROVED
                if leave.leave_type == LeaveType.CL:
                    bal.cl_used = Decimal(str(bal.cl_used or 0)) + td
                elif leave.leave_type == LeaveType.SL:
                    bal.sl_used = Decimal(str(bal.sl_used or 0)) + td
                elif leave.leave_type == LeaveType.EL:
                    bal.el_used = Decimal(str(bal.el_used or 0)) + td
                elif leave.leave_type == LeaveType.LWP:
                    bal.lwp_days = Decimal(str(bal.lwp_days or 0)) + td
            else:
                leave.status = LeaveStatus.REJECTED

            leave.approved_by = current_user.id
            leave.approver_comment = body.comment or ""
            leave.action_at = datetime.utcnow()
            success_count += 1
        except Exception as e:
            failures.append({"leave_id": leave.id, "reason": str(e)})

    await db.commit()
    return {
        "success_count": success_count,
        "failure_count": len(failures),
        "failures": failures,
    }


@router.get("/report/summary")
async def report_leave_summary(
    year: int = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Per-employee leave usage summary for a given year."""
    y = year or datetime.utcnow().year

    result = await db.execute(
        select(Leave, Employee)
        .join(Employee, Leave.emp_id == Employee.id)
        .where(
            and_(
                Leave.status == LeaveStatus.APPROVED,
                Leave.from_date >= date(y, 1, 1),
                Leave.from_date <= date(y, 12, 31),
            )
        )
    )
    rows = result.all()

    # Aggregate per employee
    emp_data: dict = {}
    for leave, emp in rows:
        if emp.id not in emp_data:
            emp_data[emp.id] = {
                "emp_id": emp.id, "emp_name": emp.name, "emp_code": emp.emp_code,
                "cl_used": 0.0, "sl_used": 0.0, "el_used": 0.0, "lwp_days": 0.0, "total_days": 0.0,
            }
        td = float(leave.total_days or 0)
        emp_data[emp.id]["total_days"] += td
        if leave.leave_type == LeaveType.CL:
            emp_data[emp.id]["cl_used"] += td
        elif leave.leave_type == LeaveType.SL:
            emp_data[emp.id]["sl_used"] += td
        elif leave.leave_type == LeaveType.EL:
            emp_data[emp.id]["el_used"] += td
        elif leave.leave_type == LeaveType.LWP:
            emp_data[emp.id]["lwp_days"] += td

    return {"year": y, "summary": list(emp_data.values())}


@router.get("/report/monthly")
async def report_leave_monthly(
    year: int = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Monthly approved leave day totals for a given year (12-element array)."""
    y = year or datetime.utcnow().year

    result = await db.execute(
        select(Leave).where(
            and_(
                Leave.status == LeaveStatus.APPROVED,
                Leave.from_date >= date(y, 1, 1),
                Leave.from_date <= date(y, 12, 31),
            )
        )
    )
    leaves = result.scalars().all()

    monthly = [0.0] * 12
    for leave in leaves:
        month_idx = leave.from_date.month - 1  # 0-indexed
        monthly[month_idx] += float(leave.total_days or 0)

    return {"year": y, "monthly": monthly}


@router.get("/my")
async def get_my_leaves(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get own leave history."""
    if not current_user.emp_id:
        return {"leaves": []}
    result = await db.execute(
        select(Leave).where(Leave.emp_id == current_user.emp_id).order_by(Leave.applied_at.desc())
    )
    leaves = result.scalars().all()
    return {"leaves": [_leave_to_dict(l) for l in leaves]}


@router.get("/balance/{emp_id}")
async def get_leave_balance(
    emp_id: str,
    year: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get leave balance for an employee."""
    y = year or datetime.utcnow().year
    bal = await _get_or_create_balance(db, emp_id, y)
    await db.commit()
    return {
        "id": bal.id,
        "emp_id": bal.emp_id,
        "year": bal.year,
        "cl_total": bal.cl_total,
        "cl_used": float(bal.cl_used or 0),
        "sl_used": float(bal.sl_used or 0),
        "el_used": float(bal.el_used or 0),
        "lwp_days": float(bal.lwp_days or 0),
        "late_mark_count": bal.late_mark_count or 0,
        "half_late_mark_count": bal.half_late_mark_count or 0,
        "half_day_from_late": float(bal.half_day_from_late or 0),
    }


@router.get("")
async def list_leaves(
    status: Optional[str] = None,
    emp_id: Optional[str] = None,
    leave_type: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """List all leaves with optional filters."""
    query = select(Leave, Employee).join(Employee, Leave.emp_id == Employee.id)
    if status:
        query = query.where(Leave.status == status)
    if emp_id:
        query = query.where(Leave.emp_id == emp_id)
    if leave_type:
        query = query.where(Leave.leave_type == leave_type)
    if from_date:
        query = query.where(Leave.from_date >= from_date)
    if to_date:
        query = query.where(Leave.to_date <= to_date)
    query = query.order_by(Leave.applied_at.desc())
    result = await db.execute(query)
    rows = result.all()
    leaves = []
    for leave, emp in rows:
        d = _leave_to_dict(leave)
        d["emp_name"] = emp.name
        d["emp_code"] = emp.emp_code
        leaves.append(d)
    return {"leaves": leaves}


@router.post("", status_code=201)
async def apply_leave(
    data: LeaveCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Apply for leave."""
    emp_result = await db.execute(select(Employee).where(Employee.id == data.emp_id))
    emp = emp_result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found.")

    if data.leave_type == LeaveType.CL:
        if not emp.is_confirmed:
            raise HTTPException(
                status_code=400,
                detail="Casual Leave (CL) is not allowed during probation. Use SL or EL."
            )

    total_days = _calc_total_days(data.from_date, data.to_date)
    year = data.from_date.year

    if data.leave_type == LeaveType.CL:
        bal = await _get_or_create_balance(db, data.emp_id, year)
        available = Decimal(str(bal.cl_total or 0)) - Decimal(str(bal.cl_used or 0))
        if available < total_days:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient CL balance. Available: {float(available)} days."
            )

    overlap = await db.execute(
        select(Leave).where(
            and_(
                Leave.emp_id == data.emp_id,
                Leave.status.in_(["pending", "approved"]),
                Leave.from_date <= data.to_date,
                Leave.to_date >= data.from_date,
            )
        )
    )
    if overlap.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Leave already applied for overlapping dates.")

    leave = Leave(
        id=str(uuid.uuid4()),
        emp_id=data.emp_id,
        leave_type=data.leave_type,
        from_date=data.from_date,
        to_date=data.to_date,
        total_days=total_days,
        reason=data.reason,
        status=LeaveStatus.PENDING,
        applied_at=datetime.utcnow(),
    )
    db.add(leave)
    await _get_or_create_balance(db, data.emp_id, year)
    await db.commit()
    await db.refresh(leave)
    return {"message": "Leave applied successfully. Awaiting approval.", "leave": _leave_to_dict(leave)}


@router.put("/{leave_id}/approve")
async def approve_leave(
    leave_id: str,
    data: LeaveActionRequest = LeaveActionRequest(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Approve a leave request."""
    result = await db.execute(select(Leave).where(Leave.id == leave_id))
    leave = result.scalar_one_or_none()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found.")
    if leave.status != LeaveStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Leave already {leave.status.value}.")

    leave.status = LeaveStatus.APPROVED
    leave.approved_by = current_user.id
    leave.approver_comment = data.comment or ""
    leave.action_at = datetime.utcnow()

    year = leave.from_date.year
    bal = await _get_or_create_balance(db, leave.emp_id, year)
    td = Decimal(str(leave.total_days))
    if leave.leave_type == LeaveType.CL:
        bal.cl_used = Decimal(str(bal.cl_used or 0)) + td
    elif leave.leave_type == LeaveType.SL:
        bal.sl_used = Decimal(str(bal.sl_used or 0)) + td
    elif leave.leave_type == LeaveType.EL:
        bal.el_used = Decimal(str(bal.el_used or 0)) + td
    elif leave.leave_type == LeaveType.LWP:
        bal.lwp_days = Decimal(str(bal.lwp_days or 0)) + td

    await db.commit()
    return {"message": "Leave approved.", "leave": _leave_to_dict(leave)}


@router.put("/{leave_id}/reject")
async def reject_leave(
    leave_id: str,
    data: LeaveActionRequest = LeaveActionRequest(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Reject a leave request."""
    result = await db.execute(select(Leave).where(Leave.id == leave_id))
    leave = result.scalar_one_or_none()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found.")
    leave.status = LeaveStatus.REJECTED
    leave.approved_by = current_user.id
    leave.approver_comment = data.comment or "Rejected."
    leave.action_at = datetime.utcnow()
    await db.commit()
    return {"message": "Leave rejected.", "leave": _leave_to_dict(leave)}


@router.put("/{leave_id}/cancel")
async def cancel_leave(
    leave_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Cancel an approved leave and reverse the balance deduction."""
    result = await db.execute(select(Leave).where(Leave.id == leave_id))
    leave = result.scalar_one_or_none()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found.")
    if leave.status != LeaveStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Only approved leaves can be cancelled.")

    year = leave.from_date.year
    bal = await _get_or_create_balance(db, leave.emp_id, year)
    td = Decimal(str(leave.total_days))

    # Reverse balance deduction (clamp to 0)
    if leave.leave_type == LeaveType.CL:
        bal.cl_used = max(Decimal("0"), Decimal(str(bal.cl_used or 0)) - td)
    elif leave.leave_type == LeaveType.SL:
        bal.sl_used = max(Decimal("0"), Decimal(str(bal.sl_used or 0)) - td)
    elif leave.leave_type == LeaveType.EL:
        bal.el_used = max(Decimal("0"), Decimal(str(bal.el_used or 0)) - td)
    elif leave.leave_type == LeaveType.LWP:
        bal.lwp_days = max(Decimal("0"), Decimal(str(bal.lwp_days or 0)) - td)

    leave.status = LeaveStatus.CANCELLED
    leave.approved_by = current_user.id
    leave.action_at = datetime.utcnow()
    await db.commit()
    return {"message": "Leave cancelled.", "leave": _leave_to_dict(leave)}
