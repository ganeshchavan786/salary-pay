from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.policy import PolicyRead, PolicyUpdate
from app.services import policy_service
from app.utils.deps import require_supervisor, require_admin
from app.schemas.settings import SMTPSettings, SMTPSettingsRead
from sqlalchemy import select
from app.models.system_setting import SystemSetting
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

router = APIRouter(tags=["Settings"])


@router.get("/policy", response_model=PolicyRead)
async def get_policy(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_supervisor),
):
    """Get the current attendance policy."""
    policy = await policy_service.get_policy(db)
    return policy


@router.put("/policy", response_model=PolicyRead)
async def update_policy(
    body: PolicyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Update the attendance policy (admin only)."""
    updates = body.model_dump(exclude_none=True)
    policy = await policy_service.update_policy(db, updates)
    return policy

@router.get("/smtp", response_model=SMTPSettingsRead)
async def get_smtp_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Get SMTP settings (admin only)."""
    keys = ["smtp_host", "smtp_port", "smtp_user", "sender_email", "sender_name", "use_tls", "app_url"]
    result = await db.execute(select(SystemSetting).where(SystemSetting.key.in_(keys)))
    settings_dict = {s.key: s.value for s in result.scalars().all()}
    
    return SMTPSettingsRead(
        smtp_host=settings_dict.get("smtp_host"),
        smtp_port=int(settings_dict.get("smtp_port")) if settings_dict.get("smtp_port") else None,
        smtp_user=settings_dict.get("smtp_user"),
        sender_email=settings_dict.get("sender_email"),
        sender_name=settings_dict.get("sender_name"),
        use_tls=settings_dict.get("use_tls", "true").lower() == "true",
        app_url=settings_dict.get("app_url", "https://drne2yi2f6fd.share.zrok.io/employee")
    )

@router.put("/smtp")
async def update_smtp_settings(
    body: SMTPSettings,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Update SMTP settings (admin only)."""
    settings_data = body.model_dump()
    for key, value in settings_data.items():
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = str(value)
        else:
            db.add(SystemSetting(key=key, value=str(value), category="smtp"))
    
    await db.commit()
    return {"message": "SMTP settings updated successfully"}

@router.post("/smtp/test")
async def test_smtp_settings(
    body: SMTPSettings,
    current_user: User = Depends(require_admin),
):
    """Test SMTP settings by sending a test email."""
    try:
        msg = MIMEMultipart()
        msg['From'] = f"{body.sender_name} <{body.sender_email}>"
        msg['To'] = body.sender_email # Send to self
        msg['Subject'] = "HRMS SMTP Test Email"
        
        body_text = "This is a test email from your HRMS system to verify SMTP configuration."
        msg.attach(MIMEText(body_text, 'plain'))
        
        if body.smtp_port == 465:
            server = smtplib.SMTP_SSL(body.smtp_host, body.smtp_port, timeout=10)
        else:
            server = smtplib.SMTP(body.smtp_host, body.smtp_port, timeout=10)
            if body.use_tls:
                server.starttls()
        
        server.login(body.smtp_user, body.smtp_password)
        server.send_message(msg)
        server.quit()
        
        return {"message": "Test email sent successfully"}
    except Exception as e:
        return {"error": str(e), "message": "Failed to send test email"}
