from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from typing import Optional, List, Literal
from datetime import date, datetime, time
import calendar as cal_module
import uuid
import logging

from app.database import get_db, AsyncSessionLocal
from app.models.attendance import Attendance, SyncStatus, AttendanceType
from app.models.attendance_daily import AttendanceDaily, AttendanceStatus, LateMarkType
from app.models.employee import Employee, EmployeeStatus
from app.models.holiday import Holiday
from app.models.leave import Leave, LeaveStatus
from app.models.user import User
from app.schemas.attendance import (
    AttendanceSyncRequest, AttendanceSyncResponse,
    SyncResult, AttendanceResponse,
    BulkSaveRequest, BulkSaveResponse, BulkRecordOutcome, BulkSaveSummary,
    WorkingDaysResponse, ExcludedDate,
    MonthlyAllResponse, EmployeeMonthlyData, EmployeeMonthlySummary, DailyRecord,
    StatsResponse,
)
from app.utils.deps import get_current_user, require_supervisor
from app.utils.conflict_handler import ConflictMode, detect_conflict, write_audit_log, apply_overwrite
from app.services.payroll_service import calculate_late_mark_type, calculate_working_days, is_second_or_fourth_saturday
from app.services import attendance_service
from app.services.payroll_recalculation_service import recalculate_payroll_record
from app.utils.period_lock_validator import check_date_in_locked_period, raise_locked_period_error

router = APIRouter(tags=["Attendance"])
logger = logging.getLogger(__name__)


async def sync_to_daily_for_date(target_date: date, emp_ids: Optional[List[str]] = None):
    """
    Background task: sync all raw attendance punches → attendance_daily table.
    Calculates cumulative working hours for multi-punch (breaks).
    """
    async with AsyncSessionLocal() as db:
        try:
            # Fetch ALL records for the day, ordered by time
            query = select(Attendance).where(Attendance.date == target_date).order_by(Attendance.emp_id, Attendance.time)
            if emp_ids:
                query = query.where(Attendance.emp_id.in_(emp_ids))
            
            result = await db.execute(query)
            all_punches = result.scalars().all()

            # Group punches by employee
            emp_punches = {}
            for p in all_punches:
                if p.emp_id not in emp_punches:
                    emp_punches[p.emp_id] = []
                emp_punches[p.emp_id].append(p)

            synced = 0
            skipped = 0

            for emp_id, punches in emp_punches.items():
                # Check if existing daily record is overridden
                existing_result = await db.execute(
                    select(AttendanceDaily).where(
                        and_(
                            AttendanceDaily.emp_id == emp_id,
                            AttendanceDaily.date == target_date,
                        )
                    )
                )
                existing = existing_result.scalar_one_or_none()

                if existing and existing.is_overridden:
                    skipped += 1
                    continue

                total_seconds = 0.0
                first_in = None
                last_out = None
                current_in_time = None

                for p in punches:
                    p_datetime = datetime.combine(target_date, p.time)
                    
                    if p.attendance_type == AttendanceType.CHECK_IN:
                        if first_in is None:
                            first_in = p_datetime
                        current_in_time = p_datetime
                    
                    elif p.attendance_type == AttendanceType.CHECK_OUT:
                        last_out = p_datetime
                        if current_in_time:
                            diff = (p_datetime - current_in_time).total_seconds()
                            if diff > 0:
                                total_seconds += diff
                            current_in_time = None # Reset for next pair

                total_hours = round(total_seconds / 3600, 2)
                
                # Late mark based on first check-in
                late_mark = LateMarkType.NONE
                if first_in:
                    late_mark = calculate_late_mark_type(first_in.time())
                
                is_late = late_mark == LateMarkType.LATE
                is_half_late = late_mark == LateMarkType.HALF_LATE
                is_half_day = late_mark == LateMarkType.HALF_DAY
                status = AttendanceStatus.HALFDAY if is_half_day else AttendanceStatus.PRESENT

                if existing:
                    existing.check_in = first_in
                    existing.check_out = last_out
                    existing.total_working_hours = total_hours
                    existing.status = status
                    existing.late_mark_type = late_mark
                    existing.is_late_mark = is_late
                    existing.is_half_late_mark = is_half_late
                    existing.is_half_day = is_half_day
                    existing.updated_at = datetime.utcnow()
                else:
                    db.add(AttendanceDaily(
                        id=str(uuid.uuid4()),
                        emp_id=emp_id,
                        date=target_date,
                        check_in=first_in,
                        check_out=last_out,
                        total_working_hours=total_hours,
                        status=status,
                        late_mark_type=late_mark,
                        is_late_mark=is_late,
                        is_half_late_mark=is_half_late,
                        is_half_day=is_half_day,
                        is_overridden=False,
                    ))
                synced += 1

            await db.commit()
            return {"synced": synced, "skipped": skipped}
        except Exception as e:
            await db.rollback()
            logger.error(f"[sync_to_daily] Error for {target_date}: {e}")
            return {"synced": 0, "skipped": 0}


@router.post("/sync", response_model=AttendanceSyncResponse)
async def sync_attendance(
    sync_data: AttendanceSyncRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    results = []
    synced = 0
    failed = 0
    duplicates = 0
    
    for record in sync_data.records:
        try:
            emp_result = await db.execute(
                select(Employee).where(Employee.id == record.emp_id)
            )
            employee = emp_result.scalar_one_or_none()
            
            if not employee:
                results.append(SyncResult(
                    local_id=record.local_id,
                    status="failed",
                    error="Employee not found"
                ))
                failed += 1
                continue
            
            # Check for duplicate - same employee, same date, same type
            existing = await db.execute(
                select(Attendance).where(
                    and_(
                        Attendance.emp_id == record.emp_id,
                        Attendance.date == record.date,
                        Attendance.attendance_type == record.attendance_type.value
                    )
                )
            )
            if existing.scalar_one_or_none():
                results.append(SyncResult(
                    local_id=record.local_id,
                    status="duplicate",
                    error=f"{record.attendance_type.value} already exists for this date"
                ))
                duplicates += 1
                continue
            
            attendance = Attendance(
                local_id=record.local_id,
                emp_id=record.emp_id,
                attendance_type=AttendanceType(record.attendance_type.value),
                date=record.date,
                time=record.time,
                latitude=record.latitude,
                longitude=record.longitude,
                device_id=sync_data.device_id,
                photo=record.photo,
                sync_status=SyncStatus.SYNCED,
                synced_at=datetime.utcnow()
            )
            
            db.add(attendance)
            await db.flush()
            
            results.append(SyncResult(
                local_id=record.local_id,
                server_id=attendance.id,
                status="synced"
            ))
            synced += 1
            
        except Exception as e:
            results.append(SyncResult(
                local_id=record.local_id,
                status="failed",
                error=str(e)
            ))
            failed += 1
    
    await db.commit()
    
    # Trigger background sync to attendance_daily for each unique date
    unique_dates = list({record.date for record in sync_data.records})
    for sync_date in unique_dates:
        background_tasks.add_task(sync_to_daily_for_date, sync_date)

    # Determine overall status based on design requirements:
    # - All synced (no failures, no duplicates) → "success"
    # - All failed (no synced, no duplicates) → "failed"
    # - All duplicates (no synced, no failures) → "partial"
    # - Mixed results → "partial"
    if synced > 0 and failed == 0 and duplicates == 0:
        overall_status = "success"
    elif failed > 0 and synced == 0 and duplicates == 0:
        overall_status = "failed"
    else:
        # Any mix of results, including all-duplicates case
        overall_status = "partial"
    
    return AttendanceSyncResponse(
        status=overall_status,
        synced=synced,
        failed=failed,
        duplicates=duplicates,
        results=results
    )


@router.get("", response_model=dict)
async def list_attendance(
    start_date: date = Query(...),
    end_date: date = Query(...),
    emp_id: Optional[str] = None,
    department: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor)
):
    query = select(Attendance, Employee).join(Employee, Attendance.emp_id == Employee.id)
    count_query = select(func.count(Attendance.id)).join(Employee, Attendance.emp_id == Employee.id)
    
    query = query.where(and_(
        Attendance.date >= start_date,
        Attendance.date <= end_date
    ))
    count_query = count_query.where(and_(
        Attendance.date >= start_date,
        Attendance.date <= end_date
    ))
    
    if emp_id:
        query = query.where(Attendance.emp_id == emp_id)
        count_query = count_query.where(Attendance.emp_id == emp_id)
    
    if department:
        query = query.where(Employee.department == department)
        count_query = count_query.where(Employee.department == department)
    
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    query = query.order_by(Attendance.date.desc(), Attendance.time.desc())
    query = query.offset((page - 1) * limit).limit(limit)
    
    result = await db.execute(query)
    records = result.all()
    
    attendance_list = []
    for att, emp in records:
        attendance_list.append({
            "id": att.id,
            "emp_id": att.emp_id,
            "emp_code": emp.emp_code,
            "emp_name": emp.name,
            "attendance_type": att.attendance_type.value if att.attendance_type else "CHECK_IN",
            "date": att.date.isoformat(),
            "time": att.time.isoformat(),
            "latitude": att.latitude,
            "longitude": att.longitude,
            "device_id": att.device_id,
            "photo": att.photo,
            "created_at": att.created_at.isoformat()
        })
    
    return {
        "records": attendance_list,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit if total > 0 else 0
    }


@router.get("/my", response_model=dict)
async def get_my_attendance(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fetch attendance history for the currently logged-in employee."""
    if not current_user.emp_id:
        return {"records": [], "total": 0, "page": page, "limit": limit, "pages": 0}
    
    # Find ALL employee IDs that belong to this user (by emp_code match)
    emp_result = await db.execute(select(Employee).where(Employee.id == current_user.emp_id))
    emp = emp_result.scalar_one_or_none()
    
    # Collect all possible emp_ids to search for
    emp_ids = [current_user.emp_id]
    if emp:
        # Also find any other employee records with same emp_code
        all_emp_result = await db.execute(select(Employee.id).where(Employee.emp_code == emp.emp_code))
        emp_ids = list(set(emp_ids + [r[0] for r in all_emp_result.all()]))
        
        # Also find orphan emp_ids from other users whose username matches this emp_code
        # (handles case where 'emp001' user submitted attendance with a different emp_id)
        from sqlalchemy import or_
        other_users = await db.execute(
            select(User.emp_id).where(
                and_(
                    User.emp_id.isnot(None),
                    or_(
                        func.lower(func.trim(User.username)) == emp.emp_code.lower().strip(),
                        func.lower(func.trim(User.username)) == (emp.email or "").lower().strip(),
                    )
                )
            )
        )
        for row in other_users.all():
            if row[0] and row[0] not in emp_ids:
                emp_ids.append(row[0])
    
    # Query attendance for all matching emp_ids
    query = select(Attendance).where(Attendance.emp_id.in_(emp_ids))
    count_query = select(func.count(Attendance.id)).where(Attendance.emp_id.in_(emp_ids))
    
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    query = query.order_by(Attendance.date.desc(), Attendance.time.desc())
    query = query.offset((page - 1) * limit).limit(limit)
    
    result = await db.execute(query)
    records = result.scalars().all()
    
    attendance_list = []
    for att in records:
        # Try to get employee info
        emp_name = emp.name if emp else current_user.username
        emp_code = emp.emp_code if emp else ""
        
        attendance_list.append({
            "id": att.id,
            "emp_id": att.emp_id,
            "emp_code": emp_code,
            "emp_name": emp_name,
            "attendance_type": att.attendance_type.value if att.attendance_type else "CHECK_IN",
            "date": att.date.isoformat(),
            "time": att.time.isoformat(),
            "latitude": att.latitude,
            "longitude": att.longitude,
            "device_id": att.device_id,
            "photo": att.photo,
            "created_at": att.created_at.isoformat()
        })
    
    return {
        "records": attendance_list,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit if total > 0 else 0
    }

@router.get("/summary")
async def attendance_summary(
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor)
):
    """
    Get attendance summary for a date range.
    Returns zero counts when no attendance records exist.
    """
    logger.info(f"Attendance summary requested by user {current_user.id} for {start_date} to {end_date}")
    
    total_employees = await db.execute(select(func.count(Employee.id)))
    total_emp_count = total_employees.scalar()
    
    present_query = select(func.count(func.distinct(Attendance.emp_id))).where(
        and_(
            Attendance.date >= start_date,
            Attendance.date <= end_date
        )
    )
    present_result = await db.execute(present_query)
    present_count = present_result.scalar()
    
    total_attendance = await db.execute(
        select(func.count(Attendance.id)).where(
            and_(
                Attendance.date >= start_date,
                Attendance.date <= end_date
            )
        )
    )
    total_att_count = total_attendance.scalar()
    
    # Ensure all fields are present even when counts are zero
    response = {
        "total_employees": total_emp_count or 0,
        "employees_present": present_count or 0,
        "total_attendance_records": total_att_count or 0,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat()
    }
    
    logger.info(f"Attendance summary response: {response}")
    return response


from pydantic import BaseModel as _BaseModel

class SyncToDailyRequest(_BaseModel):
    date: date
    emp_ids: Optional[List[str]] = None


@router.post("/sync-to-daily")
async def manual_sync_to_daily(
    data: SyncToDailyRequest,
    current_user: User = Depends(require_supervisor),
):
    """Manually trigger sync of raw attendance records to attendance_daily table."""
    result = await sync_to_daily_for_date(data.date, data.emp_ids)
    return {
        "message": f"Sync complete for {data.date}",
        "synced": result.get("synced", 0),
        "skipped": result.get("skipped", 0),
    }


# ─── Advanced Attendance Endpoints ──────────────────────────────────────────

@router.post("/bulk-save", response_model=BulkSaveResponse)
async def bulk_save_attendance(
    data: BulkSaveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Batch upsert attendance records for one employee's month in a single transaction."""
    # Validate employee exists
    emp_result = await db.execute(select(Employee).where(Employee.id == data.emp_id))
    employee = emp_result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Check if ANY date in the bulk request falls within a LOCKED period (BEFORE processing)
    for record in data.records:
        locked_period = await check_date_in_locked_period(db, record.date)
        if locked_period:
            raise_locked_period_error(locked_period)

    outcomes: list = []

    try:
        for record in data.records:
            try:
                # Parse check_in / check_out from "HH:MM" string to datetime
                check_in_dt: Optional[datetime] = None
                check_out_dt: Optional[datetime] = None

                if record.check_in:
                    try:
                        t = time(*[int(x) for x in record.check_in.split(":")])
                        check_in_dt = datetime(
                            record.date.year, record.date.month, record.date.day,
                            t.hour, t.minute
                        )
                    except (ValueError, AttributeError):
                        check_in_dt = None

                if record.check_out:
                    try:
                        t = time(*[int(x) for x in record.check_out.split(":")])
                        check_out_dt = datetime(
                            record.date.year, record.date.month, record.date.day,
                            t.hour, t.minute
                        )
                    except (ValueError, AttributeError):
                        check_out_dt = None

                # Calculate late mark flags
                late_mark_type = LateMarkType.NONE
                if check_in_dt and record.status in (
                    AttendanceStatus.PRESENT, AttendanceStatus.HALFDAY,
                ):
                    late_mark_type = calculate_late_mark_type(check_in_dt.time())

                is_late_mark = late_mark_type == LateMarkType.LATE
                is_half_late_mark = late_mark_type == LateMarkType.HALF_LATE
                is_half_day = (
                    record.status == AttendanceStatus.HALFDAY
                    or late_mark_type == LateMarkType.HALF_DAY
                )

                # Detect conflict
                existing = await detect_conflict(db, data.emp_id, record.date)

                if existing is None:
                    # No conflict — INSERT new record
                    new_record = AttendanceDaily(
                        id=str(uuid.uuid4()),
                        emp_id=data.emp_id,
                        date=record.date,
                        check_in=check_in_dt,
                        check_out=check_out_dt,
                        status=record.status,
                        late_mark_type=late_mark_type,
                        is_late_mark=is_late_mark,
                        is_half_late_mark=is_half_late_mark,
                        is_half_day=is_half_day,
                        is_overridden=False,
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow(),
                    )
                    db.add(new_record)
                    await db.flush()  # get the id assigned

                    await write_audit_log(
                        db,
                        record_id=new_record.id,
                        emp_id=data.emp_id,
                        action="INSERT",
                        field_name="status",
                        old_value=None,
                        new_value=record.status.value if hasattr(record.status, "value") else str(record.status),
                        changed_by=current_user.id,
                        changed_by_name=getattr(current_user, "full_name", None)
                            or getattr(current_user, "username", str(current_user.id)),
                        note=f"Bulk save — {data.month}/{data.year}",
                    )
                    outcomes.append(BulkRecordOutcome(date=record.date, outcome="created"))

                elif data.conflict_mode == ConflictMode.OVERWRITE:
                    # Conflict + OVERWRITE — update existing record
                    new_data = {
                        "check_in": check_in_dt,
                        "check_out": check_out_dt,
                        "status": record.status,
                        "late_mark_type": late_mark_type,
                        "is_late_mark": is_late_mark,
                        "is_half_late_mark": is_half_late_mark,
                        "is_half_day": is_half_day,
                    }
                    await apply_overwrite(
                        db,
                        existing_record=existing,
                        new_data=new_data,
                        current_user=current_user,
                        override_note=f"Bulk save overwrite — {data.month}/{data.year}",
                    )
                    outcomes.append(BulkRecordOutcome(date=record.date, outcome="updated"))

                else:
                    # Conflict + SKIP (or BLOCK treated as skip in bulk context)
                    outcomes.append(BulkRecordOutcome(date=record.date, outcome="skipped"))

            except Exception as e:
                # Per-record failure — log and continue
                outcomes.append(BulkRecordOutcome(
                    date=record.date,
                    outcome="failed",
                    detail=str(e),
                ))

        await db.commit()

        # Trigger payroll recalculation if any records were created or updated
        # Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3
        created_count = sum(1 for o in outcomes if o.outcome == "created")
        updated_count = sum(1 for o in outcomes if o.outcome == "updated")
        
        if created_count > 0 or updated_count > 0:
            # Query for a processed (but not paid) payroll record
            from app.models.payroll import Payroll, PayrollStatus
            payroll_result = await db.execute(
                select(Payroll).where(
                    and_(
                        Payroll.emp_id == data.emp_id,
                        Payroll.month == data.month,
                        Payroll.year == data.year,
                        Payroll.status == PayrollStatus.PROCESSED,
                    )
                )
            )
            payroll = payroll_result.scalar_one_or_none()
            
            if payroll:
                # Recalculate payroll record based on updated attendance
                await recalculate_payroll_record(db, payroll.id)

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Bulk save failed, transaction rolled back: {str(e)}",
        )

    # Build summary from outcome counts
    created_count = sum(1 for o in outcomes if o.outcome == "created")
    updated_count = sum(1 for o in outcomes if o.outcome == "updated")
    skipped_count = sum(1 for o in outcomes if o.outcome == "skipped")
    failed_count = sum(1 for o in outcomes if o.outcome == "failed")

    summary = BulkSaveSummary(
        created=created_count,
        updated=updated_count,
        skipped=skipped_count,
        failed=failed_count,
    )

    return BulkSaveResponse(
        emp_id=data.emp_id,
        month=data.month,
        year=data.year,
        conflict_mode=data.conflict_mode.value,
        summary=summary,
        records=outcomes,
        # Legacy fields for backward compatibility
        created=created_count,
        updated=updated_count,
        total=created_count + updated_count,
    )


