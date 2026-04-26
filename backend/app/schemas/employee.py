from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Literal
from datetime import datetime, date
from decimal import Decimal
from app.models.employee import EmployeeStatus


class EmployeeCreate(BaseModel):
    emp_code: Optional[str] = Field(None, max_length=20)  # Auto-generated as EMP0001 if not provided
    name: str = Field(..., min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    department: Optional[str] = None
    # HR fields
    salary: Optional[Decimal] = None
    designation: Optional[str] = None
    joining_date: Optional[date] = None
    phone: Optional[str] = None
    photo_url: Optional[str] = None
    remarks: Optional[str] = None


class EmployeeUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    email: Optional[EmailStr] = None
    department: Optional[str] = None
    status: Optional[EmployeeStatus] = None
    # HR fields
    salary: Optional[Decimal] = None
    designation: Optional[str] = None
    joining_date: Optional[date] = None
    phone: Optional[str] = None
    photo_url: Optional[str] = None
    remarks: Optional[str] = None


class EmployeeResponse(BaseModel):
    id: str
    emp_code: str
    name: str
    email: Optional[str] = None
    department: Optional[str] = None
    face_enrolled: bool
    status: EmployeeStatus
    # HR fields
    salary: Optional[Decimal] = None
    designation: Optional[str] = None
    joining_date: Optional[date] = None
    is_confirmed: bool = False
    probation_end_date: Optional[date] = None
    phone: Optional[str] = None
    photo_url: Optional[str] = None
    remarks: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EmployeeWithDescriptor(EmployeeResponse):
    face_descriptor: Optional[List[float]] = None


class FaceEnrollRequest(BaseModel):
    face_descriptors: List[List[float]] = Field(..., min_length=5, max_length=10)


# ── New schemas for employee management feature ──────────────────────────────

class PhotoUploadRequest(BaseModel):
    photo_data: str  # base64 data URI: "data:image/jpeg;base64,..."


class BulkActionRequest(BaseModel):
    action: Literal["confirm", "deactivate"]
    emp_ids: List[str] = Field(..., min_length=1)


class BulkActionResponse(BaseModel):
    action: str
    updated: int
    message: str


class BulkImportError(BaseModel):
    row: int
    emp_code: Optional[str] = None
    reason: str


class BulkImportResponse(BaseModel):
    created: int
    skipped: int
    errors: List[BulkImportError]


class EmployeeSummary(BaseModel):
    total: int
    active: int
    on_probation: int
    face_enrolled: int


class DepartmentReport(BaseModel):
    department: str
    count: int


class HeadcountReport(BaseModel):
    month: str  # "YYYY-MM"
    count: int


class SalaryBucket(BaseModel):
    range: str
    count: int


class ProbationEmployee(BaseModel):
    id: str
    emp_code: str
    name: str
    department: Optional[str] = None
    probation_end_date: Optional[date] = None
    is_confirmed: bool = False
