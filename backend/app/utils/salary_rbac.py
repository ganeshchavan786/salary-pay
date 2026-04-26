from fastapi import HTTPException, status
from app.models.user import User, UserRole


SALARY_PERMISSIONS = {
    UserRole.ADMIN: [
        "payroll.period.create", "payroll.period.manage", "payroll.period.lock",
        "salary.calculate", "salary.approve", "salary.view.all",
        "deduction.manage", "loan.approve",
        "compliance.generate", "reports.all",
        "config.manage", "audit.view", "bulk.import",
    ],
    UserRole.SUPERVISOR: [
        "salary.view.team", "salary.approve.team",
        "reports.team", "audit.view.team",
    ],
}

# Employee role - basic access
EMPLOYEE_PERMISSIONS = [
    "salary.view.own", "documents.download.own",
    "loan.apply", "tax.declaration.submit",
]


def require_salary_permission(permission: str):
    """Dependency factory for salary permission checks"""
    def check_permission(current_user: User):
        user_role = current_user.role

        # Admin has all permissions
        if user_role == UserRole.ADMIN:
            return current_user

        allowed = SALARY_PERMISSIONS.get(user_role, [])

        if permission not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission}' required. Your role: {user_role.value}",
            )
        return current_user

    return check_permission


def mask_sensitive_fields(data: dict, user_role: UserRole) -> dict:
    """Mask sensitive salary fields based on user role"""
    if user_role == UserRole.ADMIN:
        return data

    masked = data.copy()
    sensitive_fields = ["bank_account", "pan_number", "aadhaar_number"]

    for field in sensitive_fields:
        if field in masked and masked[field]:
            value = str(masked[field])
            masked[field] = f"XXXX{value[-4:]}" if len(value) > 4 else "XXXX"

    return masked
