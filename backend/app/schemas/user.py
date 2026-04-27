from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models.user import UserRole


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: Optional[str] = Field(None, min_length=6)
    role: UserRole = UserRole.EMPLOYEE
    emp_id: Optional[str] = None


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: str
    username: str
    role: UserRole
    emp_id: Optional[str] = None  # emp_id already present — Bug #1 resolved
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse
    must_change_password: bool = False
    refresh_token: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., min_length=6)
    new_password: str = Field(..., min_length=6)


class TokenData(BaseModel):
    user_id: str
    username: str
    role: UserRole
