from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from typing import List, Optional
from datetime import date, datetime, timedelta
import uuid
import csv
import io
import base64

from app.database import get_db
from app.models.employee import Employee, EmployeeStatus
from app.models.leave import LeaveBalance
from app.models.user import User
from app.schemas.employee import (
    EmployeeCreate, EmployeeUpdate, EmployeeResponse,
    EmployeeWithDescriptor, FaceEnrollRequest,
    PhotoUploadRequest, BulkActionRequest, BulkActionResponse,
    BulkImportResponse, BulkImportError,
    EmployeeSummary, DepartmentReport, HeadcountReport,
    SalaryBucket, ProbationEmployee,
)
import types as _types
from app.models.policy import EmployeePolicyOverride
from app.schemas.policy import (
    EmployeePolicyOverrideRead, EmployeePolicyOverrideUpdate,
    EmployeePolicyResponse, PolicyRead,
)
from app.services.policy_service import get_policy
from app.services.payroll_service import get_effective_policy
from app.utils.deps import get_current_user, require_admin, require_supervisor
from app.utils.encryption import encrypt_descriptor, decrypt_descriptor

router = APIRouter(tags=["Employees"])

# ── Helpers ──────────────────────────────────────────────────────────────────

ALLOWED_PHOTO_PREFIXES = (
    "data:image/jpeg;base64,",
    "data:image/png;base64,",
    "data:image/webp;base64,",
)
MAX_PHOTO_BYTES = 5 * 1024 * 1024  # 5 MB


def validate_photo(photo_data: str) -> None:
    if not any(photo_data.startswith(p) for p in ALLOWED_PHOTO_PREFIXES):
        raise HTTPException(status_code=422, detail="File must be JPEG, PNG, or WebP")
    b64 = photo_data.split(",", 1)[1]
    raw_size = len(b64) * 3 // 4
    if raw_size > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=422, detail="File size exceeds 5 MB limit")


def _emp_to_dict(emp: Employee, include_descriptor: bool = False) -> dict:
    d = {
        "id": emp.id,
        "emp_code": emp.emp_code,
        "name": emp.name,
        "email": emp.email,
        "department": emp.department,
        "face_enrolled": emp.face_enrolled,
        "status": emp.status,
        "salary": float(emp.salary) if emp.salary else None,
        "designation": emp.designation,
        "joining_date": emp.joining_date.isoformat() if emp.joining_date else None,
        "is_confirmed": emp.is_confirmed or False,
        "probation_end_date": emp.probation_end_date.isoformat() if emp.probation_end_date else None,
        "phone": getattr(emp, "phone", None),
        "photo_url": getattr(emp, "photo_url", None),
        "remarks": getattr(emp, "remarks", None),
        "created_at": emp.created_at,
        "updated_at": emp.updated_at,
    }
    if include_descriptor and emp.face_descriptor:
        try:
            d["face_descriptor"] = decrypt_descriptor(emp.face_descriptor)
        except Exception:
            d["face_descriptor"] = None
    return d


# ── Static routes (MUST be before /{employee_id}) ────────────────────────────


# ── Per-employee policy override endpoints ────────────────────────────────────

