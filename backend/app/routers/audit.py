from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.utils.deps import require_supervisor

router = APIRouter(tags=["Audit"])


@router.get("/all")
async def get_all_audit_logs(
    limit: int = Query(default=50, ge=1, le=200),
    emp_id: str = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """All recent audit log entries, optionally filtered by employee."""
    query = select(AuditLog)
    if emp_id:
        query = query.where(AuditLog.emp_id == emp_id)
    query = query.order_by(AuditLog.created_at.desc()).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()
    return {"logs": [_log_to_dict(l) for l in logs]}


@router.get("/attendance/{attendance_id}")
async def get_attendance_audit(
    attendance_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Audit history for one attendance_daily record."""
    result = await db.execute(
        select(AuditLog).where(
            and_(
                AuditLog.table_name == "attendance_daily",
                AuditLog.record_id == attendance_id,
            )
        ).order_by(AuditLog.created_at.desc())
    )
    logs = result.scalars().all()
    return {"logs": [_log_to_dict(l) for l in logs]}


@router.get("/employee/{emp_id}")
async def get_employee_audit(
    emp_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """All audit log entries for one employee."""
    result = await db.execute(
        select(AuditLog).where(AuditLog.emp_id == emp_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    logs = result.scalars().all()

    count_result = await db.execute(
        select(AuditLog).where(AuditLog.emp_id == emp_id)
    )
    total = len(count_result.scalars().all())

    return {"logs": [_log_to_dict(l) for l in logs], "total": total}


def _log_to_dict(l: AuditLog) -> dict:
    return {
        "id": l.id,
        "table_name": l.table_name,
        "record_id": l.record_id,
        "emp_id": l.emp_id,
        "action": l.action,
        "field_name": l.field_name,
        "old_value": l.old_value,
        "new_value": l.new_value,
        "changed_by": l.changed_by,
        "changed_by_name": l.changed_by_name,
        "note": l.note,
        "created_at": l.created_at.isoformat() if l.created_at else None,
    }
