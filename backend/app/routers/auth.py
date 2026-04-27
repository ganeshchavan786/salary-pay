from fastapi import APIRouter, Depends, HTTPException, status, Body, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta
from jose import jwt, JWTError

from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserResponse, Token, ChangePasswordRequest
from app.utils.security import hash_password, verify_password, create_access_token, create_refresh_token
from app.utils.deps import get_current_user, require_admin
from app.config import settings
from app.limiter import limiter

import secrets
import string

def generate_random_password(length=10):
    """Generate a secure random password."""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for i in range(length))

router = APIRouter(tags=["Authentication"])
DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_PASSWORD = "admin123"


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is disabled"
        )
        
    if not user.emp_id and user.role != UserRole.ADMIN:
        from app.models.employee import Employee
        emp_result = await db.execute(select(Employee).where(
            (Employee.emp_code == user.username) | 
            (Employee.email == user.username)
        ))
        emp = emp_result.scalar_one_or_none()
        if emp:
            user.emp_id = emp.id
            await db.commit()
            await db.refresh(user)

    
    access_token = create_access_token(
        user_id=user.id,
        username=user.username,
        role=user.role,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    refresh_token = create_refresh_token(
        user_id=user.id,
        username=user.username,
        role=user.role
    )
    must_change_password = (
        user.username == DEFAULT_ADMIN_USERNAME and
        form_data.password == DEFAULT_ADMIN_PASSWORD
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user),
        must_change_password=must_change_password,
        refresh_token=refresh_token
    )


@router.post("/refresh", response_model=Token)
async def refresh_token_endpoint(
    refresh_token: str = Body(..., embed=True),
    db: AsyncSession = Depends(get_db)
):
    try:
        # Decode the refresh token
        payload = jwt.decode(refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        
        # Validate token type
        token_type = payload.get("type")
        if token_type != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type"
            )
        
        # Extract user_id from token
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload"
            )
        
        # Look up user in database
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is disabled"
            )
        
        # Generate new access token
        new_access_token = create_access_token(
            user_id=user.id,
            username=user.username,
            role=user.role,
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        
        # Optionally generate new refresh token
        new_refresh_token = create_refresh_token(
            user_id=user.id,
            username=user.username,
            role=user.role
        )
        
        return Token(
            access_token=new_access_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserResponse.model_validate(user),
            must_change_password=False,
            refresh_token=new_refresh_token
        )
        
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.post("/register", response_model=UserResponse)
async def register_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    result = await db.execute(select(User).where(User.username == user_data.username))
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    password_to_send = user_data.password
    if not password_to_send:
        password_to_send = generate_random_password()
        
    new_user = User(
        username=user_data.username,
        password_hash=hash_password(password_to_send),
        role=user_data.role,
        emp_id=user_data.emp_id
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Automatically send welcome email if it's an employee login
    if new_user.role == "EMPLOYEE" and new_user.emp_id:
        from app.models.employee import Employee
        from app.utils.notification_service import notification_service
        
        result = await db.execute(select(Employee).where(Employee.id == new_user.emp_id))
        employee = result.scalar_one_or_none()
        
        if employee and employee.email:
            try:
                # Get app URL from settings or use a default
                from app.models.system_setting import SystemSetting
                res = await db.execute(select(SystemSetting).where(SystemSetting.key == "app_url"))
                app_url_setting = res.scalar_one_or_none()
                app_url = app_url_setting.value if app_url_setting else "https://drne2yi2f6fd.share.zrok.io/employee"
                
                await notification_service.send_notification(
                    recipient_email=employee.email,
                    template_key="welcome_pwa",
                    variables={
                        "employee_name": employee.name,
                        "username": new_user.username,
                        "password": password_to_send, # Use the generated/provided password
                        "company_name": "SalaryPay HR",
                        "app_url": app_url
                    }
                )
            except Exception as e:
                import logging
                logging.error(f"Failed to send welcome email: {e}")
    
    return UserResponse.model_validate(new_user)


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not verify_password(payload.old_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    if payload.old_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password"
        )

    current_user.password_hash = hash_password(payload.new_password)
    await db.commit()

    return {"message": "Password changed successfully"}
from app.schemas.settings import ResendWelcomeEmailRequest

@router.post("/resend-welcome-email")
async def resend_welcome_email(
    payload: ResendWelcomeEmailRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Manual trigger to send/resend welcome email with credentials."""
    from app.models.employee import Employee
    from app.utils.notification_service import notification_service
    from app.models.system_setting import SystemSetting
    
    result = await db.execute(select(Employee).where(Employee.id == payload.emp_id))
    employee = result.scalar_one_or_none()
    
    if not employee or not employee.email:
        raise HTTPException(status_code=400, detail="Employee not found or has no email")
        
    try:
        # Update password in DB if user exists
        from app.models.user import User
        from app.routers.auth import hash_password
        
        password_to_send = payload.password
        if not password_to_send:
            password_to_send = generate_random_password()
            
        user_result = await db.execute(select(User).where(User.emp_id == payload.emp_id))
        user = user_result.scalar_one_or_none()
        
        if user:
            user.password_hash = hash_password(password_to_send)
            # If username changed, update it too (optional but helpful)
            user.username = payload.username
            await db.commit()
            
        res = await db.execute(select(SystemSetting).where(SystemSetting.key == "app_url"))
        app_url_setting = res.scalar_one_or_none()
        app_url = app_url_setting.value if app_url_setting else "https://drne2yi2f6fd.share.zrok.io/employee"
        
        await notification_service.send_notification(
            recipient_email=employee.email,
            template_key="welcome_pwa",
            variables={
                "employee_name": employee.name,
                "username": payload.username,
                "password": password_to_send,
                "company_name": "SalaryPay HR",
                "app_url": app_url
            }
        )
        return {"message": "Password reset and welcome email sent successfully"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to reset/send email: {str(e)}")
