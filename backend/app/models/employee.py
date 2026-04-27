from sqlalchemy import Column, String, Text, Boolean, DateTime, Enum as SQLEnum, Numeric, Date
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.database import Base


class EmployeeStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class Employee(Base):
    __tablename__ = "employees"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    emp_code = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=True)
    department = Column(String(50), nullable=True)
    face_descriptor = Column(Text, nullable=True)  # Encrypted JSON array
    face_enrolled = Column(Boolean, default=False)
    status = Column(SQLEnum(EmployeeStatus), default=EmployeeStatus.ACTIVE)
    salary = Column(Numeric(10, 2), nullable=True)
    is_confirmed = Column(Boolean, default=False)
    joining_date = Column(Date, nullable=True)
    probation_end_date = Column(Date, nullable=True)
    designation = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    photo_url = Column(Text, nullable=True)
    remarks   = Column(Text, nullable=True)
    
    # New Profile Fields
    aadhaar_no = Column(String(20), nullable=True)
    pan_no = Column(String(20), nullable=True)
    bank_name = Column(String(100), nullable=True)
    account_no = Column(String(50), nullable=True)
    ifsc_code = Column(String(20), nullable=True)
    current_address = Column(Text, nullable=True)
    permanent_address = Column(Text, nullable=True)
    emergency_name = Column(String(100), nullable=True)
    emergency_phone = Column(String(20), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="employee", uselist=False)
    attendances = relationship("Attendance", back_populates="employee")
