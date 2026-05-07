from fastapi import FastAPI, Request, Depends
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
    statutory_rates_router, company_router,
)
from app.routers.license import router as license_router
from app.models.user import User, UserRole
from app.utils.security import hash_password
from app.database import AsyncSessionLocal
from app.license_check import is_license_valid


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await create_default_admin()
    # Seed default attendance policy if not exists
    from app.services.policy_service import seed_default_policy
    async with AsyncSessionLocal() as db:
        await seed_default_policy(db)
    
    # Start Background Task for Attendance Cleanup
    import asyncio
    from app.tasks.attendance_cleanup import auto_cleanup_missing_punches
    
    async def schedule_cleanup():
        while True:
            now = datetime.now()
            # Run at 00:01 AM
            if now.hour == 0 and now.minute == 1:
                print(f"[{now}] Running scheduled attendance cleanup...")
                await auto_cleanup_missing_punches()
                # Sleep for 60 seconds to avoid multiple runs in the same minute
                await asyncio.sleep(61)
            # Check every 30 seconds
            await asyncio.sleep(30)

    # Run without blocking the main app
    asyncio.create_task(schedule_cleanup())
    
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

# ── LICENSE MIDDLEWARE ──
@app.middleware("http")
async def license_check_middleware(request: Request, call_next):
    # Exempt paths (Activation, Docs, Debug)
    exempt_paths = ["/api/v1/license/", "/docs", "/openapi.json", "/redoc", "/api/debug/", "/api/status"]
    
    is_exempt = any(request.url.path.startswith(p) for p in exempt_paths) or request.url.path == "/"
    
    if not is_exempt:
        from app.license_check import STATE_NORMAL, STATE_READ_ONLY, STATE_BLOCKED
        status, reason = is_license_valid()
        
        # 1. BLOCKED STATE -> Full block
        if status == STATE_BLOCKED:
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=402, # Payment Required
                content={
                    "detail": "LICENSE_BLOCKED",
                    "reason": reason,
                    "message": "License expired or blocked. Please upgrade/renew to continue."
                }
            )
            
        # 2. READ_ONLY STATE -> Block Writes/Exports
        if status == STATE_READ_ONLY:
            # Check if this is a "Write" or "Export" operation
            is_write = request.method in ["POST", "PUT", "DELETE", "PATCH"]
            is_export = "export" in request.url.path.lower()
            
            if is_write or is_export:
                from fastapi.responses import JSONResponse
                return JSONResponse(
                    status_code=403, # Forbidden
                    content={
                        "detail": "LICENSE_READ_ONLY",
                        "reason": reason,
                        "message": "System is in Read-Only mode due to connection issues. Please connect to internet to reactivate."
                    }
                )
            
            # Allow GET requests in Read-Only mode (Viewing is allowed)
            response = await call_next(request)
            # Add a custom header to inform frontend it's read-only
            response.headers["X-License-Status"] = "READ_ONLY"
            return response

    # 3. NORMAL STATE or EXEMPT -> Proceed normally
    response = await call_next(request)
    return response

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
app.include_router(attendance_hr_router, prefix="/api/attendance")
app.include_router(attendance_router, prefix="/api/attendance")
app.include_router(leaves_router, prefix="/api/leaves")
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
app.include_router(company_router, prefix="/api/v1/company")
app.include_router(license_router, prefix="/api/v1/license")


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
    """Heartbeat endpoint"""
    try:
        from sqlalchemy import select
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User))
            users = [{"id": u.id, "username": u.username, "role": u.role.value} for u in result.scalars().all()]
            return {"status": "online", "users": users}
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/debug/log")
async def debug_log(request: Request):
    data = await request.json()
    with open("frontend_crash.log", "a", encoding="utf-8") as f:
        f.write(f"\n--- CRASH AT {datetime.utcnow()} ---\n")
        f.write(str(data))
        f.write("\n")
    return {"status": "logged"}

from app.utils.deps import get_current_user
@app.get("/api/debug/user")
async def debug_user(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "username": current_user.username}
