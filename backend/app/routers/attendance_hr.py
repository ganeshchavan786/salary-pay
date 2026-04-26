from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Optional
from datetime import date, datetime, time
import uuid
import calendar

from app.database import get_db
from app.models.attendance_daily import AttendanceDaily, AttendanceStatus, LateMarkType
from app.models.audit_log import AuditLog
from app.models.employee import Employee
from app.models.user import User
from app.schemas.attendance_hr import (
    ManualAttendanceRequest,
    AttendanceOverrideRequest,
    ConflictResponse,
    ManualEntryResponse,
    AttendanceDailyResponse,
)
from app.services.payroll_service import calculate_late_mark_type
from app.utils.conflict_handler import ConflictMode, detect_conflict, apply_overwrite, write_audit_log
from app.utils.deps import get_current_user, require_supervisor
from app.utils.period_lock_validator import check_date_in_locked_period, raise_locked_period_error

router = APIRouter(tags=["Attendance HR"])


@router.post("/manual", status_code=201)
async def manual_attendance_entry(
    data: ManualAttendanceRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Create or update a daily attendance record (HR manual entry).

    - No conflict: INSERT new record, return HTTP 201 with action="created".
    - Conflict + conflict_mode=BLOCK (default): return HTTP 409 with ConflictResponse.
    - Conflict + conflict_mode=OVERWRITE: UPDATE existing record, return HTTP 200 with action="updated".
    """
    # Validate employee
    emp_result = await db.execute(select(Employee).where(Employee.id == data.emp_id))
    emp = emp_result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found.")

    # Check if date falls within a LOCKED payroll period (BEFORE conflict detection)
    locked_period = await check_date_in_locked_period(db, data.date)
    if locked_period:
        raise_locked_period_error(locked_period)

    # Detect conflict using shared utility
    existing = await detect_conflict(db, data.emp_id, data.date)

    if existing:
        if data.conflict_mode == ConflictMode.OVERWRITE:
            # Build new_data dict for apply_overwrite
            check_in_dt = datetime.combine(data.date, data.check_in) if data.check_in else None
            check_out_dt = datetime.combine(data.date, data.check_out) if data.check_out else None

            late_mark = LateMarkType.NONE
            is_late = False
            is_half_late = False
            is_half_day_flag = False
            if data.check_in and data.status in (AttendanceStatus.PRESENT, AttendanceStatus.HALFDAY):
                late_mark = calculate_late_mark_type(data.check_in)
                is_late = late_mark == LateMarkType.LATE
                is_half_late = late_mark == LateMarkType.HALF_LATE
                is_half_day_flag = late_mark == LateMarkType.HALF_DAY

            new_data = {
                "check_in": check_in_dt,
                "check_out": check_out_dt,
                "status": data.status,
                "late_mark_type": late_mark,
                "is_late_mark": is_late,
                "is_half_late_mark": is_half_late,
                "is_half_day": is_half_day_flag,
            }

            updated_record = await apply_overwrite(
                db,
                existing_record=existing,
                new_data=new_data,
                current_user=current_user,
                override_note=data.override_note or "Manual HR Overwrite",
            )
            await db.commit()

            response_body = ManualEntryResponse(
                message="Attendance updated.",
                action="updated",
                record=AttendanceDailyResponse.model_validate(updated_record),
            )
            return JSONResponse(status_code=200, content=response_body.model_dump(mode="json"))

        else:
            # BLOCK mode (default) — return 409 with conflict details
            conflict_body = ConflictResponse(
                conflict=True,
                message=f"An attendance record already exists for employee {data.emp_id} on {data.date}.",
                existing_record=AttendanceDailyResponse.model_validate(existing),
            )
            raise HTTPException(
                status_code=409,
                detail=conflict_body.model_dump(mode="json"),
            )

    # No conflict — create new record
    check_in_dt = datetime.combine(data.date, data.check_in) if data.check_in else None
    check_out_dt = datetime.combine(data.date, data.check_out) if data.check_out else None

    late_mark = LateMarkType.NONE
    is_late = False
    is_half_late = False
    is_half_day_flag = False
    if data.check_in and data.status in (AttendanceStatus.PRESENT, AttendanceStatus.HALFDAY):
        late_mark = calculate_late_mark_type(data.check_in)
        is_late = late_mark == LateMarkType.LATE
        is_half_late = late_mark == LateMarkType.HALF_LATE
        is_half_day_flag = late_mark == LateMarkType.HALF_DAY

    record = AttendanceDaily(
        id=str(uuid.uuid4()),
        emp_id=data.emp_id,
        date=data.date,
        check_in=check_in_dt,
        check_out=check_out_dt,
        status=data.status,
        late_mark_type=late_mark,
        is_late_mark=is_late,
        is_half_late_mark=is_half_late,
        is_half_day=is_half_day_flag,
        is_overridden=True,
        override_by=current_user.id,
        override_note=data.override_note or "Manual HR Entry",
    )
    db.add(record)
    await db.flush()

    changer_name = getattr(current_user, "username", None) or str(current_user.id)
    await write_audit_log(
        db,
        record_id=record.id,
        emp_id=data.emp_id,
        action="INSERT",
        field_name="status",
        old_value=None,
        new_value=data.status.value,
        changed_by=current_user.id,
        changed_by_name=changer_name,
        note=data.override_note or "Manual HR Entry",
    )
    await db.commit()

    response_body = ManualEntryResponse(
        message="Attendance added.",
        action="created",
        record=AttendanceDailyResponse.model_validate(record),
    )
    return JSONResponse(status_code=201, content=response_body.model_dump(mode="json"))


@router.get("/daily/report/monthly")
async def monthly_report(
    month: int = Query(default=None),
    year: int = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Monthly attendance report for all employees."""
    now = datetime.utcnow()
    m = month or now.month
    y = year or now.year
    from_date = date(y, m, 1)
    last_day = calendar.monthrange(y, m)[1]
    to_date = date(y, m, last_day)

    emp_result = await db.execute(select(Employee))
    employees = emp_result.scalars().all()

    report = []
    for emp in employees:
        att_result = await db.execute(
            select(AttendanceDaily).where(
                and_(
                    AttendanceDaily.emp_id == emp.id,
                    AttendanceDaily.date >= from_date,
                    AttendanceDaily.date <= to_date,
                )
            )
        )
        records = att_result.scalars().all()
        report.append({
            "employee": {"id": emp.id, "name": emp.name, "code": emp.emp_code, "department": emp.department},
            "present": sum(1 for r in records if r.status == AttendanceStatus.PRESENT),
            "absent": sum(1 for r in records if r.status == AttendanceStatus.ABSENT),
            "halfday": sum(1 for r in records if r.status == AttendanceStatus.HALFDAY),
            "late_mark": sum(1 for r in records if r.is_late_mark),
            "half_late_mark": sum(1 for r in records if r.is_half_late_mark),
        })
    return {"month": m, "year": y, "report": report}


@router.get("/daily/{emp_id}")
async def get_daily_attendance(
    emp_id: str,
    month: int = Query(default=None),
    year: int = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Get monthly daily attendance records for an employee."""
    now = datetime.utcnow()
    m = month or now.month
    y = year or now.year
    from_date = date(y, m, 1)
    last_day = calendar.monthrange(y, m)[1]
    to_date = date(y, m, last_day)

    result = await db.execute(
        select(AttendanceDaily, Employee)
        .join(Employee, AttendanceDaily.emp_id == Employee.id)
        .where(
            and_(
                AttendanceDaily.emp_id == emp_id,
                AttendanceDaily.date >= from_date,
                AttendanceDaily.date <= to_date,
            )
        )
        .order_by(AttendanceDaily.date)
    )
    rows = result.all()
    records = []
    for att, emp in rows:
        d = _att_to_dict(att)
        d["emp_name"] = emp.name
        d["emp_code"] = emp.emp_code
        records.append(d)

    summary = {
        "present": sum(1 for r in records if r["status"] == "present"),
        "absent": sum(1 for r in records if r["status"] == "absent"),
        "halfday": sum(1 for r in records if r["status"] == "halfday"),
        "late_mark": sum(1 for r in records if r["is_late_mark"]),
        "half_late_mark": sum(1 for r in records if r["is_half_late_mark"]),
    }
    return {"records": records, "summary": summary}


@router.put("/daily/{record_id}/override")
async def override_attendance(
    record_id: str,
    data: AttendanceOverrideRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Override attendance status with audit log."""
    result = await db.execute(select(AttendanceDaily).where(AttendanceDaily.id == record_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found.")

    old_status = record.status.value if record.status else "absent"
    record.status = data.status
    record.is_overridden = True
    record.override_by = current_user.id
    record.override_note = data.note or "HR Override"
    record.updated_at = datetime.utcnow()

    changer_name = getattr(current_user, 'username', None) or str(current_user.id)
    audit = AuditLog(
        id=str(uuid.uuid4()),
        table_name="attendance_daily",
        record_id=record_id,
        emp_id=record.emp_id,
        action="UPDATE",
        field_name="status",
        old_value=old_status,
        new_value=data.status.value,
        changed_by=current_user.id,
        changed_by_name=changer_name,
        note=data.note or "Status changed via override",
        created_at=datetime.utcnow(),
    )
    db.add(audit)
    await db.commit()
    return {"message": "Attendance updated.", "record": _att_to_dict(record)}


@router.get("/daily/{record_id}/audit")
async def get_attendance_audit(
    record_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Get audit history for one attendance record."""
    result = await db.execute(
        select(AuditLog).where(
            and_(AuditLog.table_name == "attendance_daily", AuditLog.record_id == record_id)
        ).order_by(AuditLog.created_at.desc())
    )
    logs = result.scalars().all()
    return {"logs": [_audit_to_dict(l) for l in logs]}


def _att_to_dict(a: AttendanceDaily) -> dict:
    return {
        "id": a.id,
        "emp_id": a.emp_id,
        "date": a.date.isoformat() if a.date else None,
        "check_in": a.check_in.isoformat() if a.check_in else None,
        "check_out": a.check_out.isoformat() if a.check_out else None,
        "status": a.status.value if a.status else "absent",
        "late_mark_type": a.late_mark_type.value if a.late_mark_type else "none",
        "is_late_mark": a.is_late_mark or False,
        "is_half_late_mark": a.is_half_late_mark or False,
        "is_half_day": a.is_half_day or False,
        "is_overridden": a.is_overridden or False,
        "override_note": a.override_note,
    }


def _audit_to_dict(l: AuditLog) -> dict:
    return {
        "id": l.id,
        "action": l.action,
        "field_name": l.field_name,
        "old_value": l.old_value,
        "new_value": l.new_value,
        "changed_by_name": l.changed_by_name,
        "note": l.note,
        "created_at": l.created_at.isoformat() if l.created_at else None,
    }


# ─── Missed Punch Regularization ────────────────────────────────────────────

from sqlalchemy import func, extract
from app.models.missed_punch import MissedPunchRequest, MissedPunchStatus
from app.schemas.missed_punch import MissedPunchCreate, MissedPunchRead, MissedPunchReject
from app.services import policy_service as _policy_svc


@router.post("/missed-punch", response_model=MissedPunchRead, status_code=201)
async def submit_missed_punch(
    data: MissedPunchCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Employee submits a missed punch regularization request."""
    if not current_user.emp_id:
        raise HTTPException(status_code=400, detail="User is not linked to an employee")

    policy = await _policy_svc.get_policy(db)
    limit = policy.missed_punch_requests_per_month

    today = date.today()
    count_result = await db.execute(
        select(func.count(MissedPunchRequest.id)).where(
            and_(
                MissedPunchRequest.emp_id == current_user.emp_id,
                extract("year", MissedPunchRequest.created_at) == today.year,
                extract("month", MissedPunchRequest.created_at) == today.month,
            )
        )
    )
    count = count_result.scalar() or 0
    if count >= limit:
        raise HTTPException(status_code=400, detail="Monthly missed punch request limit reached")

    req = MissedPunchRequest(
        id=str(uuid.uuid4()),
        emp_id=current_user.emp_id,
        date=data.date,
        requested_check_in=data.requested_check_in,
        requested_check_out=data.requested_check_out,
        reason=data.reason,
        status=MissedPunchStatus.PENDING,
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return req


@router.get("/missed-punch", response_model=list[MissedPunchRead])
async def list_missed_punch(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """List all pending missed punch requests (supervisor/admin only)."""
    result = await db.execute(
        select(MissedPunchRequest)
        .where(MissedPunchRequest.status == MissedPunchStatus.PENDING)
        .order_by(MissedPunchRequest.created_at.desc())
    )
    return result.scalars().all()


@router.put("/missed-punch/{request_id}/approve", response_model=MissedPunchRead)
async def approve_missed_punch(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Approve a missed punch request and update attendance_daily."""
    result = await db.execute(
        select(MissedPunchRequest).where(MissedPunchRequest.id == request_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Missed punch request not found")
    if req.status != MissedPunchStatus.PENDING:
        raise HTTPException(status_code=400, detail="Request has already been processed")

    # Update attendance_daily if record exists
    att_result = await db.execute(
        select(AttendanceDaily).where(
            and_(
                AttendanceDaily.emp_id == req.emp_id,
                AttendanceDaily.date == req.date,
            )
        )
    )
    att = att_result.scalar_one_or_none()
    if att:
        if req.requested_check_in:
            h, m = req.requested_check_in.split(":")
            att.check_in = datetime(req.date.year, req.date.month, req.date.day, int(h), int(m))
        if req.requested_check_out:
            h, m = req.requested_check_out.split(":")
            att.check_out = datetime(req.date.year, req.date.month, req.date.day, int(h), int(m))
        att.updated_at = datetime.utcnow()
        db.add(att)

    req.status = MissedPunchStatus.APPROVED
    req.approved_by = current_user.id
    req.updated_at = datetime.utcnow()
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return req


@router.put("/missed-punch/{request_id}/reject", response_model=MissedPunchRead)
async def reject_missed_punch(
    request_id: str,
    body: MissedPunchReject,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Reject a missed punch request."""
    result = await db.execute(
        select(MissedPunchRequest).where(MissedPunchRequest.id == request_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Missed punch request not found")
    if req.status != MissedPunchStatus.PENDING:
        raise HTTPException(status_code=400, detail="Request has already been processed")

    req.status = MissedPunchStatus.REJECTED
    req.approved_by = current_user.id
    req.updated_at = datetime.utcnow()
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return req


# ─── Consecutive Absence Alerts ─────────────────────────────────────────────

from datetime import timedelta


@router.get("/absence-alerts")
async def get_absence_alerts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Return employees with consecutive absences >= policy threshold."""
    from app.models.employee import EmployeeStatus

    policy = await _policy_svc.get_policy(db)
    threshold = policy.consecutive_absent_threshold

    emp_result = await db.execute(
        select(Employee).where(Employee.status == EmployeeStatus.ACTIVE)
    )
    employees = emp_result.scalars().all()

    alerts = []
    cutoff = date.today() - timedelta(days=60)

    for emp in employees:
        att_result = await db.execute(
            select(AttendanceDaily).where(
                and_(
                    AttendanceDaily.emp_id == emp.id,
                    AttendanceDaily.date >= cutoff,
                )
            ).order_by(AttendanceDaily.date.desc())
        )
        records = att_result.scalars().all()

        streak = 0
        start_date = None
        for rec in records:
            if rec.status == AttendanceStatus.ABSENT:
                streak += 1
                start_date = rec.date
            else:
                break

        if streak >= threshold:
            alerts.append({
                "emp_id": emp.id,
                "emp_name": emp.name,
                "emp_code": emp.emp_code,
                "start_date": str(start_date),
                "consecutive_days": streak,
            })

    return {"alerts": alerts, "threshold": threshold}
