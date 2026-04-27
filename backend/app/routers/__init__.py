from app.routers.auth import router as auth_router
from app.routers.employees import router as employees_router
from app.routers.attendance import router as attendance_router
from app.routers.leaves import router as leaves_router
from app.routers.payroll import router as payroll_router
from app.routers.holidays import router as holidays_router
from app.routers.attendance_hr import router as attendance_hr_router
from app.routers.dashboard import router as dashboard_router
from app.routers.audit import router as audit_router
from app.routers.settings import router as settings_router
from app.routers.reports import router as reports_router
from app.routers.payroll_periods import router as payroll_periods_router
from app.routers.salary_config import router as salary_config_router
from app.routers.formulas import router as formulas_router
from app.routers.tax import router as tax_router
from app.routers.deductions import router as deductions_router
from app.routers.salary_calculation import router as salary_calculation_router
from app.routers.lifecycle import router as lifecycle_router
from app.routers.leave_encashment import router as leave_encashment_router
from app.routers.arrears import router as arrears_router
from app.routers.approvals import router as approvals_router
from app.routers.compliance import router as compliance_router
from app.routers.payslips import router as payslips_router
from app.routers.salary_audit import router as salary_audit_router
from app.routers.salary_reports import router as salary_reports_router
from app.routers.bulk_operations import router as bulk_operations_router
from app.routers.scheduler import router as scheduler_router
from app.routers.insights import router as insights_router
from app.routers.statutory_rates import router as statutory_rates_router
from app.routers.company import router as company_router

__all__ = [
    "auth_router",
    "employees_router",
    "attendance_router",
    "leaves_router",
    "payroll_router",
    "holidays_router",
    "attendance_hr_router",
    "dashboard_router",
    "audit_router",
    "settings_router",
    "reports_router",
    "payroll_periods_router",
    "salary_config_router",
    "formulas_router",
    "tax_router",
    "deductions_router",
    "salary_calculation_router",
    "lifecycle_router",
    "leave_encashment_router",
    "arrears_router",
    "approvals_router",
    "compliance_router",
    "payslips_router",
    "salary_audit_router",
    "salary_reports_router",
    "bulk_operations_router",
    "scheduler_router",
    "insights_router",
    "statutory_rates_router",
    "company_router",
]