@router.get("/{emp_id}/policy", response_model=EmployeePolicyResponse)
async def get_employee_policy(
    emp_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Get effective policy for an employee (company policy merged with override)."""
    emp = (await db.execute(select(Employee).where(Employee.id == emp_id))).scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    company_policy = await get_policy(db)
    override = (await db.execute(
        select(EmployeePolicyOverride).where(EmployeePolicyOverride.emp_id == emp_id)
    )).scalar_one_or_none()

    effective = get_effective_policy(company_policy, override)

    # Build PolicyRead from SimpleNamespace
    effective_read = PolicyRead(
        id=company_policy.id,
        shift_hours=effective.shift_hours,
        weekly_limit_hours=effective.weekly_limit_hours,
        break_time_minutes=effective.break_time_minutes,
        grace_period_minutes=effective.grace_period_minutes,
        allowed_late_marks_per_month=effective.allowed_late_marks_per_month,
        late_action=effective.late_action,
        min_working_hours_for_halfday=effective.min_working_hours_for_halfday,
        early_leaving_action=effective.early_leaving_action,
        consecutive_absent_threshold=effective.consecutive_absent_threshold,
        ot_enabled=effective.ot_enabled,
        ot_normal_multiplier=effective.ot_normal_multiplier,
        ot_holiday_multiplier=effective.ot_holiday_multiplier,
        weekly_off_day=effective.weekly_off_day,
        second_fourth_saturday_off=effective.second_fourth_saturday_off,
        comp_off_enabled=effective.comp_off_enabled,
        comp_off_expiry_days=effective.comp_off_expiry_days,
        missed_punch_requests_per_month=effective.missed_punch_requests_per_month,
        shift_type=effective.shift_type,
        shift_start_time=effective.shift_start_time,
        shift_end_time=effective.shift_end_time,
        night_shift_allowance=effective.night_shift_allowance,
        updated_at=company_policy.updated_at,
    )
    company_read = PolicyRead.model_validate(company_policy)

    return EmployeePolicyResponse(
        effective_policy=effective_read,
        override=EmployeePolicyOverrideRead.model_validate(override) if override else None,
        company_policy=company_read,
    )


@router.put("/{emp_id}/policy", response_model=EmployeePolicyOverrideRead)
async def set_employee_policy(
    emp_id: str,
    body: EmployeePolicyOverrideUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Create or update per-employee policy override."""
    emp = (await db.execute(select(Employee).where(Employee.id == emp_id))).scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    override = (await db.execute(
        select(EmployeePolicyOverride).where(EmployeePolicyOverride.emp_id == emp_id)
    )).scalar_one_or_none()

    if override is None:
        override = EmployeePolicyOverride(id=str(uuid.uuid4()), emp_id=emp_id)

    updates = body.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(override, key, value)
    override.updated_by = current_user.id
    override.updated_at = datetime.utcnow()

    db.add(override)
    await db.commit()
    await db.refresh(override)
    return EmployeePolicyOverrideRead.model_validate(override)


@router.delete("/{emp_id}/policy", status_code=204)
async def reset_employee_policy(
    emp_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Remove all policy overrides for an employee (reset to company defaults)."""
    emp = (await db.execute(select(Employee).where(Employee.id == emp_id))).scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    override = (await db.execute(
        select(EmployeePolicyOverride).where(EmployeePolicyOverride.emp_id == emp_id)
    )).scalar_one_or_none()

    if override:
        await db.delete(override)
        await db.commit()

    return Response(status_code=204)

@router.get("/summary", response_model=EmployeeSummary)
async def get_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Global employee stats counts."""
    total = (await db.execute(select(func.count(Employee.id)))).scalar() or 0
    active = (await db.execute(
        select(func.count(Employee.id)).where(Employee.status == EmployeeStatus.ACTIVE)
    )).scalar() or 0
    on_probation = (await db.execute(
        select(func.count(Employee.id)).where(
            and_(Employee.status == EmployeeStatus.ACTIVE, Employee.is_confirmed == False)
        )
    )).scalar() or 0
    face_enrolled = (await db.execute(
        select(func.count(Employee.id)).where(
            and_(Employee.status == EmployeeStatus.ACTIVE, Employee.face_enrolled == True)
        )
    )).scalar() or 0
    return EmployeeSummary(total=total, active=active, on_probation=on_probation, face_enrolled=face_enrolled)


@router.post("/bulk-import", response_model=BulkImportResponse)
async def bulk_import(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Bulk create employees from CSV file."""
    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=422, detail="File exceeds 2 MB limit")
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=422, detail="Invalid CSV file — must be UTF-8 encoded")

    reader = csv.DictReader(io.StringIO(text))
    required_cols = {"emp_code", "name"}
    if not required_cols.issubset(set(reader.fieldnames or [])):
        missing = required_cols - set(reader.fieldnames or [])
        raise HTTPException(status_code=422, detail=f"Missing required columns: {missing}")

    created = 0
    skipped = 0
    errors: List[BulkImportError] = []

    for row_num, row in enumerate(reader, start=2):
        emp_code = (row.get("emp_code") or "").strip()
        name = (row.get("name") or "").strip()

        if not emp_code or not name:
            errors.append(BulkImportError(row=row_num, emp_code=emp_code or None, reason="emp_code and name are required"))
            skipped += 1
            continue

        # Check duplicate
        existing = (await db.execute(select(Employee).where(Employee.emp_code == emp_code))).scalar_one_or_none()
        if existing:
            errors.append(BulkImportError(row=row_num, emp_code=emp_code, reason=f"emp_code '{emp_code}' already exists"))
            skipped += 1
            continue

        # Parse optional fields
        salary = None
        raw_salary = (row.get("salary") or "").strip()
        if raw_salary:
            try:
                salary = float(raw_salary)
                if salary < 0:
                    raise ValueError()
            except ValueError:
                errors.append(BulkImportError(row=row_num, emp_code=emp_code, reason="salary must be a non-negative number"))
                skipped += 1
                continue

        joining_date = None
        raw_date = (row.get("joining_date") or "").strip()
        if raw_date:
            try:
                joining_date = date.fromisoformat(raw_date)
            except ValueError:
                errors.append(BulkImportError(row=row_num, emp_code=emp_code, reason="joining_date must be YYYY-MM-DD"))
                skipped += 1
                continue

        emp = Employee(
            id=str(uuid.uuid4()),
            emp_code=emp_code,
            name=name,
            email=(row.get("email") or "").strip() or None,
            department=(row.get("department") or "").strip() or None,
            designation=(row.get("designation") or "").strip() or None,
            salary=salary,
            joining_date=joining_date,
            phone=(row.get("phone") or "").strip() or None,
        )
        db.add(emp)
        try:
            await db.flush()
        except Exception as e:
            await db.rollback()
            errors.append(BulkImportError(row=row_num, emp_code=emp_code, reason=str(e)))
            skipped += 1
            continue

        # Auto-create LeaveBalance
        db.add(LeaveBalance(
            id=str(uuid.uuid4()),
            emp_id=emp.id,
            year=date.today().year,
            cl_total=0,
        ))
        created += 1

    await db.commit()
    return BulkImportResponse(created=created, skipped=skipped, errors=errors)


@router.post("/bulk-action", response_model=BulkActionResponse)
async def bulk_action(
    body: BulkActionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Bulk confirm or deactivate employees."""
    result = await db.execute(select(Employee).where(Employee.id.in_(body.emp_ids)))
    employees = result.scalars().all()

    updated = 0
    if body.action == "confirm":
        current_year = date.today().year
        for emp in employees:
            if not emp.is_confirmed:
                emp.is_confirmed = True
                # Upsert leave balance
                bal = (await db.execute(
                    select(LeaveBalance).where(
                        and_(LeaveBalance.emp_id == emp.id, LeaveBalance.year == current_year)
                    )
                )).scalar_one_or_none()
                if bal:
                    bal.cl_total = 12
                else:
                    db.add(LeaveBalance(id=str(uuid.uuid4()), emp_id=emp.id, year=current_year, cl_total=12))
                updated += 1
    elif body.action == "deactivate":
        for emp in employees:
            if emp.status == EmployeeStatus.ACTIVE:
                emp.status = EmployeeStatus.INACTIVE
                updated += 1

    if updated == 0:
        raise HTTPException(status_code=400, detail=f"No eligible employees found for action '{body.action}'")

    await db.commit()
    return BulkActionResponse(action=body.action, updated=updated, message=f"{updated} employee(s) {body.action}d successfully")


@router.get("/export")
async def export_employees(
    format: str = Query("csv", pattern="^(csv|xlsx)$"),
    department: Optional[str] = None,
    status: Optional[EmployeeStatus] = None,
    is_confirmed: Optional[bool] = None,
    face_enrolled: Optional[bool] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export filtered employee list as CSV or Excel."""
    query = select(Employee)
    if department:
        query = query.where(Employee.department == department)
    if status:
        query = query.where(Employee.status == status)
    if is_confirmed is not None:
        query = query.where(Employee.is_confirmed == is_confirmed)
    if face_enrolled is not None:
        query = query.where(Employee.face_enrolled == face_enrolled)
    if search:
        query = query.where(or_(
            Employee.name.ilike(f"%{search}%"),
            Employee.emp_code.ilike(f"%{search}%"),
        ))
    query = query.limit(10000)
    result = await db.execute(query)
    employees = result.scalars().all()

    HEADERS = ["emp_code", "name", "email", "phone", "department", "designation",
               "salary", "joining_date", "probation_end_date", "is_confirmed",
               "face_enrolled", "status", "remarks"]

    def row_values(emp):
        return [
            emp.emp_code, emp.name, emp.email or "",
            getattr(emp, "phone", "") or "",
            emp.department or "", emp.designation or "",
            str(emp.salary) if emp.salary else "",
            emp.joining_date.isoformat() if emp.joining_date else "",
            emp.probation_end_date.isoformat() if emp.probation_end_date else "",
            str(emp.is_confirmed), str(emp.face_enrolled),
            emp.status.value if emp.status else "",
            getattr(emp, "remarks", "") or "",
        ]

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(HEADERS)
        for emp in employees:
            writer.writerow(row_values(emp))
        csv_bytes = output.getvalue().encode("utf-8")
        return Response(
            content=csv_bytes,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=employees.csv"},
        )
    else:
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "Employees"
        ws.append(HEADERS)
        for emp in employees:
            ws.append(row_values(emp))
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        return Response(
            content=buf.read(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=employees.xlsx"},
        )


@router.get("/reports/department", response_model=List[DepartmentReport])
async def report_department(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Department-wise active employee counts."""
    result = await db.execute(
        select(Employee.department, func.count(Employee.id).label("count"))
        .where(Employee.status == EmployeeStatus.ACTIVE)
        .group_by(Employee.department)
    )
    rows = result.all()
    return [DepartmentReport(department=r[0] or "Unassigned", count=r[1]) for r in rows]


@router.get("/reports/headcount", response_model=List[HeadcountReport])
async def report_headcount(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Monthly joining counts for trailing 12 months."""
    today = date.today()
    months = []
    for i in range(11, -1, -1):
        m = today.month - i
        y = today.year
        while m <= 0:
            m += 12
            y -= 1
        months.append((y, m))

    result = await db.execute(
        select(Employee.joining_date).where(Employee.joining_date.isnot(None))
    )
    all_dates = [r[0] for r in result.all()]

    counts = {}
    for y, m in months:
        key = f"{y:04d}-{m:02d}"
        counts[key] = sum(1 for d in all_dates if d.year == y and d.month == m)

    return [HeadcountReport(month=k, count=v) for k, v in counts.items()]


@router.get("/reports/salary", response_model=List[SalaryBucket])
async def report_salary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Salary distribution in fixed buckets."""
    result = await db.execute(
        select(Employee.salary).where(
            and_(Employee.status == EmployeeStatus.ACTIVE, Employee.salary.isnot(None))
        )
    )
    salaries = [float(r[0]) for r in result.all()]

    buckets = [
        ("0-25000", 0, 25000),
        ("25001-50000", 25001, 50000),
        ("50001-75000", 50001, 75000),
        ("75001-100000", 75001, 100000),
        ("100001+", 100001, float("inf")),
    ]
    return [
        SalaryBucket(range=label, count=sum(1 for s in salaries if lo <= s <= hi))
        for label, lo, hi in buckets
    ]


@router.get("/reports/probation", response_model=List[ProbationEmployee])
async def report_probation(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Employees with probation ending within 30 days."""
    today = date.today()
    cutoff = today + timedelta(days=30)
    result = await db.execute(
        select(Employee).where(
            and_(
                Employee.status == EmployeeStatus.ACTIVE,
                Employee.is_confirmed == False,
                Employee.probation_end_date.isnot(None),
                Employee.probation_end_date >= today,
                Employee.probation_end_date <= cutoff,
            )
        ).order_by(Employee.probation_end_date)
    )
    employees = result.scalars().all()
    return [
        ProbationEmployee(
            id=emp.id, emp_code=emp.emp_code, name=emp.name,
            department=emp.department, probation_end_date=emp.probation_end_date,
            is_confirmed=emp.is_confirmed or False,
        )
        for emp in employees
    ]


# ── List employees (with extended filters) ───────────────────────────────────

@router.get("", response_model=dict)
async def list_employees(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    department: Optional[str] = None,
    status: Optional[EmployeeStatus] = None,
    is_confirmed: Optional[bool] = None,
    face_enrolled: Optional[bool] = None,
    search: Optional[str] = None,
    include_descriptors: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Employee)
    count_query = select(func.count(Employee.id))

    filters = []
    if department:
        filters.append(Employee.department == department)
    if status:
        filters.append(Employee.status == status)
    if is_confirmed is not None:
        filters.append(Employee.is_confirmed == is_confirmed)
    if face_enrolled is not None:
        filters.append(Employee.face_enrolled == face_enrolled)
    if search:
        filters.append(or_(
            Employee.name.ilike(f"%{search}%"),
            Employee.emp_code.ilike(f"%{search}%"),
        ))

    for f in filters:
        query = query.where(f)
        count_query = count_query.where(f)

    total = (await db.execute(count_query)).scalar()
    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    employees = result.scalars().all()

    return {
        "employees": [_emp_to_dict(emp, include_descriptors) for emp in employees],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
    }


# ── Single employee ───────────────────────────────────────────────────────────

@router.get("/{employee_id}", response_model=EmployeeResponse)
async def get_employee(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return EmployeeResponse.model_validate(employee)


@router.post("", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    employee_data: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    # =====================================================================
    # FEATURE: Auto-Generate Employee Code (emp_code)
    # If the user leaves the emp_code field blank, the system will automatically
    # find the highest existing code that starts with "EMP" (e.g., EMP0042)
    # and generate the next sequential code (e.g., EMP0043).
    # =====================================================================
    emp_code = (employee_data.emp_code or "").strip()
    if not emp_code:
        # Step 1: Fetch all existing employee codes starting with "EMP"
        result = await db.execute(
            select(Employee.emp_code)
            .where(Employee.emp_code.like("EMP%"))
            .order_by(Employee.emp_code.desc())
        )
        all_codes = [r[0] for r in result.all()]
        
        # Step 2: Extract the numeric part to find the maximum number used so far
        max_num = 0
        for code in all_codes:
            # Slices the string from index 3 (skips "EMP") and checks if it's a number
            num_part = code[3:]  
            if num_part.isdigit():
                max_num = max(max_num, int(num_part))
                
        # Step 3: Generate the new code by adding 1 and padding with zeros (e.g., EMP0001)
        emp_code = f"EMP{max_num + 1:04d}"

    existing = (await db.execute(select(Employee).where(Employee.emp_code == emp_code))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Employee code already exists")

    # =====================================================================
    # FEATURE: Strict Duplicate Checking (Email, Phone)
    # We prevent creating an employee if another employee with the 
    # EXACT SAME Email or Phone number already exists.
    # Note: We ALLOW duplicate Names because two different people can 
    # have the exact same name (e.g. 'Ganesh Patil').
    # =====================================================================
    
    if employee_data.email:
        existing_email = (await db.execute(select(Employee).where(Employee.email.ilike(employee_data.email)))).scalar_one_or_none()
        if existing_email:
            raise HTTPException(status_code=400, detail=f"An employee with email '{employee_data.email}' already exists.")
            
    if employee_data.phone:
        existing_phone = (await db.execute(select(Employee).where(Employee.phone == employee_data.phone))).scalar_one_or_none()
        if existing_phone:
            raise HTTPException(status_code=400, detail=f"An employee with mobile number '{employee_data.phone}' already exists.")

    data = employee_data.model_dump()
    data["emp_code"] = emp_code  # Use auto-generated or provided code
    employee = Employee(**data)
    db.add(employee)
    await db.commit()
    await db.refresh(employee)

    # Auto-create LeaveBalance for current year
    leave_balance = LeaveBalance(
        id=str(uuid.uuid4()),
        emp_id=employee.id,
        year=date.today().year,
        cl_total=0,
    )
    db.add(leave_balance)
    await db.commit()

    return EmployeeResponse.model_validate(employee)


@router.put("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: str,
    employee_data: EmployeeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    for field, value in employee_data.model_dump(exclude_unset=True).items():
        setattr(employee, field, value)

    await db.commit()
    await db.refresh(employee)
    return EmployeeResponse.model_validate(employee)


@router.delete("/{employee_id}")
async def delete_employee(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    employee.status = EmployeeStatus.INACTIVE
    await db.commit()
    return {"message": "Employee deactivated successfully"}


# ── Photo endpoints ───────────────────────────────────────────────────────────

@router.post("/{employee_id}/photo")
async def upload_photo(
    employee_id: str,
    body: PhotoUploadRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Upload or replace employee profile photo (base64 data URI)."""
    validate_photo(body.photo_data)
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    employee.photo_url = body.photo_data
    await db.commit()
    return {"photo_url": employee.photo_url}


@router.delete("/{employee_id}/photo")
async def delete_photo(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Remove employee profile photo."""
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    employee.photo_url = None
    await db.commit()
    return {"photo_url": None}


# ── Face enrollment endpoints ─────────────────────────────────────────────────

@router.post("/{employee_id}/enroll-face")
async def enroll_face(
    employee_id: str,
    face_data: FaceEnrollRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    if len(face_data.face_descriptors) < 5:
        raise HTTPException(status_code=400, detail="Minimum 5 face samples required")

    num_samples = len(face_data.face_descriptors)
    descriptor_length = len(face_data.face_descriptors[0])
    avg_descriptor = [
        sum(d[i] for d in face_data.face_descriptors) / num_samples
        for i in range(descriptor_length)
    ]
    employee.face_descriptor = encrypt_descriptor(avg_descriptor)
    employee.face_enrolled = True
    await db.commit()
    return {"status": "success", "message": "Face enrolled successfully", "employee_id": employee_id, "samples_processed": num_samples}


@router.get("/{employee_id}/face-status")
async def get_face_status(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"employee_id": employee_id, "face_enrolled": employee.face_enrolled, "enrolled_at": employee.updated_at if employee.face_enrolled else None}


@router.put("/{employee_id}/confirm")
async def confirm_employee(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Confirm employee (end probation) and credit 12 CL leaves."""
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    employee.is_confirmed = True
    await db.flush()

    current_year = date.today().year
    bal = (await db.execute(
        select(LeaveBalance).where(and_(LeaveBalance.emp_id == employee_id, LeaveBalance.year == current_year))
    )).scalar_one_or_none()
    if bal:
        bal.cl_total = 12
    else:
        db.add(LeaveBalance(id=str(uuid.uuid4()), emp_id=employee_id, year=current_year, cl_total=12))

    await db.commit()
    await db.refresh(employee)
    return {"message": f"{employee.name} confirmed! 12 CL leaves credited.", "employee": EmployeeResponse.model_validate(employee)}


@router.delete("/{employee_id}/face")
async def delete_face(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    employee.face_descriptor = None
    employee.face_enrolled = False
    await db.commit()
    return {"message": "Face data removed successfully"}
