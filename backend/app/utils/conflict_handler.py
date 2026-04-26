"""
Shared conflict detection and resolution utility for attendance write operations.

This module centralizes all conflict detection, audit log creation, and overwrite
logic used by manual entry, bulk save, and sync endpoints.
"""
from enum import Enum
from typing import Optional
from datetime import datetime, date
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance_daily import AttendanceDaily, AttendanceStatus
from app.models.audit_log import AuditLog


class ConflictMode(str, Enum):
    """Conflict resolution strategy for attendance writes."""
    BLOCK = "block"
    OVERWRITE = "overwrite"
    SKIP = "skip"


async def detect_conflict(
    db: AsyncSession,
    emp_id: str,
    date: date
) -> Optional[AttendanceDaily]:
    """
    Detect if an AttendanceDaily record already exists for (emp_id, date).
    
    Args:
        db: Async database session
        emp_id: Employee UUID
        date: Attendance date
        
    Returns:
        Existing AttendanceDaily record if found, None otherwise
    """
    stmt = select(AttendanceDaily).where(
        AttendanceDaily.emp_id == emp_id,
        AttendanceDaily.date == date
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def write_audit_log(
    db: AsyncSession,
    *,
    record_id: str,
    emp_id: str,
    action: str,
    field_name: str,
    old_value: Optional[str],
    new_value: str,
    changed_by: str,
    changed_by_name: str,
    note: Optional[str] = None
) -> AuditLog:
    """
    Create an audit log entry for an attendance write operation.
    
    The entry is added to the session but NOT committed. The caller is
    responsible for committing the transaction.
    
    Args:
        db: Async database session
        record_id: AttendanceDaily record UUID
        emp_id: Employee UUID
        action: "INSERT" or "UPDATE"
        field_name: Name of the field being changed (typically "status")
        old_value: Previous value (None for INSERT)
        new_value: New value
        changed_by: User UUID who made the change
        changed_by_name: User's display name
        note: Optional reason or note for the change
        
    Returns:
        The created AuditLog instance (not yet committed)
    """
    audit_entry = AuditLog(
        id=str(uuid.uuid4()),
        table_name="attendance_daily",
        record_id=record_id,
        emp_id=emp_id,
        action=action,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value,
        changed_by=changed_by,
        changed_by_name=changed_by_name,
        note=note,
        created_at=datetime.utcnow()
    )
    db.add(audit_entry)
    return audit_entry


async def apply_overwrite(
    db: AsyncSession,
    existing_record: AttendanceDaily,
    new_data: dict,
    current_user,  # Can be dict or User object
    override_note: Optional[str] = None
) -> AttendanceDaily:
    """
    Update an existing AttendanceDaily record with new data and mark as overridden.
    
    This function:
    1. Captures the old status value
    2. Updates the record fields from new_data
    3. Sets is_overridden=True, override_by, override_note
    4. Writes an audit log entry with action="UPDATE"
    5. Does NOT commit - caller is responsible for commit
    
    Args:
        db: Async database session
        existing_record: The AttendanceDaily record to update
        new_data: Dictionary with new field values (status, check_in, check_out, etc.)
        current_user: Dict with 'id' and 'name' keys OR User object with id and username/full_name
        override_note: Optional reason for the override
        
    Returns:
        The updated AttendanceDaily record (not yet committed)
    """
    # Extract user_id and user_name from current_user (dict or object)
    if isinstance(current_user, dict):
        user_id = current_user["id"]
        user_name = current_user["name"]
    else:
        user_id = current_user.id
        user_name = getattr(current_user, "full_name", None) or getattr(current_user, "username", str(current_user.id))
    
    # Capture old status for audit log
    old_status = existing_record.status.value if existing_record.status else None
    
    # Update record fields
    if "status" in new_data:
        existing_record.status = new_data["status"]
    if "check_in" in new_data:
        existing_record.check_in = new_data["check_in"]
    if "check_out" in new_data:
        existing_record.check_out = new_data["check_out"]
    if "late_mark_type" in new_data:
        existing_record.late_mark_type = new_data["late_mark_type"]
    if "is_late_mark" in new_data:
        existing_record.is_late_mark = new_data["is_late_mark"]
    if "is_half_late_mark" in new_data:
        existing_record.is_half_late_mark = new_data["is_half_late_mark"]
    if "is_half_day" in new_data:
        existing_record.is_half_day = new_data["is_half_day"]
    
    # Mark as overridden
    existing_record.is_overridden = True
    existing_record.override_by = user_id
    existing_record.override_note = override_note or "Manual HR Overwrite"
    existing_record.updated_at = datetime.utcnow()
    
    # Write audit log
    new_status = new_data.get("status").value if "status" in new_data else existing_record.status.value
    await write_audit_log(
        db,
        record_id=existing_record.id,
        emp_id=existing_record.emp_id,
        action="UPDATE",
        field_name="status",
        old_value=old_status,
        new_value=new_status,
        changed_by=user_id,
        changed_by_name=user_name,
        note=existing_record.override_note
    )
    
    return existing_record