@router.get("/working-days", response_model=WorkingDaysResponse)
async def get_working_days(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Calculate working days for a month, excluding Sundays, 2nd/4th Saturdays, and holidays."""
    from sqlalchemy import extract
    _, days_in_month = cal_module.monthrange(year, month)

    # Fetch active holidays for the month
    holiday_result = await db.execute(
        select(Holiday).where(
            and_(
                Holiday.year == year,
                Holiday.is_active == True,
                func.strftime("%m", Holiday.date) == f"{month:02d}",
            )
        )
    )
    holidays = holiday_result.scalars().all()
    holiday_dates = {h.date: h.name for h in holidays}

    # Build excluded dates list
    excluded = []
    for day in range(1, days_in_month + 1):
        d = date(year, month, day)
        if d.weekday() == 6:
            excluded.append(ExcludedDate(date=d, reason="Sunday"))
        elif is_second_or_fourth_saturday(d):
            excluded.append(ExcludedDate(date=d, reason="2nd/4th Saturday"))
        elif d in holiday_dates:
            excluded.append(ExcludedDate(date=d, reason="Holiday", name=holiday_dates[d]))

    working_days = calculate_working_days(year, month, list(holiday_dates.keys()))

    return WorkingDaysResponse(
        working_days=working_days,
        total_calendar_days=days_in_month,
        excluded=excluded,
    )


@router.get("/monthly-all")
async def get_monthly_all(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Return attendance data for all active employees for a full month with holiday/leave auto-marking."""
    from datetime import timedelta
    _, days_in_month = cal_module.monthrange(year, month)
    first_day = date(year, month, 1)
    last_day = date(year, month, days_in_month)

    # Fetch all active employees
    emp_result = await db.execute(
        select(Employee).where(Employee.status == EmployeeStatus.ACTIVE)
    )
    employees = emp_result.scalars().all()

    # Fetch all attendance_daily records for the month
    emp_ids = [e.id for e in employees]
    if emp_ids:
        att_result = await db.execute(
            select(AttendanceDaily).where(
                and_(
                    AttendanceDaily.emp_id.in_(emp_ids),
                    AttendanceDaily.date >= first_day,
                    AttendanceDaily.date <= last_day,
                )
            )
        )
        all_records = att_result.scalars().all()
    else:
        all_records = []

    # Group by emp_id → date
    records_by_emp = {}
    for rec in all_records:
        records_by_emp.setdefault(rec.emp_id, {})[rec.date] = rec

    # Fetch active holidays for working_days
    holiday_result = await db.execute(
        select(Holiday).where(
            and_(
                Holiday.year == year,
                Holiday.is_active == True,
                func.strftime("%m", Holiday.date) == f"{month:02d}",
            )
        )
    )
    holidays = holiday_result.scalars().all()
    holiday_date_list = [h.date for h in holidays]
    working_days = calculate_working_days(year, month, holiday_date_list)

    # Build response for each employee
    employees_data = []
    for emp in employees:
        emp_records = records_by_emp.get(emp.id, {})
        resolved = await attendance_service.apply_holiday_leave_automark(
            db=db, emp_id=emp.id, month=month, year=year, records=emp_records
        )

        days_list = []
        summary = {
            "present": 0, "absent": 0, "halfday": 0,
            "leave": 0, "holiday": 0, "weeklyoff": 0,
            "late_mark": 0, "half_late_mark": 0,
        }

        for day in range(1, days_in_month + 1):
            d = date(year, month, day)
            rec = resolved.get(d, {})
            status = rec.get("status", AttendanceStatus.ABSENT)
            late_mark_type = rec.get("late_mark_type", LateMarkType.NONE)
            check_in = rec.get("check_in")
            check_out = rec.get("check_out")

            days_list.append({
                "date": d,
                "status": status,
                "late_mark_type": late_mark_type,
                "check_in": check_in.strftime("%H:%M") if check_in else None,
                "check_out": check_out.strftime("%H:%M") if check_out else None,
                "total_working_hours": rec.get("total_working_hours", 0.0),
                "is_incomplete": rec.get("is_incomplete", False),
                "is_overridden": rec.get("is_overridden", False),
            })

            # Update summary
            status_key = status.value if hasattr(status, "value") else str(status)
            if status_key in summary:
                summary[status_key] += 1
            if late_mark_type in (LateMarkType.LATE, "late"):
                summary["late_mark"] += 1
            elif late_mark_type in (LateMarkType.HALF_LATE, "halfLate"):
                summary["half_late_mark"] += 1

        employees_data.append({
            "emp_id": emp.id,
            "name": emp.name,
            "emp_code": emp.emp_code,
            "department": emp.department,
            "days": days_list,
            "summary": summary,
        })

    return {
        "month": month,
        "year": year,
        "working_days": working_days,
        "employees": employees_data,
    }


@router.get("/export")
async def export_attendance(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    format: str = Query("csv"),
    emp_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Export attendance as day-wise matrix in CSV or Excel format."""
    if format not in ("csv", "xlsx"):
        raise HTTPException(status_code=422, detail="format must be csv or xlsx")

    try:
        file_bytes, filename = await attendance_service.generate_export(
            db=db, month=month, year=year, format=format, emp_id=emp_id
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    if format == "csv":
        media_type = "text/csv"
    else:
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    import io as _io
    return StreamingResponse(
        _io.BytesIO(file_bytes),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/stats")
async def get_attendance_stats(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Return attendance statistics for the given month/year."""
    stats = await attendance_service.compute_stats(db=db, month=month, year=year)
    return stats
