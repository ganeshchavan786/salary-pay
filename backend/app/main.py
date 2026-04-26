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
    return {
        "status": "online",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }
