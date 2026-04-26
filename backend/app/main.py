from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from datetime import datetime

from app.config import settings
from app.database import init_db
from app.limiter import limiter, rate_limit_exceeded_handler
from app.routers import (
    auth_router, employees_router, attendance_router,
    leaves_router, payroll_router, holidays_router,
    attendance_hr_router, dashboard_router, audit_router,
    settings_router, reports_router,
    payroll_periods_router, salary_config_router,
    formulas_router, tax_router, deductions_router,
    salary_calculation_router, lifecycle_router,
    leave_encashment_router, arrears_router, approvals_router,
    compliance_router, payslips_router, salary_audit_router,
    salary_reports_router, bulk_operations_router,
    scheduler_router, insights_router,
    statutory_rates_router,
)
from app.models.user import User, UserRole
from app.utils.security import hash_password
from app.database import AsyncSessionLocal


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await create_default_admin()
    # Seed default attendance policy if not exists
    from app.database import AsyncSessionLocal
    from app.services.policy_service import seed_default_policy
    async with AsyncSessionLocal() as db:
        await seed_default_policy(db)
    yield


async def create_default_admin():
    async with AsyncSessionLocal() as db:
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.username == "admin"))
        admin = result.scalar_one_or_none()
        
        if not admin:
            admin_user = User(
                username="admin",
                password_hash=hash_password("admin123"),
                role=UserRole.ADMIN,
                is_active=True
            )
            db.add(admin_user)
            await db.commit()
            print("Default admin user created: admin / admin123")


app = FastAPI(
    title=settings.APP_NAME,
    description="Face Recognition Based Offline Attendance API",
    version="1.0.0",
    lifespan=lifespan
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(SlowAPIMiddleware)

app.include_router(auth_router, prefix="/api/auth")
app.include_router(employees_router, prefix="/api/employees")
# attendance_hr_router MUST be registered BEFORE attendance_router
# so that /api/attendance/manual, /api/attendance/daily/*, etc. are matched first
app.include_router(attendance_hr_router, prefix="/api/attendance")
app.include_router(attendance_router, prefix="/api/attendance")
app.include_router(leaves_router, prefix="/api/leaves")
# app.include_router(payroll_router, prefix="/api/payroll") # Disabled old Payroll API as per user request
app.include_router(holidays_router, prefix="/api/holidays")
app.include_router(dashboard_router, prefix="/api/dashboard")
app.include_router(audit_router, prefix="/api/audit")
app.include_router(settings_router, prefix="/api/settings")
app.include_router(reports_router, prefix="/api")
app.include_router(payroll_periods_router, prefix="/api/v1/payroll-periods")
app.include_router(salary_config_router, prefix="/api/v1/salary-configs")
app.include_router(formulas_router, prefix="/api/v1/formulas")
app.include_router(tax_router, prefix="/api/v1/tax")
app.include_router(deductions_router, prefix="/api/v1/deductions")
app.include_router(salary_calculation_router, prefix="/api/v1/payroll")
app.include_router(lifecycle_router, prefix="/api/v1/lifecycle")
app.include_router(leave_encashment_router, prefix="/api/v1/leave-encashment")
app.include_router(arrears_router, prefix="/api/v1/arrears")
app.include_router(approvals_router, prefix="/api/v1/approvals")
app.include_router(compliance_router, prefix="/api/v1/compliance")
app.include_router(payslips_router, prefix="/api/v1/payslips")
app.include_router(salary_audit_router, prefix="/api/v1/salary-audit")
app.include_router(salary_reports_router, prefix="/api/v1/salary-reports")
app.include_router(bulk_operations_router, prefix="/api/v1/bulk")
app.include_router(scheduler_router, prefix="/api/v1/scheduler")
app.include_router(insights_router, prefix="/api/v1/insights")
app.include_router(statutory_rates_router, prefix="/api/v1/statutory-rates")


@app.get("/")
async def root():
    return {
        "message": "Face Attendance API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/api/status")
async def server_status():
    """Heartbeat endpoint — SRS GET /v1/status"""
    try:
        from app.database import AsyncSessionLocal
        from app.models.user import User
        from app.models.employee import Employee
        from sqlalchemy import select
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User))
            users = [{"id": u.id, "username": u.username, "emp_id": u.emp_id, "role": u.role.value} for u in result.scalars().all()]
            
            emp_result = await db.execute(select(Employee))
            employees = [{"id": e.id, "emp_code": e.emp_code, "email": getattr(e, 'email', None), "name": getattr(e, 'name', getattr(e, 'first_name', ''))} for e in emp_result.scalars().all()]
            
            from app.models.salary_calculation import SalaryCalculation
            sc_result = await db.execute(select(SalaryCalculation))
            salary_calculations = [{"id": sc.id, "employee_id": sc.employee_id, "status": sc.status.value if hasattr(sc.status, 'value') else sc.status} for sc in sc_result.scalars().all()]
            
            from app.models.attendance import Attendance
            att_result = await db.execute(select(Attendance).order_by(Attendance.created_at.desc()).limit(20))
            attendance_records = [{"id": a.id, "emp_id": a.emp_id, "date": str(a.date), "time": str(a.time), "type": a.attendance_type.value if hasattr(a.attendance_type, 'value') else a.attendance_type} for a in att_result.scalars().all()]
            
            return {
                "status": "online",
                "users": users,
                "employees": employees,
                "salary_calculations": salary_calculations,
                "attendance_records": attendance_records
            }
    except Exception as e:
        return {"error": str(e)}

from fastapi import Request
@app.post("/api/debug/log")
async def debug_log(request: Request):
    data = await request.json()
    with open("frontend_crash.log", "a", encoding="utf-8") as f:
        f.write(f"\n--- CRASH AT {datetime.utcnow()} ---\n")
        f.write(str(data))
        f.write("\n")
    return {"status": "logged"}

from app.utils.deps import get_current_user
from fastapi import Depends
from app.models.user import User

@app.get("/api/debug/user")
async def debug_user(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "emp_id": current_user.emp_id,
        "role": current_user.role.value
    }
