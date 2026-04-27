from pydantic import BaseModel, EmailStr
from typing import Optional

class SMTPSettings(BaseModel):
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_password: str
    sender_email: EmailStr
    sender_name: str
    use_tls: bool = True
    app_url: str

class SMTPSettingsRead(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    sender_email: Optional[str] = None
    sender_name: Optional[str] = None
    use_tls: Optional[bool] = True
    app_url: Optional[str] = None
    # We don't send password back for security

class ResendWelcomeEmailRequest(BaseModel):
    emp_id: str
    username: str
    password: Optional[str] = None
