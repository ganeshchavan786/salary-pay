from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
from datetime import datetime

from app.database import get_db
from app.models.salary_audit_log import SalaryAuditLog
from app.models.user import User
from app.utils.deps import get_current_user

router = APIRouter(tags=["Salary Audit"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class AuditLogResponse(BaseModel):
    id: str
    entity_type: str
    entity_id: str
    operation: str
    old_values: Optional[Any] = None
    new_values: Optional[Any] = None
    changed_fields: Optional[Any] = None
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    ip_address: Optional[str] = None
    record_hash: Optional[str] = None
    previous_hash: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[AuditLogResponse])
async def search_audit_logs(
    entity_type: Optional[str] = Query(None, description="Filter by entity type (e.g. SALARY_CALCULATION)"),
    entity_id: Optional[str] = Query(None, description="Filter by entity ID"),
    user_id: Optional[str] = Query(None, description="Filter by user who performed the action"),
    operation: Optional[str] = Query(None, description="Filter by operation (create/update/delete/calculate/approve/lock)"),
    date_from: Optional[datetime] = Query(None, description="Filter logs from this datetime (ISO 8601)"),
    date_to: Optional[datetime] = Query(None, description="Filter logs up to this datetime (ISO 8601)"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    offset: int = Query(0, ge=0, description="Number of records to skip"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[AuditLogResponse]:
    """
    Search salary audit logs with optional filters.
    Results are ordered by timestamp descending (most recent first).
    """
    conditions = []

    if entity_type:
        conditions.append(SalaryAuditLog.entity_type == entity_type)
    if entity_id:
        conditions.append(SalaryAuditLog.entity_id == entity_id)
    if user_id:
        conditions.append(SalaryAuditLog.user_id == user_id)
    if operation:
        conditions.append(SalaryAuditLog.operation == operation)
    if date_from:
        conditions.append(SalaryAuditLog.timestamp >= date_from)
    if date_to:
        conditions.append(SalaryAuditLog.timestamp <= date_to)

    query = select(SalaryAuditLog).order_by(SalaryAuditLog.timestamp.desc())
    if conditions:
        query = query.where(and_(*conditions))
    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    logs = result.scalars().all()

    return [AuditLogResponse.model_validate(log) for log in logs]


@router.get("/{log_id}", response_model=AuditLogResponse)
async def get_audit_log(
    log_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AuditLogResponse:
    """Get a single salary audit log entry by ID."""
    result = await db.execute(select(SalaryAuditLog).where(SalaryAuditLog.id == log_id))
    log = result.scalar_one_or_none()

    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audit log entry not found.")

    return AuditLogResponse.model_validate(log)
